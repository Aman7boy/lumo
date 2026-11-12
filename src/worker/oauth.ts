// Customer account connections. Google and Microsoft use the same framework:
// authorization-code + PKCE, single-use state rows, encrypted access and
// refresh tokens, and per-service rows in tool_accounts so the existing Agent
// Engine and permission manager can bind an exact account to an exact agent.
//
// The platform never falls back to an owner mailbox or key. If a workspace has
// not connected an account, the tool is simply unavailable.

import type { Hono } from 'hono'

import type { ConnectedAccount, OAuthStatus } from '../shared/types'
import type { AppEnv } from './context'
import { credentialEncryptionConfigured, oauthClientContext, openSecret, sealSecret } from './crypto'
import { audit, now, uid, type Env } from './store'

type ProviderKey = 'google' | 'microsoft'

interface ProviderConfig {
  key: ProviderKey
  name: string
  authUrl: string
  tokenUrl: string
  profileUrl: string
  revokeUrl: string | null
  baseScopes: string[]
  capabilities: Array<{ key: string; label: string; scopes: string[]; tools: string[] }>
  envClientId: keyof Env
  envClientSecret: keyof Env
}

export const OAUTH_PROVIDERS: Record<ProviderKey, ProviderConfig> = {
  google: {
    key: 'google',
    name: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    baseScopes: ['openid', 'email', 'profile'],
    capabilities: [
      { key: 'gmail_read', label: 'Read and summarise Gmail', scopes: ['https://www.googleapis.com/auth/gmail.readonly'], tools: ['gmail'] },
      {
        key: 'gmail_draft',
        label: 'Draft Gmail replies',
        scopes: ['https://www.googleapis.com/auth/gmail.compose'],
        tools: ['gmail'],
      },
      {
        key: 'gmail_send',
        label: 'Send Gmail (approval enforced)',
        scopes: ['https://www.googleapis.com/auth/gmail.send'],
        tools: ['gmail'],
      },
      {
        key: 'gmail_labels',
        label: 'Organise Gmail labels',
        scopes: ['https://www.googleapis.com/auth/gmail.modify'],
        tools: ['gmail'],
      },
      { key: 'sheets', label: 'Read and edit Google Sheets', scopes: ['https://www.googleapis.com/auth/spreadsheets'], tools: ['sheets'] },
      { key: 'drive', label: 'List Google Drive files', scopes: ['https://www.googleapis.com/auth/drive.readonly'], tools: ['drive'] },
      { key: 'docs', label: 'Read Google Docs', scopes: ['https://www.googleapis.com/auth/documents.readonly'], tools: ['docs'] },
      {
        key: 'calendar',
        label: 'Read and create Calendar events',
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
        tools: ['calendar'],
      },
    ],
    envClientId: 'GOOGLE_CLIENT_ID',
    envClientSecret: 'GOOGLE_CLIENT_SECRET',
  },
  microsoft: {
    key: 'microsoft',
    name: 'Microsoft',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    profileUrl: 'https://graph.microsoft.com/v1.0/me',
    revokeUrl: null,
    baseScopes: ['openid', 'email', 'profile', 'offline_access', 'User.Read'],
    capabilities: [
      { key: 'outlook_read', label: 'Read Outlook mail', scopes: ['Mail.Read'], tools: ['outlook'] },
      { key: 'outlook_send', label: 'Send Outlook mail (approval enforced)', scopes: ['Mail.Send'], tools: ['outlook'] },
      { key: 'onedrive', label: 'List OneDrive files', scopes: ['Files.Read'], tools: ['onedrive'] },
      { key: 'excel', label: 'Read Excel workbooks', scopes: ['Files.ReadWrite'], tools: ['excel'] },
      { key: 'calendar', label: 'Read and create Outlook events', scopes: ['Calendars.ReadWrite'], tools: ['calendar'] },
    ],
    envClientId: 'MICROSOFT_CLIENT_ID',
    envClientSecret: 'MICROSOFT_CLIENT_SECRET',
  },
}

// crypto.ts exports accountSecretContext; tokens use a group-scoped context.
function oauthSecretContextForToken(workspaceId: string, groupId: string, field: 'access' | 'refresh'): string {
  return `oauth:${workspaceId}:${groupId}:${field}`
}

export function isOAuthProvider(value: string): value is ProviderKey {
  return value === 'google' || value === 'microsoft'
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomHex(length: number): string {
  return [...crypto.getRandomValues(new Uint8Array(length))].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return base64Url(new Uint8Array(digest))
}

export function redirectUriFor(base: string, provider: ProviderKey): string {
  return `${base.replace(/\/$/, '')}/api/oauth/${provider}/callback`
}

function publicBase(c: any): string {
  return String(c.env.PUBLIC_BASE_URL ?? new URL(c.req.url).origin).replace(/\/$/, '')
}

export async function oauthClientFor(
  env: Env,
  workspaceId: string,
  provider: ProviderKey,
): Promise<{ clientId: string; clientSecret: string; source: 'platform' | 'workspace' } | null> {
  const row = await env.DB.prepare('SELECT * FROM oauth_clients WHERE workspace_id = ? AND provider = ?')
    .bind(workspaceId, provider)
    .first<any>()
  if (row) {
    try {
      const secret = await openSecret(env, row.client_secret, oauthClientContext(workspaceId, provider))
      if (row.client_id && secret) return { clientId: row.client_id, clientSecret: secret, source: 'workspace' }
    } catch {
      return null
    }
  }
  const config = OAUTH_PROVIDERS[provider]
  const clientId = String(env[config.envClientId] ?? '').trim()
  const clientSecret = String(env[config.envClientSecret] ?? '').trim()
  if (clientId && clientSecret) return { clientId, clientSecret, source: 'platform' }
  return null
}

export function scopesFor(provider: ProviderKey, capabilities: string[]): { scopes: string[]; selected: string[] } {
  const config = OAUTH_PROVIDERS[provider]
  const selected = config.capabilities.filter((capability) => capabilities.includes(capability.key))
  const scopes = new Set(config.baseScopes)
  for (const capability of selected) for (const scope of capability.scopes) scopes.add(scope)
  return { scopes: [...scopes], selected: selected.map((capability) => capability.key) }
}

export function capabilityScopes(provider: ProviderKey): OAuthStatus['scopes'] {
  return OAUTH_PROVIDERS[provider].capabilities.map((capability) => ({
    key: capability.key,
    label: capability.label,
    scopes: capability.scopes,
  }))
}

export async function buildAuthorizationUrl(options: {
  env: Env
  workspaceId: string
  provider: ProviderKey
  capabilities: string[]
  base: string
  groupId?: string
}): Promise<{ url: string; redirectUri: string; scopes: string[] } | { error: string; detail?: string }> {
  const { env, workspaceId, provider, capabilities, base } = options
  const config = OAUTH_PROVIDERS[provider]
  const client = await oauthClientFor(env, workspaceId, provider)
  if (!client) {
    return {
      error: `${config.name} OAuth is not configured for this deployment.`,
      detail: `Add ${String(config.envClientId)} and ${String(config.envClientSecret)} as server secrets, or save a workspace OAuth client, then retry.`,
    }
  }
  if (!credentialEncryptionConfigured(env)) {
    return { error: 'Credential encryption is not configured, so OAuth tokens cannot be stored securely.', detail: 'Set CREDENTIAL_KEY on the server.' }
  }
  const { scopes } = scopesFor(provider, capabilities)
  const state = randomHex(24)
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)))
  const challenge = await sha256Base64Url(verifier)
  const redirectUri = redirectUriFor(base, provider)
  await env.DB.prepare('DELETE FROM oauth_states WHERE expires_at < ?').bind(now()).run()
  await env.DB.prepare(
    `INSERT INTO oauth_states (state, workspace_id, tool, connected_account_id, created_at, expires_at, provider, code_verifier, redirect_uri, scopes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(state, workspaceId, provider, options.groupId ?? '', now(), now() + 10 * 60 * 1000, provider, verifier, redirectUri, scopes.join(' '))
    .run()

  const params = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  if (provider === 'google') params.set('login_hint', '')
  return { url: `${config.authUrl}?${params.toString()}`, redirectUri, scopes }
}

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

async function tokenRequest(config: ProviderConfig, body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(20_000),
  })
  const data = (await response.json().catch(() => ({}))) as TokenResponse
  if (!response.ok || data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || `Token endpoint returned HTTP ${response.status}.`)
  }
  return data
}

export async function exchangeCodeForWorkspace(
  env: Env,
  workspaceId: string,
  provider: ProviderKey,
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const client = await oauthClientFor(env, workspaceId, provider)
  if (!client) throw new Error('OAuth client is not configured for this workspace.')
  return tokenRequest(OAUTH_PROVIDERS[provider], {
    grant_type: 'authorization_code',
    code,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  })
}

export async function fetchProfile(provider: ProviderKey, accessToken: string): Promise<{ id: string; email: string; name: string }> {
  const config = OAUTH_PROVIDERS[provider]
  const response = await fetch(config.profileUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Could not read the ${config.name} profile (HTTP ${response.status}).`)
  const data = (await response.json()) as any
  const email = String(data.email ?? data.mail ?? data.userPrincipalName ?? '').toLowerCase()
  if (!email) throw new Error(`The ${config.name} profile did not include an email address.`)
  return { id: String(data.sub ?? data.id ?? email), email, name: String(data.name ?? data.displayName ?? email) }
}

async function sealToken(env: Env, value: string, context: string): Promise<string> {
  return value ? sealSecret(env, value, context) : ''
}

function serviceTools(provider: ProviderKey, grantedScopes: string[]): string[] {
  const config = OAUTH_PROVIDERS[provider]
  const granted = new Set(grantedScopes)
  const tools = new Set<string>()
  for (const capability of config.capabilities) {
    if (capability.scopes.every((scope) => granted.has(scope))) {
      for (const tool of capability.tools) tools.add(tool)
    }
  }
  return [...tools]
}

export async function connectAccountFromCode(options: {
  env: Env
  workspaceId: string
  provider: ProviderKey
  code: string
  verifier: string
  redirectUri: string
  groupId?: string
}): Promise<{ groupId: string; email: string }> {
  const { env, workspaceId, provider } = options
  const token = await exchangeCodeForWorkspace(env, workspaceId, provider, options.code, options.verifier, options.redirectUri)
  const accessToken = String(token.access_token)
  const profile = await fetchProfile(provider, accessToken)
  const grantedScopes = String(token.scope ?? '')
    .split(/\s+/)
    .filter(Boolean)
  const tools = serviceTools(provider, grantedScopes)
  const groupId = options.groupId || (await existingGroupForEmail(env, workspaceId, provider, profile.email)) || uid('oag_')
  const context = (field: 'access' | 'refresh') => oauthSecretContextForToken(workspaceId, groupId, field)
  const sealedAccess = await sealToken(env, accessToken, context('access'))
  const sealedRefresh = await sealToken(env, String(token.refresh_token ?? ''), context('refresh'))
  const expiresAt = now() + Math.max(60, Number(token.expires_in ?? 3600)) * 1000
  const timestamp = now()

  for (const tool of tools) {
    const existing = await env.DB.prepare('SELECT id FROM tool_accounts WHERE workspace_id = ? AND tool = ? AND label = ?')
      .bind(workspaceId, tool, profile.email)
      .first<{ id: string }>()
    const accountId = existing?.id ?? uid('acc_')
    await env.DB.prepare(
      `INSERT INTO tool_accounts (id, workspace_id, tool, label, owner, via, external_id, fields, permissions, status, created_at, updated_at,
        provider, email, scopes, access_token, refresh_token, token_expires_at, last_connected_at, last_error, oauth_group)
       VALUES (?, ?, ?, ?, ?, 'oauth', ?, '{}', 'read', 'connected', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
       ON CONFLICT(workspace_id, tool, label) DO UPDATE SET
         owner = excluded.owner, via = 'oauth', status = 'connected', updated_at = excluded.updated_at,
         provider = excluded.provider, email = excluded.email,
         scopes = CASE WHEN excluded.refresh_token = '' THEN tool_accounts.scopes ELSE excluded.scopes END,
         access_token = excluded.access_token,
         refresh_token = CASE WHEN excluded.refresh_token = '' THEN tool_accounts.refresh_token ELSE excluded.refresh_token END,
         token_expires_at = excluded.token_expires_at, last_connected_at = excluded.last_connected_at,
         last_error = NULL, oauth_group = excluded.oauth_group`,
    )
      .bind(
        accountId,
        workspaceId,
        tool,
        profile.email,
        profile.email,
        profile.id,
        timestamp,
        timestamp,
        provider,
        profile.email,
        grantedScopes.join(' '),
        sealedAccess,
        sealedRefresh,
        expiresAt,
        timestamp,
        groupId,
      )
      .run()
    await env.DB.prepare(
      `INSERT INTO integrations (workspace_id, tool, status, account_label, fields, connected_at) VALUES (?, ?, 'connected', ?, '{}', ?)
       ON CONFLICT(workspace_id, tool) DO UPDATE SET status = 'connected', account_label = excluded.account_label, connected_at = excluded.connected_at`,
    )
      .bind(workspaceId, tool, `${profile.email} · ${OAUTH_PROVIDERS[provider].name}`, timestamp)
      .run()
  }

  if (tools.length) {
    await env.DB.prepare(
      `DELETE FROM tool_accounts WHERE workspace_id = ? AND oauth_group = ? AND label = ? AND provider = ? AND tool NOT IN (${tools.map(() => '?').join(',')})`,
    )
      .bind(workspaceId, groupId, profile.email, provider, ...tools)
      .run()
  } else {
    await env.DB.prepare('DELETE FROM tool_accounts WHERE workspace_id = ? AND oauth_group = ? AND label = ? AND provider = ?')
      .bind(workspaceId, groupId, profile.email, provider)
      .run()
  }

  await audit(env.DB, workspaceId, 'oauth', `oauth.${provider}.connect`, groupId, `${profile.email} · ${tools.join(', ') || 'no service scopes'}`, null)
  return { groupId, email: profile.email }
}

async function existingGroupForEmail(env: Env, workspaceId: string, provider: ProviderKey, email: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT oauth_group FROM tool_accounts WHERE workspace_id = ? AND provider = ? AND label = ? LIMIT 1')
    .bind(workspaceId, provider, email)
    .first<{ oauth_group: string | null }>()
  return row?.oauth_group ?? null
}

export async function ensureAccountToken(env: Env, account: any): Promise<string> {
  const workspaceId = String(account.workspace_id)
  const groupId = String(account.oauth_group || account.id)
  const encrypted = String(account.access_token ?? '')
  const expiresAt = Number(account.token_expires_at ?? 0)
  if (encrypted && expiresAt > now() + 90_000) {
    return openSecret(env, encrypted, oauthSecretContextForToken(workspaceId, groupId, 'access'))
  }
  const refresh = await openSecret(env, account.refresh_token ?? '', oauthSecretContextForToken(workspaceId, groupId, 'refresh'))
  if (!refresh) throw new Error('This account has no refresh token. Reconnect it to grant access again.')
  const provider = (account.provider === 'microsoft' ? 'microsoft' : 'google') as ProviderKey
  const client = await oauthClientFor(env, workspaceId, provider)
  if (!client) throw new Error(`${OAUTH_PROVIDERS[provider].name} OAuth is not configured.`)
  let token: TokenResponse
  try {
    token = await tokenRequest(OAUTH_PROVIDERS[provider], {
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: client.clientId,
      client_secret: client.clientSecret,
    })
  } catch (error) {
    await env.DB.prepare("UPDATE tool_accounts SET status = 'error', last_error = ? WHERE workspace_id = ? AND oauth_group = ?")
      .bind(String((error as Error).message).slice(0, 300), workspaceId, groupId)
      .run()
    throw error
  }
  const access = String(token.access_token)
  const newRefresh = String(token.refresh_token ?? refresh)
  const sealedAccess = await sealToken(env, access, oauthSecretContextForToken(workspaceId, groupId, 'access'))
  const sealedRefresh = await sealToken(env, newRefresh, oauthSecretContextForToken(workspaceId, groupId, 'refresh'))
  const newExpiry = now() + Math.max(60, Number(token.expires_in ?? 3600)) * 1000
  await env.DB.prepare(
    "UPDATE tool_accounts SET access_token = ?, refresh_token = ?, token_expires_at = ?, status = 'connected', last_error = NULL WHERE workspace_id = ? AND oauth_group = ?",
  )
    .bind(sealedAccess, sealedRefresh, newExpiry, workspaceId, groupId)
    .run()
  return access
}

export async function revokeAccount(env: Env, account: any): Promise<void> {
  const provider = (account.provider === 'microsoft' ? 'microsoft' : 'google') as ProviderKey
  const config = OAUTH_PROVIDERS[provider]
  if (!config.revokeUrl) return
  const groupId = String(account.oauth_group || account.id)
  let token = ''
  try {
    token = await openSecret(env, account.refresh_token || account.access_token, oauthSecretContextForToken(String(account.workspace_id), groupId, account.refresh_token ? 'refresh' : 'access'))
  } catch {
    return
  }
  if (!token) return
  await fetch(`${config.revokeUrl}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined)
}

function scopeList(value: unknown): string[] {
  return String(value ?? '')
    .split(/\s+/)
    .filter(Boolean)
}

export async function listConnectedAccounts(env: Env, workspaceId: string): Promise<ConnectedAccount[]> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM tool_accounts WHERE workspace_id = ? AND provider IN ('google', 'microsoft') AND oauth_group IS NOT NULL
     ORDER BY created_at`,
  )
    .bind(workspaceId)
    .all<any>()
  const groups = new Map<string, ConnectedAccount>()
  for (const row of results) {
    const groupId = String(row.oauth_group)
    const provider = (row.provider === 'microsoft' ? 'microsoft' : 'google') as 'google' | 'microsoft'
    const current: ConnectedAccount = groups.get(groupId) ?? {
      id: groupId,
      provider,
      label: row.label,
      email: row.email || row.label,
      services: [],
      scopes: [],
      status: 'connected',
      permissions: 'read',
      lastConnectedAt: row.last_connected_at ?? null,
      lastError: null,
      connectedAt: row.created_at,
    }
    current.services.push({ tool: row.tool, accountId: row.id, scopes: scopeList(row.scopes) })
    for (const scope of scopeList(row.scopes)) if (!current.scopes.includes(scope)) current.scopes.push(scope)
    if (row.status === 'error') {
      current.status = 'error'
      current.lastError = row.last_error ?? current.lastError
    }
    const levels = { read: 0, draft: 1, send: 2 } as const
    if ((levels[row.permissions as keyof typeof levels] ?? 0) > (levels[current.permissions] ?? 0)) {
      current.permissions = row.permissions === 'send' || row.permissions === 'draft' ? row.permissions : 'read'
    }
    current.lastConnectedAt = Math.max(current.lastConnectedAt ?? 0, row.last_connected_at ?? 0) || null
    groups.set(groupId, current)
  }
  return [...groups.values()]
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerOAuthRoutes(app: Hono<AppEnv>): void {
  app.get('/api/oauth/:provider/status', async (c) => {
    const provider = c.req.param('provider')
    if (!isOAuthProvider(provider)) return c.json({ error: 'Unknown OAuth provider.' }, 404)
    const { workspace } = c.get('session')
    const client = await oauthClientFor(c.env as Env, workspace.id, provider)
    const data: OAuthStatus = {
      provider,
      configured: Boolean(client),
      source: client?.source ?? 'none',
      redirectUri: redirectUriFor(publicBase(c), provider),
      scopes: capabilityScopes(provider),
    }
    return c.json({ data })
  })

  app.put('/api/oauth/:provider/client', async (c) => {
    const provider = c.req.param('provider')
    if (!isOAuthProvider(provider)) return c.json({ error: 'Unknown OAuth provider.' }, 404)
    const { workspace, user } = c.get('session')
    const body = await c.req.json<any>().catch(() => ({}))
    const clientId = String(body.clientId ?? '').trim()
    const clientSecret = String(body.clientSecret ?? '').trim()
    if (!clientId || !clientSecret) return c.json({ error: 'Enter both the OAuth client ID and client secret.' }, 400)
    if (!credentialEncryptionConfigured(c.env as Env)) {
      return c.json({ error: 'Server credential encryption is not configured.' }, 503)
    }
    const sealed = await sealSecret(c.env as Env, clientSecret, oauthClientContext(workspace.id, provider))
    await c.env.DB.prepare(
      `INSERT INTO oauth_clients (workspace_id, provider, client_id, client_secret, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id, provider) DO UPDATE SET client_id = excluded.client_id, client_secret = excluded.client_secret`,
    )
      .bind(workspace.id, provider, clientId.slice(0, 200), sealed, now())
      .run()
    await audit(c.env.DB, workspace.id, user.id, `oauth.${provider}.client`, provider, 'Workspace OAuth client saved', null)
    return c.json({ data: { saved: true } })
  })

  app.post('/api/oauth/:provider/start', async (c) => {
    const provider = c.req.param('provider')
    if (!isOAuthProvider(provider)) return c.json({ error: 'Unknown OAuth provider.' }, 404)
    const { workspace } = c.get('session')
    const body = await c.req.json<any>().catch(() => ({}))
    const capabilities = Array.isArray(body.capabilities) ? body.capabilities.map(String) : []
    if (!capabilities.length) return c.json({ error: 'Choose at least one capability to request.' }, 400)
    const result = await buildAuthorizationUrl({
      env: c.env as Env,
      workspaceId: workspace.id,
      provider,
      capabilities,
      base: publicBase(c),
      groupId: typeof body.groupId === 'string' ? body.groupId : undefined,
    })
    if ('error' in result) return c.json(result, 503)
    return c.json({ data: result })
  })

  app.get('/api/oauth/:provider/callback', async (c) => {
    const provider = c.req.param('provider')
    const base = publicBase(c)
    const failure = (message: string) => c.redirect(`${base}/app/settings/accounts?error=${encodeURIComponent(message)}`, 302)
    if (!isOAuthProvider(provider)) return failure('Unknown OAuth provider.')
    const state = c.req.query('state') ?? ''
    const code = c.req.query('code') ?? ''
    if (c.req.query('error')) return failure(String(c.req.query('error_description') ?? c.req.query('error')))
    if (!state || !code) return failure('The OAuth callback was incomplete.')
    const row = await c.env.DB.prepare('SELECT * FROM oauth_states WHERE state = ?').bind(state).first<any>()
    await c.env.DB.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run()
    if (!row || row.expires_at < now()) return failure('The authorization request expired. Start again.')
    if (row.provider !== provider) return failure('The OAuth state does not match this provider.')
    try {
      const result = await connectAccountFromCode({
        env: c.env as Env,
        workspaceId: row.workspace_id,
        provider,
        code,
        verifier: String(row.code_verifier ?? ''),
        redirectUri: String(row.redirect_uri ?? redirectUriFor(base, provider)),
        groupId: row.connected_account_id || undefined,
      })
      return c.redirect(`${base}/app/settings/accounts?connected=${encodeURIComponent(result.email)}`, 302)
    } catch (error) {
      console.error('oauth_callback_error', (error as Error).message)
      return failure((error as Error).message)
    }
  })

  app.get('/api/connected-accounts', async (c) => {
    const { workspace } = c.get('session')
    return c.json({ data: await listConnectedAccounts(c.env as Env, workspace.id) })
  })

  app.post('/api/connected-accounts/:id/refresh', async (c) => {
    const { workspace } = c.get('session')
    const account = await c.env.DB.prepare('SELECT * FROM tool_accounts WHERE workspace_id = ? AND oauth_group = ? LIMIT 1')
      .bind(workspace.id, c.req.param('id'))
      .first<any>()
    if (!account) return c.json({ error: 'Connected account not found.' }, 404)
    try {
      await ensureAccountToken(c.env as Env, { ...account, token_expires_at: 0 })
      return c.json({ data: { refreshed: true } })
    } catch (error) {
      return c.json({ error: `Token refresh failed: ${(error as Error).message}`, hint: 'Reconnect the account to grant access again.' }, 502)
    }
  })

  app.post('/api/connected-accounts/:id/reconnect', async (c) => {
    const { workspace } = c.get('session')
    const accounts = await c.env.DB.prepare('SELECT * FROM tool_accounts WHERE workspace_id = ? AND oauth_group = ?')
      .bind(workspace.id, c.req.param('id'))
      .all<any>()
    if (!accounts.results.length) return c.json({ error: 'Connected account not found.' }, 404)
    const row = accounts.results[0]
    const provider = (row.provider === 'microsoft' ? 'microsoft' : 'google') as ProviderKey
    const capabilities = OAUTH_PROVIDERS[provider].capabilities
      .filter((capability) => capability.scopes.every((scope) => scopeList(row.scopes).includes(scope)))
      .map((capability) => capability.key)
    const result = await buildAuthorizationUrl({
      env: c.env as Env,
      workspaceId: workspace.id,
      provider,
      capabilities: capabilities.length ? capabilities : [OAUTH_PROVIDERS[provider].capabilities[0].key],
      base: publicBase(c),
      groupId: String(row.oauth_group),
    })
    if ('error' in result) return c.json(result, 503)
    return c.json({ data: result })
  })

  app.patch('/api/connected-accounts/:id', async (c) => {
    const { workspace } = c.get('session')
    const body = await c.req.json<any>().catch(() => ({}))
    const permissions = body.permissions === 'send' || body.permissions === 'draft' ? body.permissions : 'read'
    const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM tool_accounts WHERE workspace_id = ? AND oauth_group = ?')
      .bind(workspace.id, c.req.param('id'))
      .first<{ n: number }>()
    if (!count?.n) return c.json({ error: 'Connected account not found.' }, 404)
    await c.env.DB.prepare('UPDATE tool_accounts SET permissions = ?, updated_at = ? WHERE workspace_id = ? AND oauth_group = ?')
      .bind(permissions, now(), workspace.id, c.req.param('id'))
      .run()
    return c.json({ data: { permissions } })
  })

  app.delete('/api/connected-accounts/:id', async (c) => {
    const { workspace, user } = c.get('session')
    const groupId = c.req.param('id')
    const accounts = await c.env.DB.prepare('SELECT * FROM tool_accounts WHERE workspace_id = ? AND oauth_group = ?')
      .bind(workspace.id, groupId)
      .all<any>()
    if (!accounts.results.length) return c.json({ error: 'Connected account not found.' }, 404)
    await revokeAccount(c.env as Env, accounts.results[0])
    await c.env.DB.prepare('DELETE FROM agent_tool_accounts WHERE account_id IN (SELECT id FROM tool_accounts WHERE workspace_id = ? AND oauth_group = ?)')
      .bind(workspace.id, groupId)
      .run()
    await c.env.DB.prepare('DELETE FROM tool_accounts WHERE workspace_id = ? AND oauth_group = ?').bind(workspace.id, groupId).run()
    const tools = [...new Set(accounts.results.map((row: any) => row.tool))]
    for (const tool of tools) {
      const remaining = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM tool_accounts WHERE workspace_id = ? AND tool = ? AND status = 'connected'")
        .bind(workspace.id, tool)
        .first<{ n: number }>()
      if (!remaining?.n) {
        await c.env.DB.prepare("UPDATE integrations SET status = 'disconnected' WHERE workspace_id = ? AND tool = ?")
          .bind(workspace.id, tool)
          .run()
      }
    }
    await audit(c.env.DB, workspace.id, user.id, 'oauth.disconnect', groupId, `${accounts.results[0].email ?? groupId} revoked`, null)
    return c.json({ data: { disconnected: true, revoked: Boolean(OAUTH_PROVIDERS[(accounts.results[0].provider === 'microsoft' ? 'microsoft' : 'google')].revokeUrl) } })
  })
}

// Composio is the external tool connection and execution layer. The project
// API key belongs to the tenant and is sealed in D1. Every connected account is
// created under a workspace-scoped Composio user id, so two customers can never
// share an OAuth grant.

import { composioToolkits } from '../shared/catalog'
import { integrationSecretContext, openSecret, sealSecret } from './crypto'
import { now, uid, type Env } from './store'

export interface ComposioConfig {
  apiKey: string
  baseUrl: string
  userId: string
}

export interface ComposioAuthConfig {
  id: string
  toolkitSlug: string
  authScheme: string
}

interface ComposioEnvelope {
  items?: any[]
  data?: any
  [key: string]: any
}

export function tenantComposioUser(workspaceId: string): string {
  return `lumo_${workspaceId}`
}

export async function getComposioConfig(db: D1Database, env: Env, workspaceId: string): Promise<ComposioConfig | null> {
  const row = await db
    .prepare("SELECT * FROM integrations WHERE workspace_id = ? AND tool = 'composio' AND status = 'connected'")
    .bind(workspaceId)
    .first<any>()
  if (!row?.fields) return null
  try {
    const raw = await openSecret(env, row.fields, integrationSecretContext(workspaceId, 'composio'))
    const fields = JSON.parse(raw) as { apiKey?: string; baseUrl?: string; userId?: string }
    if (!fields.apiKey) return null
    return {
      apiKey: fields.apiKey,
      baseUrl: (fields.baseUrl || 'https://backend.composio.dev').replace(/\/$/, ''),
      userId: tenantComposioUser(workspaceId),
    }
  } catch {
    return null
  }
}

export async function saveComposioConfig(
  db: D1Database,
  env: Env,
  workspaceId: string,
  input: { apiKey: string; baseUrl: string },
): Promise<void> {
  const fields = JSON.stringify({
    apiKey: input.apiKey,
    baseUrl: input.baseUrl.replace(/\/$/, ''),
    userId: tenantComposioUser(workspaceId),
  })
  const sealed = await sealSecret(env, fields, integrationSecretContext(workspaceId, 'composio'))
  await db
    .prepare(
      `INSERT INTO integrations (workspace_id, tool, status, account_label, fields, connected_at) VALUES (?, 'composio', 'connected', ?, ?, ?)
       ON CONFLICT(workspace_id, tool) DO UPDATE SET status = 'connected', account_label = excluded.account_label, fields = excluded.fields, connected_at = excluded.connected_at`,
    )
    .bind(workspaceId, 'Composio project', sealed, now())
    .run()
}

async function composioFetch(config: ComposioConfig, path: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      'x-api-key': config.apiKey,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  })
  const text = await response.text()
  let payload: any = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = { raw: text.slice(0, 600) }
  }
  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.message ?? payload?.raw ?? `HTTP ${response.status}`
    const error = new Error(String(message).slice(0, 300)) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return payload
}

export async function verifyComposioProject(config: ComposioConfig): Promise<void> {
  await composioFetch(config, '/api/v3/toolkits?limit=1')
}

export async function ensureAuthConfig(config: ComposioConfig, toolKey: string): Promise<ComposioAuthConfig> {
  const slug = composioToolkits[toolKey] ?? toolKey
  const listed = (await composioFetch(
    config,
    `/api/v3/auth_configs?toolkit_slug=${encodeURIComponent(slug)}&show_disabled=false&limit=10`,
  )) as ComposioEnvelope
  const existing = (listed.items ?? []).find((item) => item?.id && item?.auth_scheme && String(item.auth_scheme) !== 'NO_AUTH')
  if (existing) {
    return { id: String(existing.id), toolkitSlug: slug, authScheme: String(existing.auth_scheme ?? 'OAUTH2') }
  }

  const created = await composioFetch(config, '/api/v3/auth_configs', {
    method: 'POST',
    body: JSON.stringify({
      toolkit: { slug },
      auth_config: { type: 'use_composio_managed_auth', credentials: {}, restrict_to_following_tools: [] },
    }),
  })
  const authConfig = created?.auth_config ?? created
  const id = authConfig?.id
  if (!id) throw new Error('Composio did not return an auth config id for this toolkit.')
  return { id: String(id), toolkitSlug: slug, authScheme: String(authConfig?.auth_scheme ?? 'OAUTH2') }
}

export async function startComposioLink(
  config: ComposioConfig,
  authConfigId: string,
  alias: string,
  callbackUrl: string,
): Promise<{ redirectUrl: string; connectedAccountId: string; expiresAt: string }> {
  const result = await composioFetch(config, '/api/v3/connected_accounts/link', {
    method: 'POST',
    body: JSON.stringify({
      auth_config_id: authConfigId,
      user_id: config.userId,
      alias: alias.slice(0, 80),
      callback_url: callbackUrl,
      experimental: { account_type: 'PRIVATE' },
    }),
  })
  if (!result?.redirect_url || !result?.connected_account_id) {
    throw new Error('Composio did not return a redirect URL.')
  }
  return {
    redirectUrl: String(result.redirect_url),
    connectedAccountId: String(result.connected_account_id),
    expiresAt: String(result.expires_at ?? new Date(now() + 15 * 60 * 1000).toISOString()),
  }
}

export async function getComposioAccount(config: ComposioConfig, connectedAccountId: string): Promise<any> {
  return composioFetch(config, `/api/v3/connected_accounts/${encodeURIComponent(connectedAccountId)}`)
}

export async function deleteComposioAccount(config: ComposioConfig, connectedAccountId: string): Promise<void> {
  await composioFetch(config, `/api/v3/connected_accounts/${encodeURIComponent(connectedAccountId)}`, {
    method: 'DELETE',
  }).catch(() => undefined)
}

export function accountOwner(account: any): string {
  const state = account?.state ?? {}
  const val = state?.val ?? state
  const candidates = [
    val?.email,
    val?.emailAddress,
    val?.user?.email,
    val?.profile?.email,
    val?.account_id,
    val?.username,
    val?.name,
    account?.alias,
  ]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim() && !value.startsWith('http')) return value.trim().slice(0, 160)
  }
  // Some toolkits return a nested data object; look one level deep for an email.
  for (const value of Object.values(val ?? {})) {
    if (typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return value.slice(0, 160)
  }
  const fallback = String(account?.id ?? account?.nanoid ?? '')
  return fallback ? `Composio account ${fallback.slice(0, 10)}` : ''
}

export interface ComposioActionDefinition {
  slug: string
  name: string
  description: string
  parameters: { type?: string; properties?: Record<string, unknown>; required?: string[]; [key: string]: unknown }
}

// The action catalogue is fetched from the customer's own Composio project.
// Nothing is hard-coded as available; the engine intersects this list with the
// agent's selected actions, bound account and permission grant.
export async function listComposioActions(config: ComposioConfig, toolKey: string): Promise<ComposioActionDefinition[]> {
  const slug = composioToolkits[toolKey] ?? toolKey
  const payload = (await composioFetch(
    config,
    `/api/v3/tools?toolkit_slug=${encodeURIComponent(slug)}&limit=100`,
  )) as ComposioEnvelope
  return (payload.items ?? [])
    .filter((item) => item?.slug)
    .map((item) => ({
      slug: String(item.slug),
      name: String(item.name ?? item.slug),
      description: String(item.description ?? '').slice(0, 700),
      parameters:
        item.input_parameters && typeof item.input_parameters === 'object'
          ? item.input_parameters
          : item.parameters && typeof item.parameters === 'object'
            ? item.parameters
            : { type: 'object', properties: {} },
    }))
}

export async function executeComposioTool(
  env: Env,
  workspaceId: string,
  account: { externalId: string | null },
  toolSlug: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const config = await getComposioConfig(env.DB, env, workspaceId)
  if (!config) return { ok: false, error: 'Composio is not connected for this workspace.' }
  if (!account.externalId) return { ok: false, error: 'This account has no Composio connected-account ID.' }
  try {
    const result = await composioFetch(config, `/api/v3/tools/execute/${encodeURIComponent(toolSlug)}`, {
      method: 'POST',
      body: JSON.stringify({
        connected_account_id: account.externalId,
        user_id: config.userId,
        arguments: args,
      }),
    })
    if (result?.data?.successful === false) {
      return { ok: false, error: String(result?.data?.error ?? 'Composio reported a failed execution.').slice(0, 400) }
    }
    return { ok: true, data: result?.data ?? result }
  } catch (error) {
    return { ok: false, error: (error as Error).message.slice(0, 400) }
  }
}

export function createOAuthState(): string {
  return uid('ost_') + uid('')
}

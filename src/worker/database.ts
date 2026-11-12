// Database ownership. Every workspace has Lumo-managed records in D1 plus, if
// they choose, an external database reached over HTTPS. External connection
// details are sealed with CREDENTIAL_KEY and never returned to the browser or
// the model. Raw Postgres/MySQL TCP is not reachable from a Worker, so those
// providers are stored as unsupported until the workspace adds a secure HTTP
// gateway; we do not pretend a connection exists.

import type { Hono } from 'hono'

import type { AppEnv } from './context'

import type { DatabaseRecord, DatabaseSource } from '../shared/types'
import { CredentialKeyError, credentialEncryptionConfigured, databaseSecretContext, openSecret, sealSecret } from './crypto'
import { audit, now, parseJson, uid, type Env } from './store'

export const COLLECTION_RE = /^[a-z][a-z0-9_]{1,40}$/

export interface ManagedRow {
  id: string
  sourceId: string | null
  collection: string
  data: Record<string, unknown>
  createdBy: string | null
  createdAt: number
  updatedAt: number
}

export function mapRecord(row: any): DatabaseRecord {
  return {
    id: row.id,
    sourceId: row.source_id ?? null,
    collection: row.collection,
    data: parseJson<Record<string, unknown>>(row.data, {}),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function recordsToCsv(rows: Array<Record<string, unknown>>): string {
  const columns: string[] = []
  for (const row of rows) for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key)
  if (!columns.length) return ''
  const lines = [columns.map(csvEscape).join(',')]
  for (const row of rows) lines.push(columns.map((column) => csvEscape(row[column])).join(','))
  return `${lines.join('\r\n')}\r\n`
}

export function validateData(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const data = input as Record<string, unknown>
  if (Object.keys(data).length > 100) return null
  const serialized = JSON.stringify(data)
  if (serialized.length > 60_000) return null
  return data
}

export function mapSource(row: any): DatabaseSource {
  const config = parseJson<Record<string, string>>(row.config, {})
  return {
    id: row.id,
    mode: row.mode === 'external' ? 'external' : 'managed',
    provider: row.provider,
    label: row.label,
    permissions: row.permissions === 'delete' || row.permissions === 'write' ? row.permissions : 'read',
    status: ['connected', 'error', 'unsupported'].includes(row.status) ? row.status : 'untested',
    lastTestedAt: row.last_tested_at ?? null,
    lastError: row.last_error ?? null,
    configHint: row.config_hint || (config.url ? safeHost(config.url) : config.table ? `table ${config.table}` : `${row.provider} endpoint`),
    createdAt: row.created_at,
  }
}

function publicHttpsUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false
  if (host.startsWith('[')) return false
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const parts = ipv4.slice(1).map(Number)
    if (parts.some((part) => part > 255)) return false
    const [a, b] = parts
    if (a === 0 || a === 10 || a === 127) return false
    if (a === 169 && b === 254) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 100 && b >= 64 && b <= 127) return false
  }
  return true
}

function safeHost(value: string): string {
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}`
  } catch {
    return ''
  }
}

export async function getSource(env: Env, workspaceId: string, sourceId: string | null | undefined): Promise<any | null> {
  if (!sourceId || sourceId === 'managed') return null
  return env.DB.prepare('SELECT * FROM db_sources WHERE id = ? AND workspace_id = ?').bind(sourceId, workspaceId).first<any>()
}

async function sourceConfig(env: Env, source: any): Promise<Record<string, string>> {
  const raw = String(source.config ?? '{}')
  try {
    const plain = await openSecret(env, raw, databaseSecretContext(source.workspace_id, source.id))
    return parseJson<Record<string, string>>(plain, {})
  } catch (error) {
    if (error instanceof CredentialKeyError) throw new Error('Server credential encryption is not configured.')
    throw new Error('The external database credential could not be decrypted.')
  }
}

async function externalFetch(env: Env, source: any, path: string, init: RequestInit = {}): Promise<Response> {
  const config = await sourceConfig(env, source)
  if (!config.url) throw new Error('This external database has no URL configured.')
  const url = `${config.url.replace(/\/$/, '')}${path}`
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(config.apiKey ? { apikey: config.apiKey, Authorization: `Bearer ${config.apiKey}` } : {}),
    ...(source.provider === 'supabase' ? { Prefer: 'return=representation' } : {}),
    ...(init.headers as Record<string, string> | undefined),
  }
  const response = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`External database returned HTTP ${response.status}${body ? `: ${body.replace(/\s+/g, ' ').slice(0, 240)}` : ''}`)
  }
  return response
}

export async function testExternalSource(env: Env, source: any): Promise<{ ok: boolean; message: string }> {
  if (source.provider === 'postgres' || source.provider === 'mysql') {
    return {
      ok: false,
      message: `${source.provider} needs a secure HTTPS gateway. Workers cannot open a raw database port. Add a gateway URL and use the custom REST adapter.`,
    }
  }
  try {
    const config = await sourceConfig(env, source)
    if (source.provider === 'supabase') {
      if (!config.table) return { ok: false, message: 'Add the table name this connection may use.' }
      await externalFetch(env, source, `/rest/v1/${encodeURIComponent(config.table)}?select=*&limit=1`)
      return { ok: true, message: `Connected to ${safeHost(config.url)} · table ${config.table}.` }
    }
    await externalFetch(env, source, '')
    return { ok: true, message: `Reached ${safeHost(config.url)}.` }
  } catch (error) {
    return { ok: false, message: (error as Error).message }
  }
}

function externalPath(source: any, config: Record<string, string>): string {
  if (source.provider === 'supabase') return `/rest/v1/${encodeURIComponent(config.table || '')}`
  return ''
}

export async function externalQuery(env: Env, source: any, args: { collection?: string; limit?: number; query?: string }) {
  const config = await sourceConfig(env, source)
  const limit = Math.max(1, Math.min(200, args.limit ?? 50))
  if (source.provider === 'supabase') {
    if (!config.table) throw new Error('This Supabase source has no table configured.')
    const params = new URLSearchParams({ select: '*', limit: String(limit) })
    if (args.query) params.set(config.searchColumn || 'name', `ilike.*${args.query}*`)
    const response = await externalFetch(env, source, `/rest/v1/${encodeURIComponent(config.table)}?${params.toString()}`)
    return { rows: (await response.json()) as unknown[] }
  }
  const response = await externalFetch(env, source, config.queryPath || '/records')
  const data = (await response.json().catch(() => [])) as unknown
  const rows = Array.isArray(data) ? data : Array.isArray((data as any)?.records) ? (data as any).records : []
  return { rows: rows.slice(0, limit) }
}

export async function externalInsert(env: Env, source: any, row: Record<string, unknown>) {
  const config = await sourceConfig(env, source)
  if (source.provider === 'supabase') {
    const response = await externalFetch(env, source, externalPath(source, config), { method: 'POST', body: JSON.stringify(row) })
    return { inserted: (await response.json().catch(() => [row])) as unknown }
  }
  const response = await externalFetch(env, source, config.recordsPath || '/records', { method: 'POST', body: JSON.stringify(row) })
  return { inserted: await response.json().catch(() => row) }
}

export async function externalUpdate(env: Env, source: any, id: string, patch: Record<string, unknown>) {
  const config = await sourceConfig(env, source)
  if (source.provider === 'supabase') {
    const params = new URLSearchParams({ [config.idColumn || 'id']: `eq.${id}` })
    const response = await externalFetch(env, source, `${externalPath(source, config)}?${params.toString()}`, { method: 'PATCH', body: JSON.stringify(patch) })
    return { updated: await response.json().catch(() => patch) }
  }
  const response = await externalFetch(env, source, `${config.recordsPath || '/records'}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return { updated: await response.json().catch(() => patch) }
}

export async function externalDelete(env: Env, source: any, id: string) {
  const config = await sourceConfig(env, source)
  if (source.provider === 'supabase') {
    const params = new URLSearchParams({ [config.idColumn || 'id']: `eq.${id}` })
    await externalFetch(env, source, `${externalPath(source, config)}?${params.toString()}`, { method: 'DELETE' })
    return { deleted: true }
  }
  await externalFetch(env, source, `${config.recordsPath || '/records'}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  return { deleted: true }
}

export async function listManagedRecords(env: Env, workspaceId: string, options: { collection?: string; query?: string; limit?: number } = {}) {
  let sql = 'SELECT * FROM records WHERE workspace_id = ?'
  const params: unknown[] = [workspaceId]
  if (options.collection) {
    sql += ' AND collection = ?'
    params.push(options.collection)
  }
  if (options.query) {
    sql += ' AND lower(data) LIKE ?'
    params.push(`%${options.query.toLowerCase().slice(0, 80)}%`)
  }
  sql += ' ORDER BY created_at DESC LIMIT ?'
  params.push(Math.min(options.limit ?? 100, 500))
  const { results } = await env.DB.prepare(sql).bind(...params).all<any>()
  return results.map(mapRecord)
}

export async function insertManagedRecord(env: Env, workspaceId: string, collection: string, data: Record<string, unknown>, actor: string) {
  const id = uid('rec_')
  const timestamp = now()
  await env.DB.prepare(
    'INSERT INTO records (id, workspace_id, source_id, collection, data, created_by, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)',
  )
    .bind(id, workspaceId, collection, JSON.stringify(data), actor, timestamp, timestamp)
    .run()
  return { id, collection, createdAt: timestamp }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerDatabaseRoutes(app: Hono<AppEnv>): void {
  app.get('/api/database/sources', async (c) => {
    const { workspace } = c.get('session')
    const { results } = await c.env.DB.prepare('SELECT * FROM db_sources WHERE workspace_id = ? ORDER BY created_at')
      .bind(workspace.id)
      .all<any>()
    const counts = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM records WHERE workspace_id = ?').bind(workspace.id).first<{ n: number }>()
    const managed: DatabaseSource = {
      id: 'managed',
      mode: 'managed',
      provider: 'd1',
      label: 'Lumo-managed database',
      permissions: 'delete',
      status: 'connected',
      lastTestedAt: Date.now(),
      lastError: null,
      configHint: `${counts?.n ?? 0} record${counts?.n === 1 ? '' : 's'} in Cloudflare D1`,
      createdAt: 0,
    }
    return c.json({ data: [managed, ...results.map(mapSource)] })
  })

  app.post('/api/database/sources', async (c) => {
    const { workspace, user } = c.get('session')
    const body = await c.req.json<any>().catch(() => ({}))
    const provider = ['supabase', 'postgres', 'mysql', 'custom_rest'].includes(body.provider) ? body.provider : ''
    if (!provider) return c.json({ error: 'Choose Supabase, PostgreSQL, MySQL or a custom REST gateway.' }, 400)
    const label = String(body.label ?? '').trim().slice(0, 80)
    if (label.length < 2) return c.json({ error: 'Name this database connection.' }, 400)
    const url = String(body.url ?? '').trim()
    if (provider !== 'postgres' && provider !== 'mysql' && !publicHttpsUrl(url)) {
      return c.json({ error: 'Use a public HTTPS endpoint. Private, loopback and credential-bearing URLs are blocked.' }, 400)
    }
    if (!credentialEncryptionConfigured(c.env as Env)) {
      return c.json({ error: 'Server credential encryption is not configured, so database secrets cannot be stored.' }, 503)
    }
    const config = {
      url,
      apiKey: String(body.apiKey ?? '').trim().slice(0, 500),
      table: String(body.table ?? '').trim().slice(0, 64),
      schema: String(body.schema ?? 'public').trim().slice(0, 40),
      idColumn: String(body.idColumn ?? 'id').trim().slice(0, 40),
      recordsPath: String(body.recordsPath ?? '/records').trim().slice(0, 80),
      queryPath: String(body.queryPath ?? '').trim().slice(0, 80),
      searchColumn: String(body.searchColumn ?? '').trim().slice(0, 40),
    }
    const permissions = ['write', 'delete'].includes(body.permissions) ? body.permissions : 'read'
    const id = uid('dbs_')
    const sealed = await sealSecret(c.env as Env, JSON.stringify(config), databaseSecretContext(workspace.id, id))
    const unsupported = provider === 'postgres' || provider === 'mysql'
    await c.env.DB.prepare(
      `INSERT INTO db_sources (id, workspace_id, mode, provider, label, config, config_hint, permissions, status, last_error, created_at)
       VALUES (?, ?, 'external', ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        workspace.id,
        provider,
        label,
        sealed,
        provider === 'postgres' || provider === 'mysql' ? label : safeHost(url) || `${provider} endpoint`,
        permissions,
        unsupported ? 'unsupported' : 'untested',
        unsupported ? 'Direct TCP databases need a secure HTTPS gateway; store the gateway URL with the custom REST adapter.' : null,
        now(),
      )
      .run()
    await audit(c.env.DB, workspace.id, user.id, 'database.create', id, `${provider} · ${label}`, c.req.header('cf-connecting-ip') ?? null)
    const row = await c.env.DB.prepare('SELECT * FROM db_sources WHERE id = ?').bind(id).first<any>()
    return c.json({ data: mapSource(row) }, 201)
  })

  app.post('/api/database/sources/:id/test', async (c) => {
    const { workspace } = c.get('session')
    const source = await getSource(c.env as Env, workspace.id, c.req.param('id'))
    if (!source) return c.json({ error: 'Database connection not found.' }, 404)
    const result = await testExternalSource(c.env as Env, source)
    await c.env.DB.prepare('UPDATE db_sources SET status = ?, last_error = ?, last_tested_at = ? WHERE id = ? AND workspace_id = ?')
      .bind(result.ok ? 'connected' : source.provider === 'postgres' || source.provider === 'mysql' ? 'unsupported' : 'error', result.ok ? null : result.message.slice(0, 400), now(), source.id, workspace.id)
      .run()
    const updated = await c.env.DB.prepare('SELECT * FROM db_sources WHERE id = ?').bind(source.id).first<any>()
    return c.json({ data: mapSource(updated), test: result }, result.ok ? 200 : 400)
  })

  app.patch('/api/database/sources/:id', async (c) => {
    const { workspace, user } = c.get('session')
    const source = await getSource(c.env as Env, workspace.id, c.req.param('id'))
    if (!source) return c.json({ error: 'Database connection not found.' }, 404)
    const body = await c.req.json<any>().catch(() => ({}))
    const permissions = ['read', 'write', 'delete'].includes(body.permissions) ? body.permissions : source.permissions
    await c.env.DB.prepare('UPDATE db_sources SET permissions = ?, label = COALESCE(?, label), updated_at = ? WHERE id = ? AND workspace_id = ?')
      .bind(permissions, typeof body.label === 'string' ? body.label.trim().slice(0, 80) : null, now(), source.id, workspace.id)
      .run()
    await audit(c.env.DB, workspace.id, user.id, 'database.permissions', source.id, permissions, null)
    const updated = await c.env.DB.prepare('SELECT * FROM db_sources WHERE id = ?').bind(source.id).first<any>()
    return c.json({ data: mapSource(updated) })
  })

  app.delete('/api/database/sources/:id', async (c) => {
    const { workspace, user } = c.get('session')
    const source = await getSource(c.env as Env, workspace.id, c.req.param('id'))
    if (!source) return c.json({ error: 'Database connection not found.' }, 404)
    await c.env.DB.prepare('DELETE FROM db_sources WHERE id = ? AND workspace_id = ?').bind(source.id, workspace.id).run()
    await c.env.DB.prepare('UPDATE agents SET database_source_id = NULL WHERE workspace_id = ? AND database_source_id = ?').bind(workspace.id, source.id).run()
    await audit(c.env.DB, workspace.id, user.id, 'database.delete', source.id, source.label, null)
    return c.json({ data: { deleted: true } })
  })

  app.get('/api/records', async (c) => {
    const { workspace } = c.get('session')
    const sourceId = c.req.query('sourceId')
    const collection = c.req.query('collection') ?? undefined
    const query = c.req.query('q') ?? undefined
    if (collection && !COLLECTION_RE.test(collection)) return c.json({ error: 'Collection names use lowercase letters, numbers and underscores.' }, 400)
    if (sourceId && sourceId !== 'managed') {
      const source = await getSource(c.env as Env, workspace.id, sourceId)
      if (!source) return c.json({ error: 'Database connection not found.' }, 404)
      try {
        const result = await externalQuery(c.env as Env, source, { limit: Number(c.req.query('limit')) || 50, query })
        return c.json({ data: result.rows })
      } catch (error) {
        return c.json({ error: (error as Error).message }, 502)
      }
    }
    return c.json({ data: await listManagedRecords(c.env as Env, workspace.id, { collection, query, limit: Number(c.req.query('limit')) || 100 }) })
  })

  app.post('/api/records', async (c) => {
    const { workspace, user } = c.get('session')
    const body = await c.req.json<any>().catch(() => ({}))
    const collection = String(body.collection ?? '').trim()
    if (!COLLECTION_RE.test(collection)) return c.json({ error: 'Use a collection name like invoices, leads or suppliers.' }, 400)
    const data = validateData(body.data)
    if (!data) return c.json({ error: 'Record data must be a small JSON object (under 60 KB).' }, 400)
    const sourceId = body.sourceId && body.sourceId !== 'managed' ? String(body.sourceId) : null
    if (sourceId) {
      const source = await getSource(c.env as Env, workspace.id, sourceId)
      if (!source) return c.json({ error: 'Database connection not found.' }, 404)
      if (source.permissions === 'read') return c.json({ error: 'This connection is read-only. Raise its permission before inserting.' }, 403)
      try {
        return c.json({ data: await externalInsert(c.env as Env, source, data) }, 201)
      } catch (error) {
        return c.json({ error: (error as Error).message }, 502)
      }
    }
    const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM records WHERE workspace_id = ? AND collection = ?')
      .bind(workspace.id, collection)
      .first<{ n: number }>()
    if ((count?.n ?? 0) >= 10_000) return c.json({ error: 'This collection reached its 10,000 record limit.' }, 409)
    const record = await insertManagedRecord(c.env as Env, workspace.id, collection, data, user.id)
    await audit(c.env.DB, workspace.id, user.id, 'database.insert', record.id, collection, c.req.header('cf-connecting-ip') ?? null)
    return c.json({ data: record }, 201)
  })

  app.patch('/api/records/:id', async (c) => {
    const { workspace, user } = c.get('session')
    const body = await c.req.json<any>().catch(() => ({}))
    const patch = validateData(body.data)
    if (!patch) return c.json({ error: 'Send the fields to update as a JSON object.' }, 400)
    const row = await c.env.DB.prepare('SELECT * FROM records WHERE id = ? AND workspace_id = ?').bind(c.req.param('id'), workspace.id).first<any>()
    if (!row) return c.json({ error: 'Record not found.' }, 404)
    const merged = { ...parseJson<Record<string, unknown>>(row.data, {}), ...patch }
    await c.env.DB.prepare('UPDATE records SET data = ?, updated_at = ? WHERE id = ? AND workspace_id = ?')
      .bind(JSON.stringify(merged), now(), row.id, workspace.id)
      .run()
    await audit(c.env.DB, workspace.id, user.id, 'database.update', row.id, row.collection, null)
    return c.json({ data: mapRecord({ ...row, data: JSON.stringify(merged), updated_at: now() }) })
  })

  app.delete('/api/records/:id', async (c) => {
    const { workspace, user } = c.get('session')
    const row = await c.env.DB.prepare('SELECT * FROM records WHERE id = ? AND workspace_id = ?').bind(c.req.param('id'), workspace.id).first<any>()
    if (!row) return c.json({ error: 'Record not found.' }, 404)
    await c.env.DB.prepare('DELETE FROM records WHERE id = ? AND workspace_id = ?').bind(row.id, workspace.id).run()
    await audit(c.env.DB, workspace.id, user.id, 'database.delete', row.id, row.collection, null)
    return c.json({ data: { deleted: true } })
  })

  app.get('/api/database/export', async (c) => {
    const { workspace } = c.get('session')
    const format = c.req.query('format') === 'csv' ? 'csv' : 'json'
    const collection = c.req.query('collection') ?? undefined
    if (collection && !COLLECTION_RE.test(collection)) return c.json({ error: 'Invalid collection name.' }, 400)
    const rows = await listManagedRecords(c.env as Env, workspace.id, { collection, limit: 500 })
    await audit(c.env.DB, workspace.id, c.get('session').user.id, 'database.export', collection ?? 'all', format, null)
    if (format === 'csv') {
      const csv = recordsToCsv(rows.map((row) => ({ id: row.id, collection: row.collection, created_at: new Date(row.createdAt).toISOString(), ...row.data })))
      return c.body(csv, 200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="lumo-${collection ?? 'records'}-${new Date().toISOString().slice(0, 10)}.csv"`,
      })
    }
    return c.json({ data: rows }, 200, {
      'Content-Disposition': `attachment; filename="lumo-${collection ?? 'records'}-${new Date().toISOString().slice(0, 10)}.json"`,
    })
  })
}

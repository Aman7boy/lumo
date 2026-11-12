// Workspace backup, restore and portability. A backup is a full logical
// snapshot of one workspace, encrypted with CREDENTIAL_KEY and stored in R2.
// Restore decrypts, verifies the checksum, takes a pre-restore safety copy,
// replaces tenant rows, then compares row counts before reporting success.
//
// Credentials never enter a backup or an export: API keys, OAuth tokens and
// database secrets are stripped. Restored accounts are marked disconnected so
// a customer reconnects rather than inheriting a stale grant.

import type { Hono } from 'hono'

import type { AppEnv } from './context'

import type { Backup, BackupSettings } from '../shared/types'
import { backupSecretContext, credentialEncryptionConfigured, openSecret, sealSecret } from './crypto'
import { audit, logEvent, now, parseJson, uid, type Env } from './store'
import { COLLECTION_RE } from './database'

const SNAPSHOT_VERSION = 1
const MAX_ROWS_PER_TABLE = 20_000

interface TableSpec {
  name: string
  sql: string
  deleteSql?: string
}

// Order matters on restore: parents before children.
const TABLES: TableSpec[] = [
  { name: 'workspaces', sql: 'SELECT * FROM workspaces WHERE id = ?' },
  { name: 'agents', sql: 'SELECT * FROM agents WHERE workspace_id = ?' },
  { name: 'agent_tools', sql: 'SELECT * FROM agent_tools WHERE agent_id IN (SELECT id FROM agents WHERE workspace_id = ?)' },
  { name: 'conversations', sql: 'SELECT * FROM conversations WHERE workspace_id = ?' },
  { name: 'messages', sql: 'SELECT * FROM messages WHERE workspace_id = ?' },
  { name: 'memory', sql: 'SELECT * FROM memory WHERE workspace_id = ?' },
  { name: 'knowledge_docs', sql: 'SELECT * FROM knowledge_docs WHERE workspace_id = ?' },
  { name: 'knowledge_chunks', sql: 'SELECT * FROM knowledge_chunks WHERE workspace_id = ?' },
  { name: 'tasks', sql: 'SELECT * FROM tasks WHERE workspace_id = ?' },
  { name: 'events', sql: 'SELECT * FROM events WHERE workspace_id = ?' },
  { name: 'automations', sql: 'SELECT * FROM automations WHERE workspace_id = ?' },
  { name: 'records', sql: 'SELECT * FROM records WHERE workspace_id = ?' },
  { name: 'documents', sql: 'SELECT * FROM documents WHERE workspace_id = ?' },
  { name: 'generated_files', sql: 'SELECT * FROM generated_files WHERE workspace_id = ?' },
  { name: 'document_mappings', sql: 'SELECT * FROM document_mappings WHERE workspace_id = ?' },
  { name: 'agent_tool_accounts', sql: 'SELECT * FROM agent_tool_accounts WHERE agent_id IN (SELECT id FROM agents WHERE workspace_id = ?)' },
  { name: 'agent_tool_actions', sql: 'SELECT * FROM agent_tool_actions WHERE agent_id IN (SELECT id FROM agents WHERE workspace_id = ?)' },
  { name: 'workspace_settings', sql: 'SELECT * FROM workspace_settings WHERE workspace_id = ?' },
  { name: 'db_sources', sql: 'SELECT * FROM db_sources WHERE workspace_id = ?' },
  { name: 'voice_providers', sql: 'SELECT * FROM voice_providers WHERE workspace_id = ?' },
  { name: 'ocr_providers', sql: 'SELECT * FROM ocr_providers WHERE workspace_id = ?' },
  { name: 'voice_usage', sql: 'SELECT * FROM voice_usage WHERE workspace_id = ?' },
  { name: 'native_executions', sql: 'SELECT * FROM native_executions WHERE workspace_id = ?' },
  { name: 'usage', sql: 'SELECT * FROM usage WHERE workspace_id = ?' },
  { name: 'tool_accounts', sql: 'SELECT * FROM tool_accounts WHERE workspace_id = ?' },
  { name: 'model_connections', sql: 'SELECT * FROM model_connections WHERE workspace_id = ?' },
]

// Children first, then parents. `agents` must be deleted last so the
// agent-scoped deletes above still find their rows.
const DELETE_ORDER = [
  'agent_tool_actions',
  'agent_tool_accounts',
  'agent_tools',
  'messages',
  'conversations',
  'knowledge_chunks',
  'knowledge_docs',
  'memory',
  'tasks',
  'events',
  'automations',
  'generated_files',
  'documents',
  'document_mappings',
  'records',
  'native_executions',
  'voice_usage',
  'db_sources',
  'voice_providers',
  'ocr_providers',
  'workspace_settings',
  'tool_accounts',
  'model_connections',
  'usage',
  'agents',
]

const RESTORE_ORDER = [
  'agent_tool_actions',
  'agent_tool_accounts',
  'agent_tools',
  'messages',
  'conversations',
  'knowledge_chunks',
  'knowledge_docs',
  'memory',
  'tasks',
  'events',
  'automations',
  'generated_files',
  'documents',
  'document_mappings',
  'records',
  'native_executions',
  'voice_usage',
  'db_sources',
  'voice_providers',
  'ocr_providers',
  'workspace_settings',
  'tool_accounts',
  'model_connections',
  'usage',
  'agents',
]

export interface Snapshot {
  version: number
  workspaceId: string
  generatedAt: number
  tables: Record<string, any[]>
  counts: Record<string, number>
  truncated: string[]
  omitted: string[]
}

export async function checksumText(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function sanitizeRow(table: string, row: any): any {
  if (table === 'model_connections') {
    return { ...row, api_key: '', status: 'untested', last_error: 'Restored from backup. Re-enter this provider key.' }
  }
  if (table === 'tool_accounts') {
    return {
      ...row,
      fields: '{}',
      access_token: '',
      refresh_token: '',
      token_expires_at: null,
      status: 'disconnected',
      last_error: 'Restored from backup. Reconnect this account to grant access again.',
    }
  }
  if (table === 'db_sources') {
    return { ...row, config: '{}', status: 'untested', last_error: 'Restored from backup. Re-enter connection details.' }
  }
  if (table === 'voice_providers' || table === 'ocr_providers') {
    return { ...row, api_key: '', status: 'untested', last_error: 'Restored from backup. Re-enter the provider key.' }
  }
  return row
}

export async function collectSnapshot(env: Env, workspaceId: string): Promise<Snapshot> {
  const tables: Record<string, any[]> = {}
  const counts: Record<string, number> = {}
  const truncated: string[] = []
  for (const table of TABLES) {
    const { results } = await env.DB.prepare(table.sql).bind(workspaceId).all<any>()
    const rows = results ?? []
    counts[table.name] = rows.length
    if (rows.length > MAX_ROWS_PER_TABLE) truncated.push(table.name)
    tables[table.name] = rows.slice(0, MAX_ROWS_PER_TABLE).map((row) => sanitizeRow(table.name, row))
  }
  return {
    version: SNAPSHOT_VERSION,
    workspaceId,
    generatedAt: now(),
    tables,
    counts,
    truncated,
    omitted: ['oauth_clients', 'oauth_states', 'sessions', 'users', 'rate_limits', 'integrity: credentials are never included'],
  }
}

export function mapBackup(row: any): Backup {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    size: row.size,
    checksum: row.checksum ?? null,
    counts: parseJson<Record<string, number>>(row.counts, {}),
    error: row.error ?? null,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
    restoredAt: row.restored_at ?? null,
  }
}

async function backupSettingsRow(env: Env, workspaceId: string) {
  const row = await env.DB.prepare('SELECT * FROM workspace_settings WHERE workspace_id = ?').bind(workspaceId).first<any>()
  if (row) return row
  await env.DB.prepare('INSERT INTO workspace_settings (workspace_id, backup_schedule, backup_retention_days, updated_at) VALUES (?, ?, ?, ?)')
    .bind(workspaceId, 'manual', 30, now())
    .run()
  return env.DB.prepare('SELECT * FROM workspace_settings WHERE workspace_id = ?').bind(workspaceId).first<any>()
}

export async function createBackup(env: Env, workspaceId: string, kind: 'manual' | 'scheduled' | 'pre_restore'): Promise<Backup> {
  if (!credentialEncryptionConfigured(env)) {
    throw new Error('Backup encryption requires CREDENTIAL_KEY on the server.')
  }
  const id = uid('bkp_')
  const timestamp = now()
  await env.DB.prepare("INSERT INTO backups (id, workspace_id, kind, status, created_at) VALUES (?, ?, ?, 'running', ?)")
    .bind(id, workspaceId, kind, timestamp)
    .run()
  try {
    const snapshot = await collectSnapshot(env, workspaceId)
    const json = JSON.stringify(snapshot)
    const checksum = await checksumText(json)
    const sealed = await sealSecret(env, json, backupSecretContext(workspaceId, id))
    const storageKey = `backups/${workspaceId}/${id}.json.enc`
    await env.FILES.put(storageKey, sealed, {
      httpMetadata: { contentType: 'application/octet-stream' },
      customMetadata: { workspace: workspaceId, checksum, version: String(SNAPSHOT_VERSION) },
    })
    const completedAt = now()
    await env.DB.prepare(
      "UPDATE backups SET status = 'completed', size = ?, checksum = ?, counts = ?, storage_key = ?, completed_at = ? WHERE id = ? AND workspace_id = ?",
    )
      .bind(sealed.length, checksum, JSON.stringify(snapshot.counts), storageKey, completedAt, id, workspaceId)
      .run()
    if (kind !== 'pre_restore') {
      await env.DB.prepare('UPDATE workspace_settings SET last_backup_at = ?, next_backup_at = ?, updated_at = ? WHERE workspace_id = ?')
        .bind(completedAt, nextBackupAt(String((await backupSettingsRow(env, workspaceId))?.backup_schedule ?? 'manual'), completedAt), completedAt, workspaceId)
        .run()
    }
    await logEvent(env.DB, workspaceId, 'workspace', 'backup', `Backup completed (${kind})`, `${Object.values(snapshot.counts).reduce((a, b) => a + b, 0)} rows · ${sealed.length} bytes`)
    const row = await env.DB.prepare('SELECT * FROM backups WHERE id = ?').bind(id).first<any>()
    return mapBackup(row)
  } catch (error) {
    await env.DB.prepare("UPDATE backups SET status = 'failed', error = ?, completed_at = ? WHERE id = ? AND workspace_id = ?")
      .bind(String((error as Error).message).slice(0, 400), now(), id, workspaceId)
      .run()
    throw error
  }
}

function nextBackupAt(schedule: string, from = now()): number | null {
  if (schedule === 'daily') return from + 24 * 60 * 60 * 1000
  if (schedule === 'weekly') return from + 7 * 24 * 60 * 60 * 1000
  return null
}

async function readSnapshot(env: Env, backup: any): Promise<Snapshot> {
  if (!backup?.storage_key) throw new Error('This backup has no stored file.')
  const object = await env.FILES.get(backup.storage_key)
  if (!object) throw new Error('The backup file is missing from storage.')
  const sealed = await object.text()
  const json = await openSecret(env, sealed, backupSecretContext(backup.workspace_id, backup.id))
  const checksum = await checksumText(json)
  if (checksum !== backup.checksum) throw new Error('Backup integrity check failed: the checksum does not match.')
  const snapshot = JSON.parse(json) as Snapshot
  if (snapshot.workspaceId !== backup.workspace_id) throw new Error('Backup belongs to a different workspace.')
  if (snapshot.version !== SNAPSHOT_VERSION) throw new Error('This backup was written by an unsupported version.')
  return snapshot
}

async function insertRows(env: Env, table: string, rows: any[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 20) {
    const batch = rows.slice(i, i + 20)
    const statements = batch.map((row) => {
      const keys = Object.keys(row)
      const placeholders = keys.map(() => '?').join(', ')
      return env.DB.prepare(`INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).bind(...keys.map((key) => row[key]))
    })
    await env.DB.batch(statements)
  }
}

export async function restoreBackup(env: Env, workspaceId: string, backupId: string): Promise<{ counts: Record<string, number>; verified: boolean; safetyBackupId: string }> {
  const backup = await env.DB.prepare('SELECT * FROM backups WHERE id = ? AND workspace_id = ?').bind(backupId, workspaceId).first<any>()
  if (!backup) throw new Error('Backup not found.')
  if (backup.status !== 'completed' && backup.status !== 'restored') throw new Error('Only a completed backup can be restored.')
  const snapshot = await readSnapshot(env, backup)
  const safety = await createBackup(env, workspaceId, 'pre_restore')

  try {
    // Delete tenant rows in child-first order. Workspaces, users and sessions
    // are never deleted; the workspace row is updated from the snapshot.
    for (const table of DELETE_ORDER) {
      if (!snapshot.tables[table]) continue
      if (table === 'agent_tools' || table === 'agent_tool_accounts' || table === 'agent_tool_actions') {
        await env.DB.prepare(`DELETE FROM ${table} WHERE agent_id IN (SELECT id FROM agents WHERE workspace_id = ?)`).bind(workspaceId).run()
      } else if (table === 'usage' || table === 'workspace_settings') {
        await env.DB.prepare(`DELETE FROM ${table} WHERE workspace_id = ?`).bind(workspaceId).run()
      } else {
        await env.DB.prepare(`DELETE FROM ${table} WHERE workspace_id = ?`).bind(workspaceId).run()
      }
    }

    for (const table of RESTORE_ORDER) {
      const rows = snapshot.tables[table] ?? []
      if (!rows.length) continue
      await insertRows(env, table, rows)
    }

    const workspaceRow = snapshot.tables.workspaces?.[0]
    if (workspaceRow) {
      await env.DB.prepare('UPDATE workspaces SET name = ?, company = ?, plan = ? WHERE id = ?')
        .bind(workspaceRow.name, workspaceRow.company, workspaceRow.plan, workspaceId)
        .run()
    }

    // Restoration validation: recount every table and compare with the snapshot.
    const counts: Record<string, number> = {}
    let verified = true
    for (const table of TABLES) {
      if (!snapshot.tables[table.name]) continue
      let actual = 0
      if (table.name === 'workspaces') {
        actual = (await env.DB.prepare('SELECT COUNT(*) AS n FROM workspaces WHERE id = ?').bind(workspaceId).first<{ n: number }>())?.n ?? 0
      } else if (table.name === 'agent_tools' || table.name === 'agent_tool_accounts' || table.name === 'agent_tool_actions') {
        actual = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table.name} WHERE agent_id IN (SELECT id FROM agents WHERE workspace_id = ?)`).bind(workspaceId).first<{ n: number }>())?.n ?? 0
      } else {
        actual = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table.name} WHERE workspace_id = ?`).bind(workspaceId).first<{ n: number }>())?.n ?? 0
      }
      counts[table.name] = actual
      if (actual !== (snapshot.counts[table.name] ?? 0)) verified = false
    }

    await env.DB.prepare("UPDATE backups SET status = 'restored', restored_at = ? WHERE id = ? AND workspace_id = ?").bind(now(), backup.id, workspaceId).run()
    await logEvent(env.DB, workspaceId, 'workspace', 'backup', `Restored backup ${backup.id}`, verified ? 'Integrity and row counts verified' : 'Restored with count differences — review the report')
    return { counts, verified, safetyBackupId: safety.id }
  } catch (error) {
    await logEvent(env.DB, workspaceId, 'workspace', 'backup', `Restore failed for ${backup.id}`, String((error as Error).message).slice(0, 300))
    throw error
  }
}

async function retention(env: Env, workspaceId: string, days: number): Promise<void> {
  const floor = now() - Math.max(1, days) * 24 * 60 * 60 * 1000
  const { results } = await env.DB.prepare(
    "SELECT id, storage_key FROM backups WHERE workspace_id = ? AND created_at < ? AND kind != 'pre_restore' ORDER BY created_at",
  )
    .bind(workspaceId, floor)
    .all<any>()
  for (const row of results.slice(0, Math.max(0, results.length - 2))) {
    if (row.storage_key) await env.FILES.delete(row.storage_key).catch(() => undefined)
    await env.DB.prepare('DELETE FROM backups WHERE id = ? AND workspace_id = ?').bind(row.id, workspaceId).run()
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerBackupRoutes(app: Hono<AppEnv>): void {
  app.get('/api/backups', async (c) => {
    const { workspace } = c.get('session')
    const { results } = await c.env.DB.prepare('SELECT * FROM backups WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 100')
      .bind(workspace.id)
      .all<any>()
    const settings = await backupSettingsRow(c.env as Env, workspace.id)
    const data: BackupSettings = {
      schedule: settings?.backup_schedule === 'daily' || settings?.backup_schedule === 'weekly' ? settings.backup_schedule : 'manual',
      retentionDays: Number(settings?.backup_retention_days ?? 30),
      lastBackupAt: settings?.last_backup_at ?? null,
      nextBackupAt: settings?.next_backup_at ?? null,
    }
    return c.json({ data: { backups: results.map(mapBackup), settings: data, encryptionConfigured: credentialEncryptionConfigured(c.env as Env) } })
  })

  app.patch('/api/backups/settings', async (c) => {
    const { workspace } = c.get('session')
    const body = await c.req.json<any>().catch(() => ({}))
    const schedule = ['manual', 'daily', 'weekly'].includes(body.schedule) ? body.schedule : 'manual'
    const days = Math.max(1, Math.min(365, Number(body.retentionDays ?? 30) || 30))
    await backupSettingsRow(c.env as Env, workspace.id)
    await c.env.DB.prepare('UPDATE workspace_settings SET backup_schedule = ?, backup_retention_days = ?, next_backup_at = ?, updated_at = ? WHERE workspace_id = ?')
      .bind(schedule, days, schedule === 'manual' ? null : nextBackupAt(schedule), now(), workspace.id)
      .run()
    return c.json({ data: { schedule, retentionDays: days, nextBackupAt: schedule === 'manual' ? null : nextBackupAt(schedule) } })
  })

  app.post('/api/backups', async (c) => {
    const { workspace, user } = c.get('session')
    if (!credentialEncryptionConfigured(c.env as Env)) {
      return c.json({ error: 'Backup encryption is not configured.', hint: 'Set CREDENTIAL_KEY on the server before creating backups.' }, 503)
    }
    try {
      const backup = await createBackup(c.env as Env, workspace.id, 'manual')
      await audit(c.env.DB, workspace.id, user.id, 'backup.create', backup.id, `${backup.size} bytes`, c.req.header('cf-connecting-ip') ?? null)
      return c.json({ data: backup }, 201)
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500)
    }
  })

  app.post('/api/backups/tick', async (c) => {
    const { workspace } = c.get('session')
    const settings = await backupSettingsRow(c.env as Env, workspace.id)
    if (!settings || settings.backup_schedule === 'manual' || !settings.next_backup_at || settings.next_backup_at > now()) {
      return c.json({ data: { ran: false, reason: 'No scheduled backup is due.' } })
    }
    const backup = await createBackup(c.env as Env, workspace.id, 'scheduled')
    await retention(c.env as Env, workspace.id, Number(settings.backup_retention_days ?? 30))
    return c.json({ data: { ran: true, backup } })
  })

  app.get('/api/backups/:id/download', async (c) => {
    const { workspace } = c.get('session')
    const backup = await c.env.DB.prepare('SELECT * FROM backups WHERE id = ? AND workspace_id = ?').bind(c.req.param('id'), workspace.id).first<any>()
    if (!backup) return c.json({ error: 'Backup not found.' }, 404)
    try {
      const snapshot = await readSnapshot(c.env as Env, backup)
      await audit(c.env.DB, workspace.id, c.get('session').user.id, 'backup.download', backup.id, null, null)
      return c.body(JSON.stringify(snapshot, null, 2), 200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="lumo-backup-${backup.id}.json"`,
      })
    } catch (error) {
      return c.json({ error: (error as Error).message }, 422)
    }
  })

  app.post('/api/backups/:id/verify', async (c) => {
    const { workspace } = c.get('session')
    const backup = await c.env.DB.prepare('SELECT * FROM backups WHERE id = ? AND workspace_id = ?').bind(c.req.param('id'), workspace.id).first<any>()
    if (!backup) return c.json({ error: 'Backup not found.' }, 404)
    try {
      const snapshot = await readSnapshot(c.env as Env, backup)
      return c.json({
        data: {
          verified: true,
          checksum: backup.checksum,
          rows: Object.values(snapshot.counts).reduce((total, value) => total + value, 0),
          tables: snapshot.counts,
          truncated: snapshot.truncated,
          generatedAt: snapshot.generatedAt,
        },
      })
    } catch (error) {
      return c.json({ data: { verified: false, error: (error as Error).message } }, 422)
    }
  })

  app.post('/api/backups/:id/restore', async (c) => {
    const { workspace, user } = c.get('session')
    const body = await c.req.json<any>().catch(() => ({}))
    if (body.confirm !== true) {
      return c.json({ error: 'Restore replaces this workspace’s agents, records, documents and conversations.', hint: 'Send confirm: true to proceed. A safety backup is taken first.' }, 400)
    }
    try {
      const result = await restoreBackup(c.env as Env, workspace.id, c.req.param('id'))
      await audit(c.env.DB, workspace.id, user.id, 'backup.restore', c.req.param('id'), result.verified ? 'verified' : 'count mismatch', c.req.header('cf-connecting-ip') ?? null)
      return c.json({
        data: result,
        hint: result.verified ? 'Restore verified against the backup manifest.' : 'Restore completed but some counts differ. Review the report before relying on the data.',
      }, result.verified ? 200 : 409)
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500)
    }
  })

  app.delete('/api/backups/:id', async (c) => {
    const { workspace } = c.get('session')
    const backup = await c.env.DB.prepare('SELECT * FROM backups WHERE id = ? AND workspace_id = ?').bind(c.req.param('id'), workspace.id).first<any>()
    if (!backup) return c.json({ error: 'Backup not found.' }, 404)
    if (backup.storage_key) await c.env.FILES.delete(backup.storage_key).catch(() => undefined)
    await c.env.DB.prepare('DELETE FROM backups WHERE id = ? AND workspace_id = ?').bind(backup.id, workspace.id).run()
    return c.json({ data: { deleted: true } })
  })

  app.get('/api/export', async (c) => {
    const { workspace, user } = c.get('session')
    const snapshot = await collectSnapshot(c.env as Env, workspace.id)
    await audit(c.env.DB, workspace.id, user.id, 'workspace.export', 'json', null, c.req.header('cf-connecting-ip') ?? null)
    const document = {
      format: 'lumo-workspace-export',
      version: SNAPSHOT_VERSION,
      exportedAt: new Date().toISOString(),
      workspace: { id: workspace.id, name: workspace.name, company: workspace.company, plan: workspace.plan },
      note: 'Credentials, OAuth tokens and database secrets are never included. Restored accounts must be reconnected.',
      counts: snapshot.counts,
      tables: snapshot.tables,
    }
    return c.body(JSON.stringify(document, null, 2), 200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="lumo-workspace-${new Date().toISOString().slice(0, 10)}.json"`,
    })
  })

  app.get('/api/export/csv', async (c) => {
    const { workspace } = c.get('session')
    const collection = c.req.query('collection') ?? ''
    if (collection && !COLLECTION_RE.test(collection)) return c.json({ error: 'Invalid collection name.' }, 400)
    const { results } = collection
      ? await c.env.DB.prepare('SELECT * FROM records WHERE workspace_id = ? AND collection = ? ORDER BY created_at').bind(workspace.id, collection).all<any>()
      : await c.env.DB.prepare('SELECT * FROM records WHERE workspace_id = ? ORDER BY collection, created_at').bind(workspace.id).all<any>()
    const columns = new Set<string>(['id', 'collection', 'created_at'])
    const parsed = (results ?? []).map((row) => ({ ...parseJson<Record<string, unknown>>(row.data, {}), id: row.id, collection: row.collection, created_at: new Date(row.created_at).toISOString() }))
    for (const row of parsed) for (const key of Object.keys(row)) columns.add(key)
    const header = [...columns]
    const escape = (value: unknown) => {
      const text = value === null || value === undefined ? '' : String(value)
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const lines = [header.map(escape).join(',')]
    for (const row of parsed) lines.push(header.map((column) => escape((row as any)[column])).join(','))
    return c.body(`${lines.join('\r\n')}\r\n`, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lumo-records-${new Date().toISOString().slice(0, 10)}.csv"`,
    })
  })
}

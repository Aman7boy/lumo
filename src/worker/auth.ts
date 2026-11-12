// Password hashing and sessions. PBKDF2-SHA256 with a per-user salt, stored in
// the D1 user row; the session token lives in an httpOnly cookie and is never
// exposed to client JavaScript.

import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Context } from 'hono'
import type { AccountType, PlanKey, User, Workspace } from '../shared/types'

const ITERATIONS = 100_000
const SESSION_COOKIE = 'crv_session'
const SESSION_DAYS = 30

const encoder = new TextEncoder()

function b64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function unb64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256)
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(new Uint8Array(bits))}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterationsRaw, saltRaw, hashRaw] = stored.split('$')
  if (scheme !== 'pbkdf2' || !saltRaw || !hashRaw) return false
  const iterations = Number(iterationsRaw)
  if (!Number.isFinite(iterations) || iterations < 1000) return false
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(saltRaw), iterations, hash: 'SHA-256' }, key, 256),
  )
  const expected = unb64(hashRaw)
  if (bits.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < bits.length; i += 1) diff |= bits[i] ^ expected[i]
  return diff === 0
}

export interface SessionContext {
  user: User
  workspace: Workspace
  sessionId: string
}

export function sessionCookieOptions(c: Context, maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: 'Lax' as const,
    secure: new URL(c.req.url).protocol === 'https:',
    path: '/',
    maxAge,
  }
}

export async function createSession(c: Context, db: D1Database, userId: string, workspaceId: string): Promise<void> {
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('')
  const createdAt = Date.now()
  const expiresAt = createdAt + SESSION_DAYS * 24 * 60 * 60 * 1000
  await db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(createdAt).run()
  await db
    .prepare('INSERT INTO sessions (id, user_id, workspace_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(token, userId, workspaceId, createdAt, expiresAt)
    .run()
  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(c, SESSION_DAYS * 24 * 60 * 60))
}

export async function clearSession(c: Context, db: D1Database): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) await db.prepare('DELETE FROM sessions WHERE id = ?').bind(token).run()
  deleteCookie(c, SESSION_COOKIE, sessionCookieOptions(c))
}

export async function readSession(c: Context, db: D1Database): Promise<SessionContext | null> {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) return null
  const row = await db
    .prepare(
      `SELECT s.id AS session_id, u.id AS user_id, u.email, u.name, u.account_type, u.password_hash, u.role, u.disabled,
              w.id AS workspace_id, w.name AS workspace_name, w.company, w.plan, w.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN workspaces w ON w.id = s.workspace_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .bind(token, Date.now())
    .first<any>()
  if (!row || row.disabled) return null
  return {
    sessionId: row.session_id,
    user: {
      id: row.user_id,
      email: row.email,
      name: row.name,
      accountType: row.account_type as AccountType,
      role: row.role === 'admin' ? 'admin' : 'user',
    },
    workspace: {
      id: row.workspace_id,
      name: row.workspace_name,
      company: row.company,
      plan: row.plan as PlanKey,
      accountType: row.account_type as AccountType,
      createdAt: row.created_at,
    },
  }
}

export async function createUserAndWorkspace(
  db: D1Database,
  input: {
    name: string
    email: string
    password: string
    accountType: AccountType
    workspaceName: string
    company: string
  },
): Promise<{ userId: string; workspaceId: string }> {
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(input.email.toLowerCase()).first<any>()
  if (existing) throw new Error('EMAIL_TAKEN')

  const userId = `usr_${crypto.randomUUID().slice(0, 8)}${Date.now().toString(36)}`
  const workspaceId = `ws_${crypto.randomUUID().slice(0, 8)}${Date.now().toString(36)}`
  const createdAt = Date.now()
  const passwordHash = await hashPassword(input.password)

  await db
    .prepare('INSERT INTO users (id, email, name, password_hash, account_type, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(userId, input.email.toLowerCase(), input.name, passwordHash, input.accountType, createdAt)
    .run()
  await db
    .prepare('INSERT INTO workspaces (id, owner_id, name, company, plan, account_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(workspaceId, userId, input.workspaceName, input.company, 'free', input.accountType, createdAt)
    .run()
  await db
    .prepare('INSERT INTO usage (workspace_id, month, ai_calls, tokens) VALUES (?, ?, 0, 0)')
    .bind(workspaceId, new Date(createdAt).toISOString().slice(0, 7))
    .run()
  return { userId, workspaceId }
}

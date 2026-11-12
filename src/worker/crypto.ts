// Credential sealing for tenant secrets. AES-256-GCM with a per-record context
// so a ciphertext cannot be moved between workspaces or records. The master key
// lives only in the Worker environment (CREDENTIAL_KEY), never in D1, logs,
// browser storage or API responses.

export const SEALED_PREFIX = 'sealed:v1:'

export class CredentialKeyError extends Error {
  constructor() {
    super('Credential encryption is not configured on the server.')
    this.name = 'CredentialKeyError'
  }
}

type KeyEnv = { CREDENTIAL_KEY?: string }

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function masterKey(env: KeyEnv): Promise<CryptoKey> {
  const raw = env.CREDENTIAL_KEY?.trim()
  if (!raw || raw.length < 16) throw new CredentialKeyError()
  let keyBytes: Uint8Array<ArrayBuffer>
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    keyBytes = new Uint8Array(32)
    for (let i = 0; i < 32; i += 1) keyBytes[i] = Number.parseInt(raw.slice(i * 2, i * 2 + 2), 16)
  } else {
    // Accept a base64-encoded 32-byte key or a strong passphrase. Hashing a
    // passphrase gives a stable 256-bit key without ever storing the phrase.
    const decoded = /^[A-Za-z0-9+/]+={0,2}$/.test(raw) ? base64ToBytes(raw) : null
    keyBytes =
      decoded && decoded.length === 32
        ? decoded
        : new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))
  }
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export function isSealed(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(SEALED_PREFIX)
}

export function credentialEncryptionConfigured(env: KeyEnv): boolean {
  return Boolean(env.CREDENTIAL_KEY && env.CREDENTIAL_KEY.trim().length >= 16)
}

export async function sealSecret(env: KeyEnv, plaintext: string, context: string): Promise<string> {
  if (!plaintext) return ''
  const key = await masterKey(env)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(context) },
      key,
      encoded,
    ),
  )
  return `${SEALED_PREFIX}${bytesToBase64(iv)}.${bytesToBase64(ciphertext)}`
}

export async function openSecret(env: KeyEnv, stored: string | null | undefined, context: string): Promise<string> {
  if (!stored) return ''
  // Legacy rows written before sealing remain readable. They are re-sealed by
  // the migration when CREDENTIAL_KEY is available.
  if (!isSealed(stored)) return stored
  const key = await masterKey(env)
  const payload = stored.slice(SEALED_PREFIX.length)
  const [ivRaw, cipherRaw] = payload.split('.')
  if (!ivRaw || !cipherRaw) throw new Error('Stored credential is malformed.')
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(ivRaw),
      additionalData: new TextEncoder().encode(context),
    },
    key,
    base64ToBytes(cipherRaw),
  )
  return new TextDecoder().decode(plaintext)
}

export function modelSecretContext(workspaceId: string, connectionId: string): string {
  return `model:${workspaceId}:${connectionId}`
}

export function integrationSecretContext(workspaceId: string, integration: string): string {
  return `integration:${workspaceId}:${integration}`
}

export function accountSecretContext(workspaceId: string, accountId: string): string {
  return `account:${workspaceId}:${accountId}`
}

export function oauthTokenContext(workspaceId: string, groupId: string, field: 'access' | 'refresh'): string {
  return `oauth:${workspaceId}:${groupId}:${field}`
}

export function oauthClientContext(workspaceId: string, provider: string): string {
  return `oauth-client:${workspaceId}:${provider}`
}

export function databaseSecretContext(workspaceId: string, sourceId: string): string {
  return `database:${workspaceId}:${sourceId}`
}

export function voiceSecretContext(workspaceId: string, providerId: string): string {
  return `voice:${workspaceId}:${providerId}`
}

export function ocrSecretContext(workspaceId: string, providerId: string): string {
  return `ocr:${workspaceId}:${providerId}`
}

export function backupSecretContext(workspaceId: string, backupId: string): string {
  return `backup:${workspaceId}:${backupId}`
}

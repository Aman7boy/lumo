import type { ApiEnvelope } from '../shared/types'

export class ApiError extends Error {
  status: number
  hint?: string
  constructor(message: string, status: number, hint?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.hint = hint
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0)
  }

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok) {
    throw new ApiError(payload?.error ?? `Request failed (${response.status}).`, response.status, payload?.hint)
  }
  if (!payload || payload.data === undefined) {
    throw new ApiError('The server returned an unexpected response.', response.status)
  }
  return payload.data
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', body: form }),
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.hint ? `${error.message} ${error.hint}` : error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}

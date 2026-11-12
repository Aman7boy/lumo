// Provider connection testing and model discovery. Keys are passed only from
// the Worker after decryption; nothing here returns a credential.

import { providerMap } from '../shared/catalog'

export interface ProviderTestResult {
  ok: boolean
  models: string[]
  message: string
}

function normaliseBase(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')
  try {
    const payload = JSON.parse(text)
    return String(payload?.error?.message ?? payload?.message ?? `HTTP ${response.status}`).slice(0, 240)
  } catch {
    return (text || `HTTP ${response.status}`).slice(0, 240)
  }
}

export async function discoverProviderModels(input: {
  provider: string
  baseUrl: string
  apiKey: string
}): Promise<ProviderTestResult> {
  const def = providerMap[input.provider]
  const protocol = def?.protocol ?? 'openai'
  const baseUrl = normaliseBase(input.baseUrl || def?.baseUrl || '')
  if (!baseUrl) return { ok: false, models: [], message: 'This provider needs a base URL.' }

  try {
    if (protocol === 'anthropic') {
      const response = await fetch(`${baseUrl}/models?limit=100`, {
        headers: { 'x-api-key': input.apiKey, 'anthropic-version': '2023-06-01' },
        signal: AbortSignal.timeout(12_000),
      })
      if (!response.ok) return { ok: false, models: [], message: await readError(response) }
      const data = (await response.json()) as { data?: Array<{ id?: string }> }
      return { ok: true, models: (data.data ?? []).map((m) => String(m.id ?? '')).filter(Boolean), message: 'Connection verified.' }
    }

    if (protocol === 'google') {
      const response = await fetch(`${baseUrl}/models?key=${encodeURIComponent(input.apiKey)}&pageSize=100`, {
        signal: AbortSignal.timeout(12_000),
      })
      if (!response.ok) return { ok: false, models: [], message: await readError(response) }
      const data = (await response.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> }
      const models = (data.models ?? [])
        .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
        .map((m) => String(m.name ?? '').replace(/^models\//, ''))
        .filter(Boolean)
      return { ok: true, models, message: 'Connection verified.' }
    }

    const headers: Record<string, string> = { Authorization: `Bearer ${input.apiKey}` }
    const response = await fetch(`${baseUrl}/models`, { headers, signal: AbortSignal.timeout(12_000) })
    if (!response.ok) {
      return { ok: false, models: [], message: await readError(response) }
    }
    const data = (await response.json()) as { data?: Array<{ id?: string }>; models?: Array<{ id?: string; name?: string }> }
    const models = data.data
      ? data.data.map((m) => String(m.id ?? '')).filter(Boolean)
      : (data.models ?? []).map((m) => String(m.id ?? m.name ?? '')).filter(Boolean)
    models.sort((a, b) => a.localeCompare(b))
    return { ok: true, models, message: models.length ? `Connection verified. ${models.length} models available.` : 'Connection verified.' }
  } catch (error) {
    return {
      ok: false,
      models: [],
      message:
        (error as Error).name === 'TimeoutError'
          ? 'The provider did not respond within 12 seconds.'
          : `Could not reach the provider: ${(error as Error).message}`,
    }
  }
}

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import { api } from '../lib/api'
import type { PlanKey, User, Workspace } from '../shared/types'

export interface Me {
  user: User
  workspace: Workspace
  plan: { key: PlanKey; name: string; agentLimit: number }
  engine: { provider: 'builtin' | 'openai'; model: string; externalConfigured: boolean; searchConfigured?: boolean }
  isAdmin: boolean
  credentialEncryption: boolean
}

interface AuthValue {
  me: Me | null
  loading: boolean
  refresh: () => Promise<Me | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const next = await api.get<Me>('/api/me')
      setMe(next)
      return next
    } catch {
      setMe(null)
      return null
    }
  }, [])

  useEffect(() => {
    let alive = true
    api
      .get<Me>('/api/me')
      .then((next) => {
        if (alive) setMe(next)
      })
      .catch(() => {
        if (alive) setMe(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const signOut = useCallback(async () => {
    await api.post('/api/auth/logout').catch(() => undefined)
    setMe(null)
  }, [])

  return <AuthContext.Provider value={{ me, loading, refresh, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

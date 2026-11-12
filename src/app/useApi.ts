import { useCallback, useEffect, useRef, useState } from 'react'

import { api, errorMessage } from '../lib/api'

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(path))
  const [tick, setTick] = useState(0)
  const first = useRef(true)

  useEffect(() => {
    if (!path) {
      setLoading(false)
      return
    }
    let alive = true
    if (first.current) setLoading(true)
    setError(null)
    api
      .get<T>(path)
      .then((result) => {
        if (alive) setData(result)
      })
      .catch((cause) => {
        if (alive) setError(errorMessage(cause))
      })
      .finally(() => {
        if (alive) {
          setLoading(false)
          first.current = false
        }
      })
    return () => {
      alive = false
    }
  }, [path, tick])

  const reload = useCallback(() => setTick((value) => value + 1), [])
  return { data, error, loading, reload, setData }
}

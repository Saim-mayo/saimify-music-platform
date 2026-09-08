import { useEffect } from 'react'

export default function useSessionRefresh({ isAuthenticated, refresh, delayMs }) {
  useEffect(() => {
    if (!isAuthenticated) return undefined

    let timer
    let cancelled = false

    const scheduleRefresh = () => {
      timer = window.setTimeout(async () => {
        try {
          await refresh()
        } catch {
          // The auth store clears the session when refresh cannot recover it.
        }
        if (!cancelled) scheduleRefresh()
      }, delayMs)
    }

    scheduleRefresh()

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [delayMs, isAuthenticated, refresh])
}
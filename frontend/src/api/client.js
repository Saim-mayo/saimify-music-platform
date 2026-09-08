import axios from 'axios'
import { runtime } from '@/config/runtime'

// Use same-origin proxy during development to avoid third-party cookie issues.
// In dev, Vite serves the app and proxies `/api` to the backend; the
// browser sees requests as same-origin so cookies set by the server are
// included on subsequent requests. In production, prefer an explicit
// VITE_API_BASE_URL if provided.
const apiClient = axios.create({
  baseURL: runtime.apiBaseUrl,
  withCredentials: true,
  timeout: 10000,
})

let refreshPromise = null
let refreshChannel = null
const refreshLockName = 'spotify-refresh-token'
const refreshSignalKey = 'spotify-refresh-token-signal'

const isAuthRoute = (url = '') => /\/auth\/(login|register|refresh-token|logout|forgot-password|reset-password|verify-email|resend-verification)/.test(url)

export const refreshSession = () => {
  if (!refreshPromise) {
    refreshPromise = coordinateRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

const refreshRequest = () => apiClient.post('/auth/refresh-token')

const getRefreshChannel = () => {
  if (!refreshChannel && typeof BroadcastChannel !== 'undefined') {
    refreshChannel = new BroadcastChannel(refreshLockName)
  }
  return refreshChannel
}

const publishRefreshSignal = (ok) => {
  const signal = { ok, at: Date.now() }
  try {
    window.localStorage.setItem(refreshSignalKey, JSON.stringify(signal))
  } catch {
    // Storage may be unavailable in private browsing; BroadcastChannel is enough there.
  }
  getRefreshChannel()?.postMessage(signal)
}

const waitForRefreshSignal = (startedAt = Date.now()) => {
  const channel = getRefreshChannel()

  return new Promise((resolve, reject) => {
    let settled = false
    let timer

    const cleanup = () => {
      window.removeEventListener('storage', onStorage)
      channel?.removeEventListener('message', onMessage)
      window.clearTimeout(timer)
    }

    const finish = (signal) => {
      if (settled) return
      settled = true
      cleanup()
      if (signal?.ok) {
        resolve({ data: { sharedRefresh: true } })
      } else {
        reject(Object.assign(new Error('Shared refresh failed'), { response: { status: 401 } }))
      }
    }

    const onStorage = (event) => {
      if (event.key !== refreshSignalKey || !event.newValue) return
      try {
        const signal = JSON.parse(event.newValue)
        if (signal.at > startedAt) finish(signal)
      } catch {
        // Ignore malformed coordination data.
      }
    }

    const onMessage = (event) => {
      if (event.data?.at > startedAt) finish(event.data)
    }

    window.addEventListener('storage', onStorage)
    channel?.addEventListener('message', onMessage)

    const poll = () => {
      if (settled) return
      try {
        const signal = JSON.parse(window.localStorage.getItem(refreshSignalKey) || 'null')
        if (signal?.at > startedAt) return finish(signal)
      } catch {
        // Ignore unavailable storage and rely on BroadcastChannel.
      }
      if (Date.now() - startedAt >= 15000) {
        finish({ ok: false })
        return
      }
      timer = window.setTimeout(poll, 100)
    }
    poll()
  })
}

const coordinateRefresh = async () => {
  const coordinationStartedAt = Date.now()

  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    let ownerResult
    await navigator.locks.request(refreshLockName, { ifAvailable: true }, async (lock) => {
      if (!lock) return
      try {
        ownerResult = await refreshRequest()
        publishRefreshSignal(true)
      } catch (error) {
        publishRefreshSignal(false)
        throw error
      }
    })
    return ownerResult || waitForRefreshSignal(coordinationStartedAt)
  }

  const ownerId = `${Date.now()}-${Math.random()}`
  let ownsFallbackLock = false
  try {
    const currentLock = window.localStorage.getItem(refreshLockName)
    if (!currentLock) {
      window.localStorage.setItem(refreshLockName, ownerId)
      ownsFallbackLock = window.localStorage.getItem(refreshLockName) === ownerId
    }
  } catch {
    ownsFallbackLock = true
  }

  if (!ownsFallbackLock) return waitForRefreshSignal(coordinationStartedAt)

  try {
    const response = await refreshRequest()
    publishRefreshSignal(true)
    return response
  } catch (error) {
    publishRefreshSignal(false)
    throw error
  } finally {
    try {
      if (window.localStorage.getItem(refreshLockName) === ownerId) {
        window.localStorage.removeItem(refreshLockName)
      }
    } catch {
      // Ignore unavailable storage.
    }
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const status = error.response?.status
    const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh-token')

    if (!originalRequest || isRefreshRequest || status !== 401 || isAuthRoute(originalRequest?.url)) {
      return Promise.reject(error)
    }

    originalRequest._retryCount = originalRequest._retryCount ?? 0
    if (originalRequest._retryCount >= 1) {
      return Promise.reject(error)
    }

    originalRequest._retryCount += 1

    try {
      await refreshSession()
      return apiClient(originalRequest)
    } catch (refreshError) {
      return Promise.reject(refreshError)
    }
  },
)

export default apiClient

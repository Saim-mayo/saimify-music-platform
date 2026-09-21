import { create } from 'zustand'
import { runtime } from '@/config/runtime'
import { setSessionActive } from '@/api/client'
import { usePlayerStore } from './playerStore'
import {
  forgotPassword,
  getMe,
  getMyFeatures,
  login,
  logout,
  register,
  refreshAccessToken as refreshAccessTokenRequest,
  requestArtistVerification,
  resendVerification,
  resetPassword,
  verifyEmail,
} from '@/api'

const resolveApiUrl = (value = '') => {
  if (!value || typeof value !== 'string') return ''
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value

  // In development we proxy `/api` through Vite, so use a relative
  // path (no host) to keep requests same-origin and avoid third-party
  // cookie restrictions. In production, use VITE_API_BASE_URL when set.
  const base = import.meta.env.DEV ? '' : runtime.apiOrigin

  return value.startsWith('/') ? `${base}${value}` : `${base}/${value}`
}

const normalizeUser = (user) => {
  if (!user || typeof user !== 'object') return null
  if (typeof user.avatar === 'string' && user.avatar) {
    return { ...user, avatar: resolveApiUrl(user.avatar) }
  }
  return user
}

const isInvalidSessionError = (error) => [401, 403].includes(error?.response?.status)
const isRetryableSessionError = (error) => !error?.response || error.response.status >= 500
const sessionBootstrapRetryDelays = [250, 750]

const loadSession = async () => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await Promise.all([getMe(), getMyFeatures().catch(() => null)])
    } catch (error) {
      const retryDelay = sessionBootstrapRetryDelays[attempt]
      if (!retryDelay || !isRetryableSessionError(error)) throw error
      await new Promise((resolve) => window.setTimeout(resolve, retryDelay))
    }
  }
}

export const useAuthStore = create((set, get) => ({
  user: null,
  features: null,
  isAuthenticated: false,
  initialized: false,
  loading: false,

  async fetchMe() {
    setSessionActive(true)
    set({ loading: true })
    try {
      const [user, features] = await loadSession()
      const normalizedUser = normalizeUser(user)
      set({ user: normalizedUser, features, isAuthenticated: Boolean(normalizedUser), initialized: true, loading: false })
      return normalizedUser
    } catch (error) {
      const currentUser = get().user
      if (currentUser && !isInvalidSessionError(error)) {
        set({ initialized: true, loading: false })
        return currentUser
      }
      set({ user: null, features: null, isAuthenticated: false, initialized: true, loading: false })
      return null
    }
  },

  async refreshFeatures() {
    try {
      const features = await getMyFeatures().catch(() => null)
      set({ features })
      return features
    } catch {
      return null
    }
  },

  async login(payload) {
    set({ loading: true })
    try {
      setSessionActive(true)
      const data = await login(payload)
      const user = await get().fetchMe()
      return { ...data, user }
    } catch (error) {
      set({ user: null, features: null, isAuthenticated: false, loading: false })
      throw error
    }
  },

  async register(payload) {
    set({ loading: true })
    try {
      setSessionActive(true)
      const data = await register(payload)
      const user = await get().fetchMe()
      return { ...data, user }
    } catch (error) {
      set({ user: null, features: null, isAuthenticated: false, loading: false })
      throw error
    }
  },

  async logout() {
    setSessionActive(false)
    usePlayerStore.getState().resetPlayback()
    set({ loading: true })
    try {
      await logout()
      set({ user: null, features: null, isAuthenticated: false, loading: false })
    } catch (error) {
      set({ user: null, features: null, isAuthenticated: false, loading: false })
      throw error
    }
  },

  async requestArtistAccess() {
    set({ loading: true })
    try {
      const data = await requestArtistVerification()
      await get().fetchMe()
      return data
    } finally {
      set({ loading: false })
    }
  },

  async verifyEmail(token) {
    set({ loading: true })
    try {
      return await verifyEmail(token)
    } finally {
      set({ loading: false })
    }
  },

  async resendVerification(payload) {
    set({ loading: true })
    try {
      return await resendVerification(payload)
    } finally {
      set({ loading: false })
    }
  },

  async refreshAccessToken() {
    if (!get().isAuthenticated) {
      setSessionActive(false)
      return null
    }
    set({ loading: true })
    try {
      await refreshAccessTokenRequest()
      const user = await get().fetchMe()
      return user
    } catch (error) {
      if (isInvalidSessionError(error)) {
        set({ user: null, features: null, isAuthenticated: false, loading: false })
      } else {
        set({ loading: false })
      }
      throw error
    } finally {
      set({ loading: false })
    }
  },

  async requestPasswordReset(payload) {
    set({ loading: true })
    try {
      return await forgotPassword(payload)
    } finally {
      set({ loading: false })
    }
  },

  async resetPassword(payload) {
    set({ loading: true })
    try {
      return await resetPassword(payload)
    } finally {
      set({ loading: false })
    }
  },
}))

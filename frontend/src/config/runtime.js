const envNumber = (name, fallback) => {
  const value = Number(import.meta.env?.[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

const stripTrailingSlashes = (value = '') => String(value).replace(/\/+$/, '')

const configuredApiBase = stripTrailingSlashes(import.meta.env?.VITE_API_BASE_URL || '')
const apiBaseUrl = import.meta.env.DEV ? '/api' : configuredApiBase || '/api'
const apiOrigin = configuredApiBase.replace(/\/api$/, '')
const oauthBaseUrl = stripTrailingSlashes(import.meta.env?.VITE_OAUTH_BASE_URL || apiOrigin)

export const runtime = Object.freeze({
  apiBaseUrl,
  apiOrigin,
  oauthBaseUrl,
  creatorCvUrl: import.meta.env?.VITE_CREATOR_CV_URL || 'https://github.com/Saim-mayo',
  accessTokenExpiresMs: envNumber('VITE_ACCESS_TOKEN_EXPIRES_MS', 15 * 60 * 1000),
  accessTokenRefreshLeadMs: envNumber('VITE_ACCESS_TOKEN_REFRESH_LEAD_MS', 2 * 60 * 1000),
  minimumRefreshDelayMs: envNumber('VITE_MINIMUM_REFRESH_DELAY_MS', 30 * 1000),
  searchDebounceMs: envNumber('VITE_SEARCH_DEBOUNCE_MS', 350),
  trendingTimeoutMs: envNumber('VITE_TRENDING_TIMEOUT_MS', 5000),
  unreadRefreshMs: envNumber('VITE_UNREAD_REFRESH_MS', 30 * 1000),
  maxRecentSearches: envNumber('VITE_MAX_RECENT_SEARCHES', 6),
})

export const buildApiUrl = (path = '') => {
  const normalizedPath = String(path).replace(/^\/+/, '')
  if (!normalizedPath) return runtime.apiOrigin
  return `${runtime.apiOrigin}/${normalizedPath}`
}

export const buildOAuthUrl = (providerPath) => {
  const normalizedPath = String(providerPath || '').replace(/^\/+/, '')
  return `${runtime.oauthBaseUrl}/${normalizedPath}`
}

export const buildStreamUrl = (songId) => {
  if (!songId) return ''
  return `${runtime.apiOrigin || ''}/api/music/stream/${encodeURIComponent(String(songId))}`
}

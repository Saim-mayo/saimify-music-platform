import apiClient, { refreshSession } from './client'

export const refreshAccessToken = async () => {
  const { data } = await refreshSession()
  return data
}

export const register = async (payload) => {
  const { data } = await apiClient.post('/auth/register', payload)
  return data
}

export const login = async (payload) => {
  const { data } = await apiClient.post('/auth/login', payload)
  return data
}

export const logout = async () => {
  const { data } = await apiClient.post('/auth/logout')
  return data
}

export const getMe = async () => {
  const { data } = await apiClient.get('/users/me')
  return data?.user || data || null
}

export const getMyFeatures = async () => {
  const { data } = await apiClient.get('/users/me/features')
  return data?.features || data || null
}

export const updateProfile = async (payload) => {
  const { data } = await apiClient.patch('/users/me', payload)
  return data
}

export const uploadAvatar = async (formData) => {
  const { data } = await apiClient.post('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export const setPassword = async (password) => {
  const { data } = await apiClient.patch('/users/set-password', { password })
  return data
}

export const requestArtistVerification = async () => {
  const { data } = await apiClient.post('/users/artist/request')
  return data
}

export const verifyEmail = async (token) => {
  const { data } = await apiClient.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
  return data
}

export const resendVerification = async (payload) => {
  const { data } = await apiClient.post('/auth/resend-verification', payload)
  return data
}

export const forgotPassword = async (payload) => {
  const { data } = await apiClient.post('/auth/forgot-password', payload)
  return data
}

export const resetPassword = async (payload) => {
  const { data } = await apiClient.post('/auth/reset-password', payload)
  return data
}

export const exchangeOAuthCode = async (code) => {
  const { data } = await apiClient.post('/auth/oauth/exchange', { code })
  return data
}

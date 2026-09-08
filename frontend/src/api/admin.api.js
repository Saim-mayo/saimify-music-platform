import apiClient from './client'
import { pagination } from '@/config/pagination'

export const getPendingArtists = async (page = pagination.firstPage, limit = pagination.adminPageSize) => {
  const { data } = await apiClient.get('/admin/artists/pending', { params: { page, limit } })
  return data
}

export const getUsers = async ({ page = pagination.firstPage, limit = pagination.adminPageSize, search = '', role = '', isBanned = '' } = {}) => {
  const { data } = await apiClient.get('/admin/users', {
    params: {
      page,
      limit,
      search,
      role,
      isBanned
    }
  })
  return data
}

export const approveArtist = async (userId) => {
  const { data } = await apiClient.patch(`/admin/artists/${encodeURIComponent(userId)}/approve`)
  return data
}

export const rejectArtist = async (userId) => {
  const { data } = await apiClient.patch(`/admin/artists/${encodeURIComponent(userId)}/reject`)
  return data
}

export const banUser = async (userId) => {
  const { data } = await apiClient.patch(`/admin/users/${encodeURIComponent(userId)}/ban`)
  return data
}

export const unbanUser = async (userId) => {
  const { data } = await apiClient.patch(`/admin/users/${encodeURIComponent(userId)}/unban`)
  return data
}

export const getAuditLog = async ({ page = pagination.firstPage, limit = pagination.adminAuditPageSize, targetUserId = '', action = '', from = '', to = '' } = {}) => {
  const { data } = await apiClient.get('/admin/audit-log', {
    params: {
      page,
      limit,
      targetUserId,
      action,
      from,
      to
    }
  })
  return data
}

export const cancelUserSubscription = async (userId) => {
  const { data } = await apiClient.patch(`/admin/users/${encodeURIComponent(userId)}/subscription/cancel`)
  return data
}

export const getAdminSongs = async ({ page = pagination.firstPage, limit = pagination.adminPageSize, search = '' } = {}) => {
  const { data } = await apiClient.get('/admin/songs', {
    params: {
      page,
      limit,
      search,
    }
  })
  return data
}

export const getAdminAlbums = async ({ page = pagination.firstPage, limit = pagination.adminPageSize, search = '' } = {}) => {
  const { data } = await apiClient.get('/admin/albums', {
    params: {
      page,
      limit,
      search,
    }
  })
  return data
}

export const getAdminPlaylists = async ({ page = pagination.firstPage, limit = pagination.adminPageSize, search = '' } = {}) => {
  const { data } = await apiClient.get('/admin/playlists', {
    params: {
      page,
      limit,
      search,
    }
  })
  return data
}

export const deleteSongAdmin = async (songId) => {
  const { data } = await apiClient.delete(`/music/${encodeURIComponent(songId)}`)
  return data
}

export const deleteAlbumAdmin = async (albumId) => {
  const { data } = await apiClient.delete(`/music/albums/${encodeURIComponent(albumId)}`)
  return data
}

export const deletePlaylistAdmin = async (playlistId) => {
  const { data } = await apiClient.delete(`/admin/playlists/${encodeURIComponent(playlistId)}`)
  return data
}

import apiClient from './client'
import { pagination } from '@/config/pagination'

const emitLibraryRefresh = () => {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('library:refresh', { detail: { source: 'playlists' } }))
  }
}

export const createPlaylist = async ({ title, isPublic, cover } = {}) => {
  if (cover) {
    const formData = new FormData()
    formData.append('title', title)
    if (isPublic !== undefined) formData.append('isPublic', isPublic)
    formData.append('cover', cover)
    const { data } = await apiClient.post('/playlists', formData)
    emitLibraryRefresh()
    return data
  }

  const { data } = await apiClient.post('/playlists', { title, isPublic })
  emitLibraryRefresh()
  return data
}

export const getUserPlaylists = async (page = pagination.firstPage, limit = pagination.defaultPageSize) => {
  const { data } = await apiClient.get('/playlists/user', { params: { page, limit } })
  return data
}

export const getPlaylistById = async (playlistId) => {
  const { data } = await apiClient.get(`/playlists/${encodeURIComponent(playlistId)}`)
  return data
}

export const addSongToPlaylist = async (payload) => {
  const { data } = await apiClient.post('/playlists/add-song', payload)
  emitLibraryRefresh()
  return data
}

export const removeSongFromPlaylist = async (payload) => {
  const { data } = await apiClient.post('/playlists/remove-song', payload)
  emitLibraryRefresh()
  return data
}

export const deletePlaylist = async (playlistId) => {
  const { data } = await apiClient.delete(`/playlists/${playlistId}`)
  emitLibraryRefresh()
  return data
}

export const updatePlaylist = async ({ playlistId, title, cover } = {}) => {
  if (!playlistId) throw new Error('playlistId is required')
  const formData = new FormData()
  if (title !== undefined) {
    formData.append('title', title)
  }
  if (cover) {
    formData.append('cover', cover)
  }

  const { data } = await apiClient.put(`/playlists/${encodeURIComponent(playlistId)}`, formData)
  emitLibraryRefresh()
  return data
}
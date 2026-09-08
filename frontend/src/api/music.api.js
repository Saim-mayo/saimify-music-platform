import apiClient from './client'
import { pagination } from '@/config/pagination'

export const getAllSongs = async (page = pagination.firstPage, limit = pagination.catalogPageSize) => {
  const { data } = await apiClient.get('/music/all-songs', { params: { page, limit } })
  return data
}

export const getAllAlbums = async (page = pagination.firstPage, limit = pagination.catalogPageSize) => {
  const { data } = await apiClient.get('/music/all-albums', { params: { page, limit } })
  return data
}

export const getMySongs = async (page = pagination.firstPage, limit = pagination.contentPageSize) => {
  const { data } = await apiClient.get('/music/my-songs', { params: { page, limit } })
  return data
}

export const getMyAlbums = async (page = pagination.firstPage, limit = pagination.contentPageSize) => {
  const { data } = await apiClient.get('/music/my-albums', { params: { page, limit } })
  return data
}

export const getAlbumById = async (albumId) => {
  const { data } = await apiClient.get(`/music/albums/${albumId}`)
  return data
}

export const searchSongs = async (q, genre = null) => {
  const params = { q }
  if (genre) params.genre = genre
  const { data } = await apiClient.get('/music/search/songs', { params })
  return data
}

export const searchArtists = async (q) => {
  const { data } = await apiClient.get('/music/search/artists', { params: { q } })
  return data
}

export const getTrending = async () => {
  const { data } = await apiClient.get('/music/trending')
  return data
}

export const playSong = async (songId) => {
  const { data } = await apiClient.post(`/music/play/${songId}`)
  return data
}

export const recordPlay = async (songId) => {
  return await playSong(songId)
}

export const getHistory = async () => {
  const { data } = await apiClient.get('/music/history')
  return data
}

export const streamSong = async (songId) => {
  const { data } = await apiClient.get(`/music/stream/${songId}`, { responseType: 'blob' })
  return data
}

export const getSongsByArtist = async (artistId) => {
  const { data } = await apiClient.get(`/music/artist/${artistId}/songs`)
  return data
}

export const downloadSong = async (songId) => {
  const { data } = await apiClient.get(`/music/download/${songId}`, { responseType: 'blob' })
  return data
}

export const uploadSong = async (formData, onUploadProgress) => {
  const { data } = await apiClient.post('/music/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  })
  return data
}

export const createAlbum = async (payload) => {
  const { data } = await apiClient.post('/music/album', payload)
  return data
}

export const updateSong = async (songId, payload) => {
  const { data } = await apiClient.patch(`/music/${songId}`, payload, payload instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined)
  return data
}

export const deleteSong = async (songId) => {
  const { data } = await apiClient.delete(`/music/${songId}`)
  return data
}

export const updateAlbum = async (albumId, payload) => {
  const { data } = await apiClient.patch(`/music/albums/${albumId}`, payload, payload instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined)
  return data
}

export const deleteAlbum = async (albumId) => {
  const { data } = await apiClient.delete(`/music/albums/${albumId}`)
  return data
}

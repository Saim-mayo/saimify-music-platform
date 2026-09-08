import apiClient from './client'

const emitLibraryRefresh = () => {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('library:refresh', { detail: { source: 'likes' } }))
  }
}

export const likeSong = async (payload) => {
  const { data } = await apiClient.post('/likes/like', payload)
  emitLibraryRefresh()
  return data
}

export const unlikeSong = async (payload) => {
  const { data } = await apiClient.post('/likes/unlike', payload)
  emitLibraryRefresh()
  return data
}

export const getSongLikes = async (songId) => {
  const { data } = await apiClient.get(`/likes/likes/${encodeURIComponent(songId)}`)
  return data
}

export const getMyLikedSongs = async () => {
  const { data } = await apiClient.get('/likes/user')
  return data
}

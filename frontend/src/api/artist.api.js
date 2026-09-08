import apiClient from './client'

export const uploadArtistTrack = async (formData, onUploadProgress) => {
  const { data } = await apiClient.post('/music/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  })
  return data
}

export const createArtistAlbum = async (payload) => {
  const isFormData = payload instanceof FormData
  const { data } = await apiClient.post('/music/album', payload, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined)
  return data
}

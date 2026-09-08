import apiClient from './client'

export const addToQueue = async (payload) => {
  const { data } = await apiClient.post('/queue/add', payload)
  return data
}

export const getCurrentQueue = async () => {
  const { data } = await apiClient.get('/queue/current')
  return data
}

export const getFullQueue = async () => {
  const { data } = await apiClient.get('/queue/all')
  return data
}

export const nextQueueSong = async () => {
  const { data } = await apiClient.post('/queue/next')
  return data
}

export const previousQueueSong = async () => {
  const { data } = await apiClient.post('/queue/prev')
  return data
}

export const clearQueue = async () => {
  const { data } = await apiClient.delete('/queue/clear')
  return data
}

export const toggleShuffle = async (shuffle) => {
  const { data } = await apiClient.post('/queue/shuffle', { shuffle: Boolean(shuffle) })
  return data
}

export const replaceQueue = async (payload) => {
  const { data } = await apiClient.post('/queue/set', payload)
  return data
}

export const toggleRepeat = async (repeatMode) => {
  const { data } = await apiClient.post('/queue/repeat', { repeatMode })
  return data
}

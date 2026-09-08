import { useCallback, useEffect, useState } from 'react'
import { createArtistAlbum, deleteAlbum, deleteSong, getApiErrorMessage, getMyAlbums, getMySongs, updateAlbum, updateSong, uploadArtistTrack } from '@/api'

export default function useArtistContent(ownerId) {
  const [songs, setSongs] = useState([])
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!ownerId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [songsResult, albumsResult] = await Promise.all([getMySongs(1, 50), getMyAlbums(1, 50)])
      setSongs(songsResult?.songs || [])
      setAlbums(albumsResult?.albums || [])
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load your releases right now.'))
    } finally {
      setLoading(false)
    }
  }, [ownerId])

  useEffect(() => {
    void reload()
  }, [reload])

  const uploadTrack = useCallback((formData, onUploadProgress) => uploadArtistTrack(formData, onUploadProgress), [])
  const createAlbum = useCallback((formData) => createArtistAlbum(formData), [])
  const editSong = useCallback((songId, payload) => updateSong(songId, payload), [])
  const removeSong = useCallback((songId) => deleteSong(songId), [])
  const editAlbum = useCallback((albumId, payload) => updateAlbum(albumId, payload), [])
  const removeAlbum = useCallback((albumId) => deleteAlbum(albumId), [])

  return {
    songs,
    albums,
    loading,
    error,
    reload,
    uploadTrack,
    createAlbum,
    editSong,
    removeSong,
    editAlbum,
    removeAlbum
  }
}

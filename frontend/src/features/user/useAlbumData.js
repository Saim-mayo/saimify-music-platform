import { useCallback, useEffect, useState } from 'react'
import { getAlbumById, getApiErrorMessage, getMyLikedSongs, likeSong, recordPlay, unlikeSong, unwrapCollection, unwrapEntity } from '@/api'

export function useAlbumData(albumId) {
  const [album, setAlbum] = useState(null)
  const [likedTrackIds, setLikedTrackIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [albumResult, likedResult] = await Promise.all([getAlbumById(albumId), getMyLikedSongs()])
      setAlbum(unwrapEntity(albumResult, ['album']))
      setLikedTrackIds(new Set(unwrapCollection(likedResult, ['songs']).map((song) => song?._id || song?.id).filter(Boolean)))
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load album.'))
    } finally {
      setLoading(false)
    }
  }, [albumId])

  useEffect(() => {
    void reload()
  }, [reload])

  const toggleLike = useCallback(async (track) => {
    const trackId = track?._id || track?.id
    if (!trackId) return
    const liked = likedTrackIds.has(trackId)
    setLikedTrackIds((current) => {
      const next = new Set(current)
      if (liked) next.delete(trackId)
      else next.add(trackId)
      return next
    })
    try {
      if (liked) await unlikeSong({ songId: trackId })
      else await likeSong({ songId: trackId })
    } catch (requestError) {
      setLikedTrackIds((current) => {
        const next = new Set(current)
        if (liked) next.add(trackId)
        else next.delete(trackId)
        return next
      })
      setError(getApiErrorMessage(requestError, 'Unable to update your likes.'))
    }
  }, [likedTrackIds])

  return { album, likedTrackIds, loading, error, setError, reload, toggleLike, recordPlay }
}

export default useAlbumData

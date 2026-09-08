import { useCallback, useEffect, useState } from 'react'
import { deletePlaylist, getApiErrorMessage, getMyLikedSongs, getPlaylistById, likeSong, removeSongFromPlaylist, unlikeSong, unwrapCollection, unwrapEntity, updatePlaylist } from '@/api'

export function usePlaylistData(playlistId, user) {
  const isLikedPlaylist = playlistId === 'liked'
  const [playlist, setPlaylist] = useState(null)
  const [likedSongs, setLikedSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const likedResult = await getMyLikedSongs()
      const liked = unwrapCollection(likedResult, ['songs'])
      setLikedSongs(liked)
      if (isLikedPlaylist) {
        setPlaylist({ _id: 'liked', title: 'Liked Songs', owner: user, songs: liked })
      } else {
        setPlaylist(unwrapEntity(await getPlaylistById(playlistId), ['playlist']))
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load playlist.'))
    } finally {
      setLoading(false)
    }
  }, [isLikedPlaylist, playlistId, user])

  useEffect(() => {
    void reload()
  }, [reload])

  const removeSong = useCallback(async (songId) => {
    const result = await removeSongFromPlaylist({ playlistId: playlist?._id, songId })
    setPlaylist(unwrapEntity(result, ['playlist']))
  }, [playlist?._id])

  const toggleLike = useCallback(async (song) => {
    const songId = song?._id || song?.id
    if (!songId) return
    const liked = likedSongs.some((item) => (item?._id || item?.id) === songId)
    if (liked) {
      await unlikeSong({ songId })
      setLikedSongs((current) => current.filter((item) => (item?._id || item?.id) !== songId))
    } else {
      await likeSong({ songId })
      setLikedSongs((current) => [...current, song])
    }
  }, [likedSongs])

  const rename = useCallback(async (newTitle) => {
    const result = await updatePlaylist({ playlistId: playlist?._id, title: newTitle })
    setPlaylist(unwrapEntity(result, ['playlist']))
  }, [playlist?._id])

  const changeCover = useCallback(async (file) => {
    const result = await updatePlaylist({ playlistId: playlist?._id, cover: file })
    setPlaylist(unwrapEntity(result, ['playlist']))
  }, [playlist?._id])

  const removePlaylist = useCallback(async () => {
    await deletePlaylist(playlist?._id)
  }, [playlist?._id])

  return { playlist, likedSongs, loading, error, setError, reload, removeSong, toggleLike, rename, changeCover, removePlaylist }
}

export default usePlaylistData

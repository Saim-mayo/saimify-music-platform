import { useEffect, useState } from 'react'
import { getMyLikedSongs, getSongLikes, likeSong, recordPlay, unlikeSong } from '@/api'
import { usePlayerStore } from '@/store'
import { dispatchErrorToast } from '@/utils/toast'

export default function useSongActions(song) {
  const [liked, setLiked] = useState(false)
  const [totalLikes, setTotalLikes] = useState(0)
  const [loadingLike, setLoadingLike] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastTone, setToastTone] = useState('info')
  const { playTrack, enqueueTrack } = usePlayerStore()
  const songId = song?._id || song?.id

  useEffect(() => {
    if (!songId) return
    Promise.all([getSongLikes(songId), getMyLikedSongs()])
      .then(([likesData, likedSongsData]) => {
        const likedSongs = Array.isArray(likedSongsData?.songs) ? likedSongsData.songs : []
        const isLikedByUser = likedSongs.some((item) => {
          const likedSong = item?.song || item
          return String(likedSong?._id || likedSong?.id) === String(songId)
        })
        setLiked(isLikedByUser)
        setTotalLikes(Number(likesData?.totalLikes || 0))
      })
      .catch(() => {})
  }, [songId])

  useEffect(() => {
    const onToast = (event) => {
      const detail = event?.detail || {}
      setToastMessage(detail.message || '')
      setToastTone(detail.tone || 'info')
    }

    window.addEventListener('toast', onToast)
    return () => window.removeEventListener('toast', onToast)
  }, [])

  const handleLikeToggle = async () => {
    if (!songId) return
    setLoadingLike(true)
    try {
      if (liked) {
        await unlikeSong({ songId })
        setLiked(false)
        setTotalLikes((value) => Math.max(0, value - 1))
      } else {
        await likeSong({ songId })
        setLiked(true)
        setTotalLikes((value) => value + 1)
      }
    } catch {
      setToastMessage('Unable to update like right now.')
      setToastTone('error')
    } finally {
      setLoadingLike(false)
    }
  }

  const handlePlay = async () => {
    if (!song || !songId) return

    try {
      await recordPlay(songId)
      playTrack(song, [song], 0)
    } catch (error) {
      dispatchErrorToast(error)
    }
  }

  const handleQueue = async () => {
    if (!songId) return
    try {
      await enqueueTrack(songId)
      setToastMessage('Added to queue.')
      setToastTone('success')
    } catch {
      setToastMessage('Unable to add to queue.')
      setToastTone('error')
    }
  }

  const handleAddToPlaylist = (message) => {
    setToastMessage(message || 'Added to playlist.')
    setToastTone('success')
  }

  const handlePlaylistError = (message) => {
    setToastMessage(message || 'Unable to add this song to the playlist.')
    setToastTone('error')
  }

  return {
    liked,
    totalLikes,
    loadingLike,
    toastMessage,
    toastTone,
    setToastMessage,
    setToastTone,
    handleLikeToggle,
    handlePlay,
    handleQueue,
    handleAddToPlaylist,
    handlePlaylistError,
  }
}

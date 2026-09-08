import { useCallback, useEffect, useState } from 'react'
import { getApiErrorMessage, getMyLikedSongs, getMySongs, getUserPlaylists, unwrapCollection } from '@/api'

export default function useLibraryData({ canViewCatalog, refreshKey }) {
  const [data, setData] = useState({ playlists: [], songCatalog: [], likedSongs: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [playlistResult, likedResult] = await Promise.all([
        getUserPlaylists(1, 50),
        getMyLikedSongs(),
      ])
      let catalogResult = []
      if (canViewCatalog) {
        try {
          catalogResult = await getMySongs(1, 50)
        } catch (catalogError) {
          if (catalogError?.response?.status !== 403) throw catalogError
        }
      }

      setData({
        playlists: unwrapCollection(playlistResult, ['playlists']),
        songCatalog: unwrapCollection(catalogResult, ['songs']),
        likedSongs: unwrapCollection(likedResult, ['songs']),
      })
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Unable to load your library.'))
    } finally {
      setLoading(false)
    }
  }, [canViewCatalog])

  useEffect(() => {
    void load()
    const handleLibraryRefresh = () => void load()
    window.addEventListener('library:refresh', handleLibraryRefresh)
    return () => window.removeEventListener('library:refresh', handleLibraryRefresh)
  }, [load, refreshKey])

  return { ...data, loading, error, reload: load }
}

import { useCallback, useEffect, useState } from 'react'
import { getApiErrorMessage, getTrending, recordPlay, searchArtists, searchSongs, unwrapCollection } from '@/api'

export function useSearchData(query, genre, retryKey, onRecentSearch) {
  const [songs, setSongs] = useState([])
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [trending, setTrending] = useState([])
  const [trendingLoading, setTrendingLoading] = useState(false)
  const [trendingError, setTrendingError] = useState('')

  const reloadTrending = useCallback(async () => {
    setTrendingLoading(true)
    setTrendingError('')
    try {
      setTrending(unwrapCollection(await getTrending(), ['results', 'songs']))
    } catch (requestError) {
      setTrending([])
      setTrendingError(getApiErrorMessage(requestError, 'Unable to load trending content. Please try again.'))
    } finally {
      setTrendingLoading(false)
    }
  }, [])

  useEffect(() => {
    void reloadTrending()
  }, [reloadTrending])

  useEffect(() => {
    if (!query) {
      setSongs([])
      setArtists([])
      setLoading(false)
      setError('')
      return undefined
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [songResult, artistResult] = await Promise.all([searchSongs(query, genre), searchArtists(query)])
        if (cancelled) return
        setSongs(unwrapCollection(songResult, ['results', 'songs']))
        setArtists(unwrapCollection(artistResult, ['results', 'artists']))
        onRecentSearch?.(query)
      } catch (requestError) {
        if (!cancelled) {
          setError(getApiErrorMessage(requestError, 'Search failed.'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [genre, onRecentSearch, query, retryKey])

  return { songs, artists, loading, error, trending, trendingLoading, trendingError, reloadTrending, setSongs, setArtists, setError, setLoading, recordPlay }
}

export default useSearchData

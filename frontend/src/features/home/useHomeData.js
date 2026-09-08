import { useCallback, useEffect, useState } from 'react'
import { getAllAlbums, getApiErrorMessage, getHistory, getTrending, unwrapCollection } from '@/api'

export default function useHomeData() {
  const [data, setData] = useState({ history: [], albums: [], trending: [] })
  const [status, setStatus] = useState({ history: 'loading', albums: 'loading', trending: 'loading' })
  const [errors, setErrors] = useState({ history: '', albums: '', trending: '' })

  const load = useCallback(async () => {
    setStatus({ history: 'loading', albums: 'loading', trending: 'loading' })
    setErrors({ history: '', albums: '', trending: '' })

    const results = await Promise.allSettled([
      getHistory(),
      getAllAlbums(1, 8),
      getTrending(),
    ])

    const [historyResult, albumsResult, trendingResult] = results
    setData({
      history: historyResult.status === 'fulfilled'
        ? unwrapCollection(historyResult.value, ['history']).map((entry) => entry?.song || entry)
        : [],
      albums: albumsResult.status === 'fulfilled'
        ? unwrapCollection(albumsResult.value, ['albums'])
        : [],
      trending: trendingResult.status === 'fulfilled'
        ? unwrapCollection(trendingResult.value, ['songs'])
        : [],
    })
    setErrors({
      history: historyResult.status === 'rejected' ? getApiErrorMessage(historyResult.reason, 'Unable to load your recent listens.') : '',
      albums: albumsResult.status === 'rejected' ? getApiErrorMessage(albumsResult.reason, 'Unable to load albums right now.') : '',
      trending: trendingResult.status === 'rejected' ? getApiErrorMessage(trendingResult.reason, 'Unable to load trending tracks.') : '',
    })
    setStatus({
      history: historyResult.status === 'fulfilled' ? 'success' : 'error',
      albums: albumsResult.status === 'fulfilled' ? 'success' : 'error',
      trending: trendingResult.status === 'fulfilled' ? 'success' : 'error',
    })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return {
    ...data,
    errors,
    loading: {
      history: status.history === 'loading',
      albums: status.albums === 'loading',
      trending: status.trending === 'loading',
    },
    reload: load,
  }
}

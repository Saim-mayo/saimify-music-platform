import { useCallback, useEffect, useState } from 'react'
import { getApiErrorMessage, getUserPlaylists } from '@/api'
import { pagination } from '@/config/pagination'

export function usePlaylistsList(limit = pagination.sidebarPlaylistPageSize) {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getUserPlaylists(1, limit)
      const nextPlaylists = response?.playlists || []
      setPlaylists(nextPlaylists)
      setTotal(response?.pagination?.totalItems ?? nextPlaylists.length)
    } catch (requestError) {
      setPlaylists([])
      setTotal(0)
      setError(getApiErrorMessage(requestError, 'Unable to load playlists.'))
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    void reload()
  }, [reload])

  return { playlists, loading, error, total, reload }
}

export default usePlaylistsList

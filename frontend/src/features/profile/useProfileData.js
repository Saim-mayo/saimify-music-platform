import { useCallback, useEffect, useState } from 'react'
import { getApiErrorMessage, getHistory, getMe, getUserPlaylists, unwrapCollection } from '@/api'

export default function useProfileData({ loadSubscriptionStatus }) {
  const [data, setData] = useState({ profile: null, playlists: [], history: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [profileResult, playlistResult, historyResult] = await Promise.all([
        getMe(),
        getUserPlaylists(1, 50),
        getHistory(),
      ])
      setData({
        profile: profileResult || null,
        playlists: unwrapCollection(playlistResult, ['playlists']),
        history: unwrapCollection(historyResult, ['history']),
      })
      await loadSubscriptionStatus().catch(() => {})
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Unable to load profile.'))
    } finally {
      setLoading(false)
    }
  }, [loadSubscriptionStatus])

  useEffect(() => {
    void load()
  }, [load])

  return { ...data, loading, error, reload: load }
}

import { useCallback, useEffect, useState } from 'react'
import * as adminApi from '@/api'
import * as paymentApi from '@/api'
import { getApiErrorMessage } from '@/api'
import { pagination } from '@/config/pagination'

const emptyPagination = { totalItems: 0, currentPage: 1, totalPages: 1 }
const adminLoaders = {
  songs: adminApi.getAdminSongs,
  albums: adminApi.getAdminAlbums,
  playlists: adminApi.getAdminPlaylists
}
const adminDeleters = {
  songs: adminApi.deleteSongAdmin,
  albums: adminApi.deleteAlbumAdmin,
  playlists: adminApi.deletePlaylistAdmin
}

const useAdminList = ({ load, initialPage = pagination.firstPage, limit = pagination.adminPageSize, params = {}, selectItems, errorMessage }) => {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(initialPage)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pagination, setPagination] = useState(emptyPagination)
  const paramsKey = JSON.stringify(params)

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await load({ page, limit, ...JSON.parse(paramsKey) })
      setItems(selectItems(response))
      setPagination(response?.pagination || { ...emptyPagination, currentPage: page })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, errorMessage))
    } finally {
      setLoading(false)
    }
  }, [errorMessage, limit, load, page, paramsKey, selectItems])

  useEffect(() => {
    void reload()
  }, [reload])

  return { items, setItems, page, setPage, limit, loading, error, pagination, reload }
}

export function useAdminUsers({ search, role, status }) {
  const params = { search, role, isBanned: status }
  const selectUsers = useCallback((response) => response?.users || [], [])
  const list = useAdminList({
    load: adminApi.getUsers,
    params,
    selectItems: selectUsers,
    errorMessage: 'Unable to load users.'
  })

  const toggleBan = useCallback(async (user) => {
    if (user.isBanned) await adminApi.unbanUser(user._id)
    else await adminApi.banUser(user._id)
    list.setItems((current) => current.map((entry) => entry._id === user._id ? { ...entry, isBanned: !entry.isBanned } : entry))
  }, [list])

  const cancelSubscription = useCallback(async (user) => {
    await adminApi.cancelUserSubscription(user._id)
    list.setItems((current) => current.map((entry) => entry._id === user._id ? {
      ...entry,
      subscription: { ...entry.subscription, status: 'canceled' }
    } : entry))
  }, [list])

  return { ...list, toggleBan, cancelSubscription }
}

export function useAdminArtists() {
  const loadArtists = useCallback(({ page, limit }) => adminApi.getPendingArtists(page, limit), [])
  const selectArtists = useCallback((response) => response?.artists || [], [])
  const list = useAdminList({
    load: loadArtists,
    selectItems: selectArtists,
    errorMessage: 'Unable to load pending artists.'
  })

  const decideArtist = useCallback(async (userId, approve) => {
    if (approve) await adminApi.approveArtist(userId)
    else await adminApi.rejectArtist(userId)
    list.setItems((current) => current.filter((entry) => entry._id !== userId))
  }, [list])

  return { ...list, decideArtist }
}

export function useAdminAuditLog() {
  const selectLogs = useCallback((response) => response?.logs || [], [])
  return useAdminList({
    load: adminApi.getAuditLog,
    initialPage: pagination.firstPage,
    limit: pagination.adminAuditPageSize,
    selectItems: selectLogs,
    errorMessage: 'Unable to load audit activity.'
  })
}

export function useAdminCatalog(resource, search) {
  const itemKey = resource
  const selectCatalogItems = useCallback((response) => response?.[itemKey] || [], [itemKey])
  const list = useAdminList({
    load: adminLoaders[resource],
    params: { search },
    selectItems: selectCatalogItems,
    errorMessage: `Unable to load ${resource}.`
  })
  const deleteResource = adminDeleters[resource]
  const { reload } = list

  const remove = useCallback(async (id) => {
    await deleteResource(id)
    await reload()
  }, [deleteResource, reload])

  return { ...list, remove }
}

export function useAdminPayments() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const response = await paymentApi.getPaymentHistory()
        if (active) setHistory(response?.items || [])
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  return { history, loading }
}

export function useAdminSubscriptions() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const response = await paymentApi.getPlans()
        if (active) setPlans(response?.plans || response?.items || response || [])
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  return { plans, loading }
}

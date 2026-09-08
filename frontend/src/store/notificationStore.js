import { create } from 'zustand'
import { getNotifications, getUnreadCount, markAllNotificationsAsRead, markNotificationAsRead } from '@/api'
import { pagination } from '@/config/pagination'

export const useNotificationStore = create((set, get) => ({
  items: [],
  unreadCount: 0,
  loading: false,
  error: '',
  page: 1,
  totalPages: 1,
  limit: pagination.notificationPageSize,

  async refresh(page = pagination.firstPage, limit = pagination.notificationPageSize) {
    set({ loading: true, error: '' })
    try {
      const [notifications, unread] = await Promise.all([getNotifications(page, limit), getUnreadCount()])
      set((state) => ({
        items: page === 1 ? (notifications?.items || notifications?.notifications || []) : [...(state.items || []), ...(notifications?.items || notifications?.notifications || [])],
        unreadCount: unread?.count || 0,
        loading: false,
        page: notifications?.page || page,
        totalPages: notifications?.totalPages || 1,
        limit,
      }))
      return { notifications, unread }
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to load notifications.'
      set({ error: message, loading: false })
      throw error
    }
  },

  async loadMore() {
    const state = get()
    if (state.loading || state.page >= state.totalPages) return

    set({ loading: true, error: '' })
    try {
      const nextPage = state.page + 1
      const notifications = await getNotifications(nextPage, state.limit)
      set({
        items: [...(state.items || []), ...(notifications?.items || notifications?.notifications || [])],
        page: notifications?.page || nextPage,
        totalPages: notifications?.totalPages || state.totalPages,
        loading: false,
      })
      return notifications
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to load more notifications.'
      set({ error: message, loading: false })
      throw error
    }
  },

  async refreshUnreadCount() {
    try {
      const unread = await getUnreadCount()
      set({ unreadCount: unread?.count || 0 })
      return unread
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to refresh notifications.'
      set({ error: message })
      throw error
    }
  },

  async markAsRead(notificationId) {
    try {
      await markNotificationAsRead(notificationId)
      set((state) => ({
        items: state.items.map((item) => item._id === notificationId ? { ...item, read: true } : item),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }))
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to update that notification.'
      set({ error: message })
      throw error
    }
  },

  async markAllAsRead() {
    try {
      await markAllNotificationsAsRead()
      set((state) => ({
        items: state.items.map((item) => ({ ...item, read: true })),
        unreadCount: 0,
      }))
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to mark notifications as read.'
      set({ error: message })
      throw error
    }
  },
}))

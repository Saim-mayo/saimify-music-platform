import apiClient from './client'
import { pagination } from '@/config/pagination'

export const getNotifications = async (page = pagination.firstPage, limit = pagination.notificationPageSize) => {
  const { data } = await apiClient.get('/notifications', { params: { page, limit } })
  return data
}

export const getUnreadCount = async () => {
  const { data } = await apiClient.get('/notifications/unread-count')
  return data
}

export const markNotificationAsRead = async (notificationId) => {
  const { data } = await apiClient.patch(`/notifications/${notificationId}/read`)
  return data
}

export const markAllNotificationsAsRead = async () => {
  const { data } = await apiClient.patch('/notifications/read-all')
  return data
}

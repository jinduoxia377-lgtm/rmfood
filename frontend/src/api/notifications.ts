/**
 * 通知 API
 */
import api from './client'

export interface Notification {
  id: number
  type: string
  status: string
  title: string
  content: string | null
  link: string | null
  metadata: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

export interface NotificationListResponse {
  items: Notification[]
  total: number
  unread_count: number
}

export const notificationApi = {
  list: (params?: { page?: number; page_size?: number; status?: string }) =>
    api.get<NotificationListResponse>('/notifications', { params }).then((r) => r.data),

  markRead: (notificationIds?: number[]) =>
    api.post('/notifications/mark-read', { notification_ids: notificationIds }).then((r) => r.data),

  unreadCount: () =>
    api.get<{ count: number }>('/notifications/unread-count').then((r) => r.data),
}

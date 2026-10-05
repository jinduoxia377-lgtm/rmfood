/**
 * 通知 API
 * 对齐后端契约（backend/app/api/v1/notification_router.py，前缀 /notifications）：
 * - GET  /notifications            → { notifications, total, unread_count, page, page_size }
 * - GET  /notifications/unread-count → { unread_count, last_read_at }
 * - PUT  /notifications/{id}/read  单条标已读
 * - PUT  /notifications/read-all   全部标已读
 * - DELETE /notifications/{id}      删除
 * 通知类型（NotificationType）：system / formula_review / experiment_complete / ai_task_done / data_sync
 */
import api from './client'
import type { Notification as BaseNotification, PaginatedResponse } from '@/types'

export type NotificationTypeValue = 'system' | 'formula_review' | 'experiment_complete' | 'ai_task_done' | 'data_sync'

// 后端 NotificationItem 字段（camelCase 序列化）
export interface NotificationItem {
  id: number
  type: NotificationTypeValue | string
  title: string
  content: string | null
  metadata: Record<string, unknown> | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

// 前端展示模型：基于全局 Notification，userId 后端未返回故放宽为可选
export interface Notification extends Omit<BaseNotification, 'type' | 'userId'> {
  type: string
  userId?: number
  /** 后端 NotificationItem.metadata（可选） */
  metadata?: Record<string, unknown>
}

export interface NotificationListResponse {
  notifications: NotificationItem[]
  /** 映射后的展示模型（与全局 Notification 兼容），供既有消费方直接使用 */
  items?: Notification[]
  total: number
  unread_count: number
  page?: number
  page_size?: number
}

export interface UnreadCountResponse {
  unread_count: number
  last_read_at: string | null
}

export const notificationApi = {
  /**
   * 通知列表。对齐后端 v1 契约：GET /notifications → { notifications, total, unread_count, ... }。
   * 同时兼容旧后端/ mock 响应 { items: [...] }，并映射为全局 Notification 展示字段
   * （message/isRead/createdAt），供 NotificationBell / NotificationPage 等既有消费方使用。
   */
  list: (params?: { page?: number; page_size?: number; type?: string; status?: string; is_read?: boolean }) =>
    api.get<NotificationListResponse>('/notifications', {
      params: {
        ...params,
        // 兼容旧调用：status('read'|'unread') → 后端 is_read
        is_read: params?.is_read !== undefined ? params.is_read : params?.status ? params.status === 'read' : undefined,
      },
    }).then((r) => {
      const raw = r.data as unknown as NotificationListResponse & { items?: NotificationItem[] }
      const items = raw.notifications ?? raw.items ?? []
      const mapped: Notification[] = items.map((n) => ({
        id: n.id,
        type: String(n.type),
        title: n.title,
        message: n.content ?? '',
        isRead: n.is_read,
        readAt: n.read_at ?? undefined,
        createdAt: n.created_at,
        metadata: n.metadata ?? undefined,
      }))
      return {
        ...raw,
        notifications: items,
        items: mapped,
        total: raw.total ?? items.length,
        unread_count: raw.unread_count ?? 0,
      } as unknown as NotificationListResponse
    }),

  /** 单条 / 批量标已读（批量时逐条调用；后端无批量 PUT） */
  markRead: async (notificationIds: number[]) => {
    await Promise.all(notificationIds.map((id) =>
      api.put(`/notifications/${id}/read`).then((r) => r.data),
    ))
  },

  markAllRead: (type?: string) =>
    api.put('/notifications/read-all', null, { params: type ? { type } : {} }).then((r) => r.data),

  remove: (notificationId: number) =>
    api.delete(`/notifications/${notificationId}`).then((r) => r.data),

  unreadCount: () =>
    api.get<UnreadCountResponse>('/notifications/unread-count').then((r) => r.data),
}

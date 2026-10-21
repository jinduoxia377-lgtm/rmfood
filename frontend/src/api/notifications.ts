/**
 * 通知 API（统一客户端）
 *
 * 全项目通知功能统一从这里取数，后端契约以 v1 notification_router 为准
 * （backend/app/api/v1/notification_router.py，前缀 /api/v1/notifications）：
 * - GET    /notifications              → { notifications, total, unread_count, page, page_size }
 * - GET    /notifications/unread-count → { unread_count, last_read_at }
 * - PUT    /notifications/{id}/read    单条标已读
 * - PUT    /notifications/read-all     全部标已读
 * - DELETE /notifications/{id}         删除
 * - GET    /notifications/preferences  通知偏好
 * - PUT    /notifications/preferences  更新通知偏好
 *
 * 同时兼容旧 admin 路由返回的 { items, ... } 响应形态。
 *
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

// 前端展示模型：基于全局 Notification，userId 后端未返回故放宽为可选。
// 同时补充 NotificationCenter（顶栏铃铛）使用的 snake_case 别名字段，避免组件各自归一化。
export interface Notification extends Omit<BaseNotification, 'type' | 'userId'> {
  type: string
  userId?: number
  /** 后端 NotificationItem.metadata（可选） */
  metadata?: Record<string, any>
  /** 原始后端 id（与 id 相同），供批量已读/删除使用 */
  apiId?: number
  /** 顶栏铃铛组件使用的 snake_case 别名 */
  subject?: string
  body?: string
  is_read?: boolean
  created_at?: string
  channel?: string
  link?: string | null
}

export interface NotificationListResponse {
  notifications: NotificationItem[]
  /** 映射后的展示模型（与全局 Notification 兼容），供既有消费方直接使用 */
  items?: Notification[]
  total: number
  unread_count: number
  page?: number
  page_size?: number
  total_pages?: number
}

export interface UnreadCountResponse {
  unread_count: number
  last_read_at: string | null
}

/** 通知偏好（与 v1 /notifications/preferences 的 preferences 字段对齐） */
export interface NotificationPreferences {
  email_enabled: boolean
  push_enabled: boolean
  browser_push: boolean
  in_app_enabled: boolean
  team_invite: boolean
  sync_status: boolean
  ai_task_complete: boolean
  system_alert: boolean
  system_updates: boolean
  formula_review: boolean
  experiment_complete: boolean
  notification_frequency: 'realtime' | 'daily' | 'weekly'
  notification_priority: 'high' | 'medium' | 'low'
  quiet_hours: { start: string; end: string } | null
  /** 更新接口的免打扰字段（后端 v1 接受独立 start/end） */
  quiet_hours_start?: string
  quiet_hours_end?: string
}

export interface NotificationPreferencesResponse {
  user_id: number
  preferences: NotificationPreferences
  updated_at: string | null
}

export const notificationApi = {
  /**
   * 通知列表。对齐后端 v1 契约：GET /notifications → { notifications, total, unread_count, ... }。
   * 同时兼容旧后端/ mock 响应 { items: [...] }，并映射为全局 Notification 展示字段
   * （message/isRead/createdAt），供 NotificationBell / NotificationPage / NotificationCenter 使用。
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
      const mapped: Notification[] = items.map((n) => {
        const rawItem = n as NotificationItem & { link?: string | null }
        return {
          id: n.id,
          apiId: n.id,
          type: String(n.type),
          title: n.title,
          message: n.content ?? '',
          isRead: n.is_read,
          readAt: n.read_at ?? undefined,
          createdAt: n.created_at,
          metadata: n.metadata ?? undefined,
          // snake_case 别名（顶栏铃铛组件直接消费）
          subject: n.title,
          body: n.content ?? '',
          is_read: n.is_read,
          created_at: n.created_at,
          channel: (n.metadata as Record<string, unknown> | null)?.channel as string | undefined ?? 'in_app',
          link: rawItem.link ?? null,
        }
      })
      return {
        ...raw,
        notifications: items,
        items: mapped,
        total: raw.total ?? items.length,
        unread_count: raw.unread_count ?? 0,
        page: raw.page ?? params?.page ?? 1,
        page_size: raw.page_size ?? params?.page_size ?? 20,
        total_pages: Math.max(1, Math.ceil((raw.total ?? items.length) / (raw.page_size ?? params?.page_size ?? 20))),
      } as unknown as NotificationListResponse
    }),

  /** 单条 / 批量标已读（批量时逐条调用；后端无批量 PUT） */
  markRead: async (notificationIds: number | number[]) => {
    const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds]
    await Promise.all(ids.map((id) =>
      api.put(`/notifications/${id}/read`).then((r) => r.data),
    ))
  },

  markAllRead: (type?: string) =>
    api.put('/notifications/read-all', null, { params: type ? { type } : {} }).then((r) => r.data),

  remove: (notificationId: number) =>
    api.delete(`/notifications/${notificationId}`).then((r) => r.data),

  unreadCount: () =>
    api.get<UnreadCountResponse>('/notifications/unread-count').then((r) => r.data),

  /** 获取当前用户通知偏好 */
  getPreferences: () =>
    api.get<NotificationPreferencesResponse>('/notifications/preferences')
      .then((r) => r.data?.preferences ?? null),

  /** 更新当前用户通知偏好 */
  updatePreferences: (prefs: Partial<NotificationPreferences>) =>
    api.put<NotificationPreferencesResponse>('/notifications/preferences', prefs).then((r) => r.data),
}

export type { PaginatedResponse }
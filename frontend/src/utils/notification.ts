/**
 * 通知数据归一化工具
 *
 * 后端通知接口存在多套路由（admin / v1 notification_router / v2），
 * 返回字段不一致（如 status vs is_read、title vs subject、content vs body）。
 * 此工具把后端原始通知项统一映射为前端组件可用的稳定结构，
 * 避免「有真实通知却显示无标题/无内容」的契约错位问题。
 */

import type { Notification } from '@/types'

export interface NormalizedNotification extends Notification {
  // ── 通知下拉面板（NotificationCenter）使用的 snake_case 别名字段 ──
  subject: string
  body: string
  is_read: boolean
  created_at: string
  channel: string
  link: string | null
  metadata: Record<string, any>
}

export interface NotificationListData {
  items: NormalizedNotification[]
  total: number
  unread_count: number
  page: number
  page_size: number
  total_pages: number
}

/**
 * 归一化单条通知。
 * 兼容以下后端响应形态：
 * - admin:  { id, type, status, title, content, link, metadata, read_at, created_at }
 * - v1:     { id, type, title, content, metadata, is_read, read_at, created_at }
 * - v2:     { id, type, title, content, link, metadata, is_read, created_at }
 */
export function normalizeNotification(raw: any): NormalizedNotification {
  const isRead = raw?.is_read ?? (raw?.status ? raw.status === 'read' : false)
  const createdAt = raw?.created_at ?? raw?.createdAt ?? ''
  const readAt = raw?.read_at ?? raw?.readAt ?? null
  const link = raw?.link ?? raw?.actionUrl ?? null
  const metadata = raw?.metadata ?? raw?.data ?? {}

  return {
    id: Number(raw?.id),
    type: (raw?.type || 'system') as Notification['type'],
    title: raw?.title || '',
    message: raw?.content || raw?.message || '',
    userId: Number(raw?.userId ?? raw?.user_id ?? 0),
    isRead,
    readAt: readAt ?? undefined,
    createdAt,
    actionUrl: link ?? undefined,
    data: metadata,
    metadata,

    subject: raw?.title || '',
    body: raw?.content || raw?.message || '',
    is_read: isRead,
    created_at: createdAt,
    channel: raw?.channel || 'in_app',
    link,
  }
}

/**
 * 归一化通知列表响应。
 * 兼容：
 * - admin: { items, total, unread_count, page, page_size }
 * - v2:    { items, pagination: { page, page_size, total, total_pages }, unread_count }
 */
export function normalizeNotificationList(raw: any): NotificationListData {
  const items = Array.isArray(raw?.items)
    ? raw.items.map(normalizeNotification)
    : []

  const total = raw?.total ?? raw?.pagination?.total ?? items.length
  const page = raw?.page ?? raw?.pagination?.page ?? 1
  const page_size = raw?.page_size ?? raw?.pagination?.page_size ?? 20
  const rawTotalPages = raw?.pagination?.total_pages
  const totalPages = rawTotalPages
    ?? (page_size > 0 ? Math.ceil(total / page_size) : 1)

  return {
    items,
    total,
    unread_count: raw?.unread_count ?? 0,
    page,
    page_size,
    total_pages: Math.max(1, totalPages),
  }
}
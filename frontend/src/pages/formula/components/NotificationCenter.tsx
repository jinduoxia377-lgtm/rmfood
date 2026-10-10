/**
 * 智能通知中心组件
 * 支持实时通知、分类管理、批量操作
 * R-02：列表接后端 /notifications API；接口不可用时降级为本地 mock 并展示「离线模式」标识
 */
import { useState, useEffect, useCallback } from 'react'
import { Bell, Check, CheckCircle, Archive, Trash2, Settings, Mail, Clock, Zap, AlertTriangle } from 'lucide-react'
import { Button, Badge, Modal, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import { notificationApi, type Notification as ApiNotification } from '@/api/notifications'
import { logger } from '@/utils/safeLogger'

export type NotificationType = 'system' | 'formula_review' | 'experiment_complete' | 'ai_task_done' | 'data_sync' | 'other'

export interface Notification {
  id: string
  apiId?: number
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  isArchived: boolean
  createdAt: string
  actionUrl?: string
  metadata?: Record<string, unknown>
}

// notificationApi.list 的 items 已是全局展示模型（message/isRead/createdAt），此处补充 apiId
function mapApiItem(n: ApiNotification): Notification {
  return {
    id: String(n.id),
    apiId: n.id,
    type: mapApiType(n.type),
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    isArchived: false,
    createdAt: n.createdAt,
    metadata: n.metadata ?? undefined,
  }
}

// 后端 NotificationType → 前端展示分类
function mapApiType(type: unknown): NotificationType {
  const t = String(type ?? 'other')
  return (['system', 'formula_review', 'experiment_complete', 'ai_task_done', 'data_sync'] as const).includes(t as never)
    ? (t as NotificationType)
    : 'other'
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'formula_review',
    title: '配方审核完成',
    message: '配方"益气补血膏"已通过审核',
    isRead: false,
    isArchived: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    actionUrl: '/formulas/1',
  },
  {
    id: '2',
    type: 'data_sync',
    title: '实验数据同步完成',
    message: '实验"EXP-003"数据已成功同步',
    isRead: false,
    isArchived: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    actionUrl: '/experiments/3',
  },
  {
    id: '3',
    type: 'formula_review',
    title: '待审核配方提醒',
    message: '有3个配方等待您的审核',
    isRead: true,
    isArchived: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    actionUrl: '/formulas?status=pending_review',
  },
  {
    id: '4',
    type: 'ai_task_done',
    title: 'AI智能分析完成',
    message: '您的配方安全分析报告已生成',
    isRead: false,
    isArchived: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    actionUrl: '/ai',
  },
  {
    id: '5',
    type: 'system',
    title: '系统更新通知',
    message: '新版本已上线，新增配方对比功能',
    isRead: true,
    isArchived: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
]

const NOTIFICATION_ICONS: Record<NotificationType, React.ReactNode> = {
  system: <Mail size={18} />,
  formula_review: <Zap size={18} />,
  experiment_complete: <Clock size={18} />,
  ai_task_done: <Zap size={18} />,
  data_sync: <Clock size={18} />,
  other: <AlertTriangle size={18} />,
}

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  system: 'text-neutral-500 bg-neutral-100 dark:bg-neutral-800',
  formula_review: 'text-warning-600 bg-warning-100 dark:bg-warning-300/25',
  experiment_complete: 'text-secondary-600 bg-secondary-100 dark:bg-secondary-300/25',
  ai_task_done: 'text-accent-600 bg-accent-100 dark:bg-accent-300/25',
  data_sync: 'text-info-600 bg-info-100 dark:bg-info-300/25',
  other: 'text-error-600 bg-error-100 dark:bg-error-300/25',
}

const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  system: '系统通知',
  formula_review: '配方审核',
  experiment_complete: '实验完成',
  ai_task_done: 'AI任务',
  data_sync: '数据同步',
  other: '其他',
}

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  // R-02：false = 后端 API 可用；true = 降级为本地 mock（接口不可用）
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [filter, setFilter] = useState<NotificationType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // 将后端列表映射为前端展示模型
  const loadNotifications = useCallback(async () => {
    const res = await notificationApi.list({ page: 1, page_size: 20 })
    return (res.items ?? []).map(mapApiItem)
  }, [])

  // 打开时拉取真实通知；失败则降级 mock 并标记离线
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const items = await loadNotifications()
        if (cancelled) return
        setNotifications(items)
        setIsOfflineMode(false)
      } catch (error) {
        if (cancelled) return
        logger.warn('通知中心：后端接口不可用，降级为离线模式', error)
        setNotifications(MOCK_NOTIFICATIONS)
        setIsOfflineMode(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isOpen, loadNotifications])

  const unreadCount = notifications.filter(n => !n.isRead && !n.isArchived).length
  const filteredNotifications = notifications.filter(n => {
    if (n.isArchived) return false
    if (filter !== 'all' && n.type !== filter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
    }
    return true
  })

  // 离线模式（mock）下操作仅更新本地 state；在线模式下标已读调后端并刷新列表
  const markAsRead = async (id: string) => {
    const target = notifications.find(n => n.id === id)
    if (isOfflineMode || !target?.apiId) {
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)))
      return
    }
    try {
      await notificationApi.markRead([target.apiId])
      const items = await loadNotifications()
      setNotifications(items)
    } catch {
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)))
    }
  }

  const markAllAsRead = async () => {
    if (isOfflineMode) {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      return
    }
    try {
      await notificationApi.markAllRead()
      const items = await loadNotifications()
      setNotifications(items)
    } catch {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    }
  }

  const archive = (id: string) => {
    // 归档为本地操作（后端无归档端点）
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, isArchived: true } : n,
    ))
  }

  const deleteNotification = async (id: string) => {
    const target = notifications.find(n => n.id === id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (isOfflineMode || !target?.apiId) return
    try {
      await notificationApi.remove(target.apiId)
    } catch (error) {
      logger.warn('通知删除失败（本地已移除）', error)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString('zh-CN')
  }

  if (!isOpen) return null

  return (
    <Modal open={isOpen} onClose={onClose} maxWidth="max-w-lg" title="通知中心">
      <div className="flex flex-col h-[600px]">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-neutral-600 dark:text-neutral-400" />
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">通知中心</h3>
            {unreadCount > 0 && (
              <Badge variant="primary" size="sm">{unreadCount}条未读</Badge>
            )}
            {isOfflineMode && (
              <Badge variant="neutral" size="sm" title="后端接口不可用，当前展示本地缓存数据">
                离线模式
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={markAllAsRead}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-700"
              title="全部标为已读"
            >
              <CheckCircle size={16} />
            </button>
            <button className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-700" title="设置">
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="mb-4">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索通知..."
          />
        </div>

        {/* 筛选标签 */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
              filter === 'all'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-300/25 dark:text-primary-700'
                : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800',
            )}
          >
            全部
          </button>
          {Object.entries(NOTIFICATION_LABELS).map(([type, label]) => (
            <button
              key={type}
              onClick={() => setFilter(type as NotificationType)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                filter === type
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-300/25 dark:text-primary-700'
                  : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 通知列表 */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 rounded-xl border border-neutral-100 dark:border-neutral-800 animate-pulse">
                  <div className="h-4 w-1/3 bg-neutral-200 dark:bg-neutral-700 rounded mb-2" />
                  <div className="h-3 w-2/3 bg-neutral-100 dark:bg-neutral-800 rounded" />
                </div>
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Bell size={48} className="text-neutral-300 dark:text-neutral-400 mb-3" />
              <p className="text-neutral-500 dark:text-neutral-400 text-sm">暂无通知</p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  'p-4 rounded-xl border transition-all duration-200 group relative',
                  notification.isRead
                    ? 'bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800'
                    : 'bg-primary-50 dark:bg-primary-300/15 border-primary-200 dark:border-primary-800/50',
                )}
              >
                {/* 未读指示 */}
                {!notification.isRead && (
                  <div className="absolute top-4 left-4 w-2 h-2 rounded-full bg-primary-500" />
                )}

                <div className="flex items-start gap-3 pl-6">
                  {/* 图标 */}
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    NOTIFICATION_COLORS[notification.type],
                  )}>
                    {NOTIFICATION_ICONS[notification.type]}
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h4 className={cn(
                          'text-sm font-semibold',
                          notification.isRead ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-900 dark:text-white',
                        )}>
                          {notification.title}
                        </h4>
                        <Badge variant="neutral" size="sm">{NOTIFICATION_LABELS[notification.type]}</Badge>
                      </div>
                      <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] whitespace-nowrap">
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
                      {notification.message}
                    </p>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {notification.actionUrl && (
                        <a href={notification.actionUrl}>
                          <Button variant="secondary" size="sm">
                            查看详情
                          </Button>
                        </a>
                      )}
                      {!notification.isRead && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600"
                          title="标为已读"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => archive(notification.id)}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600"
                        title="归档"
                      >
                        <Archive size={14} />
                      </button>
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-1.5 rounded-lg hover:bg-error-100 dark:hover:bg-error-900/30 text-neutral-400 hover:text-error-600"
                        title="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 底部操作 */}
        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 mt-4">
          <a href="/notifications">
            <Button variant="secondary" size="sm" className="w-full">
              查看全部通知
            </Button>
          </a>
        </div>
      </div>
    </Modal>
  )
}

interface NotificationBadgeProps {
  count: number
  onClick: () => void
}

export function NotificationBadge({ count, onClick }: NotificationBadgeProps) {
  return (
    <button
      onClick={onClick}
      className="relative p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      aria-label={count > 0 ? `${count} 条未读通知` : '通知中心'}
    >
      <Bell size={20} className="text-neutral-600 dark:text-neutral-400" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-error-500 text-white text-xs font-semibold" aria-hidden="true">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}

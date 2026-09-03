/**
 * 智能通知中心组件
 * 支持实时通知、分类管理、批量操作
 */
import { useState } from 'react'
import { Bell, Check, CheckCircle, Archive, Trash2, Settings, Mail, Clock, Zap, AlertTriangle } from 'lucide-react'
import { Button, Badge, Modal, Input } from '@/components/ui'
import { cn } from '@/lib/utils'

export type NotificationType = 'system' | 'formula' | 'experiment' | 'review' | 'alert' | 'ai'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  isArchived: boolean
  createdAt: string
  actionUrl?: string
  metadata?: Record<string, unknown>
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'formula',
    title: '配方审核完成',
    message: '配方"益气补血膏"已通过审核',
    isRead: false,
    isArchived: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    actionUrl: '/formulas/1',
  },
  {
    id: '2',
    type: 'experiment',
    title: '实验数据同步完成',
    message: '实验"EXP-003"数据已成功同步',
    isRead: false,
    isArchived: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    actionUrl: '/experiments/3',
  },
  {
    id: '3',
    type: 'review',
    title: '待审核配方提醒',
    message: '有3个配方等待您的审核',
    isRead: true,
    isArchived: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    actionUrl: '/formulas?status=pending_review',
  },
  {
    id: '4',
    type: 'ai',
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
  formula: <Zap size={18} />,
  experiment: <Clock size={18} />,
  review: <AlertTriangle size={18} />,
  alert: <AlertTriangle size={18} />,
  ai: <Zap size={18} />,
}

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  system: 'text-neutral-500 bg-neutral-100 dark:bg-neutral-800',
  formula: 'text-primary-600 bg-primary-100 dark:bg-primary-900/30',
  experiment: 'text-secondary-600 bg-secondary-100 dark:bg-secondary-900/30',
  review: 'text-warning-600 bg-warning-100 dark:bg-warning-900/30',
  alert: 'text-error-600 bg-error-100 dark:bg-error-900/30',
  ai: 'text-accent-600 bg-accent-100 dark:bg-accent-900/30',
}

const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  system: '系统通知',
  formula: '配方通知',
  experiment: '实验通知',
  review: '审核通知',
  alert: '警告通知',
  ai: 'AI助手',
}

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS)
  const [filter, setFilter] = useState<NotificationType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

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

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, isRead: true } : n,
    ))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const archive = (id: string) => {
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, isArchived: true } : n,
    ))
  }

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
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
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
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
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 通知列表 */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Bell size={48} className="text-neutral-300 dark:text-neutral-600 mb-3" />
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
                    : 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800/50',
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
                      <span className="text-xs text-neutral-400 whitespace-nowrap">
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
      className="relative p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      aria-label={count > 0 ? `${count} 条未读通知` : '通知中心'}
    >
      <Bell size={20} className="text-neutral-600 dark:text-neutral-400" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-error-500 text-white text-[10px] font-semibold" aria-hidden="true">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}

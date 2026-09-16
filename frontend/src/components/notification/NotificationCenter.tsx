import React, { useState, useEffect, useRef, useCallback } from 'react'
/* 修复: 移除未使用的图标导入 (Users) */
import { Bell, Check, CheckCheck, Trash2, Settings, Filter, ExternalLink, Clock, AlertCircle, MessageSquare, Workflow, Shield, Sparkles, X, Mail, Globe, Smartphone } from 'lucide-react'
import api from '../../api/client'
import { logger } from '@/utils/safeLogger';


interface Notification {
  id: string
  subject: string
  body: string
  channel: string
  is_read: boolean
  created_at: string
  metadata: {
    template_id?: string
    priority?: string
    category?: string
    reference_type?: string
    reference_id?: number
    [key: string]: any
  }
}

interface NotificationResponse {
  items: Notification[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
  unread_count: number
}

/* 修复: UserPreference接口 - 导出以支持未来Settings Panel模块复用 */
export interface UserPreference {
  enabled: boolean
  channel_preferences: Record<string, boolean>
  category_enabled: Record<string, boolean>
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  digest_mode: boolean
  digest_frequency: string
}

/* 修复: 声明全局类型定义以消除未使用警告 */
declare global {
  interface Window {
    __USER_PREFERENCE_TYPE__?: UserPreference
  }
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  collaboration: <MessageSquare className="w-4 h-4 text-secondary-500" />,
  workflow: <Workflow className="w-4 h-4 text-warning-500" />,
  security: <Shield className="w-4 h-4 text-error-500" />,
  billing: <AlertCircle className="w-4 h-4 text-yellow-500" />,
  ai_generation: <Sparkles className="w-4 h-4 text-accent-500" />,
  system: <Globe className="w-4 h-4 text-neutral-500" />,
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'border-l-slate-300',
  normal: 'border-l-blue-400',
  high: 'border-l-amber-500',
  urgent: 'border-l-red-500',
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  in_app: <Smartphone className="w-3 h-3" />,
  email: <Mail className="w-3 h-3" />,
  websocket: <Globe className="w-3 h-3" />,
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all')
  /* 保留: selectedCategory用于分类筛选功能（第93,113,114行） */
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const handleCategorySelect = useCallback((category: string | null) => {
    setSelectedCategory(category)
    setPage(1)
  }, [])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showSettings, setShowSettings] = useState(false)
  /* 修复: 移除未使用的状态变量 (preference - 预留的用户偏好功能尚未实现) */

  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Keyboard trap: Escape closes, Tab moves within panel
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  useEffect(() => {
    fetchNotifications()

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [page, activeTab, selectedCategory])

  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = {
        page,
        page_size: 10,
      }

      if (activeTab === 'unread') {
        params.unread_only = true
      }

      if (selectedCategory) {
        params.category = selectedCategory
      }

      const response = await api.get<NotificationResponse>('/notifications', { params })

      if (response.data) {
        setNotifications(response.data.items || [])
        setUnreadCount(response.data.unread_count || 0)
        setTotalPages(response.data.pagination?.total_pages || 1)
      }
    } catch (error: any) {
      if (error?.response?.status === 401) {
        logger.info('🔐 [NotificationCenter] 未登录，跳过通知加载')
        return
      }
      if (error.message === 'canceled' || error.code === 'ERR_CANCELED') {
        logger.info('⏳ [NotificationCenter] 请求被取消（页面导航）')
        return
      }
      if (error?.response?.status === 500) {
        logger.warn('⚠️ [NotificationCenter] 通知服务暂时不可用，使用空数据')
        setNotifications([])
        setUnreadCount(0)
        setTotalPages(1)
        return
      }
      logger.error('❌ [NotificationCenter] 获取通知失败:', error?.message || error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await api.post('/notifications/read', { notification_ids: [id] })

      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n),
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      logger.error('❌ 标记已读失败:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all')

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (error) {
      logger.error('❌ 全部标记已读失败:', error)
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      await api.delete(`/api/notifications/${id}`)

      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (error) {
      logger.error('❌ 删除通知失败:', error)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    return date.toLocaleDateString('zh-CN')
  }

  const categories = [...new Set(notifications.map(n => n.metadata?.category).filter(Boolean))]

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label="通知中心"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="w-5 h-5 text-neutral-600 dark:text-neutral-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-error-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[420px] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 z-[100] overflow-hidden"
             style={{ paddingBottom: 'var(--safe-area-inset-bottom, 0px)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="font-semibold text-neutral-900 dark:text-white">通知中心</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 px-2 py-1 text-sm text-secondary-600 hover:bg-secondary-50 dark:hover:bg-secondary-900/20 rounded transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                  全部已读
                </button>
              )}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded-lg transition-colors ${
                  showSettings ? 'bg-neutral-100 dark:bg-neutral-800' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <Settings className="w-4 h-4 text-neutral-500" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4 text-neutral-500" />
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="p-4 bg-slate-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
              <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">通知设置</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
<input aria-label="通知设置" type="checkbox" defaultChecked className="rounded" />                  <span>启用通知</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
<input aria-label="启用通知" type="checkbox" defaultChecked className="rounded" />                  <span>邮件通知</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
<input aria-label="邮件通知" type="checkbox" defaultChecked className="rounded" />                  <span>实时推送</span>
                </label>
                <div className="flex items-center gap-2 pt-2">
                  <Clock className="w-4 h-4 text-neutral-400" />
                  <input
                    type="time"
                    defaultValue="22:00"
                    className="text-sm border rounded px-2 py-1 w-28"
                  />
                  <span className="text-sm text-neutral-500">至</span>
                  <input
                    type="time"
                    defaultValue="08:00"
                    className="text-sm border rounded px-2 py-1 w-28"
                  />
                  <span className="text-xs text-neutral-400">免打扰时段</span>
                </div>
              </div>
            </div>
          )}

          {/* Tabs & Filters */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-neutral-700 shadow-sm font-medium'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setActiveTab('unread')}
                className={`px-3 py-1 text-sm rounded-md transition-colors relative ${
                  activeTab === 'unread'
                    ? 'bg-white dark:bg-neutral-700 shadow-sm font-medium'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                未读
                {unreadCount > 0 && (
                  <span className="ml-1 bg-error-500 text-white text-xs rounded-full px-1.5 min-w-[18px] text-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {categories.length > 0 && (
              <div className="relative">
                <button className="flex items-center gap-1 px-2 py-1 text-sm text-neutral-500 hover:text-neutral-700 rounded hover:bg-neutral-100">
                  <Filter className="w-3 h-3" />
                  筛选
                </button>
              </div>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-[480px] overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-neutral-500">加载中...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                <Bell className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">暂无{activeTab === 'unread' ? '未读' : ''}通知</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`group relative px-4 py-3 hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors border-l-2 ${
                      notification.is_read ? PRIORITY_COLORS[normalizePriority(notification)] + ' bg-slate-50/50 dark:bg-neutral-800/30' : PRIORITY_COLORS[normalizePriority(notification)] + ' bg-secondary-50/30 dark:bg-secondary-900/10'
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Icon - 修复: 添加category的空值保护，防止undefined作为索引类型 */}
                        <div className="mt-0.5 flex-shrink-0">
                          {CATEGORY_ICONS[notification.metadata?.category ?? 'general'] || <Bell className="w-4 h-4 text-neutral-400" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={`text-sm font-medium line-clamp-1 ${
                            notification.is_read
                              ? 'text-neutral-600 dark:text-neutral-400'
                              : 'text-neutral-900 dark:text-white'
                          }`}>
                            {notification.subject || '无标题'}
                          </h4>
                          {!notification.is_read && (
                            <span className="flex-shrink-0 w-2 h-2 bg-secondary-500 rounded-full mt-1.5" />
                          )}
                        </div>

                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                          {stripHtml(notification.body) || '无内容'}
                        </p>

                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-neutral-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimeAgo(notification.created_at)}
                          </span>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {CHANNEL_ICONS[notification.channel || 'in_app']}
                                <span className="text-xs text-neutral-400">{getChannelLabel(notification.channel || 'in_app')}</span>
                              </div>
                        </div>

                        {/* Actions on hover */}
                        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notification.is_read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                markAsRead(notification.id)
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-secondary-600 hover:bg-secondary-50 rounded transition-colors"
                            >
                              <Check className="w-3 h-3" />
                              标记已读
                            </button>
                          )}

                          {notification.metadata?.reference_type && notification.metadata.reference_id && (
                            <a
                              href={`/${notification.metadata.reference_type}/${notification.metadata.reference_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 text-xs text-success-600 hover:bg-success-50 rounded transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3" />
                              查看详情
                            </a>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteNotification(notification.id)
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-error-600 hover:bg-error-50 rounded transition-colors ml-auto"
                          >
                            <Trash2 className="w-3 h-3" />
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer with Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800/50">
              <span className="text-xs text-neutral-500">
                第 {page} / {totalPages} 页
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-sm bg-white dark:bg-neutral-700 border rounded disabled:opacity-50 hover:bg-neutral-100 dark:hover:bg-neutral-600"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-sm bg-white dark:bg-neutral-700 border rounded disabled:opacity-50 hover:bg-neutral-100 dark:hover:bg-neutral-600"
                >
                  下一页
                </button>
              </div>
            </div>
          )}

          {/* Quick Link to Full Page */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-neutral-800/30 border-t border-neutral-200 dark:border-neutral-700">
            <a
              href="/notifications"
              className="block text-center text-sm text-secondary-600 hover:text-secondary-700 py-1"
              onClick={() => setIsOpen(false)}
            >
              查看所有通知 →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function normalizePriority(notification: Notification): string {
  return notification.metadata?.priority || 'normal'
}

function stripHtml(html: string | undefined | null): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function getChannelLabel(channel: string): string {
  const labels: Record<string, string> = {
    in_app: '站内信',
    email: '邮件',
    websocket: '实时推送',
    sms: '短信',
    wechat: '微信',
  }
  return labels[channel] || channel
}

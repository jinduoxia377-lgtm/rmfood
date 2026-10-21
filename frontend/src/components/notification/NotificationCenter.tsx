import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  ExternalLink,
  Clock,
  Filter,
  MessageSquare,
  Workflow,
  Shield,
  Sparkles,
  X,
  Mail,
  Globe,
  Smartphone,
  Send,
} from 'lucide-react'
import api from '../../api/client'
import { notificationApi, type Notification } from '@/api/notifications'
import { logger } from '@/utils/safeLogger';
import { useToast } from '@/components/ui/Toast'
import { subscribeToChannel, onWebSocketMessage } from '@/services/websocket'
import { useAuthStore } from '@/stores/auth'

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
  ai_generation: <Sparkles className="w-4 h-4 text-accent-500" />,
  system: <Globe className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />,
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

const TYPE_LABELS: Record<string, string> = {
  system: '系统',
  formula_review: '审核',
  experiment_complete: '实验',
  ai_task_done: 'AI',
  data_sync: '数据',
}

interface NotificationPrefs {
  enabled: boolean
  email_enabled: boolean
  push_enabled: boolean
  quiet_hours_start: string
  quiet_hours_end: string
}

const PREFS_STORAGE_KEY = 'rmfood_notification_prefs'
const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  email_enabled: true,
  push_enabled: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
}

export function NotificationCenter() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const user = useAuthStore((s) => s.user)

  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showSettings, setShowSettings] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  // 偏好初始值：先从 localStorage 恢复（惰性初始化，避免 effect 中同步 setState）
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => {
    try {
      const saved = localStorage.getItem(PREFS_STORAGE_KEY)
      if (saved) return { ...DEFAULT_PREFS, ...JSON.parse(saved) }
    } catch { /* 忽略损坏数据 */ }
    return DEFAULT_PREFS
  })

  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const data = await notificationApi.list({
        page,
        page_size: 10,
        status: activeTab === 'unread' ? 'unread' : undefined,
      })
      setNotifications((data.items ?? []) as Notification[])
      setUnreadCount(data.unread_count ?? 0)
      setTotalPages(data.total_pages ?? 1)
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
  }, [page, activeTab])

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

  // 初始加载 + 切换页签/翻页时刷新 + 点击面板外部关闭
  useEffect(() => {
    // 数据加载需同步置 loading 状态（react-hooks/set-state-in-effect 对数据请求场景误报）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications()

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [page, activeTab, fetchNotifications])

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchNotifications()
    }
  }, [isOpen, fetchNotifications])

  // 未读角标轮询（60s 一次，关闭面板时静默刷新）
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isOpen) {
        notificationApi.unreadCount()
          .then((res) => {
            const count = res?.unread_count
            if (typeof count === 'number') setUnreadCount(count)
          })
          .catch(() => { /* 静默 */ })
      }
    }, 60000)
    return () => clearInterval(timer)
  }, [isOpen])

  // 实时推送：WebSocket 收到 notification 事件时立即刷新未读角标/列表
  useEffect(() => {
    const refresh = () => {
      if (isOpen) {
        fetchNotifications()
      } else {
        notificationApi.unreadCount()
          .then((res) => {
            const count = res?.unread_count
            if (typeof count === 'number') setUnreadCount(count)
          })
          .catch(() => { /* 静默 */ })
      }
    }

    const unsubChannel = subscribeToChannel('notification', refresh)
    const offMessage = onWebSocketMessage((msg) => {
      if (msg.type === 'notification') refresh()
    })
    return () => {
      unsubChannel()
      offMessage()
    }
  }, [isOpen, fetchNotifications])

  // 从服务端同步通知偏好（尽力而为；本地已由 useState 惰性初始化恢复）
  useEffect(() => {
    notificationApi.getPreferences()
      .then((p) => {
        if (p) {
          setPrefs((prev) => ({
            ...prev,
            email_enabled: p.email_enabled ?? prev.email_enabled,
            push_enabled: p.push_enabled ?? prev.push_enabled,
            quiet_hours_start: p.quiet_hours?.start ?? prev.quiet_hours_start,
            quiet_hours_end: p.quiet_hours?.end ?? prev.quiet_hours_end,
          }))
        }
      })
      .catch(() => { /* 后端未实现持久化时静默，使用本地设置 */ })
  }, [])

  const savePrefs = (next: NotificationPrefs) => {
    setPrefs(next)
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next))
    } catch { /* 存储不可用时忽略 */ }
    // 与服务端同步（v1 落库到 notification_preferences 表）
    notificationApi.updatePreferences({
      email_enabled: next.email_enabled,
      push_enabled: next.push_enabled,
      quiet_hours_start: next.quiet_hours_start,
      quiet_hours_end: next.quiet_hours_end,
    }).catch(() => { /* 静默 */ })
  }

  // 标记单条已读 —— 对齐后端 v1 路由：PUT /notifications/{id}/read
  const markAsRead = async (id: number) => {
    try {
      await notificationApi.markRead(id)

      setNotifications((prev) =>
        activeTab === 'unread'
          ? prev.filter((n) => n.id !== id)
          : prev.map((n) => (n.id === id ? { ...n, is_read: true, isRead: true } : n)),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      logger.error('❌ 标记已读失败:', error)
      addToast({ type: 'error', message: '标记已读失败，请重试' })
    }
  }

  const markAllAsRead = async () => {
    try {
      await notificationApi.markAllRead()

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, isRead: true })))
      setUnreadCount(0)
      addToast({ type: 'success', message: '已全部标记为已读' })
    } catch (error) {
      logger.error('❌ 全部标记已读失败:', error)
      addToast({ type: 'error', message: '全部标记已读失败，请重试' })
    }
  }

  const deleteNotification = async (id: number, wasUnread: boolean) => {
    try {
      await notificationApi.remove(id)

      setNotifications((prev) => prev.filter((n) => n.id !== id))
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
      addToast({ type: 'success', message: '通知已删除' })
    } catch (error) {
      logger.error('❌ 删除通知失败:', error)
      addToast({ type: 'error', message: '删除通知失败，请重试' })
    }
  }

  // 点击通知主体：未读则标记已读，有链接则跳转
  const handleNotificationClick = (n: Notification) => {
    if (!n.is_read) {
      markAsRead(n.id)
    }
    if (n.link) {
      setIsOpen(false)
      navigate(n.link)
    }
  }

  // 清空全部通知（设置面板内，需二次点击确认）
  const clearAllNotifications = async () => {
    try {
      await api.delete('/notifications/clear-all')
      setNotifications([])
      setUnreadCount(0)
      setTotalPages(1)
      setConfirmClear(false)
      addToast({ type: 'success', message: '已清空全部通知' })
    } catch (error) {
      logger.error('❌ 清空通知失败:', error)
      addToast({ type: 'error', message: '清空通知失败，请重试' })
    }
  }

  // 发送测试通知（仅管理员，用于验证实时推送链路）
  const sendTestNotification = async () => {
    setSendingTest(true)
    try {
      await api.post('/notifications/v2/send', { template_id: 'test' })
      addToast({ type: 'success', message: '测试通知已发送' })
    } catch (error) {
      logger.error('❌ 发送测试通知失败:', error)
      addToast({ type: 'error', message: '发送测试通知失败' })
    } finally {
      setSendingTest(false)
    }
  }

  // 分类筛选：从当前已加载通知的 metadata.category 提取可筛选分类
  const categories = [...new Set(
    notifications
      .map((n) => n.metadata?.category)
      .filter((c): c is string => Boolean(c)),
  )]

  const visibleNotifications = categoryFilter
    ? notifications.filter((n) => n.metadata?.category === categoryFilter)
    : notifications

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return ''
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

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg hover:bg-[var(--color-primary-50)] dark:hover:bg-[var(--color-primary)]/15 transition-colors focus:outline-none"
        aria-label="通知中心"
        title="通知"
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

      {/* Notification Panel
            桌面端：跟随铃铛按钮右下弹出（sm:absolute）
            移动端：fixed 贴住视口右缘/顶栏下方，避免 420px 宽面板溢出屏幕 */}
      {isOpen && (
        <div className="fixed right-4 top-[calc(var(--header-height,56px)+var(--safe-area-inset-top,0px)+8px)] w-[calc(100vw-32px)] max-w-[420px] sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-[420px] sm:max-w-none bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 z-[100] overflow-hidden"
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
                className={`p-1.5 rounded-lg transition-colors focus:outline-none ${
                  showSettings ? 'bg-neutral-100 dark:bg-neutral-800' : 'hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-800'
                }`}
                aria-label="通知设置"
                title="通知设置"
              >
                <Settings className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-800 focus:outline-none"
                aria-label="关闭通知面板"
              >
                <X className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
              </button>
            </div>
          </div>

          {/* Settings Panel（已接线：本地持久化 + 服务端同步） */}
          {showSettings && (
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">通知设置</h4>
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">自动保存</span>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    aria-label="启用通知"
                    type="checkbox"
                    checked={prefs.enabled}
                    onChange={(e) => savePrefs({ ...prefs, enabled: e.target.checked })}
                    className="rounded"
                  />
                  <span>启用通知</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    aria-label="邮件通知"
                    type="checkbox"
                    checked={prefs.enabled && prefs.email_enabled}
                    disabled={!prefs.enabled}
                    onChange={(e) => savePrefs({ ...prefs, email_enabled: e.target.checked })}
                    className="rounded"
                  />
                  <span>邮件通知</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    aria-label="实时推送"
                    type="checkbox"
                    checked={prefs.enabled && prefs.push_enabled}
                    disabled={!prefs.enabled}
                    onChange={(e) => savePrefs({ ...prefs, push_enabled: e.target.checked })}
                    className="rounded"
                  />
                  <span>实时推送</span>
                </label>
                <div className="flex items-center gap-2 pt-2">
                  <Clock className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                  <input
                    type="time"
                    value={prefs.quiet_hours_start}
                    onChange={(e) => savePrefs({ ...prefs, quiet_hours_start: e.target.value })}
                    className="text-sm border rounded px-2 py-1 w-28"
                    aria-label="免打扰开始时间"
                  />
                  <span className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">至</span>
                  <input
                    type="time"
                    value={prefs.quiet_hours_end}
                    onChange={(e) => savePrefs({ ...prefs, quiet_hours_end: e.target.value })}
                    className="text-sm border rounded px-2 py-1 w-28"
                    aria-label="免打扰结束时间"
                  />
                  <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">免打扰时段</span>
                </div>

                {/* 管理操作 */}
                <div className="flex items-center gap-2 pt-3 mt-3 border-t border-neutral-200 dark:border-neutral-700">
                  {user?.role === 'admin' && (
                    <button
                      onClick={sendTestNotification}
                      disabled={sendingTest}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-secondary-600 hover:bg-secondary-50 dark:hover:bg-secondary-900/20 rounded transition-colors focus:outline-none disabled:opacity-50"
                    >
                      <Send className="w-3 h-3" />
                      {sendingTest ? '发送中...' : '发送测试通知'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (!confirmClear) {
                        setConfirmClear(true)
                        setTimeout(() => setConfirmClear(false), 3000)
                        return
                      }
                      clearAllNotifications()
                    }}
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors focus:outline-none ${
                      confirmClear
                        ? 'bg-error-50 text-error-600 dark:bg-error-900/30 dark:text-error-400 font-medium'
                        : 'text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-900/30'
                    }`}
                  >
                    <Trash2 className="w-3 h-3" />
                    {confirmClear ? '再次点击确认清空' : '清空全部通知'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tabs + 分类筛选 */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
              <button
                onClick={() => { setActiveTab('all'); setPage(1) }}
                className={`px-3 py-1 text-sm rounded-md transition-colors focus:outline-none ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-neutral-700 shadow-sm font-medium'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => { setActiveTab('unread'); setPage(1) }}
                className={`px-3 py-1 text-sm rounded-md transition-colors relative focus:outline-none ${
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

            {/* 分类筛选（有分类数据时显示） */}
            {categories.length > 0 && (
              <div className="relative ml-auto">
                <button
                  onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                  className={`flex items-center gap-1 px-2 py-1 text-sm rounded-md transition-colors focus:outline-none ${
                    categoryFilter
                      ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200'
                      : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                  aria-haspopup="menu"
                  aria-expanded={showCategoryMenu}
                >
                  <Filter className="w-3 h-3" />
                  {categoryFilter ?? '筛选'}
                </button>
                {showCategoryMenu && (
                  <div
                    className="absolute right-0 mt-1 w-40 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 z-50 py-1"
                    role="menu"
                  >
                    <button
                      role="menuitem"
                      onClick={() => { setCategoryFilter(null); setShowCategoryMenu(false) }}
                      className="block w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none"
                    >
                      全部类型
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c}
                        role="menuitem"
                        onClick={() => { setCategoryFilter(c); setShowCategoryMenu(false) }}
                        className="block w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-[480px] overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="w-8 h-8 border-2 border-secondary-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">加载中...</span>
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                <Bell className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">
                  {categoryFilter
                    ? '该分类下暂无通知'
                    : `暂无${activeTab === 'unread' ? '未读' : ''}通知`}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {visibleNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleNotificationClick(notification)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleNotificationClick(notification)
                    }}
                    className={`group relative px-4 py-3 hover:bg-neutral-50 dark:bg-neutral-800 dark:hover:bg-neutral-800/50 transition-colors border-l-2 cursor-pointer focus:outline-none ${
                      notification.is_read
                        ? PRIORITY_COLORS[normalizePriority(notification)] + ' bg-neutral-50/50 dark:bg-neutral-800/30'
                        : PRIORITY_COLORS[normalizePriority(notification)] + ' bg-secondary-50/30 dark:bg-secondary-300/15'
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className="mt-0.5 flex-shrink-0">
                        {CATEGORY_ICONS[notification.metadata?.category ?? 'general'] || <Bell className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
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
                          <div className="flex items-center gap-1.5 shrink-0">
                            {notification.type && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                                {TYPE_LABELS[notification.type] || notification.type}
                              </span>
                            )}
                            {!notification.is_read && (
                              <span className="flex-shrink-0 w-2 h-2 bg-secondary-500 rounded-full mt-1.5" />
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                          {stripHtml(notification.body) || '无内容'}
                        </p>

                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimeAgo(notification.created_at ?? '')}
                          </span>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {CHANNEL_ICONS[notification.channel || 'in_app']}
                            <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{getChannelLabel(notification.channel || 'in_app')}</span>
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
                              className="flex items-center gap-1 px-2 py-1 text-xs text-secondary-600 hover:bg-secondary-50 rounded transition-colors focus:outline-none"
                            >
                              <Check className="w-3 h-3" />
                              标记已读
                            </button>
                          )}

                          {notification.link && (
                            <a
                              href={notification.link}
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
                              deleteNotification(notification.id, !notification.is_read)
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-error-600 hover:bg-error-50 rounded transition-colors ml-auto focus:outline-none"
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
              <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                第 {page} / {totalPages} 页
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-sm bg-white dark:bg-neutral-700 border rounded disabled:opacity-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-600 focus:outline-none"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-sm bg-white dark:bg-neutral-700 border rounded disabled:opacity-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-600 focus:outline-none"
                >
                  下一页
                </button>
              </div>
            </div>
          )}

          {/* Quick Link to Full Page */}
          <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-800/30 border-t border-neutral-200 dark:border-neutral-700">
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
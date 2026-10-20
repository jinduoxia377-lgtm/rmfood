/**
 * 通知中心页面 — v5.0 仪表盘风格重构版
 *
 * 设计改进：
 *   - 顶部主色横幅替代标题行，与 Dashboard/Settings 风格统一
 *   - 宽页面布局，去除 max-w-4xl 限制，充分利用屏幕空间
 *   - 筛选改为横排药丸 Tab，与 Settings 一致风格
 *   - 通知卡片间距宽松（py-4 px-6，未读加左侧色条）
 *   - 全页面 padding 统一（space-y-6、py-8、gap-5）
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { subscribeToChannel, onWebSocketMessage } from '@/services/websocket'
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Filter,
  Inbox,
  BellOff,
  Clock,
  Zap,
} from 'lucide-react'
import { notificationApi } from '@/api/admin'
import type { Notification } from '@/types'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Button, EmptyState, Skeleton, Pagination } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'

// ─── 类型配置 ────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { labelKey: string; color: string; icon: typeof Bell }> = {
  system: { labelKey: 'pages.notification.typeSystem', color: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)]', icon: Zap },
  formula_review: {
    labelKey: 'pages.notification.typeReview',
    color: 'bg-[var(--color-warning-container)] text-[var(--color-warning-text)] dark:bg-[var(--color-warning-container)]/25 dark:text-[var(--color-warning-text)]',
    icon: Check,
  },
  experiment_complete: {
    labelKey: 'pages.notification.typeExperiment',
    color: 'bg-info-100 text-info-700 dark:bg-info-300/25 dark:text-info-700',
    icon: Inbox,
  },
  ai_task_done: {
    labelKey: 'pages.notification.typeAi',
    color: 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)] dark:bg-[var(--color-primary-container)]/25 dark:text-[var(--color-primary-text)]',
    icon: Zap,
  },
  data_sync: {
    labelKey: 'pages.notification.typeData',
    color: 'bg-[var(--color-accent-container)] text-[var(--color-accent-text)] dark:bg-[var(--color-accent-container)]/25 dark:text-[var(--color-accent-text)]',
    icon: Clock,
  },
}

// ─── 状态筛选 ────────────────────────────────────────────────
const STATUS_FILTERS = [
  { key: '', labelKey: 'pages.notification.all' },
  { key: 'unread', labelKey: 'pages.notification.unread' },
  { key: 'read', labelKey: 'pages.notification.read' },
]

// ─── 主组件 ──────────────────────────────────────────────────
export default function NotificationPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { addToast } = useToast()

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  // 实时推送：收到新通知时自动刷新列表与未读计数
  useEffect(() => {
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    }
    const unsubChannel = subscribeToChannel('notification', refresh)
    const offMessage = onWebSocketMessage((msg) => {
      if (msg.type === 'notification') refresh()
    })
    return () => {
      unsubChannel()
      offMessage()
    }
  }, [qc])

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page, 20, statusFilter],
    queryFn: () => notificationApi.list({ page, page_size: 20, status: statusFilter || undefined }),
  })

  const notifications = data?.items ?? []
  const total = data?.total ?? 0
  const unreadCount = data?.unread_count ?? 0

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      addToast({ type: 'success', message: t('pages.notification.allReadToast') })
    },
  })

  const handleNotifClick = (notif: Notification) => {
    if (!notif.isRead) {
      markReadMutation.mutate(notif.id)
    }
    if (notif.actionUrl) {
      navigate(notif.actionUrl)
    }
  }

  const filteredNotifications = typeFilter
    ? notifications.filter((n) => n.type === typeFilter)
    : notifications

  const totalPages = Math.ceil(total / 20)

  // 切换状态筛选时重置页码
  const handleStatusChange = (key: string) => {
    setStatusFilter(key)
    setPage(1)
  }

  // 切换类型筛选时重置页码
  const handleTypeChange = (key: string) => {
    setTypeFilter(typeFilter === key ? '' : key)
    setPage(1)
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)] animate-page-enter">

      {/* ── 顶部横幅 ── */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold leading-snug">{t('pages.notification.title')}</h1>
            <p className="mt-1 text-white/90 text-sm">{t('pages.notification.subtitle')}</p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              icon={<CheckCheck className="w-4 h-4" />}
              loading={markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
            >
              {t('pages.notification.markAllRead')}
            </Button>
          )}
        </div>
      </div>

      {/* ── 未读统计 + 筛选药丸 ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* 未读数 */}
        <div className="flex items-center gap-2 px-[var(--space-apple-md)] py-2.5 rounded-[var(--radius-Apple-md)] bg-[var(--color-primary-container)] border border-[var(--color-primary-border)] dark:border-[var(--color-primary)]/40">
          <Bell size={15} className="text-[var(--color-primary-text)]" />
          <span className="text-sm font-semibold text-[var(--color-primary-text)]">
            {t('pages.notification.unreadCount', { count: unreadCount })}
          </span>
        </div>

        {/* 筛选栏 */}
        <div className="flex flex-wrap items-center gap-[var(--space-apple-sm)] w-full sm:w-auto">
          {/* 状态筛选 — 药丸 */}
          <div className="flex items-center gap-1 p-1 rounded-[var(--radius-Apple-md)] bg-[var(--bg-tertiary)]">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => handleStatusChange(f.key)}
                className={cn(
                  'px-[var(--space-apple-sm)] py-1.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-all min-h-[44px] inline-flex items-center',
                  statusFilter === f.key
                    ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                )}
              >
                {t(f.labelKey)}
              </button>
            ))}
          </div>

          {/* 类型筛选 */}
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0" />
            <div className="flex flex-wrap items-center gap-1.5">
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => handleTypeChange(key)}
                  className={cn(
                    'px-2.5 py-1 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-all min-h-[44px] inline-flex items-center',
                    typeFilter === key
                      ? cn(cfg.color, 'ring-1 ring-current/30')
                      : 'bg-[var(--bg-tertiary)]/50 text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-muted)]',
                  )}
                >
                  {t(cfg.labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 通知列表 ── */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)]/60 dark:border-neutral-800/60 overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800/40">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-6 py-5">
              <Skeleton className="h-4 w-3/4 mb-[var(--space-apple-sm)]" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            icon={<BellOff className="w-10 h-10 text-[var(--text-muted)] dark:text-[var(--text-muted)]" />}
            title={t('pages.notification.noNotifications')}
            description={statusFilter ? t('pages.notification.noNotificationsFiltered') : t('pages.notification.noNotificationsCurrent')}
          />
        ) : (
          filteredNotifications.map((notif) => {
            const typeCfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system
            const Icon = typeCfg.icon
            return (
              <button
                key={notif.id}
                onClick={() => handleNotifClick(notif)}
                className={cn(
                  'w-full text-left px-6 py-4 transition-colors',
                  'hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/40',
                  !notif.isRead && 'bg-[var(--color-primary-container)]/30 dark:bg-[var(--color-primary-container)]/15',
                )}
              >
                <div className="flex items-start gap-4">
                  {/* 未读左侧色条 */}
                  {!notif.isRead && (
                    <div className="shrink-0 w-1 h-10 rounded-[var(--radius-pill)] bg-[var(--color-primary-container)]0 mt-0.5" />
                  )}

                  {/* 类型图标 */}
                  <div
                    className={cn(
                      'shrink-0 w-10 h-10 rounded-[var(--radius-Apple-md)] flex items-center justify-center',
                      typeCfg.color,
                    )}
                  >
                    <Icon size={16} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          'text-sm truncate',
                          !notif.isRead
                            ? 'font-semibold text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)]',
                        )}
                      >
                        {notif.title}
                      </p>
                      {notif.actionUrl && (
                        <ExternalLink size={12} className="shrink-0 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                      )}
                      {!notif.isRead && (
                        <span className="shrink-0 w-2 h-2 rounded-[var(--radius-pill)] bg-[var(--color-primary-container)]0" />
                      )}
                    </div>
                    {notif.message && (
                      <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                        {notif.message}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={cn('px-2 py-0.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium', typeCfg.color)}
                      >
                        {t(typeCfg.labelKey)}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {notif.createdAt &&
                          format(new Date(notif.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                      </span>
                    </div>
                  </div>

                  {/* 单条已读按钮 */}
                  {!notif.isRead && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        markReadMutation.mutate(notif.id)
                      }}
                      className="shrink-0 p-2 rounded-[var(--radius-Apple-sm)] text-[var(--text-muted)] hover:text-[var(--color-primary-text)]0 hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]/20 transition-colors"
                      title={t('pages.notification.markRead')}
                      aria-label={t('pages.notification.markRead')}
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}

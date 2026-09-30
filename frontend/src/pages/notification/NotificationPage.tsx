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
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
const TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof Bell }> = {
  system: { label: '系统', color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300', icon: Zap },
  formula_review: {
    label: '审核',
    color: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
    icon: Check,
  },
  experiment_complete: {
    label: '实验',
    color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    icon: Inbox,
  },
  ai_task_done: {
    label: 'AI',
    color: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
    icon: Zap,
  },
  data_sync: {
    label: '数据',
    color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    icon: Clock,
  },
}

// ─── 状态筛选 ────────────────────────────────────────────────
const STATUS_FILTERS = [
  { key: '', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'read', label: '已读' },
]

// ─── 主组件 ──────────────────────────────────────────────────
export default function NotificationPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { addToast } = useToast()

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

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
      addToast({ type: 'success', message: '已全部标记为已读' })
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
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-page-enter">

      {/* ── 顶部横幅 ── */}
      <div className="surface-primary rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold leading-snug">通知中心</h1>
            <p className="mt-1 text-white/90 text-sm">查看系统通知、审核反馈和任务完成提醒</p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              icon={<CheckCheck className="w-4 h-4" />}
              loading={markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
            >
              全部已读
            </Button>
          )}
        </div>
      </div>

      {/* ── 未读统计 + 筛选药丸 ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* 未读数 */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/40">
          <Bell size={15} className="text-primary-600 dark:text-primary-400" />
          <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
            {unreadCount} 条未读
          </span>
        </div>

        {/* 筛选栏 */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* 状态筛选 — 药丸 */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => handleStatusChange(f.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  statusFilter === f.key
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* 类型筛选 */}
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-neutral-400 shrink-0" />
            <div className="flex flex-wrap items-center gap-1.5">
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => handleTypeChange(key)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                    typeFilter === key
                      ? cn(cfg.color, 'ring-1 ring-current/30')
                      : 'bg-slate-50 dark:bg-neutral-800/50 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300',
                  )}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 通知列表 ── */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/40">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-6 py-5">
              <Skeleton className="h-4 w-3/4 mb-3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            icon={<BellOff className="w-10 h-10 text-neutral-300 dark:text-neutral-600" />}
            title="暂无通知"
            description={statusFilter ? '该筛选条件下没有通知' : '当前没有新通知'}
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
                  'hover:bg-neutral-50 dark:hover:bg-neutral-800/40',
                  !notif.isRead && 'bg-primary-50/30 dark:bg-primary-900/10',
                )}
              >
                <div className="flex items-start gap-4">
                  {/* 未读左侧色条 */}
                  {!notif.isRead && (
                    <div className="shrink-0 w-1 h-10 rounded-full bg-primary-500 mt-0.5" />
                  )}

                  {/* 类型图标 */}
                  <div
                    className={cn(
                      'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
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
                            ? 'font-semibold text-neutral-900 dark:text-white'
                            : 'text-neutral-600 dark:text-neutral-300',
                        )}
                      >
                        {notif.title}
                      </p>
                      {notif.actionUrl && (
                        <ExternalLink size={12} className="shrink-0 text-neutral-400" />
                      )}
                      {!notif.isRead && (
                        <span className="shrink-0 w-2 h-2 rounded-full bg-primary-500" />
                      )}
                    </div>
                    {notif.message && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                        {notif.message}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={cn('px-2 py-0.5 rounded-md text-[10px] font-medium', typeCfg.color)}
                      >
                        {typeCfg.label}
                      </span>
                      <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
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
                      className="shrink-0 p-2 rounded-lg text-neutral-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                      title="标记已读"
                      aria-label="标记已读"
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

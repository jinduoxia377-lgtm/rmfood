/**
 * 审计日志页面（管理员）
 * 操作记录查询 | 筛选 | 用户追溯
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Shield, Search, User, FileText, Activity, Clock,
} from 'lucide-react'

import {
  Input, EmptyState, Skeleton, Pagination,
} from '@/components/ui'

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-info-100 text-info-700 dark:bg-info-300/25 dark:text-info-700',
  create: 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)] dark:bg-[var(--color-primary-container)]/25 dark:text-[var(--color-primary-text)]',
  update: 'bg-[var(--color-warning-container)] text-[var(--color-warning-text)] dark:bg-[var(--color-warning-container)]/25 dark:text-[var(--color-warning-text)]',
  delete: 'bg-danger-100 text-danger-700 dark:bg-danger-300/25 dark:text-danger-700',
  review: 'bg-[var(--color-accent-container)] text-[var(--color-accent-text)] dark:bg-[var(--color-accent-container)]/25 dark:text-[var(--color-accent-text)]',
  export: 'bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)] dark:bg-[var(--color-secondary-container)]/25 dark:text-[var(--color-secondary-text)]',
  status_change: 'bg-[var(--color-warning-container)] text-[var(--color-warning-text)] dark:bg-[var(--color-warning-container)]/25 dark:text-[var(--color-warning-text)]',
}

const ACTION_LABELS: Record<string, string> = {
  login: 'pages.auditLog.actionLogin',
  create: 'pages.auditLog.actionCreate',
  update: 'pages.auditLog.actionUpdate',
  delete: 'pages.auditLog.actionDelete',
  review: 'pages.auditLog.actionReview',
  export: 'pages.auditLog.actionExport',
  status_change: 'pages.auditLog.actionStatusChange',
}

interface AuditLog {
  id: number
  user_id: number | null
  username: string | null
  action: string
  entity_type: string | null
  entity_id: number | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string | null
}

export default function AuditLogPage() {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  // Fetch audit logs via admin API client
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, actionFilter],
    queryFn: async () => {
      const { adminApi } = await import('@/api/admin')
      return adminApi.getAuditLogs({ page, page_size: 20, action: actionFilter || undefined }) as Promise<{ items: AuditLog[]; total: number; page: number; page_size: number }>
    },
  })

  const logs = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 20)

  // Search client-side for simplicity
  const filteredLogs = search
    ? logs.filter((log) =>
        log.username?.toLowerCase().includes(search.toLowerCase()) ||
        log.action?.toLowerCase().includes(search.toLowerCase()) ||
        log.entity_type?.toLowerCase().includes(search.toLowerCase()),
      )
    : logs

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 py-[var(--space-apple-lg)]">
      {/* 欢迎横幅 */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-[var(--space-apple-md)]">
          <div>
            <h1 className="text-xl font-semibold leading-snug tracking-tight">{t('pages.auditLog.title')}</h1>
            <p className="mt-1 text-sm text-white/80">{t('pages.auditLog.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0" />
        </div>
      </div>

      {/* 统计摘要 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-[var(--space-apple-sm)]">
        {[
          { label: t('pages.auditLog.statTotal'), value: total, icon: Activity, color: 'from-neutral-500 to-neutral-600' },
          { label: t('pages.auditLog.statToday'), value: logs.filter((l) => l.created_at?.startsWith(new Date().toISOString().slice(0, 10))).length, icon: Clock, color: 'from-primary-500 to-primary-600' },
          { label: t('pages.auditLog.statUsers'), value: new Set(logs.map((l) => l.username).filter(Boolean)).size, icon: User, color: 'from-accent-500 to-accent-600' },
          { label: t('pages.auditLog.statActionTypes'), value: new Set(logs.map((l) => l.action).filter(Boolean)).size, icon: FileText, color: 'from-warning-500 to-warning-500' },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="flex items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-md)] py-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] bg-[var(--bg-secondary)] border border-[var(--border-color)]/60 dark:border-neutral-800/60">
              <div className={`w-9 h-9 rounded-[var(--radius-Apple-sm)] bg-gradient-to-br ${stat.color} flex items-center justify-center shrink-0`}>
                <Icon size={16} className="text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-[var(--text-primary)]">{stat.value}</p>
                <p className="text-xs text-[var(--text-muted)]">{stat.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-[var(--space-apple-sm)]">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('pages.auditLog.searchPlaceholder')}
            prefix={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-[var(--radius-Apple-md)] bg-[var(--bg-tertiary)]">
          <button
            onClick={() => setActionFilter('')}
            className={cn(
              'px-[var(--space-apple-sm)] py-1.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-all min-h-[44px] inline-flex items-center',
              !actionFilter ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)]',
            )}
          >
            {t('pages.auditLog.all')}
          </button>
          {Object.entries(ACTION_LABELS).map(([key, labelKey]) => (
            <button
              key={key}
              onClick={() => setActionFilter(actionFilter === key ? '' : key)}
              className={cn(
                'px-[var(--space-apple-sm)] py-1.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-all min-h-[44px] inline-flex items-center',
                actionFilter === key ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)]',
              )}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* 日志列表 */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)]/60 dark:border-neutral-800/60 overflow-hidden">
        {/* 表头 */}
        <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-[var(--space-apple-md)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-tertiary)]/50 border-b border-[var(--border-color)]/60 dark:border-neutral-800/60">
          <div className="col-span-2">{t('pages.auditLog.thTime')}</div>
          <div className="col-span-2">{t('pages.auditLog.thUser')}</div>
          <div className="col-span-2">{t('pages.auditLog.thAction')}</div>
          <div className="col-span-2">{t('pages.auditLog.thEntity')}</div>
          <div className="col-span-2">{t('pages.auditLog.thDetails')}</div>
          <div className="col-span-2">{t('pages.auditLog.thIp')}</div>
        </div>

        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-5 py-[var(--space-apple-md)] border-b border-[var(--border-color)]/40">
              <Skeleton className="h-4 w-full" />
            </div>
          ))
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={<Shield className="w-10 h-10 text-[var(--text-muted)] dark:text-[var(--text-muted)]" />}
            title={t('pages.auditLog.noLogs')}
            description={t('pages.auditLog.noLogsDesc')}
          />
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-5 py-[var(--space-apple-md)] border-b border-[var(--border-color)]/40 hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/30 transition-colors"
            >
              {/* 时间 */}
              <div className="col-span-2 text-xs text-[var(--text-muted)]">
                {log.created_at
                  ? new Date(log.created_at).toLocaleString(i18n.language, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                  : '-'}
              </div>

              {/* 用户 */}
              <div className="col-span-2">
                <div className="flex items-center gap-1.5">
                  <User size={12} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                  <span className="text-sm text-[var(--text-primary)] font-medium">
                    {log.username || `ID:${log.user_id}`}
                  </span>
                </div>
              </div>

              {/* 操作 */}
              <div className="col-span-2">
                <span className={cn(
                  'inline-flex px-2 py-0.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium',
                  ACTION_COLORS[log.action] || 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)]',
                )}>
                  {t(ACTION_LABELS[log.action] || log.action) || log.action}
                </span>
              </div>

              {/* 实体 */}
              <div className="col-span-2 text-sm text-[var(--text-secondary)]">
                {log.entity_type ? `${log.entity_type}${log.entity_id ? ` #${log.entity_id}` : ''}` : '-'}
              </div>

              {/* 详情 */}
              <div className="col-span-2 text-xs text-[var(--text-muted)] truncate">
                {log.details ? (
                  <span className="font-mono">
                    {Object.entries(log.details).slice(0, 2).map(([k, v]) => `${k}:${typeof v === 'string' ? v.slice(0, 20) : v}`).join(' ')}
                  </span>
                ) : '-'}
              </div>

              {/* IP */}
              <div className="col-span-2 text-xs text-[var(--text-muted)] font-mono">
                {log.ip_address || '-'}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  )
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

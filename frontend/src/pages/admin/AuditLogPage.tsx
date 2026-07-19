/**
 * 审计日志页面（管理员）
 * 操作记录查询 | 筛选 | 用户追溯
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Shield, Search, User, FileText, Activity, Clock,
} from 'lucide-react'

import {
  Input, PageHeader, EmptyState, Skeleton, Pagination,
} from '@/components/ui'

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  create: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
  update: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
  delete: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  review: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  export: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-400',
  status_change: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

const ACTION_LABELS: Record<string, string> = {
  login: '登录',
  create: '创建',
  update: '更新',
  delete: '删除',
  review: '审核',
  export: '导出',
  status_change: '状态变更',
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
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  // Direct API call to avoid circular dependencies
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, actionFilter],
    queryFn: async () => {
      const api = (await import('@/api/client')).default
      const params: Record<string, unknown> = { page, page_size: 20 }
      if (actionFilter) params.action = actionFilter
      return api.get('/admin/audit-logs', { params }).then((r: { data: unknown }) => r.data as { items: AuditLog[]; total: number; page: number; page_size: number })
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
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="审计日志"
        description="系统操作记录，追踪用户行为和数据变更"
      />

      {/* 统计摘要 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '总记录', value: total, icon: Activity, color: 'from-slate-500 to-slate-600' },
          { label: '今日操作', value: logs.filter((l) => l.created_at?.startsWith(new Date().toISOString().slice(0, 10))).length, icon: Clock, color: 'from-primary-500 to-primary-600' },
          { label: '涉及用户', value: new Set(logs.map((l) => l.username).filter(Boolean)).size, icon: User, color: 'from-violet-500 to-purple-600' },
          { label: '操作类型', value: new Set(logs.map((l) => l.action).filter(Boolean)).size, icon: FileText, color: 'from-amber-500 to-orange-500' },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60">
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center shrink-0`}>
                <Icon size={16} className="text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-neutral-900 dark:text-white">{stat.value}</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{stat.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索用户、操作、实体..."
            prefix={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
          <button
            onClick={() => setActionFilter('')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              !actionFilter ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400',
            )}
          >
            全部
          </button>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActionFilter(actionFilter === key ? '' : key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                actionFilter === key ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 日志列表 */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
        {/* 表头 */}
        <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider bg-slate-50 dark:bg-neutral-800/50 border-b border-neutral-200/60 dark:border-neutral-800/60">
          <div className="col-span-2">时间</div>
          <div className="col-span-2">用户</div>
          <div className="col-span-2">操作</div>
          <div className="col-span-2">实体</div>
          <div className="col-span-2">详情</div>
          <div className="col-span-2">IP</div>
        </div>

        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-5 py-3 border-b border-neutral-100 dark:border-neutral-800/40">
              <Skeleton className="h-4 w-full" />
            </div>
          ))
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={<Shield className="w-10 h-10 text-neutral-300 dark:text-neutral-600" />}
            title="暂无审计记录"
            description="系统暂无操作记录"
          />
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-5 py-3 border-b border-neutral-100 dark:border-neutral-800/40 hover:bg-slate-50 dark:hover:bg-neutral-800/30 transition-colors"
            >
              {/* 时间 */}
              <div className="col-span-2 text-xs text-neutral-500 dark:text-neutral-400">
                {log.created_at
                  ? new Date(log.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                  : '-'}
              </div>

              {/* 用户 */}
              <div className="col-span-2">
                <div className="flex items-center gap-1.5">
                  <User size={12} className="text-neutral-400" />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300 font-medium">
                    {log.username || `ID:${log.user_id}`}
                  </span>
                </div>
              </div>

              {/* 操作 */}
              <div className="col-span-2">
                <span className={cn(
                  'inline-flex px-2 py-0.5 rounded-md text-xs font-medium',
                  ACTION_COLORS[log.action] || 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
                )}>
                  {ACTION_LABELS[log.action] || log.action}
                </span>
              </div>

              {/* 实体 */}
              <div className="col-span-2 text-sm text-neutral-600 dark:text-neutral-400">
                {log.entity_type ? `${log.entity_type}${log.entity_id ? ` #${log.entity_id}` : ''}` : '-'}
              </div>

              {/* 详情 */}
              <div className="col-span-2 text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {log.details ? (
                  <span className="font-mono">
                    {Object.entries(log.details).slice(0, 2).map(([k, v]) => `${k}:${typeof v === 'string' ? v.slice(0, 20) : v}`).join(' ')}
                  </span>
                ) : '-'}
              </div>

              {/* IP */}
              <div className="col-span-2 text-xs text-neutral-400 dark:text-neutral-500 font-mono">
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

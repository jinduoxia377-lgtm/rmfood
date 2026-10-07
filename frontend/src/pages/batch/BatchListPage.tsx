/**
 * 批记录列表页面
 * Phase 1: 数据底座加固
 */
import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Plus, Search, Filter, FlaskConical, Trash2, X,
  ChevronUp, ChevronDown, ArrowUpDown, Calendar,
  Download, Eye, ArrowRight,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { StatusBadge, EmptyState, Pagination, Skeleton } from '@/components/ui/Common'
import { Button, Input, StatCard, Badge, Card, CardContent } from '@/components/ui'
import { Highlight } from '@/components/common'
import { cn } from '@/lib/utils'
import { batchApi } from '@/api/batch'
import { useToast } from '@/components/ui/Toast'

const STATUS_FILTERS = [
  { value: '', label: '全部' },
  { value: 'planned', label: '计划中' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'closed', label: '已关闭' },
]

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-400',
  in_progress: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
  completed: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400',
  closed: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
}

type SortKey = 'batch_code' | 'created_at' | 'target_weight_kg'
type SortDir = 'asc' | 'desc'

export default function BatchListPage() {
  const navigate = useNavigate()
  // Toast handled by parent layout
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [formulaFilter, setFormulaFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const { data, isLoading } = useQuery({
    queryKey: ['batches', { search, statusFilter, formulaFilter, page, pageSize, sortKey, sortDir }],
    queryFn: () => batchApi.list({
      search,
      status: statusFilter || undefined,
      formula_code: formulaFilter || undefined,
      page,
      page_size: pageSize,
      sort_by: sortKey,
      sort_order: sortDir,
    }),
  })

  const batches = data?.items ?? []
  const total = data?.total ?? 0

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortKey }) => {
    if (sortKey !== field) return <ArrowUpDown size={13} className="text-neutral-300" />
    return sortDir === 'asc'
      ? <ChevronUp size={13} className="text-primary" />
      : <ChevronDown size={13} className="text-primary" />
  }

  return (
    <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div className="max-w-7xl mx-auto space-y-6">
      {/* 页头横幅 — 对齐 Dashboard 品牌横幅规范 */}
      <div className="surface-primary rounded-xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold leading-snug tracking-tight flex items-center gap-2">
              <FlaskConical size={20} className="text-white/80 shrink-0" />
              批记录管理
            </h2>
            <p className="mt-1 text-white/80 text-sm">
              从配方生成批记录，追踪原料→批次→样品的完整链路
            </p>
          </div>
          <Button onClick={() => navigate('/batches/new')} className="bg-white dark:bg-neutral-900/15 hover:bg-white dark:bg-neutral-900/25 text-white border-none">
            <Plus size={16} />
            新建批记录
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="总批次数"
          value={total}
          icon={FlaskConical}
          variant="secondary"
        />
        <StatCard
          label="计划中"
          value={batches.filter(b => b.status === 'planned').length}
          icon={Calendar}
          variant="warning"
        />
        <StatCard
          label="已完成"
          value={batches.filter(b => b.status === 'completed').length}
          icon={ArrowRight}
          variant="success"
        />
        <StatCard
          label="样品数"
          value={batches.reduce((sum, b) => sum + (b.sample_count ?? 0), 0)}
          icon={FlaskConical}
          variant="info"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <Input
                placeholder="搜索批号..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm"
            >
              {STATUS_FILTERS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatusFilter(''); setFormulaFilter(''); }}>
              <X size={14} /> 清除
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                <th className="text-left px-4 py-3 font-medium text-neutral-500">
                  <button onClick={() => handleSort('batch_code')} className="flex items-center gap-1">
                    批号 <SortIcon field="batch_code" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">配方</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">
                  <button onClick={() => handleSort('target_weight_kg')} className="flex items-center gap-1">
                    目标产量 <SortIcon field="target_weight_kg" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">状态</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">样品数</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">
                  <button onClick={() => handleSort('created_at')} className="flex items-center gap-1">
                    创建时间 <SortIcon field="created_at" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 font-medium text-neutral-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-neutral-50 dark:border-neutral-800/50">
                    <td colSpan={7} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={<FlaskConical size={48} strokeWidth={1.5} />}
                      title="暂无批记录"
                      description="从配方创建批记录，开始追踪原料→批次→样品的完整链路"
                      action={<button onClick={() => navigate('/batches/new')} className="mt-4 px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition-colors">新建批记录</button>}
                    />
                  </td>
                </tr>
              ) : (
                batches.map(batch => (
                  <tr key={batch.id} className="border-b border-neutral-50 dark:border-neutral-800/50 hover:bg-neutral-50 dark:bg-neutral-800/50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-medium text-primary">
                        {batch.batch_code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/formulas/${batch.formula_id}`}
                        className="font-medium text-neutral-700 dark:text-neutral-300 hover:text-primary transition-colors"
                      >
                        {batch.formula_name || batch.formula_code}
                      </Link>
                      <div className="text-xs text-neutral-400">{batch.formula_code}</div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {batch.target_weight_kg?.toFixed(3)} kg
                      {batch.actual_weight_kg && (
                        <span className="ml-2 text-xs text-neutral-400">
                          实际: {batch.actual_weight_kg.toFixed(3)} kg
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        STATUS_COLORS[batch.status] || 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'
                      )}>
                        {batch.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {batch.sample_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-400">
                      {batch.created_at ? new Date(batch.created_at).toLocaleDateString('zh-CN') : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/batches/${batch.id}`}
                          className="p-1.5 rounded-lg hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-800 transition-colors"
                        >
                          <Eye size={14} className="text-neutral-500" />
                        </Link>
                        <Link
                          to={`/batches/${batch.id}/trace`}
                          className="p-1.5 rounded-lg hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-800 transition-colors"
                          title="追溯"
                        >
                          <ArrowRight size={14} className="text-neutral-500" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > pageSize && (
          <div className="px-4 py-3 border-t border-neutral-100 dark:border-neutral-800">
            <Pagination
              page={page}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
      </div>
    </div>
  )
}

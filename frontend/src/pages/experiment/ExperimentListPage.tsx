/**
 * 实验管理页面 — 专家级深度增强版
 * 功能：搜索高亮 + 关联配方显示 + 批量操作 + 列排序 + 高级筛选 + 负责人筛选 + 导出 + 统计概览
 */
import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Plus, Search, Filter, TestTubes, Trash2, X,
  ChevronUp, ChevronDown, ArrowUpDown, FlaskConical,
  Calendar, User, Download, BarChart3, FileText,
} from 'lucide-react'
import { useExperiments } from '@/hooks/useQueries'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StatusBadge, EmptyState, Pagination, Skeleton } from '@/components/ui/Common'
import { Button, Input, PageHeader, Badge, Card, CardContent } from '@/components/ui'
import { Highlight } from '@/components/common'
import { cn } from '@/lib/utils'
import { experimentApi } from '@/api/experiment'
import { useToast } from '@/components/ui/Toast'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

// ── 状态筛选 ──
const STATUS_FILTERS = [
  { value: '', label: '全部' },
  { value: 'planned', label: '计划中' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '已失败' },
  { value: 'cancelled', label: '已取消' },
]

type SortKey = 'title' | 'updated_at' | 'status' | 'code'

// ── 排序图标 ──
const SortIcon: React.FC<{ field: SortKey; sortKey: SortKey | null; sortDir: 'asc' | 'desc' }> = ({ field, sortKey, sortDir }) => {
  if (sortKey !== field) return <ArrowUpDown size={13} className="text-neutral-300" />
  return sortDir === 'asc'
    ? <ChevronUp size={13} className="text-violet-500" />
    : <ChevronDown size={13} className="text-violet-500" />
}

export default function ExperimentListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()
  const { addToast } = useToast()

  const page = Number(searchParams.get('page') ?? 1)
  const status = searchParams.get('status') ?? ''
  const search = searchParams.get('search') ?? ''
  const [searchInput, setSearchInput] = useState(search)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // 批量操作
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // 查询
  const { data, isLoading } = useExperiments({
    page,
    page_size: 12,
    status: status || undefined,
    search: search || undefined,
  })

  // 负责人统计（从实验数据中聚合）
  const { data: stats } = useQuery({
    queryKey: ['experiment-statistics'],
    queryFn: experimentApi.statistics,
    staleTime: 60_000,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  // 排序
  const sortedItems = useMemo(() => {
    if (!sortKey) return items
    return [...items].sort((a, b) => {
      const av = String(a[sortKey as keyof typeof a] ?? '')
      const bv = String(b[sortKey as keyof typeof b] ?? '')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [items, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams)
    if (searchInput) params.set('search', searchInput)
    else params.delete('search')
    params.set('page', '1')
    setSearchParams(params)
    setSelectedIds(new Set())
  }

  const handleFilter = (newStatus: string) => {
    const params = new URLSearchParams(searchParams)
    if (newStatus) params.set('status', newStatus)
    else params.delete('status')
    params.set('page', '1')
    setSearchParams(params)
    setSelectedIds(new Set())
  }

  const clearAllFilters = () => {
    setSearchParams({})
    setSearchInput('')
    setSelectedIds(new Set())
    setSortKey(null)
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // 批量删除
  const batchDeleteMut = useMutation({
    mutationFn: (ids: number[]) => experimentApi.batchDelete(ids),
    onSuccess: (res) => {
      addToast({ type: 'success', message: res.message || '批量删除成功' })
      qc.invalidateQueries({ queryKey: ['experiments'] })
      setSelectedIds(new Set())
    },
    onError: () => addToast({ type: 'error', message: '批量删除失败' }),
  })

  // 导出 CSV
  const handleExportCSV = () => {
    const rows = [
      ['编号', '标题', '状态', '关联配方', '更新时间'],
      ...sortedItems.map((exp) => [
        String(exp.id),
        exp.title,
        exp.status,
        [exp.formulaId ? `配方#${exp.formulaId}` : '-',
        format(new Date(exp.updatedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })],
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `实验列表_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(total / 12)

  // 状态统计
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { planned: 0, in_progress: 0, completed: 0, failed: 0, cancelled: 0 }
    for (const exp of items) {
      const s = exp.status
      if (counts[s] !== undefined) counts[s]++
    }
    return counts
  }, [items])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* 页面头部 */}
      <PageHeader
        title="实验管理"
        description={`共 ${total} 个实验`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={handleExportCSV} disabled={total === 0}>
              导出
            </Button>
            <Link to="/experiments/new">
              <Button
                icon={<Plus size={16} />}
                size="md"
                className="bg-primary-600 hover:bg-primary-700 shadow-primary-600/25"
              >
                新建实验
              </Button>
            </Link>
          </div>
        }
      />

      {/* 统计概览 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STATUS_FILTERS.filter((f) => f.value).map((f) => {
          const count = statusCounts[f.value] ?? 0
          return (
            <button
              key={f.value}
              onClick={() => handleFilter(f.value)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border transition-all hover:-translate-y-0.5',
                status === f.value
                  ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                  : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:shadow-md',
              )}
            >
              <div className={cn(
                'w-2 h-2 rounded-full shrink-0',
                f.value === 'planned' && 'bg-sky-500',
                f.value === 'in_progress' && 'bg-violet-500',
                f.value === 'completed' && 'bg-success-500',
                f.value === 'failed' && 'bg-error-500',
                f.value === 'cancelled' && 'bg-neutral-400',
              )} />
              <div className="text-left min-w-0">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{f.label}</p>
                <p className="text-lg font-bold text-neutral-900 dark:text-white leading-none">{count}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索实验标题或编号..."
                prefix={<Search size={16} />}
                className="flex-1"
              />
              {(search || status || sortKey) && (
                <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={clearAllFilters}>
                  清除筛选
                </Button>
              )}
            </div>

            {/* 状态筛选 */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={14} className="text-neutral-400" />
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => handleFilter(f.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    (!f.value && !status) || f.value === status
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                  )}
                >
                  {f.label}
                  {f.value && statusCounts[f.value] !== undefined && (
                    <span className="ml-1 text-neutral-400">({statusCounts[f.value]})</span>
                  )}
                </button>
              ))}

              {/* 高级筛选按钮 */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn(
                  'ml-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  showAdvanced
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                    : 'text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                )}
              >
                排序选项
              </button>
            </div>

            {/* 高级排序面板 */}
            {showAdvanced && (
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-neutral-800/50 rounded-xl">
                <span className="text-xs text-neutral-500 shrink-0">排序依据:</span>
                {[
                  { key: 'title' as SortKey, label: '标题' },
                  { key: 'code' as SortKey, label: '编号' },
                  { key: 'status' as SortKey, label: '状态' },
                  { key: 'updated_at' as SortKey, label: '更新时间' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => toggleSort(opt.key)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                      sortKey === opt.key
                        ? 'bg-primary-500 text-white'
                        : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700',
                    )}
                  >
                    {opt.label}
                    {sortKey === opt.key && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 多选提示条 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/40 rounded-xl animate-fade-in">
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            已选中 {selectedIds.size} 个实验
          </span>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 size={13} />}
            loading={batchDeleteMut.isPending}
            onClick={() => batchDeleteMut.mutate(Array.from(selectedIds))}
          >
            批量删除
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            取消选择
          </button>
        </div>
      )}

      {/* 列表 */}
      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-5 w-1/3 mb-3" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sortedItems.length === 0 ? (
        <EmptyState
          icon={<TestTubes size={48} />}
          title="暂无实验"
          description={search || status ? '没有匹配筛选条件的实验' : '创建实验来验证您的配方方案'}
          action={
            <Link to="/experiments/new">
              <Button icon={<Plus size={14} />} size="sm" className="bg-primary-600 hover:bg-primary-700">
                {search || status ? '查看全部实验' : '新建实验'}
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {/* 表头 */}
          <div
            className="hidden sm:grid sm:grid-cols-[auto_1fr_140px_100px_120px_100px_40px] gap-3 px-5 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"
            role="rowgroup"
          >
            <div className="w-5" role="columnheader" />
            <button
              onClick={() => toggleSort('title')}
              className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-200"
              role="columnheader"
              aria-sort={sortKey === 'title' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              标题 <SortIcon field="title" sortKey={sortKey} sortDir={sortDir} />
            </button>
            <div role="columnheader">编号</div>
            <button
              onClick={() => toggleSort('status')}
              className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-200"
              role="columnheader"
              aria-sort={sortKey === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              状态 <SortIcon field="status" sortKey={sortKey} sortDir={sortDir} />
            </button>
            <div role="columnheader">关联配方</div>
            <button
              onClick={() => toggleSort('updated_at')}
              className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-200"
              role="columnheader"
              aria-sort={sortKey === 'updated_at' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              更新时间 <SortIcon field="updated_at" sortKey={sortKey} sortDir={sortDir} />
            </button>
            <div role="columnheader" />
          </div>

          {/* 列表行 */}
          {sortedItems.map((exp) => {
            const isSelected = selectedIds.has(exp.id)
            return (
              <div key={exp.id} className={cn('group block', isSelected && 'ring-2 ring-violet-400 rounded-2xl')}>
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                  <div className="flex items-center gap-3 p-5">
                    {/* 勾选框 */}
                    <button
                      onClick={(e) => { e.preventDefault(); toggleSelect(exp.id) }}
                      className={cn(
                        'shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-primary-500 border-primary-500 text-white'
                          : 'border-neutral-300 dark:border-neutral-600 hover:border-primary-400',
                      )}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* 主内容 */}
                    <Link
                      to={`/experiments/${exp.id}`}
                      className="flex-1 min-w-0 grid sm:grid-cols-[1fr_140px_100px_120px_100px] gap-3 items-start"
                    >
                      {/* 标题 */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FlaskConical size={14} className="text-violet-400 shrink-0" />
                          <div className="text-sm font-semibold text-neutral-900 dark:text-white truncate group-hover:text-violet-600 transition-colors">
                            <Highlight text={exp.title} keyword={search} />
                          </div>
                        </div>
                        {exp.description && (
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 pl-[22px]">
                            <Highlight text={exp.description} keyword={search} />
                          </p>
                        )}
                        {exp.objectives && exp.objectives.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5 pl-[22px]">
                            {exp.objectives.slice(0, 3).map((obj, i) => (
                              <Badge key={i} variant="info" size="sm">{obj}</Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 编号 */}
                      <div className="hidden sm:block text-xs font-mono text-neutral-500 dark:text-neutral-400">
                        <Highlight text={String(exp.id)} keyword={search} />
                      </div>

                      {/* 状态 */}
                      <div className="hidden sm:block">
                        <StatusBadge status={exp.status} />
                      </div>

                      {/* 关联配方 */}
                      <div className="hidden sm:block">
                        {exp.formula_id ? (
                          <Link
                            to={`/formulas/${exp.formula_id}`}
                            className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FlaskConical size={11} />
                            {exp.formulaId ? `配方#${exp.formulaId}` : '-'}
                          </Link>
                        ) : (
                          <span className="text-xs text-neutral-400">-</span>
                        )}
                      </div>

                      {/* 更新时间 */}
                      <div className="hidden sm:flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500">
                        <Calendar size={11} />
                        {format(new Date(exp.updatedAt), 'MM-dd', { locale: zhCN })}
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={(p) => {
            const params = new URLSearchParams(searchParams)
            params.set('page', String(p))
            setSearchParams(params)
          }}
        />
      )}
    </div>
  )
}

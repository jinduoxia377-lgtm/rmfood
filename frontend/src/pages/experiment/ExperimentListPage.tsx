/**
 * 实验管理页面 — 专家级深度增强版
 * 功能：搜索高亮 + 关联配方显示 + 批量操作 + 列排序 + 高级筛选 + 负责人筛选 + 导出 + 统计概览
 */
import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Plus, Search, Filter, TestTubes, Trash2, X,
  ChevronUp, ChevronDown, ArrowUpDown, FlaskConical,
  Calendar, Download, Send,
  TestTube, CheckCircle2, AlertCircle, Ban, Clock,
  Sparkles,
} from 'lucide-react'
import { useExperiments } from '@/hooks/useQueries'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StatusBadge, EmptyState, Pagination, Skeleton } from '@/components/ui/Common'
import { Button, Input, StatCard, Badge, Card, CardContent } from '@/components/ui'
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
    ? <ChevronUp size={13} className="text-primary-600 dark:text-primary-400" />
    : <ChevronDown size={13} className="text-primary-600 dark:text-primary-400" />
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

  // 个人删除
  const deleteMut = useMutation({
    mutationFn: (id: number) => experimentApi.delete(id),
    onSuccess: () => {
      addToast({ type: 'success', message: '实验已删除' })
      qc.invalidateQueries({ queryKey: ['experiments'] })
    },
    onError: () => addToast({ type: 'error', message: '删除失败' }),
  })

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

  const handleDelete = (id: number) => {
    if (!confirm('确定要删除这个实验吗？此操作不可恢复。')) return
    deleteMut.mutate(id)
  }

  // 导出 CSV
  const handleExportCSV = () => {
    const rows = [
      ['编号', '标题', '状态', '关联配方', '更新时间'],
      ...sortedItems.map((exp) => [
        String(exp.id),
        exp.title,
        exp.status,
        exp.formulaId ? `配方#${exp.formulaId}` : '-',
        format(new Date(exp.updatedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN }),
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
    <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div className="max-w-7xl mx-auto space-y-4 px-4 sm:px-6 lg:px-8 py-6">

      {/* ── 页面横幅 ── */}
      <div className="surface-primary rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold leading-snug tracking-tight">
              实验管理
            </h2>
            <p className="mt-1 text-white/80 text-sm">
              实验计划 · 执行跟踪 · 结果分析 · 共 {total} 项实验
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              onClick={handleExportCSV}
              disabled={total === 0}
            >
              导出
            </Button>
            <Link to="/experiments/new">
              <Button
                icon={<Plus size={16} />}
                size="md"
                className="bg-white dark:bg-neutral-900 text-primary-600 hover:bg-neutral-100 dark:bg-neutral-800 shadow-sm"
              >
                新建实验
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── 统计概览 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <button type="button" onClick={() => handleFilter('planned')} className="w-full text-left" aria-label="计划中：{statusCounts.planned ?? 0} 个实验">
          <StatCard label="计划中" value={statusCounts.planned ?? 0} icon={Clock} variant="secondary" />
        </button>
        <button type="button" onClick={() => handleFilter('in_progress')} className="w-full text-left" aria-label="进行中：{statusCounts.in_progress ?? 0} 个实验">
          <StatCard label="进行中" value={statusCounts.in_progress ?? 0} icon={TestTube} variant="info" size="large" subtitle="活跃实验中" />
        </button>
        <button type="button" onClick={() => handleFilter('completed')} className="w-full text-left" aria-label="已完成：{statusCounts.completed ?? 0} 个实验">
          <StatCard label="已完成" value={statusCounts.completed ?? 0} icon={CheckCircle2} variant="success" />
        </button>
        <button type="button" onClick={() => handleFilter('failed')} className="w-full text-left" aria-label="已失败：{statusCounts.failed ?? 0} 个实验">
          <StatCard label="已失败" value={statusCounts.failed ?? 0} icon={AlertCircle} variant="warning" />
        </button>
        <button type="button" onClick={() => handleFilter('cancelled')} className="w-full text-left" aria-label="已取消：{statusCounts.cancelled ?? 0} 个实验">
          <StatCard label="已取消" value={statusCounts.cancelled ?? 0} icon={Ban} variant="secondary" />
        </button>
      </div>

      {/* ── 搜索和筛选 ── */}
      <Card className="overflow-hidden border-neutral-200 dark:border-neutral-700">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索实验标题或编号…"
              prefix={<Search size={14} className="text-neutral-400" />}
              className="flex-1 h-9 text-sm"
            />
            {(search || status || sortKey) && (
              <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={clearAllFilters}>
                清除
              </Button>
            )}
          </div>

          {/* 状态筛选 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={13} className="text-neutral-400 shrink-0" />
            <button
              onClick={() => handleFilter('')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                !status ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'text-neutral-500 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-800',
              )}
            >全部
              <span className="ml-1 text-neutral-400">({total})</span>
            </button>
            {STATUS_FILTERS.filter((f) => f.value).map((f) => (
              <button
                key={f.value}
                onClick={() => handleFilter(f.value)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                  status === f.value ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                                     : 'text-neutral-500 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-800',
                )}
              >
                {f.label}
                {statusCounts[f.value] !== undefined && (
                  <span className="ml-1 text-neutral-400">({statusCounts[f.value]})</span>
                )}
              </button>
            ))}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={cn(
                'ml-auto px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                showAdvanced ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                             : 'text-neutral-400 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-800',
              )}
            >
              排序
            </button>
          </div>

          {/* 高级排序面板 */}
          {showAdvanced && (
            <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <span className="text-xs text-neutral-500 shrink-0">排序依据：</span>
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
                      ? 'bg-primary-container text-primary-main'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700',
                  )}
                >
                  {opt.label}
                  {sortKey === opt.key && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 多选提示条 ── */}
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

      {/* ── 列表 ── */}
      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-5 w-1/3 mb-3" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sortedItems.length === 0 ? (
        <EmptyState
          icon={<div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center"><TestTubes size={24} className="text-primary-500 dark:text-primary-400" /></div>}
          title={search || status ? '没有匹配的实驗' : '暂无实验'}
          description={search || status ? '尝试调整搜索关键词或筛选条件' : '创建实验来验证您的配方方案'}
          action={
            <Link to="/experiments/new">
              <Button icon={<Plus size={14} />} size="sm" className="bg-primary-600 hover:bg-primary-700">
                {search || status ? '查看全部实验' : '新建实验'}
              </Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden border-neutral-200 dark:border-neutral-700">
          {/* 表头（桌面端） */}
          <div className="hidden sm:grid sm:grid-cols-[auto_1fr_90px_70px_90px_80px_44px] gap-3 px-5 py-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
            <div className="w-5" role="columnheader" />
            <button onClick={() => toggleSort('title')} className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-200" role="columnheader" aria-sort={sortKey === 'title' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
              标题 <SortIcon field="title" sortKey={sortKey} sortDir={sortDir} />
            </button>
            <div role="columnheader">编号</div>
            <button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-200" role="columnheader" aria-sort={sortKey === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
              状态 <SortIcon field="status" sortKey={sortKey} sortDir={sortDir} />
            </button>
            <div role="columnheader">关联配方</div>
            <button onClick={() => toggleSort('updated_at')} className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-200" role="columnheader" aria-sort={sortKey === 'updated_at' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
              更新时间 <SortIcon field="updated_at" sortKey={sortKey} sortDir={sortDir} />
            </button>
            <div role="columnheader" />
          </div>

          {/* 行列表 */}
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
            {sortedItems.map((exp) => {
              const isSelected = selectedIds.has(exp.id)
              const deleting = deleteMut.isPending && deleteMut.variables === exp.id
              return (
                <div
                  key={exp.id}
                  className={cn(
                    'group flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50 dark:bg-neutral-800/60 dark:hover:bg-neutral-800/30 transition-colors',
                    isSelected && 'bg-primary-50/50 dark:bg-primary-900/10',
                  )}
                >
                  {/* 勾选框 */}
                  <button
                    onClick={(e) => { e.preventDefault(); toggleSelect(exp.id) }}
                    className={cn(
                      'shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors mt-0.5',
                      isSelected
                        ? 'bg-primary-container border-primary-500 text-primary-main'
                        : 'border-neutral-300 dark:border-neutral-600 hover:border-primary-400',
                    )}
                  >
                    {isSelected && (
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* 主内容（标题列） */}
                  <Link
                    to={`/experiments/${exp.id}`}
                    className="flex-1 min-w-0"
                    onClick={(e) => { if (selectedIds.has(exp.id)) e.preventDefault() }}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <FlaskConical size={13} className="text-primary-500 shrink-0" />
                      <span className="text-sm font-medium text-neutral-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        <Highlight text={exp.title} keyword={search} />
                      </span>
                    </div>
                    {exp.description && (
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 line-clamp-1">
                        <Highlight text={exp.description} keyword={search} />
                      </p>
                    )}
                    {exp.objectives && exp.objectives.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {exp.objectives.slice(0, 2).map((obj, i) => (
                          <Badge key={i} variant="info" size="sm">{obj}</Badge>
                        ))}
                      </div>
                    )}
                  </Link>

                  {/* 编号 */}
                  <div className="hidden sm:block text-xs font-mono text-neutral-400 dark:text-neutral-500 shrink-0">
                    #{exp.id}
                  </div>

                  {/* 状态 */}
                  <div className="hidden md:block shrink-0">
                    <StatusBadge status={exp.status} />
                  </div>

                  {/* 关联配方 */}
                  <div className="hidden lg:block shrink-0">
                    {exp.formula_id ? (
                      <Link
                        to={`/formulas/${exp.formula_id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FlaskConical size={11} />
                        {exp.formulaId ? `#${exp.formulaId}` : '-'}
                      </Link>
                    ) : (
                      <span className="text-xs text-neutral-300 dark:text-neutral-600">-</span>
                    )}
                  </div>

                  {/* 更新时间 */}
                  <div className="hidden sm:flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500 shrink-0">
                    <Calendar size={11} />
                    {format(new Date(exp.updatedAt), 'MM-dd', { locale: zhCN })}
                  </div>

                  {/* 删除按钮 */}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(exp.id) }}
                    disabled={deleting}
                    className={cn(
                      'shrink-0 p-1.5 rounded-lg text-neutral-300 dark:text-neutral-600 hover:text-error-600 dark:hover:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors',
                      deleting && 'opacity-50 cursor-wait',
                    )}
                    aria-label="删除实验"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>

                  {/* 发送到 DOE（实验管理 → DOE 拟合入口） */}
                  <Link
                    to={`/doe?exp=${exp.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 p-1.5 rounded-lg text-neutral-300 dark:text-neutral-600 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    title="发送到 DOE 拟合"
                    aria-label="发送到 DOE"
                  >
                    <Send size={14} />
                  </Link>

                  {/* 一键验证（仅有关联配方时显示） */}
                  {exp.formula_id && (
                    <Link
                      to={`/experiments/${exp.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 p-1.5 rounded-lg text-neutral-300 dark:text-neutral-600 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                      title="查看验证详情"
                      aria-label="验证配方"
                    >
                      <Sparkles size={14} />
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
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
    </div>
  )
}

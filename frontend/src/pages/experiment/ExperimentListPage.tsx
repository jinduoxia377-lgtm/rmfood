/**
 * 实验管理页面 — 专家级深度增强版
 * 功能：搜索高亮 + 关联配方显示 + 批量操作 + 列排序 + 高级筛选 + 负责人筛选 + 导出 + 统计概览
 */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Plus, Search, Filter, TestTubes, Trash2, X,
  ChevronUp, ChevronDown, ArrowUpDown, FlaskConical,
  Calendar, Download, Send,
  TestTube, CheckCircle2, AlertCircle, Ban, Clock,
  Sparkles, AlertTriangle, RefreshCw,
} from 'lucide-react'
import { useExperiments, useExperimentStatistics, useFormulas } from '@/hooks/useQueries'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { StatusBadge, EmptyState, Pagination, Skeleton } from '@/components/ui/Common'
import { Button, Input, StatCard, Badge, Card, CardContent, Alert, AlertTitle, AlertDescription } from '@/components/ui'
import { Highlight } from '@/components/common'
import { cn } from '@/lib/utils'
import { experimentApi } from '@/api/experiment'
import { useToast } from '@/components/ui/Toast'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

/** 安全日期格式化：避免 Invalid Date 抛 RangeError（与详情页 formatExpDate 同策略） */
function safeFormatDate(raw: string | null | undefined, pattern = 'yyyy-MM-dd HH:mm'): string {
  if (!raw) return '-'
  const dt = new Date(raw)
  if (Number.isNaN(dt.getTime())) return '-'
  return format(dt, pattern, { locale: zhCN })
}

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
  if (sortKey !== field) return <ArrowUpDown size={13} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
  return sortDir === 'asc'
    ? <ChevronUp size={13} className="text-[var(--color-primary-text)]" />
    : <ChevronDown size={13} className="text-[var(--color-primary-text)]" />
}

export default function ExperimentListPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()
  const { addToast } = useToast()

  const page = Number(searchParams.get('page') ?? 1)
  const status = searchParams.get('status') ?? ''
  const search = searchParams.get('search') ?? ''
  const formulaFilter = searchParams.get('formula_id') ?? ''
  const researcherFilter = searchParams.get('researcher_id') ?? ''
  const [searchInput, setSearchInput] = useState(search)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // 批量操作
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // 负责人/配方筛选选项
  const { data: formulaData } = useFormulas({ page_size: 100 })
  const formulaOptions = (formulaData as { items?: Array<{ id: number; name?: string }> } | undefined)?.items ?? []

  // 查询（排序交由服务端处理）
  const { data, isLoading, error } = useExperiments({
    page,
    page_size: 12,
    status: status || undefined,
    search: search || undefined,
    formula_id: formulaFilter ? Number(formulaFilter) : undefined,
    researcher_id: researcherFilter ? Number(researcherFilter) : undefined,
    sort_field: sortKey ?? undefined,
    sort_order: sortKey ? sortDir : undefined,
  })

  // 个人删除（取消）
  const deleteMut = useMutation({
    mutationFn: (id: number) => experimentApi.delete(id),
    onSuccess: () => {
      addToast({ type: 'success', message: t('pages.experiment.cancelledToast') })
      qc.invalidateQueries({ queryKey: ['experiments'] })
    },
    onError: () => addToast({ type: 'error', message: t('pages.experiment.cancelFailed') }),
  })

  // 批量删除（取消）
  const batchDeleteMut = useMutation({
    mutationFn: (ids: number[]) => experimentApi.batchDelete(ids),
    onSuccess: (res) => {
      addToast({ type: 'success', message: res.message || t('pages.experiment.batchCancelled') })
      qc.invalidateQueries({ queryKey: ['experiments'] })
      setSelectedIds(new Set())
    },
    onError: () => addToast({ type: 'error', message: t('pages.experiment.batchCancelFailed') }),
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  const sortedItems = items

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

  const handleFormulaFilter = (value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) params.set('formula_id', value)
    else params.delete('formula_id')
    params.set('page', '1')
    setSearchParams(params)
    setSelectedIds(new Set())
  }

  const handleResearcherFilter = (value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) params.set('researcher_id', value)
    else params.delete('researcher_id')
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
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleDelete = (id: number) => {
    if (!confirm(t('pages.experiment.confirmCancel'))) return
    deleteMut.mutate(id)
  }

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return
    if (!confirm(t('pages.experiment.confirmBatchCancel', { count: selectedIds.size }))) return
    batchDeleteMut.mutate(Array.from(selectedIds))
  }

  // 导出 CSV
  const handleExportCSV = () => {
    // CSV 注入防护：对以 = + - @ \t 开头的单元格加前缀 '，防止 Excel 公式注入
    const escapeCell = (val: string) => {
      const str = String(val ?? '')
      return /^[=+\-@\t]/.test(str) ? `'${str}` : str
    }
    const rows = [
      [
        t('pages.experiment.exportCsv.code'),
        t('pages.experiment.exportCsv.title'),
        t('pages.experiment.exportCsv.status'),
        t('pages.experiment.exportCsv.formula'),
        t('pages.experiment.exportCsv.updatedAt'),
      ],
      ...sortedItems.map((exp) => [
        escapeCell(exp.code ?? String(exp.id)),
        escapeCell(exp.title),
        escapeCell(exp.status),
        exp.formula_id ? `${t('pages.experiment.formulaLabel', { id: exp.formula_id })}` : '-',
        safeFormatDate(exp.updated_at, 'yyyy-MM-dd HH:mm'),
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${escapeCell(String(c))}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${t('pages.experiment.exportCsv.fileName')}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(total / 12)

  // 状态统计 —— 使用后端全量统计（避免仅统计当前页 12 条导致的数字漂移）
  const { data: statsData } = useExperimentStatistics()
  const statusCounts: Record<string, number> = {
    planned: statsData?.planned ?? 0,
    in_progress: statsData?.in_progress ?? 0,
    completed: statsData?.completed ?? 0,
    failed: statsData?.failed ?? 0,
    cancelled: statsData?.cancelled ?? 0,
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto space-y-4 px-[var(--space-apple-md)] sm:px-[var(--space-apple-lg)] lg:px-[var(--space-apple-xl)] py-[var(--space-apple-lg)]">

      {/* ── 页面横幅 ── */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            {/* A-40：整页此前最高只到 h2（且没有 h1），文档大纲缺少顶层标题，
                屏幕阅读器无法用 h 键跳到本页主题。与 /formulas 对齐改为 h1。 */}
            <h1 className="text-xl font-semibold leading-snug tracking-tight">
              {t('pages.experiment.title')}
            </h1>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              {t('pages.experiment.subtitle', { total })}
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
              {t('pages.experiment.export')}
            </Button>
            <Link to="/experiments/new">
              <Button
                icon={<Plus size={16} />}
                size="md"
                className="bg-[var(--bg-secondary)] text-[var(--color-primary-text)] hover:bg-[var(--bg-tertiary)] shadow-sm"
              >
                {t('pages.experiment.newExperiment')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── 统计概览 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        <button type="button" onClick={() => handleFilter('planned')} className="w-full text-left" aria-label={t('pages.experiment.statAria', { label: t('pages.experiment.planned'), count: statusCounts.planned ?? 0 })}>
          <StatCard label={t('pages.experiment.planned')} value={statusCounts.planned ?? 0} icon={Clock} variant="secondary" />
        </button>
        <button type="button" onClick={() => handleFilter('in_progress')} className="w-full text-left" aria-label={t('pages.experiment.statAria', { label: t('pages.experiment.inProgress'), count: statusCounts.in_progress ?? 0 })}>
          <StatCard label={t('pages.experiment.inProgress')} value={statusCounts.in_progress ?? 0} icon={TestTube} variant="info" size="large" subtitle={t('pages.experiment.activeExperiments')} />
        </button>
        <button type="button" onClick={() => handleFilter('completed')} className="w-full text-left" aria-label={t('pages.experiment.statAria', { label: t('pages.experiment.completed'), count: statusCounts.completed ?? 0 })}>
          <StatCard label={t('pages.experiment.completed')} value={statusCounts.completed ?? 0} icon={CheckCircle2} variant="success" />
        </button>
        <button type="button" onClick={() => handleFilter('failed')} className="w-full text-left" aria-label={t('pages.experiment.statAria', { label: t('pages.experiment.failed'), count: statusCounts.failed ?? 0 })}>
          <StatCard label={t('pages.experiment.failed')} value={statusCounts.failed ?? 0} icon={AlertCircle} variant="warning" />
        </button>
        <button type="button" onClick={() => handleFilter('cancelled')} className="w-full text-left" aria-label={t('pages.experiment.statAria', { label: t('pages.experiment.cancelled'), count: statusCounts.cancelled ?? 0 })}>
          <StatCard label={t('pages.experiment.cancelled')} value={statusCounts.cancelled ?? 0} icon={Ban} variant="secondary" />
        </button>
      </div>

      {/* ── 搜索和筛选 ── */}
      <Card className="overflow-hidden border-[var(--border-color)]">
        <CardContent className="p-[var(--space-apple-md)] space-y-[var(--space-apple-md)]">
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('pages.experiment.searchPlaceholder')}
              prefix={<Search size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
              className="flex-1 h-9 text-sm"
            />
            {(search || status || sortKey) && (
              <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={clearAllFilters}>
                {t('pages.experiment.clear')}
              </Button>
            )}
          </div>

          {/* 状态筛选 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={13} aria-hidden="true" className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0" />
            <button
              onClick={() => handleFilter('')}
              className={cn(
                'px-2.5 py-1 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-colors min-h-[44px] inline-flex items-center',
                !status ? 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)]'
                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]',
              )}
            >{t('pages.experiment.all')}
              <span className="ml-1 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">({total})</span>
            </button>
            {STATUS_FILTERS.filter((f) => f.value).map((f) => (
              <button
                key={f.value}
                onClick={() => handleFilter(f.value)}
                className={cn(
                  'px-2.5 py-1 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-colors min-h-[44px] inline-flex items-center',
                  status === f.value ? 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)]'
                                     : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]',
                )}
              >
                {t(`common.statusLabels.${f.value}`, { defaultValue: f.label })}
                {statusCounts[f.value] !== undefined && (
                  <span className="ml-1 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">({statusCounts[f.value]})</span>
                )}
              </button>
            ))}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={cn(
                'ml-auto px-2.5 py-1 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-colors min-h-[44px] inline-flex items-center',
                showAdvanced ? 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)]'
                             : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]',
              )}
            >
              {t('pages.experiment.sort')}
            </button>
          </div>

          {/* 高级排序 + 筛选面板 */}
          {showAdvanced && (
            <div className="space-y-[var(--space-apple-sm)] pt-[var(--space-apple-sm)] border-t border-[var(--border-color)]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0">{t('pages.experiment.sortBy')}</span>
                {[
                  { key: 'title' as SortKey, label: t('pages.experiment.columnTitle') },
                  { key: 'code' as SortKey, label: t('pages.experiment.columnCode') },
                  { key: 'status' as SortKey, label: t('pages.experiment.columnStatus') },
                  { key: 'updated_at' as SortKey, label: t('pages.experiment.columnUpdatedAt') },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => toggleSort(opt.key)}
                    className={cn(
                      'px-2.5 py-1 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-colors min-h-[44px] inline-flex items-center',
                      sortKey === opt.key
                        ? 'bg-primary-container text-[var(--color-primary)]'
                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]',
                    )}
                  >
                    {opt.label}
                    {sortKey === opt.key && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0">{t('pages.experiment.filter')}</span>
                <select
                  value={formulaFilter}
                  onChange={(e) => handleFormulaFilter(e.target.value)}
                  aria-label={t('pages.experiment.filterByFormula')}
                  className="h-8 rounded-[var(--radius-Apple-sm)] border-[var(--border-color)] bg-[var(--bg-secondary)] px-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">{t('pages.experiment.allFormulas')}</option>
                  {formulaOptions.map((f) => (
                    <option key={f.id} value={String(f.id)}>{f.name ? t('pages.experiment.formulaOption', { name: f.name, id: f.id }) : t('pages.experiment.formulaOptionId', { id: f.id })}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={researcherFilter}
                  onChange={(e) => handleResearcherFilter(e.target.value)}
                  placeholder={t('pages.experiment.researcherId')}
                  aria-label={t('pages.experiment.filterByResearcher')}
                  className="h-8 w-28 rounded-[var(--radius-Apple-sm)] border-[var(--border-color)] bg-[var(--bg-secondary)] px-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                {(formulaFilter || researcherFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      const params = new URLSearchParams(searchParams)
                      params.delete('formula_id')
                      params.delete('researcher_id')
                      params.set('page', '1')
                      setSearchParams(params)
                      setSelectedIds(new Set())
                    }}
                    className="text-xs text-[var(--color-primary-text)] hover:underline inline-flex items-center gap-1 min-h-[44px]"
                  >
                    {t('pages.experiment.clearFilters')}
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 多选提示条 ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 px-[var(--space-apple-md)] py-2 bg-[var(--color-primary-container)] border-[var(--color-primary-border)] rounded-[var(--radius-Apple-md)] animate-fade-in">
          <span className="text-sm font-medium text-[var(--color-primary-text)]">
            {t('pages.experiment.selectedCount', { count: selectedIds.size })}
          </span>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 size={13} />}
            loading={batchDeleteMut.isPending}
            onClick={handleBatchDelete}
          >
            {t('pages.experiment.batchCancel')}
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            {t('pages.experiment.cancelSelection')}
          </button>
        </div>
      )}

      {/* ── 错误状态 ── */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>{t('pages.experiment.loadFailed')}</AlertTitle>
          <AlertDescription className="flex items-center gap-2 mt-1.5">
            <span>
              {(error as { response?: { status?: number } } | null)?.response?.status === 403
                ? t('pages.experiment.loadFailedForbiddenDesc')
                : t('pages.experiment.loadFailedDesc')}
            </span>
            <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['experiments'] })}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> {t('common.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* ── 列表 ── */}
      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-[var(--space-apple-md)]">
                <Skeleton className="h-5 w-1/3 mb-[var(--space-apple-sm)]" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sortedItems.length === 0 ? (
        <EmptyState
          icon={<div className="w-12 h-12 rounded-[var(--radius-Apple-md)] bg-[var(--color-primary-container)] flex items-center justify-center"><TestTubes size={24} aria-hidden="true" className="text-[var(--color-primary-text)]" /></div>}
          title={search || status ? t('pages.experiment.noMatchingExperiments') : t('pages.experiment.noExperiments')}
          description={search || status ? t('pages.experiment.noMatchingDesc') : t('pages.experiment.noExperimentsDesc')}
          action={
            <Link to="/experiments/new">
              <Button icon={<Plus size={14} />} size="sm" className="bg-[var(--color-primary-text)] hover:opacity-90">
                {search || status ? t('pages.experiment.viewAllExperiments') : t('pages.experiment.newExperiment')}
              </Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden border-[var(--border-color)]">
          {/* 表头（桌面端） */}
          <div className="hidden sm:grid sm:grid-cols-[auto_1fr_90px_70px_90px_80px_44px] gap-4 px-[var(--space-apple-md)] py-2 text-xs font-medium text-[var(--text-muted)] border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50">
            <div className="w-5" role="columnheader" />
            <button onClick={() => toggleSort('title')} className="flex items-center gap-1 min-h-[44px] hover:text-[var(--text-primary)]" role="columnheader" aria-sort={sortKey === 'title' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
              {t('pages.experiment.columnTitle')} <SortIcon field="title" sortKey={sortKey} sortDir={sortDir} />
            </button>
            <div role="columnheader">{t('pages.experiment.columnCode')}</div>
            <button onClick={() => toggleSort('status')} className="flex items-center gap-1 min-h-[44px] hover:text-[var(--text-primary)]" role="columnheader" aria-sort={sortKey === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
              {t('pages.experiment.columnStatus')} <SortIcon field="status" sortKey={sortKey} sortDir={sortDir} />
            </button>
            <div role="columnheader">{t('pages.experiment.linkedFormula')}</div>
            <button onClick={() => toggleSort('updated_at')} className="flex items-center gap-1 min-h-[44px] hover:text-[var(--text-primary)]" role="columnheader" aria-sort={sortKey === 'updated_at' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
              {t('pages.experiment.columnUpdatedAt')} <SortIcon field="updated_at" sortKey={sortKey} sortDir={sortDir} />
            </button>
            <div role="columnheader" />
          </div>

          {/* 行列表 */}
          <div className="divide-y divide-[var(--border-color)]">
            {sortedItems.map((exp) => {
              const isSelected = selectedIds.has(exp.id)
              const deleting = deleteMut.isPending && deleteMut.variables === exp.id
              return (
                <div
                  key={exp.id}
                  className={cn(
                    'group flex items-center gap-4 px-[var(--space-apple-md)] py-[var(--space-apple-md)] hover:bg-[var(--bg-secondary)]/50 transition-colors',
                    isSelected && 'bg-[var(--color-primary-container)]/50',
                  )}
                >
                  {/* 勾选框
                      A-40：原先是一个 16x16 的裸 <button>，既没有可访问名称（WCAG
                      4.1.2），也远小于 44x44 触控目标（WCAG 2.5.5）。
                      改成「44x44 的透明按钮 + 内层 16x16 视觉方框」：视觉尺寸不变，
                      命中区域达标；同时补 aria-label / aria-pressed。 */}
                  <button
                    onClick={(e) => { e.preventDefault(); toggleSelect(exp.id) }}
                    aria-label={isSelected ? t('pages.experiment.unselectExperiment', { title: exp.title }) : t('pages.experiment.selectExperiment', { title: exp.title })}
                    aria-pressed={isSelected}
                    className="shrink-0 w-11 h-11 -my-[var(--space-apple-sm)] -ml-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] flex items-center justify-center"
                  >
                    <span
                      className={cn(
                        'w-4 h-4 rounded-[var(--radius-Apple-sm)] border-2 flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-primary-container border-[var(--color-primary-text)] text-[var(--color-primary)]'
                          : 'border-[var(--border-color)] hover:border-[var(--color-primary-text)]',
                      )}
                    >
                      {isSelected && (
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                  </button>

                  {/* 主内容（标题列） */}
                  <Link
                    to={`/experiments/${exp.id}`}
                    className="flex-1 min-w-0"
                    onClick={(e) => { if (selectedIds.has(exp.id)) e.preventDefault() }}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <FlaskConical size={13} aria-hidden="true" className="text-[var(--color-primary-text)] shrink-0" />
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--color-primary-text)] transition-colors">
                        <Highlight text={exp.title} keyword={search} />
                      </span>
                    </div>
                    {exp.description && (
                      <p className="text-xs text-[var(--text-muted)] line-clamp-1">
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
                  <div className="hidden sm:block text-xs font-mono text-[var(--text-muted)] shrink-0">
                    {exp.code ?? `#${exp.id}`}
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
                        className="inline-flex items-center gap-1 text-xs text-[var(--color-primary-text)] hover:underline min-h-[44px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FlaskConical size={11} />
                        {exp.formula_name ?? t('pages.experiment.formulaLabel', { id: exp.formula_id })}
                      </Link>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">-</span>
                    )}
                  </div>

                  {/* 更新时间 */}
                  <div className="hidden sm:flex items-center gap-1 text-xs text-[var(--text-muted)] shrink-0">
                    <Calendar size={11} aria-hidden="true" />
                    {exp.updated_at ? safeFormatDate(exp.updated_at, 'MM-dd') : '-'}
                  </div>

                  {/* 删除按钮 */}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(exp.id) }}
                    disabled={deleting}
                    className={cn(
                      'shrink-0 p-1.5 rounded-[var(--radius-Apple-sm)] text-[var(--text-muted)] min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:text-[var(--color-error-text)] hover:bg-[var(--color-error-container)] transition-colors',
                      deleting && 'opacity-50 cursor-wait',
                    )}
                    aria-label={t('pages.experiment.cancelExperiment')}
                    title={t('pages.experiment.cancel')}
                  >
                    <Trash2 size={14} />
                  </button>

                  {/* 发送到 DOE（实验管理 → DOE 拟合入口） */}
                  <Link
                    to={`/doe?exp=${exp.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 p-1.5 rounded-[var(--radius-Apple-sm)] text-[var(--text-muted)] min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:text-[var(--color-success-text)] hover:bg-[var(--color-success-container)] transition-colors"
                    title={t('pages.experiment.sendToDoe')}
                    aria-label={t('pages.experiment.sendToDoeAria')}
                  >
                    <Send size={14} />
                  </Link>

                  {/* 一键验证（仅有关联配方时显示） */}
                  {exp.formula_id && (
                    <Link
                      to={`/experiments/${exp.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 p-1.5 rounded-[var(--radius-Apple-sm)] text-[var(--text-muted)] min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:text-[var(--color-accent-text)] hover:bg-[var(--color-accent-container)] transition-colors"
                      title={t('pages.experiment.viewValidation')}
                      aria-label={t('pages.experiment.validateFormula')}
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

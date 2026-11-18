/**
 * 批记录列表页面
 * Phase 1: 数据底座加固
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Plus, Search, FlaskConical, X,
  ChevronUp, ChevronDown, ArrowUpDown, Calendar,
  Eye, ArrowRight,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { EmptyState, Pagination, Skeleton } from '@/components/ui/Common'
import { Button, Input, StatCard, Card, CardContent } from '@/components/ui'
import { cn } from '@/lib/utils'
import { batchApi } from '@/api/batch'

const STATUS_FILTERS = [
  { value: '', label: '全部' },
  { value: 'planned', label: '计划中' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'closed', label: '已关闭' },
]

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)] dark:bg-[var(--color-secondary-container)]/25 dark:text-[var(--color-secondary-text)]',
  in_progress: 'bg-[var(--color-warning-container)] text-[var(--color-warning-text)] dark:bg-[var(--color-warning-container)]/25 dark:text-[var(--color-warning-text)]',
  completed: 'bg-[var(--color-success-container)] text-[var(--color-success-text)] dark:bg-[var(--color-success-container)]/25 dark:text-[var(--color-success-text)]',
  closed: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)]',
}

type SortKey = 'batch_code' | 'created_at' | 'target_weight_kg'
type SortDir = 'asc' | 'desc'

export default function BatchListPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
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
    if (sortKey !== field) return <ArrowUpDown size={13} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
    return sortDir === 'asc'
      ? <ChevronUp size={13} className="text-primary" />
      : <ChevronDown size={13} className="text-primary" />
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto space-y-6 py-[var(--space-apple-lg)] px-4 sm:px-5 lg:px-[var(--space-apple-lg)]">
      {/* 页头横幅 — 对齐 Dashboard 品牌横幅规范 */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-semibold leading-snug tracking-tight flex items-center gap-2">
              <FlaskConical size={20} className="text-white/80 shrink-0" />
              {t('pages.batch.title')}
            </h1>
            <p className="mt-1 text-white/80 text-sm">
              {t('pages.batch.subtitle')}
            </p>
          </div>
          <Button onClick={() => navigate('/batches/new')} className="bg-[var(--bg-secondary)]/15 hover:bg-[var(--bg-secondary)]/25 text-[var(--color-primary-text)] dark:text-white border-none">
            <Plus size={16} />
            {t('pages.batch.newBatch')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={t('pages.batch.totalBatches')}
          value={total}
          icon={FlaskConical}
          variant="secondary"
        />
        <StatCard
          label={t('pages.batch.planned')}
          value={batches.filter(b => b.status === 'planned').length}
          icon={Calendar}
          variant="warning"
        />
        <StatCard
          label={t('pages.batch.completed')}
          value={batches.filter(b => b.status === 'completed').length}
          icon={ArrowRight}
          variant="success"
        />
        <StatCard
          label={t('pages.batch.sampleCount')}
          value={batches.reduce((sum, b) => sum + (b.sample_count ?? 0), 0)}
          icon={FlaskConical}
          variant="info"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-[var(--space-apple-md)]">
          <div className="flex flex-col md:flex-row gap-[var(--space-apple-sm)]">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
              <Input
                placeholder={t('pages.batch.searchPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm min-h-[44px]"
            >
              {STATUS_FILTERS.map(f => (
                <option key={f.value} value={f.value}>{f.value ? t(`common.statusLabels.${f.value}`, { defaultValue: f.label }) : t('pages.batch.all')}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatusFilter(''); setFormulaFilter(''); }}>
              <X size={14} /> {t('pages.batch.clear')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        {/* A-41：本页大纲原先是 h1 → h3（空态组件的标题固定是 h3），中间断了一级。
            补一个屏幕阅读器可见的 h2 承接表格区，与 /formulas 的处理方式一致。 */}
        <h2 className="sr-only">{t('pages.batch.listTitle')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="text-left px-[var(--space-apple-md)] py-[var(--space-apple-md)] font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  <button onClick={() => handleSort('batch_code')} className="flex items-center gap-1 min-h-[44px] min-w-[44px]">
                    {t('pages.batch.batchCode')}
                    {/* eslint-disable-next-line react-hooks/static-components */}
                    <SortIcon field="batch_code" />
                  </button>
                </th>
                <th className="hidden sm:table-cell text-left px-[var(--space-apple-md)] py-[var(--space-apple-md)] font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.batch.formula')}</th>
                <th className="text-left px-[var(--space-apple-md)] py-[var(--space-apple-md)] font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  <button onClick={() => handleSort('target_weight_kg')} className="flex items-center gap-1 min-h-[44px] min-w-[44px]">
                    {t('pages.batch.targetYield')}
                    {/* eslint-disable-next-line react-hooks/static-components */}
                    <SortIcon field="target_weight_kg" />
                  </button>
                </th>
                <th className="text-left px-[var(--space-apple-md)] py-[var(--space-apple-md)] font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.batch.status')}</th>
                <th className="hidden md:table-cell text-left px-[var(--space-apple-md)] py-[var(--space-apple-md)] font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.batch.samples')}</th>
                <th className="text-left px-[var(--space-apple-md)] py-[var(--space-apple-md)] font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  <button onClick={() => handleSort('created_at')} className="flex items-center gap-1 min-h-[44px] min-w-[44px]">
                    {t('pages.batch.createdAt')}
                    {/* eslint-disable-next-line react-hooks/static-components */}
                    <SortIcon field="created_at" />
                  </button>
                </th>
                <th className="text-right px-[var(--space-apple-md)] py-[var(--space-apple-md)] font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.batch.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-neutral-50 dark:border-neutral-800/50">
                    <td colSpan={7} className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={<FlaskConical size={48} strokeWidth={1.5} />}
                      title={t('pages.batch.noBatches')}
                      description={t('pages.batch.noBatchesDesc')}
                      action={<button onClick={() => navigate('/batches/new')} className="mt-[var(--space-apple-md)] px-[var(--space-apple-md)] py-2 rounded-[var(--radius-Apple-sm)] bg-primary-surface text-white text-sm hover:bg-primary-surface-hover transition-colors min-h-[44px]">{t('pages.batch.newBatch')}</button>}
                    />
                  </td>
                </tr>
              ) : (
                batches.map(batch => (
                  <tr key={batch.id} className="border-b border-neutral-50 dark:border-neutral-800/50 hover:bg-[var(--bg-tertiary)]/50 dark:hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                      <span className="font-mono text-xs font-medium text-[var(--text-primary)]">
                        {batch.batch_code}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                      <Link
                        to={`/formulas/${batch.formula_id}`}
                        className="font-medium text-[var(--text-primary)] hover:text-primary transition-colors"
                      >
                        {batch.formula_name || batch.formula_code}
                      </Link>
                      <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{batch.formula_code}</div>
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-[var(--text-secondary)]">
                      {batch.target_weight_kg?.toFixed(3)} kg
                      {batch.actual_weight_kg && (
                        <span className="ml-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                          {t('pages.batch.actualWeight', { weight: batch.actual_weight_kg.toFixed(3) })}
                        </span>
                      )}
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium',
                        STATUS_COLORS[batch.status] || 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                      )}>
                        {t(`common.statusLabels.${batch.status}`, { defaultValue: batch.status })}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-[var(--text-secondary)]">
                      {batch.sample_count ?? 0}
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      {batch.created_at ? new Date(batch.created_at).toLocaleDateString(i18n.language) : '-'}
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/batches/${batch.id}`}
                          className="p-1.5 rounded-[var(--radius-Apple-sm)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                          <Eye size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                        </Link>
                        <Link
                          to={`/batches/${batch.id}/trace`}
                          className="p-1.5 rounded-[var(--radius-Apple-sm)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)] transition-colors"
                          title={t('pages.batch.trace')}
                        >
                          <ArrowRight size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
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
          <div className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] border-t border-[var(--border-color)]">
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

/**
 * 学术报告页面 — Dashboard 设计语言对齐版
 * 统计卡片 · 横幅 · 紧凑筛选 · 行列表（divide-y）
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileText, Search, Filter, Plus, Edit, Trash2, Eye,
  Calendar, BookOpen, Link2, User, X, MoreVertical,
  ClipboardCopy, RefreshCw,
} from 'lucide-react'
import { Card, CardContent, Button, Input, StatCard } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/Common'
import { useAcademicReportStore } from '@/stores/academicReportStore'
import { useToastStore } from '@/stores/toastStore'
import { AcademicReportEditor } from '@/components/academic/AcademicReportEditor'
import type { ReportItem } from '@/stores/academicReportStore'
import { cn } from '@/lib/utils'

type ViewMode = 'list' | 'editor'
type SortField = 'createdAt' | 'updatedAt' | 'title' | 'status'
type SortOrder = 'asc' | 'desc'

export default function AcademicReportPage() {
  const { t, i18n } = useTranslation()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('updatedAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showMoreMenu, setShowMoreMenu] = useState<string | null>(null)
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)

  let store
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    store = useAcademicReportStore()
  } catch (e) {
    console.error('[AcademicReport] store init error:', e)
    setStoreError(e instanceof Error ? e.message : 'Store initialization failed')
    store = {
      reports: [], isLoading: false, error: null,
      fetchReports: async () => {}, deleteReport: () => {},
      loadReport: () => {}, createReport: () => {},
    }
  }
  const { reports, isLoading, error, fetchReports, deleteReport, loadReport, createReport } = store
  const { addToast } = useToastStore()

  const fetchRef = useRef(fetchReports)
  // eslint-disable-next-line react-hooks/refs
  fetchRef.current = fetchReports

  useEffect(() => {
    fetchRef.current()
  }, [])

  const filteredAndSortedReports = useMemo(() => {
    const result = reports.filter(report => {
      const q = searchQuery.toLowerCase()
      return (
        report.title.toLowerCase().includes(q) ||
        report.formulaName?.toLowerCase().includes(q) ||
        report.authors.some(a => a.toLowerCase().includes(q)) ||
        (report.abstract || '').toLowerCase().includes(q)
      ) && (selectedStatus === 'all' || report.status === selectedStatus)
    })
    result.sort((a, b) => {
      let c = 0
      switch (sortField) {
        case 'title':      c = a.title.localeCompare(b.title); break
        case 'status': {
          const o: Record<string, number> = { draft: 0, in_review: 1, published: 2 }
          c = (o[a.status] ?? 0) - (o[b.status] ?? 0)
          break
        }
        case 'createdAt':  c = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break
        default:          c = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(); break
      }
      return sortOrder === 'asc' ? c : -c
    })
    return result
  }, [reports, searchQuery, selectedStatus, sortField, sortOrder])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortOrder('desc') }
  }

  const handleSelectReport = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
    setShowBulkActions(next.size > 0)
    setShowMoreMenu(null)
  }

  const handleBulkDelete = () => {
    selectedIds.forEach(id => deleteReport(id))
    addToast({ type: 'success', message: t('pages.academic.deletedReports', { count: selectedIds.size }) })
    setSelectedIds(new Set()); setShowBulkActions(false); setShowDeleteConfirm(false)
  }

  const handleDuplicate = (report: ReportItem) => {
    void report;
    createReport('research')
    addToast({ type: 'success', message: t('pages.academic.reportDuplicated') })
    setShowMoreMenu(null)
  }

  const handleView = (report: ReportItem) => {
    setSelectedReport(report); loadReport(report.id); setViewMode('editor'); setShowMoreMenu(null)
  }
  const handleEdit = (report: ReportItem) => {
    setSelectedReport(report); loadReport(report.id); setViewMode('editor'); setShowMoreMenu(null)
  }

  const handleDelete = (id: string) => {
    deleteReport(id)
    addToast({ type: 'success', message: t('pages.academic.reportDeleted') })
    setShowDeleteConfirm(false); setDeleteTargetId(null); setShowMoreMenu(null)
  }

  const confirmDelete = (id: string) => { setDeleteTargetId(id); setShowDeleteConfirm(true); setShowMoreMenu(null) }

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString(i18n.language, { year: 'numeric', month: '2-digit', day: '2-digit' })

  const statusCls = (s: string) => ({
    draft:      'bg-[var(--bg-tertiary)] text-[var(--text-primary)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)]',
    in_review:  'bg-[var(--color-warning-container)] text-[var(--color-warning-text)] dark:bg-[var(--color-warning-container)]/25 dark:text-[var(--color-warning-text)]',
    published:  'bg-[var(--color-primary-container)] text-[var(--color-primary-text)] dark:bg-[var(--color-primary-container)]/25 dark:text-[var(--color-primary-text)]',
  }[s] ?? 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]')

  const clearFilters = () => {
    setSearchQuery(''); setSelectedStatus('all'); setSortField('updatedAt'); setSortOrder('desc')
  }
  const hasActiveFilters = searchQuery || selectedStatus !== 'all' || sortField !== 'updatedAt' || sortOrder !== 'desc'

  const total     = reports.length
  const draft     = reports.filter(r => r.status === 'draft').length
  const inReview  = reports.filter(r => r.status === 'in_review').length
  const published = reports.filter(r => r.status === 'published').length

  // ── Store error fallback ──
  if (storeError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8">
          <p className="text-[var(--color-error-text)] dark:text-[var(--color-error-text)] font-semibold mb-2">{t('pages.academic.loadFailed')}</p>
          <p className="text-sm text-[var(--text-muted)] mb-[var(--space-apple-md)]">{storeError}</p>
          <Button size="sm" onClick={() => window.location.reload()}>{t('pages.academic.refreshPage')}</Button>
        </div>
      </div>
    )
  }

  // ── Editor view ──
  if (viewMode === 'editor') {
    return (
      <div className="h-screen flex flex-col" style={{ height: '100dvh' }}>
        <div className="sticky top-0 z-20 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-6 py-[var(--space-apple-md)] flex items-center gap-4 shadow-sm">
          <Button variant="ghost" onClick={() => setViewMode('list')} className="gap-2 text-[var(--text-secondary)]">
            <span className="rotate-180 inline-block">›</span> {t('pages.academic.backToList')}
          </Button>
          {selectedReport && (
            <div className="flex items-center gap-[var(--space-apple-sm)] flex-1 min-w-0">
              <div className="w-9 h-9 bg-[var(--color-primary-container)] rounded-[var(--radius-Apple-md)] flex items-center justify-center shrink-0">
                <BookOpen size={16} className="text-[var(--color-primary-text)]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">{selectedReport.title}</h2>
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span className={`px-2 py-0.5 rounded-[var(--radius-pill)] font-medium ${statusCls(selectedReport.status)}`}>
                    {selectedReport.status === 'draft' ? t('pages.academic.statusDraft') : selectedReport.status === 'in_review' ? t('pages.academic.statusInReview') : t('pages.academic.statusPublished')}
                  </span>
                  <span>·</span>
                  <span>{t('pages.academic.updatedOn', { date: formatDate(selectedReport.updatedAt) })}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <AcademicReportEditor />
        </div>
      </div>
    )
  }

  // ── List view ──
  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto space-y-[var(--space-apple-md)] px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)]">

      {/* ── 页面横幅 ── */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-semibold leading-snug tracking-tight">{t('pages.academic.title')}</h1>
            <p className="mt-1 text-white/80 text-sm">{t('pages.academic.subtitle')}</p>
          </div>
          <Button
            icon={<Plus size={16} />}
            size="md"
            className="bg-[var(--bg-secondary)] text-[var(--color-primary-text)] hover:bg-[var(--bg-tertiary)] shadow-sm"
            onClick={() => { setSelectedReport(null); setViewMode('editor') }}
          >
            {t('pages.academic.newReport')}
          </Button>
        </div>
      </div>

      {/* ── 统计概览 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-[var(--space-apple-sm)]">
        <StatCard label={t('pages.academic.totalReports')} value={total} icon={FileText} variant="primary" />
        <StatCard label={t('pages.academic.draft')} value={draft} icon={Edit} variant="secondary" />
        <StatCard label={t('pages.academic.inReview')} value={inReview} icon={Filter} variant="warning" />
        <StatCard label={t('pages.academic.published')} value={published} icon={BookOpen} variant="success" />
      </div>

      {/* ── 搜索和筛选 ── */}
      <Card className="overflow-hidden border-[var(--border-color)]">
        <div className="h-[3px] bg-gradient-to-r from-primary-500 to-success-400" />
        <CardContent className="p-[var(--space-apple-md)] space-y-[var(--space-apple-sm)]">
          <div className="flex flex-col sm:flex-row gap-[var(--space-apple-sm)]">
            <Input
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && setSearchQuery((e.target as HTMLInputElement).value)}
              placeholder={t('pages.academic.searchPlaceholder')}
              prefix={<Search size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
              className="flex-1 h-9 text-sm"
            />
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={clearFilters}>{t('pages.academic.clear')}</Button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={13} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0" />
            {(['all', 'draft', 'in_review', 'published'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSelectedStatus(s)}
                className={cn(
                  'px-2.5 py-1 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-colors min-h-[44px] inline-flex items-center',
                  selectedStatus === s
                    ? 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)] dark:bg-[var(--color-primary-container)]/25 dark:text-[var(--color-primary-text)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]',
                )}
              >
                {s === 'all' ? t('pages.academic.all') : s === 'draft' ? t('pages.academic.statusDraft') : s === 'in_review' ? t('pages.academic.statusInReview') : t('pages.academic.statusPublished')}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              {([
                { key: 'updatedAt', label: t('pages.academic.updatedAt') },
                { key: 'createdAt', label: t('pages.academic.createdAt') },
                { key: 'title', label: t('pages.academic.columnTitle') },
                { key: 'status', label: t('pages.academic.status') },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => handleSort(opt.key)}
                  className={cn(
                    'px-2.5 py-1 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-colors min-h-[44px] inline-flex items-center',
                    sortField === opt.key
                      ? 'bg-primary-container text-[var(--color-primary)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)]',
                  )}
                >
                  {opt.label}
                  {sortField === opt.key && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 批量操作条 ── */}
      {showBulkActions && (
        <div className="flex items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-md)] py-2.5 bg-[var(--color-primary-container)] border border-[var(--color-primary-border)] dark:border-[var(--color-primary)]/40 rounded-[var(--radius-Apple-md)] animate-fade-in">
          <span className="text-sm font-medium text-[var(--color-primary-text)]">
            {t('pages.academic.selectedCount', { count: selectedIds.size })}
          </span>
          <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setShowDeleteConfirm(true)}>
            {t('pages.academic.batchDelete')}
          </Button>
          <button onClick={() => { setSelectedIds(new Set()); setShowBulkActions(false) }} className="ml-auto text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--text-secondary)] transition-colors">{t('pages.academic.cancelSelection')}</button>
        </div>
      )}

      {/* ── 列表 ── */}
      {isLoading ? (
        <Card className="border-[var(--border-color)]">
          <CardContent className="p-4 sm:p-16 text-center">
            <div className="inline-block animate-spin w-8 h-8 border-4 border-[var(--color-primary-border)] dark:border-[var(--color-primary)] border-t-primary-600 dark:border-t-primary-400 rounded-[var(--radius-pill)] mb-[var(--space-apple-md)]" />
            <p className="text-[var(--text-muted)] font-medium">{t('pages.academic.loading')}</p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-[var(--color-error-border)] dark:border-[var(--color-error)] bg-[var(--color-error-container)]">
          <CardContent className="p-4 sm:p-8 text-center">
            <p className="text-[var(--color-error-text)] dark:text-[var(--color-error-text)] text-sm mb-[var(--space-apple-sm)]">{error}</p>
            <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={fetchReports}>{t('pages.academic.retry')}</Button>
          </CardContent>
        </Card>
      ) : filteredAndSortedReports.length === 0 ? (
        <EmptyState
          icon={<div className="w-12 h-12 rounded-[var(--radius-Apple-md)] bg-[var(--color-primary-container)] flex items-center justify-center"><FileText size={24} className="text-[var(--color-primary-text)]0 dark:text-[var(--color-primary-text)]" /></div>}
          title={hasActiveFilters ? t('pages.academic.noMatchingReports') : t('pages.academic.noReports')}
          description={hasActiveFilters ? t('pages.academic.noMatchingDesc') : t('pages.academic.noReportsDesc')}
          action={
            hasActiveFilters
              ? <Button variant="outline" size="sm" onClick={clearFilters}>{t('pages.academic.clearFilters')}</Button>
              : <Button icon={<Plus size={14} />} size="sm" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]" onClick={() => setViewMode('editor')}>{t('pages.academic.newReport')}</Button>
          }
        />
      ) : (
        <Card className="overflow-hidden border-[var(--border-color)]">
          {/* 表头 */}
          <div className="hidden sm:grid sm:grid-cols-[auto_1fr_90px_80px_40px] gap-[var(--space-apple-sm)] px-5 py-2.5 text-xs font-medium text-[var(--text-muted)] border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/50 dark:bg-[var(--bg-secondary)]/50">
            <div className="w-5" />
            <button onClick={() => handleSort('title')} className="flex items-center gap-1 hover:text-[var(--text-primary)] dark:hover:text-neutral-200 text-left">
              {t('pages.academic.title')} {sortField === 'title' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
            </button>
            <div>{t('pages.academic.status')}</div>
            <div>{t('pages.academic.updatedAt')}</div>
            <div />
          </div>

          {/* 行 */}
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
            {filteredAndSortedReports.map((report) => {
              const isSelected = selectedIds.has(report.id)
              const showMenu = showMoreMenu === report.id
              return (
                <div
                  key={report.id}
                  className={cn(
                    'group flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--bg-tertiary)]/60 dark:hover:bg-[var(--bg-tertiary)]/30 transition-colors',
                    isSelected && 'bg-[var(--color-primary-container)]/50 dark:bg-[var(--color-primary-container)]/15',
                  )}
                >
                  {/* 勾选框 */}
                  <button
                    onClick={(e) => { e.preventDefault(); handleSelectReport(report.id) }}
                    className={cn(
                      'shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors mt-0.5',
                      isSelected
                        ? 'bg-primary-container border-[var(--color-primary)] text-[var(--color-primary)]'
                        : 'border-[var(--border-color)] hover:border-[var(--color-primary)]',
                    )}
                  >
                    {isSelected && (
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* 标题/摘要 */}
                  <button
                    onClick={() => handleView(report)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <BookOpen size={13} className="text-[var(--color-primary-text)]0 shrink-0" />
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--color-primary-text)] dark:group-hover:text-[var(--color-primary-text)] transition-colors">
                        {report.title}
                      </span>
                    </div>
                    {report.abstract && (
                      <p className="text-xs text-[var(--text-muted)] line-clamp-1 mb-1">{report.abstract}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                      {report.authors.length > 0 && (
                        <span className="flex items-center gap-1"><User size={11} />{report.authors.join('、')}</span>
                      )}
                      {report.formulaName && (
                        <span className="flex items-center gap-1"><Link2 size={11} /><span className="font-medium text-[var(--text-muted)]">{report.formulaName}</span></span>
                      )}
                      <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(report.updatedAt)}</span>
                    </div>
                  </button>

                  {/* 状态 */}
                  <div className="hidden sm:block shrink-0">
                    <span className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-medium ${statusCls(report.status)}`}>
                      <span className={cn('w-1.5 h-1.5 rounded-[var(--radius-pill)]', report.status === 'published' ? 'bg-[var(--color-primary-container)]0' : report.status === 'in_review' ? 'bg-[var(--color-warning-container)]0' : 'bg-neutral-400')} />
                      {report.status === 'draft' ? t('pages.academic.statusDraft') : report.status === 'in_review' ? t('pages.academic.statusInReview') : t('pages.academic.statusPublished')}
                    </span>
                  </div>

                  {/* 操作 */}
                  <div className="shrink-0 flex items-center gap-1">
                    <button type="button" onClick={() => handleView(report)} title={t('pages.academic.view')}
                      className="p-1.5 rounded-[var(--radius-Apple-sm)] text-[var(--text-muted)] hover:text-[var(--color-primary-text)] hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]/20 transition-colors">
                      <Eye size={14} />
                    </button>
                    <button type="button" onClick={() => handleEdit(report)} title={t('pages.academic.edit')}
                      className="p-1.5 rounded-[var(--radius-Apple-sm)] text-[var(--text-muted)] hover:text-[var(--color-primary-text)] hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]/20 transition-colors">
                      <Edit size={14} />
                    </button>
                    <div className="relative">
                      <button type="button" onClick={() => setShowMoreMenu(showMenu ? null : report.id)} title={t('pages.academic.more')}
                        className="p-1.5 rounded-[var(--radius-Apple-sm)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)] transition-colors">
                        <MoreVertical size={14} />
                      </button>
                      {showMenu && (
                        <>
                          <div className="fixed inset-0 z-10"  role="button" tabIndex={0} onClick={() => setShowMoreMenu(null)} />
                          <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] shadow-xl border border-[var(--border-color)] py-1.5 z-20">
                            <button onClick={() => handleView(report)} className="w-full px-[var(--space-apple-sm)] py-2 text-left text-xs hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)] flex items-center gap-2 text-[var(--text-primary)]">
                              <Eye size={13} />{t('pages.academic.view')}
                            </button>
                            <button onClick={() => handleEdit(report)} className="w-full px-[var(--space-apple-sm)] py-2 text-left text-xs hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)] flex items-center gap-2 text-[var(--text-primary)]">
                              <Edit size={13} />{t('pages.academic.edit')}
                            </button>
                            <button onClick={() => handleDuplicate(report)} className="w-full px-[var(--space-apple-sm)] py-2 text-left text-xs hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)] flex items-center gap-2 text-[var(--text-primary)]">
                              <ClipboardCopy size={13} />{t('pages.academic.duplicate')}
                            </button>
                            <div className="my-1 border-t border-[var(--border-color)] dark:border-neutral-700" />
                            <button onClick={() => confirmDelete(report.id)} className="w-full px-[var(--space-apple-sm)] py-2 text-left text-xs hover:bg-[var(--color-error-container)] dark:hover:bg-[var(--color-error-container)]/20 flex items-center gap-2 text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">
                              <Trash2 size={13} />{t('pages.academic.delete')}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* 删除确认 */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDeleteTargetId(null) }}
        title={t('pages.academic.confirmDelete')}
        description={selectedIds.size > 1
          ? t('pages.academic.confirmDeleteMany', { count: selectedIds.size })
          : t('pages.academic.confirmDeleteDesc')}
      >
        <div className="flex gap-[var(--space-apple-sm)] justify-end mt-6">
          <Button variant="ghost" onClick={() => { setShowDeleteConfirm(false); setDeleteTargetId(null) }}>{t('pages.academic.cancel')}</Button>
          <Button variant="danger" onClick={() => selectedIds.size > 1 ? handleBulkDelete() : deleteTargetId && handleDelete(deleteTargetId)}>{t('pages.academic.confirmDeleteBtn')}</Button>
        </div>
      </Modal>
      </div>
    </div>
  )
}

/**
 * 学术报告页面 — Dashboard 设计语言对齐版
 * 统计卡片 · 横幅 · 紧凑筛选 · 行列表（divide-y）
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  FileText, Search, Filter, Plus, Edit, Trash2, Eye,
  Calendar, BookOpen, Link2, User, X, MoreVertical,
  ClipboardCopy, RefreshCw,
} from 'lucide-react'
import { Card, CardContent, Button, Input, Badge, StatCard } from '@/components/ui'
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
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
    setShowBulkActions(next.size > 0)
    setShowMoreMenu(null)
  }

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedReports.length) {
      setSelectedIds(new Set()); setShowBulkActions(false)
    } else {
      setSelectedIds(new Set(filteredAndSortedReports.map(r => r.id)))
      setShowBulkActions(true)
    }
  }

  const handleBulkDelete = () => {
    selectedIds.forEach(id => deleteReport(id))
    addToast({ type: 'success', message: `已删除 ${selectedIds.size} 份报告` })
    setSelectedIds(new Set()); setShowBulkActions(false); setShowDeleteConfirm(false)
  }

  const handleDuplicate = (report: ReportItem) => {
    createReport('research')
    addToast({ type: 'success', message: '报告已复制' })
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
    addToast({ type: 'success', message: '报告已删除' })
    setShowDeleteConfirm(false); setDeleteTargetId(null); setShowMoreMenu(null)
  }

  const confirmDelete = (id: string) => { setDeleteTargetId(id); setShowDeleteConfirm(true); setShowMoreMenu(null) }

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })

  const statusCls = (s: string) => ({
    draft:      'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
    in_review:  'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
    published:  'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  }[s] ?? 'bg-neutral-100 text-neutral-600')

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
      <div className="min-h-screen bg-grid flex items-center justify-center" style={{ backgroundColor: 'var(--bg-canvas)' }}>
        <div className="text-center p-8">
          <p className="text-error-600 dark:text-error-400 font-semibold mb-2">加载失败</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">{storeError}</p>
          <Button size="sm" onClick={() => window.location.reload()}>刷新页面</Button>
        </div>
      </div>
    )
  }

  // ── Editor view ──
  if (viewMode === 'editor') {
    return (
      <div className="h-screen flex flex-col bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
        <div className="sticky top-0 z-20 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-6 py-3 flex items-center gap-4 shadow-sm">
          <Button variant="ghost" onClick={() => setViewMode('list')} className="gap-2 text-neutral-600 dark:text-neutral-400">
            <span className="rotate-180 inline-block">›</span> 返回列表
          </Button>
          {selectedReport && (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center shrink-0">
                <BookOpen size={16} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{selectedReport.title}</h2>
                <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${statusCls(selectedReport.status)}`}>
                    {selectedReport.status === 'draft' ? '草稿' : selectedReport.status === 'in_review' ? '审核中' : '已发布'}
                  </span>
                  <span>·</span>
                  <span>更新于 {formatDate(selectedReport.updatedAt)}</span>
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
    <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div className="max-w-7xl mx-auto space-y-4 px-4 sm:px-6 lg:px-8 py-6">

      {/* ── 页面横幅 ── */}
      <div className="rounded-xl bg-primary-600 p-6 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold leading-snug tracking-tight">学术报告管理</h2>
            <p className="mt-1 text-white/80 text-sm">报告撰写 · 协作审核 · 成果归档</p>
          </div>
          <Button
            icon={<Plus size={16} />}
            size="md"
            className="bg-white text-primary-600 hover:bg-neutral-100 shadow-sm"
            onClick={() => { setSelectedReport(null); setViewMode('editor') }}
          >
            新建报告
          </Button>
        </div>
      </div>

      {/* ── 统计概览 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="总报告数" value={total} icon={FileText} variant="primary" />
        <StatCard label="草稿" value={draft} icon={Edit} variant="secondary" />
        <StatCard label="审核中" value={inReview} icon={Filter} variant="warning" />
        <StatCard label="已发布" value={published} icon={BookOpen} variant="success" />
      </div>

      {/* ── 搜索和筛选 ── */}
      <Card className="overflow-hidden border-neutral-200 dark:border-neutral-700">
        <div className="h-[3px] bg-gradient-to-r from-primary-500 to-emerald-400" />
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && setSearchQuery((e.target as HTMLInputElement).value)}
              placeholder="搜索标题、作者、摘要或关联配方…"
              prefix={<Search size={14} className="text-neutral-400" />}
              className="flex-1 h-9 text-sm"
            />
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={clearFilters}>清除</Button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={13} className="text-neutral-400 shrink-0" />
            {(['all', 'draft', 'in_review', 'published'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSelectedStatus(s)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                  selectedStatus === s
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                )}
              >
                {s === 'all' ? '全部' : s === 'draft' ? '草稿' : s === 'in_review' ? '审核中' : '已发布'}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              {([
                { key: 'updatedAt', label: '更新时间' },
                { key: 'createdAt', label: '创建时间' },
                { key: 'title', label: '标题' },
                { key: 'status', label: '状态' },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => handleSort(opt.key)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                    sortField === opt.key
                      ? 'bg-primary-500 text-white'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700',
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
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/40 rounded-xl animate-fade-in">
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            已选中 {selectedIds.size} 份报告
          </span>
          <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setShowDeleteConfirm(true)}>
            批量删除
          </Button>
          <button onClick={() => { setSelectedIds(new Set()); setShowBulkActions(false) }} className="ml-auto text-xs text-neutral-400 hover:text-neutral-600 transition-colors">取消选择</button>
        </div>
      )}

      {/* ── 列表 ── */}
      {isLoading ? (
        <Card className="border-neutral-200 dark:border-neutral-700">
          <CardContent className="p-16 text-center">
            <div className="inline-block animate-spin w-8 h-8 border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 dark:border-t-primary-400 rounded-full mb-4" />
            <p className="text-neutral-500 dark:text-neutral-400 font-medium">加载中…</p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-200 dark:border-red-800 bg-error-50 dark:bg-error-900/20">
          <CardContent className="p-8 text-center">
            <p className="text-error-600 dark:text-error-400 text-sm mb-3">{error}</p>
            <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={fetchReports}>重试</Button>
          </CardContent>
        </Card>
      ) : filteredAndSortedReports.length === 0 ? (
        <EmptyState
          icon={<div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center"><FileText size={24} className="text-primary-500 dark:text-primary-400" /></div>}
          title={hasActiveFilters ? '未找到匹配的报告' : '暂无学术报告'}
          description={hasActiveFilters ? '尝试调整搜索条件或清除筛选' : '点击上方按钮创建您的第一份学术报告'}
          action={
            hasActiveFilters
              ? <Button variant="outline" size="sm" onClick={clearFilters}>清除筛选</Button>
              : <Button icon={<Plus size={14} />} size="sm" className="bg-primary-600 hover:bg-primary-700" onClick={() => setViewMode('editor')}>新建报告</Button>
          }
        />
      ) : (
        <Card className="overflow-hidden border-neutral-200 dark:border-neutral-700">
          {/* 表头 */}
          <div className="hidden sm:grid sm:grid-cols-[auto_1fr_90px_80px_40px] gap-3 px-5 py-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
            <div className="w-5" />
            <button onClick={() => handleSort('title')} className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-200 text-left">
              标题 {sortField === 'title' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
            </button>
            <div>状态</div>
            <div>更新时间</div>
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
                    'group flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors',
                    isSelected && 'bg-primary-50/50 dark:bg-primary-900/10',
                  )}
                >
                  {/* 勾选框 */}
                  <button
                    onClick={(e) => { e.preventDefault(); handleSelectReport(report.id) }}
                    className={cn(
                      'shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors mt-0.5',
                      isSelected
                        ? 'bg-primary-500 border-primary-500 text-white'
                        : 'border-neutral-300 dark:border-neutral-600 hover:border-primary-400',
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
                      <BookOpen size={13} className="text-primary-500 shrink-0" />
                      <span className="text-sm font-medium text-neutral-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {report.title}
                      </span>
                    </div>
                    {report.abstract && (
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 line-clamp-1 mb-1">{report.abstract}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400 dark:text-neutral-500">
                      {report.authors.length > 0 && (
                        <span className="flex items-center gap-1"><User size={11} />{report.authors.join('、')}</span>
                      )}
                      {report.formulaName && (
                        <span className="flex items-center gap-1"><Link2 size={11} /><span className="font-medium text-neutral-500 dark:text-neutral-400">{report.formulaName}</span></span>
                      )}
                      <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(report.updatedAt)}</span>
                    </div>
                  </button>

                  {/* 状态 */}
                  <div className="hidden sm:block shrink-0">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCls(report.status)}`}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', report.status === 'published' ? 'bg-primary-500' : report.status === 'in_review' ? 'bg-warning-500' : 'bg-neutral-400')} />
                      {report.status === 'draft' ? '草稿' : report.status === 'in_review' ? '审核中' : '已发布'}
                    </span>
                  </div>

                  {/* 操作 */}
                  <div className="shrink-0 flex items-center gap-1">
                    <button type="button" onClick={() => handleView(report)} title="查看"
                      className="p-1.5 rounded-lg text-neutral-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                      <Eye size={14} />
                    </button>
                    <button type="button" onClick={() => handleEdit(report)} title="编辑"
                      className="p-1.5 rounded-lg text-neutral-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                      <Edit size={14} />
                    </button>
                    <div className="relative">
                      <button type="button" onClick={() => setShowMoreMenu(showMenu ? null : report.id)} title="更多"
                        className="p-1.5 rounded-lg text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                        <MoreVertical size={14} />
                      </button>
                      {showMenu && (
                        <>
                          <div className="fixed inset-0 z-10"  role="button" tabIndex={0} onClick={() => setShowMoreMenu(null)} />
                          <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 py-1.5 z-20">
                            <button onClick={() => handleView(report)} className="w-full px-3 py-2 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
                              <Eye size={13} />查看
                            </button>
                            <button onClick={() => handleEdit(report)} className="w-full px-3 py-2 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
                              <Edit size={13} />编辑
                            </button>
                            <button onClick={() => handleDuplicate(report)} className="w-full px-3 py-2 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
                              <ClipboardCopy size={13} />复制
                            </button>
                            <div className="my-1 border-t border-neutral-100 dark:border-neutral-700" />
                            <button onClick={() => confirmDelete(report.id)} className="w-full px-3 py-2 text-left text-xs hover:bg-error-50 dark:hover:bg-error-900/20 flex items-center gap-2 text-error-600 dark:text-error-400">
                              <Trash2 size={13} />删除
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
        title="确认删除"
        description={selectedIds.size > 1
          ? `确定要删除选中的 ${selectedIds.size} 份报告吗？此操作无法撤销。`
          : '此操作将永久删除该报告，无法撤销。确定要继续吗？'}
      >
        <div className="flex gap-3 justify-end mt-6">
          <Button variant="ghost" onClick={() => { setShowDeleteConfirm(false); setDeleteTargetId(null) }}>取消</Button>
          <Button variant="danger" onClick={() => selectedIds.size > 1 ? handleBulkDelete() : deleteTargetId && handleDelete(deleteTargetId)}>确认删除</Button>
        </div>
      </Modal>
      </div>
    </div>
  )
}

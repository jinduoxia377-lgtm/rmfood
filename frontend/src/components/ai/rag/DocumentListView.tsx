/**
 * DocumentListView - 知识库「文档列表」专业文档管理视图
 *
 * 消费 `GET /rag/documents`（含 display_name / category / dynasty / author /
 * is_protected / updated_at / size_bytes 与全库口径 summary）渲染：
 * - 统计条：总来源 + 分类计数 chips（全部/平台种子/本草古籍/我的上传）+ 总块数
 * - 工具栏：搜索框（display_name / filename，300ms 防抖）+ 排序下拉
 * - 列表行：分类图标（Database / BookOpen / FileText）+ 专有名称加粗 + 原始文件名
 *           + 分类徽标 + 块数 + 版本数 + 更新时间
 * - 行操作：展开版本历史（listDocumentVersions，按需加载且缓存）、删除
 *           （内联二次确认；is_protected 时禁用）
 * - 分页：纯客户端，每页 20 条
 * - 三态：加载骨架 / 空态（无匹配 vs 无文档）/ 错误态（可重试）
 *
 * 组件为受控展示层：数据与副作用（react-query / mutation）由父级注入，
 * 便于从 KnowledgeBasePanel 逐步接线而不改动其现有查询逻辑。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  History,
  Layers,
  Loader2,
  Search,
  Trash2,
} from 'lucide-react'
import {
  listDocumentVersions,
  type RAGDocument,
  type RAGDocumentCategory,
  type RAGDocumentSort,
  type RAGDocumentVersion,
  type RAGDocumentsSummary,
} from '@/api/rag'
import { Card } from '@/components/ui'
import { clsx } from 'clsx'
import { getSourceDisplayName } from './sourceDisplay'

// ═══════════════════════════════════════════
// 命名常量（替换魔法数字）
// ═══════════════════════════════════════════

/** 每页条数（纯客户端分页） */
const PAGE_SIZE = 20
/** 搜索输入防抖时长（毫秒） */
const SEARCH_DEBOUNCE_MS = 300
/** 加载骨架行数 */
const SKELETON_ROWS = 6

/** 分类筛选（含「全部」） */
type CategoryFilter = 'all' | RAGDocumentCategory

const CATEGORY_FILTERS: CategoryFilter[] = ['all', 'seed', 'ancient_book', 'upload']

/** 排序方式（与后端 sort 白名单一致） */
const SORT_OPTIONS: RAGDocumentSort[] = ['name', 'chunks_desc', 'updated_desc']

/** 分类筛选 → i18n key */
const CATEGORY_LABEL_KEYS: Record<CategoryFilter, string> = {
  all: 'ai.knowledge.docCatAll',
  seed: 'ai.knowledge.docCatSeed',
  ancient_book: 'ai.knowledge.docCatAncient',
  upload: 'ai.knowledge.docCatUpload',
}

/** 排序方式 → i18n key */
const SORT_LABEL_KEYS: Record<RAGDocumentSort, string> = {
  name: 'ai.knowledge.docSortName',
  chunks_desc: 'ai.knowledge.docSortChunks',
  updated_desc: 'ai.knowledge.docSortUpdated',
}

/**
 * 分类视觉元数据。
 * seed=Database（主色）/ ancient_book=BookOpen（古籍琥珀）/ upload=FileText（上传天蓝）。
 */
const CATEGORY_META: Record<
  RAGDocumentCategory,
  { labelKey: string; icon: LucideIcon; iconBgClass: string; iconClass: string; badgeClass: string }
> = {
  seed: {
    labelKey: 'ai.knowledge.docCatSeed',
    icon: Database,
    iconBgClass: 'bg-primary-50 dark:bg-primary-300/15',
    iconClass: 'text-primary-700 dark:text-primary-600',
    badgeClass:
      'bg-primary-50 dark:bg-primary-300/15 text-primary-700 dark:text-primary-600 border-primary-200/70 dark:border-primary-700/40',
  },
  ancient_book: {
    labelKey: 'ai.knowledge.docCatAncient',
    icon: BookOpen,
    iconBgClass: 'bg-accent-50 dark:bg-accent-300/15',
    iconClass: 'text-accent-600 dark:text-accent-500',
    badgeClass:
      'bg-accent-50 dark:bg-accent-300/15 text-accent-700 dark:text-accent-500 border-accent-200/70 dark:border-accent-700/40',
  },
  upload: {
    labelKey: 'ai.knowledge.docCatUpload',
    icon: FileText,
    iconBgClass: 'bg-secondary-50 dark:bg-secondary-300/15',
    iconClass: 'text-secondary-600 dark:text-secondary-500',
    badgeClass:
      'bg-secondary-50 dark:bg-secondary-300/15 text-secondary-700 dark:text-secondary-500 border-secondary-200/70 dark:border-secondary-700/40',
  },
}

/** 分页按钮基础样式 */
const PAGER_BUTTON_CLASS =
  'flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-[var(--border-color)] ' +
  'text-[var(--text-secondary)] transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'

// ═══════════════════════════════════════════
// 纯函数工具
// ═══════════════════════════════════════════

/**
 * 文档分类解析（后端已下发 category；兼容旧响应缺失该字段的场景）。
 * 缺失时按 `ancient/` 前缀推断古籍，其余按上传处理。
 */
function resolveCategory(doc: RAGDocument): RAGDocumentCategory {
  if (doc.category) return doc.category
  return doc.filename.startsWith('ancient/') ? 'ancient_book' : 'upload'
}

/** 数字格式化（千分位；非法值回退占位符） */
function formatNumber(value: number, language: string): string {
  if (!Number.isFinite(value)) return '—'
  try {
    return new Intl.NumberFormat(language).format(value)
  } catch {
    return value.toLocaleString()
  }
}

/** 日期格式化（ISO 字符串 → 本地短日期；非法/空值返回 null，让调用方决定是否渲染） */
function formatDate(value: string | null | undefined, language: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  try {
    return date.toLocaleDateString(language)
  } catch {
    return value.slice(0, 10)
  }
}

/** 时间戳（用于 updated_desc 排序；空值/非法值排到最后） */
function timestampOf(value: string | null | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

/** 版本历史按需加载状态 */
type VersionState =
  | { status: 'loading' }
  | { status: 'ready'; items: RAGDocumentVersion[] }
  | { status: 'error' }

// ═══════════════════════════════════════════
// 子组件
// ═══════════════════════════════════════════

interface DocumentRowProps {
  doc: RAGDocument
  language: string
  isExpanded: boolean
  isConfirming: boolean
  isDeleting: boolean
  versionState: VersionState | undefined
  /** 是否渲染删除按钮（父级未提供 onDelete 时不渲染） */
  canDelete: boolean
  onToggleVersions: () => void
  onRequestDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
}

/** 单个文档行：主体信息 + 版本历史展开区 + 删除内联确认层 */
function DocumentRow({
  doc,
  language,
  isExpanded,
  isConfirming,
  isDeleting,
  versionState,
  canDelete,
  onToggleVersions,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: DocumentRowProps) {
  const { t } = useTranslation()
  const category = resolveCategory(doc)
  const meta = CATEGORY_META[category]
  const Icon = meta.icon
  const displayName = getSourceDisplayName(doc.filename, doc.display_name)
  const categoryLabel = t(meta.labelKey)
  const updatedAt = formatDate(doc.updated_at ?? doc.created_at, language)
  const chunksText = t('ai.knowledge.docChunksTotal', {
    count: formatNumber(doc.chunks ?? 0, language),
  })
  const versionsText = t('ai.knowledge.docVersions', { count: doc.total_versions ?? 0 })

  // 受保护文档（平台种子/本草古籍）的删除按钮禁用；i18n 无专门的「不可删除」键
  // （且本次禁止改动 i18n），故用分类文案作 title 提示。
  const deleteTitle = doc.is_protected
    ? `${t('ai.knowledge.docCategory')}: ${categoryLabel}`
    : t('ai.knowledge.deleteDoc', { filename: doc.filename })

  return (
    <div className="border-t border-[var(--border-color)] first:border-t-0">
      <div className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
        {/* 类型图标 */}
        <span
          className={clsx(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
            meta.iconBgClass,
          )}
          aria-hidden="true"
        >
          <Icon className={clsx('h-4 w-4', meta.iconClass)} />
        </span>

        {/* 专有名称 + 原始文件名 */}
        <div className="flex min-w-0 flex-1 flex-col">
          <span
            className="truncate text-sm font-semibold text-[var(--text-primary)] dark:text-white"
            title={displayName}
          >
            {displayName}
          </span>
          <span
            className="truncate font-mono text-[11px] text-[var(--text-muted)]"
            title={doc.filename}
          >
            {doc.filename}
          </span>
        </div>

        {/* 右侧元信息：分类徽标 + 块数 + 版本数 + 更新时间（窄屏隐藏，信息不丢但避免换行） */}
        <div className="hidden flex-shrink-0 items-center gap-2 text-[11px] text-[var(--text-muted)] md:flex">
          <span
            className={clsx(
              'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
              meta.badgeClass,
            )}
            title={`${t('ai.knowledge.docCategory')}: ${categoryLabel}`}
          >
            {categoryLabel}
          </span>
          <span className="tabular-nums" title={t('ai.knowledge.docChunksLabel')}>
            {chunksText}
          </span>
          <span className="tabular-nums" title={t('ai.knowledge.docVersions', { count: doc.total_versions ?? 0 })}>
            {versionsText}
          </span>
          {updatedAt && (
            <span className="tabular-nums">{t('ai.knowledge.docUpdatedAt', { date: updatedAt })}</span>
          )}
        </div>

        {/* 行操作 */}
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onToggleVersions}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? t('ai.knowledge.docCollapse') : t('ai.knowledge.docExpand')}
            title={isExpanded ? t('ai.knowledge.docCollapse') : t('ai.knowledge.docExpand')}
            className="rounded-lg p-1.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <ChevronDown
              className={clsx(
                'h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-200',
                isExpanded && 'rotate-180',
              )}
            />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={onRequestDelete}
              disabled={doc.is_protected || isDeleting}
              aria-label={t('ai.knowledge.deleteDoc', { filename: doc.filename })}
              title={deleteTitle}
              data-protected={doc.is_protected ? 'true' : undefined}
              className={clsx(
                'rounded-lg p-1.5 transition-colors',
                doc.is_protected
                  ? 'cursor-not-allowed opacity-40'
                  : 'hover:bg-error-50 dark:hover:bg-error-950/30',
              )}
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-error-500" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 text-error-400 hover:text-error-600" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 版本历史（展开时按需加载） */}
      {isExpanded && (
        <div className="bg-neutral-50/70 px-3 pb-3 pt-1 dark:bg-neutral-900/40">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <History className="h-3 w-3" aria-hidden="true" />
            {t('ai.knowledge.docVersionHistory')}
          </p>
          {!versionState || versionState.status === 'loading' ? (
            <div className="flex items-center gap-2 py-1.5 text-xs text-[var(--text-muted)]" aria-busy="true">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{t('ai.knowledge.docVersionHistory')}</span>
            </div>
          ) : versionState.status === 'error' ? (
            <p className="py-1 text-xs text-error-600 dark:text-error-400">
              {t('ai.knowledge.docLoadError')}
            </p>
          ) : versionState.items.length === 0 ? (
            <p className="py-1 text-xs text-[var(--text-muted)]">{t('ai.knowledge.docNoMatch')}</p>
          ) : (
            <ul className="space-y-1">
              {versionState.items.map((version) => (
                <li
                  key={version.version}
                  className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
                  title={t('ai.knowledge.docVersionLabel', { version: version.version })}
                >
                  <span className="font-mono font-semibold text-[var(--text-primary)] dark:text-neutral-200">
                    v{version.version}
                  </span>
                  <span className="text-[var(--text-muted)]" aria-hidden="true">
                    ·
                  </span>
                  <span className="tabular-nums text-[var(--text-secondary)]">
                    {t('ai.knowledge.docChunksTotal', {
                      count: formatNumber(version.chunks, language),
                    })}
                  </span>
                  <span className="text-[var(--text-muted)]" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-[var(--text-muted)]">
                    {formatDate(version.created_at, language) ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 删除内联二次确认 */}
      {isConfirming && (
        <div className="flex flex-col gap-2 border-t border-error-200/60 bg-error-50/70 px-3 py-2.5 dark:border-error-900/30 dark:bg-error-300/10 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-error-600 dark:text-error-400">
              {t('ai.knowledge.docDeleteConfirmTitle')}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
              {t('ai.knowledge.docDeleteConfirmDesc', { name: displayName })}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onCancelDelete}
              className="rounded-lg border border-[var(--border-color)] px-2.5 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {t('ai.knowledge.docDeleteCancel')}
            </button>
            <button
              type="button"
              onClick={onConfirmDelete}
              disabled={isDeleting}
              className="flex items-center gap-1 rounded-lg bg-error-600 px-2.5 py-1 text-xs text-white transition-colors hover:bg-error-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting && <Loader2 className="h-3 w-3 animate-spin" />}
              {t('ai.knowledge.docDeleteConfirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════

export interface DocumentListViewProps {
  /** 文档列表（父级由 GET /rag/documents 提供） */
  documents: RAGDocument[]
  /** 全库口径分类统计（用于统计条与 chips 计数，缺失时按 documents 本地推导） */
  summary?: RAGDocumentsSummary
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  /** 删除回调（父级负责 mutation / 缓存失效）；未提供时隐藏删除入口 */
  onDelete?: (filename: string) => Promise<void>
  /** 正在删除的文件名（用于行内 spinner） */
  deletingFile?: string | null
}

export function DocumentListView({
  documents,
  summary,
  isLoading = false,
  error = null,
  onRetry,
  onDelete,
  deletingFile = null,
}: DocumentListViewProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.language || 'zh-CN'

  // 输入框即时值与防抖后的过滤值分离：输入始终流畅，过滤稍后生效
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [sort, setSort] = useState<RAGDocumentSort>('name')
  const [page, setPage] = useState(1)
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [confirmFile, setConfirmFile] = useState<string | null>(null)
  const [versionStates, setVersionStates] = useState<Record<string, VersionState>>({})

  // 300ms 防抖：输入停顿后写入真正参与过滤的 query，并把页码复位
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  // ── 统计（summary 为全库口径；缺失时从 documents 推导）──
  const categoryCounts = useMemo<Record<RAGDocumentCategory, number>>(() => {
    if (summary) {
      return {
        seed: summary.seed ?? 0,
        ancient_book: summary.ancient_book ?? 0,
        upload: summary.upload ?? 0,
      }
    }
    const counts: Record<RAGDocumentCategory, number> = { seed: 0, ancient_book: 0, upload: 0 }
    for (const doc of documents) counts[resolveCategory(doc)] += 1
    return counts
  }, [documents, summary])

  const totalSources = useMemo(() => {
    if (summary) return categoryCounts.seed + categoryCounts.ancient_book + categoryCounts.upload
    return documents.length
  }, [categoryCounts, documents.length, summary])

  const totalChunks = useMemo(() => {
    if (typeof summary?.total_chunks === 'number') return summary.total_chunks
    return documents.reduce((sum, doc) => sum + (Number.isFinite(doc.chunks) ? doc.chunks : 0), 0)
  }, [documents, summary])

  // ── 客户端过滤 → 排序 → 分页（全部 useMemo，输入变化只重算列表）──
  const filteredDocuments = useMemo(() => {
    const needle = query.toLocaleLowerCase(language)
    return documents.filter((doc) => {
      if (category !== 'all' && resolveCategory(doc) !== category) return false
      if (!needle) return true
      const displayName = getSourceDisplayName(doc.filename, doc.display_name)
      return (
        displayName.toLocaleLowerCase(language).includes(needle) ||
        doc.filename.toLocaleLowerCase(language).includes(needle)
      )
    })
  }, [documents, category, query, language])

  const sortedDocuments = useMemo(() => {
    const displayOf = (doc: RAGDocument) => getSourceDisplayName(doc.filename, doc.display_name)
    const list = [...filteredDocuments]
    if (sort === 'chunks_desc') {
      list.sort(
        (a, b) =>
          (b.chunks ?? 0) - (a.chunks ?? 0) ||
          displayOf(a).localeCompare(displayOf(b), language),
      )
    } else if (sort === 'updated_desc') {
      list.sort(
        (a, b) =>
          timestampOf(b.updated_at ?? b.created_at) - timestampOf(a.updated_at ?? a.created_at),
      )
    } else {
      list.sort(
        (a, b) =>
          displayOf(a).localeCompare(displayOf(b), language) || a.filename.localeCompare(b.filename),
      )
    }
    return list
  }, [filteredDocuments, sort, language])

  const totalPages = Math.max(1, Math.ceil(sortedDocuments.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageDocuments = useMemo(
    () => sortedDocuments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sortedDocuments, currentPage],
  )

  const hasDocuments = documents.length > 0
  const hasMatches = sortedDocuments.length > 0

  // ── 版本历史按需加载（成功结果缓存，失败允许再次展开重试）──
  const loadVersions = useCallback(async (filename: string) => {
    setVersionStates((prev) => ({ ...prev, [filename]: { status: 'loading' } }))
    try {
      const items = await listDocumentVersions(filename)
      setVersionStates((prev) => ({ ...prev, [filename]: { status: 'ready', items } }))
    } catch {
      // 版本历史失败不阻塞主列表：仅在该行展示轻量错误文案
      setVersionStates((prev) => ({ ...prev, [filename]: { status: 'error' } }))
    }
  }, [])

  const handleToggleVersions = useCallback(
    (doc: RAGDocument) => {
      setConfirmFile(null)
      const isSame = expandedFile === doc.filename
      setExpandedFile(isSame ? null : doc.filename)
      const cached = versionStates[doc.filename]
      if (!isSame && (!cached || cached.status === 'error')) {
        void loadVersions(doc.filename)
      }
    },
    [expandedFile, loadVersions, versionStates],
  )

  const handleConfirmDelete = useCallback(
    async (doc: RAGDocument) => {
      if (!onDelete) return
      try {
        await onDelete(doc.filename)
      } catch {
        // 删除失败的用户提示由父级（mutation onError / toast）负责，这里只收起确认层
      } finally {
        setConfirmFile(null)
      }
    },
    [onDelete],
  )

  const chipClass = (active: boolean) =>
    clsx(
      'px-2.5 py-1 rounded-full text-xs border transition-colors',
      active
        ? 'bg-primary-700 text-white border-primary-700 dark:bg-primary-600 dark:border-primary-600'
        : 'bg-white dark:bg-neutral-900 border-[var(--border-color)] text-[var(--text-secondary)] hover:border-primary-400 dark:hover:border-primary-600',
    )

  return (
    <div className="space-y-3">
      {/* 统计条：总来源 + 分类计数 chips + 总块数 */}
      <Card className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex flex-shrink-0 items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <Database className="h-3.5 w-3.5 text-primary-700 dark:text-primary-600" aria-hidden="true" />
            <span className="font-semibold tabular-nums text-[var(--text-primary)] dark:text-white">
              {t('ai.knowledge.docTotalSources', {
                count: formatNumber(totalSources, language),
              })}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORY_FILTERS.map((option) => {
              const active = category === option
              const count = option === 'all' ? totalSources : categoryCounts[option]
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setCategory(option)
                    setPage(1)
                  }}
                  aria-pressed={active}
                  className={chipClass(active)}
                >
                  {t(CATEGORY_LABEL_KEYS[option])}
                  <span className="ml-1 tabular-nums opacity-70">{formatNumber(count, language)}</span>
                </button>
              )
            })}
          </div>

          <div className="ml-auto flex flex-shrink-0 items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="tabular-nums">
              {t('ai.knowledge.docChunksTotal', {
                count: formatNumber(totalChunks, language),
              })}
            </span>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {/* 工具栏：搜索 / 排序 */}
        <div className="flex flex-col gap-2 border-b border-[var(--border-color)] p-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('ai.knowledge.docSearchPlaceholder')}
              aria-label={t('ai.knowledge.docSearchPlaceholder')}
              className="w-full rounded-lg border border-[var(--border-color)] bg-white py-1.5 pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-neutral-900"
            />
            {searchInput !== query && (
              <Loader2
                className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-[var(--text-muted)]"
                aria-hidden="true"
              />
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <label
              htmlFor="document-list-sort"
              className="whitespace-nowrap text-xs text-[var(--text-muted)]"
            >
              {t('ai.knowledge.sortBy')}
            </label>
            <select
              id="document-list-sort"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as RAGDocumentSort)
                setPage(1)
              }}
              className="rounded-lg border border-[var(--border-color)] bg-white px-2 py-1.5 text-xs text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-neutral-900"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(SORT_LABEL_KEYS[option])}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 三态：错误 / 加载 / 空 / 列表 */}
        {error ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <AlertCircle className="h-6 w-6 text-error-500" aria-hidden="true" />
            <p className="text-sm text-error-600 dark:text-error-400">
              {t('ai.knowledge.docLoadError')}
            </p>
            <p className="max-w-full break-all text-xs text-[var(--text-muted)]">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-1 rounded-lg bg-primary-700 px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary-600"
              >
                {t('ai.knowledge.retry')}
              </button>
            )}
          </div>
        ) : isLoading ? (
          <div className="space-y-2 p-4" aria-busy="true">
            {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="h-8 w-8 flex-shrink-0 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-1/3 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
                </div>
              </div>
            ))}
          </div>
        ) : !hasDocuments ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <FileText className="h-6 w-6 text-[var(--text-muted)]" aria-hidden="true" />
            <p className="text-sm text-[var(--text-muted)]">{t('ai.knowledge.noDocsHint')}</p>
          </div>
        ) : !hasMatches ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <Search className="h-6 w-6 text-[var(--text-muted)]" aria-hidden="true" />
            <p className="text-sm text-[var(--text-muted)]">{t('ai.knowledge.docNoMatch')}</p>
          </div>
        ) : (
          <div>
            {pageDocuments.map((doc) => (
              <DocumentRow
                key={doc.filename}
                doc={doc}
                language={language}
                isExpanded={expandedFile === doc.filename}
                isConfirming={confirmFile === doc.filename}
                isDeleting={deletingFile === doc.filename}
                versionState={versionStates[doc.filename]}
                canDelete={Boolean(onDelete)}
                onToggleVersions={() => handleToggleVersions(doc)}
                onRequestDelete={() => {
                  setExpandedFile(null)
                  setConfirmFile(doc.filename)
                }}
                onCancelDelete={() => setConfirmFile(null)}
                onConfirmDelete={() => void handleConfirmDelete(doc)}
              />
            ))}
          </div>
        )}

        {/* 客户端分页（每页 20 条） */}
        {!error && !isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-[var(--border-color)] px-3 py-2.5">
            <span className="text-xs tabular-nums text-[var(--text-muted)]">
              {t('ai.knowledge.pageInfo', { current: currentPage, total: totalPages })}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className={PAGER_BUTTON_CLASS}
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                {t('ai.knowledge.prevPage')}
              </button>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className={PAGER_BUTTON_CLASS}
              >
                {t('ai.knowledge.nextPage')}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

export default DocumentListView

/**
 * AncientBooksPanel - 本草古籍书目面板（知识库第三个标签页）
 *
 * 直接消费 PostgreSQL 表 `rag_knowledge_sources` 的 3 个只读接口，展示 42 部本草古籍：
 * - 顶部统计卡：总书数 / 总知识块 / 总字符（千分位与紧凑单位）
 * - 朝代筛选 chips：由 `stats.by_dynasty` 动态生成（含「全部」），点击切换 dynasty 过滤
 * - 搜索框：按书名/来源/展示名模糊匹配，300ms 防抖后触发请求
 * - 排序下拉：朝代（默认）/ 块数降序 / 书名 A-Z / 最近导入
 * - 书目列表：书名 · 朝代·作者 · 块数 · 字符数 · 导入日期；点击行展开 metadata 详情
 * - 分页：上一页 / 下一页 + 第 X/Y 页（每页 20 条）
 * - 完整状态：loading 骨架、空态、错误态（含重试）
 *
 * 全部文案经 `t('ai.knowledge.*')`，无硬编码中文。
 */

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Type,
} from 'lucide-react'
import {
  getKnowledgeSourceStats,
  listKnowledgeSources,
  type KnowledgeSource,
  type KnowledgeSourceSort,
  type KnowledgeSourceStats,
} from '@/api/rag'
import { Card } from '@/components/ui'
import { clsx } from 'clsx'

// ═══════════════════════════════════════════
// 命名常量（替换魔法数字）
// ═══════════════════════════════════════════

/** 每页条数（后端 page_size 允许 1–100，产品要求固定 20） */
const PAGE_SIZE = 20
/** 搜索输入防抖时长（毫秒）——输入停顿后才发请求 */
const SEARCH_DEBOUNCE_MS = 300
/** 详情中 checksum 的展示前缀长度 */
const CHECKSUM_PREVIEW_LENGTH = 12
/** 加载骨架行数 */
const SKELETON_ROWS = 6

/** 可选的排序方式（与后端 sort 白名单一致，默认朝代升序） */
const SORT_OPTIONS: KnowledgeSourceSort[] = ['dynasty_asc', 'chunk_desc', 'title_asc', 'imported_desc']

/** 排序方式 → i18n key */
const SORT_LABEL_KEYS: Record<KnowledgeSourceSort, string> = {
  dynasty_asc: 'ai.knowledge.sortDynasty',
  chunk_desc: 'ai.knowledge.sortChunks',
  title_asc: 'ai.knowledge.sortTitle',
  imported_desc: 'ai.knowledge.sortImported',
}

/**
 * 列表网格列宽（表头与数据行共用，保证纵向对齐）：
 * 书名 / 朝代·作者 / 块数 / 字符数 / 导入日期 / 展开箭头
 */
const ROW_GRID_STYLE: CSSProperties = {
  gridTemplateColumns:
    'minmax(0, 2.4fr) minmax(0, 1.6fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.1fr) 1.5rem',
}

/** 分页按钮基础样式 */
const PAGER_BUTTON_CLASS =
  'flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-[var(--border-color)] ' +
  'text-[var(--text-secondary)] transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'

// ═══════════════════════════════════════════
// 纯函数工具（号码/日期/元数据格式化）
// ═══════════════════════════════════════════

/**
 * 数字格式化。
 * @param compact true 时用 Intl 紧凑记法（中文「万」/ 英文「K、M」/ 德文「Mio.」），
 *                否则使用千分位普通记法。
 */
function formatNumber(value: number, language: string, compact = false): string {
  if (!Number.isFinite(value)) return '—'
  try {
    return new Intl.NumberFormat(
      language,
      compact ? { notation: 'compact', maximumFractionDigits: 1 } : undefined,
    ).format(value)
  } catch {
    return value.toLocaleString()
  }
}

/** 日期格式化（ISO 字符串 → 本地短日期），非法值回退占位符 */
function formatDate(value: string | null | undefined, language: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  try {
    return date.toLocaleDateString(language)
  } catch {
    return value.slice(0, 10)
  }
}

/** metadata 值可能是 string / number / null，统一安全转字符串 */
function metaText(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined) return fallback
  const text = String(value)
  return text.length > 0 ? text : fallback
}

// ═══════════════════════════════════════════
// 子组件
// ═══════════════════════════════════════════

/** 顶部统计卡：总书数 / 总知识块 / 总字符 */
function BooksStatCards({
  stats,
  isLoading,
  isError,
}: {
  stats: KnowledgeSourceStats | undefined
  isLoading: boolean
  isError: boolean
}) {
  const { t, i18n } = useTranslation()
  const language = i18n.language || 'zh-CN'

  const cards = [
    {
      key: 'books',
      label: t('ai.knowledge.booksTotal'),
      value: stats?.total_books ?? 0,
      compact: false,
      icon: BookOpen,
      accent: 'text-primary-700 dark:text-primary-700',
    },
    {
      key: 'chunks',
      label: t('ai.knowledge.booksChunks'),
      value: stats?.total_chunks ?? 0,
      compact: false,
      icon: Layers,
      accent: 'text-secondary-600 dark:text-secondary-700',
    },
    {
      key: 'chars',
      label: t('ai.knowledge.booksChars'),
      value: stats?.total_chars ?? 0,
      compact: true,
      icon: Type,
      accent: 'text-accent-600 dark:text-accent-700',
    },
  ]

  return (
    <Card className="p-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.key} className="space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)]">
                <Icon className="w-3.5 h-3.5" />
                <span>{card.label}</span>
              </div>
              {isLoading ? (
                <div className="h-6 w-20 mx-auto rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
              ) : (
                <div
                  className={clsx('text-base font-bold tabular-nums', card.accent)}
                  title={isError ? t('ai.knowledge.booksLoadError') : formatNumber(card.value, language)}
                >
                  {isError ? '—' : formatNumber(card.value, language, card.compact)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/** 朝代筛选 chips（含「全部」），来自 stats.by_dynasty 动态生成 */
function DynastyChips({
  stats,
  active,
  onChange,
}: {
  stats: KnowledgeSourceStats | undefined
  active: string | null
  onChange: (dynasty: string | null) => void
}) {
  const { t } = useTranslation()

  // 后端可能返回 dynasty=null 的分组，但接口只支持按字符串精确过滤 —— 这类分组无法作为筛选条件，跳过
  const dynasties = useMemo(
    () => (stats?.by_dynasty ?? []).filter((item) => Boolean(item.dynasty)),
    [stats],
  )

  if (dynasties.length === 0 && !stats) return null

  const chipClass = (isActive: boolean) =>
    clsx(
      'px-2.5 py-1 rounded-full text-xs border transition-colors',
      isActive
        ? 'bg-primary-700 text-white border-primary-700 dark:bg-primary-600 dark:border-primary-600'
        : 'bg-white dark:bg-neutral-900 border-[var(--border-color)] text-[var(--text-secondary)] hover:border-primary-400 dark:hover:border-primary-600',
    )

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={active === null}
        className={chipClass(active === null)}
      >
        {t('ai.knowledge.allDynasties')}
        {stats ? <span className="ml-1 opacity-70 tabular-nums">{stats.total_books}</span> : null}
      </button>
      {dynasties.map((item) => (
        <button
          key={item.dynasty ?? 'unknown'}
          type="button"
          onClick={() => onChange(active === item.dynasty ? null : item.dynasty)}
          aria-pressed={active === item.dynasty}
          className={chipClass(active === item.dynasty)}
        >
          {item.dynasty}
          <span className="ml-1 opacity-70 tabular-nums">{item.count}</span>
        </button>
      ))}
    </div>
  )
}

/** 单行展开后的书目详情（metadata：行数 / 预估块数 / 原始文件 + checksum 前 12 位） */
function BookDetail({ book }: { book: KnowledgeSource }) {
  const { t } = useTranslation()
  const metadata = book.metadata ?? {}

  const fields = [
    { key: 'lines', label: t('ai.knowledge.linesLabel'), value: metaText(metadata.lines), mono: false },
    {
      key: 'estimatedChunks',
      label: t('ai.knowledge.estimatedChunks'),
      value: metaText(metadata.estimated_chunks),
      mono: false,
    },
    {
      key: 'originalFile',
      label: t('ai.knowledge.originalFile'),
      value: metaText(metadata.original_file),
      mono: false,
    },
    {
      key: 'checksum',
      label: t('ai.knowledge.checksum'),
      value: book.checksum ? book.checksum.slice(0, CHECKSUM_PREVIEW_LENGTH) : '—',
      mono: true,
    },
  ]

  return (
    <div className="px-3 pb-3 pt-1 bg-neutral-50/70 dark:bg-neutral-900/40">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
        {t('ai.knowledge.bookDetail')}
      </p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {fields.map((field) => (
          <div key={field.key} className="min-w-0 text-xs">
            <dt className="text-[var(--text-muted)]">{field.label}</dt>
            <dd
              className={clsx(
                'mt-0.5 truncate text-[var(--text-primary)] dark:text-neutral-200',
                field.mono && 'font-mono',
              )}
              title={field.value}
            >
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ═══════════════════════════════════════════
// 主面板
// ═══════════════════════════════════════════

export function AncientBooksPanel() {
  const { t, i18n } = useTranslation()
  const language = i18n.language || 'zh-CN'

  // 输入框即时值 vs 防抖后的查询值，二者分离才能既保持输入流畅又减少请求
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [dynasty, setDynasty] = useState<string | null>(null)
  const [sort, setSort] = useState<KnowledgeSourceSort>('dynasty_asc')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // 300ms 防抖：输入停顿后写入真正参与查询的 query，并把页码复位到第 1 页
  // （setState 在 setTimeout 回调内执行，不在 effect 内同步 setState）
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  // 朝代 / 排序切换后立即回到第 1 页，避免停留在越界页码上看到空列表
  const handleDynastyChange = (next: string | null) => {
    setDynasty(next)
    setPage(1)
  }

  const handleSortChange = (next: KnowledgeSourceSort) => {
    setSort(next)
    setPage(1)
  }

  const statsQuery = useQuery({
    queryKey: ['rag-knowledge-source-stats'],
    queryFn: getKnowledgeSourceStats,
    staleTime: 60_000,
  })

  const listQuery = useQuery({
    queryKey: ['rag-knowledge-sources', { q: query, dynasty, sort, page }],
    queryFn: () =>
      listKnowledgeSources({
        q: query || undefined,
        dynasty: dynasty ?? undefined,
        sort,
        page,
        page_size: PAGE_SIZE,
      }),
    // 翻页/切换筛选时保留上一页数据，避免整表闪成骨架
    placeholderData: keepPreviousData,
  })

  const items = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // 页码越界时不额外发请求也不渲染空列表：展示层钳制到末页
  const currentPage = Math.min(page, totalPages)

  const hasItems = items.length > 0
  // total > 0 时即便当前页越界（如筛选后数据收缩）也保留分页条，用户可自行翻回
  const showPager = !listQuery.isError && !listQuery.isLoading && (hasItems || total > 0)

  return (
    <div className="space-y-3">
      {/* 统计卡 */}
      <BooksStatCards
        stats={statsQuery.data}
        isLoading={statsQuery.isLoading}
        isError={statsQuery.isError}
      />

      {/* 朝代 chips */}
      <DynastyChips stats={statsQuery.data} active={dynasty} onChange={handleDynastyChange} />

      <Card className="overflow-hidden">
        {/* 工具栏：搜索 / 排序 / 刷新 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border-b border-[var(--border-color)]">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('ai.knowledge.searchBooksPlaceholder')}
              aria-label={t('ai.knowledge.searchBooksPlaceholder')}
              className="w-full pl-8 pr-8 py-1.5 text-sm border border-[var(--border-color)] rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {listQuery.isFetching && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <label
              htmlFor="ancient-books-sort"
              className="text-xs text-[var(--text-muted)] whitespace-nowrap"
            >
              {t('ai.knowledge.sortBy')}
            </label>
            <select
              id="ancient-books-sort"
              value={sort}
              onChange={(e) => handleSortChange(e.target.value as KnowledgeSourceSort)}
              className="px-2 py-1.5 text-xs border border-[var(--border-color)] rounded-lg bg-white dark:bg-neutral-900 text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(SORT_LABEL_KEYS[option])}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void listQuery.refetch()}
              title={t('ai.knowledge.refresh')}
              aria-label={t('ai.knowledge.refresh')}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <RefreshCw
                className={clsx(
                  'w-4 h-4 text-[var(--text-muted)]',
                  listQuery.isFetching && 'animate-spin',
                )}
              />
            </button>
          </div>
        </div>

        {/* 错误态 */}
        {listQuery.isError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center px-4">
            <AlertCircle className="w-6 h-6 text-error-500" />
            <p className="text-sm text-error-600 dark:text-error-400">
              {t('ai.knowledge.booksLoadError')}
            </p>
            <button
              type="button"
              onClick={() => {
                void listQuery.refetch()
                if (statsQuery.isError) void statsQuery.refetch()
              }}
              className="mt-1 px-3 py-1.5 text-xs rounded-lg bg-primary-700 hover:bg-primary-600 text-white transition-colors"
            >
              {t('ai.knowledge.retry')}
            </button>
          </div>
        ) : listQuery.isLoading ? (
          /* 加载骨架 */
          <div className="p-4 space-y-2" aria-busy="true">
            {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
              <div
                key={index}
                className="h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse"
              />
            ))}
          </div>
        ) : !hasItems ? (
          /* 空态 */
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center px-4">
            <BookOpen className="w-6 h-6 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-muted)]">{t('ai.knowledge.noBooks')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              {/* 表头 */}
              <div
                className="grid gap-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] bg-neutral-50 dark:bg-neutral-800/50"
                style={ROW_GRID_STYLE}
              >
                <span className="truncate">{t('ai.knowledge.bookTitle')}</span>
                <span className="truncate">{t('ai.knowledge.dynasty')}</span>
                <span className="truncate">{t('ai.knowledge.chunksLabel')}</span>
                <span className="truncate">{t('ai.knowledge.charsLabel')}</span>
                <span className="truncate">{t('ai.knowledge.importedAt')}</span>
                <span aria-hidden="true" />
              </div>

              {/* 数据行（点击展开详情） */}
              {items.map((book) => {
                const isExpanded = expandedId === book.id
                const meta = [book.dynasty, book.author].filter(Boolean).join(' · ')
                return (
                  <div
                    key={book.id}
                    className="border-t border-[var(--border-color)] first:border-t-0"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : book.id)}
                      aria-expanded={isExpanded}
                      className="w-full grid gap-3 px-3 py-2.5 text-left items-center hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                      style={ROW_GRID_STYLE}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <BookOpen className="w-3.5 h-3.5 flex-shrink-0 text-primary-600 dark:text-primary-500" />
                        <span
                          className="truncate text-sm font-medium text-[var(--text-primary)] dark:text-white"
                          title={book.display_name || book.title}
                        >
                          {book.display_name || book.title}
                        </span>
                      </span>
                      <span
                        className="truncate text-xs text-[var(--text-secondary)]"
                        title={meta || undefined}
                      >
                        {meta || '—'}
                      </span>
                      <span className="text-xs tabular-nums text-[var(--text-secondary)]">
                        {formatNumber(book.chunk_count, language)}
                      </span>
                      <span className="text-xs tabular-nums text-[var(--text-secondary)]">
                        {formatNumber(book.char_count, language)}
                      </span>
                      <span className="truncate text-xs text-[var(--text-muted)]">
                        {formatDate(book.imported_at, language)}
                      </span>
                      <span className="flex items-center justify-end">
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        )}
                      </span>
                    </button>
                    {isExpanded && <BookDetail book={book} />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 分页 */}
        {showPager && (
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-[var(--border-color)]">
            <span className="text-xs text-[var(--text-muted)] tabular-nums">
              {t('ai.knowledge.pageInfo', { current: currentPage, total: totalPages })}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1 || listQuery.isFetching}
                className={PAGER_BUTTON_CLASS}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                {t('ai.knowledge.prevPage')}
              </button>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages || listQuery.isFetching}
                className={PAGER_BUTTON_CLASS}
              >
                {t('ai.knowledge.nextPage')}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

export default AncientBooksPanel

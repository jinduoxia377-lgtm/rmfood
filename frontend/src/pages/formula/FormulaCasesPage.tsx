/**
 * 配方案例库页面 — 对齐 FormulaListPage 设计语言
 *
 * 与 /formulas 页面保持一致的视觉体系：
 * 1. 渐变 Hero Banner（primary-600 → primary-800）+ shadow-card-hover
 * 2. StatCard 组件展示统计（与配方页 4 卡片一致）
 * 3. 工具栏整合进 Hero 区域
 * 4. 统一使用 RMFOOD 设计令牌（text-display-lg / text-body-sm / surface-default）
 * 5. 零装饰渐变背景 — 卡片 hover 仅边框变色
 */
import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Search,
  Grid,
  List as ListIcon,
  Star,
  Eye,
  Heart,
  Bookmark,
  TrendingUp,
  ChevronRight,
  Plus,
  FileText,
  Award,
  X,
} from 'lucide-react'
import {
  getFormulaCases,
  getCaseStats,
  getCaseCategories,
  getTrendingCases,
  type FormulaCase,
  type CaseListParams,
} from '@/api/formula'
import {
  Card,
  CardContent,
  Button,
  Input,
  Select,
  StatCard,
} from '@/components/ui'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/Common'
import { cn } from '@/lib/utils'

// ── 分类色块映射 — 每类别独占色系，饱和度统一，柔和不抢视觉重心 ──
const CATEGORY_GRADIENTS = {
  '补气养血':   { from: 'from-danger-100', to: 'to-danger-50',   text: 'text-danger-700', darkText: 'text-danger-300' },
  '滋阴润燥':   { from: 'from-accent-100', to: 'to-accent-50', text: 'text-[var(--color-accent-text)]', darkText: 'text-[var(--color-accent-text)]' },
  '清热解毒':   { from: 'from-success-100', to: 'to-success-50',  text: 'text-[var(--color-success-text)]', darkText: 'text-[var(--color-success-text)]' },
  '活血化瘀':   { from: 'from-error-100', to: 'to-danger-50',    text: 'text-[var(--color-error-text)]', darkText: 'text-[var(--color-error-text)]' },
  '祛湿化浊':   { from: 'from-warning-100', to: 'to-warning-50', text: 'text-[var(--color-warning-text)]', darkText: 'text-[var(--color-warning-text)]' },
  '扶正固本':   { from: 'from-info-100', to: 'to-secondary-50',    text: 'text-info-700', darkText: 'text-info-300' },
  '疏肝理气':   { from: 'from-success-100', to: 'to-success-50',   text: 'text-[var(--color-success-text)]', darkText: 'text-[var(--color-success-text)]' },
  '化痰散结':   { from: 'from-accent-100', to: 'to-accent-50', text: 'text-[var(--color-accent-text)]', darkText: 'text-[var(--color-accent-text)]' },
  '安神定志':   { from: 'from-accent-100', to: 'to-secondary-50',  text: 'text-[var(--color-accent-text)]', darkText: 'text-[var(--color-accent-text)]' },
  '健脾和胃':   { from: 'from-warning-100', to: 'to-warning-50', text: 'text-[var(--color-warning-text)]', darkText: 'text-[var(--color-warning-text)]' },
  '补肾填精':   { from: 'from-success-100', to: 'to-success-50', text: 'text-[var(--color-success-text)]', darkText: 'text-[var(--color-success-text)]' },
  '清热利湿':   { from: 'from-info-100', to: 'to-info-50',     text: 'text-info-700', darkText: 'text-info-300' },
  '调和营卫':   { from: 'from-danger-100', to: 'to-danger-50',    text: 'text-danger-700', darkText: 'text-danger-300' },
  '通络止痛':   { from: 'from-neutral-100', to: 'to-neutral-50',   text: 'text-[var(--text-primary)]', darkText: 'text-[var(--text-muted)]' },
} as const

const DEFAULT_GRADIENT = { from: 'from-neutral-100', to: 'to-neutral-50', text: 'text-[var(--text-primary)]', darkText: 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]' }

function getCatGradient(cat?: string) {
  if (!cat) return DEFAULT_GRADIENT
  return (CATEGORY_GRADIENTS as Record<string, typeof DEFAULT_GRADIENT>)[cat] ?? DEFAULT_GRADIENT
}

// ── 分类徽章 ──────────────────────────────────────────────────
function CategoryChip({
  name, count, active, onClick,
}: {
  name: string; count: number; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--radius-pill)] text-sm font-medium transition-all duration-150 active:scale-95',
        active
          ? 'bg-primary-container text-[var(--color-primary)] shadow-sm'
          : 'bg-[var(--bg-canvas)] dark:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-color)] dark:hover:bg-[var(--bg-secondary)]',
      )}
    >
      {name}
      <span className={cn('text-xs', active ? 'text-white/70' : 'text-[var(--text-muted)]')}>{count}</span>
    </button>
  )
}

// ── 案例卡片（网格视图）───────────────────────────────────────
function CaseCard({ item }: { item: FormulaCase }) {
  const [imgError, setImgError] = useState(false)
  const grad = getCatGradient(item.category ?? undefined)

  return (
    <Link to={`/formulas/cases/${item.id}`} className="group block">
      <div className={cn(
        'card-hover relative rounded-[var(--radius-Apple-md)] overflow-hidden border border-neutral-default/50 dark:border-neutral-default/80 bg-[var(--bg-secondary)] transition-all duration-200',
      )}>
        {/* Cover */}
        {!imgError && item.cover_image ? (
          <div className="relative h-44 overflow-hidden">
            <img
              src={item.cover_image}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
              onError={() => setImgError(true)}
            />
            {/* 类别色调叠加 — 用固定背景色层，避免动态字符串拼接 */}
            <div className={cn('absolute inset-0 pointer-events-none', `bg-${grad.from.replace('from-', '')}/20`)} />
            {item.is_featured && (
              <div className="absolute top-[var(--space-apple-sm)] right-3">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-semibold bg-[var(--color-warning-container)]0/90 text-white backdrop-blur-sm">
                  <Star size={10} className="fill-white" />推荐
                </span>
              </div>
            )}
          </div>
        ) : (
          /* 无图占位：类别柔和渐变背景 */
          <div className={cn('h-36 bg-gradient-to-br flex items-center justify-center relative', grad.from, grad.to)}>
            {item.generated_by_ai && (
              <span className="absolute top-[var(--space-apple-sm)] right-3 px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-semibold bg-[var(--bg-secondary)]/70 dark:bg-black/30 text-[var(--text-secondary)] backdrop-blur-sm border border-white/40">
                AI
              </span>
            )}
            <span className={`text-5xl font-semibold select-none tracking-tight opacity-25 ${grad.text} dark:${grad.darkText}`}>
              {item.category?.slice(0, 2) ?? '方'}
            </span>
          </div>
        )}

        <div className="p-[var(--space-apple-md)]">
          {/* Title */}
          <h3 className="font-semibold text-[15px] text-[var(--text-primary)] leading-snug mb-1.5 line-clamp-1 group-hover:text-[var(--color-primary-text)] dark:group-hover:text-[var(--color-primary-text)] transition-colors">
            {item.title}
          </h3>

          {/* Summary */}
          <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-[var(--space-apple-sm)] leading-relaxed min-h-[2em]">
            {item.summary}
          </p>

          {/* Category + Tags */}
          <div className="flex flex-wrap items-center gap-1.5 mb-[var(--space-apple-sm)]">
            {item.category && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium bg-[var(--bg-canvas)] dark:bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                {item.category}
              </span>
            )}
            {item.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-Apple-sm)] text-xs bg-[var(--bg-canvas)] dark:bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                {tag}
              </span>
            ))}
          </div>

          {/* Meta Row */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-default/50 dark:border-neutral-default/80">
            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <Eye size={12} className="shrink-0" />
                <span className="font-medium tabular-nums text-[var(--text-muted)]">{item.views}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <Heart size={12} className="shrink-0" />
                <span className="font-medium tabular-nums text-[var(--text-muted)]">{item.likes}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <Bookmark size={12} className="shrink-0" />
                <span className="font-medium tabular-nums text-[var(--text-muted)]">{item.bookmarks ?? 0}</span>
              </span>
            </div>
            {item.formula_name && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] truncate max-w-[80px]" title={item.formula_name}>
                <FileText size={11} className="shrink-0" />
                <span className="truncate">{item.formula_name}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── 列表项（列表视图）─────────────────────────────────────────
function CaseListItem({ item }: { item: FormulaCase }) {
  return (
    <Link to={`/formulas/cases/${item.id}`} className="group block">
      <div className={cn(
        'card-hover flex items-center gap-4 px-5 py-3.5 rounded-[var(--radius-Apple-md)] border border-neutral-default/50 dark:border-neutral-default/80 bg-[var(--bg-secondary)] transition-all duration-200 cursor-pointer',
      )}>
        {/* Category label */}
        <div className="w-10 h-10 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-canvas)] dark:bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0 text-[var(--text-muted)] text-xs font-semibold">
          {item.category?.slice(0, 2) ?? '方'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h3 className="font-semibold text-[15px] text-[var(--text-primary)] truncate group-hover:text-[var(--color-primary-text)] dark:group-hover:text-[var(--color-primary-text)] transition-colors">
              {item.title}
            </h3>
            {item.is_featured && <Star size={13} className="text-[var(--color-warning-text)]0 shrink-0 fill-warning-500" />}
            {item.generated_by_ai && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium bg-[var(--bg-canvas)] dark:bg-[var(--bg-tertiary)] text-[var(--text-muted)]">AI</span>
            )}
          </div>
          <p className="text-sm text-[var(--text-muted)] line-clamp-1 mb-1.5">{item.summary}</p>
          <div className="flex items-center gap-[var(--space-apple-sm)] text-xs text-[var(--text-muted)] flex-wrap">
            <span className="inline-flex items-center gap-1"><Eye size={11} />{item.views}</span>
            <span className="inline-flex items-center gap-1"><Heart size={11} />{item.likes}</span>
            <span className="inline-flex items-center gap-1"><Bookmark size={11} />{item.bookmarks ?? 0}</span>
            {item.category && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-pill)] text-xs bg-[var(--bg-canvas)] dark:bg-[var(--bg-tertiary)] text-[var(--text-muted)]">{item.category}</span>
            )}
            {item.formula_name && <span className="flex items-center gap-1"><FileText size={11} />{item.formula_name}</span>}
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight size={16} className="text-neutral-default/50 dark:text-neutral-default/60 shrink-0 opacity-0 group-hover:opacity-100 group-hover:text-[var(--color-primary-text)] transition-all duration-150 group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}

// ── 分页组件 ──────────────────────────────────────────────────
function Pagination({
  page, total, pageSize, onPageChange,
}: {
  page: number; total: number; pageSize: number; onPageChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const pages: (number | string)[] = []
  const maxVisible = 5
  let start = Math.max(1, page - Math.floor(maxVisible / 2))
  const end = Math.min(totalPages, start + maxVisible - 1)
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1)

  for (let p = start; p <= end; p++) pages.push(p)
  if (start > 1) { pages.unshift('...'); pages.unshift(1) }
  if (end < totalPages) { pages.push('...'); pages.push(totalPages) }

  return (
    <div className="flex items-center justify-center gap-1.5 py-[var(--space-apple-lg)]">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-[var(--radius-Apple-sm)] transition-all active:scale-95"
      >
        上一页
      </Button>
      {pages.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i} className="px-2 text-[var(--text-muted)] text-[14px]">…</span>
        ) : (
          <button
            key={i}
            onClick={() => onPageChange(p)}
            className={cn(
              'w-8 h-8 rounded-[var(--radius-Apple-sm)] text-[14px] font-medium transition-all duration-150 active:scale-95',
              p === page
                ? 'bg-primary-container text-[var(--color-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:bg-surface-tertiary dark:hover:bg-[var(--bg-tertiary)]',
            )}
          >
            {p}
          </button>
        )
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-[var(--radius-Apple-sm)] transition-all active:scale-95"
      >
        下一页
      </Button>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────
export function FormulaCasesPage() {
  const [params, setParams] = useState<CaseListParams>({ page: 1, page_size: 20, sort_by: 'created_at', sort_dir: 'desc' })
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [showAllCategories, setShowAllCategories] = useState(false)

  // Debounce search
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(searchKeyword), 300)
    return () => clearTimeout(timer)
  }, [searchKeyword])

  const { data: casesData, isLoading } = useQuery({
    queryKey: ['formula-cases', { ...params, keyword: debouncedKeyword }],
    queryFn: () => getFormulaCases({ ...params, keyword: debouncedKeyword || undefined }),
  })

  const { data: stats } = useQuery({
    queryKey: ['formula-case-stats'],
    queryFn: getCaseStats,
  })

  const { data: categories } = useQuery({
    queryKey: ['formula-case-categories'],
    queryFn: getCaseCategories,
  })

  const { data: trending } = useQuery({
    queryKey: ['formula-cases-trending'],
    queryFn: () => getTrendingCases(5),
  })

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    setParams(prev => ({ ...prev, keyword: searchKeyword, page: 1 }))
  }, [searchKeyword])

  const handleCategoryClick = useCallback((cat: string) => {
    setActiveCategory(prev => prev === cat ? '' : cat)
    setParams(prev => ({ ...prev, category: prev.category === cat ? undefined : cat, page: 1 }))
  }, [])

  const total = casesData?.total ?? 0
  const cases = casesData?.cases ?? []
  const visibleCategories = showAllCategories ? (categories || []) : (categories || []).slice(0, 8)
  const hasMoreCategories = (categories?.length || 0) > 8

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 px-[var(--space-apple-md)] lg:px-6 py-[var(--space-apple-lg)]">

      {/* ── 渐变 Hero Banner（对齐 FormulaListPage）────────── */}
      <div className="rounded-[var(--radius-Apple-md)] bg-gradient-to-r from-[var(--color-primary-surface)] to-[var(--color-primary-surface-hover)] p-5 text-white shadow-card-hover">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Award size={18} className="text-white/80" />
              <h1 className="text-display-lg font-semibold leading-snug">配方案例库</h1>
            </div>
            <p className="text-white/90 text-body-sm">
              浏览成功的配方设计方案，获取灵感与参考 · 共{' '}
              <strong className="text-white">{stats?.total ?? '-'}</strong> 个案例，
              {stats?.featured ?? 0} 个推荐
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {/* View toggle */}
            <div className="flex items-center border border-white/30 rounded-[var(--radius-Apple-sm)] overflow-hidden bg-[var(--bg-secondary)]/10">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'px-[var(--space-apple-sm)] py-2 min-h-[44px] text-sm font-medium transition-colors',
                  viewMode === 'grid' ? 'bg-[var(--bg-secondary)]/20 text-[var(--color-primary-text)] dark:text-white' : 'text-[var(--color-primary-text)]/70 dark:text-white/70 hover:text-[var(--color-primary-text)] dark:hover:text-white',
                )}
              >
                <Grid size={14} className="inline mr-1" />网格
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'px-[var(--space-apple-sm)] py-2 min-h-[44px] text-sm font-medium transition-colors border-l border-white/20',
                  viewMode === 'list' ? 'bg-[var(--bg-secondary)]/20 text-[var(--color-primary-text)] dark:text-white' : 'text-[var(--color-primary-text)]/70 dark:text-white/70 hover:text-[var(--color-primary-text)] dark:hover:text-white',
                )}
              >
                <ListIcon size={14} className="inline mr-1" />列表
              </button>
            </div>

            {/* CTA */}
            <Link to="/formulas/new">
              <button className="px-[var(--space-apple-sm)] py-2 min-h-[44px] rounded-[var(--radius-Apple-sm)] text-sm font-medium bg-[var(--bg-secondary)]/10 text-[var(--color-primary-text)]/80 dark:text-white/80 hover:bg-[var(--bg-secondary)]/20 border border-white/30 transition-all active:scale-95">
                <Plus size={14} className="inline mr-1" />新建配方
              </button>
            </Link>
            <Link to="/formulas/cases/new">
              <Button variant="primary" icon={<Plus size={16} />} className="bg-[var(--bg-secondary)] text-[var(--color-primary-text)] hover:bg-[var(--bg-secondary)]/90 shadow-sm font-semibold">
                创建案例
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── 统计卡片（对齐 FormulaListPage 4 卡片布局）──────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-[var(--space-apple-sm)]">
        <StatCard label="案例总数" value={stats?.total ?? cases.length} icon={FileText} variant="primary" />
        <StatCard label="推荐案例" value={stats?.featured ?? 0} icon={Award} variant="warning" />
        <StatCard label="总浏览数" value={(stats?.total_views ?? 0).toLocaleString()} icon={TrendingUp} variant="info" />
        <StatCard label="总点赞数" value={(stats?.total_likes ?? 0).toLocaleString()} icon={Heart} variant="success" />
      </div>

      {/* ── 分类标签云 ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption font-medium text-[var(--text-muted)] shrink-0">分类</span>
        <CategoryChip name="全部" count={total} active={!activeCategory} onClick={() => handleCategoryClick('')} />
        {(visibleCategories ?? []).map((c: string) => (
          <CategoryChip
            key={c}
            name={c} count={0}
            active={activeCategory === c}
            onClick={() => handleCategoryClick(c)}
          />
        ))}
        {hasMoreCategories && (
          <button
            onClick={() => setShowAllCategories(!showAllCategories)}
            className="px-3.5 py-1.5 rounded-[var(--radius-pill)] text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-dashed border-neutral-default/50 dark:border-neutral-default/60 hover:border-[var(--color-primary)] transition-colors"
          >
            {showAllCategories ? '收起' : `更多 (${(categories?.length || 0) - 8})`}
          </button>
        )}
      </div>

      {/* ── 热门案例速览 ── */}
      {trending && trending.length > 0 && (
        <section aria-label="热门案例">
          <div className="flex items-center justify-between mb-[var(--space-apple-sm)]">
            <h2 className="text-body font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <TrendingUp size={16} className="text-[var(--color-primary-text)]0" />
              热门案例
            </h2>
            <Link to="/formulas/cases?sort_by=views&sort_dir=desc" className="text-sm text-[var(--color-primary-text)]0 hover:text-[var(--color-primary-text)] flex items-center gap-1 transition-colors">
              查看全部 <ChevronRight size={13} />
            </Link>
          </div>
          <div className="flex gap-[var(--space-apple-sm)] overflow-x-auto pb-1 scrollbar-hide">
            {trending.slice(0, 5).map((c: any) => {
              const cg = getCatGradient(c.category ?? undefined)
              return (
                <Link key={c.id} to={`/formulas/cases/${c.id}`} className="shrink-0 w-44 group">
                  <div className="card-hover rounded-[var(--radius-Apple-md)] overflow-hidden border border-neutral-default/50 dark:border-neutral-default/80 bg-[var(--bg-secondary)] active:scale-[0.98] transition-transform duration-150">
                    {c.cover_image ? (
                      <div className="relative h-24 overflow-hidden">
                        <img src={c.cover_image} alt={c.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-400" />
                        <div className={cn('absolute inset-0 pointer-events-none', `bg-${cg.from.replace('from-', '')}/15`)} />
                      </div>
                    ) : (
                      <div className={cn('w-full h-24 bg-gradient-to-br flex items-center justify-center', cg.from, cg.to)}>
                        <span className={`text-lg font-semibold select-none opacity-30 ${cg.text} dark:${cg.darkText}`}>{c.category?.slice(0, 2) ?? '方'}</span>
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--color-primary-text)] dark:group-hover:text-[var(--color-primary-text)] transition-colors">{c.title}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--text-muted)]">
                        <span className="inline-flex items-center gap-0.5"><Eye size={10} />{c.views}</span>
                        <span className="inline-flex items-center gap-0.5"><Heart size={10} />{c.likes}</span>
                        <span className="inline-flex items-center gap-0.5"><Bookmark size={10} />{c.bookmarks ?? 0}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── 搜索与筛选栏 ── */}
      <Card className="rounded-[var(--radius-Apple-md)] border-neutral-default/50 dark:border-neutral-default/80 bg-[var(--bg-secondary)]">
        <CardContent className="p-[var(--space-apple-md)]">
          <form onSubmit={handleSearch} className="flex gap-[var(--space-apple-sm)] mb-[var(--space-apple-sm)]">
            <Input
              placeholder="搜索案例标题、简介..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="max-w-md"
              prefix={<Search size={15} className="text-[var(--text-muted)]" />}
              suffix={
                searchKeyword ? (
                  <button onClick={() => setSearchKeyword('')} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                    <X size={14} />
                  </button>
                ) : null
              }
            />
            <Button type="submit" variant="primary" className="rounded-[var(--radius-Apple-sm)]">搜索</Button>
          </form>

          <div className="flex items-center gap-[var(--space-apple-sm)] flex-wrap">
            <Select
              value={params.category || ''}
              onChange={(v) =>
                setParams(prev => ({ ...prev, category: v || undefined, page: 1 }))
              }
              className="min-w-[140px]"
            >
              <option value="">全部分类</option>
              {(categories ?? []).map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>

            <Select
              value={params.sort_by || 'created_at'}
              onChange={(v) =>
                setParams(prev => ({ ...prev, sort_by: v, page: 1 }))
              }
              className="min-w-[120px]"
            >
              <option value="created_at">最新创建</option>
              <option value="views">最多浏览</option>
              <option value="likes">最多点赞</option>
              <option value="bookmarks">最多收藏</option>
              <option value="title">按名称</option>
            </Select>

            <Select
              value={params.sort_dir || 'desc'}
              onChange={(v) =>
                setParams(prev => ({ ...prev, sort_dir: (v || 'desc') as 'asc' | 'desc', page: 1 }))
              }
              className="min-w-[100px]"
            >
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </Select>

            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={params.featured_only || false}
                onChange={(e) => setParams(prev => ({ ...prev, featured_only: e.target.checked, page: 1 }))}
                className="rounded border-neutral-default/50 dark:border-neutral-default/60 accent-[var(--color-primary)] w-4 h-4"
              />
              <Star size={13} className="text-[var(--color-warning-text)]0 shrink-0" />仅推荐
            </label>
          </div>
        </CardContent>
      </Card>

      {/* ── 案例列表 ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-[var(--radius-Apple-md)] overflow-hidden border border-neutral-default/50 dark:border-neutral-default/80 bg-[var(--bg-secondary)]">
              <div className="h-44 bg-[var(--bg-canvas)] dark:bg-[var(--bg-tertiary)] animate-pulse" />
              <div className="p-[var(--space-apple-md)] space-y-2">
                <Skeleton className="h-4 w-3/4 rounded-[var(--radius-pill)]" />
                <Skeleton className="h-3 w-full rounded-[var(--radius-pill)]" />
                <Skeleton className="h-3 w-1/2 rounded-[var(--radius-pill)]" />
                <div className="flex items-center gap-[var(--space-apple-sm)] pt-2">
                  <Skeleton className="h-3 w-8 rounded-[var(--radius-pill)]" />
                  <Skeleton className="h-3 w-8 rounded-[var(--radius-pill)]" />
                  <Skeleton className="h-3 w-8 rounded-[var(--radius-pill)]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : cases.length === 0 ? (
        <Card className="rounded-[var(--radius-Apple-md)] border-neutral-default/50 dark:border-neutral-default/80 bg-[var(--bg-secondary)]">
          <CardContent className="py-16 text-center">
            <EmptyState
              icon={<FileText size={48} className="text-neutral-default/40 dark:text-neutral-default/60" />}
              title="暂无案例"
              description="分享你的配方设计经验，帮助用户获取灵感"
              action={
                <Link to="/formulas/cases/new">
                  <Button variant="primary" icon={<Plus size={15} />}>
                    创建第一个案例
                  </Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cases.map((c) => <CaseCard key={c.id} item={c} />)}
        </div>
      ) : (
        <div className="space-y-2">
          {cases.map((c) => <CaseListItem key={c.id} item={c} />)}
        </div>
      )}

      {/* ── 分页 ── */}
      <Pagination
        page={params.page ?? 1}
        total={total}
        pageSize={params.page_size ?? 20}
        onPageChange={(p) => setParams(prev => ({ ...prev, page: p }))}
      />
    </div>
  )
}

export default FormulaCasesPage

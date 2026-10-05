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
  '补气养血':   { from: 'from-rose-100', to: 'to-rose-50',   text: 'text-rose-700', darkText: 'text-rose-300' },
  '滋阴润燥':   { from: 'from-violet-100', to: 'to-fuchsia-50', text: 'text-violet-700', darkText: 'text-violet-300' },
  '清热解毒':   { from: 'from-emerald-100', to: 'to-teal-50',  text: 'text-emerald-700', darkText: 'text-emerald-300' },
  '活血化瘀':   { from: 'from-red-100', to: 'to-rose-50',    text: 'text-red-700', darkText: 'text-red-300' },
  '祛湿化浊':   { from: 'from-amber-100', to: 'to-orange-50', text: 'text-amber-700', darkText: 'text-amber-300' },
  '扶正固本':   { from: 'from-sky-100', to: 'to-blue-50',    text: 'text-sky-700', darkText: 'text-sky-300' },
  '疏肝理气':   { from: 'from-green-100', to: 'to-lime-50',   text: 'text-green-700', darkText: 'text-green-300' },
  '化痰散结':   { from: 'from-purple-100', to: 'to-violet-50', text: 'text-purple-700', darkText: 'text-purple-300' },
  '安神定志':   { from: 'from-indigo-100', to: 'to-blue-50',  text: 'text-indigo-700', darkText: 'text-indigo-300' },
  '健脾和胃':   { from: 'from-orange-100', to: 'to-amber-50', text: 'text-orange-700', darkText: 'text-orange-300' },
  '补肾填精':   { from: 'from-teal-100', to: 'to-emerald-50', text: 'text-teal-700', darkText: 'text-teal-300' },
  '清热利湿':   { from: 'from-cyan-100', to: 'to-sky-50',     text: 'text-cyan-700', darkText: 'text-cyan-300' },
  '调和营卫':   { from: 'from-pink-100', to: 'to-rose-50',    text: 'text-pink-700', darkText: 'text-pink-300' },
  '通络止痛':   { from: 'from-slate-100', to: 'to-zinc-50',   text: 'text-slate-700', darkText: 'text-slate-300' },
} as const

const DEFAULT_GRADIENT = { from: 'from-neutral-100', to: 'to-neutral-50', text: 'text-neutral-700', darkText: 'text-neutral-300' }

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
        'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-150 active:scale-95',
        active
          ? 'bg-primary-500 text-white shadow-sm'
          : 'bg-[var(--bg-canvas)] dark:bg-neutral-800 text-text-secondary hover:bg-neutral-200 dark:hover:bg-neutral-700',
      )}
    >
      {name}
      <span className={cn('text-[11px]', active ? 'text-white/70' : 'text-text-disabled')}>{count}</span>
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
        'card-hover relative rounded-xl overflow-hidden border border-neutral-default/50 dark:border-neutral-default/80 bg-surface-default transition-all duration-200',
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
              <div className="absolute top-3 right-3">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-warning-500/90 text-white backdrop-blur-sm">
                  <Star size={10} className="fill-white" />推荐
                </span>
              </div>
            )}
          </div>
        ) : (
          /* 无图占位：类别柔和渐变背景 */
          <div className={cn('h-36 bg-gradient-to-br flex items-center justify-center relative', grad.from, grad.to)}>
            {item.generated_by_ai && (
              <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/70 dark:bg-black/30 text-text-secondary backdrop-blur-sm border border-white/40">
                AI
              </span>
            )}
            <span className={`text-5xl font-semibold select-none tracking-tight opacity-25 ${grad.text} dark:${grad.darkText}`}>
              {item.category?.slice(0, 2) ?? '方'}
            </span>
          </div>
        )}

        <div className="p-4">
          {/* Title */}
          <h3 className="font-semibold text-[15px] text-text-primary leading-snug mb-1.5 line-clamp-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {item.title}
          </h3>

          {/* Summary */}
          <p className="text-[13px] text-text-muted line-clamp-2 mb-3 leading-relaxed min-h-[2em]">
            {item.summary}
          </p>

          {/* Category + Tags */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {item.category && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--bg-canvas)] dark:bg-neutral-800 text-text-muted">
                {item.category}
              </span>
            )}
            {item.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] bg-[var(--bg-canvas)] dark:bg-neutral-800 text-text-disabled">
                {tag}
              </span>
            ))}
          </div>

          {/* Meta Row */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-default/50 dark:border-neutral-default/80">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-[11px] text-text-disabled">
                <Eye size={12} className="shrink-0" />
                <span className="font-medium tabular-nums text-text-muted">{item.views}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-text-disabled">
                <Heart size={12} className="shrink-0" />
                <span className="font-medium tabular-nums text-text-muted">{item.likes}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-text-disabled">
                <Bookmark size={12} className="shrink-0" />
                <span className="font-medium tabular-nums text-text-muted">{item.bookmarks ?? 0}</span>
              </span>
            </div>
            {item.formula_name && (
              <span className="inline-flex items-center gap-1 text-[11px] text-text-disabled truncate max-w-[80px]" title={item.formula_name}>
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
        'card-hover flex items-center gap-4 px-5 py-3.5 rounded-xl border border-neutral-default/50 dark:border-neutral-default/80 bg-surface-default transition-all duration-200 cursor-pointer',
      )}>
        {/* Category label */}
        <div className="w-10 h-10 rounded-lg bg-[var(--bg-canvas)] dark:bg-neutral-800 flex items-center justify-center shrink-0 text-text-muted text-xs font-semibold">
          {item.category?.slice(0, 2) ?? '方'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h3 className="font-semibold text-[15px] text-text-primary truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              {item.title}
            </h3>
            {item.is_featured && <Star size={13} className="text-warning-500 shrink-0 fill-warning-500" />}
            {item.generated_by_ai && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[var(--bg-canvas)] dark:bg-neutral-800 text-text-disabled">AI</span>
            )}
          </div>
          <p className="text-[13px] text-text-muted line-clamp-1 mb-1.5">{item.summary}</p>
          <div className="flex items-center gap-3 text-[11px] text-text-disabled flex-wrap">
            <span className="inline-flex items-center gap-1"><Eye size={11} />{item.views}</span>
            <span className="inline-flex items-center gap-1"><Heart size={11} />{item.likes}</span>
            <span className="inline-flex items-center gap-1"><Bookmark size={11} />{item.bookmarks ?? 0}</span>
            {item.category && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] bg-[var(--bg-canvas)] dark:bg-neutral-800 text-text-muted">{item.category}</span>
            )}
            {item.formula_name && <span className="flex items-center gap-1"><FileText size={11} />{item.formula_name}</span>}
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight size={16} className="text-neutral-default/50 dark:text-neutral-default/60 shrink-0 opacity-0 group-hover:opacity-100 group-hover:text-primary-500 transition-all duration-150 group-hover:translate-x-0.5" />
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
  let end = Math.min(totalPages, start + maxVisible - 1)
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1)

  for (let p = start; p <= end; p++) pages.push(p)
  if (start > 1) { pages.unshift('...'); pages.unshift(1) }
  if (end < totalPages) { pages.push('...'); pages.push(totalPages) }

  return (
    <div className="flex items-center justify-center gap-1.5 py-6">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-lg transition-all active:scale-95"
      >
        上一页
      </Button>
      {pages.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i} className="px-2 text-text-disabled text-[14px]">…</span>
        ) : (
          <button
            key={i}
            onClick={() => onPageChange(p)}
            className={cn(
              'w-8 h-8 rounded-lg text-[14px] font-medium transition-all duration-150 active:scale-95',
              p === page
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-text-secondary hover:bg-surface-tertiary dark:hover:bg-neutral-800',
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
        className="rounded-lg transition-all active:scale-95"
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
    <div className="max-w-7xl mx-auto space-y-6 px-4 lg:px-6 py-6">

      {/* ── 渐变 Hero Banner（对齐 FormulaListPage）────────── */}
      <div className="rounded-xl bg-gradient-to-r from-primary-600 to-primary-800 p-5 text-white shadow-card-hover">
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
            <div className="flex items-center border border-white/30 rounded-lg overflow-hidden bg-white/10">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'px-3 py-2 min-h-[44px] text-sm font-medium transition-colors',
                  viewMode === 'grid' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white',
                )}
              >
                <Grid size={14} className="inline mr-1" />网格
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'px-3 py-2 min-h-[44px] text-sm font-medium transition-colors border-l border-white/20',
                  viewMode === 'list' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white',
                )}
              >
                <ListIcon size={14} className="inline mr-1" />列表
              </button>
            </div>

            {/* CTA */}
            <Link to="/formulas/new">
              <button className="px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium bg-white/10 text-white/80 hover:bg-white/20 border border-white/30 transition-all active:scale-95">
                <Plus size={14} className="inline mr-1" />新建配方
              </button>
            </Link>
            <Link to="/formulas/cases/new">
              <Button variant="primary" icon={<Plus size={16} />} className="bg-white text-primary-600 hover:bg-white/90 shadow-sm font-semibold">
                创建案例
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── 统计卡片（对齐 FormulaListPage 4 卡片布局）──────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="案例总数" value={stats?.total ?? cases.length} icon={FileText} variant="primary" />
        <StatCard label="推荐案例" value={stats?.featured ?? 0} icon={Award} variant="warning" />
        <StatCard label="总浏览数" value={(stats?.total_views ?? 0).toLocaleString()} icon={TrendingUp} variant="info" />
        <StatCard label="总点赞数" value={(stats?.total_likes ?? 0).toLocaleString()} icon={Heart} variant="success" />
      </div>

      {/* ── 分类标签云 ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption font-medium text-text-muted shrink-0">分类</span>
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
            className="px-3.5 py-1.5 rounded-full text-[13px] text-text-muted hover:text-text-primary border border-dashed border-neutral-default/50 dark:border-neutral-default/60 hover:border-primary-400 transition-colors"
          >
            {showAllCategories ? '收起' : `更多 (${(categories?.length || 0) - 8})`}
          </button>
        )}
      </div>

      {/* ── 热门案例速览 ── */}
      {trending && trending.length > 0 && (
        <section aria-label="热门案例">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-body font-semibold text-text-primary flex items-center gap-2">
              <TrendingUp size={16} className="text-primary-500" />
              热门案例
            </h2>
            <Link to="/formulas/cases?sort_by=views&sort_dir=desc" className="text-[13px] text-primary-500 hover:text-primary-600 flex items-center gap-1 transition-colors">
              查看全部 <ChevronRight size={13} />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {trending.slice(0, 5).map((c: any) => {
              const cg = getCatGradient(c.category ?? undefined)
              return (
                <Link key={c.id} to={`/formulas/cases/${c.id}`} className="shrink-0 w-44 group">
                  <div className="card-hover rounded-xl overflow-hidden border border-neutral-default/50 dark:border-neutral-default/80 bg-surface-default active:scale-[0.98] transition-transform duration-150">
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
                      <p className="text-[13px] font-medium text-text-primary truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{c.title}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-text-disabled">
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
      <Card className="rounded-xl border-neutral-default/50 dark:border-neutral-default/80 bg-surface-default">
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-3 mb-3">
            <Input
              placeholder="搜索案例标题、简介..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="max-w-md"
              prefix={<Search size={15} className="text-text-disabled" />}
              suffix={
                searchKeyword ? (
                  <button onClick={() => setSearchKeyword('')} className="text-text-disabled hover:text-text-primary transition-colors">
                    <X size={14} />
                  </button>
                ) : null
              }
            />
            <Button type="submit" variant="primary" className="rounded-lg">搜索</Button>
          </form>

          <div className="flex items-center gap-3 flex-wrap">
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

            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={params.featured_only || false}
                onChange={(e) => setParams(prev => ({ ...prev, featured_only: e.target.checked, page: 1 }))}
                className="rounded border-neutral-default/50 dark:border-neutral-default/60 accent-primary-500 w-4 h-4"
              />
              <Star size={13} className="text-warning-500 shrink-0" />仅推荐
            </label>
          </div>
        </CardContent>
      </Card>

      {/* ── 案例列表 ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-neutral-default/50 dark:border-neutral-default/80 bg-surface-default">
              <div className="h-44 bg-[var(--bg-canvas)] dark:bg-neutral-800 animate-pulse" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4 rounded-full" />
                <Skeleton className="h-3 w-full rounded-full" />
                <Skeleton className="h-3 w-1/2 rounded-full" />
                <div className="flex items-center gap-3 pt-2">
                  <Skeleton className="h-3 w-8 rounded-full" />
                  <Skeleton className="h-3 w-8 rounded-full" />
                  <Skeleton className="h-3 w-8 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : cases.length === 0 ? (
        <Card className="rounded-xl border-neutral-default/50 dark:border-neutral-default/80 bg-surface-default">
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

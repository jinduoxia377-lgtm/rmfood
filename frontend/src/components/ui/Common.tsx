/**
 * RMFOOD 设计系统 — 通用组件
 * StatusBadge / EmptyState / Skeleton / Pagination
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Inbox, FlaskConical, AlertTriangle, Lock } from 'lucide-react'

/* ═══════════════════════════════════════════
   StatusBadge 状态标签
   ═══════════════════════════════════════════ */

interface StatusBadgeProps {
  status: string
  className?: string
  size?: 'sm' | 'md'
}

const statusConfig: Record<string, { label: string; cls: string; dot?: string }> = {
  // 配方状态
  draft:          { label: '草稿',   cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' },
  pending_review: { label: '待审核', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', dot: 'bg-amber-500' },
  approved:       { label: '已通过', cls: 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300', dot: 'bg-primary-500' },
  rejected:       { label: '已驳回', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', dot: 'bg-rose-500' },
  archived:       { label: '已归档', cls: 'bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-500', dot: 'bg-slate-300' },
  // 实验状态
  planned:     { label: '计划中', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300', dot: 'bg-sky-500' },
  in_progress: { label: '进行中', cls: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', dot: 'bg-violet-500' },
  completed:   { label: '已完成', cls: 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300', dot: 'bg-primary-500' },
  failed:      { label: '已失败', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', dot: 'bg-rose-500' },
  cancelled:   { label: '已取消', cls: 'bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-500', dot: 'bg-slate-300' },
}

export function StatusBadge({ status, className, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-px text-[11px]' : 'px-2.5 py-0.5 text-xs',
        config.cls,
        className,
      )}
    >
      {config.dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', config.dot)} />
      )}
      {config.label}
    </span>
  )
}

/* ═══════════════════════════════════════════
   EmptyState 空状态（增强版：支持空/错误/无权限状态）
   ═══════════════════════════════════════════ */

type EmptyStateVariant = 'empty' | 'error' | 'forbidden'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  variant?: EmptyStateVariant
  titleClassName?: string
  descriptionClassName?: string
}

const VARIANT_CONFIG: Record<EmptyStateVariant, { iconBg: string; iconColor: string; containerClass: string }> = {
  empty: {
    iconBg: 'bg-slate-100 dark:bg-slate-800',
    iconColor: 'text-slate-400 dark:text-slate-500',
    containerClass: '',
  },
  error: {
    iconBg: 'bg-red-100 dark:bg-red-900/20',
    iconColor: 'text-red-500 dark:text-red-400',
    containerClass: '',
  },
  forbidden: {
    iconBg: 'bg-amber-100 dark:bg-amber-900/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    containerClass: '',
  },
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'empty',
  titleClassName = '',
  descriptionClassName = '',
}: EmptyStateProps) {
  const config = VARIANT_CONFIG[variant]

  const defaultIcon = variant === 'error'
    ? <AlertTriangle size={48} strokeWidth={1.5} />
    : variant === 'forbidden'
      ? <Lock size={48} strokeWidth={1.5} />
      : <FlaskConical size={48} strokeWidth={1.5} />

  return (
    <div className={`flex flex-col items-center justify-center py-12 md:py-16 px-4 text-center ${config.containerClass}`}>
      <div className={`mb-4 w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center ${config.iconBg} ${config.iconColor}`}>
        {icon ?? defaultIcon}
      </div>
      <h3 className={`text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-100 ${titleClassName}`}>{title}</h3>
      {description && (
        <p className={`mt-2 max-w-md text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed ${descriptionClassName}`}>{description}</p>
      )}
      {action && (
        <div className="mt-6 md:mt-8">
          {action}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════
   Skeleton 骨架屏
   ═══════════════════════════════════════════ */

interface SkeletonProps {
  className?: string
  lines?: number
}

export function Skeleton({ className, lines }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'skeleton',
              i === lines - 1 && 'w-3/4',
              className,
            )}
          />
        ))}
      </div>
    )
  }
  return <div className={cn('skeleton', className)} />
}

/* ═══════════════════════════════════════════
   Pagination 分页
   ═══════════════════════════════════════════ */

interface PaginationProps {
  // 兼容模式: currentPage + totalPages
  currentPage?: number
  totalPages?: number
  // 标准模式: page + pageSize + total
  page?: number
  pageSize?: number
  total?: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({
  // 兼容模式
  currentPage,
  totalPages: tp,
  // 标准模式
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: PaginationProps) {
  // 优先使用兼容模式
  const _page = currentPage ?? page ?? 1
  const totalPages = tp ?? (pageSize && total ? Math.ceil(total / pageSize) : 1)

  if (totalPages <= 1) return null

  // 生成页码：首页 ... 当前页附近 ... 末页
  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = [1]
    if (_page > 3) pages.push('...')
    for (let i = Math.max(2, _page - 1); i <= Math.min(totalPages - 1, _page + 1); i++) {
      pages.push(i)
    }
    if (_page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
  }

  const pages = getPageNumbers()

  return (
    <nav className={cn('flex items-center justify-between gap-4', className)} aria-label="分页">
      {/* 信息 */}
      <span className="text-sm text-slate-500 dark:text-slate-400">
        共 <span className="font-medium text-slate-700 dark:text-slate-300">{total ?? (tp ? _page * 10 : 0)}</span> 条
      </span>

      {/* 页码 */}
      <div className="flex items-center gap-1">
        {/* 上一页 */}
        <button
          onClick={() => onPageChange(_page - 1)}
          disabled={_page <= 1}
          className={cn(
            'inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-all duration-150',
            'border border-slate-200 dark:border-slate-700',
            'hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
          )}
          aria-label="上一页"
        >
          <ChevronLeft size={16} />
        </button>

        {/* 页码按钮 */}
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="w-8 h-8 flex items-center justify-center text-slate-400 text-sm">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                'w-8 h-8 rounded-lg text-sm font-medium transition-all duration-150',
                p === _page
                  ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
              )}
              aria-current={p === _page ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}

        {/* 下一页 */}
        <button
          onClick={() => onPageChange(_page + 1)}
          disabled={_page >= totalPages}
          className={cn(
            'inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-all duration-150',
            'border border-slate-200 dark:border-slate-700',
            'hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
          )}
          aria-label="下一页"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  )
}

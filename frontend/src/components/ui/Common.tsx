/**
 * RMFOOD 设计系统 — 通用组件
 * StatusBadge / EmptyState / Skeleton / Pagination
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, FlaskConical, AlertTriangle, Lock } from 'lucide-react'

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
  draft:          { label: '草稿',   cls: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700', dot: 'bg-neutral-400' },
  pending_review: { label: '待审核', cls: 'bg-warning-50 text-warning-700 dark:bg-warning-300/25 dark:text-warning-700 border border-warning-200 dark:border-warning-800', dot: 'bg-warning-500' },
  approved:       { label: '已通过', cls: 'bg-primary-50 text-primary-700 dark:bg-primary-300/25 dark:text-primary-700 border border-primary-200 dark:border-primary-800', dot: 'bg-primary-500' },
  rejected:       { label: '已驳回', cls: 'bg-error-50 text-error-700 dark:bg-error-300/25 dark:text-error-600 border border-error-200 dark:border-error-800', dot: 'bg-danger-500' },
  archived:       { label: '已归档', cls: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700', dot: 'bg-neutral-300' },
  // 实验状态
  planned:     { label: '计划中', cls: 'bg-info-50 text-info-700 dark:bg-info-300/25 dark:text-info-700 border border-info-200 dark:border-info-800', dot: 'bg-info-500' },
  in_progress: { label: '进行中', cls: 'bg-accent-50 text-accent-700 dark:bg-accent-300/25 dark:text-accent-700 border border-accent-200 dark:border-accent-800', dot: 'bg-accent-500' },
  completed:   { label: '已完成', cls: 'bg-primary-50 text-primary-700 dark:bg-primary-300/25 dark:text-primary-700 border border-primary-200 dark:border-primary-800', dot: 'bg-primary-500' },
  failed:      { label: '已失败', cls: 'bg-error-50 text-error-700 dark:bg-error-300/25 dark:text-error-600 border border-error-200 dark:border-error-800', dot: 'bg-danger-500' },
  cancelled:   { label: '已取消', cls: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700', dot: 'bg-neutral-300' },
}

export function StatusBadge({ status, className, size = 'md' }: StatusBadgeProps) {
  const { t } = useTranslation()
  const key = status.toLowerCase()
  const config = statusConfig[key] ?? statusConfig[status] ?? { label: status, cls: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400', dot: 'bg-neutral-400' }
  const label = t(`common.statusLabels.${key}`, { defaultValue: config.label })
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-px text-xs' : 'px-2.5 py-0.5 text-xs',
        config.cls,
        className,
      )}
    >
      {config.dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', config.dot)} />
      )}
      {label}
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
    iconBg: 'bg-neutral-100 dark:bg-neutral-800',
    iconColor: 'text-neutral-400 dark:text-neutral-400',
    containerClass: '',
  },
  error: {
    iconBg: 'bg-error-100 dark:bg-error-300/20',
    iconColor: 'text-error-500 dark:text-error-600',
    containerClass: '',
  },
  forbidden: {
    iconBg: 'bg-warning-100 dark:bg-warning-300/20',
    iconColor: 'text-warning-600 dark:text-warning-700',
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
      <h3 className={`text-lg md:text-xl font-semibold text-neutral-900 dark:text-neutral-100 ${titleClassName}`}>{title}</h3>
      {description && (
        <p className={`mt-2 max-w-md text-sm md:text-base text-neutral-500 dark:text-neutral-400 leading-relaxed ${descriptionClassName}`}>{description}</p>
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
      <span className="text-sm text-neutral-500 dark:text-neutral-400">
        共 <span className="font-medium text-neutral-700 dark:text-neutral-300">{total ?? (tp ? _page * 10 : 0)}</span> 条
      </span>

      {/* 页码 */}
      <div className="flex items-center gap-1">
        {/* 上一页 */}
        <button
          onClick={() => onPageChange(_page - 1)}
          disabled={_page <= 1}
          className={cn(
            'inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-all duration-150',
            'border border-neutral-200 dark:border-neutral-700',
            'hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
          )}
          aria-label="上一页"
        >
          <ChevronLeft size={16} />
        </button>

        {/* 页码按钮 */}
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="w-8 h-8 flex items-center justify-center text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-sm">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                'w-8 h-8 rounded-lg text-sm font-medium transition-all duration-150',
                p === _page
                  ? 'bg-primary-container text-primary-main shadow-sm shadow-primary-600/20'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800',
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
            'border border-neutral-200 dark:border-neutral-700',
            'hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600',
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

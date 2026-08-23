/**
 * RMFOOD — 全局 Loading 骨架组件集
 *
 * 提供多种场景骨架屏:
 * TableSkeleton — 表格列表骨架（配方/实验/审计日志）
 * ListSkeleton — 卡片列表骨架（通知/工作流）
 * DetailSkeleton — 详情页骨架（配方详情/实验详情）
 * CardSkeleton — 统计卡片骨架
 * FormSkeleton — 表单骨架（新建/编辑页面）
 * ChartSkeleton — 图表区域骨架
 *
 * 所有组件均使用 .skeleton CSS class（已有 shimmer 动画）
 */
import { cn } from'@/lib/utils'

/* ═══════════════════════════════════════════
 TableSkeleton 表格骨架
 ═══════════════════════════════════════════ */

interface TableSkeletonProps {
 /** 表格行数 */
 rows?: number
 /** 表格列数（不含操作列） */
 columns?: number
 /** 是否显示操作列 */
 hasActions?: boolean
 className?: string
}

export function TableSkeleton({ rows = 5, columns = 4, hasActions = true, className }: TableSkeletonProps) {
 return (
 <div className={cn('space-y-3', className)}>
 {/* 表头 */}
 <div className="flex items-center gap-4 px-4 py-2.5">
 {Array.from({ length: columns }).map((_, i) => (
 <div
 key={`th-${i}`}
 className="skeleton h-4 rounded"
 style={{ width: i === 0 ?'28%' : i === 1 ?'24%' : `${Math.floor(60 / columns)}%`, flexShrink: 0 }}
 />
 ))}
 {hasActions && <div className="skeleton h-4 w-16 rounded ml-auto" />}
 </div>

 {/* 表格行 */}
 {Array.from({ length: rows }).map((_, row) => (
 <div
 key={`row-${row}`}
 className="card flex items-center gap-4 px-4 py-3.5"
 >
 {/* 复选框 */}
 <div className="skeleton w-4 h-4 rounded shrink-0" />
 {/* 数据列 */}
 {Array.from({ length: columns }).map((_, col) => (
 <div
 key={`cell-${row}-${col}`}
 className="skeleton h-4 rounded"
 style={{
 width: col === 0 ?'28%' : col === 1 ?'24%' : `${Math.floor(60 / columns)}%`,
 flexShrink: 0,
 }}
 />
 ))}
 {/* 操作列 */}
 {hasActions && (
 <div className="flex items-center gap-1.5 ml-auto">
 <div className="skeleton w-7 h-7 rounded-lg" />
 <div className="skeleton w-7 h-7 rounded-lg" />
 <div className="skeleton w-7 h-7 rounded-lg" />
 </div>
 )}
 </div>
 ))}

 {/* 分页 */}
 <div className="flex items-center justify-between px-2 pt-2">
 <div className="skeleton h-4 w-24 rounded" />
 <div className="flex items-center gap-1.5">
 <div className="skeleton w-8 h-8 rounded-lg" />
 {Array.from({ length: 5 }).map((_, i) => (
 <div key={`pg-${i}`} className="skeleton w-8 h-8 rounded-lg" />
 ))}
 <div className="skeleton w-8 h-8 rounded-lg" />
 </div>
 </div>
 </div>
 )
}

/* ═══════════════════════════════════════════
 ListSkeleton 卡片列表骨架
 ═══════════════════════════════════════════ */

interface ListSkeletonProps {
 /** 列表项数 */
 items?: number
 /** 是否显示左侧图标/头像 */
 hasAvatar?: boolean
 /** 是否显示右侧箭头 */
 hasArrow?: boolean
 className?: string
}

export function ListSkeleton({ items = 5, hasAvatar = true, hasArrow = true, className }: ListSkeletonProps) {
 return (
 <div className={cn('space-y-2', className)}>
 {Array.from({ length: items }).map((_, i) => (
 <div key={i} className="card flex items-center gap-3 px-4 py-3.5">
 {hasAvatar && <div className="skeleton w-10 h-10 rounded-full shrink-0" />}
 <div className="flex-1 min-w-0 space-y-2">
 <div className="skeleton h-4 w-3/5 rounded" />
 <div className="skeleton h-3 w-2/5 rounded" />
 </div>
 {hasArrow && (
 <div className="flex items-center gap-2 shrink-0">
 <div className="skeleton h-5 w-14 rounded-full" />
 <div className="skeleton w-4 h-4 rounded" />
 </div>
 )}
 </div>
 ))}
 </div>
 )
}

/* ═══════════════════════════════════════════
 DetailSkeleton 详情页骨架
 ═══════════════════════════════════════════ */

interface DetailSkeletonProps {
 /** 是否显示侧栏 */
 hasSidebar?: boolean
 className?: string
}

export function DetailSkeleton({ hasSidebar = false, className }: DetailSkeletonProps) {
 return (
 <div className={cn('space-y-6', className)}>
 {/* 页面标题 */}
 <div className="space-y-2">
 <div className="skeleton h-8 w-64 rounded-lg" />
 <div className="skeleton h-4 w-96 rounded-lg" />
 </div>

 {/* 操作按钮栏 */}
 <div className="flex items-center gap-3">
 <div className="skeleton h-9 w-24 rounded-lg" />
 <div className="skeleton h-9 w-24 rounded-lg" />
 <div className="skeleton h-9 w-24 rounded-lg" />
 </div>

 {/* 主内容区 */}
 <div className={cn('grid gap-6', hasSidebar ?'grid-cols-1 lg:grid-cols-3' :'grid-cols-1')}>
 {/* 左侧主内容 */}
 <div className={cn(hasSidebar &&'lg:col-span-2','space-y-6')}>
 {/* 信息卡片 */}
 <div className="card p-5 space-y-4">
 <div className="skeleton h-5 w-32 rounded" />
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
 {Array.from({ length: 6 }).map((_, i) => (
 <div key={i} className="space-y-1.5">
 <div className="skeleton h-3 w-16 rounded" />
 <div className="skeleton h-5 w-24 rounded" />
 </div>
 ))}
 </div>
 </div>

 {/* 内容区 */}
 <div className="card p-5 space-y-3">
 <div className="skeleton h-5 w-24 rounded" />
 <div className="skeleton h-4 w-full rounded" />
 <div className="skeleton h-4 w-full rounded" />
 <div className="skeleton h-4 w-3/4 rounded" />
 <div className="skeleton h-32 w-full rounded-xl" />
 </div>
 </div>

 {/* 右侧边栏 */}
 {hasSidebar && (
 <div className="space-y-6">
 <div className="card p-5 space-y-3">
 <div className="skeleton h-5 w-20 rounded" />
 <div className="skeleton h-4 w-full rounded" />
 <div className="skeleton h-4 w-full rounded" />
 <div className="skeleton h-4 w-2/3 rounded" />
 </div>
 <div className="card p-5 space-y-3">
 <div className="skeleton h-5 w-24 rounded" />
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="flex items-center gap-2">
 <div className="skeleton w-8 h-8 rounded-lg shrink-0" />
 <div className="flex-1 space-y-1.5">
 <div className="skeleton h-3 w-3/4 rounded" />
 <div className="skeleton h-2.5 w-1/2 rounded" />
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 )
}

/* ═══════════════════════════════════════════
 CardSkeleton 统计卡片骨架
 ═══════════════════════════════════════════ */

interface CardSkeletonProps {
 /** 卡片数量 */
 count?: number
 className?: string
}

export function CardSkeleton({ count = 4, className }: CardSkeletonProps) {
 return (
 <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-4', className)}>
 {Array.from({ length: count }).map((_, i) => (
 <div key={i} className="card p-5 space-y-3">
 <div className="flex items-center justify-between">
 <div className="skeleton h-4 w-16 rounded" />
 <div className="skeleton w-8 h-8 rounded-lg" />
 </div>
 <div className="skeleton h-8 w-20 rounded" />
 <div className="skeleton h-3 w-24 rounded" />
 </div>
 ))}
 </div>
 )
}

/* ═══════════════════════════════════════════
 FormSkeleton 表单骨架
 ═══════════════════════════════════════════ */

interface FormSkeletonProps {
 /** 表单字段数 */
 fields?: number
 /** 是否包含大文本区域 */
 hasTextarea?: boolean
 className?: string
}

export function FormSkeleton({ fields = 6, hasTextarea = true, className }: FormSkeletonProps) {
 return (
 <div className={cn('card p-6 space-y-6 max-w-3xl', className)}>
 {Array.from({ length: fields }).map((_, i) => (
 <div key={i} className="space-y-2">
 <div className="skeleton h-4 w-24 rounded" />
 {hasTextarea && i === fields - 1 ? (
 <div className="skeleton h-28 w-full rounded-lg" />
 ) : (
 <div className="skeleton h-10 w-full rounded-lg" />
 )}
 </div>
 ))}
 {/* 提交按钮 */}
 <div className="flex items-center gap-3 pt-2">
 <div className="skeleton h-10 w-28 rounded-lg" />
 <div className="skeleton h-10 w-20 rounded-lg" />
 </div>
 </div>
 )
}

/* ═══════════════════════════════════════════
 ChartSkeleton 图表区域骨架
 ═══════════════════════════════════════════ */

interface ChartSkeletonProps {
 /** 是否显示图例 */
 hasLegend?: boolean
 className?: string
}

export function ChartSkeleton({ hasLegend = true, className }: ChartSkeletonProps) {
 return (
 <div className={cn('card p-5 space-y-4', className)}>
 <div className="flex items-center justify-between">
 <div className="skeleton h-5 w-32 rounded" />
 <div className="skeleton h-8 w-20 rounded-lg" />
 </div>
 {/* 图表区域 — 模拟柱状图/折线图 */}
 <div className="relative h-[240px] w-full">
 {/* Y 轴 */}
 <div className="absolute left-0 top-0 bottom-6 w-8 space-y-4 flex flex-col justify-between">
 {Array.from({ length: 5 }).map((_, i) => (
 <div key={i} className="skeleton h-3 w-6 rounded ml-auto" />
 ))}
 </div>
 {/* 柱状图模拟 */}
 <div className="ml-10 h-[200px] flex items-end gap-3 pb-6 border-t border-[var(--border-subtle,#e2e8f0)] dark:border-[var(--border-subtle,#334155)]">
 {Array.from({ length: 7 }).map((_, i) => (
 <div
 key={i}
 className="flex-1 skeleton rounded-t-md"
 style={{ height: `${40 + Math.random() * 55}%` }}
 />
 ))}
 </div>
 </div>
 {/* 图例 */}
 {hasLegend && (
 <div className="flex items-center gap-4 pt-1">
 {Array.from({ length: 3 }).map((_, i) => (
 <div key={i} className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full skeleton" />
 <div className="skeleton h-3 w-12 rounded" />
 </div>
 ))}
 </div>
 )}
 </div>
 )
}

/* ═══════════════════════════════════════════
 FormulaCardSkeleton 配方卡片骨架屏
 ═══════════════════════════════════════════ */

export function FormulaCardSkeleton() {
 return (
 <div className="animate-pulse p-4 bg-[var(--card-bg-solid,#fff)] dark:bg-[var(--bg-surface,#0f172a)] rounded-lg shadow border border-[var(--border-subtle,#f8fafc)] dark:border-[var(--border-subtle,#334155)]">
 <div className="h-6 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded w-1/3 mb-4"></div>
 <div className="space-y-2">
 <div className="h-4 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded"></div>
 <div className="h-4 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded w-5/6"></div>
 <div className="h-4 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded w-4/6"></div>
 </div>
 <div className="flex gap-2 mt-4">
 <div className="h-8 w-20 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded"></div>
 <div className="h-8 w-20 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded"></div>
 </div>
 </div>
 )
}

/* ═══════════════════════════════════════════
 FormulaListSkeleton 配方列表骨架屏
 ═══════════════════════════════════════════ */

interface FormulaListSkeletonProps {
 count?: number
 className?: string
}

export function FormulaListSkeleton({ count = 3, className }: FormulaListSkeletonProps) {
 return (
 <div className={cn('space-y-4', className)}>
 {Array.from({ length: count }).map((_, i) => (
 <FormulaCardSkeleton key={i} />
 ))}
 </div>
 )
}

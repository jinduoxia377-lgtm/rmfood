/**
 * RMFOOD 设计系统 — StatCard 统计卡片（专业版）
 * Apple HIG 层级：标签 → 图标+数值+趋势 → 副标题
 * 流式布局，无 overflow-hidden，无 h-full，让内容自然撑开高度
 */
import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'

export type StatVariant = 'primary' | 'secondary' | 'info' | 'success' | 'warning'
export type StatTrend = 'up' | 'down' | 'stable'

export interface StatCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  variant?: StatVariant
  size?: 'default' | 'large'
  subtitle?: string
  trend?: { direction: StatTrend; value: string }
  className?: string
  onClick?: () => void
}

const variantStyles: Record<StatVariant, { iconBg: string; iconColor: string; accentBar: string }> = {
  primary:  { iconBg: 'bg-primary-100 dark:bg-primary-300/25',    iconColor: 'text-primary-700 dark:text-primary-700',    accentBar: 'bg-primary-500' },
  secondary:{ iconBg: 'bg-secondary-100 dark:bg-secondary-300/25',          iconColor: 'text-secondary-700 dark:text-secondary-700',          accentBar: 'bg-secondary-500' },
  info:     { iconBg: 'bg-info-100 dark:bg-info-300/25',            iconColor: 'text-info-700 dark:text-info-700',            accentBar: 'bg-info-500' },
  success:  { iconBg: 'bg-success-100 dark:bg-success-300/25',    iconColor: 'text-success-700 dark:text-success-600',    accentBar: 'bg-success-500' },
  warning:  { iconBg: 'bg-warning-100 dark:bg-warning-300/25',        iconColor: 'text-warning-600 dark:text-warning-700',        accentBar: 'bg-warning-500' },
}

const trendIcon = (direction: StatTrend, cls: string) => {
  if (direction === 'up')   return <TrendingUp size={12} className={cls} />
  if (direction === 'down') return <TrendingDown size={12} className={cls} />
  return <Minus size={12} className={cn(cls, 'opacity-40')} />
}

export function StatCard({
  label, value, icon: Icon,
  variant = 'primary', size = 'default',
  subtitle, trend, className, onClick,
}: StatCardProps) {
  const s       = variantStyles[variant]
  const isLg    = size === 'large'
  const fmt     = typeof value === 'number' ? new Intl.NumberFormat('zh-CN').format(value) : String(value)

  return (
    <Card className={cn(
      'relative overflow-visible',
      'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm',
      'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
      onClick && 'cursor-pointer',
      className,
    )} onClick={onClick}>
      {/* 顶部色条 — 始终显示，flow 布局 */}
      <div className={cn(
        'h-[3px] w-full',
        isLg ? 'absolute top-0 left-0 right-0' : 'rounded-t-xl',
        s.accentBar,
      )} />

      <div className={cn(
        'px-5 pt-4 pb-5',
        isLg && 'px-6 pt-5 pb-6',
      )}>
        {/* 标签 */}
        <p className={cn(
          'mb-2 font-semibold',
          isLg ? 'text-sm font-semibold text-neutral-600 dark:text-neutral-300' : 'text-xs font-semibold text-neutral-600 dark:text-neutral-300',
        )}>{label}</p>

        {/* 图标 + 数值 + 趋势 */}
        <div className="flex items-baseline gap-3 mb-1.5">
          <div
            className={cn(
              'flex items-center justify-center rounded-lg shrink-0',
              s.iconBg,
              isLg ? 'w-10 h-10' : 'w-7 h-7',
            )}
            aria-hidden="true"
          >
            <Icon size={isLg ? 20 : 14} className={s.iconColor} />
          </div>
          <div className="flex items-baseline gap-1.5 min-w-0">
            <p
              className={cn(
                'font-semibold text-neutral-900 dark:text-white tabular-nums leading-none truncate',
                isLg ? 'text-3xl' : 'text-xl',
              )}
              aria-label={`${label}，数值${fmt}`}
            >
              {fmt}
            </p>
            {trend && (
              <span className={cn(
                'flex items-center gap-0.5 text-xs font-normal shrink-0 leading-normal',
                /* D-71：涨/跌趋势文字原用 Tailwind 原生色板 emerald-600
                   (oklch 0.596 .145 163 → #059669)，白底仅 3.67:1（12px 需 4.5）。
                   改用设计系统令牌：亮色 success-700 #047857 = 5.48:1，
                   暗色 success-600 #34d399 在暗画布上同样远超 AA。 */
                trend.direction === 'up'   ? 'text-success-700 dark:text-success-600'
              : trend.direction === 'down' ? 'text-error-600 dark:text-error-600'
              : 'text-[color:var(--text-muted)]',
              )}>
                {trendIcon(trend.direction, 'w-3 h-3')}
                {trend.value}
              </span>
            )}
          </div>
        </div>

        {/* 副标题 */}
        {subtitle && (
          <p className={cn(
            'text-[color:var(--text-muted)] leading-relaxed',
            isLg ? 'text-sm' : 'text-xs',
          )}>{subtitle}</p>
        )}
      </div>
    </Card>
  )
}

// StatCardProps / StatVariant / StatTrend 已在文件顶部直接导出，无需重复 export type

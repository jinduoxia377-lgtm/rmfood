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
}

const variantStyles: Record<StatVariant, { iconBg: string; iconColor: string; accentBar: string }> = {
  primary:  { iconBg: 'bg-primary-100 dark:bg-primary-900/30',    iconColor: 'text-primary-600 dark:text-primary-400',    accentBar: 'bg-primary-500' },
  secondary:{ iconBg: 'bg-blue-100 dark:bg-blue-900/30',          iconColor: 'text-blue-600 dark:text-blue-400',          accentBar: 'bg-blue-500' },
  info:     { iconBg: 'bg-sky-100 dark:bg-sky-900/30',            iconColor: 'text-sky-600 dark:text-sky-400',            accentBar: 'bg-sky-500' },
  success:  { iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',    iconColor: 'text-emerald-600 dark:text-emerald-400',    accentBar: 'bg-emerald-500' },
  warning:  { iconBg: 'bg-amber-100 dark:bg-amber-900/30',        iconColor: 'text-amber-600 dark:text-amber-400',        accentBar: 'bg-amber-500' },
}

const trendIcon = (direction: StatTrend, cls: string) => {
  if (direction === 'up')   return <TrendingUp size={12} className={cls} />
  if (direction === 'down') return <TrendingDown size={12} className={cls} />
  return <Minus size={12} className={cn(cls, 'opacity-40')} />
}

export function StatCard({
  label, value, icon: Icon,
  variant = 'primary', size = 'default',
  subtitle, trend, className,
}: StatCardProps) {
  const s       = variantStyles[variant]
  const isLg    = size === 'large'
  const fmt     = typeof value === 'number' ? new Intl.NumberFormat('zh-CN').format(value) : String(value)

  return (
    <Card className={cn(
      'relative overflow-visible',
      'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm',
      'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
      className,
    )}>
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
                trend.direction === 'up'   ? 'text-emerald-600 dark:text-emerald-400'
              : trend.direction === 'down' ? 'text-error-600 dark:text-error-400'
              :                              'text-neutral-400',
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
            'text-neutral-400 dark:text-neutral-500 leading-relaxed',
            isLg ? 'text-sm' : 'text-xs',
          )}>{subtitle}</p>
        )}
      </div>
    </Card>
  )
}

// StatCardProps / StatVariant / StatTrend 已在文件顶部直接导出，无需重复 export type

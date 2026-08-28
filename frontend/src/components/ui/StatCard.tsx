/**
 * RMFOOD 设计系统 — StatCard 统计卡片
 * 统一 Dashboard 统计数据展示，支持 large 变体用于突出显示主要指标
 */
import { type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'

type StatVariant = 'primary' | 'secondary' | 'info' | 'success' | 'warning'

interface StatCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  variant?: StatVariant
  size?: 'default' | 'large'
  className?: string
}

const variantStyles: Record<StatVariant, { iconBg: string; iconColor: string }> = {
  primary: { iconBg: 'bg-primary-100 dark:bg-primary-900/30', iconColor: 'text-primary-600 dark:text-primary-400' },
  secondary: { iconBg: 'bg-secondary-100 dark:bg-secondary-900/30', iconColor: 'text-secondary-600 dark:text-secondary-400' },
  info: { iconBg: 'bg-info-100 dark:bg-info-900/30', iconColor: 'text-info-600 dark:text-info-400' },
  success: { iconBg: 'bg-success-100 dark:bg-success-900/30', iconColor: 'text-success-600 dark:text-success-400' },
  warning: { iconBg: 'bg-warning-100 dark:bg-warning-900/30', iconColor: 'text-warning-600 dark:text-warning-400' },
}

const sizeStyles = {
  default: { valueSize: 'text-2xl', iconSize: 'w-8 h-8', iconPixel: 16 },
  large: { valueSize: 'text-3xl', iconSize: 'w-10 h-10', iconPixel: 20 },
}

export function StatCard({ label, value, icon: Icon, variant = 'primary', size = 'default', className }: StatCardProps) {
  const styles = variantStyles[variant]
  const sizeConfig = sizeStyles[size]

  return (
    <Card className={cn('h-full px-5 py-4', size === 'large' && 'py-5', className)}>
      <div className="flex flex-col h-full">
        <p className={cn('mb-2 text-text-secondary text-xs', size === 'large' && 'mb-3 text-sm')}>{label}</p>
        <div className="flex items-center gap-3">
          <p className={cn('font-bold text-text-primary', sizeConfig.valueSize)}>{value}</p>
          <div className={cn('flex items-center justify-center rounded-lg', styles.iconBg, sizeConfig.iconSize)}>
            <Icon size={sizeConfig.iconPixel} className={styles.iconColor} />
          </div>
        </div>
      </div>
    </Card>
  )
}

export type { StatCardProps, StatVariant }

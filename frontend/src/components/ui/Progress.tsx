/**
 * 进度条组件
 * 用于显示任务进度、加载状态等
 */
import { cn } from '@/lib/utils'

export interface ProgressProps {
  value: number
  max?: number
  variant?: 'default' | 'success' | 'warning' | 'danger'
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Progress({
  value,
  max = 100,
  variant = 'default',
  className,
  size = 'md',
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  const variantClasses = {
    default: 'bg-primary-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-error-500',
  }

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-1.5',
    lg: 'h-2',
  }

  return (
    <div
      className={cn(
        'w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden',
        sizeClasses[size],
        className,
      )}
    >
      <div
        className={cn(
          'h-full rounded-full transition-all duration-300 ease-out',
          variantClasses[variant],
        )}
        style={{ width: `${percentage}%` }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      />
    </div>
  )
}

/**
 * RMFOOD 设计系统 — Progress (shadcn/ui Radix 兼容层)
 *
 * Phase 6: 使用 @radix-ui/react-progress 替代手撸实现
 * 保留 variant/size/value/max API
 */
import { cn } from '@/lib/utils'
import * as ProgressPrimitive from '@radix-ui/react-progress'

export interface ProgressProps {
  value: number
  max?: number
  variant?: 'default' | 'success' | 'warning' | 'danger'
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const variantClasses = {
  default: 'bg-primary-500',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-error',
}

const sizeClasses = {
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2',
}

export function Progress({ value, max = 100, variant = 'default', className, size = 'md' }: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <ProgressPrimitive.Root
      className={cn('w-full bg-neutral-200 rounded-full overflow-hidden dark:bg-neutral-700', sizeClasses[size], className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <ProgressPrimitive.Indicator
        className={`h-full w-full flex-1 rounded-full transition-all duration-300 ease-out ${variantClasses[variant]}`}
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export type { ProgressProps }

/**
 * 分隔线组件
 * 用于分隔不同内容区域
 */
import { cn } from '@/lib/utils'

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical'
  variant?: 'solid' | 'dashed' | 'dotted'
  className?: string
}

export function Divider({
  orientation = 'horizontal',
  variant = 'solid',
  className,
}: DividerProps) {
  const variantClasses = {
    solid: 'border-solid',
    dashed: 'border-dashed',
    dotted: 'border-dotted',
  }

  const orientationClasses = {
    horizontal: 'h-px w-full',
    vertical: 'h-full w-px',
  }

  return (
    <div
      className={cn(
        'border-neutral-200 dark:border-neutral-700',
        variantClasses[variant],
        orientationClasses[orientation],
        className,
      )}
      role="separator"
      aria-orientation={orientation}
    />
  )
}

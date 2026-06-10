/**
 * RMFOOD 设计系统 — Badge 徽章
 * 支持 variant / size / dot indicator
 */
import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type BadgeSize = 'sm' | 'md'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  icon?: ReactNode
}

const variantClasses: Record<BadgeVariant, string> = {
  primary: 'badge-primary',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
  neutral: 'badge-neutral',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-px text-[11px]',
  md: 'px-2.5 py-0.5 text-xs',
}

export function Badge({
  className,
  variant = 'primary',
  size = 'md',
  dot = false,
  icon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn('badge', variantClasses[variant], sizeClasses[size], className)} {...props}>
      {dot && (
        <span className={cn(
          'inline-block w-1.5 h-1.5 rounded-full mr-1.5',
          variant === 'primary' && 'bg-primary-500',
          variant === 'success' && 'bg-emerald-500',
          variant === 'warning' && 'bg-amber-500',
          variant === 'danger' && 'bg-rose-500',
          variant === 'info' && 'bg-sky-500',
          variant === 'neutral' && 'bg-slate-400',
        )} />
      )}
      {icon && <span className="mr-1">{icon}</span>}
      {children}
    </span>
  )
}

export type { BadgeProps, BadgeVariant, BadgeSize }

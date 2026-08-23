/**
 * RMFOOD 设计系统 — Badge (shadcn/ui 兼容层)
 *
 * Phase 6: 保留 variant/size/dot/icon API，使用 CVA 统一样式
 */
import { type HTMLAttributes, type ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        primary: 'border-transparent bg-primary text-primary-foreground',
        success: 'border-transparent bg-success text-success-foreground',
        warning: 'border-transparent bg-warning text-warning-foreground',
        danger: 'border-transparent bg-destructive text-destructive-foreground',
        info: 'border-transparent bg-secondary text-secondary-foreground',
        neutral: 'border-border bg-background text-foreground',
      },
      size: {
        sm: 'px-2 py-px text-[11px]',
        md: 'px-2.5 py-0.5 text-xs',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean
  icon?: ReactNode
}

export function Badge({ className, variant = 'primary', size = 'md', dot = false, icon, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size, className }))}
      role="status"
      aria-label={typeof children === 'string' ? children : undefined}
      {...props}
    >
      {dot && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {icon && <span className="mr-1">{icon}</span>}
      {children}
    </span>
  )
}

export { badgeVariants }
export type { BadgeProps, BadgeVariant, BadgeSize }

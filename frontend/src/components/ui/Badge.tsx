import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'border-border text-foreground',
        success: 'border-transparent bg-success text-success-foreground',
        warning: 'border-transparent bg-warning text-warning-foreground',
        /* D-72：info / danger 原用 Tailwind 原生色板 bg-secondary-500 / bg-error-500
           —— 既绕开了设计系统令牌（暗色下不随主题反转），白字对比度也不足：
             white on red-500  #fb2c36 = 3.82:1 ✗（实测 /users「已禁用」计数徽章）
             white on blue-500 #3b82f6 = 3.68:1 ✗
           改为语义令牌：亮色用 600/700 实底 + 白字（4.83 / 5.48:1），
           暗色改用「深底 + 亮字」的暗色徽章范式 *-300/25 + *-700（8.3:1）。 */
        info: 'border-transparent bg-info-700 dark:bg-info-300/25 text-white dark:text-info-700',
        danger: 'border-transparent bg-danger-600 dark:bg-danger-300/25 text-white dark:text-danger-700',
        neutral: 'border-transparent bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200',
        primary: 'border-transparent bg-primary text-primary-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
  icon?: React.ReactNode
  size?: string
}

function Badge({ className, variant, dot = false, icon, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
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

export { Badge, badgeVariants }

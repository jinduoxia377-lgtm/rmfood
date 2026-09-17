/**
 * RMFOOD 设计系统 — Radix Themes 组件包装层
 *
 * 策略：
 * - 简单组件（Badge、Text）使用 Radix Themes 原生实现
 * - 复杂组件（Button、Card）保留 shadcn/ui（更多功能）
 * - 统一导出到 @/components/ui
 */
'use client'

import * as React from 'react'
import { Badge as RadixBadgePrimitive, Text as RadixTextPrimitive } from '@radix-ui/themes'
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════
// Badge — 使用 Radix Themes 原生
// ═══════════════════════════════════════════════════════════════

export interface RadixBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  dot?: boolean
  icon?: React.ReactNode
}

export const RadixBadge = React.forwardRef<HTMLSpanElement, RadixBadgeProps>(
  ({ className, variant = 'default', dot = false, icon, children, ...props }, ref) => {
    const colorMap: Record<string, string> = {
      default: 'gray',
      success: 'green',
      warning: 'orange',
      error: 'red',
      info: 'blue',
    }

    return (
      <RadixBadgePrimitive
        ref={ref}
        color={colorMap[variant] as 'gray' | 'green' | 'orange' | 'red' | 'blue'}
        className={cn('inline-flex items-center gap-1', className)}
        {...props}
      >
        {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span>{children}</span>
      </RadixBadgePrimitive>
    )
  }
)
RadixBadge.displayName = 'RadixBadge'

// ═══════════════════════════════════════════════════════════════
// Text — 使用 Radix Themes 原生
// ═══════════════════════════════════════════════════════════════

type RadixTextAs = 'p' | 'span' | 'div' | 'label'

export interface RadixTextProps extends React.HTMLAttributes<HTMLElement> {
  as?: RadixTextAs
  size?: '1' | '2' | '3' | '4' | '5' | '6' | '7'
  weight?: 'regular' | 'medium' | 'bold'
  color?: 'gray' | 'mint' | 'orange' | 'red' | 'mauve' | 'auto'
}

export const RadixText = React.forwardRef<HTMLElement, RadixTextProps>(
  ({ className, as: Tag = 'p', size = '2', weight = 'regular', color = 'gray', children, ...props }, ref) => {
    const Component = Tag as RadixTextAs
    return (
      <RadixTextPrimitive
        ref={ref}
        as={Component}
        size={size as '1' | '2' | '3' | '4' | '5' | '6' | '7'}
        weight={weight}
        color={color as 'gray' | 'mint' | 'orange' | 'red' | 'mauve' | 'auto'}
        className={cn(className)}
        {...props}
      >
        {children}
      </RadixTextPrimitive>
    )
  }
)
RadixText.displayName = 'RadixText'

export { RadixBadge as Badge, RadixText as Text }

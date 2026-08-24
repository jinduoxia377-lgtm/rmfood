/**
 * RMFOOD 设计系统 — Radix Themes 组件包装层
 *
 * 策略：
 * - 简单组件（Badge、Button）使用 Radix Themes 原生实现
 * - 复杂组件（Dialog、Select、Tabs）保留 shadcn/ui（更多功能）
 * - 统一导出到 @/components/ui
 */
'use client'

import * as React from 'react'
import { Button as RadixButton, Badge as RadixBadge, Card as RadixCard, Text as RadixText } from '@radix-ui/themes'
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════
// Button — 使用 Radix Themes 原生，保留 shadcn 变体
// ═══════════════════════════════════════════════════════════════

export interface RadixButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'soft' | 'outline' | 'ghost'
  size?: '1' | '2' | '3'
  loading?: boolean
}

const RadixButtonComp = React.forwardRef<HTMLButtonElement, RadixButtonProps>(
  ({ className, variant = 'solid', size = '2', loading, children, disabled, ...props }, ref) => {
    return (
      <RadixButton
        ref={ref}
        className={cn(className)}
        variant={variant}
        size={size}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </RadixButton>
    )
  }
)
RadixButtonComp.displayName = 'RadixButton'

// ═══════════════════════════════════════════════════════════════
// Badge — 使用 Radix Themes 原生
// ═══════════════════════════════════════════════════════════════

export interface RadixBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  dot?: boolean
  icon?: React.ReactNode
}

const RadixBadgeComp = React.forwardRef<HTMLSpanElement, RadixBadgeProps>(
  ({ className, variant = 'default', dot = false, icon, children, ...props }, ref) => {
    const colorMap = {
      default: 'mauve',
      success: 'green',
      warning: 'orange',
      error: 'red',
      info: 'blue',
    } as const

    return (
      <RadixBadge
        ref={ref}
        color={colorMap[variant]}
        className={cn('inline-flex items-center gap-1', className)}
        {...props}
      >
        {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span>{children}</span>
      </RadixBadge>
    )
  }
)
RadixBadgeComp.displayName = 'RadixBadge'

// ═══════════════════════════════════════════════════════════════
// Card — 使用 Radix Themes 原生
// ═══════════════════════════════════════════════════════════════

export interface RadixCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
  glass?: boolean
}

const RadixCardComp = React.forwardRef<HTMLDivElement, RadixCardProps>(
  ({ className, hoverable, glass, children, ...props }, ref) => {
    return (
      <RadixCard
        ref={ref}
        className={cn(
          hoverable && 'transition-shadow duration-200 hover:shadow-md',
          glass && 'backdrop-blur-md bg-white/80 dark:bg-gray-900/80',
          className
        )}
        {...props}
      >
        {children}
      </RadixCard>
    )
  }
)
RadixCardComp.displayName = 'RadixCard'

// ═══════════════════════════════════════════════════════════════
// Text — 使用 Radix Themes 原生
// ═══════════════════════════════════════════════════════════════

export interface RadixTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  as?: 'p' | 'span' | 'div'
  size?: '1' | '2' | '3' | '4' | '5' | '6' | '7'
  weight?: 'regular' | 'medium' | 'bold'
  color?: 'gray' | 'mint' | 'orange' | 'red' | 'mauve' | 'auto'
}

const RadixTextComp = React.forwardRef<HTMLParagraphElement, RadixTextProps>(
  ({ className, as: Tag = 'p', size = '2', weight = 'regular', color = 'gray', children, ...props }, ref) => {
    const Component = Tag as keyof JSX.IntrinsicElements
    return (
      <RadixText
        ref={ref}
        as={Component}
        size={size}
        weight={weight}
        color={color}
        className={cn(className)}
        {...props}
      >
        {children}
      </RadixText>
    )
  }
)
RadixTextComp.displayName = 'RadixText'

// ═══════════════════════════════════════════════════════════════
// Export unified API
// ═══════════════════════════════════════════════════════════════

export const RadixComponents = {
  Button: RadixButtonComp,
  Badge: RadixBadgeComp,
  Card: RadixCardComp,
  Text: RadixTextComp,
}

export { RadixButtonComp as Button, RadixBadgeComp as Badge, RadixCardComp as Card, RadixTextComp as Text }
export type { RadixButtonProps as ButtonProps, RadixBadgeProps as BadgeProps, RadixCardProps as CardProps, RadixTextProps as TextProps }

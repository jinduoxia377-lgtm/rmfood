/**
 * 触摸友好的按钮组件
 * 符合 WCAG 标准的最小触摸目标尺寸（44px）
 */

import React from 'react'
import { cn } from '@/lib/utils'

interface TouchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 是否为大块按钮 */
  large?: boolean
  /** 是否为块状按钮 */
  block?: boolean
  /** 自定义触摸目标尺寸 */
  touchSize?: number
}

export default function TouchButton({
  children,
  className,
  large = false,
  block = false,
  touchSize = 44,
  disabled,
  style,
  ...props
}: TouchButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        'active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
        'touch-button',
        large ? 'h-14 px-6 text-lg gap-3' : 'h-11 px-4 text-sm gap-2',
        block && 'w-full',
        className,
      )}
      style={{
        minWidth: touchSize,
        minHeight: touchSize,
        ...style,
      }}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

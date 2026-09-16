/**
 * 触摸友好的卡片组件
 * 支持触摸反馈、长按手势等交互
 */

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { useLongPress } from '../useMobile'

interface TouchCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  /** 是否支持长按操作 */
  longPressable?: boolean
  /** 长按回调 */
  onLongPress?: () => void
  /** 长按延迟（毫秒） */
  longPressDelay?: number
  /** 是否可点击 */
  clickable?: boolean
  /** 点击回调 */
  onClick?: () => void
}

export default function TouchCard({
  children,
  className,
  longPressable = false,
  onLongPress,
  longPressDelay = 500,
  clickable = false,
  onClick,
  style,
  ...props
}: TouchCardProps) {
  const [isPressed, setIsPressed] = useState(false)

  const longPressHandlers = useLongPress({
    onLongPress: onLongPress || (() => {}),
    delay: longPressDelay,
    onTouchStart: () => setIsPressed(true),
    onTouchEnd: () => setIsPressed(false),
  })

  const handleMouseDown = () => setIsPressed(true)
  const handleMouseUp = () => setIsPressed(false)
  const handleMouseLeave = () => setIsPressed(false)

  return (
    <div
      className={cn(
        'rounded-xl p-4 transition-all duration-200 touch-card',
        clickable && 'cursor-pointer hover:shadow-md',
        isPressed && 'scale-[0.98] shadow-sm',
        longPressable && 'touch-target',
        className,
      )}
      style={{
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
       role="button" tabIndex={0} onClick={onClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      {...(longPressable ? longPressHandlers : {})}
      {...props}
    >
      {children}
    </div>
  )
}

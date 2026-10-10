'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider
const TooltipRoot = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

export interface TooltipContentProps extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> {
  position?: 'top' | 'bottom' | 'left' | 'right'
}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(({ className, side = 'top', align = 'center', sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      side={side}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-md bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// Backward-compatible wrapper that accepts `content` prop
export interface TooltipWrapperProps {
  content?: React.ReactNode
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  className?: string
  /* A-23：旧注释称 react-popper@1.3.7 的 Anchor 不支持 asChild 会崩溃，但当前依赖
     是 @radix-ui/react-tooltip@^1.2.16（基于 floating-ui），Trigger 完整支持 asChild。
     开启后 Trigger 不再额外渲染一层 <button>，避免「按钮套按钮」这种无效 HTML
     （/formulas 快捷键悬浮按钮曾出现：外层 button 无可读名称且只有 38×38）。
     默认开启；children 不是单个 React 元素（文本/数组/Fragment）时自动退回包裹模式，
     避免 Slot 收到非法子元素而崩溃。 */
  asChild?: boolean
}

function TooltipWrapper({ content, children, position = 'top', delay = 300, className = '', asChild = true }: TooltipWrapperProps) {
  const hasContent = content != null && content !== ''
  const canForward = React.isValidElement(children) && !Array.isArray(children)
  return (
    <TooltipProvider delayDuration={delay}>
      <TooltipRoot>
        <TooltipTrigger asChild={asChild && canForward}>{children}</TooltipTrigger>
        {hasContent && (
          <TooltipContent side={position} className={className}>
            {content}
          </TooltipContent>
        )}
      </TooltipRoot>
    </TooltipProvider>
  )
}

TooltipWrapper.displayName = 'Tooltip'

export { TooltipWrapper as Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }

/**
 * RMFOOD 设计系统 — Tooltip 提示框 (shadcn/ui Radix 兼容层)
 *
 * Phase 5: 保留 content/children/position/delay API
 * 底层使用 Radix Tooltip，自动处理 ARIA 和键盘交互
 */
import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  Tooltip as ShadcnTooltip,
  TooltipTrigger as ShadcnTooltipTrigger,
  TooltipContent as ShadcnTooltipContent,
  TooltipProvider as ShadcnTooltipProvider,
} from './shadcn/tooltip'

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  position?: TooltipPosition
  delay?: number
  className?: string
}

export function Tooltip({ content, children, position = 'top', delay = 300, className = '' }: TooltipProps) {
  return (
    <ShadcnTooltipProvider delayDuration={delay}>
      <ShadcnTooltip>
        <ShadcnTooltipTrigger asChild>{children}</ShadcnTooltipTrigger>
        <ShadcnTooltipContent side={position} className={className}>
          {content}
        </ShadcnTooltipContent>
      </ShadcnTooltip>
    </ShadcnTooltipProvider>
  )
}

export { ShadcnTooltipProvider as TooltipProvider }
export type { TooltipProps, TooltipPosition }

/**
 * RMFOOD 设计系统 — Tabs 标签页 (shadcn/ui Radix 兼容层)
 *
 * Phase 5: 保留原有 API (value/onChange/orientation/TabsList/TabsTrigger/TabsContent)
 * 键盘导航由 Radix 原生提供，移除手动 handleTabKeydown
 */
import { type ReactNode, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import {
  Tabs as ShadcnTabs,
  TabsList as ShadcnTabsList,
  TabsTrigger as ShadcnTabsTrigger,
  TabsContent as ShadcnTabsContent,
} from './shadcn/tabs'

/* ── Tabs ── */

interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (v: string) => void
  children: ReactNode
  className?: string
  orientation?: 'horizontal' | 'vertical'
}

export function Tabs({ defaultValue, value: controlledValue, onValueChange, children, className, orientation = 'horizontal' }: TabsProps) {
  return (
    <ShadcnTabs
      defaultValue={defaultValue}
      value={controlledValue}
      onValueChange={onValueChange}
      orientation={orientation}
      className={className}
    >
      {children}
    </ShadcnTabs>
  )
}

/* ── TabsList ── */

interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function TabsList({ className, children, ...props }: TabsListProps) {
  return (
    <ShadcnTabsList className={className} {...props}>
      {children}
    </ShadcnTabsList>
  )
}

/* ── TabsTrigger ── */

interface TabsTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  value: string
  children: ReactNode
  icon?: ReactNode
}

export function TabsTrigger({ className, value, icon, children, ...props }: TabsTriggerProps) {
  return (
    <ShadcnTabsTrigger value={value} className={className} {...props}>
      {icon && <span className="mr-1.5">{icon}</span>}
      {children}
    </ShadcnTabsTrigger>
  )
}

/* ── TabsContent ── */

interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string
  children: ReactNode
}

export function TabsContent({ className, value, children, ...props }: TabsContentProps) {
  return (
    <ShadcnTabsContent value={value} className={cn('mt-4 animate-fade-in', className)} {...props}>
      {children}
    </ShadcnTabsContent>
  )
}

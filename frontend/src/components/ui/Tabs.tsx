/**
 * RMFOOD 设计系统 — Tabs 标签页
 * 受控 / 非受控模式，胶囊风格切换
 */
import { useState, createContext, useContext, type ReactNode, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/* ── Context ── */

interface TabsCtx {
  value: string
  onChange: (v: string) => void
}

const CTX = createContext<TabsCtx>({ value: '', onChange: () => {} })
function useTabs() { return useContext(CTX) }

/* ── Tabs ── */

interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (v: string) => void
  children: ReactNode
  className?: string
}

export function Tabs({ defaultValue = '', value: controlledValue, onValueChange, children, className }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue)
  const value = controlledValue ?? internal
  const onChange = (v: string) => {
    setInternal(v)
    onValueChange?.(v)
  }

  return (
    <CTX.Provider value={{ value, onChange }}>
      <div className={className}>{children}</div>
    </CTX.Provider>
  )
}

/* ── TabsList ── */

interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function TabsList({ className, children, ...props }: TabsListProps) {
  return (
    <div className={cn('tabs-list', className)} role="tablist" {...props}>
      {children}
    </div>
  )
}

/* ── TabsTrigger ── */

interface TabsTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  value: string
  children: ReactNode
  icon?: ReactNode
}

export function TabsTrigger({ className, value, icon, children, ...props }: TabsTriggerProps) {
  const { value: active, onChange } = useTabs()
  const isActive = active === value

  return (
    <button
      role="tab"
      aria-selected={isActive}
      className={cn('tabs-trigger', isActive && 'tabs-trigger-active', className)}
      onClick={() => onChange(value)}
      {...props}
    >
      {icon && <span className="mr-1.5">{icon}</span>}
      {children}
    </button>
  )
}

/* ── TabsContent ── */

interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string
  children: ReactNode
}

export function TabsContent({ className, value, children, ...props }: TabsContentProps) {
  const { value: active } = useTabs()
  if (active !== value) return null

  return (
    <div role="tabpanel" className={cn('mt-4 animate-fade-in', className)} {...props}>
      {children}
    </div>
  )
}

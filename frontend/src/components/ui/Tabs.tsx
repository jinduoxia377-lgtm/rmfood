/**
 * RMFOOD 设计系统 — Tabs 标签页
 * 受控 / 非受控模式，胶囊风格切换
 * WCAG 2.2: Arrow key navigation per tablist pattern
 */
import { useState, createContext, useContext, type ReactNode, type HTMLAttributes, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

/* ── Context ── */

interface TabsCtx {
  value: string
  onChange: (v: string) => void
  orientation?: 'horizontal' | 'vertical'
}

const CTX = createContext<TabsCtx>({ value: '', onChange: () => {}, orientation: 'horizontal' })
function useTabs() { return useContext(CTX) }

/* ── Tabs ── */

interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (v: string) => void
  children: ReactNode
  className?: string
  orientation?: 'horizontal' | 'vertical'
}

export function Tabs({ defaultValue = '', value: controlledValue, onValueChange, children, className, orientation = 'horizontal' }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue)
  const value = controlledValue ?? internal
  const onChange = (v: string) => {
    setInternal(v)
    onValueChange?.(v)
  }

  return (
    <CTX.Provider value={{ value, onChange, orientation }}>
      <div className={className} onKeyDown={(e) => handleTabKeydown(e, value, onChange, orientation)}>
        {children}
      </div>
    </CTX.Provider>
  )
}

function handleTabKeydown(e: KeyboardEvent<HTMLDivElement>, active: string, onChange: (v: string) => void, orientation: 'horizontal' | 'vertical') {
  const tablist = e.currentTarget
  const tabs = Array.from(tablist.querySelectorAll('[role="tab"]')) as HTMLButtonElement[]
  if (!tabs.length) return

  const currentIndex = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true')
  if (currentIndex === -1) return

  let nextIndex = currentIndex
  if (orientation === 'horizontal') {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIndex = currentIndex + 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIndex = currentIndex - 1
  } else {
    if (e.key === 'ArrowDown') nextIndex = currentIndex + 1
    else if (e.key === 'ArrowUp') nextIndex = currentIndex - 1
  }

  if (nextIndex < 0) nextIndex = tabs.length - 1
  if (nextIndex >= tabs.length) nextIndex = 0

  const nextTab = tabs[nextIndex]
  if (nextTab) {
    e.preventDefault()
    nextTab.focus()
    onChange(nextTab.value)
  }
}

/* ── TabsList ── */

interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function TabsList({ className, children, ...props }: TabsListProps) {
  return (
    <div className={cn('tabs-list', className)} role="tablist" aria-orientation="horizontal" {...props}>
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
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${value}`}
      tabIndex={isActive ? 0 : -1}
      value={value}
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
    <div
      id={`panel-${value}`}
      role="tabpanel"
      className={cn('mt-4 animate-fade-in', className)}
      tabIndex={0}
      {...props}
    >
      {children}
    </div>
  )
}

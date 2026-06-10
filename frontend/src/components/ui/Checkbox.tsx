/**
 * RMFOOD 设计系统 — 复选框组件
 */
import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface CheckboxProps {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
  disabled?: boolean
  label?: string
}

export function Checkbox({
  id,
  checked,
  onCheckedChange,
  className,
  disabled = false,
  label,
}: CheckboxProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        disabled={disabled}
        className={cn(
          'w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-2 focus:ring-primary-500/50 dark:bg-slate-800 dark:checked:bg-primary-600 transition-colors',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
      />
      {label && (
        <label
          htmlFor={id}
          className={cn(
            'text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          {label}
        </label>
      )}
    </div>
  )
}

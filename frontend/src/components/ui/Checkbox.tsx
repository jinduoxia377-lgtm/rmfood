/**
 * RMFOOD 设计系统 — 复选框组件
 * 支持 indeterminate 状态和完整的 ARIA 属性
 */
import { useRef, useEffect, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onCheckedChange?: (checked: boolean) => void
  label?: string
  indeterminate?: boolean
}

export function Checkbox({
  id,
  checked,
  onCheckedChange,
  onChange,
  className,
  disabled = false,
  label,
  indeterminate = false,
  ...props
}: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onCheckedChange?.(e.target.checked)
    onChange?.(e)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="checkbox"
        id={id}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        aria-checked={indeterminate ? 'mixed' : checked}
        className={cn(
          'w-4 h-4 rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-2 focus:ring-primary-500/50 dark:bg-neutral-800 dark:checked:bg-primary-600 transition-colors',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
        {...props}
      />
      {label && (
        <label
          htmlFor={id}
          className={cn(
            'text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer select-none',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          {label}
        </label>
      )}
    </div>
  )
}

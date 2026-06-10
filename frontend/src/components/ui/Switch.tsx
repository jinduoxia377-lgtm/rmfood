/**
 * RMFOOD 设计系统 — 开关切换组件 (Switch)
 *
 * 用于二进制状态切换（开/关、启用/禁用等）
 * 符合 WAI-ARIA 规范，支持键盘操作
 */
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  label?: string
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      className,
      checked = false,
      onCheckedChange,
      disabled = false,
      label,
      id,
      ...props
    },
    ref,
  ) => {
    const handleClick = () => {
      if (!disabled && onCheckedChange) {
        onCheckedChange(!checked)
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleClick()
      }
    }

    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          id={id}
          ref={ref}
          disabled={disabled}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
            'border-2 border-transparent transition-colors duration-200 ease-in-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            checked ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700',
            className,
          )}
          {...props}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-[18px] w-[18px] rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out',
              checked ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
        {label && (
          <span
            className={cn(
              'text-sm font-medium text-gray-700 dark:text-gray-300 select-none',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            {label}
          </span>
        )}
      </div>
    )
  },
)

Switch.displayName = 'Switch'

export { Switch }

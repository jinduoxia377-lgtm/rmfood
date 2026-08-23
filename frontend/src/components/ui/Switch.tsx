/**
 * RMFOOD 设计系统 — Switch (Radix 兼容层)
 *
 * Phase 6: 使用 @radix-ui/react-switch 替代手撸实现
 * 保留 checked/onCheckedChange/label/disabled API
 */
import * as React from 'react'
import { cn } from '@/lib/utils'
import * as SwitchPrimitives from '@radix-ui/react-switch'

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  label?: string
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, disabled = false, label, id, ...props }, ref) => {
    const handleChange = (nextChecked: boolean) => {
      onCheckedChange?.(nextChecked)
    }

    return (
      <div className="flex items-center gap-2">
        <SwitchPrimitives.Root
          ref={ref}
          id={id}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            checked ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
            className,
          )}
          checked={checked}
          onCheckedChange={handleChange}
          disabled={disabled}
          {...props}
        >
          <SwitchPrimitives.Thumb
            className={cn(
              'pointer-events-none inline-block h-[18px] w-[18px] rounded-full bg-background shadow-card-hover ring-0 transition-transform duration-200 ease-in-out',
              checked ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </SwitchPrimitives.Root>
        {label && (
          <span
            className={cn(
              'text-sm font-medium text-text-secondary select-none',
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
export type { SwitchProps }

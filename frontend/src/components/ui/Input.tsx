/**
 * RMFOOD 设计系统 — Input (shadcn/ui 兼容层)
 *
 * Phase 6: 保留 size/error/prefix/suffix/showCount API
 * 底层样式使用 shadcn input + CSS 变量，确保 light/dark 一致
 */
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type InputSize = 'sm' | 'md' | 'lg'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  size?: InputSize
  error?: string | boolean
  prefix?: ReactNode
  suffix?: ReactNode
  showCount?: boolean
}

const sizeClasses: Record<InputSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-10 px-4 text-sm',
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, size = 'md', error, prefix, suffix, disabled, showCount, maxLength, value, ...props }, ref) => {
    const currentLength = typeof value === 'string' ? value.length : 0
    const isNearLimit = maxLength !== undefined && currentLength > maxLength * 0.8
    const isOverLimit = maxLength !== undefined && currentLength > maxLength

    return (
      <div className="relative w-full">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            'input w-full appearance-none transition-all duration-200',
            sizeClasses[size],
            prefix && 'pl-9',
            suffix && 'pr-9',
            showCount && maxLength && 'pr-16',
            error && 'input-error border-danger-500 focus:ring-danger-500/20 focus:border-danger-500',
            isOverLimit && 'border-danger-500 focus:ring-danger-500/20',
            disabled && 'bg-neutral-700 text-text-disabled cursor-not-allowed',
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={typeof error === 'string' && error && props.id ? `${props.id}-error` : undefined}
          disabled={disabled}
          maxLength={maxLength}
          value={value}
          {...props}
        />
        {suffix && !showCount && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-disabled">{suffix}</span>
        )}
        {showCount && maxLength !== undefined && (
          <span
            className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums',
              isOverLimit ? 'text-danger-500 font-medium'
                : isNearLimit ? 'text-warning-500'
                : 'text-text-disabled',
            )}
          >
            {currentLength}/{maxLength}
          </span>
        )}
        {typeof error === 'string' && error && (
          <p id={props.id ? `${props.id}-error` : undefined} className="mt-1 text-xs text-danger-500" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
export { Input }
export type { InputProps, InputSize }

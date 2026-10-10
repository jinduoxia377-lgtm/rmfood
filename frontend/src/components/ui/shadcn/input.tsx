// @ts-nocheck
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md' | 'lg'
  error?: string | boolean
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  showCount?: boolean
}

const sizeClasses: Record<NonNullable<InputProps['size']>, string> = {
  sm: 'min-h-[44px] text-xs',
  md: 'min-h-[44px] text-sm',
  lg: 'min-h-[44px] text-sm',
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size = 'md', error, prefix, suffix, showCount, maxLength, value, ...props }, ref) => {
    const currentLength = typeof value === 'string' ? value.length : 0
    const isNearLimit = maxLength !== undefined && currentLength > maxLength * 0.8
    const isOverLimit = maxLength !== undefined && currentLength > maxLength

    return (
      <div className="relative w-full">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            'flex min-h-[44px] w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            sizeClasses[size],
            prefix && 'pl-9',
            suffix && 'pr-9',
            showCount && maxLength && 'pr-16',
            error && 'border-destructive focus-visible:ring-destructive',
            isOverLimit && 'border-destructive focus-visible:ring-destructive',
            className,
          )}
          maxLength={maxLength}
          /* A-25：与 components/ui/Input.tsx 同步 —— 未显式指定 aria-label /
             aria-labelledby 时，回退用 placeholder 作为可访问名称（WCAG 4.1.2）。 */
          aria-label={
            props['aria-label'] ??
            (props['aria-labelledby']
              ? undefined
              : typeof props.placeholder === 'string' && props.placeholder ? props.placeholder : undefined)
          }
          aria-invalid={!!error}
          aria-describedby={typeof error === 'string' && error && props.id ? `${props.id}-error` : undefined}
          {...props}
        />
        {suffix && !showCount && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{suffix}</span>
        )}
        {showCount && maxLength !== undefined && (
          <span
            className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums',
              isOverLimit ? 'text-destructive font-medium'
                : isNearLimit ? 'text-warning'
                : 'text-muted-foreground',
            )}
          >
            {currentLength}/{maxLength}
          </span>
        )}
        {typeof error === 'string' && error && (
          <p id={props.id ? `${props.id}-error` : undefined} className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }

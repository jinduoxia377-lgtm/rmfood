import * as React from 'react'
import { cn } from '@/lib/utils'

// @ts-ignore: React 19 InputHTMLAttributes has size?: number, conflicting with our size?: 'sm'|'md'|'lg'
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  size?: 'sm' | 'md' | 'lg'
  error?: string | boolean
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  showCount?: boolean
}

const sizeClasses: Record<NonNullable<InputProps['size']>, string> = {
  sm: 'h-8 text-xs',
  md: 'h-9 text-sm',
  lg: 'h-10 text-sm',
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
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            sizeClasses[size],
            prefix && 'pl-9',
            suffix && 'pr-9',
            showCount && maxLength && 'pr-16',
            error && 'border-destructive focus-visible:ring-destructive',
            isOverLimit && 'border-destructive focus-visible:ring-destructive',
            className,
          )}
          maxLength={maxLength}
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

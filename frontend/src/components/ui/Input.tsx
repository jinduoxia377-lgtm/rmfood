import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  size?: 'sm' | 'md' | 'lg'
  error?: string | boolean
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  showCount?: boolean
  /** 聚焦时是否显示 ring 光圈（默认 true；搜索框等场景可传 false 关闭） */
  focusRing?: boolean
}

const sizeClasses: Record<NonNullable<InputProps['size']>, string> = {
  sm: 'min-h-[44px] text-xs',
  md: 'min-h-[44px] text-sm',
  lg: 'min-h-[44px] text-sm',
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size = 'md', error, prefix, suffix, showCount, maxLength, value, focusRing = true, ...props }, ref) => {
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
          value={value}
          className={cn(
            'flex min-h-[44px] w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[color:var(--text-muted)] dark:placeholder:text-[color:var(--text-secondary)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            focusRing
              ? 'focus-visible:ring-1 focus-visible:ring-ring'
              : 'focus-visible:ring-0 focus-visible:ring-transparent',
            sizeClasses[size],
            prefix && 'pl-9',
            suffix && 'pr-9',
            showCount && maxLength && 'pr-16',
            error && 'border-destructive focus-visible:ring-destructive',
            isOverLimit && 'border-destructive focus-visible:ring-destructive',
            className,
          )}
          maxLength={maxLength}
          /* A-25：全站大量输入框只写了 placeholder 而没有可访问名称 —— placeholder
             在获取焦点后会被真实输入覆盖，且部分屏幕阅读器不朗读，不能充当名称
             （WCAG 4.1.2）。这里在调用方未显式指定 aria-label / aria-labelledby 时，
             回退用 placeholder 作为可访问名称：比"完全匿名"好，且不改变视觉。
             调用方若有更准确的语义（如"搜索配方名称"）应显式传 aria-label 覆盖。 */
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

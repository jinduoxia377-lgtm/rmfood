import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoResize?: boolean
  error?: string | boolean
  showCount?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoResize, error, showCount, maxLength, value, defaultValue, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null)

    React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement)

    React.useEffect(() => {
      if (autoResize && innerRef.current) {
        const el = innerRef.current
        el.style.height = 'auto'
        el.style.height = el.scrollHeight + 'px'
      }
    }, [autoResize, value, defaultValue])

    const currentLength = typeof value === 'string' ? value.length : 0
    const isNearLimit = maxLength !== undefined && currentLength > maxLength * 0.8
    const isOverLimit = maxLength !== undefined && currentLength > maxLength

    return (
      <div className="relative w-full">
        <textarea
          ref={innerRef}
          className={cn(
            'flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-colors resize-y',
            showCount && maxLength && 'pb-7',
            error && 'border-destructive focus-visible:ring-destructive',
            isOverLimit && 'border-destructive focus-visible:ring-destructive',
            className,
          )}
          maxLength={maxLength}
          value={value}
          {...props}
        />
        {showCount && maxLength !== undefined && (
          <span
            className={cn(
              'absolute bottom-2 right-3 text-xs tabular-nums pointer-events-none',
              isOverLimit ? 'text-destructive font-medium'
                : isNearLimit ? 'text-warning'
                : 'text-muted-foreground',
            )}
          >
            {currentLength}/{maxLength}
          </span>
        )}
        {typeof error === 'string' && error && (
          <p className="mt-1 text-xs text-destructive">{error}</p>
        )}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }

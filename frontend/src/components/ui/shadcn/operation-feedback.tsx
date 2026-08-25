import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'

const feedbackVariants = cva(
  'relative rounded-lg border p-4 transition-all duration-300',
  {
    variants: {
      variant: {
        success: 'border-success/30 bg-success/5 text-success-foreground',
        error: 'border-destructive/30 bg-destructive/5 text-destructive-foreground',
        warning: 'border-warning/30 bg-warning/5 text-warning-foreground',
        info: 'border-blue-500/30 bg-blue-50 text-blue-900 dark:text-blue-100',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
)

type FeedbackVariant = 'success' | 'error' | 'warning' | 'info'

const iconMap: Record<FeedbackVariant, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5" />,
  error: <AlertCircle className="h-5 w-5" />,
  warning: <TriangleAlert className="h-5 w-5" />,
  info: <Info className="h-5 w-5" />,
}

export interface OperationFeedbackProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof feedbackVariants> {
  title?: string
  description?: string
  code?: string
  solution?: string
  retryable?: boolean
  onRetry?: () => void
  onDismiss?: () => void
  showIcon?: boolean
  dismissible?: boolean
}

export function OperationFeedback({
  variant = 'info',
  title,
  description,
  code,
  solution,
  retryable = false,
  onRetry,
  onDismiss,
  showIcon = true,
  dismissible = false,
  className,
  children,
  ...props
}: OperationFeedbackProps) {
  const [dismissed, setDismissed] = React.useState(false)
  const Icon = iconMap[variant as FeedbackVariant] ?? iconMap.info

  if (dismissed) return null

  return (
    <div
      className={cn(feedbackVariants({ variant }), className)}
      role="alert"
      {...props}
    >
      {showIcon && <div className="absolute left-4 top-4">{Icon}</div>}
      <div className={cn(dismissible ? 'pr-9' : '')}>
        {title && <div className={cn('font-semibold', showIcon && 'pl-7')}>{title}</div>}
        {description && <p className={cn('text-sm opacity-90 mt-1', showIcon && 'pl-7')}>{description}</p>}
        {code && <p className="text-xs font-mono opacity-70 mt-1 pl-7">{code}</p>}
        {children}
      </div>
      {solution && (
        <div className="mt-2 text-sm pl-7 opacity-80">
          <span className="font-medium">建议：</span>{solution}
        </div>
      )}
      {(retryable || onRetry) && (
        <button
          onClick={onRetry}
          className="mt-2 ml-7 text-sm font-medium underline hover:no-underline"
        >
          重试
        </button>
      )}
      {dismissible && (
        <button
          onClick={() => { setDismissed(true); onDismiss?.() }}
          className="absolute right-2 top-2 rounded-md p-1 hover:bg-black/5 transition-colors"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

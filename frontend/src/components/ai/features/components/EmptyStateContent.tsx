import React from 'react'
import { MessageSquare, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EmptyStateContentProps {
  icon?: React.ReactNode
  title?: string
  subtitle?: string
  className?: string
}

export const EmptyStateContent = React.forwardRef<HTMLDivElement, EmptyStateContentProps>(({
  icon,
  title = '暂无消息',
  subtitle = '开始与 AI 助手对话',
  className,
}, ref) => {
  const defaultIcon = (
    <MessageSquare
      className="h-16 w-16 opacity-60 sm:h-16 sm:w-16 md:h-16 md:w-16"
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  )

  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-center text-center',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'mx-auto mb-6 flex h-12 w-12 items-center justify-center sm:h-14 sm:w-14 md:h-16 md:w-16',
          'text-neutral-300 dark:text-neutral-400',
          'es-animate-float es-focus-visible',
        )}
        style={{
          animation: 'gentleFloat 3s ease-in-out infinite',
        }}
        aria-hidden="true"
        role="img"
        aria-label="空状态图标"
      >
        {icon || defaultIcon}
      </div>

      <h2
        id="empty-state-content-title"
        className={cn(
          'mt-6 text-lg font-medium sm:text-base',
          'es-high-contrast-text',
        )}
        style={{ color: 'var(--a11y-text-secondary)' }}
      >
        {title}
      </h2>

      <p
        className={cn(
          'mt-2 max-w-[280px] text-sm font-normal leading-relaxed sm:text-sm',
        )}
        role="note"
        style={{ color: 'var(--a11y-text-tertiary)' }}
      >
        {subtitle}
      </p>
    </div>
  )
})

EmptyStateContent.displayName = 'EmptyStateContent'

export default EmptyStateContent

import React from 'react'
import { cn } from '@/lib/utils'
import { EmptyStateContent } from './EmptyStateContent'
import { StartConversationCard } from './StartConversationCard'
import '@/components/ai/features/styles/empty-state-design-tokens.css'
import '@/components/ai/features/styles/empty-state-animations.css'
import '@/components/ai/features/styles/empty-state-accessibility.css'
import '@/components/ai/features/styles/wcag21-color-system.css'

export interface EmptyStateProps {
  title?: string
  subtitle?: string
  showStartCard?: boolean
  onStartClick?: () => void
  suggestions?: string[]
  className?: string
}

export const EmptyState = React.forwardRef<HTMLElement, EmptyStateProps>(({
  title = '暂无消息',
  subtitle = '开始与 AI 助手对话',
  showStartCard = true,
  onStartClick,
  suggestions,
  className,
}, ref) => {
  return (
    <main
      id="empty-state-main"
      ref={ref}
      role="main"
      aria-label="智能对话区域"
      className={cn(
        'relative flex min-h-[40vh] flex-col items-center justify-center px-6 py-6',
        'sm:min-h-[45vh] sm:px-8 sm:py-7',
        'md:min-h-[50vh] md:py-8',
        'lg:min-h-[55vh]',
        'max-w-2xl mx-auto',
        'animate-[fadeInUp_0.5s_ease-out]',
        'bg-gradient-to-b from-white to-gray-50/50',
        'dark:from-gray-900 dark:to-gray-950',
        'before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_30%,rgba(99,102,241,0.05)_0%,transparent_70%)] dark:before:hidden',
        className,
      )}
    >
      {showStartCard ? (
        <div className="w-full animate-[scaleIn_0.4s_ease-out_0.1s_both]" role="region" aria-label="快速开始操作">
          <StartConversationCard
            onClick={onStartClick}
            suggestions={suggestions}
            title={title}
            subtitle={subtitle}
          />
        </div>
      ) : (
        <section
          aria-labelledby="empty-state-title"
          className="w-full animate-[fadeInUp_0.6s_ease-out_0.1s_both]"
        >
          <EmptyStateContent
            title={title}
            subtitle={subtitle}
            className="w-full"
          />
        </section>
      )}

      <div
        aria-live="polite"
        aria-atomic="true"
        className="es-live-region"
      >
        {title && `当前状态：${title}`}
      </div>
    </main>
  )
})

EmptyState.displayName = 'EmptyState'

export default EmptyState

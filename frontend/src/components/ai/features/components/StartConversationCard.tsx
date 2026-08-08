import React from 'react'
import { Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StartConversationCardProps {
  title?: string
  subtitle?: string
  icon?: React.ReactNode
  onClick?: () => void
  suggestions?: string[]
  className?: string
}

export const StartConversationCard = React.forwardRef<
  HTMLDivElement,
  StartConversationCardProps
>(({
  title = '开始新对话',
  subtitle = '描述您的配方需求，即刻获得智能建议',
  icon,
  onClick,
  suggestions,
  className,
}, ref) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }

  return (
    <article
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={`${title}。${subtitle}${suggestions ? `，包含 ${suggestions.length} 个建议` : ''}`}
      aria-describedby="start-card-description"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative w-full max-w-[400px] mx-auto min-h-[160px]',
        'rounded-2xl p-8 sm:p-8 md:p-8 es-card',
        'bg-gradient-to-br from-white to-slate-50/80',
        'dark:from-slate-800 dark:to-slate-900/90',
        'border border-neutral-200/80 dark:border-neutral-700/60',
        'shadow-md dark:shadow-slate-900/30',
        'cursor-pointer transition-all duration-200 ease-out',
        'hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary-500/10',
        'hover:border-primary-300 dark:hover:border-primary-600',
        'active:scale-[0.98] active:brightness-[0.98] active:transition-duration-100',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 es-focus-visible',
        'focus:ring-offset-white dark:focus:ring-offset-slate-900',
        className,
      )}
    >
      <div className="flex flex-col items-center text-center">
        <div
          className="mx-auto mb-6 flex h-14 w-14 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-violet-400 shadow-inner shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_25px_rgba(99,102,241,0.4)] es-animate-pulse"
          style={{ animationDuration: '3s' }}
          aria-hidden="true"
          role="img"
          aria-label="AI 助手图标"
        >
          {icon || <Brain className="h-7 w-7 text-white" strokeWidth={2} />}
        </div>

        <h3
          id="start-card-title"
          className="mt-5 text-2xl font-semibold tracking-tight text-neutral-800 dark:text-neutral-100 es-high-contrast-text"
          style={{ color: 'var(--a11y-text-primary)' }}
        >
          {title}
        </h3>

        <p
          id="start-card-description"
          className="mt-2 max-w-[320px] text-sm font-normal leading-relaxed text-neutral-600 dark:text-neutral-400"
          style={{ color: 'var(--a11y-text-secondary)' }}
        >
          {subtitle}
        </p>

        {suggestions && suggestions.length > 0 && (
          <nav
            className="mt-6 flex flex-wrap items-center justify-center gap-2"
            aria-label="快速建议选项"
            role="navigation"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onClick?.()
                }}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium',
                  'border-neutral-300 bg-white',
                  'dark:border-neutral-600 dark:bg-neutral-800',
                  'transition-colors duration-150',
                  'hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700',
                  'dark:hover:border-primary-600 dark:hover:bg-primary-900/30 dark:hover:text-primary-300',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 es-focus-visible',
                )}
                style={{
                  color: 'var(--a11y-text-secondary)',
                  borderColor: 'var(--a11y-border-strong)',
                }}
                aria-label={`选择建议：${suggestion}`}
              >
                {suggestion}
              </button>
            ))}
          </nav>
        )}
      </div>
    </article>
  )
})

StartConversationCard.displayName = 'StartConversationCard'

export default StartConversationCard

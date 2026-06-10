import React from 'react'
import { MessageSquare, Sparkles, Bell, X, Plus, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EmptyStateHeaderProps {
  chatName?: string
  onClose?: () => void
  messageCount?: number
  onNotificationClick?: () => void
  onNewChatClick?: () => void
  className?: string
}

export const EmptyStateHeader = React.forwardRef<HTMLDivElement, EmptyStateHeaderProps>(({
  chatName = 'loopseek chat',
  onClose,
  messageCount,
  onNotificationClick,
  onNewChatClick,
  className,
}, ref) => {
  return (
    <header
      ref={ref}
      className={cn(
        'flex w-full items-center justify-between',
        className,
      )}
      role="banner"
    >
      <div className="flex items-center gap-2">
        <Sparkles
          className="h-5 w-5 text-primary-600 dark:text-primary-400 es-focus-visible"
          aria-hidden="true"
          role="img"
        />
        <h1
          id="empty-state-title"
          className="text-xl font-semibold text-slate-800 dark:text-slate-100 sm:text-lg es-high-contrast-text"
        >
          智能对话
        </h1>

        <div
          className="ml-3 flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 dark:border-primary-800 dark:bg-primary-900/30"
          role="status"
          aria-label={`当前对话：${chatName}`}
        >
          <Hash className="h-3 w-3 text-primary-700 dark:text-primary-300" aria-hidden="true" />
          <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
            {chatName}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="ml-1 flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-red-100 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 es-focus-ring"
              aria-label={`关闭 ${chatName}`}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <nav className="ml-auto flex items-center gap-2" aria-label="操作菜单">
        <button
          type="button"
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-full',
            'transition-colors duration-150',
            'hover:bg-gray-100 dark:hover:bg-gray-800',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500 es-focus-visible',
            'dark:focus:ring-offset-gray-900',
          )}
          aria-label={`消息${messageCount ? ` (${messageCount > 99 ? '99+' : messageCount})` : ''}`}
          aria-live="polite"
        >
          <MessageSquare className="h-5 w-5 text-slate-600 dark:text-slate-400" aria-hidden="true" />
          {messageCount !== undefined && messageCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
              role="status"
              aria-label={`${messageCount} 条未读消息`}
            >
              {messageCount > 99 ? '99+' : messageCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onNotificationClick}
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-full',
            'transition-colors duration-150',
            'hover:bg-gray-100 dark:hover:bg-gray-800',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500 es-focus-visible',
            'dark:focus:ring-offset-gray-900',
          )}
          aria-label="通知，有新通知"
        >
          <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" aria-hidden="true" />
          <span
            className="absolute right-0 top-0 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900"
            role="presentation"
            aria-hidden="true"
          />
        </button>

        {onNewChatClick && (
          <button
            type="button"
            onClick={onNewChatClick}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2',
              'bg-green-600 text-sm font-medium text-white shadow-sm',
              'transition-all duration-200',
              'hover:bg-green-700 hover:shadow-md',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500 es-focus-visible',
              'dark:focus:ring-offset-gray-900',
            )}
            aria-label="创建新对话"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>新对话</span>
          </button>
        )}
      </nav>
    </header>
  )
})

EmptyStateHeader.displayName = 'EmptyStateHeader'

export default EmptyStateHeader

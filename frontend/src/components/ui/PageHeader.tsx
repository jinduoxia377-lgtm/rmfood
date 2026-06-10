/**
 * RMFOOD 设计系统 — PageHeader 页面标题
 * 统一页面标题 + 描述 + 操作按钮布局
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  titleClassName?: string
  description?: string
  descriptionClassName?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, titleClassName, description, descriptionClassName, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4', className)}>
      <div>
        <h1 className={cn('text-2xl font-bold text-slate-900 dark:text-white tracking-tight', titleClassName)}>{title}</h1>
        {description && (
          <p className={cn('mt-1 text-sm text-slate-500 dark:text-slate-400', descriptionClassName)}>{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  )
}

/**
 * Loading 全局加载指示器
 * 路由级页面加载时显示骨架屏 / 旋转加载
 */
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
  fullScreen?: boolean
}

export function LoadingSpinner({ size = 'md', text, className, fullScreen = false }: LoadingSpinnerProps) {
  const sizeMap = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }

  const content = (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <Loader2 className={cn(sizeMap[size], 'animate-spin text-primary-500')} />
      {text && <p className="text-sm text-neutral-400 dark:text-neutral-500">{text}</p>}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm flex items-center justify-center">
        {content}
      </div>
    )
  }

  return content
}

/**
 * 页面级骨架屏 — 模拟内容布局
 */
export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* PageHeader skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-700 rounded-lg" />
        <div className="h-4 w-72 bg-neutral-200 dark:bg-neutral-700 rounded-lg" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded" />
            <div className="h-8 w-12 bg-neutral-200 dark:bg-neutral-700 rounded" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5 space-y-4">
          <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded" />
          <div className="h-[280px] bg-neutral-100 dark:bg-neutral-800 rounded-xl" />
        </div>
        <div className="card p-5 space-y-4">
          <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded" />
          <div className="h-[280px] bg-neutral-100 dark:bg-neutral-800 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

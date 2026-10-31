/**
 * 数据分析页面骨架屏组件
 * 提供加载状态下的占位符展示，提升用户体验
 */
import React from 'react'

export function AnalyticsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-pulse">
      <div className="h-16 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />

      <div className="h-14 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-24 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />
        <div className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />
      </div>

      <div className="space-y-4">
        <div className="h-12 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />

        <div className="h-80 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-48 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />
          <div className="h-48 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />
          <div className="h-48 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function KPICardSkeleton() {
  return (
    <div className="card p-4 bg-neutral-50 dark:bg-neutral-800/50 animate-pulse">
      <div className="w-10 h-10 bg-neutral-200 dark:bg-neutral-700 rounded mb-3" />
      <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded mb-2" />
      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
    </div>
  )
}

export function ChartSkeleton({ height: _height = 300 }: { height?: number }) {
  return (
    <div className="card p-6 bg-white dark:bg-neutral-900 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-32" />
        <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-24" />
      </div>
      <div className="h-[300px] bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-700 rounded-lg" />
    </div>
  )
}

export function ActivityItemSkeleton() {
  return (
    <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-2 h-2 bg-neutral-300 dark:bg-neutral-600 rounded-full mt-2" />
        <div className="flex-1">
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded mb-2" />
          <div className="flex items-center gap-4">
            <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-16" />
            <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-12" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsSkeleton
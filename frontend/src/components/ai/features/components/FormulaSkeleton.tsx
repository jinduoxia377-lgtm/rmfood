/**
 * FormulaSkeleton - 配方列表骨架屏加载组件 (v1.0)
 *
 * 在数据加载时显示占位符动画，提升用户体验。
 * 使用 shimmer 效果模拟真实卡片布局。
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-20
 */

import React from 'react'

interface FormulaSkeletonProps {
  /** 显示几个骨架卡片（默认5） */
  count?: number
}

export const FormulaSkeleton = React.memo<FormulaSkeletonProps>(({ count = 5 }) => {
  return (
    <div className="space-y-4 p-6 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          {/* 标题行：复选框 + 标题 + 质量等级 */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-5 h-5 rounded border-2 skeleton-shimmer" />
            <div className="h-5 w-48 rounded skeleton-shimmer" />
            <div className="h-6 w-12 rounded-full skeleton-shimmer ml-auto" />
          </div>

          {/* 功效标签行 */}
          <div className="flex gap-2 mb-3">
            <div className="h-6 w-16 rounded-full skeleton-shimmer" />
            <div className="h-6 w-20 rounded-full skeleton-shimmer" />
            <div className="h-6 w-14 rounded-full skeleton-shimmer" />
            <div className="h-6 w-18 rounded-full skeleton-shimmer" />
          </div>

          {/* 置信度标签 */}
          <div className="flex justify-end mb-3">
            <div className="h-6 w-24 rounded-md skeleton-shimmer" />
          </div>

          {/* 成分 pill 标签行 */}
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="h-8 w-20 rounded-md skeleton-shimmer" />
            <div className="h-8 w-24 rounded-md skeleton-shimmer" />
            <div className="h-8 w-18 rounded-md skeleton-shimmer" />
            <div className="h-8 w-22 rounded-md skeleton-shimmer" />
            <div className="h-8 w-16 rounded-md skeleton-shimmer bg-primary-50 dark:bg-primary-900/20" />
          </div>

          {/* 底部元信息行 */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center gap-2">
              <div className="h-4 w-32 rounded skeleton-shimmer" />
              <div className="h-4 w-24 rounded skeleton-shimmer" />
            </div>
            <div className="h-4 w-20 rounded skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  )
})

FormulaSkeleton.displayName = 'FormulaSkeleton'

export type { FormulaSkeletonProps }

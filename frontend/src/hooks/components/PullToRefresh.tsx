/**
 * 下拉刷新组件
 * 支持触摸设备的下拉刷新交互
 */

import React, { useState, useRef } from 'react'
import { ChevronUp } from 'lucide-react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
  /** 自定义下拉提示 */
  pullDownText?: string
  /** 自定义刷新中提示 */
  refreshingText?: string
  /** 触发刷新的最小距离（像素） */
  threshold?: number
  /** 最大下拉距离（像素） */
  maxDistance?: number
}

export default function PullToRefresh({
  onRefresh,
  children,
  pullDownText = '下拉刷新',
  refreshingText = '正在刷新...',
  threshold = 60,
  maxDistance = 100,
}: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    const container = containerRef.current
    if (container?.scrollTop === 0) {
      startY.current = e.touches[0].clientY
      setPullDistance(0)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const container = containerRef.current
    if (!container || container.scrollTop > 0 || isRefreshing) return

    const distance = Math.max(0, e.touches[0].clientY - startY.current)
    const easedDistance = distance * 0.5 // 减缓下拉速度
    setPullDistance(Math.min(easedDistance, maxDistance))
  }

  const handleTouchEnd = async () => {
    if (pullDistance > threshold && !isRefreshing) {
      setIsRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
      }
    }
    setPullDistance(0)
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-y-auto overscroll-contain pull-to-refresh"
      style={{ height: '100%' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 刷新指示器 */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center h-12 transition-all duration-200"
        style={{
          transform: `translateY(${Math.min(pullDistance, 40)}px)`,
          opacity: pullDistance > 20 ? 1 : 0,
        }}
      >
        <div className="flex items-center gap-2 text-sm text-secondary-600 dark:text-secondary-400">
          {isRefreshing ? (
            <>
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              {refreshingText}
            </>
          ) : (
            <>
              <ChevronUp
                size={16}
                style={{ transform: `rotate(${pullDistance > threshold ? '180deg' : '0deg'})` }}
              />
              {pullDistance > threshold ? '释放立即刷新' : pullDownText}
            </>
          )}
        </div>
      </div>

      {/* 内容 */}
      <div style={{ paddingTop: isRefreshing ? '48px' : undefined }}>
        {children}
      </div>
    </div>
  )
}

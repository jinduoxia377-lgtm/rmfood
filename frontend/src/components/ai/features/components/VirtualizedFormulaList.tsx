/**
 * VirtualizedFormulaList - 高性能虚拟滚动配方列表组件
 *
 * 使用 @tanstack/react-virtual 实现，适用于大数据量场景（100+条配方）
 * 特性：
 * - 只渲染可视区域内的项目
 * - 支持动态高度测量
 * - 预渲染额外项数避免滚动白屏
 * - CSS containment 优化渲染性能
 * - 自动在数据量>100时启用
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-20
 */

import React, { useRef, useCallback, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { AIRecognizedFormula } from '@/types/ai.types'

interface VirtualizedFormulaListProps {
  /** 配方列表数据 */
  formulas: AIRecognizedFormula[]
  /** 预估每项高度（默认120px） */
  estimateSize?: number
  /** 预渲染额外项数（默认5） */
  overscan?: number
  /** 渲染函数 */
  children: (formula: AIRecognizedFormula, index: number) => React.ReactNode
  /** 容器高度（默认600px） */
  height?: number | string
  /** 是否显示空状态 */
  emptyComponent?: React.ReactNode
  /** 加载状态 */
  isLoading?: boolean
  /** 加载组件 */
  loadingComponent?: React.ReactNode
  /** 列表容器自定义类名 */
  className?: string
}

export const VirtualizedFormulaList: React.FC<VirtualizedFormulaListProps> = ({
  formulas,
  estimateSize = 120,
  overscan = 5,
  children,
  height = 600,
  emptyComponent,
  isLoading = false,
  loadingComponent,
  className = '',
}) => {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: formulas.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  const measuredSizesRef = useRef<Map<number, number>>(new Map())

  const measureElement = useCallback((element: HTMLElement | null, index: number) => {
    if (!element) return

    const { height } = element.getBoundingClientRect()
    const roundedHeight = Math.ceil(height)

    if (measuredSizesRef.current.get(index) !== roundedHeight) {
      measuredSizesRef.current.set(index, roundedHeight)
      rowVirtualizer.measure()
    }
  }, [rowVirtualizer])

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ minHeight: typeof height === 'number' ? `${height}px` : height }}>
        {loadingComponent || (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500">加载中...</p>
          </div>
        )}
      </div>
    )
  }

  if (formulas.length === 0) {
    return (
      <div className={className} style={{ minHeight: typeof height === 'number' ? `${height}px` : height }}>
        {emptyComponent || (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <p className="text-base font-medium">暂无配方数据</p>
            <p className="text-sm mt-1 text-gray-400">继续对话以生成配方</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className={`overflow-auto relative ${className}`}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        contain: 'strict',
        willChange: 'transform',
      }}
      data-testid="virtualized-formula-list"
    >
      <div
        style={{
          height: `${totalSize}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const formula = formulas[virtualRow.index]
          if (!formula) return null

          return (
            <div
              key={formula.id}
              data-index={virtualRow.index}
              ref={(el) => measureElement(el, virtualRow.index)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {children(formula, virtualRow.index)}
            </div>
          )
        })}
      </div>

      {/* 滚动位置指示器（开发环境） */}
      {process.env.NODE_ENV === 'development' && (
        <div
          className="fixed bottom-4 right-4 bg-black/70 text-white text-xs px-2 py-1 rounded z-50 pointer-events-none"
          style={{ display: 'none' }}
          data-virtual-scroll-debug
        >
          可视: {virtualItems.length}/{formulas.length}
        </div>
      )}
    </div>
  )
}

export default VirtualizedFormulaList

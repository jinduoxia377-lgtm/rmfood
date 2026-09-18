/**
 * PerformanceOptimizer - 性能优化工具集
 * 提供虚拟滚动、数据分页、内存管理、懒加载等性能优化功能
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronLeft, ChevronRight, Loader2, Database, Zap, MemoryStick } from 'lucide-react'

// ─── 类型定义 ───
export interface PaginationConfig {
  currentPage: number
  pageSize: number
  totalItems: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
}

interface VirtualScrollProps<T> {
  items: T[]
  itemHeight: number | ((index: number) => number)
  overscan?: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  estimateSize?: () => number
}

// ─── 虚拟滚动组件 ───
export function VirtualizedList<T>({
  items,
  itemHeight,
  overscan = 5,
  renderItem,
  className = '',
}: VirtualScrollProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => typeof itemHeight === 'function' ? itemHeight(index) : itemHeight,
    overscan,
  })

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height: '600px' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const isLoaderRow = virtualItem.index >= items.length

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {isLoaderRow ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                  <span className="ml-2 text-sm text-text-muted">加载更多数据...</span>
                </div>
              ) : (
                renderItem(items[virtualItem.index], virtualItem.index)
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 分页组件 ───
export function Pagination({
  currentPage,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: PaginationConfig) {
  const [inputPage, setInputPage] = useState(currentPage)

  // 计算显示的页码范围
  const pageNumbers = useMemo(() => {
    const delta = 2 // 当前页前后显示的页数
    const range = []
    const rangeWithDots: (number | string)[] = []

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i)
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...')
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages)
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages)
    }

    return rangeWithDots
  }, [currentPage, totalPages])

  // 处理输入跳转
  const handleJumpToPage = useCallback(() => {
    const page = parseInt(inputPage.toString())
    if (page >= 1 && page <= totalPages) {
      onPageChange(page)
    }
    setInputPage(currentPage)
  }, [inputPage, currentPage, totalPages, onPageChange])

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700">
      {/* 左侧：信息 */}
      <div className="flex items-center gap-4 text-sm text-text-muted">
        <span>共 {totalItems.toLocaleString()} 条记录</span>

        {/* 每页条数选择器 */}
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 input text-xs"
          >
            {[10, 20, 50, 100, 200].map(size => (
              <option key={size} value={size}>{size} 条/页</option>
            ))}
          </select>
        )}
      </div>

      {/* 中间：页码导航 */}
      <div className="flex items-center gap-1">
        {/* 上一页按钮 */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* 页码按钮 */}
        {pageNumbers.map((pageNum, index) =>
          pageNum === '...' ? (
            <span key={`dots-${index}`} className="px-2 py-1 text-text-muted">...</span>
          ) : (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum as number)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                currentPage === pageNum
                  ? 'bg-primary-600 text-white font-medium'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-text-primary'
              }`}
            >
              {pageNum}
            </button>
          ),
        )}

        {/* 下一页按钮 */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 右侧：跳转输入框 */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-text-muted">跳转到</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={inputPage}
          onChange={(e) => setInputPage(Number(e.target.value))}
          onKeyDown={(e) => e.key === 'Enter' && handleJumpToPage()}
          className="w-16 px-2 py-1 input text-center"
        />
        <button
          onClick={handleJumpToPage}
          className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded text-text-primary hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
        >
          Go
        </button>
      </div>
    </div>
  )
}

// ─── 数据缓存管理器 ───
class DataCacheManager {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number; size: number }>()
  private maxSize: number
  private currentSize: number

  constructor(maxSizeMB = 50) {
    this.maxSize = maxSizeMB * 1024 * 1024 // 转换为字节
    this.currentSize = 0
  }

  set(key: string, data: any, ttl = 30_000): void {
    // 计算数据大小（简化版）
    const size = new TextEncoder().encode(JSON.stringify(data)).length

    // 如果超出容量，清理旧缓存
    if (this.currentSize + size > this.maxSize) {
      this.evictLRU()
    }

    this.cache.set(key, { data, timestamp: Date.now(), ttl, size })
    this.currentSize += size
  }

  get(key: string): any | null {
    const item = this.cache.get(key)

    if (!item) return null

    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.delete(key)
      return null
    }

    // 更新访问时间（LRU）
    this.cache.set(key, { ...item, timestamp: Date.now() })

    return item.data
  }

  delete(key: string): boolean {
    const item = this.cache.get(key)
    if (item) {
      this.currentSize -= item.size
      return this.cache.delete(key)
    }
    return false
  }

  clear(): void {
    this.cache.clear()
    this.currentSize = 0
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  stats(): {
    size: number
    count: number
    memoryUsageMB: number
    hitRate: number
  } {
    return {
      size: this.currentSize,
      count: this.cache.size,
      memoryUsageMB: Math.round(this.currentSize / (1024 * 1024) * 100) / 100,
      hitRate: 0, // 实际应用中需要统计命中率
    }
  }

  private evictLRU(): void {
    // 找到最久未使用的项并删除
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.delete(oldestKey)
    }
  }
}

export const globalCacheManager = new DataCacheManager()

// ─── 内存监控组件 ───
export function MemoryMonitor() {
  const [memoryStats, setMemoryStats] = useState<{
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  } | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      if ('memory' in performance) {
        const perfWithMemory = performance as { memory?: PerformanceMemory } | undefined;
        setMemoryStats({
          usedJSHeapSize: perfWithMemory?.memory?.usedJSHeapSize ?? 0,
          totalJSHeapSize: perfWithMemory?.memory?.totalJSHeapSize ?? 0,
          jsHeapSizeLimit: perfWithMemory?.memory?.jsHeapSizeLimit ?? 0,
        })
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  if (!memoryStats) return null

  const usagePercent = (memoryStats.usedJSHeapSize / memoryStats.jsHeapSizeLimit) * 100
  const isWarning = usagePercent > 80
  const isCritical = usagePercent > 95

  return (
    <div className={`fixed bottom-4 right-4 p-3 rounded-lg shadow-lg border z-50 transition-all ${
      isCritical ? 'bg-error-50 dark:bg-error-900/20 border-red-200 dark:border-red-800' :
      isWarning ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
      'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <MemoryStick className={`w-4 h-4 ${isCritical ? 'text-error-500' : isWarning ? 'text-yellow-500' : 'text-success-500'}`} />
        <span className="text-xs font-semibold">内存使用</span>
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-text-muted">已用:</span>
          <span>{(memoryStats.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB</span>
        </div>

        <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              isCritical ? 'bg-error-500' : isWarning ? 'bg-yellow-500' : 'bg-success-500'
            }`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>

        <div className="text-right text-text-muted">
          {(usagePercent).toFixed(1)}%
        </div>
      </div>

      {isCritical && (
        <p className="text-[10px] text-error-600 mt-2 font-medium">
          ⚠️ 内存使用过高，建议刷新页面或关闭部分标签页
        </p>
      )}
    </div>
  )
}

// ─── 数据预取 Hook ───
export function useDataPrefetch<T>(
  queryKey: string[],
  fetcher: () => Promise<T>,
  options?: {
    prefetchOnHover?: boolean
    prefetchDelay?: number
    staleTime?: number
  },
): {
  data: T | undefined
  isLoading: boolean
  error: Error | null
  prefetch: () => void
} {
  const [data, setData] = useState<T | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const result = await fetcher()
      setData(result)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [fetcher])

  const prefetch = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      fetchData()
    }, options?.prefetchDelay || 200)
  }, [fetchData, options?.prefetchDelay])

  return { data, isLoading, error, prefetch }
}

// ─── 导出工具函数 ───

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), wait)
  }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * 格式化数字（添加千位分隔符）
 */
export function formatNumber(num: number, locale = 'zh-CN'): string {
  return num.toLocaleString(locale)
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export default VirtualizedList

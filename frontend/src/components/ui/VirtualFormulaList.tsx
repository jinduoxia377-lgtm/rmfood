/**
 * 虚拟列表组件
 *
 * @description 高性能虚拟滚动列表，适用于大量数据的渲染
 * @version 1.0.0
 */

import React, { useRef, useMemo, useCallback, useEffect } from 'react'

export interface VirtualItem<T> {
  index: number
  start: number
  size: number
  data: T
}

export interface VirtualListOptions<T> {
  items: T[]
  estimatedSize?: number
  overscan?: number
  getItemKey?: (item: T, index: number) => string | number
}

export interface UseVirtualizerReturn<T> {
  virtualItems: VirtualItem<T>[]
  totalSize: number
  scrollToIndex: (index: number) => void
  scrollToOffset: (offset: number) => void
}

export function useVirtualizer<T>({
  items,
  estimatedSize = 300,
  overscan = 3,
  getItemKey,
}: VirtualListOptions<T>): UseVirtualizerReturn<T> {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollTopRef = useRef(0)
  const [totalSize, setTotalSize] = React.useState(0)
  const sizesRef = useRef<Map<number, number>>(new Map())

  const getItemKeyCallback = useCallback(
    (index: number) => {
      const item = items[index]
      if (!item) return index
      if (getItemKey) {
        return getItemKey(item, index)
      }
      return index
    },
    [items, getItemKey],
  )

  const measureItem = useCallback((index: number, element: HTMLElement | null) => {
    if (!element) return

    const { height } = element.getBoundingClientRect()
    const roundedHeight = Math.ceil(height)

    if (sizesRef.current.get(index) !== roundedHeight) {
      sizesRef.current.set(index, roundedHeight)
    }
  }, [])

  const calculateTotalSize = useCallback(() => {
    let total = 0
    for (let i = 0; i < items.length; i++) {
      total += sizesRef.current.get(i) || estimatedSize
    }
    return total
  }, [items.length, estimatedSize])

  const getVirtualItems = useCallback((): VirtualItem<T>[] => {
    const scrollTop = scrollTopRef.current
    const containerHeight = containerRef.current?.clientHeight || 0

    const itemCount = items.length
    const sizes = sizesRef.current

    let offset = 0
    const virtualItems: VirtualItem<T>[] = []
    let lastMeasuredIndex = -1

    for (let i = 0; i < itemCount; i++) {
      const itemSize = sizes.get(i) || estimatedSize
      const itemEnd = offset + itemSize

      if (itemEnd < scrollTop - overscan * estimatedSize) {
        offset = itemEnd
        lastMeasuredIndex = i
        continue
      }

      if (offset > scrollTop + containerHeight + overscan * estimatedSize) {
        break
      }

      virtualItems.push({
        index: i,
        start: offset,
        size: itemSize,
        data: items[i],
      })

      offset = itemEnd
      lastMeasuredIndex = i
    }

    return virtualItems
  }, [items, estimatedSize, overscan])

  const virtualItems = useMemo(() => getVirtualItems(), [getVirtualItems])

  const scrollToIndex = useCallback((index: number) => {
    if (!containerRef.current) return

    let offset = 0
    const sizes = sizesRef.current

    for (let i = 0; i < index; i++) {
      offset += sizes.get(i) || estimatedSize
    }

    containerRef.current.scrollTop = offset
  }, [estimatedSize])

  const scrollToOffset = useCallback((offset: number) => {
    if (!containerRef.current) return
    containerRef.current.scrollTop = offset
  }, [])

  useEffect(() => {
    setTotalSize(calculateTotalSize())
  }, [calculateTotalSize])

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        scrollTopRef.current = containerRef.current.scrollTop
      }
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true })
      return () => container.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return {
    virtualItems,
    totalSize,
    scrollToIndex,
    scrollToOffset,
  }
}

export interface VirtualFormulaListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  estimatedItemHeight?: number
  overscan?: number
  getItemKey?: (item: T, index: number) => string | number
  className?: string
  emptyComponent?: React.ReactNode
  loadingComponent?: React.ReactNode
  isLoading?: boolean
}

export function VirtualFormulaList<T>({
  items,
  renderItem,
  estimatedItemHeight = 350,
  overscan = 3,
  getItemKey,
  className = '',
  emptyComponent,
  loadingComponent,
  isLoading = false,
}: VirtualFormulaListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    virtualItems,
    totalSize,
    scrollToIndex,
  } = useVirtualizer({
    items,
    estimatedSize: estimatedItemHeight,
    overscan,
    getItemKey,
  })

  const measuredRef = useRef<Map<string, HTMLElement>>(new Map())

  const itemRefs = useMemo(() => {
    return new Map<string, React.RefObject<HTMLElement>>()
  }, [])

  const getItemRef = (key: string | number): React.RefObject<HTMLElement> | undefined => {
    const keyStr = String(key)
    if (!itemRefs.has(keyStr)) {
      itemRefs.set(keyStr, { current: null })
    }
    return itemRefs.get(keyStr)
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        {loadingComponent || (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
            <p className="text-gray-500">加载中...</p>
          </div>
        )}
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div className={`py-12 ${className}`}>
        {emptyComponent || (
          <div className="text-center text-gray-500">
            暂无数据
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: 'calc(100vh - 300px)', minHeight: '400px' }}
    >
      <div style={{ height: totalSize, position: 'relative' }}>
        {virtualItems.map((virtualItem) => {
          const key = getItemKey ? getItemKey(virtualItem.data, virtualItem.index) : virtualItem.index
          const ref = getItemRef(key)

          return (
            <div
              key={key}
              ref={ref as React.RefObject<HTMLDivElement>}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
              data-index={virtualItem.index}
            >
              {renderItem(virtualItem.data, virtualItem.index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default VirtualFormulaList

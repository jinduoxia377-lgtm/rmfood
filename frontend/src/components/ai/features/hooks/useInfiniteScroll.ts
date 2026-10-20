/**
 * useInfiniteScroll — 无限滚动 + 历史分页 Hook
 *
 * 功能：
 * - 基于 IntersectionObserver 检测滚动到顶部，自动加载更早的消息
 * - 分页切片：从最新消息往前按 pageSize 加载
 * - 提供 loadMore 手动触发、hasMore 状态、加载中指示器
 *
 * @example
 * ```tsx
 * const { visibleMessages, hasMore, loadMore, isLoadingMore, sentinelRef } =
 *   useInfiniteScroll(messages, { pageSize: 20 })
 *
 * // 在消息列表顶部放置 sentinel 元素
 * <div ref={sentinelRef} />
 * {visibleMessages.map(msg => ...)}
 * ```
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import type { ChatMessage } from './useChatMessages'
import { logger } from '@/utils/safeLogger'

export interface UseInfiniteScrollOptions {
  /** 每页消息数量（默认20） */
  pageSize?: number
}

export interface UseInfiniteScrollReturn {
  /** 当前可见的消息切片（从最早已加载到最新） */
  visibleMessages: ChatMessage[]
  /** 是否还有更多历史消息可加载 */
  hasMore: boolean
  /** 手动加载更早的消息 */
  loadMore: () => void
  /** 是否正在加载更多 */
  isLoadingMore: boolean
  /** 已加载的总消息数 */
  totalLoaded: number
  /** 哨兵元素 ref（放在列表顶部用于触发加载） */
  sentinelRef: React.RefObject<HTMLDivElement | null>
}

const DEFAULT_PAGE_SIZE = 20

export function useInfiniteScroll(
  messages: ChatMessage[],
  options: UseInfiniteScrollOptions = {},
): UseInfiniteScrollReturn {
  const { pageSize = DEFAULT_PAGE_SIZE } = options

  const [totalLoaded, setTotalLoaded] = useState<number>(() => {
    // 初始只显示最近 pageSize 条消息
    return Math.min(messages.length, pageSize)
  })
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // 计算当前可见的消息切片（取最新的 totalLoaded 条）
  const visibleMessages = messages.length > totalLoaded
    ? messages.slice(messages.length - totalLoaded)
    : messages

  const hasMore = totalLoaded < messages.length

  /** 加载更早的一批消息 */
  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return

    setIsLoadingMore(true)
    logger.info('[useInfiniteScroll] 📜 加载历史消息:', {
      currentLoaded: totalLoaded,
      totalMessages: messages.length,
      pageSize,
    })

    // 使用 requestAnimationFrame 让 UI 先渲染 loading 状态
    requestAnimationFrame(() => {
      setTotalLoaded(prev => Math.min(prev + pageSize, messages.length))
      setIsLoadingMore(false)
      logger.info('[useInfiniteScroll] ✅ 历史消息加载完成:', {
        newTotal: Math.min(totalLoaded + pageSize, messages.length),
      })
    })
  }, [hasMore, isLoadingMore, totalLoaded, messages.length, pageSize])

  // 当外部 messages 变化时（如新消息到来），自动调整 totalLoaded
  useEffect(() => {
    if (messages.length > totalLoaded) {
      // 新消息到达时，保持当前可见范围并包含新消息
      setTotalLoaded(prev => prev + (messages.length - (messages.length > prev ? messages.length - prev : 0)))
    }
    // 如果消息被清空或减少，重置 loaded 计数
    if (messages.length === 0) {
      setTotalLoaded(0)
    }
  }, [messages.length])

  // IntersectionObserver：检测哨兵元素进入视口时触发加载
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    // 清理旧的 observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && hasMore && !isLoadingMore) {
          logger.debug('[useInfiniteScroll] 🔝 哨兵进入视口，触发 loadMore')
          loadMore()
        }
      },
      {
        rootMargin: '200px 0px 0px 0px', // 距离顶部 200px 时提前触发
        threshold: 0,
      },
    )

    observerRef.current.observe(sentinel)

    return () => {
      observerRef.current?.disconnect()
    }
  }, [hasMore, isLoadingMore, loadMore])

  return {
    visibleMessages,
    hasMore,
    loadMore,
    isLoadingMore,
    totalLoaded,
    sentinelRef,
  }
}

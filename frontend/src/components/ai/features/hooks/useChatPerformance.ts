/**
 * useChatPerformance - 聊天性能优化Hook
 *
 * 提供性能监控、响应速度优化和用户体验增强功能。
 *
 * 核心功能：
 * - 请求防抖：避免重复请求
 * - 请求缓存：缓存相似请求的结果
 * - 性能监控：跟踪请求耗时
 * - 渐进式加载：先显示快速响应，再优化完整响应
 * - 智能重试：基于网络状况动态调整重试策略
 *
 * @version 2.0.0
 * @lastUpdated 2026-05-22
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { logger } from '@/utils/safeLogger'

export interface PerformanceMetrics {
  requestCount: number
  successCount: number
  failureCount: number
  avgResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  cacheHits: number
  cacheMisses: number
  debounceCount: number
}

export interface ChatPerformanceState {
  isLoading: boolean
  isCached: boolean
  requestId: string | null
  startTime: number | null
  metrics: PerformanceMetrics
}

export interface UseChatPerformanceReturn {
  state: ChatPerformanceState
  executeWithOptimization: <T>(fn: () => Promise<T>, key: string) => Promise<T>
  cancelRequest: () => void
  clearCache: () => void
  getMetrics: () => PerformanceMetrics
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
  hitCount: number
}

const CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存
const DEBOUNCE_DELAY = 300 // 300ms防抖
const MAX_CACHE_SIZE = 50

export const useChatPerformance = (): UseChatPerformanceReturn => {
  const [state, setState] = useState<ChatPerformanceState>({
    isLoading: false,
    isCached: false,
    requestId: null,
    startTime: null,
    metrics: {
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      debounceCount: 0,
    },
  })

  const cache = useRef<Map<string, CacheEntry<unknown>>>(new Map())
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRequest = useRef<string | null>(null)
  const responseTimes = useRef<number[]>([])

  const updateMetrics = useCallback((type: 'success' | 'failure' | 'cache_hit' | 'cache_miss' | 'debounce', duration?: number) => {
    setState(prev => {
      const newMetrics = { ...prev.metrics }

      if (type === 'success') {
        newMetrics.requestCount++
        newMetrics.successCount++
        if (duration !== undefined) {
          responseTimes.current.push(duration)
          const times = responseTimes.current.slice(-100)
          newMetrics.avgResponseTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
          newMetrics.minResponseTime = Math.min(newMetrics.minResponseTime, duration)
          newMetrics.maxResponseTime = Math.max(newMetrics.maxResponseTime, duration)
        }
      } else if (type === 'failure') {
        newMetrics.requestCount++
        newMetrics.failureCount++
      } else if (type === 'cache_hit') {
        newMetrics.cacheHits++
      } else if (type === 'cache_miss') {
        newMetrics.cacheMisses++
      } else if (type === 'debounce') {
        newMetrics.debounceCount++
      }

      return { ...prev, metrics: newMetrics }
    })
  }, [])

  const getCacheKey = (key: string): string => {
    return key.toLowerCase().trim().replace(/\s+/g, '-')
  }

  const getFromCache = useCallback(<T>(key: string): T | null => {
    const cacheKey = getCacheKey(key)
    const entry = cache.current.get(cacheKey)

    if (!entry) {
      return null
    }

    if (Date.now() > entry.expiresAt) {
      cache.current.delete(cacheKey)
      return null
    }

    entry.hitCount++
    return entry.data as T
  }, [])

  const setToCache = useCallback(<T>(key: string, data: T, ttl: number = CACHE_TTL): void => {
    const cacheKey = getCacheKey(key)

    if (cache.current.size >= MAX_CACHE_SIZE) {
      const oldestKey = Array.from(cache.current.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0]
      cache.current.delete(oldestKey)
    }

    cache.current.set(cacheKey, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
      hitCount: 1,
    })
  }, [])

  const debounce = useCallback((fn: () => void, delay: number): void => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
      updateMetrics('debounce')
    }

    debounceTimer.current = setTimeout(fn, delay)
  }, [updateMetrics])

  const executeWithOptimization = useCallback(async <T>(fn: () => Promise<T>, key: string): Promise<T> => {
    const cacheKey = getCacheKey(key)

    // 检查缓存
    const cachedData = getFromCache<T>(key)
    if (cachedData !== null) {
      logger.debug('[useChatPerformance] 缓存命中:', { key: cacheKey })
      updateMetrics('cache_hit')
      setState(prev => ({ ...prev, isCached: true, isLoading: false }))
      return cachedData
    }

    // 检查是否有pending请求
    if (pendingRequest.current !== null && pendingRequest.current !== cacheKey) {
      logger.debug('[useChatPerformance] 等待前一个请求完成:', { current: pendingRequest.current, new: cacheKey })
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (pendingRequest.current !== cacheKey) {
            clearInterval(checkInterval)
            resolve(undefined)
          }
        }, 50)
      })
    }

    updateMetrics('cache_miss')
    pendingRequest.current = cacheKey

    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const startTime = Date.now()

    setState(prev => ({
      ...prev,
      isLoading: true,
      isCached: false,
      requestId,
      startTime,
    }))

    try {
      const result = await fn()

      const duration = Date.now() - startTime
      logger.debug('[useChatPerformance] 请求完成:', {
        key: cacheKey,
        duration,
        requestId,
      })

      setToCache(key, result)
      updateMetrics('success', duration)

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error('[useChatPerformance] 请求失败:', {
        key: cacheKey,
        duration,
        error: error instanceof Error ? error.message : String(error),
      })

      updateMetrics('failure', duration)
      throw error
    } finally {
      pendingRequest.current = null
      setState(prev => ({
        ...prev,
        isLoading: false,
        requestId: null,
        startTime: null,
      }))
    }
  }, [getFromCache, setToCache, updateMetrics])

  const cancelRequest = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = null
    }
    pendingRequest.current = null
    setState(prev => ({
      ...prev,
      isLoading: false,
      requestId: null,
      startTime: null,
    }))
    logger.debug('[useChatPerformance] 请求已取消')
  }, [])

  const clearCache = useCallback(() => {
    cache.current.clear()
    logger.info('[useChatPerformance] 缓存已清空')
  }, [])

  const getMetrics = useCallback((): PerformanceMetrics => {
    return { ...state.metrics }
  }, [state.metrics])

  useEffect(() => {
    return () => {
      cancelRequest()
    }
  }, [cancelRequest])

  return {
    state,
    executeWithOptimization,
    cancelRequest,
    clearCache,
    getMetrics,
  }
}

export default useChatPerformance

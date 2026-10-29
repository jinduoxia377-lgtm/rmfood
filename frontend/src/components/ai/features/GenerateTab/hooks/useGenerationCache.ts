/**
 * useGenerationCache - 配方生成缓存Hook
 * 
 * @description 缓存配方生成结果，提升重复操作性能
 * @version 1.0.0
 */
import { useState, useCallback, useEffect } from 'react'
import { logger } from '@/utils/safeLogger'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

interface GenerationCache {
  [key: string]: CacheEntry<any>
}

const CACHE_TTL = 5 * 60 * 1000 // 5分钟
const MAX_CACHE_SIZE = 50

class LRUCache {
  private cache: GenerationCache = {}
  private order: string[] = []

  get(key: string): any {
    if (!this.cache[key]) return undefined
    
    const entry = this.cache[key]
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      this.delete(key)
      return undefined
    }
    
    // 更新顺序
    this.order = this.order.filter(k => k !== key)
    this.order.push(key)
    
    return entry.data
  }

  set(key: string, data: any) {
    // 如果已存在，先删除
    if (this.cache[key]) {
      this.order = this.order.filter(k => k !== key)
    }
    
    // 如果超出大小限制，删除最旧的
    if (this.order.length >= MAX_CACHE_SIZE) {
      const oldest = this.order.shift()
      if (oldest) {
        delete this.cache[oldest]
      }
    }
    
    this.cache[key] = {
      data,
      timestamp: Date.now(),
      ttl: CACHE_TTL,
    }
    this.order.push(key)
    
    logger.debug('Cache set', { key, size: this.order.length })
  }

  delete(key: string) {
    delete this.cache[key]
    this.order = this.order.filter(k => k !== key)
  }

  clear() {
    this.cache = {}
    this.order = []
    logger.info('Cache cleared')
  }

  get size() {
    return this.order.length
  }

  getStats() {
    return {
      size: this.order.length,
      maxSize: MAX_CACHE_SIZE,
      ttl: CACHE_TTL,
    }
  }
}

const cache = new LRUCache()

export function useGenerationCache() {
  const [cacheStats, setCacheStats] = useState(cache.getStats())

  useEffect(() => {
    const interval = setInterval(() => {
      setCacheStats(cache.getStats())
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const getCachedResult = useCallback((key: string) => {
    const result = cache.get(key)
    if (result) {
      logger.info('Cache hit', { key })
    }
    return result
  }, [])

  const setCachedResult = useCallback((key: string, data: any) => {
    cache.set(key, data)
    setCacheStats(cache.getStats())
  }, [])

  const clearCache = useCallback(() => {
    cache.clear()
    setCacheStats(cache.getStats())
  }, [])

  return {
    getCachedResult,
    setCachedResult,
    clearCache,
    stats: cacheStats,
  }
}

/**
 * 生成缓存键
 *
 * P2：除功效列表外，加入算法关键参数（population_size/generations/useLlm/
 * max_candidates/strategy/taste_preference 等），与 GenerateTab 实际传参一致，
 * 避免修改算法参数后仍命中旧缓存。options 键按字典序排列，保证键稳定。
 */
export function generateCacheKey(effects: string[], options?: Record<string, unknown>): string {
  const sortedEffects = [...effects].sort().join(',')
  let optionsStr = ''
  if (options) {
    optionsStr = Object.keys(options)
      .sort()
      .map((k) => `${k}:${JSON.stringify(options[k])}`)
      .join('|')
  }
  return `generate_${sortedEffects}_${optionsStr}`
}

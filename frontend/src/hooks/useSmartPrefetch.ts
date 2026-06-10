import { useEffect, useRef, useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

const PREFETCH_THRESHOLD = 0.8

interface PrefetchOptions {
  enabled?: boolean
  staleTime?: number
  gcTime?: number
}

export function useSmartPrefetch<T>(
  key: string[],
  fetcher: () => Promise<T>,
  options: PrefetchOptions = {},
) {
  const { enabled = true, staleTime = 1000 * 60 * 5, gcTime = 1000 * 60 * 10 } = options
  const queryClient = useQueryClient()
  const prefetchedRef = useRef(false)

  useEffect(() => {
    if (!enabled || prefetchedRef.current) return

    const queryCache = queryClient.getQueryCache()
    const query = queryCache.find<T>({ queryKey: key })

    if (query?.state.status === 'pending') {
      queryClient.prefetchQuery({
        queryKey: key,
        queryFn: fetcher,
        staleTime,
        gcTime,
      })
      prefetchedRef.current = true
    }
  }, [enabled, fetcher, key, queryClient, staleTime, gcTime])

  return useQuery({
    queryKey: key,
    queryFn: fetcher,
    staleTime,
    gcTime,
    enabled,
  })
}

export function useBackgroundSync<T>(
  key: string[],
  fetcher: () => Promise<T>,
  interval: number = 1000 * 60 * 5,
) {
  const [data, setData] = useState<T | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const queryClient = useQueryClient()

  const sync = useCallback(async () => {
    setIsSyncing(true)
    try {
      const result = await fetcher()
      setData(result)
      setError(null)
      queryClient.setQueryData(key, result)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsSyncing(false)
    }
  }, [fetcher, key, queryClient])

  useEffect(() => {
    sync()
    const intervalId = setInterval(sync, interval)
    return () => clearInterval(intervalId)
  }, [sync, interval])

  return { data, isSyncing, error, refetch: sync }
}

interface CacheStrategy {
  maxSize: number
  ttl: number
  strategy: 'lru' | 'lfu' | 'fifo'
}

const defaultStrategy: CacheStrategy = {
  maxSize: 100,
  ttl: 1000 * 60 * 10,
  strategy: 'lru',
}

export class AdvancedQueryCache {
  private cache = new Map<string, { data: any; timestamp: number; hits: number }>()
  private strategy: CacheStrategy

  constructor(strategy: CacheStrategy = defaultStrategy) {
    this.strategy = strategy
  }

  get(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > this.strategy.ttl) {
      this.cache.delete(key)
      return null
    }

    entry.hits++
    return entry.data
  }

  set(key: string, data: any): void {
    if (this.cache.size >= this.strategy.maxSize) {
      this.evict()
    }
    this.cache.set(key, { data, timestamp: Date.now(), hits: 0 })
  }

  private evict(): void {
    if (this.strategy.strategy === 'lru') {
      let oldest: string | null = null
      let oldestTime = Infinity
      for (const [key, entry] of this.cache) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp
          oldest = key
        }
      }
      if (oldest) this.cache.delete(oldest)
    } else if (this.strategy.strategy === 'lfu') {
      let leastHits: string | null = null
      let minHits = Infinity
      for (const [key, entry] of this.cache) {
        if (entry.hits < minHits) {
          minHits = entry.hits
          leastHits = key
        }
      }
      if (leastHits) this.cache.delete(leastHits)
    } else {
      const first = this.cache.keys().next().value
      if (first !== undefined) this.cache.delete(first)
    }
  }

  clear(): void {
    this.cache.clear()
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (Date.now() - entry.timestamp > this.strategy.ttl) {
      this.cache.delete(key)
      return false
    }
    return true
  }
}

const aiQueryCache = new AdvancedQueryCache({
  maxSize: 50,
  ttl: 1000 * 60 * 5,
  strategy: 'lru',
})

export function useAICache() {
  return {
    get: (key: string) => aiQueryCache.get(key),
    set: (key: string, data: any) => aiQueryCache.set(key, data),
    has: (key: string) => aiQueryCache.has(key),
    clear: () => aiQueryCache.clear(),
  }
}

export function usePrefetchRecommendations(
  currentEffects: string[],
  prefetchEnabled = true,
) {
  const queryClient = useQueryClient()
  const effectsKey = currentEffects.sort().join(',')

  useEffect(() => {
    if (!prefetchEnabled || !effectsKey) return

    const cacheKey = ['recommendations', effectsKey]
    const cached = queryClient.getQueryData(cacheKey)

    if (!cached) {
      queryClient.prefetchQuery({
        queryKey: cacheKey,
        queryFn: async () => {
          const response = await fetch('/api/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ effects: currentEffects }),
          })
          return response.json()
        },
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 10,
      })
    }
  }, [effectsKey, prefetchEnabled, queryClient, currentEffects])
}

export function useFormulaLinking() {
  const queryClient = useQueryClient()

  const linkFormulaToHistory = useCallback(
    (formulaId: number, historyId: string) => {
      queryClient.setQueryData(['formula-links'], (old: any[] = []) => {
        const updated = [...old, { formulaId, historyId, timestamp: Date.now() }]
        return updated.slice(-100)
      })
    },
    [queryClient],
  )

  const getLinkedHistory = useCallback(
    (formulaId: number) => {
      const links = queryClient.getQueryData(['formula-links'])!
      return links?.filter((l) => l.formulaId === formulaId) || []
    },
    [queryClient],
  )

  return { linkFormulaToHistory, getLinkedHistory }
}

export function useStaleIndicator(queryKey: string[]) {
  const queryClient = useQueryClient()
  const query = queryClient.getQueryState(queryKey)

  return {
    isStale: true,
    dataUpdatedAt: query?.dataUpdatedAt ?? 0,
    timeSinceUpdate: query?.dataUpdatedAt
      ? Date.now() - query.dataUpdatedAt
      : Infinity,
  }
}

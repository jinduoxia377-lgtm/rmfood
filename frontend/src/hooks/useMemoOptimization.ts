import { useMemo, useCallback, useRef, useEffect } from 'react'

export function useMemoizedFn<T extends (...args: any[]) => any>(
  fn: T,
  deps: React.DependencyList = [],
): T {
  const fnRef = useRef(fn)

  useEffect(() => {
    fnRef.current = fn
  })

  return useCallback(
    ((...args) => fnRef.current(...args)) as T,
    [...deps],
  )
}

export interface MemoOptions<T> {
  value: T
  key: string | number
  maxAge?: number
}

const memoCache = new Map<string, { value: any; timestamp: number }>()

export function useTimedMemo<T>({ value, key, maxAge = 60000 }: MemoOptions<T>): T {
  useEffect(() => {
    const now = Date.now()
    memoCache.set(key.toString(), { value, timestamp: now })

    const cleanup = setTimeout(() => {
      memoCache.delete(key.toString())
    }, maxAge)

    return () => clearTimeout(cleanup)
  }, [value, key, maxAge])

  return useMemo(() => value, [value])
}

export function useComputed<T>(compute: () => T, deps: React.DependencyList): T {
  return useMemo(compute, deps)
}

interface CacheOptions {
  maxSize?: number
  maxAge?: number
}

class LRUCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>()
  private maxSize: number
  private maxAge: number

  constructor({ maxSize = 100, maxAge = 60000 }: CacheOptions = {}) {
    this.maxSize = maxSize
    this.maxAge = maxAge
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key)
      return undefined
    }

    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.value
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, { value, timestamp: Date.now() })
  }

  clear(): void {
    this.cache.clear()
  }
}

const formulaCache = new LRUCache<string, any>({ maxSize: 50, maxAge: 300000 })

export function useFormulaCache() {
  return {
    get: (key: string) => formulaCache.get(key),
    set: (key: string, value: any) => formulaCache.set(key, value),
    clear: () => formulaCache.clear(),
  }
}

// NOTE: useIntersectionObserver has been moved to hooks/usePerformance.ts

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>(null)

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref.current as T | undefined
}

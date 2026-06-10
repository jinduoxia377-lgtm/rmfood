import { useMemo, useCallback, useRef, useEffect, useState } from 'react'

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

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = useState(value)
  const lastExecuted = useRef(Date.now())

  useEffect(() => {
    const now = Date.now()
    const timeSinceLastExecution = now - lastExecuted.current

    if (timeSinceLastExecution >= interval) {
      lastExecuted.current = now
      setThrottledValue(value)
    } else {
      const timeoutId = setTimeout(() => {
        lastExecuted.current = Date.now()
        setThrottledValue(value)
      }, interval - timeSinceLastExecution)

      return () => clearTimeout(timeoutId)
    }
  }, [value, interval])

  return throttledValue
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

export function useIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit,
) {
  const observer = useRef<IntersectionObserver | null>(null)

  const observe = useCallback((element: Element) => {
    if (observer.current) {
      observer.current.observe(element)
    }
  }, [])

  const unobserve = useCallback((element: Element) => {
    if (observer.current) {
      observer.current.unobserve(element)
    }
  }, [])

  const disconnect = useCallback(() => {
    if (observer.current) {
      observer.current.disconnect()
    }
  }, [])

  useEffect(() => {
    observer.current = new IntersectionObserver(callback, options)

    return () => {
      disconnect()
    }
  }, [callback, options, disconnect])

  return { observe, unobserve, disconnect }
}

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>(null)

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref.current as T | undefined
}

/**
 * 内存缓存管理器 - 基于Map的高性能键值存储
 * 支持TTL过期机制和命中率统计
 */
export class MemoryCache<T> {
  private store: Map<string, { value: T; expiresAt: number }>
  private defaultTTL: number
  private stats: { hits: number; misses: number }

  constructor(defaultTTL: number = 30 * 60 * 1000) {
    this.store = new Map()
    this.defaultTTL = defaultTTL
    this.stats = { hits: 0, misses: 0 }
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) {
      this.stats.misses++
      return undefined
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      this.stats.misses++
      return undefined
    }
    this.stats.hits++
    return entry.value
  }

  set(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.defaultTTL)
    this.store.set(key, { value, expiresAt })
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  clear(): void {
    this.store.clear()
    this.stats = { hits: 0, misses: 0 }
  }

  invalidate(key: string): void {
    this.store.delete(key)
  }

  getStats(): { hits: number; misses: number; hitRate: number } {
    const total = this.stats.hits + this.stats.misses
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
    }
  }

  size(): number {
    return this.store.size
  }
}

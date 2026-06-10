import { MemoryCache } from './MemoryCache'
import { PersistentCache } from './PersistentCache'

/**
 * 两级缓存协调器 - L1(Memory) + L2(localStorage)
 * 提供统一的缓存接口，自动协调两级缓存的读写
 */
export class CacheCoordinator<T> {
  private l1: MemoryCache<T>
  private l2: PersistentCache<T>

  constructor(l1TTL?: number, l2TTL?: number) {
    this.l1 = new MemoryCache<T>(l1TTL)
    this.l2 = new PersistentCache<T>('theme', l2TTL)
  }

  async get(key: string): Promise<T | undefined> {
    let value = this.l1.get(key)

    if (value === undefined) {
      const l2Value = this.l2.read(key)
      if (l2Value !== null && l2Value !== undefined) {
        value = l2Value
        this.l1.set(key, value)
      }
    }

    return value
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    this.l1.set(key, value, ttl)

    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => this.l2.write(key, value, ttl))
    } else {
      setTimeout(() => this.l2.write(key, value, ttl), 0)
    }
  }

  invalidate(key: string): void {
    this.l1.invalidate(key)
    this.l2.remove(key)
  }

  clear(): void {
    this.l1.clear()
    this.l2.clear()
  }

  getStats(): { l1: ReturnType<MemoryCache<T>['getStats']>; l2: ReturnType<PersistentCache<T>['getUsage']> } {
    return {
      l1: this.l1.getStats(),
      l2: this.l2.getUsage(),
    }
  }
}

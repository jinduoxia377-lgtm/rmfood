import { logger } from '@/utils/safeLogger';

/**
 * localStorage 持久化缓存 - 支持序列化和容量监控
 */
export class PersistentCache<T> {
  private prefix: string
  private defaultTTL: number

  constructor(prefix = 'theme_cache', defaultTTL = 86400000) {
    this.prefix = prefix
    this.defaultTTL = defaultTTL
  }

  private getKey(key: string): string {
    return `${this.prefix}_${key}`
  }

  write(key: string, data: T, ttl?: number): boolean {
    try {
      const expiresAt = Date.now() + (ttl ?? this.defaultTTL)
      const payload = { data, expiresAt, timestamp: Date.now() }
      const serialized = JSON.stringify(payload)

      if (serialized.length > 5 * 1024 * 1024) {
        logger.warn('[PersistentCache] Data size exceeds 5MB limit')
        return false
      }

      localStorage.setItem(this.getKey(key), serialized)
      return true
    } catch (error) {
      logger.error('[PersistentCache] Write failed:', error)
      return false
    }
  }

  read(key: string): T | null {
    try {
      const raw = localStorage.getItem(this.getKey(key))
      if (!raw) return null

      const payload = JSON.parse(raw)
      if (Date.now() > payload.expiresAt) {
        localStorage.removeItem(this.getKey(key))
        return null
      }

      return payload.data as T
    } catch (error) {
      logger.error('[PersistentCache] Read failed:', error)
      return null
    }
  }

  remove(key: string): boolean {
    try {
      localStorage.removeItem(this.getKey(key))
      return true
    } catch {
      return false
    }
  }

  clear(): boolean {
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(this.prefix)) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key))
      return true
    } catch {
      return false
    }
  }

  getUsage(): { used: number; total: number; percentage: number } {
    let used = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(this.prefix)) {
        used += (localStorage.getItem(key)?.length ?? 0) * 2
      }
    }
    const total = 5 * 1024 * 1024
    return { used, total, percentage: (used / total) * 100 }
  }
}

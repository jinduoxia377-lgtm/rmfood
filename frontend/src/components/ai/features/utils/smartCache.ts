/**
 * SmartCache - 智能缓存管理器 (v7.1)
 *
 * 提供 LRU/LFU 混合淘汰算法、TTL 过期、
 * 内存感知、预加载等高级缓存能力。
 *
 * @version 7.1.0
 */

import { logger } from '@/utils/safeLogger';

interface CacheItem<T> {
  value: T;
  timestamp: number;
  expiresAt?: number;
  accessCount: number;
  lastAccessTime: number;
  size: number; // bytes (估算)
}

type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'hybrid';

interface SmartCacheConfig<T = unknown> {
  maxSize: number; // 最大条目数
  maxMemoryMB: number; // 最大内存占用 (MB)
  defaultTTL: number; // 默认过期时间 (ms)
  evictionPolicy: EvictionPolicy;
  cleanupInterval: number; // 自动清理间隔 (ms)

  // 钩子函数
  onEvict?: (key: string, item: CacheItem<T>) => void;
  onExpire?: (key: string, item: CacheItem<T>) => void;
  onHit?: (key: string) => void;
  onMiss?: (key: string) => void;

  // 序列化（可选）
  serialize?: (value: T) => string;
  deserialize?: (data: string) => T;
}

interface RequiredSmartCacheConfig<T = unknown> {
  maxSize: number;
  maxMemoryMB: number;
  defaultTTL: number;
  evictionPolicy: EvictionPolicy;
  cleanupInterval: number;
  onEvict: ((key: string, item: CacheItem<T>) => void) | undefined;
  onExpire: ((key: string, item: CacheItem<T>) => void) | undefined;
  onHit: ((key: string) => void) | undefined;
  onMiss: ((key: string) => void) | undefined;
  serialize?: (value: T) => string;
  deserialize?: (data: string) => T;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  memoryUsageMB: number;
  hitRate: number;
  evictionCount: number;
  expirationCount: number;
}

class SmartCache<T = unknown> {
  private cache = new Map<string, CacheItem<T>>();
  private config: RequiredSmartCacheConfig<T>;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    memoryUsageMB: 0,
    hitRate: 0,
    evictionCount: 0,
    expirationCount: 0,
  };
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<SmartCacheConfig<T>> = {}) {
    this.config = {
      maxSize: 100,
      maxMemoryMB: 10,
      defaultTTL: 5 * 60 * 1000, // 5 分钟
      evictionPolicy: 'hybrid',
      cleanupInterval: 60000, // 1 分钟
      onEvict: undefined,
      onExpire: undefined,
      onHit: undefined,
      onMiss: undefined,
      ...config,
    };

    if (typeof window !== 'undefined') {
      this.startCleanup();
    }
  }

  get(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      this.stats.misses++;
      this.updateHitRate();
      this.config.onMiss?.(key);
      return null;
    }

    // 检查是否过期
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.delete(key);
      this.stats.expirationCount++;
      this.config.onExpire?.(key, item);
      return null;
    }

    // 更新访问统计
    item.accessCount++;
    item.lastAccessTime = Date.now();

    this.stats.hits++;
    this.updateHitRate();
    this.config.onHit?.(key);

    return item.value;
  }

  set(key: string, value: T, ttl?: number): void {
    // 如果已存在，先删除旧值
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // 检查内存限制
    this.enforceMemoryLimit();

    // 检查容量限制
    if (this.cache.size >= this.config.maxSize) {
      this.evict(1);
    }

    // 创建新的缓存项
    const size = this.estimateSize(value);

    const item: CacheItem<T> = {
      value,
      timestamp: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : Date.now() + this.config.defaultTTL,
      accessCount: 1,
      lastAccessTime: Date.now(),
      size,
    };

    this.cache.set(key, item);
    this.updateStats();
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    this.cache.delete(key);
    this.updateStats();

    return true;
  }

  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    this.stats.size = 0;
    this.stats.memoryUsageMB = 0;

    logger.info(`[SmartCache] 缓存已清空 (${count} 条目)`);
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  values(): T[] {
    return Array.from(this.cache.values()).map((item) => item.value);
  }

  getStats(): Readonly<CacheStats> {
    return { ...this.stats };
  }

  // ===== 高级操作 =====

  /**
   * 批量获取
   */
  getMany(keys: string[]): Map<string, T | null> {
    const result = new Map<string, T | null>();

    for (const key of keys) {
      result.set(key, this.get(key));
    }

    return result;
  }

  /**
   * 批量设置
   */
  setMany(entries: [string, T][]): void {
    for (const [key, value] of entries) {
      this.set(key, value);
    }
  }

  /**
   * 获取或设置（如果不存在）
   */
  getOrSet(key: string, factory: () => T, ttl?: number): T {
    let value = this.get(key);

    if (value === null) {
      value = factory();
      this.set(key, value, ttl);
    }

    return value;
  }

  /**
   * 带 TTL 的异步获取或设置
   */
  async getOrSetAsync(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    let value = this.get(key);

    if (value === null) {
      value = await factory();
      this.set(key, value, ttl);
    }

    return value;
  }

  /**
   * 预加载多个 key
   */
  async prefetch(keys: string[], loader: (key: string) => Promise<T>): Promise<void> {
    const promises = keys.map(async (key) => {
      if (!this.has(key)) {
        try {
          const value = await loader(key);
          this.set(key, value);
        } catch (error) {
          logger.warn(`[SmartCache] 预加载失败 [${key}]:`, error);
        }
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * 标签化缓存（支持按标签批量操作）
   */
  setWithTags(key: string, value: T, tags: string[], ttl?: number): void {
    // 使用特殊的内部结构存储标签信息
    const taggedValue = { _value: value, _tags: tags } as any;
    this.set(key, taggedValue, ttl);
  }

  getByTag(tag: string): T[] {
    const results: T[] = [];

    for (const [, item] of this.cache) {
      const taggedValue = item.value as any
      if (taggedValue._tags?.includes(tag)) {
        results.push(taggedValue._value);
      }
    }

    return results;
  }

  invalidateByTag(tag: string): number {
    const keysToDelete: string[] = [];

    for (const [key, item] of this.cache) {
      const taggedValue = item.value as any
      if (taggedValue._tags?.includes(tag)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.delete(key));
    return keysToDelete.length;
  }

  // ===== 内部方法 =====

  private evict(count: number): void {
    const policy = this.config.evictionPolicy;
    const entries = Array.from(this.cache.entries());

    // 根据策略排序
    entries.sort((a, b) => {
      switch (policy) {
        case 'lru':
          return a[1].lastAccessTime - b[1].lastAccessTime;
        case 'lfu':
          return a[1].accessCount - b[1].accessCount;
        case 'fifo':
          return a[1].timestamp - b[1].timestamp;
        case 'hybrid': // LRU + LFU 加权
          const aScore = a[1].lastAccessTime * 0.6 + a[1].accessCount * 1000 * 0.4;
          const bScore = b[1].lastAccessTime * 0.6 + b[1].accessCount * 1000 * 0.4;
          return aScore - bScore;
        default:
          return 0;
      }
    });

    // 淘汰指定数量的条目
    for (let i = 0; i < Math.min(count, entries.length); i++) {
      const [key, item] = entries[i];
      this.cache.delete(key);
      this.config.onEvict?.(key, item);
      this.stats.evictionCount++;
    }

    this.updateStats();
  }

  private enforceMemoryLimit(): void {
    while (this.stats.memoryUsageMB > this.config.maxMemoryMB && this.cache.size > 0) {
      this.evict(1);
    }
  }

  private updateStats(): void {
    this.stats.size = this.cache.size;

    let totalSize = 0;
    for (const [, item] of this.cache) {
      totalSize += item.size;
    }
    this.stats.memoryUsageMB = totalSize / (1024 * 1024);
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private estimateSize(value: T): number {
    try {
      return JSON.stringify(value).length * 2; // UTF-16 编码
    } catch {
      return 1024; // 默认 1KB
    }
  }

  private startCleanup(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupInterval);
  }

  private stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, item] of this.cache) {
      if (item.expiresAt && now > item.expiresAt) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => {
      const item = this.cache.get(key)!;
      this.cache.delete(key);
      this.config.onExpire?.(key, item);
      this.stats.expirationCount++;
    });

    if (expiredKeys.length > 0) {
      logger.debug(`[SmartCache] 清理 ${expiredKeys.length} 个过期项`);
      this.updateStats();
    }
  }

  destroy(): void {
    this.stopCleanup();
    this.clear();
    logger.info('[SmartCache] 实例已销毁');
  }
}

// ===== 导出 =====

export { SmartCache, type SmartCacheConfig, type CacheStats, type EvictionPolicy };

// ===== 预设实例导出 =====

export const chatMessageCache = new SmartCache({
  maxSize: 200,
  maxMemoryMB: 20,
  defaultTTL: 10 * 60 * 1000, // 10 分钟
  evictionPolicy: 'lru',
});

export const formulaCache = new SmartCache({
  maxSize: 50,
  maxMemoryMB: 5,
  defaultTTL: 30 * 60 * 1000, // 30 分钟
  evictionPolicy: 'lfu', // 配方数据访问频率更重要
});

export const apiResponseCache = new SmartCache({
  maxSize: 100,
  maxMemoryMB: 15,
  defaultTTL: 5 * 60 * 1000, // 5 分钟
  evictionPolicy: 'hybrid',
});

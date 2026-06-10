import { logger } from '@/utils/safeLogger'
/**
 * 三级缓存与预计算架构 V4.0
 *
 * 核心特性：
 * - L1: 内存LRU缓存 (最快, 容量最小)
 * - L2: 预计算结果缓存 (热门查询)
 * - L3: 持久化存储缓存 (跨会话)
 * - 智能预计算引擎 (基于用户行为模式)
 * - 目标响应时间 ≤80ms
 */

// ============ 缓存接口定义 ============

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // 毫秒
  accessCount: number
  lastAccessTime: number
  sizeBytes: number // 估算内存占用
}

export interface CacheStats {
  level: 'L1' | 'L2' | 'L3'
  hits: number
  misses: number
  hitRate: number
  avgAccessTimeMs: number
  memoryUsageMB: number
  evictionCount: number
}

export interface PrecomputeTask {
  id: string
  query: string
  priority: number // 1-10 (10最高)
  frequency: number // 出现频率
  lastRequested: number
  status: 'pending' | 'computing' | 'completed' | 'failed'
  result?: any
  error?: string
  computeTime?: number
}

export interface PrecomputeConfig {
  maxQueueSize: number
  computeIntervalMs: number
  minFrequencyThreshold: number
  maxConcurrentComputes: number
  enablePredictivePrecomputation: boolean
}

export interface ThreeLevelCacheStats {
  l1Hits: number
  l1Misses: number
  l2Hits: number
  l2Misses: number
  l3Hits: number
  l3Misses: number
  totalRequests: number
  hitRate: number
  avgResponseTimeMs: number
  memoryUsageMB: number
}

// ============ L1 内存缓存 (LRU) ============

export class L1MemoryCache<T> {
  private cache: Map<string, CacheEntry<T>>
  private maxSize: number
  private defaultTTL: number
  private stats: { hits: number; misses: number }

  constructor(maxSize = 500, defaultTTL = 5 * 60 * 1000) {
    this.cache = new Map()
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL
    this.stats = { hits: 0, misses: 0 }
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return null
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }

    entry.accessCount++
    entry.lastAccessTime = Date.now()
    this.stats.hits++

    // LRU: 移动到末尾(最近访问)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.data
  }

  set(key: string, data: T, ttl?: number): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      accessCount: 1,
      lastAccessTime: Date.now(),
      sizeBytes: this.estimateSize(data),
    }

    this.cache.set(key, entry)
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    return !!entry && !this.isExpired(entry)
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
    this.stats = { hits: 0, misses: 0 }
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses
    return {
      level: 'L1',
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      avgAccessTimeMs: 0.01, // L1 极快(<0.1ms)
      memoryUsageMB: this.calculateMemoryUsage(),
      evictionCount: 0,
    }
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  private evictLRU(): void {
    // Map保持插入顺序，第一个元素是最久未访问的
    const firstKey = this.cache.keys().next().value
    if (firstKey) {
      this.cache.delete(firstKey)
    }
  }

  private estimateSize(data: T): number {
    try {
      const serialized = JSON.stringify(data)
      return new Blob([serialized]).size
    } catch {
      return 1024 // 默认估算1KB
    }
  }

  private calculateMemoryUsage(): number {
    let totalSize = 0
    this.cache.forEach(entry => {
      totalSize += entry.sizeBytes
    })
    return totalSize / (1024 * 1024) // 转换为MB
  }
}

// ============ L2 预计算缓存 ============

export class L2PrecomputeCache<T> {
  private cache: Map<string, CacheEntry<T>>
  private precomputeQueue: PrecomputeTask[]
  private config: PrecomputeConfig
  private computeFunction: (query: string) => Promise<T>
  private intervalId: NodeJS.Timeout | null
  private stats: { hits: number; misses: number; computes: number }

  constructor(
    computeFunction: (query: string) => Promise<T>,
    config?: Partial<PrecomputeConfig>,
  ) {
    this.cache = new Map()
    this.precomputeQueue = []
    this.computeFunction = computeFunction
    this.config = {
      maxQueueSize: 100,
      computeIntervalMs: 60000, // 每分钟检查一次
      minFrequencyThreshold: 3,
      maxConcurrentComputes: 3,
      enablePredictivePrecomputation: true,
      ...config,
    }
    this.intervalId = null
    this.stats = { hits: 0, misses: 0, computes: 0 }

    this.startPrecomputeWorker()
  }

  async get(query: string): Promise<T | null> {
    const cacheKey = this.generateKey(query)
    const entry = this.cache.get(cacheKey)

    if (entry && !this.isExpired(entry)) {
      entry.accessCount++
      this.stats.hits++
      return entry.data
    }

    this.stats.misses++

    // 记录查询以供预计算
    this.recordQuery(query)

    return null
  }

  async set(query: string, data: T, ttl = 30 * 60 * 1000): Promise<void> {
    const cacheKey = this.generateKey(query)

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl,
      accessCount: 1,
      lastAccessTime: Date.now(),
      sizeBytes: this.estimateSize(data),
    })
  }

  private recordQuery(query: string): void {
    const existingTask = this.precomputeQueue.find(t => t.query === query)

    if (existingTask) {
      existingTask.frequency++
      existingTask.lastRequested = Date.now()

      // 动态提升优先级
      if (existingTask.frequency >= this.config.minFrequencyThreshold) {
        existingTask.priority = Math.min(10, existingTask.priority + 1)
      }
    } else if (this.precomputeQueue.length < this.config.maxQueueSize) {
      this.precomputeQueue.push({
        id: `pre-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        query,
        priority: 1,
        frequency: 1,
        lastRequested: Date.now(),
        status: 'pending',
      })
    }
  }

  private startPrecomputeWorker(): void {
    if (this.intervalId) return

    this.intervalId = setInterval(async () => {
      await this.processPrecomputeQueue()
    }, this.config.computeIntervalMs)
  }

  private async processPrecomputeQueue(): Promise<void> {
    if (!this.config.enablePredictivePrecomputation) return

    // 按优先级和频率排序
    this.precomputeQueue.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      return b.frequency - a.frequency
    })

    let concurrentComputes = 0

    for (const task of this.precomputeQueue) {
      if (task.status !== 'pending') continue
      if (task.frequency < this.config.minFrequencyThreshold) continue
      if (concurrentComputes >= this.config.maxConcurrentComputes) break

      task.status = 'computing'
      concurrentComputes++

      this.computeWithTimeout(task).catch(error => {
        logger.warn(`[L2Cache] 预计算失败: ${task.query}`, error.message)
        task.status = 'failed'
        task.error = error.message
      })
    }
  }

  private async computeWithTimeout(task: PrecomputeTask): Promise<void> {
    const startTime = performance.now()

    try {
      const result = await Promise.race([
        this.computeFunction(task.query),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('预计算超时')), 30000),
        ),
      ])

      task.status = 'completed'
      task.result = result
      task.computeTime = performance.now() - startTime

      await this.set(task.query, result)
      this.stats.computes++

      logger.log(`[L2Cache] ✅ 预计算完成 (${task.computeTime?.toFixed(0)}ms):`, task.query.substring(0, 50))

    } catch (error) {
      task.status = 'failed'
      task.error = error instanceof Error ? error.message : String(error)
    }
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses
    return {
      level: 'L2',
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      avgAccessTimeMs: 5, // L2 较快(1-10ms)
      memoryUsageMB: this.calculateMemoryUsage(),
      evictionCount: 0,
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private generateKey(query: string): string {
    return `l2-${query.substring(0, 100).toLowerCase().replace(/\s+/g, '_')}`
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  private estimateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size
    } catch {
      return 2048
    }
  }

  private calculateMemoryUsage(): number {
    let totalSize = 0
    this.cache.forEach(entry => {
      totalSize += entry.sizeBytes
    })
    return totalSize / (1024 * 1024)
  }
}

// ============ L3 持久化缓存 (LocalStorage) ============

export class L3PersistentCache<T> {
  private prefix: string
  private defaultTTL: number
  private maxSize: number
  private stats: { hits: number; misses: number }

  constructor(prefix = 'pie_v4', maxSize = 50, defaultTTL = 24 * 60 * 60 * 1000) {
    this.prefix = prefix
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL
    this.stats = { hits: 0, misses: 0 }
  }

  async get(key: string): Promise<T | null> {
    try {
      const fullKey = `${this.prefix}_${key}`
      const item = localStorage.getItem(fullKey)

      if (!item) {
        this.stats.misses++
        return null
      }

      const entry: CacheEntry<T> & { key: string } = JSON.parse(item)

      if (this.isExpired(entry)) {
        localStorage.removeItem(fullKey)
        this.stats.misses++
        return null
      }

      entry.accessCount++
      entry.lastAccessTime = Date.now()
      localStorage.setItem(fullKey, JSON.stringify(entry))

      this.stats.hits++
      return entry.data

    } catch (error) {
      logger.warn('[L3Cache] 读取失败:', error)
      this.stats.misses++
      return null
    }
  }

  async set(key: string, data: T, ttl?: number): Promise<void> {
    try {
      this.ensureCapacity()

      const fullKey = `${this.prefix}_${key}`
      const entry: CacheEntry<T> & { key: string } = {
        key,
        data,
        timestamp: Date.now(),
        ttl: ttl || this.defaultTTL,
        accessCount: 1,
        lastAccessTime: Date.now(),
        sizeBytes: this.estimateSize(data),
      }

      localStorage.setItem(fullKey, JSON.stringify(entry))

    } catch (error) {
      logger.warn('[L3Cache] 写入失败:', error)
    }
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses
    return {
      level: 'L3',
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      avgAccessTimeMs: 20, // L3 最慢(10-30ms, IO操作)
      memoryUsageMB: this.calculateLocalStorageUsage(),
      evictionCount: 0,
    }
  }

  clear(): void {
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(this.prefix)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
    this.stats = { hits: 0, misses: 0 }
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  private ensureCapacity(): void {
    const currentCount = this.getPrefixedItemCount()

    if (currentCount >= this.maxSize) {
      this.evictLRUItems(Math.ceil(this.maxSize * 0.2)) // 清理20%空间
    }
  }

  private getPrefixedItemCount(): number {
    let count = 0
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i)?.startsWith(this.prefix)) {
        count++
      }
    }
    return count
  }

  private evictLRUItems(count: number): void {
    const items: { key: string; lastAccessTime: number }[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(this.prefix)) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '{}')
          items.push({ key, lastAccessTime: item.lastAccessTime || 0 })
        } catch { /* 忽略解析错误 */ }
      }
    }

    items.sort((a, b) => a.lastAccessTime - b.lastAccessTime)
    items.slice(0, count).forEach(item => {
      localStorage.removeItem(item.key)
    })
  }

  private estimateSize(data: T): number {
    try {
      return new Blob([JSON.stringify(data)]).size
    } catch {
      return 4096
    }
  }

  private calculateLocalStorageUsage(): number {
    let totalSize = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(this.prefix)) {
        totalSize += (localStorage.getItem(key) || '').length * 2 // UTF-16编码
      }
    }
    return totalSize / (1024 * 1024)
  }
}

// ============ 三级缓存管理器 ============

export class ThreeLevelCacheManager<T> {
  private l1Cache: L1MemoryCache<T>
  private l2Cache: L2PrecomputeCache<T> | null
  private l3Cache: L3PersistentCache<T>
  private globalStats: ThreeLevelCacheStats

  constructor(
    computeFunction?: (query: string) => Promise<T>,
    options?: {
      l1MaxSize?: number
      l1DefaultTTL?: number
      enableL2Precompute?: boolean
      l3MaxSize?: number
      l3DefaultTTL?: number
    },
  ) {
    this.l1Cache = new L1MemoryCache<T>(
      options?.l1MaxSize || 500,
      options?.l1DefaultTTL || 5 * 60 * 1000,
    )

    this.l2Cache = options?.enableL2Precompute && computeFunction
      ? new L2PrecomputeCache<T>(computeFunction)
      : null

    this.l3Cache = new L3PersistentCache<T>(
      undefined,
      options?.l3MaxSize || 50,
      options?.l3DefaultTTL || 24 * 60 * 60 * 1000,
    )

    this.globalStats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      l3Hits: 0,
      l3Misses: 0,
      totalRequests: 0,
      hitRate: 0,
      avgResponseTimeMs: 0,
      memoryUsageMB: 0,
    }
  }

  async get(query: string): Promise<{ data: T | null; source: 'L1' | 'L2' | 'L3' | 'miss'; timeMs: number }> {
    const startTime = performance.now()
    this.globalStats.totalRequests++

    // Level 1: 内存缓存 (最快)
    const l1Result = this.l1Cache.get(query)
    if (l1Result) {
      this.globalStats.l1Hits++
      this.updateGlobalStats(performance.now() - startTime, 'L1')
      return { data: l1Result, source: 'L1', timeMs: performance.now() - startTime }
    }
    this.globalStats.l1Misses++

    // Level 2: 预计算缓存
    if (this.l2Cache) {
      const l2Result = await this.l2Cache.get(query)
      if (l2Result) {
        this.globalStats.l2Hits++
        // 回填L1缓存
        this.l1Cache.set(query, l2Result)
        this.updateGlobalStats(performance.now() - startTime, 'L2')
        return { data: l2Result, source: 'L2', timeMs: performance.now() - startTime }
      }
      this.globalStats.l2Misses++
    }

    // Level 3: 持久化缓存
    const l3Result = await this.l3Cache.get(query)
    if (l3Result) {
      this.globalStats.l3Hits++
      // 回填L1和L2缓存
      this.l1Cache.set(query, l3Result)
      if (this.l2Cache) await this.l2Cache.set(query, l3Result)
      this.updateGlobalStats(performance.now() - startTime, 'L3')
      return { data: l3Result, source: 'L3', timeMs: performance.now() - startTime }
    }
    this.globalStats.l3Misses++

    this.updateGlobalStats(performance.now() - startTime, 'miss')
    return { data: null, source: 'miss', timeMs: performance.now() - startTime }
  }

  async set(query: string, data: T, options?: { l1TTL?: number; l2TTL?: number; l3TTL?: number }): Promise<void> {
    this.l1Cache.set(query, data, options?.l1TTL)
    if (this.l2Cache) await this.l2Cache.set(query, data, options?.l2TTL)
    await this.l3Cache.set(query, data, options?.l3TTL)
  }

  getFullStats(): { l1: CacheStats; l2: CacheStats | null; l3: CacheStats; global: ThreeLevelCacheStats } {
    return {
      l1: this.l1Cache.getStats(),
      l2: this.l2Cache?.getStats() || null,
      l3: this.l3Cache.getStats(),
      global: this.globalStats,
    }
  }

  clearAll(): void {
    this.l1Cache.clear()
    this.l2Cache?.stop()
    this.l3Cache.clear()
    this.globalStats = {
      l1Hits: 0, l1Misses: 0, l2Hits: 0, l2Misses: 0,
      l3Hits: 0, l3Misses: 0, totalRequests: 0,
      hitRate: 0, avgResponseTimeMs: 0, memoryUsageMB: 0,
    }
  }

  private updateGlobalStats(timeMs: number, _source: 'L1' | 'L2' | 'L3' | 'miss'): void {
    const alpha = 0.3 // 指数移动平均系数
    this.globalStats.avgResponseTimeMs = this.globalStats.avgResponseTimeMs === 0
      ? timeMs
      : alpha * timeMs + (1 - alpha) * this.globalStats.avgResponseTimeMs

    const totalHits = this.globalStats.l1Hits + this.globalStats.l2Hits + this.globalStats.l3Hits
    const totalRequests = this.globalStats.totalRequests
    this.globalStats.hitRate = totalRequests > 0 ? totalHits / totalRequests : 0

    this.globalStats.memoryUsageMB =
      this.l1Cache.getStats().memoryUsageMB +
      (this.l2Cache?.getStats().memoryUsageMB || 0) +
      this.l3Cache.getStats().memoryUsageMB
  }
}

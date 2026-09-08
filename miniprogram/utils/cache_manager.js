/**
 * 页面缓存管理器
 * 管理页面数据和生命周期缓存
 */

class CacheManager {
  constructor() {
    this.pageCache = new Map()
    this.dataCache = new Map()
    this.maxCacheSize = 20 // 最大缓存页面数
    this.cacheTTL = 5 * 60 * 1000 // 缓存过期时间：5分钟
  }

  /**
   * 缓存页面数据
   * @param {string} pagePath - 页面路径
   * @param {Object} data - 页面数据
   */
  cachePage(pagePath, data) {
    try {
      const cacheKey = this.getCacheKey(pagePath)
      const cacheData = {
        data: data,
        timestamp: Date.now(),
        size: this.calculateSize(data)
      }
      
      this.pageCache.set(cacheKey, cacheData)
      this.evictExpiredCache()
      
      console.log(`[Cache] Page cached: ${pagePath}`)
      return true
    } catch (e) {
      console.error(`[Cache] Cache page failed: ${pagePath}`, e)
      return false
    }
  }

  /**
   * 获取缓存的页面数据
   * @param {string} pagePath - 页面路径
   * @returns {Object|null} 缓存数据或null
   */
  getCachedPage(pagePath) {
    try {
      const cacheKey = this.getCacheKey(pagePath)
      const cacheData = this.pageCache.get(cacheKey)
      
      if (!cacheData) {
        return null
      }
      
      // 检查是否过期
      if (this.isExpired(cacheData)) {
        this.pageCache.delete(cacheKey)
        return null
      }
      
      console.log(`[Cache] Page loaded from cache: ${pagePath}`)
      return cacheData.data
    } catch (e) {
      console.error(`[Cache] Get cached page failed: ${pagePath}`, e)
      return null
    }
  }

  /**
   * 缓存业务数据
   * @param {string} key - 缓存键
   * @param {Object} data - 数据
   * @param {number} ttl - 过期时间（毫秒），默认5分钟
   */
  cacheData(key, data, ttl = this.cacheTTL) {
    try {
      const cacheKey = this.getDataCacheKey(key)
      const cacheData = {
        data: data,
        timestamp: Date.now(),
        ttl: ttl,
        size: this.calculateSize(data)
      }
      
      this.dataCache.set(cacheKey, cacheData)
      this.evictExpiredDataCache()
      
      console.log(`[Cache] Data cached: ${key}`)
      return true
    } catch (e) {
      console.error(`[Cache] Cache data failed: ${key}`, e)
      return false
    }
  }

  /**
   * 获取缓存的业务数据
   * @param {string} key - 缓存键
   * @returns {Object|null} 缓存数据或null
   */
  getCachedData(key) {
    try {
      const cacheKey = this.getDataCacheKey(key)
      const cacheData = this.dataCache.get(cacheKey)
      
      if (!cacheData) {
        return null
      }
      
      // 检查是否过期
      if (this.isExpired(cacheData)) {
        this.dataCache.delete(cacheKey)
        return null
      }
      
      console.log(`[Cache] Data loaded from cache: ${key}`)
      return cacheData.data
    } catch (e) {
      console.error(`[Cache] Get cached data failed: ${key}`, e)
      return null
    }
  }

  /**
   * 清除页面缓存
   * @param {string} pagePath - 页面路径，不传则清除所有
   */
  clearPageCache(pagePath = null) {
    try {
      if (pagePath) {
        const cacheKey = this.getCacheKey(pagePath)
        this.pageCache.delete(cacheKey)
        console.log(`[Cache] Page cache cleared: ${pagePath}`)
      } else {
        this.pageCache.clear()
        console.log('[Cache] All page caches cleared')
      }
    } catch (e) {
      console.error('[Cache] Clear page cache failed:', e)
    }
  }

  /**
   * 清除数据缓存
   * @param {string} key - 缓存键，不传则清除所有
   */
  clearDataCache(key = null) {
    try {
      if (key) {
        const cacheKey = this.getDataCacheKey(key)
        this.dataCache.delete(cacheKey)
        console.log(`[Cache] Data cache cleared: ${key}`)
      } else {
        this.dataCache.clear()
        console.log('[Cache] All data caches cleared')
      }
    } catch (e) {
      console.error('[Cache] Clear data cache failed:', e)
    }
  }

  /**
   * 清除所有缓存
   */
  clearAll() {
    this.pageCache.clear()
    this.dataCache.clear()
    console.log('[Cache] All caches cleared')
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getStats() {
    return {
      pageCacheSize: this.pageCache.size,
      dataCacheSize: this.dataCache.size,
      pageCacheMemory: this.calculateTotalSize(this.pageCache),
      dataCacheMemory: this.calculateTotalSize(this.dataCache)
    }
  }

  /**
   * 生成缓存键
   * @param {string} path - 页面路径
   * @returns {string} 缓存键
   */
  getCacheKey(path) {
    return `page:${path}`
  }

  /**
   * 生成数据缓存键
   * @param {string} key - 原始键
   * @returns {string} 缓存键
   */
  getDataCacheKey(key) {
    return `data:${key}`
  }

  /**
   * 检查缓存是否过期
   * @param {Object} cacheData - 缓存数据
   * @returns {boolean} 是否过期
   */
  isExpired(cacheData) {
    const age = Date.now() - cacheData.timestamp
    const ttl = cacheData.ttl || this.cacheTTL
    return age > ttl
  }

  /**
   * 驱逐过期的缓存
   */
  evictExpiredCache() {
    const now = Date.now()
    for (const [key, value] of this.pageCache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.pageCache.delete(key)
      }
    }
    
    // 如果超过最大缓存数，按时间排序驱逐最旧的
    if (this.pageCache.size > this.maxCacheSize) {
      const sorted = Array.from(this.pageCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      const toDelete = sorted.slice(0, this.pageCache.size - this.maxCacheSize)
      toDelete.forEach(([key]) => this.pageCache.delete(key))
    }
  }

  /**
   * 驱逐过期的数据缓存
   */
  evictExpiredDataCache() {
    const now = Date.now()
    for (const [key, value] of this.dataCache.entries()) {
      if (now - value.timestamp > (value.ttl || this.cacheTTL)) {
        this.dataCache.delete(key)
      }
    }
  }

  /**
   * 计算对象大小（字节）
   * @param {Object} obj - 对象
   * @returns {number} 大小（字节）
   */
  calculateSize(obj) {
    try {
      const str = JSON.stringify(obj)
      return str.length * 2 // UTF-16，每个字符2字节
    } catch (e) {
      return 0
    }
  }

  /**
   * 计算缓存总大小
   * @param {Map} cache - 缓存Map
   * @returns {number} 总大小（字节）
   */
  calculateTotalSize(cache) {
    let total = 0
    for (const [, value] of cache.entries()) {
      total += value.size || 0
    }
    return total
  }
}

// 导出单例
const cacheManager = new CacheManager()

module.exports = {
  getCacheManager: () => cacheManager
}

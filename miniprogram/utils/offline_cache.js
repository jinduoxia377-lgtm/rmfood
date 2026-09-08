/**
 * 离线缓存管理器
 * 支持数据离线访问和自动同步
 */

class OfflineCacheManager {
  constructor() {
    this.cacheVersion = 'v1.0.0'
    this.lastSyncTime = null
    this.syncInterval = 5 * 60 * 1000 // 5分钟
    this.maxCacheSize = 50 * 1024 * 1024 // 50MB
  }

  /**
   * 初始化离线缓存
   */
  init() {
    try {
      const version = wx.getStorageSync('offline_cache_version')
      if (version !== this.cacheVersion) {
        // 版本变更，清除旧缓存
        this.clearAll()
        wx.setStorageSync('offline_cache_version', this.cacheVersion)
      }

      this.lastSyncTime = wx.getStorageSync('last_sync_time') || 0
      console.log('[OfflineCache] Initialized, version:', this.cacheVersion)
    } catch (error) {
      console.error('[OfflineCache] Init failed:', error)
    }
  }

  /**
   * 缓存数据
   * @param {string} key - 缓存键
   * @param {*} data - 缓存数据
   * @param {number} ttl - 过期时间（毫秒）
   */
  set(key, data, ttl = 24 * 60 * 60 * 1000) {
    try {
      const cacheKey = `offline_${key}`
      const cacheData = {
        data: data,
        timestamp: Date.now(),
        expireAt: Date.now() + ttl,
        size: this.calculateSize(data)
      }

      wx.setStorageSync(cacheKey, cacheData)

      // 检查总大小
      this.checkCacheSize()

      return true
    } catch (error) {
      console.error('[OfflineCache] Set failed:', error)
      return false
    }
  }

  /**
   * 获取缓存数据
   * @param {string} key - 缓存键
   * @returns {*} 缓存数据，过期则返回null
   */
  get(key) {
    try {
      const cacheKey = `offline_${key}`
      const cacheData = wx.getStorageSync(cacheKey)

      if (!cacheData) {
        return null
      }

      // 检查是否过期
      if (Date.now() > cacheData.expireAt) {
        wx.removeStorageSync(cacheKey)
        return null
      }

      return cacheData.data
    } catch (error) {
      console.error('[OfflineCache] Get failed:', error)
      return null
    }
  }

  /**
   * 检查缓存是否有效
   * @param {string} key - 缓存键
   * @returns {boolean}
   */
  isValid(key) {
    try {
      const cacheKey = `offline_${key}`
      const cacheData = wx.getStorageSync(cacheKey)

      if (!cacheData) {
        return false
      }

      return Date.now() <= cacheData.expireAt
    } catch (error) {
      return false
    }
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   */
  remove(key) {
    try {
      const cacheKey = `offline_${key}`
      wx.removeStorageSync(cacheKey)
    } catch (error) {
      console.error('[OfflineCache] Remove failed:', error)
    }
  }

  /**
   * 清除所有缓存
   */
  clearAll() {
    try {
      const keys = Object.keys(wx.getStorageInfoSync().keys)
      keys.forEach(key => {
        if (key.startsWith('offline_')) {
          wx.removeStorageSync(key)
        }
      })
      console.log('[OfflineCache] All cleared')
    } catch (error) {
      console.error('[OfflineCache] ClearAll failed:', error)
    }
  }

  /**
   * 检查缓存大小
   */
  checkCacheSize() {
    try {
      const info = wx.getStorageInfoSync()
      let totalSize = 0

      info.keys.forEach(key => {
        try {
          const data = wx.getStorageSync(key)
          totalSize += this.calculateSize(data)
        } catch (e) {}
      })

      // 如果超过限制，清除最旧的缓存
      if (totalSize > this.maxCacheSize) {
        this.evictOldest()
      }
    } catch (error) {
      console.error('[OfflineCache] CheckSize failed:', error)
    }
  }

  /**
   * 清除最旧的缓存
   */
  evictOldest() {
    try {
      const info = wx.getStorageInfoSync()
      let oldestKey = null
      let oldestTime = Infinity

      info.keys.forEach(key => {
        if (key.startsWith('offline_')) {
          try {
            const data = wx.getStorageSync(key)
            if (data.timestamp < oldestTime) {
              oldestTime = data.timestamp
              oldestKey = key
            }
          } catch (e) {}
        }
      })

      if (oldestKey) {
        wx.removeStorageSync(oldestKey)
        console.log('[OfflineCache] Evicted oldest:', oldestKey)
      }
    } catch (error) {
      console.error('[OfflineCache] EvictOldest failed:', error)
    }
  }

  /**
   * 计算数据大小
   */
  calculateSize(data) {
    try {
      const str = JSON.stringify(data)
      return new Blob([str]).size
    } catch (error) {
      return 0
    }
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    try {
      const info = wx.getStorageInfoSync()
      let count = 0
      let totalSize = 0

      info.keys.forEach(key => {
        if (key.startsWith('offline_')) {
          count++
          try {
            const data = wx.getStorageSync(key)
            totalSize += this.calculateSize(data)
          } catch (e) {}
        }
      })

      return {
        count,
        size: totalSize,
        sizeMB: (totalSize / 1024 / 1024).toFixed(2),
        limitMB: (this.maxCacheSize / 1024 / 1024)
      }
    } catch (error) {
      return { count: 0, size: 0, sizeMB: '0', limitMB: 50 }
    }
  }

  /**
   * 标记同步时间
   */
  markSync() {
    this.lastSyncTime = Date.now()
    wx.setStorageSync('last_sync_time', this.lastSyncTime)
  }

  /**
   * 获取上次同步时间
   */
  getLastSyncTime() {
    return this.lastSyncTime
  }

  /**
   * 检查是否需要重新同步
   */
  needsSync() {
    const now = Date.now()
    return (now - (this.lastSyncTime || 0)) > this.syncInterval
  }
}

// 导出单例
const offlineCache = new OfflineCacheManager()

module.exports = {
  getOfflineCacheManager: () => offlineCache
}

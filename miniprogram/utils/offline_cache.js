/**
 * RMFOOD 离线缓存系统
 * 提供离线访问能力
 * CommonJS 导出格式
 */

class OfflineCache {
  constructor() {
    this.cache = new Map()
    this.maxSize = 50
    this.ttl = 24 * 60 * 60 * 1000
  }

  init() {
    this.loadFromStorage()
  }

  loadFromStorage() {
    try {
      const cached = wx.getStorageSync('offline_cache')
      if (cached) {
        const data = JSON.parse(cached)
        Object.entries(data).forEach(([key, value]) => {
          if (this.isExpired(value.timestamp)) {
            this.cache.delete(key)
          } else {
            this.cache.set(key, value)
          }
        })
      }
    } catch (e) {
      console.error('[OfflineCache] Load failed:', e)
    }
  }

  saveToStorage() {
    try {
      const data = {}
      this.cache.forEach((value, key) => {
        data[key] = value
      })
      wx.setStorageSync('offline_cache', JSON.stringify(data))
    } catch (e) {
      console.error('[OfflineCache] Save failed:', e)
    }
  }

  set(key, data, ttl = this.ttl) {
    if (this.cache.size >= this.maxSize) {
      this.evict()
    }

    const value = {
      data,
      timestamp: Date.now(),
      ttl
    }

    this.cache.set(key, value)
    this.saveToStorage()
  }

  get(key) {
    const value = this.cache.get(key)
    if (!value) return null

    if (this.isExpired(value.timestamp, value.ttl)) {
      this.cache.delete(key)
      return null
    }

    return value.data
  }

  isExpired(timestamp, ttl = this.ttl) {
    return Date.now() - timestamp > ttl
  }

  evict() {
    let oldestKey = null
    let oldestTime = Infinity

    this.cache.forEach((value, key) => {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp
        oldestKey = key
      }
    })

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  delete(key) {
    this.cache.delete(key)
    this.saveToStorage()
  }

  clear() {
    this.cache.clear()
    wx.removeStorageSync('offline_cache')
  }

  getSize() {
    return this.cache.size
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      usage: `${Math.round(this.cache.size / this.maxSize * 100)}%`
    }
  }
}

// 单例实例
let _instance = null

// CommonJS 导出 - 与 app.js 的 require 导入兼容
module.exports = {
  getOfflineCacheManager: function() {
    if (!_instance) {
      _instance = new OfflineCache()
    }
    return _instance
  },
  OfflineCache: OfflineCache
}

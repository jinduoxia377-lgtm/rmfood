/**
 * 本地缓存管理工具
 * CommonJS 导出格式（微信小程序兼容）
 */

class CacheManager {
  constructor() {
    this.prefix = 'rmfood_'
  }

  /**
   * 设置缓存
   */
  set(key, value, duration = 3600000) {
    const data = {
      value,
      expiry: Date.now() + duration
    }
    try {
      wx.setStorageSync(this.prefix + key, JSON.stringify(data))
      return true
    } catch (e) {
      console.error('Cache set failed:', e)
      return false
    }
  }

  /**
   * 获取缓存
   */
  get(key) {
    try {
      const data = wx.getStorageSync(this.prefix + key)
      if (!data) return null
      
      const parsed = JSON.parse(data)
      if (Date.now() > parsed.expiry) {
        this.remove(key)
        return null
      }
      return parsed.value
    } catch (e) {
      return null
    }
  }

  /**
   * 删除缓存
   */
  remove(key) {
    try {
      wx.removeStorageSync(this.prefix + key)
    } catch (e) {
      console.error('Cache remove failed:', e)
    }
  }

  /**
   * 清除所有缓存
   */
  clear() {
    try {
      const keys = wx.getStorageInfoSync().keys
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          wx.removeStorageSync(key)
        }
      })
    } catch (e) {
      console.error('Cache clear failed:', e)
    }
  }

  /**
   * 检查缓存是否存在
   */
  has(key) {
    const value = this.get(key)
    return value !== null
  }
}

// CommonJS 导出 - 与 app.js 的 require 导入兼容
module.exports = {
  getCacheManager: function() {
    return new CacheManager()
  },
  CacheManager: CacheManager
}

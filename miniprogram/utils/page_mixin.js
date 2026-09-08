/**
 * 页面缓存混入
 * 为页面提供缓存能力
 */

const { getCacheManager } = require('./cache_manager')

/**
 * 创建带缓存能力的页面混入
 * @param {string} pagePath - 页面路径
 * @returns {Object} 混入对象
 */
function createCachedPageMixin(pagePath) {
  const cacheManager = getCacheManager()
  
  return {
    /**
     * 获取缓存数据
     * @returns {Object|null}
     */
    getCachedData() {
      return cacheManager.getCachedPage(pagePath)
    },

    /**
     * 保存数据到缓存
     * @param {Object} data
     */
    cacheData(data) {
      cacheManager.cachePage(pagePath, data)
    },

    /**
     * 清除页面缓存
     */
    clearCache() {
      cacheManager.clearPageCache(pagePath)
    },

    /**
     * 检查是否有缓存
     * @returns {boolean}
     */
    hasCache() {
      return !!cacheManager.getCachedPage(pagePath)
    },

    /**
     * 获取缓存统计
     * @returns {Object}
     */
    getCacheStats() {
      return cacheManager.getStats()
    }
  }
}

/**
 * 页面生命周期钩子混入
 * 自动管理页面缓存
 */
const pageLifecycleMixin = {
  /**
   * 页面卸载时保存缓存
   */
  onUnload() {
    // 子类可以重写此方法
  },

  /**
   * 页面显示时检查缓存
   */
  onShow() {
    // 子类可以重写此方法
  }
}

/**
 * 创建带生命周期管理的页面
 * @param {Object} options - 页面选项
 * @param {string} pagePath - 页面路径
 * @returns {Object} 页面对象
 */
function createCachedPage(options, pagePath) {
  const basePage = {
    ...options,
    
    /**
     * 页面卸载时保存缓存
     */
    onUnload() {
      // 保存当前数据到缓存
      if (this.data && Object.keys(this.data).length > 0) {
        this.cacheData(this.data)
      }
      
      // 调用父类方法
      if (options.onUnload) {
        options.onUnload.call(this)
      }
    },

    /**
     * 页面显示时检查缓存
     */
    onShow() {
      // 尝试从缓存加载数据
      const cachedData = this.getCachedData()
      if (cachedData) {
        this.setData({ ...cachedData, fromCache: true })
      }
      
      // 调用父类方法
      if (options.onShow) {
        options.onShow.call(this)
      }
    },

    /**
     * 从缓存获取数据
     */
    getCachedData() {
      return createCachedPageMixin(pagePath).getCachedData()
    },

    /**
     * 缓存数据
     */
    cacheData(data) {
      createCachedPageMixin(pagePath).cacheData(data)
    },

    /**
     * 清除缓存
     */
    clearCache() {
      createCachedPageMixin(pagePath).clearCache()
    }
  }
  
  return basePage
}

module.exports = {
  createCachedPageMixin,
  pageLifecycleMixin,
  createCachedPage
}

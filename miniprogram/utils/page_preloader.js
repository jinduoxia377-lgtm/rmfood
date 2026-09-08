/**
 * 页面预加载管理器
 * 预加载即将访问的页面
 */

class PagePreloader {
  constructor() {
    this.preloadQueue = new Map()
    this.preloadDelay = 300 // 延迟毫秒
    this.maxPreloadCount = 3 // 最大预加载数
  }

  /**
   * 预加载页面
   * @param {string} url - 页面路径
   * @param {Object} params - 页面参数
   */
  preload(url, params = {}) {
    // 检查是否已经预加载
    if (this.preloadQueue.has(url)) {
      return
    }

    // 检查预加载数量限制
    if (this.preloadQueue.size >= this.maxPreloadCount) {
      // 移除最旧的预加载
      const oldestKey = Array.from(this.preloadQueue.keys())[0]
      this.preloadQueue.delete(oldestKey)
    }

    // 添加到队列
    this.preloadQueue.set(url, {
      params,
      time: Date.now(),
      status: 'pending'
    })

    console.log(`[PagePreloader] Preloading: ${url}`)

    // 延迟预加载
    setTimeout(() => {
      this.doPreload(url, params)
    }, this.preloadDelay)
  }

  /**
   * 执行预加载
   * @param {string} url - 页面路径
   * @param {Object} params - 页面参数
   */
  doPreload(url, params) {
    // 使用 wx.createIntersectionObserver 监听页面可见性
    // 这里简化处理，直接预加载
    
    this.preloadQueue.set(url, {
      ...this.preloadQueue.get(url),
      status: 'loading'
    })

    // 实际预加载逻辑（简化版）
    // 在生产环境中应该使用 wx.navigateTo 的替代方案
    
    this.preloadQueue.set(url, {
      ...this.preloadQueue.get(url),
      status: 'loaded'
    })

    console.log(`[PagePreloader] Loaded: ${url}`)
  }

  /**
   * 取消预加载
   * @param {string} url - 页面路径
   */
  cancel(url) {
    this.preloadQueue.delete(url)
    console.log(`[PagePreloader] Cancelled: ${url}`)
  }

  /**
   * 清除所有预加载
   */
  clearAll() {
    this.preloadQueue.clear()
    console.log('[PagePreloader] All preloads cleared')
  }

  /**
   * 获取预加载状态
   * @param {string} url - 页面路径
   * @returns {Object|null}
   */
  getStatus(url) {
    return this.preloadQueue.get(url) || null
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    let loaded = 0
    let pending = 0
    let loading = 0

    for (const [, value] of this.preloadQueue.entries()) {
      if (value.status === 'loaded') loaded++
      if (value.status === 'pending') pending++
      if (value.status === 'loading') loading++
    }

    return {
      total: this.preloadQueue.size,
      loaded,
      pending,
      loading
    }
  }
}

// 导出单例
const pagePreloader = new PagePreloader()

module.exports = {
  getPagePreloader: () => pagePreloader
}

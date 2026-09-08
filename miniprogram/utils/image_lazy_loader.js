/**
 * 图片懒加载管理器
 * 优化图片加载性能
 */

class ImageLazyLoader {
  constructor() {
    this.imageCache = new Map()
    this.loadingQueue = []
    this.isProcessing = false
    this.threshold = 200 // 预加载阈值（像素）
  }

  /**
   * 注册图片观察器
   */
  init() {
    if (typeof IntersectionObserver === 'undefined') {
      console.warn('[ImageLazyLoader] IntersectionObserver not supported')
      return
    }

    this.observer = wx.createIntersectionObserver(this)
      .relativeToViewport({ top: 500, bottom: 500 })
      .observe('.lazy-image', (res) => {
        if (res.intersectionRatio > 0) {
          this.loadImage(res.dataset.src, res.dataset.index)
        }
      })

    console.log('[ImageLazyLoader] Observer initialized')
  }

  /**
   * 预加载图片
   * @param {string} src - 图片地址
   * @param {number} priority - 优先级（0-1）
   */
  preload(src, priority = 0.5) {
    if (this.imageCache.has(src)) {
      return
    }

    this.loadingQueue.push({
      src,
      priority,
      time: Date.now()
    })

    // 按优先级排序
    this.loadingQueue.sort((a, b) => b.priority - a.priority)

    // 开始处理队列
    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  /**
   * 加载单张图片
   * @param {string} src - 图片地址
   * @param {string} index - 索引
   */
  loadImage(src, index) {
    if (!src || this.imageCache.has(src)) {
      return
    }

    // 标记为加载中
    this.imageCache.set(src, {
      status: 'loading',
      index
    })

    wx.getImageInfo({
      src,
      success: (res) => {
        this.imageCache.set(src, {
          status: 'loaded',
          width: res.width,
          height: res.height,
          index
        })
        
        // 触发事件
        wx.trigger('imageLoaded', { src, index })
      },
      fail: (err) => {
        this.imageCache.set(src, {
          status: 'error',
          error: err,
          index
        })
        
        // 触发错误事件
        wx.trigger('imageError', { src, index, error: err })
      }
    })
  }

  /**
   * 处理加载队列
   */
  processQueue() {
    if (this.loadingQueue.length === 0) {
      this.isProcessing = false
      return
    }

    this.isProcessing = true
    const item = this.loadingQueue.shift()

    this.loadImage(item.src)

    // 延迟处理下一张
    setTimeout(() => {
      this.processQueue()
    }, 100)
  }

  /**
   * 批量预加载
   * @param {Array} images - 图片数组
   * @param {number} batchSize - 批次大小
   */
  batchPreload(images, batchSize = 5) {
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize)
      batch.forEach((img, idx) => {
        this.preload(img.src, img.priority || 0.5)
      })
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.imageCache.clear()
    this.loadingQueue = []
    this.isProcessing = false
  }

  /**
   * 获取缓存状态
   * @param {string} src - 图片地址
   * @returns {Object|null}
   */
  getCacheStatus(src) {
    return this.imageCache.get(src) || null
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    let loaded = 0
    let error = 0
    
    for (const [, value] of this.imageCache.entries()) {
      if (value.status === 'loaded') loaded++
      if (value.status === 'error') error++
    }

    return {
      total: this.imageCache.size,
      loaded,
      error,
      queueLength: this.loadingQueue.length
    }
  }
}

// 导出单例
const imageLazyLoader = new ImageLazyLoader()

module.exports = {
  getImageLazyLoader: () => imageLazyLoader
}

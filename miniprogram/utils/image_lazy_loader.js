/**
 * RMFOOD 图片懒加载优化 - 微信小程序版本
 * 使用小程序 API 替代 DOM API
 */

class ImageLazyLoader {
  constructor(options = {}) {
    this.options = {
      threshold: 100,
      placeholder: '/assets/images/placeholder.png',
      ...options
    }
    this.loadedImages = new Set()
    this.loadingImages = new Set()
    this._imageNodes = []
  }

  /**
   * 初始化懒加载
   */
  init(page) {
    this._page = page
    // 注意：小程序中没有 document.querySelectorAll
    // 需要在页面中手动注册图片节点
    console.log('[ImageLazyLoader] Initialized for page')
  }

  /**
   * 注册图片节点（在页面 onLoad 时调用）
   */
  registerImage(imageNode) {
    if (!imageNode) return
    
    this._imageNodes.push(imageNode)
    
    // 使用小程序的 IntersectionObserver
    if (wx.createIntersectionObserver) {
      const observer = wx.createIntersectionObserver(this._page, {
        thresholds: [0, 0.1, 0.5, 1]
      })
      
      observer
        .relativeToViewport({ bottom: this.options.threshold })
        .observe(`[data-src="${imageNode.dataset?.src}"]`, (res) => {
          if (res.intersectionRatio > 0) {
            this.loadImage(imageNode)
            observer.disconnect()
          }
        })
    }
  }

  /**
   * 加载图片
   */
  loadImage(imageNode) {
    const src = imageNode.dataset?.src || imageNode.src
    
    if (!src) return
    if (this.loadedImages.has(src) || this.loadingImages.has(src)) return

    this.loadingImages.add(src)

    // 使用 wx.getImageInfo 预加载
    wx.getImageInfo({
      src: src,
      success: (res) => {
        imageNode.src = src
        this.loadedImages.add(src)
        this.loadingImages.delete(src)
      },
      fail: (err) => {
        console.error('[ImageLazyLoader] Failed to load:', src, err)
        imageNode.src = this.options.placeholder
        this.loadingImages.delete(src)
      }
    })
  }

  /**
   * 预加载图片
   */
  preload(images) {
    images.forEach(src => {
      if (!this.loadedImages.has(src) && !this.loadingImages.has(src)) {
        wx.getImageInfo({
          src: src,
          success: () => {
            this.loadedImages.add(src)
          },
          fail: () => {
            console.error('[ImageLazyLoader] Preload failed:', src)
          }
        })
      }
    })
  }

  /**
   * 批量加载
   */
  batchLoad(imageList) {
    const batchSize = 5
    let index = 0

    const loadBatch = () => {
      if (index >= imageList.length) return
      
      const batch = imageList.slice(index, index + batchSize)
      batch.forEach(item => {
        if (item.src) {
          this.preload([item.src])
        }
      })
      
      index += batchSize
      setTimeout(loadBatch, 100)
    }

    loadBatch()
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.loadedImages.clear()
    this.loadingImages.clear()
    this._imageNodes = []
  }

  /**
   * 销毁
   */
  destroy() {
    this.clearCache()
  }
}

// 单例实例
let _instance = null

// CommonJS 导出 - 与 app.js 的 require 导入兼容
module.exports = {
  getImageLazyLoader: function(options) {
    if (!_instance) {
      _instance = new ImageLazyLoader(options)
    }
    return _instance
  },
  ImageLazyLoader: ImageLazyLoader
}

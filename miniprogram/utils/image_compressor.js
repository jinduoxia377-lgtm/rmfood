/**
 * 图片压缩工具
 * 优化图片加载性能
 */

class ImageCompressor {
  constructor() {
    this.maxWidth = 750  // 最大宽度（rpx）
    this.maxHeight = 1200 // 最大高度（rpx）
    this.quality = 0.8    // 压缩质量
    this.cache = new Map()
  }

  /**
   * 压缩图片
   * @param {string} tempFilePath - 临时文件路径
   * @param {Object} options - 压缩选项
   * @returns {Promise<string>} 压缩后的文件路径
   */
  async compress(tempFilePath, options = {}) {
    const {
      width = this.maxWidth,
      height = this.maxHeight,
      quality = this.quality
    } = options

    // 检查缓存
    const cacheKey = `${tempFilePath}_${width}_${height}_${quality}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      // 获取图片信息
      const info = await this.getImageInfo(tempFilePath)
      
      // 计算压缩尺寸
      const { compressWidth, compressHeight } = this.calculateSize(
        info.width,
        info.height,
        width,
        height
      )

      // 压缩图片
      const result = await new Promise((resolve, reject) => {
        wx.compressImage({
          src: tempFilePath,
          width: compressWidth,
          height: compressHeight,
          quality: Math.round(quality * 100),
          success: (res) => resolve(res.tempFilePath),
          fail: (err) => reject(err)
        })
      })

      // 缓存结果
      this.cache.set(cacheKey, result)
      
      // 限制缓存大小
      if (this.cache.size > 20) {
        const firstKey = this.cache.keys().next().value
        this.cache.delete(firstKey)
      }

      return result
    } catch (error) {
      console.error('[ImageCompressor] Compress failed:', error)
      return tempFilePath
    }
  }

  /**
   * 获取图片信息
   */
  getImageInfo(filePath) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: filePath,
        success: (res) => resolve(res),
        fail: (err) => reject(err)
      })
    })
  }

  /**
   * 计算压缩尺寸
   */
  calculateSize(originalWidth, originalHeight, maxWidth, maxHeight) {
    let width = originalWidth
    let height = originalHeight

    // 等比缩放
    if (width > maxWidth) {
      height = (height * maxWidth) / width
      width = maxWidth
    }
    if (height > maxHeight) {
      width = (width * maxHeight) / height
      height = maxHeight
    }

    return {
      compressWidth: Math.round(width),
      compressHeight: Math.round(height)
    }
  }

  /**
   * 上传前压缩
   * @param {string} tempFilePath - 临时文件路径
   * @returns {Promise<string>} 压缩后的文件路径
   */
  async compressBeforeUpload(tempFilePath) {
    return this.compress(tempFilePath, {
      width: 750,
      height: 1200,
      quality: 0.85
    })
  }

  /**
   * 生成缩略图
   * @param {string} tempFilePath - 原始文件路径
   * @param {number} size - 缩略图尺寸（rpx）
   * @returns {Promise<string>} 缩略图路径
   */
  async generateThumbnail(tempFilePath, size = 200) {
    return this.compress(tempFilePath, {
      width: size,
      height: size,
      quality: 0.7
    })
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear()
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      maxSize: 20
    }
  }
}

// 导出单例
const imageCompressor = new ImageCompressor()

module.exports = {
  getImageCompressor: () => imageCompressor
}

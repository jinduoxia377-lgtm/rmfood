/**
 * 鍥剧墖鍘嬬缉宸ュ叿
 * 浼樺寲鍥剧墖鍔犺浇鎬ц兘
 */

class ImageCompressor {
  constructor() {
    this.maxWidth = 750  // 鏈€澶у搴︼紙rpx锛?
    this.maxHeight = 1200 // 鏈€澶ч珮搴︼紙rpx锛?
    this.quality = 0.8    // 鍘嬬缉璐ㄩ噺
    this.cache = new Map()
  }

  /**
   * 鍘嬬缉鍥剧墖
   * @param {string} tempFilePath - 涓存椂鏂囦欢璺緞
   * @param {Object} options - 鍘嬬缉閫夐」
   * @returns {Promise<string>} 鍘嬬缉鍚庣殑鏂囦欢璺緞
   */
  async compress(tempFilePath, options = {}) {
    const {
      width = this.maxWidth,
      height = this.maxHeight,
      quality = this.quality
    } = options

    // 妫€鏌ョ紦瀛?
      const cacheKey = tempFilePath + "_" + width + "_" + height + "_" + quality
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      // 鑾峰彇鍥剧墖淇℃伅
      const info = await this.getImageInfo(tempFilePath)
      
      // 璁＄畻鍘嬬缉灏哄
      const { compressWidth, compressHeight } = this.calculateSize(
        info.width,
        info.height,
        width,
        height
      )

      // 鍘嬬缉鍥剧墖
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
      
      // 闄愬埗缂撳瓨澶у皬
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
   * 鑾峰彇鍥剧墖淇℃伅
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
   * 璁＄畻鍘嬬缉灏哄
   */
  calculateSize(originalWidth, originalHeight, maxWidth, maxHeight) {
    let width = originalWidth
    let height = originalHeight

    // 绛夋瘮缂╂斁
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
   * 涓婁紶鍓嶅帇缂?
   * @param {string} tempFilePath - 涓存椂鏂囦欢璺緞
   * @returns {Promise<string>} 鍘嬬缉鍚庣殑鏂囦欢璺緞
   */
  async compressBeforeUpload(tempFilePath) {
    return this.compress(tempFilePath, {
      width: 750,
      height: 1200,
      quality: 0.85
    })
  }

  /**
   * 鐢熸垚缂╃暐鍥?
   * @param {string} tempFilePath - 鍘熷鏂囦欢璺緞
   * @param {number} size - 缂╃暐鍥惧昂瀵革紙rpx锛?
   * @returns {Promise<string>} 缂╃暐鍥捐矾寰?
   */
  async generateThumbnail(tempFilePath, size = 200) {
    return this.compress(tempFilePath, {
      width: size,
      height: size,
      quality: 0.7
    })
  }

  /**
   * 娓呴櫎缂撳瓨
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

// 瀵煎嚭鍗曚緥
const imageCompressor = new ImageCompressor()

module.exports = {
  getImageCompressor: () => imageCompressor
}


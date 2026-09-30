/**
 * RMFOOD 小程序 - OCR服务模块
 * 支持腾讯OCR和百度OCR双平台
 */

const request = require('./request.js')
const { showLoading, hideLoading, showError } = require('./helpers.js')

class OCRService {
  constructor() {
    this.platform = 'tencent' // 'tencent' | 'baidu'
    this.maxRetry = 3
    this.timeout = 30000
  }

  /**
   * 识别配料表图片
   * @param {string} imagePath - 本地图片路径
   * @returns {Promise<object>} 识别结果
   */
  async recognizeIngredient(imagePath) {
    showLoading('正在识别配料表...')
    
    try {
      // 方式一：使用后端OCR服务（推荐）
      const result = await this._recognizeViaBackend(imagePath)
      
      if (result && result.ingredients) {
        hideLoading()
        return this._processResult(result)
      }
      
      // 方式二：降级到前端本地识别
      const localResult = await this._localRecognition(imagePath)
      hideLoading()
      return localResult
      
    } catch (error) {
      console.error('[OCR] 识别失败:', error)
      hideLoading()
      
      // 提供手动输入备选方案
      this._showManualInputFallback()
      throw error
    }
  }

  /**
   * 通过后端服务识别（调用后端OCR API）
   */
  async _recognizeViaBackend(imagePath) {
    try {
      // 上传并识别
      const uploadRes = await this._uploadImage(imagePath)
      if (!uploadRes || !uploadRes.url) {
        throw new Error('图片上传失败')
      }
      
      // 调用识别接口
      const result = await request.post('/ingredients/ocr', {
        image_url: uploadRes.url,
        platform: this.platform
      }, { timeout: this.timeout })
      
      return result
    } catch (error) {
      console.error('[OCR] 后端识别失败:', error)
      throw error
    }
  }

  /**
   * 上传图片到后端
   */
  async _uploadImage(imagePath) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: "" + request.baseUrl + "/ingredients/upload",
        filePath: imagePath,
        name: 'image',
        header: {
          'Authorization': "Bearer" + wx.getStorageSync('access_token') || '' + ""
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data)
            if (res.statusCode === 200 && data.url) {
              resolve(data)
            } else {
              reject(new Error(data.message || '上传失败'))
            }
          } catch (e) {
            reject(new Error('上传响应解析失败'))
          }
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  }

  /**
   * 前端本地识别（降级方案）
   */
  async _localRecognition(imagePath) {
    // 使用微信原生OCR能力（需要配置）
    return new Promise((resolve) => {
      wx.scanCode({
        onlyFromCamera: false,
        scanType: ['barCode', 'qrCode'],
        success: (res) => {
          // 扫码识别
          resolve({
            success: true,
            text: res.result,
            type: 'barcode'
          })
        },
        fail: () => {
          // 降级：返回空结果，让用户手动输入
          resolve({
            success: false,
            text: '',
            type: 'manual'
          })
        }
      })
    })
  }

  /**
   * 处理识别结果
   */
  _processResult(result) {
    const ingredients = []
    
    // 解析识别到的文本
    const text = result.text || ''
    const lines = text.split('\n')
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.length > 0) {
        ingredients.push({
          name: trimmed,
          amount: '',
          unit: '',
          source: 'ocr'
        })
      }
    }
    
    return {
      success: true,
      ingredients: ingredients.slice(0, 50), // 限制最多50个成分
      rawText: text,
      confidence: result.confidence || 0.85
    }
  }

  /**
   * 显示手动输入备选方案
   */
  _showManualInputFallback() {
    wx.showModal({
      title: '识别失败',
      content: 'OCR服务暂时不可用，您可以手动输入配料表内容，或稍后重试。',
      confirmText: '手动输入',
      cancelText: '重试',
      success: (res) => {
        if (res.confirm) {
          // 跳转到手动输入页面
          wx.navigateTo({
            url: '/packages/ingredient/pages/analysis/index?mode=manual'
          })
        }
      }
    })
  }

  /**
   * 识别营养成分表
   */
  async recognizeNutrition(imagePath) {
    showLoading('正在识别营养成分...')
    
    try {
      const result = await request.post('/ingredients/ocr/nutrition', {
        image_path: imagePath
      }, { timeout: this.timeout })
      
      hideLoading()
      return result
      
    } catch (error) {
      console.error('[OCR] 营养成分识别失败:', error)
      hideLoading()
      throw error
    }
  }

  /**
   * 批量识别多张图片
   */
  async batchRecognize(imagePaths) {
    const results = []
    
    for (const path of imagePaths) {
      try {
        const result = await this.recognizeIngredient(path)
        results.push({ path, result, success: true })
      } catch (error) {
        results.push({ path, result: null, success: false, error })
      }
    }
    
    return results
  }

  /**
   * 获取OCR配置
   */
  getOCRConfig() {
    return {
      platform: this.platform,
      maxRetry: this.maxRetry,
      timeout: this.timeout
    }
  }

  /**
   * 切换OCR平台
   */
  switchPlatform(platform) {
    if (['tencent', 'baidu'].includes(platform)) {
      this.platform = platform
      wx.setStorageSync('ocr_platform', platform)
    }
  }

  /**
   * 恢复上次选择的OCR平台
   */
  restorePlatform() {
    const saved = wx.getStorageSync('ocr_platform')
    if (saved && ['tencent', 'baidu'].includes(saved)) {
      this.platform = saved
    }
  }
}

module.exports = new OCRService()

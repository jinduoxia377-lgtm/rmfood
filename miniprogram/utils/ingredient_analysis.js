/**
 * RMFOOD 小程序 - 配料分析服务
 * 对接后端 /api/v1/ingredients/* 接口
 */

const request = require('./request.js')
const { showLoading, hideLoading, showError } = require('./helpers.js')

/**
 * 配料分析服务类
 * 所有分析算法由后端执行，前端仅负责UI渲染
 */
class IngredientAnalysisService {
  constructor() {
    this.currentSessionId = null
    this.analysisHistory = []
  }

  /**
   * OCR识别配料表图片
   * POST /api/v1/ingredients/ocr
   * @param {string} imagePath - 本地图片路径
   * @returns {Promise<{success, text, ingredients}>}
   */
  async ocrRecognize(imagePath) {
    showLoading('识别中...')
    try {
      // 上传并调用后端OCR
      const result = await request.post('/ingredients/ocr', {
        image_path: imagePath
      }, { timeout: 30000 })
      
      hideLoading()
      return result
    } catch (error) {
      hideLoading()
      console.error('[OCR] 识别失败:', error)
      throw error
    }
  }

  /**
   * 六维分析配料表
   * POST /api/v1/ingredients/analyze
   * @param {Object} params - 分析参数
   * @param {string} params.ingredientText - 配料表文本
   * @param {Array} params.ingredients - 结构化成分列表
   * @param {Object} params.nutrition - 营养成分数据
   * @param {string} params.servingSize - 食用份量
   * @returns {Promise<Object>} 六维分析结果
   */
  async analyze(params = {}) {
    const {
      ingredientText = '',
      ingredients = [],
      nutrition = {},
      servingSize = '100g'
    } = params

    showLoading('六维分析中...')
    try {
      const result = await request.post('/ingredients/analyze', {
        ingredient_text: ingredientText,
        ingredients: ingredients.map(ing => ({
          name: ing.name,
          additive: ing.additive || null
        })),
        nutrition: nutrition,
        serving_size: servingSize
      }, { timeout: 60000 })
      
      hideLoading()
      return result
    } catch (error) {
      hideLoading()
      console.error('[Analyze] 分析失败:', error)
      throw error
    }
  }

  /**
   * 批量分析多个配料表
   * POST /api/v1/ingredients/batch-analyze
   */
  async batchAnalyze(items) {
    showLoading('批量分析中...')
    try {
      const result = await request.post('/ingredients/batch-analyze', { 
        items 
      }, { timeout: 60000 })
      hideLoading()
      return result
    } catch (error) {
      hideLoading()
      console.error('[BatchAnalyze] 批量分析失败:', error)
      throw error
    }
  }

  /**
   * 获取E编码添加剂数据库
   * GET /api/v1/ingredients/additives
   */
  async getAdditives() {
    try {
      return await request.get('/ingredients/additives')
    } catch (error) {
      console.error('[Additives] 获取失败:', error)
      return null
    }
  }

  /**
   * 获取药食同源目录
   * GET /api/v1/ingredients/food-homology
   */
  async getFoodHomology() {
    try {
      return await request.get('/ingredients/food-homology')
    } catch (error) {
      console.error('[FoodHomology] 获取失败:', error)
      return null
    }
  }

  /**
   * 获取过敏原配置
   * GET /api/v1/ingredients/allergens
   */
  async getAllergens() {
    try {
      return await request.get('/ingredients/allergens')
    } catch (error) {
      console.error('[Allergens] 获取失败:', error)
      return null
    }
  }

  /**
   * 获取评分详情解读
   * GET /api/v1/ingredients/health-score/{score}
   */
  async getScoreDetail(score) {
    try {
      return await request.get(`/ingredients/health-score/${score}`)
    } catch (error) {
      console.error('[ScoreDetail] 获取失败:', error)
      return null
    }
  }

  /**
   * 解析OCR识别结果
   * 将识别到的文本解析为结构化成分
   * @param {string} ocrText - OCR识别文本
   * @returns {Array} 成分列表
   */
  parseOcrResult(ocrText) {
    if (!ocrText) return []

    // 移除"配料："前缀
    let text = ocrText.replace(/^配料[：:]/, '').trim()

    // 按逗号、顿号、空格分隔
    const parts = text.split(/[，,、\s]+/).filter(Boolean)

    // 匹配E编码
    const eCodeRegex = /\b([EE]?\d{3})\b/g
    const eCodes = text.match(eCodeRegex) || []

    return parts.map((name, index) => ({
      name: name.trim(),
      additive: eCodes[index] || null
    }))
  }

  /**
   * 提取营养成分数据（从OCR结果中提取）
   * @param {string} nutritionText - 营养成分表文本
   * @returns {Object} 营养成分数据
   */
  extractNutrition(nutritionText) {
    if (!nutritionText) return {}

    const data = {}
    const patterns = {
      energy: /能量[\s：:]*([\d.]+)\s*k?j/i,
      protein: /蛋白质[\s：:]*([\d.]+)\s*g/i,
      fat: /脂肪[\s：:]*([\d.]+)\s*g/i,
      carbohydrate: /碳水化合物[\s：:]*([\d.]+)\s*g/i,
      sodium: /钠[\s：:]*([\d.]+)\s*m?g/i,
      sugar: /糖[\s：:]*([\d.]+)\s*g/i,
      saturatedFat: /饱和脂肪[\s：:]*([\d.]+)\s*g/i,
      fiber: /膳食纤维[\s：:]*([\d.]+)\s*g/i,
      cholesterol: /胆固醇[\s：:]*([\d.]+)\s*m?g/i,
      vitaminA: /维生素A[\s：:]*([\d.]+)/i,
      vitaminC: /维生素C[\s：:]*([\d.]+)/i,
      calcium: /钙[\s：:]*([\d.]+)\s*m?g/i,
      iron: /铁[\s：:]*([\d.]+)\s*m?g/i
    }

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = nutritionText.match(pattern)
      if (match) {
        data[key] = parseFloat(match[1])
      }
    }

    return data
  }

  /**
   * 完整分析流程：OCR + 解析 + 分析
   * @param {string} imagePath - 图片路径
   */
  async analyzeFromImage(imagePath) {
    try {
      // Step 1: OCR识别
      const ocrResult = await this.ocrRecognize(imagePath)
      if (!ocrResult?.success) {
        throw new Error('OCR识别失败')
      }

      // Step 2: 解析成分
      const ingredients = this.parseOcrResult(ocrResult.text || '')

      // Step 3: 执行六维分析
      const analysisResult = await this.analyze({
        ingredientText: ocrResult.text || '',
        ingredients: ingredients,
        nutrition: {}
      })

      // 保存分析记录
      this.saveAnalysisRecord({
        ocrText: ocrResult.text,
        ingredients: ingredients,
        analysis: analysisResult.data,
        timestamp: new Date().toISOString()
      })

      return {
        success: true,
        ocrText: ocrResult.text,
        ingredients: ingredients,
        analysis: analysisResult.data
      }
    } catch (error) {
      console.error('[AnalyzeFromImage] 失败:', error)
      throw error
    }
  }

  /**
   * 手动输入分析流程
   * @param {string} ingredientText - 用户输入的配料表
   * @param {Object} nutritionData - 可选的营养成分数据
   */
  async analyzeFromText(ingredientText, nutritionData = {}) {
    try {
      const ingredients = this.parseOcrResult(ingredientText)
      const result = await this.analyze({
        ingredientText: ingredientText,
        ingredients: ingredients,
        nutrition: nutritionData
      })
      
      // 保存分析记录
      this.saveAnalysisRecord({
        ingredientText: ingredientText,
        ingredients: ingredients,
        analysis: result.data,
        timestamp: new Date().toISOString()
      })

      return result
    } catch (error) {
      console.error('[AnalyzeFromText] 失败:', error)
      throw error
    }
  }

  /**
   * 保存分析记录
   */
  saveAnalysisRecord(record) {
    try {
      const history = wx.getStorageSync('analysis_history') || []
      history.unshift(record)
      
      // 限制历史记录数量
      if (history.length > 50) {
        history.splice(50)
      }
      
      wx.setStorageSync('analysis_history', history)
      this.analysisHistory = history
    } catch (error) {
      console.error('[SaveRecord] 保存失败:', error)
    }
  }

  /**
   * 获取分析历史
   */
  getHistory() {
    try {
      const history = wx.getStorageSync('analysis_history') || []
      this.analysisHistory = history
      return history
    } catch (error) {
      return []
    }
  }

  /**
   * 清除分析历史
   */
  clearHistory() {
    try {
      wx.removeStorageSync('analysis_history')
      this.analysisHistory = []
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 删除单条记录
   */
  deleteRecord(index) {
    try {
      const history = wx.getStorageSync('analysis_history') || []
      history.splice(index, 1)
      wx.setStorageSync('analysis_history', history)
      this.analysisHistory = history
      return true
    } catch (error) {
      return false
    }
  }
}

// 导出单例
module.exports = new IngredientAnalysisService()

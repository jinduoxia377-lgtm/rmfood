// 配料分析页面 - 对接后端API版
const api = require('../../../utils/api.js')
const ingredientService = require('../../../utils/ingredient_analysis.js')
const { getCacheManager } = require('../../../utils/cache_manager')
const { getMicroAnimationManager } = require('../../../utils/micro_animation')

Page({
  data: {
    statusBarHeight: 0,
    safeAreaBottom: 0,
    loading: false,
    analyzing: false,
    refreshing: false,
    ingredientText: '',
    nutritionText: '', // 营养成分表文本
    result: null,
    history: [],
    historyLoading: false,
    ocrResult: null, // OCR识别结果（中间状态）
    showInputSection: true,
    showResultSection: false,
    containerHeight: 0
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      safeAreaBottom: systemInfo.safeAreaInsets?.bottom || 0,
      containerHeight: systemInfo.windowHeight * (750 / systemInfo.windowWidth) - 120
    })
    this.loadHistory()
    this.initAnimations()
  },

  onShow() {
    this.loadHistory()
  },

  onHide() {
    this.saveToCache()
  },

  /**
   * 初始化动效
   */
  initAnimations() {
    const manager = getMicroAnimationManager()
    manager.playEnterAnimation(this, '.input-section', 'slide-up', 200)
  },

  /**
   * 保存缓存
   */
  saveToCache() {
    const cacheManager = getCacheManager()
    cacheManager.cachePage('/packages/ingredient/pages/analysis/index', {
      ingredientText: this.data.ingredientText,
      nutritionText: this.data.nutritionText
    })
  },

  /**
   * 加载缓存
   */
  loadFromCache() {
    const cacheManager = getCacheManager()
    const cachedData = cacheManager.getCachedPage('/packages/ingredient/pages/analysis/index')
    if (cachedData) {
      this.setData({
        ingredientText: cachedData.ingredientText || '',
        nutritionText: cachedData.nutritionText || ''
      })
    }
  },

  // ========== 输入处理 ==========
  onInputChange(e) {
    this.setData({ ingredientText: e.detail.value })
  },

  onNutritionInputChange(e) {
    this.setData({ nutritionText: e.detail.value })
  },

  // ========== 图片上传 ==========
  async chooseImage() {
    try {
      const { getImageCompressor } = require('../../../../utils/image_compressor')
      const compressor = getImageCompressor()

      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const tempFilePath = res.tempFiles[0].tempFilePath
          // 压缩图片后再分析
          try {
            const compressedPath = await compressor.compressBeforeUpload(tempFilePath)
            this.analyzeImage(compressedPath)
          } catch (compressError) {
            console.error('[Image] Compress failed, using original:', compressError)
            this.analyzeImage(tempFilePath)
          }
        },
        fail: (err) => {
          if (!err.errMsg || !err.errMsg.includes('cancel')) {
            wx.showToast({ title: '请选择图片', icon: 'none' })
          }
        }
      })
    } catch (error) {
      console.error('[Image] Choose image failed:', error)
      wx.showToast({ title: '请选择图片', icon: 'none' })
    }
  },

  async analyzeImage(imagePath) {
    this.setData({ loading: true, showInputSection: false })

    try {
      // 调用后端OCR API
      const result = await ingredientService.analyzeFromImage(imagePath)

      // 展示OCR结果，让用户确认后再分析
      this.setData({
        ocrResult: result,
        ingredientText: result.ocrText || '',
        showInputSection: true,
        loading: false
      })

      wx.showModal({
        title: '识别结果确认',
        content: `已识别 ${result.ingredients?.length || 0} 个成分，是否开始分析？`,
        confirmText: '开始分析',
        cancelText: '重新识别',
        success: (res) => {
          if (res.confirm) {
            this.performAnalysis(result)
          } else {
            this.setData({ showInputSection: true, ocrResult: null })
          }
        }
      })
    } catch (error) {
      console.error('[Image] 分析失败:', error)
      wx.hideLoading()
      wx.showToast({ title: '识别失败，请重试', icon: 'none' })
      this.setData({ loading: false, showInputSection: true })
    }
  },

  // ========== 手动输入分析 ==========
  startAnalysis() {
    const text = this.data.ingredientText.trim()
    if (!text) {
      wx.showToast({ title: '请输入配料表', icon: 'none' })
      return
    }

    this.setData({ analyzing: true })

    // 解析营养成分表
    let nutritionData = {}
    if (this.data.nutritionText) {
      nutritionData = ingredientService.extractNutrition(this.data.nutritionText)
    }

    // 调用后端API
    ingredientService.analyzeFromText(text, nutritionData)
      .then(result => {
        this.setData({
          result: result.data,
          loading: false,
          analyzing: false,
          showInputSection: false,
          showResultSection: true
        })
        this.saveToHistory(result.data)
      })
      .catch(error => {
        console.error('[Text] 分析失败:', error)
        wx.hideLoading()
        wx.showToast({ title: '分析失败，请重试', icon: 'none' })
        this.setData({ analyzing: false })
      })
  },

  // ========== 核心分析 ==========
  performAnalysis(data) {
    const { ocrResult, nutritionText } = this.data

    // 解析营养成分
    let nutritionData = {}
    if (nutritionText) {
      nutritionData = ingredientService.extractNutrition(nutritionText)
    }

    // 调用后端分析API
    ingredientService.analyze({
      ingredientText: ocrResult?.ocrText || this.data.ingredientText,
      ingredients: ocrResult?.ingredients || this.parseIngredients(this.data.ingredientText),
      nutrition: nutritionData
    })
      .then(result => {
        this.setData({
          result: result.data,
          loading: false,
          analyzing: false,
          showInputSection: false,
          showResultSection: true
        })
        this.saveToHistory(result.data)
      })
      .catch(error => {
        console.error('[Perform] 分析失败:', error)
        wx.hideLoading()
        wx.showToast({ title: '分析失败', icon: 'none' })
        this.setData({ loading: false, analyzing: false })
      })
  },

  parseIngredients(text) {
    if (!text) return []
    const parts = text.split(/[，,、\s]+/).filter(Boolean)
    return parts.map(name => ({ name, additive: null }))
  },

  // ========== 历史记录 ==========
  saveToHistory(result) {
    try {
      const history = wx.getStorageSync('analysis_history') || []
      history.unshift({
        timestamp: result.timestamp,
        score: result.overallScore,
        grade: result.overallGrade?.grade || '?',
        ingredients: result.ingredients?.slice(0, 5) || [],
        ingredientText: result.ingredientText?.slice(0, 30) || ''
      })
      if (history.length > 20) history.pop()
      wx.setStorageSync('analysis_history', history)
      this.setData({ history })
    } catch (e) {
      console.error('[History] 保存失败:', e)
    }
  },

  loadHistory() {
    try {
      this.setData({ historyLoading: true })
      const history = wx.getStorageSync('analysis_history') || []
      this.setData({ history, historyLoading: false })
    } catch (e) {
      this.setData({ historyLoading: false })
    }
  },

  clearHistory() {
    wx.showModal({
      title: '清除历史',
      content: '确定要清除所有分析历史吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('analysis_history')
          this.setData({ history: [] })
          wx.showToast({ title: '已清除', icon: 'success' })
        }
      }
    })
  },

  /**
   * 滚动到历史记录
   */
  scrollToHistory(e) {
    const index = e.detail.index
    wx.pageScrollTo({
      scrollTop: index * 160,
      duration: 300
    })
  },

  // ========== 工具方法 ==========
  getNovaColor(group) {
    const colors = ['#22C55E', '#84CC16', '#F59E0B', '#EF4444']
    return colors[(group || 1) - 1] || '#999999'
  },

  getAdditiveRiskWidth() {
    const count = this.data.result?.additives?.length || 0
    return Math.min(count * 15, 100)
  },

  getAdditiveRiskColor() {
    const count = this.data.result?.additives?.length || 0
    if (count === 0) return '#22C55E'
    if (count <= 2) return '#F59E0B'
    return '#EF4444'
  },

  getItemNrvClass(nrvPercent) {
    if (nrvPercent === null || nrvPercent === undefined) return ''
    if (nrvPercent >= 30) return 'high'
    if (nrvPercent >= 15) return 'medium'
    return ''
  },

  // ========== 操作按钮 ==========
  goBack() {
    // 返回输入界面
    if (this.data.showResultSection) {
      this.setData({
        showResultSection: false,
        showInputSection: true,
        result: null
      })
    } else {
      wx.navigateBack()
    }
  },

  retryAnalysis() {
    this.setData({
      showResultSection: false,
      showInputSection: true,
      result: null,
      ingredientText: ''
    })
  },

  saveAnalysis() {
    if (!this.data.result) return
    wx.showLoading({ title: '保存中...' })
    try {
      const records = wx.getStorageSync('analysis_records') || []
      records.unshift({
        ...this.data.result,
        savedAt: new Date().toISOString()
      })
      if (records.length > 50) records.pop()
      wx.setStorageSync('analysis_records', records)
      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  shareResult() {
    if (!this.data.result) return
    wx.showShareMenu({
      withShareTicket: false,
      menus: ['shareAppMessage', 'shareTimeline']
    })
    wx.showToast({ title: '点击右上角分享', icon: 'none' })
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true })
    setTimeout(() => {
      this.setData({ refreshing: false })
      wx.stopPullDownRefresh()
    }, 1000)
  },

  // ========== 分享配置 ==========
  onShareAppMessage() {
    const r = this.data.result
    return {
      title: `食品配料分析报告 - ${r?.overallGrade?.grade || '?'}级`,
      path: '/pages/index/index',
      imageUrl: ''
    }
  },

  onShareTimeline() {
    const r = this.data.result
    return {
      title: `食品配料分析报告 - ${r?.overallGrade?.grade || '?'}级`,
      query: ''
    }
  }
})

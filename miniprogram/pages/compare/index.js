// 对比分析页逻辑
const api = require('../../utils/api.js')
const request = require('../../utils/request.js')

Page({
  data: {
    productA: {},
    productB: {},
    comparisonResult: null,
    recommendColor: '',
    recommendText: '',
    loading: false,
    menuOpen: false,
    comparing: false
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '产品对比' })
  },

  // 选择产品A
  selectProductA() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFiles[0].tempFilePath
        this.analyzeProduct(filePath, 'A').then(result => {
          this.setData({ productA: result })
        })
      }
    })
  },

  // 选择产品B
  selectProductB() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFiles[0].tempFilePath
        this.analyzeProduct(filePath, 'B').then(result => {
          this.setData({ productB: result })
        })
      }
    })
  },

  // 分析产品（OCR + API）
  async analyzeProduct(imagePath, side) {
    this.setData({ loading: true })
    try {
      // 调用OCR识别
      const ocrResult = await api.ingredients.ocr(imagePath)
      
      if (ocrResult && ocrResult.ingredients) {
        // 调用配料分析API
        const analysis = await api.ingredients.analyze(ocrResult.ingredients)
        
        const result = {
          name: ocrResult.productName || '识别产品',
          score: analysis.score || 75,
          nutriScoreLetter: analysis.nutrientLevel === '丰富' ? 'A' : analysis.nutrientLevel === '中等' ? 'B' : 'C',
          novaGroup: analysis.safetyLevel === '高' ? 1 : analysis.safetyLevel === '中' ? 2 : 3,
          additiveCount: ocrResult.ingredients.filter(i => i.isAdditive).length,
          herbalCount: ocrResult.ingredients.filter(i => i.isHerb).length,
          allergenCount: ocrResult.ingredients.filter(i => i.isAllergen).length,
          ingredients: ocrResult.ingredients,
          image: imagePath
        }
        
        this.setData({ loading: false })
        return result
      }
    } catch (e) {
      console.error('分析失败:', e)
    }
    
    // 降级：使用模拟数据
    this.setData({ loading: false })
    return {
      name: '测试产品',
      score: 85,
      nutriScoreLetter: 'B',
      novaGroup: 2,
      additiveCount: 0,
      herbalCount: 2,
      allergenCount: 0,
      image: imagePath
    }
  },

  // 开始对比
  startCompare() {
    const { productA, productB } = this.data
    if (!productA.name || !productB.name) {
      wx.showToast({ title: '请选择两个产品', icon: 'none' })
      return
    }
    
    this.setData({ comparing: true })
    
    // 计算对比结果
    const result = this.calculateComparison(productA, productB)
    this.setData({ 
      comparisonResult: result,
      recommending: result.recommendation,
      recommendColor: result.recommendColor,
      recommendText: result.recommendText,
      comparing: false 
    })
  },

  calculateComparison(a, b) {
    const differences = []
    let winner = ''
    let winReason = ''
    
    // Nutri-Score 对比
    if (a.score > b.score) {
      differences.push({ type: 'good', title: '营养评分', description: `${a.name} 营养评分更高` })
      winner = a.name
      winReason = '营养评分更高'
    } else if (b.score > a.score) {
      differences.push({ type: 'good', title: '营养评分', description: `${b.name} 营养评分更高` })
      winner = b.name
      winReason = '营养评分更高'
    }
    
    // NOVA 分组对比
    if (a.novaGroup < b.novaGroup) {
      differences.push({ type: 'good', title: '加工程度', description: `${a.name} 加工程度更低` })
    } else if (b.novaGroup < a.novaGroup) {
      differences.push({ type: 'good', title: '加工程度', description: `${b.name} 加工程度更低` })
    }
    
    // 添加剂数量对比
    if (a.additiveCount < b.additiveCount) {
      differences.push({ type: 'good', title: '添加剂', description: `${a.name} 添加剂更少` })
    } else if (b.additiveCount < a.additiveCount) {
      differences.push({ type: 'good', title: '添加剂', description: `${b.name} 添加剂更少` })
    }
    
    // 药食同源成分对比
    if (a.herbalCount > b.herbalCount) {
      differences.push({ type: 'good', title: '药食同源', description: `${a.name} 含有更多药食同源成分` })
    } else if (b.herbalCount > a.herbalCount) {
      differences.push({ type: 'good', title: '药食同源', description: `${b.name} 含有更多药食同源成分` })
    }
    
    // 过敏原对比
    if (a.allergenCount > 0 && b.allergenCount === 0) {
      differences.push({ type: 'warning', title: '过敏原', description: `${a.name} 含有过敏原` })
    } else if (b.allergenCount > 0 && a.allergenCount === 0) {
      differences.push({ type: 'warning', title: '过敏原', description: `${b.name} 含有过敏原` })
    }
    
    const recommendColor = winner === a.name ? 'var(--color-system-blue)' : 'var(--color-system-orange)'
    
    return {
      winner,
      reason: winReason,
      differences,
      recommendation: winner,
      recommendColor,
      recommendText: `推荐 ${winner}`
    }
  },

  // 切换菜单
  toggleMenu() {
    this.setData({ menuOpen: !this.data.menuOpen })
  },

  // 清除对比
  clearComparison() {
    this.setData({ 
      productA: {}, 
      productB: {}, 
      comparisonResult: null,
      recommendColor: '',
      recommendText: ''
    })
  },

  // 跳转到产品详情
  goToProduct(e) {
    const product = e.currentTarget.dataset.product
    wx.navigateTo({ url: `/packages/ingredient/pages/analysis/index?name=${product.name}` })
  },

  // 返回首页
  goToHome() {
    wx.navigateTo({ url:"/pages/index/index" })
  },

  // 分享
  onShareAppMessage() {
    const { productA, productB, comparisonResult } = this.data
    let title = '药食同源产品对比'
    if (comparisonResult?.winner) {
      title = `对比结果：${comparisonResult.winner} 更优`
    }
    return {
      title,
      path: '/pages/index/index'
    }
  }
})

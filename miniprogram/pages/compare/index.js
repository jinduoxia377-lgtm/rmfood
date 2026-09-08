// 对比分析页逻辑
const app = getApp()
const request = require('../../utils/request.js')

Page({
  data: {
    productA: {},
    productB: {},
    comparisonResult: null,
    recommendColor: '',
    recommendText: ''
  },

  // 选择产品A
  selectProductA() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFiles[0].tempFilePath
        this.analyzeProduct(filePath).then(result => {
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
        this.analyzeProduct(filePath).then(result => {
          this.setData({ productB: result })
        })
      }
    })
  },

  // 分析产品
  async analyzeProduct(imagePath) {
    // TODO: 实现OCR和分析逻辑
    return {
      name: '测试产品',
      score: 85,
      nutriScoreLetter: 'B',
      novaGroup: 2,
      additiveCount: 0,
      herbalCount: 2,
      allergenCount: 0
    }
  },

  // 开始对比
  startCompare() {
    const { productA, productB } = this.data
    const result = this.generateComparison(productA, productB)
    this.setData({ comparisonResult: result })
  },

  // 生成对比结果
  generateComparison(a, b) {
    const differences = []
    
    // Nutri-Score差异
    if (a.score !== b.score) {
      const better = a.score > b.score ? 'A' : 'B'
      differences.push({
        type: better,
        title: `Nutri-Score差异`,
        description: `${better === 'A' ? a.name : b.name}的营养评分更高，更健康`
      })
    }
    
    // NOVA分组差异
    if (a.novaGroup !== b.novaGroup) {
      const better = a.novaGroup < b.novaGroup ? 'A' : 'B'
      differences.push({
        type: better,
        title: `加工程度差异`,
        description: `${better === 'A' ? a.name : b.name}的加工程度更低，更接近天然`
      })
    }
    
    // 添加剂差异
    if (a.additiveCount !== b.additiveCount) {
      const better = a.additiveCount < b.additiveCount ? 'A' : 'B'
      differences.push({
        type: better,
        title: `添加剂差异`,
        description: `${better === 'A' ? a.name : b.name}的添加剂更少`
      })
    }
    
    // 药食同源差异
    if (a.herbalCount !== b.herbalCount) {
      const better = a.herbalCount > b.herbalCount ? 'A' : 'B'
      differences.push({
        type: better,
        title: `药食同源成分差异`,
        description: `${better === 'A' ? a.name : b.name}含有更多药食同源成分`
      })
    }
    
    // 推荐产品
    const recommendScore = Math.max(a.score, b.score)
    const recommendProduct = a.score >= b.score ? a : b
    const recommendColor = recommendScore >= 70 ? '#4CAF50' : '#FF9800'
    const recommendText = recommendScore >= 70 ? '推荐此产品' : '谨慎选择'
    
    return {
      differences,
      recommendation: {
        ...recommendProduct,
        reason: this.getRecommendReason(recommendProduct, a, b)
      }
    }
  },

  // 获取推荐理由
  getRecommendReason(recommend, a, b) {
    const reasons = []
    if (recommend.score > (recommend === a ? b : a).score) {
      reasons.push('营养评分更高')
    }
    if (recommend.novaGroup < (recommend === a ? b : a).novaGroup) {
      reasons.push('加工程度更低')
    }
    if (recommend.additiveCount < (recommend === a ? b : a).additiveCount) {
      reasons.push('添加剂更少')
    }
    return `相比另一款产品，${reasons.join('、')}，更健康选择`
  },

  // 跳转到产品
  goToProduct(e) {
    const product = e.currentTarget.dataset.product
    // TODO: 跳转到产品详情页
    wx.showToast({ title: '功能开发中', icon: 'none' })
  },

  // 获取评分颜色
  getScoreColor(score) {
    if (score >= 85) return '#4CAF50'
    if (score >= 70) return '#8BC34A'
    if (score >= 50) return '#FFC107'
    if (score >= 30) return '#FF9800'
    return '#F44336'
  }
})

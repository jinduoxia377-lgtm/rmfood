// packages/formulas/pages/detail/index.js
const api = require('../../../../utils/api.js')

Page({
  data: {
    formula: null,
    id: null,
    ingredients: []
  },

  onLoad(options) {
    this.setData({ id: options.id })
    if (options.id) {
      this.loadFormula(options.id)
    }
  },

  async loadFormula(id) {
    try {
      const formula = await api.formulas.getFormula(id)
      // 转换composition（后端返回对象，需要转为数组）
      const ingredients = this.transformComposition(formula.composition)
      this.setData({
        formula,
        ingredients
      })
    } catch (e) {
      console.error('加载配方详情失败:', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  /**
   * 转换composition对象为数组格式
   * 后端格式: { "山楂": {weight_g: 15, unit: "g", prep: "炒用"}, ... }
   * 前端格式: [{ name: "山楂", weight: 15, unit: "g", prep: "炒用" }, ...]
   */
  transformComposition(composition) {
    if (!composition || typeof composition !== 'object') return []
    if (Array.isArray(composition)) return composition

    return Object.entries(composition).map(([name, info]) => ({
      name,
      weight: info.weight_g || info.weight || 0,
      unit: info.unit || 'g',
      prep: info.prep || ''
    }))
  },

  onShareAppMessage() {
    return {
      title: this.data.formula?.name || '药食同源配方',
      path: `/packages/formulas/pages/detail/index?id=${this.data.id}`
    }
  }
})

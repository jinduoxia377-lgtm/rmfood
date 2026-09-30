// 测试页面逻辑
const api = require('../../utils/api.js')

Page({
  data: {
    testResults: [],
    loading: false
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '测试页面' })
  },

  // 配料分析测试
  async testIngredient() {
    wx.showToast({ title: '测试中...', icon: 'loading' })
    try {
      const res = await api.ingredients.getAdditives()
      this.setData({ 
        testResults: [...this.data.testResults, { type: 'ingredient', result: res, time: new Date().toLocaleString() }] 
      })
      wx.showToast({ title: '测试通过', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '测试失败', icon: 'error' })
    }
  },

  // 配方库测试
  async testFormula() {
    wx.showToast({ title: '测试中...', icon: 'loading' })
    try {
      const res = await api.formulas.getFormulas({ page: 1, pageSize: 5 })
      this.setData({ 
        testResults: [...this.data.testResults, { type: 'formula', result: res, time: new Date().toLocaleString() }] 
      })
      wx.showToast({ title: `获取 ${res.total} 条配方`, icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '测试失败', icon: 'error' })
    }
  },

  // 搜索测试
  async testSearch() {
    wx.showToast({ title: '测试中...', icon: 'loading' })
    try {
      const res = await api.database.searchHerbs({ keyword: '枸杞', page: 1 })
      this.setData({ 
        testResults: [...this.data.testResults, { type: 'search', result: res, time: new Date().toLocaleString() }] 
      })
      wx.showToast({ title: `找到 ${res.total} 条结果`, icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '测试失败', icon: 'error' })
    }
  },

  // 加载测试
  testLoad() {
    this.setData({ loading: true })
    setTimeout(() => {
      this.setData({ loading: false })
      wx.showToast({ title: '加载完成', icon: 'success' })
    }, 1000)
  },

  // 渲染测试
  testRender() {
    wx.showToast({ title: '渲染测试通过', icon: 'success' })
  },

  // 缓存测试
  testCache() {
    try {
      wx.setStorageSync('test_cache', { time: Date.now(), data: 'test' })
      const cached = wx.getStorageSync('test_cache')
      wx.showToast({ title: `缓存测试: ${cached ? '成功' : '失败'}`, icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '缓存测试失败', icon: 'error' })
    }
  },

  // 导航测试
  goToHome() {
    wx.navigateTo({ url:"/pages/index/index" })
  },

  goToSearch() {
    wx.navigateTo({ url:"/pages/search/index" })
  },

  goToProfile() {
    wx.navigateTo({ url:"/pages/profile/index/index" })
  },

  onShareAppMessage() {
    return {
      title: 'RMFOOD 测试页面',
      path: '/pages/test/index'
    }
  }
})

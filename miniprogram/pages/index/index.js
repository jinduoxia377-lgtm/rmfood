// index.js - 首页逻辑
const app = getApp()
const api = require('../../utils/api.js')

Page({
  data: {
    refreshing: false,
    showSkeleton: true,
    statusBarHeight: 0,
    headerHeight: 0,
    userInfo: null,
    formulas: [],
    recentFormulas: [],
    featuredFormula: null,
    healthTips: [],
    favorites: [],
    loading: false,
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  onLoad() {
    const systemInfo = wx.getWindowInfo()
    const statusBarHeight = systemInfo.statusBarHeight || 20
    
    // 导航栏高度 = 状态栏 + 标题区(约60px) + 搜索框(约72rpx≈36px)
    const headerHeight = statusBarHeight + 60 + 36
    
    this.setData({ 
      statusBarHeight,
      headerHeight
    })
    
    this.loadUserInfo()
    this.loadData()
  },

  onShow() {
    this.loadUserInfo()
  },

  onPullDownRefresh() {
    this.refreshData()
  },

  onReachBottom() {
    this.loadMore()
  },

  onShareAppMessage() {
    return {
      title: 'RMFOOD - 药食同源配方设计平台',
      path: '/pages/index/index'
    }
  },

  // ==================== 数据加载 ====================

  async loadData() {
    try {
      console.log('[首页] 开始加载数据')
      this.setData({ showSkeleton: true, loading: true })
      
      console.log('[首页] 调用api.formulas.getFormulas')
      const [formulasRes, tipsRes] = await Promise.allSettled([
        api.formulas.getFormulas({ page: 1, pageSize: 10 }),
        this.getHealthTips()
      ])
      console.log('[首页] formulasRes status:', formulasRes.status)

      // 处理配方数据
      if (formulasRes.status === 'fulfilled' && formulasRes.value) {
        const items = formulasRes.value.items || formulasRes.value || []
        const transformed = items.map(f => this.transformFormula(f))
        
        this.setData({
          formulas: transformed,
          recentFormulas: transformed.slice(0, 5),
          featuredFormula: transformed[0] || null,
          hasContent: transformed.length > 0
        })
      }

      // 处理健康提示
      if (tipsRes.status === 'fulfilled') {
        this.setData({ healthTips: tipsRes.value })
      }

      this.setData({ showSkeleton: false, loading: false })
    } catch (e) {
      console.error('[首页] 数据加载失败:', e)
      console.error('[首页] 错误详情:', JSON.stringify(e))
      this.setData({ showSkeleton: false, loading: false })
    }
  },

  async refreshData() {
    await this.loadData()
    wx.stopPullDownRefresh()
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return
    // 加载更多逻辑可扩展
  },

  // 数据转换：统一字段名与WXML绑定
  transformFormula(f) {
    return {
      id: f.id,
      title: f.name || f.title || '未命名配方',
      subtitle: f.description || f.subtitle || '',
      imageUrl: f.cover_image || f.image || '/assets/images/default-formula.png',
      tags: (f.tags || []).map(t => typeof t === 'string' ? { text: t, type: 'primary' } : t),
      ingredients: f.ingredients || f.herbs || '多种食材',
      difficulty: f.difficulty || '简易',
      healthScore: f.health_score || 85,
      season: f.season || this.getCurrentSeason()
    }
  },

  getCurrentSeason() {
    const month = new Date().getMonth() + 1
    if (month >= 3 && month <= 5) return '春季'
    if (month >= 6 && month <= 8) return '夏季'
    if (month >= 9 && month <= 11) return '秋季'
    return '冬季'
  },

  // ==================== 健康提示 ====================

  getHealthTips() {
    const month = new Date().getMonth() + 1
    const tips = [
      { 
        type: 'season', 
        tag: '节气养生', 
        title: '顺应四时调神大论', 
        desc: '春养生、夏养长、秋养收、冬养藏，顺应自然规律' 
      },
      { 
        type: 'warning', 
        tag: '饮食注意', 
        title: '药食同源，食养为先', 
        desc: '许多食材兼具药用价值，合理搭配可养生保健' 
      },
      { 
        type: 'knowledge', 
        tag: '健康知识', 
        title: '了解你的体质', 
        desc: '中医体质分为九种，不同体质适合不同的食疗方案' 
      }
    ]
    return tips
  },

  // ==================== 用户信息 ====================

  async loadUserInfo() {
    try {
      const userInfo = wx.getStorageSync('user_info')
      if (userInfo) {
        this.setData({ userInfo })
      }
    } catch (e) {
      // silent fail
    }
  },

  // ==================== 收藏 ====================

  loadFavorites() {
    try {
      const favorites = wx.getStorageSync('rmfood_favorites') || []
      this.setData({ favorites })
    } catch (e) { /* silent */ }
  },

  saveFavorites(favorites) {
    wx.setStorageSync('rmfood_favorites', favorites)
    this.setData({ favorites })
  },

  // ==================== 导航 ====================

  goToSearch() {
    wx.navigateTo({ url: '/pages/search/index' })
  },

  goToProfile() {
    wx.navigateTo({ url:"/pages/profile/index/index" })
  },

  startAiChat() {
    wx.navigateTo({ url:"/packages/chat/pages/index/index" })
  },

  startIngredientAnalysis() {
    wx.navigateTo({ url: '/packages/ingredient/pages/analysis/index' })
  },

  goToFormulas() {
    wx.navigateTo({ url: '/packages/formulas/pages/index/index' })
  },

  goToHistory() {
    wx.navigateTo({ url: '/pages/profile/history/index' })
  },

  goToDatabase() {
    wx.navigateTo({ url: '/pages/database/index' })
  },

  goToCompliance() {
    wx.navigateTo({ url: '/pages/compliance/index' })
  },

  viewFormulaDetail(e) {
    const id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({ url: `/packages/formulas/pages/detail/index?id=${id}` })
    }
  },

  viewTipDetail(e) {
    const index = e.currentTarget.dataset.index
    const tip = this.data.healthTips[index]
    if (tip) {
      wx.showModal({
        title: tip.title,
        content: tip.desc,
        showCancel: false,
        confirmText: '知道了'
      })
    }
  }
})

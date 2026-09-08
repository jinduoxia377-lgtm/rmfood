// index.js - Homepage Logic
const app = getApp()
const request = require('../../utils/request.js')

Page({
  data: {
    menuOpen: false,
    refreshing: false,
    showSkeleton: true,
    statusBarHeight: 0,
    userInfo: null,
    formulas: [],
    ingredients: [],
    healthTips: [],
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  onLoad() {
    const systemInfo = wx.getWindowInfo()
    this.setData({ statusBarHeight: systemInfo.statusBarHeight })
    
    // 加载数据
    this.loadUserInfo()
    this.loadFormulas()
    this.loadIngredients()
    this.loadHealthTips()
  },

  onShow() {
    // 页面显示时刷新用户信息
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
      title: 'RMFOOD - 药食同源配方平台',
      path: '/pages/index/index'
    }
  },

  async loadUserInfo() {
    try {
      const userInfo = wx.getStorageSync('user_info')
      if (userInfo) {
        this.setData({ userInfo })
      }
    } catch (e) {
      console.error('[Index] Load user info failed:', e)
    }
  },

  async loadFormulas() {
    try {
      this.setData({ showSkeleton: true })
      
      // TODO: 调用真实 API
      // const res = await request.get('/formulas', { page: 1, pageSize: 10 })
      
      // 模拟数据
      const formulas = [
        {
          id: 1,
          name: '黄芪枸杞茶',
          description: '补气养阴，适合熬夜人群',
          image: '/assets/images/formula-1.jpg',
          healthScore: 92,
          tags: ['补气', '养生']
        }
      ]
      
      this.setData({
        formulas,
        showSkeleton: false
      })
    } catch (e) {
      console.error('[Index] Load formulas failed:', e)
      this.setData({ showSkeleton: false })
    }
  },

  async loadIngredients() {
    try {
      // TODO: 调用真实 API
    } catch (e) {
      console.error('[Index] Load ingredients failed:', e)
    }
  },

  async loadHealthTips() {
    try {
      // TODO: 调用真实 API
    } catch (e) {
      console.error('[Index] Load health tips failed:', e)
    }
  },

  async refreshData() {
    await Promise.all([
      this.loadFormulas(),
      this.loadIngredients(),
      this.loadHealthTips()
    ])
    wx.stopPullDownRefresh()
  },

  async loadMore() {
    if (!this.data.hasMore) return
    
    const nextPage = this.data.page + 1
    try {
      // TODO: 加载更多数据
      this.setData({ page: nextPage })
    } catch (e) {
      console.error('[Index] Load more failed:', e)
    }
  },

  onMenuTap() {
    this.setData({ menuOpen: !this.data.menuOpen })
  },

  onSearchTap() {
    wx.navigateTo({
      url: '/pages/search/index'
    })
  },

  onFormulaTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/packages/formulas/pages/detail/index?id=${id}`
    })
  },

  onProfileTap() {
    wx.switchTab({
      url: '/pages/profile/index/index'
    })
  }
})

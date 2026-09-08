/**
 * 配方列表页面逻辑 - 虚拟列表优化版
 */
const app = getApp()
const { getCacheManager } = require('../../../../utils/cache_manager')
const { getMicroAnimationManager } = require('../../../../utils/micro_animation')

Page({
  data: {
    loading: false,
    formulas: [],
    filters: [
      { value: 'all', label: '全部' },
      { value: 'tea', label: '代茶饮' },
      { value: 'soup', label: '汤剂' },
      { value: 'paste', label: '膏方' },
      { value: 'powder', label: '散剂' }
    ],
    activeFilter: 'all',
    menuOpen: false,
    userInfo: null,
    containerHeight: 0,
    scrollTop: 0
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      containerHeight: systemInfo.windowHeight * (750 / systemInfo.windowWidth) - 120
    })
    
    this.initPage()
  },

  onShow() {
    // 从缓存加载数据
    this.loadFromCache()
  },

  onHide() {
    // 保存到缓存
    this.saveToCache()
  },

  onUnload() {
    // 清除缓存
    this.clearCache()
  },

  /**
   * 初始化页面
   */
  async initPage() {
    // 获取用户信息
    this.setData({
      userInfo: app.globalData.userInfo
    })

    // 加载配方数据
    await this.loadFormulas()

    // 播放入场动画
    this.playEnterAnimations()
  },

  /**
   * 从缓存加载数据
   */
  loadFromCache() {
    const cacheManager = getCacheManager()
    const cachedData = cacheManager.getCachedPage('/packages/formulas/pages/index/index')
    
    if (cachedData) {
      console.log('[FormulaList] Loading from cache')
      this.setData({
        formulas: cachedData.formulas,
        activeFilter: cachedData.activeFilter || 'all',
        loading: false
      })
    }
  },

  /**
   * 保存数据到缓存
   */
  saveToCache() {
    const cacheManager = getCacheManager()
    cacheManager.cachePage('/packages/formulas/pages/index/index', {
      formulas: this.data.formulas,
      activeFilter: this.data.activeFilter
    })
  },

  /**
   * 清除缓存
   */
  clearCache() {
    const cacheManager = getCacheManager()
    cacheManager.clearPageCache('/packages/formulas/pages/index/index')
  },

  /**
   * 加载配方列表
   */
  async loadFormulas() {
    this.setData({ loading: true })
    
    try {
      // 优先从本地缓存加载
      const cachedFormulas = wx.getStorageSync('formulas_cache')
      if (cachedFormulas && cachedFormulas.length > 0) {
        const filtered = this.filterFormulas(cachedFormulas)
        this.setData({ 
          formulas: filtered,
          loading: false 
        })
        // 异步缓存
        this.saveToCache()
        return
      }
      
      // TODO: 调用后端API
      // const res = await request.get('/formulas', { filter: this.data.activeFilter })
      // this.setData({ formulas: res.data, loading: false })
      
      // 模拟数据加载
      setTimeout(() => {
        const mockData = this.getMockFormulas()
        const filtered = this.filterFormulas(mockData)
        
        this.setData({ 
          formulas: filtered,
          loading: false 
        })
        
        // 缓存数据
        wx.setStorageSync('formulas_cache', mockData)
      }, 300)
      
    } catch (error) {
      console.error('[FormulaList] Load failed:', error)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 筛选配方
   */
  filterFormulas(formulas) {
    switch (this.data.activeFilter) {
      case 'tea':
        return formulas.filter(f => f.type === 'tea')
      case 'soup':
        return formulas.filter(f => f.type === 'soup')
      case 'paste':
        return formulas.filter(f => f.type === 'paste')
      case 'powder':
        return formulas.filter(f => f.type === 'powder')
      default:
        return formulas
    }
  },

  /**
   * 切换筛选
   */
  setFilter(e) {
    const filter = e.currentTarget.dataset.filter
    this.setData({ activeFilter: filter })
    this.loadFormulas()
    
    // 播放微动效
    const manager = getMicroAnimationManager()
    manager.playTapFeedback(this, '.filter-item')
  },

  /**
   * 滚动事件
   */
  onScroll(e) {
    this.setData({
      scrollTop: e.detail.scrollTop
    })
  },

  /**
   * 滚动到指定位置
   */
  onScrollTo(e) {
    const { index } = e.detail
    console.log('[FormulaList] Scroll to index:', index)
  },

  /**
   * 跳转到详情页
   */
  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/packages/formulas/pages/detail/index?id=${id}`
    })
    
    // 播放微动效
    const manager = getMicroAnimationManager()
    manager.playTapFeedback(this, '.formula-card')
  },

  /**
   * 切换菜单
   */
  toggleMenu() {
    this.setData({ menuOpen: !this.data.menuOpen })
  },

  /**
   * 跳转到个人中心
   */
  goToProfile() {
    wx.switchTab({
      url: '/pages/profile/index/index'
    })
  },

  /**
   * 跳转到历史记录
   */
  goToHistory() {
    wx.navigateTo({
      url: '/pages/profile/history/index'
    })
  },

  /**
   * 跳转到设置
   */
  goToSettings() {
    wx.navigateTo({
      url: '/pages/settings/index'
    })
  },

  /**
   * 开始新对话
   */
  newChat() {
    wx.switchTab({
      url: '/packages/chat/pages/index/index'
    })
  },

  /**
   * 播放入场动画
   */
  playEnterAnimations() {
    const manager = getMicroAnimationManager()
    
    // 筛选栏动画
    manager.playEnterAnimation(this, '.filter-bar', 'fade-in', 100)
    
    // 列表项动画（交错）
    if (this.data.formulas.length > 0) {
      manager.playBatchEnterAnimation(
        this, 
        '.formula-card', 
        'slide-up', 
        50
      )
    }
  },

  /**
   * 获取评分颜色
   */
  getScoreColor(score) {
    if (!score) return 'var(--color-text-muted)'
    if (score >= 85) return 'var(--color-success)'
    if (score >= 70) return 'var(--color-primary)'
    if (score >= 50) return 'var(--color-warning)'
    return 'var(--color-danger)'
  },

  /**
   * 获取模拟数据
   */
  getMockFormulas() {
    return [
      {
        id: 1,
        name: '安神助眠汤',
        description: '养心安神，适用于心肾不交引起的失眠多梦',
        type: 'soup',
        days: 7,
        healthScore: 92,
        coverImage: '/assets/images/formula-1.jpg',
        tags: [
          { text: '安神', type: 'success' },
          { text: '助眠', type: 'primary' }
        ]
      },
      {
        id: 2,
        name: '健脾养胃茶',
        description: '健脾益气，适用于脾胃虚弱引起的食欲不振',
        type: 'tea',
        days: 14,
        healthScore: 88,
        coverImage: '/assets/images/formula-2.jpg',
        tags: [
          { text: '健脾', type: 'success' },
          { text: '养胃', type: 'primary' }
        ]
      },
      {
        id: 3,
        name: '益气养阴膏',
        description: '益气养阴，适用于气阴两虚引起的乏力口渴',
        type: 'paste',
        days: 30,
        healthScore: 85,
        coverImage: '/assets/images/formula-3.jpg',
        tags: [
          { text: '益气', type: 'success' },
          { text: '养阴', type: 'primary' }
        ]
      },
      {
        id: 4,
        name: '清热解毒散',
        description: '清热解毒，适用于热毒蕴结引起的咽喉肿痛',
        type: 'powder',
        days: 7,
        healthScore: 80,
        coverImage: '/assets/images/formula-4.jpg',
        tags: [
          { text: '清热', type: 'warning' },
          { text: '解毒', type: 'primary' }
        ]
      },
      {
        id: 5,
        name: '活血化瘀汤',
        description: '活血化瘀，适用于血瘀引起的痛经月经不调',
        type: 'soup',
        days: 14,
        healthScore: 78,
        coverImage: '/assets/images/formula-5.jpg',
        tags: [
          { text: '活血', type: 'warning' },
          { text: '化瘀', type: 'primary' }
        ]
      },
      {
        id: 6,
        name: '润肺止咳茶',
        description: '润肺止咳，适用于肺燥引起的干咳少痰',
        type: 'tea',
        days: 7,
        healthScore: 85,
        coverImage: '/assets/images/formula-6.jpg',
        tags: [
          { text: '润肺', type: 'success' },
          { text: '止咳', type: 'primary' }
        ]
      }
    ]
  }
})

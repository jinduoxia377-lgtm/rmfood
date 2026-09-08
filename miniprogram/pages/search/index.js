// search/index.js - 药食同源搜索功能深度开发版
const app = getApp()
const { getMicroAnimationManager } = require('../../utils/micro_animation')
const request = require('../../utils/request.js')

Page({
  data: {
    // 搜索状态
    keyword: '',
    isSearchActive: false,
    showSkeleton: false,

    // 搜索结果
    ingredients: [],
    formulas: [],
    articles: [],
    allResults: [],

    // 加载状态
    loading: false,
    searched: false,
    hasMore: false,

    // 搜索历史
    searchHistory: [],

    // 热门搜索词
    hotKeywords: [
      '枸杞', '黄芪', '山药', '茯苓', '红枣',
      '安神助眠', '健脾养胃', '补气血', '祛湿',
      '润肺止咳', '清热解毒', '养肝护肝'
    ],

    // 筛选标签
    activeTab: 'all',
    tabs: [
      { key: 'all', name: '全部' },
      { key: 'ingredient', name: '食材' },
      { key: 'formula', name: '配方' },
      { key: 'article', name: '知识' }
    ],

    // 排序
    sortBy: 'relevance',
    sortOptions: [
      { key: 'relevance', name: '相关度' },
      { key: 'score', name: '健康分' },
      { key: 'compounds', name: '化合物数' }
    ]
  },  playTapFeedback(selector) {
    const manager = getMicroAnimationManager()
    manager.playTapFeedback(this, selector)
  },
  onLoad() {
    this.loadSearchHistory()
  },

  onShow() {
    // 刷新搜索历史
    this.loadSearchHistory()
  },

  onHide() {
    // 页面隐藏时保存状态
  },

  // ==================== 搜索历史管理 ====================
  
  loadSearchHistory() {
    try {
      const history = wx.getStorageSync('search_history') || []
      this.setData({ searchHistory: history.slice(0, 10) })
    } catch (error) {
      console.error('[search] loadSearchHistory error:', error)
    }
  },

  saveSearchHistory(keyword) {
    if (!keyword || keyword.trim() === '') return
    try {
      let history = wx.getStorageSync('search_history') || []
      // 移除重复项
      history = history.filter(item => item !== keyword.trim())
      // 添加到开头
      history.unshift(keyword.trim())
      // 限制数量
      if (history.length > 20) {
        history = history.slice(0, 20)
      }
      wx.setStorageSync('search_history', history)
      this.setData({ searchHistory: history })
    } catch (error) {
      console.error('[search] saveSearchHistory error:', error)
    }
  },

  clearSearchHistory() {
    wx.showModal({
      title: '清除历史',
      content: '确定要清除所有搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('search_history')
          this.setData({ searchHistory: [] })
          wx.showToast({ title: '已清除', icon: 'success' })
        }
      }
    })
  },

  // ==================== 搜索输入处理 ====================
  
  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({ keyword })
    
    // 实时搜索建议（防抖）
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
    }
    this.searchTimer = setTimeout(() => {
      if (keyword.length >= 1) {
        this.performSearch(keyword, true)
      }
    }, 300)
  },

  // 执行搜索
  onSearch() {
    const keyword = this.data.keyword.trim()
    if (!keyword) {
      wx.showToast({ title: '请输入搜索关键词', icon: 'none' })
      return
    }
    
    // 清除定时器
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
    }
    
    this.saveSearchHistory(keyword)
    this.performSearch(keyword, false)
  },

  // 实际搜索逻辑
  async performSearch(keyword, isSuggestion = false) {
    if (this.data.loading) return

    this.setData({
      loading: true,
      searched: true,
      isSearchActive: keyword.length > 0,
      showSkeleton: !isSuggestion
    })

    try {
      // 并发搜索多个数据源
      const [ingredientsRes, formulasRes, articlesRes] = await Promise.allSettled([
        this.searchIngredients(keyword),
        this.searchFormulas(keyword),
        this.searchArticles(keyword)
      ])

      // 处理搜索结果
      const ingredients = ingredientsRes.status === 'fulfilled' ? (ingredientsRes.value.items || []) : []
      const formulas = formulasRes.status === 'fulfilled' ? (formulasRes.value.items || []) : []
      const articles = articlesRes.status === 'fulfilled' ? (articlesRes.value.items || []) : []

      // 合并结果
      const allResults = this.mergeResults(ingredients, formulas, articles, keyword)

      this.setData({
        ingredients,
        formulas,
        articles,
        allResults,
        hasMore: ingredients.length + formulas.length + articles.length >= 10,
        loading: false,
        showSkeleton: false
      })
      
    } catch (error) {
      console.error('[search] performSearch error:', error)
      this.setData({
        loading: false,
        showSkeleton: false
      })

      if (!isSuggestion) {
        wx.showToast({
          title: '搜索失败，请重试',
          icon: 'none'
        })
      }
    }
  },

  // 搜索食材
  async searchIngredients(keyword) {
    try {
      const res = await request.get('/ingredients', {
        search: keyword,
        page: 1,
        page_size: 20
      })
      return res && res.data ? res.data : { items: [], total: 0 }
    } catch (error) {
      console.error('[search] searchIngredients error:', error)
      return { items: [], total: 0 }
    }
  },

  // 搜索配方
  async searchFormulas(keyword) {
    try {
      const res = await request.get('/formulas', {
        search: keyword,
        page: 1,
        page_size: 20,
        status: 'approved'
      })
      return res || { items: [], total: 0 }
    } catch (error) {
      console.error('[search] searchFormulas error:', error)
      return { items: [], total: 0 }
    }
  },

  // 搜索文章
  async searchArticles(keyword) {
    // 文章搜索暂使用本地数据或返回空
    return { items: [], total: 0 }
  },

  // 合并结果并排序
  mergeResults(ingredients, formulas, articles, keyword) {
    const results = []
    const keywordLower = keyword.toLowerCase()
    
    // 添加食材结果
    ingredients.forEach(item => {
      results.push({
        type: 'ingredient',
        id: item.id,
        name: item.nameCn || item.name,
        latin: item.latin,
        description: item.description,
        properties: item.properties,
        obPercent: item.ob_percent,
        dlValue: item.dl_value,
        compoundCount: item.compounds ? item.compounds.length : 0,
        score: item.health_score || 0,
        relevance: this.calculateRelevance(item.nameCn || item.name, keywordLower)
      })
    })
    
    // 添加配方结果
    formulas.forEach(item => {
      results.push({
        type: 'formula',
        id: item.id,
        name: item.name,
        description: item.description || item.shortDesc,
        healthScore: item.health_score,
        tags: item.tags,
        coverImage: item.cover_image,
        score: item.health_score || 0,
        relevance: this.calculateRelevance(item.name, keywordLower)
      })
    })
    
    // 按相关度排序
    results.sort((a, b) => b.relevance - a.relevance)
    
    return results
  },

  // 计算相关度
  calculateRelevance(text, keyword) {
    if (!text || !keyword) return 0
    text = text.toLowerCase()
    keyword = keyword.toLowerCase()
    
    let score = 0
    if (text.includes(keyword)) score += 10
    if (text.startsWith(keyword)) score += 5
    if (text === keyword) score += 20
    
    return score
  },

  // ==================== 筛选和排序 ====================
  
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  switchSort(e) {
    const sort = e.currentTarget.dataset.sort
    this.setData({ sortBy: sort })
    // 重新排序
    this.sortResults()
  },

  sortResults() {
    let sorted = [...this.data.allResults]
    
    switch (this.data.sortBy) {
      case 'score':
        sorted.sort((a, b) => b.score - a.score)
        break
      case 'compounds':
        sorted.sort((a, b) => (b.compoundCount || 0) - (a.compoundCount || 0))
        break
      default:
        sorted.sort((a, b) => b.relevance - a.relevance)
    }
    
    this.setData({ allResults: sorted })
  },

  // ==================== 热门关键词搜索 ====================
  
  searchHotKeyword(e) {
    const keyword = e.currentTarget.dataset.keyword
    this.setData({ keyword })
    this.saveSearchHistory(keyword)
    this.performSearch(keyword, false)
  },

  // ==================== 结果交互 ====================
  
  goToIngredientDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/ingredient/detail/index?id=${id}`
    })
  },

  goToFormulaDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/packages/formulas/pages/detail/index?id=${id}`
    })
  },

  goToArticle(e) {
    const id = e.currentTarget.dataset.id
    wx.showToast({ title: '即将上线', icon: 'none' })
  },

  // ==================== 清除搜索 ====================
  
  clearSearch() {
    this.setData({ 
      keyword: '',
      searched: false,
      isSearchActive: false,
      allResults: [],
      ingredients: [],
      formulas: [],
      articles: []
    })
  },

  // ==================== 下拉刷新 ====================
  
  onPullDownRefresh() {
    if (this.data.keyword) {
      this.performSearch(this.data.keyword, false).then(() => {
        wx.stopPullDownRefresh()
      })
    } else {
      wx.stopPullDownRefresh()
    }
  },

  // ==================== 上拉加载更多 ====================
  
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore()
    }
  },

  loadMore() {
    // 加载更多逻辑
    wx.showToast({ title: '已加载全部', icon: 'none' })
  },

  // ==================== 工具方法 ====================
  
  getScoreColor(score) {
    if (!score) return '#9E9E9E'
    const s = parseInt(score)
    if (s >= 85) return '#4CAF50'
    if (s >= 70) return '#8BC34A'
    if (s >= 50) return '#FFC107'
    if (s >= 30) return '#FF9800'
    return '#F44336'
  },

  getIngredientType(tag) {
    const types = {
      '寒': '寒性',
      '热': '热性',
      '温': '温性',
      '凉': '凉性',
      '平': '平性'
    }
    return types[tag] || tag
  },

  // ==================== 分享 ====================
  
  onShareAppMessage() {
    return {
      title: `我在药食同源平台搜索了"${this.data.keyword || '药食同源'}"`,
      path: '/pages/search/index',
      imageUrl: ''
    }
  },

  onShareTimeline() {
    return {
      title: '药食同源 - 智能膳食顾问',
      query: '',
      imageUrl: ''
    }
  }
})


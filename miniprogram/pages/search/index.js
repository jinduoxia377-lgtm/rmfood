// Search Page Logic - Medicine Food Homology Search
const app = getApp()
const { getMicroAnimationManager } = require('../../utils/micro_animation')
const api = require('../../utils/api.js')

Page({
  data: {
    keyword: '',
    searchQuery: '',
    hasSearch: false,
    hasSearched: false,
    showSkeleton: false,
    isTyping: false,
    ingredients: [],
    formulas: [],
    articles: [],
    allResults: [],
    loading: false,
    searched: false,
    hasMore: false,
    isLoadingMore: false,
    searchHistory: [],
    hotKeywords: [
      { name: 'Goji', count: 1280, rank: 1 },
      { name: 'Astragalus', count: 956, rank: 2 },
      { name: 'Yam', count: 834, rank: 3 },
      { name: 'Poria', count: 723, rank: 4 },
      { name: 'Jujube', count: 698, rank: 5 },
      { name: 'Sleep Aid', count: 567, rank: 6 },
      { name: 'Spleen Support', count: 523, rank: 7 },
      { name: 'Blood Tonic', count: 489, rank: 8 }
    ],
    categories: [
      { id: '1', name: 'Exterior', icon: 'search', color: '#E53935' },
      { id: '2', name: 'Heat-clearing', icon: 'fire', color: '#FF9800' },
      { id: '3', name: 'Tonifying', icon: 'heart', color: '#43A047' },
      { id: '4', name: 'Qi-regulating', icon: 'wind', color: '#1E88E5' },
      { id: '5', name: 'Blood-activating', icon: 'drop', color: '#8E24AA' },
      { id: '6', name: 'Phlegm-resolving', icon: 'cough', color: '#00ACC1' }
    ],
    activeTab: 'all',
    tabs: [
      { key: 'all', name: 'All' },
      { key: 'ingredient', name: 'Ingredients' },
      { key: 'formula', name: 'Formulas' },
      { key: 'article', name: 'Articles' }
    ],
    sortBy: 'relevance',
    sortOptions: [
      { key: 'relevance', name: 'Relevance' },
      { key: 'score', name: 'Health Score' },
      { key: 'compounds', name: 'Compounds' }
    ],
    voiceSearch: false,
    isVoiceRecording: false,
    showFilter: false,
    filters: {
      nature: '',
      taste: '',
      meridian: ''
    }
  },

  searchTimer: null,

  onLoad() {
    this.loadSearchHistory()
  },

  onShow() {
    this.loadSearchHistory()
  },

  loadSearchHistory() {
    try {
      const history = wx.getStorageSync('rmfood_search_history') || []
      this.setData({ searchHistory: history.slice(0, 10) })
    } catch (error) {
      // silent fail
    }
  },

  saveSearchHistory(keyword) {
    if (!keyword || keyword.trim() === '') return
    try {
      let history = wx.getStorageSync('rmfood_search_history') || []
      history = history.filter(item => item !== keyword.trim())
      history.unshift(keyword.trim())
      if (history.length > 20) {
        history = history.slice(0, 20)
      }
      wx.setStorageSync('rmfood_search_history', history)
      this.setData({ searchHistory: history })
    } catch (error) {
      // silent fail
    }
  },

  clearSearchHistory() {
    wx.showModal({
      title: 'Clear History',
      content: 'Are you sure you want to clear all search history?',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('rmfood_search_history')
          this.setData({ searchHistory: [] })
          wx.showToast({ title: 'Cleared', icon: 'success' })
        }
      }
    })
  },

  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({ keyword, searchQuery: keyword })
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
    }
    this.searchTimer = setTimeout(() => {
      if (keyword.length >= 1) {
        this.performSearch(keyword, true)
      }
    }, 300)
  },

  onSearch() {
    const keyword = this.data.keyword.trim()
    if (!keyword) {
      wx.showToast({ title: 'Please enter a search keyword', icon: 'none' })
      return
    }
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
    }
    this.saveSearchHistory(keyword)
    this.setData({ hasSearch: true, hasSearched: true })
    this.performSearch(keyword, false)
  },

  onCancel() {
    this.setData({
      keyword: '',
      searchQuery: '',
      hasSearch: false,
      hasSearched: false,
      allResults: [],
      ingredients: [],
      formulas: [],
      searched: false
    })
  },

  async performSearch(keyword, isSuggestion = false) {
    if (this.data.loading) return
    this.setData({
      loading: true,
      searched: true,
      showSkeleton: !isSuggestion
    })
    try {
      const [ingredientsRes, formulasRes] = await Promise.allSettled([
        this.searchIngredients(keyword),
        this.searchFormulas(keyword)
      ])
      const ingredients = ingredientsRes.status === 'fulfilled' ? (ingredientsRes.value.items || []) : []
      const formulas = formulasRes.status === 'fulfilled' ? (formulasRes.value.items || []) : []
      const allResults = this.mergeResults(ingredients, formulas, keyword)
      this.setData({
        ingredients,
        formulas,
        allResults,
        hasMore: ingredients.length + formulas.length >= 10,
        loading: false,
        showSkeleton: false
      })
    } catch (error) {
      this.setData({ loading: false, showSkeleton: false })
      if (!isSuggestion) {
        wx.showToast({ title: 'Search failed, please retry', icon: 'none' })
      }
    }
  },

  async searchIngredients(keyword) {
    try {
      const res = await api.database.searchHerbs({ keyword, page: 1, pageSize: 20 })
      return res
    } catch (error) {
      return { items: [], total: 0 }
    }
  },

  async searchFormulas(keyword) {
    try {
      const res = await api.formulas.getFormulas({ search: keyword, page: 1, pageSize: 20, status: 'approved' })
      return res
    } catch (error) {
      return { items: [], total: 0 }
    }
  },

  mergeResults(ingredients, formulas, keyword) {
    const results = []
    const keywordLower = keyword.toLowerCase()
    ingredients.forEach(item => {
      results.push({
        type: 'ingredient',
        id: item.id,
        name: item.name_cn || item.name,
        latin: item.name_latin,
        description: item.effects,
        properties: item.properties,
        obPercent: item.ob_percent,
        dlValue: item.dl_value,
        compoundCount: item.compound_count || 0,
        score: item.ob_percent || 0,
        relevance: this.calculateRelevance(item.name_cn || item.name, keywordLower),
        coverImage: item.image_url
      })
    })
    formulas.forEach(item => {
      results.push({
        type: 'formula',
        id: item.id,
        name: item.name,
        description: item.description || '',
        healthScore: item.health_score || 0,
        tags: item.tags || [],
        coverImage: item.cover_image,
        score: item.health_score || 0,
        relevance: this.calculateRelevance(item.name, keywordLower)
      })
    })
    results.sort((a, b) => b.relevance - a.relevance)
    return results
  },

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

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  switchSort(e) {
    const sort = e.currentTarget.dataset.sort
    this.setData({ sortBy: sort })
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

  searchHotKeyword(e) {
    const keyword = e.currentTarget.dataset.keyword
    this.setData({ keyword, searchQuery: keyword, hasSearch: true, hasSearched: true })
    this.saveSearchHistory(keyword)
    this.performSearch(keyword, false)
  },

  searchByCategory(e) {
    const category = e.currentTarget.dataset.category
    const keywords = {
      '1': 'Exterior', '2': 'Heat-clearing', '3': 'Tonifying',
      '4': 'Qi-regulating', '5': 'Blood', '6': 'Phlegm'
    }
    const keyword = keywords[category] || category
    this.setData({ keyword, searchQuery: keyword, hasSearch: true, hasSearched: true })
    this.performSearch(keyword, false)
  },

  goToIngredientDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/database/herb-detail/index?id=${id}` })
  },

  goToFormulaDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/packages/formulas/pages/detail/index?id=${id}` })
  },

  viewResult(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.allResults.find(r => r.id == id)
    if (item) {
      if (item.type === 'ingredient') {
        this.goToIngredientDetail(e)
      } else {
        this.goToFormulaDetail(e)
      }
    }
  },

  startVoiceSearch() {
    this.setData({ isVoiceRecording: true })
    const recorderManager = wx.getRecorderManager()
    recorderManager.onStart(() => {
      this.setData({ voiceSearch: true })
    })
    recorderManager.onStop((res) => {
      this.setData({ isVoiceRecording: false, voiceSearch: false })
      if (res.duration > 500) {
        const tempFilePath = res.tempFilePath
        wx.uploadFile({
          url: `${app.globalData.baseUrl}/speech/recognize`,
          filePath: tempFilePath,
          name: 'audio',
          formData: { language: 'zh' },
          success: (uploadRes) => {
            try {
              const data = JSON.parse(uploadRes.data)
              if (data.text) {
                this.setData({ keyword: data.text, searchQuery: data.text, hasSearch: true, hasSearched: true })
                this.saveSearchHistory(data.text)
                this.performSearch(data.text, false)
              }
            } catch (e) {
              wx.showToast({ title: 'Recognition failed', icon: 'none' })
            }
          },
          fail: () => {
            wx.showToast({ title: 'Recognition failed', icon: 'none' })
          }
        })
      }
    })
    recorderManager.start({
      duration: 10000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 192000,
      format: 'mp3'
    })
  },

  toggleFilter() {
    this.setData({ showFilter: !this.data.showFilter })
  },

  applyFilter(e) {
    const filterType = e.currentTarget.dataset.type
    const filterValue = e.currentTarget.dataset.value
    this.setData({ [`filters.${filterType}`]: filterValue })
    this.setData({ showFilter: false })
    wx.showToast({ title: 'Filter applied', icon: 'success' })
  },

  clearFilter() {
    this.setData({ filters: { nature: '', taste: '', meridian: '' } })
    this.setData({ showFilter: false })
  },

  clearSearch() {
    this.setData({
      keyword: '',
      searchQuery: '',
      hasSearch: false,
      hasSearched: false,
      allResults: [],
      ingredients: [],
      formulas: [],
      searched: false
    })
  },

  onPullDownRefresh() {
    if (this.data.keyword) {
      this.performSearch(this.data.keyword, false).then(() => {
        wx.stopPullDownRefresh()
      })
    } else {
      wx.stopPullDownRefresh()
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore()
    }
  },

  loadMore() {
    wx.showToast({ title: 'All loaded', icon: 'none' })
  },

  getScoreColor(score) {
    if (!score) return '#9E9E9E'
    const s = parseInt(score)
    if (s >= 85) return '#4CAF50'
    if (s >= 70) return '#8BC34A'
    if (s >= 50) return '#FFC107'
    if (s >= 30) return '#FF9800'
    return '#F44336'
  },

  getNatureColor(nature) {
    const colors = {
      'Cold': '#2196F3',
      'Hot': '#F44336',
      'Warm': '#FF9800',
      'Cool': '#00BCD4',
      'Neutral': '#8BC34A'
    }
    return colors[nature] || '#9E9E9E'
  },

  onShareAppMessage() {
    return {
      title: `I searched ${this.data.keyword || 'Medicine Food'} on RMFOOD platform`,
      path: '/pages/search/index',
      imageUrl: ''
    }
  },

  onShareTimeline() {
    return {
      title: 'Medicine Food Homology - Smart Diet Consultant',
      query: '',
      imageUrl: ''
    }
  },

  onUnload() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
  },

  // Method aliases for WXML compatibility
  focusSearch() {
    // Focus search input
    this.setData({ showSearchInput: true })
  },
  
  searchKeyword(e) {
    const keyword = e.detail.value
    this.setData({ keyword, searchQuery: keyword })
    if (keyword.trim()) {
      this.performSearch(keyword)
    }
  },
  
  clearHistory() {
    this.clearSearchHistory()
  },
  
  searchHistory(e) {
    const keyword = e.currentTarget.dataset.keyword
    this.setData({ keyword, searchQuery: keyword })
    this.performSearch(keyword)
  },
  
  deleteHistory(e) {
    const keyword = e.currentTarget.dataset.keyword
    let history = wx.getStorageSync('rmfood_search_history') || []
    history = history.filter(h => h !== keyword)
    wx.setStorageSync('rmfood_search_history', history)
    this.setData({ searchHistory: history })
  },
  
  applyFilters() {
    this.performSearch(this.data.keyword)
  }
})
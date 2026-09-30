/**
 * 数据库检索中心 - 深度完善版
 */
const api = require('../../utils/api.js')

// Tab 配置
const TABS = [
  { key: 'dashboard', label: '概览', icon: '📊' },
  { key: 'herbs', label: '中药材', icon: '🌿' },
  { key: 'peptides', label: '活性肽', icon: '🧬' },
  { key: 'homology', label: '药食同源', icon: '⭐' },
  { key: 'graph', label: '知识图谱', icon: '🕸️' }
]

const HERB_CATEGORIES = [
  { key: '', label: '全部' },
  { key: '解表药', label: '解表药' },
  { key: '清热药', label: '清热药' },
  { key: '泻下药', label: '泻下药' },
  { key: '祛风湿药', label: '祛风湿药' },
  { key: '化湿药', label: '化湿药' },
  { key: '利水渗湿药', label: '利水渗湿药' },
  { key: '温里药', label: '温里药' },
  { key: '理气药', label: '理气药' },
  { key: '消食药', label: '消食药' },
  { key: '驱虫药', label: '驱虫药' },
  { key: '止血药', label: '止血药' },
  { key: '活血化瘀药', label: '活血化瘀药' },
  { key: '化痰止咳药', label: '化痰止咳药' },
  { key: '安神药', label: '安神药' },
  { key: '平肝息风药', label: '平肝息风药' },
  { key: '开窍药', label: '开窍药' },
  { key: '补虚药', label: '补虚药' },
  { key: '收涩药', label: '收涩药' }
]

const PEPTIDE_ACTIVITY_TYPES = [
  { key: '', label: '全部' },
  { key: 'antioxidant', label: '抗氧化' },
  { key: 'antibacterial', label: '抗菌' },
  { key: 'antiviral', label: '抗病毒' },
  { key: 'immunomodulatory', label: '免疫调节' },
  { key: 'antitumor', label: '抗肿瘤' },
  { key: 'antihypertensive', label: '降血压' },
  { key: 'antidiabetic', label: '降血糖' },
  { key: 'lipid_lowering', label: '降血脂' }
]

const NODE_TYPES = [
  { key: '', label: '全部' },
  { key: 'herb', label: '药材' },
  { key: 'compound', label: '化合物' },
  { key: 'target', label: '靶点' },
  { key: 'disease', label: '疾病' }
]

// 颜色配置
const CATEGORY_COLORS = [
  '#2D5A3D', '#3B82F6', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#10B981', '#F97316'
]

Page({
  data: {
    statusBarHeight: 0,
    menuOpen: false,
    activeTab: 'dashboard',
    tabs: TABS,
    nodeTypes: NODE_TYPES,
    searchInput: '',
    showSearchHistory: false,
    searchHistory: [],
    todayQueries: 0,
    summary: {
      totalHerbs: 0,
      totalPeptides: 0,
      foodHomology: 0,
      graphNodes: 0
    },
    categoryData: [],
    recentUpdates: [],
    herbKeyword: '',
    herbCategory: '',
    herbFoodHomologyOnly: false,
    herbs: [],
    herbsLoading: false,
    herbsTotal: 0,
    herbsPage: 1,
    herbsPageSize: 20,
    herbsLoaded: 0,
    showCategoryPicker: false,
    herbCategories: HERB_CATEGORIES,
    peptideKeyword: '',
    peptideActivityType: '',
    peptides: [],
    peptidesLoading: false,
    peptidesTotal: 0,
    peptidesPage: 1,
    peptidesPageSize: 20,
    peptidesLoaded: 0,
    showActivityPicker: false,
    peptideActivityTypes: PEPTIDE_ACTIVITY_TYPES,
    homologyKeyword: '',
    homologyLoading: false,
    homologyResult: null,
    homologyList: [],
    homologyListLoading: false,
    graphKeyword: '',
    activeNodeType: '',
    graphLoading: false,
    graphResult: { nodes: [], edges: [], centerNode: '' }
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: systemInfo.statusBarHeight })
    this.loadSearchHistory()
    this.loadTodayQueries()
    this.loadDashboard()
  },

  onShow() {
    this.loadDashboard()
  },

  // ==================== 导航 ====================
  toggleMenu() {
    this.setData({ menuOpen: !this.data.menuOpen })
  },

  closeMenu() {
    this.setData({ menuOpen: false })
  },

  // ==================== Tab 切换 ====================
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    if (tab === 'herbs' && this.data.herbs.length === 0) {
      this.loadHerbs()
    } else if (tab === 'peptides' && this.data.peptides.length === 0) {
      this.loadPeptides()
    } else if (tab === 'homology' && this.data.homologyList.length === 0) {
      this.loadHomologyList()
    }
  },

  // ==================== 搜索 ====================
  onSearchInput(e) {
    this.setData({ searchInput: e.detail.value })
  },

  clearSearch() {
    this.setData({ searchInput: '', showSearchHistory: false })
  },

  globalSearch() {
    const query = this.data.searchInput.trim()
    if (!query) return
    this.saveSearchHistory(query)
    this.incrementTodayQueries()
    
    if (query.length > 2) {
      // 跳转到搜索页
      wx.navigateTo({ url: `/pages/search/index?keyword=${encodeURIComponent(query)}` })
    } else {
      wx.showToast({ title: `搜索: ${query}`, icon: 'none' })
    }
  },

  selectHistory(e) {
    const query = e.currentTarget.dataset.query
    this.setData({ searchInput: query })
    this.globalSearch()
  },

  clearSearchHistory() {
    wx.showModal({
      title: '清除历史',
      content: '确定要清除所有搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ searchHistory: [] })
          wx.removeStorageSync('search_history')
          wx.showToast({ title: '已清除', icon: 'success' })
        }
      }
    })
  },

  // ==================== Dashboard ====================
  async loadDashboard() {
    try {
      const [herbsRes, peptidesRes, homologyRes] = await Promise.allSettled([
        api.database.searchHerbs({ keyword: '', page: 1, pageSize: 1 }),
        api.database.searchPeptides({ keyword: '', page: 1, pageSize: 1 }),
        api.database.getFoodHomologyHerbs({ page: 1, pageSize: 1 })
      ])

      const totalHerbs = herbsRes.status === 'fulfilled' ? (herbsRes.value.total || 0) : 0
      const totalPeptides = peptidesRes.status === 'fulfilled' ? (peptidesRes.value.total || 0) : 0
      const foodHomology = homologyRes.status === 'fulfilled' ? (homologyRes.value.total || 0) : 0

      this.setData({
        summary: {
          totalHerbs,
          totalPeptides,
          foodHomology,
          graphNodes: totalHerbs + totalPeptides
        }
      })
    } catch (error) {
      console.error('[Database] 加载仪表盘失败:', error)
    }
  },

  // ==================== 中药材搜索 ====================
  async loadHerbs(append = false) {
    if (this.data.herbsLoading) return
    this.setData({ herbsLoading: true })
    try {
      const res = await api.database.searchHerbs({
        keyword: this.data.herbKeyword,
        category: this.data.herbCategory,
        foodHomologyOnly: this.data.herbFoodHomologyOnly,
        page: this.data.herbsPage,
        pageSize: this.data.herbsPageSize
      })
      const herbs = (res.items || []).map(h => ({
        id: h.id,
        name: h.name_cn || h.name,
        latin: h.name_latin,
        pinyin: h.name_pinyin,
        category: h.category,
        effects: h.effects,
        isFoodHomology: h.is_food_homology,
        obPercent: h.ob_percent,
        dlValue: h.dl_value,
        compoundCount: h.compound_count || 0,
        targetCount: h.target_count || 0
      }))
      this.setData({
        herbs: append ? [...this.data.herbs, ...herbs] : herbs,
        herbsTotal: res.total || 0,
        herbsPage: res.page || this.data.herbsPage,
        herbsLoaded: append ? this.data.herbsLoaded + herbs.length : herbs.length,
        herbsLoading: false
      })
    } catch (error) {
      console.error('[Database] 加载药材失败:', error)
      this.setData({ herbsLoading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onHerbSearch() {
    this.setData({ herbsPage: 1, herbs: [] })
    this.loadHerbs()
  },

  onHerbCategoryChange(e) {
    this.setData({ herbCategory: e.detail.value, herbsPage: 1, herbs: [] })
    this.loadHerbs()
  },

  onHerbFoodHomologyChange(e) {
    this.setData({ herbFoodHomologyOnly: e.detail.value, herbsPage: 1, herbs: [] })
    this.loadHerbs()
  },

  loadMoreHerbs() {
    if (!this.data.herbsLoading && this.data.herbsLoaded < this.data.herbsTotal) {
      this.setData({ herbsPage: this.data.herbsPage + 1 })
      this.loadHerbs(true)
    }
  },

  showHerbCategoryPicker() {
    wx.showActionSheet({
      itemList: this.data.herbCategories.map(c => c.label),
      success: (res) => {
        if (res.tapIndex < this.data.herbCategories.length) {
          const cat = this.data.herbCategories[res.tapIndex]
          this.setData({ herbCategory: cat.key, herbsPage: 1, herbs: [] })
          this.loadHerbs()
        }
      }
    })
  },

  // ==================== 活性肽搜索 ====================
  async loadPeptides(append = false) {
    if (this.data.peptidesLoading) return
    this.setData({ peptidesLoading: true })
    try {
      const res = await api.database.searchPeptides({
        keyword: this.data.peptideKeyword,
        activityType: this.data.peptideActivityType,
        page: this.data.peptidesPage,
        pageSize: this.data.peptidesPageSize
      })
      const peptides = (res.items || []).map(p => ({
        id: p.id,
        sequence: p.sequence,
        sourceProtein: p.source_protein,
        sourceOrganism: p.source_organism,
        activityType: p.activity_type,
        activityValue: p.activity_value,
        molecularWeight: p.molecular_weight
      }))
      this.setData({
        peptides: append ? [...this.data.peptides, ...peptides] : peptides,
        peptidesTotal: res.total || 0,
        peptidesPage: res.page || this.data.peptidesPage,
        peptidesLoaded: append ? this.data.peptidesLoaded + peptides.length : peptides.length,
        peptidesLoading: false
      })
    } catch (error) {
      console.error('[Database] 加载肽失败:', error)
      this.setData({ peptidesLoading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onPeptideSearch() {
    this.setData({ peptidesPage: 1, peptides: [] })
    this.loadPeptides()
  },

  loadMorePeptides() {
    if (!this.data.peptidesLoading && this.data.peptidesLoaded < this.data.peptidesTotal) {
      this.setData({ peptidesPage: this.data.peptidesPage + 1 })
      this.loadPeptides(true)
    }
  },

  showPeptideActivityPicker() {
    wx.showActionSheet({
      itemList: this.data.peptideActivityTypes.map(t => t.label),
      success: (res) => {
        if (res.tapIndex < this.data.peptideActivityTypes.length) {
          const type = this.data.peptideActivityTypes[res.tapIndex]
          this.setData({ peptideActivityType: type.key, peptidesPage: 1, peptides: [] })
          this.loadPeptides()
        }
      }
    })
  },

  // ==================== 药食同源 ====================
  async loadHomologyList(append = false) {
    if (this.data.homologyListLoading) return
    this.setData({ homologyListLoading: true })
    try {
      const res = await api.database.getFoodHomologyHerbs({
        keyword: this.data.homologyKeyword,
        page: 1,
        pageSize: 20
      })
      const items = (res.items || []).map(h => ({
        id: h.id,
        name: h.name_cn,
        latin: h.name_latin,
        category: h.category,
        effects: h.effects,
        isFoodHomology: h.is_food_homology
      }))
      this.setData({
        homologyList: append ? [...this.data.homologyList, ...items] : items,
        homologyListLoading: false
      })
    } catch (error) {
      console.error('[Database] 加载药食同源失败:', error)
      this.setData({ homologyListLoading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onHomologySearch() {
    this.setData({ homologyList: [] })
    this.loadHomologyList()
  },

  checkHomology(e) {
    const herbName = e.detail.value.trim()
    if (!herbName) {
      wx.showToast({ title: '请输入药材名称', icon: 'none' })
      return
    }
    this.setData({ homologyLoading: true })
    api.database.checkFoodHomology(herbName)
      .then(res => {
        this.setData({ homologyResult: res, homologyLoading: false })
      })
      .catch(() => {
        this.setData({ homologyLoading: false })
        wx.showToast({ title: '查询失败', icon: 'none' })
      })
  },

  // ==================== 知识图谱 ====================
  searchGraph() {
    const keyword = this.data.graphKeyword.trim()
    if (!keyword) {
      wx.showToast({ title: '请输入药材名称', icon: 'none' })
      return
    }
    this.setData({ graphLoading: true })
    api.database.getHerbCompoundTargets(keyword)
      .then(res => {
        this.setData({ graphResult: res, graphLoading: false })
      })
      .catch(() => {
        this.setData({ graphLoading: false })
        wx.showToast({ title: '查询失败', icon: 'none' })
      })
  },

  // ==================== 历史记录 ====================
  loadSearchHistory() {
    try {
      const history = wx.getStorageSync('search_history') || []
      this.setData({ searchHistory: history })
    } catch (e) {
      this.setData({ searchHistory: [] })
    }
  },

  saveSearchHistory(query) {
    try {
      const history = wx.getStorageSync('search_history') || []
      const index = history.indexOf(query)
      if (index > -1) history.splice(index, 1)
      history.unshift(query)
      if (history.length > 20) history.pop()
      wx.setStorageSync('search_history', history)
      this.setData({ searchHistory: history })
    } catch (e) {
      console.error('保存搜索历史失败:', e)
    }
  },

  incrementTodayQueries() {
    const today = new Date().toDateString()
    const lastDate = wx.getStorageSync('last_query_date') || ''
    if (lastDate !== today) {
      wx.setStorageSync('today_queries', 1)
      wx.setStorageSync('last_query_date', today)
    } else {
      const count = wx.getStorageSync('today_queries') || 0
      wx.setStorageSync('today_queries', count + 1)
    }
    this.setData({ todayQueries: wx.getStorageSync('today_queries') || 0 })
  },

  loadTodayQueries() {
    const today = new Date().toDateString()
    const lastDate = wx.getStorageSync('last_query_date') || ''
    if (lastDate !== today) {
      wx.setStorageSync('today_queries', 0)
      wx.setStorageSync('last_query_date', today)
    }
    this.setData({ todayQueries: wx.getStorageSync('today_queries') || 0 })
  },

  // ==================== 工具方法 ====================
  getCategoryColor(index) {
    return CATEGORY_COLORS[index % CATEGORY_COLORS.length]
  },

  getIngredientTag(item) {
    if (item.isFoodHomology) return { text: '药食同源', color: '#2D5A3D' }
    return { text: '中药材', color: '#3B82F6' }
  },

  // ==================== 详情跳转 ====================
  viewHerbDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/database/herb-detail/index?id=${id}` })
  },

  viewPeptideDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/database/peptide-detail/index?id=${id}` })
  },

  viewHomologyDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/database/herb-detail/index?id=${id}&type=homology` })
  },

  viewGraphNode(e) {
    const id = e.currentTarget.dataset.id
    const type = e.currentTarget.dataset.type
    wx.navigateTo({ url: `/pages/database/herb-detail/index?id=${id}&type=${type}` })
  },

  // ==================== 下拉刷新 ====================
  onPullRefresh() {
    this.loadDashboard()
    this.setData({ refreshing: false })
  },

  // ==================== 分享 ====================
  onShareAppMessage() {
    return {
      title: 'RMFOOD - 药食同源数据库',
      path: '/pages/database/index'
    }
  }
})

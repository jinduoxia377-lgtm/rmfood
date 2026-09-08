/**
 * 数据检索中心 - 逻辑层
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

const NODE_TYPES = [
  { key: '', label: '全部' },
  { key: 'herb', label: '药材' },
  { key: 'compound', label: '化合物' },
  { key: 'target', label: '靶点' },
  { key: 'disease', label: '疾病' }
]

const NODE_TYPE_LABELS = {
  herb: '药材',
  compound: '化合物',
  target: '靶点',
  disease: '疾病'
}

// 药材分类颜色
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
    nodeTypeLabels: NODE_TYPE_LABELS,
    // 搜索
    searchInput: '',
    showSearchHistory: false,
    searchHistory: [],
    todayQueries: 0,
    // 概览
    summary: {
      totalHerbs: 0,
      totalPeptides: 0,
      foodHomology: 0,
      graphNodes: 0
    },
    categoryData: [],
    recentUpdates: [],
    // 中药材
    herbKeyword: '',
    herbCategory: '',
    herbFoodHomologyOnly: false,
    herbs: [],
    herbsLoading: false,
    herbsTotal: 0,
    herbsPage: 1,
    herbsPageSize: 20,
    herbsLoaded: 0,
    // 活性肽
    peptideKeyword: '',
    peptideActivityType: '',
    peptides: [],
    peptidesLoading: false,
    peptidesTotal: 0,
    peptidesPage: 1,
    peptidesPageSize: 20,
    peptidesLoaded: 0,
    activityTypes: [],
    // 药食同源
    homologyKeyword: '',
    homologyLoading: false,
    homologyResult: null,
    homologyList: [],
    homologyListLoading: false,
    // 知识图谱
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

  // ========== 导航 ==========
  toggleMenu() {
    this.setData({ menuOpen: !this.data.menuOpen })
  },

  // ========== Tab 切换 ==========
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    // 懒加载数据
    if (tab === 'herbs' && this.data.herbs.length === 0) {
      this.loadHerbs()
    } else if (tab === 'peptides' && this.data.peptides.length === 0) {
      this.loadPeptides()
    } else if (tab === 'homology' && this.data.homologyList.length === 0) {
      this.loadHomologyList()
    }
  },

  // ========== 搜索 ==========
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
    // 根据关键词跳转到相应tab
    if (query.length > 2) {
      this.setData({ searchInput: '' })
      wx.showToast({ title: `搜索: ${query}`, icon: 'none' })
    }
  },

  selectHistory(e) {
    const query = e.currentTarget.dataset.query
    this.setData({ searchInput: query })
    this.globalSearch()
  },

  showSearchHistory() {
    this.setData({ showSearchHistory: true })
  },

  loadSearchHistory() {
    api.database.getSearchHistory().then(res => {
      this.setData({ searchHistory: res.history || [] })
    }).catch(() => {})
  },

  saveSearchHistory(query) {
    api.database.saveSearchHistory(query).then(res => {
      this.setData({ searchHistory: res.history || [] })
    }).catch(() => {})
  },

  clearHistory() {
    api.database.clearSearchHistory().then(res => {
      this.setData({ searchHistory: [] })
    }).catch(() => {})
  },

  loadTodayQueries() {
    const today = new Date().toDateString()
    const stored = wx.getStorageSync('rmfood_today_queries') || { date: today, count: 0 }
    if (stored.date !== today) {
      wx.setStorageSync('rmfood_today_queries', { date: today, count: 0 })
      this.setData({ todayQueries: 0 })
    } else {
      this.setData({ todayQueries: stored.count })
    }
  },

  incrementTodayQueries() {
    const today = new Date().toDateString()
    const stored = wx.getStorageSync('rmfood_today_queries') || { date: today, count: 0 }
    stored.count++
    wx.setStorageSync('rmfood_today_queries', stored)
    this.setData({ todayQueries: stored.count })
  },

  // ========== 概览 ==========
  loadDashboard() {
    Promise.all([
      api.database.getHerbCategories(),
      api.database.getActivityTypes(),
      api.database.getCompoundStats()
    ]).then(([catRes, actRes, compRes]) => {
      const categories = (catRes.categories || []).slice(0, 8)
      const categoryData = categories.map((cat, i) => ({
        name: cat.category,
        value: cat.count,
        fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        percent: Math.round((cat.count / catRes.total) * 100) || 0,
        foodHomology: cat.food_homology_count || 0
      }))

      this.setData({
        'summary.totalHerbs': catRes.total || 0,
        'summary.foodHomology': catRes.total_food_homology || 0,
        'summary.graphNodes': compRes.total_compounds || 0,
        categoryData
      })
    }).catch(() => {})
  },

  onPullRefresh() {
    this.loadDashboard()
    wx.stopPullDownRefresh()
  },

  // ========== 中药材 ==========
  onHerbSearch(e) {
    this.setData({ herbKeyword: e.detail.value })
  },

  showCategoryPicker() {
    wx.showActionSheet({
      itemList: ['全部分类', '解表药', '清热药', '泻下药', '祛风湿药', '化湿药', '利水渗湿药', '温里药', '理气药', '消食药', '驱虫药', '止血药', '活血化瘀药', '化痰止咳药', '安神药', '平肝息风药', '开窍药', '补虚药', '安神药'],
      success: (res) => {
        const categories = ['', '解表药', '清热药', '泻下药', '祛风湿药', '化湿药', '利水渗湿药', '温里药', '理气药', '消食药', '驱虫药', '止血药', '活血化瘀药', '化痰止咳药', '安神药', '平肝息风药', '开窍药', '补虚药']
        if (res.tapIndex > 0) {
          this.setData({ herbCategory: categories[res.tapIndex - 1] })
        } else {
          this.setData({ herbCategory: '' })
        }
        this.loadHerbs()
      }
    })
  },

  toggleFoodHomology() {
    this.setData({ herbFoodHomologyOnly: !this.data.herbFoodHomologyOnly })
    this.loadHerbs()
  },

  searchHerbs() {
    this.loadHerbs()
  },

  loadHerbs(reset = true) {
    if (reset) {
      this.setData({ herbsPage: 1, herbs: [], herbsLoaded: 0 })
    }
    this.setData({ herbsLoading: true })

    api.database.searchHerbs({
      keyword: this.data.herbKeyword,
      category: this.data.herbCategory,
      foodHomologyOnly: this.data.herbFoodHomologyOnly,
      page: this.data.herbsPage,
      pageSize: this.data.herbsPageSize
    }).then(res => {
      const items = res.items || res.data || []
      const total = res.total || 0
      const newHerbs = reset ? items : [...this.data.herbs, ...items]
      this.setData({
        herbs: newHerbs,
        herbsTotal: total,
        herbsLoaded: newHerbs.length,
        herbsPage: this.data.herbsPage + 1,
        herbsLoading: false
      })
    }).catch(() => {
      this.setData({ herbsLoading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  loadMoreHerbs() {
    this.loadHerbs(false)
  },

  viewHerbDetail(e) {
    const herb = e.currentTarget.dataset.herb
    wx.navigateTo({
      url: `/pages/database/herb-detail/index?id=${herb.id}&name=${encodeURIComponent(herb.name_cn)}`
    })
  },

  // ========== 活性肽 ==========
  onPeptideSearch(e) {
    this.setData({ peptideKeyword: e.detail.value })
  },

  showActivityTypePicker() {
    api.database.getActivityTypes().then(res => {
      const types = (res.activity_types || []).map(t => t.type_cn || t.type_en)
      wx.showActionSheet({
        itemList: ['全部类型', ...types.slice(0, 8)],
        success: (r) => {
          if (r.tapIndex > 0) {
            this.setData({ peptideActivityType: types[r.tapIndex - 1] })
          } else {
            this.setData({ peptideActivityType: '' })
          }
          this.loadPeptides()
        }
      })
    }).catch(() => {})
  },

  searchPeptides() {
    this.loadPeptides()
  },

  loadPeptides(reset = true) {
    if (reset) {
      this.setData({ peptidesPage: 1, peptides: [], peptidesLoaded: 0 })
    }
    this.setData({ peptidesLoading: true })

    api.database.searchPeptides({
      keyword: this.data.peptideKeyword,
      activityType: this.data.peptideActivityType,
      page: this.data.peptidesPage,
      pageSize: this.data.peptidesPageSize
    }).then(res => {
      const items = res.items || res.data || []
      const total = res.total || 0
      const newPeptides = reset ? items : [...this.data.peptides, ...items]
      this.setData({
        peptides: newPeptides,
        peptidesTotal: total,
        peptidesLoaded: newPeptides.length,
        peptidesPage: this.data.peptidesPage + 1,
        peptidesLoading: false
      })
    }).catch(() => {
      this.setData({ peptidesLoading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  loadMorePeptides() {
    this.loadPeptides(false)
  },

  viewPeptideDetail(e) {
    const peptide = e.currentTarget.dataset.peptide
    wx.navigateTo({
      url: `/pages/database/peptide-detail/index?id=${peptide.id}`
    })
  },

  // ========== 药食同源 ==========
  onHomologySearch(e) {
    this.setData({ homologyKeyword: e.detail.value })
  },

  checkHomology() {
    const name = this.data.homologyKeyword.trim()
    if (!name) {
      wx.showToast({ title: '请输入药材名称', icon: 'none' })
      return
    }
    this.setData({ homologyLoading: true })
    api.database.checkFoodHomology(name).then(res => {
      this.setData({ homologyResult: res, homologyLoading: false })
    }).catch(() => {
      this.setData({ homologyLoading: false })
      wx.showToast({ title: '查询失败', icon: 'none' })
    })
  },

  loadHomologyList() {
    this.setData({ homologyListLoading: true })
    api.database.getFoodHomologyHerbs({ pageSize: 100 }).then(res => {
      const items = res.items || res.data || []
      this.setData({
        homologyList: items.slice(0, 50),
        homologyListLoading: false
      })
    }).catch(() => {
      this.setData({ homologyListLoading: false })
    })
  },

  viewHomologyDetail(e) {
    const item = e.currentTarget.dataset.item
    wx.showActionSheet({
      itemList: ['查看详情', '添加到配方', '分享'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 查看详情
        } else if (res.tapIndex === 1) {
          // 添加到配方
          wx.setStorageSync('rmfood_homology_temp', item)
          wx.showToast({ title: '已添加', icon: 'success' })
        }
      }
    })
  },

  // ========== 知识图谱 ==========
  onGraphSearch(e) {
    this.setData({ graphKeyword: e.detail.value })
  },

  setNodeType(e) {
    this.setData({ activeNodeType: e.currentTarget.dataset.type })
  },

  searchGraph() {
    const keyword = this.data.graphKeyword.trim()
    if (!keyword) {
      wx.showToast({ title: '请输入药材名', icon: 'none' })
      return
    }
    this.setData({ graphLoading: true })
    api.database.getHerbCompoundTargets(keyword).then(res => {
      this.setData({
        graphResult: res,
        graphLoading: false
      })
    }).catch(() => {
      this.setData({ graphLoading: false })
      wx.showToast({ title: '查询失败', icon: 'none' })
    })
  },

  viewGraphNode(e) {
    const node = e.currentTarget.dataset.node
    wx.showToast({ title: node.label, icon: 'none' })
  },

  // ========== 详情页导航 ==========
  viewDetail(e) {
    const type = e.currentTarget.dataset.type
    const id = e.currentTarget.dataset.id
    if (type === 'herb') {
      wx.navigateTo({ url: `/pages/database/herb-detail/index?id=${id}` })
    }
  }
})

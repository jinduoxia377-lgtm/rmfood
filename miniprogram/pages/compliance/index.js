/**
 * 合规标准 - 逻辑层
 */

const api = require('../../utils/api.js')

// Tab 配置
const TABS = [
  { key: 'standards', label: '国家标准', icon: '📋' },
  { key: 'gb2760', label: 'GB 2760', icon: '🧪' },
  { key: 'gb14880', label: 'GB 14880', icon: '💊' },
  { key: 'homology', label: '药食同源', icon: '⭐' },
  { key: 'prohibited', label: '禁忌搭配', icon: '⚠️' },
  { key: 'check', label: '合规检查', icon: '✅' }
]

const POPULATIONS = [
  { key: 'adults', label: '成人' },
  { key: 'children', label: '儿童' },
  { key: 'elderly', label: '老年人' }
]

const VIOLATION_TYPE_LABELS = {
  exceeds_limit: '超限量',
  prohibited_combo: '禁忌搭配',
  child_forbidden: '儿童禁忌',
  not_in_directory: '非目录',
  gb2760: 'GB 2760',
  gb14880: 'GB 14880',
  prohibited_tcm: '禁用品'
}

// 评分颜色
const SCORE_COLORS = {
  90: '#22C55E',
  80: '#84CC16',
  70: '#EAB308',
  60: '#F97316',
  50: '#EF4444',
  0: '#DC2626'
}

Page({
  data: {
    statusBarHeight: 0,
    menuOpen: false,
    activeTab: 'standards',
    tabs: TABS,
    refreshing: false,
    // 国家标准
    standardSearch: '',
    standardCategory: '',
    standardsCount: 0,
    standardsLoading: false,
    standards: [],
    // GB 2760
    gb2760Search: '',
    gb2760Function: '',
    gb2760Loading: false,
    gb2760Additives: [],
    gb2760Count: 0,
    gb2760Sort: { field: 'name', dir: 'asc' },
    // GB 14880
    gb14880Search: '',
    gb14880Loading: false,
    gb14880Enrichers: [],
    gb14880Count: 0,
    gb14880Sort: { field: 'name', dir: 'asc' },
    // 药食同源
    homologySearch: '',
    homologyList: [],
    homologyListLoading: false,
    homologyCount: 0,
    homologySort: { field: 'name', dir: 'asc' },
    // 禁忌搭配
    prohibitedSearch: '',
    prohibitedPairs: [],
    prohibitedLoading: false,
    gbProhibitedItems: [],
    gbProhibitedLoading: false,
    // 合规检查
    population: 'adults',
    populations: POPULATIONS,
    ingredients: [{ name: '', dosage_mg: '' }],
    checkResult: null,
    checking: false,
    violationTypeLabels: VIOLATION_TYPE_LABELS,
    // 详情弹窗
    detailModal: null
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: systemInfo.statusBarHeight })
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  // ========== 导航 ==========
  toggleMenu() {
    this.setData({ menuOpen: !this.data.menuOpen })
  },

  refreshData() {
    this.loadData()
    wx.showToast({ title: '刷新成功', icon: 'success' })
  },

  loadData() {
    Promise.all([
      this.loadStandards(),
      this.loadGB2760(),
      this.loadGB14880(),
      this.loadHomologyList(),
      this.loadProhibited(),
      this.loadGBProhibited()
    ]).catch(() => {})
  },

  onPullRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // ========== Tab 切换 ==========
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    // 懒加载
    if (tab === 'check' && !this.data.checkResult) {
      // 无需预加载
    }
  },

  // ========== 国家标准 ==========
  onStandardSearch(e) {
    this.setData({ standardSearch: e.detail.value })
  },

  showCategoryPicker() {
    wx.showActionSheet({
      itemList: ['全部分类', '食品添加剂', '农药残留', '污染物限量', '微生物控制', '乳制品', '饮料', '调味品', '油脂', '婴幼儿食品', '冷冻食品', '蛋白质类', '食品接触材料', '兽药残留'],
      success: (res) => {
        const categories = ['', '食品添加剂', '农药残留', '污染物限量', '微生物控制', '乳制品', '饮料', '调味品', '油脂', '婴幼儿食品', '冷冻食品', '蛋白质类', '食品接触材料', '兽药残留']
        if (res.tapIndex > 0) {
          this.setData({ standardCategory: categories[res.tapIndex] })
        } else {
          this.setData({ standardCategory: '' })
        }
        this.filterStandards()
      }
    })
  },

  filterStandards() {
    this.loadStandards()
  },

  async loadStandards() {
    this.setData({ standardsLoading: true })
    try {
      const res = await api.compliance.getStandards(this.data.standardCategory)
      const items = res.data?.standards || []
      this.setData({
        standards: items,
        standardsCount: res.data?.count || items.length,
        standardsLoading: false
      })
    } catch (e) {
      this.setData({ standardsLoading: false })
    }
  },

  viewStandardDetail(e) {
    const item = e.currentTarget.dataset.item
    const type = e.currentTarget.dataset.type
    this.showDetailModal({ type, item, title: `${item.standard_code} · ${item.title}` })
  },

  // ========== GB 2760 ==========
  onGb2760Search(e) {
    this.setData({ gb2760Search: e.detail.value })
  },

  showGb2760FunctionPicker() {
    wx.showActionSheet({
      itemList: ['全部功能', '着色剂', '漂白剂', '防腐剂', '抗氧化剂', '甜味剂', '增稠剂', '乳化剂', '酸度调节剂', '膨松剂', '香料', '营养强化剂'],
      success: (res) => {
        const functions = ['', '着色剂', '漂白剂', '防腐剂', '抗氧化剂', '甜味剂', '增稠剂', '乳化剂', '酸度调节剂', '膨松剂', '香料', '营养强化剂']
        if (res.tapIndex > 0) {
          this.setData({ gb2760Function: functions[res.tapIndex] })
        } else {
          this.setData({ gb2760Function: '' })
        }
        this.filterGb2760()
      }
    })
  },

  filterGb2760() {
    this.loadGB2760()
  },

  async loadGB2760() {
    this.setData({ gb2760Loading: true })
    try {
      const res = await api.compliance.getGB2760({
        keyword: this.data.gb2760Search,
        function: this.data.gb2760Function
      })
      const items = res.data?.additives || []
      this.setData({
        gb2760Additives: items,
        gb2760Count: items.length,
        gb2760Loading: false
      })
    } catch (e) {
      this.setData({ gb2760Loading: false })
    }
  },

  setGb2760Sort(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      gb2760Sort: {
        field,
        dir: this.data.gb2760Sort.field === field && this.data.gb2760Sort.dir === 'asc' ? 'desc' : 'asc'
      }
    })
  },

  get sortedGb2760() {
    const { gb2760Additives, gb2760Sort } = this.data
    return [...gb2760Additives].sort((a, b) => {
      const av = gb2760Sort.field === 'name' ? a.name : a.max_usage
      const bv = gb2760Sort.field === 'name' ? b.name : b.max_usage
      const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0
      return gb2760Sort.dir === 'asc' ? cmp : -cmp
    })
  },

  viewGb2760Detail(e) {
    const item = e.currentTarget.dataset.item
    this.showDetailModal({ type: 'gb2760', item, title: `${item.name} — GB 2760 详情` })
  },

  // ========== GB 14880 ==========
  onGb14880Search(e) {
    this.setData({ gb14880Search: e.detail.value })
  },

  filterGb14880() {
    this.loadGB14880()
  },

  async loadGB14880() {
    this.setData({ gb14880Loading: true })
    try {
      const res = await api.compliance.getGB14880({ keyword: this.data.gb14880Search })
      const items = res.data?.enrichers || []
      this.setData({
        gb14880Enrichers: items,
        gb14880Count: items.length,
        gb14880Loading: false
      })
    } catch (e) {
      this.setData({ gb14880Loading: false })
    }
  },

  setGb14880Sort(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      gb14880Sort: {
        field,
        dir: this.data.gb14880Sort.field === field && this.data.gb14880Sort.dir === 'asc' ? 'desc' : 'asc'
      }
    })
  },

  get sortedGb14880() {
    const { gb14880Enrichers, gb14880Sort } = this.data
    return [...gb14880Enrichers].sort((a, b) => {
      const av = gb14880Sort.field === 'name' ? a.name : gb14880Sort.field === 'min' ? a.min : a.max
      const bv = gb14880Sort.field === 'name' ? b.name : gb14880Sort.field === 'min' ? b.min : b.max
      const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0
      return gb14880Sort.dir === 'asc' ? cmp : -cmp
    })
  },

  viewGb14880Detail(e) {
    const item = e.currentTarget.dataset.item
    this.showDetailModal({ type: 'gb14880', item, title: `${item.name} — GB 14880 详情` })
  },

  // ========== 药食同源 ==========
  onHomologySearch(e) {
    this.setData({ homologySearch: e.detail.value })
  },

  searchHomology() {
    this.loadHomologyList()
  },

  setHomologySort(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      homologySort: {
        field,
        dir: this.data.homologySort.field === field && this.data.homologySort.dir === 'asc' ? 'desc' : 'asc'
      }
    })
  },

  get sortedHomology() {
    const { homologyList, homologySort } = this.data
    return [...homologyList].sort((a, b) => {
      const av = homologySort.field === 'name' ? a.name : String(a.max_dosage || '')
      const bv = homologySort.field === 'name' ? b.name : String(b.max_dosage || '')
      const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0
      return homologySort.dir === 'asc' ? cmp : -cmp
    })
  },

  async loadHomologyList() {
    this.setData({ homologyListLoading: true })
    try {
      const res = await api.compliance.getFoodHomology(this.data.homologySearch)
      const items = res.data?.materials || []
      this.setData({
        homologyList: items,
        homologyCount: items.length,
        homologyListLoading: false
      })
    } catch (e) {
      this.setData({ homologyListLoading: false })
    }
  },

  viewHomologyDetail(e) {
    const item = e.currentTarget.dataset.item
    wx.showActionSheet({
      itemList: ['查看详情', '添加到配方', '分享'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: "/pages/compliance/homology-detail/index?name=+encodeURIComponent(item.name)+" })
        } else if (res.tapIndex === 1) {
          wx.setStorageSync('rmfood_homology_temp', item)
          wx.showToast({ title: '已添加', icon: 'success' })
        }
      }
    })
  },

  // ========== 禁忌搭配 ==========
  onProhibitedSearch(e) {
    this.setData({ prohibitedSearch: e.detail.value })
  },

  filterProhibited() {
    this.loadProhibited()
  },

  async loadProhibited() {
    this.setData({ prohibitedLoading: true })
    try {
      const res = await api.compliance.getProhibited()
      const items = res.data?.combinations || []
      this.setData({
        prohibitedPairs: items,
        prohibitedLoading: false
      })
    } catch (e) {
      this.setData({ prohibitedLoading: false })
    }
  },

  async loadGBProhibited() {
    this.setData({ gbProhibitedLoading: true })
    try {
      const res = await api.compliance.getGBProhibited()
      const items = res.data?.items || []
      this.setData({
        gbProhibitedItems: items,
        gbProhibitedLoading: false
      })
    } catch (e) {
      this.setData({ gbProhibitedLoading: false })
    }
  },

  viewProhibitedDetail(e) {
    const item = e.currentTarget.dataset.item
    this.showDetailModal({ type: 'prohibited', item, title: `${item.name} — 禁用物质` })
  },

  get filteredProhibited() {
    const { prohibitedPairs, prohibitedSearch } = this.data
    if (!prohibitedSearch) return prohibitedPairs
    return prohibitedPairs.filter(p =>
      p.pair.some(n => n.includes(prohibitedSearch))
    )
  },

  // ========== 合规检查 ==========
  setPopulation(e) {
    this.setData({ population: e.currentTarget.dataset.pop })
  },

  addIngredient() {
    const ingredients = [...this.data.ingredients, { name: '', dosage_mg: '' }]
    this.setData({ ingredients })
  },

  removeIngredient(e) {
    const idx = e.currentTarget.dataset.index
    const ingredients = this.data.ingredients.filter((_, i) => i !== idx)
    this.setData({ ingredients })
  },

  onIngredientNameChange(e) {
    const idx = e.currentTarget.dataset.index
    const ingredients = [...this.data.ingredients]
    ingredients[idx].name = e.detail.value
    this.setData({ ingredients })
  },

  onIngredientDosageChange(e) {
    const idx = e.currentTarget.dataset.index
    const ingredients = [...this.data.ingredients]
    ingredients[idx].dosage_mg = e.detail.value
    this.setData({ ingredients })
  },

  async performCheck() {
    const { ingredients, population } = this.data
    const validIngredients = ingredients.filter(i => i.name.trim())
    if (validIngredients.length === 0) {
      wx.showToast({ title: '请添加成分', icon: 'none' })
      return
    }
    this.setData({ checking: true })
    try {
      const res = await api.compliance.realtimeCheck(validIngredients, { population })
      const result = res.data
      this.setData({ checkResult: result, checking: false })
    } catch (e) {
      this.setData({ checking: false })
      wx.showToast({ title: '检查失败', icon: 'none' })
    }
  },

  async autoFixFormula() {
    const { ingredients, population } = this.data
    const validIngredients = ingredients.filter(i => i.name.trim())
    wx.showLoading({ title: '正在修复...' })
    try {
      const res = await api.compliance.autoFix(validIngredients, population)
      wx.hideLoading()
      wx.showModal({
        title: '自动修复结果',
        content: `原评分: ${res.data.original_score}\n修复后: ${res.data.fixed_score}\n修复了 ${res.data.fixes.length} 个成分`,
        showCancel: false
      })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '修复失败', icon: 'none' })
    }
  },

  saveCheckRecord() {
    const { checkResult, ingredients, population } = this.data
    if (!checkResult) return
    wx.showLoading({ title: '保存中...' })
    api.compliance.saveCheckRecord({
      ingredients: ingredients.filter(i => i.name.trim()),
      population,
      score: checkResult.score,
      status: checkResult.status,
      violations: checkResult.violations
    }).then(() => {
      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    })
  },

  getScoreColor(score) {
    if (score >= 90) return '#22C55E'
    if (score >= 80) return '#84CC16'
    if (score >= 70) return '#EAB308'
    if (score >= 60) return '#F97316'
    return '#EF4444'
  },

  // ========== 详情弹窗 ==========
  showDetailModal({ type, item, title }) {
    this.setData({ detailModal: { type, item, title } })
  },

  closeDetailModal() {
    this.setData({ detailModal: null })
  },

  getModalHeaderBg() {
    const { type } = this.data.detailModal || {}
    if (type === 'standard') return 'linear-gradient(135deg, #2D5A3D, #4A7C5C)'
    if (type === 'gb2760') return 'linear-gradient(135deg, #3B82F6, #1D4ED8)'
    if (type === 'gb14880') return 'linear-gradient(135deg, #8B5CF6, #6D28D9)'
    return 'linear-gradient(135deg, #EF4444, #DC2626)'
  },

  openLink(e) {
    const url = e.currentTarget.dataset.url
    if (url) {
      wx.openUrl({ url })
    }
  },

  get filteredStandards() {
    const { standards, standardSearch, standardCategory } = this.data
    return standards.filter(s => {
      const matchSearch = !standardSearch ||
        s.standard_code.toLowerCase().includes(standardSearch.toLowerCase()) ||
        s.title.includes(standardSearch)
      const matchCategory = !standardCategory || standardCategory === '全部' || s.category === standardCategory
      return matchSearch && matchCategory
    })
  }
})

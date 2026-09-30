/**
 * Herb Detail Page Logic
 */
const api = require('../../../utils/api.js')

Page({
  data: {
    herb: null,
    loading: true,
    statusBarHeight: 0,
    safeAreaBottom: 0,
    isFoodHomology: false,
    compounds: [],
    targets: [],
    diseases: [],
    graphResult: { nodes: [], edges: [] },
    showingGraph: false,
    safetyInfo: {
      toxicity: 'Low',
      contraindications: [],
      precautions: []
    }
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      safeAreaBottom: systemInfo.safeArea?.bottom || 0
    })
    const id = options.id
    if (id) {
      this.loadHerb(id)
    } else {
      wx.showToast({ title: 'Invalid Herb ID', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  onShow() {
    // Refresh when page shows
  },

  async loadHerb(id) {
    this.setData({ loading: true, herb: null })
    try {
      const res = await api.database.getHerb(id)
      if (res) {
        const herb = this.transformHerb(res)
        this.setData({ 
          herb,
          isFoodHomology: herb.isFoodHomology,
          loading: false 
        })
        if (herb.compoundCount > 0) {
          this.loadCompounds(id)
        }
        this.loadKnowledgeGraph(herb.name)
      } else {
        throw new Error('Herb not found')
      }
    } catch (error) {
      console.error('[HerbDetail] Load failed:', error)
      this.setData({
        herb: this.getMockHerb(id),
        loading: false
      })
    }
  },

  transformHerb(data) {
    return {
      id: data.id,
      name: data.name_cn || data.name,
      latinName: data.name_latin || '',
      pinyin: data.name_pinyin || '',
      category: data.category || 'Uncategorized',
      nature: data.nature_cn || 'Neutral',
      flavor: data.flavor_cn || '',
      meridians: data.meridians_cn || '',
      effects: data.effects || '',
      function: data.function_cn || '',
      isFoodHomology: data.is_food_homology || false,
      obPercent: data.ob_percent || 0,
      dlValue: data.dl_value || 0,
      tcmspId: data.tcmsp_id || '',
      compoundCount: data.compound_count || 0,
      targetCount: data.target_count || 0,
      compounds: (data.compounds || []).map(c => ({
        id: c.mol_id,
        name: c.name,
        mw: c.mw,
        ob: c.ob,
        dl: c.dl,
        alogp: c.alogp
      })),
      targets: (data.targets || []),
      diseases: (data.diseases || [])
    }
  },

  async loadCompounds(herbId) {
    try {
      const res = await api.database.searchCompounds({
        keyword: '',
        minOb: 0,
        maxOb: 100,
        page: 1,
        pageSize: 50
      })
      const compounds = (res.items || []).filter(c => 
        c.herbs?.includes(herbId) || c.herb_id === herbId
      ).slice(0, 20)
      this.setData({ compounds })
    } catch (error) {
      console.error('[HerbDetail] Load compounds failed:', error)
    }
  },

  async loadKnowledgeGraph(herbName) {
    try {
      const res = await api.database.getHerbCompoundTargets(herbName)
      this.setData({ 
        graphResult: res,
        showingGraph: true 
      })
    } catch (error) {
      console.error('[HerbDetail] Load knowledge graph failed:', error)
    }
  },

  copyHerbInfo() {
    const herb = this.data.herb
    if (!herb) return
    let content = `${herb.name}\n`
    content += `Latin: ${herb.latinName}\n`
    content += `Nature: ${herb.nature} ${herb.flavor}\n`
    content += `Meridians: ${herb.meridians}\n`
    content += `Function: ${herb.function}\n`
    if (herb.isFoodHomology) {
      content += '\n[Medicine Food Homology Herb]\n'
    }
    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({ title: 'Copied', icon: 'success' })
      }
    })
  },

  searchRelated() {
    const herb = this.data.herb
    if (herb) {
      wx.navigateTo({
        url: `/pages/search/index?keyword=${herb.name}&type=herb`
      })
    }
  },

  viewCompound(e) {
    const index = e.currentTarget.dataset.index
    const compound = this.data.compounds[index]
    if (compound) {
      wx.showToast({
        title: compound.name,
        icon: 'none'
      })
    }
  },

  getNatureColor(nature) {
    const colors = {
      'Cold': '#00BFFF',
      'Cool': '#87CEEB',
      'Neutral': '#90EE90',
      'Warm': '#FFA500',
      'Hot': '#FF4500'
    }
    return colors[nature] || '#90EE90'
  },

  getScoreColor(score) {
    if (!score) return '#9E9E9E'
    const s = parseInt(score)
    if (s >= 80) return '#07c160'
    if (s >= 60) return '#ff976a'
    if (s >= 40) return '#FFC107'
    return '#F44336'
  },

  getNatureClass(nature) {
    const map = { 'Cold': 'han', 'Cool': 'liang', 'Neutral': 'ping', 'Warm': 'wen', 'Hot': 're' }
    return map[nature] || 'ping'
  },

  goBack() {
    wx.navigateBack()
  },

  viewAllCompounds() {
    const herb = this.data.herb
    if (herb) {
      wx.navigateTo({
        url: `/pages/database/herb-detail/index?id=${herb.id}&showAll=true`
      })
    }
  },

  onShareAppMessage() {
    const herb = this.data.herb
    if (!herb) return {}
    return {
      title: `${herb.name} - Medicine Food Homology Herb`,
      path: `/pages/database/herb-detail/index?id=${herb.id}`,
      imageUrl: ''
    }
  },

  getMockHerb(id) {
    const herbs = {
      229: {
        id: 229,
        name: 'Ejiao',
        latinName: 'Asini Corii Colla',
        pinyin: 'Ejiao',
        category: 'Tonifying Herb',
        nature: 'Neutral',
        flavor: 'Sweet',
        meridians: 'Lung, Liver, Kidney',
        effects: 'Nourishes blood and yin, moistens dryness and stops bleeding',
        function: 'Used for blood deficiency, dizziness, palpitations, restlessness, insomnia',
        isFoodHomology: true,
        obPercent: 1.85,
        dlValue: 0.52,
        compoundCount: 0,
        targetCount: 0,
        compounds: [],
        targets: [],
        diseases: []
      },
      1: {
        id: 1,
        name: 'Gouqi',
        latinName: 'Lycii Fructus',
        pinyin: 'Gouqizi',
        category: 'Tonifying Herb',
        nature: 'Neutral',
        flavor: 'Sweet',
        meridians: 'Liver, Kidney',
        effects: 'Nourishes liver and kidney, benefits essence and brightens eyes',
        function: 'Used for deficiency fatigue, sore back and knees, dizziness, tinnitus',
        isFoodHomology: true,
        obPercent: 73.3,
        dlValue: 0.65,
        compoundCount: 15,
        targetCount: 8,
        compounds: [],
        targets: [],
        diseases: []
      }
    }
    return herbs[id] || herbs[1]
  }
})
// 配方详情页逻辑 - 深度开发版
const app = getApp()
const request = require('../../../../utils/request.js')
const formulaManager = require('../../../../utils/formula_manager.js')

Page({
  data: {
    formula: null,
    loading: true,
    isFavorite: false,
    statusBarHeight: 0,
    safeAreaBottom: 0,
    // 配方分析数据
    analysisResult: null,
    showingAnalysis: false
  },

  onLoad(options) {
    const systemInfo = wx.getWindowInfo()
    this.setData({ 
      statusBarHeight: systemInfo.statusBarHeight,
      safeAreaBottom: systemInfo.safeArea?.bottom || 0
    })
    
    const id = options.id
    if (id) {
      this.loadFormula(id)
    } else {
      wx.showToast({ title: '配方ID无效', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  onShow() {
    // 重新检查收藏状态
    this.checkFavoriteStatus()
  },

  /**
   * 加载配方详情
   */
  async loadFormula(id) {
    this.setData({ loading: true, formula: null })
    
    try {
      // 从后端API获取配方
      const res = await request.get(`/formulas/${id}`)
      
      if (res) {
        const formula = this.mapFormulaToFrontend(res)
        this.setData({ 
          formula,
          isFavorite: formula.isFavorite || false,
          loading: false 
        })
        
        // 保存到缓存
        this.saveToCache(formula)
      } else {
        throw new Error('配方不存在')
      }
    } catch (error) {
      console.error('加载配方失败:', error)
      
      // 降级到本地缓存
      const cached = this.getFromCache(id)
      if (cached) {
        this.setData({ formula: cached, loading: false })
        return
      }
      
      // 最后使用模拟数据
      this.setData({ 
        formula: this.getMockFormula(id),
        loading: false 
      })
    }
  },

  /**
   * 映射后端配方数据到前端格式
   */
  mapFormulaToFrontend(formula) {
    return {
      id: formula.id,
      name: formula.name || '未命名配方',
      description: formula.description || '',
      coverImage: formula.cover_image || formula.coverImage || '/assets/images/default-formula.png',
      healthScore: formula.health_score || formula.healthScore || this.calculateHealthScore(formula),
      isFavorite: formula.is_favorite || formula.isFavorite || false,
      tags: formula.tags || this.extractTags(formula),
      ingredients: (formula.ingredients || []).map(ing => ({
        id: ing.id,
        name: ing.name_cn || ing.name || ing.nameCn,
        amount: ing.amount || ing.dosage || 0,
        unit: ing.unit || 'g',
        latinName: ing.latin_name || ing.latinName || '',
        function: ing.function || '',
        isFoodHomology: ing.is_food_homology || false
      })),
      peptides: (formula.peptides || []),
      sop: formula.processing_method || formula.sop || '',
      usage: formula.dosage || formula.usage || '',
      mechanism: formula.synergy_analysis || formula.mechanism || '',
      indications: formula.target_effects || formula.indications || [],
      contraindications: formula.contraindications || [],
      monitoring: formula.monitoring || '',
      createdAt: formula.created_at || formula.createdAt,
      updatedAt: formula.updated_at || formula.updatedAt
    }
  },

  /**
   * 计算健康评分
   */
  calculateHealthScore(formula) {
    if (!formula.ingredients) return 75
    const total = formula.ingredients.length
    const foodHomology = formula.ingredients.filter(i => i.is_food_homology).length
    const ratio = foodHomology / total
    let score = 60 + Math.round(ratio * 30)
    return Math.min(score, 100)
  },

  /**
   * 提取标签
   */
  extractTags(formula) {
    const tags = []
    const effects = formula.target_effects || []
    effects.slice(0, 3).forEach(effect => {
      tags.push({ name: effect, type: 'effect' })
    })
    if (formula.category) {
      tags.push({ name: formula.category, type: 'category' })
    }
    return tags
  },

  /**
   * 检查收藏状态
   */
  async checkFavoriteStatus() {
    if (!this.data.formula) return
    try {
      const isFav = await formulaManager.isFavorite(this.data.formula.id)
      this.setData({ isFavorite: isFav })
    } catch (error) {
      // 使用本地缓存
      const favorites = wx.getStorageSync('favorites') || []
      this.setData({ isFavorite: favorites.includes(this.data.formula.id) })
    }
  },

  /**
   * 切换收藏状态
   */
  async toggleFavorite() {
    const formula = { ...this.data.formula }
    formula.isFavorite = !formula.isFavorite
    this.setData({ formula, isFavorite: formula.isFavorite })
    
    try {
      if (formula.isFavorite) {
        await formulaManager.addToFavorites(formula.id)
        wx.showToast({ title: '已收藏', icon: 'success' })
      } else {
        await formulaManager.removeFromFavorites(formula.id)
        wx.showToast({ title: '已取消收藏', icon: 'none' })
      }
    } catch (error) {
      console.error('收藏操作失败:', error)
      // 回滚状态
      formula.isFavorite = !formula.isFavorite
      this.setData({ formula, isFavorite: formula.isFavorite })
    }
  },

  /**
   * 分享配方
   */
  shareFormula() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  /**
   * 返回顶部
   */
  scrollToTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 })
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack()
  },

  /**
   * 保存配方到缓存
   */
  saveToCache(formula) {
    try {
      const key = 'formula_' + formula.id
      wx.setStorageSync(key, JSON.stringify({
        value: formula,
        time: Date.now(),
        expire: 30 * 60 * 1000
      }))
    } catch (error) {
      console.error('保存缓存失败:', error)
    }
  },

  /**
   * 从缓存获取配方
   */
  getFromCache(id) {
    try {
      const data = wx.getStorageSync('formula_' + id)
      if (!data) return null
      const parsed = JSON.parse(data)
      if (Date.now() - parsed.time > parsed.expire) {
        return null
      }
      return parsed.value
    } catch (error) {
      return null
    }
  },

  /**
   * 获取评分颜色
   */
  getScoreColor(score) {
    if (!score) return '#9E9E9E'
    const s = parseInt(score)
    if (s >= 90) return '#07c160'
    if (s >= 80) return '#2D5A3D'
    if (s >= 70) return '#ff976a'
    if (s >= 60) return '#FFC107'
    if (s >= 50) return '#FF9800'
    return '#F44336'
  },

  /**
   * 获取配方类型图标
   */
  getFormulaTypeIcon(type) {
    const types = {
      '汤剂': 'soup',
      '代茶饮': 'tea',
      '膏方': 'paste',
      '丸剂': 'pill',
      '散剂': 'powder'
    }
    return types[type] || 'formula'
  },

  /**
   * 查看历史版本
   */
  viewHistory() {
    wx.showToast({ title: '版本历史开发中', icon: 'none' })
  },

  onShareAppMessage() {
    const formula = this.data.formula
    return {
      title: `【${formula.name}】药食同源配方`,
      path: `/packages/formulas/pages/detail/index?id=${formula.id}`,
      imageUrl: formula.coverImage || ''
    }
  },

  onShareTimeline() {
    const formula = this.data.formula
    return {
      title: `【${formula.name}】药食同源配方`,
      query: `id=${formula.id}`,
      imageUrl: formula.coverImage || ''
    }
  },

  // ==================== 模拟数据（用于测试） ====================
  getMockFormula(id) {
    const formulas = {
      1: {
        id: 1,
        name: '安神助眠汤',
        description: '改善睡眠质量，缓解失眠多梦',
        coverImage: '',
        healthScore: 88,
        isFavorite: true,
        tags: [
          { name: '安神', type: 'effect' },
          { name: '助眠', type: 'effect' },
          { name: '养心', type: 'category' }
        ],
        ingredients: [
          { name: '酸枣仁', amount: 15, unit: 'g', latinName: 'Ziziphi Spinosae Semen', isFoodHomology: true },
          { name: '茯苓', amount: 10, unit: 'g', latinName: 'Poria', isFoodHomology: true },
          { name: '龙眼肉', amount: 10, unit: 'g', latinName: 'Longan Arillus', isFoodHomology: true },
          { name: '莲子', amount: 10, unit: 'g', latinName: 'Nelumbinis Semen', isFoodHomology: true }
        ],
        sop: '1. 酸枣仁捣碎，与其他药材一起放入砂锅\n2. 加水800ml，浸泡30分钟\n3. 大火煮沸后转小火煎煮30分钟\n4. 滤取药液，约200ml\n5. 再加水500ml，煎煮20分钟，滤取药液\n6. 两次药液混合，分早晚两次温服',
        usage: '建议连续服用7天为一疗程。睡前1小时服用效果最佳。服药期间避免饮用浓茶、咖啡。',
        mechanism: '本方以酸枣仁为君药，富含皂苷和黄酮类化合物，可通过调节GABA能神经系统改善睡眠结构；茯苓为臣药，其茯苓三萜成分具有镇静安神作用；龙眼肉补益心脾，莲子交通心肾。四药合用，共奏养心安神、交通心肾之功。现代药理研究表明，酸枣仁皂苷A可通过调节TH1/TH2免疫平衡改善睡眠质量。',
        indications: '适用于心肾不交、阴虚火旺所致失眠多梦、心悸健忘、乏力头晕者。',
        contraindications: ['孕妇慎用', '脾胃虚寒者减量', '感冒发热期间停用'],
        monitoring: '建议监测睡眠质量（入睡时间、觉醒次数）、日间精力状态。如服用7天后症状无改善，建议就医进一步检查。',
        createdAt: '2024-03-15',
        updatedAt: '2024-03-15'
      },
      2: {
        id: 2,
        name: '健脾养胃茶',
        description: '调理脾胃虚弱，促进消化吸收',
        coverImage: '',
        healthScore: 85,
        isFavorite: false,
        tags: [
          { name: '健脾', type: 'effect' },
          { name: '养胃', type: 'effect' }
        ],
        ingredients: [
          { name: '山药', amount: 15, unit: 'g', latinName: 'Dioscoreae Rhizoma', isFoodHomology: true },
          { name: '茯苓', amount: 10, unit: 'g', latinName: 'Poria', isFoodHomology: true },
          { name: '白术', amount: 10, unit: 'g', latinName: 'Atractylodis Rhizoma', isFoodHomology: true },
          { name: '薏苡仁', amount: 15, unit: 'g', latinName: 'Coicis Semen', isFoodHomology: true }
        ],
        sop: '1. 所有药材洗净，山药切片\n2. 放入保温杯中，加沸水500ml\n3. 加盖焖泡20分钟\n4. 代茶饮用，可反复冲泡至味淡',
        usage: '每日1剂，连服14天。饭前半小时饮用效果更佳。',
        mechanism: '本方以山药为君，富含多糖和薯蓣皂苷，可改善肠道屏障功能；白术为臣，其挥发油促进胃肠蠕动；茯苓利水渗湿，薏苡仁健脾渗湿。全方共奏健脾益气、渗湿止泻之效。',
        indications: '适用于脾胃气虚所致食少便溏、乏力倦怠者。',
        contraindications: ['实热证者慎用', '孕妇慎用'],
        monitoring: '建议监测食欲、排便情况。如出现口干舌燥等热象，应减量或停用。',
        createdAt: '2024-03-10',
        updatedAt: '2024-03-10'
      },
      3: {
        id: 3,
        name: '补气养阴方',
        description: '益气养阴，增强免疫力',
        coverImage: '',
        healthScore: 82,
        isFavorite: true,
        tags: [
          { name: '补气', type: 'effect' },
          { name: '养阴', type: 'effect' },
          { name: '免疫', type: 'category' }
        ],
        ingredients: [
          { name: '黄芪', amount: 15, unit: 'g', latinName: 'Astragali Radix', isFoodHomology: true },
          { name: '西洋参', amount: 6, unit: 'g', latinName: 'Panacis Quinquefolii Radix', isFoodHomology: true },
          { name: '麦冬', amount: 10, unit: 'g', latinName: 'Ophiopogonis Radix', isFoodHomology: true },
          { name: '五味子', amount: 6, unit: 'g', latinName: 'Schisandrae Fructus', isFoodHomology: true }
        ],
        sop: '1. 所有药材洗净，西洋参切片\n2. 放入砂锅，加水600ml\n3. 大火煮沸后转小火煎煮25分钟\n4. 滤取药液，约150ml\n5. 再加水400ml，煎煮15分钟\n6. 两次药液混合，分早晚服用',
        usage: '每日1剂，连服10天。午后服用效果更佳。',
        mechanism: '本方以黄芪为君，富含黄芪多糖和皂苷，可增强免疫细胞活性；西洋参为臣，含人参皂苷Rb1，益气养阴；麦冬润肺养阴，五味子收敛固涩。四药合用，气阴双补。',
        indications: '适用于气阴两虚所致乏力、自汗、口干者。',
        contraindications: ['感冒发热期间停用', '实热证者慎用'],
        monitoring: '建议监测精神状态、出汗情况。如出现上火症状，应减量。',
        createdAt: '2024-03-05',
        updatedAt: '2024-03-05'
      }
    }
    return formulas[id] || formulas[1]
  }
})

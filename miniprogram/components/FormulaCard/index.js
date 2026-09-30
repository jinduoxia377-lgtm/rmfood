Component({
  properties: {
    formula: {
      type: Object,
      value: { 
        name: "", 
        description: "", 
        healthScore: 0, 
        tags: [], 
        coverImage: "", 
        isFavorite: false,
        ingredients: [],
        category: '',
        servings: 1,
        prepTime: 0,
        difficulty: 'easy'
      }
    },
    showFavorite: { type: Boolean, value: false },
    size: { type: String, value: "normal" },
    showActions: { type: Boolean, value: true },
    enableAnimation: { type: Boolean, value: true }
  },

  data: {
    sizeClass: "formula-card-normal",
    isAnimating: false,
    likeCount: 0,
    viewCount: 0,
    displayTags: []
  },

  observers: {
    "size": function(size) {
      this.setData({
        sizeClass: "formula-card-" + (size || "normal")
      })
    },
    "formula.tags": function(tags) {
      if (tags && tags.length > 3) {
        this.setData({ displayTags: tags.slice(0, 3) })
      } else {
        this.setData({ displayTags: tags || [] })
      }
    }
  },

  methods: {
    /**
     * 卡片点击
     */
    onTap(e) {
      if (this.data.isAnimating) return
      
      this.setData({ isAnimating: true })
      this.triggerEvent("tap", e)
      
      setTimeout(() => {
        this.setData({ isAnimating: false })
      }, 300)
    },

    /**
     * 收藏功能
     */
    onFavorite(e) {
      e.stopPropagation()
      const formula = this.data.formula
      const isFav = !formula.isFavorite
      
      // 触觉反馈
      if (wx.vibrateShort) {
        wx.vibrateShort({ type: 'light' })
      }
      
      this.setData({
        'formula.isFavorite': isFav
      })
      
      this.triggerEvent("favorite", {
        formula,
        isFavorite: isFav
      })
    },

    /**
     * 分享功能
     */
    onShare(e) {
      e.stopPropagation()
      
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline']
      })
      
      this.triggerEvent("share", this.data.formula)
    },

    /**
     * 添加到配方
     */
    onAddToFormula(e) {
      e.stopPropagation()
      this.triggerEvent("add", this.data.formula)
    },

    /**
     * 查看详情
     */
    onViewDetail(e) {
      e.stopPropagation()
      this.triggerEvent("detail", this.data.formula)
    },

    /**
     * 计算健康分颜色
     */
    getScoreColor(score) {
      if (score >= 80) return '#22c55e'
      if (score >= 60) return '#f59e0b'
      if (score >= 40) return '#f97316'
      return '#ef4444'
    },

    /**
     * 获取难度文本
     */
    getDifficultyText(difficulty) {
      const map = {
        'easy': '简单',
        'medium': '中等',
        'hard': '困难'
      }
      return map[difficulty] || '简单'
    },

    /**
     * 格式化时间
     */
    formatTime(minutes) {
      if (minutes < 60) return `${minutes}分钟`
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return mins > 0 ? `${hours}小时${mins}分` : `${hours}小时`
    },

    /**
     * 获取 Ingredients 摘要
     */
    getIngredientsSummary(ingredients) {
      if (!ingredients || ingredients.length === 0) return ''
      const names = ingredients.map(i => i.name || i).slice(0, 3)
      return names.join('、') + (ingredients.length > 3 ? ` 等${ingredients.length}味` : '')
    }
  }
})

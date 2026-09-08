// Tabs 选项卡组件
Component({
  options: {
    multipleSlots: true
  },

  properties: {
    tabs: {
      type: Array,
      value: [],
      observer: 'onTabsChange'
    },
    current: {
      type: Number,
      value: 0
    },
    type: {
      type: String,
      value: 'default'  // default | divider | capsule
    },
    padding: {
      type: Number,
      value: 32
    }
  },

  data: {
    currentIndex: 0,
    scrollLeft: 0,
    indicatorWidth: 0,
    indicatorX: 0
  },

  lifetimes: {
    attached() {
      this.setData({ currentIndex: this.data.current })
    },
    ready() {
      this.updateIndicator()
    }
  },

  methods: {
    onTabsChange(newVal) {
      if (newVal && newVal.length > 0) {
        this.updateIndicator()
      }
    },

    handleTabTap(e) {
      const index = e.currentTarget.dataset.index
      if (this.data.tabs[index]?.disabled) return
      
      this.setData({ currentIndex: index })
      this.triggerEvent('change', { index })
      this.updateIndicator()
    },

    updateIndicator() {
      const query = wx.createSelectorQuery().in(this)
      query.selectAll('.tabs-item').boundingClientRect((rects) => {
        if (rects.length === 0) return
        
        const activeRect = rects[this.data.currentIndex]
        if (!activeRect) return
        
        let totalOffset = 0
        for (let i = 0; i < this.data.currentIndex; i++) {
          totalOffset += rects[i].width
        }
        
        this.setData({
          indicatorWidth: activeRect.width,
          indicatorX: totalOffset + activeRect.width / 2
        })
      }).exec()
    }
  }
})

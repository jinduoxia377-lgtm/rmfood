// Card 卡片组件
Component({
  options: {
    multipleSlots: true
  },

  properties: {
    // 标题
    title: {
      type: String,
      value: ''
    },
    // 副标题
    subtitle: {
      type: String,
      value: ''
    },
    // 操作文字
    action: {
      type: String,
      value: ''
    },
    // 底部文字
    footer: {
      type: String,
      value: ''
    },
    // 阴影级别
    shadow: {
      type: String,
      value: 'md'  // none | sm | md | lg | brand
    },
    // 是否可点击
    clickable: {
      type: Boolean,
      value: false
    },
    // 自定义类名
    className: {
      type: String,
      value: ''
    }
  },

  methods: {
    handleTap() {
      if (this.data.clickable) {
        this.triggerEvent('tap', {})
      }
    },

    handleAction() {
      this.triggerEvent('action', {})
    }
  }
})

// Button 按钮组件
Component({
  options: {
    multipleSlots: true
  },

  properties: {
    // 按钮类型
    type: {
      type: String,
      value: 'primary'  // primary | secondary | text | danger | success
    },
    // 按钮尺寸
    size: {
      type: String,
      value: 'medium'   // small | medium | large
    },
    // 是否加载中
    loading: {
      type: Boolean,
      value: false
    },
    // 是否禁用
    disabled: {
      type: Boolean,
      value: false
    },
    // 按钮类名
    className: {
      type: String,
      value: ''
    },
    // 图标名称
    icon: {
      type: String,
      value: ''
    },
    // 图标大小
    iconSize: {
      type: String,
      value: 'md'
    },
    // 图标颜色
    iconColor: {
      type: String,
      value: '#FFFFFF'
    }
  },

  methods: {
    handleTap(e) {
      if (this.data.disabled || this.data.loading) return
      
      this.triggerEvent('tap', e.detail)
    }
  }
})

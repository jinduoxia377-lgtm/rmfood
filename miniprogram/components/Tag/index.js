// Tag 标签组件
Component({
  properties: {
    // 类型
    type: {
      type: String,
      value: 'default'  // primary | success | warning | danger | info | default
    },
    // 尺寸
    size: {
      type: String,
      value: 'medium'   // small | medium | large
    },
    // 是否可关闭
    closable: {
      type: Boolean,
      value: false
    },
    // 是否实心
    solid: {
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
      this.triggerEvent('tap', {})
    },

    handleClose(e) {
      e.stopPropagation()
      this.triggerEvent('close', {})
    }
  }
})

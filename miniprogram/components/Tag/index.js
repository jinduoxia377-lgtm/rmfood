// Tag 标签组件
Component({
  properties: {
    // 类型
    type: {
      type: String,
      value: 'default'  // primary | success | warning | danger | info | default
    },
    // 尺寸 - 支持 sm/md/lg 和 small/medium/large
    size: {
      type: String,
      value: 'md'
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

  data: {
    sizeClass: 'tag-md'
  },

  observers: {
    'size': function(size) {
      const sizeMap = {
        'xs': 'tag-xs',
        'sm': 'tag-sm',
        'small': 'tag-sm',
        'md': 'tag-md',
        'medium': 'tag-md',
        'lg': 'tag-lg',
        'large': 'tag-lg'
      }
      this.setData({ sizeClass: sizeMap[size] || 'tag-md' })
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

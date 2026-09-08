Component({
  properties: {
    // 骨架屏类型：card, list, text, circular
    type: {
      type: String,
      value: 'card'
    },
    // 列表项数量（仅list类型有效）
    count: {
      type: Number,
      value: 5
    }
  },

  data: {
    // 内部数据
  },

  observers: {
    'type': function(type) {
      // 类型变化时触发
    }
  },

  methods: {
    // 刷新骨架屏
    refresh() {
      this.triggerEvent('refresh')
    }
  }
})
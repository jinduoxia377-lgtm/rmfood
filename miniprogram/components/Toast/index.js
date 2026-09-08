// Toast 轻提示组件
Component({
  options: {
    multipleSlots: true
  },

  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    content: {
      type: String,
      value: ''
    },
    type: {
      type: String,
      value: 'info'  // info | success | error | warning | loading
    },
    position: {
      type: String,
      value: 'center'  // top | center | bottom
    },
    icon: {
      type: String,
      value: ''
    },
    duration: {
      type: Number,
      value: 2000
    }
  },

  timers: {},

  methods: {
    show(options = {}) {
      if (options.content) this.setData({ content: options.content })
      if (options.type) this.setData({ type: options.type })
      if (options.position) this.setData({ position: options.position })
      
      this.setData({ visible: true })
      
      // 自动隐藏
      if (this.timers.hide) clearTimeout(this.timers.hide)
      this.timers.hide = setTimeout(() => {
        this.hide()
      }, this.data.duration)
    },

    hide() {
      this.setData({ visible: false })
      if (this.timers.hide) {
        clearTimeout(this.timers.hide)
        this.timers.hide = null
      }
    },

    success(content) {
      this.show({ content, type: 'success', icon: 'check' })
    },

    error(content) {
      this.show({ content, type: 'error', icon: 'error' })
    },

    loading(content) {
      this.show({ content, type: 'loading' })
    },

    clearTimer() {
      if (this.timers.hide) {
        clearTimeout(this.timers.hide)
        this.timers.hide = null
      }
    }
  },

  detached() {
    this.clearTimer()
  }
})

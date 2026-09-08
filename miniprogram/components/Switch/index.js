// Switch 开关组件
Component({
  options: {
    multipleSlots: true
  },

  properties: {
    value: {
      type: Boolean,
      value: false
    },
    disabled: {
      type: Boolean,
      value: false
    },
    size: {
      type: String,
      value: 'medium'  // small | medium | large
    },
    className: {
      type: String,
      value: ''
    }
  },

  methods: {
    handleTap() {
      if (this.data.disabled) return
      
      const newValue = !this.data.value
      this.triggerEvent('change', { value: newValue })
      this.triggerEvent('input', { value: newValue })
    }
  }
})

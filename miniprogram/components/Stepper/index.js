// Stepper 步进器组件
Component({
  properties: {
    value: {
      type: Number,
      value: 1
    },
    min: {
      type: Number,
      value: 1
    },
    max: {
      type: Number,
      value: 99
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
    handleMinus() {
      if (this.data.disabled || this.data.value <= this.data.min) return
      const newValue = this.data.value - 1
      this.setData({ value: newValue })
      this.triggerEvent('change', { value: newValue })
      this.triggerEvent('input', { value: newValue })
    },

    handlePlus() {
      if (this.data.disabled || this.data.value >= this.data.max) return
      const newValue = this.data.value + 1
      this.setData({ value: newValue })
      this.triggerEvent('change', { value: newValue })
      this.triggerEvent('input', { value: newValue })
    },

    handleInput(e) {
      const value = parseInt(e.detail.value) || 0
      const clampedValue = Math.max(this.data.min, Math.min(this.data.max, value))
      this.setData({ value: clampedValue })
      this.triggerEvent('change', { value: clampedValue })
      this.triggerEvent('input', { value: clampedValue })
    }
  }
})

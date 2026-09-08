// Checkbox 多选组件
Component({
  properties: {
    checked: {
      type: Boolean,
      value: false
    },
    disabled: {
      type: Boolean,
      value: false
    },
    className: {
      type: String,
      value: ''
    }
  },

  methods: {
    handleTap() {
      if (this.data.disabled) return
      
      this.triggerEvent('change', { checked: !this.data.checked })
      this.triggerEvent('input', { checked: !this.data.checked })
    }
  }
})

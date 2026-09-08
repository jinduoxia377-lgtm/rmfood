// Input 输入框组件
Component({
  options: {
    multipleSlots: true
  },

  properties: {
    // 值
    value: {
      type: String,
      value: ''
    },
    // 类型
    type: {
      type: String,
      value: 'text'  // text | number | idcard | digit
    },
    // 占位符
    placeholder: {
      type: String,
      value: ''
    },
    // 前置图标
    prefixIcon: {
      type: String,
      value: ''
    },
    // 后置图标
    suffixIcon: {
      type: String,
      value: ''
    },
    // 图标大小
    iconSize: {
      type: String,
      value: 'md'
    },
    // 是否可清除
    clearable: {
      type: Boolean,
      value: false
    },
    // 是否禁用
    disabled: {
      type: Boolean,
      value: false
    },
    // 最大长度
    maxlength: {
      type: Number,
      value: -1
    },
    // 是否获取焦点
    focus: {
      type: Boolean,
      value: false
    },
    // 确定按钮类型
    confirmType: {
      type: String,
      value: 'done'
    },
    // 错误信息
    errorMessage: {
      type: String,
      value: ''
    },
    // 显示字数统计
    showCount: {
      type: Boolean,
      value: false
    },
    // 自定义类名
    className: {
      type: String,
      value: ''
    },
    // 自定义输入框类名
    inputClass: {
      type: String,
      value: ''
    }
  },

  data: {
    isFocused: false
  },

  methods: {
    handleInput(e) {
      this.triggerEvent('input', e.detail.value)
      this.triggerEvent('change', { value: e.detail.value })
    },

    handleConfirm(e) {
      this.triggerEvent('confirm', e.detail.value)
    },

    handleFocus(e) {
      this.setData({ isFocused: true })
      this.triggerEvent('focus', e.detail)
    },

    handleBlur(e) {
      this.setData({ isFocused: false })
      this.triggerEvent('blur', e.detail)
    },

    handleClear() {
      this.triggerEvent('input', '')
      this.triggerEvent('change', { value: '' })
      this.triggerEvent('clear')
    }
  }
})

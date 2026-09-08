// Modal 弹窗组件
Component({
  options: {
    multipleSlots: true
  },

  properties: {
    // 是否显示
    visible: {
      type: Boolean,
      value: false,
      observer: '_onVisibleChange'
    },
    // 标题
    title: {
      type: String,
      value: ''
    },
    // 位置
    position: {
      type: String,
      value: 'center'  // center | top | bottom
    },
    // 显示关闭按钮
    showClose: {
      type: Boolean,
      value: true
    },
    // 显示底部
    showFooter: {
      type: Boolean,
      value: true
    },
    // 显示取消按钮
    showCancel: {
      type: Boolean,
      value: true
    },
    // 取消文字
    cancelText: {
      type: String,
      value: '取消'
    },
    // 确认文字
    confirmText: {
      type: String,
      value: '确认'
    },
    // 确认按钮类型
    confirmType: {
      type: String,
      value: 'primary'  // primary | danger
    },
    // 点击遮罩是否关闭
    closeOnClickOverlay: {
      type: Boolean,
      value: true
    },
    // 动作对齐
    actionsAlign: {
      type: String,
      value: 'center'  // center | start | end
    }
  },

  data: {
    animated: false
  },

  methods: {
    _onVisibleChange(newVal) {
      if (newVal) {
        this.setData({ animated: true })
        this.triggerEvent('show')
      } else {
        this.triggerEvent('hide')
      }
    },

    handleOverlayTap() {
      if (this.data.closeOnClickOverlay) {
        this.handleClose()
      }
    },

    stopPropagation() {
      // 阻止事件冒泡
    },

    handleClose() {
      this.triggerEvent('close')
      this.setData({ visible: false })
    },

    handleCancel() {
      this.triggerEvent('cancel')
      this.handleClose()
    },

    handleConfirm() {
      this.triggerEvent('confirm')
      this.handleClose()
    }
  }
})

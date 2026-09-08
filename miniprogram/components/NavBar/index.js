// NavBar 导航栏组件
const app = getApp()

Component({
  options: {
    multipleSlots: true
  },

  properties: {
    // 标题
    title: {
      type: String,
      value: ''
    },
    // 副标题
    subtitle: {
      type: String,
      value: ''
    },
    // 左侧文字
    leftText: {
      type: String,
      value: ''
    },
    // 左侧图标
    leftIcon: {
      type: String,
      value: 'back'
    },
    // 左侧颜色
    leftColor: {
      type: String,
      value: ''
    },
    // 右侧图标
    rightIcon: {
      type: String,
      value: ''
    },
    // 右侧颜色
    rightColor: {
      type: String,
      value: ''
    },
    // 是否固定
    fixed: {
      type: Boolean,
      value: true
    },
    // 是否透明
    transparent: {
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
    statusBarHeight: 0
  },

  lifetimes: {
    attached() {
      const systemInfo = wx.getWindowInfo()
      this.setData({ statusBarHeight: systemInfo.statusBarHeight })
    }
  },

  methods: {
    handleLeftTap() {
      this.triggerEvent('left', {})
      // 默认返回
      if (!this.properties.leftText) {
        wx.navigateBack()
      }
    },

    handleRightTap() {
      this.triggerEvent('right', {})
    }
  }
})

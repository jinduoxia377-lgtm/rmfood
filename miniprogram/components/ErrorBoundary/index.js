Component({
  options: {
    multipleSlots: true
  },

  properties: {
    // 是否显示错误
    hasError: {
      type: Boolean,
      value: false
    },
    // 错误标题
    errorTitle: {
      type: String,
      value: ''
    },
    // 错误描述
    errorDesc: {
      type: String,
      value: ''
    },
    // 错误消息（调试用）
    errorMessage: {
      type: String,
      value: ''
    },
    // 是否显示详情
    showDetail: {
      type: Boolean,
      value: false
    },
    // 是否显示联系方式
    showContact: {
      type: Boolean,
      value: true
    },
    // 自定义样式
    className: {
      type: String,
      value: ''
    }
  },

  data: {
    retryCount: 0,
    maxRetries: 3
  },

  lifetimes: {
    attached() {
      // 组件挂载时的初始化
    },
    detached() {
      // 组件销毁时的清理
    }
  },

  methods: {
    /**
     * 处理重试
     */
    handleRetry() {
      const { retryCount, maxRetries } = this.data
      
      if (retryCount >= maxRetries) {
        wx.showToast({
          title: '重试次数过多',
          icon: 'none'
        })
        return
      }
      
      this.setData({
        retryCount: retryCount + 1
      })
      
      // 触发重试事件
      this.triggerEvent('retry', {
        count: retryCount + 1
      })
    },

    /**
     * 处理重新加载
     */
    handleReload() {
      // 返回首页
      wx.navigateTo({
        url: '/pages/index/index',
        fail: (err) => {
          console.error('[ErrorBoundary] Reload failed:', err)
          wx.redirectTo({
            url:"/pages/index/index"
          })
        }
      })
    },

    /**
     * 清除错误状态
     */
    clearError() {
      this.setData({
        retryCount: 0
      })
      this.triggerEvent('clear')
    },

    /**
     * 设置错误状态
     */
    setError(error) {
      const message = error?.message || '未知错误'
      this.setData({
        errorMessage: message,
        hasError: true
      })
      this.triggerEvent('error', { error })
    }
  }
})

/**
 * RMFOOD 触摸反馈系统 - 微信小程序版本
 * 使用小程序API替代DOM API
 */

class TouchFeedback {
  constructor() {
    this.activeElements = new Set()
  }

  /**
   * 按钮点击反馈 - 使用小程序事件系统
   */
  buttonPress(event) {
    const { currentTarget } = event
    if (!currentTarget) return

    // 视觉反馈
    currentTarget.classList.add('press-active')

    // 触觉反馈（如果支持）
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'light' })
    }

    setTimeout(() => {
      if (currentTarget) {
        currentTarget.classList.remove('press-active')
      }
    }, 150)
  }

  /**
   * 长按反馈
   */
  longPress(event, duration = 500) {
    const { currentTarget } = event
    if (!currentTarget) return

    let timer = null

    const start = () => {
      timer = setTimeout(() => {
        currentTarget.classList.add('press-active')
        if (wx.vibrateShort) {
          wx.vibrateShort({ type: 'medium' })
        }
      }, duration)
    }

    const end = () => {
      if (timer) {
        clearTimeout(timer)
        currentTarget.classList.remove('press-active')
      }
    }

    currentTarget.addEventListener('touchstart', start)
    currentTarget.addEventListener('touchend', end)
    currentTarget.addEventListener('touchcancel', end)
  }

  /**
   * 滑动反馈
   */
  swipeFeedback(direction) {
    // 触觉反馈
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'light' })
    }

    // 视觉提示
    const feedback = {
      left: '← 左滑',
      right: '→ 右滑',
      up: '↑ 上滑',
      down: '↓ 下滑'
    }
    wx.showToast({
      title: feedback[direction] || '滑动',
      icon: 'none',
      duration: 800
    })
  }

  /**
   * 成功反馈
   */
  success() {
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'heavy' })
    }
  }

  /**
   * 错误反馈
   */
  error() {
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'heavy' })
    }
  }

  /**
   * 加载状态
   */
  setLoading(element, loading) {
    if (!element) return
    if (loading) {
      element.classList.add('loading')
    } else {
      element.classList.remove('loading')
    }
  }

  /**
   * 清除所有反馈
   */
  clearAll() {
    this.activeElements.clear()
  }
}

// 导出单例
let instance = null

function getTouchFeedback() {
  if (!instance) {
    instance = new TouchFeedback()
  }
  return instance
}

module.exports = { TouchFeedback, getTouchFeedback }

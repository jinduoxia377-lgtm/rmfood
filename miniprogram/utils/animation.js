/**
 * 动效管理器
 * 统一管理动画和转场效果
 */

class AnimationManager {
  constructor() {
    this.animations = {}
    this.queue = []
  }

  /**
   * 页面转场动画
   */
  static navigateWithAnimation(fromPage, toPage, options = {}) {
    const { direction = 'forward', duration = 300 } = options
    
    // 微信小程序原生转场
    wx.navigateTo({
      url: toPage,
      animationType: direction === 'back' ? 'slide-out-right' : 'slide-in-right',
      animationDuration: duration,
      success: () => {
        // 记录导航历史
        const history = wx.getStorageSync('nav_history') || []
        history.push(toPage)
        wx.setStorageSync('nav_history', history)
      }
    })
  }

  /**
   * 返回动画
   */
  static backWithAnimation(fromPage) {
    wx.navigateBack({
      animationType: 'slide-in-left',
      animationDuration: 300
    })
  }

  /**
   * 元素入场动画
   */
  static animateEnter(element, delay = 0) {
    return new Promise(resolve => {
      setTimeout(() => {
        element.style.animation = 'fadeInUp 0.5s ease forwards'
        resolve()
      }, delay)
    })
  }

  /**
   * 元素离场动画
   */
  static animateExit(element) {
    return new Promise(resolve => {
      element.style.animation = 'fadeOutDown 0.3s ease forwards'
      setTimeout(resolve, 300)
    })
  }

  /**
   * 成功反馈动画
   */
  static showSuccess(element) {
    element.style.animation = 'successCheck 0.5s ease'
    setTimeout(() => {
      element.style.animation = ''
    }, 500)
  }

  /**
   * 错误反馈动画
   */
  static showError(element) {
    element.style.animation = 'errorShake 0.5s ease'
    setTimeout(() => {
      element.style.animation = ''
    }, 500)
  }

  /**
   * 加载旋转动画
   */
  static startLoading(element) {
    element.style.animation = 'spin 1s linear infinite'
  }

  /**
   * 停止加载动画
   */
  static stopLoading(element) {
    element.style.animation = ''
  }
}

// CSS动画定义
const ANIMATION_STYLES = `
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeOutDown {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(20rpx);
  }
}

@keyframes successCheck {
  0% { transform: scale(0) rotate(-45deg); }
  50% { transform: scale(1.2) rotate(-45deg); }
  100% { transform: scale(1) rotate(0deg); }
}

@keyframes errorShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10rpx); }
  75% { transform: translateX(10rpx); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`

module.exports = {
  AnimationManager,
  ANIMATION_STYLES
}

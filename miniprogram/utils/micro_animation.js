/**
 * 微动效管理器
 * 统一管理页面微动效
 */

class MicroAnimationManager {
  constructor() {
    this.animations = new Map()
    this.queue = []
    this.isPlaying = false
  }

  /**
   * 播放元素入场动画
   * @param {Object} page - 页面实例
   * @param {string} selector - CSS选择器
   * @param {string} animation - 动画类型
   * @param {number} delay - 延迟（毫秒）
   */
  playEnterAnimation(page, selector, animation = 'fade-in', delay = 0) {
    setTimeout(() => {
      page.createSelectorQuery()
        .select(selector)
        .boundingClientRect()
        .exec((res) => {
          if (res[0]) {
            this.animateElement(page, selector, animation)
          }
        })
    }, delay)
  }

  /**
   * 动画单个元素
   * @param {Object} page - 页面实例
   * @param {string} selector - CSS选择器
   * @param {string} animation - 动画类型
   */
  animateElement(page, selector, animation) {
    const animationName = "micro-" + animation + ""
    const el = page.select(selector)
    
    if (!el) return
    
    // 添加动画类
    el.addClass(animationName)
    
    // 动画结束后移除类
    setTimeout(() => {
      el.removeClass(animationName)
    }, 400)
  }

  /**
   * 批量入场动画
   * @param {Object} page - 页面实例
   * @param {string} selector - CSS选择器
   * @param {string} animation - 动画类型
   * @param {number} stagger - 交错延迟（毫秒）
   */
  playBatchEnterAnimation(page, selector, animation = 'fade-in', stagger = 50) {
    const pages = page.selectAllComponents(selector) || 
                  page.select(selector).nodes()
    
    if (!pages || pages.length === 0) return
    
    pages.forEach((el, index) => {
      setTimeout(() => {
        this.animateElement(page, selector, animation)
      }, index * stagger)
    })
  }

  /**
   * 点击反馈动画
   * @param {Object} page - 页面实例
   * @param {string} selector - CSS选择器
   */
  playTapFeedback(page, selector) {
    const el = page.select(selector)
    if (!el) return
    
    // 缩放动画
    el.animate([
      { transform: 'scale(0.95)' },
      { transform: 'scale(1)' }
    ], {
      duration: 150,
      easing: 'ease-out'
    })
  }

  /**
   * 加载状态动画
   * @param {Object} page - 页面实例
   * @param {string} selector - CSS选择器
   */
  playLoadingAnimation(page, selector) {
    const el = page.select(selector)
    if (!el) return
    
    // 脉冲动画
    el.animate([
      { opacity: 0.4 },
      { opacity: 1 },
      { opacity: 0.4 }
    ], {
      duration: 1500,
      easing: 'ease-in-out',
      iterations: Infinity
    })
  }

  /**
   * 停止所有动画
   */
  stopAllAnimations() {
    this.animations.clear()
    this.queue = []
    this.isPlaying = false
  }

  /**
   * 获取动画状态
   * @returns {boolean}
   */
  isPlayingAny() {
    return this.isPlaying
  }
}

// 动画定义
const animations = {
  'fade-in': {
    keyframes: [
      { opacity: 0, transform: 'translateY(20rpx)' },
      { opacity: 1, transform: 'translateY(0)' }
    ],
    duration: 300,
    easing: 'ease-out'
  },
  'slide-up': {
    keyframes: [
      { opacity: 0, transform: 'translateY(40rpx)' },
      { opacity: 1, transform: 'translateY(0)' }
    ],
    duration: 400,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
  },
  'scale-in': {
    keyframes: [
      { opacity: 0, transform: 'scale(0.9)' },
      { opacity: 1, transform: 'scale(1)' }
    ],
    duration: 300,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
  }
}

// 导出单例
const microAnimationManager = new MicroAnimationManager()

module.exports = {
  getMicroAnimationManager: () => microAnimationManager,
  animations
}

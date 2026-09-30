/**
 * 手势导航管理器
 * 实现滑动手势返回功能
 */

class GestureNavigator {
  constructor() {
    this.startX = 0
    this.startY = 0
    this.currentX = 0
    this.isSwiping = false
    this.threshold = 100 // 滑动阈值（px）
    this.dragDistance = 0
    this.pageContext = null
    this.touchStartY = 0
  }

  /**
   * 初始化手势监听
   * @param {Object} pageContext - 页面上下文
   */
  init(pageContext) {
    this.pageContext = pageContext
    if (!pageContext) {
      return
    }
  }

  /**
   * 获取页面实例
   */
  getPageContext() {
    return this.pageContext
  }

  /**
   * 处理触摸开始
   */
  onTouchStart(e) {
    if (!e.touches || e.touches.length === 0) return
    
    const touch = e.touches[0]
    this.startX = touch.clientX
    this.startY = touch.clientY
    this.touchStartY = touch.clientY
    this.isSwiping = false
    this.dragDistance = 0
  }

  /**
   * 处理触摸移动
   */
  onTouchMove(e) {
    if (!this.startX || !e.touches || e.touches.length === 0) return
    
    const touch = e.touches[0]
    const deltaX = touch.clientX - this.startX
    const deltaY = Math.abs(touch.clientY - this.touchStartY)
    
    // 只处理水平滑动，且起始点在屏幕左边缘
    if (this.startX < 50 && Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 0) {
      this.isSwiping = true
      this.dragDistance = deltaX
    }
  }

  /**
   * 处理触摸结束
   */
  onTouchEnd() {
    if (!this.isSwiping || this.dragDistance < this.threshold) {
      this.reset()
      return
    }
    
    // 触发返回
    wx.navigateBack({
      delta: 1,
      fail: () => {
        // 如果没有上一页，返回主页
        wx.navigateTo({
          url:"/pages/index/index"
        })
      }
    })
    
    this.reset()
  }

  /**
   * 处理触摸取消
   */
  onTouchCancel() {
    this.reset()
  }

  /**
   * 重置状态
   */
  reset() {
    this.startX = 0
    this.startY = 0
    this.currentX = 0
    this.isSwiping = false
    this.dragDistance = 0
    this.touchStartY = 0
  }

  /**
   * 获取当前拖拽距离
   */
  getDragDistance() {
    return this.dragDistance
  }

  /**
   * 是否正在滑动
   */
  isCurrentlySwiping() {
    return this.isSwiping
  }

  /**
   * 销毁
   */
  destroy() {
    this.pageContext = null
  }
}

// 导出单例
const gestureNavigator = new GestureNavigator()

module.exports = {
  getGestureNavigator: () => gestureNavigator
}

// utils/loading.js - 统一加载管理器
// 符合微信官方设计规范

class LoadingManager {
  constructor() {
    this.loadingCount = 0
  }

  /**
   * 显示全局加载
   */
  showGlobal(title = '加载中...') {
    wx.showLoading({ title, mask: true })
    this.loadingCount++
  }

  /**
   * 隐藏全局加载
   */
  hideGlobal() {
    if (this.loadingCount > 0) {
      wx.hideLoading()
      this.loadingCount--
    }
  }

  /**
   * 包裹异步操作的加载状态
   */
  async withLoading(asyncFn, title = '加载中...') {
    this.showGlobal(title)
    try {
      const result = await asyncFn()
      return result
    } catch (error) {
      throw error
    } finally {
      this.hideGlobal()
    }
  }

  /**
   * 显示局部加载（用于setData）
   */
  showLocal(page, key) {
    page.setData({ [key]: true })
  }

  /**
   * 隐藏局部加载
   */
  hideLocal(page, key) {
    page.setData({ [key]: false })
  }
}

// 单例模式
const loadingManager = new LoadingManager()
module.exports = loadingManager

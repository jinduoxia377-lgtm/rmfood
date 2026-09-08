// utils/loadingManager.js - Global Loading Manager
class LoadingManager {
  constructor() {
    this.loadingCount = 0
    this.maskVisible = false
  }

  show(options = {}) {
    this.loadingCount++
    if (this.loadingCount === 1) {
      wx.showLoading({
        title: options.title || 'Loading...',
        mask: options.mask !== undefined ? options.mask : true
      })
      this.maskVisible = true
    }
  }

  hide() {
    if (this.loadingCount > 0) {
      this.loadingCount--
    }
    if (this.loadingCount === 0 && this.maskVisible) {
      wx.hideLoading()
      this.maskVisible = false
    }
  }

  async run(asyncFn, options = {}) {
    this.show(options)
    try {
      const result = await asyncFn()
      return result
    } catch (error) {
      console.error('[LoadingManager] Error:', error)
      throw error
    } finally {
      this.hide()
    }
  }

  static instance = null

  static getInstance() {
    if (!LoadingManager.instance) {
      LoadingManager.instance = new LoadingManager()
    }
    return LoadingManager.instance
  }
}

module.exports = { LoadingManager }

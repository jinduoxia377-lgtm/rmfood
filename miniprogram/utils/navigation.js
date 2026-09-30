// utils/navigation.js - 统一导航工具类
// 符合微信官方设计规范

const NavigationHelper = {
  /**
   * 返回上一页
   * 官方要求: 所有次级页面需提供返回操作
   */
  goBack(delta = 1) {
    wx.navigateBack({ delta })
  },

  /**
   * 跳转到TabBar页面
   * 官方要求: TabBar页面使用switchTab
   */
  goToTabBar(pagePath) {
    wx.switchTab({ path: pagePath })
  },

  /**
   * 普通页面跳转
   * 官方要求: 预留右上角菜单控件空间
   */
  navigateTo(url, params = {}) {
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    wx.navigateTo({ 
      url: `${url}${query ? '?' + query : ''}`,
      fail: () => this.showError('页面跳转失败')
    })
  },

  /**
   * 重新页面
   */
  redirectTo(url, params = {}) {
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    wx.redirectTo({ 
      url: `${url}${query ? '?' + query : ''}`,
      fail: () => this.showError('页面跳转失败')
    })
  },

  /**
   * 关闭当前页面，跳转到应用内的某个页面
   */
  navigateBack(delta = 1) {
    wx.navigateBack({ delta })
  },

  // ========== 加载状态管理 ==========
  // 官方要求: 及时反馈，减少等待

  showLoading(title = '加载中') {
    wx.showLoading({ title, mask: true })
  },

  hideLoading() {
    wx.hideLoading()
  },

  // ========== 提示消息 ==========
  // 官方要求: 反馈及时，异常可控

  showToast(title, icon = 'none', duration = 1500) {
    wx.showToast({ title, icon, duration })
  },

  showSuccess(title) {
    wx.showToast({ title, icon: 'success', duration: 1500 })
  },

  showError(title) {
    wx.showToast({ title, icon: 'error', duration: 2000 })
  },

  showLoadingToast(title) {
    wx.showLoading({ title, mask: true })
  },

  hideToast() {
    wx.hideToast()
  },

  // ========== 确认对话框 ==========
  // 官方要求: 明确流程，友好礼貌

  confirm(title, content, success = () => {}, fail = () => {}) {
    wx.showModal({
      title,
      content,
      success: (res) => {
        if (res.confirm) success()
        else fail()
      },
      fail: () => fail()
    })
  },

  alert(title, content) {
    wx.showModal({
      title,
      content,
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  // ========== 权限申请 ==========
  // 官方要求: 尊重用户知情权与操作权

  requestLocation(success) {
    wx.getLocation({
      type: 'wgs84',
      success,
      fail: (err) => {
        if (err.errMsg.includes('auth deny')) {
          this.alert('位置权限未授权', '请在设置中开启位置权限')
        }
      }
    })
  },

  chooseImage(maxCount = 9) {
    return new Promise((resolve, reject) => {
      wx.chooseImage({
        count: maxCount,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: resolve,
        fail: reject
      })
    })
  }
}

module.exports = NavigationHelper

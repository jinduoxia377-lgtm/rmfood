// 设置页逻辑
const app = getApp()
const { getThemeManager } = require('../../utils/theme')

Page({
  data: {
    cacheSize: '12.5MB',
    isDarkMode: false,
    showToast: false,
    toastContent: '',
    toastType: 'info'
  },

  themeManager: null,

  onLoad() {
    this.themeManager = getThemeManager()
    this.checkDarkMode()
  },

  onShow() {
    // 确保每次显示时更新主题状态
    this.checkDarkMode()
  },

  checkDarkMode() {
    const isDark = this.themeManager.getCurrentTheme() === 'dark'
    this.setData({ isDarkMode: isDark })
  },

  toggleDarkMode(e) {
    const newTheme = this.themeManager.toggleTheme()
    this.setData({ isDarkMode: newTheme === 'dark' })
    
    wx.showToast({
      title: newTheme === 'dark' ? '已切换深色模式' : '已切换浅色模式',
      icon: 'none',
      duration: 1500
    })
  },

  // 编辑个人资料
  editProfile() {
    wx.navigateTo({
      url: '/pages/profile/edit/index'
    })
  },

  // 修改密码
  changePassword() {
    this.showToast('功能开发中', 'info')
  },

  // 隐私设置
  privacySettings() {
    wx.navigateTo({
      url: '/pages/privacy/settings/index'
    })
  },

  // 清除缓存
  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除所有缓存数据吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          this.setData({ cacheSize: '0MB' })
          this.showToast('缓存已清除', 'success')
        }
      }
    })
  },

  // 导出数据
  exportData() {
    this.showToast('功能开发中', 'info')
  },

  // 关于我们
  goToAbout() {
    wx.showModal({
      title: '关于RMFOOD',
      content: 'RMFOOD是药食同源配方平台，致力于为用户提供科学、精准、个性化的食疗方案。\n\n核心功能：\n• AI智能问诊，生成个性化配方\n• 配料表六维分析，评估食品健康\n• 电商平台同步，一键购买食材',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 隐私政策
  goToPrivacy() {
    wx.navigateTo({
      url: '/pages/privacy/index'
    })
  },

  // 用户协议
  goToAgreement() {
    wx.navigateTo({
      url: '/pages/agreement/index'
    })
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.clearLoginStatus()
          wx.reLaunch({ url: '/pages/index/index' })
        }
      }
    })
  },

  // 返回
  handleBack() {
    wx.navigateBack()
  },

  // 显示Toast
  showToast(content, type = 'info') {
    this.setData({
      showToast: true,
      toastContent: content,
      toastType: type
    })
    
    setTimeout(() => {
      this.setData({ showToast: false })
    }, 2000)
  }
})

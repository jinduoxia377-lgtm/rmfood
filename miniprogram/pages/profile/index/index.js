// 个人中心页面 - 深度开发版
const app = getApp()
const request = require('../../../utils/request.js')
const aiChat = require('../../../utils/ai_chat.js')
const formulaManager = require('../../../utils/formula_manager.js')
const ingredientAnalysis = require('../../../utils/ingredient_analysis.js')

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    statusBarHeight: 0,
    safeAreaBottom: 0,
    menuOpen: false,
    stats: {
      formulaCount: 0,
      favoriteCount: 0,
      analysisCount: 0,
      chatCount: 0
    },
    quickActions: [
      { id: 'analysis', title: '配料分析', icon: 'ingredient', color: '#2D5A3D' },
      { id: 'ai-chat', title: 'AI顾问', icon: 'ai', color: '#1976D2' },
      { id: 'formulas', title: '配方库', icon: 'formula', color: '#E65100' },
      { id: 'history', title: '历史记录', icon: 'history', color: '#7B1FA2' }
    ],
    menuItems: [
      { id: 'formulas', title: '我的配方', desc: '管理您的配方', icon: 'formula', color: '#2D5A3D' },
      { id: 'favorites', title: '我的收藏', desc: '收藏的配方', icon: 'favorite', color: '#E65100' },
      { id: 'history', title: '分析历史', desc: '查看历史分析', icon: 'history', color: '#1976D2' },
      { id: 'settings', title: '设置', desc: '账户与隐私', icon: 'settings', color: '#666666' }
    ]
  },

  onLoad() {
    const systemInfo = wx.getWindowInfo()
    this.setData({ 
      statusBarHeight: systemInfo.statusBarHeight,
      safeAreaBottom: systemInfo.safeArea?.bottom || 0
    })
    this.checkLoginStatus()
  },

  onShow() {
    this.loadUserData()
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    try {
      const userInfo = wx.getStorageSync('user_info') || app.globalData.userInfo
      if (userInfo) {
        this.setData({ 
          userInfo,
          isLoggedIn: true 
        })
        this.loadStats()
      }
    } catch (error) {
      console.error('[Profile] 检查登录状态失败:', error)
    }
  },

  /**
   * 加载用户数据
   */
  loadUserData() {
    this.checkLoginStatus()
  },

  /**
   * 加载统计数据
   */
  async loadStats() {
    try {
      // 加载本地统计
      const formulas = wx.getStorageSync('formulas') || []
      const favorites = wx.getStorageSync('favorites') || []
      const analysisHistory = wx.getStorageSync('analysis_history') || []
      const chatHistory = wx.getStorageSync('chat_history') || []
      
      this.setData({
        stats: {
          formulaCount: formulas.length,
          favoriteCount: favorites.length,
          analysisCount: analysisHistory.length,
          chatCount: chatHistory.length
        }
      })
      
      // 尝试从后端获取统计
      try {
        const statsRes = await request.get('/formulas/statistics')
        if (statsRes) {
          this.setData({
            'stats.formulaCount': statsRes.total_formulas || formulas.length
          })
        }
      } catch (e) {
        // 使用本地数据
      }
    } catch (error) {
      console.error('[Profile] 加载统计失败:', error)
    }
  },

  /**
   * 登录
   */
  async login() {
    try {
      wx.showLoading({ title: '登录中...', mask: true })
      
      // 调用微信登录
      const loginRes = await wx.login()
      if (!loginRes.code) {
        throw new Error('获取登录凭证失败')
      }
      
      // 发送到后端
      const res = await request.post('/auth/wechat/login', {
        code: loginRes.code
      })
      
      if (res && res.user) {
        const userInfo = {
          userId: res.user.id,
          nickname: res.user.nickname || '微信用户',
          avatarUrl: res.user.avatar_url || '',
          phone: res.user.phone || ''
        }
        
        // 保存用户信息
        wx.setStorageSync('user_info', userInfo)
        wx.setStorageSync('access_token', res.access_token)
        app.saveUserInfo(userInfo)
        
        this.setData({
          userInfo,
          isLoggedIn: true
        })
        
        wx.hideLoading()
        wx.showToast({ title: '登录成功', icon: 'success' })
        
        // 加载统计数据
        this.loadStats()
      } else {
        throw new Error('登录响应异常')
      }
      
    } catch (error) {
      console.error('[Profile] 登录失败:', error)
      wx.hideLoading()
      
      // 降级：使用本地模拟登录
      wx.showModal({
        title: '登录提示',
        content: '后端服务暂时不可用，是否使用演示模式登录？',
        success: (res) => {
          if (res.confirm) {
            this.demoLogin()
          }
        }
      })
    }
  },

  /**
   * 演示模式登录
   */
  demoLogin() {
    const demoUser = {
      userId: 'demo_user_' + Date.now(),
      nickname: '演示用户',
      avatarUrl: '',
      phone: ''
    }
    
    wx.setStorageSync('user_info', demoUser)
    app.saveUserInfo(demoUser)
    
    this.setData({
      userInfo: demoUser,
      isLoggedIn: true
    })
    
    wx.showToast({ title: '演示模式已登录', icon: 'none' })
  },

  /**
   * 退出登录
   */
  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地数据
          wx.removeStorageSync('user_info')
          wx.removeStorageSync('access_token')
          app.clearUserInfo()
          
          this.setData({
            userInfo: null,
            isLoggedIn: false,
            stats: {
              formulaCount: 0,
              favoriteCount: 0,
              analysisCount: 0,
              chatCount: 0
            }
          })
          
          wx.showToast({ title: '已退出登录', icon: 'success' })
        }
      }
    })
  },

  /**
   * 编辑昵称
   */
  editNickname() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    
    wx.showModal({
      title: '设置昵称',
      editable: true,
      placeholderText: '请输入昵称（2-20个字符）',
      success: (res) => {
        if (res.confirm && res.content) {
          const nickname = res.content.trim()
          if (nickname.length < 2 || nickname.length > 20) {
            wx.showToast({ title: '昵称长度2-20个字符', icon: 'none' })
            return
          }
          
          const userInfo = { ...this.data.userInfo, nickname }
          wx.setStorageSync('user_info', userInfo)
          app.saveUserInfo(userInfo)
          this.setData({ userInfo })
          
          // 同步到后端
          request.post('/users/profile', { nickname }).catch(e => {
            console.error('同步昵称失败:', e)
          })
        }
      }
    })
  },

  /**
   * 选择头像
   */
  chooseAvatar() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.uploadAvatar(res.tempFiles[0].tempFilePath)
      }
    })
  },

  /**
   * 上传头像
   */
  uploadAvatar(filePath) {
    if (!this.data.isLoggedIn) return
    
    wx.showLoading({ title: '上传中...', mask: true })
    
    request.upload('/users/avatar', filePath)
      .then(res => {
        const userInfo = { ...this.data.userInfo, avatarUrl: res.url }
        wx.setStorageSync('user_info', userInfo)
        app.saveUserInfo(userInfo)
        this.setData({ userInfo })
        wx.hideLoading()
        wx.showToast({ title: '头像已更新', icon: 'success' })
      })
      .catch(err => {
        console.error('上传头像失败:', err)
        wx.hideLoading()
        wx.showToast({ title: '上传失败', icon: 'none' })
      })
  },

  /**
   * 导航到指定页面
   */
  goToPage(e) {
    const page = e.currentTarget.dataset.page
    const urls = {
      'analysis': '/packages/ingredient/pages/analysis/index',
      'ai-chat': '/packages/chat/pages/index/index',
      'formulas': '/packages/formulas/pages/index/index',
      'history': '/pages/profile/history/index',
      'favorites': '/pages/profile/favorites/index',
      'settings': '/pages/settings/index'
    }
    
    if (urls[page]) {
      wx.navigateTo({ url: urls[page] })
    }
  },

  /**
   * 清空缓存
   */
  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除所有缓存数据吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          wx.reLaunch({ url: '/pages/index/index' })
        }
      }
    })
  },

  /**
   * 前往设置
   */
  goToSettings() {
    wx.navigateTo({ url: '/pages/settings/index' })
  },

  /**
   * 切换菜单
   */
  toggleMenu() {
    this.setData({ menuOpen: !this.data.menuOpen })
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: 'RMFOOD - 药食同源配方平台',
      path: '/pages/profile/index/index',
      imageUrl: ''
    }
  }
})

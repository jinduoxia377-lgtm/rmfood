/**
 * RMFOOD 小程序 - 应用入口
 */

const { getGestureNavigator } = require('./utils/gesture_navigator')
const { getCacheManager } = require('./utils/cache_manager')
const { getMicroAnimationManager } = require('./utils/micro_animation')
const { getImageLazyLoader } = require('./utils/image_lazy_loader')
const { getPagePreloader } = require('./utils/page_preloader')
const { getImageCompressor } = require('./utils/image_compressor')
const { getWebSocketManager } = require('./utils/websocket')
const { getOfflineCacheManager } = require('./utils/offline_cache')
const config = require('./config/api')

App({
  globalData: {
    userInfo: null,
    accessToken: null,
    baseUrl: config.baseUrl,
    systemInfo: null,
    platform: 'ios',
    gestureNavigator: null,
    cacheManager: null,
    microAnimationManager: null,
    imageLazyLoader: null,
    pagePreloader: null,
    imageCompressor: null,
    wsManager: null,
    offlineCache: null
  },

  onLaunch() {
    // 获取系统信息（使用新API）
    try {
      const systemInfo = wx.getWindowInfo()
      this.globalData.systemInfo = systemInfo
      this.globalData.platform = systemInfo.platform
      
      // 检查网络状态
      wx.getNetworkType({
        success: (res) => {
          this.globalData.networkType = res.networkType
        }
      })
    } catch (e) {
      console.error('[App] Get system info failed:', e)
    }

    // 初始化手势导航（在页面级别初始化）
    
    // 初始化缓存管理器
    this.initCacheManager()
    
    // 初始化微动效管理器
    this.initMicroAnimationManager()
    
    // 初始化图片懒加载
    this.initImageLazyLoader()
    
    // 初始化页面预加载
    this.initPagePreloader()
    
    // 初始化图片压缩
    this.initImageCompressor()
    
    // 初始化WebSocket
    this.initWebSocketManager()

    // 初始化离线缓存
    this.initOfflineCache()
    
    // 检查登录状态
    this.checkLoginStatus()
    
    // 检查更新
    this.checkUpdate()
  },

  /**
   * 初始化手势导航（已在onLaunch中注释掉，改为页面级别初始化）
   */
  // initGestureNavigator() {
  //   try {
  //     const navigator = getGestureNavigator()
  //     navigator.init(this)
  //     this.globalData.gestureNavigator = navigator
  //     console.log('[App] Gesture navigator initialized')
  //   } catch (e) {
  //     console.error('[App] Init gesture navigator failed:', e)
  //   }
  // },

  /**
   * 初始化缓存管理器
   */
  initCacheManager() {
    try {
      const cacheManager = getCacheManager()
      this.globalData.cacheManager = cacheManager
    } catch (e) {
      console.error('[App] Init cache manager failed:', e)
    }
  },

  /**
   * 初始化微动效管理器
   */
  initMicroAnimationManager() {
    try {
      const manager = getMicroAnimationManager()
      this.globalData.microAnimationManager = manager
    } catch (e) {
      console.error('[App] Init micro animation manager failed:', e)
    }
  },

  /**
   * 初始化图片懒加载管理器
   */
  initImageLazyLoader() {
    try {
      const loader = getImageLazyLoader()
      loader.init()
      this.globalData.imageLazyLoader = loader
    } catch (e) {
      console.error('[App] Init image lazy loader failed:', e)
    }
  },

  /**
   * 初始化页面预加载管理器
   */
  initPagePreloader() {
    try {
      const preloader = getPagePreloader()
      this.globalData.pagePreloader = preloader
    } catch (e) {
      console.error('[App] Init page preloader failed:', e)
    }
  },

  /**
   * 初始化图片压缩管理器
   */
  initImageCompressor() {
    try {
      const compressor = getImageCompressor()
      this.globalData.imageCompressor = compressor
    } catch (e) {
      console.error('[App] Init image compressor failed:', e)
    }
  },

  /**
   * 初始化WebSocket管理器
   */
  initWebSocketManager() {
    try {
      const wsManager = getWebSocketManager()
      this.globalData.wsManager = wsManager
    } catch (e) {
      console.error('[App] Init WebSocket manager failed:', e)
    }
  },

  /**
   * 初始化离线缓存管理器
   */
  initOfflineCache() {
    try {
      const offlineCache = getOfflineCacheManager()
      offlineCache.init()
      this.globalData.offlineCache = offlineCache
    } catch (e) {
      console.error('[App] Init offline cache failed:', e)
    }
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    try {
      const userInfo = wx.getStorageSync('user_info')
      const accessToken = wx.getStorageSync('access_token')
      
      if (userInfo && accessToken) {
        this.globalData.userInfo = userInfo
        this.globalData.accessToken = accessToken
      }
    } catch (e) {
      console.error('[App] Check login status failed:', e)
    }
  },

  /**
   * 检查小程序更新
   */
  checkUpdate() {
    if (!wx.canIUse('getUpdateManager')) {
      return
    }
    
    const updateManager = wx.getUpdateManager()
    
    updateManager.onCheckForUpdate((res) => {
      if (res.hasUpdate) {
      }
    })
    
    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启应用？',
        success: (res) => {
          if (res.confirm) {
            updateManager.applyUpdate()
          }
        }
      })
    })
    
    updateManager.onUpdateFailed(() => {
      console.error('[App] Update failed')
    })
  },

  /**
   * 保存用户信息
   */
  saveUserInfo(userInfo) {
    this.globalData.userInfo = userInfo
    wx.setStorageSync('user_info', userInfo)
  },

  /**
   * 清除用户信息
   */
  clearUserInfo() {
    this.globalData.userInfo = null
    this.globalData.accessToken = null
    wx.removeStorageSync('user_info')
    wx.removeStorageSync('access_token')
  },

  /**
   * 网络变化监听
   */
  onNetworkStatusChange(callback) {
    wx.onNetworkStatusChange(callback)
  }
})

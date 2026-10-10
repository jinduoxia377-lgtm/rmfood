/**
 * RMFOOD 主题管理器
 * 符合微信官方 DarkMode 规范:
 * https://developers.weixin.qq.com/miniprogram/dev/framework/ability/darkmode.html
 *
 * 三层主题机制：
 *   - system: 跟随系统（默认）
 *   - light : 强制浅色
 *   - dark  : 强制深色
 *
 * 应用方式：
 *   1) theme.json（官方格式）负责平台级导航栏/窗口背景的自动切换；
 *   2) @media (prefers-color-scheme: dark) 负责跟随系统时的组件颜色；
 *   3) 本管理器在用户手动切换时，通过根节点类 .theme-dark / .theme-light
 *      （优先级最高）强制覆盖，并同步设置导航栏/窗口颜色。
 *
 * 使用方式：
 *   const { getThemeManager } = require('./theme')
 *   const theme = getThemeManager()
 *   theme.setMode('dark')                 // 设置模式并持久化
 *   theme.applyToPage(this)               // 在页面 onLoad/onShow 调用
 *   const off = theme.onChange(t => {})   // 订阅变化
 */

const THEME_STORAGE_KEY = 'rmfood_theme'
const THEME_MODE_SYSTEM = 'system'
const THEME_MODE_LIGHT = 'light'
const THEME_MODE_DARK = 'dark'

/**
 * 各主题对应的「导航栏 + 窗口背景」视觉值（与 theme.json 保持一致）
 * frontColor 取 white：品牌底色为深绿，浅/深态均用白字。
 */
const THEME_CHROME = {
  light: {
    navBarBackgroundColor: '#2D5A3D',
    navBarTextStyle: 'white',
    frontColor: '#ffffff',
    backgroundColor: '#F5F7FA',
    backgroundColorTop: '#F5F7FA',
    backgroundColorBottom: '#FFFFFF',
    // tabBar：app.json 中的 tabBar 颜色是静态配置，无法跟随主题，
    // 必须通过 wx.setTabBarStyle 在运行时同步（与 app.json 默认浅色值保持一致）
    tabBar: {
      color: '#8E8E93',
      selectedColor: '#007AFF',
      backgroundColor: '#FCFCFE',
      borderStyle: 'white'
    }
  },
  dark: {
    navBarBackgroundColor: '#1A2F20',
    navBarTextStyle: 'white',
    frontColor: '#ffffff',
    backgroundColor: '#0D1117',
    backgroundColorTop: '#0D1117',
    backgroundColorBottom: '#161B22',
    tabBar: {
      color: '#98989D',
      selectedColor: '#0A84FF',
      backgroundColor: '#1C1C1E',
      borderStyle: 'black'
    }
  }
}

class ThemeManager {
  constructor() {
    this._mode = THEME_MODE_SYSTEM
    this._theme = 'light'
    this._listeners = []
    this._inited = false
    this._init()
  }

  /**
   * 初始化：读取本地存储 + 监听系统主题变化
   */
  _init() {
    try {
      const saved = wx.getStorageSync(THEME_STORAGE_KEY)
      if (saved === THEME_MODE_LIGHT || saved === THEME_MODE_DARK || saved === THEME_MODE_SYSTEM) {
        this._mode = saved
      }
    } catch (e) {
      // ignore
    }

    // 同步初始主题
    this._syncTheme()
    this._inited = true

    // 监听系统主题变化（仅 system 模式下自动跟随）
    if (typeof wx.onThemeChange === 'function') {
      wx.onThemeChange(({ theme }) => {
        if (this._mode === THEME_MODE_SYSTEM) {
          this._theme = theme === 'dark' ? 'dark' : 'light'
          this._applyChrome()
          this._notify()
        }
      })
    }
  }

  /**
   * 同步当前主题
   */
  _syncTheme() {
    if (this._mode === THEME_MODE_SYSTEM) {
      let sysTheme = 'light'
      try {
        const info = (typeof wx.getWindowInfo === 'function')
          ? wx.getWindowInfo()
          : wx.getSystemInfoSync()
        sysTheme = (info && info.theme === 'dark') ? 'dark' : 'light'
      } catch (e) {
        sysTheme = 'light'
      }
      this._theme = sysTheme
    } else {
      this._theme = this._mode
    }
  }

  /**
   * 获取当前主题 ('light' | 'dark')
   */
  getTheme() {
    return this._theme
  }

  /**
   * 兼容别名（旧调用方使用 getCurrentTheme）
   */
  getCurrentTheme() {
    return this._theme
  }

  /**
   * 判断是否为深色模式
   */
  isDark() {
    return this._theme === 'dark'
  }

  /**
   * 获取当前模式 (system | light | dark)
   */
  getMode() {
    return this._mode
  }

  /**
   * 返回根节点应绑定的主题类（.theme-dark / .theme-light）
   */
  getThemeClass() {
    return this._theme === 'dark' ? 'theme-dark' : 'theme-light'
  }

  /**
   * 设置主题模式
   * @param {string} mode - 'system' | 'light' | 'dark'
   */
  setMode(mode) {
    if (mode !== THEME_MODE_SYSTEM && mode !== THEME_MODE_LIGHT && mode !== THEME_MODE_DARK) {
      return
    }
    this._mode = mode
    this._syncTheme()
    try {
      wx.setStorageSync(THEME_STORAGE_KEY, this._mode)
    } catch (e) {
      // ignore
    }
    this._applyChrome()
    this._notify()
  }

  /**
   * 切换主题（深色/浅色）
   * @returns {string} 切换后的主题 'light' | 'dark'
   */
  toggle() {
    const next = this._theme === 'dark' ? THEME_MODE_LIGHT : THEME_MODE_DARK
    this.setMode(next)
    return this._theme
  }

  /**
   * 兼容别名（旧调用方使用 toggleTheme）
   */
  toggleTheme() {
    return this.toggle()
  }

  /**
   * 应用导航栏 + 窗口背景色（规范 §6 的公开 API）
   * 内部实现见 _applyChrome()，此处仅为规范要求的公开入口。
   */
  applyChrome() {
    this._applyChrome()
  }

  /**
   * 应用导航栏 + 窗口背景色（按当前解析主题）
   * 与 theme.json 的官方字段保持一致。
   */
  _applyChrome() {
    const chrome = THEME_CHROME[this._theme] || THEME_CHROME.light
    try {
      if (typeof wx.setNavigationBarColor === 'function') {
        wx.setNavigationBarColor({
          frontColor: chrome.frontColor,
          backgroundColor: chrome.navBarBackgroundColor,
          animation: { duration: 300, timingFunc: 'ease' }
        })
      }
      if (typeof wx.setBackgroundColor === 'function') {
        wx.setBackgroundColor({
          backgroundColor: chrome.backgroundColor,
          backgroundColorTop: chrome.backgroundColorTop,
          backgroundColorBottom: chrome.backgroundColorBottom
        })
      }
      // tabBar 跟随主题：app.json 的 tabBar 颜色为静态值且不参与 theme.json，
      // 若不在此同步，深色模式下底部 tabBar 会保持浅色，破坏一致性。
      if (typeof wx.setTabBarStyle === 'function' && chrome.tabBar) {
        wx.setTabBarStyle({
          color: chrome.tabBar.color,
          selectedColor: chrome.tabBar.selectedColor,
          backgroundColor: chrome.tabBar.backgroundColor,
          borderStyle: chrome.tabBar.borderStyle
        })
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * 对单个页面应用主题：
   *   1) setData 根节点主题类（业务 WXML 需绑定 {{themeClass}}）
   *   2) 应用导航栏 + 窗口背景色
   * @param {object} page - 当前 Page 实例（this）
   */
  applyToPage(page) {
    if (!page) return
    const themeClass = this.getThemeClass()
    try {
      if (typeof page.setData === 'function') {
        page.setData({ themeClass })
      }
    } catch (e) {
      // ignore
    }
    this._applyChrome()
  }

  /**
   * 应用全局主题（在 App.onLaunch 调用，确保启动即正确）
   */
  applyTheme() {
    this._syncTheme()
    this._applyChrome()
  }

  /**
   * 注册主题变化监听
   * @param {Function} callback - (theme: 'light'|'dark') => void
   * @returns {Function} 取消监听的函数
   */
  onChange(callback) {
    if (typeof callback === 'function') {
      this._listeners.push(callback)
    }
    return () => {
      const idx = this._listeners.indexOf(callback)
      if (idx > -1) this._listeners.splice(idx, 1)
    }
  }

  /**
   * 通知所有监听者
   */
  _notify() {
    this._listeners.forEach((fn) => {
      try { fn(this._theme) } catch (e) { console.error('[Theme] 回调错误:', e) }
    })
  }
}

// 导出工厂函数（单例）
let _instance = null
function getThemeManager() {
  if (!_instance) _instance = new ThemeManager()
  return _instance
}

module.exports = {
  ThemeManager,
  getThemeManager,
  /** 供 app.js 在 onLaunch 时调用 */
  initTheme: () => getThemeManager()
}

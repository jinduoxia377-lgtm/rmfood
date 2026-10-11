/**
 * RMFOOD 主题管理器
 * 符合微信官方 DarkMode 规范:
 * https://developers.weixin.qq.com/miniprogram/dev/framework/ability/darkmode.html
 *
 * 使用方式:
 *   const { getThemeManager } = require('./theme')
 *   const theme = getThemeManager()
 *   const isDark = theme.isDark()
 *   theme.onChange((t) => console.log('theme:', t))
 */

const THEME_STORAGE_KEY = 'rmfood_theme'
const THEME_MODE_SYSTEM = 'system'
const THEME_MODE_LIGHT  = 'light'
const THEME_MODE_DARK   = 'dark'

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
      if (saved === THEME_MODE_LIGHT || saved === THEME_MODE_DARK) {
        this._mode = saved
      }
    } catch (e) {
    }

    // 同步初始主题
    this._syncTheme()
    this._inited = true

    // 监听系统主题变化
    wx.onThemeChange(({ theme }) => {
      if (this._mode === THEME_MODE_SYSTEM) {
        this._theme = theme || 'light'
        this._notify()
      }
    })
  }

  /**
   * 同步当前主题
   */
  _syncTheme() {
    if (this._mode === THEME_MODE_SYSTEM) {
      try {
        const info = wx.getSystemInfoSync()
        this._theme = info.theme || 'light'
      } catch (e) {
        this._theme = 'light'
      }
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
    }
    this._notify()
  }

  /**
   * 切换主题（深色/浅色）
   */
  toggle() {
    const next = this._theme === 'dark' ? THEME_MODE_LIGHT : THEME_MODE_DARK
    this.setMode(next)
    return this._theme
  }

  /**
   * 注册主题变化监听
   * @param {Function} callback - (theme: 'light'|'dark') => void
   * @returns {Function} 取消监听的函数
   */
  onChange(callback) {
    this._listeners.push(callback)
    return () => {
      const idx = this._listeners.indexOf(callback)
      if (idx > -1) this._listeners.splice(idx, 1)
    }
  }

  /**
   * 通知所有监听者
   */
  _notify() {
    this._listeners.forEach(fn => {
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

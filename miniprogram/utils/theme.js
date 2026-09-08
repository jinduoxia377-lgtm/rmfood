/**
 * 主题管理器
 * 支持浅色/深色模式切换
 */

class ThemeManager {
  constructor() {
    this.currentTheme = 'light'
    this.callbacks = []
    this.init()
  }

  init() {
    // 读取保存的主题
    const saved = wx.getStorageSync('rmfood_theme')
    if (saved) {
      this.setTheme(saved)
    } else {
      // 检测系统主题
      const systemTheme = wx.getSystemInfoSync().theme || 'light'
      this.setTheme(systemTheme)
    }
  }

  setTheme(theme) {
    this.currentTheme = theme
    wx.setStorageSync('rmfood_theme', theme)
    
    // 通知所有监听者
    this.callbacks.forEach(cb => cb(theme))
    
    // 触发全局事件
    wx.triggerEvent && wx.triggerEvent('themeChange', { theme })
  }

  toggleTheme() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light'
    this.setTheme(newTheme)
    return newTheme
  }

  getCurrentTheme() {
    return this.currentTheme
  }

  onThemeChange(callback) {
    this.callbacks.push(callback)
    return () => {
      const index = this.callbacks.indexOf(callback)
      if (index > -1) {
        this.callbacks.splice(index, 1)
      }
    }
  }

  // 获取主题相关的样式变量
  getThemeVariables() {
    if (this.currentTheme === 'dark') {
      return {
        '--color-bg-primary': '#0F172A',
        '--color-bg-secondary': '#1E293B',
        '--color-bg-tertiary': '#334155',
        '--color-text-primary': '#F8FAFC',
        '--color-text-secondary': '#CBD5E1',
        '--color-text-muted': '#94A3B8',
        '--color-border': '#334155',
        '--color-border-strong': '#475569',
        '--color-brand-500': '#4ADE80',
        '--color-brand-400': '#86EFAC',
        '--color-brand-700': '#22C55E'
      }
    }
    return {}
  }
}

// 单例
let instance = null

function getThemeManager() {
  if (!instance) {
    instance = new ThemeManager()
  }
  return instance
}

module.exports = {
  ThemeManager,
  getThemeManager
}

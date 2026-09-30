// utils/visual-helpers.js - 视觉规范工具
// 符合微信官方字体、色板规范

/**
 * 字体大小映射（微信官方标准）
 */
const FontSize = {
  h1: 44,    // 大标题 22pt
  h2: 36,    // 标题 18pt
  h3: 32,    // 副标题 16pt
  body: 28,  // 正文 14pt
  caption: 24, // 辅助文字 12pt
  tiny: 20   // 小字 10pt
}

/**
 * 颜色规范（微信官方色板 + 品牌色扩展）
 */
const Color = {
  // 微信官方色
  primary: '#07C160',       // 微信绿
  secondary: '#1989FA',     // 蓝色
  warning: '#FF976A',       // 橙色
  error: '#EE0A24',         // 红色
  
  // 文本颜色
  textPrimary: '#333333',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textPlaceholder: '#CCCCCC',
  
  // 背景颜色
  bgPage: '#F5F7FA',
  bgCard: '#FFFFFF',
  bgHover: 'rgba(0, 0, 0, 0.04)',
  
  // 边框颜色
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  
  // 阴影
  shadow: '0 2rpx 12rpx rgba(0, 0, 0, 0.08)',
  
  // 品牌色扩展
  brand: {
    50: '#f0f7f2',
    100: '#d9ece1',
    200: '#b3d9c3',
    300: '#7dbfa3',
    400: '#4a7c5c',
    500: '#2D5A3D',  // 主色
    600: '#244a33',
    700: '#1e3d2a',
    800: '#183022',
    900: '#112319'
  }
}

/**
 * 安全区域计算
 * 官方要求: 预留右上角菜单控件空间
 */
const SafeArea = {
  getStatusBarHeight() {
    try {
      const systemInfo = wx.getWindowInfo()
      return systemInfo.statusBarHeight || 20
    } catch (e) {
      return 20
    }
  },

  getNavHeight() {
    // 导航栏高度: 状态栏 + 导航内容区(44px)
    const statusBarHeight = this.getStatusBarHeight()
    return statusBarHeight + 44
  },

  getBottomSafeArea() {
    try {
      const systemInfo = wx.getWindowInfo()
      return systemInfo.safeAreaInsets?.bottom || 0
    } catch (e) {
      return 0
    }
  }
}

/**
 * 触控区域规范
 * 官方要求: 最适宜点击像素尺寸约7mm-9mm
 */
const TouchArea = {
  // 最小点击区域: 44rpx × 44rpx (约11mm × 11mm)
  minTouchSize: 88,
  
  // 推荐点击区域: 56rpx × 56rpx (约14mm × 14mm)
  recommendedTouchSize: 112,
  
  /**
   * 检查触控区域是否合规
   */
  isValidSize(size) {
    return size >= this.minTouchSize
  }
}

module.exports = { FontSize, Color, SafeArea, TouchArea }

/**
 * RMFOOD 设计Token系统
 * 单一设计真相源 - 所有样式从这里引用
 *
 * 设计规范:
 * - 颜色: OKLCH 语义化命名 (brand/surface/content/accent)
 * - 字号: 8rpx 阶梯 (20/24/28/32/40/48/64)
 * - 间距: 8rpx 阶梯 (8/16/24/32/48/64)
 * - 圆角: 8rpx 基准 (0/8/16/24/32/48/full)
 * - 阴影: 5级层级 (xs/sm/md/lg/xl)
 *
 * 对应 app.wxss CSS 变量命名规范
 */

const DESIGN_TOKENS = {
  // ===== 品牌色彩 (Brand Scale) =====
  colors: {
    brand: {
      50:  '#f0f7f2',
      100: '#d9ece1',
      200: '#b3d9c3',
      300: '#7dbfa3',
      400: '#4a7c5c',
      500: '#2D5A3D',  // 主色
      600: '#244a33',
      700: '#1e3d2a',
      800: '#183022',
      900: '#112319'
    },
    accent: {
      50:  '#eff8ff',
      100: '#dbeefe',
      200: '#c2e0ff',
      300: '#99ccff',
      400: '#66adff',
      500: '#1976D2',  // AI蓝
      600: '#1565c0',
      700: '#1152a7',
      800: '#0e3d8a',
      900: '#0a2a6c'
    },
    success: '#22C55E',
    warning: '#F59E0B',
    danger:  '#EF4444',
    info:    '#3B82F6',

    // 中性灰阶
    gray: {
      50:  '#fafafa',
      100: '#f5f5f5',
      200: '#eeeeee',
      300: '#e0e0e0',
      400: '#bdbdbd',
      500: '#9e9e9e',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121'
    },

    // 深色模式中性色 (GitHub Dark 风格)
    darkGray: {
      50:  '#1c2128',
      100: '#161b22',
      200: '#21262d',
      300: '#30363d',
      400: '#484f58',
      500: '#6e7681',
      600: '#8b949e',
      700: '#c9d1d9',
      800: '#e6edf3',
      900: '#ffffff'
    }
  },

  // ===== 字体系统 (Typography Scale) =====
  font: {
    sizes: {
      xs:   '20rpx',
      sm:   '24rpx',
      base: '28rpx',
      md:   '32rpx',
      lg:   '40rpx',
      xl:   '48rpx',
      '2xl':'64rpx',
      '3xl':'96rpx'
    },
    weights: {
      light:   '300',
      regular: '400',
      medium:  '500',
      semibold:'600',
      bold:    '700'
    },
    lineHeights: {
      tight:   '1.25',
      normal:  '1.5',
      relaxed: '1.75'
    },
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
  },

  // ===== 间距系统 (Spacing Scale) =====
  space: {
    0:  '0rpx',
    1:  '8rpx',
    2:  '16rpx',
    3:  '24rpx',
    4:  '32rpx',
    5:  '40rpx',
    6:  '48rpx',
    8:  '64rpx',
    10: '80rpx',
    12: '96rpx',
    16: '128rpx',
    20: '160rpx',
    24: '192rpx',
    32: '256rpx'
  },

  // ===== 圆角系统 (Border Radius) =====
  radius: {
    none: '0rpx',
    sm:   '8rpx',
    md:   '16rpx',
    lg:   '24rpx',
    xl:   '32rpx',
    '2xl':'48rpx',
    full: '50%'
  },

  // ===== 阴影系统 (Elevation Scale) =====
  shadow: {
    none:  'none',
    xs:    '0 2rpx 4rpx rgba(0, 0, 0, 0.04)',
    sm:    '0 2rpx 8rpx rgba(0, 0, 0, 0.05)',
    md:    '0 4rpx 16rpx rgba(0, 0, 0, 0.08)',
    lg:    '0 8rpx 32rpx rgba(0, 0, 0, 0.12)',
    xl:    '0 16rpx 48rpx rgba(0, 0, 0, 0.15)',
    brand: '0 4rpx 24rpx rgba(45, 90, 61, 0.2)'
  },

  // ===== 过渡动画 (Transitions) =====
  transition: {
    fast:  '150ms ease',
    normal:'300ms ease',
    slow:  '500ms ease'
  },

  // ===== 层级 (Z-Index Scale) =====
  zIndex: {
    base:        '1',
    dropdown:    '100',
    sticky:      '200',
    fixed:       '300',
    modal:       '400',
    overlay:     '500',
    toast:       '600',
    notification:'700'
  },

  // ===== 断点 (Breakpoints) =====
  breakpoints: {
    sm: '375px',
    md: '414px',
    lg: '768px',
    xl: '1024px'
  }
}

/**
 * 生成 CSS 变量字符串
 * 严格遵循 app.wxss 中的变量命名规范
 */
function generateCSSVariables() {
  let css = ':root, page {\n'

  // 品牌色
  css += '  /* ===== 品牌色彩 ===== */\n'
  for (const [shade, value] of Object.entries(DESIGN_TOKENS.colors.brand)) {
    css += '  --color-brand-' + shade + ': ' + value + ';\n'
  }

  // AI 强调色
  css += '  /* ===== AI强调色 ===== */\n'
  for (const [shade, value] of Object.entries(DESIGN_TOKENS.colors.accent)) {
    css += '  --color-accent-' + shade + ': ' + value + ';\n'
  }

  // 状态色
  css += '  /* ===== 状态色 ===== */\n'
  css += '  --color-success: ' + DESIGN_TOKENS.colors.success + ';\n'
  css += '  --color-warning: ' + DESIGN_TOKENS.colors.warning + ';\n'
  css += '  --color-danger: ' + DESIGN_TOKENS.colors.danger + ';\n'
  css += '  --color-info: ' + DESIGN_TOKENS.colors.info + ';\n'

  // 中性色（亮色）
  css += '  /* ===== 中性色 ===== */\n'
  for (const [shade, value] of Object.entries(DESIGN_TOKENS.colors.gray)) {
    css += '  --color-gray-' + shade + ': ' + value + ';\n'
  }

  // 语义化文本色
  css += '  /* ===== 语义化文本 ===== */\n'
  css += '  --color-text-primary: var(--color-gray-900);\n'
  css += '  --color-text-secondary: var(--color-gray-700);\n'
  css += '  --color-text-tertiary: var(--color-gray-500);\n'
  css += '  --color-text-placeholder: var(--color-gray-400);\n'
  css += '  --color-text-disabled: var(--color-gray-300);\n'
  css += '  --color-text-inverse: #ffffff;\n'

  // 背景色
  css += '  /* ===== 背景色 ===== */\n'
  css += '  --color-bg-page: var(--color-gray-50);\n'
  css += '  --color-bg-card: #ffffff;\n'
  css += '  --color-bg-elevated: #ffffff;\n'
  css += '  --color-bg-tertiary: var(--color-gray-100);\n'
  css += '  --color-bg-hover: var(--color-gray-100);\n'
  css += '  --color-bg-active: var(--color-gray-200);\n'
  css += '  --color-bg-overlay: rgba(0, 0, 0, 0.5);\n'

  // 边框色
  css += '  /* ===== 边框色 ===== */\n'
  css += '  --color-border: var(--color-gray-200);\n'
  css += '  --color-border-light: var(--color-gray-100);\n'
  css += '  --color-border-dark: var(--color-gray-300);\n'
  css += '  --color-border-focus: var(--color-brand-500);\n'

  // 状态色背景
  css += '  /* ===== 状态色背景 ===== */\n'
  css += '  --color-success-bg: rgba(34, 197, 94, 0.1);\n'
  css += '  --color-warning-bg: rgba(245, 158, 11, 0.1);\n'
  css += '  --color-danger-bg: rgba(239, 68, 68, 0.1);\n'
  css += '  --color-info-bg: rgba(59, 130, 246, 0.1);\n'

  // 间距
  css += '  /* ===== 间距 ===== */\n'
  for (const [key, value] of Object.entries(DESIGN_TOKENS.space)) {
    css += '  --space-' + key + ': ' + value + ';\n'
  }

  // 圆角
  css += '  /* ===== 圆角 ===== */\n'
  for (const [key, value] of Object.entries(DESIGN_TOKENS.radius)) {
    css += '  --radius-' + key + ': ' + value + ';\n'
  }

  // 阴影
  css += '  /* ===== 阴影 ===== */\n'
  for (const [key, value] of Object.entries(DESIGN_TOKENS.shadow)) {
    css += '  --shadow-' + key + ': ' + value + ';\n'
  }

  // 字号
  css += '  /* ===== 字号 ===== */\n'
  for (const [key, value] of Object.entries(DESIGN_TOKENS.font.sizes)) {
    css += '  --font-size-' + key + ': ' + value + ';\n'
  }

  // 字重
  css += '  /* ===== 字重 ===== */\n'
  for (const [key, value] of Object.entries(DESIGN_TOKENS.font.weights)) {
    css += '  --font-weight-' + key + ': ' + value + ';\n'
  }

  // 行高
  css += '  /* ===== 行高 ===== */\n'
  css += '  --line-height-tight: ' + DESIGN_TOKENS.font.lineHeights.tight + ';\n'
  css += '  --line-height-normal: ' + DESIGN_TOKENS.font.lineHeights.normal + ';\n'
  css += '  --line-height-relaxed: ' + DESIGN_TOKENS.font.lineHeights.relaxed + ';\n'

  // 过渡
  css += '  /* ===== 过渡 ===== */\n'
  for (const [key, value] of Object.entries(DESIGN_TOKENS.transition)) {
    css += '  --transition-' + key + ': ' + value + ';\n'
  }

  // 基础样式
  css += '  /* ===== 基础样式 ===== */\n'
  css += '  background-color: var(--color-bg-page);\n'
  css += '  font-family: ' + DESIGN_TOKENS.font.family + ';\n'
  css += '  font-size: var(--font-size-base);\n'
  css += '  color: var(--color-text-primary);\n'
  css += '  line-height: var(--line-height-normal);\n'
  css += '  -webkit-tap-highlight-color: transparent;\n'

  css += '}\n'

  return css
}

/**
 * 生成深色模式 CSS 变量覆盖
 */
function generateDarkCSSVariables() {
  let css = '@media (prefers-color-scheme: dark) {\npage {\n'

  // 深色背景
  css += '  /* ===== 深色背景 ===== */\n'
  css += '  --color-bg-page: #0D1117;\n'
  css += '  --color-bg-card: #161B22;\n'
  css += '  --color-bg-elevated: #161B22;\n'
  css += '  --color-bg-tertiary: #1c2128;\n'
  css += '  --color-bg-hover: #21262d;\n'
  css += '  --color-bg-active: #292e36;\n'
  css += '  --color-bg-overlay: rgba(0, 0, 0, 0.7);\n'

  // 深色文本
  css += '  /* ===== 深色文本 ===== */\n'
  css += '  --color-text-primary: #e6edf3;\n'
  css += '  --color-text-secondary: #c9d1d9;\n'
  css += '  --color-text-tertiary: #8b949e;\n'
  css += '  --color-text-placeholder: #484f58;\n'
  css += '  --color-text-disabled: #30363d;\n'

  // 深色边框
  css += '  /* ===== 深色边框 ===== */\n'
  css += '  --color-border: #30363d;\n'
  css += '  --color-border-light: #21262d;\n'
  css += '  --color-border-dark: #484f58;\n'

  // 深色阴影
  css += '  /* ===== 深色阴影 ===== */\n'
  css += '  --shadow-xs: 0 2rpx 4rpx rgba(0, 0, 0, 0.3);\n'
  css += '  --shadow-sm: 0 2rpx 8rpx rgba(0, 0, 0, 0.35);\n'
  css += '  --shadow-md: 0 4rpx 16rpx rgba(0, 0, 0, 0.4);\n'
  css += '  --shadow-lg: 0 8rpx 32rpx rgba(0, 0, 0, 0.5);\n'
  css += '  --shadow-xl: 0 16rpx 48rpx rgba(0, 0, 0, 0.6);\n'

  css += '}\n}\n'

  return css
}

module.exports = {
  TOKENS: DESIGN_TOKENS,
  generateCSS: generateCSSVariables,
  generateDarkCSS: generateDarkCSSVariables
}

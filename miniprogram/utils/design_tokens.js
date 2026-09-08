/**
 * RMFOOD 设计Token系统
 * 单一设计真相源 - 所有样式从这里引用
 */

const DESIGN_TOKENS = {
  // ===== 品牌色彩 =====
  colors: {
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
    },
    accent: {
      50: '#eff8ff',
      100: '#dbeefe',
      200: '#bakbe7',
      300: '#7dabf7',
      400: '#4d94ef',
      500: '#1976D2',  // AI蓝
      600: '#1565c0',
      700: '#1152a7',
      800: '#0e3d8a',
      900: '#0a2a6c'
    },
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
    
    // 中性色
    gray: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#eeeeee',
      300: '#e0e0e0',
      400: '#bdbdbd',
      500: '#9e9e9e',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121'
    }
  },
  
  // ===== 字体系统 =====
  font: {
    sizes: {
      xs: '20rpx',
      sm: '24rpx',
      base: '28rpx',
      md: '32rpx',
      lg: '40rpx',
      xl: '48rpx',
      '2xl': '64rpx',
      '3xl': '96rpx'
    },
    weights: {
      light: '300',
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700'
    },
    lineHeights: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75'
    },
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
  },
  
  // ===== 间距系统 =====
  space: {
    0: '0rpx',
    1: '8rpx',
    2: '16rpx',
    3: '24rpx',
    4: '32rpx',
    5: '40rpx',
    6: '48rpx',
    8: '64rpx',
    10: '80rpx',
    12: '96rpx',
    16: '128rpx',
    20: '160rpx',
    24: '192rpx',
    32: '256rpx'
  },
  
  // ===== 圆角系统 =====
  radius: {
    none: '0rpx',
    sm: '8rpx',
    md: '16rpx',
    lg: '24rpx',
    xl: '32rpx',
    '2xl': '48rpx',
    full: '50%'
  },
  
  // ===== 阴影系统 =====
  shadow: {
    none: 'none',
    xs: '0 2rpx 4rpx rgba(0, 0, 0, 0.04)',
    sm: '0 2rpx 8rpx rgba(0, 0, 0, 0.05)',
    md: '0 4rpx 16rpx rgba(0, 0, 0, 0.08)',
    lg: '0 8rpx 32rpx rgba(0, 0, 0, 0.12)',
    xl: '0 16rpx 48rpx rgba(0, 0, 0, 0.15)',
    brand: '0 4rpx 24rpx rgba(45, 90, 61, 0.2)'
  },
  
  // ===== 过渡动画 =====
  transition: {
    fast: '150ms ease',
    normal: '300ms ease',
    slow: '500ms ease'
  },
  
  // ===== 断点 =====
  breakpoints: {
    sm: '375px',
    md: '414px',
    lg: '768px',
    xl: '1024px'
  },
  
  // ===== 层级 =====
  zIndex: {
    base: '1',
    dropdown: '100',
    sticky: '200',
    fixed: '300',
    modal: '400',
    overlay: '500',
    toast: '600',
    notification: '700'
  }
}

// 生成CSS变量字符串
function generateCSSVariables() {
  let css = ':root, page {\n'
  
  // 颜色变量
  css += '  /* ===== 品牌色彩 ===== */\n'
  for (const [shade, value] of Object.entries(DESIGN_TOKENS.colors.brand)) {
    css += `  --color-brand-${shade}: ${value};\n`
  }
  css += '  --color-primary: var(--color-brand-500);\n'
  css += '  --color-primary-light: var(--color-brand-400);\n'
  css += '  --color-primary-dark: var(--color-brand-700);\n'
  
  css += '\n  /* ===== AI强调色 ===== */\n'
  for (const [shade, value] of Object.entries(DESIGN_TOKENS.colors.accent)) {
    css += `  --color-accent-${shade}: ${value};\n`
  }
  css += '  --color-accent: var(--color-accent-500);\n'
  
  css += `\n  /* ===== 状态色 ===== */\n`
  css += `  --color-success: ${DESIGN_TOKENS.colors.success};\n`
  css += `  --color-warning: ${DESIGN_TOKENS.colors.warning};\n`
  css += `  --color-danger: ${DESIGN_TOKENS.colors.danger};\n`
  css += `  --color-info: ${DESIGN_TOKENS.colors.info};\n`
  
  css += '\n  /* ===== 中性色 ===== */\n'
  for (const [shade, value] of Object.entries(DESIGN_TOKENS.colors.gray)) {
    css += `  --color-gray-${shade}: ${value};\n`
  }
  
  // 语义化颜色
  css += '\n  /* ===== 语义化颜色 ===== */\n'
  css += '  --color-text-primary: var(--color-gray-900);\n'
  css += '  --color-text-secondary: var(--color-gray-700);\n'
  css += '  --color-text-muted: var(--color-gray-500);\n'
  css += '  --color-text-disabled: var(--color-gray-400);\n'
  css += '  --color-text-inverse: #ffffff;\n'
  
  css += '\n  --color-bg-primary: var(--color-gray-50);\n'
  css += '  --color-bg-secondary: #ffffff;\n'
  css += '  --color-bg-tertiary: var(--color-gray-100);\n'
  css += '  --color-bg-elevated: #ffffff;\n'
  css += '  --color-bg-overlay: rgba(0, 0, 0, 0.5);\n'
  
  css += '\n  --color-border: var(--color-gray-200);\n'
  css += '  --color-border-strong: var(--color-gray-300);\n'
  css += '  --color-border-focus: var(--color-primary);\n'
  
  // 间距变量
  css += '\n  /* ===== 间距 ===== */\n'
  for (const [key, value] of Object.entries(DESIGN_TOKENS.space)) {
    css += `  --space-${key}: ${value};\n`
  }
  
  // 圆角变量
  css += '\n  /* ===== 圆角 ===== */\n'
  for (const [key, value] of Object.entries(DESIGN_TOKENS.radius)) {
    css += `  --radius-${key}: ${value};\n`
  }
  
  // 阴影变量
  css += '\n  /* ===== 阴影 ===== */\n'
  for (const [key, value] of Object.entries(DESIGN_TOKENS.shadow)) {
    css += `  --shadow-${key}: ${value};\n`
  }
  
  // 字号变量
  css += '\n  /* ===== 字号 ===== */\n'
  for (const [key, value] of Object.entries(DESIGN_TOKENS.font.sizes)) {
    css += `  --font-size-${key}: ${value};\n`
  }
  
  // 字重变量
  css += '\n  /* ===== 字重 ===== */\n'
  for (const [key, value] of Object.entries(DESIGN_TOKENS.font.weights)) {
    css += `  --font-weight-${key}: ${value};\n`
  }
  
  // 过渡变量
  css += '\n  /* ===== 过渡 ===== */\n'
  for (const [key, value] of Object.entries(DESIGN_TOKENS.transition)) {
    css += `  --transition-${key}: ${value};\n`
  }
  
  // 基础样式
  css += '\n  /* ===== 基础样式 ===== */\n'
  css += `  background-color: var(--color-bg-primary);\n`
  css += `  font-family: ${DESIGN_TOKENS.font.family};\n`
  css += `  font-size: var(--font-size-base);\n`
  css += `  color: var(--color-text-primary);\n`
  css += `  line-height: var(--line-height-normal);\n`
  css += `  -webkit-tap-highlight-color: transparent;\n`
  
  css += '}\n'
  
  return css
}

module.exports = {
  TOKENS: DESIGN_TOKENS,
  generateCSS: generateCSSVariables
}

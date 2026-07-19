/**
 * RMFOOD 设计令牌系统 (Design Tokens) - 完整规范
 *
 * 本文档整合了项目所有的设计标准：
 * - 排版系统 (Typography)
 * - 色彩系统 (Colors)
 * - 间距系统 (Spacing)
 * - 图标规范 (Icons)
 * - 按钮系统 (Buttons)
 * - 圆角与阴影 (Radius & Shadows)
 * - 动效规范 (Animation)
 * - 响应式断点 (Breakpoints)
 *
 * 使用方式：在组件中引用CSS变量或工具类
 * 示例：<h1 className="text-headline-lg">标题</h1>
 */

// ============================================================================
// 1. 排版系统 (Typography System)
// ============================================================================

/**
 * 字体族
 */
export const FONT_FAMILIES = {
  sans: "'Noto Sans SC', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  serif: "'Noto Serif SC', Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Consolas', Monaco, monospace",
} as const;

/**
 * 字体大小层级 (12级)
 * 基于 Major Third (1.250) 比例 | 基准: 16px
 */
export const FONT_SIZES = {
  // Display 超大标题 (57-45px)
  display: '3.5625rem', // 57px - 品牌展示/英雄区
  'display-sm': '2.8125rem', // 45px - 大屏主标题

  // Headline 主标题 (36-24px)
  'headline-lg': '2.25rem', // 36px - 页面主标题 H1
  'headline-md': '1.75rem', // 28px - 章节标题 H2
  'headline-sm': '1.5rem', // 24px - 子章节 H3

  // Title 次级标题 (22-14px)
  'title-lg': '1.375rem', // 22px - 卡片标题 H4
  'title-md': '1rem', // 16px - 强调文本
  'title-sm': '0.875rem', // 14px - 小标题

  // Body 正文 (16-12px)
  'body-lg': '1rem', // 16px - 大正文/基础字号
  'body-md': '0.875rem', // 14px - 标准正文 ⭐️ **最常用**
  'body-sm': '0.75rem', // 12px - 辅助说明

  // Label 标签 (14-11px)
  'label-lg': '0.875rem', // 14px - 大标签
  'label-md': '0.75rem', // 12px - 表单标签
  'label-sm': '0.6875rem', // 11px - 徽章/角标
} as const;

/**
 * 行高规范 (基于字体大小的比例)
 */
export const LINE_HEIGHTS = {
  display: '1.12', // 紧凑行高适合超大字
  'display-sm': '1.16',
  'headline-lg': '1.22', // 标题适中行高
  'headline-md': '1.28',
  'headline-sm': '1.33',
  'title-lg': '1.36',
  'title-md': '1.5', // ✅ **正文推荐行高**
  'title-sm': '1.43',
  'body-lg': '1.5', // ✅ **正文推荐行高**
  'body-md': '1.43',
  'body-sm': '1.33',
  'label-lg': '1.43',
  'label-md': '1.33',
  'label-sm': '1.45',
} as const;

/**
 * 字重层级
 */
export const FONT_WEIGHTS = {
  regular: '400', // 正文
  medium: '500', // 标签/强调
  semibold: '600', // 小标题
  bold: '700', // 主标题
} as const;

/**
 * 字间距 (Letter Spacing)
 */
export const LETTER_SPACING = {
  display: '-0.025em', // 负字距增强可读性
  'display-sm': '-0.02em',
  'headline-lg': '-0.015em',
  'headline-md': '-0.01em',
  default: '0', // 默认无额外间距
  'body-lg': '0.0015em',
  'body-sm': '0.002em',
  'label-lg': '0.01em',
  'label-md': '0.015em',
  'label-sm': '0.025em', // 大写字距提升小字识别度
} as const;

// ============================================================================
// 2. 色彩系统 (Color System)
// ============================================================================

/**
 * 品牌主色 - Forest Green 森林绿 (#28A745)
 * 设计系统文档 v1.0 指定值
 * 传达：健康、天然、安全、活力、专业
 * 用途：主操作按钮、成功状态、自然与健康主题
 */
export const BRAND_COLORS = {
  primary: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#4ADE80',
    400: '#4ADE80',
    500: '#34C759',
    600: '#28A745',
    700: '#1E8E3E',
    800: '#1E8E3E',
    900: '#0D4F28',
    // 别名（符合文档规范）
    main: '#34C759' /* ✅ Emerald-500 主色 */,
    hover: '#28A745' /* Hover状态 (600) */,
    light: '#4ADE80' /* 浅色变体 (300) */,
    dark: '#1E8E3E' /* 深色变体 (700) */,
    contrastText: '#ffffff',
  },
} as const;

/**
 * 品牌辅色 - Ocean Blue 海洋蓝 (#007AFF)
 * 设计系统文档 v1.0 指定值
 * 传达：科技、精确、信赖、专业
 * 用途：信息链接、次要操作、数据可视化
 */
export const SECONDARY_COLORS = {
  secondary: {
    50: '#F0F7FF',
    100: '#E8F4FD',
    200: '#D2EFFF',
    300: '#A8DFFF',
    400: '#6ECAFF',
    500: '#007AFF',
    600: '#0056B3',
    700: '#003E87',
    800: '#002A60',
    900: '#172554',
    main: '#007AFF' /* ✅ Ocean Blue 主色 */,
    hover: '#0056B3' /* Hover状态 */,
    light: '#A8DFFF' /* 浅色变体 */,
    dark: '#003E87' /* 深色变体 */,
    contrastText: '#ffffff',
  },
} as const;

/**
 * 强调色 - Bio Purple 生物紫 (#AF52DE)
 * 设计系统文档 v1.0 指定值
 * 传达：AI功能、智能、创新、未来感
 * 用途：AI相关功能、智能推荐、创新特性
 */
export const ACCENT_COLORS = {
  accent: {
    50: '#FAF5FF',
    100: '#F3E8FF',
    200: '#E8D5FF',
    300: '#D4B3FF',
    400: '#C090FF',
    500: '#AF52DE',
    600: '#AF52DE',
    700: '#AF52DE',
    800: '#8B5CF6',
    900: '#3B0764',
    main: '#AF52DE' /* ✅ Bio Purple 主色 */,
    hover: '#AF52DE' /* Hover状态 */,
    light: '#D4B3FF' /* 浅色变体 */,
    dark: '#AF52DE' /* 深色变体 */,
    contrastText: '#ffffff',
  },
} as const;

/**
 * 中性色 - Slate 灰阶
 * 用于文本、背景、边框等非品牌元素
 */
export const NEUTRAL_COLORS = {
  slate: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    // 语义化别名
    white: '#FFFFFF',
    black: '#000000',
    background: { light: '#FFFFFF', dark: '#111827' },
    surface: { light: '#F9FAFB', dark: '#1F2937' },
    text: {
      primary: { light: '#111827', dark: '#F3F4F6' }, // ✅ WCAG AAA (15:1 / 13.5:1)
      secondary: { light: '#374151', dark: '#D1D5DB' }, // ✅ WCAG AAA (9.6:1 / 9.2:1)
      disabled: { light: '#9CA3AF', dark: '#9CA3AF' }, // ⚠️ 仅装饰性
    },
    border: {
      default: { light: '#D1D5DB', dark: '#4B5563' }, // ✅ 可见 (2.6:1 / 3.2:1)
      focus: { light: '#007AFF', dark: '#6ECAFF' }, // ✅ AA达标
    },
  },
} as const;

/**
 * 功能色 (Functional Colors)
 */
export const FUNCTIONAL_COLORS = {
  success: {
    main: '#34C759',
    bg: '#F0FDF4',
    text: '#1E8E3E',
    light: '#4ADE80',
    dark: '#1E8E3E',
  },
  warning: {
    main: '#FF9F0A',
    bg: '#FFF8E1',
    text: '#B45309',
    light: '#FFB340',
    dark: '#B45309',
  },
  error: {
    main: '#FF3B30',
    bg: '#FFF0F0',
    text: '#B91C1C',
    light: '#FF8080',
    dark: '#B91C1C',
  },
  info: {
    main: '#007AFF',
    bg: '#F0F7FF',
    text: '#003E87',
    light: '#A8DFFF',
    dark: '#0056B3',
  },
} as const;

// ============================================================================
// 3. 间距系统 (Spacing System)
// ============================================================================

/**
 * 基于 4pt 基准网格 (Material Design 标准)
 */
export const SPACING = {
  0: '0',
  0.5: '0.125rem', // 2px
  1: '0.25rem', // 4px - 最小间距
  1.5: '0.375rem', // 6px
  2: '0.5rem', // 8px - 紧凑元素间距
  2.5: '0.625rem', // 10px
  3: '0.75rem', // 12px - 相关元素组内
  4: '1rem', // 16px - 标准间距 ⭐️ **最常用**
  5: '1.25rem', // 20px - 区块间距
  6: '1.5rem', // 24px - 章节间距
  8: '2rem', // 32px - 大区块间距
  10: '2.5rem', // 40px - 容器内边距
  12: '3rem', // 48px - 大容器内边距
  16: '4rem', // 64px - 页面级间距
  20: '5rem', // 80px - 特殊用途
} as const;

/**
 * 常用间距场景速查
 */
export const SPACING_USAGE = {
  // 元素内部
  iconToText: '0.5rem', // 图标与文字间
  buttonPadding: '0.75rem 1.5rem', // 按钮内边距
  inputPadding: '0.75rem 1rem', // 输入框内边距
  cardPadding: '1.5rem', // 卡片内边距

  // 元素之间
  inlineItems: '0.5rem', // 行内元素间距
  listItemGap: '0.75rem', // 列表项间距
  sectionGap: '2rem', // 章节间距
  cardGap: '1.5rem', // 卡片网格间距

  // 布局
  containerPadding: '1.5rem', // 容器内边距
  sidebarWidth: '16rem', // 侧边栏宽度
  headerHeight: '4rem', // 顶栏高度
} as const;

// ============================================================================
// 4. 图标规范 (Icon Standards)
// ============================================================================

/**
 * 图标尺寸标准
 * 使用 Lucide React Icons (stroke-based)
 */
export const ICON_SIZES = {
  xs: '14px', // 14px - 极小场景(徽章、紧凑列表)
  sm: '16px', // 16px - 小图标(按钮内联、表格操作)
  md: '20px', // 20px - 中图标(导航、菜单项) ⭐️ **最常用**
  lg: '24px', // 24px - 大图标(功能入口、空状态)
  xl: '32px', // 32px - 特大图标(Hero区域、特色功能)
  '2xl': '40px', // 40px - 超大图标(品牌标识、装饰)
} as const;

/**
 * 图标使用场景规范
 */
export const ICON_USAGE = {
  navigation: {
    size: ICON_SIZES.md,
    strokeWidth: 2,
    description: '侧边栏/顶部导航图标',
  },
  button: {
    size: ICON_SIZES.sm,
    strokeWidth: 2,
    description: '按钮内的操作图标',
  },
  status: {
    size: ICON_SIZES.md,
    strokeWidth: 2,
    description: '状态指示(成功/错误/警告)',
  },
  action: {
    size: ICON_SIZES.lg,
    strokeWidth: 1.5,
    description: '主要操作(新建/编辑/删除)',
  },
  decorative: {
    size: ICON_SIZES.xl,
    strokeWidth: 1,
    description: '装饰性图标(Hero背景)',
  },
} as const;

/**
 * 触摸目标要求
 * 最小点击区域: 44×44px (iOS) / 48×48dp (Android)
 */
export const TOUCH_TARGET = {
  minSize: '44px',
  minSizeAndroid: '48px',
  iconWithHitArea: {
    visualSize: ICON_SIZES.md, // 图标视觉尺寸
    hitAreaSize: '44px', // 实际可点击区域
    padding: '12px', // 扩展的内边距
  },
} as const;

// ============================================================================
// 5. 按钮系统 (Button System)
// ============================================================================

/**
 * 按钮尺寸变体
 */
export const BUTTON_SIZES = {
  sm: {
    height: '32px',
    padding: '0.5rem 1rem', // 8px 16px
    fontSize: FONT_SIZES['label-md'],
    borderRadius: '0.375rem', // 6px
    iconSize: ICON_SIZES.sm,
    minWidth: undefined, // 无最小宽度限制
  },
  md: {
    height: '40px', // ⭐️ **最常用**
    padding: '0.625rem 1.25rem', // 10px 20px
    fontSize: FONT_SIZES['body-md'],
    borderRadius: '0.5rem', // 8px
    iconSize: ICON_SIZES.sm,
    minWidth: undefined,
  },
  lg: {
    height: '48px',
    padding: '0.75rem 1.5rem', // 12px 24px
    fontSize: FONT_SIZES['body-lg'],
    borderRadius: '0.5rem', // 8px
    iconSize: ICON_SIZES.md,
    minWidth: '120px', // 大按钮最小宽度
  },
  xl: {
    height: '56px',
    padding: '1rem 2rem', // 16px 32px
    fontSize: FONT_SIZES['title-md'],
    borderRadius: '0.75rem', // 12px
    iconSize: ICON_SIZES.lg,
    minWidth: '160px',
  },
} as const;

/**
 * 按钮样式变体
 */
export const BUTTON_VARIANTS = {
  primary: {
    bg: 'var(--primary)',
    color: '#ffffff',
    hoverBg: 'var(--primary-hover)',
    activeBg: 'var(--primary-dark)',
    borderColor: 'transparent',
    shadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.06)',
  },
  secondary: {
    bg: 'transparent',
    color: 'var(--primary)',
    hoverBg: 'rgba(34, 197, 94, 0.08)', // primary-10
    activeBg: 'rgba(34, 197, 94, 0.16)', // primary-20
    borderColor: 'var(--primary)',
    shadow: 'none',
  },
  ghost: {
    bg: 'transparent',
    color: 'var(--text-secondary)',
    hoverBg: 'var(--bg-secondary)',
    activeBg: 'var(--bg-hover)',
    borderColor: 'transparent',
    shadow: 'none',
  },
  danger: {
    bg: 'var(--error)',
    color: '#ffffff',
    hoverBg: '#B91C1C',
    activeBg: '#B91C1C',
    borderColor: 'transparent',
    shadow: '0 1px 3px rgba(239, 68, 68, 0.18)',
  },
} as const;

/**
 * 按钮状态
 */
export const BUTTON_STATES = {
  default: {
    opacity: '1',
    cursor: 'pointer',
    transform: 'none',
  },
  hover: {
    opacity: '1',
    cursor: 'pointer',
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
  active: {
    opacity: '0.95',
    cursor: 'pointer',
    transform: 'translateY(0) scale(0.98)',
  },
  disabled: {
    opacity: '0.5',
    cursor: 'not-allowed',
    transform: 'none',
    pointerEvents: 'none',
  },
  loading: {
    opacity: '0.7',
    cursor: 'wait',
    pointerEvents: 'none',
  },
} as const;

// ============================================================================
// 6. 圆角与阴影 (Radius & Shadows)
// ============================================================================

/**
 * 圆角标准 (Border Radius)
 */
export const BORDER_RADIUS = {
  none: '0',
  xs: '0.125rem', // 2px - 微妙圆角
  sm: '0.25rem', // 4px - 小圆角(输入框、标签)
  md: '0.5rem', // 8px - 中圆角(按钮、卡片) ⭐️ **最常用**
  lg: '0.75rem', // 12px - 大圆角(模态框、面板)
  xl: '1rem', // 16px - 超大圆角(特殊卡片)
  '2xl': '1.5rem', // 24px - 全圆角(头像、徽章)
  full: '9999px', // 完全圆形(药丸形状)
} as const;

/**
 * 阴影层次 (Box Shadows Elevation)
 */
export const SHADOWS = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)', // 浅阴影(悬浮提示)
  DEFAULT: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)', // 标准阴影(卡片)
  md: '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)', // 中阴影(下拉菜单)
  lg: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)', // 大阴影(模态框)
  xl: '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)', // 超大阴影(弹窗)

  // 特殊阴影
  glow: '0 0 20px rgba(34, 197, 94, 0.3)', // 发光效果
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)', // 内阴影(按下状态)
} as const;

// ============================================================================
// 7. 动效规范 (Animation)
// ============================================================================

export const ANIMATION = {
  duration: {
    instant: '0ms', // 即时响应
    fast: '100ms', // 快速反馈(按钮按下)
    normal: '200ms', // 标准过渡(hover/focus)
    slow: '300ms', // 慢速动画(展开/收起)
    verySlow: '500ms', // 特殊效果(页面切换)
  },
  easing: {
    easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)', // 退出加速(推荐进入)
    easeIn: 'cubic-bezier(0.7, 0, 0.84, 1)', // 进入减速(推荐退出)
    easeInOut: 'cubic-bezier(0.87, 0, 0.13, 1)', // 平滑双向
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', // 弹性效果
  },
  themeTransition: {
    duration: '250ms', // 主题切换时长
    easing: 'easeInOut',
  },
} as const;

// ============================================================================
// 8. 响应式断点 (Responsive Breakpoints)
// ============================================================================

export const BREAKPOINTS = {
  xs: '320px', // 小手机
  sm: '375px', // 标准手机 (iPhone SE)
  md: '768px', // 平板竖屏 (iPad)
  lg: '1024px', // 平板横屏/小笔记本
  xl: '1280px', // 桌面 (MacBook Pro)
  '2xl': '1440px', // 大桌面 (Full HD)
  '3xl': '1920px', // 超大桌面 (2K)
} as const;

/**
 * 布局最大宽度
 */
export const LAYOUT_MAX_WIDTHS = {
  content: '1200px', // 内容区最大宽度
  sidebar: '280px', // 侧边栏固定宽度
  header: '72px', // 顶部栏高度
  footer: 'auto', // 页脚自适应
} as const;

// ============================================================================
// 导出默认配置
// ============================================================================

export const DESIGN_SYSTEM = {
  fonts: FONT_FAMILIES,
  sizes: FONT_SIZES,
  lineHeights: LINE_HEIGHTS,
  weights: FONT_WEIGHTS,
  letterSpacings: LETTER_SPACING,
  colors: {
    brand: BRAND_COLORS,
    secondary: SECONDARY_COLORS,
    accent: ACCENT_COLORS,
    neutral: NEUTRAL_COLORS,
    functional: FUNCTIONAL_COLORS,
  },
  spacing: SPACING,
  spacingUsage: SPACING_USAGE,
  icons: {
    sizes: ICON_SIZES,
    usage: ICON_USAGE,
    touchTarget: TOUCH_TARGET,
  },
  buttons: {
    sizes: BUTTON_SIZES,
    variants: BUTTON_VARIANTS,
    states: BUTTON_STATES,
  },
  radius: BORDER_RADIUS,
  shadows: SHADOWS,
  animation: ANIMATION,
  breakpoints: BREAKPOINTS,
  layout: LAYOUT_MAX_WIDTHS,
} as const;

export default DESIGN_SYSTEM;

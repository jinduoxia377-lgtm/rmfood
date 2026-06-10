/**
 * RMFOOD 配方平台 - 专业级主题系统类型定义
 * 基于 UI/UX Pro Max 设计标准
 * 符合 WCAG 2.1 AA/AAA 无障碍标准
 */

// ============================================================================
// 主题模式枚举
// ============================================================================

/** 主题模式类型 */
export type ThemeMode = 'light' | 'dark' | 'system';

/** 辅助功能模式 */
export type AccessibilityMode = 'normal' | 'high-contrast' | 'reading' | 'color-blind';

/** 主题过渡动画类型 */
export type TransitionType = 'fade' | 'slide' | 'scale' | 'none';

// ============================================================================
// 色彩系统（符合 WCAG 对比度标准）
// ============================================================================

/** 语义化颜色 Token */
export interface SemanticColors {
  // 主要颜色（品牌色）
  primary: {
    main: string;        // 主色调
    light: string;       // 浅色变体
    dark: string;        // 深色变体
    contrastText: string; // 对比文字色（确保 ≥4.5:1 对比度）
  };

  // 次要颜色
  secondary: {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
  };

  // 功能性颜色（必须包含图标/文字，不能仅靠颜色传达）
  success: {
    main: string;
    background: string;
    text: string;
  };
  warning: {
    main: string;
    background: string;
    text: string;
  };
  error: {
    main: string;
    background: string;
    text: string;
  };
  info: {
    main: string;
    background: string;
    text: string;
  };

  // 背景与表面（支持暗色模式的去饱和处理）
  background: {
    default: string;     // 默认背景
    elevated: string;    // 卡片/弹窗背景
    hover: string;       // 悬停状态
    active: string;      // 激活状态
    disabled: string;    // 禁用状态（opacity 0.38-0.5）
  };

  surface: {
    default: string;     // 表面默认
    variant: string;     // 变体表面
    overlay: string;     // 遮罩层（modal scrim 40-60% opacity）
  };

  // 文字与边框
  text: {
    primary: string;     // 主文字（≥4.5:1 对比度）
    secondary: string;   // 次要文字（≥3:1 大文字）
    disabled: string;    // 禁用文字
    link: string;        // 链接颜色
  };

  border: {
    default: string;     // 默认边框
    focus: string;       // 焦点环（2-4px 可见）
    divider: string;     // 分割线
  };
}

// ============================================================================
// 排版系统（遵循 Typography & Color 规范）
// ============================================================================

/** 字体家族 */
export interface FontFamily {
  heading: string;      // 标题字体（Bold 600-700）
  body: string;         // 正文字体（Regular 400）
  mono: string;         // 等宽字体（代码/数据）
}

/** 字体大小层级（一致的 type scale） */
export interface FontSize {
  xs: string;           // 12px - 小标签
  sm: string;           // 14px - 次要文字
  base: string;         // 16px - 正文基准（移动端最小）
  lg: string;           // 18px - 小标题
  xl: string;           // 24px - 标题
  '2xl': string;        // 32px - 大标题
  '3xl': string;        // 40px - 展示标题
  '4xl': string;        // 48px+ - 超大展示
}

/** 行高（body text 1.5-1.75） */
export interface LineHeight {
  tight: string;        // 1.25 - 标题
  normal: string;       // 1.5 - 正文
  relaxed: string;      // 1.75 - 长文本阅读
}

/** 字重层级（强化视觉层次） */
export interface FontWeight {
  light: number;        // 300
  regular: number;      // 400 - 正文
  medium: number;       // 500 - 标签
  semibold: number;     // 600 - 小标题
  bold: number;         // 700 - 标题
}

/** 完整排版配置 */
export interface Typography {
  fontFamily: FontFamily;
  fontSize: FontSize;
  lineHeight: LineHeight;
  fontWeight: FontWeight;
  letterSpacing: {
    tight: string;      // -0.025em
    normal: string;     // 0em
    wide: string;       // 0.05em
  };
}

// ============================================================================
// 间距系统（4pt/8dp 增量间距）
// ============================================================================

/** 间距 Scale（基于 4px 基准） */
export interface Spacing {
  /** 基础间距单位 */
  unit: number;         // 4px (0.25rem)

  /** 预定义间距值 */
  0: string;            // 0px
  1: string;            // 4px
  2: string;            // 8px (触摸目标最小间距)
  3: string;            // 12px
  4: string;            // 16px
  5: string;            // 20px
  6: string;            // 24px
  8: string;            // 32px
  10: string;           // 40px
  12: string;           // 48px
  16: string;           // 64px
  20: string;           // 80px
  24: string;           // 96px
}

// ============================================================================
// 组件样式系统
// ============================================================================

/** 圆角半径（一致性） */
export interface BorderRadius {
  none: string;         // 0px
  sm: string;           // 4px
  md: string;           // 8px
  lg: string;           // 12px
  xl: string;           // 16px
  '2xl': string;        // 20px
  full: string;         // 9999px (pill/circle)
}

/** 阴影/ elevation 系统（一致的高度层次） */
export interface Shadows {
  /** Flat 风格阴影 */
  flat: {
    sm: string;          // 小阴影
    md: string;          // 中等阴影
    lg: string;          // 大阴影
    xl: string;          // 特大阴影
  };

  /** Glassmorphism 风格（如使用） */
  glass?: {
    sm: string;
    md: string;
    lg: string;
  };

  /** Neumorphism 风格（如使用） */
  neo?: {
    convex: string;
    concave: string;
  };
}

/** 按钮样式变体 */
export interface ButtonVariants {
  primary: string;
  secondary: string;
  outline: string;
  ghost: string;
  danger: string;
}

/** 卡片样式 */
export interface CardStyles {
  default: {
    background: string;
    border: string;
    shadow: string;
    borderRadius: string;
  };
  elevated: {
    background: string;
    border: string;
    shadow: string;
    borderRadius: string;
  };
  outlined: {
    background: string;
    border: string;
    shadow: string;
    borderRadius: string;
  };
}

/** 输入框样式 */
export interface InputStyles {
  default: {
    background: string;
    border: string;
    borderRadius: string;
    focusRing: string;   // Focus states (可见焦点环)
  };
  error: {
    background: string;
    border: string;
    focusRing: string;
  };
  disabled: {
    background: string;
    border: string;
    textColor: string;
  };
}

// ============================================================================
// 动效系统（150-300ms 微交互）
// ============================================================================

/** 动画时长 */
export interface Duration {
  instant: string;      // 0ms (避免，除非必要)
  fast: string;         // 100ms
  normal: string;       // 200-250ms
  slow: string;         // 300ms
  slower: string;       // 400ms (复杂过渡最大值)
  enter: string;        // 进入动画
  exit: string;         // 退出动画（进入的 60-70%，更快以显响应性）
}

/** 缓动函数（ease-out 进入，ease-in 退出） */
export interface Easing {
  easeOut: string;      // 'cubic-bezier(0.16, 1, 0.3, 1)'
  easeIn: string;       // 'cubic-bezier(0.7, 0, 0.84, 0)'
  easeInOut: string;    // 'cubic-bezier(0.87, 0, 0.13, 1)'
  spring: string;       // 物理弹簧曲线（自然感觉）
  bounce: string;       // 弹跳效果（谨慎使用）
}

/** 过渡动画配置 */
export interface Transitions {
  duration: Duration;
  easing: Easing;

  /** 通用过渡 */
  all: string;          // 所有属性过渡

  /** 特定属性过渡（仅 transform/opacity 以优化性能） */
  colors: string;       // 颜色过渡
  transform: string;    // 变换过渡
  opacity: string;      // 透明度过渡

  /** 组件级过渡 */
  modal: string;        // Modal/sheet 从触发源动画（scale+fade 或 slide-in）
  dropdown: string;     // 下拉菜单
  tooltip: string;       // 工具提示
  button: string;       // 按钮按压反馈（80-150ms 内提供反馈）
  card: string;         // 卡片悬停（subtle scale 0.95-1.05）
}

/** Reduced Motion 配置 */
export interface MotionPreferences {
  reducedMotion: boolean; // 尊重 prefers-reduced-motion
  disableAnimations: boolean; // 完全禁用动画
  scaleDownTransitions: boolean; // 降低动画强度
}

// ============================================================================
// 断点系统（移动优先）
// ============================================================================

/** 响应式断点 */
export interface Breakpoints {
  xs: string;           // 320px (小手机)
  sm: string;           // 375px (iPhone SE/标准手机) - 最小可读字体
  md: string;           // 768px (平板竖屏)
  lg: string;           // 1024px (平板横屏/小笔记本)
  xl: string;           // 1280px (桌面)
  '2xl': string;        // 1440px (大屏幕)
  '3xl': string;        // 1920px (超宽屏)
}

/** Z-index 分层管理 */
export interface ZIndex {
  base: number;         // 0
  dropdown: number;     // 10
  sticky: number;       // 20
  fixed: number;        // 40
  modalBackdrop: number;// 50
  modal: number;        // 100
  popover: number;      // 110
  tooltip: number;      // 1000
  toast: number;        // 1100
  max: number;          // 9999
}

// ============================================================================
// 完整主题定义
// ============================================================================

/** 单个完整主题配置 */
export interface ThemeConfig {
  /** 主题唯一标识 */
  id: string;

  /** 主题显示名称 */
  name: string;

  /** 主题描述 */
  description?: string;

  /** 主题模式 */
  mode: ThemeMode;

  /** 是否为系统预设 */
  isPreset: boolean;

  /** 语义化色彩 */
  colors: SemanticColors;

  /** 排版系统 */
  typography: Typography;

  /** 间距系统 */
  spacing: Spacing;

  /** 圆角 */
  borderRadius: BorderRadius;

  /** 阴影 */
  shadows: Shadows;

  /** 组件样式 */
  components?: {
    buttons: ButtonVariants;
    cards: CardStyles;
    inputs: InputStyles;
  };

  /** 动画 */
  transitions: Transitions;

  /** 断点 */
  breakpoints: Breakpoints;

  /** Z-index */
  zIndex: ZIndex;

  /** 自定义 CSS 变量覆盖 */
  cssVariables?: Record<string, string>;
}

// ============================================================================
// 主题预设定义
// ============================================================================

/** 预设主题 ID */
export type PresetThemeId =
  | 'light-default'
  | 'light-warm'
  | 'light-cool'
  | 'dark-default'
  | 'dark-oled'
  | 'high-contrast-light'
  | 'high-contrast-dark'
  | 'reading-sepia'
  | 'reading-dark';

/** 用户自定义主题配置 */
export interface CustomThemeOverrides {
  colors?: Partial<SemanticColors>;
  typography?: Partial<Typography>;
  spacing?: Partial<Spacing>;
  borderRadius?: Partial<BorderRadius>;
  transitions?: Partial<Transitions>;
}

// ============================================================================
// 主题状态
// ============================================================================

/** 主题 Store 状态 */
export interface ThemeState {
  /** 当前激活的主题 ID */
  activeThemeId: PresetThemeId | string;

  /** 当前完整的主题配置 */
  activeTheme: ThemeConfig;

  /** 当前模式 */
  mode: ThemeMode;

  /** 辅助功能模式 */
  accessibilityMode: AccessibilityMode;

  /** 运动偏好 */
  motionPreferences: MotionPreferences;

  /** 过渡效果类型 */
  transitionType: TransitionType;

  /** 是否正在切换主题 */
  isTransitioning: boolean;

  /** 用户保存的自定义主题列表 */
  customThemes: ThemeConfig[];

  /** 初始化状态 */
  isInitialized: boolean;
}

/** 主题 Store 操作 */
export interface ThemeActions {
  /** 初始化主题系统 */
  initialize: () => Promise<void>;

  /** 切换主题模式 */
  setThemeMode: (mode: ThemeMode) => void;

  /** 切换到指定预设主题 */
  setPresetTheme: (themeId: PresetThemeId) => void;

  /** 应用自定义主题 */
  applyCustomTheme: (overrides: CustomThemeOverrides) => void;

  /** 设置辅助功能模式 */
  setAccessibilityMode: (mode: AccessibilityMode) => void;

  /** 设置运动偏好 */
  setMotionPreferences: (prefs: Partial<MotionPreferences>) => void;

  /** 切换过渡效果类型 */
  setTransitionType: (type: TransitionType) => void;

  /** 保存自定义主题 */
  saveCustomTheme: (theme: ThemeConfig) => void;

  /** 删除自定义主题 */
  deleteCustomTheme: (themeId: string) => void;

  /** 重置为默认主题 */
  resetToDefault: () => void;

  /** 导出主题配置 */
  exportTheme: () => string;

  /** 导入主题配置 */
  importTheme: (configJson: string) => boolean;
}

/** 完整的 Theme Store 类型 */
export type ThemeStore = ThemeState & ThemeActions;

// ============================================================================
// 主题上下文 Provider Props
// ============================================================================

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** 默认主题 */
  defaultTheme?: PresetThemeId;
  /** 默认模式 */
  defaultMode?: ThemeMode;
  /** 是否启用持久化 */
  enablePersistence?: boolean;
  /** 存储键名 */
  storageKey?: string;
  /** 主题切换时的回调 */
  onThemeChange?: (theme: ThemeConfig) => void;
}

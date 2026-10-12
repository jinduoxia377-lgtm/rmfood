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

  // 第三色调
  tertiary: {
    main: string;
    light?: string;
    dark?: string;
    contrastText?: string;
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
    textPrimary: string; // 主文本色（兼容旧版）
    textSecondary: string; // 次文本色（兼容旧版）
    textMuted: string; // 弱化文本色（兼容旧版）
  };

  // 边框
  border: {
    default: string;     // 默认边框
    focus: string;       // 焦点环（2-4px 可见）
    divider: string;     // 分割线
  };

  // 兼容旧版字段名（别名）
  surfaceVariant: string;
  errorContainer: string;
  outline: string;
  outlineVariant: string;
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
  // ── A3：L0 正文族键名（经 toKebab 产出 --text-body / --text-body-sm /
  // --text-caption / --text-body-lg / --text-overline / --text-tiny），
  // 与 base.css 的 --text-* 逐值对齐。这四个是全站正文实际消费的令牌。
  body: string;         // 15px - 正文基准
  bodySm: string;       // 14px - 次级正文
  caption: string;      // 12px - 注释/说明
  bodyLg: string;       // 16px - 导语段
  overline: string;     // 12px - 标签/徽标
  tiny: string;         // 12px - 极小字
  // ── A3：L0 标题族键名（产出 --text-h1..h6）
  h1: string;           // 36px - 页面标题
  h2: string;           // 28px - 区块标题
  h3: string;           // 24px - 子标题
  h4: string;           // 22px - 卡片标题
  h5: string;           // 18px
  h6: string;           // 16px
  // ── Tailwind 默认档（可选）──
  // 可选（C1）：这 8 个键对应 Tailwind v4 默认主题变量（--text-xs 等），
  // base.css 未定义、走 Tailwind 编译期默认值。运行时字号覆盖只针对 L0
  // 正文/标题家族（上方 12 个键），不接管 Tailwind 工具类档位 —— 否则
  // 「调大字号」会把 text-xs 这类全站微型标签一起放大，超出用户预期。
  // 预设主题仍提供完整取值（presets 的 fontSize 全 20 键）。
  xs?: string;          // 12px - 小标签
  sm?: string;         // 14px - 次要文字
  base?: string;       // 16px - 正文基准（移动端最小）
  lg?: string;         // 18px - 小标题
  xl?: string;         // 24px - 标题
  '2xl'?: string;      // 32px - 大标题
  '3xl'?: string;      // 40px - 展示标题
  '4xl'?: string;      // 48px+ - 超大展示
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

/** 缓动函数。
 *  T-D5：键名**必须**与 L0 的 `--ease-*` 令牌一一对应
 *  （`--ease-standard` / `--ease-spring` / `--ease-elegant`），
 *  否则生成器写出的 `--easing-easeOut` 这类名字没有任何 CSS 消费者（实测 0 处），
 *  主题面板的缓动调节会 100% 失效。 */
export interface Easing {
  standard: string;     // 'cubic-bezier(0.25, 0.1, 0.25, 1.0)' = --ease-standard
  spring: string;       // 'cubic-bezier(0.16, 1, 0.3, 1)'       = --ease-spring
  elegant: string;      // 'cubic-bezier(0.16, 1, 0.3, 1)'       = --ease-elegant
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

  /** 模式反转色阶（执行方案阶段 C1），由运行时样式表承载 */
  modeRamps?: ModeRamps;
}

/**
 * 模式反转色阶（执行方案阶段 C1；E3 扩展为三品牌族）
 *
 * L0 约定：`--color-<族>-<档>` 在两种模式下是【有意反转】的 ——
 *   base.css 亮色：100 最浅 → 950 最深
 *   dark.css 暗色：100 最深 → 950 最浅，且值作用域在 `.dark` 选择器上
 *
 * 涉及三个品牌族，均为模式相关：
 *   - primary   ：base.css 亮色锚点 #10b981 / dark.css 暗色锚点 #34d399（500 档两态不同）
 *   - secondary ：两态 500 锚点同为 #3b82f6，靠档位反转区分明暗
 *   - accent    ：两态 500 锚点同为 #8b5cf6，同上
 *
 * 因此这类令牌**不能**走 `root.style.setProperty` 的 inline 通道：inline 属性会
 * 同时压过 `:root` 与 `.dark`，导致选定配色后暗色模式仍显示亮色 ramp ——
 * 已实测该形态会产生「断裂梯度」（500-700 换色而 100-400 / 800-950 仍是品牌绿
 * 的反转值），暗色下 800-950 是浅色档，叠白字即对比度崩塌。
 *
 * 唯一正确写法：写成运行时 `<style>` 的双作用域块，两组值一并携带。
 *
 * 命名约定：`<族>` 为亮色（`:root`）作用域，`<族>Dark` 为暗色（`.dark`）作用域。
 * 键名可选 —— 只携带用户实际选择过的族，未选中的族不写，保持 L0 基线。
 */
export interface ModeRamps {
  /** 亮色（`:root`）作用域的主色阶 */
  primary?: Record<string, string>;
  /** 暗色（`.dark`）作用域的主色阶 */
  primaryDark?: Record<string, string>;
  /** 亮色作用域的次色色阶（--color-secondary-*） */
  secondary?: Record<string, string>;
  /** 暗色作用域的次色色阶 */
  secondaryDark?: Record<string, string>;
  /** 亮色作用域的强调色色阶（--color-accent-*） */
  accent?: Record<string, string>;
  /** 暗色作用域的强调色色阶 */
  accentDark?: Record<string, string>;
}

// ============================================================================
// 主题预设定义
// ============================================================================

/** 预设主题 ID（精简版：仅保留2套完整设计 Token 体系的基础主题） */
export type PresetThemeId = 'light-default' | 'dark-default';

/** 用户自定义主题配置 */
export interface CustomThemeOverrides {
  colors?: Partial<SemanticColors>;
  typography?: Partial<Typography>;
  spacing?: Partial<Spacing>;
  borderRadius?: Partial<BorderRadius>;
  transitions?: Partial<Transitions>;
  /** 模式反转色阶（C1）：不能走 inline 通道，见 ModeRamps 说明 */
  modeRamps?: ModeRamps;
}

/**
 * 面板选项选择态（执行方案阶段 B2）
 *
 * 与运行时覆盖一并持久化，供 UI **派生**选中态（U-6：选中态必须从 store 派生）。
 * 原实现在 ThemePanel 里用局部 state 记录「当前选了哪个配色/字号」，刷新即丢，
 * 且直接渲染成 `aria-checked={false}` —— 用户完全看不出当前生效的方案。
 */
export interface ThemeOptionMeta {
  /** 当前选中的主色配色方案 key（theme-palette 的 HIGPalette.key，如 'green' / 'blue'） */
  paletteKey?: string;
  /**
   * 当前选中的次色配色方案 key（E3）。
   *
   * 内部族名 `secondary`（COLOR_MAIN_TO_L0 的 'secondary-main' → --color-secondary），
   * 色阶作用域为 `:root` / `.dark` 的 `--color-secondary-<档>`。
   */
  secondaryPaletteKey?: string;
  /**
   * 当前选中的强调色配色方案 key（E3）。
   *
   * 注意内外名不一致：ThemeConfig 内部角色名是 `tertiary`
   * （COLOR_MAIN_TO_L0 的 'tertiary-main' → --color-accent），
   * 而 L0 令牌族名是 `accent`。对外一律用 `accent`（与用户认知及 L0 令牌一致），
   * 由调用方在写入 colors 时映射到 tertiary。
   */
  accentPaletteKey?: string;
  /** 当前选中的字体档位（'compact' / 'standard' / 'relaxed'） */
  fontScale?: string;
  /** 当前选中的圆角档位（'sharp' / 'standard' / 'rounded'） */
  radiusScale?: string;
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

  /**
   * 运行时覆盖（执行方案阶段 B1/B2）
   *
   * 面板「配色方案」「字体大小」等控件产生的**累计**覆盖，持久化后在冷启动回放。
   * 这是 R1 的根治点：原实现每次 applyCustomTheme 都用 `custom-${Date.now()}` 生成
   * 新 ID 并追加进 customThemes，而 initialize() 只用 `presetThemes[activeThemeId]`
   * 查表 —— 查不到就 warn 并回退 light-default，用户在设置里选的配色/字号刷新即丢。
   */
  runtimeOverrides: CustomThemeOverrides;

  /** 当前选中的配色方案 key（派生选中态用，空串 = 未选择） */
  paletteKey: string;

  /** 当前选中的次色方案 key（E3，派生选中态用，空串 = 未选择） */
  secondaryPaletteKey: string;

  /** 当前选中的强调色方案 key（E3，派生选中态用，空串 = 未选择） */
  accentPaletteKey: string;

  /** 当前选中的字体档位（派生选中态用） */
  fontScale: string;

  /** 当前选中的圆角档位（派生选中态用，'sharp' / 'standard' / 'rounded'） */
  radiusScale: string;

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
  applyCustomTheme: (overrides: CustomThemeOverrides, meta?: ThemeOptionMeta) => void;

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

// ============================================================================
// 自定义主题（SettingsPage 使用）
// 与 theme-mode.ts 中的 CustomTheme 结构对齐
// ============================================================================

/** 自定义主题配置（用户保存的主题） */
export interface UserCustomTheme {
  /** 主题唯一标识符 */
  id: string;
  /** 主题显示名称 */
  name: string;
  /** 主题描述 */
  description?: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 最后更新时间戳 */
  updatedAt: number;
  /** 主题样式配置 */
  config: ThemeStyles;
  /** 是否为系统预设主题 */
  isPreset: boolean;
  /** 主题标签 */
  tags: string[];
}

/** 自定义主题别名（兼容旧代码） */
export type CustomTheme = UserCustomTheme;

/** 默认主题样式常量 */
export const DEFAULT_THEME_STYLES: Required<ThemeStyles> = {
  colors: {
    primary: 'var(--color-primary-400)',
    secondary: '#0A84FF',
    tertiary: 'var(--color-accent-500)',
    background: 'var(--bg-canvas)',
    surface: '#FFFFFF',
    text: '#1D1D1F',
    onBackground: '#1D1D1F',
    onPrimary: '#ffffff',
    error: '#FF3B30',
    onError: '#ffffff',
    success: 'var(--color-primary-400)',
    warning: '#FF9F0A',
    info: 'var(--color-secondary-500)',
    border: '#E5E7EB',
    focusRing: '#0A84FF',
  },
  font: {
    fontFamily: "'Noto Sans SC', sans-serif",
    fontSize: {
      xs: '12px', sm: '14px', base: '16px', lg: '18px',
      xl: '24px', '2xl': '32px', '3xl': '40px',
    },
    lineHeight: { tight: '1.25', normal: '1.5', relaxed: '1.75' },
    fontWeight: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
  },
  spacing: {
    spacing: {
      0: '0px', 1: '4px', 2: '8px', 3: '12px', 4: '16px',
      5: '20px', 6: '24px', 8: '32px', 10: '40px', 12: '48px', 16: '64px',
    },
    borderRadius: {
      none: '0px', sm: '4px', md: '8px', lg: '12px',
      xl: '16px', '2xl': '20px', full: '9999px',
    },
    shadowIntensity: {
      none: 'none',
      sm: '0 1px 2px rgba(0,0,0,0.05)',
      md: '0 4px 6px rgba(0,0,0,0.1)',
      lg: '0 10px 15px rgba(0,0,0,0.1)',
      xl: '0 20px 25px rgba(0,0,0,0.1)',
    },
  },
  animation: {
    transitionDuration: {
      instant: '0ms', fast: '100ms', normal: '200ms', slow: '300ms', slower: '400ms',
    },
    easingFunction: {
      easeOut: 'cubic-bezier(0.16,1,0.3,1)',
      easeIn: 'cubic-bezier(0.7,0,0.84,0)',
      easeInOut: 'cubic-bezier(0.87,0,0.13,1)',
      spring: 'cubic-bezier(0.34,1.56,0.64,1)',
      bounce: 'cubic-bezier(0.68,-0.55,0.265,1.55)',
    },
  },
};

/** 完整的主题样式配置接口 */
export interface ThemeStyles {
  colors?: ThemeColors;
  font?: ThemeFont;
  spacing?: ThemeSpacing;
  animation?: ThemeAnimation;
}

/** 主题颜色配置 */
export interface ThemeColors {
  primary?: string;
  secondary?: string;
  tertiary?: string;
  background?: string;
  surface?: string;
  text?: string;
  onBackground?: string;
  onPrimary?: string;
  error?: string;
  onError?: string;
  success?: string;
  warning?: string;
  info?: string;
  border?: string;
  focusRing?: string;
}

/** 主题字体配置 */
export interface ThemeFont {
  fontFamily?: string;
  fontSize?: {
    xs?: string;
    sm?: string;
    base?: string;
    lg?: string;
    xl?: string;
    '2xl'?: string;
    '3xl'?: string;
  };
  lineHeight?: {
    tight?: string;
    normal?: string;
    relaxed?: string;
  };
  fontWeight?: {
    light?: number;
    regular?: number;
    medium?: number;
    semibold?: number;
    bold?: number;
  };
}

/** 主题间距配置 */
export interface ThemeSpacing {
  spacing?: Record<string, string>;
  borderRadius?: Record<string, string>;
  shadowIntensity?: Record<string, string>;
}

/** 主题动画配置 */
export interface ThemeAnimation {
  transitionDuration?: Record<string, string>;
  easingFunction?: Record<string, string>;
}

/** 主题版本记录 */
export interface ThemeVersion {
  id: string;
  timestamp: number;
  summary: string;
  snapshot: ThemeStyles;
}

/** 主题事件类型 */
export type ThemeEventType = 'theme-change' | 'mode-switch' | 'custom-theme-update';

/** 主题事件载荷 */
export interface ThemeEventPayload {
  type: ThemeEventType;
  timestamp: number;
  changes?: { key: string; oldValue: unknown; newValue: unknown }[];
  data?: Record<string, unknown>;
}

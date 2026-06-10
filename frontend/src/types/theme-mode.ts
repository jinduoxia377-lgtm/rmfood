/**
 * RMFOOD 配方平台 - 主题模式系统完整类型定义
 * 提供强类型支持，涵盖主题模式、自定义主题、版本管理、事件系统
 * 符合 WCAG 2.1 AA/AAA 无障碍标准
 */

// ============================================================================
// 核心枚举与基础类型
// ============================================================================

/**
 * 主题模式类型
 * - light: 浅色模式（默认）
 * - dark: 深色模式
 * - auto: 跟随系统设置
 * - high-contrast: 高对比度无障碍模式
 */
export type ThemeMode = 'light' | 'dark' | 'auto' | 'high-contrast';

/**
 * 主题事件类型
 * - theme-change: 主题配置变更
 * - mode-switch: 模式切换
 * - custom-theme-update: 自定义主题更新
 */
export type ThemeEventType = 'theme-change' | 'mode-switch' | 'custom-theme-update';

// ============================================================================
// 颜色系统（Color System）
// ============================================================================

/**
 * 主题颜色配置接口
 * 包含完整的语义化颜色体系，所有属性均为可选以支持部分覆盖
 * 默认值遵循 Material Design 和 WCAG 对比度标准
 */
export interface ThemeColors {
  /** 主色调（品牌色）- 默认: #059669 (森林绿) */
  primary?: string;

  /** 辅助色 - 默认: #2563eb (蓝色) */
  secondary?: string;

  /** 第三强调色 - 默认: #7c3aed (紫色) */
  tertiary?: string;

  /** 背景色 - 默认浅色: #ffffff / 深色: #0f172a */
  background?: string;

  /** 表面/卡片背景色 - 默认浅色: #f8fafc / 深色: #1e293b */
  surface?: string;

  /** 主文字颜色 - 默认浅色: #0f172a / 深色: #f1f5f9 */
  text?: string;

  /** 背景上的文字颜色（确保对比度 ≥4.5:1） */
  onBackground?: string;

  /** 主色上的文字/图标颜色 */
  onPrimary?: string;

  /** 错误状态色 - 默认: #ef4444 */
  error?: string;

  /** 错误背景上的文字颜色 */
  onError?: string;

  /** 成功状态色 - 默认: #10b981 */
  success?: string;

  /** 警告状态色 - 默认: #f59e0b */
  warning?: string;

  /** 信息状态色 - 默认: #06b6d4 */
  info?: string;

  /** 边框颜色 - 默认浅色: #e2e8f0 / 深色: #334155 */
  border?: string;

  /** 焦点环颜色 - 默认: #3b82f6 */
  focusRing?: string;
}

// ============================================================================
// 字体系统（Typography System）
// ============================================================================

/**
 * 主题字体配置接口
 * 遵循一致的 type scale 和行高规范
 */
export interface ThemeFont {
  /** 字体家族 - 默认: "'Noto Sans SC', sans-serif" */
  fontFamily?: string;

  /**
   * 字体大小配置（单位：px 或 rem）
   * 基准字号：16px（移动端最小可读尺寸）
   */
  fontSize?: {
    /** 超小号：12px - 标签、注释 */
    xs?: string;
    /** 小号：14px - 次要文字、辅助信息 */
    sm?: string;
    /** 基础：16px - 正文基准 */
    base?: string;
    /** 中号：18px - 小标题 */
    lg?: string;
    /** 大号：24px - 标题 */
    xl?: string;
    /** 超大号：32px - 大标题 */
    '2xl'?: string;
    /** 巨大号：40px - 展示标题 */
    '3xl'?: string;
  };

  /**
   * 行高配置
   * 正文推荐：1.5-1.75 以提升可读性
   */
  lineHeight?: {
    /** 紧凑：1.25 - 标题使用 */
    tight?: string;
    /** 正常：1.5 - 正文标准 */
    normal?: string;
    /** 宽松：1.75 - 长文本阅读 */
    relaxed?: string;
  };

  /**
   * 字重配置
   * 强化视觉层次，避免过多字重层级
   */
  fontWeight?: {
    /** 细体：300 */
    light?: number;
    /** 常规：400 - 正文 */
    regular?: number;
    /** 中等：500 - 标签 */
    medium?: number;
    /** 半粗：600 - 小标题 */
    semibold?: number;
    /** 粗体：700 - 标题 */
    bold?: number;
  };
}

// ============================================================================
// 间距系统（Spacing System）
// ============================================================================

/**
 * 主题间距配置接口
 * 基于 4pt/8dp 增量间距系统
 */
export interface ThemeSpacing {
  /**
   * 间距 Scale（基于 4px 基准单位）
   * 使用数值或 CSS 值字符串
   */
  spacing?: {
    /** 0px */
    0?: string;
    /** 4px */
    1?: string;
    /** 8px（触摸目标最小间距） */
    2?: string;
    /** 12px */
    3?: string;
    /** 16px */
    4?: string;
    /** 20px */
    5?: string;
    /** 24px */
    6?: string;
    /** 32px */
    8?: string;
    /** 40px */
    10?: string;
    /** 48px */
    12?: string;
    /** 64px */
    16?: string;
  };

  /**
   * 圆角半径配置
   * 保持一致性，避免过多变体
   */
  borderRadius?: {
    /** 无圆角：0px */
    none?: string;
    /** 小圆角：4px */
    sm?: string;
    /** 中圆角：8px */
    md?: string;
    /** 大圆角：12px */
    lg?: string;
    /** 超大圆角：16px */
    xl?: string;
    /** 超超大圆角：20px */
    '2xl'?: string;
    /** 完全圆形/药丸形：9999px */
    full?: string;
  };

  /**
   * 阴影强度配置
   * 支持 Flat、Glassmorphism、Neumorphism 风格
   */
  shadowIntensity?: {
    /** 无阴影 */
    none?: string;
    /** 小阴影 */
    sm?: string;
    /** 中等阴影 */
    md?: string;
    /** 大阴影 */
    lg?: string;
    /** 特大阴影 */
    xl?: string;
  };
}

// ============================================================================
// 动画系统（Animation System）
// ============================================================================

/**
 * 主题动画配置接口
 * 遵循 150-300ms 微交互原则，尊重 prefers-reduced-motion
 */
export interface ThemeAnimation {
  /**
   * 过渡时长配置（毫秒）
   * 避免超过 400ms 的复杂过渡
   */
  transitionDuration?: {
    /** 即时：0ms（避免使用，除非必要） */
    instant?: string;
    /** 快速：100ms */
    fast?: string;
    /** 正常：200-250ms */
    normal?: string;
    /** 缓慢：300ms */
    slow?: string;
    /** 更缓慢：400ms（复杂过渡最大值） */
    slower?: string;
  };

  /**
   * 缓动函数配置
   * 推荐使用 cubic-bezier 实现自然动效
   */
  easingFunction?: {
    /** 减速进入：cubic-bezier(0.16, 1, 0.3, 1) */
    easeOut?: string;
    /** 加速退出：cubic-bezier(0.7, 0, 0.84, 0) */
    easeIn?: string;
    /** 先加速后减速：cubic-bezier(0.87, 0, 0.13, 1) */
    easeInOut?: string;
    /** 弹簧曲线：物理自然感觉 */
    spring?: string;
    /** 弹跳效果（谨慎使用） */
    bounce?: string;
  };
}

// ============================================================================
// 完整主题样式接口（ThemeStyles）
// ============================================================================

/**
 * 完整的主题样式配置接口
 * 整合颜色、字体、间距、动画四大子系统
 * 所有属性均为可选，支持部分配置和渐进式增强
 *
 * @example
 * ```typescript
 * const myTheme: ThemeStyles = {
 *   colors: { primary: '#059669', background: '#ffffff' },
 *   font: { fontFamily: "'Noto Sans SC', sans-serif" },
 * };
 * ```
 */
export interface ThemeStyles {
  /** 颜色系统配置 */
  colors?: ThemeColors;

  /** 字体系统配置 */
  font?: ThemeFont;

  /** 间距系统配置 */
  spacing?: ThemeSpacing;

  /** 动画系统配置 */
  animation?: ThemeAnimation;
}

// ============================================================================
// 自定义主题接口（CustomTheme）
// ============================================================================

/**
 * 用户自定义主题完整配置
 * 支持持久化存储和版本管理
 */
export interface CustomTheme {
  /** 主题唯一标识符（UUID 格式） */
  id: string;

  /** 主题显示名称 */
  name: string;

  /** 主题描述（可选） */
  description?: string;

  /** 创建时间戳（Unix 时间戳，毫秒） */
  createdAt: number;

  /** 最后更新时间戳（Unix 时间戳，毫秒） */
  updatedAt: number;

  /** 主题样式配置 */
  config: ThemeStyles;

  /** 是否为系统预设主题 */
  isPreset: boolean;

  /** 主题标签（用于分类和搜索） */
  tags: string[];
}

// ============================================================================
// 主题版本管理接口（ThemeVersion）
// ============================================================================

/**
 * 主题版本记录
 * 用于追踪主题配置变更历史
 */
export interface ThemeVersion {
  /** 版本唯一标识符 */
  id: string;

  /** 版本创建时间戳（Unix 时间戳，毫秒） */
  timestamp: number;

  /** 变更摘要说明 */
  summary: string;

  /** 该版本的完整主题快照 */
  snapshot: ThemeStyles;
}

// ============================================================================
// 主题事件接口（ThemeEvent）
// ============================================================================

/**
 * 主题系统事件
 * 用于组件间通信和状态同步
 */
export interface ThemeEvent {
  /** 事件类型 */
  type: ThemeEventType;

  /** 事件触发时间戳（Unix 时间戳，毫秒） */
  timestamp: number;

  /** 变更详情列表 */
  changes: {
    /** 变更的属性键名 */
    key: string;

    /** 变更前的旧值 */
    oldValue: unknown;

    /** 变更后的新值 */
    newValue: unknown;
  }[];
}

// ============================================================================
// 辅助类型定义
// ============================================================================

/**
 * 版本历史记录
 * 按时间倒序排列的主题版本列表
 */
export type VersionHistory = ThemeVersion[];

/**
 * 缓存条目
 * 用于性能优化的主题缓存数据结构
 */
export interface CacheEntry<T = ThemeStyles> {
  /** 缓存的数据内容 */
  data: T;

  /** 缓存创建时间戳 */
  cachedAt: number;

  /** 缓存过期时间戳（可选，永不过期则不设置） */
  expiresAt?: number;

  /** 缓存命中次数 */
  hitCount: number;

  /** 最后访问时间 */
  lastAccessedAt: number;
}

/**
 * 订阅者回调函数签名
 * 用于观察者模式的主题变更通知
 */
export type SubscriptionCallback = (event: ThemeEvent) => void;

/**
 * 主题订阅项
 * 管理订阅者的生命周期
 */
export interface Subscription {
  /** 订阅唯一标识符 */
  id: string;

  /** 回调函数 */
  callback: SubscriptionCallback;

  /** 订阅创建时间 */
  createdAt: number;

  /** 是否为活跃状态 */
  active: boolean;
}

// ============================================================================
// 验证工具函数
// ============================================================================

/**
 * 默认主题样式配置
 * 作为回退值和初始化基准
 */
export const DEFAULT_THEME_STYLES: Required<ThemeStyles> = {
  colors: {
    primary: '#059669',
    secondary: '#2563eb',
    tertiary: '#7c3aed',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    onBackground: '#0f172a',
    onPrimary: '#ffffff',
    error: '#ef4444',
    onError: '#ffffff',
    success: '#10b981',
    warning: '#f59e0b',
    info: '#06b6d4',
    border: '#e2e8f0',
    focusRing: '#3b82f6',
  },
  font: {
    fontFamily: "'Noto Sans SC', sans-serif",
    fontSize: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '24px',
      '2xl': '32px',
      '3xl': '40px',
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: {
    spacing: {
      0: '0px',
      1: '4px',
      2: '8px',
      3: '12px',
      4: '16px',
      5: '20px',
      6: '24px',
      8: '32px',
      10: '40px',
      12: '48px',
      16: '64px',
    },
    borderRadius: {
      none: '0px',
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      '2xl': '20px',
      full: '9999px',
    },
    shadowIntensity: {
      none: 'none',
      sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
      md: '0 4px 6px rgba(0, 0, 0, 0.1)',
      lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
      xl: '0 20px 25px rgba(0, 0, 0, 0.1)',
    },
  },
  animation: {
    transitionDuration: {
      instant: '0ms',
      fast: '100ms',
      normal: '200ms',
      slow: '300ms',
      slower: '400ms',
    },
    easingFunction: {
      easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
      easeIn: 'cubic-bezier(0.7, 0, 0.84, 0)',
      easeInOut: 'cubic-bezier(0.87, 0, 0.13, 1)',
      spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
};

/**
 * 验证主题配置是否合法
 * 使用 TypeScript 类型守卫确保运行时类型安全
 *
 * @param config - 待验证的未知配置对象
 * @returns 如果是有效的 ThemeStyles 则返回 true，否则返回 false
 *
 * @example
 * ```typescript
 * const userInput = JSON.parse(jsonString);
 * if (validateThemeConfig(userInput)) {
 *   // userInput 此时被推断为 ThemeStyles 类型
 *   applyTheme(userInput);
 * }
 * ```
 */
export function validateThemeConfig(config: unknown): config is ThemeStyles {
  if (!config || typeof config !== 'object') {
    return false;
  }

  const themeConfig = config as Record<string, unknown>;

  // 验证 colors（如果存在）
  if (themeConfig.colors !== undefined) {
    if (typeof themeConfig.colors !== 'object' || themeConfig.colors === null) {
      return false;
    }
    const colors = themeConfig.colors as Record<string, unknown>;
    for (const value of Object.values(colors)) {
      if (value !== undefined && typeof value !== 'string') {
        return false;
      }
    }
  }

  // 验证 font（如果存在）
  if (themeConfig.font !== undefined) {
    if (typeof themeConfig.font !== 'object' || themeConfig.font === null) {
      return false;
    }
    const font = themeConfig.font as Record<string, unknown>;
    if (font.fontFamily !== undefined && typeof font.fontFamily !== 'string') {
      return false;
    }
  }

  // 验证 spacing（如果存在）
  if (themeConfig.spacing !== undefined) {
    if (typeof themeConfig.spacing !== 'object' || themeConfig.spacing === null) {
      return false;
    }
  }

  // 验证 animation（如果存在）
  if (themeConfig.animation !== undefined) {
    if (typeof themeConfig.animation !== 'object' || themeConfig.animation === null) {
      return false;
    }
  }

  return true;
}

/**
 * 清理并规范化主题输入
 * 将用户输入合并到默认配置中，确保返回完整的有效 ThemeStyles
 *
 * @param input - 用户提供的部分主题配置
 * @returns 完整且有效的 ThemeStyles 配置
 *
 * @example
 * ```typescript
 * const userPartialInput = { colors: { primary: '#ff0000' } };
 * const sanitizedTheme = sanitizeThemeInput(userPartialInput);
 * // sanitizedTheme 包含完整的配置，未指定的属性使用默认值
 * ```
 */
export function sanitizeThemeInput(input: Partial<ThemeStyles>): ThemeStyles {
  const deepMerge = <T extends Record<string, unknown>>(
    target: T,
    source: Partial<T>,
  ): T => {
    const result = { ...target };

    for (const key of Object.keys(source)) {
      const sourceValue = source[key as keyof T];
      const targetValue = result[key as keyof T];

      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Partial<Record<string, unknown>>,
        );
      } else if (sourceValue !== undefined) {
        (result as Record<string, unknown>)[key] = sourceValue;
      }
    }

    return result;
  };

  return deepMerge(DEFAULT_THEME_STYLES, input);
}

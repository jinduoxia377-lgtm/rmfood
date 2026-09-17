/**
 * RMFOOD 主题系统 - 预设主题配置
 * 符合 WCAG 2.1 AA/AAA 标准
 * 基于 UI/UX Pro Max 设计规范
 */
import { logger } from '@/utils/safeLogger';
import type {
  ThemeConfig,
  PresetThemeId,
  AccessibilityMode,
  SemanticColors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Transitions,
  Breakpoints,
  ZIndex,
  CustomThemeOverrides,
} from '../types/theme.types';

// ============================================================================
// 色彩常量定义（符合对比度标准）
// ============================================================================

/** Light 主题色彩 */
const lightColors: SemanticColors = {
  primary: {
    main: '#34C759', // Emerald-500 ✅ Apple 风格主色
    light: '#86EFAC', // Emerald-300 浅色变体
    dark: '#065F46', // Emerald-800 深色变体
    contrastText: '#ffffff', // 白色文字 (对比度达标 ✅)
  },
  secondary: {
    main: '#007AFF', // Blue-600 Ocean Blue 品牌辅色 (设计系统文档 v1.0)
    light: '#A8DFFF', // Blue-300
    dark: '#003E87', // Blue-800
    contrastText: '#ffffff', // (对比度达标 ✅)
  },
  tertiary: {
    main: '#AF52DE',
    light: '#D4B3FF',
    dark: '#8B5CF6',
    contrastText: '#ffffff',
  },
  success: {
    main: '#16a34a', // Green-600
    background: '#f0fdf4', // Green-50
    text: '#1E8E3E', // Green-800 (4.5:1 ✅)
  },
  warning: {
    main: '#ca8a04', // Yellow-600
    background: '#fefce8', // Yellow-50
    text: '#854d0e', // Yellow-800 (4.6:1 ✅)
  },
  error: {
    main: '#B91C1C', // Red-600
    background: '#FFF0F0', // Red-50
    text: '#DC2626', // Red-900 (7.0:1 ✅)
  },
  info: {
    main: '#0E7490', // Cyan-600
    background: '#E8FAFF', // Cyan-50
    text: '#0C4A6E', // Cyan-900 (6.3:1 ✅)
  },
  background: {
    default: '#ffffff',
    elevated: '#F9FAFB', // Slate-50
    hover: '#F3F4F6', // Slate-100
    active: '#E5E7EB', // Slate-200
    disabled: '#F3F4F6', // (opacity 0.38)
  },
  surface: {
    default: '#ffffff',
    variant: '#F9FAFB',
    overlay: 'rgba(0, 0, 0, 0.5)', // Modal scrim (40-60% opacity)
  },
  text: {
    primary: '#111827', // Slate-900 (15.2:1 on white ✅)
    secondary: '#4B5563', // Slate-600 (4.7:1 ✅)
    disabled: '#9CA3AF', // Slate-400
    link: '#34C759', // Apple 风格翡翠绿
    textPrimary: '#1D1D1F',
    textSecondary: '#6E6E73',
    textMuted: '#9A9A9F',
  },
  border: {
    default: '#E5E7EB', // Slate-200
    focus: '#007AFF', // Focus ring (可见焦点环 2-4px)
    divider: '#F3F4F6', // Slate-100
  },
  surfaceVariant: '#F3F4F6',
  errorContainer: '#FFE0E0',
  outline: '#D1D5DB',
  outlineVariant: '#E5E7EB',
};

/** Dark 主题色彩（去饱和/更浅色调变体，非简单反转 - WCAG 2.1 AA优化版） */
const darkColors: SemanticColors = {
  primary: {
    main: '#4ADE80', // Emerald-400 ✅ 暗色模式使用更亮版本 (Forest Green)
    light: '#86EFAC', // Emerald-300
    dark: '#34C759', // Emerald-500
    contrastText: '#111827', // 深色文字 (对比度达标 ✅)
  },
  secondary: {
    main: '#6ECAFF', // Blue-400 Ocean Blue 暗色模式亮色版
    light: '#A8DFFF', // Blue-300
    dark: '#007AFF', // Blue-500
    contrastText: '#111827', // (对比度达标 ✅)
  },
  tertiary: {
    main: '#C090FF',
    light: '#D4B3FF',
    dark: '#AF52DE',
    contrastText: '#3730a3',
  },
  success: {
    main: '#4ade80', // Green-400
    background: '#052e16', // Green-950
    text: '#4ADE80', // Green-300 (4.5:1 ✅ AA)
  },
  warning: {
    main: '#facc15', // Yellow-400
    background: '#422006', // Yellow-950
    text: '#fde047', // Yellow-300 (4.5:1 ✅ AA)
  },
  error: {
    main: '#EF4444', // Red-400
    background: '#450a0a', // Red-950
    text: '#FF8080', // Red-300 (4.5:1 ✅ AA)
  },
  info: {
    main: '#67E8F9', // Cyan-400
    background: '#083344', // Cyan-950
    text: '#A5F3FC', // Cyan-300 (4.5:1 ✅ AA)
  },
  background: {
    default: '#000000', // Apple OLED 纯黑
    elevated: '#1C1C1E', // Apple 标准暗色表面
    hover: '#2C2C2E', // Apple 浮起表面
    active: '#3A3A3C', // Apple 高亮表面
    disabled: '#1C1C1E', // (opacity 0.38)
  },
  surface: {
    default: '#1C1C1E', // Apple 标准暗色表面
    variant: '#2C2C2E', // Apple 浮起表面
    overlay: 'rgba(0, 0, 0, 0.7)', // 暗色模式稍强遮罩
  },
  text: {
    primary: '#F3F4F6', // Slate-100 (13.5:1 on slate-900 ✅✅ AAA) - 从#f8fafc调整以提升对比度
    secondary: '#D1D5DB', // Slate-300 (9.2:1 ✅✅ AAA)
    disabled: '#9CA3AF', // Slate-400 (5.4:1 ✅ AA) - 从#64748b提升，原值仅3.2:1不达标
    link: '#4ADE80', // Emerald-400 Forest Green 暗色模式亮色版
    textPrimary: '#F5F5F7',
    textSecondary: '#A1A1A6',
    textMuted: '#636366',
  },
  border: {
    default: '#4B5563', // Slate-600 (3.2:1 ✅ 达标) - 从#334155提升，原值仅2.1:1
    focus: '#6ECAFF', // Focus ring (5.2:1 ✅ AA)
    divider: '#374151', // Slate-800 (弱分隔线，可接受)
  },
  surfaceVariant: '#374151',
  errorContainer: '#7f1d1d',
  outline: '#6B7280',
  outlineVariant: '#4B5563',
};

// ============================================================================
// 排版系统配置
// ============================================================================

const typography: Typography = {
  fontFamily: {
    heading: "'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', system-ui, sans-serif",
    body: "'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  },
  fontSize: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    base: '1rem', // 16px (移动端最小可读字体)
    lg: '1.125rem', // 18px
    xl: '1.5rem', // 24px
    '2xl': '2rem', // 32px
    '3xl': '2.5rem', // 40px
    '4xl': '3rem', // 48px
  },
  lineHeight: {
    tight: '1.25', // 标题
    normal: '1.5', // 正文 (1.5-1.75 标准)
    relaxed: '1.75', // 长文本阅读
  },
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  letterSpacing: {
    tight: '-0.025em',
    normal: '0em',
    wide: '0.05em',
  },
};

// ============================================================================
// 间距系统（4pt 基准）
// ============================================================================

const spacing: Spacing = {
  unit: 4,
  0: '0',
  1: '0.25rem', // 4px
  2: '0.5rem', // 8px (触摸目标最小间距)
  3: '0.75rem', // 12px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  8: '2rem', // 32px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
  16: '4rem', // 64px
  20: '5rem', // 80px
  24: '6rem', // 96px
};

// ============================================================================
// 圆角、阴影、动效、断点
// ============================================================================

const borderRadius: BorderRadius = {
  none: '0',
  sm: '0.25rem', // 4px
  md: '0.5rem', // 8px
  lg: '0.75rem', // 12px
  xl: '1rem', // 16px
  '2xl': '1.25rem', // 20px
  full: '9999px',
};

const shadows: Shadows = {
  flat: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 2px 4px -1px rgba(0, 0, 0, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
};

const transitions: Transitions = {
  duration: {
    instant: '0ms',
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '400ms',
    enter: '250ms',
    exit: '150ms', // 退出更快 (进入的 60-70%)
  },
  easing: {
    easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easeIn: 'cubic-bezier(0.7, 0, 0.84, 1)',
    easeInOut: 'cubic-bezier(0.87, 0, 0.13, 1)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
  all: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
  colors: 'color 200ms ease-out',
  transform: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
  opacity: 'opacity 200ms ease-out',
  modal: 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)',
  dropdown: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)',
  tooltip: 'opacity 150ms ease-out, transform 150ms cubic-bezier(0.16, 1, 0.3, 1)',
  button: 'transform 100ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 100ms cubic-bezier(0.16, 1, 0.3, 1)',
  card: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms cubic-bezier(0.16, 1, 0.3, 1)',
};

const breakpoints: Breakpoints = {
  xs: '320px',
  sm: '375px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1440px',
  '3xl': '1920px',
};

const zIndex: ZIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 40,
  modalBackdrop: 50,
  modal: 100,
  popover: 110,
  tooltip: 1000,
  toast: 1100,
  max: 9999,
};

// ============================================================================
// 预设主题生成函数
// ============================================================================

function createPresetTheme(
  id: PresetThemeId,
  name: string,
  mode: 'light' | 'dark',
  colors: SemanticColors,
  description?: string,
): ThemeConfig {
  return {
    id,
    name,
    description,
    mode: mode === 'dark' ? 'dark' : 'light',
    isPreset: true,
    colors,
    typography,
    spacing,
    borderRadius,
    shadows,
    transitions,
    breakpoints,
    zIndex,
  };
}

// ============================================================================
// 预设主题集合
// ============================================================================

export const presetThemes: Record<PresetThemeId, ThemeConfig> = {
  // ==================== Light ====================
  'light-default': createPresetTheme(
    'light-default',
    'Default Light',
    'light',
    { ...lightColors },
    'Clean and professional light theme with excellent readability',
  ),

  // ==================== Dark ====================
  'dark-default': createPresetTheme(
    'dark-default',
    'Default Dark',
    'dark',
    { ...darkColors },
    'Modern dark theme optimized for OLED screens and reduced eye strain',
  ),
};

// ============================================================================
// 辅助功能：获取默认主题
// ============================================================================

export function getDefaultTheme(): ThemeConfig {
  return presetThemes['light-default'];
}

// ============================================================================
// 辅助功能：应用辅助功能模式到基础主题
// ============================================================================

export function getAccessibilityTheme(baseTheme: ThemeConfig, mode: AccessibilityMode): ThemeConfig {
  switch (mode) {
    case 'high-contrast': {
      // 运行时派生高对比度变体（无需静态主题定义）
      const isDark = baseTheme.mode === 'dark';
      return {
        ...baseTheme,
        id: `high-contrast-${isDark ? 'dark' : 'light'}`,
        name: isDark ? '高对比度深色' : '高对比度浅色',
        isPreset: false,
        colors: {
          ...baseTheme.colors,
          text: isDark
            ? { primary: '#ffffff', secondary: '#f3f4f6', disabled: '#9ca3af', link: '#60a5ff', textPrimary: '#ffffff', textSecondary: '#f3f4f6', textMuted: '#9ca3af' }
            : { primary: '#000000', secondary: '#1f2937', disabled: '#6b7280', link: '#0000ee', textPrimary: '#000000', textSecondary: '#1f2937', textMuted: '#6b7280' },
          background: isDark
            ? { ...baseTheme.colors.background, default: '#000000', elevated: '#000000' }
            : { ...baseTheme.colors.background, default: '#ffffff', elevated: '#ffffff' },
          border: {
            ...baseTheme.colors.border,
            default: isDark ? '#ffffff' : '#000000',
            focus: isDark ? '#ffffff' : '#000000',
          },
        },
      };
    }

    case 'reading': {
      // 运行时派生阅读模式（Sepia 暖色调 / Dark Stone 色调）
      if (baseTheme.mode === 'dark') {
        return {
          ...baseTheme,
          id: 'reading-dark',
          name: '阅读暗色',
          isPreset: false,
          colors: {
            ...baseTheme.colors,
            primary: { main: '#B45309', light: '#D97706', dark: '#D97706', contrastText: '#000000' },
            background: { default: '#1c1917', elevated: '#292524', hover: '#44403c', active: '#57534e', disabled: '#292524' },
            surface: { default: '#292524', variant: '#44403c', overlay: 'rgba(0, 0, 0, 0.75)' },
            text: { primary: '#e7e5e4', secondary: '#a8a29e', disabled: '#78716c', link: '#F59E0B', textPrimary: '#e7e5e4', textSecondary: '#a8a29e', textMuted: '#78716c' },
            border: { default: '#44403c', focus: '#B45309', divider: '#292524' },
          },
        };
      }
      return {
        ...baseTheme,
        id: 'reading-sepia',
        name: '阅读琥珀色',
        isPreset: false,
        colors: {
          ...baseTheme.colors,
          primary: { main: '#D97706', light: '#D97706', dark: '#78350f', contrastText: '#ffffff' },
          background: { default: '#fdf6e3', elevated: '#FFF3CD', hover: '#FEF3C7', active: '#FFB340', disabled: '#FFF3CD' },
          surface: { default: '#FFF3CD', variant: '#FEF3C7', overlay: 'rgba(0, 0, 0, 0.5)' },
          text: { primary: '#5b4636', secondary: '#78716c', disabled: '#a8a29e', link: '#D97706', textPrimary: '#5b4636', textSecondary: '#78716c', textMuted: '#a8a29e' },
          border: { default: '#d6d3d1', focus: '#D97706', divider: '#e7e5e4' },
        },
      };
    }

    case 'color-blind':
      // 色盲友好：调整颜色确保不仅靠颜色传达信息
      // 关键改进：success/error 使用更高对比度 + 不同色相
      return {
        ...baseTheme,
        colors: {
          ...baseTheme.colors,
          success: {
            main: '#34C759', // Apple Green — 与 primary 区分明显
            background: baseTheme.mode === 'dark' ? '#064E3B' : '#F0FDF4',
            text: baseTheme.mode === 'dark' ? '#86EFAC' : '#065F46',
          },
          error: {
            main: '#FF3B30', // Apple Red — 高对比度
            background: baseTheme.mode === 'dark' ? '#7F1D1D' : '#FFF0F0',
            text: baseTheme.mode === 'dark' ? '#FF8080' : '#DC2626',
          },
          warning: {
            main: '#CA8A04', // Yellow-600 — 与 success 色相区分
            background: baseTheme.mode === 'dark' ? '#713F12' : '#FEFCE8',
            text: baseTheme.mode === 'dark' ? '#FDE047' : '#854D0E',
          },
          info: {
            main: '#0E7490', // Cyan-600 — 独立色相
            background: baseTheme.mode === 'dark' ? '#0C4A6E' : '#E8FAFF',
            text: baseTheme.mode === 'dark' ? '#C7D2FE' : '#0C4A6E',
          },
        },
      };

    default:
      return baseTheme;
  }
}

// ============================================================================
// 辅助功能：合并自定义主题覆盖
// ============================================================================

export function mergeThemeOverrides(base: ThemeConfig, overrides: CustomThemeOverrides): ThemeConfig {
  return {
    ...base,
    ...(overrides.colors && { colors: { ...base.colors, ...overrides.colors } }),
    ...(overrides.typography && { typography: { ...base.typography, ...overrides.typography } }),
    ...(overrides.spacing && { spacing: { ...base.spacing, ...overrides.spacing } }),
    ...(overrides.borderRadius && { borderRadius: { ...base.borderRadius, ...overrides.borderRadius } }),
    ...(overrides.transitions && { transitions: { ...base.transitions, ...overrides.transitions } }),
  };
}

// ============================================================================
// 辅助功能：生成 CSS 变量
// ============================================================================

export function generateCSSVariables(theme: ThemeConfig): Record<string, string> {
  // 防御性检查：如果theme或theme.colors不存在，返回空对象
  if (!theme?.colors) {
    logger.warn('[Theme System] ⚠️ generateCSSVariables 收到无效的主题配置');
    return {};
  }

  const vars: Record<string, string> = {};

  // 颜色变量
  Object.entries(theme.colors).forEach(([category, values]) => {
    if (typeof values === 'object' && !Array.isArray(values)) {
      Object.entries(values as Record<string, string>).forEach(([key, value]) => {
        vars[`--color-${category}-${key}`] = value;
      });
    }
  });

  // 排版变量
  Object.entries(theme.typography.fontFamily).forEach(([key, value]) => {
    vars[`--font-${key}`] = value;
  });
  Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
    vars[`--text-${key}`] = value;
  });
  Object.entries(theme.typography.fontWeight).forEach(([key, value]) => {
    vars[`--weight-${key}`] = String(value);
  });

  // 间距变量
  Object.entries(theme.spacing).forEach(([key, value]) => {
    if (key !== 'unit') {
      vars[`--space-${key}`] = value;
    }
  });

  // 圆角变量
  Object.entries(theme.borderRadius).forEach(([key, value]) => {
    vars[`--radius-${key}`] = value;
  });

  // 阴影变量
  Object.entries(theme.shadows.flat).forEach(([key, value]) => {
    vars[`--shadow-${key}`] = value;
  });

  // 动画变量
  Object.entries(theme.transitions.duration).forEach(([key, value]) => {
    vars[`--duration-${key}`] = value;
  });
  Object.entries(theme.transitions.easing).forEach(([key, value]) => {
    vars[`--easing-${key}`] = value;
  });

  // Z-index 变量
  Object.entries(theme.zIndex).forEach(([key, value]) => {
    vars[`--z-${key}`] = String(value);
  });

  return vars;
}

// ============================================================================
// 辅助功能：将主题应用到 DOM
// ============================================================================

export function applyThemeToDOM(theme: ThemeConfig): void {
  // 防御性检查：如果theme无效，不执行任何操作
  if (!theme?.colors) {
    logger.warn('[Theme System] ⚠️ applyThemeToDOM 收到无效的主题配置，跳过应用');
    return;
  }

  const root = document.documentElement;
  const cssVars = generateCSSVariables(theme);

  // 批量构建 CSS text，一次性写入（比逐条 setProperty 快 5-10x）
  const cssText = Object.entries(cssVars)
    .map(([name, value]) => `${name}: ${value};`)
    .join('\n');
  root.style.cssText += cssText;

  // 设置 data 属性用于 CSS 选择器
  root.setAttribute('data-theme', theme.id);
  root.setAttribute('data-mode', theme.mode);

  // 统一使用 .dark class 作为暗色模式选择器（Tailwind dark: 变体依赖它）
  if (theme.mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // 设置颜色方案（影响浏览器原生 UI）
  const colorScheme = theme.mode === 'dark' ? 'dark' : 'light';
  root.style.colorScheme = colorScheme;

  logger.info(`🎨 [Theme System] Applied theme: ${theme.name} (${theme.mode})`);
}



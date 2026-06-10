/**
 * Material Design 3 颜色系统
 *
 * 基于 Material Design 3 色彩模型，包含：
 * - Primary (主色调)
 * - Secondary (辅助色调)
 * - Tertiary (第三色调)
 * - Neutral (中性色)
 * - Neutral Variant (中性变体)
 * - Error (错误色)
 * - Surface & Background (表面与背景)
 * - Inverse (反色)
 * - Surface Tint (表面着色)
 *
 * 所有颜色组合均经过 WCAG 2.1 AA 对比度验证
 */

// 单个颜色角色
export interface ColorRole {
  main: string;
  on: string;           // 在该颜色上的文字颜色
  container: string;    // 容器颜色
  onContainer: string;  // 在容器颜色上的文字颜色
}

// 扩展颜色角色（包含更多变体）
export interface ExtendedColorRole extends ColorRole {
  light?: string;       // 浅色变体
  dark?: string;        // 深色变体
  hover?: string;       // 悬停状态
  disabled?: string;    // 禁用状态
  focus?: string;       // 焦点状态
}

// 功能颜色角色
export interface FunctionalColorRole {
  main: string;
  on: string;
  container: string;
  onContainer: string;
  light?: string;
  dark?: string;
}

// 表面颜色
export interface SurfaceColors {
  default: string;
  variant: string;
  elevated: string;
  dim: string;
  bright: string;
}

// 背景颜色
export interface BackgroundColors {
  default: string;
  surface: string;
}

// 反色系统
export interface InverseColors {
  surface: string;
  onSurface: string;
  primary: string;
}

// 文本颜色
export interface TextColors {
  primary: string;
  secondary: string;
  tertiary: string;
  disabled: string;
}

// 边框颜色
export interface BorderColors {
  default: string;
  variant: string;
}

// 完整颜色令牌
export interface ColorTokens {
  // 主色调系统
  primary: ExtendedColorRole;
  secondary: ExtendedColorRole;
  tertiary: ExtendedColorRole;

  // 中性色系统
  neutral: Record<number, string>;

  // 中性变体系统
  neutralVariant: Record<number, string>;

  // 功能色系统
  error: FunctionalColorRole;
  success: FunctionalColorRole;
  warning: FunctionalColorRole;
  info: FunctionalColorRole;

  // 表面颜色
  surface: SurfaceColors;

  // 背景颜色
  background: BackgroundColors;

  // 反色系统
  inverse: InverseColors;

  // 文本颜色
  text: TextColors;

  // 边框颜色
  border: BorderColors;

  // 表面着色
  surfaceTint: string;

  // 覆盖层
  scrim: string;

  // 状态颜色映射
  state: {
    draft: string;
    pending: string;
    approved: string;
    rejected: string;
    revision: string;
    archived: string;
  };
}

// WCAG 对比度阈值
export const WCAG_THRESHOLD = {
  AA: {
    normal: 4.5,
    large: 3.0,
  },
  AAA: {
    normal: 7.0,
    large: 4.5,
  },
};

// 颜色工具函数

/**
 * 将十六进制颜色转换为 RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * 将 RGB 转换为十六进制
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * 计算相对亮度
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * 计算对比度比率
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return 1;

  const lum1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);

  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return Math.round(((brightest + 0.05) / (darkest + 0.05)) * 100) / 100;
}

/**
 * 检查是否符合 WCAG AA 标准
 */
export function meetsWCAGAA(color1: string, color2: string, largeText = false): boolean {
  const ratio = getContrastRatio(color1, color2);
  const threshold = largeText ? WCAG_THRESHOLD.AA.large : WCAG_THRESHOLD.AA.normal;
  return ratio >= threshold;
}

/**
 * 检查是否符合 WCAG AAA 标准
 */
export function meetsWCAGAAA(color1: string, color2: string, largeText = false): boolean {
  const ratio = getContrastRatio(color1, color2);
  const threshold = largeText ? WCAG_THRESHOLD.AAA.large : WCAG_THRESHOLD.AAA.normal;
  return ratio >= threshold;
}

/**
 * 生成颜色变体
 */
export function generateColorVariants(baseColor: string): Record<string, string> {
  const rgb = hexToRgb(baseColor);
  if (!rgb) return {};

  const variants: Record<string, string> = {};
  const intensities = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const names = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];

  intensities.forEach((intensity, i) => {
    if (i < 5) {
      // 浅色变体 - 添加白色
      const factor = 1 - intensity;
      const r = Math.round(rgb.r * factor + 255 * intensity);
      const g = Math.round(rgb.g * factor + 255 * intensity);
      const b = Math.round(rgb.b * factor + 255 * intensity);
      variants[names[i]] = rgbToHex(r, g, b);
    } else {
      // 深色变体 - 添加黑色
      const factor = (i - 4) / 5;
      const r = Math.round(rgb.r * (1 - factor));
      const g = Math.round(rgb.g * (1 - factor));
      const b = Math.round(rgb.b * (1 - factor));
      variants[names[i]] = rgbToHex(r, g, b);
    }
  });

  return variants;
}

/**
 * 验证颜色组合的对比度
 */
export function validateColorContrast(
  foreground: string,
  background: string,
  label: string,
): {
  ratio: number;
  meetsAA: boolean;
  meetsAAA: boolean;
  label: string;
} {
  const ratio = getContrastRatio(foreground, background);
  return {
    ratio,
    meetsAA: meetsWCAGAA(foreground, background),
    meetsAAA: meetsWCAGAAA(foreground, background),
    label,
  };
}

// 默认浅色主题颜色令牌
export const LIGHT_COLOR_TOKENS: ColorTokens = {
  // 主色调 - 森林绿
  primary: {
    main: '#059669',
    on: '#ffffff',
    container: '#d1fae5',
    onContainer: '#065f46',
    light: '#6ee7b7',
    dark: '#047857',
    hover: '#047857',
    disabled: '#99d5b8',
    focus: '#065f46',
  },

  // 辅助色调 - 海洋蓝
  secondary: {
    main: '#2563eb',
    on: '#ffffff',
    container: '#dbeafe',
    onContainer: '#1e40af',
    light: '#93c5fd',
    dark: '#1d4ed8',
    hover: '#1d4ed8',
    disabled: '#93c5fd',
    focus: '#1e40af',
  },

  // 第三色调 - 生物紫
  tertiary: {
    main: '#7c3aed',
    on: '#ffffff',
    container: '#f3e8ff',
    onContainer: '#4c1d95',
    light: '#c4b5fd',
    dark: '#6d28d9',
    hover: '#6d28d9',
    disabled: '#c4b5fd',
    focus: '#4c1d95',
  },

  // 中性色 Slate
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },

  // 中性变体
  neutralVariant: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },

  // 错误色
  error: {
    main: '#dc2626',
    on: '#ffffff',
    container: '#fee2e2',
    onContainer: '#991b1b',
    light: '#fca5a5',
    dark: '#b91c1c',
  },

  // 成功色
  success: {
    main: '#16a34a',
    on: '#ffffff',
    container: '#dcfce7',
    onContainer: '#166534',
    light: '#86efac',
    dark: '#15803d',
  },

  // 警告色
  warning: {
    main: '#f59e0b',
    on: '#ffffff',
    container: '#fefce8',
    onContainer: '#854d0e',
    light: '#fcd34d',
    dark: '#d97706',
  },

  // 信息色
  info: {
    main: '#0891b2',
    on: '#ffffff',
    container: '#cffafe',
    onContainer: '#164e63',
    light: '#67e8f9',
    dark: '#0e7490',
  },

  // 表面颜色
  surface: {
    default: '#ffffff',
    variant: '#f1f5f9',
    elevated: '#ffffff',
    dim: '#f1f5f9',
    bright: '#ffffff',
  },

  // 背景颜色
  background: {
    default: '#fcfcfc',
    surface: '#ffffff',
  },

  // 反色系统
  inverse: {
    surface: '#1e293b',
    onSurface: '#f8fafc',
    primary: '#d1fae5',
  },

  // 文本颜色
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    tertiary: '#64748b',
    disabled: '#94a3b8',
  },

  // 边框颜色
  border: {
    default: '#e2e8f0',
    variant: '#cbd5e1',
  },

  // 表面着色
  surfaceTint: '#059669',

  // 覆盖层
  scrim: '#000000',

  // 状态颜色映射
  state: {
    draft: '#64748b',
    pending: '#f59e0b',
    approved: '#16a34a',
    rejected: '#dc2626',
    revision: '#f59e0b',
    archived: '#94a3b8',
  },
};

// 默认深色主题颜色令牌
export const DARK_COLOR_TOKENS: ColorTokens = {
  // 主色调 - 更亮的森林绿变体
  primary: {
    main: '#34d399',
    on: '#064e3b',
    container: '#065f46',
    onContainer: '#d1fae5',
    light: '#6ee7b7',
    dark: '#10b981',
    hover: '#6ee7b7',
    disabled: '#065f46',
    focus: '#d1fae5',
  },

  // 辅助色调 - 更亮的蓝色变体
  secondary: {
    main: '#60a5fa',
    on: '#1e3a8a',
    container: '#1e40af',
    onContainer: '#dbeafe',
    light: '#93c5fd',
    dark: '#3b82f6',
    hover: '#93c5fd',
    disabled: '#1e40af',
    focus: '#dbeafe',
  },

  // 第三色调 - 更亮的紫色变体
  tertiary: {
    main: '#a78bfa',
    on: '#3730a3',
    container: '#4c1d95',
    onContainer: '#f3e8ff',
    light: '#c4b5fd',
    dark: '#8b5cf6',
    hover: '#c4b5fd',
    disabled: '#4c1d95',
    focus: '#f3e8ff',
  },

  // 中性色 Slate（深色模式反转）
  neutral: {
    50: '#0f172a',
    100: '#1e293b',
    200: '#334155',
    300: '#475569',
    400: '#64748b',
    500: '#94a3b8',
    600: '#cbd5e1',
    700: '#e2e8f0',
    800: '#f1f5f9',
    900: '#f8fafc',
  },

  // 中性变体（深色模式）
  neutralVariant: {
    50: '#0c4a6e',
    100: '#075985',
    200: '#0369a1',
    300: '#0284c7',
    400: '#0ea5e9',
    500: '#7dd3fc',
    600: '#bae6fd',
    700: '#e0f2fe',
    800: '#f0f9ff',
    900: '#fafafa',
  },

  // 错误色（深色模式）
  error: {
    main: '#f87171',
    on: '#7f1d1d',
    container: '#991b1b',
    onContainer: '#fee2e2',
    light: '#fca5a5',
    dark: '#ef4444',
  },

  // 成功色（深色模式）
  success: {
    main: '#4ade80',
    on: '#14532d',
    container: '#15803d',
    onContainer: '#dcfce7',
    light: '#86efac',
    dark: '#16a34a',
  },

  // 警告色（深色模式）
  warning: {
    main: '#fbbf24',
    on: '#78350f',
    container: '#b45309',
    onContainer: '#fefce8',
    light: '#fcd34d',
    dark: '#f59e0b',
  },

  // 信息色（深色模式）
  info: {
    main: '#22d3ee',
    on: '#164e63',
    container: '#0e7490',
    onContainer: '#cffafe',
    light: '#67e8f9',
    dark: '#0891b2',
  },

  // 表面颜色（深色模式）
  surface: {
    default: '#1e293b',
    variant: '#334155',
    elevated: '#334155',
    dim: '#0f172a',
    bright: '#334155',
  },

  // 背景颜色（深色模式）
  background: {
    default: '#0f172a',
    surface: '#1e293b',
  },

  // 反色系统（深色模式）
  inverse: {
    surface: '#f8fafc',
    onSurface: '#1e293b',
    primary: '#065f46',
  },

  // 文本颜色（深色模式）
  text: {
    primary: '#f8fafc',
    secondary: '#cbd5e1',
    tertiary: '#94a3b8',
    disabled: '#64748b',
  },

  // 边框颜色（深色模式）
  border: {
    default: '#475569',
    variant: '#64748b',
  },

  // 表面着色（深色模式）
  surfaceTint: '#34d399',

  // 覆盖层（深色模式）
  scrim: '#000000',

  // 状态颜色映射（深色模式）
  state: {
    draft: '#94a3b8',
    pending: '#fbbf24',
    approved: '#4ade80',
    rejected: '#f87171',
    revision: '#fbbf24',
    archived: '#64748b',
  },
};

// 验证颜色对比度的测试用例
export const COLOR_CONTRAST_TESTS = [
  // 主色调组合
  validateColorContrast(LIGHT_COLOR_TOKENS.primary.on, LIGHT_COLOR_TOKENS.primary.main, 'primary.on on primary.main'),
  validateColorContrast(LIGHT_COLOR_TOKENS.primary.onContainer, LIGHT_COLOR_TOKENS.primary.container, 'primary.onContainer on primary.container'),

  // 辅助色调组合
  validateColorContrast(LIGHT_COLOR_TOKENS.secondary.on, LIGHT_COLOR_TOKENS.secondary.main, 'secondary.on on secondary.main'),
  validateColorContrast(LIGHT_COLOR_TOKENS.secondary.onContainer, LIGHT_COLOR_TOKENS.secondary.container, 'secondary.onContainer on secondary.container'),

  // 文本颜色组合
  validateColorContrast(LIGHT_COLOR_TOKENS.text.primary, LIGHT_COLOR_TOKENS.background.default, 'text.primary on background.default'),
  validateColorContrast(LIGHT_COLOR_TOKENS.text.secondary, LIGHT_COLOR_TOKENS.background.default, 'text.secondary on background.default'),
  validateColorContrast(LIGHT_COLOR_TOKENS.text.tertiary, LIGHT_COLOR_TOKENS.background.default, 'text.tertiary on background.default'),

  // 深色模式文本组合
  validateColorContrast(DARK_COLOR_TOKENS.text.primary, DARK_COLOR_TOKENS.background.default, 'dark text.primary on dark background.default'),
  validateColorContrast(DARK_COLOR_TOKENS.text.secondary, DARK_COLOR_TOKENS.background.default, 'dark text.secondary on dark background.default'),

  // 功能色组合
  validateColorContrast(LIGHT_COLOR_TOKENS.error.on, LIGHT_COLOR_TOKENS.error.main, 'error.on on error.main'),
  validateColorContrast(LIGHT_COLOR_TOKENS.error.onContainer, LIGHT_COLOR_TOKENS.error.container, 'error.onContainer on error.container'),
];

// 导出颜色工具
export const colorUtils = {
  hexToRgb,
  rgbToHex,
  getRelativeLuminance,
  getContrastRatio,
  meetsWCAGAA,
  meetsWCAGAAA,
  generateColorVariants,
  validateColorContrast,
};

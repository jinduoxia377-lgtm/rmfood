/**
 * RMFOOD 配方平台 - 主题模式系统
 *
 * ⚠️ DEPRECATED — 类型定义已迁移至 theme.types.ts
 * 此文件仅为向后兼容而存在，re-export 自统一类型系统。
 * 新代码请直接导入 @/types/theme.types
 */

import type {
  ThemeStyles,
  ThemeColors,
  ThemeFont,
  ThemeSpacing,
  ThemeAnimation,
  UserCustomTheme,
  ThemeVersion,
  ThemeEventType,
} from './theme.types';

export type {
  ThemeMode,
  ThemeEventType,
  UserCustomTheme as CustomTheme,
  ThemeStyles,
  ThemeColors,
  ThemeFont,
  ThemeSpacing,
  ThemeAnimation,
  ThemeVersion,
} from './theme.types';

// 默认主题样式 — 从 theme.types.ts 导出
export const DEFAULT_THEME_STYLES: Required<ThemeStyles> = {
  colors: {
    primary: '#34C759',
    secondary: '#0A84FF',
    tertiary: '#AF52DE',
    background: '#F5F5F7',
    surface: '#FFFFFF',
    text: '#1D1D1F',
    onBackground: '#1D1D1F',
    onPrimary: '#ffffff',
    error: '#FF3B30',
    onError: '#ffffff',
    success: '#34C759',
    warning: '#FF9F0A',
    info: '#007AFF',
    border: '#E5E7EB',
    focusRing: '#0A84FF',
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
      0: '0px', 1: '4px', 2: '8px', 3: '12px', 4: '16px',
      5: '20px', 6: '24px', 8: '32px', 10: '40px', 12: '48px', 16: '64px',
    },
    borderRadius: {
      none: '0px', sm: '4px', md: '8px', lg: '12px',
      xl: '16px', '2xl': '20px', full: '9999px',
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
      instant: '0ms', fast: '100ms', normal: '200ms',
      slow: '300ms', slower: '400ms',
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
 * @deprecated 使用 zod 或其他 schema 验证库替代
 */
export function validateThemeConfig(config: unknown): config is ThemeStyles {
  if (!config || typeof config !== 'object') return false;
  const themeConfig = config as Record<string, unknown>;
  if (themeConfig.colors !== undefined) {
    if (typeof themeConfig.colors !== 'object' || themeConfig.colors === null) return false;
    for (const value of Object.values(themeConfig.colors as Record<string, unknown>)) {
      if (value !== undefined && typeof value !== 'string') return false;
    }
  }
  if (themeConfig.font !== undefined) {
    if (typeof themeConfig.font !== 'object' || themeConfig.font === null) return false;
    const font = themeConfig.font as Record<string, unknown>;
    if (font.fontFamily !== undefined && typeof font.fontFamily !== 'string') return false;
  }
  if (themeConfig.spacing !== undefined) {
    if (typeof themeConfig.spacing !== 'object' || themeConfig.spacing === null) return false;
  }
  if (themeConfig.animation !== undefined) {
    if (typeof themeConfig.animation !== 'object' || themeConfig.animation === null) return false;
  }
  return true;
}

/**
 * 清理并规范化主题输入
 * @deprecated 使用 deepMerge 工具函数替代
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

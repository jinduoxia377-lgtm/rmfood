/**
 * Legacy useTheme Hook — 薄兼容层
 *
 * 将所有 useTheme 调用转发到 Zustand 主题系统（@/theme）。
 * 保留此文件以确保向后兼容，避免修改大量现有组件。
 *
 * 策略：
 * - useTheme() → 包装 Zustand context，补充 isDark 等旧字段
 * - 类型 → @/types/theme.types
 * - 预设主题 → @/theme.presetThemes（Zustand 系统）
 * - 遗留常量 → 静态数据，供 SettingsPage UI 渲染使用
 */

import {
  useTheme as useThemeFromStore,
  useThemeStore,
  useThemeColors,
  useTypography,
  useSpacing,
  useIsDarkMode,
  useThemedValue,
  useCSSVariable,
  presetThemes,
  type ThemeMode,
  type AccessibilityMode,
  type TransitionType,
  type PresetThemeId,
  type ThemeConfig,
} from '@/theme';

// ==================== 类型导出 ====================

export type {
  ThemeStore,
  ThemeState,
  ThemeActions,
  ThemeProviderProps,
  CustomThemeOverrides,
  MotionPreferences,
  SemanticColors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Transitions,
  Breakpoints,
  ZIndex,
  FontFamily,
  FontSize,
  LineHeight,
  FontWeight,
} from '@/types/theme.types';

// ==================== 核心兼容 Hook ====================

/**
 * 兼容旧版 useTheme() 返回结构。
 * 旧版返回 { settings, isDark, updateSettings, ... }
 * 新版 Zustand 返回 { theme, mode, setThemeMode, ... }
 * 此包装层桥接两者。
 */
export const useTheme = () => {
  const store = useThemeFromStore();
  const storeFull = useThemeStore();
  const isDark = store.mode === 'dark' || store.theme?.mode === 'dark';

  return {
    // === 旧版兼容字段 ===
    isDark,
    isAutoMode: store.mode === 'system',
    settings: {
      mode: store.mode === 'system' ? 'auto' : store.mode,
      animation: !storeFull.motionPreferences?.disableAnimations,
      density: 'comfortable' as const,
      fontSize: 16,
      fontFamily: store.theme?.typography?.fontFamily?.body || "'Microsoft YaHei', system-ui, sans-serif",
      fontColor: store.theme?.colors?.text?.primary || '#1f2937',
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: 0,
      accentColor: store.theme?.colors?.primary?.main || '#34C759',
      sidebarCollapsed: false,
      borderRadius: 8,
      shadowIntensity: 2,
      customColors: { light: {}, dark: {} },
      cloudSync: false,
      sidebarTransparent: false,
      sidebarOpacity: 0.5,
    },
    updateSettings: (newSettings: Partial<any>) => {
      if (newSettings.mode) {
        const modeMap: Record<string, ThemeMode> = {
          light: 'light',
          dark: 'dark',
          auto: 'system',
        };
        store.setThemeMode(modeMap[newSettings.mode] || 'system');
      }
    },
    resetSettings: store.resetToDefault,
    applyTheme: () => {}, // Zustand store 自动应用
    applyPreset: (presetId: string) => {
      // 将旧版 preset ID 映射到 Zustand 预设
      const idMap: Record<string, PresetThemeId> = {
        'professional-green': 'light-default',
        'medical-blue': 'light-default',
        'warm-orange': 'light-warm',
        'google-light': 'light-default',
      };
      const mappedId = idMap[presetId] || 'light-default';
      store.setPresetTheme(mappedId);
    },
    getCurrentColors: () => {
      const c = store.theme?.colors || presetThemes['light-default'].colors;
      return {
        ...c,
        textPrimary: c.text?.primary || '#1D1D1F',
        textSecondary: c.text?.secondary || '#4B5563',
        textMuted: c.text?.textMuted || '#9CA3AF',
        surfaceVariant: c.surfaceVariant || '#F3F4F6',
        errorContainer: c.errorContainer || '#FFE0E0',
        outline: c.border?.default || '#E5E7EB',
        outlineVariant: c.outlineVariant || '#E5E7EB',
        tertiary: c.tertiary?.main || '#AF52DE',
      } as Record<string, string>;
    },
    checkContrast: (c1: string, c2: string) => getContrastRatio(c1, c2),
    meetsWCAGAA: (c1: string, c2: string) => getContrastRatio(c1, c2) >= 4.5,

    // === Zustand 原生字段（直接暴露） ===
    mode: store.mode,
    accessibilityMode: store.accessibilityMode,
    setThemeMode: store.setThemeMode,
    setPresetTheme: store.setPresetTheme,
    setAccessibilityMode: store.setAccessibilityMode,
    setTransitionType: store.setTransitionType,
    resetToDefault: store.resetToDefault,
    exportTheme: store.exportTheme,
    importTheme: store.importTheme,
    theme: store.theme,
    isTransitioning: store.isTransitioning,
    isInitialized: store.isInitialized,
    motionPreferences: storeFull.motionPreferences,
    toggleTheme: () => {
      // 切换 light/dark
      const newMode = store.mode === 'dark' ? 'light' : 'dark';
      store.setThemeMode(newMode);
    },
  };
};

// ==================== 便捷 Hook ====================

export const useThemeSettings = () => {
  const theme = useTheme();
  return {
    settings: theme.settings,
    setMode: (mode: 'light' | 'dark' | 'auto') => theme.updateSettings({ mode }),
    setAnimation: () => {},
    setDensity: () => {},
    setFontSize: () => {},
    setFontFamily: () => {},
    setFontColor: () => {},
    setAccentColor: () => {},
    setBorderRadius: () => {},
    setShadowIntensity: () => {},
    setCustomColors: () => {},
    setCloudSync: () => {},
    setSidebarCollapsed: () => {},
    setSidebarTransparent: () => {},
    setSidebarOpacity: () => {},
    applyPreset: theme.applyPreset,
    resetSettings: theme.resetSettings,
  };
};

// ==================== 从 Zustand 系统直接导出 ====================

export {
  useThemeStore,
  useThemeColors,
  useTypography,
  useSpacing,
  useIsDarkMode,
  useThemedValue,
  useCSSVariable,
  presetThemes,
  getDefaultTheme,
  getAccessibilityTheme,
  mergeThemeOverrides,
  applyThemeToDOM,
  generateCSSVariables,
  ThemeProvider,
} from '@/theme';

// ==================== SettingsPage 需要的类型 ====================

export type InterfaceDensity = 'compact' | 'comfortable' | 'spacious';
export type ShadowIntensity = 0 | 1 | 2 | 3 | 4;
export type ThemeModeLegacy = 'light' | 'dark' | 'auto';

// Legacy types for config/theme.config.ts compatibility
export interface CompleteThemePreset {
  id: string;
  name: string;
  description: string;
  lightColors: Record<string, string>;
  darkColors: Record<string, string>;
  borderRadius: number;
  shadowIntensity: ShadowIntensity;
  density: InterfaceDensity;
  fontSize: number;
  fontFamily: string;
}

// ==================== COMPLETE_THEME_PRESETS ====================
/**
 * 从 Zustand presetThemes 动态生成，确保与运行时主题一致。
 * 供 SettingsPage.tsx 的预设主题选择器使用。
 */
export const COMPLETE_THEME_PRESETS: Array<{
  id: string;
  name: string;
  description: string;
  lightColors: Record<string, string>;
  darkColors: Record<string, string>;
  borderRadius: number;
  shadowIntensity: ShadowIntensity;
  density: InterfaceDensity;
  fontSize: number;
  fontFamily: string;
}> = Object.values(presetThemes).map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description || '',
  lightColors: t.mode === 'light' ? { primary: t.colors.primary.main } : {},
  darkColors: t.mode === 'dark' ? { primary: t.colors.primary.main } : {},
  borderRadius: 8,
  shadowIntensity: 2 as ShadowIntensity,
  density: 'comfortable' as InterfaceDensity,
  fontSize: 16,
  fontFamily: t.typography.fontFamily.body || "'Microsoft YaHei', system-ui, sans-serif",
} as {
  id: string;
  name: string;
  description: string;
  lightColors: Record<string, string>;
  darkColors: Record<string, string>;
  borderRadius: number;
  shadowIntensity: ShadowIntensity;
  density: InterfaceDensity;
  fontSize: number;
  fontFamily: string;
}));

// ==================== 字体选项 ====================

export const FONT_OPTIONS = [
  {
    id: 'system',
    name: '系统默认',
    family: "'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif",
    category: 'sans-serif' as const,
    weights: [400, 500, 600, 700],
    description: '操作系统默认中文字体',
    preview: '微软雅黑 Aa',
  },
  {
    id: 'inter',
    name: 'Inter',
    family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    category: 'sans-serif' as const,
    weights: [300, 400, 500, 600, 700, 800],
    description: '现代无衬线字体',
    preview: 'Inter Aa',
  },
  {
    id: 'jetbrains',
    name: 'JetBrains Mono',
    family: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    category: 'mono' as const,
    weights: [400, 500, 600, 700],
    description: '等宽编程字体',
    preview: 'JetBrains',
  },
  {
    id: 'source-han-serif',
    name: '思源宋体',
    family: "'Source Han Serif SC', 'SimSun', serif",
    category: 'serif' as const,
    weights: [400, 500, 600, 700],
    description: '中文衬线字体',
    preview: '思源宋体',
  },
  {
    id: 'roboto',
    name: 'Roboto',
    family: "'Roboto', 'Helvetica Neue', Arial, sans-serif",
    category: 'sans-serif' as const,
    weights: [300, 400, 500, 700, 900],
    description: 'Material Design 标准字体',
    preview: 'Roboto Aa',
  },
];

export const FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 22, 24];

export const FONT_WEIGHT_OPTIONS = [
  { value: 300, label: '细体 (Light)', desc: '300' },
  { value: 400, label: '常规 (Regular)', desc: '400' },
  { value: 500, label: '中等 (Medium)', desc: '500' },
  { value: 600, label: '半粗 (Semi Bold)', desc: '600' },
  { value: 700, label: '粗体 (Bold)', desc: '700' },
];

export const LINE_HEIGHT_OPTIONS = [
  { value: 1.0, label: '紧凑', desc: '1.0' },
  { value: 1.25, label: '适中', desc: '1.25' },
  { value: 1.5, label: '标准', desc: '1.5' },
  { value: 1.75, label: '宽松', desc: '1.75' },
  { value: 2.0, label: '舒展', desc: '2.0' },
];

export const LETTER_SPACING_OPTIONS = [
  { value: -0.5, label: '紧密', desc: '-0.5' },
  { value: 0, label: '标准', desc: '0' },
  { value: 0.5, label: '宽松', desc: '0.5' },
  { value: 1, label: '分散', desc: '1.0' },
];

export const FONT_COLOR_PRESETS = [
  { id: 'default', name: '默认黑', color: '#1D1D1F' },
  { id: 'dark-gray', name: '深灰', color: '#374151' },
  { id: 'navy', name: '藏青', color: '#002A60' },
  { id: 'forest', name: '森林绿', color: '#34C759' },
  { id: 'ocean', name: '海洋蓝', color: '#0A84FF' },
  { id: 'purple', name: '紫罗兰', color: '#AF52DE' },
  { id: 'rose', name: '玫瑰红', color: '#E11D48' },
  { id: 'amber', name: '琥珀', color: '#B45309' },
];

// ==================== 主题预设（旧版） ====================

export const THEME_PRESETS = [
  { id: 'forest', name: '森林绿', accentColor: '#34C759', description: '自然、健康，专业' },
  { id: 'ocean', name: '海洋蓝', accentColor: '#007AFF', description: '科技、清晰、信任' },
  { id: 'purple', name: '生物紫', accentColor: '#AF52DE', description: '创新、智能、前沿' },
  { id: 'teal', name: '科技青', accentColor: '#0E7490', description: '现代、活力' },
  { id: 'google-light', name: 'Google 浅色', accentColor: '#4285F4', description: '现代、简洁、专业' },
];

// ==================== 专业主题（空对象，旧版兼容） ====================

export const PROFESSIONAL_THEMES: Record<string, unknown> = {};

// ==================== 登录页专用配色 ====================

export const LOGIN_THEME = {
  light: {
    background: 'var(--bg-canvas, #F5F5F7)',
    cardBackground: 'var(--card-bg-solid, #FFFFFF)',
    brandGradient: 'linear-gradient(135deg, var(--color-primary, #34C759) 0%, var(--color-primary-hover, #28A745) 50%, var(--color-primary-800, #065F46) 100%)',
    textPrimary: 'var(--text-primary, #1D1D1F)',
    textSecondary: 'var(--text-secondary, #6E6E73)',
    border: 'var(--border-color, rgba(0, 0, 0, 0.06))',
    inputBackground: 'var(--bg-tertiary, #F5F5F7)',
    inputBorder: 'var(--border-subtle, rgba(0, 0, 0, 0.06))',
    buttonBackground: 'var(--color-primary, #34C759)',
    buttonHover: 'var(--color-primary-hover, #28A745)',
    errorBackground: 'var(--color-error-container, #FFF0F0)',
    errorBorder: 'var(--color-error-container, #FFD0D0)',
    errorText: 'var(--color-error, #FF3B30)',
  },
  'google-light': {
    background: '#FFFFFF',
    cardBackground: '#F8F9FA',
    brandGradient: 'linear-gradient(135deg, #4285F4 0%, #3367D6 50%, #1A3A78 100%)',
    textPrimary: '#202124',
    textSecondary: '#5F6368',
    border: 'rgba(218, 220, 224, 0.5)',
  },
  dark: {
    background: 'var(--bg-canvas, #000000)',
    cardBackground: 'var(--bg-surface, #1C1C1E)',
    brandGradient: 'linear-gradient(135deg, var(--color-primary, #30D158) 0%, var(--color-primary-hover, #34C759) 50%, var(--color-primary-800, #065F46) 100%)',
    textPrimary: '#F9FAFB',
    textSecondary: '#9CA3AF',
    border: 'rgba(148, 163, 184, 0.2)',
  },
};

// ==================== WCAG 对比度 ====================

export const WCAG_CONTRAST = {
  AA: { normal: 4.5, large: 3 },
  AAA: { normal: 7, large: 4.5 },
};

export const VERIFIED_COLOR_COMBOS = [];

// ==================== 排版/间距/圆角/阴影系统 ====================

export const TYPOGRAPHY = {
  display: {
    '2xl': { fontSize: '3rem', lineHeight: '3.5rem', fontWeight: 700 },
    xl: { fontSize: '2.25rem', lineHeight: '2.75rem', fontWeight: 700 },
    lg: { fontSize: '1.875rem', lineHeight: '2.375rem', fontWeight: 600 },
  },
  heading: {
    h1: { fontSize: '1.875rem', lineHeight: '2.375rem', fontWeight: 700 },
    h2: { fontSize: '1.5rem', lineHeight: '2rem', fontWeight: 600 },
    h3: { fontSize: '1.25rem', lineHeight: '1.75rem', fontWeight: 600 },
    h4: { fontSize: '1.125rem', lineHeight: '1.5rem', fontWeight: 600 },
  },
  body: {
    lg: { fontSize: '1.125rem', lineHeight: '1.75rem', fontWeight: 400 },
    base: { fontSize: '1rem', lineHeight: '1.5rem', fontWeight: 400 },
    sm: { fontSize: '0.875rem', lineHeight: '1.25rem', fontWeight: 400 },
    xs: { fontSize: '0.75rem', lineHeight: '1rem', fontWeight: 400 },
  },
};

export const SPACING_SYSTEM = {
  xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem', '3xl': '4rem',
};

export const BORDER_RADIUS = {
  none: '0', sm: '0.375rem', md: '0.5rem', lg: '0.75rem', xl: '1rem', '2xl': '1.5rem', '3xl': '2rem', full: '9999px',
};

export const SHADOW_SYSTEM = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
};

// ==================== 默认值（旧版兼容占位） ====================

export const DEFAULT_THEME = {};
export const DEFAULT_SETTINGS = {};
export const THEME_PROVIDER = {};

// ==================== 颜色工具（真实实现） ====================

function hexToRgbFn(hex: string): { r: number; g: number; b: number } | null {
  const m = String(hex).match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (!m) return null
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

export function getContrastRatio(c1: string, c2: string): number {
  const rgb1 = hexToRgbFn(c1)
  const rgb2 = hexToRgbFn(c2)
  if (!rgb1 || !rgb2) return 1
  const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b)
  const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function checkWCAGAACompliance(ratio: number, largeText = false): boolean {
  return largeText ? ratio >= 3 : ratio >= 4.5
}

export const colorUtils = {
  hexToRgb: hexToRgbFn,
  rgbToHsl: () => ({ h: 0, s: 0, l: 0 }),
  getContrastRatio,
  checkWCAGAACompliance,
  generateColorVariants: () => ({}),
}
export const generateColorVariants = () => ({})

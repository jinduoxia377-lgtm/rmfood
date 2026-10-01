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
 *
 * D-40 修复：本导出**原名为 `useTheme`**，与 `@/theme`
 * （即 `stores/ThemeProvider.tsx`）导出的现代 `useTheme` **同名但返回结构不兼容** ——
 * 消费方从不同路径导入会得到完全不同的形状，且 IDE 无法提示。
 * 现已改名为 `useLegacyTheme`，`useTheme` 全项目唯一。
 *
 * @deprecated 仅为旧返回结构保留。新代码**必须**使用 `@/theme` 的
 * `useTheme()` / `useIsDarkMode()`。当前已无任何消费者，
 * 计划在 M3（死代码清理，D-18/D-25）随本文件一并删除。
 */
export const useLegacyTheme = () => {
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
        'warm-orange': 'light-default',
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
      } as unknown as Record<string, string>;
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
  // D-40：本函数返回的是**遗留结构**（settings/updateSettings），故调用本地遗留包装层。
  // 改名后不能再用 `useTheme()` —— 那会解析到未导入的现代 hook。
  const theme = useLegacyTheme();
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
  getContrastRatio,
  checkWCAGAACompliance,
} as const

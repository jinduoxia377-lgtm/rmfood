/**
 * RMFOOD 主题系统 - 模块导出索引
 * 专业级 UI/UX 主题管理解决方案
 *
 * 基于 Zustand 状态管理，支持 Light/Dark 两套主题
 * - ✅ 多模式支持（Light / Dark / System）
 * - ✅ WCAG 2.1 AA/AAA 无障碍标准
 * - ✅ 高对比度模式
 * - ✅ 阅读模式（Sepia/Dark）
 * - ✅ 平滑过渡动画（Fade/Slide/Scale）
 * - ✅ 持久化存储（localStorage）
 * - ✅ Reduced Motion 支持
 * - ✅ 完整的 TypeScript 类型定义
 * - ✅ React Hooks 集成
 * - ✅ 自定义主题导入/导出
 */

// ==================== 核心类型 ====================
export type {
  ThemeMode,
  AccessibilityMode,
  TransitionType,
  ThemeConfig,
  PresetThemeId,
  CustomThemeOverrides,
  ThemeState,
  ThemeActions,
  ThemeStore,
  ThemeProviderProps,
} from '../types/theme.types';

// ==================== Store & Provider ====================
export { useThemeStore } from '../stores/themeStore';
export { ThemeProvider, useTheme, useThemeColors, useTypography, useSpacing, useIsDarkMode, useThemedValue, useCSSVariable } from '../stores/ThemeProvider';

// ==================== 预设主题 ====================
export { presetThemes, getDefaultTheme, getAccessibilityTheme, mergeThemeOverrides, generateCSSVariables, applyThemeToDOM } from '../stores/theme.presets';

// ==================== 持久化存储 ====================
export { themeStorage, ThemeStorage } from '../stores/theme.storage';

// ==================== 语义主题 ====================
export type { SemanticColorVars } from '../hooks/useSemanticTheme';
export { useSemanticTheme, getSemanticColor } from '../hooks/useSemanticTheme';

// ==================== UI 组件 ====================
export { ThemeSwitcher } from '../components/theme/ThemeSwitcher';

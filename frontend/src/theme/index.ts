/**
 * RMFOOD 主题系统 - 模块导出索引
 * 专业级 UI/UX 主题管理解决方案
 *
 * 功能特性：
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
export { useThemeStore, default as themeStore } from '../stores/themeStore';
export { ThemeProvider, useTheme, useThemeColors, useTypography, useSpacing, useIsDarkMode, useThemedValue, useCSSVariable } from '../stores/ThemeProvider';

// ==================== 预设主题 ====================
export { presetThemes, getDefaultTheme, getAccessibilityTheme, mergeThemeOverrides, generateCSSVariables, applyThemeToDOM } from '../stores/theme.presets';

// ==================== 持久化存储 ====================
export { themeStorage, ThemeStorage } from '../stores/theme.storage';

// ==================== UI 组件 ====================
export { ThemeSwitcher, default as themeSwitcher } from '../components/theme/ThemeSwitcher';

// ==================== CSS 样式文件路径 ====================
/**
 * 使用方法：
 * 在 main.tsx 或 App.tsx 中导入：
 * import './styles/theme.css';
 */
export const THEME_CSS_PATH = './styles/theme.css';

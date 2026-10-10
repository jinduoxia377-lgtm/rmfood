/**
 * useSemanticTheme — 语义主题 Hook
 *
 * 提供从 SemanticColors 到 CSS 变量字符串的映射，供图表、画布等
 * 需要程序化颜色访问的场景使用。
 *
 * 返回格式与 Tailwind v4 @theme 定义严格对齐，确保 JS 与 CSS 使用同一变量名。
 */
import { useIsDarkMode } from'@/theme';

/** 当前主题的语义色映射（CSS 变量引用） */
export interface SemanticColorVars {
 /** 品牌主色 */
 primary: string;
 primaryLight: string;
 primaryDark: string;
 primaryContainer: string;
 primary50: string;
 primary400: string;
 primary600: string;
 primary700: string;
 primary900: string;

 /** 次要色 */
 secondary: string;
 secondaryLight: string;
 secondaryContainer: string;
 secondary400: string;
 secondary600: string;

 /** 第三色 */
 tertiary: string;
 tertiaryLight: string;
 tertiaryContainer: string;

 /** 功能色 */
 success: string;
 successLight: string;
 success50: string;
 success400: string;
 success600: string;

 warning: string;
 warningLight: string;
 warning50: string;
 warning400: string;
 warning600: string;

 error: string;
 errorLight: string;
 error50: string;
 error400: string;
 error600: string;

 info: string;
 infoLight: string;
 info50: string;
 info400: string;
 info600: string;

 /** 中性色 */
 neutral50: string;
 neutral100: string;
 neutral200: string;
 neutral300: string;
 neutral400: string;
 neutral500: string;
 neutral600: string;
 neutral700: string;
 neutral800: string;
 neutral900: string;

 /** 文本 */
 textPrimary: string;
 textSecondary: string;
 textMuted: string;
 textDisabled: string;

 /** 背景 / 表面 */
 bgCanvas: string;
 bgPrimary: string;
 bgSecondary: string;
 bgTertiary: string;
 bgSurface: string;
 bgElevated: string;
 bgHover: string;
 cardBgSolid: string;
 surfaceVariant: string;

 /** 边框 */
 borderDefault: string;
 borderSubtle: string;
 borderHover: string;
 borderDivider: string;
 focusRing: string;

 /** 阴影 */
 shadowSm: string;
 shadowCard: string;
 shadowMd: string;
 shadowLg: string;
 shadowModal: string;
 shadowGlass: string;

 /** 毛玻璃 */
 glassBg: string;
 glassBorder: string;
 headerBg: string;
 materialAcrylic: string;

 /** 渐变文字 */
 gradientTextPrimary: string;
 gradientTextSecondary: string;

 /** 补充色系 */
 orange500: string;
 purple500: string;
 pink500: string;
 cyan500: string;
 sky500: string;
 indigo500: string;
 teal500: string;
 lime500: string;
 yellow500: string;
}

/**
 * 将 CSS 变量引用包装为 safe CSS 字符串
 * 在 JS 中读取 CSS 变量需通过 getComputedStyle，此处直接返回 var() 引用
 */
function cssVar(name: string): string {
 return `var(${name})`;
}

/**
 * 根据当前主题模式构建完整的语义色映射对象
 * 返回的值都是 CSS 变量引用，不是硬编码颜色
 */
export function useSemanticTheme(): SemanticColorVars {
 const dark = useIsDarkMode();

 return {
 // 品牌色
 primary: cssVar('--color-primary'),
 primaryLight: cssVar('--color-primary-300'),
 primaryDark: cssVar('--color-primary-700'),
 primaryContainer: cssVar('--color-primary-container'),
 primary50: cssVar('--color-primary-50'),
 primary400: cssVar('--color-primary-400'),
 primary600: cssVar('--color-primary-600'),
 primary700: cssVar('--color-primary-700'),
 primary900: cssVar('--color-primary-900'),

 // 次要色
 secondary: cssVar('--color-secondary'),
 secondaryLight: cssVar('--color-secondary-300'),
 secondaryContainer: cssVar('--color-secondary-container'),
 secondary400: cssVar('--color-secondary-400'),
 secondary600: cssVar('--color-secondary-600'),

 // 第三色
 tertiary: cssVar('--color-tertiary'),
 tertiaryLight: cssVar('--color-tertiary-300'),
 tertiaryContainer: cssVar('--color-tertiary-container'),

 // 功能色
 success: cssVar('--color-success'),
 successLight: cssVar('--color-success-400'),
 success50: cssVar('--color-success-50'),
 success400: cssVar('--color-success-400'),
 success600: cssVar('--color-success-600'),

 warning: cssVar('--color-warning'),
 warningLight: cssVar('--color-warning-400'),
 warning50: cssVar('--color-warning-50'),
 warning400: cssVar('--color-warning-400'),
 warning600: cssVar('--color-warning-600'),

 error: cssVar('--color-error'),
 errorLight: cssVar('--color-error-400'),
 error50: cssVar('--color-error-50'),
 error400: cssVar('--color-error-400'),
 error600: cssVar('--color-error-600'),

 info: cssVar('--color-info'),
 infoLight: cssVar('--color-info-400'),
 info50: cssVar('--color-info-50'),
 info400: cssVar('--color-info-400'),
 info600: cssVar('--color-info-600'),

 // 中性色
 neutral50: cssVar('--color-neutral-50'),
 neutral100: cssVar('--color-neutral-100'),
 neutral200: cssVar('--color-neutral-200'),
 neutral300: cssVar('--color-neutral-300'),
 neutral400: cssVar('--color-neutral-400'),
 neutral500: cssVar('--color-neutral-500'),
 neutral600: cssVar('--color-neutral-600'),
 neutral700: cssVar('--color-neutral-700'),
 neutral800: cssVar('--color-neutral-800'),
 neutral900: cssVar('--color-neutral-900'),

 // 文本
 textPrimary: cssVar('--text-primary'),
 textSecondary: cssVar('--text-secondary'),
 textMuted: cssVar('--text-muted'),
 textDisabled: cssVar('--text-disabled'),

 // 背景 / 表面
 bgCanvas: cssVar('--bg-canvas'),
 bgPrimary: cssVar('--bg-primary'),
 bgSecondary: cssVar('--bg-secondary'),
 bgTertiary: cssVar('--bg-tertiary'),
 bgSurface: cssVar('--bg-surface'),
 bgElevated: cssVar('--bg-surface-elevated'),
 bgHover: cssVar('--bg-surface-hover'),
 cardBgSolid: cssVar('--card-bg-solid'),
 surfaceVariant: cssVar('--bg-surface-variant'),

 // 边框
 borderDefault: cssVar('--border-default'),
 borderSubtle: cssVar('--border-subtle'),
 borderHover: cssVar('--border-color-hover'),
 borderDivider: cssVar('--border-divider'),
 focusRing: cssVar('--color-primary'),

 // 阴影
 shadowSm: cssVar('--shadow-sm'),
 shadowCard: cssVar('--shadow-card'),
 shadowMd: cssVar('--shadow-md'),
 shadowLg: cssVar('--shadow-lg'),
 shadowModal: cssVar('--shadow-modal'),
 shadowGlass: cssVar('--shadow-glass'),

 // 毛玻璃
 glassBg: cssVar('--glass-bg'),
 glassBorder: cssVar('--glass-border'),
 headerBg: cssVar('--header-bg'),
 materialAcrylic: cssVar('--material-acrylic'),

 // 渐变
 gradientTextPrimary: cssVar('--gradient-text-primary'),
 gradientTextSecondary: cssVar('--gradient-text-secondary'),

 // 补充色系
 orange500: cssVar('--color-warning-500'),
 purple500: cssVar('--color-accent-500'),
 pink500: cssVar('--color-danger-500'),
 cyan500: cssVar('--color-info-500'),
 sky500: cssVar('--color-sky-500'),
 indigo500: cssVar('--color-accent-500'),
 teal500: cssVar('--color-teal-500'),
 lime500: cssVar('--color-success-500'),
 yellow500: cssVar('--color-warning-500'),
 };
}

/**
 * 获取当前主题的主色 hex 值（用于 canvas/chart 等需要实际颜色的场景）
 * 通过 getComputedStyle 读取实际渲染值
 */
export function getSemanticColor(name: keyof SemanticColorVars): string {
 if (typeof document ==='undefined') return'#000000';
 const root = document.documentElement;
 const vars: Record<string, string> = {
 primary:'--color-primary',
 primaryLight:'--color-primary-300',
 primaryDark:'--color-primary-700',
 primaryContainer:'--color-primary-container',
 primary50:'--color-primary-50',
 primary400:'--color-primary-400',
 primary600:'--color-primary-600',
 primary700:'--color-primary-700',
 primary900:'--color-primary-900',
 secondary:'--color-secondary',
 secondaryLight:'--color-secondary-300',
 secondaryContainer:'--color-secondary-container',
 secondary400:'--color-secondary-400',
 secondary600:'--color-secondary-600',
 tertiary:'--color-tertiary',
 success:'--color-success',
 successLight:'--color-success-400',
 success50:'--color-success-50',
 success400:'--color-success-400',
 success600:'--color-success-600',
 warning:'--color-warning',
 warningLight:'--color-warning-400',
 warning50:'--color-warning-50',
 warning400:'--color-warning-400',
 warning600:'--color-warning-600',
 error:'--color-error',
 errorLight:'--color-error-400',
 error50:'--color-error-50',
 error400:'--color-error-400',
 error600:'--color-error-600',
 info:'--color-info',
 infoLight:'--color-info-400',
 info50:'--color-info-50',
 info400:'--color-info-400',
 info600:'--color-info-600',
 textPrimary:'--text-primary',
 textSecondary:'--text-secondary',
 textMuted:'--text-muted',
 textDisabled:'--text-disabled',
 bgPrimary:'--bg-primary',
 bgSecondary:'--bg-secondary',
 bgSurface:'--bg-surface',
 bgElevated:'--bg-surface-elevated',
 borderDefault:'--border-default',
 borderSubtle:'--border-subtle',
 shadowMd:'--shadow-md',
 shadowLg:'--shadow-lg',
 };

 const cssVarName = vars[name];
 if (!cssVarName) return'#000000';
 return getComputedStyle(root).getPropertyValue(cssVarName).trim() ||'#000000';
}

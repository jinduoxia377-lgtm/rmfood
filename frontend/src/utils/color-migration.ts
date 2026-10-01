/**
 * 颜色变量迁移工具
 * 提供标准化的颜色映射和主题适配功能
 * 确保所有组件使用主题变量而非硬编码值
 */

/**
 * 旧版 CSS 变量名 → 新版变量名的兼容映射
 * 注：当前 base.css 已统一使用 --text-primary 等命名，此映射表仅保留必要的跨版本兼容项
 */
export const CSS_VARIABLE_MIGRATION: Readonly<Record<string, string>> = {
  // 无迁移项 — base.css 变量名已与语义化命名一致
} as const;

/**
 * 获取迁移后的CSS变量值
 * @param oldVarName 旧版变量名
 * @param fallbackValue 回退值（可选）
 * @returns 新版CSS变量字符串
 */
export function getMigratedVariable(oldVarName: string, fallbackValue?: string): string {
  const newVar = CSS_VARIABLE_MIGRATION[oldVarName as keyof typeof CSS_VARIABLE_MIGRATION];
  if (newVar) {
    return fallbackValue ? `${newVar}, ${fallbackValue}` : newVar;
  }
  return fallbackValue || oldVarName;
}

/**
 * 图表主题颜色配置
 * 基于CSS变量，自动适配亮色/暗色模式
 */
export const CHART_THEME_COLORS = {
  grid: 'var(--color-border-divider)',
  axis: 'var(--color-text-secondary)',

  tooltip: {
    background: 'var(--color-surface-default)',
    border: 'var(--color-border-default)',
    text: 'var(--color-text-primary)',
  },

  line: {
    // T-B2a：--color-primary-main → L0 名 --color-primary（生成器已改名）
    primary: 'var(--color-primary)',
    success: 'var(--color-success-main)',
    warning: 'var(--color-warning-main)',
    danger: 'var(--color-error-main)',
    info: 'var(--color-info-main)',
  },

  bar: {
    primary: 'var(--color-primary)',
    secondary: 'var(--color-secondary)',
  },
} as const;

/**
 * 配方角色颜色映射（君臣佐使）
 * 使用语义化颜色，确保在两种模式下都有良好对比度
 */
export const FORMULA_ROLE_COLORS = {
  light: {
    君: 'var(--color-success-main)',
    臣: 'var(--color-info-main)',
    佐: 'var(--color-purple-500)',
    使: 'var(--color-warning-main)',
    辅料: 'var(--color-neutral-500)',
  },
  dark: {
    君: 'var(--color-success-light)',
    臣: 'var(--color-info-light)',
    佐: 'var(--color-purple-400)',
    使: 'var(--color-warning-light)',
    辅料: 'var(--color-neutral-400)',
  },
} as const;

/**
 * 配方分类调色板
 * 用于饼图/柱状图的多色显示
 */
export const FORMULA_CATEGORY_PALETTE = {
  light: [
    'var(--color-success-main)',
    'var(--color-info-main)',
    'var(--color-purple-500)',
    'var(--color-warning-main)',
    'var(--color-error-main)',
    'var(--color-pink-500)',
    'var(--color-cyan-500)',
    'var(--color-purple-600)',
    'var(--color-orange-500)',
    'var(--color-sky-500)',
  ],
  dark: [
    'var(--color-success-light)',
    'var(--color-info-light)',
    'var(--color-purple-400)',
    'var(--color-warning-light)',
    'var(--color-error-light)',
    'var(--color-pink-400)',
    'var(--color-cyan-400)',
    'var(--color-purple-500)',
    'var(--color-orange-400)',
    'var(--color-sky-400)',
  ],
} as const;

/**
 * 获取当前模式的图表颜色配置
 * @returns 图表颜色配置对象
 */
export function getChartThemeColors() {
  const isDark =
    document.documentElement.classList.contains('dark') ||
    document.documentElement.getAttribute('data-mode') === 'dark';

  return {
    grid: 'var(--color-border-divider)',
    axis: 'var(--color-text-secondary)',
    tooltipBg: 'var(--color-surface-default)',
    tooltipBorder: 'var(--color-border-default)',
    tooltipText: 'var(--color-text-primary)',
    line: isDark ? '#6ECAFF' : 'var(--color-success-main)',
    bar: isDark ? '#007AFF' : 'var(--color-success-main)',
    pie: isDark ? FORMULA_CATEGORY_PALETTE.dark : FORMULA_CATEGORY_PALETTE.light,
    axisColor: 'var(--color-text-secondary)',
    barFill: 'var(--color-primary)',   // T-B2a：原 --color-primary-main（生成器已改名）
  };
}

/**
 * 获取配方角色颜色
 * @param role 角色名称
 * @returns 对应的CSS变量颜色值
 */
export function getRoleColor(role: string): string {
  const isDark =
    document.documentElement.classList.contains('dark') ||
    document.documentElement.getAttribute('data-mode') === 'dark';

  const colors = isDark ? FORMULA_ROLE_COLORS.dark : FORMULA_ROLE_COLORS.light;
  return colors[role as keyof typeof colors] || colors['辅料'];
}

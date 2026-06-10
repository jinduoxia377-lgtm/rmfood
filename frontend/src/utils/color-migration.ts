/**
 * 颜色变量迁移工具
 * 提供标准化的颜色映射和主题适配功能
 * 确保所有组件使用主题变量而非硬编码值
 */

/**
 * 旧版CSS变量名 → 新版CSS变量名 映射表
 * 用于统一变量命名规范
 */
export const CSS_VARIABLE_MIGRATION = {
  // 文本色
  '--text-primary': 'var(--color-text-primary)',
  '--text-secondary': 'var(--color-text-secondary)',
  '--text-muted': 'var(--color-text-disabled)',
  '--text-disabled': 'var(--color-text-disabled)',

  // 背景色
  '--bg-primary': 'var(--color-background-default)',
  '--bg-secondary': 'var(--color-background-elevated)',
  '--bg-card': 'var(--color-surface-default)',

  // 边框色
  '--border-color': 'var(--color-border-default)',
  '--border-light': 'var(--color-border-divider)',

  // 主题色
  '--color-primary': 'var(--color-primary-main)',
  '--color-success': 'var(--color-success-main)',
  '--color-warning': 'var(--color-warning-main)',
  '--color-danger': 'var(--color-error-main)',
  '--color-info': 'var(--color-info-main)',
} as const;

/**
 * 获取迁移后的CSS变量值
 * @param oldVarName 旧版变量名
 * @param fallbackValue 回退值（可选）
 * @returns 新版CSS变量字符串
 */
export function getMigratedVariable(
  oldVarName: string,
  fallbackValue?: string,
): string {
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
    primary: 'var(--color-primary-main)',
    success: 'var(--color-success-main)',
    warning: 'var(--color-warning-main)',
    danger: 'var(--color-error-main)',
    info: 'var(--color-info-main)',
  },

  bar: {
    primary: 'var(--color-primary-main)',
    secondary: 'var(--color-secondary-main)',
  },
} as const;

/**
 * 配方角色颜色映射（君臣佐使）
 * 使用语义化颜色，确保在两种模式下都有良好对比度
 */
export const FORMULA_ROLE_COLORS = {
  light: {
    '君': 'var(--color-success-main)',
    '臣': 'var(--color-info-main)',
    '佐': 'var(--color-purple-500)',
    '使': 'var(--color-warning-main)',
    '辅料': 'var(--color-neutral-500)',
  },
  dark: {
    '君': 'var(--color-success-light)',
    '臣': 'var(--color-info-light)',
    '佐': 'var(--color-purple-400)',
    '使': 'var(--color-warning-light)',
    '辅料': 'var(--color-neutral-400)',
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
  const isDark = document.documentElement.classList.contains('dark') ||
                 document.documentElement.getAttribute('data-mode') === 'dark';

  return {
    grid: 'var(--color-border-divider)',
    axis: 'var(--color-text-secondary)',
    tooltipBg: 'var(--color-surface-default)',
    tooltipBorder: 'var(--color-border-default)',
    tooltipText: 'var(--color-text-primary)',
    line: isDark ? '#60A5FA' : 'var(--color-success-main)',
    bar: isDark ? '#3B82F6' : 'var(--color-success-main)',
    pie: isDark
      ? FORMULA_CATEGORY_PALETTE.dark
      : FORMULA_CATEGORY_PALETTE.light,
  };
}

/**
 * 获取配方角色颜色
 * @param role 角色名称
 * @returns 对应的CSS变量颜色值
 */
export function getRoleColor(role: string): string {
  const isDark = document.documentElement.classList.contains('dark') ||
                 document.documentElement.getAttribute('data-mode') === 'dark';

  const colors = isDark ? FORMULA_ROLE_COLORS.dark : FORMULA_ROLE_COLORS.light;
  return colors[role as keyof typeof colors] || colors['辅料'];
}

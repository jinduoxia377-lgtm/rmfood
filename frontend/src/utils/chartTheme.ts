/**
 * 全局图表主题配置 — 基于 CSS 变量，自动适配明暗模式
 * 统一来源：替代 DarkModeChartTheme.tsx 中的重复实现
 * 所有颜色引用 CSS 变量，主题切换时自动响应
 */

import { useIsDarkMode } from '@/theme'

/** 图表颜色方案 */
const LIGHT_COLORS = {
  primary: 'var(--color-primary, var(--color-primary-400))',
  secondary: 'var(--color-secondary, #0A84FF)',
  accent: 'var(--color-tertiary, var(--color-accent-500))',
  success: 'var(--color-success, var(--color-primary-400))',
  warning: 'var(--color-warning, #FF9F0A)',
  danger: 'var(--color-error, #FF3B30)',
  info: 'var(--color-info, var(--color-secondary-500))',
  text: 'var(--text-primary, #1D1D1F)',
  textSecondary: 'var(--text-secondary, #6E6E73)',
  grid: 'var(--border-subtle, rgba(0, 0, 0, 0.06))',
  background: 'transparent',
  tooltipBg: 'var(--card-bg-solid, #FFFFFF)',
  tooltipBorder: 'var(--border-subtle, rgba(0, 0, 0, 0.06))',
  axisLine: 'var(--border-color, rgba(0, 0, 0, 0.08))',
  tickLine: 'var(--border-color, rgba(0, 0, 0, 0.08))',
}

const DARK_COLORS = {
  primary: 'var(--color-primary, #30D158)',
  secondary: 'var(--color-secondary, #0A84FF)',
  accent: 'var(--color-tertiary, #BF5AF2)',
  success: 'var(--color-success, #30D158)',
  warning: 'var(--color-warning, #FF9F0A)',
  danger: 'var(--color-error, #FF453A)',
  info: 'var(--color-info, #0A84FF)',
  text: 'var(--text-primary, var(--bg-canvas))',
  textSecondary: 'var(--text-secondary, #A1A1A6)',
  grid: 'var(--border-subtle, rgba(255, 255, 255, 0.06))',
  background: 'transparent',
  tooltipBg: 'var(--bg-surface, var(--bg-surface-container))',
  tooltipBorder: 'var(--border-subtle, rgba(255, 255, 255, 0.06))',
  axisLine: 'var(--border-color, rgba(255, 255, 255, 0.08))',
  tickLine: 'var(--border-color, rgba(255, 255, 255, 0.08))',
}

/** 多系列配色 */
const SERIES_COLORS_LIGHT = [
  'var(--color-primary, var(--color-primary-400))',
  'var(--color-secondary, #0A84FF)',
  'var(--color-tertiary, var(--color-accent-500))',
  'var(--color-warning, #FF9F0A)',
  'var(--color-error, #FF3B30)',
  'var(--color-info, var(--color-secondary-500))',
  'var(--color-pink-500, #D946EF)',
  'var(--color-orange-500, #EA580C)',
]

const SERIES_COLORS_DARK = [
  'var(--color-primary, #30D158)',
  'var(--color-secondary, #0A84FF)',
  'var(--color-tertiary, #BF5AF2)',
  'var(--color-warning, #FF9F0A)',
  'var(--color-error, #FF453A)',
  'var(--color-info, #0A84FF)',
  'var(--color-pink-400, #EC4899)',
  'var(--color-orange-400, #FB923C)',
]

export interface ChartThemeConfig {
  colors: typeof LIGHT_COLORS
  seriesColors: string[]
  fontSize: {
    label: number
    tick: number
    tooltip: number
    legend: number
  }
  tooltip: {
    contentStyle: React.CSSProperties
    itemStyle: React.CSSProperties
    labelStyle: React.CSSProperties
  }
  cartesianGrid: {
    strokeDasharray: string
    stroke: string
  }
  axis: {
    tick: { fill: string; fontSize: number }
    axisLine: { stroke: string }
    tickLine: { stroke: string }
  }
}

/**
 * 获取图表主题配置
 */
export function getChartTheme(isDark: boolean): ChartThemeConfig {
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS
  const seriesColors = isDark ? SERIES_COLORS_DARK : SERIES_COLORS_LIGHT

  return {
    colors,
    seriesColors,
    fontSize: {
      label: 12,
      tick: 11,
      tooltip: 12,
      legend: 12,
    },
    tooltip: {
      contentStyle: {
        backgroundColor: colors.tooltipBg,
        backdropFilter: 'blur(16px)',
        borderRadius: '14px',
        border: `1px solid ${colors.tooltipBorder}`,
        boxShadow: isDark
          ? 'var(--shadow-modal, 0 24px 64px rgba(0,0,0,0.16))'
          : 'var(--shadow-modal, 0 8px 32px rgba(0,0,0,0.08))',
        padding: '14px 18px',
        fontSize: '12px',
        color: colors.text,
      },
      itemStyle: {
        padding: '4px 0',
        color: colors.text,
      },
      labelStyle: {
        fontWeight: 600,
        marginBottom: 6,
        color: colors.text,
      },
    },
    cartesianGrid: {
      strokeDasharray: '3 3',
      stroke: colors.grid,
    },
    axis: {
      tick: {
        fill: colors.textSecondary,
        fontSize: 11,
      },
      axisLine: {
        stroke: colors.axisLine,
      },
      tickLine: {
        stroke: colors.tickLine,
      },
    },
  }
}

/**
 * React Hook: 获取当前主题的图表配置
 */
export function useChartTheme(): ChartThemeConfig {
  const isDark = useIsDarkMode()
  return getChartTheme(isDark)
}

/**
 * 获取系列颜色
 */
export function getSeriesColor(index: number, isDark: boolean): string {
  const colors = isDark ? SERIES_COLORS_DARK : SERIES_COLORS_LIGHT
  return colors[index % colors.length]
}

// ============================================================================
// T-E1：配方图表配色（自 utils/color-migration.ts 迁入，统一到本文件唯一通道）
// ----------------------------------------------------------------------------
// 迁移时**为每个 var() 补上 fallback**。原实现引用了一批**并不存在**的令牌且无回退：
//   · --color-success-light / -info-light / -warning-light / -error-light 四族缺失（D-4）
//   · --color-chart-1..5 全缺（D-45）
//   · --color-pink-500 / --color-cyan-500 / --color-sky-500 未定义
// 导致 GATE-08 报「无回退 var() 解析为空」——图表取色实际落到继承值。
// 现改为：优先复用**确实存在**的语义令牌（暗色已由令牌自身承载亮色变体），
// 并保留同色系 fallback 兜底。
// ============================================================================

/** 配方角色配色（君臣佐使）。暗色侧不再另找 `-light` 令牌 —— 语义令牌本身已随模式切换。 */
export const FORMULA_ROLE_COLORS = {
  light: {
    君: 'var(--color-success, #10b981)',
    臣: 'var(--color-info, #3b82f6)',
    佐: 'var(--color-purple-500, #a855f7)',
    使: 'var(--color-warning, #f59e0b)',
    辅料: 'var(--color-neutral-500, #64748b)',
  },
  dark: {
    君: 'var(--color-success, #34d399)',
    臣: 'var(--color-info, #60a5fa)',
    佐: 'var(--color-purple-400, #c084fc)',
    使: 'var(--color-warning, #fcd34d)',
    辅料: 'var(--color-neutral-400, #94a3b8)',
  },
} as const

/** 配方分类调色板（10 色，用于饼图/柱状图）。复用系列色板并补足到 10 色。 */
export const FORMULA_CATEGORY_PALETTE = {
  light: [...SERIES_COLORS_LIGHT, 'var(--color-cyan-600, var(--color-info-600))', 'var(--color-purple-600, #9333ea)'],
  dark: [...SERIES_COLORS_DARK, 'var(--color-cyan-700, #0e7490)', 'var(--color-purple-500, #a855f7)'],
} as const

function detectDark(): boolean {
  if (typeof document === 'undefined') return false
  const root = document.documentElement
  return root.classList.contains('dark') || root.getAttribute('data-mode') === 'dark'
}

/**
 * 获取图表通用配色。
 * 注意：**依赖 DOM 上的当前模式**，调用方必须把模式纳入 React 依赖，
 * 否则切主题后颜色不会更新（D-43：原消费方写 `useMemo(..., [])`）。
 */
export function getChartThemeColors() {
  const isDark = detectDark()

  return {
    grid: 'var(--color-border-divider, rgba(0,0,0,0.06))',
    axis: 'var(--text-secondary, #6E6E73)',
    tooltipBg: 'var(--color-surface-default, #ffffff)',
    tooltipBorder: 'var(--color-border-default, #E5E7EB)',
    tooltipText: 'var(--color-text-primary, #111827)',
    line: isDark ? 'var(--color-primary, #34d399)' : 'var(--color-success, #10b981)',
    bar: isDark ? 'var(--color-secondary, #60a5fa)' : 'var(--color-success, #10b981)',
    pie: isDark ? FORMULA_CATEGORY_PALETTE.dark : FORMULA_CATEGORY_PALETTE.light,
    axisColor: 'var(--text-secondary, #6E6E73)',
    barFill: 'var(--color-primary, #10b981)',
  }
}

/**
 * 获取配方角色颜色（君臣佐使）。
 * 同样依赖 DOM 模式 —— 调用方需把模式纳入依赖。
 */
export function getRoleColor(role: string): string {
  const colors = detectDark() ? FORMULA_ROLE_COLORS.dark : FORMULA_ROLE_COLORS.light
  return colors[role as keyof typeof colors] || colors['辅料']
}

/**
 * 全局图表主题配置 — 基于 CSS 变量，自动适配明暗模式
 * 统一来源：替代 DarkModeChartTheme.tsx 中的重复实现
 * 所有颜色引用 CSS 变量，主题切换时自动响应
 */

import { useIsDarkMode } from '@/theme'

/** 图表颜色方案 */
const LIGHT_COLORS = {
  primary: 'var(--color-primary, #34C759)',
  secondary: 'var(--color-secondary, #0A84FF)',
  accent: 'var(--color-tertiary, #AF52DE)',
  success: 'var(--color-success, #34C759)',
  warning: 'var(--color-warning, #FF9F0A)',
  danger: 'var(--color-error, #FF3B30)',
  info: 'var(--color-info, #007AFF)',
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
  text: 'var(--text-primary, #F5F5F7)',
  textSecondary: 'var(--text-secondary, #A1A1A6)',
  grid: 'var(--border-subtle, rgba(255, 255, 255, 0.06))',
  background: 'transparent',
  tooltipBg: 'var(--bg-surface, #1C1C1E)',
  tooltipBorder: 'var(--border-subtle, rgba(255, 255, 255, 0.06))',
  axisLine: 'var(--border-color, rgba(255, 255, 255, 0.08))',
  tickLine: 'var(--border-color, rgba(255, 255, 255, 0.08))',
}

/** 多系列配色 */
const SERIES_COLORS_LIGHT = [
  'var(--color-primary, #34C759)',
  'var(--color-secondary, #0A84FF)',
  'var(--color-tertiary, #AF52DE)',
  'var(--color-warning, #FF9F0A)',
  'var(--color-error, #FF3B30)',
  'var(--color-info, #007AFF)',
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

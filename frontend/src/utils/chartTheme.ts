/**
 * 全局图表主题配置
 * 统一 Recharts 图表的颜色、字体、网格线等配置
 * 支持亮色/暗色模式自动切换
 */

import { useIsDarkMode } from '@/theme'

/** 图表颜色方案 */
const LIGHT_COLORS = {
  primary: '#059669',
  secondary: '#2563eb',
  accent: '#7c3aed',
  success: '#16a34a',
  warning: '#ca8a04',
  danger: '#dc2626',
  info: '#0891b2',
  text: '#334155',
  textSecondary: '#64748b',
  grid: '#e2e8f0',
  background: '#ffffff',
  tooltipBg: 'rgba(255,255,255,0.98)',
  tooltipBorder: 'rgba(226,232,240,0.9)',
  axisLine: '#cbd5e1',
  tickLine: '#cbd5e1',
}

const DARK_COLORS = {
  primary: '#34d399',
  secondary: '#60a5fa',
  accent: '#a78bfa',
  success: '#4ade80',
  warning: '#facc15',
  danger: '#f87171',
  info: '#22d3ee',
  text: '#e2e8f0',
  textSecondary: '#94a3b8',
  grid: '#334155',
  background: '#0f172a',
  tooltipBg: 'rgba(15,23,42,0.98)',
  tooltipBorder: 'rgba(51,65,85,0.9)',
  axisLine: '#475569',
  tickLine: '#475569',
}

/** 多系列配色（最多 8 个系列） */
const SERIES_COLORS_LIGHT = [
  '#059669', '#2563eb', '#7c3aed', '#ca8a04',
  '#dc2626', '#0891b2', '#d946ef', '#f97316',
]

const SERIES_COLORS_DARK = [
  '#34d399', '#60a5fa', '#a78bfa', '#facc15',
  '#f87171', '#22d3ee', '#e879f9', '#fb923c',
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
 * @param isDark 是否为暗色模式
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
        borderRadius: '12px',
        border: `1px solid ${colors.tooltipBorder}`,
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.4)'
          : '0 8px 32px rgba(0,0,0,0.08)',
        padding: '12px 16px',
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
 * 用法:
 *   const chartTheme = useChartTheme()
 *   <Tooltip {...chartTheme.tooltip} />
 */
export function useChartTheme(): ChartThemeConfig {
  const isDark = useIsDarkMode()
  return getChartTheme(isDark)
}

/**
 * 获取系列颜色
 * @param index 系列索引
 * @param isDark 是否为暗色模式
 */
export function getSeriesColor(index: number, isDark: boolean): string {
  const colors = isDark ? SERIES_COLORS_DARK : SERIES_COLORS_LIGHT
  return colors[index % colors.length]
}

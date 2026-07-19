/**
 * DarkModeChartTheme — 向后兼容层
 * 所有图表主题数据已统一到 utils/chartTheme.ts
 * 此文件保留以兼容旧的 import 路径
 */
export { useChartTheme, getChartTheme, getSeriesColor, type ChartThemeConfig } from '@/utils/chartTheme'

/**
 * 注意：darkModeChartTheme / lightModeChartTheme 常量已废弃。
 * 请使用 useChartTheme() hook 获取动态主题配置。
 * 以下为旧版常量（仅用于向后兼容），不再推荐使用。
 */
export const darkModeChartTheme: any = {}
export const lightModeChartTheme: any = {}
export const chartColors: any = {}

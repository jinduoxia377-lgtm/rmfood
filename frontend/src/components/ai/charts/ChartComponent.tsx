import { useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { CHART_TYPOGRAPHY } from '../../../utils/typography'
import { getChartThemeColors } from '../../../utils/chartTheme'
import { useIsDarkMode } from '@/theme'

export interface ChartComponentProps {
  type: 'line' | 'bar' | 'pie'
  data: any[]
  options: {
    title?: string
    xAxisKey?: string
    yAxisKey?: string
    valueKey?: string
    source?: string
  }
  theme?: 'light' | 'dark'
}

export function ChartComponent({ type, data, options }: ChartComponentProps) {
  // D-43 修复：原为 useMemo(..., []) 空依赖 —— getChartThemeColors() 读取 DOM 上的
  // 当前模式（.dark / data-mode），空依赖会使**切主题后图表颜色永不更新**。
  const isDark = useIsDarkMode()
  const colors = useMemo(() => getChartThemeColors(), [isDark])

  const tooltipStyle = {
    backgroundColor: colors.tooltipBg,
    border: `1px solid ${colors.tooltipBorder}`,
    borderRadius: '8px',
    color: colors.tooltipText,
    fontSize: CHART_TYPOGRAPHY.tooltipContent.fontSize + 'px',
  }

  const axisTickStyle = {
    fontSize: CHART_TYPOGRAPHY.axisLabel.fontSize,
    fill: colors.axis,
  }

  switch (type) {
    case 'line':
      return (
        <div className="my-4 p-4 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <h4 className="text-sm font-medium mb-3">{options.title || '折线图'}</h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis dataKey={options.xAxisKey || 'name'} tick={axisTickStyle} />
              <YAxis tick={axisTickStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey={options.yAxisKey || 'value'} stroke={colors.line} strokeWidth={2} dot={{ r: 3, fill: colors.line }} />
            </LineChart>
          </ResponsiveContainer>
          {options.source && (
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-2 text-right">数据来源: {options.source}</p>
          )}
        </div>
      )
    case 'bar':
      return (
        <div className="my-4 p-4 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <h4 className="text-sm font-medium mb-3">{options.title || '柱状图'}</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis dataKey={options.xAxisKey || 'name'} tick={axisTickStyle} />
              <YAxis tick={axisTickStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey={options.yAxisKey || 'value'} fill={colors.bar} />
            </BarChart>
          </ResponsiveContainer>
          {options.source && (
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-2 text-right">数据来源: {options.source}</p>
          )}
        </div>
      )
    case 'pie':
      return (
        <div className="my-4 p-4 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <h4 className="text-sm font-medium mb-3">{options.title || '饼图'}</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie rootTabIndex={-1}
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey={options.valueKey || 'value'}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((_entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={colors.pie[index % colors.pie.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          {options.source && (
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-2 text-right">数据来源: {options.source}</p>
          )}
        </div>
      )
    default:
      return null
  }
}

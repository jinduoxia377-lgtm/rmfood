/**
 * Enhanced Bar Chart Component
 *
 * Features:
 * - Grouped/stacked bar support
 * - Animated bars with entrance effects
 * - Theme-aware colors
 * - Interactive hover states
 * - Gradient fills option
 */
import React, { useMemo } from 'react'
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'

interface ChartData {
  chart_type: string
  title: string
  labels: string[]
  datasets: {
    data: number[]
    label?: string
    backgroundColor?: string | string[]
    borderRadius?: number
  }[]
}

interface ThemeColors {
  primary: string
  secondary: string
  tertiary: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  surfaceVariant: string
  outline: string
  background: string
  success: string
  warning: string
  surface: string
  outlineVariant: string
}

interface EnhancedBarChartProps {
  data: ChartData
  themeColors: ThemeColors
  height?: number
  horizontal?: boolean
  stacked?: boolean
  showGrid?: boolean
}

export function EnhancedBarChart({
  data,
  themeColors,
  height = 320,
  horizontal = false,
  stacked = false,
  showGrid = true,
}: EnhancedBarChartProps) {

  const chartData = useMemo(() => {
    const labels = data.labels || []

    return labels.map((label, index) => {
      const point: Record<string, any> = { name: label }

      ;(data.datasets || []).forEach((dataset: { data: number[]; label?: string }, datasetIndex: number) => {
        point[dataset.label || `series_${datasetIndex}`] = dataset.data[index] ?? 0
      })

      return point
    })
  }, [data])

  const defaultColors = [
    themeColors.primary,
    themeColors.secondary,
    themeColors.success,
    themeColors.warning,
    'var(--color-tertiary, var(--color-accent-500))',
  ]

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div
          className="rounded-lg p-4 shadow-xl border min-w-[160px]"
          style={{
            backgroundColor: `${themeColors.surface}F5`,
            borderColor: themeColors.outline,
          }}
        >
          <p className="font-semibold mb-2 text-sm" style={{ color: themeColors.textPrimary }}>
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1.5 last:mb-0">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs font-medium" style={{ color: themeColors.textSecondary }}>
                  {entry.name}
                </span>
              </div>
              <span className="text-sm font-bold tabular-nums" style={{ color: themeColors.textPrimary }}>
                {entry.value?.toLocaleString('zh-CN')}
              </span>
            </div>
          ))}

          {/* Total for stacked */}
          {stacked && (
            <div
              className="mt-3 pt-3 border-t flex justify-between items-center"
              style={{ borderColor: themeColors.outlineVariant }}
            >
              <span className="text-xs font-bold" style={{ color: themeColors.textSecondary }}>总计</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: themeColors.primary }}>
                {payload.reduce((sum: number, item: any) => sum + (item.value || 0), 0).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )
    }
    return null
  }

  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 80, bottom: 0 }}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={themeColors.surfaceVariant} opacity={0.3} horizontal={false} />}

          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: themeColors.textMuted, fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: themeColors.textSecondary, fontSize: 12 }}
            width={75}
          />

          <Tooltip content={<CustomTooltip />} animationDuration={200} cursor={{ fill: `${themeColors.primary}08` }} />

          {(data.datasets || []).map((dataset, index) => (
            <Bar
              key={index}
              dataKey={dataset.label || `series_${index}`}
              fill={defaultColors[index % defaultColors.length]}
              radius={[0, 4, 4, 0]}
              stackId={stacked ? "stack" : undefined}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
              maxBarSize={24}
            >
              {chartData.map((_, cellIndex) => (
                <Cell
                  key={`cell-${cellIndex}`}
                  fill={Array.isArray(dataset.backgroundColor)
                    ? (dataset.backgroundColor[cellIndex % dataset.backgroundColor.length] || defaultColors[index])
                    : (dataset.backgroundColor || defaultColors[index % defaultColors.length])
                  }
                />
              ))}
            </Bar>
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={chartData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={themeColors.surfaceVariant} opacity={0.3} vertical={false} />}

        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: themeColors.textMuted, fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: themeColors.textMuted, fontSize: 11 }} width={55} />

        <Tooltip content={<CustomTooltip />} animationDuration={200} cursor={{ fill: `${themeColors.primary}08` }} />

        {(data.datasets || []).map((dataset, index) => (
          <Bar
            key={index}
            dataKey={dataset.label || `series_${index}`}
            fill={defaultColors[index % defaultColors.length]}
            radius={[4, 4, 0, 0]}
            stackId={stacked ? "stack" : undefined}
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
            maxBarSize={40}
          >
            {chartData.map((_, cellIndex) => (
              <Cell
                key={`cell-${cellIndex}`}
                fill={Array.isArray(dataset.backgroundColor)
                  ? (dataset.backgroundColor[cellIndex % dataset.backgroundColor.length] || defaultColors[index])
                  : (dataset.backgroundColor || defaultColors[index % defaultColors.length])
                }
              />
            ))}
          </Bar>
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}

export default EnhancedBarChart

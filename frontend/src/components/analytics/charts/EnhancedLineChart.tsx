/**
 * Enhanced Line Chart Component
 *
 * Features:
 * - Multi-line support with smooth curves
 * - Interactive data points
 * - Zoom and pan capabilities
 * - Theme-aware styling
 * - Responsive tooltips
 */
import React, { useMemo } from 'react'
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Brush,
} from 'recharts'

interface ChartData {
  chart_type: string
  title: string
  labels: string[]
  datasets: {
    data: number[]
    label?: string
    borderColor?: string
    backgroundColor?: string | string[]
    tension?: number
    pointRadius?: number
    pointHoverRadius?: number
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
}

interface EnhancedLineChartProps {
  data: ChartData
  themeColors: ThemeColors
  height?: number
  showBrush?: boolean
  showGrid?: boolean
}

export function EnhancedLineChart({
  data,
  themeColors,
  height = 320,
  showBrush = false,
  showGrid = true,
}: EnhancedLineChartProps) {

  const chartData = useMemo(() => {
    const labels = data.labels || []

    return labels.map((label, index) => {
      const point: Record<string, any> = { name: label }

      (data.datasets || []).forEach((dataset, datasetIndex) => {
        point[dataset.label || `series_${datasetIndex}`] = dataset.data[index] ?? 0
      })

      return point
    })
  }, [data])

  const defaultColors = [
    themeColors.primary,
    themeColors.secondary,
    themeColors.tertiary,
    '#4CAF50',
    '#FF9800',
  ]

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div
          className="rounded-lg p-4 shadow-xl border"
          style={{
            backgroundColor: `${themeColors.surface}F5`,
            borderColor: themeColors.outline,
          }}
        >
          <p className="font-semibold mb-2 text-sm" style={{ color: themeColors.textPrimary }}>
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-3 mb-1 last:mb-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-xs" style={{ color: themeColors.textSecondary }}>{entry.name}</span>
              </div>
              <span className="text-sm font-bold tabular-nums" style={{ color: themeColors.textPrimary }}>
                {entry.value?.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart
        data={chartData}
        margin={{ top: 10, right: 30, left: 0, bottom: showBrush ? 50 : 0 }}
      >
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={themeColors.surfaceVariant} opacity={0.4} />}

        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: themeColors.textMuted, fontSize: 11 }}
        />

        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: themeColors.textMuted, fontSize: 11 }}
          width={55}
        />

        <Tooltip content={<CustomTooltip />} animationDuration={200} />

        {(data.datasets || []).map((dataset, index) => (
          <Line
            key={index}
            type="monotone"
            dataKey={dataset.label || `series_${index}`}
            stroke={defaultColors[index % defaultColors.length]}
            strokeWidth={2.5}
            dot={{
              r: dataset.pointRadius || 3,
              fill: themeColors.background,
              stroke: defaultColors[index % defaultColors.length],
              strokeWidth: 2,
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
            }}
            activeDot={{
              r: 6,
              fill: defaultColors[index % defaultColors.length],
              stroke: themeColors.background,
              strokeWidth: 2,
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.25))',
            }}
            isAnimationActive={true}
            animationDuration={1000}
            animationEasing="ease-in-out"
            tension={dataset.tension || 0.4}
          />
        ))}

        {showBrush && (
          <Brush
            dataKey="name"
            height={30}
            stroke={themeColors.primary}
            fill={`${themeColors.primary}10`}
            travellerWidth={6}
          />
        )}
      </RechartsLineChart>
    </ResponsiveContainer>
  )
}

export default EnhancedLineChart

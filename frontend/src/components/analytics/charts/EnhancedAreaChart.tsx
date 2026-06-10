/**
 * Enhanced Area Chart Component
 *
 * Features:
 * - Full Material Design 3 theme support (light/dark)
 * - Smooth animations with easing
 * - Interactive tooltips
 * - Responsive design
 * - Gradient fill effects
 * - Grid lines with subtle styling
 * - Legend support
 * - Accessibility compliant
 */
import React, { useMemo } from 'react'
import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface ChartData {
  chart_type: string
  title: string
  subtitle?: string
  labels: string[]
  datasets: {
    data: number[]
    label?: string
    borderColor?: string
    backgroundColor?: string | string[]
    fill?: boolean
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
  surface: string
  success: string
  warning: string
  error: string
  info: string
}

interface EnhancedAreaChartProps {
  data: ChartData
  themeColors: ThemeColors
  height?: number
  showLegend?: boolean
  showGrid?: boolean
  animate?: boolean
}

export function EnhancedAreaChart({
  data,
  themeColors,
  height = 320,
  showLegend = true,
  showGrid = true,
  animate = true,
}: EnhancedAreaChartProps) {

  const chartData = useMemo(() => {
    const labels = data.labels || []
    const datasets = data.datasets || []

    return labels.map((label, index) => {
      const point: Record<string, any> = { name: label }

      datasets.forEach((dataset, datasetIndex) => {
        point[dataset.label || `series_${datasetIndex}`] = dataset.data[index] ?? 0
      })

      return point
    })
  }, [data])

  const defaultColors = [
    themeColors.primary,
    themeColors.secondary,
    themeColors.tertiary,
    themeColors.success,
    themeColors.warning,
    themeColors.info,
  ]

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div
          className="rounded-lg p-4 shadow-xl border backdrop-blur-sm"
          style={{
            backgroundColor: `${themeColors.surface}F2`,
            borderColor: themeColors.outline,
          }}
        >
          <p className="font-semibold mb-3 text-sm" style={{ color: themeColors.textPrimary }}>
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1.5 last:mb-0">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs font-medium" style={{ color: themeColors.textSecondary }}>
                  {entry.name}
                </span>
              </div>
              <span className="text-sm font-bold tabular-nums" style={{ color: themeColors.textPrimary }}>
                {typeof entry.value === 'number' ? entry.value.toLocaleString('zh-CN') : entry.value}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  const CustomLegend = ({ payload }: any) => {
    if (!showLegend || !payload) return null

    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4" style={{ borderTop: `1px solid ${themeColors.outlineVariant}20` }}>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 cursor-pointer group">
            <div
              className="w-3 h-3 rounded-full transition-transform group-hover:scale-125"
              style={{ backgroundColor: entry.color }}
            />
            <span
              className="text-xs font-medium transition-colors group-hover:text-primary"
              style={{ color: themeColors.textSecondary }}
            >
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart
        data={chartData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={themeColors.surfaceVariant}
            vertical={false}
            opacity={0.5}
          />
        )}

        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{
            fill: themeColors.textMuted,
            fontSize: 12,
            fontFamily: 'inherit',
          }}
          tickMargin={10}
        />

        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{
            fill: themeColors.textMuted,
            fontSize: 12,
            fontFamily: 'inherit',
          }}
          tickFormatter={(value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value}
          width={60}
        />

        <Tooltip content={<CustomTooltip />} animationDuration={200} />
        <Legend content={<CustomLegend />} />

        {(data.datasets || []).map((dataset, index) => {
          const color = defaultColors[index % defaultColors.length]

          return (
            <Area
              key={index}
              type="monotone"
              dataKey={dataset.label || `series_${index}`}
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#gradient_${index})`}
              fillOpacity={0.6}
              dot={false}
              activeDot={{
                r: 6,
                fill: color,
                stroke: themeColors.background,
                strokeWidth: 2,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
              }}
              isAnimationActive={animate}
              animationBegin={0}
              animationDuration={1200}
              animationEasing="ease-in-out"
              name={dataset.label}
            />
          )
        })}

        {/* Gradient Definitions */}
        <defs>
          {(data.datasets || []).map((_, index) => {
            const color = defaultColors[index % defaultColors.length]

            return (
              <linearGradient key={index} id={`gradient_${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            )
          })}
        </defs>
      </RechartsAreaChart>
    </ResponsiveContainer>
  )
}

export default EnhancedAreaChart

/**
 * Enhanced Radar Chart Component
 *
 * Features:
 * - Multi-dimensional data visualization
 * - Polygon fill with transparency
 * - Interactive hover states
 * - Theme-aware styling
 * - Smooth animations
 */
import React, { useMemo } from 'react'
import {
  RadarChart as RechartsRadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
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
    fill?: boolean
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
}

interface EnhancedRadarChartProps {
  data: ChartData
  themeColors: ThemeColors
  height?: number
  showLegend?: boolean
}

export function EnhancedRadarChart({
  data,
  themeColors,
  height = 320,
  showLegend = true,
}: EnhancedRadarChartProps) {

  const radarData = useMemo(() => {
    const labels = data.labels || []

    return labels.map((label, index) => {
      const point: Record<string, any> = { subject: label }

      (data.datasets || []).forEach((dataset, datasetIndex) => {
        const value = dataset.data[index]
        point[dataset.label || `series_${datasetIndex}`] = typeof value === 'number' ? Math.max(0, Math.min(100, value)) : 0
      })

      return point
    })
  }, [data])

  const defaultColors = [
    themeColors.primary,
    themeColors.secondary,
    themeColors.tertiary,
  ]

  const CustomTooltip = ({ active, payload }: any) => {
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
            {payload[0]?.payload?.subject}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-xs font-medium" style={{ color: themeColors.textSecondary }}>
                  {entry.name}
                </span>
              </div>
              <span className="text-sm font-bold tabular-nums" style={{ color: themeColors.textPrimary }}>
                {entry.value}
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
      <RechartsRadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
        <PolarGrid stroke={themeColors.surfaceVariant} strokeDasharray="3 3" opacity={0.5} />

        <PolarAngleAxis
          dataKey="subject"
          tick={{
            fill: themeColors.textSecondary,
            fontSize: 11,
            fontFamily: 'inherit',
          }}
        />

        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{
            fill: themeColors.textMuted,
            fontSize: 10,
          }}
          axisLine={false}
          tickCount={5}
        />

        <Tooltip content={<CustomTooltip />} animationDuration={200} />

        {(data.datasets || []).map((dataset, index) => (
          <Radar
            key={index}
            name={dataset.label || `系列 ${index + 1}`}
            dataKey={dataset.label || `series_${index}`}
            stroke={defaultColors[index % defaultColors.length]}
            fill={`${defaultColors[index % defaultColors.length]}25`}
            strokeWidth={2}
            dot={{
              r: 3,
              fill: themeColors.background,
              stroke: defaultColors[index % defaultColors.length],
              strokeWidth: 2,
            }}
            isAnimationActive={true}
            animationDuration={1200}
            animationEasing="ease-in-out"
          />
        ))}
      </RechartsRadarChart>
    </ResponsiveContainer>
  )
}

export default EnhancedRadarChart

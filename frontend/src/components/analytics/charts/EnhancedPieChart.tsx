/**
 * Enhanced Pie/Donut Chart Component
 *
 * Features:
 * - Full Material Design 3 theme support
 * - Donut or pie mode toggle
 * - Interactive hover effects
 * - Animated entrance
 * - Accessible labels
 * - Center statistics display
 * - Legend with percentages
 */
import React, { useState, useMemo } from 'react'
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Sector,
} from 'recharts'

interface ChartData {
  chart_type: string
  title: string
  subtitle?: string
  labels: string[]
  datasets: {
    data: number[]
    label?: string
    backgroundColor?: string | string[]
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

interface EnhancedPieChartProps {
  data: ChartData
  themeColors: ThemeColors
  height?: number
  donutMode?: boolean
  showCenterLabel?: boolean
  innerRadius?: number
  outerRadius?: number
}

const defaultPalette = [
  'var(--color-success, var(--color-primary-400))', 'var(--color-secondary, #0A84FF)', 'var(--color-warning, #FF9F0A)', 'var(--color-tertiary, var(--color-accent-500))',
  'var(--color-info, var(--color-secondary-500))', 'var(--color-error, #FF3B30)', 'var(--color-neutral-600, #4B5563)', 'var(--color-neutral-500, #6B7280)',
  'var(--color-danger-500, #D946EF)', 'var(--color-success-400, #4ADE80)', 'var(--color-warning-400, #F59E0B)', 'var(--color-info-400, #67E8F9)',
]

export function EnhancedPieChart({
  data,
  themeColors,
  height = 320,
  donutMode = true,
  showCenterLabel = true,
  innerRadius = 55,
  outerRadius = 110,
}: EnhancedPieChartProps) {

  const [activeIndex, setActiveIndex] = useState(-1)

  const pieData = useMemo(() => {
    const labels = data.labels || []
    const dataset = data.datasets?.[0] || {}
    const values = dataset.data || []
    const colors = dataset.backgroundColor || defaultPalette

    return labels.slice(0, 8).map((label, index) => ({
      name: label,
      value: values[index] || 0,
      color: colors[index % colors.length],
      percentage: ((values[index] || 0) / Math.max(...values.filter(v => v > 0), 1)) * 100,
    })).filter(item => item.value > 0).sort((a, b) => b.value - a.value)
  }, [data])

  const totalValue = useMemo(() => {
    return pieData.reduce((sum, item) => sum + item.value, 0)
  }, [pieData])

  const renderActiveShape = (props: any) => {
    const {
      cx, cy, innerRadius, outerRadius, startAngle, endAngle,
      fill, payload, percent, value,
    } = props

    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 8}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          filter="drop-shadow(0 4px 12px rgba(0,0,0,0.2))"
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={innerRadius + 6}
          outerRadius={outerRadius + 14}
          fill={fill}
          opacity={0.25}
        />
        <path d={`M${cx},${cy - outerRadius - 20}L${cx},${cy - outerRadius - 8}`} stroke={fill} strokeWidth="2" fill="none"/>
        <circle cx={cx} cy={cy - outerRadius - 24} r="4" fill={fill}/>
        <text x={cx} y={cy - outerRadius - 32} textAnchor="middle" fill={themeColors.textPrimary} fontSize="13" fontWeight="600">
          {payload.name}
        </text>
        <text x={cx} y={cy - outerRadius - 16} textAnchor="middle" fill={themeColors.textSecondary} fontSize="11">
          {value.toLocaleString('zh-CN')} ({(percent * 100).toFixed(1)}%)
        </text>
      </g>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const item = payload[0].payload

      return (
        <div
          className="rounded-lg p-4 shadow-xl border min-w-[180px]"
          style={{
            backgroundColor: `${themeColors.surface}F2`,
            borderColor: themeColors.outline,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="font-semibold text-sm" style={{ color: themeColors.textPrimary }}>
              {item.name}
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span style={{ color: themeColors.textSecondary }}>数量</span>
              <span className="font-bold tabular-nums" style={{ color: themeColors.textPrimary }}>
                {item.value.toLocaleString('zh-CN')}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: themeColors.textSecondary }}>占比</span>
              <span className="font-bold tabular-nums" style={{ color: themeColors.primary }}>
                {item.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie rootTabIndex={-1}
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={donutMode ? innerRadius : 0}
            outerRadius={outerRadius}
            paddingAngle={donutMode ? 3 : 0}
            dataKey="value"
            activeIndex={activeIndex}
            activeShape={renderActiveShape}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(-1)}
            animationBegin={0}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {pieData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke={themeColors.background}
                strokeWidth={2}
                style={{
                  transition: 'all 0.3s ease',
                  filter: activeIndex === index ? 'brightness(1.1)' : 'none',
                  transform: activeIndex === index ? 'scale(1.02)' : 'scale(1)',
                  transformOrigin: 'center',
                }}
              />
            ))}
          </Pie>

          {/* eslint-disable-next-line react-hooks/static-components -- 图表局部 Tooltip 组件 */}
          <Tooltip content={<CustomTooltip />} animationDuration={200} />

          {/* Center Label for Donut Mode */}
          {donutMode && showCenterLabel && totalValue > 0 && (
            <>
              <text
                x="50%"
                y="45%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="font-bold"
                fill={themeColors.textPrimary}
                fontSize="22"
              >
                {totalValue >= 1000000 ? `${(totalValue / 1000000).toFixed(1)}M` :
                 totalValue >= 1000 ? `${(totalValue / 1000).toFixed(1)}K` :
                 totalValue.toLocaleString('zh-CN')}
              </text>
              <text
                x="50%"
                y="58%"
                textAnchor="middle"
                dominantBaseline="middle"
                fill={themeColors.textMuted}
                fontSize="11"
                fontWeight="500"
              >
                总计
              </text>
            </>
          )}
        </RechartsPieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-wrap justify-center gap-x-6 gap-y-2 px-4 py-3 bg-gradient-to-t from-white/80 dark:from-neutral-900/80 to-transparent">
        {pieData.slice(0, 5).map((item, index) => (
          <button
            key={index}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(-1)}
            className="flex items-center gap-2 px-2 py-1 rounded-md transition-all hover:bg-opacity-10"
            style={{
              backgroundColor: activeIndex === index ? `${item.color}15` : 'transparent',
            }}
          >
            <div
              className="w-2.5 h-2.5 rounded-sm transition-transform"
              style={{
                backgroundColor: item.color,
                transform: activeIndex === index ? 'scale(1.3)' : 'scale(1)',
              }}
            />
            <span className="text-xs font-medium truncate max-w-[80px]" style={{ color: themeColors.textSecondary }}>
              {item.name}
            </span>
            <span className="text-xs font-bold tabular-nums" style={{ color: themeColors.textPrimary }}>
              {item.percentage.toFixed(1)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default EnhancedPieChart

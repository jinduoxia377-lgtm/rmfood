/**
 * TasteRadarChart - 五味雷达图可视化组件
 *
 * 基于 Recharts 的专业级五味分布对比图表
 * 支持多数据系列、交互式工具提示、响应式布局
 */

import React, { useMemo } from 'react'
import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import {
  FIVE_TASTES_LABELS,
} from '@/types/taste.types'
import { FiveTastes } from '@/types/taste.types'
import type {
  TasteProfile,
} from '@/types/taste.types'

interface TasteRadarChartProps {
  /** 主数据（当前配方） */
  primaryData: TasteProfile
  /** 对比数据（可选，如标准配方/历史记录） */
  comparisonData?: {
    label: string
    data: TasteProfile
    color?: string
  }[]
  /** 图表尺寸 */
  width?: number
  height?: number
  /** 是否显示网格 */
  showGrid?: boolean
  /** 自定义类名 */
  className?: string
}

interface RadarDataPoint {
  taste: string
  label: string
  primary: number
  comparison1?: number
  comparison2?: number
}

const DEFAULT_COLORS = [
  'var(--color-secondary-500)',
  'var(--color-primary-400)',
  '#D97706',
  '#FF3B30',
  'var(--color-accent-500)',
]

export function TasteRadarChart({
  primaryData,
  comparisonData = [],
  width = 500,
  height = 400,
  showGrid = true,
  className = '',
}: TasteRadarChartProps) {
  const chartData = useMemo<RadarDataPoint[]>(() => {
    const tasteKeys = Object.values(FiveTastes) as FiveTastes[]

    return tasteKeys.map((taste) => {
      const point: RadarDataPoint = {
        taste,
        label: FIVE_TASTES_LABELS[taste],
        primary: primaryData[taste] || 0,
      }

      if (comparisonData.length > 0) {
        point.comparison1 = comparisonData[0]?.data[taste] || 0
      }
      if (comparisonData.length > 1) {
        point.comparison2 = comparisonData[1]?.data[taste] || 0
      }

      return point
    })
  }, [primaryData, comparisonData])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white dark:bg-neutral-800 p-3 rounded-lg shadow-xl border
                       border-neutral-200 dark:border-neutral-700 text-sm">
          <p className="font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span>{entry.name}:</span>
              <span className="font-semibold">{entry.value.toFixed(1)}</span>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className={`w-full ${className}`} style={{ width: width || '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart
          cx="50%"
          cy="50%"
          outerRadius="75%"
          data={chartData}
        >
          {showGrid && (
            <PolarGrid
              stroke="#e5e7eb"
              className="dark:stroke-neutral-700"
            />
          )}

          <PolarAngleAxis
            dataKey="label"
            tick={{
              fill: '#6b7280',
              fontSize: 13,
              fontWeight: 500,
            }}
            className="dark:text-neutral-400"
          />

          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{
              fill: '#9ca3af',
              fontSize: 12,
            }}
            axisLine={false}
            className="dark:text-neutral-400"
          />

          {/* 主数据 */}
          <Radar
            name="当前配方"
            dataKey="primary"
            stroke="var(--color-secondary-500)"
            fill="var(--color-secondary-500)"
            fillOpacity={0.25}
            strokeWidth={2.5}
            dot={{ r: 4, fill: 'var(--color-secondary-500)', strokeWidth: 2 }}
          />

          {/* 对比数据 1 */}
          {comparisonData.length > 0 && (
            <Radar
              name={comparisonData[0].label || '对比 1'}
              dataKey="comparison1"
              stroke={comparisonData[0].color || DEFAULT_COLORS[1]}
              fill={comparisonData[0].color || DEFAULT_COLORS[1]}
              fillOpacity={0.15}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
            />
          )}

          {/* 对比数据 2 */}
          {comparisonData.length > 1 && (
            <Radar
              name={comparisonData[1].label || '对比 2'}
              dataKey="comparison2"
              stroke={comparisonData[1].color || DEFAULT_COLORS[2]}
              fill={comparisonData[1].color || DEFAULT_COLORS[2]}
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="10 5"
              dot={{ r: 3 }}
            />
          )}

          {/* eslint-disable-next-line react-hooks/static-components */}
          <Tooltip content={<CustomTooltip />} />

          {(comparisonData.length > 0) && (
            <Legend
              wrapperStyle={{
                paddingTop: '20px',
                fontSize: '13px',
              }}
            />
          )}
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default TasteRadarChart

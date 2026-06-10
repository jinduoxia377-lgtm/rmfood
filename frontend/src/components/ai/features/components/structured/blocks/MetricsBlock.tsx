/**
 * MetricsBlock — KPI 指标卡区块
 *
 * 展示多个关键指标的网格卡片
 * 每个卡片包含：图标 + 标签 + 数值 + 单位 + 趋势
 * 自适应列数（2/3/4列）
 */
import React from 'react'
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react'
import type { MetricsData } from '../types'

interface MetricsBlockProps {
  data: MetricsData
}

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
}

const TREND_COLORS = {
  up: 'text-emerald-500 dark:text-emerald-400',
  down: 'text-red-500 dark:text-red-400',
  stable: 'text-gray-400 dark:text-gray-500',
}

function getValueColor(value: string | number): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return 'text-gray-800 dark:text-gray-200'
  if (num >= 0.8) return 'text-emerald-600 dark:text-emerald-400'
  if (num >= 0.5) return 'text-amber-600 dark:text-amber-400'
  if (num > 0) return 'text-red-600 dark:text-red-400'
  return 'text-gray-800 dark:text-gray-200'
}

function formatDisplayValue(value: string | number): string {
  if (typeof value === 'number') {
    if (value < 1 && value > 0) return (value * 100).toFixed(0)
    return value.toLocaleString()
  }
  return value
}

function MetricsBlock({ data }: MetricsBlockProps) {
  const { title, items = [] } = data

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-gray-300 dark:text-gray-600">
        <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-xs">暂无指标数据</p>
      </div>
    )
  }

  // 自适应列数：<=2 项用2列，<=4项用4列，>4项用3列
  const gridCols = items.length <= 2 ? 'grid-cols-2'
    : items.length <= 4 ? 'grid-cols-2 sm:grid-cols-4'
    : 'grid-cols-2 sm:grid-cols-3'

  return (
    <div className="mb-3 last:mb-0">
      {/* 标题 */}
      {title && (
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
          {title}
        </div>
      )}

      {/* 指标卡片网格 */}
      <div className={`grid ${gridCols} gap-2`}>
        {items.map((item, i) => {
          const TrendIcon = item.trend ? TREND_ICONS[item.trend] : null
          const trendColor = item.trend ? TREND_COLORS[item.trend] : ''
          const valueColor = item.color || getValueColor(item.value)
          const displayValue = formatDisplayValue(item.value)

          // 背景色：从预设色板循环
          const bgColors = [
            'bg-primary-50/60 dark:bg-primary-950/30',
            'bg-blue-50/60 dark:bg-blue-950/30',
            'bg-emerald-50/60 dark:bg-emerald-950/30',
            'bg-purple-50/60 dark:bg-purple-950/30',
          ]

          return (
            <div
              key={i}
              className={`${bgColors[i % bgColors.length]} rounded-lg px-3 py-2.5
                border border-gray-100 dark:border-gray-700/50
                transition-all duration-200 hover:shadow-sm`}
            >
              {/* 标签行 */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate">
                  {item.label}
                </span>
                {TrendIcon && (
                  <TrendIcon className={`w-3 h-3 flex-shrink-0 ${trendColor}`} />
                )}
              </div>

              {/* 数值行 */}
              <div className="flex items-baseline gap-0.5">
                <span className={`text-base font-bold ${valueColor} leading-none`}>
                  {displayValue}
                </span>
                {item.unit && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                    {item.unit}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MetricsBlock

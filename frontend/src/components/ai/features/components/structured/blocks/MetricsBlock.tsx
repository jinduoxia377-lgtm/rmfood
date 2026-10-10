/**
 * MetricsBlock — KPI 指标卡区块
 *
 * 展示多个关键指标的网格卡片
 * 每个卡片包含：图标 + 标签 + 数值 + 单位 + 趋势
 * 自适应列数（2/3/4列）
 * 支持雷达图可视化切换（≥5个指标时启用）
 */
import React, { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, BarChart3, CircleDot } from 'lucide-react'
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
  up: 'text-primary-500 dark:text-primary-700',
  down: 'text-error-500 dark:text-error-600',
  stable: 'text-neutral-400 dark:text-neutral-400',
}

function getValueColor(value: string | number): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return 'text-neutral-800 dark:text-neutral-200'
  if (num >= 0.8) return 'text-primary-700 dark:text-primary-700'
  if (num >= 0.5) return 'text-warning-600 dark:text-warning-700'
  if (num > 0) return 'text-error-600 dark:text-error-600'
  return 'text-neutral-800 dark:text-neutral-200'
}

function formatDisplayValue(value: string | number): string {
  if (typeof value === 'number') {
    if (value < 1 && value > 0) return (value * 100).toFixed(0)
    return value.toLocaleString()
  }
  return value
}

function RadarChartView({ items }: { items: MetricsData['items'] }) {
  if (items.length < 3) return null
  const maxVal = Math.max(...items.map(i => typeof i.value === 'number' ? i.value : parseFloat(String(i.value)) || 0))
  const normalizedItems = items.map(i => {
    const v = typeof i.value === 'number' ? i.value : parseFloat(String(i.value)) || 0
    return { ...i, displayValue: maxVal > 0 ? (v / maxVal) * 100 : v }
  })
  const n = normalizedItems.length
  const angleStep = (2 * Math.PI) / n
  const radius = 80
  const center = { x: 100, y: 100 }

  const getPoint = (index: number, value: number) => {
    const angle = index * angleStep - Math.PI / 2
    return {
      x: center.x + (radius * value / 100) * Math.cos(angle),
      y: center.y + (radius * value / 100) * Math.sin(angle),
    }
  }

  const gridLevels = [25, 50, 75, 100]
  const polygonPoints = normalizedItems.map((item, i) => {
    const p = getPoint(i, item.displayValue)
    return `${p.x},${p.y}`
  }).join(' ')

  return (
    <div className="mt-3">
      <svg viewBox="0 0 200 200" className="w-full h-auto">
        {/* 背景网格 */}
        {gridLevels.map((level) => (
          <polygon
            key={level}
            points={normalizedItems.map((_, i) => {
              const p = getPoint(i, level)
              return `${p.x},${p.y}`
            }).join(' ')}
            fill="none"
            stroke="var(--border-subtle, rgba(0,0,0,0.08))"
            strokeWidth={1}
          />
        ))}
        {/* 坐标轴 */}
        {normalizedItems.map((_, i) => {
          const p = getPoint(i, 100)
          return (
            <line
              key={i}
              x1={center.x}
              y1={center.y}
              x2={p.x}
              y2={p.y}
              stroke="var(--border-subtle, rgba(0,0,0,0.08))"
              strokeWidth={1}
            />
          )
        })}
        {/* 数据区域 */}
        <polygon
          points={polygonPoints}
          fill="rgba(16, 185, 129, 0.2)"
          stroke="rgba(16, 185, 129, 0.8)"
          strokeWidth={2}
        />
        {/* 数据点 */}
        {normalizedItems.map((item, i) => {
          const p = getPoint(i, item.displayValue)
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={4}
              fill="rgba(16, 185, 129, 0.9)"
            />
          )
        })}
        {/* 标签 */}
        {normalizedItems.map((item, i) => {
          const p = getPoint(i, 115)
          return (
            <text
              key={i}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[8px] fill-neutral-600 dark:fill-neutral-400"
            >
              {item.label.length > 6 ? item.label.slice(0, 6) + '…' : item.label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

function MetricsBlock({ data }: MetricsBlockProps) {
  const { title, items = [] } = data
  const [showRadar, setShowRadar] = useState(false)

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-neutral-300 dark:text-neutral-400">
        <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-xs">暂无指标数据</p>
      </div>
    )
  }

  // 自适应列数：<=2 项用2列，<=4项用4列，>4项用3列
  const gridCols = items.length <= 2 ? 'grid-cols-2'
    : items.length <= 4 ? 'grid-cols-2 sm:grid-cols-4'
    : 'grid-cols-2 sm:grid-cols-3'

  const canShowRadar = items.length >= 3

  return (
    <div className="mb-3 last:mb-0">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-2">
        {title && (
          <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            {title}
          </div>
        )}
        {canShowRadar && (
          <button
            onClick={() => setShowRadar(!showRadar)}
            className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 hover:text-primary-500 dark:hover:text-primary-600 transition-colors"
          >
            <CircleDot className="w-3 h-3" />
            <span>{showRadar ? '切换卡片' : '雷达图'}</span>
          </button>
        )}
      </div>

      {/* 雷达图视图 */}
      {showRadar && canShowRadar && (
        <RadarChartView items={items} />
      )}

      {/* 指标卡片网格 */}
      {!showRadar && (
        <div className={`grid ${gridCols} gap-2`}>
          {items.map((item, i) => {
            const TrendIcon = item.trend ? TREND_ICONS[item.trend] : null
            const trendColor = item.trend ? TREND_COLORS[item.trend] : ''
            const valueColor = item.color || getValueColor(item.value)
            const displayValue = formatDisplayValue(item.value)

            // 背景色：从预设色板循环
            const bgColors = [
              'bg-primary-50/60 dark:bg-primary-950/30',
              'bg-secondary-50/60 dark:bg-secondary-950/30',
              'bg-primary-50/60 dark:bg-success-950/30',
              'bg-accent-50/60 dark:bg-accent-950/30',
            ]

            return (
              <div
                key={i}
                className={`${bgColors[i % bgColors.length]} rounded-lg px-3 py-2.5
                  border border-neutral-100 dark:border-neutral-700/50
                  transition-all duration-200 hover:shadow-sm`}
              >
                {/* 标签行 */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium truncate">
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
                    <span className="text-xs text-neutral-400 dark:text-neutral-400 font-medium">
                      {item.unit}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MetricsBlock

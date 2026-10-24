/**
 * FlavorWheel - 五味风味轮可视化组件
 *
 * 基于 SVG 的交互式六边形风味轮
 * 用于展示配方的五味分布特征
 *
 * 技术栈：React + TypeScript + SVG
 * 设计原则：简洁优先、性能优化、可访问性
 */

import React, { useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FIVE_TASTES_LABELS,
  FIVE_TASTES_COLORS,
} from '@/types/taste.types'
import { FiveTastes } from '@/types/taste.types'
import type {
  TasteProfile,
} from '@/types/taste.types'

interface FlavorWheelProps {
  /** 口感数据 */
  data: TasteProfile
  /** 尺寸大小 (px) */
  size?: number
  /** 是否显示动画 */
  animated?: boolean
  /** 自定义类名 */
  className?: string
  /** 悬停回调 */
  onHover?: (taste: FiveTastes | null, value: number) => void
}

/** 扇区配置接口 */
interface SectorConfig {
  taste: FiveTastes
  label: string
  color: string
  startAngle: number
  endAngle: number
}

const WHEEL_SIZE = 300
const INNER_RADIUS = 60
const OUTER_RADIUS = 140

export function FlavorWheel({
  data,
  size = WHEEL_SIZE,
  animated = true,
  className = '',
  onHover,
}: FlavorWheelProps) {
  const { t } = useTranslation()
  const [hoveredTaste, setHoveredTaste] = useState<FiveTastes | null>(null)

  const center = size / 2
  const radius = (size / 2) - 20
  const innerRadius = (radius * INNER_RADIUS) / OUTER_RADIUS

  const sectors = useMemo<SectorConfig[]>(() => {
    const tasteKeys = Object.values(FiveTastes)
    const angleStep = (Math.PI * 2) / tasteKeys.length

    return tasteKeys.map((taste, index) => ({
      taste,
      label: FIVE_TASTES_LABELS[taste],
      color: FIVE_TASTES_COLORS[taste],
      startAngle: index * angleStep - Math.PI / 2,
      endAngle: (index + 1) * angleStep - Math.PI / 2,
    }))
  }, [])

  const maxIntensity = useMemo(() => {
    return Math.max(...Object.values(data), 100)
  }, [data])

  const handleMouseEnter = useCallback(
    (taste: FiveTastes, value: number) => {
      setHoveredTaste(taste)
      onHover?.(taste, value)
    },
    [onHover],
  )

  const handleMouseLeave = useCallback(() => {
    setHoveredTaste(null)
    onHover?.(null, 0)
  }, [onHover])

  const createArcPath = (
    cx: number,
    cy: number,
    r: number,
    startAngle: number,
    endAngle: number,
  ): string => {
    const startX = cx + r * Math.cos(startAngle)
    const startY = cy + r * Math.sin(startAngle)
    const endX = cx + r * Math.cos(endAngle)
    const endY = cy + r * Math.sin(endAngle)
    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0

    return [
      'M', cx, cy,
      'L', startX, startY,
      'A', r, r, 0, largeArcFlag, 1, endX, endY,
      'Z',
    ].join(' ')
  }

  const getLabelPosition = (sector: SectorConfig): { x: number; y: number } => {
    const midAngle = (sector.startAngle + sector.endAngle) / 2
    const labelRadius = radius + 25
    return {
      x: center + labelRadius * Math.cos(midAngle),
      y: center + labelRadius * Math.sin(midAngle),
    }
  }

  const getValuePosition = (sector: SectorConfig): { x: number; y: number } => {
    const midAngle = (sector.startAngle + sector.endAngle) / 2
    const valueRadius = innerRadius + (radius - innerRadius) * 0.6
    return {
      x: center + valueRadius * Math.cos(midAngle),
      y: center + valueRadius * Math.sin(midAngle),
    }
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        role="img"
        aria-label={t('ai.taste.visualization.ariaLabel')}
      >
        {/* 背景圆 */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="#f8f9fa"
          stroke="#e9ecef"
          strokeWidth={2}
          className="dark:fill-neutral-800 dark:stroke-neutral-700"
        />

        {/* 六个扇区 */}
        {sectors.map((sector) => {
          const intensity = data[sector.taste] || 0
          const normalizedIntensity = intensity / maxIntensity
          const sectorRadius = innerRadius + (radius - innerRadius) * normalizedIntensity

          if (normalizedIntensity < 0.02) return null

          const path = createArcPath(
            center,
            center,
            sectorRadius,
            sector.startAngle,
            sector.endAngle,
          )

          const isHovered = hoveredTaste === sector.taste

          return (
            <g key={sector.taste}>
              {/* 扇区填充 */}
              <path
                d={path}
                fill={sector.color}
                opacity={isHovered ? 1 : 0.8}
                stroke="white"
                strokeWidth={isHovered ? 3 : 1.5}
                className={`transition-all duration-200 ${
                  animated ? 'animate-pulse-once' : ''
                }`}
                style={{
                  transformOrigin: `${center}px ${center}px`,
                  cursor: 'pointer',
                }}
                onMouseEnter={() =>
                  handleMouseEnter(sector.taste, intensity)
                }
                onMouseLeave={handleMouseLeave}
              />

              {/* 强度数值标签 */}
              {normalizedIntensity > 0.15 && (() => {
                const pos = getValuePosition(sector)
                return (
                  <text
                    x={pos.x}
                    y={pos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={`text-xs font-bold select-none ${
                      isHovered ? 'fill-white' : 'fill-white'
                    }`}
                    style={{
                      textShadow: isHovered
                        ? '0 1px 3px rgba(0,0,0,0.5)'
                        : 'none',
                    }}
                  >
                    {intensity.toFixed(0)}
                  </text>
                )
              })()}
            </g>
          )
        })}

        {/* 中心圆 */}
        <circle
          cx={center}
          cy={center}
          r={innerRadius}
          fill="white"
          stroke="#e9ecef"
          strokeWidth={2}
          className="dark:fill-neutral-900 dark:stroke-neutral-700"
        />

        {/* 中心文字 */}
        <text
          x={center}
          y={center - 10}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-sm font-bold fill-neutral-700 dark:fill-neutral-300"
        >
          {t('ai.taste.visualization.balanceScore')}
        </text>
        <text
          x={center}
          y={center + 15}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-2xl font-bold fill-secondary-600 dark:fill-secondary-400"
        >
          {calculateBalanceScore(data).toFixed(1)}
        </text>

        {/* 外围标签 */}
        {sectors.map((sector) => {
          const pos = getLabelPosition(sector)
          const isHovered = hoveredTaste === sector.taste

          return (
            <g key={`label-${sector.taste}`}>
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`text-sm font-medium transition-all duration-200 ${
                  isHovered
                    ? 'font-bold scale-110'
                    : ''
                }`}
                fill={sector.color}
                style={{
                  fontSize: isHovered ? '16px' : '14px',
                  transition: 'all 0.2s ease',
                }}
              >
                {sector.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* 悬停提示框 */}
      {hoveredTaste && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 bg-white dark:bg-neutral-800
                     px-4 py-2 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700
                     z-10 animate-fade-in pointer-events-none"
        >
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: FIVE_TASTES_COLORS[hoveredTaste] }}
            />
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              {FIVE_TASTES_LABELS[hoveredTaste]}
            </span>
            <span className="text-neutral-600 dark:text-neutral-400">
              {data[hoveredTaste]?.toFixed(1) || 0}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function calculateBalanceScore(profile: TasteProfile): number {
  const values = Object.values(profile)
  const sum = values.reduce((a, b) => a + b, 0)

  if (sum === 0) return 0

  const mean = sum / values.length
  const variance =
    values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
    values.length
  const stdDev = Math.sqrt(variance)

  const coefficientOfVariation = stdDev / mean
  const balanceScore = Math.max(0, 1 - coefficientOfVariation)

  return balanceScore
}

export default FlavorWheel

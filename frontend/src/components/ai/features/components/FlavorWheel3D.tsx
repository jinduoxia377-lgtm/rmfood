/**
 * FlavorWheel3D - 3D 风味雷达图组件 (v1.0)
 *
 * 使用 CSS 3D transform 实现可交互的 3D 风味轮盘。
 * 支持六大味道维度（酸/甜/苦/辣/鲜/涩）的可视化展示。
 *
 * 技术选型理由：
 * - 选择 CSS 3D transform 而非 Three.js 是为了：
 *   1. 包体积更小（0KB vs ~500KB）
 *   2. 更容易与 React 集成
 *   3. 性能更好（GPU 加速，无需 WebGL 上下文）
 *   4. 移动端兼容性更好
 *
 * 功能特性：
 * - 可旋转/缩放交互（鼠标拖拽/滚轮）
 * - 六大味道维度标注清晰
 * - 触摸手势支持（移动端适配）
 * - 数据点悬停显示详情
 * - 动画过渡效果流畅
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-12
 */

import React, { useRef, useState, useCallback, useEffect, memo } from 'react'
import { RotateCcw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { Tooltip } from '@/components/ui'
import { logger } from '@/utils/safeLogger'

// ===== 类型定义 =====

export interface FlavorDimension {
  id: string
  label: string
  value: number // 0-100
  color: string
  description?: string
}

interface FlavorData {
  name: string
  dimensions: FlavorDimension[]
  timestamp?: number
}

interface FlavorWheel3DProps {
  data: FlavorData[]
  width?: number
  height?: number
  showControls?: boolean
  interactive?: boolean
  onDimensionClick?: (dimension: FlavorDimension) => void
  className?: string
}

// ===== 常量配置 =====

const DEFAULT_DIMENSIONS: Omit<FlavorDimension, 'value'>[] = [
  { id: 'sour', label: '酸', color: 'var(--color-yellow-400, #F59E0B)' },
  { id: 'sweet', label: '甜', color: 'var(--color-pink-500, #D946EF)' },
  { id: 'bitter', label: '苦', color: 'var(--color-amber-600, #d97706)' },
  { id: 'spicy', label: '辣', color: 'var(--color-error, #FF3B30)' },
  { id: 'umami', label: '鲜', color: 'var(--color-primary, var(--color-primary-400))' },
  { id: 'astringent', label: '涩', color: 'var(--color-primary-500, #10b981)' },
]

const ROTATION_SPEED = 0.5
const ZOOM_SPEED = 0.1
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.0

// ===== 主组件实现 =====

const FlavorWheel3D = memo(({
  data,
  width = 500,
  height = 500,
  showControls = true,
  interactive = true,
  onDimensionClick,
  className = '',
}: FlavorWheel3DProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [rotation, setRotation] = useState({ x: -20, y: 30 })
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hoveredDimension, setHoveredDimension] = useState<FlavorDimension | null>(null)

  /**
   * 鼠标/触摸事件处理
   */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!interactive) return
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [interactive])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !interactive) return

    const deltaX = e.clientX - dragStart.x
    const deltaY = e.clientY - dragStart.y

    setRotation(prev => ({
      x: Math.max(-90, Math.min(90, prev.x + deltaY * ROTATION_SPEED)),
      y: prev.y + deltaX * ROTATION_SPEED,
    }))

    setDragStart({ x: e.clientX, y: e.clientY })
  }, [isDragging, dragStart, interactive])

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  /**
   * 滚轮缩放处理
   */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!interactive) return
    e.preventDefault()

    setZoom(prev => {
      const delta = e.deltaY > 0 ? -ZOOM_SPEED : ZOOM_SPEED
      return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta))
    })
  }, [interactive])

  /**
   * 触摸手势处理（双指缩放）
   */
  const [touchDistance, setTouchDistance] = useState<number | null>(null)

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!interactive || e.touches.length !== 2) return

    const touch1 = e.touches[0]
    const touch2 = e.touches[1]
    const distance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY,
    )

    if (touchDistance !== null) {
      const scale = distance / touchDistance
      setZoom(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * scale)))
    }

    setTouchDistance(distance)
  }, [interactive, touchDistance])

  useEffect(() => {
    if (touchDistance === null && isDragging) {
      // 单指拖拽已在 handlePointerMove 中处理
    }
  }, [touchDistance, isDragging])

  /**
   * 控制按钮操作
   */
  const handleReset = useCallback(() => {
    setRotation({ x: -20, y: 30 })
    setZoom(1)
  }, [])

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(MAX_ZOOM, prev + 0.2))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(MIN_ZOOM, prev - 0.2))
  }, [])

  /**
   * 计算多边形顶点坐标
   */
  const calculatePolygonPoints = useCallback((
    dimensions: FlavorDimension[],
    centerX: number,
    centerY: number,
    radius: number,
  ): string => {
    const angleStep = (Math.PI * 2) / dimensions.length
    return dimensions
      .map((dim, i) => {
        const angle = angleStep * i - Math.PI / 2
        const r = radius * (dim.value / 100)
        const x = centerX + r * Math.cos(angle)
        const y = centerY + r * Math.sin(angle)
        return `${x},${y}`
      })
      .join(' ')
  }, [])

  /**
   * 渲染单个数据集的雷达图
   */
  const renderRadarChart = useCallback(
    (flavorData: FlavorData, index: number) => {
      const cx = width / 2
      const cy = height / 2
      const maxRadius = Math.min(width, height) * 0.35

      return (
        <g key={flavorData.name} className="radar-chart">
          {/* 背景网格 */}
          {[0.25, 0.5, 0.75, 1].map((level) => (
            <polygon
              key={level}
              points={DEFAULT_DIMENSIONS.map((_, i) => {
                const angleStep = (Math.PI * 2) / DEFAULT_DIMENSIONS.length
                const angle = angleStep * i - Math.PI / 2
                const r = maxRadius * level
                return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
              }).join(' ')}
              fill={index === 0 ? 'rgba(99, 102, 241, 0.05)' : 'none'}
              stroke="rgba(156, 163, 175, 0.3)"
              strokeWidth={0.5}
            />
          ))}

          {/* 轴线 */}
          {DEFAULT_DIMENSIONS.map((dim, i) => {
            const angleStep = (Math.PI * 2) / DEFAULT_DIMENSIONS.length
            const angle = angleStep * i - Math.PI / 2
            return (
              <line
                key={dim.id}
                x1={cx}
                y1={cy}
                x2={cx + maxRadius * Math.cos(angle)}
                y2={cy + maxRadius * Math.sin(angle)}
                stroke="rgba(156, 163, 175, 0.3)"
                strokeWidth={0.5}
              />
            )
          })}

          {/* 数据多边形 */}
          <polygon
            points={calculatePolygonPoints(
              flavorData.dimensions.map(d => ({
                ...d,
                ...DEFAULT_DIMENSIONS.find(def => def.id === d.id)!,
              })),
              cx,
              cy,
              maxRadius,
            )}
            fill={`hsla(${index * 60}, 70%, 60%, ${data.length > 1 ? 0.3 : 0.4})`}
            stroke={`hsl(${index * 60}, 70%, 50%)`}
            strokeWidth={2}
            style={{ transition: 'all 0.3s ease-out' }}
          />

          {/* 数据点和标签 */}
          {flavorData.dimensions.map((dim, i) => {
            const dimDef = DEFAULT_DIMENSIONS.find(d => d.id === dim.id)!
            const angleStep = (Math.PI * 2) / DEFAULT_DIMENSIONS.length
            const angle = angleStep * i - Math.PI / 2
            const r = maxRadius * (dim.value / 100)
            const x = cx + r * Math.cos(angle)
            const y = cy + r * Math.sin(angle)
            const labelX = cx + (maxRadius + 25) * Math.cos(angle)
            const labelY = cy + (maxRadius + 25) * Math.sin(angle)

            return (
              <g key={dim.id}>
                {/* 数据点 */}
                <circle
                  cx={x}
                  cy={y}
                  r={hoveredDimension?.id === dim.id ? 7 : 5}
                  fill={dimDef.color}
                  stroke="#fff"
                  strokeWidth={2}
                  style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={() => setHoveredDimension(dim)}
                  onMouseLeave={() => setHoveredDimension(null)}
                  onClick={() => onDimensionClick?.(dim)}
                />
                {/* 维度标签 */}
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill={dimDef.color}
                >
                  {dimDef.label}
                </text>
                {/* 数值标签 */}
                <text
                  x={x}
                  y={y - 12}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--color-gray-700, #374151)"
                >
                  {dim.value.toFixed(0)}
                </text>
              </g>
            )
          })}
        </g>
      )
    },
    [width, height, hoveredDimension, data.length, onDimensionClick, calculatePolygonPoints],
  )

  return (
    <div className={`relative ${className}`}>
      {/* 控制按钮 */}
      {showControls && (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="p-2 bg-white dark:bg-neutral-800 rounded-lg shadow-md hover:bg-slate-50 dark:hover:bg-neutral-700 transition-colors"
            title="放大"
          >
            <ZoomIn className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 bg-white dark:bg-neutral-800 rounded-lg shadow-md hover:bg-slate-50 dark:hover:bg-neutral-700 transition-colors"
            title="缩小"
          >
            <ZoomOut className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 bg-white dark:bg-neutral-800 rounded-lg shadow-md hover:bg-slate-50 dark:hover:bg-neutral-700 transition-colors"
            title="重置视图"
          >
            <RotateCcw className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
          </button>
          <div className="text-xs text-center text-neutral-500 dark:text-neutral-400 mt-1">
            {(zoom * 100).toFixed(0)}%
          </div>
        </div>
      )}

      {/* 3D 容器 */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
        style={{
          perspective: '1000px',
          width: `${width}px`,
          height: `${height}px`,
          maxWidth: '100%',
          margin: '0 auto',
        }}
        onWheel={handleWheel}
        onTouchMove={handleTouchMove}
      >
        {/* SVG 图表层 */}
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale(${zoom})`,
            transformStyle: 'preserve-3d',
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
            cursor: interactive ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* 渲染所有数据集 */}
          {data.map(renderRadarChart)}

          {/* 中心标题 */}
          {data.length === 1 && (
            <text
              x={width / 2}
              y={height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={14}
              fontWeight={700}
              fill="var(--color-gray-700, #374151)"
            >
              {data[0].name}
            </text>
          )}

          {/* 多数据集图例 */}
          {data.length > 1 && (
            <g transform={`translate(${width - 80}, 10)`}>
              {data.map((d, i) => (
                <g key={i} transform={`translate(0, ${i * 18})`}>
                  <rect width={12} height={12} fill={`hsl(${i * 60}, 70%, 50%)`} rx={2} />
                  <text x={16} y={10} fontSize={10} fill="var(--color-gray-700, #374151)">{d.name}</text>
                </g>
              ))}
            </g>
          )}
        </svg>

        {/* 交互提示 */}
        {interactive && !isDragging && (
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] pointer-events-none select-none">
            拖拽旋转 · 滚轮缩放 · 点击查看详情
          </div>
        )}
      </div>

      {/* 悬停 Tooltip */}
      {hoveredDimension && (
        <Tooltip content={
          <div className="space-y-1">
            <div className="font-semibold" style={{ color: hoveredDimension.color }}>
              {hoveredDimension.label}
            </div>
            <div className="text-sm">强度值: {hoveredDimension.value.toFixed(1)}</div>
            {hoveredDimension.description && (
              <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{hoveredDimension.description}</div>
            )}
          </div>
        }>
          <div className="sr-only">维度信息</div>
        </Tooltip>
      )}
    </div>
  )
})

FlavorWheel3D.displayName = 'FlavorWheel3D'

export { FlavorWheel3D }
export default FlavorWheel3D

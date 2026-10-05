import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import * as d3 from 'd3'
import { Tooltip } from '@/components/ui'

interface HazardType {
  id: string
  name: string
  label: string
}

interface IngredientRisk {
  ingredientId: string
  name: string
  hazards: Record<string, {
    score: number
    level: 'low' | 'medium' | 'high' | 'unknown'
    regulation?: string
    limit?: number
    actual?: number
    suggestion?: string
  }>
}

interface RiskMatrixProps {
  data: IngredientRisk[]
  hazardTypes?: HazardType[]
  maxIngredients?: number
  onCellClick?: (ingredientId: string, hazardTypeId: string) => void
  className?: string
}

const DEFAULT_HAZARD_TYPES: HazardType[] = [
  { id: 'acute_toxicity', name: 'acute_toxicity', label: '急性毒性' },
  { id: 'chronic_toxicity', name: 'chronic_toxicity', label: '慢性毒性' },
  { id: 'sensitization', name: 'sensitization', label: '致敏性' },
  { id: 'carcinogenicity', name: 'carcinogenicity', label: '致癌性' },
  { id: 'reproductive_toxicity', name: 'reproductive_toxicity', label: '生殖毒性' },
  { id: 'other', name: 'other', label: '其他' },
]

const COLOR_CONFIG = {
  unknown: { fill: 'var(--color-slate-200, #E5E7EB)', text: 'var(--color-slate-500, #6B7280)' },
  low: { fill: 'var(--color-primary, var(--color-primary-400))', text: 'var(--color-green-900, #065F46)' },
  medium: { fill: 'var(--color-warning, #FF9F0A)', text: 'var(--color-amber-800, #D97706)' },
  high: { fill: 'var(--color-error, #FF3B30)', text: 'var(--color-red-800, #DC2626)' },
}

const CELL_SIZE = 60
const CELL_PADDING = 2
const HEADER_HEIGHT = 40
const HEADER_WIDTH = 120

export function RiskMatrix({
  data,
  hazardTypes = DEFAULT_HAZARD_TYPES,
  maxIngredients = 20,
  onCellClick,
  className = '',
}: RiskMatrixProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hoveredCell, setHoveredCell] = useState<{ ingredientId: string; hazardTypeId: string } | null>(null)

  const displayData = useMemo(() => data.slice(0, maxIngredients), [data, maxIngredients])

  const matrixWidth = HEADER_WIDTH + hazardTypes.length * (CELL_SIZE + CELL_PADDING)
  const matrixHeight = HEADER_HEIGHT + displayData.length * (CELL_SIZE + CELL_PADDING)

  const getOpacityByScore = useCallback((score: number, level: string) => {
    if (level === 'unknown') return 0.3
    if (level === 'low') return 0.3 + (score / 100) * 0.5
    if (level === 'medium') return 0.5 + (score / 100) * 0.4
    return 0.7 + (score / 100) * 0.3
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.5, Math.min(3, transform.k * delta))
    setTransform(prev => ({ ...prev, k: newScale }))
  }, [transform.k])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
    }
  }, [transform.x, transform.y])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setTransform({
        ...transform,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }, [isDragging, dragStart, transform])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const tooltipContent = useMemo(() => {
    if (!hoveredCell) return null

    const ingredient = displayData.find(d => d.ingredientId === hoveredCell.ingredientId)
    if (!ingredient) return null

    const hazard = ingredient.hazards[hoveredCell.hazardTypeId]
    if (!hazard) return null

    const hazardType = hazardTypes.find(h => h.id === hoveredCell.hazardTypeId)
    const colorConfig = COLOR_CONFIG[hazard.level]

    return (
      <div className="space-y-2 min-w-[250px] p-3">
        <div className="font-semibold text-neutral-900 dark:text-neutral-100 border-b pb-2">
          {ingredient.name} - {hazardType?.label}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-neutral-500">风险等级:</span>
            <span className={`ml-2 font-medium`} style={{ color: colorConfig.text }}>
              {hazard.level === 'low' ? '低' : hazard.level === 'medium' ? '中' : hazard.level === 'high' ? '高' : '未检测'}
            </span>
          </div>
          <div>
            <span className="text-neutral-500">评分:</span>
            <span className="ml-2 font-bold">{hazard.score}</span>
          </div>
        </div>
        {hazard.regulation && (
          <div className="text-sm">
            <span className="text-neutral-500">法规依据:</span>
            <span className="ml-2">{hazard.regulation}</span>
          </div>
        )}
        {hazard.limit !== undefined && hazard.actual !== undefined && (
          <div className="text-sm">
            <span className="text-neutral-500">限值/实测:</span>
            <span className="ml-2">{hazard.limit} / {hazard.actual}</span>
          </div>
        )}
        {hazard.suggestion && (
          <div className="mt-2 p-2 bg-secondary-50 dark:bg-secondary-900/20 rounded text-sm text-secondary-800 dark:text-secondary-200">
            <span className="font-medium">建议: </span>{hazard.suggestion}
          </div>
        )}
      </div>
    )
  }, [hoveredCell, displayData, hazardTypes])

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const g = svg.append('g')
      .attr('transform', `translate(${transform.x}, ${transform.y}) scale(${transform.k})`)

    g.append('rect')
      .attr('width', matrixWidth)
      .attr('height', matrixHeight)
      .attr('fill', 'white')
      .attr('stroke', 'var(--color-slate-200, #E5E7EB)')

    hazardTypes.forEach((hazard, colIndex) => {
      const x = HEADER_WIDTH + colIndex * (CELL_SIZE + CELL_PADDING)
      g.append('text')
        .attr('x', x + CELL_SIZE / 2)
        .attr('y', HEADER_HEIGHT / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('fill', 'var(--color-gray-700, #374151)')
        .attr('transform', `rotate(-45, ${x + CELL_SIZE / 2}, ${HEADER_HEIGHT / 2})`)
        .text(hazard.label)
    })

    displayData.forEach((ingredient, rowIndex) => {
      const y = HEADER_HEIGHT + rowIndex * (CELL_SIZE + CELL_PADDING)

      g.append('text')
        .attr('x', HEADER_WIDTH - 10)
        .attr('y', y + CELL_SIZE / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '11px')
        .attr('fill', 'var(--color-gray-700, #374151)')
        .text(ingredient.name.length > 8 ? ingredient.name.substring(0, 8) + '...' : ingredient.name)

      hazardTypes.forEach((hazard, colIndex) => {
        const x = HEADER_WIDTH + colIndex * (CELL_SIZE + CELL_PADDING)
        const cellData = ingredient.hazards[hazard.id]
        const level = cellData?.level || 'unknown'
        const score = cellData?.score || 0
        const colorConfig = COLOR_CONFIG[level]
        const opacity = getOpacityByScore(score, level)

        const cellGroup = g.append('g')
          .attr('class', 'matrix-cell')
          .style('cursor', 'pointer')

        cellGroup.append('rect')
          .attr('x', x)
          .attr('y', y)
          .attr('width', CELL_SIZE)
          .attr('height', CELL_SIZE)
          .attr('rx', 4)
          .attr('fill', colorConfig.fill)
          .attr('fill-opacity', opacity)
          .attr('stroke', colorConfig.fill)
          .attr('stroke-width', hoveredCell?.ingredientId === ingredient.ingredientId && hoveredCell?.hazardTypeId === hazard.id ? 2 : 0.5)
          .style('transition', 'all 0.2s ease')

        const levelText = level === 'unknown' ? '未检测' : level === 'low' ? '低' : level === 'medium' ? '中' : '高'

        cellGroup.append('text')
          .attr('x', x + CELL_SIZE / 2)
          .attr('y', y + CELL_SIZE / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', '10px')
          .attr('font-weight', '600')
          .attr('fill', colorConfig.text)
          .text(levelText)

        cellGroup.on('click', () => {
          onCellClick?.(ingredient.ingredientId, hazard.id)
        })

        cellGroup.on('mouseenter', () => {
          setHoveredCell({ ingredientId: ingredient.ingredientId, hazardTypeId: hazard.id })
          d3.select(cellGroup.node())
            .select('rect')
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 1)
        })

        cellGroup.on('mouseleave', () => {
          setHoveredCell(null)
          d3.select(cellGroup.node())
            .select('rect')
            .attr('stroke-width', 0.5)
            .attr('stroke-opacity', 0.5)
        })
      })
    })
  }, [displayData, hazardTypes, transform, hoveredCell, onCellClick, getOpacityByScore, matrixWidth, matrixHeight])

  return (
    <div ref={containerRef} className={`relative overflow-hidden border border-neutral-200 dark:border-neutral-700 rounded-lg ${className}`}>
      <svg
        ref={svgRef}
        width={matrixWidth}
        height={matrixHeight}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      />

      {hoveredCell && (
        <Tooltip content={tooltipContent} position="right">
          <div className="absolute top-0 left-0 w-0 h-0" />
        </Tooltip>
      )}

      <div className="absolute bottom-2 right-2 flex gap-2 bg-white/90 dark:bg-neutral-800/90 p-2 rounded-lg shadow-md text-xs">
        {Object.entries(COLOR_CONFIG).map(([level, config]) => (
          <div key={level} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: config.fill }}
            />
            <span style={{ color: config.text }}>
              {level === 'unknown' ? '未检测' : level === 'low' ? '低风险' : level === 'medium' ? '中风险' : '高风险'}
            </span>
          </div>
        ))}
      </div>

      <div className="absolute top-2 left-2 text-xs text-neutral-500 dark:text-neutral-400 bg-white/80 dark:bg-neutral-800/80 px-2 py-1 rounded">
        缩放: {(transform.k * 100).toFixed(0)}% | 拖拽移动 | 滚轮缩放
      </div>
    </div>
  )
}

export type { RiskMatrixProps, HazardType, IngredientRisk }

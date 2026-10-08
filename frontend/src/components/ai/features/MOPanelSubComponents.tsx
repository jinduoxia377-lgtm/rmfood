/**
 * MO Panel Sub-Components — 多目标优化面板子组件提取
 *
 * 从 MultiObjectivePanel.tsx 中提取的展示组件：
 * - ParallelCoordinatesChart（平行坐标图）
 * - MOParamSlider（参数滑块）
 * - MOStatCard（统计卡片）
 * - MOCandidateCard（候选方案卡片）
 */
import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Slider, Badge } from '@/components/ui'
import { ChevronDown, ChevronUp, Info, Zap } from 'lucide-react'
import type { MultiObjectiveResponse } from '@/api/ai'

// ─── Pareto 颜色工具 ───

export function getParetoColor(rank: number): string {
  const colors = ['var(--color-yellow-400, #F59E0B)', 'var(--color-slate-400, #9CA3AF)', 'var(--color-blue-400, #6ECAFF)', 'var(--color-violet-400, #C090FF)', 'var(--color-emerald-400, #4ADE80)', 'var(--color-red-400, #EF4444)'];
  return colors[Math.min(rank, colors.length) - 1] || 'var(--color-slate-400, #9CA3AF)';
}

// ─── 平行坐标图 ───

interface ParallelCoordinatesChartProps {
  objectives: Array<{ name: string; key: string; direction: string; weight: number }>
  candidates: Array<{
    objective_scores: Record<string, number>
    pareto_rank: number
    crowding_distance: number
  }>
  minMax: Record<string, { min: number; max: number }>
  hoveredIdx: number | null
  onHover: (idx: number | null) => void
  onSelectIdx: (idx: number) => void
  selectedIdx: number | null
}

export function ParallelCoordinatesChart({
  objectives,
  candidates,
  minMax,
  hoveredIdx,
  onHover,
  onSelectIdx,
  selectedIdx,
}: ParallelCoordinatesChartProps) {
  const svgWidth = 500
  const svgHeight = 280
  const labelY = 18
  const axisTop = 36
  const axisBottom = svgHeight - 16
  const axisRange = axisBottom - axisTop

  const padding = 40
  const stepX = (svgWidth - padding * 2) / Math.max(objectives.length - 1, 1)
  const axisXPositions = objectives.map((_, i) => padding + i * stepX)

  const getY = useCallback(
    (value: number, objKey: string): number => {
      const range = minMax[objKey]
      if (!range || range.max === range.min) return axisTop + axisRange / 2
      const normalized = (value - range.min) / (range.max - range.min)
      return axisBottom - normalized * axisRange
    },
    [minMax, axisTop, axisBottom, axisRange],
  )

  return (
    <div className="w-full" style={{ maxWidth: '100%' }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full overflow-visible"
        role="img"
        aria-label={`平行坐标图，展示 ${candidates.length} 个候选方案在 ${objectives.length} 个目标维度上的权衡关系`}
      >
        {/* Y轴标签和轴线 */}
        {objectives.map((obj, i) => (
          <g key={obj.key}>
            <text
              x={axisXPositions[i]}
              y={labelY}
              textAnchor="middle"
              className="text-[10px] fill-slate-500 dark:fill-slate-400"
              fill="currentColor"
            >
              {obj.name}
            </text>
            <circle
              cx={axisXPositions[i] - 8}
              cy={labelY - 3}
              r={3}
              fill={obj.direction === 'maximize' ? 'var(--color-primary, var(--color-primary-400))' : 'var(--color-orange-500, #EA580C)'}
            />
            <line
              x1={axisXPositions[i]}
              y1={axisTop}
              x2={axisXPositions[i]}
              y2={axisBottom}
              stroke="currentColor"
              opacity={0.15}
            />
          </g>
        ))}

        {/* 每个候选方案的一条折线 */}
        {candidates.map((cand, idx) => {
          const isHovered = hoveredIdx === idx
          const isSelected = selectedIdx === idx
          const points = objectives
            .map((obj, i) => `${axisXPositions[i]},${getY(cand.objective_scores[obj.key] ?? 0, obj.key)}`)
            .join(' ')

          return (
            <g key={idx}>
              <polyline
                points={points}
                fill="none"
                stroke={getParetoColor(cand.pareto_rank)}
                strokeWidth={cand.pareto_rank === 1 ? 2.5 : isSelected ? 2.2 : 1.2}
                opacity={isHovered || isSelected ? 1 : 0.55}
                strokeLinejoin="round"
                className="cursor-pointer transition-opacity duration-150"
                onMouseEnter={() => onHover(idx)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onSelectIdx(idx)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectIdx(idx)
                  }
                }}
                aria-label={`候选方案 ${idx + 1}, Pareto Rank-${cand.pareto_rank}${isSelected ? ' (已选中)' : ''}`}
              />
              {(isHovered || isSelected) &&
                objectives.map((obj, i) => {
                  const cy = getY(cand.objective_scores[obj.key] ?? 0, obj.key)
                  return (
                    <circle
                      key={`${idx}-${obj.key}`}
                      cx={axisXPositions[i]}
                      cy={cy}
                      r={3.5}
                      fill={getParetoColor(cand.pareto_rank)}
                      stroke="#fff"
                      strokeWidth={1.2}
                    >
                      <title>
                        {`${obj.name}: ${(cand.objective_scores[obj.key] ?? 0).toFixed(4)} · Rank-${cand.pareto_rank}`}
                      </title>
                    </circle>
                  )
                })}
            </g>
          )
        })}

        {/* Hover tooltip */}
        {hoveredIdx !== null && candidates[hoveredIdx] && (
          <foreignObject x={8} y={4} width={180} height={80}>
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg p-2 text-[11px]">
              <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                方案 #{hoveredIdx + 1} · R{candidates[hoveredIdx].pareto_rank}
              </p>
              {objectives.slice(0, 4).map((obj) => (
                <p key={obj.key} className="text-neutral-600 dark:text-neutral-400 flex justify-between gap-2">
                  <span>{obj.name}</span>
                  <span className="font-mono">
                    {(candidates[hoveredIdx].objective_scores[obj.key] ?? 0).toFixed(3)}
                  </span>
                </p>
              ))}
            </div>
          </foreignObject>
        )}
      </svg>

      {/* 图例 */}
      <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
        {[1, 2, 3, 4, 5].map((rank) => (
          <div key={rank} className="flex items-center gap-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            <span
              className="w-2.5 h-0.5 rounded-sm"
              style={{ backgroundColor: getParetoColor(rank), height: rank === 1 ? '3px' : '2px' }}
            />
            R{rank}
          </div>
        ))}
        <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-1">· 点击折线选中查看雷达图</span>
      </div>
    </div>
  )
}

// ─── 参数滑块 ───

export interface MOParamSliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  displayFormat?: (v: number) => string
  description?: string
}

export function MOParamSlider({ label, value, min, max, step, onChange, displayFormat, description }: MOParamSliderProps) {
  const displayValue = displayFormat ? displayFormat(value) : String(value)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">{label}</label>
        <span className="text-sm font-semibold tabular-nums text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md">
          {displayValue}
        </span>
      </div>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        aria-label={`${label}，当前值 ${displayValue}，范围 ${min}-${max}`}
      />
      {description && <p className="text-xs text-neutral-400 dark:text-neutral-500">{description}</p>}
    </div>
  )
}

// ─── 统计卡片 ───

interface MOStatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  color: 'indigo' | 'blue' | 'green' | 'amber' | 'purple' | 'teal'
}

const MO_COLOR_MAP: Record<MOStatCardProps['color'], { bg: string; text: string; iconBg: string }> = {
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/15', text: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  blue:   { bg: 'bg-secondary-50 dark:bg-secondary-900/15', text: 'text-secondary-600 dark:text-secondary-400', iconBg: 'bg-secondary-100 dark:bg-secondary-900/30' },
  green:  { bg: 'bg-success-50 dark:bg-success-900/15', text: 'text-success-600 dark:text-success-400', iconBg: 'bg-success-100 dark:bg-success-900/30' },
  amber:  { bg: 'bg-warning-50 dark:bg-warning-900/15', text: 'text-warning-600 dark:text-warning-400', iconBg: 'bg-warning-100 dark:bg-warning-900/30' },
  purple: { bg: 'bg-accent-50 dark:bg-accent-900/15',  text: 'text-accent-600 dark:text-accent-400',  iconBg: 'bg-accent-100 dark:bg-accent-900/30' },
  teal:   { bg: 'bg-teal-50 dark:bg-teal-900/15',    text: 'text-teal-600 dark:text-teal-400',    iconBg: 'bg-teal-100 dark:bg-teal-900/30' },
}

export function MOStatCard({ icon, label, value, color }: MOStatCardProps) {
  const c = MO_COLOR_MAP[color]
  return (
    <div className={cn(c.bg, 'rounded-xl border border-neutral-100 dark:border-neutral-800 p-4')}>
      <div className="flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', c.iconBg, c.text)}>{icon}</div>
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
          <p className={cn('text-lg font-bold tabular-nums', c.text)}>{value}</p>
        </div>
      </div>
    </div>
  )
}

// ─── 候选方案卡片 ───

interface MOCandidateCardProps {
  candidate: MultiObjectiveResponse['candidates'][0]
  rank: number
  objectivesConfig: Array<{ name: string; key: string; direction: string; weight: number }>
}

export function MOCandidateCard({ candidate, rank, objectivesConfig }: MOCandidateCardProps) {
  const [expanded, setExpanded] = useState(false)

  const rankColor =
    candidate.pareto_rank === 1
      ? 'from-yellow-400 to-amber-500'
      : candidate.pareto_rank === 2
        ? 'from-slate-300 to-slate-400'
        : candidate.pareto_rank === 3
          ? 'from-amber-600 to-amber-700'
          : 'from-slate-400 to-slate-500'

  return (
    <article
      className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-200 overflow-hidden"
      aria-label={`Pareto 方案第 ${rank} 名，Rank-${candidate.pareto_rank}，适应度 ${candidate.overall_fitness.toFixed(4)}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <span
                className={cn(
                  'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white',
                  `bg-gradient-to-br ${rankColor}`,
                )}
                aria-label={`排名第 ${rank}`}
              >
                {rank}
              </span>
              <Badge
                variant={candidate.pareto_rank === 1 ? 'success' : candidate.pareto_rank === 2 ? 'warning' : 'neutral'}
              >
                Pareto R{candidate.pareto_rank}
              </Badge>
              {candidate.compliance_status && (
                <Badge
                  variant={
                    candidate.compliance_status === 'compliant' ? 'success' :
                    candidate.compliance_status === 'warning' ? 'warning' : 'danger'
                  }
                  size="sm"
                >
                  {candidate.compliance_status === 'compliant' ? '✓ 营养合规' :
                   candidate.compliance_status === 'warning' ? '⚠ 营养警告' : '✗ 营养违规'}
                </Badge>
              )}
              <span className="text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
                {candidate.overall_fitness.toFixed(4)}
              </span>
              <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">拥挤度: {candidate.crowding_distance.toFixed(4)}</span>
            </div>

            {/* 药材组成 */}
            <div className="flex flex-wrap gap-1.5">
              {candidate.ingredients.map((ing) => (
                <span
                  key={ing.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-md text-xs text-neutral-700 dark:text-neutral-300"
                >
                  {ing.name_cn}
                  <span className="text-neutral-400 dark:text-neutral-500">{ing.dosage}g</span>
                </span>
              ))}
            </div>
          </div>

          {/* 目标分数条形图 */}
          <div className="hidden sm:flex items-end gap-1 h-16 flex-shrink-0" aria-label="各目标分数可视化">
            {objectivesConfig.slice(0, 6).map((obj) => {
              const val = (candidate.objective_scores ?? {})[obj.key] ?? 0
              return (
                <div key={obj.key} className="flex flex-col items-center gap-1" title={`${obj.name}: ${val.toFixed(4)}`}>
                  <div
                    className="w-3 rounded-t-sm opacity-80"
                    style={{
                      height: `${Math.max(Math.abs(val) * 48, 4)}px`,
                      backgroundColor: obj.direction === 'maximize' ? 'var(--color-primary-500, var(--color-primary-400))' : 'var(--color-orange-500, #EA580C)',
                    }}
                  />
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 whitespace-nowrap truncate w-8 text-center">
                    {obj.name.slice(0, 3)}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="flex-shrink-0 self-center text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" aria-hidden="true">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </button>

      {/* 展开详情 */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-neutral-100 dark:border-neutral-800 pt-4 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
            {objectivesConfig.map((obj) => {
              const val = candidate.objective_scores[obj.key] ?? 0
              return (
                <div
                  key={obj.key}
                  className="flex items-center gap-2 bg-slate-50 dark:bg-neutral-800/50 rounded-lg px-3 py-2"
                >
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      obj.direction === 'maximize' ? 'bg-primary-500' : 'bg-orange-500',
                    )}
                  />
                  <div>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{obj.name}</p>
                    <p className="text-sm font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
                      {val.toFixed(4)}
                    </p>
                  </div>
                </div>
              )
            })}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-neutral-800/50 rounded-lg px-3 py-2">
              <Zap className="w-2 h-2 text-violet-500" />
              <div>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500">拥挤距离</p>
                <p className="text-sm font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
                  {candidate.crowding_distance.toFixed(4)}
                </p>
              </div>
            </div>
          </div>

          {candidate.explanation && (
            <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-lg p-4 border border-indigo-100 dark:border-indigo-900/20">
              <h5 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" aria-hidden="true" />
                方案解析
              </h5>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
                {candidate.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

/**
 * GA Sub-Components — 遗传算法面板子组件提取
 *
 * 从 GeneticAlgorithmPanel.tsx 中提取的纯展示组件，
 * 减少主文件复杂度，便于独立测试和维护。
 */
import React from 'react'
import { Slider, Badge } from '@/components/ui'
import { ChevronDown, ChevronUp, FlaskConical, Shield, Zap, DollarSign } from 'lucide-react'
import type { GeneticGenerateResponse } from '@/api/ai'

// ─── 参数滑块 ───

export interface ParamSliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  displayFormat?: (v: number) => string
  description?: string
}

export function ParamSlider({ label, value, min, max, step, onChange, displayFormat, description }: ParamSliderProps) {
  const displayValue = displayFormat ? displayFormat(value) : String(value)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">{label}</label>
        <span className="text-sm font-semibold tabular-nums text-accent-600 dark:text-accent-700 bg-accent-50 dark:bg-accent-300/20 px-2 py-0.5 rounded-md">
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
      {description && (
        <p className="text-xs text-neutral-400 dark:text-neutral-400">{description}</p>
      )}
    </div>
  )
}

// ─── 统计卡片 ───

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  color: 'violet' | 'blue' | 'green' | 'amber' | 'teal'
}

const COLOR_MAP: Record<StatCardProps['color'], { bg: string; text: string; iconBg: string }> = {
  violet: { bg: 'bg-accent-50 dark:bg-accent-300/18', text: 'text-accent-600 dark:text-accent-700', iconBg: 'bg-accent-100 dark:bg-accent-300/25' },
  blue:   { bg: 'bg-secondary-50 dark:bg-secondary-300/18',   text: 'text-secondary-600 dark:text-secondary-700',   iconBg: 'bg-secondary-100 dark:bg-secondary-300/25' },
  green:  { bg: 'bg-success-50 dark:bg-success-300/18',  text: 'text-success-600 dark:text-success-600',  iconBg: 'bg-success-100 dark:bg-success-300/25' },
  amber:  { bg: 'bg-warning-50 dark:bg-warning-300/18',  text: 'text-warning-600 dark:text-warning-700',  iconBg: 'bg-warning-100 dark:bg-warning-300/25' },
  teal:   { bg: 'bg-success-50 dark:bg-success-300/18',   text: 'text-success-600 dark:text-success-700',   iconBg: 'bg-success-100 dark:bg-success-300/25' },
}

export function StatCard({ icon, label, value, color }: StatCardProps) {
  const c = COLOR_MAP[color]
  return (
    <div className={`${c.bg} rounded-xl border border-neutral-100 dark:border-neutral-800 p-4`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg ${c.iconBg} flex items-center justify-center ${c.text}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
          <p className={`text-lg font-bold tabular-nums ${c.text}`}>{value}</p>
        </div>
      </div>
    </div>
  )
}

// ─── 候选方案卡片 ───

interface CandidateCardProps {
  candidate: GeneticGenerateResponse['candidates'][0]
  rank: number
  isExpanded: boolean
  onToggleExpand: () => void
}

export function CandidateCard({ candidate, rank, isExpanded, onToggleExpand }: CandidateCardProps) {
  const scoreColor =
    candidate.overall_score >= 0.85 ? 'text-success-500' :
    candidate.overall_score >= 0.70 ? 'text-warning-500' :
    'text-error-500'

  const scoreLabels = [
    { key: 'efficacy_score', label: '药效', value: candidate.efficacy_score, icon: <FlaskConical className="w-3.5 h-3.5" />, color: 'text-success-500' },
    { key: 'safety_score',   label: '安全', value: candidate.safety_score,   icon: <Shield className="w-3.5 h-3.5" />,       color: 'text-secondary-500' },
    { key: 'taste_score',    label: '口感', value: candidate.taste_score,    icon: <Zap className="w-3.5 h-3.5" />,          color: 'text-warning-500' },
    { key: 'cost_score',     label: '成本', value: candidate.cost_score,     icon: <DollarSign className="w-3.5 h-3.5" />,   color: 'text-accent-500' },
  ]

  return (
    <article
      className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm hover:shadow-md hover:border-accent-200 dark:hover:border-accent-800 transition-all duration-200 overflow-hidden"
      aria-label={`候选方案第 ${rank} 名，综合分 ${(candidate.overall_score * 100).toFixed(1)} 分`}
    >
      {/* 卡片头部 */}
      <button
        onClick={onToggleExpand}
        className="w-full text-left p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-inset"
        aria-expanded={isExpanded}
        aria-controls={`candidate-detail-${rank}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* 排名 + 综合分 */}
            <div className="flex items-center gap-3 mb-3">
              <span
                className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${
                  rank === 1 ? 'bg-gradient-to-br from-warning-400 to-warning-500' :
                  rank === 2 ? 'bg-gradient-to-br from-neutral-300 to-neutral-400' :
                  rank === 3 ? 'bg-gradient-to-br from-warning-600 to-warning-700' :
                  'bg-neutral-400 dark:bg-neutral-600'
                }`}
                aria-label={`排名第 ${rank}`}
              >
                {rank}
              </span>
              <div className={`text-2xl font-bold tabular-nums ${scoreColor}`}>
                {(candidate.overall_score * 100).toFixed(1)}
                <span className="text-sm font-normal text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-1">分</span>
              </div>
              <Badge variant="neutral" size="sm">
                置信度 {(candidate.confidence * 100).toFixed(0)}%
              </Badge>
            </div>

            {/* 药材组成 */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {candidate.ingredients.map((ing) => (
                <span
                  key={ing.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-md text-xs text-neutral-700 dark:text-neutral-300"
                >
                  {ing.name_cn}
                  <span className="text-neutral-400 dark:text-neutral-400">{ing.dosage}g</span>
                </span>
              ))}
            </div>
          </div>

          {/* 四维评分柱状图 */}
          <div className="hidden sm:flex items-end gap-1.5 h-16 flex-shrink-0" aria-label="四维评分可视化">
            {scoreLabels.map(({ label, value, color }) => (
              <div key={label} className="flex flex-col items-center gap-1" title={`${label}: ${(value * 100).toFixed(0)}%`}>
                <div
                  className={`w-3 rounded-t-sm ${color.replace('text-', 'bg-')} opacity-80`}
                  style={{ height: `${Math.max(value * 48, 4)}px` }}
                />
                <span className="text-xs text-neutral-400 dark:text-neutral-400 whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>

          {/* 展开/收起图标 */}
          <div className="flex-shrink-0 self-center text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" aria-hidden="true">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </button>

      {/* 展开详情区域 */}
      {isExpanded && (
        <div
          id={`candidate-detail-${rank}`}
          className="px-5 pb-5 border-t border-neutral-100 dark:border-neutral-800 pt-4 animate-in slide-in-from-top-2 duration-200"
        >
          {/* 四维评分详情 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {scoreLabels.map(({ label, value, icon, color }) => (
              <div key={label} className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg px-3 py-2">
                <span className={color}>{icon}</span>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-400">{label}评分</p>
                  <p className={`text-sm font-semibold tabular-nums ${color}`}>{(value * 100).toFixed(1)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 详细说明 */}
          {candidate.explanation && (
            <div className="bg-accent-50 dark:bg-accent-300/15 rounded-lg p-4 border border-accent-100 dark:border-accent-900/20">
              <h5 className="text-xs font-semibold text-accent-600 dark:text-accent-700 mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" aria-hidden="true" />
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

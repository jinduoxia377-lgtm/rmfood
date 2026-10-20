/**
 * TimelineBlock — 服用周期时间线
 *
 * 展示多阶段服药方案的时间轴
 * 每个阶段包含：天数、阶段名、说明、剂量、注意事项
 */
import React, { useState } from 'react'
import { Clock, Calendar, Pill, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { TimelineData, TimelinePhase } from '../types'

interface TimelineBlockProps {
  data: TimelineData
}

const PHASE_COLORS: Record<TimelinePhase, {
  bg: string
  border: string
  text: string
  dot: string
}> = {
  '初期': {
    bg: 'bg-secondary-50 dark:bg-secondary-300/20',
    border: 'border-secondary-200 dark:border-secondary-800',
    text: 'text-secondary-700 dark:text-secondary-700',
    dot: 'bg-secondary-500',
  },
  '中期': {
    bg: 'bg-primary-50 dark:bg-success-300/20',
    border: 'border-success-200 dark:border-success-800',
    text: 'text-success-700 dark:text-success-700',
    dot: 'bg-success-500',
  },
  '后期': {
    bg: 'bg-warning-50 dark:bg-warning-300/20',
    border: 'border-warning-200 dark:border-warning-800',
    text: 'text-warning-700 dark:text-warning-700',
    dot: 'bg-warning-500',
  },
  '巩固': {
    bg: 'bg-accent-50 dark:bg-accent-300/20',
    border: 'border-accent-200 dark:border-accent-800',
    text: 'text-accent-700 dark:text-accent-700',
    dot: 'bg-accent-500',
  },
}

function TimelineBlock({ data }: TimelineBlockProps) {
  const { title, duration_days, phases = [], items = [] } = data
  const [expandedDay, setExpandedDay] = useState<number | null>(null)

  // 按天数排序
  const sortedItems = [...items].sort((a, b) => a.day - b.day)

  if (items.length === 0) {
    return (
      <div className="mb-3 last:mb-0 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 text-center">
        <Calendar className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-400 mb-2" />
        <p className="text-xs text-neutral-400 dark:text-neutral-400">暂无疗程数据</p>
      </div>
    )
  }

  return (
    <div className="mb-3 last:mb-0 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary-50/50 to-transparent dark:from-primary-900/10 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary-500" />
          <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            {title || '服用周期'}
          </span>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-300/25 text-primary-700 dark:text-primary-700 font-medium">
          {duration_days} 天
        </span>
      </div>

      {/* 阶段概览 */}
      {phases.length > 0 && (
        <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex flex-wrap gap-2">
            {phases.map((phase) => {
              const colors = PHASE_COLORS[phase.key as TimelinePhase] || PHASE_COLORS['初期']
              return (
                <div
                  key={phase.key}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors.bg} ${colors.border} ${colors.text}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                  {phase.label}
                  <span className="opacity-75">({phase.days.length}天)</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 时间线 */}
      <div className="p-4">
        <div className="relative">
          {/* 垂直线 */}
          <div className="absolute left-3.5 top-0 bottom-0 w-0.5 bg-neutral-200 dark:bg-neutral-700" />

          <div className="space-y-2">
            {sortedItems.map((item) => {
              const phaseColors = PHASE_COLORS[item.phase] || PHASE_COLORS['初期']
              const isExpanded = expandedDay === item.day
              return (
                <div key={item.day} className="relative pl-8">
                  {/* 时间点 */}
                  <div
                    className={`absolute left-1.5 top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-neutral-900 ${phaseColors.dot} shadow-sm`}
                  >
                    {item.day === duration_days && (
                      <CheckCircle2 className="w-3 h-3 text-white absolute inset-0 m-auto" />
                    )}
                  </div>

                  {/* 日期标签 */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${phaseColors.bg} ${phaseColors.text}`}>
                      第 {item.day} 天
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border ${phaseColors.bg} ${phaseColors.border} ${phaseColors.text}`}>
                      {item.phase}
                    </span>
                  </div>

                  {/* 标题 */}
                  <button
                    onClick={() => setExpandedDay(isExpanded ? null : item.day)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <Pill className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        {item.title}
                      </span>
                    </div>
                  </button>

                  {/* 展开详情 */}
                  {isExpanded && (
                    <div className="mt-1 ml-1 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-100 dark:border-neutral-700 space-y-2">
                      {item.description && (
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                      {item.dosage && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Pill className="w-3 h-3 text-primary-500" />
                          <span className="text-neutral-600 dark:text-neutral-400">剂量：</span>
                          <span className="font-medium text-neutral-800 dark:text-neutral-200">{item.dosage}</span>
                        </div>
                      )}
                      {item.notes && (
                        <div className="flex items-start gap-1.5 text-xs">
                          <AlertCircle className="w-3 h-3 text-warning-500 flex-shrink-0 mt-0.5" />
                          <span className="text-warning-600 dark:text-warning-700">{item.notes}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 结束标记 */}
        <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-success-500" />
            <span>疗程结束 · 建议复查指标</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TimelineBlock

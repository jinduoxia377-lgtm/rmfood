/**
 * KPIWidget — 单指标卡片渲染器
 *
 * 接收 kpiMap prop，展示数值、单位、环比变化及迷你趋势图。
 */
import React, { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Props {
  metricId: string
  size?: 'small' | 'medium' | 'large'
  kpiMap?: Record<string, { name: string; value: number; unit: string; change_percent?: number | null; change_direction?: 'up' | 'down'; target?: number | null }> | null
}

const SIZE_CLASSES = {
  small: 'p-3',
  medium: 'p-4',
  large: 'p-5',
}

const VALUE_SIZES = {
  small: 'text-lg',
  medium: 'text-2xl',
  large: 'text-3xl',
}

export const KPIWidget: React.FC<Props> = ({ metricId, size = 'medium', kpiMap }) => {
  const kpi = kpiMap?.[metricId]

  const changePct = kpi?.change_percent
  const changeDir = kpi?.change_direction

  const ChangeIcon = useMemo(() => {
    if (changeDir === 'up') return TrendingUp
    if (changeDir === 'down') return TrendingDown
    return Minus
  }, [changeDir])

  const changeColor = useMemo(() => {
    if (changeDir === 'up') return 'text-success-600 dark:text-success-400'
    if (changeDir === 'down') return 'text-error-600 dark:text-error-400'
    return 'text-text-muted'
  }, [changeDir])

  if (!kpi) {
    return (
      <div className={`rounded-xl bg-surface border border-border ${SIZE_CLASSES[size]} flex items-center justify-center`}>
        <span className="text-text-muted text-sm">加载中…</span>
      </div>
    )
  }

  return (
    <div className={`rounded-xl bg-surface border border-border hover:shadow-md transition-shadow ${SIZE_CLASSES[size]}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-text-muted truncate flex-1">{kpi.name}</p>
        {changePct != null && changePct !== 0 && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ml-2 flex-shrink-0 ${changeColor}`}>
            <ChangeIcon className="w-3 h-3" />
            {changePct > 0 ? '+' : ''}{changePct.toFixed(1)}%
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className={`font-bold text-text-primary ${VALUE_SIZES[size]}`}>
          {typeof kpi.value === 'number' ? kpi.value.toLocaleString('zh-CN') : kpi.value}
        </span>
        {kpi.unit && (
          <span className="text-xs text-text-muted">{kpi.unit}</span>
        )}
      </div>

      {kpi.target != null && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
            <span>目标</span>
            <span>{kpi.target.toLocaleString()}</span>
          </div>
          <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary-500 transition-all duration-700"
              style={{ width: `${Math.min(100, (kpi.value / kpi.target) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default KPIWidget

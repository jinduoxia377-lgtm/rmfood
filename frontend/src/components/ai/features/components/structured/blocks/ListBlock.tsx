/**
 * ListBlock — 分析列表区块
 *
 * 四种变体：
 * - bullet: 圆点列表（通用）
 * - number: 编号列表（步骤/排序）
 * - analysis: 带状态图标的分析列表（🟢🟡🔴）
 * - checklist: 勾选清单
 *
 * 每种变体有独立的视觉风格
 */
import React from 'react'
import { CheckCircle2, Circle, ChevronRight, HelpCircle } from 'lucide-react'
import type { ListData } from '../types'

interface ListBlockProps {
  data: ListData
}

const STATUS_ICONS = {
  positive: CheckCircle2,
  negative: HelpCircle,
  neutral: Circle,
  info: ChevronRight,
} as const

const STATUS_COLORS = {
  positive: 'text-primary-500 dark:text-primary-400',
  negative: 'text-error-500 dark:text-error-400',
  neutral: 'text-neutral-400 dark:text-neutral-500',
  info: 'text-secondary-500 dark:text-secondary-400',
} as const

const BULLET_COLORS = [
  'text-primary-500',
  'text-secondary-500',
  'text-primary-500',
  'text-warning-500',
  'text-accent-500',
]

function ListBlock({ data }: ListBlockProps) {
  const { title, variant = 'bullet', items = [] } = data

  if (items.length === 0) {
    return (
      <div className="py-3 text-center text-xs text-neutral-300 dark:text-neutral-600">
        暂无列表数据
      </div>
    )
  }

  return (
    <div className="mb-3 last:mb-0">
      {/* 标题 */}
      {title && (
        <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
          {title}
        </div>
      )}

      {/* 列表内容 */}
      <div className="space-y-1.5">
        {items.map((item, i) => {
          // — bullet 变体 —
          if (variant === 'bullet') {
            const color = BULLET_COLORS[i % BULLET_COLORS.length]
            return (
              <div key={i} className="flex items-start gap-2">
                <span className={`flex-shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${color} bg-current`} />
                <div className="min-w-0 flex-1">
                  <span className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    {item.label}
                  </span>
                  {item.description && (
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
                {item.value && (
                  <span className="flex-shrink-0 text-[10px] font-mono text-neutral-400 dark:text-neutral-500">
                    {item.value}
                  </span>
                )}
              </div>
            )
          }

          // — number 变体 —
          if (variant === 'number') {
            return (
              <div key={i} className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-md bg-neutral-100 dark:bg-neutral-800
                  flex items-center justify-center text-[10px] font-bold text-neutral-500 dark:text-neutral-400">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <span className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    {item.label}
                  </span>
                  {item.description && (
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            )
          }

          // — analysis 变体 —
          if (variant === 'analysis') {
            const status = item.status || 'neutral'
            const StatusIcon = STATUS_ICONS[status] || Circle
            const statusColor = STATUS_COLORS[status] || STATUS_COLORS.neutral
            return (
              <div key={i} className="flex items-start gap-2 px-2.5 py-2 rounded-lg
                bg-slate-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-700/50">
                <StatusIcon className={`flex-shrink-0 w-3.5 h-3.5 mt-0.5 ${statusColor}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                      {item.label}
                    </span>
                    {item.value && (
                      <span className="flex-shrink-0 text-[10px] font-mono text-neutral-400 dark:text-neutral-500">
                        {item.value}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            )
          }

          // — checklist 变体 —
          if (variant === 'checklist') {
            const isPositive = item.status === 'positive'
            return (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className={`flex-shrink-0 w-3.5 h-3.5 mt-0.5 ${
                  isPositive
                    ? 'text-primary-500 dark:text-primary-400'
                    : 'text-neutral-300 dark:text-neutral-600'
                }`} />
                <span className={`text-xs leading-relaxed ${
                  isPositive
                    ? 'text-neutral-700 dark:text-neutral-300'
                    : 'text-neutral-400 dark:text-neutral-500 line-through'
                }`}>
                  {item.label}
                </span>
              </div>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}

export default ListBlock

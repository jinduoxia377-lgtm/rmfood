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
  positive: 'text-emerald-500 dark:text-emerald-400',
  negative: 'text-red-500 dark:text-red-400',
  neutral: 'text-gray-400 dark:text-gray-500',
  info: 'text-blue-500 dark:text-blue-400',
} as const

const BULLET_COLORS = [
  'text-primary-500',
  'text-blue-500',
  'text-emerald-500',
  'text-amber-500',
  'text-purple-500',
]

function ListBlock({ data }: ListBlockProps) {
  const { title, variant = 'bullet', items = [] } = data

  if (items.length === 0) {
    return (
      <div className="py-3 text-center text-xs text-gray-300 dark:text-gray-600">
        暂无列表数据
      </div>
    )
  }

  return (
    <div className="mb-3 last:mb-0">
      {/* 标题 */}
      {title && (
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
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
                  <span className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                    {item.label}
                  </span>
                  {item.description && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
                {item.value && (
                  <span className="flex-shrink-0 text-[10px] font-mono text-gray-400 dark:text-gray-500">
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
                <span className="flex-shrink-0 w-5 h-5 rounded-md bg-gray-100 dark:bg-gray-800
                  flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-gray-400">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <span className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                    {item.label}
                  </span>
                  {item.description && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">
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
                bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/50">
                <StatusIcon className={`flex-shrink-0 w-3.5 h-3.5 mt-0.5 ${statusColor}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                      {item.label}
                    </span>
                    {item.value && (
                      <span className="flex-shrink-0 text-[10px] font-mono text-gray-400 dark:text-gray-500">
                        {item.value}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">
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
                    ? 'text-emerald-500 dark:text-emerald-400'
                    : 'text-gray-300 dark:text-gray-600'
                }`} />
                <span className={`text-xs leading-relaxed ${
                  isPositive
                    ? 'text-gray-700 dark:text-gray-300'
                    : 'text-gray-400 dark:text-gray-500 line-through'
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

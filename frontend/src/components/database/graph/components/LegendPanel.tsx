import { GraphNode, TYPE_CONFIG } from '../types'
import type { LegendItem, TypeCounts } from './types'

export interface LegendPanelProps {
  showLegend: boolean
  legendOpen: boolean
  legendItems: LegendItem[]
  typeCounts: TypeCounts
  nodeCount: number
  edgeCount: number
  onToggle: () => void
}

export default function LegendPanel({
  showLegend,
  legendOpen,
  legendItems,
  typeCounts,
  nodeCount,
  edgeCount,
  onToggle,
}: LegendPanelProps) {
  if (!showLegend || legendItems.length === 0) return null

  return (
    <div className="absolute bottom-3 left-3 z-30">
      {/* 图例触发器（始终可见的小标签条） */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/93 dark:bg-neutral-800/93 backdrop-blur-md border border-neutral-200/60 dark:border-neutral-700/60 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group"
      >
        <div className="flex -space-x-1">
          {legendItems.slice(0, 4).map(({ type, color }) => (
            <div key={type} className="w-2.5 h-2.5 rounded-full ring-1.5 ring-white dark:ring-slate-800" style={{ backgroundColor: color }} />
          ))}
          {legendItems.length > 4 && (
            <div className="w-2.5 h-2.5 rounded-full bg-neutral-300 dark:bg-neutral-600 ring-1.5 ring-white dark:ring-slate-800" />
          )}
        </div>
        <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors">
          图例 {legendOpen ? '▼' : '▶'}
        </span>
      </button>

      {/* 展开的详细图例面板 */}
      {legendOpen && (
        <div className="mt-2 p-3 rounded-xl bg-white/96 dark:bg-neutral-800/96 backdrop-blur-xl border border-neutral-200/60 dark:border-neutral-700/60 shadow-lg animate-in fade-in zoom-in-95 duration-200"
             style={{ minWidth: '200px', maxWidth: '280px' }}>
          <div className="col-span-full text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-bold mb-0.5">
            节点类型分布
          </div>
          {legendItems.map(({ type, color, label, icon }) => (
            <div key={type} className="flex items-center justify-between gap-3 group/item cursor-default rounded-lg px-2 py-1.5 -mx-2 hover:bg-slate-50 dark:hover:bg-neutral-700/40 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-3.5 h-3.5 rounded-full shadow-sm transition-transform duration-200 group-hover/item:scale-125"
                  style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}50` }}
                />
                <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">{icon} {label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* 进度条表示占比 */}
                <div className="w-16 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      backgroundColor: color,
                      width: `${Math.round((typeCounts[type] || 0) / Math.max(nodeCount, 1) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono font-bold tabular-nums min-w-[22px] text-right" style={{ color }}>
                  {typeCounts[type] || 0}
                </span>
              </div>
            </div>
          ))}

          {/* 统计汇总行 */}
          <div className="col-span-full pt-2 mt-1 border-t border-neutral-200/50 dark:border-neutral-600/40 flex justify-between text-[10px] text-neutral-500 dark:text-neutral-400">
            <span>总计 <strong className="text-neutral-700 dark:text-neutral-300">{nodeCount}</strong> 节点</span>
            <span><strong className="text-neutral-700 dark:text-neutral-300">{edgeCount}</strong> 条边</span>
          </div>
        </div>
      )}
    </div>
  )
}

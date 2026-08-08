import { GraphNode, TYPE_CONFIG } from '../types'
import type { PERF_THRESHOLD } from '../types'

/** Sorting option for centrality panel */
export type SortByOption = 'degree' | 'label' | 'type'

export interface CentralityStats {
  totalNodes: number
  totalEdges: number
  density: string
  avgDegree: string
  maxDegree: number
  connectedComponents: number
  diameter: number
  largestComponentSize: number
  typeDistribution: [string, number][]
}

export interface CentralityPanelData {
  stats: CentralityStats
  sortedNodes: Array<{ node: GraphNode; degree: number }>
}

export interface CentralityPanelProps {
  showCentralityPanel: boolean
  centralityData: CentralityPanelData | null
  sortBy: SortByOption
  onSetSortBy: (sort: SortByOption) => void
  onNodeClick?: (node: GraphNode) => void
  onClose: () => void
}

const RANK_BADGES = [
  'bg-yellow-100 text-yellow-700',
  'bg-neutral-200 text-neutral-600',
  'bg-orange-100 text-orange-700',
  'bg-slate-50 text-neutral-400',
]

export default function CentralityPanel({
  showCentralityPanel,
  centralityData,
  sortBy,
  onSetSortBy,
  onNodeClick,
  onClose,
}: CentralityPanelProps) {
  if (!showCentralityPanel || !centralityData?.stats) return null

  const { stats, sortedNodes } = centralityData
  const maxDegree = stats.maxDegree || 1

  return (
    <div className="absolute top-14 right-3 z-40 w-72 rounded-xl bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-700/60 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[70vh] overflow-y-auto">
      <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur">
        <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          中心性分析
        </span>
        <div className="flex items-center gap-1">
          <select value={sortBy} onChange={(e) => onSetSortBy(e.target.value as SortByOption)}
            className="text-[8px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded px-1 py-0.5">
            <option value="degree">按度数</option>
            <option value="label">按名称</option>
            <option value="type">按类型</option>
          </select>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 p-0.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* 图统计概览 */}
      <div className="p-2.5 space-y-2">
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: '节点', value: stats.totalNodes, color: 'text-secondary-500' },
            { label: '边', value: stats.totalEdges, color: 'text-primary-500' },
            { label: '密度', value: stats.density, color: 'text-accent-500' },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 dark:bg-neutral-800/50 rounded-lg p-1.5 text-center">
              <div className={`text-[11px] font-bold tabular-nums ${s.color}`}>{s.value}</div>
              <div className="text-[7px] text-neutral-400">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-1">
          {[
            { label: '平均度', value: stats.avgDegree },
            { label: '最大度', value: stats.maxDegree },
            { label: '连通分量', value: stats.connectedComponents },
            { label: '直径', value: stats.diameter },
          ].map(s => (
            <div key={s.label} className="text-center py-1">
              <div className="text-[10px] font-mono font-semibold text-neutral-700 dark:text-neutral-300">{s.value}</div>
              <div className="text-[7px] text-neutral-400 leading-tight">{s.label}</div>
            </div>
          ))}
        </div>

        {/* 类型分布 */}
        <div className="border-t border-neutral-100 dark:border-neutral-700/30 pt-2">
          <div className="text-[8px] font-semibold text-neutral-500 uppercase mb-1.5">类型分布</div>
          <div className="space-y-1">
            {stats.typeDistribution.slice(0, 6).map(([type, count]) => {
              const conf = TYPE_CONFIG[type]
              const pct = ((count / stats.totalNodes) * 100).toFixed(0)
              return (
                <div key={type} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: conf?.color || '#9CA3AF' }} />
                  <span className="text-[9px] text-neutral-600 dark:text-neutral-400 truncate flex-1">{conf?.label || type}</span>
                  <span className="text-[9px] font-mono text-neutral-500">{count}</span>
                  <div className="w-10 h-1.5 bg-neutral-100 dark:bg-neutral-700/40 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: conf?.color || '#9CA3AF' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top 10 节点排行 */}
        <div className="border-t border-neutral-100 dark:border-neutral-700/30 pt-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[8px] font-semibold text-neutral-500 uppercase">Top 10 关键节点</span>
            <span className="text-[7px] text-neutral-400">点击查看详情</span>
          </div>
          <div className="space-y-0.5">
            {sortedNodes.slice(0, 10).map((item, idx) => {
              const conf = TYPE_CONFIG[item.node.type]
              const pct = item.degree > 0 ? Math.min(100, (item.degree / maxDegree) * 100) : 0
              return (
                <button key={`${item.node.id}_${idx}`}
                  onClick={() => onNodeClick?.(item.node)}
                  className="w-full flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-secondary-50/70 dark:hover:bg-blue-950/20 transition-colors group text-left">
                  <span className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold shrink-0 ${RANK_BADGES[idx] || 'bg-slate-50 text-neutral-400'}`}>
                    {idx + 1}
                  </span>
                  <span className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: conf?.color || '#9CA3AF' }} />
                  <span className="text-[9px] font-medium text-neutral-700 dark:text-neutral-300 truncate flex-1 group-hover:text-secondary-600 dark:group-hover:text-secondary-400">
                    {item.node.label}
                  </span>
                  <span className="text-[9px] font-mono font-bold text-neutral-500 tabular-nums">{item.degree}</span>
                  <div className="w-8 h-1 bg-neutral-100 dark:bg-neutral-700/30 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-violet-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 连通分量警告 */}
        {stats.connectedComponents > 1 && (
          <div className="border-t border-neutral-100 dark:border-neutral-700/30 pt-2 mt-1">
            <div className="text-[8px] text-warning-600 dark:text-warning-400 px-2 py-1.5 bg-warning-50 dark:bg-warning-900/15 rounded-lg">
              ⚠ 图存在 {stats.connectedComponents} 个连通分量，最大分量含 {stats.largestComponentSize} 节点
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

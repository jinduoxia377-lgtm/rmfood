import { GraphStatistics } from './types'

export interface StatisticsDashboardProps {
  [key: string]: any;
  showStatsPanel: boolean
  graphStats: GraphStatistics | null
  onClose: () => void
}

export default function StatisticsDashboard({ showStatsPanel, graphStats, onClose }: StatisticsDashboardProps) {
  if (!showStatsPanel || !graphStats) return null

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[60] w-[520px] bg-white/98 dark:bg-neutral-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-emerald-200/60 dark:border-emerald-700/40 animate-fade-in max-h-[70vh] overflow-auto custom-scrollbar">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 border-b border-emerald-100/50 rounded-t-2xl sticky top-0">
        <div className="flex items-center gap-2">
          <span>📊</span>
          <span className="text-sm font-bold text-primary-700 dark:text-primary-300">多维统计仪表盘</span>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-full hover:bg-primary-100 dark:hover:bg-primary-800/30 flex items-center justify-center transition-colors" title="关闭">✕</button>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '节点数', value: graphStats.nodeCount, icon: '🔵' },
            { label: '边数', value: graphStats.edgeCount, icon: '🔗' },
            { label: '图密度', value: (graphStats.density * 100).toFixed(1) + '%', icon: '📈' },
            { label: '聚类系数', value: graphStats.clusteringCoeff.toFixed(3), icon: '🔄' },
          ].map((item) => (
            <div key={item.label} className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl p-2.5 text-center border border-emerald-100/50">
              <div className="text-lg">{item.icon}</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{item.label}</div>
              <div className="text-sm font-bold text-primary-700 dark:text-primary-300">{item.value}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '平均度', value: graphStats.avgDegree.toFixed(1), icon: '📊' },
            { label: '最大度', value: graphStats.maxDegree, icon: '⭐' },
            { label: '连通分量', value: graphStats.componentCount, icon: '🧩' },
            { label: '最大分量', value: graphStats.largestComponentSize, icon: '🏆' },
          ].map((item) => (
            <div key={item.label} className="bg-slate-50 dark:bg-neutral-800/50 rounded-xl p-2.5 text-center border border-neutral-100/50">
              <div className="text-lg">{item.icon}</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{item.label}</div>
              <div className="text-sm font-bold">{item.value}</div>
            </div>
          ))}
        </div>
        <div className="bg-slate-50 dark:bg-neutral-800/30 rounded-xl p-3 border border-neutral-100/50">
          <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-2">📊 节点类型分布</div>
          <div className="space-y-1.5">
            {graphStats.typeDistribution.map(t => (
              <div key={t.type} className="flex items-center gap-2">
                <span className="text-xs w-16 truncate">{t.type}</span>
                <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full" style={{ width: `${Math.min(t.percentage, 100)}%` }} />
                </div>
                <span className="text-xs font-medium w-20 text-right">{t.count} ({t.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

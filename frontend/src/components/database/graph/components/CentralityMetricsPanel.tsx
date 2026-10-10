import { GraphNode, TYPE_CONFIG } from '../types'

export interface CentralityMetricsData {
  pageRank: Record<string, number>
  betweenness: Record<string, number>
  closeness: Record<string, number>
  degree: Record<string, number>
}

export type CentralityMode = 'pageRank' | 'betweenness' | 'closeness' | 'degree'

export interface CentralityMetricsPanelProps {
  [key: string]: any;
  showCentralityPanel: boolean
  centralityMetrics: CentralityMetricsData | null
  centralityMode: CentralityMode
  filteredNodes: GraphNode[]
  onSetCentralityMode: (mode: CentralityMode) => void
  onRunCentralityAnalysis: (mode: CentralityMode) => void
  onNodeClick?: (node: GraphNode) => void
  setSelectedNode: (node: GraphNode | null) => void
  onClose: () => void
}

export default function CentralityMetricsPanel({
  showCentralityPanel,
  centralityMetrics,
  centralityMode,
  filteredNodes,
  onSetCentralityMode,
  onRunCentralityAnalysis,
  onNodeClick,
  setSelectedNode,
  onClose,
}: CentralityMetricsPanelProps) {
  if (!showCentralityPanel || !centralityMetrics) return null

  const data = centralityMetrics[centralityMode] ?? {}
  const sortedEntries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 15)
  const maxScore = Math.max(...Object.values(data))

  return (
    <div className="absolute top-14 right-3 z-[60] w-[360px] bg-white/98 dark:bg-neutral-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-error-200/60 dark:border-error-700/40 animate-fade-in max-h-[65vh] overflow-auto custom-scrollbar">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-error-50 to-warning-50 dark:from-error-950/50 dark:to-warning-950/50 border-b border-error-100/50 rounded-t-2xl sticky top-0">
        <div className="flex items-center gap-2">
          <span>🎯</span>
          <span className="text-sm font-bold text-error-700 dark:text-error-600">中心性分析</span>
        </div>
        <div className="flex items-center gap-1">
          {(['pageRank', 'betweenness', 'closeness', 'degree'] as const).map(mode => (
            <button key={mode} onClick={() => { onSetCentralityMode(mode); onRunCentralityAnalysis(mode) }}
              className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${centralityMode === mode ? 'bg-error-500 text-white' : 'hover:bg-error-100 dark:hover:bg-error-800/30 text-neutral-600 dark:text-neutral-300'}`}>
              {mode === 'pageRank' ? 'PR' : mode === 'betweenness' ? 'BC' : mode === 'closeness' ? 'CC' : 'DEG'}
            </button>
          ))}
          <button onClick={onClose} className="w-5 h-5 rounded-full hover:bg-error-100 flex items-center justify-center ml-1" title="关闭">✕</button>
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        {sortedEntries.length > 0 ? sortedEntries.map(([nodeId, score], i) => {
          const node = filteredNodes.find(n => (n.id || n.label) === nodeId)
          const barWidth = maxScore > 0 ? (score / maxScore) * 100 : 0
          return (
            <div key={nodeId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-error-50 dark:hover:bg-error-900/10 cursor-pointer transition-colors"
               role="button" tabIndex={0} onClick={() => { onNodeClick?.(node!); setSelectedNode(node ?? null) }}>
              <span className="text-xs font-mono text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] w-4">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{node?.label || nodeId}</div>
                <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{node?.type}</div>
              </div>
              <div className="w-16 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-error-400 to-warning-400 rounded-full" style={{ width: `${barWidth}%` }} />
              </div>
              <span className="text-xs font-mono font-bold text-error-600 dark:text-error-600 w-12 text-right">{(score * 100).toFixed(1)}</span>
            </div>
          )
        })
        : <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-center py-4">点击上方按钮计算中心性指标</div>}
      </div>
    </div>
  )
}

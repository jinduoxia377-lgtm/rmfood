export interface GraphCompareResult {
  similarityScore: number
  commonNodes: string[]
  nodesOnlyInA: string[]
  nodesOnlyInB: string[]
}

export interface ComparisonPanelProps {
  showCompareMode: boolean
  compareResult: GraphCompareResult | null
  filteredNodes: Array<{ id?: string; label: string }>
  onClose: () => void
}

export default function ComparisonPanel({ showCompareMode, compareResult, filteredNodes, onClose }: ComparisonPanelProps) {
  if (!showCompareMode || !compareResult) return null

  return (
    <div className="absolute bottom-16 right-3 z-45 w-[min(360px,calc(100vw-1.5rem))] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-accent-200/60 dark:border-accent-700/40 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-accent-50 to-accent-50 dark:from-accent-950/50 dark:to-accent-950/50 border-b border-accent-100/50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <span>⚖️</span>
          <span className="text-sm font-bold text-accent-700 dark:text-accent-700">图谱对比分析</span>
        </div>
        <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-accent-100 dark:hover:bg-accent-800/30 text-neutral-400">✕</button>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-accent-50/80 dark:bg-accent-950/20 p-2">
            <div className="text-lg font-bold text-accent-600 dark:text-accent-700">{compareResult.similarityScore}%</div>
            <div className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">相似度</div>
          </div>
          <div className="rounded-lg bg-primary-50/80 dark:bg-success-950/20 p-2">
            <div className="text-lg font-bold text-primary-700 dark:text-primary-700">{compareResult.commonNodes.length}</div>
            <div className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">共同节点</div>
          </div>
          <div className="rounded-lg bg-warning-50/80 dark:bg-warning-950/20 p-2">
            <div className="text-lg font-bold text-warning-600 dark:text-warning-700">{compareResult.nodesOnlyInA.length + compareResult.nodesOnlyInB.length}</div>
            <div className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">差异节点</div>
          </div>
        </div>
        {compareResult.nodesOnlyInA.length > 0 && (
          <div className="bg-secondary-50/80 dark:bg-secondary-950/20 rounded-lg p-2">
            <span className="text-xs font-semibold text-secondary-600 dark:text-secondary-700">➕ 新增节点 ({compareResult.nodesOnlyInA.length}):</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {compareResult.nodesOnlyInA.slice(0, 8).map(nid => {
                const node = filteredNodes.find(no => (no.id || no.label) === nid)
                return <span key={nid} className="px-1.5 py-0.5 rounded text-[11px] bg-white dark:bg-neutral-700 text-secondary-600 dark:text-secondary-700">{node?.label?.slice(0, 10) || nid.slice(0, 10)}</span>
              })}
              {compareResult.nodesOnlyInA.length > 8 && <span className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">+{compareResult.nodesOnlyInA.length - 8} 更多</span>}
            </div>
          </div>
        )}
        {compareResult.nodesOnlyInB.length > 0 && (
          <div className="bg-error-50/80 dark:bg-error-950/20 rounded-lg p-2">
            <span className="text-xs font-semibold text-error-600 dark:text-error-600">➖ 移除节点 ({compareResult.nodesOnlyInB.length}):</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {compareResult.nodesOnlyInB.slice(0, 8).map(nid => (
                <span key={nid} className="px-1.5 py-0.5 rounded text-[11px] bg-white dark:bg-neutral-700 text-error-500 line-through">{nid.slice(0, 10)}</span>
              ))}
              {compareResult.nodesOnlyInB.length > 8 && <span className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">+{compareResult.nodesOnlyInB.length - 8} 更多</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

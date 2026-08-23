export interface GraphCompareResult {
  similarityScore: number
  commonNodes: string[]
  nodesOnlyInA: string[]
  nodesOnlyInB: string[]
}

export interface ComparisonPanelProps {
  [key: string]: any;
  showCompareMode: boolean
  compareResult: GraphCompareResult | null
  filteredNodes: Array<{ id?: string; label: string }>
  onClose: () => void
}

export default function ComparisonPanel({ showCompareMode, compareResult, filteredNodes, onClose }: ComparisonPanelProps) {
  if (!showCompareMode || !compareResult) return null

  return (
    <div className="absolute bottom-16 right-3 z-45 w-[360px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-200/60 dark:border-indigo-700/40 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50 border-b border-indigo-100/50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <span>⚖️</span>
          <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">图谱对比分析</span>
        </div>
        <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-800/30 text-neutral-400">✕</button>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-indigo-50/80 dark:bg-indigo-950/20 p-2">
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{compareResult.similarityScore}%</div>
            <div className="text-[9px] text-neutral-400">相似度</div>
          </div>
          <div className="rounded-lg bg-primary-50/80 dark:bg-emerald-950/20 p-2">
            <div className="text-lg font-bold text-primary-600 dark:text-primary-400">{compareResult.commonNodes.length}</div>
            <div className="text-[9px] text-neutral-400">共同节点</div>
          </div>
          <div className="rounded-lg bg-warning-50/80 dark:bg-amber-950/20 p-2">
            <div className="text-lg font-bold text-warning-600 dark:text-warning-400">{compareResult.nodesOnlyInA.length + compareResult.nodesOnlyInB.length}</div>
            <div className="text-[9px] text-neutral-400">差异节点</div>
          </div>
        </div>
        {compareResult.nodesOnlyInA.length > 0 && (
          <div className="bg-secondary-50/80 dark:bg-blue-950/20 rounded-lg p-2">
            <span className="text-[10px] font-semibold text-secondary-600 dark:text-secondary-300">➕ 新增节点 ({compareResult.nodesOnlyInA.length}):</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {compareResult.nodesOnlyInA.slice(0, 8).map(nid => {
                const node = filteredNodes.find(no => (no.id || no.label) === nid)
                return <span key={nid} className="px-1.5 py-0.5 rounded text-[9px] bg-white dark:bg-neutral-700 text-secondary-600 dark:text-secondary-300">{node?.label?.slice(0, 10) || nid.slice(0, 10)}</span>
              })}
              {compareResult.nodesOnlyInA.length > 8 && <span className="text-[9px] text-neutral-400">+{compareResult.nodesOnlyInA.length - 8} 更多</span>}
            </div>
          </div>
        )}
        {compareResult.nodesOnlyInB.length > 0 && (
          <div className="bg-error-50/80 dark:bg-red-950/20 rounded-lg p-2">
            <span className="text-[10px] font-semibold text-error-600 dark:text-error-300">➖ 移除节点 ({compareResult.nodesOnlyInB.length}):</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {compareResult.nodesOnlyInB.slice(0, 8).map(nid => (
                <span key={nid} className="px-1.5 py-0.5 rounded text-[9px] bg-white dark:bg-neutral-700 text-error-500 line-through">{nid.slice(0, 10)}</span>
              ))}
              {compareResult.nodesOnlyInB.length > 8 && <span className="text-[9px] text-neutral-400">+{compareResult.nodesOnlyInB.length - 8} 更多</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

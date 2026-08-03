import { GraphNode, TYPE_CONFIG } from '../types'
import type { CommunityResult, KCoreResult, SubGraphResult } from './types'

export interface SubGraphBrowserProps {
  showSubGraphPanel: boolean
  communityResult: CommunityResult | null
  kcoreResult: KCoreResult | null
  savedSubGraphs: SubGraphResult[]
  activeSubGraph: SubGraphResult | null
  onComputeKCore: () => void
  onSetSavedSubGraphs: (subGraphs: SubGraphResult[]) => void
  onSetActiveSubGraph: (sub: SubGraphResult) => void
  onClose: () => void
}

export default function SubGraphBrowser({
  showSubGraphPanel,
  communityResult,
  kcoreResult,
  savedSubGraphs,
  activeSubGraph,
  onComputeKCore,
  onSetSavedSubGraphs,
  onSetActiveSubGraph,
  onClose,
}: SubGraphBrowserProps) {
  if (!showSubGraphPanel || !(communityResult || kcoreResult || savedSubGraphs.length > 0)) return null

  return (
    <div className="absolute bottom-16 right-3 z-[60] w-[380px] bg-white/98 dark:bg-neutral-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-purple-200/60 dark:border-purple-700/40 animate-fade-in max-h-[55vh] overflow-auto custom-scrollbar">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 border-b border-purple-100/50 rounded-t-2xl sticky top-0">
        <div className="flex items-center gap-2">
          <span>🧩</span>
          <span className="text-sm font-bold text-accent-700 dark:text-accent-300">子图浏览器</span>
          {communityResult?.communities.length ? <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-accent-100 text-accent-600">{communityResult.communities.length}社区</span> : null}
          {kcoreResult && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-pink-100 text-pink-600">k={kcoreResult.maxK}</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onComputeKCore} className="px-2 py-0.5 rounded text-[10px] font-medium hover:bg-accent-100 dark:hover:bg-accent-800/30 transition-colors text-accent-600">k-core</button>
          <button onClick={onClose} className="w-5 h-5 rounded-full hover:bg-accent-100 flex items-center justify-center" title="关闭">✕</button>
        </div>
      </div>
      <div className="p-3 space-y-2">
        {communityResult?.communities.map(comm => (
          <div key={comm.id} className="rounded-xl p-2.5 border border-neutral-100 dark:border-neutral-700/50 hover:border-purple-300 dark:hover:border-purple-600 cursor-pointer transition-colors"
            onClick={() => {
              const newSub: SubGraphResult = {
                id: crypto.randomUUID(),
                name: `社区 #${comm.id + 1}`,
                type: 'community',
                nodeIds: comm.nodes,
                edgeIds: [],
                metadata: { communityId: comm.id, modularity: communityResult.modularity },
              }
              onSetSavedSubGraphs([...savedSubGraphs.slice(-9), newSub])
              onSetActiveSubGraph(newSub)
            }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: comm.color }} />
                <span className="text-xs font-bold">社区 #{comm.id + 1}</span>
                <span className="text-[10px] text-neutral-400">({comm.nodes.length}节点)</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {comm.labels.slice(0, 8).map(l => (
                <span key={l} className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-100 dark:bg-neutral-700/50 truncate max-w-[80px]" title={l}>{l}</span>
              ))}
              {comm.labels.length > 8 && <span className="text-[10px] text-neutral-400">+{comm.labels.length - 8}</span>}
            </div>
          </div>
        ))}
        {kcoreResult?.cores.filter(c => c.k >= 2).reverse().slice(0, 5).map(core => (
          <div key={core.k} className="rounded-xl p-2.5 border border-neutral-100 dark:border-neutral-700/50 hover:border-pink-300 cursor-pointer transition-colors"
            onClick={() => {
              const newSub: SubGraphResult = {
                id: crypto.randomUUID(),
                name: `${core.k}-Core`,
                type: 'kcore',
                nodeIds: core.nodeIds,
                edgeIds: [],
                metadata: { k: core.k },
              }
              onSetSavedSubGraphs([...savedSubGraphs.slice(-9), newSub])
              onSetActiveSubGraph(newSub)
            }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-pink-600 dark:text-pink-400">{core.k}-Core</span>
              <span className="text-[10px] text-neutral-400">{core.nodeIds.length}节点 · {core.labels.slice(0, 4).join(', ')}{core.labels.length > 4 ? '...' : ''}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { GraphNode, TYPE_CONFIG } from '../types'

export interface PinnedNodesPanelProps {
  
  pinnedNodes: Set<string>
  showPinnedPanel: boolean
  filteredNodes: GraphNode[]
  onClearAllPins: () => void
  onClose: () => void
  onTogglePin: (nodeId: string) => void
  onNodeClick?: (node: GraphNode) => void
}

export default function PinnedNodesPanel({
  pinnedNodes,
  showPinnedPanel,
  filteredNodes,
  onClearAllPins,
  onClose,
  onTogglePin,
  onNodeClick,
}: PinnedNodesPanelProps) {
  if (!showPinnedPanel || pinnedNodes.size === 0) return null

  return (
    <div className="absolute top-14 left-3 z-40 w-56 rounded-xl bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-700/60 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-left-3 duration-150 max-h-[50vh] overflow-y-auto">
      <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur">
        <span className="text-[10px] font-bold text-error-500 uppercase tracking-wider flex items-center gap-1.5">
          <span>📌</span> 固定节点 ({pinnedNodes.size})
        </span>
        <div className="flex items-center gap-1">
          <button onClick={onClearAllPins} className="text-[8px] px-1.5 py-0.5 bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400 rounded hover:bg-error-200 transition-colors">
            全部释放
          </button>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 p-0.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
      <div className="p-2 space-y-1">
        {[...pinnedNodes].map(nodeId => {
          const node = filteredNodes.find(n => (n.id || n.label) === nodeId)
          if (!node) return null
          const conf = TYPE_CONFIG[node.type]
          return (
            <div key={nodeId} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800/50 group cursor-pointer"
              onClick={() => onNodeClick?.(node)}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: conf?.color || 'var(--color-knowledge-default, #9CA3AF)' }} />
              <span className="text-[10px] font-medium text-neutral-700 dark:text-neutral-300 truncate flex-1">{node.label}</span>
              <span className="text-[8px] text-neutral-400">{conf?.label || node.type}</span>
              <button onClick={(e) => { e.stopPropagation(); onTogglePin(nodeId) }}
                className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-error-500 p-0.5 transition-opacity">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

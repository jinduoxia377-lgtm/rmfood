import { GraphNode, TYPE_CONFIG } from '../types'

export interface SearchMatch {
  node: GraphNode
  score: number
  matchFields: string[]
}

export interface SearchOverlayProps {
  [key: string]: any;
  searchMatches: SearchMatch[]
  focusedNodeIndex: number
  onSelectMatch: (node: GraphNode) => void
  onFocusChange: (idx: number) => void
  totalMatches: number
}

export default function SearchOverlay({
  searchMatches,
  focusedNodeIndex,
  onSelectMatch,
  onFocusChange,
  totalMatches,
}: SearchOverlayProps) {
  if (!searchMatches || searchMatches.length === 0) return null

  return (
    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 max-h-[280px] overflow-y-auto custom-scrollbar">
      {searchMatches.map(({ node, score }, idx) => {
        const tconf = TYPE_CONFIG[node.type]
        const isFocused = idx === focusedNodeIndex
        return (
          <button
            key={node.id || node.label}
            onClick={() => onSelectMatch(node)}
            onMouseEnter={() => onFocusChange(idx)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
              isFocused ? 'bg-primary-50 dark:bg-primary-950/30' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-1.5 ring-white dark:ring-neutral-900" style={{ backgroundColor: tconf?.color || '#9CA3AF' }} />
            <span className={`flex-1 min-w-0 text-xs font-medium truncate ${isFocused ? 'text-primary-700 dark:text-primary-700' : 'text-neutral-700 dark:text-neutral-300'}`}>
              {node.label}
            </span>
            <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ backgroundColor: `${tconf?.color || '#9CA3AF'}15`, color: tconf?.color || '#6B7280' }}>
              {tconf?.label || node.type}
            </span>
            {score >= 80 && (
              <span className="text-[8px] font-bold text-warning-500 shrink-0">{score}</span>
            )}
          </button>
        )
      })}
      <div className="px-3 py-1.5 border-t border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between">
        <span className="text-[9px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">找到 {totalMatches} 个匹配</span>
        <span className="text-[8px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">↑↓ 导航 · Enter 选择</span>
      </div>
    </div>
  )
}

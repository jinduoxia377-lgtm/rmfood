import { GraphNode } from '../types'
import SearchResultsDropdown from './SearchOverlay'
import SearchHistoryPanel from './SearchHistoryPanel'

export interface SearchBarProps {
  searchQuery: string
  searchMatches: Array<{ node: GraphNode; score: number; matchFields: string[] }>
  focusedNodeIndex: number
  searchHistory: string[]
  onSearchChange: (value: string) => void
  onClearSearch: () => void
  onSelectMatch: (node: GraphNode) => void
  onFocusChange: (idx: number) => void
}

export default function SearchBar({
  searchQuery,
  searchMatches,
  focusedNodeIndex,
  searchHistory,
  onSearchChange,
  onClearSearch,
  onSelectMatch,
  onFocusChange,
}: SearchBarProps) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 w-72">
      <div className="relative">
        <div className="flex items-center gap-1 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-md rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 shadow-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary-500/30 focus-within:border-primary-400 transition-all">
          <svg className="w-3.5 h-3.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); onFocusChange(Math.min(focusedNodeIndex + 1, searchMatches.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); onFocusChange(Math.max(focusedNodeIndex - 1, 0)) }
              else if (e.key === 'Enter' && searchMatches[focusedNodeIndex]) { onSelectMatch(searchMatches[focusedNodeIndex].node) }
              else if (e.key === 'Escape') { onClearSearch(); (e.target as HTMLInputElement).blur() }
            }}
            placeholder="搜索节点..."
            className="flex-1 bg-transparent text-xs text-neutral-700 dark:text-neutral-300 placeholder-neutral-400 outline-none min-w-0"
          />
          {searchQuery && (
            <button onClick={onClearSearch} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors shrink-0">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* 搜索结果下拉 */}
        {searchQuery && searchMatches.length > 0 && (
          <SearchResultsDropdown
            searchMatches={searchMatches}
            focusedNodeIndex={focusedNodeIndex}
            onSelectMatch={onSelectMatch}
            onFocusChange={onFocusChange}
            totalMatches={searchMatches.length}
          />
        )}

        {/* 搜索历史（无输入时显示） */}
        {!searchQuery && searchHistory.length > 0 && (
          <SearchHistoryPanel
            searchHistory={searchHistory}
            onSelectTerm={(term) => onSearchChange(term)}
            onClearHistory={onClearSearch}
          />
        )}
      </div>
    </div>
  )
}

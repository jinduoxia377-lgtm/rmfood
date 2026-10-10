export interface SearchHistoryPanelProps {
  [key: string]: any;
  searchHistory: string[]
  onSelectTerm: (term: string) => void
  onClearHistory: () => void
}

export default function SearchHistoryPanel({ searchHistory, onSelectTerm, onClearHistory }: SearchHistoryPanelProps) {
  return (
    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 shadow-lg overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
      <div className="px-3 py-1.5 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between">
        <span className="text-[9px] font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">搜索历史</span>
        <button onClick={onClearHistory} className="text-[8px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-error-500 transition-colors">清空</button>
      </div>
      {searchHistory.map((term, idx) => (
        <button
          key={`${term}-${idx}`}
          onClick={() => onSelectTerm(term)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors"
        >
          <svg className="w-3 h-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="text-xs text-neutral-600 dark:text-neutral-400 truncate">{term}</span>
        </button>
      ))}
    </div>
  )
}

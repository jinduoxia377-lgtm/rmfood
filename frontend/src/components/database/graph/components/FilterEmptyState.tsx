export interface FilterEmptyStateProps {
  onClearFilter: () => void
  activeFilter?: string | null
}

export default function FilterEmptyState({ onClearFilter, activeFilter }: FilterEmptyStateProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-neutral-900/40 backdrop-blur-sm rounded-xl animate-fade-in">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
          <svg className="w-7 h-7 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">当前筛选条件下无匹配节点</p>
        <button
          onClick={onClearFilter}
          className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 text-sm hover:underline font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
          显示全部节点
        </button>
      </div>
    </div>
  )
}

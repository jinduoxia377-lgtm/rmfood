export interface SelectionBarProps {
  selectedNodesCount: number
  onClear: () => void
}

export default function SelectionBar({ selectedNodesCount, onClear }: SelectionBarProps) {
  if (selectedNodesCount === 0) return null
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-xl border border-primary-200/70 dark:border-primary-700/40 shadow-lg">
      <span className="text-xs font-semibold text-primary-700 dark:text-primary-700">
        CHECKMARK 已选择 {selectedNodesCount} 个节点
      </span>
      <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">|</span>
      <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">Ctrl+拖拽 框选 · 右键 菜单</span>
      <button onClick={onClear}
        className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-error-500 transition-colors ml-1">清除</button>
    </div>
  )
}

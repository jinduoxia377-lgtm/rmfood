export interface SelectionBarProps {
  selectedNodesCount: number
  onClear: () => void
}

export default function SelectionBar({ selectedNodesCount, onClear }: SelectionBarProps) {
  if (selectedNodesCount === 0) return null
  return (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-xl border border-primary-200/70 dark:border-primary-700/40 shadow-lg">
      <span className="text-[11px] font-semibold text-primary-600 dark:text-primary-400">
        CHECKMARK 已选择 {selectedNodesCount} 个节点
      </span>
      <span className="text-[10px] text-neutral-400">|</span>
      <span className="text-[10px] text-neutral-500">Ctrl+拖拽 框选 · 右键 菜单</span>
      <button onClick={onClear}
        className="text-[10px] text-neutral-400 hover:text-error-500 transition-colors ml-1">清除</button>
    </div>
  )
}

export interface BatchOperationBarProps {
  selectedNodesCount: number
  onFocus: () => void
  onHighlight: () => void
  onHide: () => void
  onExport: () => void
  onClear: () => void
}

export default function BatchOperationBar({ selectedNodesCount, onFocus, onHighlight, onHide, onExport, onClear }: BatchOperationBarProps) {
  if (selectedNodesCount === 0) return null
  return (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-slate-900/95 to-slate-800/95 backdrop-blur-md border border-neutral-700/50 shadow-xl animate-in fade-in zoom-in-95 duration-150">
      <span className="text-[10px] font-semibold text-white">已选 {selectedNodesCount} 项</span>
      <div className="w-px h-4 bg-neutral-600" />
      <button onClick={onFocus} className="px-2 py-1 text-[9px] bg-secondary-600 hover:bg-secondary-500 text-white rounded-md transition-colors" title="聚焦首项">
        🎯 聚焦
      </button>
      <button onClick={onHighlight} className="px-2 py-1 text-[9px] bg-warning-600 hover:bg-warning-500 text-white rounded-md transition-colors" title="高亮选中">
        ✨ 高亮
      </button>
      <button onClick={onHide} className="px-2 py-1 text-[9px] bg-neutral-600 hover:bg-neutral-500 text-white rounded-md transition-colors" title="隐藏选中">
        🚫 隐藏
      </button>
      <button onClick={onExport} className="px-2 py-1 text-[9px] bg-primary-600 hover:bg-primary-500 text-white rounded-md transition-colors" title="导出子图">
        📤 导出
      </button>
      <button onClick={onClear} className="px-2 py-1 text-[9px] bg-error-600/80 hover:bg-error-500 text-white rounded-md transition-colors" title="清除选择">
        ✕ 清除
      </button>
    </div>
  )
}

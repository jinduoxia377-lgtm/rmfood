export type ExportFormat = 'json' | 'gexf' | 'svg'

export interface ExportMenuItem {
  format: ExportFormat
  label: string
  description: string
  icon: React.ReactNode
}

export interface ExportMenuProps {
  
  showExportMenu: boolean
  selectedNodesCount: number
  onExportJson: () => void
  onExportGexf: () => void
  onExportSvg: () => void
  onClose: () => void
}

export default function ExportMenu({
  showExportMenu,
  selectedNodesCount,
  onExportJson,
  onExportGexf,
  onExportSvg,
  onClose,
}: ExportMenuProps) {
  if (!showExportMenu) return null

  return (
    <div className="absolute bottom-14 right-3 z-50 w-52 bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-xl border border-neutral-200/80 dark:border-neutral-700/60 shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
      <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">导出数据</span>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 p-0.5">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="p-1.5">
        <button onClick={onExportJson}
          className="w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-secondary-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors">
          <span className="w-5 h-5 rounded bg-secondary-100 dark:bg-secondary-900/40 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-secondary-600">{ }</span>
          </span>
          <div className="text-left">
            <div className="font-medium text-neutral-700 dark:text-neutral-300">JSON 格式</div>
            <div className="text-[8px] text-neutral-400">完整数据 + 属性 + 社群</div>
          </div>
        </button>
        <button onClick={onExportGexf}
          className="w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-accent-50 dark:hover:bg-purple-950/30 rounded-lg transition-colors">
          <span className="w-5 h-5 rounded bg-accent-100 dark:bg-accent-900/40 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-accent-600">G</span>
          </span>
          <div className="text-left">
            <div className="font-medium text-neutral-700 dark:text-neutral-300">GEXF 格式</div>
            <div className="text-[8px] text-neutral-400">Gephi / NetworkX 兼容</div>
          </div>
        </button>
        <button onClick={onExportSvg}
          className="w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-primary-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors">
          <span className="w-5 h-5 rounded bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
            <svg className="w-3 h-3 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </span>
          <div className="text-left">
            <div className="font-medium text-neutral-700 dark:text-neutral-300">SVG 图像</div>
            <div className="text-[8px] text-neutral-400">矢量图形 / 可编辑</div>
          </div>
        </button>
      </div>
      {selectedNodesCount > 0 && (
        <div className="px-3 py-1.5 bg-primary-50/50 dark:bg-primary-950/20 border-t border-neutral-100 dark:border-neutral-700/50">
          <span className="text-[9px] text-primary-600 dark:text-primary-400">将导出选中的 {selectedNodesCount} 个节点</span>
        </div>
      )}
    </div>
  )
}

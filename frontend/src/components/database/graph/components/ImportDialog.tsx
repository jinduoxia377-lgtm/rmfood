export interface ImportState {
  status: 'idle' | 'dragging' | 'parsing' | 'validating' | 'importing' | 'done' | 'error'
  fileType?: string
  progress: number
  error?: string
  previewRows?: Record<string, unknown>[]
  importedCount?: number
}

export interface ImportDialogProps {
  showImportDialog: boolean
  importState: ImportState
  dragOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onFileSelect: (file: File) => void
  onClose: () => void
}

export default function ImportDialog({
  showImportDialog,
  importState,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  onClose,
}: ImportDialogProps) {
  if (!showImportDialog) return null

  const statusText = importState.status === 'idle' ? '准备就绪' :
    importState.status === 'dragging' ? '检测到文件...' :
    importState.status === 'parsing' ? `解析中... (${importState.fileType?.toUpperCase() || ''})` :
    importState.status === 'validating' ? '验证数据格式...' :
    importState.status === 'importing' ? '导入到图谱...' :
    importState.status === 'done' ? '导入完成 ✓' :
    importState.status === 'error' ? '导入失败 ✗' : ''

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"  role="button" tabIndex={0} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-warning-50 to-warning-50 dark:from-warning-950/50 dark:to-warning-950/50 border-b border-warning-100/50">
          <div className="flex items-center gap-2"><span>📥</span><span className="text-sm font-bold text-warning-700 dark:text-warning-700">数据导入</span></div>
          <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-warning-100 dark:hover:bg-warning-800/30 text-neutral-400">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              <span>{statusText}</span>
              <span>{importState.progress}%</span>
            </div>
            <div className="h-1.5 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${
                importState.status === 'error' ? 'bg-error-500 w-full' :
                importState.status === 'done' ? 'bg-primary-500 w-full' :
                'bg-gradient-to-r from-warning-400 to-warning-400'
              }`} style={{ width: `${importState.progress}%` }} />
            </div>
          </div>
          {importState.error && (
            <div className="bg-error-50 dark:bg-error-300/20 rounded-lg px-3 py-2 text-xs text-error-600 dark:text-error-600">{importState.error}</div>
          )}
          {importState.previewRows && importState.previewRows.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">数据预览 (前{Math.min(importState.previewRows.length, 5)}行)</span>
              <div className="mt-1 max-h-[120px] overflow-auto custom-scrollbar rounded-lg border border-neutral-200 dark:border-neutral-700">
                <table className="w-full text-[9px]">
                  <thead className="bg-neutral-50 dark:bg-neutral-700/50 sticky top-0">
                    <tr>{Object.keys(importState.previewRows[0]).slice(0, 6).map(k => <th key={k} className="px-2 py-1 text-left text-neutral-500 font-medium border-b border-neutral-200 dark:border-neutral-600">{k}</th>)}</tr>
                  </thead>
                  <tbody>{importState.previewRows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/20">{Object.values(row).slice(0, 6).map((v, j) =>
                      <td key={j} className="px-2 py-1 text-neutral-600 dark:text-neutral-400 border-b border-neutral-100 dark:border-neutral-700/30 truncate max-w-[120px]">{String(v)?.slice(0, 25)}</td>,
                    )}</tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
          {importState.status === 'done' && (
            <div className="bg-primary-50 dark:bg-primary-300/20 rounded-lg px-3 py-2 text-xs text-primary-700 dark:text-primary-700 font-medium">
              ✅ 成功导入 {importState.importedCount} 条记录
            </div>
          )}
          <div className="flex gap-2">
            <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
              dragOver ? 'border-warning-400 bg-warning-50/50 dark:bg-warning-300/15' : 'border-neutral-200 dark:border-neutral-600 hover:border-warning-300'
            }`}
              onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
              <svg className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0 0V8m0 4h4m-4 0H8m12 4V4a2 2 0 00-2-2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2z" />
              </svg>
              <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">拖拽文件或点击上传</span>
              <input type="file" accept=".csv,.json,.sdf" className="hidden" onChange={e => e.target.files?.[0] && onFileSelect(e.target.files[0])} aria-hidden="true" tabIndex={-1} />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-[8px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-center">支持格式</span>
              <div className="flex gap-1">
                {['CSV', 'JSON', 'SDF'].map(fmt => (
                  <span key={fmt} className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-neutral-100 dark:bg-neutral-700 text-neutral-500">{fmt}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

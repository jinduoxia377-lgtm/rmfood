export type HistoryEntryType = 'filter' | 'search' | 'select' | 'layout' | 'theme' | 'zoom' | 'focus' | 'export' | 'annotate' | 'bookmark' | 'import' | 'share'

export interface HistoryEntryItem {
  id: string
  timestamp: Date
  type: HistoryEntryType
  description: string
  reversible: boolean
}

export interface HistoryPanelProps {
  [key: string]: any;
  showHistoryPanel: boolean
  historyEntries: HistoryEntryItem[]
  historyIndex: number
  onUndo: () => void
  onRedo: () => void
  onClose: () => void
}

export default function HistoryPanel({
  showHistoryPanel,
  historyEntries,
  historyIndex,
  onUndo,
  onRedo,
  onClose,
}: HistoryPanelProps) {
  if (!showHistoryPanel) return null

  const typeIcons: Record<string, string> = { filter: '🔍', search: '🔎', select: '👆', layout: '📐', theme: '🎨', zoom: '🔭', focus: '🎯', export: '📤', annotate: '💬', bookmark: '⭐', import: '📥', share: '🔗' }
  const typeColors: Record<string, string> = { filter: 'blue', search: 'indigo', select: 'emerald', layout: 'violet', theme: 'pink', zoom: 'cyan', focus: 'orange', export: 'slate', annotate: 'pink', bookmark: 'amber', import: 'orange', share: 'violet' }

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-45 w-[420px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-amber-200/60 dark:border-amber-700/40 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/50 border-b border-amber-100/50 rounded-t-2xl">
        <div className="flex items-center gap-2"><span>⏱️</span><span className="text-sm font-bold text-warning-700 dark:text-warning-300">操作历史</span>
          <span className="text-[10px] text-neutral-400">({historyEntries.length}条)</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onUndo} disabled={historyIndex < 0} className="w-6 h-6 rounded flex items-center justify-center hover:bg-warning-100 dark:hover:bg-warning-800/30 text-neutral-500 disabled:opacity-30 text-xs" title="撤销 (Ctrl+Z)">↩</button>
          <button onClick={onRedo} disabled={historyIndex >= historyEntries.length - 1} className="w-6 h-6 rounded flex items-center justify-center hover:bg-warning-100 dark:hover:bg-warning-800/30 text-neutral-500 disabled:opacity-30 text-xs" title="重做 (Ctrl+Y)">↪</button>
          <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-warning-100 dark:hover:bg-warning-800/30 text-neutral-400">✕</button>
        </div>
      </div>
      <div className="p-3 max-h-[35vh] overflow-y-auto custom-scrollbar space-y-1">
        {[...historyEntries].reverse().slice(0, 20).map((entry, i) => {
          const colorKey = typeColors[entry.type] || 'slate'
          return (
            <div key={entry.id} className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg hover:bg-${colorKey}-50 dark:hover:bg-${colorKey}-800/20 transition-colors ${i === historyEntries.length - 1 - historyIndex ? 'ring-1 ring-amber-300' : ''}`}>
              <span className="text-sm shrink-0">{typeIcons[entry.type] || '📌'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-neutral-700 dark:text-neutral-300 truncate">{entry.description}</p>
                <span className="text-[8px] text-neutral-400">{entry.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              {!entry.reversible && <span className="text-[8px] px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-400 shrink-0">只读</span>}
            </div>
          )
        })}
        {historyEntries.length === 0 && <p className="text-[11px] text-neutral-400 text-center py-4">暂无操作记录</p>}
      </div>
    </div>
  )
}

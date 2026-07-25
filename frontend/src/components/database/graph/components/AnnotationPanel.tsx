export interface NodeAnnotationEntry {
  id: string
  nodeId: string
  author: string
  content: string
  createdAt: Date
  mentions?: string[]
  resolved: boolean
}

export interface AnnotationPanelProps {
  showAnnotationPanel: boolean
  selectedNodeLabel: string
  nodeAnnotations: NodeAnnotationEntry[]
  newAnnotationText: string
  onSetNewAnnotationText: (text: string) => void
  onAddAnnotation: () => void
  onClose: () => void
}

export default function AnnotationPanel({
  showAnnotationPanel,
  selectedNodeLabel,
  nodeAnnotations,
  newAnnotationText,
  onSetNewAnnotationText,
  onAddAnnotation,
  onClose,
}: AnnotationPanelProps) {
  if (!showAnnotationPanel) return null

  return (
    <div className="absolute bottom-16 left-3 z-45 w-[320px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-pink-200/60 dark:border-pink-700/40 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/50 dark:to-rose-950/50 border-b border-pink-100/50 rounded-t-2xl">
        <div className="flex items-center gap-2"><span>💬</span><span className="text-sm font-bold text-pink-700 dark:text-pink-300">节点批注</span>
          <span className="text-[10px] text-neutral-400">[{selectedNodeLabel}]</span>
        </div>
        <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-pink-100 dark:hover:bg-pink-800/30 text-neutral-400">✕</button>
      </div>
      <div className="p-3 space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar">
        {nodeAnnotations.length > 0 ? nodeAnnotations.map(ann => (
          <div key={ann.id} className={`rounded-lg p-2.5 ${ann.resolved ? 'bg-slate-50/80 dark:bg-neutral-800/30 opacity-60' : 'bg-pink-50/50 dark:bg-pink-950/10'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-pink-600 dark:text-pink-300">{ann.author}</span>
              <span className="text-[8px] text-neutral-400">{ann.createdAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">{ann.content}</p>
            {ann.mentions && ann.mentions.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {ann.mentions.map(m => <span key={m} className="px-1 py-0.5 rounded text-[8px] bg-secondary-100 text-secondary-600">@{m}</span>)}
              </div>
            )}
          </div>
        )) : <p className="text-[11px] text-neutral-400 text-center py-4">暂无批注，添加第一条吧 ✨</p>}
      </div>
      <div className="px-3 pb-3 pt-1 border-t border-neutral-100 dark:border-neutral-700/30">
        <div className="flex gap-1.5">
          <input
            value={newAnnotationText}
            onChange={e => onSetNewAnnotationText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onAddAnnotation()}
            placeholder="@提及某人 添加批注..."
            className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-600 text-[11px] bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-pink-300"
          />
          <button onClick={onAddAnnotation} disabled={!newAnnotationText.trim()} className="px-2.5 py-1.5 rounded-lg bg-pink-500 text-white text-[11px] font-medium hover:bg-pink-600 disabled:opacity-40 transition-colors">发送</button>
        </div>
      </div>
    </div>
  )
}

import { GraphBookmark } from './types'

export interface BookmarkPanelProps {
  showBookmarkPanel: boolean
  bookmarks: GraphBookmark[]
  maxBookmarks?: number
  onSaveCurrentView: () => void
  onLoadBookmark: (bm: GraphBookmark) => void
  onRemoveBookmark: (id: string) => void
  onClose: () => void
}

export default function BookmarkPanel({
  showBookmarkPanel,
  bookmarks,
  maxBookmarks = 10,
  onSaveCurrentView,
  onLoadBookmark,
  onRemoveBookmark,
  onClose,
}: BookmarkPanelProps) {
  if (!showBookmarkPanel) return null

  return (
    <div className="absolute top-14 right-3 z-45 w-[320px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-amber-200/60 dark:border-amber-700/40 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 border-b border-amber-100/50 rounded-t-2xl">
        <div className="flex items-center gap-2"><span>⭐</span><span className="text-sm font-bold text-warning-700 dark:text-warning-300">书签收藏</span>
          <span className="text-[10px] text-neutral-400">({bookmarks.length}/{maxBookmarks})</span>
        </div>
        <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-warning-100 dark:hover:bg-warning-800/30 text-neutral-400">✕</button>
      </div>
      <div className="p-3 space-y-1.5 max-h-[40vh] overflow-y-auto custom-scrollbar">
        <button onClick={onSaveCurrentView}
          className="w-full px-3 py-2 rounded-lg border-2 border-dashed border-amber-200 dark:border-amber-700 text-[11px] text-warning-500 hover:bg-warning-50 dark:hover:bg-warning-900/10 transition-colors">+ 保存当前视图为书签</button>
        {bookmarks.map(bm => (
          <div key={bm.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-warning-50/50 dark:hover:bg-warning-900/10 group cursor-pointer" onClick={() => onLoadBookmark(bm)}>
            <span className="text-base shrink-0">{bm.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 truncate">{bm.name}</p>
              <p className="text-[8px] text-neutral-400">{bm.createdAt.toLocaleDateString('zh-CN')}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onRemoveBookmark(bm.id); }} className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-error-100 text-neutral-400 text-xs transition-all">✕</button>
          </div>
        ))}
        {bookmarks.length === 0 && <p className="text-[11px] text-neutral-400 text-center py-4">暂无书签，点击上方按钮保存</p>}
      </div>
    </div>
  )
}

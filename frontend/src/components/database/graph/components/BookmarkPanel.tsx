import { useState } from 'react'
import { GraphBookmark } from './types'

export interface BookmarkPanelProps {
  showBookmarkPanel: boolean
  bookmarks: GraphBookmark[]
  maxBookmarks?: number
  /** 保存当前视图为书签。名称由组件内输入框提供（原为无参回调，无法命名） */
  onSaveCurrentView: (name: string) => void
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
  // 名称输入
  const [name, setName] = useState('')
  if (!showBookmarkPanel) return null

  const atLimit = bookmarks.length >= maxBookmarks

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed || atLimit) return
    onSaveCurrentView(trimmed)
    setName('')
  }

  return (
    <div className="absolute top-14 right-3 z-45 w-[min(320px,calc(100vw-1.5rem))] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-warning-200/60 dark:border-warning-700/40 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-warning-50 to-warning-50 dark:from-warning-950/50 dark:to-warning-950/50 border-b border-warning-100/50 rounded-t-2xl">
        <div className="flex items-center gap-2"><span>⭐</span><span className="text-sm font-bold text-warning-700 dark:text-warning-700">书签收藏</span>
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">({bookmarks.length}/{maxBookmarks})</span>
        </div>
        <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-warning-100 dark:hover:bg-warning-800/30 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-xs transition-all">✕</button>
      </div>
      <div className="p-3 space-y-1.5 max-h-[52vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-1.5 mb-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="视图名称…"
            disabled={atLimit}
            aria-label="书签名称"
            maxLength={24}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-warning-200 dark:border-warning-700/60 text-xs bg-white/80 dark:bg-neutral-800/80 focus:outline-none focus:ring-1 focus:ring-warning-400 disabled:opacity-40"
          />
          <button
            onClick={handleSave}
            disabled={atLimit || !name.trim()}
            className="px-2.5 py-1.5 rounded-lg bg-warning-500 text-white text-xs font-medium hover:bg-warning-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={atLimit ? `已达上限 ${maxBookmarks} 个` : '保存当前视图'}
          >
            保存
          </button>
        </div>
        {atLimit && (
          <p className="text-[10px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-center">
            已达上限，删除旧书签后可继续保存
          </p>
        )}
        {bookmarks.map(bm => (
          <div key={bm.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-warning-50/50 dark:hover:bg-warning-900/10 group cursor-pointer"  role="button" tabIndex={0} onClick={() => onLoadBookmark(bm)}>
            <span className="text-base shrink-0">{bm.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate">{bm.name}</p>
              <p className="text-[8px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{bm.createdAt.toLocaleDateString('zh-CN')}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onRemoveBookmark(bm.id); }} className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-error-100 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-xs transition-all" aria-label={`删除书签 ${bm.name}`}>✕</button>
          </div>
        ))}
        {bookmarks.length === 0 && <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-center py-4">暂无书签，输入名称后点击保存</p>}
      </div>
    </div>
  )
}

export interface ShareLinkData {
  url: string
  shortCode: string
  viewCount: number
}

export interface SharePanelProps {
  showSharePanel: boolean
  shareLink: ShareLinkData | null
  onCopyLink: () => void
  onClose: () => void
}

export default function SharePanel({ showSharePanel, shareLink, onCopyLink, onClose }: SharePanelProps) {
  if (!showSharePanel || !shareLink) return null

  return (
    <div className="absolute top-14 right-3 z-45 w-[min(340px,calc(100vw-1.5rem))] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-accent-200/60 dark:border-accent-700/40 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-accent-50 to-accent-50 dark:from-accent-950/50 dark:to-accent-950/50 border-b border-accent-100/50 rounded-t-2xl">
        <div className="flex items-center gap-2"><span>🔗</span><span className="text-sm font-bold text-accent-700 dark:text-accent-700">分享图谱</span></div>
        <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-accent-100 dark:hover:bg-accent-800/30 text-neutral-400">✕</button>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-2.5 break-all">
          <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">分享链接</div>
          <code className="text-xs font-mono text-accent-600 dark:text-accent-700 block">{shareLink.url}</code>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-accent-50 dark:bg-accent-950/20 p-2">
            <div className="text-lg font-bold text-accent-600">{shareLink.shortCode}</div>
            <div className="text-[9px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">短码</div>
          </div>
          <div className="rounded-lg bg-primary-50 dark:bg-success-950/20 p-2">
            <div className="text-lg font-bold text-primary-700">{shareLink.viewCount}</div>
            <div className="text-[9px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">浏览</div>
          </div>
          <div className="rounded-lg bg-secondary-50 dark:bg-secondary-950/20 p-2">
            <div className="text-xs font-bold text-secondary-600">7天</div>
            <div className="text-[9px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">有效</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCopyLink} className="flex-1 px-3 py-1.5 rounded-lg bg-accent-500 text-white text-xs font-medium hover:bg-accent-600 transition-colors">📋 复制链接</button>
          <button className="flex-1 px-3 py-1.5 rounded-lg border border-accent-200 dark:border-accent-700 text-accent-600 dark:text-accent-700 text-xs font-medium hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-colors">📱 二维码</button>
        </div>
        <div className="bg-neutral-50 dark:bg-neutral-800/30 rounded-lg p-2">
          <span className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] block mb-1">嵌入代码</span>
          <code className="text-[9px] font-mono text-neutral-500 block p-1.5 bg-white dark:bg-neutral-800 rounded">&lt;iframe src="{shareLink.url}" width="800" height="600"&gt;&lt;/iframe&gt;</code>
        </div>
      </div>
    </div>
  )
}

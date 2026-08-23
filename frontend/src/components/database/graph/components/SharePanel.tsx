export interface ShareLinkData {
  url: string
  shortCode: string
  viewCount: number
}

export interface SharePanelProps {
  [key: string]: any;
  showSharePanel: boolean
  shareLink: ShareLinkData | null
  onCopyLink: () => void
  onClose: () => void
}

export default function SharePanel({ showSharePanel, shareLink, onCopyLink, onClose }: SharePanelProps) {
  if (!showSharePanel || !shareLink) return null

  return (
    <div className="absolute top-14 right-3 z-45 w-[340px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-violet-200/60 dark:border-violet-700/40 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 border-b border-violet-100/50 rounded-t-2xl">
        <div className="flex items-center gap-2"><span>🔗</span><span className="text-sm font-bold text-violet-700 dark:text-violet-300">分享图谱</span></div>
        <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-violet-100 dark:hover:bg-violet-800/30 text-neutral-400">✕</button>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="bg-slate-50 dark:bg-neutral-800/50 rounded-lg p-2.5 break-all">
          <div className="text-[10px] text-neutral-400 mb-1">分享链接</div>
          <code className="text-[11px] font-mono text-violet-600 dark:text-violet-300 block">{shareLink.url}</code>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 p-2">
            <div className="text-lg font-bold text-violet-600">{shareLink.shortCode}</div>
            <div className="text-[9px] text-neutral-400">短码</div>
          </div>
          <div className="rounded-lg bg-primary-50 dark:bg-emerald-950/20 p-2">
            <div className="text-lg font-bold text-primary-600">{shareLink.viewCount}</div>
            <div className="text-[9px] text-neutral-400">浏览</div>
          </div>
          <div className="rounded-lg bg-secondary-50 dark:bg-blue-950/20 p-2">
            <div className="text-xs font-bold text-secondary-600">7天</div>
            <div className="text-[9px] text-neutral-400">有效</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCopyLink} className="flex-1 px-3 py-1.5 rounded-lg bg-violet-500 text-white text-xs font-medium hover:bg-violet-600 transition-colors">📋 复制链接</button>
          <button className="flex-1 px-3 py-1.5 rounded-lg border border-violet-200 dark:border-violet-700 text-violet-600 dark:text-violet-300 text-xs font-medium hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">📱 二维码</button>
        </div>
        <div className="bg-slate-50 dark:bg-neutral-800/30 rounded-lg p-2">
          <span className="text-[10px] font-semibold text-neutral-500 block mb-1">嵌入代码</span>
          <code className="text-[9px] font-mono text-neutral-500 block p-1.5 bg-white dark:bg-neutral-800 rounded">&lt;iframe src="{shareLink.url}" width="800" height="600"&gt;&lt;/iframe&gt;</code>
        </div>
      </div>
    </div>
  )
}

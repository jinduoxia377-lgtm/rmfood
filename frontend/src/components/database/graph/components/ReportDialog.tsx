import { ReportConfig } from './types'

export interface ReportDialogProps {
  showReportDialog: boolean
  reportConfig: ReportConfig
  reportGenerating: boolean
  onSetReportConfig: (config: Partial<ReportConfig>) => void
  onGenerateReport: () => void
  onClose: () => void
}

export default function ReportDialog({
  showReportDialog,
  reportConfig,
  reportGenerating,
  onSetReportConfig,
  onGenerateReport,
  onClose,
}: ReportDialogProps) {
  if (!showReportDialog) return null

  const contentOptions = [
    { key: 'includeScreenshot' as const, label: '📊 图谱截图' },
    { key: 'includeStatistics' as const, label: '📈 统计数据' },
    { key: 'includeAIInsights' as const, label: '🤖 AI洞察' },
    { key: 'includeCentrality' as const, label: '🎯 中心性分析' },
  ]

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"  role="button" tabIndex={0} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-full max-w-[480px] overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-accent-50 to-accent-50 dark:from-accent-950/50 dark:to-accent-950/50 border-b border-accent-100/50">
          <div className="flex items-center gap-2"><span>📄</span><span className="text-sm font-bold text-accent-700 dark:text-accent-700">生成分析报告</span></div>
          <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-accent-100 dark:hover:bg-accent-800/30 text-neutral-400">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] block mb-1">报告标题</label>
<input aria-label="报告标题" value={reportConfig.title} onChange={e => onSetReportConfig({ title: e.target.value })} className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-600 text-xs bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-accent-300" />            </div>
            <div>
              <label className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] block mb-1">作者</label>
<input aria-label="报告标题" value={reportConfig.author} onChange={e => onSetReportConfig({ author: e.target.value })} className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-600 text-xs bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-accent-300" />            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] block mb-1">导出格式</label>
            <div className="flex gap-1.5">
              {(['pdf', 'word', 'html'] as const).map(fmt => (
                <button key={fmt} onClick={() => onSetReportConfig({ format: fmt })}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium uppercase transition-colors ${reportConfig.format === fmt ? 'bg-accent-500 text-white' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-600'}`}>
                  {fmt}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] block mb-1.5">包含内容</span>
            <div className="space-y-1">
              {contentOptions.map(opt => (
                <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={reportConfig[opt.key] as boolean}
                    onChange={e => onSetReportConfig({ [opt.key]: e.target.checked })}
                    className="rounded border-neutral-300 dark:border-neutral-700 text-accent-500 focus:ring-accent-300" />
                  <span className="text-xs text-neutral-600 dark:text-neutral-400">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <button onClick={onGenerateReport} disabled={reportGenerating}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-accent-surface)] to-[var(--color-accent-surface-deep)] text-white text-sm font-bold hover:from-[var(--color-accent-surface-deep)] hover:to-[var(--color-accent-surface-deep)] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {reportGenerating ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />生成中...</> : '📄 生成并下载报告'}
          </button>
        </div>
      </div>
    </div>
  )
}

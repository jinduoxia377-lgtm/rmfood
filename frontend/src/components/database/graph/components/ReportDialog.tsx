import { ReportConfig } from './types'

export interface ReportDialogProps {
  [key: string]: any;
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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"  role="button" tabIndex={0} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-[480px] overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 border-b border-indigo-100/50">
          <div className="flex items-center gap-2"><span>📄</span><span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">生成分析报告</span></div>
          <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-800/30 text-neutral-400">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-neutral-500 block mb-1">报告标题</label>
<input aria-label="报告标题" value={reportConfig.title} onChange={e => onSetReportConfig({ title: e.target.value })} className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-600 text-[11px] bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-300" />            </div>
            <div>
              <label className="text-[10px] font-semibold text-neutral-500 block mb-1">作者</label>
<input aria-label="报告标题" value={reportConfig.author} onChange={e => onSetReportConfig({ author: e.target.value })} className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-600 text-[11px] bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-300" />            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-neutral-500 block mb-1">导出格式</label>
            <div className="flex gap-1.5">
              {(['pdf', 'word', 'html'] as const).map(fmt => (
                <button key={fmt} onClick={() => onSetReportConfig({ format: fmt })}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium uppercase transition-colors ${reportConfig.format === fmt ? 'bg-indigo-500 text-white' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-600'}`}>
                  {fmt}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-neutral-500 block mb-1.5">包含内容</span>
            <div className="space-y-1">
              {contentOptions.map(opt => (
                <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={reportConfig[opt.key] as boolean}
                    onChange={e => onSetReportConfig({ [opt.key]: e.target.checked })}
                    className="rounded border-neutral-300 text-indigo-500 focus:ring-indigo-300" />
                  <span className="text-[11px] text-neutral-600 dark:text-neutral-400">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <button onClick={onGenerateReport} disabled={reportGenerating}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-bold hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {reportGenerating ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />生成中...</> : '📄 生成并下载报告'}
          </button>
        </div>
      </div>
    </div>
  )
}

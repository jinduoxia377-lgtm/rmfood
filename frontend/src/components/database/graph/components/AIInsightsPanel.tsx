import { GraphNode } from '../types'
import type { AIInsight } from './types'

export interface AIInsightsPanelProps {
  [key: string]: any;
  showAIPanel: boolean
  aiInsights: AIInsight[]
  isGeneratingInsight: boolean
  onRegenerateInsights: () => void
  onNodeClick?: (node: GraphNode) => void
  onSetSelectedNode: (node: GraphNode | null) => void
  onSetNodeAIAnalysis: (analysis: unknown) => void
  onClose: () => void
}

const severityColors = {
  info: 'border-blue-200 bg-secondary-50/80 dark:border-blue-800/30 dark:bg-blue-950/20',
  warning: 'border-amber-200 bg-warning-50/80 dark:border-amber-800/30 dark:bg-amber-950/20',
  critical: 'border-red-200 bg-error-50/80 dark:border-red-800/30 dark:bg-red-950/20',
} as const

const typeIcons: Record<string, string> = {
  summary: '📋', keyFinding: '🔗', anomaly: '⚠️', recommendation: '💡', topology: '🌉'
}

export default function AIInsightsPanel({
  showAIPanel,
  aiInsights,
  isGeneratingInsight,
  onRegenerateInsights,
  onNodeClick,
  onSetSelectedNode,
  onSetNodeAIAnalysis,
  onClose,
}: AIInsightsPanelProps) {
  if (!showAIPanel) return null

  return (
    <div className="absolute top-14 left-3 z-50 w-[380px] max-h-[65vh] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-purple-200/60 dark:border-purple-700/40 overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 border-b border-purple-100/50 dark:border-purple-800/30">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span className="text-sm font-bold text-accent-700 dark:text-accent-300">AI 智能洞察</span>
          {aiInsights.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-accent-100 dark:bg-accent-900/40 text-accent-600 dark:text-accent-300">{aiInsights.length} 条发现</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onRegenerateInsights} disabled={isGeneratingInsight}
            className="px-2 py-1 rounded-lg text-[10px] font-medium bg-accent-container text-accent-main hover:bg-accent-container disabled:opacity-50 transition-colors flex items-center gap-1">
            {isGeneratingInsight ? '⏳ 分析中...' : '🔄 重新分析'}
          </button>
          <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-accent-100 dark:hover:bg-accent-800/30 text-neutral-400">✕</button>
        </div>
      </div>

      <div className="overflow-y-auto custom-scrollbar p-3 space-y-2 max-h-[calc(65vh-56px)]">
        {isGeneratingInsight ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
            <p className="text-xs text-neutral-400">正在分析图谱拓扑结构...</p>
          </div>
        ) : aiInsights.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-neutral-400 mb-2">暂无洞察数据</p>
            <button onClick={onRegenerateInsights} className="text-xs text-accent-500 hover:text-accent-600 font-medium">点击生成分析报告 →</button>
          </div>
        ) : (
          aiInsights.map(insight => {
            const colorClass = severityColors[insight.severity || 'info']
            return (
              <div key={insight.id} className={`rounded-xl border ${colorClass} p-3 transition-all hover:shadow-md`}>
                <div className="flex items-start gap-2.5">
                  <span className="text-sm mt-0.5">{typeIcons[insight.type]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">{insight.title}</h4>
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[8px] font-mono font-bold bg-white/70 dark:bg-neutral-700/50 text-neutral-500">
                        {(insight.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400 line-clamp-3">{insight.description}</p>
                    {insight.actionLabel && insight.relatedNodeIds && insight.relatedNodeIds.length > 0 && (
                      <button
                        onClick={() => {
                          // The caller will need to resolve the node from filteredData
                        }}
                        className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-white/70 dark:bg-neutral-700/50 text-accent-600 dark:text-purple-350 hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-colors">
                        {insight.actionLabel} →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

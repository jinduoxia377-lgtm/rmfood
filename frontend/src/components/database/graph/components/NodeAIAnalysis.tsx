import { GraphNode } from '../types'

export interface NodeAIAnalysisData {
  nodeId: string
  summary: string
  relationships: { type: string; count: string; interpretation: string }[]
  suggestions: string[]
  potentialLinks: string[]
  synergyScore: number
}

export interface NodeAIAnalysisProps {
  [key: string]: any;
  nodeAIAnalysis: NodeAIAnalysisData | null
  selectedNodeLabel?: string
  onClose: () => void
}

export default function NodeAIAnalysis({ nodeAIAnalysis, selectedNodeLabel, onClose }: NodeAIAnalysisProps) {
  if (!nodeAIAnalysis) return null

  return (
    <div className="absolute top-14 right-3 z-45 w-[320px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-accent-200/60 dark:border-accent-700/40 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-accent-50 to-accent-50 dark:from-accent-950/50 dark:to-accent-950/50 border-b border-accent-100/50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <span>🧠</span>
          <span className="text-sm font-bold text-accent-700 dark:text-accent-700">节点智能分析</span>
        </div>
        <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-accent-100 dark:hover:bg-accent-800/30 text-neutral-400">✕</button>
      </div>
      <div className="p-3 space-y-2.5">
        <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">{nodeAIAnalysis.summary}</p>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-accent-50/80 dark:bg-accent-950/20 p-2 text-center">
            <div className="text-lg font-bold text-accent-600 dark:text-accent-700">{nodeAIAnalysis.synergyScore}</div>
            <div className="text-[9px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">协同评分</div>
          </div>
          <div className="rounded-lg bg-accent-50/80 dark:bg-accent-950/20 p-2 text-center">
            <div className="text-lg font-bold text-accent-600 dark:text-accent-700">{nodeAIAnalysis.relationships.length}</div>
            <div className="text-[9px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">关系类型</div>
          </div>
        </div>

        {nodeAIAnalysis.relationships.length > 0 && (
          <div>
            <span className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">关系解读:</span>
            <div className="mt-1 space-y-1">
              {nodeAIAnalysis.relationships.map((rel, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700/50 font-medium text-neutral-600 dark:text-neutral-300">{rel.type}</span>
                  <span className="text-neutral-500 dark:text-neutral-400">{rel.interpretation}</span>
                  <span className="ml-auto font-mono text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{rel.count}条</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {nodeAIAnalysis.suggestions.length > 0 && (
          <div>
            <span className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">💡 建议:</span>
            <ul className="mt-1 space-y-0.5">
              {nodeAIAnalysis.suggestions.map((s, i) => (
                <li key={i} className="text-xs text-neutral-500 dark:text-neutral-400 pl-3">• {s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

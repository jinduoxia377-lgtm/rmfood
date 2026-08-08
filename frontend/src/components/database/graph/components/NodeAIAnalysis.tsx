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
  nodeAIAnalysis: NodeAIAnalysisData | null
  selectedNodeLabel?: string
  onClose: () => void
}

export default function NodeAIAnalysis({ nodeAIAnalysis, selectedNodeLabel, onClose }: NodeAIAnalysisProps) {
  if (!nodeAIAnalysis) return null

  return (
    <div className="absolute top-14 right-3 z-45 w-[320px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-200/60 dark:border-indigo-700/40 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50 border-b border-indigo-100/50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <span>🧠</span>
          <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">节点智能分析</span>
        </div>
        <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-800/30 text-neutral-400">✕</button>
      </div>
      <div className="p-3 space-y-2.5">
        <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">{nodeAIAnalysis.summary}</p>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-indigo-50/80 dark:bg-indigo-950/20 p-2 text-center">
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{nodeAIAnalysis.synergyScore}</div>
            <div className="text-[9px] text-neutral-400">协同评分</div>
          </div>
          <div className="rounded-lg bg-violet-50/80 dark:bg-violet-950/20 p-2 text-center">
            <div className="text-lg font-bold text-violet-600 dark:text-violet-400">{nodeAIAnalysis.relationships.length}</div>
            <div className="text-[9px] text-neutral-400">关系类型</div>
          </div>
        </div>

        {nodeAIAnalysis.relationships.length > 0 && (
          <div>
            <span className="text-[10px] font-semibold text-neutral-500">关系解读:</span>
            <div className="mt-1 space-y-1">
              {nodeAIAnalysis.relationships.map((rel, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px]">
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700/50 font-medium text-neutral-600 dark:text-neutral-300">{rel.type}</span>
                  <span className="text-neutral-500 dark:text-neutral-400">{rel.interpretation}</span>
                  <span className="ml-auto font-mono text-neutral-400">{rel.count}条</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {nodeAIAnalysis.suggestions.length > 0 && (
          <div>
            <span className="text-[10px] font-semibold text-neutral-500">💡 建议:</span>
            <ul className="mt-1 space-y-0.5">
              {nodeAIAnalysis.suggestions.map((s, i) => (
                <li key={i} className="text-[10px] text-neutral-500 dark:text-neutral-400 pl-3">• {s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

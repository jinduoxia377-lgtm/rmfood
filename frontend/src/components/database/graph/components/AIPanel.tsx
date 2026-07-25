export interface AIPanelEntry {
  id: string
  question: string
  answer: string
}

export interface AIPanelProps {
  showAIPanel: boolean
  aiQAHistory: AIPanelEntry[]
  aiQuestion: string
  aiAnswering: boolean
  onSetAiQuestion: (q: string) => void
  onSendQuestion: () => void
  onClose: () => void
}

export default function AIPanel({
  showAIPanel,
  aiQAHistory,
  aiQuestion,
  aiAnswering,
  onSetAiQuestion,
  onSendQuestion,
  onClose,
}: AIPanelProps) {
  if (!showAIPanel) return null

  const suggestions = ['哪个节点连接最多？', '药材和化合物的关系？', '有哪些协同关系？']

  return (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[60] w-[480px] bg-white/98 dark:bg-neutral-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-blue-200/60 dark:border-blue-700/40 animate-fade-in max-h-[60vh] flex flex-col custom-scrollbar">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-b border-blue-100/50 rounded-t-2xl shrink-0">
        <div className="flex items-center gap-2">
          <span>🧠</span>
          <span className="text-sm font-bold text-secondary-700 dark:text-secondary-300">AI 图谱问答</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-secondary-100 text-secondary-600">NL2Graph</span>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-full hover:bg-secondary-100 dark:hover:bg-secondary-800/30 flex items-center justify-center transition-colors" title="关闭">✕</button>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3 min-h-0">
        {aiQAHistory.length > 0 && aiQAHistory.slice().reverse().map(record => (
          <div key={record.id} className="space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="text-sm">❓</span>
              <div className="flex-1 bg-secondary-50 dark:bg-secondary-900/20 rounded-xl px-3 py-2 text-xs">{record.question}</div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm">🤖</span>
              <div className="flex-1 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-xl px-3 py-2 text-xs whitespace-pre-wrap leading-relaxed">{record.answer}</div>
            </div>
          </div>
        ))}
        {aiQAHistory.length === 0 && (
          <div className="text-center py-6 text-neutral-400 text-xs space-y-2">
            <div className="text-2xl">🧠</div>
            <div>向AI提问关于图谱的任何问题</div>
            <div className="space-y-1 text-left max-w-xs mx-auto mt-3">
              {suggestions.map(q => (
                <div key={q} className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/50 cursor-pointer hover:bg-secondary-100 dark:hover:bg-secondary-900/20 transition-colors" onClick={() => onSetAiQuestion(q)}>{q}</div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-blue-100/50 shrink-0">
        <div className="flex items-center gap-2">
          <input
            value={aiQuestion}
            onChange={(e) => onSetAiQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSendQuestion()}
            placeholder="输入问题，如：哪些节点连接最多？..."
            className="flex-1 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/50 border border-transparent"
          />
          <button
            onClick={onSendQuestion}
            disabled={aiAnswering || !aiQuestion.trim()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0">
            {aiAnswering ? '思考中...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  )
}

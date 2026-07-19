export interface DeepThinkingAnalysis {
  keywords: string[]
  intent: string
  sentiment: 'positive' | 'negative' | 'neutral'
  complexity: number
  suggestedQuestions: string[]
}

export interface DeepThinkingPanelProps {
  analysis: DeepThinkingAnalysis | null
  isVisible: boolean
  isAnalyzing: boolean
  onApplyQuestion: (question: string) => void
  onClose: () => void
}

export interface AnalysisHistoryItem {
  id: string
  timestamp: number
  analysis: DeepThinkingAnalysis
  inputText?: string
}

export type IntentType = 'definition' | 'reasoning' | 'how_to' | 'comparison' | 'recommendation' | 'summary' | 'general'

export type SentimentType = 'positive' | 'negative' | 'neutral'

export const INTENT_LABELS: Record<IntentType, string> = {
  definition: '定义',
  reasoning: '推理',
  how_to: '操作',
  comparison: '对比',
  recommendation: '推荐',
  summary: '总结',
  general: '通用',
}

export const SENTIMENT_LABELS: Record<SentimentType, { label: string; color: string; bgColor: string }> = {
  positive: { label: '积极', color: 'text-success-500', bgColor: 'bg-success-50 dark:bg-success-900/20' },
  negative: { label: '消极', color: 'text-error-500', bgColor: 'bg-error-50 dark:bg-error-900/20' },
  neutral: { label: '中性', color: 'text-neutral-500', bgColor: 'bg-slate-50 dark:bg-neutral-700/30' },
}

export const INTENT_COLORS: Record<IntentType, { color: string; bgColor: string }> = {
  definition: { color: 'text-secondary-600 dark:text-secondary-400', bgColor: 'bg-secondary-50 dark:bg-secondary-900/20' },
  reasoning: { color: 'text-accent-600 dark:text-accent-400', bgColor: 'bg-accent-50 dark:bg-accent-900/20' },
  how_to: { color: 'text-success-600 dark:text-success-400', bgColor: 'bg-success-50 dark:bg-success-900/20' },
  comparison: { color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-900/20' },
  recommendation: { color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-50 dark:bg-pink-900/20' },
  summary: { color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-50 dark:bg-cyan-900/20' },
  general: { color: 'text-neutral-600 dark:text-neutral-400', bgColor: 'bg-slate-50 dark:bg-neutral-700/30' },
}

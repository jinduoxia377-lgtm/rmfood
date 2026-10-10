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
  positive: { label: '积极', color: 'text-success-500', bgColor: 'bg-success-50 dark:bg-success-300/20' },
  negative: { label: '消极', color: 'text-error-500', bgColor: 'bg-error-50 dark:bg-error-300/20' },
  neutral: { label: '中性', color: 'text-neutral-500', bgColor: 'bg-neutral-50 dark:bg-neutral-700/30' },
}

export const INTENT_COLORS: Record<IntentType, { color: string; bgColor: string }> = {
  definition: { color: 'text-secondary-600 dark:text-secondary-700', bgColor: 'bg-secondary-50 dark:bg-secondary-300/20' },
  reasoning: { color: 'text-accent-600 dark:text-accent-700', bgColor: 'bg-accent-50 dark:bg-accent-300/20' },
  how_to: { color: 'text-success-600 dark:text-success-600', bgColor: 'bg-success-50 dark:bg-success-300/20' },
  comparison: { color: 'text-warning-600 dark:text-warning-700', bgColor: 'bg-warning-50 dark:bg-warning-300/20' },
  recommendation: { color: 'text-danger-600 dark:text-danger-700', bgColor: 'bg-danger-50 dark:bg-danger-300/20' },
  summary: { color: 'text-info-600 dark:text-info-700', bgColor: 'bg-info-50 dark:bg-info-300/20' },
  general: { color: 'text-neutral-600 dark:text-neutral-400', bgColor: 'bg-neutral-50 dark:bg-neutral-700/30' },
}

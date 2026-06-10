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
  positive: { label: '积极', color: 'text-green-500', bgColor: 'bg-green-50 dark:bg-green-900/20' },
  negative: { label: '消极', color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-900/20' },
  neutral: { label: '中性', color: 'text-gray-500', bgColor: 'bg-gray-50 dark:bg-gray-700/30' },
}

export const INTENT_COLORS: Record<IntentType, { color: string; bgColor: string }> = {
  definition: { color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
  reasoning: { color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-900/20' },
  how_to: { color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/20' },
  comparison: { color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-900/20' },
  recommendation: { color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-50 dark:bg-pink-900/20' },
  summary: { color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-50 dark:bg-cyan-900/20' },
  general: { color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-50 dark:bg-gray-700/30' },
}

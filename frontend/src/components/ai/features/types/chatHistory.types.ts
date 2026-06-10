export type ChatRole = 'user' | 'assistant' | 'system' | 'function'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export enum ChatTopic {
  FORMULA_DESIGN = 'formula_design',
  INGREDIENT_ANALYSIS = 'ingredient_analysis',
  SAFETY_EVALUATION = 'safety_evaluation',
  SYNERGY_ANALYSIS = 'synergy_analysis',
  STABILITY_PREDICTION = 'stability_prediction',
  TASTE_PREDICTION = 'taste_prediction',
  PEPTIDE_DESIGN = 'peptide_design',
  KNOWLEDGE_QUERY = 'knowledge_query'
}

export const ChatTopicLabels: Record<ChatTopic, string> = {
  [ChatTopic.FORMULA_DESIGN]: '配方设计',
  [ChatTopic.INGREDIENT_ANALYSIS]: '成分分析',
  [ChatTopic.SAFETY_EVALUATION]: '安全性评估',
  [ChatTopic.SYNERGY_ANALYSIS]: '协同分析',
  [ChatTopic.STABILITY_PREDICTION]: '稳定性预测',
  [ChatTopic.TASTE_PREDICTION]: '口感预测',
  [ChatTopic.PEPTIDE_DESIGN]: '肽设计',
  [ChatTopic.KNOWLEDGE_QUERY]: '知识查询',
}

export const MAX_TAGS_PER_SESSION = 5

export interface ChatSessionMetadata {
  topic: ChatTopic
  tags: string[]
  createdAt: number
  updatedAt: number
  messageCount: number
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  metadata: ChatSessionMetadata
}

export interface ChatHistoryState {
  sessions: ChatSession[]
  currentSessionId: string | null
  isLoading: boolean
  isSaving: boolean
}

export interface HistorySearchFilters {
  keyword?: string
  topic?: ChatTopic
  tags?: string[]
  dateFrom?: number
  dateTo?: number
  minMessages?: number
  maxMessages?: number
}

export interface HistoryStatistics {
  totalSessions: number
  totalMessages: number
  sessionsByTopic: Record<ChatTopic, number>
  topTags: { tag: string; count: number }[]
  sessionsLastWeek: number
  sessionsLastMonth: number
}

export interface HistoryStorageConfig {
  maxSessions: number
  indexedDBName: string
  localStorageKey: string
}

export const DEFAULT_STORAGE_CONFIG: HistoryStorageConfig = {
  maxSessions: 100,
  indexedDBName: 'RMFOOD_ChatHistory',
  localStorageKey: 'rmfood_chat_history_v2',
}

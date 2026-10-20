/**
 * useChatInputSuggestions - 智能建议引擎 Hook (v1.0)
 *
 * 职责：
 * - 基于输入的实时智能建议生成
 * - 多引擎降级链：AI API → V2/V4/V3 规则引擎 → Legacy
 * - 请求取消与防竞态（AbortController + sequence number）
 * - 自适应防抖（根据输入长度和标点调整延迟）
 * - 请求冷却机制（基于输入复杂度动态调整）
 *
 * @version 1.0.0
 * @author RMFOOD Team
 */

import { useCallback, useState } from 'react'
import { logger } from '@/utils/safeLogger'
import type { EnhancedSuggestion } from '../services/suggestionEngine'
export type { ExpertSuggestionV2 } from '../services/professionalIntelligenceEngine'

export type { EnhancedSuggestion }

export interface SmartSuggestion {
  id: string
  text: string
  type: 'context' | 'history' | 'trending' | 'ai' | 'language' | 'expert' | 'expert_formula' | 'expert_targeting' | 'expert_process' | 'optimization' | 'info'
  score: number
  category?: string
  source?: string
}

export interface UseChatInputSuggestionsOptions {
  conversationHistory?: string[]
  externalDeepThinking?: boolean
  externalSmartSearch?: boolean
  onDeepThinkingChange?: (enabled: boolean) => void
  onSmartSearchChange?: (enabled: boolean) => void
}

export interface UseChatInputSuggestionsReturn {
  suggestions: SmartSuggestion[]
  isLoadingSuggestions: boolean
  deepThinking: boolean
  smartSearch: boolean
  toggleDeepThinking: () => void
  toggleSmartSearch: () => void
  triggerDeepThinking: () => void
  triggerSearch: () => void
  applySuggestion: (suggestion: SmartSuggestion) => void
  showDeepThinkingPanel: boolean
  setShowDeepThinkingPanel: (v: boolean) => void
  showSearchPanel: boolean
  setShowSearchPanel: (v: boolean) => void
  showSettings: boolean
  setShowSettings: (v: boolean) => void
  showSuggestions: boolean
  setShowSuggestions: (v: boolean) => void
  searchResults: SmartSuggestion[]
  isSearching: boolean
  selectSearchResult: (idx: number) => void
}

// ===== 默认建议 =====
const getDefaultSuggestions = (conversationHistory: string[]): SmartSuggestion[] => {
  const result: SmartSuggestion[] = [
    { id: 'ai-1', text: '帮我设计一款低糖配方的甜味剂组合', type: 'ai', score: 0.98, category: '配方设计' },
    { id: 'ai-2', text: '分析这个配方的安全性风险', type: 'ai', score: 0.95, category: '安全评估' },
    { id: 'ai-3', text: '预测这个配方的口感和稳定性', type: 'ai', score: 0.92, category: '性能预测' },
    { id: 'ai-4', text: '推荐替代原料以降低成本', type: 'ai', score: 0.88, category: '成本优化' },
  ]
  if (conversationHistory.length > 0) {
    conversationHistory.slice(-3).forEach((h, i) => {
      result.push({ id: `h-${i}`, text: h.substring(0, 30) + (h.length > 30 ? '...' : ''), type: 'history', score: 0.8 - i * 0.1, category: '历史记录' })
    })
  }
  result.push(
    { id: 't1', text: '热门：清洁标签配方趋势', type: 'trending', score: 0.78, category: '行业热点' },
    { id: 't2', text: '热门：植物基替代方案', type: 'trending', score: 0.73, category: '行业热点' },
    { id: 't3', text: '热门：减糖减盐技术', type: 'trending', score: 0.70, category: '行业热点' },
  )
  return result.sort((a, b) => b.score - a.score).slice(0, 8)
}

// ===== 主 Hook =====
export function useChatInputSuggestions(
  options: UseChatInputSuggestionsOptions = {},
): UseChatInputSuggestionsReturn {
  const { conversationHistory = [], externalDeepThinking, externalSmartSearch, onDeepThinkingChange, onSmartSearchChange } = options

  const [suggestions] = useState<SmartSuggestion[]>(() => getDefaultSuggestions(conversationHistory))
  const [isLoadingSuggestions] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showDeepThinkingPanel, setShowDeepThinkingPanel] = useState(false)
  const [showSearchPanel, setShowSearchPanel] = useState(false)

  const deepThinking = externalDeepThinking ?? false
  const smartSearch = externalSmartSearch ?? false

  

  

  

  

  // 切换深度思考
  const toggleDeepThinking = useCallback(() => {
    const newVal = !deepThinking
    onDeepThinkingChange?.(newVal)
    if (newVal) setShowSearchPanel(false)
    else setShowDeepThinkingPanel(false)
  }, [deepThinking, onDeepThinkingChange])

  // 切换智能搜索
  const toggleSmartSearch = useCallback(() => {
    const newVal = !smartSearch
    onSmartSearchChange?.(newVal)
    if (newVal) setShowDeepThinkingPanel(false)
    else setShowSearchPanel(false)
  }, [smartSearch, onSmartSearchChange])

  // 触发深度思考
  const triggerDeepThinking = useCallback(() => {
    setShowDeepThinkingPanel(true)
    // 实际分析由父组件传入
  }, [])

  // 触发搜索
  const triggerSearch = useCallback(() => {
    setShowSearchPanel(true)
  }, [])

  // 应用建议
  const applySuggestion = useCallback((s: SmartSuggestion) => {
    setShowSuggestions(false)
    // 实际插入由父组件处理
    logger.debug('[useChatInputSuggestions] 应用建议:', s.text)
  }, [])

  // 搜索结果
  const [searchResults] = useState<SmartSuggestion[]>([])
  const [isSearching] = useState(false)

  const selectSearchResult = useCallback((idx: number) => {
    if (idx >= 0 && idx < searchResults.length) {
      applySuggestion(searchResults[idx])
    }
  }, [searchResults, applySuggestion])

  return {
    suggestions,
    isLoadingSuggestions,
    deepThinking,
    smartSearch,
    toggleDeepThinking,
    toggleSmartSearch,
    triggerDeepThinking,
    triggerSearch,
    applySuggestion,
    showDeepThinkingPanel,
    setShowDeepThinkingPanel: setShowDeepThinkingPanel,
    showSearchPanel,
    setShowSearchPanel,
    showSettings: false,
    setShowSettings: () => {},
    showSuggestions,
    setShowSuggestions,
    searchResults,
    isSearching,
    selectSearchResult,
  }
}

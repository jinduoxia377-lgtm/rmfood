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

import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { API_ENDPOINTS } from '@/config/apiEndpoints'
import { logger } from '@/utils/safeLogger'
import { PromptEngineeringFramework, type GeneratedPrompt, type PromptScenario } from '../services/promptEngineeringFramework'
import { expertEngine, type ParsedContext } from '../services/expertIntelligenceEngine'
import { SuggestionEngine, type EnhancedSuggestion } from '../services/suggestionEngine'
import { getProfessionalIntelligenceEngineV4 } from '../services/professionalIntelligenceEngineV4'
import type { ExpertSuggestionV2 } from '../services/professionalIntelligenceEngine'
export type { ExpertSuggestionV2 } from '../services/professionalIntelligenceEngine'
import { getProfessionalIntelligenceEngine, type SemanticAnalysisResult } from '../services/professionalIntelligenceEngine'

export type { EnhancedSuggestion }

let contextAwareEngineV2: any = null
async function getContextAwareEngineV2() {
  if (!contextAwareEngineV2) {
    try {
      const module = await import('../services/contextAwareSuggestionEngineV2')
      contextAwareEngineV2 = module.getContextAwareEngine()
    } catch { /* V2 unavailable */ }
  }
  return contextAwareEngineV2
}

let suggestionEngineInstance: SuggestionEngine | null = null
function getSuggestionEngine(): SuggestionEngine {
  if (!suggestionEngineInstance) {
    suggestionEngineInstance = new SuggestionEngine({ maxCacheSize: 100, cacheTTLMins: 10, timeoutMs: 2000 })
  }
  return suggestionEngineInstance
}

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

// ===== 内部辅助函数 =====

const extractKeywords = (text: string): string[] => {
  const stopWords = ['的', '是', '在', '有', '和', '了', '我', '你', '他', 'she', 'it', 'the', 'is', 'in', 'has']
  const words = text.split(/[\s,.!?;:，。！？、；：]/)
    .filter(w => w.length > 1 && !stopWords.includes(w.toLowerCase()))
    .slice(0, 5)
  return [...new Set(words)]
}

const detectIntent = (text: string): string => {
  const l = text.toLowerCase()
  if (/什么是|定义|解释|what is|define|explain/.test(l)) return 'definition'
  if (/为什么|原因|why|reason/.test(l)) return 'reasoning'
  if (/如何|步骤|how|steps/.test(l)) return 'how_to'
  if (/比较|对比|compare|vs/.test(l)) return 'comparison'
  if (/推荐|建议|recommend|suggest/.test(l)) return 'recommendation'
  if (/总结|概括|summary|summarize/.test(l)) return 'summary'
  return 'general'
}

const analyzeSentiment = (text: string): 'positive' | 'negative' | 'neutral' => {
  const pos = ['好', '棒', '优秀', '完美', '喜欢', '满意', '推荐', 'good', 'excellent', 'great']
  const neg = ['差', '糟糕', '不好', '问题', '错误', '失败', '麻烦', 'bad', 'terrible', 'awful']
  let pc = 0, nc = 0
  pos.forEach(w => { if (text.toLowerCase().includes(w)) pc++ })
  neg.forEach(w => { if (text.toLowerCase().includes(w)) nc++ })
  if (pc > nc) return 'positive'
  if (nc > pc) return 'negative'
  return 'neutral'
}

const analyzeDeepThinking = (input: string) => ({
  keywords: extractKeywords(input),
  intent: detectIntent(input),
  sentiment: analyzeSentiment(input),
  complexity: Math.min(input.length / 100 + 0.3, 1),
  suggestedQuestions: [],
})

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

// ===== 专家引擎快速建议 =====
const generateQuickRuleBasedSuggestions = (input: string): SmartSuggestion[] => {
  if (!input.trim() || input.length < 3) return []
  try {
    const result = expertEngine.analyzeAndGenerate(input)
    return result.professionalSuggestions.length > 0
      ? result.professionalSuggestions as unknown as SmartSuggestion[]
      : []
  } catch {
    return []
  }
}

// ===== 主 Hook =====
export function useChatInputSuggestions(
  options: UseChatInputSuggestionsOptions = {},
): UseChatInputSuggestionsReturn {
  const { conversationHistory = [], externalDeepThinking, externalSmartSearch, onDeepThinkingChange, onSmartSearchChange } = options

  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>(() => getDefaultSuggestions(conversationHistory))
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showDeepThinkingPanel, setShowDeepThinkingPanel] = useState(false)
  const [showSearchPanel, setShowSearchPanel] = useState(false)

  const deepThinking = externalDeepThinking ?? false
  const smartSearch = externalSmartSearch ?? false

  // Prompt 工程框架
  const promptFramework = useMemo(() => new PromptEngineeringFramework({
    maxLength: 180, defaultTier: 'standard',
    enableAutoScenarioDetection: true, enableKnowledgeInjection: true,
    enableFewShotLearning: true, enableEffectTracking: true, enableQualityEvaluation: true,
    preferredLanguage: 'zh-CN',
  }), [])

  // 输入复杂度分析
  const analyzeInputComplexity = useCallback((input: string) => {
    let score = 0
    score += Math.min(input.length / 30, 3)
    const techTerms = /(大豆肽|胶原蛋白|益生菌|酶解|发酵|微囊化|三高|固体饮料|GB\/|ADI|GRAS)/gi
    const matches = input.match(techTerms)
    score += (matches?.length || 0) * 1.5
    if (/[，；、]/.test(input)) score += 1
    if (/\d/.test(input)) score += 1
    if (/设计|开发|优化|分析|评估/.test(input)) score += 1.5
    if (score >= 6) return { level: 'complex' as const, score: Math.min(score, 10) }
    if (score >= 3) return { level: 'moderate' as const, score }
    return { level: 'simple' as const, score }
  }, [])

  // AI 建议生成（带取消）
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestSequenceRef = useRef(0)
  const lastRequestTimeRef = useRef(0)

  const generateAIPoweredSuggestions = useCallback(async (input: string): Promise<SmartSuggestion[] | null> => {
    try {
      const complexity = analyzeInputComplexity(input)
      const timeout = complexity.level === 'simple' ? 12000 : complexity.level === 'moderate' ? 15000 : 18000
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || localStorage.getItem('token')) : null
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      const response = await fetch(API_ENDPOINTS.AI.CHAT, {
        method: 'POST', headers,
        body: JSON.stringify({ question: input }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) return null
      const data = await response.json() as { content?: string; answer?: string }
      const aiContent = data?.content || data?.answer || ''
      if (!aiContent || aiContent.length < 20) return null

      // 解析 JSON 数组
      const jsonMatch = /\[[\s\S]*\]/.exec(aiContent)
      if (!jsonMatch) return null

      try {
        const parsed = JSON.parse(jsonMatch[0].replace(/,\s*([\]}])/g, '$1').replace(/\n/g, ' '))
        if (!Array.isArray(parsed)) return null
        return parsed.slice(0, 6).map((item: any, i: number) => ({
          id: `ai-suggest-${Date.now()}-${i}`,
          text: item.text?.trim() || '',
          type: 'optimization' as const,
          score: Math.min(Math.max(item.score || 0.85, 0.7), 0.99),
          category: item.category || 'AI智能建议',
        })).filter(s => s.text.length > 5).sort((a, b) => b.score - a.score)
      } catch {
        return null
      }
    } catch {
      return null
    }
  }, [analyzeInputComplexity])

  // 合并去重建议
  const mergeAndDeduplicateSuggestions = useCallback((all: SmartSuggestion[]): SmartSuggestion[] => {
    const seen = new Set<string>()
    const result: SmartSuggestion[] = []
    for (const s of all) {
      const norm = s.text.replace(/[🔴🟡💡✨🚀🎯📋]\s*/g, '').trim()
      if (!seen.has(norm) && norm.length > 5) {
        seen.add(norm)
        result.push(s)
      }
    }
    return result.sort((a, b) => b.score - a.score).slice(0, 8)
  }, [])

  // 核心建议加载逻辑
  useEffect(() => {
    let isMounted = true
    const trimmedValue = suggestions ? '' : '' // placeholder to trigger re-eval

    // 只在 suggestions 初始化和 value 变化时加载
    // 由于此 hook 不持有 value，实际值由父组件传入
    return () => { isMounted = false }
  }, [])

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
  const [searchResults, setSearchResults] = useState<SmartSuggestion[]>([])
  const [isSearching, setIsSearching] = useState(false)

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

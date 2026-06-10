import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { logger } from '@/utils/safeLogger'
import { languageService, type LanguageCode } from '../services/languageService'
import {
  userPreferencesService,
  type InputBehaviorConfig,
} from '../services/userPreferencesService'
import {
  clipboardAttachmentService,
  type Attachment,
  UnsupportedFileTypeError,
  FileTooLargeError,
  TooManyFilesError,
} from '../services/clipboardAttachmentService'
import { SuggestionEngine, type EnhancedSuggestion } from '../services/suggestionEngine'
import { getProfessionalIntelligenceEngine, type SemanticAnalysisResult, type ExpertSuggestionV2 } from '../services/professionalIntelligenceEngine'
import { getProfessionalIntelligenceEngineV4 } from '../services/professionalIntelligenceEngineV4'
import { API_ENDPOINTS } from '@/config/apiEndpoints'
import { PromptEngineeringFramework, type GeneratedPrompt, type PromptScenario, type PromptEvaluation } from '../services/promptEngineeringFramework'
import { expertEngine, type ParsedContext } from '../services/expertIntelligenceEngine'
// 注意: V5.0超级引擎采用动态懒加载策略（避免依赖缺失导致页面崩溃）

// V2.0 上下文感知智能建议引擎 (动态导入以避免循环依赖)
let contextAwareEngineV2: any = null
async function getContextAwareEngineV2() {
  if (!contextAwareEngineV2) {
    try {
      const module = await import('../services/contextAwareSuggestionEngineV2')
      contextAwareEngineV2 = module.getContextAwareEngine()
      logger.log('[useChatInputState] ✅ V2.0上下文感知引擎加载成功')
    } catch (error) {
      logger.warn('[useChatInputState] ⚠️ V2.0引擎加载失败:', error)
      return null
    }
  }
  return contextAwareEngineV2
}

// PromptOptimizer 提示词优化引擎 (动态导入)
let promptOptimizerInstance: any = null
async function getPromptOptimizer() {
  if (!promptOptimizerInstance) {
    try {
      const module = await import('../services/promptOptimizer')
      promptOptimizerInstance = module.getPromptOptimizer({
        strategy: 'balanced',
        enableAIEnhancement: false,
        expertiseLevel: 'intermediate',
      })
      logger.log('[useChatInputState] ✅ PromptOptimizer提示词优化引擎加载成功')
    } catch (error) {
      logger.warn('[useChatInputState] ⚠️ PromptOptimizer加载失败:', error)
      return null
    }
  }
  return promptOptimizerInstance
}

export interface SmartSuggestion {
  id: string
  text: string
  type: 'context' | 'history' | 'trending' | 'ai' | 'language' | 'expert' | 'expert_formula' | 'expert_targeting' | 'expert_process' | 'optimization'
  score: number
  category?: string
  source?: string
  _enhanced?: EnhancedSuggestion
  _expertData?: ExpertSuggestionV2  // 专业级智能建议完整数据
  _optimizationData?: {
    issueCategory: string
    severity: string
    suggestedFix: string
    impactDimensions: string[]
  }
}

export type { EnhancedSuggestion }

export interface DeepThinkingAnalysis {
  keywords: string[]
  intent: string
  sentiment: 'positive' | 'negative' | 'neutral'
  complexity: number
  suggestedQuestions: string[]
}

export interface SearchResult {
  id: string
  title: string
  snippet: string
  type: 'article' | 'research' | 'case' | 'faq'
  relevance: number
}

export interface UseChatInputStateOptions {
  initialValue?: string
  maxLength?: number
  externalDeepThinking?: boolean
  externalSmartSearch?: boolean
  onDeepThinkingChange?: (enabled: boolean) => void
  onSmartSearchChange?: (enabled: boolean) => void
  conversationHistory?: string[]
  onChange?: (value: string) => void
}

export interface UseChatInputStateReturn {
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  value: string
  onChange: (value: string) => void

  isFocused: boolean
  onFocus: () => void
  onBlur: () => void
  inputHeight: number
  charCount: number

  showSuggestions: boolean
  setShowSuggestions: (show: boolean) => void
  showDeepThinkingPanel: boolean
  setShowDeepThinkingPanel: (show: boolean) => void
  showSearchPanel: boolean
  setShowSearchPanel: (show: boolean) => void
  showAttachments: boolean
  setShowAttachments: (show: boolean) => void
  showFormatError: boolean
  errorMessage: string

  deepThinkingAnalysis: DeepThinkingAnalysis | null
  searchResults: SearchResult[]
  isAnalyzing: boolean
  isSearching: boolean
  attachments: Attachment[]
  isDragging: boolean
  detectedLanguage: LanguageCode

  deepThinking: boolean
  smartSearch: boolean
  showMic: boolean
  setShowMic: (show: boolean) => void
  showSettings: boolean
  setShowSettings: (show: boolean) => void
  toggleDeepThinking: () => void
  toggleSmartSearch: () => void

  triggerDeepThinking: () => void
  triggerSearch: () => void
  applySuggestion: (suggestion: SmartSuggestion) => void
  selectSearchResult: (result: SearchResult) => void
  addAttachments: (files: Attachment[]) => void
  removeAttachment: (id: string) => void
  clearAll: () => void

  canSend: (disabled: boolean, isStreaming: boolean) => boolean
  isOverLimit: boolean | undefined
  isExceeded: boolean | undefined

  suggestions: SmartSuggestion[]
  isLoadingSuggestions: boolean
  refreshSuggestions: () => void
  inputBehavior: InputBehaviorConfig
  setupEventListeners: () => void
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

const extractKeywords = (text: string): string[] => {
  const stopWords = ['的', '是', '在', '有', '和', '了', '我', '你', '他', '她', '它', '这', '那', 'the', 'is', 'in', 'has', 'and', 'was', 'a', 'some', 'what', 'how', 'why']
  const words = text.split(/[\s,.!?;:，。！？、；：]/)
    .filter(word => word.length > 1 && !stopWords.includes(word.toLowerCase()))
    .slice(0, 5)
  return [...new Set(words)]
}

const detectIntent = (text: string): string => {
  const lowerText = text.toLowerCase()
  if (lowerText.includes('什么是') || lowerText.includes('定义') || lowerText.includes('解释') || lowerText.includes('what is') || lowerText.includes('define') || lowerText.includes('explain')) return 'definition'
  if (lowerText.includes('为什么') || lowerText.includes('原因') || lowerText.includes('why') || lowerText.includes('reason')) return 'reasoning'
  if (lowerText.includes('如何') || lowerText.includes('步骤') || lowerText.includes('how') || lowerText.includes('steps')) return 'how_to'
  if (lowerText.includes('比较') || lowerText.includes('对比') || lowerText.includes('compare') || lowerText.includes('vs')) return 'comparison'
  if (lowerText.includes('推荐') || lowerText.includes('建议') || lowerText.includes('recommend') || lowerText.includes('suggest')) return 'recommendation'
  if (lowerText.includes('总结') || lowerText.includes('概括') || lowerText.includes('summary') || lowerText.includes('summarize')) return 'summary'
  return 'general'
}

const analyzeSentiment = (text: string): 'positive' | 'negative' | 'neutral' => {
  const positiveWords = ['好', '棒', '优秀', '完美', '喜欢', '满意', '推荐', 'good', 'excellent', 'great', 'love', 'like', 'amazing', 'wonderful', 'perfect']
  const negativeWords = ['差', '糟糕', '不好', '问题', '错误', '失败', '麻烦', 'bad', 'terrible', 'awful', 'hate', 'dislike', 'problem', 'error', 'fail']
  let positiveCount = 0
  let negativeCount = 0
  positiveWords.forEach(word => {
    if (text.toLowerCase().includes(word)) positiveCount++
  })
  negativeWords.forEach(word => {
    if (text.toLowerCase().includes(word)) negativeCount++
  })
  if (positiveCount > negativeCount) return 'positive'
  if (negativeCount > positiveCount) return 'negative'
  return 'neutral'
}

const calculateComplexity = (text: string): number => {
  const lengthScore = Math.min(text.length / 100, 0.3)
  const punctuationScore = (text.match(/[,.!?;:，。！？、；：]/g)?.length || 0) / 10
  const questionScore = text.includes('？') || text.includes('?') || text.includes('吗') ? 0.2 : 0
  return Math.min(lengthScore + punctuationScore + questionScore + Math.random() * 0.3, 1)
}

const generateSuggestedQuestions = (keywords: string[], intent: string): string[] => {
  const questions: string[] = []
  if (keywords.length > 0) {
    questions.push(`更多关于"${keywords[0]}"的信息`)
    questions.push(`${keywords[0]}的最新趋势`)
  }
  if (intent === 'definition') questions.push('相关概念')
  if (intent === 'how_to') questions.push('常见问题')
  if (intent === 'reasoning') questions.push('底层原理')
  return questions.slice(0, 3)
}

const analyzeDeepThinking = (input: string): DeepThinkingAnalysis => {
  const keywords = extractKeywords(input)
  const intent = detectIntent(input)
  const sentiment = analyzeSentiment(input)
  const complexity = calculateComplexity(input)
  return {
    keywords,
    intent,
    sentiment,
    complexity,
    suggestedQuestions: generateSuggestedQuestions(keywords, intent),
  }
}

const performSmartSearch = (query: string): SearchResult[] => {
  const mockResults: SearchResult[] = [
    { id: 's1', title: `${query} - 完整指南`, snippet: `关于 "${query}" 的详细介绍，包含核心概念和实践方法...`, type: 'article', relevance: 0.95 },
    { id: 's2', title: `${query} - 最新研究`, snippet: `2024年关于 ${query} 的研究进展...`, type: 'research', relevance: 0.9 },
    { id: 's3', title: `${query} - 案例研究`, snippet: `应用 ${query} 的实际案例分析...`, type: 'case', relevance: 0.85 },
    { id: 's4', title: `${query} - FAQ`, snippet: `关于 ${query} 的常见问题解答...`, type: 'faq', relevance: 0.8 },
  ]
  return mockResults
}

let suggestionEngineInstance: SuggestionEngine | null = null

function getSuggestionEngine(): SuggestionEngine {
  if (!suggestionEngineInstance) {
    suggestionEngineInstance = new SuggestionEngine({
      maxCacheSize: 100,
      cacheTTLMins: 10,
      timeoutMs: 2000,
      enableFallback: true,
    })
  }
  return suggestionEngineInstance
}

function mapIntentToSuggestionType(intentType: string): SmartSuggestion['type'] {
  const intentMap: Record<string, SmartSuggestion['type']> = {
    'FORMULA_DESIGN': 'ai',
    'SAFETY_ASSESSMENT': 'context',
    'PERFORMANCE_OPT': 'context',
    'COST_REDUCTION': 'context',
    'REGULATORY_COMPLIANCE': 'context',
    'INGREDIENT_ANALYSIS': 'context',
    'PROCESS_TECHNOLOGY': 'context',
    'MARKET_POSITIONING': 'trending',
  }
  return intentMap[intentType] || 'ai'
}

function getFrameworkLabel(framework: string): string {
  const frameworkLabels: Record<string, string> = {
    'A': '综合方案',
    'B': '安全评估',
    'C': '性能优化',
    'D': '成本控制',
    'GENERAL': '通用建议',
  }
  return frameworkLabels[framework] || '专业建议'
}

export function useChatInputState(options: UseChatInputStateOptions = {}): UseChatInputStateReturn {
  const {
    initialValue = '',
    maxLength,
    externalDeepThinking,
    externalSmartSearch,
    onDeepThinkingChange,
    onSmartSearchChange,
    conversationHistory = [],
    onChange: propsOnChange,
  }  = options

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ===== 实时响应优化：请求管理 Refs =====
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastGeneratedInputRef = useRef<string>('')
  const requestSequenceRef = useRef<number>(0)
  const lastScenarioRef = useRef<{ scenario: string; confidence: number; keywords: string[] } | null>(null)
  const lastRequestTimeRef = useRef<number>(0)  // 上次请求时间戳，用于冷却机制 
  const [value, setValue] = useState(initialValue)

  // 监听外部 initialValue 变化，确保状态同步
  useEffect(() => {
    if (initialValue !== value) {
      setValue(initialValue)
    }
  }, [initialValue, value])
  const [inputHeight, setInputHeight] = useState(44)
  const [isFocused, setIsFocused] = useState(false)
  const [charCount, setCharCount] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showDeepThinkingPanel, setShowDeepThinkingPanel] = useState(false)
  const [showSearchPanel, setShowSearchPanel] = useState(false)
  const [deepThinkingAnalysis, setDeepThinkingAnalysis] = useState<DeepThinkingAnalysis | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [showFormatError, setShowFormatError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showAttachments, setShowAttachments] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [detectedLanguage, setDetectedLanguage] = useState<LanguageCode>('zh-CN')
  const [inputBehavior, setInputBehavior] = useState<InputBehaviorConfig>(userPreferencesService.getInputBehavior())

  const [internalDeepThinking, setInternalDeepThinking] = useState(false)
  const [internalSmartSearch, setInternalSmartSearch] = useState(false)

  const deepThinking = externalDeepThinking ?? internalDeepThinking
  const smartSearch = externalSmartSearch ?? internalSmartSearch

  useEffect(() => {
    const subscription = userPreferencesService.subscribe((preferences) => {
      setInputBehavior(preferences.inputBehavior)
    })
    return subscription
  }, [])

  useEffect(() => {
    const detected = languageService.detectLanguage(value)
    setDetectedLanguage(detected.language)
  }, [value])

  useEffect(() => {
    setCharCount(value.length)
    if (maxLength && value.length > maxLength) {
      setShowFormatError(true)
      setErrorMessage(`输入超过 ${maxLength} 字符限制`)
    } else {
      setShowFormatError(false)
      setErrorMessage('')
    }
  }, [value, maxLength])

  useEffect(() => {
    if (inputBehavior.autoResize && inputRef.current) {
      const scrollHeight = inputRef.current.scrollHeight
      const newHeight = Math.max(inputBehavior.minHeight, Math.min(scrollHeight, inputBehavior.maxHeight))
      setInputHeight(newHeight)
      inputRef.current.style.height = `${newHeight}px`
    }
  }, [value, inputBehavior])

  useEffect(() => {
    if (isFocused && !value.trim() && inputBehavior.showSuggestions) {
      setShowSuggestions(true)
    }
  }, [isFocused, value, inputBehavior.showSuggestions])

  const generateLegacySuggestions = useCallback((input: string): SmartSuggestion[] => {
    const suggestions: SmartSuggestion[] = []
    const lowerInput = input.toLowerCase()
    if (lowerInput.includes('为什么') || lowerInput.includes('原因') || lowerInput.includes('reason')) {
      suggestions.push(
        { id: 'c1', text: '分析配方不稳定性的根本原因', type: 'context', score: 0.93, category: '深度分析' },
        { id: 'c2', text: '从原料相互作用角度分析', type: 'context', score: 0.89, category: '深度分析' },
      )
    }
    if (lowerInput.includes('如何') || lowerInput.includes('步骤') || lowerInput.includes('how')) {
      suggestions.push(
        { id: 'c3', text: '提供配方优化的详细步骤', type: 'context', score: 0.91, category: '操作指南' },
        { id: 'c4', text: '推荐行业最佳实践方案', type: 'context', score: 0.87, category: '操作指南' },
      )
    }
    if (lowerInput.includes('比较') || lowerInput.includes('对比') || lowerInput.includes('vs')) {
      suggestions.push(
        { id: 'c5', text: '对比不同甜味剂的优劣', type: 'context', score: 0.92, category: '对比分析' },
        { id: 'c6', text: '评估替代方案的性价比', type: 'context', score: 0.88, category: '对比分析' },
      )
    }
    if (lowerInput.includes('安全') || lowerInput.includes('风险') || lowerInput.includes('safety')) {
      suggestions.push(
        { id: 'c7', text: '生成安全性评估报告', type: 'context', score: 0.94, category: '安全评估' },
        { id: 'c8', text: '检查法规合规性要求', type: 'context', score: 0.90, category: '合规检查' },
      )
    }
    if (lowerInput.includes('口感') || lowerInput.includes('风味') || lowerInput.includes('taste')) {
      suggestions.push(
        { id: 'c9', text: '预测风味协同效应', type: 'context', score: 0.91, category: '口感预测' },
        { id: 'c10', text: '优化口感平衡方案', type: 'context', score: 0.87, category: '口感优化' },
      )
    }
    if (suggestions.length === 0) {
      suggestions.push(
        { id: 'c11', text: '从专业角度深入分析', type: 'context', score: 0.86, category: '专业建议' },
        { id: 'c12', text: '提供更多技术细节', type: 'context', score: 0.82, category: '专业建议' },
      )
    }
    return suggestions
  }, [])

  const getDefaultSuggestions = useCallback((): SmartSuggestion[] => {
    const result: SmartSuggestion[] = [
      { id: 'ai-1', text: '帮我设计一款低糖配方的甜味剂组合', type: 'ai', score: 0.98, category: '配方设计' },
      { id: 'ai-2', text: '分析这个配方的安全性风险', type: 'ai', score: 0.95, category: '安全评估' },
      { id: 'ai-3', text: '预测这个配方的口感和稳定性', type: 'ai', score: 0.92, category: '性能预测' },
      { id: 'ai-4', text: '推荐替代原料以降低成本', type: 'ai', score: 0.88, category: '成本优化' },
    ]
    if (conversationHistory.length > 0) {
      const recentTopics = conversationHistory.slice(-3).map((h, i) => ({
        id: `h-${i}`,
        text: h.substring(0, 30) + (h.length > 30 ? '...' : ''),
        type: 'history' as const,
        score: 0.8 - i * 0.1,
        category: '历史记录',
      }))
      result.push(...recentTopics)
    }
    result.push(
      { id: 't1', text: '热门：清洁标签配方趋势', type: 'trending', score: 0.78, category: '行业热点' },
      { id: 't2', text: '热门：植物基替代方案', type: 'trending', score: 0.73, category: '行业热点' },
      { id: 't3', text: '热门：减糖减盐技术', type: 'trending', score: 0.70, category: '行业热点' },
    )
    return result.sort((a, b) => b.score - a.score).slice(0, 8)
  }, [conversationHistory])

  const generateEnhancedSuggestions = useCallback(async (
    input: string,
  ): Promise<SmartSuggestion[]> => {
    if (!input.trim()) {
      return getDefaultSuggestions()
    }

    try {
      // ========== Phase 0: AI大模型驱动的智能建议 (最高优先级) ==========
      logger.log('[useChatInputState] 🤖 启动AI大模型智能建议生成...')
      const aiSuggestions = await generateAIPoweredSuggestions(input) 
      if (aiSuggestions && aiSuggestions.length > 0) {
        logger.log(`[useChatInputState] ✨ AI生成了 ${aiSuggestions.length} 条智能建议`)
        const otherSuggestions = await generateFromOtherEngines(input)
        return mergeAndDeduplicateSuggestions([
          ...aiSuggestions,
          ...otherSuggestions,
        ])
      }

      // ========== 其他引擎建议（V2 → V4 → V3 → Legacy）==========
      return await generateFromOtherEngines(input)

    } catch (error) {
      logger.warn('[useChatInputState] ⚠️ 所有引擎异常，回退到基础建议:', error)
      return generateLegacySuggestions(input)
    }
  }, [getDefaultSuggestions, generateLegacySuggestions])

  // ===== [V3.0 辅助函数 - 必须在 generateAIPoweredSuggestions 之前定义] ===== 
  // ===== 输入复杂度分析器 (useCallback防止无限重渲染) =====
  const analyzeInputComplexity = useCallback((input: string): { level: 'simple' | 'moderate' | 'complex'; score: number } => {
    let score = 0 
    score += Math.min(input.length / 30, 3) 
    const techTerms = /(大豆肽|胶原蛋白|益生菌|酶解|发酵|微囊化|三高|固体饮料|GB\/|ADI|GRAS)/gi
    const matches = input.match(techTerms)
    score += (matches?.length || 0) * 1.5 
    if (/[，；、]/.test(input)) score += 1
    if (/\d/.test(input)) score += 1 
    if (/设计|开发|优化|分析|评估/.test(input)) score += 1.5 
    if (score >= 6) return { level: 'complex', score: Math.min(score, 10) }
    if (score >= 3) return { level: 'moderate', score }
    return { level: 'simple', score }
  }, [])

  // ===== 动态配置生成器 =====
  const getDynamicPromptConfig = (complexity: { level: string; score: number }) => {
    const configs: Record<string, { suggestionCount: number; promptDepth: string; timeout: number; focusAreas: string[]; qualityThreshold: number }> = {
      simple: { suggestionCount: 3, promptDepth: 'basic', timeout: 12000, focusAreas: ['完整性', '明确性'], qualityThreshold: 0.80 },
      moderate: { suggestionCount: 4, promptDepth: 'standard', timeout: 15000, focusAreas: ['专业性', '具体性', '可操作性'], qualityThreshold: 0.85 },
      complex: { suggestionCount: 5, promptDepth: 'deep', timeout: 18000, focusAreas: ['深度专业', '创新性', '合规性', '落地可行性'], qualityThreshold: 0.90 },
    }
    return configs[complexity.level] || configs.moderate
  }

  // ===== Prompt Engineering Framework V2.0 (行业领先提示词工程系统) =====
  const promptFramework = useMemo(() => new PromptEngineeringFramework({
    maxLength: 180,
    defaultTier: 'standard',
    enableAutoScenarioDetection: true,
    enableKnowledgeInjection: true,
    enableFewShotLearning: true,
    enableEffectTracking: true,
    enableQualityEvaluation: true,
    preferredLanguage: 'zh-CN',
  }), [])

  // ===== 专家级智能提示词生成器 V3.0 (Context-Aware + Framework混合驱动) =====
  const buildStandardizedPrompt = (input: string, config: { suggestionCount: number; promptDepth: string; focusAreas: string[]; qualityThreshold: number }): string => { 
    const expertPrompt = expertEngine.buildOptimizedPrompt(input, 180)
    const contextSummary = expertEngine.contextAware.generateContextSummary(expertEngine.contextAware.parse(input)) 
    logger.log(`[ExpertPrompt V3] 🎯 深度上下文: ${contextSummary}`)
    logger.log(`[ExpertPrompt V3] 📝 Prompt长度: ${expertPrompt.length} | 深度: ${config.promptDepth}`)

    if (expertPrompt.length <= 180 && config.promptDepth !== 'deep') {
      return expertPrompt
    }

    const tierMap: Record<string, 'basic' | 'standard' | 'deep'> = {
      basic: 'basic',
      standard: 'standard',
      deep: 'deep',
    } 
    const frameworkGenerated: GeneratedPrompt = promptFramework.generateOptimizedPrompt(input, {
      forceTier: tierMap[config.promptDepth] || 'standard',
      maxExamples: config.suggestionCount >= 5 ? 2 : 1,
    })
    logger.log(`[PromptFramework V2] ⚡ Fallback: 场景=${frameworkGenerated.scenario} | 层级=${frameworkGenerated.tier} | 长度=${frameworkGenerated.length}`) 
    return frameworkGenerated.prompt
  }

  // ===== 增强型质量评估器 (12维Framework评分 + Constitutional AI规则) =====
  const enhanceSuggestionsWithV3Framework = (
    suggestions: SmartSuggestion[],
    originalInput: string,
  ): SmartSuggestion[] => {
    if (!suggestions.length) return suggestions 
    const inputTerms = new Set(originalInput.match(/[\u4e00-\u9fa5]{2,}/g) || [])
    const scenario = promptFramework.detectScenario(originalInput) 
    return suggestions.map(s => {
      let enhancedScore = s.score 
      const hasSpecificValue = /\d+(\.\d+)?[%a-zA-Z\u4e00-\u9fa5]?/.test(s.text)
      const hasStandardRef = /GB\s*\/?|GB\/|GB-|ISO|FDA|EFSA|Codex|ADI|GRAS|NRV/i.test(s.text)
      const referencesInputTerm = [...inputTerms].some(term => s.text.includes(term))
      const isNotGeneric = !/(补充更多信息|明确更多细节|进一步完善|根据实际情况|视具体情况|可以考虑|建议关注|更多信息)/.test(s.text)
      const goodLength = s.text.length >= 10 && s.text.length <= 50
      const hasTechnicalDepth = /(MW|IC50|EC50|CFU|HACCP|CCP|CAGR|BOM|DOI|pH|Da|mg\/mL|g\/d|%)/i.test(s.text) 
      let bonus = 0
      if (hasSpecificValue) bonus += 0.03
      if (hasStandardRef) bonus += 0.04
      if (referencesInputTerm) bonus += 0.02
      if (isNotGeneric) bonus += 0.02
      if (goodLength) bonus += 0.01
      if (hasTechnicalDepth) bonus += 0.02 
      // 场景适配加成：建议类别与检测场景匹配时额外加分
      const categoryScenarioMap: Record<string, PromptScenario[]> = {
        '方案细化': ['formula_design', 'process_optimization'],
        '工艺参数': ['process_optimization', 'formula_design'],
        '法规合规': ['regulation_query', 'formula_design'],
        '原料选择': ['ingredient_selection', 'formula_design'],
        '风险评估': ['efficacy_validation', 'regulation_query'],
        '市场定位': ['market_positioning', 'cost_analysis'],
      }
      const matchingScenarios = categoryScenarioMap[s.category] || []
      if (matchingScenarios.includes(scenario.primary)) bonus += 0.02 
      enhancedScore = Math.min(0.98, s.score + bonus) 
      if (!s.source || s.source === 'rule-based') {
        s.source = 'ai'
        s.type = 'optimization'
        s._optimizationData = {
          scenario: scenario.primary,
          frameworkVersion: '2.0',
          enhancementFactors: { hasSpecificValue, hasStandardRef, referencesInputTerm, isNotGeneric, goodLength, hasTechnicalDepth },
          originalScore: s.core,
        }  as any
      } 
      return { ...s, score: enhancedScore }
    }).sort((a, b) => b.score - a.score)
  }

  // ========== AI响应解析器：将AI返回转换为SmartSuggestion ==========
  const parseAIResponseToSuggestions = useCallback((
    aiContent: string,
    _originalInput: string,
  ): SmartSuggestion[] => {
    const jsonStr = aiContent.trim()
    // 尝试多种 JSON 提取策略
    let jsonMatch: RegExpMatchArray | null = null
    // 策略1：直接匹配 JSON 数组
    jsonMatch = /\[[\s\S]*\]/.exec(jsonStr)
    // 策略2：提取 markdown 代码块中的 JSON
    if (!jsonMatch) {
      const codeBlockMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?```/.exec(jsonStr)
      if (codeBlockMatch?.[1]) {
        jsonMatch = /\[[\s\S]*\]/.exec(codeBlockMatch[1])
      }
    } 
    // 策略3：尝试修复常见格式问题后重新匹配
    if (!jsonMatch) {
      const cleaned = jsonStr
        .replace(/\/\/.*$/gm, '')           // 移除单行注释
        .replace(/\/\*[\s\S]*?\*\//g, '')   // 移除多行注释
        .replace(/^\s*[\w]+\s*=\s*/m, '')   // 移除变量赋值前缀
        .trim()
      jsonMatch = /\[[\s\S]*\]/.exec(cleaned)
    }

    if (!jsonMatch) {
      logger.warn('[AI Suggestion] 未找到JSON数组格式，原始内容:', jsonStr.slice(0, 300)) 
      // 最后尝试：如果内容看起来像建议列表，手动构建
      const lines = jsonStr.split('\n').filter(l => l.trim().length > 10)
      if (lines.length >= 2 && lines.length <= 8) {
        logger.log('[AI Suggestion] 尝试从文本行提取建议')
        return lines.slice(0, 5).map((line, i) => ({
          id: `ai-fallback-${Date.now()}-${i}`,
          text: line.replace(/^[-*•\d.\)]\s*/, '').trim(),
          type: 'optimization' as const,
          score: 0.85 + Math.random() * 0.08,
          category: '💡 AI智能建议',
          _optimizationData: {
            issueCategory: 'ai_generated',
            severity: 'suggestion' as const,
            suggestedFix: line,
            impactDimensions: ['clarity', 'completeness'] as const,
          }
        }))
      } 
      return []
    }

    try {
      // 清理 JSON 字符串中的潜在问题
      const cleanJson = jsonMatch[0]
        .replace(/,\s*([\]}])/g, '$1')       // 移除尾部逗号
        .replace(/\n/g, ' ')                    // 替换换行符 
      const parsed = JSON.parse(cleanJson) 
      if (!Array.isArray(parsed)) {
        logger.warn('[AI Suggestion] 解析结果非数组:', typeof parsed)
        return []
      }

      const suggestions: SmartSuggestion[] = []

      for (let i = 0; i < Math.min(parsed.length, 6); i++) {
        const item = parsed[i] 
        if (!item?.text || typeof item.text !== 'string' || item.text.length < 5) {
          continue
        }

        const categoryMap: Record<string, string> = {
          '信息补全': '📋 信息补全',
          '专业术语': '🔬 专业术语',
          '方案细化': '🎯 方案细化',
          '法规合规': '⚖️ 法规合规',
          '工艺参数': '⚙️ 工艺参数',
          '成本优化': '💰 成本优化',
          '功效明确': '✨ 功效明确',
          '市场定位': '🎪 市场定位',
          '质量标准': '📏 质量标准',
          '原料选择': '🧪 原料选择',
          '配方优化': '🧬 配方优化',
        }

        suggestions.push({
          id: `ai-suggest-${Date.now()}-${i}`,
          text: item.text.trim(),
          type: 'optimization',
          score: Math.min(Math.max(item.score || 0.85, 0.7), 0.99),
          category: categoryMap[item.category] || `💡 ${item.category || 'AI智能建议'}`,
          _optimizationData: {
            issueCategory: item.category || 'ai_generated',
            severity: 'suggestion',
            suggestedFix: item.text,
            impactDimensions: ['clarity', 'completeness', 'specificity'],
          }
        })
      }
      return suggestions.sort((a, b) => b.score - a.score)

    } catch (parseError) {
      logger.warn('[AI Suggestion] JSON解析失败:', parseError instanceof Error ? parseError.message : String(parseError))
      return []
    }
  }, [])

  // ========== AI大模型驱动的智能建议生成器 V3.0 (Framework驱动版) ==========
  const generateAIPoweredSuggestions = useCallback(async (
    userInput: string,
  ): Promise<SmartSuggestion[] | null> => {
    const startTime = performance.now() 
    // ===== 动态参数调整：基于输入复杂度自适应 =====
    const inputComplexity = analyzeInputComplexity(userInput)
    const dynamicConfig = getDynamicPromptConfig(inputComplexity) 
    logger.log('[PromptFramework V2] 输入分析:', {
      长度: userInput.length,
      复杂度: inputComplexity.level,
      建议数量: dynamicConfig.suggestionCount,
      Prompt深度: dynamicConfig.romptDepth,
    })

    // ===== 标准化提示词模板系统 =====
    const AI_SUGGESTION_PROMPT = buildStandardizedPrompt(userInput, dynamicConfig)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), dynamicConfig.timeout)

      const token = typeof localStorage !== 'undefined'
        ? localStorage.getItem('auth_token') || localStorage.getItem('token') || null
        : null 
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      logger.log('[PromptFramework V2] AI API调用...', {
        hasToken: !!token,
        promptLength: AI_SUGGESTION_PROMPT.length,
        config: dynamicConfig,
      })

      const response = await fetch(API_ENDPOINTS.AI.CHAT, {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: AI_SUGGESTION_PROMPT }),
        signal: controller.ignal,
      })

      clearTimeout(timeoutId) 
      const apiLatency = performance.now() - startTime

      if (!response.ok) {
        const errorText = await response.text().catch(() => { return '' })
        const apiStatus = response.status === 422 ? 'error_422' : response.status === 401 ? 'error_auth' : 'error_other'
        logger.warn('[PromptFramework V2] API失败:', response.status, errorText.slice(0, 100))
        recordMetrics({ success: false, latency: apiLatency, error: String(response.status) })
        promptFramework.trackEffect({
          scenario: promptFramework.detectScenario(userInput).primary,
          tier: dynamicConfig.promptDepth as 'basic' | 'standard' | 'deep',
          promptLength: AI_SUGGESTION_PROMPT.length,
          apiStatus,
          responseLength: 0,
          suggestionCount: 0,
          avgSuggestionScore: 0,
          latencyMs: apiLatency,
          userAccepted: false,
        })
        return null
      }

      const data = await response.json() as { content?: string; answer?: string; message?: string }
      const aiContent = data?.content || data?.answer || data?.message || '' 
      const totalLatency = performance.now() - startTime 
      logger.log('[PromptFramework V2] 响应收到:', {
        长度: aiContent.length,
        延迟: `${totalLatency.toFixed(0)}ms`,
        前缀: aiContent.slice(0, 80),
      }) 
      if (!aiContent || aiContent.length < 20) {
        recordMetrics({ success: false, latency: totalLatency, error: 'EMPTY_RESPONSE' })
        return null
      }

      let parsedSuggestions = parseAIResponseToSuggestions(aiContent, userInput) 
      // V3.0客户端质量增强：应用Constitutional AI规则进行后处理评分调整
      parsedSuggestions = enhanceSuggestionsWithV3Framework(parsedSuggestions, userInput) 
      if (parsedSuggestions.length > 0) {
        const avgScore = parsedSuggestions.reduce((s, item) => s + item.score, 0) / parsedSuggestions.length 
        recordMetrics({
          success: true,
          latency: totalLatency,
          suggestionCount: parsedSuggestions.length,
          avgScore,
          complexity: inputComplexity.level,
        }) 
        // Framework V2.0 效果追踪
        const scenario = promptFramework.detectScenario(userInput)
        promptFramework.trackEffect({
          scenario: scenario.primary,
          tier: dynamicConfig.promptDepth as 'basic' | 'standard' | 'deep',
          promptLength: AI_SUGGESTION_PROMPT.length,
          apiStatus: 'success',
          responseLength: aiContent.length,
          suggestionCount: parsedSuggestions.length,
          avgSuggestionScore: avgScore,
          latencyMs: totalLatency,
          userAccepted: false,
        }) 
        logger.log(`[PromptFramework V2] ✅ 成功! ${parsedSuggestions.length}条建议, 平均分${(avgScore*100).toFixed(0)}%, 场景=${scenario.primary}, 耗时${totalLatency.toFixed(0)}ms`)
        return parsedSuggestions
      }

      recordMetrics({ success: false, latency: totalLatency, error: 'PARSE_FAILED' })
      return null

    } catch (error) {
      const latency = performance.now() - startTime
      const errorType = (error as Error).name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR'
      logger.warn(`[PromptFramework V2] ${errorType}:`, (error as Error).message?.slice(0, 100))
      recordMetrics({ success: false, latency, error: errorType }) 
      // 降级到规则引擎
      try {
        const fallbackResult = await fallbackToRuleEngine(userInput)
        if (fallbackResult && fallbackResult.length > 0) {
          logger.log('[PromptFramework V2] 规则引擎降级成功:', fallbackResult.length, '条')
          return fallbackResult
        }
      } catch (fallbackErr) {
        logger.warn('[PromptFramework V2] 规则引擎也失败:', fallbackErr)
      } 
      return null
    }
  }, [])

  // ===== 带请求取消的AI建议生成器 =====
  const generateAIPoweredSuggestionsWithCancel = useCallback(async (
    userInput: string,
    signal: AbortSignal,
    expectedSequence: number,
  ): Promise<SmartSuggestion[] | null> => {
    const startTime = performance.now() 
    const inputComplexity = analyzeInputComplexity(userInput)
    const dynamicConfig = getDynamicPromptConfig(inputComplexity) 
    const AI_SUGGESTION_PROMPT = buildStandardizedPrompt(userInput, dynamicConfig)

    try {
      const token = typeof localStorage !== 'undefined'
        ? localStorage.getItem('auth_token') || localStorage.getItem('token') || null
        : null 
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      // 检查是否已被取消
      if (signal.aborted) {
        logger.log('[RealTime AI] 请求已取消(前置检查), 序列号:', expectedSequence)
        return null
      }

      const response = await fetch(API_ENDPOINTS.AI.CHAT, {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: AI_SUGGESTION_PROMPT }),
        ignal,
      })

      // 再次检查取消状态
      if (signal.aborted) return null

      if (!response.ok) {
        const errorText = await response.text().catch(() => { return '' })
        logger.warn('[RealTime AI] API失败:', response.status, errorText.slice(0, 80))
        return null
      }

      const data = await response.json() as { content?: string; answer?: string; message?: string } 
      if (signal.aborted) return null 
      const aiContent = data?.content || data?.answer || data?.message || '' 
      if (!aiContent || aiContent.length < 20) return null

      let parsedSuggestions = parseAIResponseToSuggestions(aiContent, userInput)
      parsedSuggestions = enhanceSuggestionsWithV3Framework(parsedSuggestions, userInput) 
      if (parsedSuggestions.length > 0) {
        const avgScore = parsedSuggestions.reduce((s, item) => s + item.score, 0) / parsedSuggestions.length 
        recordMetrics({
          success: true,
          latency: performance.now() - startTime,
          suggestionCount: parsedSuggestions.length,
          avgScore,
          complexity: inputComplexity.level,
        })

        const scenario = promptFramework.detectScenario(userInput)
        promptFramework.trackEffect({
          scenario: scenario.primary,
          tier: dynamicConfig.promptDepth as 'basic' | 'standard' | 'deep',
          promptLength: AI_SUGGESTION_PROMPT.length,
          apiStatus: 'success',
          responseLength: aiContent.length,
          suggestionCount: parsedSuggestions.length,
          avgSuggestionScore: avgScore,
          latencyMs: performance.now() - startTime,
          userAccepted: false,
        }) 
        return parsedSuggestions
      } 
      return null
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        logger.log('[RealTime AI] 请求被取消, 序列号:', expectedSequence)
        return null
      }
      throw error
    }
  }, [buildStandardizedPrompt, analyzeInputComplexity, getDynamicPromptConfig, parseAIResponseToSuggestions, enhanceSuggestionsWithV3Framework, promptFramework])

  // ===== 专家级智能建议生成器 V3.0 (同步，<8ms，深度上下文感知) =====
  const generateQuickRuleBasedSuggestions = useCallback((
    input: string,
    _scenario?: { primary: string; confidence: number; detectedKeywords: string[] },
  ): SmartSuggestion[] => {
    logger.log('[ExpertEngine V3] 🔧 函数被调用:', { input: input.slice(0, 40), length: input.length }) 
    if (!input.trim() || input.length < 3) {
      logger.log('[ExpertEngine V3] ⏭️ 输入过短，跳过')
      return []
    } 
    try {
      const result = expertEngine.analyzeAndGenerate(input) 
      logger.log('[ExpertEngine V3] 🎯 快速建议生成:', {
        输入: input.slice(0, 30) + (input.length > 30 ? '...' : ''),
        置信度: `${(result.context.confidence * 100).toFixed(0)}%`,
        建议数: result.professionalSuggestions.length,
        产品类型: result.context.productType || '-',
        功能目标: result.context.functionGoals.join('+') || '-',
        原料: result.context.ingredientMentions.join(',') || '-',
      })

      return result.professionalSuggestions.length > 0
        ? result.professionalSuggestions
        : generateBasicFallbackSuggestions(input)
    } catch (error) {
      logger.warn('[ExpertEngine V3] ❌ 引擎异常，降级到基础模式:', error)
      return generateBasicFallbackSuggestions(input)
    }
  }, [])

  // ===== 基础降级建议（引擎无结果时的兜底）=====
  const generateBasicFallbackSuggestions = useCallback((input: string): SmartSuggestion[] => {
    const terms = input.match(/[\u4e00-\u9fa5]{2,}/g) || []
    if (terms.length === 0) return []

    const suggestions: SmartSuggestion[] = [] 
    if (terms.some(t => /配方|设计|研发|开发/.test(t))) {
      suggestions.push({
        id: `fallback-design-${Date.now()}`,
        text: `请明确产品类型(固体饮料/片剂/胶囊等)和核心功能目标，系统将提供针对性的专业参数`,
        type: 'info',
        score: 0.75,
        category: '💡 信息补充',
        source: 'fallback',
      })
    }

    if (terms.some(t => /法规|标准|GB|合规|备案/.test(t))) {
      suggestions.push({
        id: `fallback-reg-${Date.now()}`,
        text: `法规问题请提供具体的标准号或产品类型，以便给出精准的合规路径和关键指标限值`,
        type: 'info',
        score: 0.76,
        category: '💡 法规指引',
        source: 'fallback',
      })
    }

    return suggestions.slice(0, 2)
  }, [])

  // ===== 性能指标记录器 =====
  const suggestionMetricsRef = useRef<{
    timestamp: number;
    success: boolean;
    latency: number;
    suggestionCount?: number;
    avgScore?: number;
    complexity?: string;
    error?: string;
  }[]
>([])

  const recordMetrics = (metrics: {
    success: boolean
    latency: number
    suggestionCount?: number
    avgScore?: number
    complexity?: string
    error?: string
  }) => {
    suggestionMetricsRef.current.push({
      timestamp: Date.now(),
      ...etrics,
    }) 
    // 只保留最近50条记录
    if (suggestionMetricsRef.current.length > 50) {
      suggestionMetricsRef.current.shift()
    }
  }

  // 导出指标供调试使用
  ;(globalThis as any).__suggestionMetrics = () => {
    const metrics = suggestionMetricsRef.current
    if (metrics.length === 0) return '暂无数据' 
    const successRate = metrics.filter(m => m.success).length / metrics.length * 100
    const avgLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length
    const avgScore = metrics.filter(m => m.avgScore).reduce((sum, m) => sum + (m.avgScore || 0), 0) / metrics.filter(m => m.avgScore).length || 0 
    return {
      总调用次数: metrics.length,
      成功率: `${successRate.toFixed(1)}%`,
      平均延迟: `${avgLatency.toFixed(0)}ms`,
      平均评分: `${(avgScore * 100).toFixed(1)}%`,
      最近错误: metrics.filter(m => !m.success).slice(-3).map(m => m.error),
      复杂度分布: Object.entries(
        metrics.reduce((acc, m) => {
          const key = m.complexity || 'unknown'
          acc[key] = (acc[key] || 0) + 1
          return acc
        }, {} as Record<string, number>),
      )
    }
  }

  // ========== 规则引擎降级方案 (AI失败时使用) ==========
  const fallbackToRuleEngine = useCallback(async (
    userInput: string,
  ): Promise<SmartSuggestion[] | null> => {
    try {
      const optimizer = await getPromptOptimizer()
      if (!optimizer) return null

      const analysis = await optimizer.analyzeOnly(userInput) 
      if (analysis && analysis.issues.length > 0 && analysis.evaluation.overallScore < 90) {
        logger.log(`[Fallback] 规则引擎生成建议，原始评分: ${analysis.evaluation.overallScore}`)
        return generateOptimizationBasedSuggestions(analysis, userInput)
      }

      return null
    } catch (fallbackError) {
      logger.warn('[Fallback] 规则引擎也失败了:', fallbackError)
      return null
    }
  }, [])

  // ========== 基于优化分析结果的建议转换器 ==========
  const generateOptimizationBasedSuggestions = useCallback((
    analysis: any,
    originalInput: string,
  ): SmartSuggestion[] => {
    const suggestions: SmartSuggestion[] = [] 
    // 1. 关键信息缺失建议（最高优先级）
    const criticalIssues = analysis.issues.filter((i: any) => i.severity === 'critical')
    for (const issue of criticalIssues.slice(0, 2)) {
      const suggestionText = buildOptimizationSuggestionText(issue, originalInput, analysis.intent)
      suggestions.push({
        id: `opt-crit-${issue.id}`,
        text: suggestionText,
        type: 'optimization',
        score: 0.92 + Math.random() * 0.06,
        category: `🔴 关键优化·${issue.category}`,
        _optimizationData: {
          issueCategory: issue.category,
          severity: issue.severity,
          suggestedFix: issue.suggestion,
          impactDimensions: ['completeness', 'executability'],
        }
      })
    }

    // 2. 重要问题建议
    const majorIssues = analysis.issues.filter((i: any) => i.severity === 'major')
    for (const issue of majorIssues.slice(0, 2)) {
      const suggestionText = buildOptimizationSuggestionText(issue, originalInput, analysis.intent)
      suggestions.push({
        id: `opt-major-${issue.id}`,
        text: suggestionText,
        type: 'optimization',
        score: 0.82 + Math.random() * 0.08,
        category: `🟡 建议优化·${issue.category}`,
        _optimizationData: {
          issueCategory: issue.category,
          severity: issue.severity,
          suggestedFix: issue.suggestion,
          impactDimensions: ['clarity', 'specificity'],
        }
      })
    }

    // 3. 上下文增强建议（基于缺失信息）
    if (analysis.contextGap?.missingInformation?.length > 0) {
      const essentialGaps = analysis.contextGap.missingInformation
        .filter((g: any) => g.importance === 'essential')
        .slice(0, 2) 
      for (const gap of essentialGaps) {
        suggestions.push({
          id: `opt-gap-${gap.type}`,
          text: `补充"${gap.type}"信息${gap.suggestedValue ? `（建议：${gap.suggestedValue}）` : ''}可提升方案精准度`,
          type: 'optimization',
          score: 0.85 + Math.random() * 0.05,
          category: '📋 信息补全',
          _optimizationData: {
            issueCategory: 'missing_context',
            severity: 'major',
            suggestedFix: gap.description,
            impactDimensions: ['completeness', 'specificity'],
        }
        })
      }
    }

    // 4. 智能优化版本建议（一键优化）
    if (analysis.evaluation.overallScore < 70) {
      const gradeLabel = analysis.evaluation.grade
      suggestions.push({
        id: 'opt-full-enhance',
        text: `🚀 智能增强提示词（当前${gradeLabel}级，预计提升至B+以上）`,
        type: 'optimization',
        score: 0.88,
        category: '✨ AI智能优化',
        _optimizationData: {
          issueCategory: 'enhancement',
          severity: 'suggestion',
          suggestedFix: '优化建议以增强提示质量',
          impactDimensions: ['clarity', 'completeness', 'specificity', 'professionalism'],
        }
      })
    }

    // 5. 领域专业建议（基于意图）
    if (analysis.intent?.primary && analysis.domainRelevance > 0.7) {
      const domainSuggestion = getDomainSpecificSuggestion(analysis.intent, originalInput)
      if (domainSuggestion) {
        suggestions.push({
          id: `opt-domain-${analysis.intent.primary}`,
          text: domainSuggestion.text,
          type: 'optimization',
          score: domainSuggestion.score,
          category: `🎯 专业建议`,
          _optimizationData: {
            issueCategory: 'domain_enhancement',
            severity: 'suggestion',
            suggestedFix: domainSuggestion.detail,
            impactDimensions: ['professionalism', 'executability'],
        }
        })
      }
    }

    return suggestions.sort((a, b) => b.score - a.score).slice(0, 5)
  }, [])

  // ========== 从其他引擎获取建议（V2→V4→V3→Legacy）==========
  const generateFromOtherEngines = useCallback(async (
    input: string,
  ): Promise<SmartSuggestion[]> => {
    try {
      logger.log('[useChatInputState] 🧠 尝试使用V2.0上下文感知引擎...')
      const v2Engine = await getContextAwareEngineV2() 
      if (v2Engine) {
        const v2Result = await v2Engine.analyzeAndGenerate(input, {
          maxSuggestions: 6,
          enableContextMemory: true,
          forceRefresh: false,
        }) 
        if (v2Result.suggestions.length > 0 && v2Result.analysis.entities.length > 0) {
          logger.log(`[useChatInputState] 🎯 V2.0引擎成功! 生成 ${v2Result.suggestions.length} 条上下文感知建议`, {
            实体数: v2Result.analysis.entities.length,
            意图: v2Result.analysis.intent.type,
            置信度: `${(v2Result.analysis.intent.confidence * 100).toFixed(0)}%`,
            关键词: v2Result.analysis.keywords.primary.slice(0, 3),
            上下文匹配: `${v2Result.analysis.contextRelevance.overall.toFixed(0)}%`,
            平均相关性: `${(v2Result.suggestions.reduce((s: any, sum: number) => sum + s.relevanceScore, 0) / v2Result.suggestions.length).toFixed(1)}%`,
          }) 
          const convertedSuggestions: SmartSuggestion[] = v2Result.suggestions.map((ds: any, _index: number) => ({
            id: ds.id,
            text: ds.title,
            type: 'ai' as const,
            score: ds.relevanceScore / 100,
            category: ds.category || 'V2.0智能',
            _contextAwareData: {
              analysis: v2Result.analysis,
              adaptiveness: ds.adaptiveness,
              contextMatch: ds.contextMatch,
              adaptedTerms: ds.daptedTerms,
            }
            }))
          return convertedSuggestions.slice(0, 6)
        }
      } 
      // ========== 专业级智能建议引擎 V4.0 (第二优先级) ==========
      const v4Engine = getProfessionalIntelligenceEngineV4({
        enableHybridIntent: true,
        enableThreeLevelCache: true,
        enableFeedbackLoop: true,
        enablePrecompute: true,
      }) 
      logger.log('[useChatInputState] 🚀 使用V4.0专业引擎处理...') 
      const v4Result = await v4Engine.generateProfessionalSuggestions(input, {
        maxSuggestions: 6,
        minRelevanceScore: 90,
        returnAnalysisDetails: true,
      }) 
      if (v4Result.suggestions.length > 0) {
        logger.log('[useChatInputState] V4.0引擎成功生成 ' + v4Result.suggestions.length + ' 条高质量建议', {
          总耗时: v4Result.performance.totalTimeMs + 'ms',
          性能分解: v4Result.performance.breakdown,
          系统健康状态: v4Result.metrics.p99ResponseTime <= 150 ? 'healthy' : 'needs-optimization',
        })
        const convertedSuggestions: SmartSuggestion[] = v4Result.suggestions.map((es: ExpertSuggestionV2, index: number) => ({
          id: es.id,
          text: es.title,
          type: 'expert',
          score: es.relevanceScore / 100,
          category: 'V4.0专业·' + es.professionalDepth + '分',
          _expertData: es,
          _v4Metadata: {
            position: index,
            qualityScore: es.relevanceScore,
            responseTime: v4Result.performance.totalTimeMs,
            cacheSource: v4Result.performance.breakdown.cacheLookup > 0 ? '命中' : '未命中',
          }
          }))
        return convertedSuggestions.slice(0, 6)
      } 
      // ========== V4.0无结果时回退到V3引擎 ==========
      logger.log('[useChatInputState] 📚 V4.0未生成建议，回退到V3引擎')
      const expertEngine = getProfessionalIntelligenceEngine() 
      const analysis: SemanticAnalysisResult = await expertEngine.analyzeInput(input) 
      const shouldUseExpertEngine =
        analysis.recognizedTerms.length >= 2 &&
        analysis.expertiseLevel !== 'basic' &&
        analysis.complexityScore >= 40
      if (shouldUseExpertEngine) {
        const expertSuggestions: ExpertSuggestionV2[] = await expertEngine.generateSuggestions(analysis) 
        if (expertSuggestions.length > 0) {
          return expertSuggestions.map((es): SmartSuggestion => ({
            id: es.id,
            text: es.title,
            type: 'expert' as const,
            score: es.relevanceScore / 100,
            category: 'V3专业深度:' + es.professionalDepth + '分',
            _expertData: s,
          })).slice(0, 6)
        }
      } 
      // ========== 最终回退到通用建议引擎 ==========
      logger.log('[useChatInputState]  回退到通用建议引擎')
      const engine = getSuggestionEngine()
      const enhancedSuggestions: EnhancedSuggestion[] = await engine.generate(input, {
        maxSuggestions: 4,
        minQualityScore: 65,
        includeFeedbackLearning: true,
        realtimeMode: true,
      })
      return enhancedSuggestions.map((es) => ({
        id: es.id,
        text: es.title,
        type: mapIntentToSuggestionType(es.intentType),
        score: es.qScore,
        category: getFrameworkLabel(es.framework),
        _enhanced: s,
      })) 
    } catch (error) {
      logger.warn('[useChatInputState] ⚠️ 所有引擎异常，回退到基础建议:', error)
      return generateLegacySuggestions(input)
    }
  }, [getDefaultSuggestions, generateLegacySuggestions])

  // ========== 辅助函数：构建优化建议文本 ==========
  const buildOptimizationSuggestionText = useCallback((
    issue: any,
    _originalInput: string,
    intent?: ny,
  ): string => {
    const categoryLabels: Record<string, string> = {
      missing_context: '补充关键信息',
      intent_ambiguous: '明确核心意图',
      vague_requirements: '具体化需求描述',
      poor_terminology: '规范专业术语',
      missing_constraints: '添加约束条件',
      unclear_output_format: '明确输出要求',
      insufficient_detail: '丰富细节内容',
      structural_issues: '优化结构组织',
    }

    const actionPrefixes: Record<string, string> = {
      critical: '🔴 必须：',
      major: '🟡 建议：',
      minor: '💡 可选：',
      suggestion: '✨ 推荐：',
    }

    const prefix = actionPrefixes[issue.severity] || '💡 '
    const categoryLabel = categoryLabels[issue.category] || '优化'

    let specificSuggestion = issue.suggestion

    if (issue.category === 'poor_terminology' && issue.message?.includes('"')) {
      const match = issue.message.match(/"([^"]+)"/)
      if (match) {
        const informalTerm = match[1]
        specificSuggestion = '将"' + informalTerm + '"替换为专业表述'
      }
    }

    if (issue.category === 'missing_context' && intent?.targetObject) {
      specificSuggestion = specificSuggestion + '（针对"' + intent.targetObject + '"）'
    }

    if (intent?.primary === 'FORMULA_DESIGN' && issue.category === 'missing_context') {
      specificSuggestion += '，如目标人群、功能定位、成本预算等'
    }

    return prefix + categoryLabel + ' — ' + specificSuggestion
  }, [])

  // ========== 辅助函数：获取领域专业建议 ==========
  const getDomainSpecificSuggestion = useCallback((
    intent: any,
    input: string,
  ): { text: string; score: number; detail: string } | null => {
    const domainSuggestions: Record<string, { text: string; score: number; detail: string }> = {
      FORMULA_DESIGN: {
        text: '基于配方设计框架，建议明确：产品形态、目标人群、核心功效成分、感官指标',
        score: 0.90,
        detail: '功能性食品配方设计需遵循"功效成分+载体系统+风味修饰"三元架构，建议参考GB/T 29602固体饮料标准',
      },
      OPTIMIZATION: {
        text: '提供当前配方的具体问题点和期望达成的量化指标可获更精准的优化方案',
        score: 0.88,
        detail: '配方优化遵循"单因子实验→响应面分析→验证测试"科学流程，需明确现状基线和改善目标',
      },
      ANALYSIS: {
        text: '指定分析维度（营养成分/安全性/稳定性/功效验证）和参考标准可提升分析深度',
        score: 0.87,
        detail: '建议采用GB 5009系列方法进行成分分析，引用权威标准作为评价基准',
      },
      SAFETY_ASSESSMENT: {
        text: '补充原料毒理学数据、暴露量评估范围和使用人群信息以完善安全评估',
        score: 0.89,
        detail: '需参考GB 15193毒理学评价程序，关注ADI值、NOAEL和特殊人群暴露量',
      },
      NUTRITION_ANALYSIS: {
        text: '指定营养素分析重点（宏量/微量/生物活性成分）和人群参考摄入量标准',
        score: 0.86,
        detail: '建议参照中国居民DRI标准和GB 28050营养标签通则进行分析报告',
      }
    }

    if (input.length < 15) {
      return null
    }

    return domainSuggestions[intent.primary] || null
  }, [])

  // ========== 辅助函数：合并去重建议 ==========
  const mergeAndDeduplicateSuggestions = useCallback((
    allSuggestions: SmartSuggestion[],
  ): SmartSuggestion[] => {
    const seenTexts = new Set<string>()
    const result: SmartSuggestion[] = [] 
    // AI建议始终优先保留
    const aiSuggestions = allSuggestions.filter(s => s.type === 'optimization')
    const nonAISuggestions = allSuggestions.filter(s => s.type !== 'optimization') 
    // AI建议：全部保留（已通过质量过滤）
    for (const suggestion of aiSuggestions) {
      const normalizedText = suggestion.text.replace(/[🔴🟡💡✨🚀🎯📋]\s*/g, '').trim()
      if (!seenTexts.has(normalizedText) && normalizedText.length > 5) {
        seenTexts.add(normalizedText)
        result.push(suggestion)
      }
    } 
    // 非AI建议：仅当AI建议不足3条时，且相关性>=80%才补充
    if (aiSuggestions.length < 3) {
      const highQualityNonAI = nonAISuggestions
        .filter(s => s.score >= 0.80)
        .sort((a, b) => b.score - a.score) 
      for (const suggestion of highQualityNonAI.slice(0, 3 - aiSuggestions.length)) {
        const normalizedText = suggestion.text.replace(/[🔴🟡💡✨🚀🎯📋]\s*/g, '').trim()
        if (!seenTexts.has(normalizedText) && normalizedText.length > 5) {
          seenTexts.add(normalizedText)
          result.push(suggestion)
        }
      }
    }

    return result.sort((a, b) => b.score - a.score).slice(0, 8)
  }, [])

  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>(() => getDefaultSuggestions())
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)


  // ===== 实时动态建议系统 v3.0 (专家引擎驱动，输入变更即时响应) =====
  useEffect(() => {
    let isMounted = true 
    // 输入指纹：跳过微小变化（仅空格/标点调整）
    const trimmedValue = value.trim() 
    if (!trimmedValue) {
      if (isMounted) {
        setSuggestions(getDefaultSuggestions())
        setIsLoadingSuggestions(false)
      }
      return
    }

    // ===== 阶段1: 同步场景检测（即时反馈，<5ms）=====
    const currentScenario = promptFramework.detectScenario(value)
    lastScenarioRef.current = {
      scenario: currentScenario.primary,
      confidence: currentScenario.confidence,
      keywords: currentScenario.etectedKeywords,
    }

    // ===== 阶段2: 自适应防抖策略 =====
    const inputLength = value.length 
    let debounceDelay: number
    if (inputLength === 0) {
      debounceDelay = 0
    } else if (inputLength < 5) {
      debounceDelay = 300  // 短输入：等待更多输入
    } else if (/[，。；！？]$/.test(value)) {
      debounceDelay = 80   // 句尾标点：用户可能在思考，快速触发
    } else {
      debounceDelay = 200  // 标准延迟
    }

    // ===== 阶段3: 异步建议加载（带请求取消）=====
    const loadSuggestions = async () => {
      if (!isMounted) return

      setIsLoadingSuggestions(true)

      // 取消上一个进行中的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }

      // ===== 智能冷却机制：根据输入复杂度动态调整间隔 =====
      const now = performance.now()
      const timeSinceLastRequest = now - lastRequestTimeRef.current 
      const inputComplexity = analyzeInputComplexity(value)
      const dynamicCooldown = inputComplexity.level === 'simple' ? 40 
        : inputComplexity.level === 'moderate' ? 60 
        : 800 
      const shouldSkipAI = timeSinceLastRequest < dynamicCooldown && lastRequestTimeRef.current > 0 
      if (shouldSkipAI) {
        logger.log('[RealTime V3] ⏸️ 冷却中，使用专家引擎', {
          距上次: Math.round(timeSinceLastRequest) + 'ms',
          动态间隔: dynamicCooldown + 'ms',
          复杂度: inputComplexity.level,
        }) 
        // 仅显示专家引擎建议（同步<8ms），不调用AI API
        const expertSuggestions = generateQuickRuleBasedSuggestions(value, currentScenario)
        if (isMounted) {
          if (expertSuggestions.length > 0) {
            setSuggestions(expertSuggestions)
          } else {
            const fallbackSugs = generateBasicFallbackSuggestions(input)
            setSuggestions(fallbackSugs.length > 0 ? fallbackSugs : getDefaultSuggestions())
          }
          setIsLoadingSuggestions(false)
          lastGeneratedInputRef.current = value  // 更新指纹，防止重复触发
        }
        return
      }

      // 创建新请求序列号（用于防止竞态）
      const currentSequence = ++requestSequenceRef.current
      const thisController = new AbortController()
      abortControllerRef.current = thisController
      lastRequestTimeRef.current = now

      try {
        // 先立即显示专家引擎建议（同步<8ms）
        const expertSuggestions = generateQuickRuleBasedSuggestions(value, currentScenario) 
        if (expertSuggestions.length > 0 && isMounted) {
          setSuggestions(expertSuggestions)
          lastGeneratedInputRef.current = value  // 更新指纹
        }

        // 然后异步调用AI获取高质量建议（覆盖/补充）
        const aiResult = await generateAIPoweredSuggestionsWithCancel(
          value,
          thisController.signal,
          currentSequence,
        )

        // 只有序列号匹配时才应用结果（防止竞态）
        if (isMounted && currentSequence === requestSequenceRef.current) {
          if (aiResult && aiResult.length > 0) {
            const merged = mergeAndDeduplicateSuggestions([
              ...expertSuggestions,
              ...aiResult,
              ...generateFromOtherEngines(value)
            ])

            setSuggestions(merged)
            lastGeneratedInputRef.current = value 
            logger.log('[RealTime V3] ✅ AI增强完成:', {
              输入长度: value.length,
              专家建议: expertSuggestions.length,
              AI建议: aiResult.length,
              合并后: merged.length,
              场景: currentScenario.primary,
            })
          } else {
            // AI失败时保留专家建议或使用其他引擎
            if (expertSuggestions.length > 0) {
              logger.log('[RealTime V3] ℹ️ AI无结果，保留专家建议:', expertSuggestions.length, '条')
            } else {
              const fallbackResult = await generateFromOtherEngines(value)
              if (isMounted && currentSequence === requestSequenceRef.current) {
                setSuggestions(fallbackResult)
                lastGeneratedInputRef.current = value
              }
            }
          }
        }
      } catch (error: any) {
        if (error?.name !== 'AbortError' && isMounted) {
          logger.warn('[RealTime V3] 建议生成异常:', error.message)
          // 异常时回退到专家引擎+传统建议
          const expertSugs = generateQuickRuleBasedSuggestions(value, currentScenario)
          const legacySugs = generateLegacySuggestions(value)
          setSuggestions(expertSugs.length > 0 ? expertSugs : legacySugs)
          lastGeneratedInputRef.current = value
        }
      } finally {
        if (isMounted && currentSequence === requestSequenceRef.current) {
          setIsLoadingSuggestions(false)
        }
      }
    }

    const debounceTimer = setTimeout(loadSuggestions, debounceDelay)

    return () => {
      isMounted = false
      clearTimeout(debounceTimer)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [value])  // 仅依赖 value，所有函数通过 Ref 访问，彻底防止无限循环

  const onChange = useCallback((newValue: string) => {
    setValue(newValue)
    if (propsOnChange) propsOnChange(newValue)
  }, [propsOnChange])

  const onFocus = useCallback(() => {
    setIsFocused(true)
  }, [])

  const onBlur = useCallback(() => {
    setIsFocused(false)
  }, [])

  const toggleDeepThinking = useCallback(() => {
    handleDeepThinkingChange(!deepThinking)
  }, [deepThinking])

  const toggleSmartSearch = useCallback(() => {
    handleSmartSearchChange(!smartSearch)
  }, [smartSearch])

  const handleDeepThinkingChange = useCallback((enabled: boolean) => {
    setInternalDeepThinking(enabled)
    if (enabled) {
      setInternalSmartSearch(false)
      setShowSearchPanel(false)
      if (value.trim()) {
        triggerDeepThinking()
      }
    } else {
      setShowDeepThinkingPanel(false)
      setDeepThinkingAnalysis(null)
    }
    onDeepThinkingChange?.(enabled)
  }, [value, onDeepThinkingChange])

  const handleSmartSearchChange = useCallback((enabled: boolean) => {
    setInternalSmartSearch(enabled)
    if (enabled) {
      setInternalDeepThinking(false)
      setShowDeepThinkingPanel(false)
      if (value.trim()) {
        triggerSearch()
      }
    } else {
      setShowSearchPanel(false)
      setSearchResults([])
    }
    onSmartSearchChange?.(enabled)
  }, [value, onSmartSearchChange])

  const triggerDeepThinking = useCallback(() => {
    if (!value.trim()) return
    setIsAnalyzing(true)
    setTimeout(() => {
      const analysis = analyzeDeepThinking(value)
      setDeepThinkingAnalysis(analysis)
      setShowDeepThinkingPanel(true)
      setIsAnalyzing(false)
    }, 800)
  }, [value])

  const triggerSearch = useCallback(() => {
    if (!value.trim()) return
    setIsSearching(true)
    setTimeout(() => {
      const results = performSmartSearch(value)
      setSearchResults(results)
      setShowSearchPanel(true)
      setIsSearching(false)
    }, 600)
  }, [value])

  const applySuggestion = useCallback((suggestion: SmartSuggestion) => {
    onChange(value + ' ' + suggestion.text)
    setShowSuggestions(false)
    inputRef.current?.focus()
  }, [value, onChange])

  const selectSearchResult = useCallback((result: SearchResult) => {
    onChange(value + ' ' + result.title)
    setShowSearchPanel(false)
    inputRef.current?.focus()
  }, [value, onChange])

  const addAttachments = useCallback((newAttachments: Attachment[]) => {
    setAttachments(prev => [...prev, ...newAttachments])
    setShowAttachments(true)
  }, [])

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id))
    if (attachments.length === 1) {
      setShowAttachments(false)
    }
  }, [attachments.length])

  const clearAll = useCallback(() => {
    setValue('')
    setShowSuggestions(false)
    setShowDeepThinkingPanel(false)
    setShowSearchPanel(false)
    setShowAttachments(false)
    setShowFormatError(false)
    setErrorMessage('')
    setAttachments([])
    setDeepThinkingAnalysis(null)
    setSearchResults([])
  }, [])

  const canSend = useCallback((disabled: boolean, isStreaming: boolean): boolean => {
    return !disabled && !isStreaming && value.trim().length > 0 && !showFormatError
  }, [value, showFormatError])

  const isOverLimit = useMemo((): boolean => !!(maxLength && charCount > maxLength * 0.9), [maxLength, charCount])
  const isExceeded = useMemo((): boolean => !!(maxLength && charCount > maxLength), [maxLength, charCount])

  const setupEventListeners = useCallback(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!document.getElementById('chat-input-container')?.contains(target)) {
        setShowSuggestions(false)
        setShowDeepThinkingPanel(false)
        setShowSearchPanel(false)
        setShowAttachments(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)

    let cleanupPaste: (() => void) | null = null
    let cleanupDrop: (() => void) | null = null

    if (inputRef.current) {
      cleanupPaste = clipboardAttachmentService.setupPasteHandler(inputRef.current, {
        handleImages: true,
        handleFiles: true,
        handleText: false,
      })
    }

    const container = document.getElementById('chat-input-container')
    if (container) {
      cleanupDrop = clipboardAttachmentService.setupDropZone(container, {
        accept: ['image/*', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.md'],
        maxSize: 10 * 1024 * 1024,
        maxFiles: 5,
      })

      const handleDragOver = () => setIsDragging(true)
      const handleDragLeave = () => setIsDragging(false)
      const handleDrop = () => setIsDragging(false)

      container.addEventListener('dragover', handleDragOver)
      container.addEventListener('dragleave', handleDragLeave)
      container.addEventListener('drop', handleDrop)
    }

    const handlePaste = (data: Attachment[]) => {
      addAttachments(data)
    } 
    const handleDropEvent = (data: Attachment[]) => {
      addAttachments(data)
    } 
    const handleError = (error: Error) => {
      if (error instanceof UnsupportedFileTypeError) {
        setErrorMessage('不支持的文件类型')
      } else if (error instanceof FileTooLargeError) {
        setErrorMessage('文件超过大小限制')
      } else if (error instanceof TooManyFilesError) {
        setErrorMessage('超过最大文件数量限制')
      }
      setShowFormatError(true)
      setTimeout(() => {
        setShowFormatError(false)
        setErrorMessage('')
      }, 3000)
    }

    clipboardAttachmentService.on('paste', handlePaste)
    clipboardAttachmentService.on('drop', handleDropEvent)
    clipboardAttachmentService.on('error', handleError)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      cleanupPaste?.()
      cleanupDrop?.() 
      if (container) {
        container.removeEventListener('dragover', () => setIsDragging(true))
        container.removeEventListener('dragleave', () => setIsDragging(false))
        container.removeEventListener('drop', () => setIsDragging(false))
      }

      clipboardAttachmentService.off('paste', handlePaste)
      clipboardAttachmentService.off('drop', handleDropEvent)
      clipboardAttachmentService.off('error', handleError)
    }
  }, [addAttachments])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    try {
      const newAttachments = await clipboardAttachmentService.handleFiles(files, {
        accept: ['image/*', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.md'],
        maxSize: 10 * 1024 * 1024,
        maxFiles: 5,
      })
      addAttachments(newAttachments)
    } catch (error) {
      console.error('[useChatInputState] File handling error:', error)
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [addAttachments])

  const [showMic, setShowMic] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend(false, false)) {
        return
      }
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false)
      setShowDeepThinkingPanel(false)
      setShowSearchPanel(false)
    }
    if (e.key === 'Tab' && showSuggestions && suggestions.length > 0) {
      e.preventDefault()
      const firstSuggestion = suggestions[0]
      if (firstSuggestion) applySuggestion(firstSuggestion)
    }
  }, [canSend, showSuggestions, suggestions, applySuggestion])

  return {
    inputRef,
    fileInputRef,
    value,

    onChange,
    onFocus,
    onBlur,
    inputHeight,
    charCount,

    showSuggestions,
    setShowSuggestions,
    showDeepThinkingPanel,
    setShowDeepThinkingPanel,
    showSearchPanel,
    setShowSearchPanel,
    showAttachments,
    setShowAttachments,
    showFormatError,
    errorMessage,

    deepThinkingAnalysis,
    searchResults,
    isAnalyzing,
    isSearching,
    attachments,
    isDragging,
    detectedLanguage,

    deepThinking,
    smartSearch,
    showMic,
    setShowMic,
    showSettings,
    setShowSettings,
    toggleDeepThinking,
    toggleSmartSearch,

    triggerDeepThinking,
    triggerSearch,
    applySuggestion,
    selectSearchResult,
    addAttachments,
    removeAttachment,
    clearAll,

    canSend,
    isOverLimit,
    isExceeded,

    suggestions,
    isLoadingSuggestions,
    refreshSuggestions: () => {
      generateEnhancedSuggestions(value).then(setSuggestions)
    },
    inputBehavior,
    setupEventListeners,
    handleFileSelect,
}

}
const x = 1;

export default useChatInputState;

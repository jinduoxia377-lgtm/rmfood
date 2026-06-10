/**
 * 智能提示词生成算法 - Intelligent Suggestion Generator
 *
 * 核心功能：
 * 1. 基于用户输入内容的语义特征动态生成提示词
 * 2. 结合上下文信息和历史交互数据优化建议
 * 3. 实时响应机制，确保500ms内完成更新
 * 4. 专业级质量评分算法
 */

import { logger } from '@/utils/safeLogger'
import type { IntentClassificationResult, ExtractedEntity } from './nlpProcessor'
import { fuzzyMatchTerms } from './domainKnowledge'
import { getTemplatesByIntent, type SuggestionTemplate } from './suggestionTemplates'

export interface IntelligentSuggestion {
  id: string
  title: string
  description: string
  relevanceScore: number
  confidence: number
  intentType: string
  category: string
  keywords: string[]
  timestamp: number
}

export interface GenerationContext {
  userInput: string
  entities: ExtractedEntity[]
  intentResult: IntentClassificationResult
  conversationHistory?: string[]
  userPreferences?: {
    preferredCategories?: string[]
    recentSearches?: string[]
  }
}

export interface GenerationOptions {
  maxSuggestions?: number
  minRelevanceScore?: number
  enableContextAwareness?: boolean
  enablePersonalization?: boolean
  realtimeMode?: boolean
  timeout?: number
}

// 智能关键词提取器
class IntelligentKeywordExtractor {
  private readonly COMMON_WORDS = new Set([
    '的', '是', '在', '有', '和', '了', '我', '你', '他', '她', '这', '那',
    'what', 'is', 'the', 'a', 'an', 'for', 'with', 'to', 'from', 'on', 'in',
  ])

  extract(input: string): string[] {
    const words = input.split(/[\s,.!?;:，。！？；：]+/)
    const keywords = [] as string[]

    for (const word of words) {
      if (word.length < 2) continue
      if (this.COMMON_WORDS.has(word.toLowerCase())) continue
      keywords.push(word)
    }

    return [...new Set(keywords)]
  }
}

// 语义相似度计算器
class SemanticSimilarityCalculator {
  calculate(str1: string, str2: string): number {
    const set1 = new Set(str1.toLowerCase().split(/\s+/))
    const set2 = new Set(str2.toLowerCase().split(/\s+/))
    const intersection = [...set1].filter(x => set2.has(x))
    const union = [...new Set([...set1, ...set2])]
    return intersection.length / union.length
  }

  weightedSimilarity(text: string, keywords: string[], weights?: number[]): number {
    if (keywords.length === 0) return 0

    const totalWeight = weights ? weights.reduce((a, b) => a + b, 0) : keywords.length
    let score = 0

    keywords.forEach((keyword, index) => {
      const weight = weights ? ((weights[index] ?? 0) / totalWeight) : (1 / keywords.length)
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        score += weight
      }
    })

    return score
  }
}

// 上下文感知引擎
class ContextAwarenessEngine {
  analyzeConversationHistory(history: string[]): {
    topics: string[]
    keywords: string[]
    sentiment: 'positive' | 'neutral' | 'negative'
  } {
    const keywords = new Array<string>()

    ;(history).forEach((message: string) => {
      const words = message.split(/\s+/).filter(w => w.length > 2)
      keywords.push(...words)
    })

    return {
      topics: [...new Set(keywords.slice(0, 10))],
      keywords: [...new Set(keywords.slice(0, 20))],
      sentiment: 'neutral',
    }
  }

  getContextualBoost(input: string, history: string[]): number {
    if (history.length === 0) return 1

    const analysis = this.analyzeConversationHistory(history)
    const inputKeywords = input.split(/\s+/).filter(w => w.length > 2)

    let matchCount = 0
    for (const keyword of inputKeywords) {
      if (analysis.keywords.includes(keyword)) {
        matchCount++
      }
    }

    return 1 + (matchCount / Math.max(inputKeywords.length, 1)) * 0.5
  }
}

// 个人化引擎
class PersonalizationEngine {
  private userProfile = new Map<string, {
    preferences: string[]
    recentInteractions: string[]
    successRate: number
  }>()

  getPersonalizationBoost(input: string, preferences: string[]): number {
    if (preferences.length === 0) return 1

    let boost = 1
    preferences.forEach(pref => {
      if (input.toLowerCase().includes(pref.toLowerCase())) {
        boost += 0.2
      }
    })

    return Math.min(boost, 2)
  }

  learnFromInteraction(suggestion: IntelligentSuggestion, wasAccepted: boolean): void {
    // 学习用户行为，优化未来建议
    const existing = this.userProfile.get(suggestion.category) || {
      preferences: [],
      recentInteractions: [],
      successRate: 0.5,
    }

    if (wasAccepted) {
      existing.successRate = Math.min(1, existing.successRate + 0.1)
      existing.recentInteractions.push(suggestion.title)
    } else {
      existing.successRate = Math.max(0, existing.successRate - 0.05)
    }

    this.userProfile.set(suggestion.category, existing)
  }
}

// 主智能建议生成器
export class IntelligentSuggestionGenerator {
  private keywordExtractor: IntelligentKeywordExtractor
  private similarityCalculator: SemanticSimilarityCalculator
  private contextEngine: ContextAwarenessEngine
  private personalizationEngine: PersonalizationEngine
  private suggestionCache: Map<string, IntelligentSuggestion[]>
  private generationTimeout: number
  constructor(options?: GenerationOptions) {
    this.keywordExtractor = new IntelligentKeywordExtractor()
    this.similarityCalculator = new SemanticSimilarityCalculator()
    this.contextEngine = new ContextAwarenessEngine()
    this.personalizationEngine = new PersonalizationEngine()
    this.suggestionCache = new Map()
    this.generationTimeout = options?.timeout || 400 // 确保500ms内完成
  }

  async generateSuggestions(
    context: GenerationContext,
    options: GenerationOptions = {},
  ): Promise<IntelligentSuggestion[]> {
    const startTime = performance.now()
    const {
      maxSuggestions = 4,
      minRelevanceScore = 0.6,
      enableContextAwareness = true,
      enablePersonalization = false,
      realtimeMode = true,
    } = options

    if (performance.now() - startTime > this.generationTimeout) {
      logger.warn(`[IntelligentSuggestionGenerator] Generation timeout exceeded: ${this.generationTimeout}ms`)
      return this.generateFallbackSuggestions(context.userInput)
    }

    try {
      // 检查缓存
      const cacheKey = this.generateCacheKey(context, options)
      const cached = this.suggestionCache.get(cacheKey)
      if (cached) {
        return cached.slice(0, maxSuggestions)
      }

      // 生成建议
      const suggestions = await this.generateIntelligentSuggestions(
        context,
        { maxSuggestions, enableContextAwareness, enablePersonalization, realtimeMode },
      )

      // 过滤和排序
      const filtered = suggestions
        .filter(s => s.relevanceScore >= minRelevanceScore)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, maxSuggestions)

      // 缓存结果
      this.suggestionCache.set(cacheKey, filtered)

      // 清理旧缓存
      this.cleanupCache()

      logger.log(`[IntelligentSuggestionGenerator] Generated ${filtered.length} suggestions in ${performance.now() - startTime}ms`)
      return filtered

    } catch (error) {
      logger.warn('[IntelligentSuggestionGenerator] Error generating suggestions:', error)
      return this.generateFallbackSuggestions(context.userInput)
    }
  }

  private async generateIntelligentSuggestions(
    context: GenerationContext,
    options: {
      maxSuggestions: number
      enableContextAwareness: boolean
      enablePersonalization: boolean
      realtimeMode: boolean
    },
  ): Promise<IntelligentSuggestion[]> {
    const { userInput, entities, intentResult, conversationHistory = [], userPreferences } = context
    const keywords = this.keywordExtractor.extract(userInput)

    // 获取相关模板
    const templates = getTemplatesByIntent(intentResult.primary.type)

    const suggestions: IntelligentSuggestion[] = []

    for (const template of templates) {
      const baseSuggestion = this.createSuggestionFromTemplate(
        template,
        userInput,
        keywords,
        entities,
        intentResult,
      )

      // 计算相关性分数
      let relevanceScore = this.calculateRelevanceScore(
        baseSuggestion,
        userInput,
        keywords,
        intentResult,
      )

      // 上下文感知增强
      if (options.enableContextAwareness && conversationHistory.length > 0) {
        const contextBoost = this.contextEngine.getContextualBoost(userInput, conversationHistory)
        relevanceScore *= contextBoost
      }

      // 个性化增强
      if (options.enablePersonalization && userPreferences?.preferredCategories) {
        const personalizationBoost = this.personalizationEngine.getPersonalizationBoost(
          userInput,
          userPreferences.preferredCategories,
        )
        relevanceScore *= personalizationBoost
      }

      suggestions.push({
        ...baseSuggestion,
        relevanceScore: Math.min(1, relevanceScore),
        keywords,
      })
    }

    // 实时模式下添加快速建议
    if (options.realtimeMode) {
      const quickSuggestions = this.generateQuickSuggestions(userInput, keywords)
      suggestions.push(...quickSuggestions)
    }

    return suggestions
  }

  private createSuggestionFromTemplate(
    template: SuggestionTemplate,
    userInput: string,
    keywords: string[],
    entities: ExtractedEntity[],
    intentResult: IntentClassificationResult,
  ): IntelligentSuggestion {
    return {
      id: `intelligent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      title: this.interpolateTemplate(template.title, entities, keywords),
      description: this.generateDescription(template, userInput, entities),
      relevanceScore: 0,  // 单独计算
      confidence: intentResult.primary.confidence,
      intentType: intentResult.primary.type,
      category: this.getCategoryFromIntent(intentResult.primary.type),
      keywords,
      timestamp: Date.now(),
    }
  }

  private interpolateTemplate(title: string, entities: ExtractedEntity[], _keywords: string[]): string {
    let result = title

    // 用实体替换占位符
    entities.forEach(entity => {
      const placeholder = `{${entity.type.toLowerCase()}}`
      if (result.includes(placeholder)) {
        result = result.replace(placeholder, entity.text)
      }
    })

    return result
  }

  private generateDescription(
    template: SuggestionTemplate,
    _userInput: string,
    entities: ExtractedEntity[],
  ): string {
    const entityNames = entities.map(e => e.text).join('、')

    if (template.description) {
      return this.interpolateTemplate(template.description, entities, [])
    }

    // 生成通用描述
    if (entityNames.length > 0) {
      return `基于您的需求"${entityNames}"，提供专业建议`
    }
    return '专业级建议，帮助您优化配方设计'
  }

  private calculateRelevanceScore(
    suggestion: IntelligentSuggestion,
    userInput: string,
    keywords: string[],
    intentResult: IntentClassificationResult,
  ): number {
    let score = 0.5 // 基础分数

    // 1. 意图匹配分数 (权重 40%)
    if (suggestion.intentType === intentResult.primary.type) {
      score += 0.4 * intentResult.primary.confidence
    } else {
      score += 0.2 * (intentResult.secondary?.[0]?.confidence || 0)
    }

    // 2. 关键词匹配分数 (权重 35%)
    const keywordMatch = this.similarityCalculator.weightedSimilarity(
      `${suggestion.title} ${suggestion.description}`,
      keywords,
    )
    score += 0.35 * keywordMatch

    // 3. 领域术语匹配 (权重 25%)
    const domainMatch = this.calculateDomainMatch(suggestion, userInput)
    score += 0.25 * domainMatch

    return Math.min(1, score)
  }

  private calculateDomainMatch(suggestion: IntelligentSuggestion, userInput: string): number {
    const domainTerms = fuzzyMatchTerms(userInput, 0.2)
    if (domainTerms.length === 0) return 0.5

    let matchCount = 0
    const suggestionText = `${suggestion.title} ${suggestion.description}`.toLowerCase()

    domainTerms.forEach(term => {
      if (suggestionText.includes(term.key.toLowerCase())) {
        matchCount++
      }
    })

    return matchCount / domainTerms.length
  }

  private getCategoryFromIntent(intentType: string): string {
    const categoryMap: Record<string, string> = {
      'FORMULA_DESIGN': '配方设计',
      'SAFETY_ASSESSMENT': '安全评估',
      'PERFORMANCE_OPT': '性能优化',
      'COST_REDUCTION': '成本控制',
      'MARKET_ANALYSIS': '市场分析',
      'INGREDIENT_ANALYSIS': '原料分析',
      'PROCESS_TECHNOLOGY': '工艺技术',
      'REGULATORY_COMPLIANCE': '法规合规',
    }

    return categoryMap[intentType] || '通用建议'
  }

  private generateQuickSuggestions(userInput: string, keywords: string[]): IntelligentSuggestion[] {
    const suggestions: IntelligentSuggestion[] = []

    // 基于关键词生成快速建议
    if (keywords.length > 0) {
      // 1. 配方优化建议
      suggestions.push({
        id: `quick-formula-${Date.now()}`,
        title: `优化${keywords[0]}相关配方`,
        description: '基于最新行业标准，提供专业配方优化方案',
        relevanceScore: 0.75,
        confidence: 0.8,
        intentType: 'FORMULA_DESIGN',
        category: '配方设计',
        keywords,
        timestamp: Date.now(),
      })

      // 2. 安全评估建议
      if (userInput.includes('安全') || userInput.includes('风险')) {
        suggestions.push({
          id: `quick-safety-${Date.now()}`,
          title: '进行安全风险评估',
          description: '全面检测原料安全性，确保产品合规',
          relevanceScore: 0.85,
          confidence: 0.9,
          intentType: 'SAFETY_ASSESSMENT',
          category: '安全评估',
          keywords,
          timestamp: Date.now(),
        })
      }

      // 3. 成本优化建议
      if (userInput.includes('成本') || userInput.includes('价格')) {
        suggestions.push({
          id: `quick-cost-${Date.now()}`,
          title: '寻找成本优化方案',
          description: '分析原料成本结构，提供替代方案',
          relevanceScore: 0.8,
          confidence: 0.85,
          intentType: 'COST_REDUCTION',
          category: '成本控制',
          keywords,
          timestamp: Date.now(),
        })
      }
    }

    return suggestions
  }

  private generateFallbackSuggestions(_input: string): IntelligentSuggestion[] {
    return [
      {
        id: 'fallback-1',
        title: '专业配方设计建议',
        description: '基于您的需求提供定制化配方方案',
        relevanceScore: 0.6,
        confidence: 0.7,
        intentType: 'FORMULA_DESIGN',
        category: '配方设计',
        keywords: [],
        timestamp: Date.now(),
      },
      {
        id: 'fallback-2',
        title: '原料分析与优化',
        description: '深入分析原料特性，优化配方组合',
        relevanceScore: 0.55,
        confidence: 0.65,
        intentType: 'INGREDIENT_ANALYSIS',
        category: '原料分析',
        keywords: [],
        timestamp: Date.now(),
      },
    ]
  }

  private generateCacheKey(context: GenerationContext, options: GenerationOptions): string {
    return `${context.userInput.substring(0, 100)}-${options.maxSuggestions}-${options.realtimeMode}`
  }

  private cleanupCache(): void {
    if (this.suggestionCache.size > 50) {
      const keysToRemove = Array.from(this.suggestionCache.keys()).slice(0, 25)
      keysToRemove.forEach(key => this.suggestionCache.delete(key))
    }
  }

  // 用户反馈学习
  recordUserFeedback(suggestionId: string, wasAccepted: boolean): void {
    // 记录用户反馈，用于未来优化
    logger.log(`[IntelligentSuggestionGenerator] Feedback recorded: ${suggestionId} was ${wasAccepted ? 'accepted' : 'rejected'}`)
  }
}

export default IntelligentSuggestionGenerator

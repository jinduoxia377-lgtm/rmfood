// ===== 完全内联类型定义（避免 ai.types.ts 导出问题）=====

import { logger } from '@/utils/safeLogger'
import { sentimentEngine, EmotionResult } from './sentimentEngine'

type IntentType =
  | 'greeting' | 'formula_inquiry' | 'ingredient_query' | 'dosage_inquiry'
  | 'safety_review' | 'regulation_inquiry' | 'cost_analysis' | 'synergy_analysis'
  | 'comparison' | 'optimization_request' | 'general_inquiry'
  | 'feedback_positive' | 'feedback_negative' | 'clarification'
  | 'topic_change' | 'farewell'
  | 'interaction_check' | 'evidence_inquiry' | 'sensory_adjustment'
  | 'storage_advice' | 'supply_chain'
  // 大写别名（规则引擎内部使用，保持向后兼容）
  | 'FORMULA_DESIGN' | 'SAFETY_ASSESSMENT' | 'INGREDIENT_QUERY'
  | 'DOSAGE_INQUIRY' | 'REGULATION_INQUIRY' | 'COST_ANALYSIS'
  | 'SYNERGY_ANALYSIS' | 'COMPARISON' | 'OPTIMIZATION_REQUEST'
  | 'GENERAL_INQUIRY' | 'FEEDBACK_POSITIVE' | 'FEEDBACK_NEGATIVE'
  // 额外规则中使用的意图值
  | 'EFFICACY_EVALUATION' | 'FORMULA_OPTIMIZATION' | 'REGULATORY_QUERY'
  | 'QUALITY_CONTROL'
  // scenarioSwitcher 引用的意图值（含小写格式）
  | 'formula_design' | 'efficacy_enhancement' | 'pregnancy_safety'
  | 'toxicity_check' | 'taste_modifier' | 'texture_adjustment'
  | 'stability_improvement' | 'aroma_enhancement' | 'shelf_life'
  | 'packaging_requirement'

type SubIntent =
  | 'single_ingredient' | 'multi_ingredient' | 'specific_dosage' | 'dosage_range'
  | 'toxicity_check' | 'interaction_check' | 'pregnancy_safety'
  | 'efficacy_enhancement' | 'taste_optimization' | 'stability_improvement'
  | 'cost_reduction' | 'regulatory_compliance' | 'general'
  | 'drug_food_interaction' | 'herb_contraindication' | 'nutrient_antagonism'
  | 'clinical_trial' | 'mechanism_study' | 'meta_analysis'
  | 'taste_modifier' | 'texture_adjustment' | 'aroma_enhancement'
  | 'shelf_life' | 'storage_condition' | 'packaging_requirement'
  | 'sourcing' | 'quality_spec' | 'supplier_evaluation'
  | 'functional_food'
  // 额外规则中使用的子意图值
  | 'cost_optimization' | 'functional_claim' | 'ingredient_substitution'
  | 'standard_lookup' | 'system_certification' | 'explanation_request'
  | 'dosage_inquiry'

interface IntentDetectionResult {
  primaryIntent: IntentType
  confidence: number
  subIntents?: SubIntent[]
  method: string
  processingTime?: number
  /** 候选意图列表（置信度较低的备选） */
  alternativeIntents?: { intent: IntentType; confidence: number }[]
  entities?: {
    type: string
    text: string
    confidence: number
    position?: [number, number]
  }[]
  sentiment?: {
    sentiment: 'positive' | 'negative' | 'neutral'
    score: number
    /** 细粒度情感数据（SentimentEngine 集成后可用） */
    primaryEmotion?: string
    intensity?: number
  }
  originalText?: string
}

/** 导出意图检测结果类型供外部使用 */
export type { IntentType, SubIntent, IntentDetectionResult }

// ===== 核心实现 =====

interface IntentRule {
  pattern: RegExp
  intent: IntentType
  subIntent?: SubIntent
  confidence: number
  priority: number
  description: string
}

interface IntentTemplate {
  id: string
  intent: IntentType
  subIntent?: SubIntent
  template: string
  keywords: string[]
  category: string
  examples: string[]
}

interface SemanticMatch {
  intent: IntentType
  subIntent?: SubIntent
  score: number
  matchedTemplate: string
  method: 'exact' | 'keyword' | 'semantic'
}

export class HybridNLPEngineV2 {
  private rules: IntentRule[] = []
  private templates: IntentTemplate[] = []
  private isInitialized = false
  private initFailed = false
  private cache = new Map<string, IntentDetectionResult>()
  private maxCacheSize = 100

  /** 命名常量：置信度阈值（替代魔法数字） */
  private static readonly RULE_HIGH_CONFIDENCE = 0.85
  private static readonly SEMANTIC_MIN_SCORE = 0.6
  private static readonly MAX_ADJUSTED_CONFIDENCE = 0.95
  private static readonly CONFIDENCE_BOOST = 0.05
  private static readonly EXACT_MATCH_THRESHOLD = 0.8
  private static readonly KEYWORD_MATCH_THRESHOLD = 0.7

  constructor() {
    this.initializeRules()
    this.initializeTemplates()
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      await this.loadIntentTemplates()
      this.isInitialized = true
      this.initFailed = false
      logger.log('[HybridNLPEngineV2] ✅ Engine initialized with', this.templates.length, 'templates')
    } catch (error) {
      logger.warn('[HybridNLPEngineV2] ⚠️ Initialization failed, using rule-based fallback:', error)
      // 标记初始化失败但允许规则引擎工作；后续调用可重试模板加载
      this.isInitialized = true
      this.initFailed = true
    }
  }

  /** 重试初始化（仅当之前失败时有效） */
  async retryInitialization(): Promise<boolean> {
    if (!this.initFailed) return true
    try {
      await this.loadIntentTemplates()
      this.initFailed = false
      logger.log('[HybridNLPEngineV2] ✅ Retry initialization succeeded')
      return true
    } catch (error) {
      logger.warn('[HybridNLPEngineV2] Retry initialization still failed:', error)
      return false
    }
  }

  async detectIntent(text: string, options?: { context?: string[]; history?: string[] }): Promise<IntentDetectionResult> {
    const startTime = performance.now()

    // Context-aware cache: include surrounding conversation to avoid cross-scenario collisions
    const ctxHash = options?.context ? (options.context.join(" ").slice(0, 80).toLowerCase() + "|" + (options.history?.slice(-3).join(" ") ?? "")) : ""
    const cacheKey = `${text.toLowerCase().trim()}__${ctxHash}`
    if (this.cache.has(cacheKey)) {
      // 深拷贝缓存结果，防止外部修改污染缓存数据
      const cached = this.cache.get(cacheKey)!
      return structuredClone(cached)
    }

    let result: IntentDetectionResult

    try {
      const normalizedText = this.preprocess(text)

      const ruleResult = this.matchByRules(normalizedText)

      if (ruleResult && ruleResult.confidence >= HybridNLPEngineV2.RULE_HIGH_CONFIDENCE) {
        result = {
          primaryIntent: ruleResult.intent,
          confidence: ruleResult.confidence,
          subIntents: ruleResult.subIntent ? [ruleResult.subIntent] : [],
          method: 'rule-based',
          processingTime: performance.now() - startTime,
        }
      } else {
        const semanticResult = await this.matchBySemantic(normalizedText, options)

        result = this.mergeResults(ruleResult, semanticResult)
        result.processingTime = performance.now() - startTime
      }

      result.entities = this.extractEntities(normalizedText)
      result.sentiment = this.analyzeSentiment(normalizedText)

      this.addToCache(cacheKey, result)

      return result
    } catch (error) {
      logger.error('[HybridNLPEngineV2] Error detecting intent:', error)
      return {
        primaryIntent: 'general_inquiry' as IntentType,
        confidence: 0.3,
        method: 'fallback',
        processingTime: performance.now() - startTime,
      }
    }
  }

  private preprocess(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '')
  }

  private matchByRules(text: string): IntentRule | null {
    let bestMatch: IntentRule | null = null
    let highestConfidence = 0

    for (const rule of this.rules) {
      // P0修复：重置 lastIndex 防止全局 RegExp 状态污染
      rule.pattern.lastIndex = 0
      if (rule.pattern.test(text)) {
        if (rule.confidence > highestConfidence ||
            (rule.confidence === highestConfidence && rule.priority > (bestMatch?.priority ?? 0))) {
          bestMatch = rule
          highestConfidence = rule.confidence
        }
      }
    }

    return bestMatch
  }

  private async matchBySemantic(
    text: string,
    options?: { context?: string[]; history?: string[] },
  ): Promise<SemanticMatch[]> {
    if (!this.isInitialized || this.templates.length === 0) {
      return []
    }

    const matches: SemanticMatch[] = []

    for (const template of this.templates) {
      const score = this.calculateSimilarity(text, template, options?.context)

      if (score >= HybridNLPEngineV2.SEMANTIC_MIN_SCORE) {
        matches.push({
          intent: template.intent,
          subIntent: template.subIntent,
          score,
          matchedTemplate: template.template,
          method: this.determineMethod(text, template),
        })
      }
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, 5)
  }

  private calculateSimilarity(
    text: string,
    template: IntentTemplate,
    context?: string[],
  ): number {
    let score = 0

    const exactMatchScore = this.exactMatchScore(text, template.template)
    if (exactMatchScore > HybridNLPEngineV2.EXACT_MATCH_THRESHOLD) return exactMatchScore

    const keywordScore = this.keywordMatchScore(text, template.keywords)
    score += keywordScore * 0.5

    const contextScore = context ? this.contextualScore(text, template, context) : 0
    score += contextScore * 0.3

    const patternScore = this.patternMatchScore(text, template.examples)
    score += patternScore * 0.2

    return Math.min(score, 1.0)
  }

  private exactMatchScore(text: string, template: string): number {
    const words1 = new Set(text.split(/\s+/))
    const words2 = new Set(template.split(/\s+/))

    const intersection = [...words1].filter(word => words2.has(word))
    const union = new Set([...words1, ...words2])

    return union.size > 0 ? intersection.length / union.size : 0
  }

  private keywordMatchScore(text: string, keywords: string[]): number {
    if (keywords.length === 0) return 0

    const matchedKeywords = keywords.filter(keyword =>
      text.includes(keyword.toLowerCase()),
    )

    return matchedKeywords.length / keywords.length
  }

  private contextualScore(text: string, template: IntentTemplate, context: string[]): number {
    if (!context || context.length === 0) return 0

    const relevantContext = context.filter(ctx =>
      template.keywords.some(kw => ctx.includes(kw)),
    )

    return Math.min(relevantContext.length / Math.max(context.length, 1), 0.8)
  }

  private patternMatchScore(text: string, examples: string[]): number {
    if (examples.length === 0) return 0

    let maxScore = 0
    for (const example of examples) {
      const score = this.exactMatchScore(text, example)
      maxScore = Math.max(maxScore, score)
    }

    return maxScore
  }

  private determineMethod(text: string, template: IntentTemplate): 'exact' | 'keyword' | 'semantic' {
    const exactScore = this.exactMatchScore(text, template.template)
    if (exactScore > HybridNLPEngineV2.EXACT_MATCH_THRESHOLD) return 'exact'

    const keywordScore = this.keywordMatchScore(text, template.keywords)
    if (keywordScore > HybridNLPEngineV2.KEYWORD_MATCH_THRESHOLD) return 'keyword'

    return 'semantic'
  }

  private mergeResults(ruleResult: IntentRule | null, semanticMatches: SemanticMatch[]): IntentDetectionResult {
    if (semanticMatches.length === 0 && !ruleResult) {
      return {
        primaryIntent: 'general_inquiry',
        confidence: 0.4,
        method: 'fallback',
      }
    }

    if (semanticMatches.length === 0 && ruleResult) {
      return {
        primaryIntent: ruleResult.intent,
        confidence: ruleResult.confidence,
        subIntents: ruleResult.subIntent ? [ruleResult.subIntent] : [],
        method: 'rule-based',
      }
    }

    if (ruleResult && ruleResult.confidence >= HybridNLPEngineV2.RULE_HIGH_CONFIDENCE) {
      return {
        primaryIntent: ruleResult.intent,
        confidence: ruleResult.confidence,
        subIntents: ruleResult.subIntent ? [ruleResult.subIntent] : [],
        alternativeIntents: semanticMatches.slice(0, 3).map(m => ({
          intent: m.intent,
          confidence: m.score,
        })),
        method: 'hybrid',
      }
    }

    const topSemantic = semanticMatches[0]
    const adjustedConfidence = this.adjustConfidence(topSemantic.score, ruleResult)

    return {
      primaryIntent: topSemantic.intent,
      confidence: adjustedConfidence,
      subIntents: topSemantic.subIntent ? [topSemantic.subIntent] : [],
      alternativeIntents: semanticMatches.slice(1, 4).map(m => ({
        intent: m.intent,
        confidence: m.score,
      })),
      method: 'semantic',
    }
  }

  private adjustConfidence(semanticScore: number, ruleResult: IntentRule | null): number {
    let baseConfidence = semanticScore

    if (ruleResult) {
      baseConfidence = Math.max(semanticScore, ruleResult.confidence * 0.7)
    }

    baseConfidence = Math.min(baseConfidence + HybridNLPEngineV2.CONFIDENCE_BOOST, HybridNLPEngineV2.MAX_ADJUSTED_CONFIDENCE)

    return baseConfidence
  }

  private extractEntities(text: string): { type: string; text: string; confidence: number; position?: [number, number] }[] {
    const entities: { type: string; text: string; confidence: number; position?: [number, number] }[] = []

    const formulaPatterns = [
      /([\u4e00-\u9fa5]+配方)/gi,
      /([\u4e00-\u9fa5]+\d*号?配方)/gi,
    ]

    for (const pattern of formulaPatterns) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        if (match.index !== undefined) {
          entities.push({ type: 'formula', text: match[0], confidence: 0.85, position: [match.index, match.index + match[0].length] })
        }
      }
    }

    const ingredientPattern = /([\u4e00-\u9fa5]+)(\d+\.?\d*)(g|mg|ml|kg|%|ppm)?/gi
    const ingredientMatches = [...text.matchAll(ingredientPattern)]
    for (const m of ingredientMatches) {
      if (m[1] && m.index !== undefined) {
        entities.push({ type: 'ingredient', text: m[1], confidence: 0.8, position: [m.index, m.index + m[1].length] })
      }
    }

    const dosagePattern = /(\d+\.?\d*)(g|mg|ml|kg|%|ppm)/gi
    const dosageMatches = [...text.matchAll(dosagePattern)]
    for (const m of dosageMatches) {
      if (m.index !== undefined) {
        entities.push({ type: 'dosage', text: m[0], confidence: 0.75, position: [m.index, m.index + m[0].length] })
      }
    }

    return entities
  }

  private analyzeSentiment(text: string): {
    sentiment: 'positive' | 'negative' | 'neutral'
    score: number
    primaryEmotion: string
    intensity: number
  } {
    // 使用 SentimentEngine 替代原始关键词袋（8类情绪 × 167关键词 × 强度评分）
    const result: EmotionResult = sentimentEngine.analyze(text)

    return {
      sentiment: result.polarity,
      score: result.intensity,
      primaryEmotion: result.primary,
      intensity: result.intensity,
    }
  }

  private initializeRules(): void {
    this.rules = [
      // 配方设计相关意图
      {
        pattern: /设计.*配方|开发.*配方|制定.*配方/gi,
        intent: 'FORMULA_DESIGN',
        confidence: 0.92,
        priority: 10,
        description: '配方设计请求',
      },
      {
        pattern: /帮我.*配方|我想.*配方|需要.*配方/gi,
        intent: 'FORMULA_DESIGN',
        confidence: 0.88,
        priority: 9,
        description: '配方设计需求表达',
      },
      {
        pattern: /.*功能性饮料.*|.*保健食品.*|.*营养补充剂.*/gi,
        intent: 'FORMULA_DESIGN',
        subIntent: 'functional_food',
        confidence: 0.90,
        priority: 11,
        description: '功能性食品设计',
      },

      // 安全性评估相关意图
      {
        pattern: /安全性|安全评估|毒理|毒性|安全性评价/gi,
        intent: 'SAFETY_ASSESSMENT',
        confidence: 0.93,
        priority: 10,
        description: '安全性评估请求',
      },
      {
        pattern: /这个.*安全吗|.*是否安全|.*有没有毒/gi,
        intent: 'SAFETY_ASSESSMENT',
        confidence: 0.87,
        priority: 8,
        description: '安全性询问',
      },
      {
        pattern: /.*GB\s*2760.*|.*食品添加剂.*标准|.*法规合规.*/gi,
        intent: 'SAFETY_ASSESSMENT',
        subIntent: 'regulatory_compliance',
        confidence: 0.91,
        priority: 12,
        description: '法规合规性检查',
      },

      // 成本控制相关意图
      {
        pattern: /成本|价格|预算|费用|经济性/gi,
        intent: 'COST_ANALYSIS',
        confidence: 0.89,
        priority: 9,
        description: '成本分析请求',
      },
      {
        pattern: /降低成本|节省费用|性价比|成本优化/gi,
        intent: 'COST_ANALYSIS',
        subIntent: 'cost_optimization',
        confidence: 0.91,
        priority: 11,
        description: '成本优化需求',
      },

      // 功效评估相关意图
      {
        pattern: /功效|效果|作用|功能|有效性/gi,
        intent: 'EFFICACY_EVALUATION',
        confidence: 0.88,
        priority: 9,
        description: '功效评估请求',
      },
      {
        pattern: /.*抗氧化.*|.*增强免疫.*|.*改善睡眠.*|.*抗疲劳.*/gi,
        intent: 'EFFICACY_EVALUATION',
        subIntent: 'functional_claim',
        confidence: 0.90,
        priority: 10,
        description: '特定功效询问',
      },

      // 配方修改/优化相关意图
      {
        pattern: /修改|调整|改进|优化|替换|变更/gi,
        intent: 'FORMULA_OPTIMIZATION',
        confidence: 0.87,
        priority: 8,
        description: '配方优化请求',
      },
      {
        pattern: /.*替代.*|.*换成.*|.*更换成.*/gi,
        intent: 'FORMULA_OPTIMIZATION',
        subIntent: 'ingredient_substitution',
        confidence: 0.89,
        priority: 10,
        description: '成分替代需求',
      },

      // 原料查询相关意图
      {
        pattern: /原料|成分|配料|添加剂|辅料/gi,
        intent: 'INGREDIENT_QUERY',
        confidence: 0.86,
        priority: 8,
        description: '原料信息查询',
      },
      {
        pattern: /.*用量.*|.*添加量.*|.*配比.*|.*比例.*/gi,
        intent: 'INGREDIENT_QUERY',
        subIntent: 'dosage_inquiry',
        confidence: 0.88,
        priority: 9,
        description: '用量咨询',
      },

      // 法规标准相关意图
      {
        pattern: /法规|标准|规定|要求|规范|指南/gi,
        intent: 'REGULATORY_QUERY',
        confidence: 0.90,
        priority: 10,
        description: '法规标准查询',
      },
      {
        pattern: /.*GB.*|.*国标.*|.*行业标准.*|.*企业标准.*/gi,
        intent: 'REGULATORY_QUERY',
        subIntent: 'standard_lookup',
        confidence: 0.92,
        priority: 12,
        description: '具体标准查询',
      },

      // 质量控制相关意图
      {
        pattern: /质量|检测|检验|质控|QA|QC/gi,
        intent: 'QUALITY_CONTROL',
        confidence: 0.89,
        priority: 9,
        description: '质量控制咨询',
      },
      {
        pattern: /.*HACCP.*|.*GMP.*|.*ISO.*|.*质量管理体系.*/gi,
        intent: 'QUALITY_CONTROL',
        subIntent: 'system_certification',
        confidence: 0.91,
        priority: 11,
        description: '质量体系认证',
      },

      // 一般性询问
      {
        pattern: /什么|如何|怎么|为什么|哪个|哪些|能否|可以吗/gi,
        intent: 'general_inquiry',
        confidence: 0.70,
        priority: 1,
        description: '一般性问题',
      },
      {
        pattern: /介绍|说明|解释|详细|帮助/gi,
        intent: 'general_inquiry',
        subIntent: 'explanation_request',
        confidence: 0.75,
        priority: 5,
        description: '解释说明需求',
      },

      // ===== 新增意图规则集（Phase 1.1）=====

      // 交互作用/配伍禁忌检查
      ...[
        { pattern: /(一起吃|同服|搭配.*服用|同时吃|能不能一起|可以同|配伍|相互作用)/gi, intent: 'interaction_check' as const, subIntent: 'drug_food_interaction' as const, confidence: 0.92, priority: 100, description: '成分交互作用查询' },
        { pattern: /(十八反|十九畏|相反|相畏|相恶|禁忌.*配伍|不能.*同用|忌.*同服)/gi, intent: 'interaction_check' as const, subIntent: 'herb_contraindication' as const, confidence: 0.95, priority: 101, description: '中药配伍禁忌' },
        { pattern: /(拮抗|协同|促进|抑制.*吸收|影响.*吸收|竞争性)/gi, intent: 'interaction_check' as const, subIntent: 'nutrient_antagonism' as const, confidence: 0.88, priority: 99, description: '营养素相互作用' },
      ],

      // 临床证据/循证级别问询
      ...[
        { pattern: /(临床(研究|试验|证据)|循证|文献支持|科学依据|研究证明|论文|SCI|双盲|随机对照)/gi, intent: 'evidence_inquiry' as const, subIntent: 'clinical_trial' as const, confidence: 0.90, priority: 98, description: '临床试验证据查询' },
        { pattern: /(作用机制|分子机制|通路|靶点|药理(作用)?|如何起效|为什么有效)/gi, intent: 'evidence_inquiry' as const, subIntent: 'mechanism_study' as const, confidence: 0.87, priority: 97, description: '作用机制问询' },
        { pattern: /(荟萃分析|Meta分析|系统评价|综合研究|大规模研究)/gi, intent: 'evidence_inquiry' as const, subIntent: 'meta_analysis' as const, confidence: 0.93, priority: 99, description: '循证综合分析' },
      ],

      // 感官/口感调整
      ...[
        { pattern: /(太(甜|苦|酸|咸|涩)|口感(不好|差|需要改)|风味调整|味道(改进|优化)|改善(口味|口感|风味))/gi, intent: 'sensory_adjustment' as const, subIntent: 'taste_modifier' as const, confidence: 0.91, priority: 96, description: '口味/味道调整' },
        { pattern: /(质地|口感|硬度|脆度|黏度|流动性|稳定性|浑浊)/gi, intent: 'sensory_adjustment' as const, subIntent: 'texture_adjustment' as const, confidence: 0.85, priority: 95, description: '质地/物性调整' },
        { pattern: /(香气|香味|风味|气味|回味|后味|芳香|呈香)/gi, intent: 'sensory_adjustment' as const, subIntent: 'aroma_enhancement' as const, confidence: 0.84, priority: 94, description: '香气/风味增强' },
      ],

      // 存储条件/保质期咨询
      ...[
        { pattern: /(保存|储存|存储|保质期|有效期| shelf.?life|冷藏|冷冻|阴凉|避光|密封)/gi, intent: 'storage_advice' as const, subIntent: 'storage_condition' as const, confidence: 0.89, priority: 93, description: '存储条件咨询' },
        { pattern: /(包装|包材|阻隔|防潮|避光包装|铝箔|玻璃瓶|PET)/gi, intent: 'storage_advice' as const, subIntent: 'packaging_requirement' as const, confidence: 0.86, priority: 92, description: '包装要求' },
      ],

      // 供应链/原料采购咨询
      ...[
        { pattern: /(哪里(买|采购|进货|订购)|供应商|厂家|生产商|货源|供应链|原料来源|产地)/gi, intent: 'supply_chain' as const, subIntent: 'sourcing' as const, confidence: 0.88, priority: 91, description: '原料采购/来源' },
        { pattern: /(质量标准|规格|纯度|含量规格|检测标准|CP|USP|BP|EP标准)/gi, intent: 'supply_chain' as const, subIntent: 'quality_spec' as const, confidence: 0.85, priority: 90, description: '质量规格要求' },
      ],
    ]
  }

  private initializeTemplates(): void {
    this.templates = [
      // 配方设计模板
      {
        id: 'fd-001',
        intent: 'FORMULA_DESIGN',
        template: '请帮我设计一个功能性饮料配方',
        keywords: ['设计', '配方', '功能性', '饮料'],
        category: '食品配方',
        examples: ['我需要一款抗疲劳的功能性饮料配方', '设计一个运动饮料的配方'],
      },
      {
        id: 'fd-002',
        intent: 'FORMULA_DESIGN',
        subIntent: 'functional_food',
        template: '开发一款针对老年人的低糖营养补充剂',
        keywords: ['开发', '老年人', '低糖', '营养补充剂'],
        category: '特殊膳食',
        examples: ['为老年人设计保健品', '适合老人的低糖配方'],
      },
      {
        id: 'fd-003',
        intent: 'FORMULA_DESIGN',
        template: '制定一个儿童成长型乳制品配方',
        keywords: ['制定', '儿童', '成长', '乳制品'],
        category: '婴幼儿食品',
        examples: ['儿童奶粉配方设计', '适合3-12岁儿童的营养品'],
      },

      // 安全性评估模板
      {
        id: 'sa-001',
        intent: 'SAFETY_ASSESSMENT',
        template: '评估这个配方的安全性，特别是重金属和微生物指标',
        keywords: ['评估', '安全性', '重金属', '微生物'],
        category: '安全性',
        examples: ['这个配方安全吗？', '检查一下安全性问题'],
      },
      {
        id: 'sa-002',
        intent: 'SAFETY_ASSESSMENT',
        subIntent: 'regulatory_compliance',
        template: '检查该配方是否符合 GB2760 食品添加剂使用标准',
        keywords: ['检查', '符合', 'GB2760', '食品添加剂'],
        category: '法规合规',
        examples: ['是否符合国家标准？', 'GB2760 合规性检查'],
      },
      {
        id: 'sa-003',
        intent: 'SAFETY_ASSESSMENT',
        template: '进行急性毒理学安全性评价试验设计',
        keywords: ['毒理学', '安全性评价', '试验设计'],
        category: '毒理学',
        examples: ['需要做毒理实验吗？', '毒理学评价方案'],
      },

      // 成本分析模板
      {
        id: 'ca-001',
        intent: 'COST_ANALYSIS',
        template: '分析这个配方的原料成本和生产成本构成',
        keywords: ['分析', '成本', '原料', '生产'],
        category: '成本',
        examples: ['这个配方多少钱？', '成本结构分析'],
      },
      {
        id: 'ca-002',
        intent: 'COST_ANALYSIS',
        subIntent: 'cost_optimization',
        template: '在保证功效的前提下，降低配方成本20%',
        keywords: ['降低', '成本', '保证', '功效'],
        category: '成本优化',
        examples: ['怎么降低成本？', '成本优化方案'],
      },

      // 功效评估模板
      {
        id: 'ee-001',
        intent: 'EFFICACY_EVALUATION',
        template: '评估该配方的抗氧化功效和体外活性',
        keywords: ['评估', '抗氧化', '功效', '体外活性'],
        category: '功效',
        examples: ['这个配方有什么功效？', '抗氧化效果怎么样'],
      },
      {
        id: 'ee-002',
        intent: 'EFFICACY_EVALUATION',
        subIntent: 'functional_claim',
        template: '验证"增强免疫力"功能声称的科学依据',
        keywords: ['验证', '增强免疫力', '功能声称', '科学依据'],
        category: '功能声称',
        examples: ['能说增强免疫吗？', '功能声称依据'],
      },

      // 配方优化模板
      {
        id: 'fo-001',
        intent: 'FORMULA_OPTIMIZATION',
        template: '优化配方的口感和稳定性，延长保质期至12个月',
        keywords: ['优化', '口感', '稳定性', '保质期'],
        category: '配方优化',
        examples: ['改善口感', '提高稳定性'],
      },
      {
        id: 'fo-002',
        intent: 'FORMULA_OPTIMIZATION',
        subIntent: 'ingredient_substitution',
        template: '用天然甜味剂替代人工合成甜味剂阿斯巴甜',
        keywords: ['替代', '天然', '甜味剂', '阿斯巴甜'],
        category: '成分替代',
        examples: ['用什么代替阿斯巴甜？', '天然替代方案'],
      },

      // 原料查询模板
      {
        id: 'iq-001',
        intent: 'INGREDIENT_QUERY',
        template: '查询维生素C在酸性条件下的稳定性和最大使用量',
        keywords: ['查询', '维生素C', '稳定性', '最大使用量'],
        category: '原料信息',
        examples: ['维生素C怎么用？', 'VC 的稳定性'],
      },
      {
        id: 'iq-002',
        intent: 'INGREDIENT_QUERY',
        subIntent: 'dosage_inquiry',
        template: '确定复配防腐剂的最佳配比和使用范围',
        keywords: ['确定', '复配防腐剂', '配比', '使用范围'],
        category: '用量咨询',
        examples: ['防腐剂加多少？', '最佳配比是多少'],
      },

      // 法规标准模板
      {
        id: 'rq-001',
        intent: 'REGULATORY_QUERY',
        template: '查找关于功能性配料管理的最新法规政策',
        keywords: ['查找', '功能性配料', '管理', '法规政策'],
        category: '法规',
        examples: ['有什么新法规？', '最新政策是什么'],
      },
      {
        id: 'rq-002',
        intent: 'REGULATORY_QUERY',
        subIntent: 'standard_lookup',
        template: '解读 GB 14881 食品生产通用卫生规范的关键要求',
        keywords: ['解读', 'GB14881', '卫生规范', '关键要求'],
        category: '标准',
        examples: ['GB14881 怎么理解？', '卫生规范要求'],
      },

      // 质量控制模板
      {
        id: 'qc-001',
        intent: 'QUALITY_CONTROL',
        template: '建立完整的 HACCP 计划和关键控制点监控体系',
        keywords: ['建立', 'HACCP', '关键控制点', '监控体系'],
        category: '质量体系',
        examples: ['怎么做 HACCP？', '建立质量体系'],
      },
      {
        id: 'qc-002',
        intent: 'QUALITY_CONTROL',
        subIntent: 'system_certification',
        template: '准备 ISO22000 食品安全管理体系认证所需文件清单',
        keywords: ['准备', 'ISO22000', '认证', '文件清单'],
        category: '认证',
        examples: ['ISO22000 要什么文件？', '认证准备清单'],
      },
    ]
  }

  private async loadIntentTemplates(): Promise<void> {
    logger.log('[HybridNLPEngineV2] Loading', this.templates.length, 'intent templates')
  }

  private addToCache(key: string, result: IntentDetectionResult): void {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, result)
  }

  getStats(): {
    isInitialized: boolean
    rulesCount: number
    templatesCount: number
    cacheSize: number
  } {
    return {
      isInitialized: this.isInitialized,
      rulesCount: this.rules.length,
      templatesCount: this.templates.length,
      cacheSize: this.cache.size,
    }
  }

  clearCache(): void {
    this.cache.clear()
  }
}

export const hybridNLPEngineV2 = new HybridNLPEngineV2()

import { TextCleaner, EntityExtractor, IntentClassifier, type ExtractedEntity, type IntentClassificationResult, type IntentType } from './nlpProcessor'
import { getTemplatesByIntent, renderTemplate, type SuggestionTemplate, type FrameworkType, type RenderedSection } from './suggestionTemplates'
import { getBestPracticesByIntent, type BestPractice } from './bestPractices'


import { logger } from '@/utils/safeLogger';
export interface EnhancedSuggestion {
  id: string
  title: string
  sections: RenderedSection[]
  qScore: number
  relevance: number
  intentType: IntentType
  framework: FrameworkType
  templateId: string
  relatedPractices: BestPractice[]
  generatedAt: number
  metadata: {
    entityCount: number
    primaryConfidence: number
    processingTime: number
  }
}

export interface EngineOptions {
  maxCacheSize?: number
  cacheTTLMins?: number
  timeoutMs?: number
  enableFallback?: boolean
}

export interface GenerateOptions {
  maxSuggestions?: number
  minQualityScore?: number
  includeFeedbackLearning?: boolean
  realtimeMode?: boolean  // 新增：实时模式，优化响应速度
}

class LRUCache<K, V> {
  private cache: Map<K, { value: V; timestamp: number }>
  private maxSize: number
  private ttl: number

  constructor(maxSize = 100, ttlMinutes = 10) {
    this.cache = new Map()
    this.maxSize = maxSize
    this.ttl = ttlMinutes * 60 * 1000
  }

  get(key: K): V | undefined {
    this.cleanup()
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return undefined
    }
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.value
  }

  set(key: K, value: V): void {
    this.cleanup()
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) this.cache.delete(firstKey)
    }
    this.cache.set(key, { value, timestamp: Date.now() })
  }

  has(key: K): boolean {
    return this.get(key) !== undefined
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    this.cleanup()
    return this.cache.size
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let id = 'sg-'
  for (let i = 0; i < 8; i++) id += chars.charAt(Math.floor(Math.random() * chars.length))
  return id
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const substitutionCost: number = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + substitutionCost,
      )
    }
  }
  return dp[m][n]
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  const dist = levenshteinDistance(a.toLowerCase(), b.toLowerCase())
  return 1 - dist / maxLen
}

export class SuggestionEngine {
  private textCleaner: TextCleaner
  private entityExtractor: EntityExtractor
  private intentClassifier: IntentClassifier
  private cache: LRUCache<string, EnhancedSuggestion[]>
  private maxCacheSize: number
  private cacheTTLMins: number
  private enableFallback: boolean

  constructor(options?: EngineOptions) {
    this.textCleaner = new TextCleaner()
    this.entityExtractor = new EntityExtractor()
    this.intentClassifier = new IntentClassifier()
    this.maxCacheSize = options?.maxCacheSize ?? 100
    this.cacheTTLMins = options?.cacheTTLMins ?? 5  // 缩短缓存时间，提高实时性
    this.enableFallback = options?.enableFallback !== false
    this.cache = new LRUCache<string, EnhancedSuggestion[]>(this.maxCacheSize, this.cacheTTLMins)
  }

  async generate(rawInput: string, options?: GenerateOptions): Promise<EnhancedSuggestion[]> {
    const startTime = performance.now()
    const maxSuggestions = options?.maxSuggestions ?? 4
    const minQualityScore = options?.minQualityScore ?? 60  // 实时模式下调阈值
    const realtimeMode = options?.realtimeMode ?? false

    try {
      const cacheKey = rawInput.trim().toLowerCase()
      const cached = this.cache.get(cacheKey)
      if (cached) {
        return cached.slice(0, maxSuggestions)
      }

      const cleanText = this.textCleaner.normalize(rawInput)
      if (!cleanText) {
        return this.enableFallback ? this.generateFallback(rawInput) : []
      }

      const entities = await this.entityExtractor.extract(cleanText)
      const intentResult = this.intentClassifier.classify(cleanText, entities)

      const primaryIntent = intentResult.primary.type

      const templates = getTemplatesByIntent(primaryIntent)
      const practices = realtimeMode ? [] : getBestPracticesByIntent(primaryIntent)

      if (templates.length === 0 && practices.length === 0) {
        const fallbackTemplates = getTemplatesByIntent('FORMULA_DESIGN')
        const fallbackPractices = realtimeMode ? [] : getBestPracticesByIntent('FORMULA_DESIGN')
        return this.buildSuggestions(
          cleanText,
          entities,
          intentResult,
          fallbackTemplates.length > 0 ? fallbackTemplates : [],
          fallbackPractices,
          maxSuggestions,
          minQualityScore,
          startTime,
          realtimeMode,
        )
      }

      const variables = this.extractVariables(entities, intentResult)

      let suggestions: EnhancedSuggestion[] = []

      // 实时模式下减少模板数量以提高响应速度
      const templatesToProcess = realtimeMode ? templates.slice(0, 3) : templates

      for (const template of templatesToProcess) {
        const draft = renderTemplate(template, variables)

        const selectedPractices = realtimeMode ? [] : this.selectRelatedPractices(practices, template, entities, 2)

        // 实时模式下简化评分计算
        const qScore = realtimeMode
          ? this.scoreQualityRealtime(draft, intentResult, entities)
          : this.scoreQuality(draft, intentResult, entities)

        const baseQScore = template.qualityBaseline
        const adjustedQScore = Math.round((qScore * 0.6) + (baseQScore * 0.4))

        suggestions.push({
          id: generateId(),
          title: draft.title,
          sections: realtimeMode ? draft.sections.slice(0, 2) : draft.sections,
          qScore: Math.max(qScore, adjustedQScore),
          relevance: intentResult.primary.confidence,
          intentType: primaryIntent,
          framework: template.framework,
          templateId: template.id,
          relatedPractices: selectedPractices,
          generatedAt: Date.now(),
          metadata: {
            entityCount: entities.length,
            primaryConfidence: intentResult.primary.confidence,
            processingTime: Math.round(performance.now() - startTime),
          },
        })
      }

      suggestions = this.deduplicate(suggestions)
      if (!realtimeMode) {
        suggestions = this.enforceDiversity(suggestions)
      }
      suggestions.sort((a, b) => b.qScore - a.qScore)
      suggestions = suggestions.filter(s => s.qScore >= minQualityScore)
      suggestions = suggestions.slice(0, maxSuggestions)

      this.cache.set(cacheKey, suggestions)

      return suggestions

    } catch (error) {
      logger.warn('[SuggestionEngine] Error:', error)
      if (this.enableFallback) {
        return this.generateFallback(rawInput)
      }
      return []
    }
  }

  private scoreQualityRealtime(
    suggestion: Partial<EnhancedSuggestion>,
    intentResult: IntentClassificationResult,
    entities: ExtractedEntity[],
  ): number {
    let score = 50

    score += intentResult.primary.confidence * 30

    const suggestionStr = JSON.stringify(suggestion)
    const mentionedEntities = entities.filter(e =>
      suggestionStr.includes(e.text) || suggestionStr.includes(e.normalized),
    )
    score += (mentionedEntities.length / Math.max(entities.length, 1)) * 20

    return Math.min(100, score)
  }

  private extractVariables(entities: ExtractedEntity[], _intentResult: IntentClassificationResult): Record<string, string> {
    const vars: Record<string, string> = {}

    const productForm = entities.find(e => e.type === 'PRODUCT_FORM')
    vars.productForm = productForm?.normalized || '产品'

    const activeIngredients = entities.filter(e => e.type === 'ACTIVE_INGREDIENT')
    vars.mainIngredient = activeIngredients[0]?.normalized || '功能性因子'
    vars.ingredientType1 = activeIngredients[0]?.normalized || '功能因子A'
    vars.ingredientType2 = activeIngredients[1]?.normalized || '功能因子B'
    vars.ingredientType3 = activeIngredients[2]?.normalized || '功能因子C'

    const functionalClaims = entities.filter(e => e.type === 'FUNCTIONAL_CLAIM')
    vars.functionalClaim = functionalClaims[0]?.normalized || '功能诉求'

    const processTechs = entities.filter(e => e.type === 'PROCESS_TECH')
    vars.processTechnology = processTechs[0]?.normalized || '生产工艺'
    vars.processParam1 = processTechs.length > 0
      ? `${processTechs[0].normalized}关键参数优化`
      : '常规工艺参数控制'
    vars.thermalProtection = activeIngredients.length > 0
      ? `${activeIngredients[0].text}热保护措施（环糊精包埋或微胶囊化）`
      : '热敏感成分保护方案'

    vars.validationMetric = functionalClaims.length > 0
      ? `${functionalClaims[0].text}功效验证指标（IC₅₀/IC₅₀值、体外活性检测）`
      : '核心功效指标验证'
    vars.validationMetric1 = vars.validationMetric
    vars.stabilityThreshold = '85%'
    vars.animalModel = 'SHR大鼠模型或KK-Ay小鼠模型'
    vars.feedingPeriod = '8周'
    vars.subjectCount = '120'

    vars.carrierSystemDesign = `基于${vars.productForm}特性的载体系统设计方案`
    vars.carrier1 = '麦芽糊精 DE 12-18'
    vars.carrier2 = '菊粉（益生元协同）'
    vars.synergyEffect = '益生元协同增效'
    vars.solubilityOptimization = '冲溶性优化'

    if (activeIngredients.some(e => e.text.includes('肽'))) {
      vars.function1 = 'ACE抑制活性（降压）'
      vars.function2 = 'DPP-IV抑制活性（降糖）'
      vars.function3 = '胆汁酸结合活性（降脂）'
      vars.referenceSource1 = '海洋鱼蛋白水解物'
      vars.referenceSource2 = '大豆肽提取物'
      vars.referenceSource3 = '乳清蛋白水解肽'
    } else {
      vars.function1 = '主要作用机制1'
      vars.function2 = '辅助作用机制2'
      vars.function3 = '协同作用机制3'
      vars.referenceSource1 = '行业主流供应商'
      vars.referenceSource2 = '学术文献推荐'
      vars.referenceSource3 = '专利技术来源'
    }

    const targetAudiences = entities.filter(e => e.type === 'TARGET_AUDIENCE')
    vars.targetPopulation = targetAudiences[0]?.normalized || '目标人群'

    const regulatoryStds = entities.filter(e => e.type === 'REGULATORY_STD')
    vars.regulatoryBody = regulatoryStds[0]?.normalized || '监管机构'
    vars.standardCode = regulatoryStds[0]?.normalized || 'GB/T标准编号'

    vars.dosageForm = vars.productForm
    vars.shelfLife = '24个月'
    vars.storageCondition = '阴凉干燥处密封保存'
    vars.maxDosage = '每日推荐摄入量'
    vars.allergenInfo = '常见过敏原声明（如含麸质/大豆/乳制品等）'
    vars.specialGroup = '特殊人群（孕妇、哺乳期女性、婴幼儿等）'
    vars.interactionWarning = '药物相互作用提示'
    vars.sensoryAttribute = '风味与口感特征'
    vars.stabilityFactor = '主要稳定性影响因素'
    vars.bioavailabilityMethod = '生物利用度提升技术方案'
    vars.textureParameter = '质构剖面分析参数(TPA)'
    vars.costTarget = '目标成本范围'
    vars.alternativeIngredient = '替代原料候选'
    vars.processEfficiency = '工艺效率优化方向'
    vars.supplierName = '推荐供应商'
    vars.marketSegment = '细分市场定位'
    vars.consumerInsight = '核心消费者洞察'
    vars.trendKeyword = '市场趋势关键词'
    vars.patentOpportunity = '可申请专利的技术创新点'
    vars.competitorProduct = '主要竞品名称'
    vars.uspPoint = '独特卖点(USP)'
    vars.reference = '参考文献来源'

    return vars
  }

  private scoreQuality(
    suggestion: Partial<EnhancedSuggestion>,
    intentResult: IntentClassificationResult,
    entities: ExtractedEntity[],
  ): number {
    const relevanceScore = this.calculateRelevance(suggestion, intentResult, entities)
    const professionalismScore = this.calculateProfessionalism(suggestion)
    const actionabilityScore = this.calculateActionability(suggestion)
    const completenessScore = this.calculateCompleteness(suggestion)

    const qScore = Math.round(
      relevanceScore * 0.35 +
      professionalismScore * 0.30 +
      actionabilityScore * 0.20 +
      completenessScore * 0.15,
    )

    return Math.min(100, Math.max(0, qScore))
  }

  private calculateRelevance(
    suggestion: Partial<EnhancedSuggestion>,
    intentResult: IntentClassificationResult,
    entities: ExtractedEntity[],
  ): number {
    let score = 50

    score += intentResult.primary.confidence * 30

    const suggestionStr = JSON.stringify(suggestion)
    const mentionedEntities = entities.filter(e =>
      suggestionStr.includes(e.text) ||
      suggestionStr.includes(e.normalized),
    )
    score += (mentionedEntities.length / Math.max(entities.length, 1)) * 20

    return Math.min(100, score)
  }

  private calculateProfessionalism(suggestion: Partial<EnhancedSuggestion>): number {
    let score = 40

    const professionalTerms = ['IC₅₀', 'DPP-IV', 'ACE', 'HACCP', 'GB ', 'FDA', 'ADI', 'NOAEL', 'GRAS', 'GMP', 'EFSA', 'NMPA', 'cGMP', 'CYP', 'LD₅₀', 'MOE', 'ARfD', 'RfD', 'ICH', 'OECD', 'DSHEA', 'Novel Food']
    const suggestionStr = JSON.stringify(suggestion)
    const termCount = professionalTerms.filter(term => suggestionStr.includes(term)).length
    score += Math.min(25, termCount * 5)

    if (suggestion.sections && suggestion.sections.length >= 3) score += 15
    if (suggestion.sections?.some(s => s.bulletPoints && s.bulletPoints.length >= 3)) score += 20

    return Math.min(100, score)
  }

  private calculateActionability(suggestion: Partial<EnhancedSuggestion>): number {
    let score = 30

    const suggestionStr = JSON.stringify(suggestion)
    const hasNumbers = /\d+(\.\d+)?(%|mg|mL|°C|周|天|月|小时|例)/.test(suggestionStr)
    if (hasNumbers) score += 25

    if (/(\d+-?\d*\s*(周|天|月|小时))/.test(suggestionStr)) score += 20

    const stepIndicators = ['步骤', '阶段', '首先', '然后', '推荐', '建议', '采用', '优先', '选择', '实施', '执行']
    const stepCount = stepIndicators.filter(indicator => suggestionStr.includes(indicator)).length
    score += Math.min(25, stepCount * 5)

    return Math.min(100, score)
  }

  private calculateCompleteness(suggestion: Partial<EnhancedSuggestion>): number {
    let score = 40

    const dimensions = ['需求', '原料', '工艺', '验证', '法规', '成本', '感官', '配方', '质量', '安全', '生产', '包装', '标签', '市场', '供应链']
    const suggestionStr = JSON.stringify(suggestion)
    const coveredDimensions = dimensions.filter(dim => suggestionStr.includes(dim)).length
    score += (coveredDimensions / dimensions.length) * 40

    const totalLength = suggestionStr.length
    if (totalLength > 500) score += 15
    else if (totalLength > 200) score += 10

    return Math.min(100, score)
  }

  private selectRelatedPractices(
    practices: BestPractice[],
    template: SuggestionTemplate,
    entities: ExtractedEntity[],
    maxCount = 3,
  ): BestPractice[] {
    if (practices.length === 0) return []

    const scored = practices.map(practice => {
      let score = 0

      if (practice.tags.some(tag => template.title.includes(tag))) score += 30
      if (practice.category.toUpperCase().includes(template.framework) || template.framework === 'GENERAL') score += 10

      for (const entity of entities) {
        if (practice.scenario.includes(entity.text) || practice.solution.includes(entity.normalized)) score += 15
        if (practice.tags.some(tag => tag.includes(entity.text) || tag.includes(entity.normalized))) score += 10
      }

      if (practice.evidenceLevel === 'strong') score += 15
      else if (practice.evidenceLevel === 'moderate') score += 8

      return { practice, score }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, maxCount).map(s => s.practice)
  }

  private deduplicate(suggestions: EnhancedSuggestion[]): EnhancedSuggestion[] {
    const result: EnhancedSuggestion[] = []
    const SIMILARITY_THRESHOLD = 0.7

    for (const suggestion of suggestions) {
      let isDuplicate = false
      for (const existing of result) {
        const titleSim = similarity(suggestion.title, existing.title)
        if (titleSim >= SIMILARITY_THRESHOLD) {
          isDuplicate = true
          break
        }
      }
      if (!isDuplicate) {
        result.push(suggestion)
      }
    }

    return result
  }

  private enforceDiversity(suggestions: EnhancedSuggestion[]): EnhancedSuggestion[] {
    const MAX_PER_FRAMEWORK = 2
    const frameworkCounts: Record<string, number> = {}
    const result: EnhancedSuggestion[] = []

    for (const suggestion of suggestions) {
      const fw = suggestion.framework
      const currentCount = frameworkCounts[fw] || 0
      if (currentCount < MAX_PER_FRAMEWORK) {
        result.push(suggestion)
        frameworkCounts[fw] = currentCount + 1
      }
    }

    return result
  }

  private buildSuggestions(
    cleanText: string,
    entities: ExtractedEntity[],
    intentResult: IntentClassificationResult,
    templates: SuggestionTemplate[],
    practices: BestPractice[],
    maxSuggestions: number,
    minQualityScore: number,
    startTime: number,
    realtimeMode = false,
  ): EnhancedSuggestion[] {
    if (templates.length === 0) {
      return this.enableFallback ? this.generateFallback(cleanText) : []
    }

    const variables = this.extractVariables(entities, intentResult)
    const suggestions: EnhancedSuggestion[] = []

    const templatesToProcess = realtimeMode ? templates.slice(0, 2) : templates.slice(0, maxSuggestions + 2)

    for (const template of templatesToProcess) {
      const draft = renderTemplate(template, variables)
      const selectedPractices = realtimeMode ? [] : this.selectRelatedPractices(practices, template, entities, 2)
      const qScore = realtimeMode
        ? this.scoreQualityRealtime(draft, intentResult, entities)
        : this.scoreQuality(draft, intentResult, entities)

      suggestions.push({
        id: generateId(),
        title: draft.title,
        sections: realtimeMode ? draft.sections.slice(0, 2) : draft.sections,
        qScore,
        relevance: intentResult.primary.confidence,
        intentType: intentResult.primary.type,
        framework: template.framework,
        templateId: template.id,
        relatedPractices: selectedPractices,
        generatedAt: Date.now(),
        metadata: {
          entityCount: entities.length,
          primaryConfidence: intentResult.primary.confidence,
          processingTime: Math.round(performance.now() - startTime),
        },
      })
    }

    suggestions.sort((a, b) => b.qScore - a.qScore)
    return suggestions.filter(s => s.qScore >= minQualityScore).slice(0, maxSuggestions)
  }

  private generateFallback(input: string): EnhancedSuggestion[] {
    const truncated = input.substring(0, 30)
    return [
      {
        id: 'fallback-1',
        title: `关于"${truncated}"的基础分析`,
        sections: [
          {
            heading: '概述',
            content: '建议提供更具体的需求描述以获得更精准的建议。您可以补充以下信息：产品形态（如固体饮料、软糖、片剂）、核心功能性成分、目标健康诉求、目标消费人群等。',
            bulletPoints: [
              '请明确产品形态偏好（固体饮料/软糖/片剂/胶囊/口服液等）',
              '请说明核心功能诉求（如降三高、增强免疫、护肝、抗氧化等）',
              '如有特定原料偏好，请一并提供',
              '如需法规合规建议，请注明目标销售市场',
            ],
            importance: 'medium' as const,
          },
          {
            heading: '下一步行动建议',
            content: '基于您提供的初步信息，系统已识别出以下可能的方向，供参考：',
            bulletPoints: [
              '若涉及功能性成分复配，建议从作用机制协同性角度筛选原料组合',
              '关注原料的法规准入状态（中国保健食品原料目录 / FDA GRAS / EFSA Novel Food）',
              '考虑采用微胶囊化或包埋技术保护热敏性活性成分',
              '建议开展体外活性预筛试验以确认原料功效潜力',
            ],
            importance: 'low' as const,
          },
        ],
        qScore: 60,
        relevance: 0.6,
        intentType: 'FORMULA_DESIGN',
        framework: 'GENERAL',
        templateId: 'fallback',
        relatedPractices: [],
        generatedAt: Date.now(),
        metadata: {
          entityCount: 0,
          primaryConfidence: 0.5,
          processingTime: 10,
        },
      },
    ]
  }

  clearCache(): void {
    this.cache.clear()
  }

  getCacheStats(): { size: number; maxSize: number; ttlMinutes: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      ttlMinutes: this.cacheTTLMins,
    }
  }
}

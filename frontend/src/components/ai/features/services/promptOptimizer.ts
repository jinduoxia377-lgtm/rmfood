/**
 * AI-Driven Prompt Optimization System V1.0 (Professional Edition)
 *
 * Core Capabilities:
 * ✅ Multi-dimensional professional analysis (intent, completeness, clarity, specificity)
 * ✅ Quantitative evaluation metrics (6-dimension scoring system)
 * ✅ Intelligent optimization engine (context enrichment, terminology enhancement)
 * ✅ Configurable strategy system (conservative/balanced/aggressive/domain-specific)
 * ✅ AI model integration (LLM-powered enhancement via backend API)
 * ✅ Before/after quality comparison with detailed diff analysis
 * ✅ Domain-specific knowledge injection (food formula industry standards)
 *
 * @version 1.0.0 Professional Edition
 * @lastUpdated 2026-05-29
 */

import { logger } from '@/utils/safeLogger'
import { API_ENDPOINTS } from '@/config/apiEndpoints'

// ============================================
// Type System - Complete Type Definitions
// ============================================

/** Optimization strategy type */
export type OptimizationStrategy = 'conservative' | 'balanced' | 'aggressive' | 'domain_specific'

/** Quality dimension enum */
export type QualityDimension =
  | 'clarity'        // Clarity and unambiguity
  | 'completeness'   // Presence of all necessary elements
  | 'specificity'    // Specificity of requirements
  | 'professionalism' // Domain-appropriate terminology
  | 'executability'  // AI execution effectiveness
  | 'structure'      // Logical organization

/** Analysis issue severity */
export type IssueSeverity = 'critical' | 'major' | 'minor' | 'suggestion'

/** Issue category */
export type IssueCategory =
  | 'intent_ambiguous'
  | 'missing_context'
  | 'vague_requirements'
  | 'poor_terminology'
  | 'missing_constraints'
  | 'unclear_output_format'
  | 'insufficient_detail'
  | 'structural_issues'
  | 'domain_mismatch'

/** Single analysis issue */
export interface AnalysisIssue {
  id: string
  category: IssueCategory
  severity: IssueSeverity
  message: string
  suggestion: string
  location?: { start: number; end: number }
  autoFixable: boolean
}

/** Dimension score detail */
export interface DimensionScore {
  dimension: QualityDimension
  score: number           // 0-100
  maxScore: number       // Usually 100
  weight: number         // Weight in overall calculation (0-1)
  details: string[]      // Detailed feedback items
  issues: AnalysisIssue[]
}

/** Overall quality evaluation result */
export interface QualityEvaluation {
  overallScore: number              // 0-100 weighted average
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F'
  dimensions: DimensionScore[]
  summary: string
  strengths: string[]
  weaknesses: string[]
  improvementPriority: IssueCategory[]
}

/** Detected intent from prompt */
export interface DetectedIntent {
  primary: string
  confidence: number
  secondary?: string
  domain: string
  actionVerbs: string[]
  targetObject?: string
}

/** Context gap analysis */
export interface ContextGap {
  missingInformation: {
    type: string
    description: string
    importance: 'essential' | 'recommended' | 'optional'
    suggestedValue?: string
  }[]
  domainKnowledge: string[]
  relevantStandards: string[]
}

/** Optimization suggestion */
export interface OptimizationSuggestion {
  type: 'addition' | 'modification' | 'restructuring' | 'enhancement'
  originalText?: string
  optimizedText: string
  reason: string
  impact: QualityDimension[]
  confidence: number
}

/** Complete optimization result */
export interface OptimizationResult {
  originalPrompt: string
  optimizedPrompt: string
  evaluationBefore: QualityEvaluation
  evaluationAfter: QualityEvaluation
  improvements: OptimizationSuggestion[]
  appliedStrategies: string[]
  qualityDelta: {
    overall: number
    dimensions: Record<QualityDimension, number>
  }
  metadata: {
    processingTimeMs: number
    strategyUsed: OptimizationStrategy
    aiEnhanced: boolean
    version: string
  }
}

/** Analysis result (before optimization) */
export interface PromptAnalysisResult {
  originalPrompt: string
  intent: DetectedIntent
  contextGap: ContextGap
  evaluation: QualityEvaluation
  issues: AnalysisIssue[]
  wordCount: number
  complexityLevel: 'simple' | 'moderate' | 'complex'
  domainRelevance: number  // 0-1
}

/** Configuration options */
export interface PromptOptimizerConfig {
  strategy?: OptimizationStrategy
  enableAIEnhancement?: boolean
  targetDomain?: string
  maxOptimizationRounds?: number
  preserveOriginalTone?: boolean
  outputFormatPreference?: 'structured' | 'natural' | 'mixed'
  customConstraints?: string[]
  expertiseLevel?: 'beginner' | 'intermediate' | 'expert'
}

// ============================================
// Constants & Domain Knowledge
// ============================================

const QUALITY_WEIGHTS: Record<QualityDimension, number> = {
  clarity: 0.25,
  completeness: 0.20,
  specificity: 0.20,
  professionalism: 0.15,
  executability: 0.12,
  structure: 0.08,
}

const GRADE_THRESHOLDS = [
  { min: 95, grade: 'A+' as const },
  { min: 88, grade: 'A' as const },
  { min: 78, grade: 'B+' as const },
  { min: 68, grade: 'B' as const },
  { min: 55, grade: 'C' as const },
  { min: 40, grade: 'D' as const },
  { min: 0,  grade: 'F' as const },
]

const INTENT_PATTERNS: { pattern: RegExp; intent: string; domain: string; weight: number }[] = [
  { pattern: /设计|开发|创建|制定|定制|构建/g, intent: 'FORMULA_DESIGN', domain: '配方设计', weight: 1.0 },
  { pattern: /优化|改进|提升|增强|完善/g, intent: 'OPTIMIZATION', domain: '配方优化', weight: 0.95 },
  { pattern: /分析|评估|检测|鉴定|检验/g, intent: 'ANALYSIS', domain: '质量分析', weight: 0.9 },
  { pattern: /查询|搜索|查找|了解|说明/g, intent: 'INQUIRY', domain: '知识查询', weight: 0.85 },
  { pattern: /比较|对比|区别|差异|优劣/g, intent: 'COMPARISON', domain: '方案对比', weight: 0.9 },
  { pattern: /安全|风险|毒理|合规|法规|GRAS/g, intent: 'SAFETY_ASSESSMENT', domain: '安全评估', weight: 0.95 },
  { pattern: /成本|价格|预算|经济|降本/g, intent: 'COST_ANALYSIS', domain: '成本分析', weight: 0.85 },
  { pattern: /工艺|流程|生产|制备|加工/g, intent: 'PROCESS_DESIGN', domain: '工艺设计', weight: 0.88 },
  { pattern: /营养|成分|功效|作用机制/g, intent: 'NUTRITION_ANALYSIS', domain: '营养分析', weight: 0.9 },
  { pattern: /市场|趋势|竞品|消费者/g, intent: 'MARKET_RESEARCH', domain: '市场调研', weight: 0.8 },
]

const DOMAIN_SPECIFIC_TERMS: Record<string, { terms: string[]; context: string }> = {
  FORMULA_DESIGN: {
    terms: ['目标人群', '功能定位', '产品形态', '口感要求', '成本预算', '保质期期望', '法规合规', '原料来源'],
    context: '配方设计需要明确产品定位、目标人群、核心功能、形态规格等关键要素',
  },
  OPTIMIZATION: {
    terms: ['当前问题', '优化目标', '约束条件', '可接受范围', '优先级', '评价指标'],
    context: '配方优化需要明确现状问题、期望目标、约束边界和评价标准',
  },
  ANALYSIS: {
    terms: ['分析维度', '检测标准', '参考基准', '数据精度', '报告格式'],
    context: '专业分析需要指定分析维度、采用标准、参考基线和输出格式',
  },
  SAFETY_ASSESSMENT: {
    terms: ['暴露量评估', '毒性数据', '法规依据', '使用人群', '摄入量限制'],
    context: '安全性评估需要考虑毒理学数据、法规限量、暴露评估和特殊人群',
  },
  NUTRITION_ANALYSIS: {
    terms: ['营养成分表', '参考摄入量', '生物利用率', '相互作用', '推荐量'],
    context: '营养分析应包含宏量/微量营养素、生物利用度和人群推荐量',
  },
  PROCESS_DESIGN: {
    terms: ['关键控制点', '工艺参数', '设备要求', '质量控制', '产能需求'],
    context: '工艺流程需定义CCP点、操作参数、质量标准和产能规划',
  },
}

const CONTEXT_ENHANCEMENT_TEMPLATES: Record<string, string> = {
  FORMULA_DESIGN: `请基于以下专业框架进行系统化设计：
【产品定位】明确产品的市场定位和差异化价值
【目标人群】描述主要适用人群的特征和需求
【核心功能】列出需要实现的主要功效或特性
【技术路线】建议采用的技术路径和关键原料
【感官指标】口感、风味、色泽、溶解性等要求
【成本范围】目标成本区间和主要成本驱动因素
【法规合规】需符合的法规标准（GB、保健食品等）
【质量标准】关键质量指标和验收标准`,

  OPTIMIZATION: `请按以下结构提供优化方案：
【现状诊断】分析当前配方的核心问题和瓶颈
【优化方向】提出具体的优化策略（可多选）
【实施方案】详细的调整步骤和参数建议
【预期效果】量化预测优化后的改善幅度
【风险评估】潜在风险点和缓解措施
【验证方法】效果验证的测试方案`,

  ANALYSIS: `请从以下维度进行全面分析：
【成分分析】详细列出各组分及其含量/比例
【功能评价】基于科学证据的功效评估
【适用性】目标人群适配性和禁忌情况
【优势亮点】相对于同类产品的独特优势
【改进空间】可进一步提升的方向
【参考资料】引用相关研究和标准依据`,

  SAFETY_ASSESSMENT: `请进行系统性安全评估：
【原料安全性】各成分的毒理学数据和ADI值
【暴露量评估】正常使用条件下的暴露水平
【相互作用】成分间可能的相互作用
【特殊人群】孕妇、儿童、过敏体质等注意事项
【法规符合性】与现行法规的一致性检查
【风险管理】风险等级和控制措施建议`,

  default: `为了获得更精准的结果，建议补充以下信息：
1. 具体的应用场景和使用背景
2. 明确的目标要求和成功标准
3. 约束条件（如成本、时间、法规等）
4. 期望的输出格式和详细程度`,
}

const PROFESSIONAL_TERMINOLOGY_MAP: Record<string, { standard: string; context: string }> = {
  '降三高': { standard: '辅助调节血压、血脂、血糖（代谢综合征管理）', context: '使用规范的健康声称术语' },
  '减肥': { standard: '体重管理/体脂调控', context: '避免非合规功效表述' },
  '美容': { standard: '皮肤健康维护/抗氧化护肤', context: '采用化妆品/功能性食品规范用语' },
  '抗衰老': { standard: '抗氧化/细胞活力维持', context: '避免绝对化表述' },
  '提高免疫力': { standard: '免疫调节/免疫功能支持', context: '符合保健食品功能范围' },
  '排毒': { standard: '肠道健康促进/代谢废物排出支持', context: '避免伪科学表述' },
  '补脑': { standard: '认知功能支持/脑健康维护', context: '使用神经科学规范术语' },
  '壮阳': { standard: '男性生殖健康支持', context: '采用医学规范表述' },
  '纯天然': { standard: '天然来源原料', context: '避免绝对化宣称' },
  '无添加': { standard: '不含特定类别添加剂（需明确类别）', context: '需具体说明不添加何种物质' },
}

const OUTPUT_FORMAT_TEMPLATES: Record<string, string> = {
  structured: `\n\n【输出格式要求】
请以结构化方式呈现结果：
1. 使用清晰的标题层级（## ### ####）
2. 关键数据用表格形式展示
3. 重要结论用**加粗**标注
4. 建议和注意事项用> 引用块突出
5. 如有参数推荐，给出具体数值范围`,

  natural: `\n\n【输出风格偏好】
请以专业但易懂的语言进行阐述：
1. 先给结论，再展开细节
2. 使用类比帮助理解复杂概念
3. 提供实际案例或应用场景
4. 给出可操作的下一步建议`,

  mixed: `\n\n【输出格式要求】
综合使用结构化和自然语言：
1. 核心结论用简洁段落概述
2. 详细数据和分析用表格/列表
3. 专业术语首次出现时附简明解释
4. 最终给出行动清单（Checklist）`,
}

// ============================================
// Main Class: PromptOptimizer
// ============================================

export class PromptOptimizer {
  private static readonly VERSION = '1.0.0'
  private static readonly DEFAULT_CONFIG: Required<PromptOptimizerConfig> = {
    strategy: 'balanced',
    enableAIEnhancement: true,
    targetDomain: 'food_formula',
    maxOptimizationRounds: 3,
    preserveOriginalTone: true,
    outputFormatPreference: 'mixed',
    customConstraints: [],
    expertiseLevel: 'intermediate',
  }

  private config: Required<PromptOptimizerConfig>

  constructor(config: PromptOptimizerConfig = {}) {
    this.config = { ...PromptOptimizer.DEFAULT_CONFIG, ...config }
  }

  async optimize(rawPrompt: string): Promise<OptimizationResult> {
    const startTime = performance.now()

    logger.info('[PromptOptimizer] 开始优化处理:', {
      inputLength: rawPrompt.length,
      strategy: this.config.strategy,
      aiEnhanced: this.config.enableAIEnhancement,
    })

    try {
      const analysis = await this.analyzePrompt(rawPrompt)

      let optimizedPrompt = await this.applyOptimizationRules(analysis)

      if (this.config.enableAIEnhancement) {
        optimizedPrompt = await this.enhanceWithAI(optimizedPrompt, analysis)
      }

      const postEvaluation = this.evaluateQuality(optimizedPrompt)

      const result: OptimizationResult = {
        originalPrompt: rawPrompt,
        optimizedPrompt,
        evaluationBefore: analysis.evaluation,
        evaluationAfter: postEvaluation,
        improvements: this.generateImprovementList(rawPrompt, optimizedPrompt, analysis),
        appliedStrategies: this.getAppliedStrategyNames(),
        qualityDelta: this.calculateQualityDelta(analysis.evaluation, postEvaluation),
        metadata: {
          processingTimeMs: performance.now() - startTime,
          strategyUsed: this.config.strategy,
          aiEnhanced: this.config.enableAIEnhancement,
          version: PromptOptimizer.VERSION,
        },
      }

      logger.info('[PromptOptimizer] 优化完成:', {
        qualityImprovement: `${result.qualityDelta.overall > 0 ? '+' : ''}${result.qualityDelta.overall.toFixed(1)}`,
        timeMs: result.metadata.processingTimeMs.toFixed(0),
      })

      return result

    } catch (error) {
      logger.error('[PromptOptimizer] 优化过程出错:', error)
      throw error
    }
  }

  async analyzeOnly(rawPrompt: string): Promise<PromptAnalysisResult> {
    return this.analyzePrompt(rawPrompt)
  }

  private async analyzePrompt(prompt: string): Promise<PromptAnalysisResult> {
    const intent = this.detectIntent(prompt)
    const contextGap = this.analyzeContextGaps(prompt, intent)
    const issues = this.detectIssues(prompt, intent, contextGap)
    const evaluation = this.evaluateQuality(prompt)

    return {
      originalPrompt: prompt,
      intent,
      contextGap,
      evaluation,
      issues,
      wordCount: prompt.length,
      complexityLevel: this.assessComplexity(prompt),
      domainRelevance: this.calculateDomainRelevance(prompt, intent),
    }
  }

  private detectIntent(text: string): DetectedIntent {
    let bestMatch = { intent: 'GENERAL_INQUIRY', domain: '通用咨询', weight: 0, confidence: 0 }
    const actionVerbs: string[] = []

    for (const pattern of INTENT_PATTERNS) {
      const matches = text.match(pattern.pattern)
      if (matches && matches.length > 0) {
        const confidence = Math.min(pattern.weight * (matches.length / Math.max(text.length / 15, 1)), 0.98)
        if (confidence > bestMatch.confidence) {
          bestMatch = { intent: pattern.intent, domain: pattern.domain, weight: pattern.weight, confidence }
          matches.forEach(m => actionVerbs.push(m))
        }
      }
    }

    const targetMatch = /(?:一款?|一种?|一个?)?\s*([^\s，。！？]{2,10})(?:配方|产品|饮料|食品|制剂|补充剂)/.exec(text)

    return {
      primary: bestMatch.intent,
      confidence: bestMatch.confidence,
      domain: bestMatch.domain,
      actionVerbs: [...new Set(actionVerbs)],
      targetObject: targetMatch?.[1],
    }
  }

  private analyzeContextGaps(text: string, intent: DetectedIntent): ContextGap {
    const domainInfo = DOMAIN_SPECIFIC_TERMS[intent.primary] || DOMAIN_SPECIFIC_TERMS.default
    const missingInfo: ContextGap['missingInformation'] = []

    for (const term of (domainInfo?.terms || [])) {
      const hasInfo = text.includes(term) ||
        term.split('、').some(part => text.includes(part)) ||
        this.hasRelatedInfo(text, term)

      if (!hasInfo) {
        const importance = this.isEssentialTerm(intent.primary, term) ? 'essential' :
                          this.isRecommendedTerm(intent.primary, term) ? 'recommended' : 'optional'

        missingInfo.push({
          type: term,
          description: this.getTermDescription(term),
          importance,
          suggestedValue: this.suggestDefaultValue(term, intent),
        })
      }
    }

    return {
      missingInformation: missingInfo,
      domainKnowledge: this.extractRelevantDomainKnowledge(intent),
      relevantStandards: this.getRelevantStandards(intent),
    }
  }

  private detectIssues(
    text: string,
    intent: DetectedIntent,
    contextGap: ContextGap,
  ): AnalysisIssue[] {
    const issues: AnalysisIssue[] = []
    let issueIndex = 0

    const criticalGaps = contextGap.missingInformation.filter(g => g.importance === 'essential')
    if (criticalGaps.length > 0) {
      issues.push({
        id: `issue_${++issueIndex}`,
        category: 'missing_context',
        severity: 'critical',
        message: `缺少${criticalGaps.length}项关键信息：${criticalGaps.map(g => g.type).join('、')}`,
        suggestion: `建议补充${criticalGaps.map(g => g.type).join('、')}等信息以获得更精准的结果`,
        autoFixable: true,
      })
    }

    const vaguePatterns = [
      { pattern: /好一点|更好|优化一下|改善|提高/, category: 'vague_requirements' as IssueCategory, msg: '使用了模糊的优化目标' },
      { pattern: /大概|大约|左右|可能|也许/, category: 'vague_requirements' as IssueCategory, msg: '存在不确定性表述' },
      { pattern: /等等|以及|还有一些|之类的/, category: 'insufficient_detail' as IssueCategory, msg: '信息不够具体完整' },
    ]

    for (const vp of vaguePatterns) {
      if (vp.pattern.test(text)) {
        issues.push({
          id: `issue_${++issueIndex}`,
          category: vp.category,
          severity: 'major',
          message: vp.msg,
          suggestion: '请将模糊描述替换为具体数值或明确标准',
          autoFixable: false,
        })
      }
    }

    for (const [informal, formal] of Object.entries(PROFESSIONAL_TERMINOLOGY_MAP)) {
      if (text.includes(informal)) {
        const idx = text.indexOf(informal)
        issues.push({
          id: `issue_${++issueIndex}`,
          category: 'poor_terminology',
          severity: 'minor',
          message: `"${informal}"是非规范表述`,
          suggestion: `建议替换为"${formal.standard}"（${formal.context}）`,
          location: { start: idx, end: idx + informal.length },
          autoFixable: true,
        })
      }
    }

    if (!text.includes('：') && !text.includes(':') && text.length < 30) {
      issues.push({
        id: `issue_${++issueIndex}`,
        category: 'structural_issues',
        severity: 'suggestion',
        message: '提示词结构较为简单，缺乏层次感',
        suggestion: '建议使用分点、分段等方式组织内容',
        autoFixable: true,
      })
    }

    if (!/\d/.test(text) && intent.primary !== 'INQUIRY') {
      issues.push({
        id: `issue_${++issueIndex}`,
        category: 'missing_constraints',
        severity: 'minor',
        message: '缺少具体的数量或范围约束',
        suggestion: '建议添加具体数值、百分比或范围限制',
        autoFixable: false,
      })
    }

    return issues
  }

  private evaluateQuality(prompt: string): QualityEvaluation {
    const dimensions: DimensionScore[] = [
      this.evaluateClarity(prompt),
      this.evaluateCompleteness(prompt),
      this.evaluateSpecificity(prompt),
      this.evaluateProfessionalism(prompt),
      this.evaluateExecutability(prompt),
      this.evaluateStructure(prompt),
    ]

    const overallScore = Math.round(
      dimensions.reduce((sum, d) => sum + d.score * d.weight, 0),
    )

    const grade = GRADE_THRESHOLDS.find(t => overallScore >= t.min)?.grade || 'F'

    const strengths = dimensions
      .filter(d => d.score >= 75)
      .flatMap(d => d.details.slice(0, 2))

    const weaknesses = dimensions
      .filter(d => d.score < 60)
      .flatMap(d => d.issues.slice(0, 2).map(i => i.message))

    const improvementPriority = dimensions
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .flatMap(d => d.issues.map(i => i.category))

    return {
      overallScore,
      grade,
      dimensions,
      summary: this.generateQualitySummary(overallScore, grade),
      strengths,
      weaknesses: [...new Set(weaknesses)],
      improvementPriority: [...new Set(improvementPriority)],
    }
  }

  private evaluateClarity(prompt: string): DimensionScore {
    let score = 70
    const details: string[] = []
    const issues: AnalysisIssue[] = []

    const sentences = prompt.split(/[。！？.!?]/).filter(s => s.trim().length > 0)

    if (sentences.length >= 1) {
      score += 5
      details.push(`包含${sentences.length}个完整句子`)
    }

    const ambiguousWords = ['一些', '某个', '适当', '合理', '相关']
    const ambiguityCount = ambiguousWords.filter(w => prompt.includes(w)).length

    if (ambiguityCount === 0) {
      score += 15
      details.push('无明显歧义词汇')
    } else if (ambiguityCount <= 2) {
      score += 5
      details.push(`存在${ambiguityCount}处轻微歧义`)
      issues.push({
        id: 'clarity_1',
        category: 'intent_ambiguous',
        severity: 'minor',
        message: `发现${ambiguityCount}处模糊表述`,
        suggestion: '将"适当""合理"等替换为具体标准',
        autoFixable: true,
      })
    } else {
      details.push(`存在${ambiguityCount}处模糊表述，影响理解`)
      issues.push({
        id: 'clarity_2',
        category: 'intent_ambiguous',
        severity: 'major',
        message: '多处使用模糊词汇导致意图不明确',
        suggestion: '逐一明确每个模糊表述的具体含义',
        autoFixable: false,
      })
    }

    if (/[？?]/.test(prompt)) {
      score += 5
      details.push('包含明确的询问意图')
    }

    if (/^(请|帮我|希望|需要|设计)/.test(prompt.trim())) {
      score += 5
      details.push('开头有明确的指令动词')
    }

    return {
      dimension: 'clarity',
      score: Math.min(score, 100),
      maxScore: 100,
      weight: QUALITY_WEIGHTS.clarity,
      details,
      issues,
    }
  }

  private evaluateCompleteness(prompt: string): DimensionScore {
    let score = 50
    const details: string[] = []
    const issues: AnalysisIssue[] = []

    const hasTargetObject = /[^\s]{2,}(?:配方|产品|饮料|食品|制剂)/.test(prompt)
    const hasAction = /设计|开发|分析|优化|查询|比较|评估/.test(prompt)
    const hasConstraint = /\d+[%gmgk]|不超过|范围内|介于|预算|成本|保质期/.test(prompt)
    const hasOutputFormat = /(?:格式|表格|列表|详细|步骤|方案|报告)/.test(prompt)

    if (hasTargetObject) { score += 15; details.push('✓ 包含目标对象') }
    else {
      issues.push({
        id: 'comp_1',
        category: 'missing_context',
        severity: 'major',
        message: '未明确指出目标对象（产品/配方名称）',
        suggestion: '在提示词中明确要处理的具体对象',
        autoFixable: true,
      })
    }

    if (hasAction) { score += 15; details.push('✓ 包含动作指令') }
    else {
      issues.push({
        id: 'comp_2',
        category: 'intent_ambiguous',
        severity: 'critical',
        message: '缺少明确的动作指令（如"设计""分析""优化"）',
        suggestion: '在开头添加明确的动作动词',
        autoFixable: true,
      })
    }

    if (hasConstraint) { score += 10; details.push('✓ 包含约束条件') }
    else {
      issues.push({
        id: 'comp_3',
        category: 'missing_constraints',
        severity: 'minor',
        message: '未提供具体的约束条件或范围',
        suggestion: '补充成本、时间、规模等约束信息',
        autoFixable: false,
      })
    }

    if (hasOutputFormat) { score += 5; details.push('✓ 指定了输出格式要求') }

    if (prompt.length > 50) { score += 5; details.push('✓ 内容长度适中') }
    if (prompt.length > 100) { score += 5; details.push('✓ 信息量充足') }

    return {
      dimension: 'completeness',
      score: Math.min(score, 100),
      maxScore: 100,
      weight: QUALITY_WEIGHTS.completeness,
      details,
      issues,
    }
  }

  private evaluateSpecificity(prompt: string): DimensionScore {
    let score = 55
    const details: string[] = []
    const issues: AnalysisIssue[] = []

    const quantityPattern = /(\d+(?:\.\d+)?)\s*(%|g|mg|kg|ml|L|ppm|IU|天|周|月|元)/g
    const quantities = [...prompt.matchAll(quantityPattern)]

    if (quantities.length >= 3) {
      score += 20
      details.push(`✓ 包含${quantities.length}个具体数值参数`)
    } else if (quantities.length >= 1) {
      score += 10
      details.push(`✓ 包含${quantities.length}个具体数值`)
    } else {
      issues.push({
        id: 'spec_1',
        category: 'vague_requirements',
        severity: 'major',
        message: '缺少具体的数值或参数规格',
        suggestion: '添加具体的数据指标（如含量、比例、范围）',
        autoFixable: false,
      })
    }

    const specificTerms = /(大豆肽|胶原蛋白|益生菌|VC|VE|固体饮料|片剂|胶囊|酶解|发酵|喷雾干燥)/
    if (specificTerms.test(prompt)) {
      score += 15
      details.push('✓ 使用了专业的具体术语')
    }

    const rangeIndicators = /(?:介于|范围|区间|不低于|不超过|以内|以上|以下)/
    if (rangeIndicators.test(prompt)) {
      score += 10
      details.push('✓ 包含范围或界限指示')
    }

    const examples = /(?:例如|比如|如|参照|参考)/
    if (examples.test(prompt)) {
      score += 5
      details.push('✓ 提供了示例或参考')
    }

    return {
      dimension: 'specificity',
      score: Math.min(score, 100),
      maxScore: 100,
      weight: QUALITY_WEIGHTS.specificity,
      details,
      issues,
    }
  }

  private evaluateProfessionalism(prompt: string): DimensionScore {
    let score = 60
    const details: string[] = []
    const issues: AnalysisIssue[] = []

    const professionalTerms = [
      '大豆肽', '胶原蛋白', '益生菌', '益生元', '膳食纤维', '多酚', '黄酮',
      '酶解', '发酵', '微囊化', '纳米乳化', '喷雾干燥', '超滤', '均质',
      'GRAS', '新资源食品', '保健食品', 'GB', 'FDA', 'EFSA',
      'ADI', 'NOAEL', 'LD50', '生物利用度', '半衰期',
    ]

    const foundTerms = professionalTerms.filter(t => prompt.includes(t))
    if (foundTerms.length >= 3) {
      score += 25
      details.push(`✓ 使用了${foundTerms.length}个专业术语：${foundTerms.join('、')}`)
    } else if (foundTerms.length >= 1) {
      score += 12
      details.push(`✓ 使用了${foundTerms.length}个专业术语`)
    } else {
      details.push('未检测到专业领域术语')
    }

    let informalCount = 0
    for (const informal of Object.keys(PROFESSIONAL_TERMINOLOGY_MAP)) {
      if (prompt.includes(informal)) {
        informalCount++
        issues.push({
          id: `prof_${informal}`,
          category: 'poor_terminology',
          severity: 'minor',
          message: `"${informal}"为口语化表达`,
          suggestion: `建议使用"${PROFESSIONAL_TERMINOLOGY_MAP[informal]?.standard}"`,
          autoFixable: true,
        })
      }
    }

    if (informalCount === 0) {
      score += 15
      details.push('✓ 未发现明显的非规范表述')
    }

    const standardRefs = /(?:GB\s*\d+|ISO\s*\d+|FDA|EFSA|CAC|Codex|中国药典|USP|EP)/
    if (standardRefs.test(prompt)) {
      score += 10
      details.push('✓ 引用了权威标准或法规')
    }

    return {
      dimension: 'professionalism',
      score: Math.min(score, 100),
      maxScore: 100,
      weight: QUALITY_WEIGHTS.professionalism,
      details,
      issues,
    }
  }

  private evaluateExecutability(prompt: string): DimensionScore {
    let score = 65
    const details: string[] = []
    const issues: AnalysisIssue[] = []

    const clearInstructions = /^(?:请|帮我|设计|开发|分析|优化|评估|查询|比较)/.test(prompt.trim())
    if (clearInstructions) {
      score += 10
      details.push('✓ 开头有明确的执行指令')
    }

    const hasOutputExpectation = /(?:输出|返回|生成|提供|给出|列出|展示|呈现)/.test(prompt)
    if (hasOutputExpectation) {
      score += 10
      details.push('✓ 明确了期望的输出类型')
    } else {
      issues.push({
        id: 'exec_1',
        category: 'unclear_output_format',
        severity: 'minor',
        message: '未明确期望的输出格式',
        suggestion: '添加"请以...格式输出"或"请提供..."等指引',
        autoFixable: true,
      })
    }

    const structuredRequest = /(?:[1-9][．.]|[-*+] |##|###|【|〖)/.test(prompt)
    if (structuredRequest) {
      score += 10
      details.push('✓ 使用了结构化的请求格式')
    }

    const scopeDefined = /(?:仅|只|重点|优先|主要|核心|首先)/.test(prompt)
    if (scopeDefined) {
      score += 5
      details.push('✓ 定义了处理范围或优先级')
    }

    if (prompt.length > 20 && prompt.length < 500) {
      score += 5
      details.push('✓ 长度适中，便于AI理解和执行')
    } else if (prompt.length <= 20) {
      issues.push({
        id: 'exec_2',
        category: 'insufficient_detail',
        severity: 'major',
        message: '提示词过短，可能导致AI理解偏差',
        suggestion: '扩展描述，增加更多背景和要求细节',
        autoFixable: true,
      })
    }

    return {
      dimension: 'executability',
      score: Math.min(score, 100),
      maxScore: 100,
      weight: QUALITY_WEIGHTS.executability,
      details,
      issues,
    }
  }

  private evaluateStructure(prompt: string): DimensionScore {
    let score = 60
    const details: string[] = []
    const issues: AnalysisIssue[] = []

    const hasSections = /(?:【[^】]+】|##\s+\w+|\d+[.、]\s*\w+)/.test(prompt)
    if (hasSections) {
      score += 20
      details.push('✓ 使用了分节或分点结构')
    } else {
      issues.push({
        id: 'struct_1',
        category: 'structural_issues',
        severity: 'suggestion',
        message: '内容组织较为扁平，缺乏层次',
        suggestion: '使用编号、标题或分节来组织内容',
        autoFixable: true,
      })
    }

    const paragraphs = prompt.split(/\n\n+/).filter(p => p.trim().length > 0)
    if (paragraphs.length >= 2) {
      score += 10
      details.push(`✓ 分为${paragraphs.length}个逻辑段落`)
    }

    const logicalConnectors = /(?:首先|其次|然后|最后|另外|此外|同时|因此|综上)/
    if (logicalConnectors.test(prompt)) {
      score += 10
      details.push('✓ 使用了逻辑连接词')
    }

    if (prompt.includes('\n')) {
      score += 5
      details.push('✓ 使用了换行分隔不同部分')
    }

    return {
      dimension: 'structure',
      score: Math.min(score, 100),
      maxScore: 100,
      weight: QUALITY_WEIGHTS.structure,
      details,
      issues,
    }
  }

  private async applyOptimizationRules(analysis: PromptAnalysisResult): Promise<string> {
    let optimized = analysis.originalPrompt
    const strategy = this.config.strategy

    switch (strategy) {
      case 'conservative':
        optimized = this.applyConservativeStrategy(optimized, analysis)
        break
      case 'balanced':
        optimized = this.applyBalancedStrategy(optimized, analysis)
        break
      case 'aggressive':
        optimized = this.applyAggressiveStrategy(optimized, analysis)
        break
      case 'domain_specific':
        optimized = this.applyDomainSpecificStrategy(optimized, analysis)
        break
    }

    if (this.config.customConstraints.length > 0) {
      optimized += '\n\n【附加约束】\n' + this.config.customConstraints.map(c => `- ${c}`).join('\n')
    }

    return optimized
  }

  private applyConservativeStrategy(prompt: string, analysis: PromptAnalysisResult): string {
    let optimized = prompt

    for (const [informal, formal] of Object.entries(PROFESSIONAL_TERMINOLOGY_MAP)) {
      if (optimized.includes(informal)) {
        optimized = optimized.replace(informal, formal.standard)
      }
    }

    const criticalIssues = analysis.issues.filter(i => i.severity === 'critical' && i.autoFixable)
    for (const issue of criticalIssues) {
      if (issue.category === 'missing_context' && analysis.contextGap.missingInformation.length > 0) {
        const essentialGaps = analysis.contextGap.missingInformation
          .filter(g => g.importance === 'essential')
          .slice(0, 2)

        if (essentialGaps.length > 0) {
          optimized += '\n\n【待确认信息】'
          essentialGaps.forEach(gap => {
            optimized += `\n- ${gap.type}：（待补充）`
          })
        }
      }
    }

    if (!/^(?:请|帮我|希望)/.test(optimized.trim())) {
      optimized = '请' + optimized
    }

    return optimized
  }

  private applyBalancedStrategy(prompt: string, analysis: PromptAnalysisResult): string {
    let optimized = this.applyConservativeStrategy(prompt, analysis)

    if (analysis.contextGap.missingInformation.length > 0) {
      const gapsToAdd = analysis.contextGap.missingInformation
        .filter(g => g.importance !== 'optional')
        .slice(0, 4)

      if (gapsToAdd.length > 0) {
        optimized += '\n\n【补充上下文】'
        gapsToAdd.forEach(gap => {
          const value = gap.suggestedValue || `（建议明确${gap.type}）`
          optimized += `\n- ${gap.type}：${value}`
        })
      }
    }

    const template = CONTEXT_ENHANCEMENT_TEMPLATES[analysis.intent.primary] ||
                     CONTEXT_ENHANCEMENT_TEMPLATES.default

    if (this.config.strategy === 'balanced' && analysis.evaluation.overallScore < 70) {
      optimized += '\n\n' + template
    }

    const outputFormat = OUTPUT_FORMAT_TEMPLATES[this.config.outputFormatPreference] ||
                         OUTPUT_FORMAT_TEMPLATES.mixed
    optimized += outputFormat

    return optimized
  }

  private applyAggressiveStrategy(prompt: string, analysis: PromptAnalysisResult): string {
    let optimized = this.applyBalancedStrategy(prompt, analysis)

    optimized = this.addRoleDefinition(optimized, analysis.intent)
    optimized = this.addStepByStepRequirements(optimized, analysis.intent)
    optimized = this.addQualityCriteria(optimized, analysis.intent)
    optimized = this.addExpertiseLevelGuidance(optimized)

    if (analysis.contextGap.domainKnowledge.length > 0) {
      optimized += '\n\n【领域知识参考】\n'
      optimized += analysis.contextGap.domainKnowledge.slice(0, 5).map(k => `- ${k}`).join('\n')
    }

    return optimized
  }

  private applyDomainSpecificStrategy(prompt: string, analysis: PromptAnalysisResult): string {
    let optimized = this.applyBalancedStrategy(prompt, analysis)

    const domainContext = DOMAIN_SPECIFIC_TERMS[analysis.intent.primary]
    if (domainContext) {
      optimized = `\n【专业背景】${domainContext.context}\n\n` + optimized
    }

    if (analysis.contextGap.relevantStandards.length > 0) {
      optimized += '\n\n【参考标准】\n'
      optimized += analysis.contextGap.relevantStandards.map(s => `- ${s}`).join('\n')
    }

    optimized += '\n\n【行业最佳实践提醒】\n'
    optimized += '- 请确保所有建议符合现行食品安全法规（GB 2760、GB 14881等）\n'
    optimized += '- 功能性声称需有充分的科学证据支持\n'
    optimized += '- 原料选择优先考虑已获批的新资源食品或普通食品原料\n'
    optimized += '- 工艺参数需经过验证并建立关键控制点(CCP)'

    return optimized
  }

  private addRoleDefinition(prompt: string, intent: DetectedIntent): string {
    const roleMap: Record<string, string> = {
      FORMULA_DESIGN: '你是一位拥有20年经验的食品配方研发专家，精通功能性食品、特膳食品和保健食品的开发。',
      OPTIMIZATION: '你是一位资深的产品优化工程师，擅长通过系统化方法提升产品性能、降低成本、改善品质。',
      ANALYSIS: '你是一位食品科学分析师，具备深厚的营养学、化学和微生物学知识背景。',
      SAFETY_ASSESSMENT: '你是一位食品安全与法规专家，熟悉国内外食品法规、毒理学评估和风险管理。',
      NUTRITION_ANALYSIS: '你是一位临床营养师兼食品营养研究员，精通人体营养代谢和功能性成分作用机制。',
      PROCESS_DESIGN: '你是一位食品工艺工程师，精通各类食品加工技术、设备选型和生产线设计。',
    }

    const role = roleMap[intent.primary] || '你是一位专业的食品行业顾问。'
    return `${role}\n\n${prompt}`
  }

  private addStepByStepRequirements(prompt: string, _intent: DetectedIntent): string {
    void _intent;
    return prompt + `\n\n【思考步骤要求】
1. 首先理解用户的核心需求和隐含诉求
2. 基于专业知识进行分析和推理
3. 给出有数据支撑的具体建议
4. 标注不确定之处和建议验证方法
5. 最终总结关键要点和行动计划`
  }

  private addQualityCriteria(prompt: string, _intent: DetectedIntent): string {
    void _intent;
    return prompt + `\n\n【回答质量标准】
- 准确性：数据和事实需有可靠来源
- 完整性：覆盖用户问题的各个方面
- 可操作性：建议应可直接落地执行
- 专业性：使用规范的行业术语
- 时效性：反映当前最新的行业标准和技术发展`
  }

  private addExpertiseLevelGuidance(prompt: string): string {
    const levelGuidance: Record<string, string> = {
      beginner: '\n\n【难度设置】请用通俗易懂的语言解释，避免过多专业术语，必要时提供类比说明。',
      intermediate: '\n\n【难度设置】保持专业性的同时确保可读性，专业术语首次使用时简要解释。',
      expert: '\n\n【难度设置】请深入展开技术细节，引用最新研究成果和前沿技术动态。',
    }

    return prompt + (levelGuidance[this.config.expertiseLevel] || '')
  }

  private async enhanceWithAI(prompt: string, _analysis: PromptAnalysisResult): Promise<string> {
    void _analysis;
    try {
      const response = await fetch(API_ENDPOINTS.AI.CHAT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `[Prompt Optimization Task] 请对以下提示词进行智能优化润色，保持原意不变，仅提升其专业性、完整性和可执行性。直接输出优化后的提示词，不要添加任何解释：\n\n${prompt}`,
        }),
        signal: AbortSignal.timeout(15000),
      })

      if (response.ok) {
        const data = await response.json() as { content?: string }
        if (data.content && data.content.length > prompt.length * 0.8) {
          logger.debug('[PromptOptimizer] AI增强成功')
          return data.content
        }
      }

      logger.debug('[PromptOptimizer] AI增强未返回有效结果，使用规则优化版本')
      return prompt

    } catch (error) {
      logger.warn('[PromptOptimizer] AI增强失败，回退到规则优化:', error)
      return prompt
    }
  }

  private generateImprovementList(
    original: string,
    optimized: string,
    _analysis: PromptAnalysisResult,
  ): OptimizationSuggestion[] {
    void _analysis;
    const suggestions: OptimizationSuggestion[] = []

    for (const [informal, formal] of Object.entries(PROFESSIONAL_TERMINOLOGY_MAP)) {
      if (original.includes(informal) && optimized.includes(formal.standard)) {
        suggestions.push({
          type: 'modification',
          originalText: informal,
          optimizedText: formal.standard,
          reason: formal.context,
          impact: ['professionalism', 'clarity'],
          confidence: 0.95,
        })
      }
    }

    if (optimized.includes('【') && !original.includes('【')) {
      suggestions.push({
        type: 'addition',
        optimizedText: '[新增结构化模块]',
        reason: '增加了结构化的上下文信息和输出格式要求',
        impact: ['completeness', 'executability', 'structure'],
        confidence: 0.9,
      })
    }

    if (optimized.length > original.length * 1.3) {
      suggestions.push({
        type: 'enhancement',
        originalText: original,
        optimizedText: optimized,
        reason: '大幅扩充了提示词的信息量和指导性',
        impact: ['completeness', 'specificity', 'executability'],
        confidence: 0.85,
      })
    }

    if (/^(?:你是一位)/.test(optimized) && !/^(?:你是一位)/.test(original)) {
      suggestions.push({
        type: 'addition',
        optimizedText: '[角色定义]',
        reason: '为AI设定了专业角色身份，提升回答的专业性和针对性',
        impact: ['professionalism', 'executability'],
        confidence: 0.92,
      })
    }

    return suggestions
  }

  private calculateQualityDelta(before: QualityEvaluation, after: QualityEvaluation): OptimizationResult['qualityDelta'] {
    const dimensions = {} as Record<QualityDimension, number>

    for (const dim of before.dimensions) {
      const afterDim = after.dimensions.find(d => d.dimension === dim.dimension)
      dimensions[dim.dimension] = afterDim ? afterDim.score - dim.score : 0
    }

    return {
      overall: after.overallScore - before.overallScore,
      dimensions,
    }
  }

  private getAppliedStrategyNames(): string[] {
    const names: string[] = []

    const strategyLabels: Record<OptimizationStrategy, string> = {
      conservative: '保守优化策略',
      balanced: '平衡优化策略',
      aggressive: '激进优化策略',
      domain_specific: '领域专用优化策略',
    }

    names.push(strategyLabels[this.config.strategy])

    if (this.config.enableAIEnhancement) {
      names.push('AI大模型增强')
    }

    if (this.config.customConstraints.length > 0) {
      names.push('自定义约束注入')
    }

    return names
  }

  private generateQualitySummary(score: number, _grade: string): string {
    void _grade;
    if (score >= 90) return '优秀的提示词，结构清晰、要素完整，能够有效引导AI产出高质量结果'
    if (score >= 78) return '良好的提示词，基本要素齐全，有少量可优化空间'
    if (score >= 68) return '中等质量的提示词，核心意图明确但缺少重要细节'
    if (score >= 55) return '基础水平的提示词，建议补充关键信息后重新提交'
    return '提示词质量较低，强烈建议使用优化功能进行系统性改进'
  }

  private assessComplexity(text: string): 'simple' | 'moderate' | 'complex' {
    const sentenceCount = text.split(/[。！？.!?]/).filter(s => s.trim().length > 0).length
    const clauseCount = text.split(/[,，;；]/).length
    const avgSentenceLength = text.length / Math.max(sentenceCount, 1)

    if (sentenceCount <= 2 && clauseCount <= 3 && avgSentenceLength < 30) return 'simple'
    if (sentenceCount <= 4 && clauseCount <= 8 && avgSentenceLength < 60) return 'moderate'
    return 'complex'
  }

  private calculateDomainRelevance(_text: string, intent: DetectedIntent): number {
    if (intent.domain !== '通用咨询') return 0.9
    return 0.5
  }

  private hasRelatedInfo(text: string, term: string): boolean {
    const synonyms: Record<string, string[]> = {
      '目标人群': ['用户', '消费者', '适用', '人群', '年龄', '性别'],
      '功能定位': ['功效', '作用', '功能', '效果', '目的'],
      '产品形态': ['剂型', '形态', '饮料', '片剂', '胶囊', '粉剂'],
      '成本预算': ['价格', '费用', '成本', '预算', '经济'],
      '保质期期望': ['保质期', '货架期', '储存', '稳定性'],
      '法规合规': ['法规', '标准', '认证', '合规', 'GB', '批准'],
    }

    const related = synonyms[term] || []
    return related.some(r => text.includes(r))
  }

  private isEssentialTerm(_intent: string, term: string): boolean {
    const essentialTerms = ['目标人群', '功能定位', '产品形态']
    return essentialTerms.includes(term)
  }

  private isRecommendedTerm(_intent: string, term: string): boolean {
    const recommendedTerms = ['成本预算', '保质期期望', '感官指标', '法规合规']
    return recommendedTerms.includes(term)
  }

  private getTermDescription(term: string): string {
    const descriptions: Record<string, string> = {
      '目标人群': '产品的主要使用者群体特征（年龄段、健康状况、生活方式等）',
      '功能定位': '产品要实现的核心功效或解决的问题',
      '产品形态': '最终产品的物理形态（固体饮料、液体、片剂等）',
      '口感要求': '风味、质地、溶解性等感官指标',
      '成本预算': '可接受的成本范围或目标售价',
      '保质期期望': '期望的货架期时长',
      '法规合规': '需符合的法规标准或认证要求',
      '原料来源': '对原料产地、品质等级、供应商的要求',
      '当前问题': '现有方案存在的具体不足',
      '优化目标': '希望通过优化达成的具体效果',
      '约束条件': '不可逾越的限制因素',
      '评价指标': '衡量优化效果的量化标准',
    }
    return descriptions[term] || `关于"${term}"的详细信息`
  }

  private suggestDefaultValue(term: string, intent: DetectedIntent): string | undefined {
    const defaults: Record<string, string | undefined> = {
      '目标人群': intent.targetObject ? `${intent.targetObject}的目标消费群体` : undefined,
      '产品形态': '固体饮料（可根据需求调整）',
      '法规合规': '符合GB/T 29602及食品安全国家标准',
    }
    return defaults[term]
  }

  private extractRelevantDomainKnowledge(intent: DetectedIntent): string[] {
    const knowledgeMap: Record<string, string[]> = {
      FORMULA_DESIGN: [
        '功能性食品配方设计需遵循"功效成分+载体系统+风味修饰"三元架构',
        '大豆肽推荐用量通常为1-5g/天，分子量<1000Da的生物活性更高',
        '固体饮料的水分活度(Aw)应控制在0.6以下以确保稳定性',
        '复配甜味剂可实现协同增效，降低单一甜味剂用量',
        '微囊化技术可保护敏感活性成分，掩蔽不良风味',
      ],
      OPTIMIZATION: [
        '配方优化遵循"单因子实验→响应面分析→验证测试"的科学流程',
        '成本优化需综合考虑原料成本、得率、能耗等多维因素',
        '感官优化建议采用三角测试或排序测试进行客观评价',
      ],
      ANALYSIS: [
        '营养成分分析需按照GB 5009系列标准方法执行',
        '功效评价应参考《保健食品功能检验与评价方法》',
        '稳定性试验需包括加速试验(37°C/75%RH, 6个月)和长期试验',
      ],
      default: [
        '食品配方开发需综合考虑营养、安全、感官、成本、法规五大维度',
        '建议参考GB 2760(添加剂)、GB 14881(卫生规范)、GB 7718(标签)等核心标准',
      ],
    }

    return knowledgeMap[intent.primary] || knowledgeMap.default || []
  }

  private getRelevantStandards(intent: DetectedIntent): string[] {
    const baseStandards = [
      'GB 2760 食品添加剂使用标准',
      'GB 7718 预包装食品标签通则',
      'GB 14881 食品生产通用卫生规范',
      'GB/T 29602 固体饮料',
    ]

    const specificStandards: Record<string, string[]> = {
      SAFETY_ASSESSMENT: [
        'GB 15193 食品安全性毒理学评价程序',
        'GB/T 15670 农药登记毒理学试验方法',
      ],
      NUTRITION_ANALYSIS: [
        'GB 28050 预包装食品营养标签通则',
        '中国居民膳食营养素参考摄入量(DRI)',
      ],
      PROCESS_DESIGN: [
        'GB 12695 饮料企业良好生产规范',
        'HACCP体系应用指南',
      ],
    }

    return [...baseStandards, ...(specificStandards[intent.primary] || [])]
  }
}

let optimizerInstance: PromptOptimizer | null = null

export function getPromptOptimizer(config?: PromptOptimizerConfig): PromptOptimizer {
  if (!optimizerInstance || config) {
    optimizerInstance = new PromptOptimizer(config)
  }
  return optimizerInstance
}

export default PromptOptimizer

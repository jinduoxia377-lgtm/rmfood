/**
 * FollowUpSuggestionService — 追问推荐服务
 *
 * 根据对话上下文和AI回复内容，智能推荐后续追问问题
 * 支持基于意图、实体和对话历史的动态推荐
 */
import { logger } from '@/utils/safeLogger'
import type { QuickQuestion } from '@/config/ai/questions'
import { QUICK_QUESTIONS } from '@/config/ai/questions'

/**
 * 追问建议接口
 */
export interface FollowUpSuggestion {
  id: string
  /** i18n key（ai.chat.quick.questions.*），用于在切换语言时翻译追问文本；动态问题无 i18n key 时缺省 */
  questionKey?: string
  question: string
  /** i18n key（ai.chat.quick.categories.*），用于在切换语言时翻译分类标签；动态问题无 i18n key 时缺省 */
  categoryKey?: string
  category: string
  confidence: number
  relatedEntities?: string[]
  relatedIntent?: string
  /** 建议来源：llm=后端动态生成，local=本地规则引擎 */
  source?: 'llm' | 'local'
}

/**
 * 领域上下文（LLM 失败时本地兜底引擎利用，生成贴合配方/体质/辨证的兜底问题）。
 * 全部可选：取不到就退回通用 QUICK_QUESTIONS 池（向后兼容）。
 */
export interface FollowUpDomainContext {
  /** 配方成分：名 + 可选克重 + 可选君臣佐使 role（来自 formula_context 解析） */
  ingredients?: Array<{ name: string; value?: number; unit?: string; role?: string }>
  /** 体质倾向（如「气虚质」「湿热质」） */
  constitution?: string | null
  /** 辨证要点摘要 */
  syndromePoints?: string | null
  /** 调理目标列表 */
  regulationGoals?: string[] | null
  /** 个人约束摘要（过敏原/禁忌/目标） */
  userConstraints?: string | null
  /** 合规结论摘要（药食同源目录/十八反十九畏/日用总量） */
  complianceContext?: string | null
}

/**
 * 对话上下文信息
 */
export interface ConversationContext {
  /** 当前话题关键词 */
  topicKeywords: string[]
  /** 已识别的实体 */
  entities: string[]
  /** 最近一次AI回复的意图类型 */
  lastIntent?: string
  /** 对话历史消息数 */
  messageCount: number
  /** 是否存在结构化配方输出 */
  hasFormulaOutput: boolean
  /** 是否存在安全警告 */
  hasSafetyWarning: boolean
  /** 领域上下文（LLM 失败时本地兜底增强用） */
  domain?: FollowUpDomainContext
}

/**
 * 追问推荐引擎
 */
export class FollowUpSuggestionEngine {
  private context: ConversationContext = {
    topicKeywords: [],
    entities: [],
    messageCount: 0,
    hasFormulaOutput: false,
    hasSafetyWarning: false,
  }

  /** 当前一次候选生成中标记为「领域候选」的问题 id（用于评分加分） */
  private domainCandidateIds: Set<string> = new Set()

  /**
   * 更新对话上下文
   */
  updateContext(context: Partial<ConversationContext>): void {
    this.context = { ...this.context, ...context }
    logger.debug('[FollowUpSuggestionEngine] Context updated:', this.context)
  }

  /**
   * 生成追问建议列表
   * 根据对话上下文从候选池中筛选最适合的问题
   */
  generateSuggestions(maxCount: number = 3): FollowUpSuggestion[] {
    const candidates = this.getCandidateQuestions()
    const scored = candidates.map(q => ({
      id: q.id,
      questionKey: q.questionKey,
      question: q.question,
      categoryKey: q.categoryKey,
      category: q.category,
      confidence: this.scoreQuestion(q),
      relatedEntities: this.extractRelatedEntities(q),
      relatedIntent: q.category,
      source: 'local' as const,
    }))

    // 按置信度排序，取前N个
    const sorted = scored
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxCount)

    // 去重：相同category只保留最高分
    const seenCategories = new Set<string>()
    const unique = sorted.filter(s => {
      if (seenCategories.has(s.category)) return false
      seenCategories.add(s.category)
      return true
    })

    logger.info('[FollowUpSuggestionEngine] Generated suggestions:', unique.length)
    return unique
  }

  /**
   * 获取候选问题池
   */
  private getCandidateQuestions(): QuickQuestion[] {
    const candidates: QuickQuestion[] = []

    // 领域上下文优先：LLM 失败时，本地兜底也应围绕当前配方/体质/辨证生成贴需求的问题，
    // 而非纯通用池。领域候选带高分标记，排序时优先于通用池（见 scoreQuestion）。
    const domainCandidates = this.buildDomainCandidates()
    this.domainCandidateIds = new Set(domainCandidates.map(q => q.id))
    candidates.push(...domainCandidates)

    // 优先添加与当前上下文相关的问题
    const relatedByCategory = this.context.topicKeywords.length > 0
      ? QUICK_QUESTIONS.filter(q =>
        this.context.topicKeywords.some(kw =>
          q.question.includes(kw) || q.category.includes(kw)
        )
      )
      : []

    candidates.push(...relatedByCategory)

    // 根据对话阶段补充问题
    if (this.context.hasFormulaOutput) {
      // 已有配方输出，推荐深化相关问题
      const deepQuestions = QUICK_QUESTIONS.filter(q =>
        ['配方设计', '安全合规', '配伍知识'].includes(q.category)
      )
      candidates.push(...deepQuestions)
    }

    if (this.context.hasSafetyWarning) {
      // 有安全警告，推荐安全相关问题
      const safetyQuestions = QUICK_QUESTIONS.filter(q =>
        q.category === '安全合规'
      )
      candidates.push(...safetyQuestions)
    }

    // 补充热门问题
    const popularQuestions = QUICK_QUESTIONS.filter(q => q.popular)
    candidates.push(...popularQuestions)

    // 去重
    const unique = candidates.filter((q, index, self) =>
      index === self.findIndex(item => item.id === q.id)
    )

    return unique
  }

  /**
   * 构建领域候选问题（围绕当前配方/体质/辨证/约束/合规），用于 LLM 失败时本地兜底。
   * 每个候选带 domainBoost 标记（见 domainCandidateIds），评分时获得加分以优先于通用池。
   * 取不到领域数据时返回空数组 → 自然退回通用 QUICK_QUESTIONS 池（向后兼容）。
   */
  private buildDomainCandidates(): QuickQuestion[] {
    const candidates: QuickQuestion[] = []
    const domain = this.context.domain
    if (!domain) return candidates

    // ① 配方成分：围绕前两位药材生成「用量依据」与「配伍/君臣佐使」问题
    const ingredients = (domain.ingredients ?? []).filter(i => i && i.name)
    if (ingredients.length > 0) {
      const top = ingredients.slice(0, 2)
      const nameList = top.map(i => i.name).join('、')
      // 用量依据：如「黄芪 15g 的用量依据是什么？」
      const dosageTarget = top[0]
      const dosageText = dosageTarget.value
        ? `${dosageTarget.name} ${dosageTarget.value}${dosageTarget.unit ?? 'g'}`
        : dosageTarget.name
      candidates.push({
        id: 'domain_formula_dosage',
        questionKey: 'domain_formula_dosage',
        question: `${dosageText} 的用量依据是什么？`,
        category: '配方设计',
        categoryKey: 'formulaDesign',
        popular: false,
      })
      // 配伍/君臣佐使：如「黄芪、党参 在方中的配伍作用（君臣佐使）如何？」
      const roleTarget = top.find(i => i.role) ?? top[0]
      candidates.push({
        id: 'domain_formula_role',
        questionKey: 'domain_formula_role',
        question: `${nameList} 在方中的配伍作用${roleTarget.role ? `（${roleTarget.role}）` : ''}是什么？`,
        category: '配伍知识',
        categoryKey: 'compatibilityKnowledge',
        popular: false,
      })
    }

    // ② 体质：围绕当前体质倾向生成辨识/调理问题
    const constitution = domain.constitution?.trim()
    if (constitution) {
      candidates.push({
        id: 'domain_constitution',
        questionKey: 'domain_constitution',
        question: `${constitution}该如何针对性调理？`,
        category: '体质辨识',
        categoryKey: 'constitution',
        popular: false,
      })
    }

    // ③ 辨证：围绕证候要点生成「为什么有效/机理」问题
    const syndrome = domain.syndromePoints?.trim()
    if (syndrome) {
      candidates.push({
        id: 'domain_syndrome',
        questionKey: 'domain_syndrome',
        question: '针对当前辨证结果，这个配方的调理机理是什么？',
        category: '配方设计',
        categoryKey: 'formulaDesign',
        popular: false,
      })
    }

    // ④ 个人约束：围绕过敏原/禁忌生成适配性问题
    const constraints = domain.userConstraints?.trim()
    if (constraints) {
      candidates.push({
        id: 'domain_constraints',
        questionKey: 'domain_constraints',
        question: '这个配方如何适配我的过敏原与饮食禁忌？',
        category: '安全合规',
        categoryKey: 'safetyCompliance',
        popular: false,
      })
    }

    // ⑤ 合规：围绕药食同源目录/十八反十九畏/日用总量生成校验问题
    const compliance = domain.complianceContext?.trim()
    if (compliance) {
      candidates.push({
        id: 'domain_compliance',
        questionKey: 'domain_compliance',
        question: '这个配方的药食同源目录合规性与日用总量如何校验？',
        category: '安全合规',
        categoryKey: 'safetyCompliance',
        popular: false,
      })
    }

    return candidates
  }

  /**
   * 对候选问题进行评分
   */
  private scoreQuestion(question: QuickQuestion): number {
    let score = 0.5 // 基础分

    // 领域候选（围绕当前配方/体质/辨证生成）优先于通用池
    if (this.domainCandidateIds.has(question.id)) {
      score += 0.45
    }

    // 热门问题加分
    if (question.popular) score += 0.15

    // 类别匹配加分
    if (this.context.topicKeywords.some(kw => question.question.includes(kw))) {
      score += 0.2
    }

    // 对话阶段适配加分
    if (this.context.hasFormulaOutput && question.category === '安全合规') {
      score += 0.15
    }
    if (this.context.hasFormulaOutput && question.category === '配方设计') {
      score += 0.1
    }
    if (this.context.messageCount > 5 && question.category === '配伍知识') {
      score += 0.1
    }

    // 多样性惩罚：避免推荐过多同类问题
    if (this.context.topicKeywords.length === 0 && question.popular) {
      score += 0.05
    }

    return Math.min(score, 1.0)
  }

  /**
   * 提取问题中相关的实体
   */
  private extractRelatedEntities(question: QuickQuestion): string[] {
    const entities: string[] = []
    const questionText = question.question.toLowerCase()

    // 简单实体匹配
    const knownEntities = [
      '黄芪', '党参', '枸杞', '人参', '桑叶', '苦瓜', '肉桂', '葛根',
      '睡眠', '血糖', '血压', '血脂', '免疫', '抗氧化', '肝', '肾',
    ]

    for (const entity of knownEntities) {
      if (questionText.includes(entity.toLowerCase())) {
        entities.push(entity)
      }
    }

    return entities
  }

  /**
   * 重置上下文
   */
  reset(): void {
    this.context = {
      topicKeywords: [],
      entities: [],
      messageCount: 0,
      hasFormulaOutput: false,
      hasSafetyWarning: false,
      domain: undefined,
    }
    this.domainCandidateIds = new Set()
    logger.debug('[FollowUpSuggestionEngine] Context reset')
  }
}

/**
 * 单例实例
 */
export const followUpSuggestionEngine = new FollowUpSuggestionEngine()
export default followUpSuggestionEngine

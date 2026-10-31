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
   * 对候选问题进行评分
   */
  private scoreQuestion(question: QuickQuestion): number {
    let score = 0.5 // 基础分

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
    }
    logger.debug('[FollowUpSuggestionEngine] Context reset')
  }
}

/**
 * 单例实例
 */
export const followUpSuggestionEngine = new FollowUpSuggestionEngine()
export default followUpSuggestionEngine

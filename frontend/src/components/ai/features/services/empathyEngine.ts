/**
 * 共情回应策略模块 (Empathy Response Strategy)
 *
 * 基于 SentimentEngine 的细粒度情感分析结果，为 AI 回复添加共情层：
 * - 负面情绪（焦虑/挫败）→ 安抚性前缀 + 建设性引导
 * - 困惑 → 引导式澄清 + 分步解释策略标记
 * - 正向情绪（满意/兴奋）→ 强化确认 + 主动延伸建议
 * - 中性 → 专业标准回复（无额外修饰）
 *
 * 设计原则：
 * 1. 共情层是"透明"的 — 不改变核心回答内容，只包裹情感适配外壳
 * 2. 强度自适应 — 高强度情绪触发更显著的共情，低强度则微妙处理
 * 3. 避免机械感 — 同类情绪有多种变体，随机选择避免重复
 * 4. 可配置 — 可通过 setStrategy 调整各情绪的回应强度和启用状态
 */

import { EmotionResult, EmotionCategory } from './sentimentEngine'

// ===== 类型定义 =====

export type EmpathyStrategy =
  | 'soothing'      // 安抚（焦虑/担忧）
  | 'acknowledgment' // 承认与确认（挫败/不满）
  | 'guidance'      // 引导澄清（困惑）
  | 'reinforcement' // 正向强化（满意/兴奋）
  | 'neutral'       // 中性专业（无特殊情绪）
  | 'none'          // 不添加任何共情层

export interface EmpathyResponse {
  /** 回应策略类型 */
  strategy: EmpathyStrategy
  /** 前缀文本（插入在AI回复开头） */
  prefix: string
  /** 后缀文本（追加在AI回复末尾） */
  suffix: string
  /** 是否需要在回复中添加结构化引导（如分步说明） */
  addStructuredGuidance: boolean
  /** 建议的回复语气调整 */
  toneAdjustment: 'warm' | 'professional' | 'encouraging' | 'calm' | null
}

interface StrategyConfig {
  enabled: boolean
  /** 触发该策略的最小情绪强度阈值 (0-100) */
  minIntensity: number
  /** 最大前缀长度（字符） */
  maxPrefixLength: number
  /** 最大后缀长度（字符） */
  maxSuffixLength: number
}

/** 共情强度等级（有序枚举，支持区间比较） */
export type IntensityLevel = 'low' | 'medium' | 'high'

/** 强度等级阈值配置 */
const INTENSITY_THRESHOLDS: { level: IntensityLevel; max: number }[] = [
  { level: 'low', max: 35 },
  { level: 'medium', max: 65 },
  { level: 'high', max: 100 },
]

// ===== 策略模板库 =====

/** 安抚策略模板（针对 anxious 焦虑情绪） */
const SOOTHING_TEMPLATES = {
  low: [
    '我理解您的顾虑。让我们一起来分析这个问题。\n\n',
    '这是一个值得认真对待的问题。请看以下分析：\n\n',
    '您提出的担心很有道理。下面我为您详细说明：\n\n',
  ],
  medium: [
    '我完全理解您对此事的关切。作为配方领域的专业人士，我会从多个角度为您梳理清楚，请您放心。\n\n',
    '感受到您的担忧了。这类问题确实需要谨慎对待，我会为您提供全面、可靠的分析和建议。\n\n',
    '非常理解您的心情。让我为您系统地分析一下，帮助您做出最合适的判断。\n\n',
  ],
  high: [
    '我深切理解您此刻的顾虑。请相信，我会以最严谨的态度为您逐一排查每个疑点，确保给您一个清晰、可靠的答案。\n\n',
    '注意到您对此事比较担心。这完全正常 — 配方安全关系到健康，谨慎是对的。我会用最通俗易懂的方式为您把每个环节讲透。\n\n',
  ],
}

/** 承认与确认策略模板（针对 frustrated 挫败情绪） */
const ACKNOWLEDGMENT_TEMPLATES = {
  low: [
    '收到您的反馈。让我重新梳理一下：\n\n',
    '明白，我们换个角度来看这个问题：\n\n',
    '感谢您的耐心。以下是我整理后的思路：\n\n',
  ],
  medium: [
    '很抱歉之前的回答未能满足您的需求。让我重新为您梳理，确保这次能真正帮到您。\n\n',
    '我理解您可能有些不满意。这是我的疏忽 — 让我用更清晰的方式重新组织答案。\n\n',
    '感受到了您的反馈。我会调整回答方式，力求更精准地解决您的疑问。\n\n',
  ],
  high: [
    '真诚地道歉 — 我意识到之前的回复可能让您感到失望。现在让我重新从头开始，用最直接的方式为您解答。\n\n',
    '非常抱歉带给您不好的体验。您的反馈对我很重要 — 让我换一个角度，用更贴合您需求的方式来分析。\n\n',
  ],
}

/** 引导澄清策略模板（针对 confused 困惑情绪） */
const GUIDANCE_TEMPLATES = {
  low: [
    '为了让您更好地理解，我将从基础概念开始说明：\n\n',
    '这个话题涉及几个关键点，我逐一为您解释：\n\n',
    '好的，让我把这个问题的几个层面拆解开来：\n\n',
  ],
  medium: [
    '感觉到您可能对某些概念还不太熟悉。没关系，我从最基础的原理开始，一步步带您理解。\n\n',
    '这个问题确实有一定复杂度。我把它拆成3个部分来讲，每部分都会配有具体例子，确保您能跟上思路。\n\n',
    '理解您的困惑 — 这类问题初接触时确实容易混淆。我用一个类比来帮助您建立直观认识：\n\n',
  ],
  high: [
    '注意到您可能遇到了一些理解上的障碍。这很正常！让我用一个全新的方式来解释 — 这次我们从实际应用场景出发，配合图示化的描述，确保每一个细节都清晰明了。\n\n',
    '看来之前的方式可能不够直观。我换一种讲法 — 先问您一个简单问题确认理解基线，然后针对性地逐步展开。\n\n',
  ],
}

/** 正向强化策略模板（针对 satisfied/excited 正面情绪） */
const REINFORCEMENT_TEMPLATES = {
  low: [
    '',
    '\n\n---\n*如果您还有其他问题，随时可以继续讨论。*',
  ],
  medium: [
    '很高兴能为您提供有价值的参考！\n\n',
    '\n\n---\n*看到您对这个方向感兴趣，如果需要深入探讨某个具体环节，我可以进一步展开。*',
  ],
  high: [
    '太好了！您提出的问题非常有价值，说明您在这个领域已经有了相当深入的思考。\n\n',
    '\n\n---\n*您的洞察力很强！基于目前的讨论，我建议我们可以进一步探索以下几个方向……*',
  ],
}

// ===== 核心实现 =====

class EmpathyEngine {
  private config: Record<EmotionCategory, StrategyConfig>

  constructor() {
    this.config = {
      satisfied:  { enabled: true, minIntensity: 30, maxPrefixLength: 40,  maxSuffixLength: 80 },
      confused:    { enabled: true, minIntensity: 25, maxPrefixLength: 60,  maxSuffixLength: 40 },
      anxious:     { enabled: true, minIntensity: 30, maxPrefixLength: 80,  maxSuffixLength: 60 },
      frustrated:  { enabled: true, minIntensity: 35, maxPrefixLength: 80,  maxSuffixLength: 60 },
      curious:     { enabled: true, minIntensity: 20, maxPrefixLength: 30,  maxSuffixLength: 50 },
      excited:     { enabled: true, minIntensity: 40, maxPrefixLength: 50,  maxSuffixLength: 100 },
      neutral:     { enabled: false, minIntensity: 0,  maxPrefixLength: 0,  maxSuffixLength: 0 },
      unknown:     { enabled: false, minIntensity: 0,  maxPrefixLength: 0,  maxSuffixLength: 0 },
    }
  }

  /**
   * 核心方法：根据情感分析结果生成共情回应配置
   *
   * @param sentimentResult - SentimentEngine 的分析结果
   * @param context - 可选上下文信息（如对话轮次、是否首次提问）
   * @returns 共情回应配置（prefix/suffix/strategy/tone）
   */
  generateResponse(
    sentimentResult: EmotionResult,
    context?: { turnCount?: number; isFirstQuery?: boolean; hasErrorOccurred?: boolean },
  ): EmpathyResponse {
    const { primary: primaryEmotion, intensity, polarity } = sentimentResult

    // 1. 确定策略类型
    const strategy = this.determineStrategy(primaryEmotion, intensity, polarity, context)

    // 2. 如果策略为 none 或 neutral，返回空共情
    if (strategy === 'none' || strategy === 'neutral') {
      return {
        strategy,
        prefix: '',
        suffix: '',
        addStructuredGuidance: false,
        toneAdjustment: null,
      }
    }

    // 3. 根据策略和强度等级选择模板
    const intensityLevel = this.getIntensityLevel(intensity)
    const { prefix, suffix, toneAdjustment, addStructuredGuidance } =
      this.selectTemplates(strategy, intensityLevel)

    return {
      strategy,
      prefix,
      suffix,
      addStructuredGuidance,
      toneAdjustment,
    }
  }

  /**
   * 将共情层应用到 AI 回复文本上
   *
   * @param aiReply - 原始 AI 回复
   * @param empathy - 共情回应配置
   * @returns 包裹共情层的完整回复
   */
  applyEmpathy(aiReply: string, empathy: EmpathyResponse): string {
    if (!empathy.prefix && !empathy.suffix) {
      return aiReply
    }

    let result = aiReply

    // 添加前缀
    if (empathy.prefix) {
      result = empathy.prefix + result
    }

    // 添加后缀
    if (empathy.suffix) {
      result = result + empathy.suffix
    }

    // 如果需要结构化引导，在回复中插入分段标记
    if (empathy.addStructuredGuidance && result.length > 200) {
      result = this.insertStructureMarkers(result)
    }

    return result
  }

  // ===== 内部方法 =====

  private determineStrategy(
    emotion: EmotionCategory,
    intensity: number,
    polarity: string,
    ctx?: { turnCount?: number; isFirstQuery?: boolean; hasErrorOccurred?: boolean },
  ): EmpathyStrategy {
    const cfg = this.config[emotion]

    // 未达到最小强度或未启用 → 不添加共情
    if (!cfg.enabled || intensity < cfg.minIntensity) {
      return 'none'
    }

    // 错误发生后的特殊处理
    if (ctx?.hasErrorOccurred) {
      if (emotion === 'frustrated' || emotion === 'anxious') {
        return 'acknowledgment'
      }
    }

    // 情绪→策略映射
    switch (emotion) {
      case 'anxious':
        return 'soothing'
      case 'frustrated':
        return 'acknowledgment'
      case 'confused':
        return 'guidance'
      case 'satisfied':
      case 'excited':
        return 'reinforcement'
      case 'curious':
        // 低强度好奇 → neutral，中高强度 → mild reinforcement
        return intensity > 50 ? 'reinforcement' : 'neutral'
      default:
        return 'neutral'
    }
  }

  private getIntensityLevel(intensity: number): IntensityLevel {
    // P1优化：使用阈值表替代 if-else 链，便于扩展和调整
    for (const { level, max } of INTENSITY_THRESHOLDS) {
      if (intensity <= max) return level
    }
    return 'high'
  }

  private selectTemplates(
    strategy: EmpathyStrategy,
    level: IntensityLevel,
  ): { prefix: string; suffix: string; toneAdjustment: EmpathyResponse['toneAdjustment']; addStructuredGuidance: boolean } {
    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

    switch (strategy) {
      case 'soothing':
        return {
          prefix: pick(SOOTHING_TEMPLATES[level]),
          suffix: level === 'high' ? '\n\n*如果在阅读过程中有任何不确定的地方，请随时告诉我。*' : '',
          toneAdjustment: 'calm',
          addStructuredGuidance: level === 'high',
        }

      case 'acknowledgment':
        return {
          prefix: pick(ACKNOWLEDGMENT_TEMPLATES[level]),
          suffix: level >= 'medium' ? '\n\n*这次的回答是否更清晰？如果还有疑问，请直接指出具体不明确的部分。*' : '',
          toneAdjustment: 'warm',
          addStructuredGuidance: level === 'high',
        }

      case 'guidance':
        return {
          prefix: pick(GUIDANCE_TEMPLATES[level]),
          suffix: level >= 'medium' ? '\n\n---\n*以上内容如果有任何不清楚的地方，欢迎随时追问 — 我可以针对具体概念做更详细的解释。*' : '',
          toneAdjustment: 'professional',
          addStructuredGuidance: true,
        }

      case 'reinforcement':
        return {
          prefix: pick(REINFORCEMENT_TEMPLATES[level].slice(0, 1)),
          suffix: pick(REINFORCEMENT_TEMPLATES[level].slice(1)) || REINFORCEMENT_TEMPLATES[level][1] || '',
          toneAdjustment: level === 'high' ? 'encouraging' : 'warm',
          addStructuredGuidance: false,
        }

      default:
        return { prefix: '', suffix: '', toneAdjustment: null, addStructuredGuidance: false }
    }
  }

  /**
   * 在长回复中插入结构化标记（用于困惑高强度的引导模式）
   */
  private insertStructureMarkers(text: string): string {
    // 如果已有明确的分段标记，不再重复插入
    if (/^(###|##|\d+\.|【)/m.test(text)) {
      return text
    }

    // 按句号分段，超过3句的内容插入简明标记
    const sentences = text.split(/(?<=[。！？])\s*/)
    if (sentences.length <= 3) {
      return text
    }

    // 在第2句后插入分隔
    const inserted = [...sentences]
    if (inserted.length > 2) {
      inserted.splice(2, 0, '\n\n')
    }

    return inserted.join('')
  }

  // ===== 配置管理 =====

  /**
   * 更新某类情绪的策略配置
   */
  setStrategyConfig(emotion: EmotionCategory, partial: Partial<StrategyConfig>): void {
    this.config[emotion] = { ...this.config[emotion], ...partial }
  }

  /**
   * 启用/禁用某类情绪的共情回应
   */
  setEnabled(emotion: EmotionCategory, enabled: boolean): void {
    this.config[emotion].enabled = enabled
  }

  /**
   * 获取当前配置（调试用）
   */
  getConfig(): Readonly<Record<EmotionCategory, StrategyConfig>> {
    return { ...this.config }
  }
}

// ===== 单例导出 =====

export const empathyEngine = new EmpathyEngine()

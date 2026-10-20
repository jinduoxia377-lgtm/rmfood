/**
 * TokenBudgetManager — Token 预算管理器
 *
 * 参照 DeepSeek Harness TokenMeter 设计：
 * - 同步 token 估算（无异步）
 * - 基于中文字符/英文单词/数字的混合估算模型
 * - 保留对话完整性：始终保留首条用户消息和最近 N 条完整消息
 *
 * @version 1.0.0
 */

import type { ChatMessage } from '../../types'

export interface TokenEstimate {
  content: string
  tokens: number
  cnChars: number
  enWords: number
  nums: number
}

const CN_CHAR_WEIGHT = 1.5
const EN_WORD_WEIGHT = 0.8
const NUM_WEIGHT = 1.2
const NEWLINE_WEIGHT = 0.3
const PUNCT_WEIGHT = 0.5   // 标点/空格/特殊字符（如 JSON 结构符）
const JSON_PENALTY = 1.15  // JSON/markup 结构字符整体加权（{ } : " 等高频出现）

/** 常见模型每 1K tokens 价格（USD），用于成本估算 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'deepseek-chat':       { input: 0.0005,  output: 0.002 },
  'deepseek-reasoner':   { input: 0.001,   output: 0.004 },
  'deepseek-v3':         { input: 0.001,   output: 0.002 },
  'gpt-4o':              { input: 0.0025,  output: 0.01 },
  'gpt-4o-mini':         { input: 0.00015, output: 0.0006 },
  'glm-4':               { input: 0.001,   output: 0.002 },
}

export interface ModelPricing {
  provider: string
  model: string
  inputPerK: number   // USD per 1K input tokens
  outputPerK: number  // USD per 1K output tokens
}

export class TokenBudgetManager {
  /** 默认最大历史 token 数（留给 system prompt + 工具调用预留空间） */
  private readonly DEFAULT_MAX_TOKENS = 6000
  /** 安全边际：超过此比例时触发压缩检查 */
  private readonly COMPACTION_THRESHOLD = 0.85
  /** 每次保留的最少消息数（保证对话连贯性） */
  private readonly MIN_KEEP_MESSAGES = 4

  /**
   * 估算字符串的 token 数
   * 中文字符 ≈ 1.5 token，英文单词 ≈ 0.8 token，数字 ≈ 1.2 token，
   * 标点/空白 ≈ 0.5 token；JSON 结构内容整体 ×1.15 修正系数
   */
  estimateTokens(content: string): number {
    if (!content) return 0

    const cn = (content.match(/[\u4e00-\u9fa5]/g) || []).length
    const en = (content.match(/[a-zA-Z]+/g) || []).length
    const nums = (content.match(/\d+/g) || []).length
    const newlines = (content.match(/\n/g) || []).length
    // 标点、空白及常见 JSON 结构字符（{ } : " , [ ]）的近似 token 贡献
    const structChars = (content.match(/[{}[\]:,"\s]/g) || []).length

    let raw =
      cn * CN_CHAR_WEIGHT +
      en * EN_WORD_WEIGHT +
      nums * NUM_WEIGHT +
      newlines * NEWLINE_WEIGHT +
      structChars * PUNCT_WEIGHT

    // 若消息中含明显 JSON/markup 结构，施加小幅修正
    const hasJson = /[{}[]/.test(content)
    if (hasJson) raw *= JSON_PENALTY

    return Math.ceil(raw)
  }

  /**
   * 计算单条消息的 token 信息
   */
  estimateMessage(msg: ChatMessage): TokenEstimate {
    return {
      content: msg.content,
      tokens: this.estimateTokens(msg.content),
      cnChars: (msg.content.match(/[\u4e00-\u9fa5]/g) || []).length,
      enWords: (msg.content.match(/[a-zA-Z]+/g) || []).length,
      nums: (msg.content.match(/\d+/g) || []).length,
    }
  }

  /**
   * 计算消息列表的总 token 数
   */
  estimateHistory(messages: ChatMessage[]): number {
    return messages.reduce((sum, m) => sum + this.estimateTokens(m.content), 0)
  }

  /**
   * 选择适合发送给后端的对话历史
   *
   * 策略（参照 DSH Context Projection）：
   * 1. 过滤无效消息（error、空内容）
   * 2. 始终保留第一条用户消息（对话起点）
   * 3. 从最新消息向前累加，直到 token 预算耗尽
   * 4. 保证最少保留 MIN_KEEP_MESSAGES 条
   */
  selectHistory(
    messages: ChatMessage[],
    maxTokens: number = this.DEFAULT_MAX_TOKENS
  ): Array<{ role: string; content: string }> {
    // 过滤有效消息
    const validMessages = messages.filter(
      m => !m.error && m.content && (m.role === 'user' || m.role === 'assistant')
    )

    if (validMessages.length === 0) return []

    // 从最新消息开始向前累加
    let totalTokens = 0
    const selected: ChatMessage[] = []

    for (let i = validMessages.length - 1; i >= 0; i--) {
      const msg = validMessages[i]
      const tokens = this.estimateTokens(msg.content)

      // 如果加上这条消息会超出预算，且已有足够上下文，停止
      if (totalTokens + tokens > maxTokens && selected.length >= this.MIN_KEEP_MESSAGES) {
        break
      }

      selected.unshift(msg)
      totalTokens += tokens
    }

    // 确保至少保留第一条消息（对话起点）
    if (selected.length > 0 && selected[0] !== validMessages[0]) {
      selected.unshift(validMessages[0])
    }

    // 转换为后端要求的格式
    return selected.map(m => ({
      role: m.role,
      content: m.content, // ✅ 不再截断，保留完整内容
    }))
  }

  /**
   * 检测是否需要触发上下文压缩
   */
  shouldCompact(messages: ChatMessage[], currentTokens?: number): boolean {
    const tokens = currentTokens ?? this.estimateHistory(messages)
    return tokens > this.DEFAULT_MAX_TOKENS * this.COMPACTION_THRESHOLD
  }

  /**
   * 获取当前 token 使用率（0-1）
   */
  getUsageRatio(messages: ChatMessage[]): number {
    const total = this.estimateHistory(messages)
    return Math.min(total / this.DEFAULT_MAX_TOKENS, 1)
  }

  /**
   * 按 token 预算截断消息（用于调试/统计）
   */
  truncateToFit(messages: ChatMessage[], maxTokens: number): {
    selected: ChatMessage[]
    totalTokens: number
    truncatedCount: number
  } {
    const validMessages = messages.filter(
      m => !m.error && m.content && (m.role === 'user' || m.role === 'assistant')
    )

    let totalTokens = 0
    const selected: ChatMessage[] = []

    for (let i = validMessages.length - 1; i >= 0; i--) {
      const msg = validMessages[i]
      const tokens = this.estimateTokens(msg.content)

      if (totalTokens + tokens > maxTokens && selected.length >= this.MIN_KEEP_MESSAGES) {
        break
      }

      selected.unshift(msg)
      totalTokens += tokens
    }

    return {
      selected,
      totalTokens,
      truncatedCount: validMessages.length - selected.length,
    }
  }

  /**
   * 估算指定模型每 1K tokens 的价格（参照 DSH TokenMeter.pricingFor）
   */
  pricingFor(provider: string, model: string): ModelPricing {
    const direct = MODEL_PRICING[model.toLowerCase()]
    if (direct) {
      return { provider, model, inputPerK: direct.input, outputPerK: direct.output }
    }
    // fallback: 使用 deepseek-chat 定价
    const fallback = MODEL_PRICING['deepseek-chat']
    return { provider, model, inputPerK: fallback.input, outputPerK: fallback.output }
  }

  /**
   * 估算当前上下文成本（USD）
   */
  estimateCost(messages: ChatMessage[], model = 'deepseek-chat'): number {
    const pricing = this.pricingFor('local', model)
    const inputTokens = this.estimateHistory(messages)
    // 假设输出 token ≈ 输入 token 的 1.5 倍（平均对话长度比）
    const outputTokens = Math.ceil(inputTokens * 1.5)
    return (inputTokens / 1000) * pricing.inputPerK + (outputTokens / 1000) * pricing.outputPerK
  }
}

export const tokenBudgetManager = new TokenBudgetManager()
export default TokenBudgetManager

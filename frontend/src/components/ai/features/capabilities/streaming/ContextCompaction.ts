/**
 * ContextCompaction — 上下文压缩引擎
 *
 * 参照 DeepSeek Harness Compaction 算法：
 * - 当 token 接近上限时，用摘要替换旧消息
 * - 保留关键信息（首次问题、核心配方数据）
 * - 压缩后日志完整可追溯
 *
 * @version 1.0.0
 */

import type { ChatMessage } from '../../types'
import { logger } from '@/utils/safeLogger'
import { COMPACT_TRIGGER_THRESHOLD } from '@/config/ai/constants'

export interface CompactionResult {
  /** 压缩后的消息列表 */
  messages: ChatMessage[]
  /** 被压缩的消息数量 */
  compressedCount: number
  /** 生成的摘要文本 */
  summary: string
  /** 触发原因 */
  trigger: 'pressure' | 'overflow'
}

export class ContextCompactionEngine {
  /** 压缩触发阈值：token 使用率超过此值时触发 */
  private readonly TRIGGER_THRESHOLD = COMPACT_TRIGGER_THRESHOLD
  /** 压缩后保留的最大 token 数 */
  private readonly TARGET_TOKENS = 3000
  /** 始终保留的首条用户消息（对话起点） */
  private readonly KEEP_FIRST_USER = true
  /** 始终保留的最后 N 条完整消息 */
  private readonly KEEP_LAST_N = 6

  /**
   * 检测是否需要压缩
   */
  shouldCompact(messages: ChatMessage[], estimatedTokens: number): boolean {
    if (messages.length < 20) return false
    return estimatedTokens > this.TARGET_TOKENS * this.TRIGGER_THRESHOLD
  }

  /**
   * 执行压缩
   *
   * 策略（参照 DSH Compaction flow）：
   * 1. 选择可压缩范围（早期消息）
   * 2. 调用 LLM 生成摘要
   * 3. 将摘要作为新消息插入，替换被压缩的范围
   */
  async compact(
    messages: ChatMessage[],
    onProgress?: (step: string) => void
  ): Promise<CompactionResult> {
    const validMessages = messages.filter(
      m => !m.error && m.content && (m.role === 'user' || m.role === 'assistant')
    )

    if (validMessages.length < 20) {
      return {
        messages,
        compressedCount: 0,
        summary: '',
        trigger: 'pressure',
      }
    }

    onProgress?.('开始上下文压缩...')

    // 1. 确定压缩范围（早期消息，保留最近 N 条）
    const keepFromEnd = Math.min(this.KEEP_LAST_N, Math.floor(validMessages.length * 0.3))
    const compressUpTo = validMessages.length - keepFromEnd

    if (compressUpTo <= 2) {
      logger.warn('[ContextCompaction] 可压缩消息不足，跳过压缩')
      return {
        messages,
        compressedCount: 0,
        summary: '',
        trigger: 'pressure',
      }
    }

    const messagesToCompress = validMessages.slice(0, compressUpTo)
    const messagesToKeep = validMessages.slice(compressUpTo)

    // 2. 构建压缩提示
    onProgress?.('正在生成摘要...')

    // 3. 纯规则摘要（不依赖 LLM，避免递归调用）
    const summary = this.buildRuleSummary(messagesToCompress)

    // 4. 构建压缩后的消息列表
    const summaryMessage: ChatMessage = {
      id: `compacted-summary-${Date.now()}`,
      role: 'system' as const,
      content: `【对话摘要】${summary}`,
      timestamp: Date.now(),
    }

    // 5. 保留首条用户消息（如果不在 keep 范围内）
    const result: ChatMessage[] = []
    if (this.KEEP_FIRST_USER && messagesToCompress.length > 0) {
      result.push(messagesToCompress[0])
    }
    result.push(summaryMessage)
    result.push(...messagesToKeep)

    logger.info(`[ContextCompaction] 压缩完成: ${messagesToCompress.length}条 → 保留${result.length}条`)

    return {
      messages: result,
      compressedCount: messagesToCompress.length - (this.KEEP_FIRST_USER ? 1 : 0),
      summary,
      trigger: 'pressure',
    }
  }

  /**
   * 构建压缩提示词
   */
  private buildCompressionPrompt(messages: ChatMessage[]): string {
    const conversation = messages
      .map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
      .join('\n\n')

    return `请为以下对话生成精炼摘要，保留关键信息和上下文：

${conversation}

要求：
1. 摘要不超过200字
2. 保留关键配方数据、成分名称、剂量等核心信息
3. 用中文输出
4. 直接输出摘要，不需要额外解释`
  }

  /**
   * 简单的摘要生成（LLM 不可用时的降级方案）
   */
  private buildRuleSummary(messages: ChatMessage[]): string {
    const userMessages = messages.filter(m => m.role === 'user')
    const assistantMessages = messages.filter(m => m.role === 'assistant')

    const keyPoints: string[] = []

    // 提取用户问题要点
    userMessages.slice(-3).forEach(m => {
      const preview = m.content.slice(0, 50)
      if (preview) keyPoints.push(`用户: ${preview}...`)
    })

    // 提取助手回复要点
    assistantMessages.slice(-2).forEach(m => {
      const preview = m.content.slice(0, 80)
      if (preview) keyPoints.push(`助手: ${preview}...`)
    })

    return `本次对话包含 ${messages.length} 条消息，主要涉及：${keyPoints.slice(0, 3).join('、')}`
  }
}

export const contextCompactionEngine = new ContextCompactionEngine()
export default ContextCompactionEngine

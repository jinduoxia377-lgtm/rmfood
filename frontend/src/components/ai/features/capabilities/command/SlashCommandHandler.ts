/**
 * SlashCommandHandler — Human Command 斜杠指令处理
 *
 * 参照 DeepSeek Harness Human Command 设计：
 * - /clear  → 清空当前会话
 * - /compact → 手动触发上下文压缩
 * - /topic  → 切换会话主题
 * - /fork   → 在指定消息后创建分支（可选）
 * - /resume → 恢复到指定消息历史节点
 *
 * @version 1.0.0
 */

import { logger } from '@/utils/safeLogger'
import type { ChatMessage } from '../../types'

export interface SlashCommandResult {
  handled: boolean
  action: 'clear' | 'compact' | 'topic' | 'fork' | 'resume' | 'help' | 'unknown'
  message?: string
}

export type SlashCommandHandler = (
  command: string,
  args: string,
  context: SlashCommandContext,
) => Promise<SlashCommandResult>

export interface SlashCommandContext {
  /** 清空消息 */
  clearMessages: () => void
  /** 检查并执行上下文压缩 */
  checkCompaction: () => Promise<void>
  /** 切换到指定 topic */
  switchTopic: (topic: string) => void
  /** 创建会话分支（可选，fallback 到无分支操作） */
  forkAtMessage?: (messageId: string, title?: string) => Promise<string>
  /** 恢复到指定消息（可选，fallback 到无恢复操作） */
  resumeToMessage?: (messageId: string) => Promise<ChatMessage[] | null>
  /** 获取当前所有消息（用于 /fork 和 /resume） */
  getMessages: () => ChatMessage[]
}

const COMMANDS = [
  { name: 'clear', desc: '清空当前会话消息' },
  { name: 'compact', desc: '手动触发上下文压缩' },
  { name: 'topic', desc: '切换会话主题（例：/topic formula_design）' },
  { name: 'fork', desc: '从指定消息创建分支（例：/fork msg-id "分支名"）' },
  { name: 'resume', desc: '恢复到指定消息历史节点（例：/resume msg-id）' },
  { name: 'help', desc: '显示帮助信息' },
] as const

export class SlashCommandHandlerService {
  private handlers: Map<string, SlashCommandHandler> = new Map()

  constructor() {
    this.registerDefaultHandlers()
  }

  /** 注册自定义处理器 */
  register(name: string, handler: SlashCommandHandler): void {
    this.handlers.set(name, handler)
    logger.debug(`[SlashCommand] 注册命令: ${name}`)
  }

  /**
   * 执行斜杠指令
   */
  async execute(
    rawInput: string,
    context: SlashCommandContext,
  ): Promise<SlashCommandResult> {
    const trimmed = rawInput.trim()
    if (!trimmed.startsWith('/')) {
      return { handled: false, action: 'unknown' }
    }

    // 解析命令和参数
    const parts = trimmed.slice(1).split(/\s+/)
    const command = parts[0].toLowerCase()
    const args = parts.slice(1).join(' ')

    logger.info(`[SlashCommand] 收到指令: /${command} "${args}"`)

    // 优先使用注册处理器，回退到内置
    const registered = this.handlers.get(command)
    if (registered) {
      return registered(trimmed, args, context)
    }

    // 内置命令
    switch (command) {
      case 'clear':
        return this.handleClear(context)
      case 'compact':
        return this.handleCompact(context)
      case 'topic':
        return this.handleTopic(context, args)
      case 'fork':
        return this.handleFork(context, args)
      case 'resume':
        return this.handleResume(context, args)
      case 'help':
        return this.handleHelp()
      default:
        logger.warn(`[SlashCommand] 未知命令: /${command}`)
        return { handled: true, action: 'unknown', message: `未知命令: /${command}。输入 /help 查看可用命令。` }
    }
  }

  /** 获取帮助文本 */
  getHelpText(): string {
    return `可用斜杠指令：\n` +
      COMMANDS.map(c => `  /${c.name} — ${c.desc}`).join('\n') +
      '\n\n示例：/clear、/compact、/topic formula_design、/fork <message-id>'
  }

  // ── 内置命令实现 ──

  private handleClear(context: SlashCommandContext): SlashCommandResult {
    context.clearMessages()
    logger.info('[SlashCommand] /clear — 会话已清空')
    return { handled: true, action: 'clear', message: '✓ 会话已清空' }
  }

  private async handleCompact(context: SlashCommandContext): Promise<SlashCommandResult> {
    try {
      await context.checkCompaction()
      return { handled: true, action: 'compact', message: '✓ 上下文压缩完成' }
    } catch (e) {
      logger.warn('[SlashCommand] /compact 失败:', e)
      return { handled: true, action: 'compact', message: '✗ 压缩失败，请重试' }
    }
  }

  private handleTopic(context: SlashCommandContext, topic: string): SlashCommandResult {
    if (!topic) {
      return { handled: true, action: 'topic', message: '用法：/topic <主题名>，例如 /topic formula_design' }
    }
    context.switchTopic(topic)
    logger.info(`[SlashCommand] /topic — 切换到: ${topic}`)
    return { handled: true, action: 'topic', message: `✓ 主题已切换到: ${topic}` }
  }

  private async handleFork(context: SlashCommandContext, args: string): Promise<SlashCommandResult> {
    const messages = context.getMessages()
    if (!context.forkAtMessage) {
      return { handled: true, action: 'fork', message: '当前环境不支持会话分支，请使用 /help 查看其他指令' }
    }

    const parts = args.trim().split(/\s+/)
    const messageId = parts[0]
    const title = parts.slice(1).join(' ') || `分支-${Date.now().toString(36)}`

    if (!messageId) {
      return { handled: true, action: 'fork', message: '用法：/fork <message-id> [分支名]' }
    }

    // 验证消息 ID 存在
    const msgExists = messages.some(m => m.id === messageId)
    if (!msgExists) {
      return { handled: true, action: 'fork', message: `未找到消息 ${messageId.slice(0, 8)}…，请先发送消息` }
    }

    try {
      const newSessionId = await context.forkAtMessage(messageId, title)
      logger.info(`[SlashCommand] /fork — 分支已创建: ${newSessionId}`)
      return { handled: true, action: 'fork', message: `✓ 分支已创建: ${title}` }
    } catch (e) {
      logger.warn('[SlashCommand] /fork 失败:', e)
      return { handled: true, action: 'fork', message: '✗ 分支创建失败' }
    }
  }

  private async handleResume(context: SlashCommandContext, args: string): Promise<SlashCommandResult> {
    const messages = context.getMessages()
    if (!context.resumeToMessage) {
      return { handled: true, action: 'resume', message: '当前环境不支持历史恢复，请使用 /help 查看其他指令' }
    }

    const messageId = args.trim()
    if (!messageId) {
      return { handled: true, action: 'resume', message: '用法：/resume <message-id>' }
    }

    const msgExists = messages.some(m => m.id === messageId)
    if (!msgExists) {
      return { handled: true, action: 'resume', message: `未找到消息 ${messageId.slice(0, 8)}…` }
    }

    try {
      const history = await context.resumeToMessage(messageId)
      if (history) {
        logger.info(`[SlashCommand] /resume — 已恢复到: ${messageId} (${history.length}条消息)`)
        return { handled: true, action: 'resume', message: `✓ 已恢复到 ${history.length} 条消息的历史节点` }
      }
      return { handled: true, action: 'resume', message: '✗ 恢复失败' }
    } catch (e) {
      logger.warn('[SlashCommand] /resume 失败:', e)
      return { handled: true, action: 'resume', message: '✗ 历史恢复失败' }
    }
  }

  private handleHelp(): SlashCommandResult {
    return {
      handled: true,
      action: 'help',
      message: this.getHelpText(),
    }
  }

  private registerDefaultHandlers(): void {
    // 默认无自定义处理器，全部使用内置实现
    logger.debug('[SlashCommand] 使用内置命令处理器')
  }
}

// 单例导出
export const slashCommandHandler = new SlashCommandHandlerService()
export default SlashCommandHandlerService

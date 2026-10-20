/**
 * useChatHandlers - 聊天事件处理 Hook (v2.0)
 *
 * v2.0 变更：
 * - 集成 EventBusV2 Waterfall 管道（message:sending 认证/校验/保存）
 * - 集成 SlashCommandHandler（/clear /compact /topic /fork /resume /help）
 * - sessionCapability fork/resume 操作集成
 *
 * @version 2.0.0
 * @author RMFOOD Team
 */

import { useCallback } from 'react'
import { logger } from '@/utils/safeLogger'
import { eventBus } from '../services/eventBus'
import type { ChatMessage } from '../types'
import { slashCommandHandler } from '../capabilities/command/SlashCommandHandler'
import { sessionCapability } from '../capabilities/session/SessionCapability'

interface UseChatHandlersOptions {
  input: string
  isStreaming: boolean
  activeSessionId: string | null
  chatError: Error | null
  setChatError: (e: Error | null) => void
  clearError: () => void
  retryLastMessage: () => Promise<void>
  handleSendMessage: (content: string) => Promise<void>
  updateSessionMetadata: (sessionId: string, msgs: ChatMessage[]) => void
  messages: ChatMessage[]
  showReportModal: boolean
  setShowReportModal: (v: boolean) => void
  isDetailModalOpen: boolean
  closeDetailTable: () => void
  showFormulaList: boolean
  setShowFormulaList: (v: boolean) => void
  /** 当前会话 ID，传给能力层 */
  setCurrentSessionId?: (id: string) => void
  /** 检查并执行上下文压缩（来自 useChatMessages） */
  checkCompaction?: () => Promise<void>
}

export function useChatHandlers(opts: UseChatHandlersOptions) {
  const {
    input, isStreaming, chatError,
    setChatError, clearError, retryLastMessage,
    handleSendMessage, updateSessionMetadata,
    showReportModal, setShowReportModal,
    isDetailModalOpen, closeDetailTable,
    showFormulaList, setShowFormulaList,
    checkCompaction,
  } = opts

  // ── 绑定当前会话 ID 到 SessionCapability ──
  const contextRef = {
    clearMessages: () => {}, // 由调用方实现，这里只处理指令逻辑
    getMessages: () => opts.messages,
    switchTopic: (topic: string) => {
      if (opts.activeSessionId) {
        updateSessionMetadata(opts.activeSessionId, opts.messages)
        eventBus.emit('state:changed', { newState: `topic:${topic}` })
        logger.info(`[useChatHandlers] topic switched to: ${topic}`)
      }
    },
    forkAtMessage: async (messageId: string, title?: string): Promise<string> => {
      if (!opts.activeSessionId) throw new Error('没有活跃会话')
      return sessionCapability.fork(opts.activeSessionId, {
        boundaryMessageId: messageId,
        title,
      })
    },
    checkCompaction: checkCompaction ?? (async () => {}),
    resumeToMessage: async (messageId: string) => {
      if (!opts.activeSessionId) return null
      const result = await sessionCapability.resumeTo(opts.activeSessionId, messageId)
      return result?.messages ?? null
    },
  }

  /**
   * 发送消息 — 优先处理斜杠指令，否则走正常发送流程
   */
  const handleSend = useCallback(
    async (passedContent?: string) => {
      const rawInput = (passedContent || input).trim()
      if (!rawInput || isStreaming) return

      // ── Waterfall 前置拦截：检查是否为斜杠指令 ──
      const slashResult = await slashCommandHandler.execute(rawInput, contextRef)
      if (slashResult.handled) {
        // 指令被消费，直接展示结果消息
        if (slashResult.message) {
          eventBus.emit('message:received', {
            content: slashResult.message,
            senderId: 'system',
            timestamp: Date.now(),
          })
          logger.info(`[useChatHandlers] 指令已执行: /${slashResult.action}`)
        }
        return
      }

      // ── 正常消息发送 ──
      try {
        await handleSendMessage(rawInput)
        if (opts.activeSessionId) {
          updateSessionMetadata(opts.activeSessionId, opts.messages)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('[useChatHandlers] Message send failed:', { error: errorMessage })
        setChatError(error instanceof Error ? error : new Error('发送失败'))
      }
    },
    [input, isStreaming, handleSendMessage, setChatError, opts.activeSessionId, updateSessionMetadata, opts.messages],
  )

  /**
   * 获取斜杠指令帮助
   */
  const getHelp = useCallback(() => {
    return slashCommandHandler.getHelpText()
  }, [])

  const handleRetry = useCallback(async () => {
    logger.debug('[useChatHandlers] 重试最后一条消息')
    await retryLastMessage()
  }, [retryLastMessage])

  const handleCancel = useCallback(() => {
    if (showReportModal) { setShowReportModal(false); logger.debug('[useChatHandlers] 关闭报告弹窗') }
    if (isDetailModalOpen) { closeDetailTable(); logger.debug('[useChatHandlers] 关闭详情表格') }
    if (showFormulaList) { setShowFormulaList(false); logger.debug('[useChatHandlers] 关闭配方列表') }
    if (chatError) { clearError(); logger.debug('[useChatHandlers] 清除错误状态') }
  }, [showReportModal, setShowReportModal, isDetailModalOpen, closeDetailTable, showFormulaList, chatError, clearError])

  return { handleSend, handleRetry, handleCancel, getHelp }
}

export type { UseChatHandlersOptions }

/**
 * useChatHandlers - 聊天事件处理 Hook (v1.0)
 *
 * 职责：
 * - handleSendMessage: 发送消息并更新会话元数据
 * - handleRetry: 重试最后一条消息
 * - handleCancel: 关闭各种模态框/错误/列表
 *
 * @version 1.0.0
 * @author RMFOOD Team
 */

import { useCallback } from 'react'
import { logger } from '@/utils/safeLogger'
import type { ChatMessage } from '../types'

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
}

export function useChatHandlers(opts: UseChatHandlersOptions) {
  const {
    input, isStreaming, activeSessionId, chatError,
    setChatError, clearError, retryLastMessage,
    handleSendMessage, updateSessionMetadata, messages,
    showReportModal, setShowReportModal,
    isDetailModalOpen, closeDetailTable,
    showFormulaList, setShowFormulaList,
  } = opts

  const handleSend = useCallback(
    async (passedContent?: string) => {
      const contentToSend = (passedContent || input).trim()
      if (!contentToSend || isStreaming) return
      try {
        await handleSendMessage(contentToSend)
        if (activeSessionId) {
          updateSessionMetadata(activeSessionId, messages)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('[useChatHandlers] ❌ Message send failed:', { error: errorMessage })
        setChatError(error instanceof Error ? error : new Error('发送失败'))
      }
    },
    [input, isStreaming, handleSendMessage, setChatError, activeSessionId, updateSessionMetadata, messages],
  )

  const handleRetry = useCallback(async () => {
    logger.debug('[useChatHandlers] 🔄 重试最后一条消息')
    await retryLastMessage()
  }, [retryLastMessage])

  const handleCancel = useCallback(() => {
    if (showReportModal) { setShowReportModal(false); logger.debug('[useChatHandlers] ❌ 关闭报告弹窗') }
    if (isDetailModalOpen) { closeDetailTable(); logger.debug('[useChatHandlers] ❌ 关闭详情表格') }
    if (showFormulaList) { setShowFormulaList(false); logger.debug('[useChatHandlers] ❌ 关闭配方列表') }
    if (chatError) { clearError(); logger.debug('[useChatHandlers] ❌ 清除错误状态') }
  }, [showReportModal, setShowReportModal, isDetailModalOpen, closeDetailTable, showFormulaList, chatError, clearError])

  return { handleSend, handleRetry, handleCancel }
}

/**
 * useMessageEditing - 消息编辑/撤回 Hook (v1.0)
 *
 * 职责：
 * - 编辑消息后重新发送（截断后续对话分支）
 * - 撤回消息（同时删除紧随的 AI 回复）
 *
 * @version 1.0.0
 * @author RMFOOD Team
 */

import { useCallback } from 'react'
import { logger } from '@/utils/safeLogger'
import type { ChatMessage } from '../types'

interface UseMessageEditingOptions {
  messages: ChatMessage[]
  editMessage: (id: string, newContent: string) => void
  removeMessage: (id: string) => void
  retractMessage: (id: string) => void
  sendMessage: (content: string) => Promise<void>
}

export function useMessageEditing(opts: UseMessageEditingOptions) {
  const { messages, editMessage, removeMessage, retractMessage, sendMessage } = opts

  /** 编辑消息：更新内容 → 删除后续消息 → 重新发送 */
  const handleEditMessage = useCallback(
    async (id: string, newContent: string) => {
      editMessage(id, newContent)

      // 删除该消息之后的所有 AI 回复（对话分支截断）
      const idx = messages.findIndex((m) => m.id === id)
      if (idx !== -1) {
        const msgsAfter = messages.slice(idx + 1)
        for (const m of msgsAfter) {
          removeMessage(m.id)
        }
      }

      // 重新发送编辑后的消息
      await sendMessage(newContent)
    },
    [messages, editMessage, removeMessage, sendMessage],
  )

  /** 撤回消息：标记撤回 → 删除紧随的 AI 回复 */
  const handleRetractMessage = useCallback(
    (id: string) => {
      retractMessage(id)

      // 撤回用户消息后，同时删除紧随其后的 AI 回复
      const idx = messages.findIndex((m) => m.id === id)
      if (idx !== -1 && idx + 1 < messages.length) {
        const nextMsg = messages[idx + 1]
        if (nextMsg.role === 'assistant') {
          removeMessage(nextMsg.id)
        }
      }
      logger.info('[useMessageEditing] 消息已撤回')
    },
    [messages, retractMessage, removeMessage],
  )

  return {
    handleEditMessage,
    handleRetractMessage,
  }
}

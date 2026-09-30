/**
 * useChatCallbacks - ChatTab 回调管理 Hook (v3.0)
 *
 * v3.0 更新 (2026-08-23):
 * ✅ 统一存储层：使用 ChatStorageService 替代散乱 localStorage
 * ✅ 后端回退：本地无数据时尝试从后端加载
 * ✅ 会话隔离：每个会话独立存储，切换安全
 *
 * @version 3.0.0
 */

import { useCallback, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { HistorySession } from '../components/pro'
import { logger } from '@/utils/safeLogger'
import type { ChatMessage } from '../types'
import { chatApi } from '@/api/chat'
import type { ChatSession as BackendSession } from '@/api/chat'
import { chatStorageService } from '../capabilities/storage/ChatStorageService'

export interface UseChatCallbacksOptions {
  historySessions: HistorySession[]
  setHistorySessions: Dispatch<SetStateAction<HistorySession[]>>
  setActiveSessionId: Dispatch<SetStateAction<string | null>>
  historyVisible: boolean
  setHistoryVisible: Dispatch<SetStateAction<boolean>>
  clearMessages: () => void
  clearAllFormulas: () => void
  clearWorkingMemory: () => void
  clearMultiTurnDialogue: () => void
  clearShortTermMemory: () => void
  /** 当前消息列表（用于会话切换时保存/恢复） */
  messages: ChatMessage[]
  /** 替换当前消息列表（用于从目标会话恢复） */
  setMessages: (messages: ChatMessage[]) => void
  /** 当前活跃会话ID */
  activeSessionId: string | null
}

export interface UseChatCallbacksReturn {
  handleClearChat: () => void
  handleNewSession: () => void
  handleSelectSession: (id: string) => void
  handleDeleteSession: (id: string) => void
  handleRenameSession: (id: string, title: string) => void
  toggleHistory: () => void
  updateSessionMetadata: (sessionId: string, msgs: ChatMessage[]) => void
  syncSessionsFromServer: () => Promise<void>
}

export function useChatCallbacks(options: UseChatCallbacksOptions): UseChatCallbacksReturn {
  const {
    historySessions, setHistorySessions, setActiveSessionId,
    clearMessages, clearAllFormulas,
    clearWorkingMemory, clearMultiTurnDialogue, clearShortTermMemory,
    messages, setMessages, activeSessionId,
  } = options

  const handleClearChat = useCallback(() => {
    clearMessages()
    clearAllFormulas()
    clearWorkingMemory()
    clearMultiTurnDialogue()
    clearShortTermMemory()
  }, [clearMessages, clearAllFormulas, clearWorkingMemory, clearMultiTurnDialogue, clearShortTermMemory])

  /** 更新指定会话的元数据（消息数、最后消息） */
  const updateSessionMetadata = useCallback(async (sessionId: string, msgs: ChatMessage[]) => {
    const userMsgs = msgs.filter(m => m.role === 'user')
    const lastUserMsg = userMsgs[userMsgs.length - 1]
    setHistorySessions(prev => prev.map(s =>
      s.id === sessionId
        ? { ...s, messageCount: msgs.length, lastMessage: lastUserMsg?.content?.slice(0, 50) || '', timestamp: Date.now() }
        : s
    ))
    // 统一保存到 IndexedDB
    try {
      await chatStorageService.saveMessages(sessionId, msgs)
    } catch (e) {
      logger.warn('[useChatCallbacks] 保存会话消息失败:', e)
    }
  }, [setHistorySessions])

  const handleNewSession = useCallback(async () => {
    // 保存当前会话的消息（如果有活跃会话）
    if (activeSessionId && messages.length > 0) {
      try {
        await chatStorageService.saveMessages(activeSessionId, messages)
      } catch (e) {
        logger.warn('[useChatCallbacks] 保存当前会话失败:', e)
      }
      await updateSessionMetadata(activeSessionId, messages)
    }

    const newSession: HistorySession = {
      id: `session-${Date.now()}`,
      title: '新对话',
      messageCount: 0,
      lastMessage: '',
      timestamp: Date.now(),
    }
    const updated = [newSession, ...historySessions]
    setHistorySessions(updated)
    setActiveSessionId(newSession.id)
    // 同步写入 IndexedDB 元数据，保证新会话在侧栏立即可见
    chatStorageService.saveSessionMeta(newSession.id, {
      title: newSession.title,
      tags: [],
      createdAt: newSession.timestamp,
      updatedAt: newSession.timestamp,
      messageCount: 0,
    }).catch(e => logger.warn('[useChatCallbacks] 保存新会话元数据失败:', e))
    handleClearChat()
  }, [historySessions, setHistorySessions, setActiveSessionId, handleClearChat, activeSessionId, messages, updateSessionMetadata])

  const handleSelectSession = useCallback(async (id: string) => {
    if (id === activeSessionId) return

    // 1. 保存当前会话的消息
    if (activeSessionId && messages.length > 0) {
      try {
        await chatStorageService.saveMessages(activeSessionId, messages)
      } catch (e) {
        logger.warn('[useChatCallbacks] 保存当前会话失败:', e)
      }
      await updateSessionMetadata(activeSessionId, messages)
    }

    // 2. 切换到目标会话
    setActiveSessionId(id)

    // 3. 从统一存储恢复消息（先本地，后后端）
    try {
      const restoredMessages = await chatStorageService.loadMessages(id)
      if (restoredMessages.length > 0) {
        logger.info(`[useChatCallbacks] 恢复会话 ${id} 的 ${restoredMessages.length} 条消息`)
        setMessages(restoredMessages)
        return
      }
    } catch (e) {
      logger.warn('[useChatCallbacks] 本地加载失败，尝试后端:', e)
    }

    // 4. 降级：从后端加载
    try {
      const serverMessages = await chatStorageService.fetchFromServer(id)
      if (serverMessages.length > 0) {
        setMessages(serverMessages)
        await chatStorageService.saveMessages(id, serverMessages)
        return
      }
    } catch (e) {
      logger.warn('[useChatCallbacks] 后端加载失败:', e)
    }

    // 5. 最终降级：清空
    handleClearChat()
  }, [setActiveSessionId, activeSessionId, messages, handleClearChat, setMessages, updateSessionMetadata])

  const handleDeleteSession = useCallback(async (id: string) => {
    const updated = historySessions.filter(s => s.id !== id)
    setHistorySessions(updated)
    // 清理被删除会话的消息存储（IndexedDB）
    try {
      await chatStorageService.deleteMessages(id)
    } catch {}
    // 如果删除的是当前活跃会话，清空消息
    if (id === activeSessionId) {
      handleClearChat()
    }
  }, [historySessions, setHistorySessions, activeSessionId, handleClearChat])

  const handleRenameSession = useCallback(async (id: string, title: string) => {
    const updated = historySessions.map(s => s.id === id ? { ...s, title } : s)
    setHistorySessions(updated)
    // 同步更新 IndexedDB 元数据
    try {
      await chatStorageService.saveSessionMeta(id, {
        title,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: updated.find(s => s.id === id)?.messageCount ?? 0,
      })
    } catch (e) {
      logger.warn('[useChatCallbacks] 重命名会话元数据保存失败:', e)
    }
  }, [historySessions, setHistorySessions])

  const toggleHistory = useCallback(() => {
    options.setHistoryVisible(v => !v)
  }, [options.setHistoryVisible])

  const syncSessionsFromServer = useCallback(async () => {
    try {
      const data = await chatApi.getSessions({ page_size: 50 })
      const backendSessions = data.items.map((s: BackendSession) => ({
        id: String(s.id),
        title: s.title,
        messageCount: s.message_count,
        lastMessage: '',
        timestamp: new Date(s.updated_at).getTime(),
      }))
      const existingIds = new Set(historySessions.map(s => s.id))
      const toMerge = backendSessions.filter((s: any) => !existingIds.has(s.id))
      if (toMerge.length > 0) {
        const merged = [...historySessions, ...toMerge]
        setHistorySessions(merged)
        // 同步写入 IndexedDB，废弃 localStorage
        try {
          for (const s of toMerge) {
            await chatStorageService.saveSessionMeta(s.id, {
              title: s.title,
              tags: [],
              createdAt: s.timestamp,
              updatedAt: s.timestamp,
              messageCount: s.messageCount,
            })
          }
        } catch (e) {
          logger.warn('[useChatCallbacks] 服务端会话写入 IndexedDB 失败:', e)
        }
        logger.info(`[useChatCallbacks] 手动同步新增 ${toMerge.length} 个会话`)
      }
    } catch (err) {
      logger.warn('[useChatCallbacks] 手动同步失败:', err)
    }
  }, [historySessions, setHistorySessions])

  return {
    handleClearChat,
    handleNewSession,
    handleSelectSession,
    handleDeleteSession,
    handleRenameSession,
    toggleHistory,
    updateSessionMetadata,
    syncSessionsFromServer,
  }
}

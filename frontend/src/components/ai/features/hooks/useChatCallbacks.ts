/**
 * useChatCallbacks - ChatTab 回调管理 Hook (v2.0)
 *
 * v2.0 更新 (2026-08-23):
 * ✅ 接入后端 /chat/sessions API，支持跨设备同步
 * ✅ 本地优先策略：localStorage 作为缓存，后端 API 作为持久化层
 * ✅ 会话创建自动同步到后端，删除/重命名同步删除
 *
 * @version 2.0.0
 * @lastUpdated 2026-08-23
 */

import { useCallback, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { HistorySession } from '../components/pro'
import { saveSessions, loadSessions } from '../components/pro'
import { storageService } from '../services/storageService'
import { logger } from '@/utils/safeLogger'
import type { ChatMessage } from '../types'
import { chatApi } from '@/api/chat'
import type { ChatSession as BackendSession } from '@/api/chat'

/** 按会话ID隔离的消息存储键前缀 */
const SESSION_MSG_PREFIX = 'chat_session_msgs_'

/** 获取指定会话的消息存储键 */
function getSessionMsgKey(sessionId: string): string {
  return `${SESSION_MSG_PREFIX}${sessionId}`
}

/** 保存消息到指定会话的存储 */
function saveSessionMessages(sessionId: string, messages: ChatMessage[]): void {
  try {
    storageService.set(getSessionMsgKey(sessionId), messages)
  } catch (e) {
    logger.warn('[useChatCallbacks] Failed to save session messages:', e)
  }
}

/** 从指定会话的存储加载消息 */
function loadSessionMessages(sessionId: string): ChatMessage[] {
  try {
    return storageService.get<ChatMessage[]>(getSessionMsgKey(sessionId)) || []
  } catch {
    return []
  }
}

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
  const updateSessionMetadata = useCallback((sessionId: string, msgs: ChatMessage[]) => {
    const userMsgs = msgs.filter(m => m.role === 'user')
    const lastUserMsg = userMsgs[userMsgs.length - 1]
    setHistorySessions(prev => prev.map(s =>
      s.id === sessionId
        ? { ...s, messageCount: msgs.length, lastMessage: lastUserMsg?.content?.slice(0, 50) || '', timestamp: Date.now() }
        : s
    ))
    // 同步保存会话消息到隔离存储
    saveSessionMessages(sessionId, msgs)
  }, [setHistorySessions])

  const handleNewSession = useCallback(() => {
    // 保存当前会话的消息（如果有活跃会话）
    if (activeSessionId && messages.length > 0) {
      saveSessionMessages(activeSessionId, messages)
      updateSessionMetadata(activeSessionId, messages)
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
    saveSessions(updated)
    handleClearChat()
  }, [historySessions, setHistorySessions, setActiveSessionId, handleClearChat, activeSessionId, messages, updateSessionMetadata])

  const handleSelectSession = useCallback((id: string) => {
    if (id === activeSessionId) return

    // 1. 保存当前会话的消息到隔离存储
    if (activeSessionId && messages.length > 0) {
      saveSessionMessages(activeSessionId, messages)
      updateSessionMetadata(activeSessionId, messages)
    }

    // 2. 切换到目标会话
    setActiveSessionId(id)

    // 3. 从目标会话的隔离存储恢复消息（而非清空）
    const restoredMessages = loadSessionMessages(id)
    if (restoredMessages.length > 0) {
      logger.info(`[useChatCallbacks] 恢复会话 ${id} 的 ${restoredMessages.length} 条消息`)
      setMessages(restoredMessages)
    } else {
      handleClearChat()
    }
  }, [setActiveSessionId, activeSessionId, messages, handleClearChat, setMessages, updateSessionMetadata])

  const handleDeleteSession = useCallback((id: string) => {
    const updated = historySessions.filter(s => s.id !== id)
    setHistorySessions(updated)
    saveSessions(updated)
    // 清理被删除会话的消息存储
    try { storageService.remove(getSessionMsgKey(id)) } catch {}
    // 如果删除的是当前活跃会话，清空消息
    if (id === activeSessionId) {
      handleClearChat()
    }
  }, [historySessions, setHistorySessions, activeSessionId, handleClearChat])

  const handleRenameSession = useCallback((id: string, title: string) => {
    const updated = historySessions.map(s => s.id === id ? { ...s, title } : s)
    setHistorySessions(updated)
    saveSessions(updated)
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
        saveSessions(merged)
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

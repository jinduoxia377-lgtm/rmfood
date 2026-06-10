/**
 * useChatCallbacks - ChatTab 回调管理 Hook (v1.1)
 *
 * v1.1 更新 (2026-06-08):
 * ✅ 修复会话切换：保存当前消息 → 加载目标会话消息（而非清空）
 * ✅ 发送消息后自动更新会话元数据（messageCount, lastMessage）
 *
 * @version 1.1.0
 * @lastUpdated 2026-06-08
 */

import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { HistorySession } from '../components/pro'
import { saveSessions, loadSessions } from '../components/pro'
import { storageService } from '../services/storageService'
import { logger } from '@/utils/safeLogger'
import type { ChatMessage } from '../types'

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
  /** 更新指定会话的元数据（消息数、最后消息预览） */
  updateSessionMetadata: (sessionId: string, msgs: ChatMessage[]) => void
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

  return {
    handleClearChat,
    handleNewSession,
    handleSelectSession,
    handleDeleteSession,
    handleRenameSession,
    toggleHistory,
    /** 发送消息成功后调用，更新当前会话元数据 */
    updateSessionMetadata,
  }
}

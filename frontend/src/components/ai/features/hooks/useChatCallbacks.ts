/**
 * useChatCallbacks - ChatTab 回调管理 Hook (v3.0)
 *
 * v3.0 更新 (2026-08-23):
 * ✅ 统一存储层：使用 ChatStorageService 替代散乱 localStorage
 * ✅ 后端回退：本地无数据时尝试从后端加载
 * ✅ 会话隔离：每个会话独立存储，切换安全
 *
 * v12 决策 (2026-06-26)：工作记忆 / 短期记忆已从主聊天链路移除（原为纯内存/无反馈闭环），
 * 对应回调一并删除。如需恢复用户级三级记忆，需产品决策后重新设计（含后端持久化）。
 *
 * @version 3.1.0
 */

import { useCallback, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { HistorySession } from '../components/pro'
import { logger } from '@/utils/safeLogger'
import type { ChatMessage } from '../types'
import { chatApi } from '@/api/chat'
import { chatStorageService } from '../capabilities/storage/ChatStorageService'

export interface UseChatCallbacksOptions {
  historySessions: HistorySession[]
  setHistorySessions: Dispatch<SetStateAction<HistorySession[]>>
  setActiveSessionId: Dispatch<SetStateAction<string | null>>
  historyVisible: boolean
  setHistoryVisible: Dispatch<SetStateAction<boolean>>
  clearMessages: () => void
  clearAllFormulas: () => void
  clearMultiTurnDialogue: () => void
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
    clearMessages, clearAllFormulas, clearMultiTurnDialogue,
    messages, setMessages, activeSessionId,
  } = options

  // 云端同步防抖定时器（治本：消息定期备份到服务器，刷新/清本地后可恢复）
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClearChat = useCallback(() => {
    clearMessages()
    clearAllFormulas()
    clearMultiTurnDialogue()
  }, [clearMessages, clearAllFormulas, clearMultiTurnDialogue])

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
    // 治本：防抖同步到服务器，刷新/清缓存后仍可云端恢复
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      chatStorageService.syncToServer(sessionId).catch(e =>
        logger.warn('[useChatCallbacks] 同步会话到服务器失败（本地已保存，不影响使用）:', e))
    }, 2000)
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

    // P0 修复：新建会话时【不能】调用 handleClearChat()/clearMessages()。
    // clearMessages() 会按 activeSessionIdRef.current（切换后仍指向旧会话）删除 IndexedDB 中
    // 刚保存的旧会话消息，造成数据丢失。这里改用 replaceMessages([])（即 setMessages([])）
    // 只清空内存消息，不触碰旧会话的 IndexedDB 数据；配方/多轮上下文一并重置。
    setMessages([])
    clearAllFormulas()
    clearMultiTurnDialogue()
  }, [historySessions, setHistorySessions, setActiveSessionId, activeSessionId, messages, updateSessionMetadata, setMessages, clearAllFormulas, clearMultiTurnDialogue])

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

    // 5. 最终降级：清空内存（P0 修复：不调用 clearMessages()，避免误删上一会话刚保存的消息）
    setMessages([])
    clearAllFormulas()
    clearMultiTurnDialogue()
  }, [setActiveSessionId, activeSessionId, messages, setMessages, updateSessionMetadata, clearAllFormulas, clearMultiTurnDialogue])

  const handleDeleteSession = useCallback(async (id: string) => {
    const updated = historySessions.filter(s => s.id !== id)
    setHistorySessions(updated)
    // 清理被删除会话的消息存储（IndexedDB）
    try {
      await chatStorageService.deleteMessages(id)
    } catch { /* 删除消息存储失败忽略 */ }
    // 如果删除的是当前活跃会话，清空消息并把 activeSessionId 切到剩余最近会话或 null，
    // 避免后续发送消息写入已删除的 session id（否则刷新后会话"复活"）。
    if (id === activeSessionId) {
      handleClearChat()
      setActiveSessionId(updated[0]?.id ?? null)
    }
  }, [historySessions, setHistorySessions, activeSessionId, handleClearChat, setActiveSessionId])

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
      const existingIds = new Set(historySessions.map(s => s.id))
      const toMerge: Array<{
        id: string
        title: string
        messageCount: number
        lastMessage: string
        timestamp: number
      }> = []
      // client_session_id 命中已有本地会话 → 复用本地 id，仅刷新元数据（避免重复合并）
      const toUpdate: Array<{ id: string; title: string; messageCount: number; timestamp: number }> = []

      for (const s of data.items) {
        const clientId = s.client_session_id
        const mapped = {
          // P2 统一会话 ID：后端返回 client_session_id 时直接用它作为本地会话 id，
          // 使前后端 ID 空间一致；旧数据（无 client_session_id）仍用后端 int id 兜底。
          id: clientId || String(s.id),
          title: s.title,
          messageCount: s.message_count,
          lastMessage: '',
          timestamp: new Date(s.updated_at).getTime(),
        }
        if (clientId && existingIds.has(clientId)) {
          // 已存在同 client_session_id 的本地会话 → 复用本地 id，仅刷新元数据
          toUpdate.push({ id: clientId, title: s.title, messageCount: s.message_count, timestamp: mapped.timestamp })
          continue
        }
        if (!existingIds.has(mapped.id)) {
          toMerge.push(mapped)
        }
      }

      if (toMerge.length > 0 || toUpdate.length > 0) {
        const updateMap = new Map(toUpdate.map(u => [u.id, u]))
        setHistorySessions(prev => {
          const next = [...prev, ...toMerge]
          return next.map(s => {
            const upd = updateMap.get(s.id)
            return upd ? { ...s, title: upd.title, messageCount: upd.messageCount, timestamp: upd.timestamp } : s
          })
        })
        // 同步写入 IndexedDB，废弃 localStorage
        try {
          for (const s of [...toMerge, ...toUpdate]) {
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
        logger.info(`[useChatCallbacks] 手动同步：新增 ${toMerge.length} 个会话，刷新 ${toUpdate.length} 个会话`)
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

// @ts-nocheck
/**
 * ChatStorageCapability — 统一存储能力
 *
 * 参照 DeepSeek Harness Session 持久化设计：
 * - IndexedDB 作为主存储（大容量、结构化查询）
 * - localStorage 作为性能缓存（快速读取，带版本号校验）
 * - 后端 API 作为跨设备同步层
 *
 * 统一接口替代现有的散乱存储逻辑
 *
 * @version 1.0.0
 */

import { logger } from '@/utils/safeLogger'
import type { ChatMessage } from '../../types'
import { chatHistoryStorage } from '../../services/chatHistoryStorage'
import { storageService } from '../../services/storageService'
import { ChatTopic } from '../../types/chatHistory.types'
import { chatApi } from '@/api/chat'
import type { ChatSession as BackendSession } from '@/api/chat'

export interface ChatStorageCapability {
  /** 保存指定会话的所有消息 */
  saveMessages(sessionId: string, messages: ChatMessage[]): Promise<void>

  /** 加载指定会话的所有消息 */
  loadMessages(sessionId: string): Promise<ChatMessage[]>

  /** 删除指定会话的消息 */
  deleteMessages(sessionId: string): Promise<void>

  /** 更新单条消息 */
  updateMessage(sessionId: string, messageId: string, updates: Partial<ChatMessage>): Promise<void>

  /** 删除单条消息 */
  deleteMessage(sessionId: string, messageId: string): Promise<void>

  /** 保存会话元数据 */
  saveSessionMeta(sessionId: string, meta: SessionMeta): Promise<void>

  /** 加载会话元数据 */
  loadSessionMeta(sessionId: string): Promise<SessionMeta | null>

  /** 列出所有会话摘要 */
  listSessions(): Promise<SessionSummary[]>

  /** 同步到后端 */
  syncToServer(sessionId: string): Promise<void>

  /** 从后端加载 */
  fetchFromServer(sessionId: string): Promise<ChatMessage[]>
}

export interface SessionMeta {
  title: string
  topic?: string
  tags: string[]
  createdAt: number
  updatedAt: number
  messageCount: number
}

export interface SessionSummary {
  id: string
  meta: SessionMeta
  messageCount: number
}

const STORAGE_VERSION = 2
const CACHE_TTL_MS = 5 * 60 * 1000 // 5分钟缓存有效期

export class ChatStorageService implements ChatStorageCapability {
  private cache = new Map<string, { messages: ChatMessage[]; timestamp: number }>()

  async saveMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    try {
      // 1. 保存到 IndexedDB（主存储）
      await chatHistoryStorage.saveSession({
        id: sessionId,
        title: `会话 ${sessionId.slice(-8)}`,
        messages,
        metadata: {
          topic: ChatTopic.KNOWLEDGE_QUERY,
          tags: [],
          createdAt: messages[0]?.timestamp || Date.now(),
          updatedAt: Date.now(),
          messageCount: messages.length,
        },
      })

      // 2. 更新 localStorage 缓存
      this.cache.set(sessionId, {
        messages,
        timestamp: Date.now(),
      })

      // 3. 更新会话列表
      await this.updateSessionList(sessionId, messages)

      logger.info(`[ChatStorage] 消息已保存: ${sessionId} (${messages.length}条)`)
    } catch (error) {
      logger.error('[ChatStorage] 保存消息失败:', error)
      throw error
    }
  }

  async loadMessages(sessionId: string): Promise<ChatMessage[]> {
    try {
      // 1. 尝试从缓存加载
      const cached = this.cache.get(sessionId)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.messages
      }

      // 2. 尝试从 IndexedDB 加载
      const session = await chatHistoryStorage.getSession(sessionId)
      if (session?.messages && session.messages.length > 0) {
        this.cache.set(sessionId, {
          messages: session.messages as unknown as ChatMessage[],
          timestamp: Date.now(),
        })
        return session.messages as unknown as ChatMessage[]
      }

      // 3. 降级：尝试从 localStorage 加载（兼容旧数据）
      const legacyMessages = this.loadFromLocalStorage(sessionId)
      if (legacyMessages.length > 0) {
        await this.saveMessages(sessionId, legacyMessages)
        return legacyMessages
      }

      return []
    } catch (error) {
      logger.error('[ChatStorage] 加载消息失败:', error)
      return []
    }
  }

  async deleteMessages(sessionId: string): Promise<void> {
    try {
      await chatHistoryStorage.deleteSession(sessionId)
      this.cache.delete(sessionId)
      await this.removeFromSessionList(sessionId)
      logger.info(`[ChatStorage] 消息已删除: ${sessionId}`)
    } catch (error) {
      logger.error('[ChatStorage] 删除消息失败:', error)
    }
  }

  async updateMessage(sessionId: string, messageId: string, updates: Partial<ChatMessage>): Promise<void> {
    const messages = await this.loadMessages(sessionId)
    const updated = messages.map(m =>
      m.id === messageId ? { ...m, ...updates } : m
    )
    await this.saveMessages(sessionId, updated)
  }

  async deleteMessage(sessionId: string, messageId: string): Promise<void> {
    const messages = await this.loadMessages(sessionId)
    const filtered = messages.filter(m => m.id !== messageId)
    await this.saveMessages(sessionId, filtered)
  }

  async saveSessionMeta(sessionId: string, meta: SessionMeta): Promise<void> {
    try {
      // 重新保存整个 session 以更新元数据
      const existing = await chatHistoryStorage.getSession(sessionId)
      if (existing) {
        await chatHistoryStorage.saveSession({
          ...existing,
          title: meta.title,
          metadata: {
            ...existing.metadata,
            topic: String(meta.topic || ChatTopic.KNOWLEDGE_QUERY),
            tags: meta.tags,
            updatedAt: meta.updatedAt,
            messageCount: meta.messageCount,
          },
        })
      } else {
        // 新建 session
        await chatHistoryStorage.saveSession({
          id: sessionId,
          title: meta.title,
          messages: [],
          metadata: {
            topic: String(meta.topic || ChatTopic.KNOWLEDGE_QUERY),
            tags: meta.tags,
            createdAt: meta.createdAt,
            updatedAt: meta.updatedAt,
            messageCount: meta.messageCount,
          },
        })
      }
      logger.info(`[ChatStorage] 会话元数据已保存: ${sessionId}`)
    } catch (error) {
      logger.error('[ChatStorage] 保存会话元数据失败:', error)
    }
  }

  async loadSessionMeta(sessionId: string): Promise<SessionMeta | null> {
    try {
      const session = await chatHistoryStorage.getSession(sessionId)
      if (!session) return null
      return {
        title: session.title,
        topic: session.metadata?.topic,
        tags: session.metadata?.tags || [],
        createdAt: session.metadata?.createdAt || 0,
        updatedAt: session.metadata?.updatedAt || 0,
        messageCount: session.metadata?.messageCount || session.messages?.length || 0,
      }
    } catch {
      return null
    }
  }

  async listSessions(): Promise<SessionSummary[]> {
    try {
      const sessions = await chatHistoryStorage.getAllSessions()
      return sessions.map(s => ({
        id: s.id,
        meta: {
          title: s.title,
          topic: s.metadata?.topic,
          tags: s.metadata?.tags || [],
          createdAt: s.metadata?.createdAt || 0,
          updatedAt: s.metadata?.updatedAt || 0,
          messageCount: s.metadata?.messageCount || s.messages?.length || 0,
        },
        messageCount: s.metadata?.messageCount || s.messages?.length || 0,
      }))
    } catch (error) {
      logger.error('[ChatStorage] 列出会话失败:', error)
      return []
    }
  }

  async syncToServer(sessionId: string): Promise<void> {
    try {
      const messages = await this.loadMessages(sessionId)
      if (messages.length === 0) return

      // 构建后端会话格式并上传
      const sessionData = {
        id: sessionId,
        title: this.loadSessionList().find(s => s.id === sessionId)?.title || `会话 ${sessionId.slice(-8)}`,
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          sendStatus: m.sendStatus,
          retryCount: m.retryCount,
        })),
        createdAt: messages[0]?.timestamp || Date.now(),
        updatedAt: Date.now(),
      }

      const token = localStorage.getItem('auth_token') || ''
      const response = await fetch('/api/v1/chat/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessions: [sessionData] }),
      })

      if (!response.ok) throw new Error(`同步失败: ${response.status}`)
      logger.info(`[ChatStorage] 会话已同步到后端: ${sessionId} (${messages.length}条)`)
    } catch (error) {
      logger.error('[ChatStorage] 同步到后端失败:', error)
    }
  }

  async fetchFromServer(sessionId: string): Promise<ChatMessage[]> {
    try {
      const token = localStorage.getItem('auth_token') || ''
      const response = await fetch(`/api/v1/chat/session/${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) return []
      const data = await response.json() as { messages?: Array<{ id: string; role: string; content: string; timestamp: number }> }
      if (!data.messages?.length) return []

      const messages: ChatMessage[] = data.messages.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.timestamp,
      }))

      await this.saveMessages(sessionId, messages)
      logger.info(`[ChatStorage] 从后端加载 ${messages.length} 条消息: ${sessionId}`)
      return messages
    } catch (error) {
      logger.error('[ChatStorage] 从后端加载失败:', error)
      return []
    }
  }

  // ===== 私有方法 =====

  private async updateSessionList(sessionId: string, messages: ChatMessage[]): Promise<void> {
    try {
      const sessions = this.loadSessionList()
      const existingIndex = sessions.findIndex(s => s.id === sessionId)

      const sessionData = {
        id: sessionId,
        title: messages[0]?.content?.slice(0, 30) || '新对话',
        messageCount: messages.length,
        lastMessage: messages[messages.length - 1]?.content?.slice(0, 50) || '',
        timestamp: messages[messages.length - 1]?.timestamp || Date.now(),
      }

      if (existingIndex >= 0) {
        sessions[existingIndex] = sessionData
      } else {
        sessions.unshift(sessionData)
      }

      // 限制最多100个会话
      if (sessions.length > 100) {
        sessions.splice(100)
      }

      storageService.set('rmfood_chat_sessions_v2', sessions)
    } catch (error) {
      logger.warn('[ChatStorage] 更新会话列表失败:', error)
    }
  }

  private async removeFromSessionList(sessionId: string): Promise<void> {
    try {
      const sessions = this.loadSessionList()
      const filtered = sessions.filter(s => s.id !== sessionId)
      storageService.set('rmfood_chat_sessions_v2', filtered)
    } catch (error) {
      logger.warn('[ChatStorage] 从会话列表移除失败:', error)
    }
  }

  private loadSessionList(): Array<{
    id: string
    title: string
    messageCount: number
    lastMessage: string
    timestamp: number
  }> {
    try {
      const data = storageService.get<Array<any>>('rmfood_chat_sessions_v2')
      return data || []
    } catch {
      return []
    }
  }

  private loadFromLocalStorage(sessionId: string): ChatMessage[] {
    try {
      // 兼容旧版存储键格式
      const key = `chat_session_msgs_${sessionId}`
      const data = storageService.get<ChatMessage[]>(key)
      return data || []
    } catch {
      return []
    }
  }
}

export const chatStorageService = new ChatStorageService()
export default chatStorageService

import { useState, useCallback, useEffect, useMemo } from 'react'
import { logger } from '@/utils/safeLogger'
import { chatHistoryStorage } from '../services/chatHistoryStorage'
import type {
  ChatSession,
  ChatMessage,
  HistorySearchFilters,
  HistoryStatistics,
} from '../types/chatHistory.types'
import { ChatTopic, MAX_TAGS_PER_SESSION } from '../types/chatHistory.types'

interface UseChatHistoryManagerReturn {
  sessions: ChatSession[]
  currentSession: ChatSession | null
  isLoading: boolean
  isSaving: boolean
  statistics: HistoryStatistics | null
  filters: HistorySearchFilters

  createSession: (title?: string, topic?: ChatTopic) => ChatSession
  saveSession: (session: ChatSession) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  clearAll: () => Promise<void>
  selectSession: (id: string) => void
  addMessage: (sessionId: string, message: ChatMessage) => Promise<void>
  updateSessionTopic: (sessionId: string, topic: ChatTopic) => Promise<void>
  addTagToSession: (sessionId: string, tag: string) => Promise<void>
  removeTagFromSession: (sessionId: string, tag: string) => Promise<void>
  searchSessions: (filters: HistorySearchFilters) => Promise<void>
  refreshStatistics: () => Promise<void>
  getSessionById: (id: string) => ChatSession | null
  getSessionsByTopic: (topic: ChatTopic) => ChatSession[]
  getSessionsByTag: (tag: string) => ChatSession[]
}

export function useChatHistoryManager(): UseChatHistoryManagerReturn {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [statistics, setStatistics] = useState<HistoryStatistics | null>(null)
  const [filters, setFilters] = useState<HistorySearchFilters>({})

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = useCallback(async () => {
    setIsLoading(true)
    try {
      const loaded = await chatHistoryStorage.getAllSessions(filters)
      setSessions(loaded)
      if (loaded.length > 0 && !currentSessionId) {
        setCurrentSessionId(loaded[0].id)
      }
      await refreshStatistics()
      logger.info(`[useChatHistoryManager] 加载了 ${loaded.length} 条会话`)
    } catch (error) {
      logger.error('[useChatHistoryManager] 加载会话失败:', error)
    } finally {
      setIsLoading(false)
    }
  }, [filters, currentSessionId])

  const refreshStatistics = useCallback(async () => {
    try {
      const stats = await chatHistoryStorage.getStatistics()
      setStatistics(stats)
    } catch (error) {
      logger.error('[useChatHistoryManager] 获取统计信息失败:', error)
    }
  }, [])

  const createSession = useCallback((title?: string, topic: ChatTopic = ChatTopic.KNOWLEDGE_QUERY): ChatSession => {
    const now = Date.now()
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: title || `对话 ${new Date(now).toLocaleString('zh-CN')}`,
      messages: [],
      metadata: {
        topic,
        tags: [],
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
      },
    }
    return newSession
  }, [])

  const saveSession = useCallback(async (session: ChatSession) => {
    setIsSaving(true)
    try {
      await chatHistoryStorage.saveSession(session)
      setSessions(prev => {
        const index = prev.findIndex(s => s.id === session.id)
        if (index >= 0) {
          const updated = [...prev]
          updated[index] = session
          return updated
        }
        return [session, ...prev]
      })
      if (!currentSessionId) {
        setCurrentSessionId(session.id)
      }
      await refreshStatistics()
      logger.info(`[useChatHistoryManager] 保存会话成功: ${session.id}`)
    } catch (error) {
      logger.error('[useChatHistoryManager] 保存会话失败:', error)
      throw error
    } finally {
      setIsSaving(false)
    }
  }, [currentSessionId, refreshStatistics])

  const deleteSession = useCallback(async (id: string) => {
    try {
      await chatHistoryStorage.deleteSession(id)
      setSessions(prev => prev.filter((s: any) => s.id !== id))
      if (currentSessionId === id) {
        setCurrentSessionId(sessions.filter((s: any) => s.id !== id)[0]?.id || null)
      }
      await refreshStatistics()
      logger.info(`[useChatHistoryManager] 删除会话成功: ${id}`)
    } catch (error) {
      logger.error('[useChatHistoryManager] 删除会话失败:', error)
      throw error
    }
  }, [currentSessionId, refreshStatistics])

  const clearAll = useCallback(async () => {
    try {
      await chatHistoryStorage.clearAll()
      setSessions([])
      setCurrentSessionId(null)
      setStatistics(null)
      logger.info('[useChatHistoryManager] 清除所有会话')
    } catch (error) {
      logger.error('[useChatHistoryManager] 清除会话失败:', error)
      throw error
    }
  }, [])

  const selectSession = useCallback((id: string) => {
    setCurrentSessionId(id)
    logger.info(`[useChatHistoryManager] 选择会话: ${id}`)
  }, [])

  const addMessage = useCallback(async (sessionId: string, message: ChatMessage) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`)
    }

    const updatedSession: ChatSession = {
      ...session,
      messages: [...session.messages, message],
      metadata: {
        ...session.metadata,
        updatedAt: Date.now(),
        messageCount: session.metadata.messageCount + 1,
      },
    }

    await saveSession(updatedSession)
  }, [sessions, saveSession])

  const updateSessionTopic = useCallback(async (sessionId: string, topic: ChatTopic) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`)
    }

    const updatedSession: ChatSession = {
      ...session,
      metadata: {
        ...session.metadata,
        topic,
        updatedAt: Date.now(),
      },
    }

    await saveSession(updatedSession)
  }, [sessions, saveSession])

  const addTagToSession = useCallback(async (sessionId: string, tag: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`)
    }

    if (session.metadata.tags.length >= MAX_TAGS_PER_SESSION) {
      throw new Error(`最多支持 ${MAX_TAGS_PER_SESSION} 个标签`)
    }

    if (session.metadata.tags.includes(tag)) {
      return
    }

    const updatedSession: ChatSession = {
      ...session,
      metadata: {
        ...session.metadata,
        tags: [...session.metadata.tags, tag],
        updatedAt: Date.now(),
      },
    }

    await saveSession(updatedSession)
  }, [sessions, saveSession])

  const removeTagFromSession = useCallback(async (sessionId: string, tag: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`)
    }

    const updatedSession: ChatSession = {
      ...session,
      metadata: {
        ...session.metadata,
        tags: session.metadata.tags.filter(t => t !== tag),
        updatedAt: Date.now(),
      },
    }

    await saveSession(updatedSession)
  }, [sessions, saveSession])

  const searchSessions = useCallback(async (newFilters: HistorySearchFilters) => {
    setFilters(newFilters)
  }, [])

  useEffect(() => {
    loadSessions()
  }, [filters])

  const getSessionById = useCallback((id: string): ChatSession | null => {
    return sessions.find(s => s.id === id) || null
  }, [sessions])

  const getSessionsByTopic = useCallback((topic: ChatTopic): ChatSession[] => {
    return sessions.filter(s => s.metadata.topic === topic)
  }, [sessions])

  const getSessionsByTag = useCallback((tag: string): ChatSession[] => {
    return sessions.filter(s => s.metadata.tags.includes(tag))
  }, [sessions])

  const currentSession = useMemo(() => {
    if (!currentSessionId) return null
    return sessions.find(s => s.id === currentSessionId) || null
  }, [sessions, currentSessionId])

  return {
    sessions,
    currentSession,
    isLoading,
    isSaving,
    statistics,
    filters,
    createSession,
    saveSession,
    deleteSession,
    clearAll,
    selectSession,
    addMessage,
    updateSessionTopic,
    addTagToSession,
    removeTagFromSession,
    searchSessions,
    refreshStatistics,
    getSessionById,
    getSessionsByTopic,
    getSessionsByTag,
  }
}

export default useChatHistoryManager

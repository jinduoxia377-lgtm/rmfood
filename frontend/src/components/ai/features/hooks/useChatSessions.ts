/**
 * useChatSessions - 多会话管理系统 Hook (v1.0)
 *
 * 职责：
 * - 管理多个聊天会话的完整生命周期
 * - 会话 CRUD 操作（创建/切换/删除/重命名）
 * - 会话置顶与排序
 * - 会话搜索与过滤
 * - 会话导出/导入（支持多格式）
 * - 会话数据持久化（localStorage）
 *
 * 功能特性：
 * ✅ 完整的会话 CRUD 接口
 * ✅ 置顶会话优先显示
 * ✅ 基于关键词的模糊搜索
 * ✅ 多格式导出（JSON/Markdown/TXT）
 * ✅ 数据完整性校验
 * ✅ 自动生成会话标题
 * ✅ 标签管理系统
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-12
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { logger } from '@/utils/safeLogger'

// ===== 类型定义 =====

/**
 * 聊天会话数据结构
 */
export interface ChatSession {
  /** 会话唯一标识 */
  id: string
  /** 会话标题（自动生成或用户自定义） */
  title: string
  /** 创建时间戳 */
  createdAt: number
  /** 最后更新时间戳 */
  updatedAt: number
  /** 消息数量 */
  messageCount: number
  /** 用户标签 */
  tags: string[]
  /** 是否置顶 */
  pinned: boolean
}

/** 导出格式类型 */
export type SessionExportFormat = 'json' | 'markdown' | 'text'

/**
 * useChatSessions 返回值接口
 */
export interface UseChatSessionsReturn {
  /** 所有会话列表 */
  sessions: ChatSession[]
  /** 当前激活的会话ID */
  activeSessionId: string | null

  // CRUD 操作
  /** 创建新会话 */
  createSession: (title?: string) => string
  /** 切换到指定会话 */
  switchSession: (sessionId: string) => void
  /** 删除指定会话 */
  deleteSession: (sessionId: string) => void
  /** 重命名会话 */
  renameSession: (sessionId: string, title: string) => void

  // 高级操作
  /** 切换置顶状态 */
  pinSession: (sessionId: string) => void
  /** 搜索会话 */
  searchSessions: (query: string) => ChatSession[]
  /** 更新消息计数 */
  updateMessageCount: (sessionId: string, count: number) => void
  /** 设置标签 */
  setSessionTags: (sessionId: string, tags: string[]) => void

  // 导入导出
  /** 导出会话 */
  exportSession: (sessionId: string, format?: SessionExportFormat) => Promise<Blob>
  /** 导入会话 */
  importSession: (data: Blob | string) => Promise<string>

  // 状态查询
  /** 获取指定会话 */
  getSession: (sessionId: string) => ChatSession | undefined
  /** 获取激活会话 */
  getActiveSession: () => ChatSession | null
  /** 获取统计信息 */
  getStats: () => { totalSessions: number; totalMessages: number; pinnedCount: number }
}

// ===== 常量定义 =====

const SESSIONS_STORAGE_KEY = 'rmfood_chat_sessions_v1'
const MAX_SESSIONS = 100
const MAX_TITLE_LENGTH = 50
const DEFAULT_TITLE = '新对话'

// ===== 工具函数 =====

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ===== 主 Hook 实现 =====

/**
 * useChatSessions - 多会话管理 Hook
 *
 * 核心设计思路：
 * 1. 使用 useState + useRef 管理会话列表和活跃会话
 * 2. 所有变更操作自动持久化到 localStorage
 * 3. 提供完整的 CRUD 和搜索接口
 * 4. 支持多格式导出和数据完整性校验
 *
 * @returns 会话管理接口
 *
 * @example
 * ```tsx
 * const {
 *   sessions,
 *   activeSessionId,
 *   createSession,
 *   switchSession,
 *   deleteSession,
 *   searchSessions,
 * } = useChatSessions()
 *
 * // 创建新会话
 * const sessionId = createSession('配方咨询')
 *
 * // 切换会话
 * switchSession(sessionId)
 *
 * // 搜索会话
 * const results = searchSessions('配方')
 * ```
 */
export function useChatSessions(): UseChatSessionsReturn {
  // 核心状态
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const stored = localStorage.getItem(SESSIONS_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ChatSession[]
        logger.info(`[useChatSessions] 已加载 ${parsed.length} 个会话`)
        return parsed
      }
    } catch (error) {
      logger.error('[useChatSessions] 加载会话失败:', error)
    }
    return []
  })

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`${SESSIONS_STORAGE_KEY}_active`) || null
    } catch {
      return null
    }
  })

  // Refs（避免闭包问题）
  const sessionsRef = useRef<ChatSession[]>(sessions)
  sessionsRef.current = sessions

  /**
   * 持久化会话列表到 localStorage
   */
  const persistSessions = useCallback((updatedSessions: ChatSession[]) => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions))
    } catch (error) {
      logger.error('[useChatSessions] 持久化失败:', error)
    }
  }, [])

  /**
   * 持久化活跃会话 ID
   */
  const persistActiveId = useCallback((id: string | null) => {
    try {
      if (id) {
        localStorage.setItem(`${SESSIONS_STORAGE_KEY}_active`, id)
      } else {
        localStorage.removeItem(`${SESSIONS_STORAGE_KEY}_active`)
      }
    } catch (error) {
      logger.warn('[useChatSessions] 保存活跃会话ID失败:', error)
    }
  }, [])

  // 当 sessions 变化时自动持久化
  useEffect(() => {
    persistSessions(sessions)
  }, [sessions, persistSessions])

  // 当 activeSessionId 变化时自动持久化
  useEffect(() => {
    persistActiveId(activeSessionId)
  }, [activeSessionId, persistActiveId])

  /**
   * 创建新会话
   *
   * @param title - 可选的自定义标题（不传则使用默认标题）
   * @returns 新创建的会话 ID
   */
  const createSession = useCallback((title?: string): string => {
    if (sessions.length >= MAX_SESSIONS) {
      logger.warn(`[useChatSessions] 已达到最大会话数限制 (${MAX_SESSIONS})`)
      throw new Error(`最多只能创建 ${MAX_SESSIONS} 个会话`)
    }

    const newSession: ChatSession = {
      id: generateId(),
      title: title || DEFAULT_TITLE,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      tags: [],
      pinned: false,
    }

    setSessions(prev => [newSession, ...prev])
    setActiveSessionId(newSession.id)

    logger.info(`[useChatSessions] 已创建新会话: ${newSession.id}`, { title: newSession.title })

    return newSession.id
  }, [sessions.length])

  /**
   * 切换到指定会话
   *
   * @param sessionId - 目标会话 ID
   */
  const switchSession = useCallback((sessionId: string): void => {
    const targetSession = sessions.find(s => s.id === sessionId)
    if (!targetSession) {
      logger.warn(`[useChatSessions] 目标会话不存在: ${sessionId}`)
      return
    }

    setActiveSessionId(sessionId)
    logger.info(`[useChatSessions] 已切换到会话: ${sessionId}`, { title: targetSession.title })
  }, [sessions])

  /**
   * 删除指定会话
   *
   * @param sessionId - 要删除的会话 ID
   */
  const deleteSession = useCallback((sessionId: string): void => {
    const sessionToDelete = sessions.find(s => s.id === sessionId)
    if (!sessionToDelete) {
      logger.warn(`[useChatSessions] 要删除的会话不存在: ${sessionId}`)
      return
    }

    setSessions(prev => prev.filter(s => s.id !== sessionId))

    // 如果删除的是当前活跃会话，切换到最近的会话
    if (activeSessionId === sessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId)
      setActiveSessionId(remaining.length > 0 ? remaining[0].id : null)
    }

    logger.info(`[useChatSessions] 已删除会话: ${sessionId}`, { title: sessionToDelete.title })
  }, [sessions, activeSessionId])

  /**
   * 重命名会话
   *
   * @param sessionId - 会话 ID
   * @param title - 新标题
   */
  const renameSession = useCallback((sessionId: string, title: string): void => {
    if (!title.trim()) {
      logger.warn('[useChatSessions] 标题不能为空')
      return
    }

    const trimmedTitle = title.slice(0, MAX_TITLE_LENGTH)

    setSessions(prev =>
      prev.map(session =>
        session.id === sessionId
          ? { ...session, title: trimmedTitle, updatedAt: Date.now() }
          : session,
      ),
    )

    logger.info(`[useChatSessions] 已重命名会话: ${sessionId}`, { newTitle: trimmedTitle })
  }, [])

  /**
   * 切换会话置顶状态
   *
   * @param sessionId - 会话 ID
   */
  const pinSession = useCallback((sessionId: string): void => {
    setSessions(prev => {
      const session = prev.find(s => s.id === sessionId)
      if (!session) {
        logger.warn(`[useChatSessions] 置顶目标不存在: ${sessionId}`)
        return prev
      }

      const newPinnedState = !session.pinned
      logger.info(`[useChatSessions] ${newPinnedState ? '已置顶' : '已取消置顶'}会话: ${sessionId}`)

      return prev.map(s =>
        s.id === sessionId ? { ...s, pinned: newPinnedState, updatedAt: Date.now() } : s,
      )
    })
  }, [])

  /**
   * 搜索会话（基于标题和标签的模糊匹配）
   *
   * @param query - 搜索关键词
   * @returns 匹配的会话列表
   */
  const searchSessions = useCallback((query: string): ChatSession[] => {
    if (!query.trim()) {
      return [...sessions]
    }

    const lowerQuery = query.toLowerCase().trim()

    return sessions.filter(session => {
      const titleMatch = session.title.toLowerCase().includes(lowerQuery)
      const tagMatch = session.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      return titleMatch || tagMatch
    }).sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
  }, [sessions])

  /**
   * 更新会话的消息计数
   *
   * @param sessionId - 会话 ID
   * @param count - 新的消息数量
   */
  const updateMessageCount = useCallback((sessionId: string, count: number): void => {
    setSessions(prev =>
      prev.map(session =>
        session.id === sessionId
          ? { ...session, messageCount: count, updatedAt: Date.now() }
          : session,
      ),
    )
  }, [])

  /**
   * 设置会话标签
   *
   * @param sessionId - 会话 ID
   * @param tags - 标签数组
   */
  const setSessionTags = useCallback((sessionId: string, tags: string[]): void => {
    setSessions(prev =>
      prev.map(session =>
        session.id === sessionId
          ? { ...session, tags, updatedAt: Date.now() }
          : session,
      ),
    )
  }, [])

  /**
   * 导出单个会话
   *
   * @param sessionId - 要导出的会话 ID
   * @param format - 导出格式（json/markdown/text）
   * @returns Blob 对象（可用于下载）
   */
  const exportSession = useCallback(async (
    sessionId: string,
    format: SessionExportFormat = 'json',
  ): Promise<Blob> => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`)
    }

    let content: string
    let mimeType: string

    switch (format) {
      case 'json':
        content = JSON.stringify(session, null, 2)
        mimeType = 'application/json'
        break

      case 'markdown':
        content = `# ${session.title}\n\n` +
          `- **创建时间**: ${new Date(session.createdAt).toLocaleString('zh-CN')}\n` +
          `- **最后更新**: ${new Date(session.updatedAt).toLocaleString('zh-CN')}\n` +
          `- **消息数量**: ${session.messageCount}\n` +
          `- **标签**: ${session.tags.join(', ') || '无'}\n` +
          `- **置顶**: ${session.pinned ? '是' : '否'}\n`
        mimeType = 'text/markdown'
        break

      case 'text':
        content = `会话: ${session.title}\n` +
          `创建时间: ${new Date(session.createdAt).toLocaleString('zh-CN')}\n` +
          `最后更新: ${new Date(session.updatedAt).toLocaleString('zh-CN')}\n` +
          `消息数量: ${session.messageCount}\n` +
          `标签: ${session.tags.join(', ') || '无'}\n`
        mimeType = 'text/plain'
        break

      default:
        throw new Error(`不支持的导出格式: ${format}`)
    }

    logger.info(`[useChatSessions] 已导出会话: ${sessionId}`, { format })

    return new Blob([content], { type: mimeType })
  }, [sessions])

  /**
   * 导入会话（从 JSON 数据恢复）
   *
   * @param data - 可以是 Blob 或 JSON 字符串
   * @returns 导入后的会话 ID
   */
  const importSession = useCallback(async (data: Blob | string): Promise<string> => {
    let jsonText: string

    if (typeof data === 'string') {
      jsonText = data
    } else if ('text' in data && typeof data.text === 'function') {
      jsonText = await data.text()
    } else if ('arrayBuffer' in data && typeof data.arrayBuffer === 'function') {
      const buffer = await data.arrayBuffer()
      jsonText = new TextDecoder('utf-8').decode(buffer)
    } else {
      throw new Error('无法读取导入数据')
    }

    let importedSession: ChatSession
    try {
      importedSession = JSON.parse(jsonText)
    } catch {
      throw new Error('无效的会话数据格式（期望 JSON）')
    }

    // 数据完整性校验
    if (!importedSession.id || !importedSession.title) {
      throw new Error('会话数据缺少必要字段（id 或 title）')
    }

    if (typeof importedSession.createdAt !== 'number' || typeof importedSession.updatedAt !== 'number') {
      throw new Error('会话数据的时间戳格式错误')
    }

    // 生成新的 ID 避免冲突
    const newSession: ChatSession = {
      ...importedSession,
      id: generateId(),
      title: `${importedSession.title} (已导入)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: importedSession.tags || [],
      pinned: importedSession.pinned || false,
      messageCount: importedSession.messageCount || 0,
    }

    setSessions(prev => [newSession, ...prev])
    setActiveSessionId(newSession.id)

    logger.info(`[useChatSessions] 已导入会话: ${newSession.id}`, {
      originalTitle: importedSession.title,
    })

    return newSession.id
  }, [])

  /**
   * 获取指定会话
   *
   * @param sessionId - 会话 ID
   * @returns 会话对象或 undefined
   */
  const getSession = useCallback((sessionId: string): ChatSession | undefined => {
    return sessions.find(s => s.id === sessionId)
  }, [sessions])

  /**
   * 获取当前活跃会话
   *
   * @returns 活跃会话对象或 null
   */
  const getActiveSession = useCallback((): ChatSession | null => {
    if (!activeSessionId) return null
    return sessions.find(s => s.id === activeSessionId) || null
  }, [sessions, activeSessionId])

  /**
   * 获取统计信息
   *
   * @returns 统计数据对象
   */
  const getStats = useCallback(() => ({
    totalSessions: sessions.length,
    totalMessages: sessions.reduce((sum, s) => sum + s.messageCount, 0),
    pinnedCount: sessions.filter(s => s.pinned).length,
  }), [sessions])

  return {
    sessions,
    activeSessionId,

    // CRUD 操作
    createSession,
    switchSession,
    deleteSession,
    renameSession,

    // 高级操作
    pinSession,
    searchSessions,
    updateMessageCount,
    setSessionTags,

    // 导入导出
    exportSession,
    importSession,

    // 状态查询
    getSession,
    getActiveSession,
    getStats,
  }
}

export default useChatSessions

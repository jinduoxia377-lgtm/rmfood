/**
 * useChatHistory - 企业级历史记录管理 Hook (v7.0)
 *
 * 职责：管理对话历史的持久化、加载、清除、搜索、导出等功能。
 *
 * 核心特性：
 * - ✅ 完整的 CRUD 操作（创建/读取/更新/删除会话）
 * - ✅ 智能持久化存储（集成 StorageService v7.0）
 * - ✅ 多格式导出支持（JSON/CSV/TXT/HTML/Markdown）
 * - ✅ 高级搜索与过滤（关键词/日期范围/消息数量）
 * - ✅ 分页浏览优化（大数据量场景）
 * - ✅ 事件驱动架构（EventBus 集成）
 * - ✅ 自动清理策略（LRU + 过期数据清理）
 * - ✅ 错误恢复机制（存储配额溢出处理）
 * - ✅ 会话统计与分析（使用量/频率/趋势）
 * - ✅ 批量操作支持（批量删除/导出/归档）
 *
 * @version 7.0.0
 * @lastUpdated 2026-05-12
 * @author RMFOOD Team (Deep Development)
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { logger } from '@/utils/safeLogger'
import { storageService } from '../services/storageService'
import { eventBus } from '../services/eventBus'
import type { ChatMessage } from '../services/exportService'
import { exportService } from '../services/exportService'

interface HistorySession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
  messageCount: number
  tags?: string[]
  metadata?: Record<string, unknown>
}

interface SearchFilters {
  keyword?: string
  dateFrom?: number
  dateTo?: number
  minMessages?: number
  maxMessages?: number
  tags?: string[]
}

interface PaginationState {
  currentPage: number
  pageSize: number
  totalItems: number
  totalPages: number
}

interface ExportOptions {
  format: 'json' | 'csv' | 'txt' | 'html' | 'markdown'
  includeMetadata?: boolean
  includeTimestamps?: boolean
  filenamePrefix?: string
}

interface UsageStatistics {
  totalSessions: number
  totalMessages: number
  averageMessagesPerSession: number
  storageUsedBytes: number
  oldestSessionDate: Date | null
  newestSessionDate: Date | null
  sessionsLastWeek: number
  sessionsLastMonth: number
  topTags: { tag: string; count: number }[]
}

interface UseChatHistoryOptions {
  storageKey?: string
  maxSessions?: number
  autoSave?: boolean
  autoSaveDelayMs?: number
  enableSearch?: boolean
  enableExport?: boolean
  enableAnalytics?: boolean
  onSessionLoad?: (session: HistorySession) => void
  onSessionSave?: (session: HistorySession) => void
  onError?: (error: Error, context: string) => void
}

interface UseChatHistoryReturn {
  // 状态
  sessions: HistorySession[]
  currentSession: HistorySession | null
  isLoading: boolean
  isSaving: boolean
  isExporting: boolean
  searchQuery: string
  filters: SearchFilters
  pagination: PaginationState
  statistics: UsageStatistics | null

  // 会话操作
  loadHistory: () => Promise<void>
  saveSession: (session: HistorySession) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
  switchSession: (id: string) => void
  createNewSession: (title?: string) => HistorySession

  // 搜索与过滤
  setSearchQuery: (query: string) => void
  setFilters: (filters: Partial<SearchFilters>) => void
  clearFilters: () => void
  getFilteredSessions: () => HistorySession[]

  // 分页
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  setPageSize: (size: number) => void
  getPagedSessions: () => HistorySession[]

  // 导出
  exportHistory: (options?: ExportOptions) => Promise<void>
  exportSession: (sessionId: string, options?: ExportOptions) => Promise<void>
  exportSelected: (sessionIds: string[], options?: ExportOptions) => Promise<void>

  // 批量操作
  batchDelete: (ids: string[]) => Promise<void>
  batchArchive: (ids: string[]) => Promise<void>
  batchTag: (ids: string[], tags: string[]) => Promise<void>

  // 统计与分析
  refreshStatistics: () => void
  getSessionById: (id: string) => HistorySession | null
  getRecentSessions: (count?: number) => HistorySession[]
  getSessionsByTag: (tag: string) => HistorySession[]
}

const DEFAULT_STORAGE_KEY = 'rmfood_chat_history_v7'
const DEFAULT_MAX_SESSIONS = 100
const DEFAULT_PAGE_SIZE = 10
const AUTO_SAVE_DELAY_MS = 1000

export function useChatHistory(options: UseChatHistoryOptions = {}): UseChatHistoryReturn {
  const {
    storageKey = DEFAULT_STORAGE_KEY,
    maxSessions = DEFAULT_MAX_SESSIONS,
    autoSave = true,
    autoSaveDelayMs = AUTO_SAVE_DELAY_MS,
    enableSearch = true,
    enableExport = true,
    enableAnalytics = true,
    onSessionLoad,
    onSessionSave,
    onError,
  } = options

  const [sessions, setSessions] = useState<HistorySession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<SearchFilters>({})
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
  })
  const [statistics, setStatistics] = useState<UsageStatistics | null>(null)

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pendingSaveRef = useRef<HistorySession | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    loadHistory()

    return () => {
      isMountedRef.current = false
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const unsubNewMessage = eventBus.subscribe('chat:message:sent' as any, (payload: any) => {
      if (currentSessionId && autoSave) {
        const currentSession = sessions.find(s => s.id === currentSessionId)
        if (currentSession) {
          const updatedSession = {
            ...currentSession,
            messages: [...currentSession.messages, payload.message],
            updatedAt: Date.now(),
            messageCount: currentSession.messages.length + 1,
          }
          scheduleAutoSave(updatedSession)
        }
      }
    })

    return () => {
      unsubNewMessage()
    }
  }, [currentSessionId, sessions, autoSave])

  const loadHistory = useCallback(async (): Promise<void> => {
    if (isLoading) return

    setIsLoading(true)
    try {
      logger.info('[useChatHistory] 📂 开始加载历史记录')

      const savedData = storageService.get<HistorySession[]>(storageKey)

      if (savedData && Array.isArray(savedData)) {
        const validSessions = savedData
          .filter(session => session && session.id && session.messages)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, maxSessions)

        logger.info(`[useChatHistory] ✅ 成功加载 ${validSessions.length} 条历史记录`)
        setSessions(validSessions)

        if (validSessions.length > 0) {
          setCurrentSessionId(validSessions[0].id)
          onSessionLoad?.(validSessions[0])
        }

        if (enableAnalytics) {
          calculateStatistics(validSessions)
        }
      } else {
        logger.info('[useChatHistory] 📭 未找到历史记录')
        setSessions([])
      }

      eventBus.emit('history:loaded' as any, {
        sessionCount: sessions.length,
        storageKey,
      })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('[useChatHistory] ❌ 加载历史记录失败:', err)
      onError?.(err, 'loadHistory')
      eventBus.emit('history:error' as any, { error: err.message, action: 'load' })
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [storageKey, maxSessions, enableAnalytics, isLoading, onSessionLoad, onError])

  const scheduleAutoSave = useCallback((session: HistorySession) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    pendingSaveRef.current = session

    autoSaveTimerRef.current = setTimeout(async () => {
      if (pendingSaveRef.current && isMountedRef.current) {
        await saveSession(pendingSaveRef.current)
        pendingSaveRef.current = null
      }
    }, autoSaveDelayMs)
  }, [autoSaveDelayMs])

  const saveSession = useCallback(async (session: HistorySession): Promise<void> => {
    if (isSaving) return

    setIsSaving(true)
    try {
      logger.info(`[useChatHistory] 💾 保存会话: ${session.id} (${session.title})`)

      const updatedSessions = sessions.some(s => s.id === session.id)
        ? sessions.map(s => s.id === session.id ? { ...session, updatedAt: Date.now() } : s)
        : [session, ...sessions]

      const trimmedSessions = updatedSessions.slice(0, maxSessions)

      storageService.set(storageKey, trimmedSessions)
      setSessions(trimmedSessions)

      logger.info(`[useChatHistory] ✅ 会话保存成功: ${session.id}`)
      onSessionSave?.(session)

      eventBus.emit('history:session:saved' as any, {
        sessionId: session.id,
        title: session.title,
        messageCount: session.messageCount,
      })

      if (enableAnalytics) {
        calculateStatistics(trimmedSessions)
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('[useChatHistory] ❌ 保存会话失败:', err)
      onError?.(err, 'saveSession')
      eventBus.emit('history:error' as any, { error: err.message, action: 'save' })

      if (err.message.includes('配额')) {
        handleQuotaExceeded()
      }
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false)
      }
    }
  }, [sessions, storageKey, maxSessions, isSaving, enableAnalytics, onSessionSave, onError])

  const deleteSession = useCallback(async (id: string): Promise<void> => {
    try {
      logger.info(`[useChatHistory] 🗑️ 删除会话: ${id}`)

      const updatedSessions = sessions.filter(s => s.id !== id)
      storageService.set(storageKey, updatedSessions)
      setSessions(updatedSessions)

      if (currentSessionId === id) {
        setCurrentSessionId(updatedSessions.length > 0 ? updatedSessions[0].id : null)
      }

      logger.info(`[useChatHistory] ✅ 会话删除成功: ${id}`)
      eventBus.emit('history:session:deleted' as any, { sessionId: id })

      if (enableAnalytics) {
        calculateStatistics(updatedSessions)
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('[useChatHistory] ❌ 删除会话失败:', err)
      onError?.(err, 'deleteSession')
    }
  }, [sessions, storageKey, currentSessionId, enableAnalytics, onError])

  const clearHistory = useCallback(async (): Promise<void> => {
    try {
      logger.warn('[useChatHistory] 🧹 清除所有历史记录')

      storageService.remove(storageKey)
      setSessions([])
      setCurrentSessionId(null)
      setStatistics(null)

      logger.info('[useChatHistory] ✅ 历史记录已清除')
      eventBus.emit('history:cleared' as any, {})
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('[useChatHistory] ❌ 清除历史记录失败:', err)
      onError?.(err, 'clearHistory')
    }
  }, [storageKey, onError])

  const switchSession = useCallback((id: string): void => {
    const session = sessions.find(s => s.id === id)
    if (session) {
      setCurrentSessionId(id)
      logger.info(`[useChatHistory] 🔄 切换到会话: ${id} (${session.title})`)
      onSessionLoad?.(session)
      eventBus.emit('history:session:switched' as any, { sessionId: id })
    }
  }, [sessions, onSessionLoad])

  const createNewSession = useCallback((title?: string): HistorySession => {
    const newSession: HistorySession = {
      id: crypto.randomUUID(),
      title: title || `对话 ${new Date().toLocaleString('zh-CN')}`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      tags: [],
      metadata: {},
    }

    logger.info(`[useChatHistory] ➕ 创建新会话: ${newSession.id}`)
    eventBus.emit('history:session:created' as any, { sessionId: newSession.id, title: newSession.title })

    return newSession
  }, [])

  const getFilteredSessions = useCallback((): HistorySession[] => {
    let filtered = [...sessions]

    if (enableSearch && searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(session =>
        session.title.toLowerCase().includes(query) ||
        session.messages.some(msg =>
          msg.content?.toLowerCase().includes(query),
        ),
      )
    }

    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase()
      filtered = filtered.filter(session =>
        session.title.toLowerCase().includes(keyword) ||
        session.tags?.some(tag => tag.toLowerCase().includes(keyword)),
      )
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(session => session.createdAt >= filters.dateFrom!)
    }

    if (filters.dateTo) {
      filtered = filtered.filter(session => session.createdAt <= filters.dateTo!)
    }

    if (filters.minMessages) {
      filtered = filtered.filter(session => session.messageCount >= filters.minMessages!)
    }

    if (filters.maxMessages) {
      filtered = filtered.filter(session => session.messageCount <= filters.maxMessages!)
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(session =>
        filters.tags!.some(tag => session.tags?.includes(tag)),
      )
    }

    return filtered
  }, [sessions, searchQuery, filters, enableSearch])

  const updatePagination = useCallback(() => {
    const filtered = getFilteredSessions()
    const totalPages = Math.ceil(filtered.length / pagination.pageSize)

    setPagination(prev => ({
      ...prev,
      totalItems: filtered.length,
      totalPages,
      currentPage: Math.min(prev.currentPage, totalPages) || 1,
    }))
  }, [getFilteredSessions, pagination.pageSize])

  useEffect(() => {
    updatePagination()
  }, [searchQuery, filters, sessions, updatePagination])

  const goToPage = useCallback((page: number) => {
    setPagination(prev => ({
      ...prev,
      currentPage: Math.max(1, Math.min(page, prev.totalPages)),
    }))
  }, [])

  const nextPage = useCallback(() => {
    setPagination(prev => ({
      ...prev,
      currentPage: Math.min(prev.currentPage + 1, prev.totalPages),
    }))
  }, [])

  const prevPage = useCallback(() => {
    setPagination(prev => ({
      ...prev,
      currentPage: Math.max(prev.currentPage - 1, 1),
    }))
  }, [])

  const setPageSize = useCallback((size: number) => {
    setPagination(prev => ({
      ...prev,
      pageSize: size,
      currentPage: 1,
    }))
  }, [])

  const getPagedSessions = useCallback((): HistorySession[] => {
    const filtered = getFilteredSessions()
    const startIndex = (pagination.currentPage - 1) * pagination.pageSize
    const endIndex = startIndex + pagination.pageSize
    return filtered.slice(startIndex, endIndex)
  }, [getFilteredSessions, pagination.currentPage, pagination.pageSize])

  const generateExportContent = (
    sessionsToExport: HistorySession[],
    options: ExportOptions,
  ): string => {
    const { format, includeMetadata = true, includeTimestamps = true } = options

    switch (format) {
      case 'json':
        return JSON.stringify(sessionsToExport, null, 2)

      case 'csv': {
        const headers = ['会话ID', '标题', '消息数量', '创建时间', '最后更新']
        const rows = sessionsToExport.map(session => [
          session.id,
          `"${session.title}"`,
          session.messageCount,
          includeTimestamps ? new Date(session.createdAt).toLocaleString('zh-CN') : '',
          includeTimestamps ? new Date(session.updatedAt).toLocaleString('zh-CN') : '',
        ])
        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
      }

      case 'txt':
        return sessionsToExport.map(session => {
          let content = `${'='.repeat(60)}\n`
          content += `会话: ${session.title}\n`
          content += `ID: ${session.id}\n`
          if (includeTimestamps) {
            content += `创建时间: ${new Date(session.createdAt).toLocaleString('zh-CN')}\n`
            content += `最后更新: ${new Date(session.updatedAt).toLocaleString('zh-CN')}\n`
          }
          content += `消息数量: ${session.messageCount}\n`
          content += `${'-'.repeat(40)}\n\n`

          session.messages.forEach(msg => {
            const role = msg.role === 'user' ? '👤 用户' : '🤖 AI助手'
            const timestamp = includeTimestamps
              ? `[${new Date(msg.timestamp).toLocaleTimeString('zh-CN')}] `
              : ''
            content += `${timestamp}${role}: ${msg.content}\n\n`
          })

          return content
        }).join('\n')

      case 'html': {
        let html = `<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n`
        html += `<meta charset="UTF-8">\n`
        html += `<title>聊天历史记录导出</title>\n`
        html += `<style>\nbody { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 20px; }\n`
        html += `.session { margin-bottom: 30px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }\n`
        html += `.message { margin: 10px 0; padding: 10px; border-radius: 6px; }\n`
        html += `.user { background: #e3f2fd; }\n.assistant { background: #f3e5f5; }\n`
        html += `</style>\n</head>\n<body>\n`
        html += `<h1>聊天历史记录</h1>\n`
        html += `<p>导出时间: ${new Date().toLocaleString('zh-CN')}</p>\n`

        sessionsToExport.forEach(session => {
          html += `<div class="session">\n`
          html += `<h2>${session.title}</h2>\n`
          if (includeMetadata) {
            html += `<p><strong>ID:</strong> ${session.id}</p>\n`
            if (includeTimestamps) {
              html += `<p><strong>创建时间:</strong> ${new Date(session.createdAt).toLocaleString('zh-CN')}</p>\n`
              html += `<p><strong>最后更新:</strong> ${new Date(session.updatedAt).toLocaleString('zh-CN')}</p>\n`
            }
          }
          html += `<div class="messages">\n`

          session.messages.forEach(msg => {
            const roleClass = msg.role === 'user' ? 'user' : 'assistant'
            html += `<div class="message ${roleClass}">\n`
            html += `<strong>${msg.role === 'user' ? '用户' : 'AI助手'}:</strong> `
            if (includeTimestamps) {
              html += `<em>[${new Date(msg.timestamp).toLocaleTimeString('zh-CN')}] </em>`
            }
            html += `${msg.content}\n`
            html += `</div>\n`
          })

          html += `</div>\n</div>\n`
        })

        html += `</body>\n</html>`
        return html
      }

      case 'markdown': {
        let md = `# 聊天历史记录\n\n`
        md += `> 导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`
        md += `---\n\n`

        sessionsToExport.forEach(session => {
          md += `## ${session.title}\n\n`
          if (includeMetadata) {
            md += `- **ID:** ${session.id}\n`
            if (includeTimestamps) {
              md += `- **创建时间:** ${new Date(session.createdAt).toLocaleString('zh-CN')}\n`
              md += `- **最后更新:** ${new Date(session.updatedAt).toLocaleString('zh-CN')}\n`
            }
            md += `- **消息数量:** ${session.messageCount}\n`
          }
          md += `\n---\n\n`

          session.messages.forEach(msg => {
            const role = msg.role === 'user' ? '👤 **用户**' : '🤖 **AI助手**'
            const timestamp = includeTimestamps
              ? ` *(${new Date(msg.timestamp).toLocaleTimeString('zh-CN')})*`
              : ''
            md += `${role}${timestamp}: ${msg.content}\n\n`
          })

          md += `\n---\n\n`
        })

        return md
      }

      default:
        throw new Error(`不支持的导出格式: ${format}`)
    }
  }

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportHistory = useCallback(async (options?: ExportOptions): Promise<void> => {
    if (!enableExport || isExporting) return

    setIsExporting(true)
    try {
      const exportOptions: ExportOptions = {
        format: 'json',
        includeMetadata: true,
        includeTimestamps: true,
        ...options,
      }

      const sessionsToExport = getFilteredSessions()
      const content = generateExportContent(sessionsToExport, exportOptions)

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
      const filename = `${exportOptions.filenamePrefix || 'chat_history'}_${timestamp}.${exportOptions.format}`

      const mimeTypes: Record<string, string> = {
        json: 'application/json',
        csv: 'text/csv',
        txt: 'text/plain',
        html: 'text/html',
        markdown: 'text/markdown',
      }

      downloadFile(content, filename, mimeTypes[exportOptions.format] || 'text/plain')

      logger.info(`[useChatHistory] 📤 导出完成: ${filename} (${sessionsToExport.length} 个会话)`)
      eventBus.emit('history:exported' as any, {
        format: exportOptions.format,
        sessionCount: sessionsToExport.length,
        filename,
      })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('[useChatHistory] ❌ 导出失败:', err)
      onError?.(err, 'exportHistory')
    } finally {
      if (isMountedRef.current) {
        setIsExporting(false)
      }
    }
  }, [enableExport, isExporting, getFilteredSessions, onError])

  const exportSession = useCallback(async (sessionId: string, options?: ExportOptions): Promise<void> => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`)
    }

    // 直接导出单个会话，避免循环引用
    const exportOptions: ExportOptions = {
      ...options,
      filenamePrefix: options?.filenamePrefix || session.title,
      format: options?.format || 'json',
    }

    const dataToExport = session.messages
    const exportedContent = await exportService.exportAsync(dataToExport, exportOptions.format)

    if (exportedContent) {
      logger.info('[useChatHistory] 📤 单个会话导出成功', { sessionId })
      eventBus.emit('history:exported' as any, { format: exportOptions.format, count: 1 })
    }
  }, [sessions])

  const exportSelected = useCallback(async (sessionIds: string[], options?: ExportOptions): Promise<void> => {
    const selectedSessions = sessions.filter(s => sessionIds.includes(s.id))
    if (selectedSessions.length === 0) {
      logger.warn('[useChatHistory] ⚠️ 没有选中的会话可导出')
      return
    }

    const exportOptions: ExportOptions = {
      ...options,
      filenamePrefix: options?.filenamePrefix || 'selected_sessions',
      format: options?.format || 'json',
    }

    const tempSetSessions = sessions
    const tempGetFilteredSessions = getFilteredSessions

    setSessions(selectedSessions)
    await exportHistory(exportOptions)
    setSessions(tempSetSessions)
  }, [sessions, exportHistory])

  const batchDelete = useCallback(async (ids: string[]): Promise<void> => {
    try {
      logger.info(`[useChatHistory] 🗑️ 批量删除 ${ids.length} 个会话`)

      const updatedSessions = sessions.filter(s => !ids.includes(s.id))
      storageService.set(storageKey, updatedSessions)
      setSessions(updatedSessions)

      if (currentSessionId && ids.includes(currentSessionId)) {
        setCurrentSessionId(updatedSessions.length > 0 ? updatedSessions[0].id : null)
      }

      logger.info(`[useChatHistory] ✅ 批量删除完成`)
      eventBus.emit('history:batch:deleted' as any, { deletedIds: ids })

      if (enableAnalytics) {
        calculateStatistics(updatedSessions)
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('[useChatHistory] ❌ 批量删除失败:', err)
      onError?.(err, 'batchDelete')
    }
  }, [sessions, storageKey, currentSessionId, enableAnalytics, onError])

  const batchArchive = useCallback(async (ids: string[]): Promise<void> => {
    try {
      logger.info(`[useChatHistory] 📦 批量归档 ${ids.length} 个会话`)

      const archiveKey = `${storageKey}_archived`
      const existingArchive = storageService.get<HistorySession[]>(archiveKey) || []
      const sessionsToArchive = sessions.filter(s => ids.includes(s.id))

      const updatedArchive = [...existingArchive, ...sessionsToArchive]
      storageService.set(archiveKey, updatedArchive)

      await batchDelete(ids)

      logger.info(`[useChatHistory] ✅ 批量归档完成`)
      eventBus.emit('history:batch:archived' as any, { archivedIds: ids, archiveSize: updatedArchive.length })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('[useChatHistory] ❌ 批量归档失败:', err)
      onError?.(err, 'batchArchive')
    }
  }, [sessions, storageKey, batchDelete, onError])

  const batchTag = useCallback(async (ids: string[], tags: string[]): Promise<void> => {
    try {
      logger.info(`[useChatHistory] 🏷️ 批量标记 ${ids.length} 个会话`)

      const updatedSessions = sessions.map(session => {
        if (ids.includes(session.id)) {
          const existingTags = session.tags || []
          const newTags = [...new Set([...existingTags, ...tags])]
          return { ...session, tags: newTags, updatedAt: Date.now() }
        }
        return session
      })

      storageService.set(storageKey, updatedSessions)
      setSessions(updatedSessions)

      logger.info(`[useChatHistory] ✅ 批量标记完成`)
      eventBus.emit('history:batch:tagged' as any, { taggedIds: ids, tags })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('[useChatHistory] ❌ 批量标记失败:', err)
      onError?.(err, 'batchTag')
    }
  }, [sessions, storageKey, onError])

  const calculateStatistics = useCallback((sessionsData?: HistorySession[]) => {
    const data = sessionsData || sessions

    if (data.length === 0) {
      setStatistics(null)
      return
    }

    const now = Date.now()
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000

    const totalMessages = data.reduce((sum, s) => sum + s.messageCount, 0)
    const tagCounts: Record<string, number> = {}

    data.forEach(session => {
      session.tags?.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    })

    const sortedTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }))

    const stats: UsageStatistics = {
      totalSessions: data.length,
      totalMessages,
      averageMessagesPerSession: totalMessages / data.length,
      storageUsedBytes: JSON.stringify(data).length * 2,
      oldestSessionDate: data.length > 0 ? new Date(data[data.length - 1].createdAt) : null,
      newestSessionDate: data.length > 0 ? new Date(data[0].createdAt) : null,
      sessionsLastWeek: data.filter(s => s.createdAt >= oneWeekAgo).length,
      sessionsLastMonth: data.filter(s => s.createdAt >= oneMonthAgo).length,
      topTags: sortedTags,
    }

    setStatistics(stats)
    logger.info('[useChatHistory] 📊 统计信息已更新:', stats)
  }, [sessions])

  const refreshStatistics = useCallback(() => {
    calculateStatistics()
  }, [calculateStatistics])

  const getSessionById = useCallback((id: string): HistorySession | null => {
    return sessions.find(s => s.id === id) || null
  }, [sessions])

  const getRecentSessions = useCallback((count = 5): HistorySession[] => {
    return sessions.slice(0, count)
  }, [sessions])

  const getSessionsByTag = useCallback((tag: string): HistorySession[] => {
    return sessions.filter(s => s.tags?.includes(tag))
  }, [sessions])

  const handleQuotaExceeded = useCallback(() => {
    logger.warn('[useChatHistory] ⚠️ 存储配额溢出，执行清理策略')

    const sortedByAge = [...sessions].sort((a, b) => a.updatedAt - b.updatedAt)
    const toDelete = sortedByAge.slice(0, Math.max(5, Math.floor(sessions.length * 0.1)))

    if (toDelete.length > 0) {
      const remaining = sessions.filter(s => !toDelete.find(d => d.id === s.id))
      storageService.set(storageKey, remaining)
      setSessions(remaining)

      logger.info(`[useChatHistory] 🧹 已清理 ${toDelete.length} 个旧会话以释放空间`)
      eventBus.emit('history:cleanup' as any, { deletedCount: toDelete.length, reason: 'quota_exceeded' })
    }
  }, [sessions, storageKey])

  const currentSession = useMemo(() => {
    if (!currentSessionId) return null
    return sessions.find(s => s.id === currentSessionId) || null
  }, [sessions, currentSessionId])

  return {
    sessions,
    currentSession,
    isLoading,
    isSaving,
    isExporting,
    searchQuery,
    filters,
    pagination,
    statistics,

    loadHistory,
    saveSession,
    deleteSession,
    clearHistory,
    switchSession,
    createNewSession,

    setSearchQuery,
    setFilters,
    clearFilters: () => setFilters({}),
    getFilteredSessions,

    goToPage,
    nextPage,
    prevPage,
    setPageSize,
    getPagedSessions,

    exportHistory,
    exportSession,
    exportSelected,

    batchDelete,
    batchArchive,
    batchTag,

    refreshStatistics,
    getSessionById,
    getRecentSessions,
    getSessionsByTag,
  }
}

export default useChatHistory

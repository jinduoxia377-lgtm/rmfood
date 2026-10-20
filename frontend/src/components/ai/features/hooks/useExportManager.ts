/**
 * useExportManager - 导出管理器 Hook (v7.0)
 *
 * 职责：管理聊天消息的导出功能，包括格式选择、
 * 进度跟踪、事件通知等。
 *
 * @version 7.0.0
 * @lastUpdated 2026-05-11
 */

import { useState, useCallback, useRef } from 'react'
import { logger } from '@/utils/safeLogger'
import type { ExportFormat } from '../services/exportService'
import { exportService } from '../services/exportService'
import type { UnsubscribeFn } from '../services/eventBus'
import { eventBus } from '../services/eventBus'
import type { ChatMessage } from '../types'
import { chatApi } from '@/api/chat'

/** 导出消息格式（内部使用，扩展自 ChatMessage 核心字段） */
export interface ExportChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isEdited?: boolean
  editedAt?: number
  originalContent?: string
  isWithdrawn?: boolean
  withdrawnAt?: number
  withdrawReason?: string
  replyTo?: string
  quoteContent?: string
  rating?: 'up' | 'down' | null
  feedback?: string
  isBookmarked?: boolean
  bookmarkNote?: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface ExportOptions {
  includeMetadata?: boolean
  exportSource?: 'local' | 'api'
}

export interface UseExportManagerReturn {
  /** 当前选中的导出格式 */
  exportFormat: ExportFormat
  /** 设置导出格式的方法 */
  setExportFormat: React.Dispatch<React.SetStateAction<ExportFormat>>
  /** 是否正在导出 */
  isExporting: boolean
  /** 导出进度 (0-100) */
  exportProgress: number
  /** 是否显示导出对话框 */
  showExportDialog: boolean
  /** 设置导出对话框显示状态的方法 */
  setShowExportDialog: React.Dispatch<React.SetStateAction<boolean>>
  /** 是否包含元数据 */
  includeMetadata: boolean
  /** 设置是否包含元数据 */
  setIncludeMetadata: React.Dispatch<React.SetStateAction<boolean>>
  /** 当前会话ID（用于API导出） */
  currentSessionId: string | null
  /** 设置当前会话ID */
  setCurrentSessionId: React.Dispatch<React.SetStateAction<string | null>>
  /** 执行导出操作的方法 */
  exportMessages: (messages: ChatMessage[], options?: ExportOptions) => Promise<void>
  /** 通过API导出当前会话 */
  exportSession: (sessionId: number, format: ExportFormat, includeMetadata?: boolean) => Promise<void>
  /** 取消正在进行的导出操作 */
  cancelExport: () => void
  /** 验证导出格式 */
  validateFormat: (format: ExportFormat) => { valid: boolean; message?: string }
  /** 订阅导出进度事件 */
  onExportProgress: (handler: (progress: { format: string; processed: number; total: number; percentage: number }) => void) => UnsubscribeFn
  /** 订阅导出完成事件 */
  onExportComplete: (handler: (result: { filePath: string; success: boolean }) => void) => UnsubscribeFn
}

/**
 * 导出管理器 Hook
 *
 * 提供完整的导出功能管理，包括：
 * - 格式选择（JSON/CSV/TXT/HTML/Markdown）
 * - 异步导出支持（大数据量优化）
 * - 实时进度追踪
 * - 事件驱动通知
 * - 取消操作支持
 *
 * @returns UseExportManagerReturn 导出管理器的状态和方法
 *
 * @example
 * ```tsx
 * const {
 *   exportFormat,
 *   setExportFormat,
 *   isExporting,
 *   exportProgress,
 *   showExportDialog,
 *   setShowExportDialog,
 *   exportMessages,
 *   cancelExport
 * } = useExportManager()
 *
 * // 触发导出
 * await exportMessages(messages)
 * ```
 */
export function useExportManager(): UseExportManagerReturn {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json')
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [exportProgress, setExportProgress] = useState<number>(0)
  const [showExportDialog, setShowExportDialog] = useState<boolean>(false)
  const [includeMetadata, setIncludeMetadata] = useState<boolean>(true)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * 将内部 ChatMessage 格式转换为 exportService 需要的格式（包含所有元数据）
   */
  const convertMessages = useCallback((messages: ChatMessage[], includeMeta: boolean): ExportChatMessage[] => {
    return messages.map(msg => {
      const base: ExportChatMessage = {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      }

      if (includeMeta) {
        return {
          ...base,
          isEdited: msg.isEdited,
          editedAt: msg.editedAt,
          originalContent: msg.originalContent,
          isWithdrawn: msg.isWithdrawn,
          withdrawnAt: msg.withdrawnAt,
          withdrawReason: msg.withdrawReason,
          replyTo: msg.replyTo,
          quoteContent: msg.quoteContent,
          rating: msg.rating,
          feedback: msg.feedback,
          isBookmarked: msg.isBookmarked,
          bookmarkNote: msg.bookmarkNote,
          tags: msg.tags,
          metadata: msg.metadata,
        }
      }

      return base
    })
  }, [])

  /**
   * 验证导出格式
   */
  const validateFormat = useCallback((format: ExportFormat): { valid: boolean; message?: string } => {
    const validFormats: ExportFormat[] = ['json', 'csv', 'txt', 'html', 'markdown']

    if (!validFormats.includes(format)) {
      return { valid: false, message: `无效的导出格式: ${format}` }
    }

    switch (format) {
      case 'json':
        return { valid: true }
      case 'csv':
        return { valid: true }
      case 'txt':
        return { valid: true }
      case 'html':
        return { valid: true }
      case 'markdown':
        return { valid: true }
      default:
        return { valid: false, message: `未知的导出格式: ${format}` }
    }
  }, [])

  /**
   * 执行导出操作
   *
   * 异步导出消息到指定格式，自动触发文件下载。
   * 支持大数据量分块处理，通过 eventBus 发布进度事件。
   *
   * @param messages - 要导出的消息数组
   * @param options - 导出选项（包含元数据、导出源）
   * @throws {Error} 当导出被取消时抛出错误
   */
  const exportMessages = useCallback(async (messages: ChatMessage[], options?: ExportOptions): Promise<void> => {
    if (!messages || messages.length === 0) {
      logger.warn('没有可导出的消息')
      return
    }

    const useMetadata = options?.includeMetadata ?? includeMetadata
    const exportSource = options?.exportSource ?? 'local'

    setIsExporting(true)
    setExportProgress(0)

    abortControllerRef.current = new AbortController()

    try {
      // 验证格式
      const validation = validateFormat(exportFormat)
      if (!validation.valid) {
        throw new Error(validation.message || '无效的导出格式')
      }

      // API导出模式
      if (exportSource === 'api' && currentSessionId) {
        logger.info(`通过API导出会话 ${currentSessionId}，格式：${exportFormat}`)

        let blob: Blob
        if (exportFormat === 'json') {
          blob = await chatApi.exportSessionJson(parseInt(currentSessionId), { include_metadata: useMetadata })
        } else if (exportFormat === 'csv') {
          blob = await chatApi.exportSessionCsv(parseInt(currentSessionId), { include_metadata: useMetadata })
        } else {
          throw new Error(`API导出不支持 ${exportFormat} 格式`)
        }

        const filename = `chat_session_${currentSessionId}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}.${exportFormat}`
        downloadBlob(blob, filename, exportFormat)

        setExportProgress(100)
        eventBus.emit('export:completed', { filePath: filename, success: true })
        logger.info(`API导出完成：${filename}`)
        return
      }

      // 本地导出模式
      const convertedMessages = convertMessages(messages, useMetadata)
      const filename = exportService.generateFilename(exportFormat)

      eventBus.emit('export:started', {
        format: exportFormat,
        itemCount: messages.length,
      })

      logger.info(`开始导出 ${messages.length} 条消息，格式：${exportFormat}，包含元数据：${useMetadata}`)

      const content = await exportService.exportAsync(
        convertedMessages,
        exportFormat,
        (progress) => {
          setExportProgress(progress.percentage)
          logger.debug(`导出进度：${progress.percentage}% (${progress.processed}/${progress.total})`)
        },
      )

      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('导出操作已取消')
      }

      downloadFile(content, filename, exportFormat)

      setExportProgress(100)

      eventBus.emit('export:completed', { filePath: filename, success: true })

      logger.info(`导出完成：${filename}`)
    } catch (error) {
      if ((error as Error).message === '导出操作已取消') {
        logger.info('用户取消了导出操作')
        setExportProgress(0)
      } else {
        logger.error('导出失败:', error)
        eventBus.emit('export:completed', {
          filePath: '',
          success: false,
        })
        throw error
      }
    } finally {
      setIsExporting(false)
      abortControllerRef.current = null
    }
  }, [exportFormat, convertMessages, includeMetadata, currentSessionId, validateFormat])

  /**
   * 通过API导出当前会话
   *
   * @param sessionId - 会话ID
   * @param format - 导出格式
   * @param includeMetadata - 是否包含元数据
   */
  const exportSession = useCallback(async (sessionId: number, format: ExportFormat, includeMeta = true): Promise<void> => {
    setIsExporting(true)
    setExportProgress(0)

    try {
      // 验证格式
      const validation = validateFormat(format)
      if (!validation.valid) {
        throw new Error(validation.message || '无效的导出格式')
      }

      logger.info(`通过API导出会话 ${sessionId}，格式：${format}，包含元数据：${includeMeta}`)

      let blob: Blob
      if (format === 'json') {
        blob = await chatApi.exportSessionJson(sessionId, { include_metadata: includeMeta })
      } else if (format === 'csv') {
        blob = await chatApi.exportSessionCsv(sessionId, { include_metadata: includeMeta })
      } else {
        throw new Error(`API导出不支持 ${format} 格式`)
      }

      const filename = `chat_session_${sessionId}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}.${format}`
      downloadBlob(blob, filename, format)

      setExportProgress(100)
      eventBus.emit('export:completed', { filePath: filename, success: true })
      logger.info(`API导出完成：${filename}`)
    } catch (error) {
      logger.error('API导出失败:', error)
      eventBus.emit('export:completed', { filePath: '', success: false })
      throw error
    } finally {
      setIsExporting(false)
    }
  }, [validateFormat])

  /**
   * 取消正在进行的导出操作
   */
  const cancelExport = useCallback((): void => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      exportService.cancelExport()
      logger.info('已请求取消导出操作')
    }
  }, [])

  /**
   * 订阅导出进度事件
   *
   * @param handler - 进度事件处理函数
   * @returns 取消订阅的函数
   */
  const onExportProgress = useCallback((
    handler: (progress: { format: string; processed: number; total: number; percentage: number }) => void,
  ): UnsubscribeFn => {
    return eventBus.subscribe('export:started', (payload: { format: string; itemCount: number }) => {
      handler({
        format: payload.format || exportFormat,
        processed: payload.itemCount || 0,
        total: payload.itemCount || 0,
        percentage: payload.itemCount ? Math.round((payload.itemCount / payload.itemCount) * 100) : 0,
      })
    })
  }, [exportFormat])

  /**
   * 订阅导出完成事件
   *
   * @param handler - 完成事件处理函数
   * @returns 取消订阅的函数
   */
  const onExportComplete = useCallback((
    handler: (result: { filePath: string; success: boolean }) => void,
  ): UnsubscribeFn => {
    return eventBus.subscribe('export:completed', (payload) => {
      handler({
        filePath: payload.filePath,
        success: payload.success,
      })
    })
  }, [])

  return {
    exportFormat,
    setExportFormat,
    isExporting,
    exportProgress,
    showExportDialog,
    setShowExportDialog,
    includeMetadata,
    setIncludeMetadata,
    currentSessionId,
    setCurrentSessionId,
    exportMessages,
    exportSession,
    cancelExport,
    validateFormat,
    onExportProgress,
    onExportComplete,
  }
}

/**
 * 触发浏览器下载文件
 *
 * @private
 * @param content - 文件内容
 * @param filename - 文件名
 * @param format - 文件格式
 */
function downloadFile(content: string, filename: string, format: ExportFormat): void {
  const mimeTypeMap: Record<ExportFormat, string> = {
    json: 'application/json',
    csv: 'text/csv',
    txt: 'text/plain',
    html: 'text/html',
    markdown: 'text/markdown',
  }

  const blob = new Blob([content], { type: mimeTypeMap[format] + ';charset=utf-8' })
  downloadBlob(blob, filename, format)
}

/**
 * 触发浏览器下载Blob文件
 *
 * @private
 * @param blob - Blob对象
 * @param filename - 文件名
 * @param format - 文件格式
 */
function downloadBlob(blob: Blob, filename: string, _format: ExportFormat): void {
  void _format;
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default useExportManager

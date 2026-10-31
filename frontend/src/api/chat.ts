/**
 * 对话管理 API 客户端
 *
 * 提供会话和消息的完整CRUD操作，支持：
 * - 会话管理（创建/读取/更新/删除/列表）
 * - 消息管理（创建/读取/删除/批量删除）
 * - 导出功能（JSON/CSV格式）
 */

import api from './client'
import { logger } from '@/utils/safeLogger'

// ===== 类型定义 =====

export interface ChatMessage {
  id: number
  session_id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  is_edited?: boolean
  edited_at?: string | null
  original_content?: string | null
  is_withdrawn?: boolean
  withdrawn_at?: string | null
  withdraw_reason?: string | null
  reply_to?: number | null
  quote_content?: string | null
  rating?: 'up' | 'down' | null
  feedback?: string | null
  is_bookmarked?: boolean
  bookmark_note?: string | null
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface ChatSession {
  id: number
  user_id: number
  /** 前端本地会话标识（session-<ts>-<rand>），无则说明是旧数据/未携带创建 */
  client_session_id?: string | null
  title: string
  message_count: number
  is_active: boolean
  tags: string[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ExportOptions {
  include_metadata?: boolean
}

// ===== API 客户端 =====

export const chatApi = {
  /** 获取会话列表 */
  getSessions: (params?: {
    page?: number
    page_size?: number
    search?: string
  }) =>
    api.get<PaginatedResponse<ChatSession>>('/chat/sessions', { params }).then(r => r.data),

  /** 获取会话详情（包含消息） */
  getSession: (sessionId: number) =>
    api.get<{ session: ChatSession; messages: ChatMessage[] }>(`/chat/sessions/${sessionId}`).then(r => r.data),

  /** 创建新会话 */
  createSession: (data: { title: string; tags?: string[] }) =>
    api.post<ChatSession>('/chat/sessions', data).then(r => r.data),

  /** 更新会话 */
  updateSession: (sessionId: number, data: { title?: string; tags?: string[] }) =>
    api.put<ChatSession>(`/chat/sessions/${sessionId}`, data).then(r => r.data),

  /** 删除会话 */
  deleteSession: (sessionId: number) =>
    api.delete<{ success: boolean; message: string }>(`/chat/sessions/${sessionId}`).then(r => r.data),

  /** 获取会话消息列表 */
  getMessages: (sessionId: number, params?: { page?: number; page_size?: number }) =>
    api.get<PaginatedResponse<ChatMessage>>(`/chat/sessions/${sessionId}/messages`, { params }).then(r => r.data),

  /** 获取单条消息 */
  getMessage: (sessionId: number, messageId: number) =>
    api.get<ChatMessage>(`/chat/sessions/${sessionId}/messages/${messageId}`).then(r => r.data),

  /** 添加消息 */
  addMessage: (sessionId: number, data: { role: string; content: string; metadata?: Record<string, unknown> }) =>
    api.post<ChatMessage>(`/chat/sessions/${sessionId}/messages`, data).then(r => r.data),

  /** 删除单条消息 */
  deleteMessage: (sessionId: number, messageId: number) =>
    api.delete<{ success: boolean; message: string }>(`/chat/sessions/${sessionId}/messages/${messageId}`).then(r => r.data),

  /** 批量删除消息 */
  batchDeleteMessages: (sessionId: number, messageIds: number[]) =>
    api.delete<{ success: boolean; message: string; deleted_count: number }>(
      `/chat/sessions/${sessionId}/messages/batch`,
      { data: { message_ids: messageIds } },
    ).then(r => r.data),

  /** 导出会话为JSON */
  exportSessionJson: (sessionId: number, options?: ExportOptions) =>
    api.get<Blob>(`/chat/sessions/${sessionId}/export/json`, {
      params: options,
      responseType: 'blob',
    }).then(r => r.data),

  /** 导出会话为CSV */
  exportSessionCsv: (sessionId: number, options?: ExportOptions) =>
    api.get<Blob>(`/chat/sessions/${sessionId}/export/csv`, {
      params: options,
      responseType: 'blob',
    }).then(r => r.data),

  /** 导出所有会话为JSON */
  exportAllJson: (options?: ExportOptions) =>
    api.get<Blob>('/chat/export/all/json', {
      params: options,
      responseType: 'blob',
    }).then(r => r.data),
}

// ===== 工具函数 =====

/**
 * 下载导出文件
 */
export async function downloadExportFile(
  blob: Blob,
  filename: string,
  _mimeType: string,
): Promise<void> {
  try {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    logger.info(`[chatApi] 导出文件下载完成: ${filename}`)
  } catch (error) {
    logger.error('[chatApi] 下载导出文件失败:', error)
    throw error
  }
}

/**
 * 导出会话为JSON格式并下载
 */
export async function exportAndDownloadSessionJson(
  sessionId: number,
  options?: ExportOptions,
): Promise<void> {
  const blob = await chatApi.exportSessionJson(sessionId, options)
  const filename = `chat_session_${sessionId}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}.json`
  await downloadExportFile(blob, filename, 'application/json')
}

/**
 * 导出会话为CSV格式并下载
 */
export async function exportAndDownloadSessionCsv(
  sessionId: number,
  options?: ExportOptions,
): Promise<void> {
  const blob = await chatApi.exportSessionCsv(sessionId, options)
  const filename = `chat_session_${sessionId}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}.csv`
  await downloadExportFile(blob, filename, 'text/csv')
}

/**
 * 导出所有会话为JSON格式并下载
 */
export async function exportAndDownloadAllSessions(options?: ExportOptions): Promise<void> {
  const blob = await chatApi.exportAllJson(options)
  const filename = `all_chats_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}.json`
  await downloadExportFile(blob, filename, 'application/json')
}

export default chatApi

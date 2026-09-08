/**
 * exportService - 聊天消息导出服务 (v7.0)
 *
 * 职责：提供多格式导出功能（JSON/CSV/TXT/HTML/Markdown），
 * 支持大数据量分块处理和异步导出。
 *
 * @version 7.0.0
 * @lastUpdated 2026-05-11
 */

import { logger } from '@/utils/safeLogger'
import type { IEventBus } from './eventBus'
import { eventBus } from './eventBus'

export type ExportFormat = 'json' | 'csv' | 'txt' | 'html' | 'markdown'

interface ExportProgress {
  format: ExportFormat
  processed: number
  total: number
  percentage: number
}

type ProgressCallback = (progress: ExportProgress) => void

const CHUNK_SIZE = 100
const LARGE_DATA_THRESHOLD = 1000

class ExportService {
  private isCancelled = false
  private eventBus: IEventBus

  constructor(eventBusInstance?: IEventBus) {
    this.eventBus = eventBusInstance || eventBus
  }

  /**
   * 将消息导出为 JSON 格式
   *
   * @param messages - 要导出的消息数组
   * @returns JSON 字符串
   */
  exportToJSON(messages: ChatMessage[]): string {
    return JSON.stringify(messages, null, 2)
  }

  /**
   * 将消息导出为 CSV 格式
   *
   * @param messages - 要导出的消息数组
   * @returns CSV 字符串
   */
  exportToCSV(messages: ChatMessage[]): string {
    const headers = ['ID', '角色', '内容', '时间戳']
    const rows = messages.map(msg => [
      msg.id,
      msg.role,
      `"${msg.content.replace(/"/g, '""')}"`,
      new Date(msg.timestamp).toLocaleString('zh-CN'),
    ])
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
  }

  /**
   * 将消息导出为纯文本格式
   *
   * @param messages - 要导出的消息数组
   * @returns TXT 字符串
   */
  exportToTXT(messages: ChatMessage[]): string {
    return messages.map((msg, index) => {
      const time = new Date(msg.timestamp).toLocaleString('zh-CN')
      const role = msg.role === 'user' ? '👤 用户' : '🤖 AI助手'
      return `[${index + 1}] ${role} (${time})\n${msg.content}\n${'─'.repeat(50)}`
    }).join('\n\n')
  }

  /**
   * 将消息导出为 HTML 格式
   *
   * @param messages - 要导出的消息数组
   * @returns HTML 字符串
   */
  exportToHTML(messages: ChatMessage[]): string {
    const htmlContent = messages.map(msg => {
      const time = new Date(msg.timestamp).toLocaleString('zh-CN')
      const bgColor = msg.role === 'user' ? '#e3f2fd' : '#f3e5f5'
      return `
        <div style="margin-bottom: 16px; padding: 12px; background-color: ${bgColor}; border-radius: 8px;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #333;">
            ${msg.role === 'user' ? '👤 用户' : '🤖 AI助手'} - ${time}
          </div>
          <div style="white-space: pre-wrap; color: #555;">${msg.content}</div>
        </div>
      `.trim()
    }).join('\n')

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>RMFOOD 智能对话记录</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
    h1 { text-align: center; color: #10B981; }
    .meta { color: #666; font-size: 14px; text-align: center; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>RMFOOD 智能对话记录</h1>
  <p class="meta">导出时间：${new Date().toLocaleString('zh-CN')} | 共 ${messages.length} 条消息</p>
  ${htmlContent}
</body>
</html>`
  }

  /**
   * 将消息导出为 Markdown 格式
   *
   * @param messages - 要导出的消息数组
   * @returns Markdown 字符串
   */
  exportToMarkdown(messages: ChatMessage[]): string {
    const mdContent = messages.map((msg, index) => {
      const time = new Date(msg.timestamp).toLocaleString('zh-CN')
      const role = msg.role === 'user' ? '👤 **用户**' : '🤖 **AI助手**'
      return `### ${index + 1}. ${role} (${time})\n\n${msg.content}\n`
    }).join('\n---\n\n')

    return `# RMFOOD 智能对话记录\n\n> 导出时间：${new Date().toLocaleString('zh-CN')} | 共 ${messages.length} 条消息\n\n---\n\n${mdContent}`
  }

  /**
   * 根据指定格式导出消息
   *
   * @param messages - 要导出的消息数组
   * @param format - 导出格式
   * @returns 格式化后的字符串内容
   */
  exportByFormat(messages: ChatMessage[], format: ExportFormat): string {
    switch (format) {
      case 'json':
        return this.exportToJSON(messages)
      case 'csv':
        return this.exportToCSV(messages)
      case 'txt':
        return this.exportToTXT(messages)
      case 'html':
        return this.exportToHTML(messages)
      case 'markdown':
        return this.exportToMarkdown(messages)
      default:
        logger.warn(`未知的导出格式: ${format}, 使用默认的 JSON 格式`)
        return this.exportToJSON(messages)
    }
  }

  /**
   * 异步导出消息（支持大数据量和进度回调）
   *
   * 使用分块处理避免阻塞 UI 线程，
   * 通过 requestIdleCallback 或 setTimeout 实现非阻塞处理。
   *
   * @param messages - 要导出的消息数组
   * @param format - 导出格式
   * @param onProgress - 进度回调函数
   * @returns Promise<string> 导出内容的字符串
   */
  async exportAsync(
    messages: ChatMessage[],
    format: ExportFormat,
    onProgress?: ProgressCallback,
  ): Promise<string> {
    this.isCancelled = false
    const total = messages.length

    if (total <= LARGE_DATA_THRESHOLD) {
      onProgress?.({
        format,
        processed: total,
        total,
        percentage: 100,
      })
      return this.exportByFormat(messages, format)
    }

    const chunks: string[] = []
    let processedCount = 0

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      if (this.isCancelled) {
        throw new Error('导出操作已取消')
      }

      const chunk = messages.slice(i, i + CHUNK_SIZE)
      const chunkResult = this.processChunk(chunk, format, i)
      chunks.push(chunkResult)

      processedCount += chunk.length
      const percentage = Math.round((processedCount / total) * 100)

      const progress: ExportProgress = {
        format,
        processed: processedCount,
        total,
        percentage,
      }

      onProgress?.(progress)

      this.eventBus.emit('export:started', {
        format,
        itemCount: processedCount,
      })

      await this.yieldToMain()
    }

    return this.assembleChunks(chunks, format, messages.length)
  }

  /**
   * 取消正在进行的导出操作
   */
  cancelExport(): void {
    this.isCancelled = true
    logger.info('导出操作已标记为取消')
  }

  /**
   * 生成标准化的导出文件名
   *
   * @param format - 导出格式
   * @param prefix - 可选的文件名前缀
   * @returns 生成的文件名字符串
   */
  generateFilename(format: ExportFormat, prefix?: string): string {
    const date = new Date().toISOString().slice(0, 10)
    const time = new Date().toISOString().slice(11, 19).replace(/:/g, '-')
    const filePrefix = prefix || 'rmfood-chat-export'
    return `${filePrefix}-${date}_${time}.${format}`
  }

  /**
   * 处理单个数据块
   *
   * @private
   */
  private processChunk(
    chunk: ChatMessage[],
    format: ExportFormat,
    startIndex: number,
  ): string {
    switch (format) {
      case 'csv': {
        const rows = chunk.map(msg => [
          msg.id,
          msg.role,
          `"${msg.content.replace(/"/g, '""')}"`,
          new Date(msg.timestamp).toLocaleString('zh-CN'),
        ])
        return rows.map(row => row.join(',')).join('\n')
      }
      case 'txt': {
        return chunk.map((msg, index) => {
          const globalIndex = startIndex + index + 1
          const time = new Date(msg.timestamp).toLocaleString('zh-CN')
          const role = msg.role === 'user' ? '👤 用户' : '🤖 AI助手'
          return `[${globalIndex}] ${role} (${time})\n${msg.content}\n${'─'.repeat(50)}`
        }).join('\n\n')
      }
      case 'html': {
        return chunk.map(msg => {
          const time = new Date(msg.timestamp).toLocaleString('zh-CN')
          const bgColor = msg.role === 'user' ? '#e3f2fd' : '#f3e5f5'
          return `
            <div style="margin-bottom: 16px; padding: 12px; background-color: ${bgColor}; border-radius: 8px;">
              <div style="font-weight: bold; margin-bottom: 8px; color: #333;">
                ${msg.role === 'user' ? '👤 用户' : '🤖 AI助手'} - ${time}
              </div>
              <div style="white-space: pre-wrap; color: #555;">${msg.content}</div>
            </div>
          `.trim()
        }).join('\n')
      }
      case 'markdown': {
        return chunk.map((msg, index) => {
          const globalIndex = startIndex + index + 1
          const time = new Date(msg.timestamp).toLocaleString('zh-CN')
          const role = msg.role === 'user' ? '👤 **用户**' : '🤖 **AI助手**'
          return `### ${globalIndex}. ${role} (${time})\n\n${msg.content}\n`
        }).join('\n---\n\n')
      }
      default:
        return JSON.stringify(chunk, null, 2)
    }
  }

  /**
   * 组装所有数据块为最终输出
   *
   * @private
   */
  private assembleChunks(
    chunks: string[],
    format: ExportFormat,
    totalCount: number,
  ): string {
    switch (format) {
      case 'json':
        return `[${chunks.join(',')}]`
      case 'csv': {
        const header = 'ID,角色,内容,时间戳'
        return [header, ...chunks].join('\n')
      }
      case 'txt':
        return chunks.join('\n\n')
      case 'html': {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>RMFOOD 智能对话记录</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
    h1 { text-align: center; color: #10B981; }
    .meta { color: #666; font-size: 14px; text-align: center; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>RMFOOD 智能对话记录</h1>
  <p class="meta">导出时间：${new Date().toLocaleString('zh-CN')} | 共 ${totalCount} 条消息</p>
  ${chunks.join('\n')}
</body>
</html>`
      }
      case 'markdown': {
        return `# RMFOOD 智能对话记录\n\n> 导出时间：${new Date().toLocaleString('zh-CN')} | 共 ${totalCount} 条消息\n\n---\n\n${chunks.join('\n---\n\n')}`
      }
      default:
        return chunks.join('')
    }
  }

  /**
   * 让出主线程控制权（用于非阻塞处理）
   *
   * @private
   */
  private yieldToMain(): Promise<void> {
    return new Promise(resolve => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => resolve())
      } else {
        setTimeout(resolve, 0)
      }
    })
  }
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export const exportService = new ExportService()
export default exportService

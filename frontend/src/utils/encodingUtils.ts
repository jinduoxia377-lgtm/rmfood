/**
 * UTF-8 BOM 编码工具函数
 * 确保 CSV 文件在 Excel 和 WPS 中正确显示中文
 * 统一管理所有编码相关的优化
 */

import { EXCEL } from '@/constants/businessRules'


import { logger } from '@/utils/safeLogger';
export const UTF8_BOM = '\uFEFF'

export function addBOM(content: string): string {
  return UTF8_BOM + content
}

export function removeBOM(content: string): string {
  return content.startsWith(UTF8_BOM) ? content.slice(1) : content
}

export function hasBOM(content: string | Uint8Array): boolean {
  if (typeof content === 'string') {
    return content.startsWith(UTF8_BOM)
  }
  if (content instanceof Uint8Array && content.length >= 3) {
    return content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF
  }
  return false
}

export function validateChineseSupport(content: string): boolean {
  const chineseRegex = /[\u4e00-\u9fff]/
  return chineseRegex.test(content)
}

export function detectEncoding(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)

  if (bytes.length >= 3) {
    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return 'UTF-8-BOM'
    }
  }

  if (bytes.length >= 2) {
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return 'UTF-16LE'
    }
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return 'UTF-16BE'
    }
  }

  return 'UTF-8'
}

export function csvEscape(value: string, maxLength: number = EXCEL.MAX_CELL_LENGTH): string {
  if (value === null || value === undefined) {
    return ''
  }

  let str = String(value)

  if (str.length > maxLength) {
    str = str.slice(0, maxLength - EXCEL.TEXT_TRUNCATION_RESERVE) + EXCEL.TEXT_TRUNCATION_SUFFIX
  }

  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }

  return str
}

export function escapeCSVLine(fields: any[]): string {
  return fields
    .map(field => csvEscape(field))
    .join(',')
}

export function escapeSpecialChars(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

export function sanitizeCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return escapeSpecialChars(String(value))
}

export function createCSVRows(
  headers: string[],
  data: Record<string, any>[],
  options: {
    includeHeaders?: boolean
    maxCellLength?: number
  } = {},
): string[] {
  const { includeHeaders = true, maxCellLength = EXCEL.MAX_CELL_LENGTH } = options

  const rows: string[] = []

  if (includeHeaders) {
    rows.push(headers.join(','))
  }

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header]
      return csvEscape(sanitizeCSVValue(value), maxCellLength)
    })
    rows.push(values.join(','))
  }

  return rows
}

export function exportToCSVWithBOM(
  rows: string[],
  filename = 'export.csv',
): void {
  const content = addBOM(rows.join('\n'))
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })

  downloadBlob(blob, filename)
}

export function formatFilename(baseName: string, extension = 'csv'): string {
  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  return `${baseName}_${dateStr}_${timeStr}.${extension}`
}

export function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'text/csv': 'csv',
    'application/json': 'json',
    'text/plain': 'txt',
    'text/html': 'html',
  }
  return mimeToExt[mimeType] || 'txt'
}

export interface DownloadOptions {
  filename?: string
  timestamp?: boolean
  autoTimestamp?: boolean
}

export function downloadBlob(
  blob: Blob,
  filename: string,
  options: DownloadOptions = {},
): string {
  const { timestamp = false, autoTimestamp = true } = options

  let finalFilename = filename
  if (timestamp || autoTimestamp) {
    finalFilename = formatFilename(
      filename.replace(/\.[^/.]+$/, ''),
      filename.split('.').pop() || 'txt',
    )
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = finalFilename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()

  setTimeout(() => {
    URL.revokeObjectURL(url)
    // 在非 DOM 环境（如测试 teardown 后/worker）下安全跳过 DOM 清理
    if (typeof document !== 'undefined') {
      document.body.removeChild(link)
    }
  }, 100)

  return finalFilename
}

export function downloadContent(
  content: string,
  filename: string,
  mimeType = 'text/plain',
  options: DownloadOptions & { addBOM?: boolean } = {},
): string {
  let finalContent = content

  if (options.addBOM || mimeType.includes('csv')) {
    finalContent = addBOM(content)
  }

  const blob = new Blob([finalContent], { type: `${mimeType};charset=utf-8` })
  return downloadBlob(blob, filename, options)
}

export function downloadArrayBuffer(
  buffer: ArrayBuffer,
  filename: string,
  mimeType = 'application/octet-stream',
): string {
  const blob = new Blob([buffer], { type: mimeType })
  return downloadBlob(blob, filename, { timestamp: true })
}

export interface ExportProgress {
  stage: 'preparing' | 'processing' | 'finalizing' | 'completed' | 'failed'
  progress: number
  message: string
  startTime: number
  estimatedTimeRemaining?: number
}

export type ProgressCallback = (progress: ExportProgress) => void

export class ExportProgressTracker {
  private startTime: number
  private stages: string[] = ['preparing', 'processing', 'finalizing', 'completed']
  private _currentStageIndex = 0
  private _progress = 0
  private callbacks = new Set<ProgressCallback>()

  constructor() {
    this.startTime = Date.now()
  }

  get currentStageIndex(): number {
    return this._currentStageIndex
  }

  get progress(): number {
    return this._progress
  }

  updateStage(stage: ExportProgress['stage'], progress: number, message?: string): void {
    this._currentStageIndex = this.stages.indexOf(stage)
    this._progress = progress

    const elapsed = Date.now() - this.startTime
    const estimatedTimeRemaining = progress > 0
      ? (elapsed / progress) * (100 - progress)
      : undefined

    const exportProgress: ExportProgress = {
      stage,
      progress,
      message: message || this.getDefaultMessage(stage),
      startTime: this.startTime,
      estimatedTimeRemaining,
    }

    this.notifyCallbacks(exportProgress)
  }

  private getDefaultMessage(stage: ExportProgress['stage']): string {
    const messages: Record<string, string> = {
      preparing: '准备导出数据...',
      processing: '正在处理数据...',
      finalizing: '正在生成文件...',
      completed: '导出完成',
      failed: '导出失败',
    }
    return messages[stage] || '处理中...'
  }

  onProgress(callback: ProgressCallback): () => void {
    this.callbacks.add(callback)
    return () => this.callbacks.delete(callback)
  }

  private notifyCallbacks(progress: ExportProgress): void {
    this.callbacks.forEach(cb => cb(progress))
  }

  complete(): void {
    this.updateStage('completed', 100, '导出完成')
  }

  fail(error: string): void {
    this.updateStage('failed', 0, `导出失败: ${error}`)
  }

  getElapsedTime(): number {
    return Date.now() - this.startTime
  }
}

export interface ExportHistoryItem {
  id: string
  filename: string
  format: string
  fileSize: number
  rowCount: number
  timestamp: Date
  duration: number
  status: 'success' | 'failed'
  error?: string
}

export class ExportHistoryManager {
  private history: ExportHistoryItem[] = []
  private maxHistory = 50
  private storageKey = 'rmfood_export_history'

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        this.history = data.history || []
        this.maxHistory = data.maxHistory || 50
      }
    } catch (e) {
      logger.warn('[ExportHistory] Failed to load history from storage:', e)
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        history: this.history,
        maxHistory: this.maxHistory,
      }))
    } catch (e) {
      logger.warn('[ExportHistory] Failed to save history to storage:', e)
    }
  }

  addEntry(entry: Omit<ExportHistoryItem, 'id'>): string {
    const id = `export_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    const newEntry: ExportHistoryItem = {
      id,
      filename: entry.filename,
      format: entry.format,
      fileSize: entry.fileSize,
      rowCount: entry.rowCount,
      timestamp: new Date(),
      duration: entry.duration,
      status: entry.status,
      error: entry.error,
    }

    this.history.unshift(newEntry)

    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory)
    }

    this.saveToStorage()
    return id
  }

  updateEntry(id: string, updates: Partial<ExportHistoryItem>): void {
    const index = this.history.findIndex(item => item.id === id)
    if (index !== -1) {
      this.history[index] = { ...this.history[index], ...updates, id: this.history[index].id ?? updates.id ?? '' }
      this.saveToStorage()
    }
  }

  getHistory(): ExportHistoryItem[] {
    return [...this.history]
  }

  getHistoryByFormat(format: string): ExportHistoryItem[] {
    return this.history.filter(item => item.format === format)
  }

  getRecentHistory(limit = 10): ExportHistoryItem[] {
    return this.history.slice(0, limit)
  }

  clearHistory(): void {
    this.history = []
    this.saveToStorage()
  }

  removeEntry(id: string): void {
    this.history = this.history.filter(item => item.id !== id)
    this.saveToStorage()
  }

  getStatistics(): {
    totalExports: number
    successRate: number
    averageDuration: number
    totalDataSize: number
    formatDistribution: Record<string, number>
  } {
    const totalExports = this.history.length
    const successfulExports = this.history.filter(item => item.status === 'success').length
    const successRate = totalExports > 0 ? (successfulExports / totalExports) * 100 : 0

    const totalDuration = this.history.reduce((sum, item) => sum + item.duration, 0)
    const averageDuration = totalExports > 0 ? totalDuration / totalExports : 0

    const totalDataSize = this.history.reduce((sum, item) => sum + item.fileSize, 0)

    const formatDistribution: Record<string, number> = {}
    this.history.forEach(item => {
      formatDistribution[item.format] = (formatDistribution[item.format] || 0) + 1
    })

    return {
      totalExports,
      successRate,
      averageDuration,
      totalDataSize,
      formatDistribution,
    }
  }
}

export const exportHistory = new ExportHistoryManager()

import type { ColumnDef } from '@tanstack/react-table'
import { EXCEL } from '@/constants/businessRules'
import type { ProgressCallback } from './encodingUtils'

export interface ExcelCellStyle {
  fontName?: string
  fontSize?: number
  bold?: boolean
  color?: string
  bgColor?: string
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  wrapText?: boolean
  border?: boolean
}

export interface ExcelColumnOption {
  wch?: number
  width?: number
  minWidth?: number
  maxWidth?: number
}

export interface ExcelExportOptions {
  filename?: string
  sheetName?: string
  columns?: ColumnDef<any>[]
  includeHeaders?: boolean
  freezeRow?: number
  autoFilter?: boolean
  columnWidthMode?: 'auto' | 'fixed' | 'custom'
  customColumnWidths?: ExcelColumnOption[]
  headerStyle?: ExcelCellStyle
  cellStyle?: ExcelCellStyle
  alternateRowColors?: boolean
  alternateRowColor?: string
  maxCellLength?: number
  onProgress?: ProgressCallback
}

export interface ChunkProcessingOptions {
  chunkSize: number
  onChunkProcessed?: (processed: number, total: number) => void
}

const DEFAULT_CHINESE_FONT = EXCEL.DEFAULT_FONT_NAME
const DEFAULT_FONT_SIZE = EXCEL.DEFAULT_FONT_SIZE
const MAX_CELL_LENGTH = EXCEL.MAX_CELL_LENGTH
const CHINESE_CHAR_WIDTH = EXCEL.CHINESE_CHAR_WIDTH
const ASCII_CHAR_WIDTH = EXCEL.ASCII_CHAR_WIDTH
const MIN_COLUMN_WIDTH = EXCEL.MIN_COLUMN_WIDTH
const MAX_COLUMN_WIDTH = EXCEL.MAX_COLUMN_WIDTH
const DEFAULT_COLUMN_WIDTH = EXCEL.DEFAULT_COLUMN_WIDTH

export function calculateStringWidth(str: string): number {
  if (!str) return 0
  let width = 0
  for (const char of str) {
    if (/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef\u3400-\u4dbf]/.test(char)) {
      width += CHINESE_CHAR_WIDTH
    } else if (/[\u0000-\u001f]/.test(char)) {
      width += 0.5
    } else {
      width += ASCII_CHAR_WIDTH
    }
  }
  return Math.ceil(width)
}

export function truncateText(text: string, maxLength: number = MAX_CELL_LENGTH): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

export function calculateColumnWidths(
  headers: string[],
  data: any[],
  options: {
    mode?: 'auto' | 'fixed' | 'custom'
    customWidths?: ExcelColumnOption[]
    minWidth?: number
    maxWidth?: number
  } = {},
): any[] {
  const { mode = 'auto', customWidths, minWidth = MIN_COLUMN_WIDTH, maxWidth = MAX_COLUMN_WIDTH } = options

  if (mode === 'fixed') {
    return headers.map(() => ({ wch: DEFAULT_COLUMN_WIDTH }))
  }

  if (mode === 'custom' && customWidths) {
    return headers.map((_, index) => {
      const custom = customWidths[index]
      if (custom) {
        return {
          wch: Math.min(Math.max(custom.wch || custom.width || DEFAULT_COLUMN_WIDTH, minWidth), maxWidth),
        }
      }
      return { wch: DEFAULT_COLUMN_WIDTH }
    })
  }

  const widths = headers.map(header => calculateStringWidth(header))

  data.forEach(row => {
    headers.forEach((header, index) => {
      const value = row[header]
      if (value !== null && value !== undefined) {
        const valueStr = String(value)
        const valueWidth = calculateStringWidth(valueStr)
        widths[index] = Math.max(widths[index] || 0, valueWidth)
      }
    })
  })

  return widths.map(w => ({
    wch: Math.min(Math.max(w + 2, minWidth), maxWidth),
  }))
}

export function getColumnHeaders(columns?: ColumnDef<any>[]): string[] {
  if (!columns) return []
  return columns.map(col => {
    if ((col as any).header) {
      return String((col as any).header)
    }
    if ((col as any).accessorKey) {
      return String((col as any).accessorKey)
    }
    return ''
  })
}

export function extractDataWithColumns(data: any[], columns?: ColumnDef<any>[]): { headers: string[], rows: any[][] } {
  const headers = getColumnHeaders(columns)

  if (!headers.length) {
    if (data.length === 0) return { headers: [], rows: [] }
    headers.push(...Object.keys(data[0]))
  }

  const rows = data.map(row =>
    headers.map(h => {
      const value = row[h]
      if (value === null || value === undefined) return ''
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    }),
  )

  return { headers, rows }
}

export function applyCellStyle(
  cell: any,
  style: ExcelCellStyle,
  isHeader = false,
): void {
  const fontName = style.fontName || (isHeader ? DEFAULT_CHINESE_FONT : DEFAULT_CHINESE_FONT)
  const fontSize = style.fontSize || DEFAULT_FONT_SIZE

  cell.s = {
    font: {
      name: fontName,
      size: fontSize * 20,
      bold: isHeader || style.bold || false,
      color: style.color || { rgb: '000000' },
    },
    alignment: {
      horizontal: style.align || 'center',
      vertical: style.verticalAlign || 'middle',
      wrapText: style.wrapText ?? true,
    },
    fill: style.bgColor ? {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { rgb: style.bgColor.replace('#', '') },
    } : undefined,
    border: style.border ? {
      top: { style: 'thin', color: { rgb: 'CCCCCC' } },
      bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
      left: { style: 'thin', color: { rgb: 'CCCCCC' } },
      right: { style: 'thin', color: { rgb: 'CCCCCC' } },
    } : undefined,
  }
}

export function sortByChinesePinyin<T>(
  array: T[],
  keyOrFn: keyof T | ((item: T) => string),
): T[] {
  return array.sort((a, b) => {
    const getValue = typeof keyOrFn === 'function'
      ? keyOrFn
      : (item: T) => String(item[keyOrFn] || '')

    const valA = getValue(a)
    const valB = getValue(b)

    return valA.localeCompare(valB, 'zh-CN', { sensitivity: 'base', numeric: true })
  })
}

export function prepareExcelCellValue(value: any, maxLength: number = MAX_CELL_LENGTH): string {
  if (value === null || value === undefined) return ''

  if (typeof value === 'object') {
    value = JSON.stringify(value)
  }

  const strValue = String(value)

  if (strValue.length > maxLength) {
    return truncateText(strValue, maxLength)
  }

  return strValue
}

export function generateTestData(rowCount = 10000): any[] {
  const testData = []
  const categories = ['主料', '辅料', '调料', '香料', '添加剂', '营养成分']
  const units = ['g', 'kg', 'ml', 'L', '勺', '茶匙', '杯', '个', '块']
  const sampleNames = [
    '蛋白质', '脂肪', '碳水化合物', '纤维素', '维生素A', '维生素C',
    '钙', '铁', '锌', '钠', '钾', '镁', '磷', '硒', '叶酸',
    '配方一', '配方二', '配方三', '测试配方', '实验样品', '对照组',
    '实验组', '标准样', '参考样', '空白样', '平行样1', '平行样2',
    '面粉', '糖', '盐', '油', '水', '牛奶', '鸡蛋', '酵母', '黄油',
    '番茄', '胡萝卜', '土豆', '洋葱', '大蒜', '生姜', '辣椒', '花椒',
  ]

  for (let i = 0; i < rowCount; i++) {
    const sampleName = sampleNames[i % sampleNames.length]
    const dosage = (Math.random() * 500 + 10).toFixed(2)
    const unit = units[i % units.length]
    const category = categories[i % categories.length]

    testData.push({
      序号: i + 1,
      样品名称: `${sampleName}_${Math.floor(i / sampleNames.length) + 1}`,
      分类: category,
      剂量: parseFloat(dosage),
      单位: unit,
      含量: (Math.random() * 100).toFixed(2),
      备注: `测试数据_${i + 1} - 中文备注信息包含特殊字符测试：，。、；：！？`,
      创建时间: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toLocaleString('zh-CN'),
      状态: i % 3 === 0 ? '已完成' : (i % 3 === 1 ? '进行中' : '待处理'),
      批次号: `BATCH${String(i + 1).padStart(6, '0')}`,
    })
  }

  return testData
}

export async function measureExportPerformance(
  exportFn: () => Promise<void>,
  dataSize: number,
): Promise<{ duration: number; dataSize: number; rowsPerSecond: number }> {
  const startTime = performance.now()
  await exportFn()
  const endTime = performance.now()
  const duration = (endTime - startTime) / 1000
  const rowsPerSecond = dataSize / duration

  return {
    duration,
    dataSize,
    rowsPerSecond,
  }
}

export function validateExcelCompatibility(): { isSupported: boolean; suggestions: string[] } {
  const suggestions: string[] = []
  let isSupported = true

  const userAgent = navigator.userAgent.toLowerCase()
  if (userAgent.includes('wps')) {
    suggestions.push('检测到 WPS Office，建议使用 .xlsx 格式以获得最佳兼容性')
    suggestions.push('WPS 对中文排版有特殊优化，但某些复杂格式可能显示不同')
  } else if (userAgent.includes('office') || userAgent.includes('microsoft')) {
    suggestions.push('检测到 Microsoft Office，功能完全兼容')
  } else {
    suggestions.push('未知办公软件，建议使用标准 .xlsx 格式')
    isSupported = false
  }

  return { isSupported, suggestions }
}

export async function processDataInChunks<T, R>(
  data: T[],
  processor: (chunk: T[]) => R | Promise<R>,
  options: ChunkProcessingOptions,
): Promise<R[]> {
  const { chunkSize, onChunkProcessed } = options
  const results: R[] = []

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize)
    const result = await processor(chunk)
    results.push(result)

    if (onChunkProcessed) {
      onChunkProcessed(i + chunk.length, data.length)
    }

    if (i + chunkSize < data.length) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  return results
}

export interface LargeDataExportOptions extends ExcelExportOptions {
  enableChunkProcessing?: boolean
  chunkSize?: number
  maxMemoryUsage?: number
}

export function estimateMemoryUsage(rowCount: number, columnCount: number): number {
  const avgCellSize = 50
  return rowCount * columnCount * avgCellSize
}

export function shouldUseChunkProcessing(
  dataLength: number,
  estimatedMemory: number,
  threshold: number = 50 * 1024 * 1024,
): boolean {
  return dataLength > 10000 || estimatedMemory > threshold
}

export function createStreamingExporter<T>(
  data: T[],
  options: {
    chunkSize?: number
    onProgress?: (processed: number, total: number) => void
  } = {},
) {
  const { chunkSize = 1000, onProgress } = options
  let currentIndex = 0
  let aborted = false

  return {
    next: (): T[] | null => {
      if (aborted || currentIndex >= data.length) {
        return null
      }

      const endIndex = Math.min(currentIndex + chunkSize, data.length)
      const chunk = data.slice(currentIndex, endIndex)
      currentIndex = endIndex

      if (onProgress) {
        onProgress(currentIndex, data.length)
      }

      return chunk
    },

    hasNext: (): boolean => {
      return currentIndex < data.length && !aborted
    },

    abort: (): void => {
      aborted = true
    },

    getProgress: (): { processed: number; total: number; percentage: number } => {
      return {
        processed: currentIndex,
        total: data.length,
        percentage: data.length > 0 ? (currentIndex / data.length) * 100 : 0,
      }
    },
  }
}

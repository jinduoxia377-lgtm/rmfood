import { logger } from '@/utils/safeLogger'
import type { ColumnDef } from '@tanstack/react-table'
import { ExportFormat, type EnhancedIngredient, type ProfessionalReport } from '@/types/ai.types'
import { exportToPDF, exportReportToPDF as pdfExportReport } from './pdfExportService'
import {
  csvEscape,
  sanitizeCSVValue,
  formatFilename,
  downloadBlob,
  downloadContent,
  addBOM,
  ExportProgressTracker,
  exportHistory,
  type ExportProgress,
  type ProgressCallback,
} from '@/utils/encodingUtils'
import {
  calculateColumnWidths,
  extractDataWithColumns,
  prepareExcelCellValue,
  sortByChinesePinyin,
  calculateStringWidth,
  generateTestData,
  measureExportPerformance,
  validateExcelCompatibility,
  processDataInChunks,
  estimateMemoryUsage,
  shouldUseChunkProcessing,
  createStreamingExporter,
  type ExcelExportOptions,
} from '@/utils/excelUtils'
import { ErrorFactory, parseError } from '@/utils/errorHandler'
import { ERROR_CODES } from '@/constants/errorCodes'

export interface ExportTask {
  id: string
  format: ExportFormat
  filename: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: Date
  completedAt?: Date
  fileSize?: number
  error?: string
  downloadUrl?: string
  progressTracker?: ExportProgressTracker
}

export interface ExportOptions {
  format: ExportFormat
  filename?: string
  columns?: ColumnDef<any>[]
  includeHeaders?: boolean
  includeTimestamp?: boolean
  encoding?: string
  delimiter?: string
  sheetName?: string
  pdfOptions?: Parameters<typeof exportToPDF>[1]
  excelOptions?: ExcelExportOptions
  onProgress?: ProgressCallback
  enableChunkProcessing?: boolean
  chunkSize?: number
}

class ExportService {
  private tasks = new Map<string, ExportTask>()
  private progressTracker: ExportProgressTracker | null = null

  async export(
    data: any[] | EnhancedIngredient[],
    options: ExportOptions,
  ): Promise<void> {
    const {
      format,
      filename = '配方明细',
      columns,
      excelOptions,
      pdfOptions,
      onProgress,
    } = options

    this.progressTracker = new ExportProgressTracker()

    if (onProgress) {
      this.progressTracker.onProgress(onProgress)
    }

    const startTime = Date.now()
    let taskId = ''

    try {
      this.progressTracker.updateStage('preparing', 5, '准备导出数据...')

      taskId = exportHistory.addEntry({
        filename: `${filename}_${formatDate()}.${format}`,
        format,
        fileSize: 0,
        rowCount: Array.isArray(data) ? data.length : 1,
        duration: 0,
        status: 'failed',
        timestamp: new Date(),
      })

      this.progressTracker.updateStage('processing', 10, '开始处理数据...')

      switch (format) {
        case ExportFormat.CSV:
          await this.exportToCSV(data, filename, columns)
          break

        case ExportFormat.EXCEL:
          await this.exportToExcel(data, filename, columns, excelOptions)
          break

        case ExportFormat.JSON:
          this.exportToJSON(data, filename)
          break

        case ExportFormat.PDF:
          await this.exportToPDF(data, filename, columns, pdfOptions)
          break

        default:
          throw ErrorFactory.export.failed(`不支持的导出格式: ${format}`)
      }

      this.progressTracker.updateStage('finalizing', 95, '正在完成导出...')
      this.progressTracker.complete()

      const duration = Date.now() - startTime
      exportHistory.updateEntry(taskId, {
        status: 'success',
        duration,
        fileSize: 0,
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      this.progressTracker?.fail(errorMessage)

      if (taskId) {
        exportHistory.updateEntry(taskId, {
          status: 'failed',
          error: errorMessage,
        })
      }

      throw error
    }
  }

  async exportToCSV(
    data: any[] | EnhancedIngredient[],
    filename: string,
    columns?: ColumnDef<any>[],
  ): Promise<void> {
    if (!data || data.length === 0) {
      throw new Error('没有可导出的数据')
    }

    this.progressTracker?.updateStage('processing', 30, '正在提取CSV数据...')

    const headers = columns
      ? columns.map((col) => {
          const h = (col as ColumnDef<any, any> & { header?: string | ((info: unknown) => unknown) }).header
          return typeof h === 'function' ? String(h({ table: {} as any, column: {} as any })) : (h as string) || (col as ColumnDef<any, any> & { accessorKey?: string }).accessorKey || ''
        })
      : Object.keys(data[0])

    const useChunkProcessing = shouldUseChunkProcessing(
      data.length,
      estimateMemoryUsage(data.length, headers.length),
    )

    if (useChunkProcessing) {
      await this.exportCSVinChunks(data, headers, filename)
    } else {
      const rows = data.map((row) =>
        headers
          .map((header) => {
            const value = row[header]
            if (value === null || value === undefined) return ''
            return sanitizeCSVValue(value)
          })
          .map((cell) => csvEscape(cell, 32767)),
      )

      const csvContent = [
        headers.map(h => csvEscape(h)).join(','),
        ...rows.map(r => r.join(',')),
      ].join('\n')

      downloadContent(csvContent, `${filename}.csv`, 'text/csv', { addBOM: true })
    }

    this.progressTracker?.updateStage('finalizing', 90, 'CSV导出完成')
  }

  private async exportCSVinChunks(
    data: any[],
    headers: string[],
    filename: string,
  ): Promise<void> {
    const chunks: string[] = []

    chunks.push(headers.map(h => csvEscape(h)).join(','))

    const chunkSize = 1000
    const totalChunks = Math.ceil(data.length / chunkSize)

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize)
      const chunkIndex = Math.floor(i / chunkSize)

      const rows = chunk.map((row) =>
        headers
          .map((header) => {
            const value = row[header]
            return csvEscape(sanitizeCSVValue(value), 32767)
          })
          .join(','),
      )

      chunks.push(...rows)

      const progress = 30 + ((chunkIndex + 1) / totalChunks) * 60
      this.progressTracker?.updateStage('processing', progress,
        `正在处理CSV数据 (${Math.min(i + chunkSize, data.length)}/${data.length})...`)

      await new Promise(resolve => setTimeout(resolve, 0))
    }

    const csvContent = chunks.join('\n')
    downloadContent(csvContent, `${filename}.csv`, 'text/csv', { addBOM: true })
  }

  async exportToExcel(
    data: any[] | EnhancedIngredient[],
    filename: string,
    columns?: ColumnDef<any>[],
    options?: ExcelExportOptions,
  ): Promise<void> {
    if (!data || data.length === 0) {
      throw ErrorFactory.export.failed('没有可导出的数据')
    }

    this.progressTracker?.updateStage('processing', 30, '正在提取Excel数据...')

    const ExcelJS = await import('exceljs')

    const { headers, rows } = extractDataWithColumns(data, columns)

    this.progressTracker?.updateStage('processing', 50, '正在处理单元格数据...')

    const processedRows = rows.map(row =>
      row.map(cell => prepareExcelCellValue(cell)),
    )

    this.progressTracker?.updateStage('processing', 70, '正在生成Excel工作表...')

    const workbook = new ExcelJS.default.Workbook()
    workbook.creator = 'RMFOOD'
    workbook.created = new Date()
    const worksheet = workbook.addWorksheet(options?.sheetName || '配方明细')

    // 添加表头
    worksheet.addRow(headers)
    // 添加数据行
    processedRows.forEach(row => worksheet.addRow(row))

    // 设置列宽
    const columnWidths = calculateColumnWidths(headers, data, {
      mode: options?.columnWidthMode || 'auto',
      customWidths: options?.customColumnWidths,
    })
    if (columnWidths && columnWidths.length > 0) {
      worksheet.columns = columnWidths.map((w: any) => ({ width: (w).wch || 15 }))
    }

    // 冻结首行
    if (options?.freezeRow !== undefined && options.freezeRow >= 0) {
      worksheet.views = [{ state: 'frozen', ySplit: options.freezeRow }]
    } else {
      worksheet.views = [{ state: 'frozen', ySplit: 1 }]
    }

    // 自动筛选
    if (options?.autoFilter !== false) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: processedRows.length + 1, column: headers.length },
      }
    }

    this.progressTracker?.updateStage('processing', 85, '正在生成Excel文件...')

    const excelBuffer = await workbook.xlsx.writeBuffer()

    const blob = new Blob(
      [excelBuffer],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    )

    downloadBlob(blob, `${filename}.xlsx`, { timestamp: true })

    this.progressTracker?.updateStage('finalizing', 95, 'Excel导出完成')
    logger.log(`[ExportService] Excel export completed: ${data.length} rows, ${headers.length} columns`)
  }

  private async exportToPDF(
    data: any[] | EnhancedIngredient[],
    filename: string,
    columns?: ColumnDef<any>[],
    pdfOptions?: any,
  ): Promise<void> {
    this.progressTracker?.updateStage('processing', 50, '正在生成PDF文档...')
    await exportToPDF(data, { ...pdfOptions, filename }, columns)
    this.progressTracker?.updateStage('finalizing', 95, 'PDF导出完成')
  }

  exportToJSON(
    data: any[] | EnhancedIngredient,
    filename: string,
  ): void {
    const dataArray = Array.isArray(data) ? data : [data]

    if (!dataArray || dataArray.length === 0) {
      throw new Error('没有可导出的数据')
    }

    const jsonContent = JSON.stringify(dataArray, null, 2)
    downloadContent(jsonContent, `${filename}.json`, 'application/json')

    this.progressTracker?.updateStage('finalizing', 95, 'JSON导出完成')
  }

  async exportWithStyles(
    data: any[],
    filename: string,
    options: {
      sheetName?: string
      headers?: string[]
      headerStyle?: {
        fontName?: string
        fontSize?: number
        bold?: boolean
        color?: string
        bgColor?: string
      }
      cellStyle?: {
        fontName?: string
        fontSize?: number
      }
      alternateRowColors?: boolean
      alternateRowColor?: string
    } = {},
  ): Promise<void> {
    if (!data || data.length === 0) {
      throw ErrorFactory.export.failed('没有可导出的数据')
    }

    try {
      this.progressTracker?.updateStage('processing', 30, '正在创建Excel工作簿...')

      const ExcelJS = await import('exceljs')

      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'RMFOOD'
      workbook.created = new Date()
      workbook.modified = new Date()

      const worksheet = workbook.addWorksheet(options.sheetName || '配方明细', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
      })

      const headers = options.headers || Object.keys(data[0])

      worksheet.columns = calculateColumnWidths(headers, data, {
        mode: 'auto',
      }).map((col: any) => ({ key: col.key || headers[col.index], width: col.wch }))

      this.progressTracker?.updateStage('processing', 50, '正在处理表头...')

      const headerRow = worksheet.addRow(headers)
      headerRow.eachCell((cell) => {
        cell.font = {
          name: options.headerStyle?.fontName || '微软雅黑',
          size: options.headerStyle?.fontSize || 11,
          bold: options.headerStyle?.bold ?? true,
          color: { argb: options.headerStyle?.color || 'FF000000' },
        }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: options.headerStyle?.bgColor || 'FFD9E1F2' },
        }
        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true,
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        }
      })

      this.progressTracker?.updateStage('processing', 70, '正在处理数据行...')

      data.forEach((row, index) => {
        const rowData = headers.map(h => {
          const value = row[h]
          if (value === null || value === undefined) return ''
          if (typeof value === 'object') return JSON.stringify(value)
          return prepareExcelCellValue(value)
        })

        const dataRow = worksheet.addRow(rowData)

        if (options.alternateRowColors && index % 2 === 1) {
          const bgColor = options.alternateRowColor || 'FFF2F2F2'
          dataRow.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: bgColor },
            }
          })
        }

        dataRow.eachCell((cell) => {
          cell.font = {
            name: options.cellStyle?.fontName || '微软雅黑',
            size: options.cellStyle?.fontSize || 11,
          }
          cell.alignment = {
            vertical: 'middle',
            wrapText: true,
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          }
        })
      })

      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: headers.length },
      }

      this.progressTracker?.updateStage('processing', 90, '正在生成Excel文件...')

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      downloadBlob(blob, `${filename}.xlsx`, { timestamp: true })

      this.progressTracker?.complete()
      logger.log(`[ExportService] Excel with styles exported: ${data.length} rows`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      this.progressTracker?.fail(errorMessage)
      throw new Error(`导出带样式的Excel失败: ${errorMessage}`)
    }
  }

  async exportProfessionalReport(
    reportData: ProfessionalReport,
    format: ExportFormat = ExportFormat.PDF,
    options: {
      filename?: string
      pdfOptions?: Parameters<typeof pdfExportReport>[1]
    } = {},
  ): Promise<void> {
    const { filename = 'RMFOOD_专业分析报告', pdfOptions } = options

    this.progressTracker?.updateStage('processing', 30, '正在生成专业报告...')

    switch (format) {
      case ExportFormat.PDF:
        await pdfExportReport(reportData, { ...pdfOptions, filename })
        break

      case ExportFormat.JSON:
        this.exportToJSON([reportData], filename)
        break

      default:
        throw ErrorFactory.export.failed(`不支持的报告格式: ${format}`)
    }

    this.progressTracker?.complete()
  }

  getHistory() {
    return exportHistory.getHistory()
  }

  getRecentHistory(limit?: number) {
    return exportHistory.getRecentHistory(limit)
  }

  getStatistics() {
    return exportHistory.getStatistics()
  }

  clearHistory() {
    exportHistory.clearHistory()
  }

  removeHistoryEntry(id: string) {
    exportHistory.removeEntry(id)
  }
}

function formatDate(): string {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
}



export const exportService = new ExportService()

export const { exportToCSV, exportToExcel, exportToJSON } = exportService

export {
  ExportFormat,
  exportService as default,
  sortByChinesePinyin,
  generateTestData,
  measureExportPerformance,
  validateExcelCompatibility,
  calculateColumnWidths,
  calculateStringWidth,
  processDataInChunks,
  shouldUseChunkProcessing,
  estimateMemoryUsage,
  createStreamingExporter,
}

export type { ExportProgress, ProgressCallback }

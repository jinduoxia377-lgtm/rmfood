/**
 * 导出服务优化版
 * 使用动态导入减少初始包体积
 */
import type { ExportFormat } from '@/types/ai.types'

import {
  importExcelJS,
  importJSPDF,
  importJSPDFAutoTable,
  importHtml2Canvas,
} from '@/utils/dynamicImports'
import { logger } from '@/utils/safeLogger'

interface DynamicExportOptions<T extends Record<string, unknown>> {
  format: Extract<ExportFormat, 'xlsx' | 'pdf' | 'png'>
  data: T[]
  columns?: { key: string; label: string; width?: number }[]
  filename: string
  onProgress?: (progress: number) => void
  onComplete?: () => void
  onError?: (error: Error) => void
}

/**
 * 导出为 Excel 格式 (动态加载)
 */
export async function exportToExcelDynamic<T extends Record<string, unknown>>(
  options: Omit<DynamicExportOptions<T>, 'format'> & { format: 'xlsx' },
): Promise<void> {
  try {
    options.onProgress?.(10)

    // 动态加载 ExcelJS
    const ExcelJS = await importExcelJS()
    options.onProgress?.(30)

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(options.filename || 'Sheet1')

    // 准备数据
    const columnKeys = options.columns
      ? options.columns.map(c => c.key)
      : Object.keys(options.data[0] || {})

    const columnLabels = options.columns
      ? options.columns.map(c => c.label)
      : columnKeys

    // 添加表头
    worksheet.addRow(columnLabels)
    options.onProgress?.(50)

    // 添加数据行
    options.data.forEach(item => {
      const row = columnKeys.map(key => item[key])
      worksheet.addRow(row)
    })

    // 设置列宽
    columnKeys.forEach((_, index) => {
      const column = worksheet.getColumn(index + 1)
      const columnOption = options.columns?.[index]
      column.width = columnOption?.width || 15
    })

    options.onProgress?.(80)

    // 生成并下载
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    downloadBlob(blob, `${options.filename}.xlsx`)
    options.onProgress?.(100)
    options.onComplete?.()

    logger.info(`Excel 导出完成: ${options.filename}`)
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('Excel 导出失败', error)
    options.onError?.(err)
    throw err
  }
}

/**
 * 导出为 PDF 格式 (动态加载)
 */
export async function exportToPDFDynamic<T extends Record<string, unknown>>(
  options: Omit<DynamicExportOptions<T>, 'format'> & { format: 'pdf' },
): Promise<void> {
  try {
    options.onProgress?.(10)

    // 动态加载 JSPDF 和 AutoTable
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      importJSPDF(),
      importJSPDFAutoTable(),
    ])
    options.onProgress?.(30)

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    // 准备表格数据
    const columns = options.columns
      ? options.columns.map(c => ({ header: c.label, dataKey: c.key }))
      : Object.keys(options.data[0] || {}).map(key => ({ header: key, dataKey: key }))

    const tableData = options.data.map(item => {
      const row: Record<string, unknown> = {}
      columns.forEach(col => {
        row[col.dataKey] = item[col.dataKey]
      })
      return row
    })

    options.onProgress?.(50)

    // 添加标题
    pdf.setFontSize(16)
    pdf.text(options.filename, 14.5, 15, { align: 'center' })

    // 添加表格
    autoTable(pdf, {
      startY: 25,
      head: [columns.map(c => c.header)],
      body: tableData.map(row => columns.map(c => String(row[c.dataKey] ?? ''))),
      theme: 'striped',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
    })

    options.onProgress?.(90)

    // 生成并下载
    pdf.save(`${options.filename}.pdf`)
    options.onProgress?.(100)
    options.onComplete?.()

    logger.info(`PDF 导出完成: ${options.filename}`)
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('PDF 导出失败', error)
    options.onError?.(err)
    throw err
  }
}

/**
 * 导出为 PNG 图片 (动态加载)
 */
export async function exportToPNGDynamic(
  elementId: string,
  filename = 'screenshot',
  options?: {
    scale?: number
    backgroundColor?: string
    onProgress?: (progress: number) => void
  },
): Promise<void> {
  try {
    options?.onProgress?.(10)

    // 动态加载 html2canvas
    const html2canvasModule = await importHtml2Canvas()
    options?.onProgress?.(30)

    // 获取元素
    const element = document.getElementById(elementId)
    if (!element) {
      throw new Error(`找不到元素: ${elementId}`)
    }

    options?.onProgress?.(50)

    // 截图
    const html2canvasDefault = html2canvasModule.default || html2canvasModule;
    const canvas = await html2canvasDefault(element, {
      scale: options?.scale || 2,
      backgroundColor: options?.backgroundColor || '#ffffff',
      useCORS: true,
    })

    options?.onProgress?.(80)

    // 下载
    canvas.toBlob((blob: Blob | null) => {
      if (blob) {
        downloadBlob(blob, `${filename}.png`)
        options?.onProgress?.(100)
        logger.info(`PNG 导出完成: ${filename}`)
      }
    }, 'image/png')
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('PNG 导出失败', error)
    throw err
  }
}

/**
 * 通用下载辅助函数
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

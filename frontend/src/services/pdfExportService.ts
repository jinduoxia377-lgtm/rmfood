/**
 * PDF 导出服务
 * 使用 jspdf + jspdf-autotable 实现专业级 PDF 导出功能
 */

import { logger } from '@/utils/safeLogger'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ColumnDef } from '@tanstack/react-table'
import type { EnhancedIngredient, ProfessionalReport } from '@/types/ai.types'

/** PDF 导出选项 */
export interface PdfExportOptions {
  filename?: string
  title?: string
  subtitle?: string
  author?: string
  date?: string
  watermark?: boolean
  watermarkText?: string
  orientation?: 'portrait' | 'landscape'
  fontSize?: number
  showPageNumbers?: boolean
}

/** 表格样式配置 */
interface TableStyle {
  headerBackgroundColor?: [number, number, number]
  headerTextColor?: [number, number, number]
  alternateRowColors?: [[number, number, number], [number, number, number]]
  borderColor?: [number, number, number]
  cellPadding?: number
}

const DEFAULT_OPTIONS: Required<PdfExportOptions> = {
  filename: 'RMFOOD_配方明细',
  title: 'RMFOOD 配方平台',
  subtitle: '专业配方分析报告',
  author: 'AI 智能分析系统',
  date: new Date().toLocaleDateString('zh-CN'),
  watermark: true,
  watermarkText: 'RMFOOD 配方平台',
  orientation: 'portrait',
  fontSize: 10,
  showPageNumbers: true,
}

const DEFAULT_TABLE_STYLE: TableStyle = {
  headerBackgroundColor: [41, 128, 185],
  headerTextColor: [255, 255, 255],
  alternateRowColors: [[245, 245, 245], [255, 255, 255]],
  borderColor: [200, 200, 200],
  cellPadding: 5,
}

/**
 * 导出数据为 PDF 格式（表格数据）
 */
export async function exportToPDF(
  data: any[] | EnhancedIngredient[],
  options: Partial<PdfExportOptions> = {},
  columns?: ColumnDef<any>[],
): Promise<void> {
  if (!data || data.length === 0) {
    logger.warn('[PdfExportService] No data to export')
    return
  }

  try {
    const config = { ...DEFAULT_OPTIONS, ...options }

    const doc = new jsPDF({
      orientation: config.orientation,
      unit: 'mm',
      format: 'a4',
    })

    doc.setProperties({
      title: config.title,
      subject: config.subtitle,
      author: config.author,
      creator: 'RMFOOD 配方平台',
    })

    if (config.watermark) {
      addWatermark(doc, config.watermarkText)
    }

    addTitleSection(doc, config)

    const headers = prepareTableHeaders(data[0], columns)
    const rows = prepareTableRows(data, headers)

    addStyledTable(doc, headers, rows, {
      startY: getTableStartY(doc),
      styles: DEFAULT_TABLE_STYLE,
      showPageNumbers: config.showPageNumbers,
    })

    addFooterInfo(doc, config)

    const filename = `${config.filename}_${formatDate()}.pdf`
    doc.save(filename)

    logger.log(`[PdfExportService] ✅ PDF export success: ${filename}`)

  } catch (error) {
    logger.error('[PdfExportService] ❌ PDF export failed:', error)
    throw new Error(`PDF export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * 导出专业报告为 PDF 格式
 */
export async function exportReportToPDF(
  reportData: ProfessionalReport,
  options: Partial<PdfExportOptions> = {},
): Promise<void> {
  try {
    const config = {
      ...DEFAULT_OPTIONS,
      ...options,
      filename: 'RMFOOD_专业分析报告',
      title: 'RMFOOD 专业配方分析报告',
      subtitle: `生成时间: ${new Date().toLocaleString('zh-CN')}`,
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    doc.setProperties({
      title: config.title,
      subject: config.subtitle,
      author: config.author,
      creator: 'RMFOOD 配方平台',
    })

    if (config.watermark) {
      addWatermark(doc, config.watermarkText)
    }

    let currentY = 20

    currentY = addReportHeader(doc, reportData, currentY)

    currentY = addSectionWithTitle(doc, '一、执行摘要', currentY)
    currentY = addTextBlock(doc, reportData.title || '专业分析报告', currentY)

    addFooterInfo(doc, config)

    const filename = `${config.filename}_${formatDate()}.pdf`
    doc.save(filename)

    logger.log(`[PdfExportService] ✅ Report PDF export success: ${filename}`)

  } catch (error) {
    logger.error('[PdfExportService] ❌ Report PDF export failed:', error)
    throw error
  }
}

function addWatermark(doc: jsPDF, text: string): void {
  const pageCount = doc.getNumberOfPages()

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(60)
    doc.setTextColor(230, 230, 230)

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    doc.text(text, pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45,
    })
  }
}

function addTitleSection(doc: jsPDF, config: Required<PdfExportOptions>): void {
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFontSize(24)
  doc.setTextColor(41, 128, 185)
  doc.text(config.title, pageWidth / 2, 25, { align: 'center' })

  doc.setFontSize(14)
  doc.setTextColor(100, 100, 100)
  doc.text(config.subtitle, pageWidth / 2, 33, { align: 'center' })

  doc.setFontSize(10)
  doc.setTextColor(150, 150, 150)
  doc.text(`作者: ${config.author}`, pageWidth / 2, 42, { align: 'center' })
  doc.text(`日期: ${config.date}`, pageWidth / 2, 47, { align: 'center' })

  doc.setDrawColor(41, 128, 185)
  doc.setLineWidth(0.5)
  doc.line(20, 52, pageWidth - 20, 52)
}

function getTableStartY(doc: jsPDF): number {
  return 58
}

function addStyledTable(
  doc: jsPDF,
  headers: string[],
  rows: any[][],
  options: {
    startY: number
    styles: TableStyle
    showPageNumbers?: boolean
  },
): void {
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: options.startY,
    margin: { top: 20, right: 15, bottom: 20, left: 15 },
    styles: {
      fontSize: options.styles.cellPadding || 5,
      cellPadding: options.styles.cellPadding || 5,
      lineColor: options.styles.borderColor || [200, 200, 200],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: options.styles.headerBackgroundColor || [41, 128, 185],
      textColor: options.styles.headerTextColor || [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: options.styles.alternateRowColors?.[0] || [245, 245, 245],
    },
    didDrawPage: (data) => {
      if (options.showPageNumbers) {
        const pageCount = doc.getNumberOfPages()
        const currentPage = data.pageNumber

        doc.setFontSize(9)
        doc.setTextColor(150, 150, 150)
        doc.text(
          `第 ${currentPage} / ${pageCount} 页`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' },
        )
      }
    },
  })
}

function addFooterInfo(doc: jsPDF, config: Required<PdfExportOptions>): void {
  const pageCount = doc.getNumberOfPages()

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)

    const pageHeight = doc.internal.pageSize.getHeight()
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15)

    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      '© 2025 RMFOOD 配方平台 | AI 智能分析系统 | 保密文件',
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' },
    )
  }
}

function prepareTableHeaders(firstRow: any, columns?: ColumnDef<any>[]): string[] {
  if (columns && columns.length > 0) {
    return columns.map((col) => {
      const h = (col as ColumnDef<any, any> & { header?: string | ((info: unknown) => unknown) }).header
      return typeof h === 'function' ? String(h({})) : (typeof h === 'string' ? h : (col as ColumnDef<any, any> & { accessorKey?: string }).accessorKey || '')
    }).filter(Boolean)
  }

  return Object.keys(firstRow || {})
}

function prepareTableRows(data: any[], headers: string[]): any[][] {
  return data.map(row =>
    headers.map(header => {
      const value = row[header]

      if (value === null || value === undefined) return ''
      if (typeof value === 'object') return JSON.stringify(value)
      if (typeof value === 'boolean') return value ? '是' : '否'

      return String(value)
    }),
  )
}

function formatDate(): string {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
}

function addReportHeader(doc: jsPDF, report: ProfessionalReport, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFontSize(22)
  doc.setTextColor(41, 128, 185)
  doc.text(report.title || '专业分析报告', pageWidth / 2, y, { align: 'center' })

  y += 12
  doc.setFontSize(11)
  doc.setTextColor(100, 100, 100)
  doc.text(`版本: ${report.version}`, 20, y)
  doc.text(`生成时间: ${report.generatedAt.toLocaleDateString('zh-CN')}`, pageWidth - 70, y)

  y += 8
  doc.setDrawColor(41, 128, 185)
  doc.setLineWidth(0.5)
  doc.line(20, y, pageWidth - 20, y)

  return y + 10
}

function addSectionWithTitle(doc: jsPDF, title: string, y: number): number {
  checkAndAddPage(doc, y, 30)

  doc.setFontSize(16)
  doc.setTextColor(41, 128, 185)
  doc.text(title, 20, y)

  doc.setDrawColor(41, 128, 185)
  doc.setLineWidth(0.3)
  doc.line(20, y + 2, 200, y + 2)

  return y + 12
}

function addTextBlock(doc: jsPDF, text: string, y: number): number {
  const maxWidth = doc.internal.pageSize.getWidth() - 40
  const lines = doc.splitTextToSize(text, maxWidth)

  doc.setFontSize(11)
  doc.setTextColor(60, 60, 60)

  lines.forEach((line: string) => {
    checkAndAddPage(doc, y, 15)
    doc.text(line, 20, y)
    y += 6
  })

  return y + 5
}

function checkAndAddPage(doc: jsPDF, currentY: number, requiredSpace: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginBottom = 25

  if (currentY + requiredSpace > pageHeight - marginBottom) {
    doc.addPage()
    return 20
  }

  return currentY
}

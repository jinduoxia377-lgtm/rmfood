/**
 * ReportExporter.ts - 专业报告多格式导出服务
 *
 * 支持格式：
 * - PDF（使用 jsPDF + jsPDF-AutoTable）
 * - Word（使用 docx 库）
 * - Excel（使用 ExcelJS）
 *
 * 特性：
 * - 真实的文件生成和下载
 * - 进度回调支持
 * - 完整的错误处理
 * - 深色模式适配
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import ExcelJS from 'exceljs'
import type { ProfessionalReport, ReportSection } from '@/types/ai.types'
import { ExportFormat } from '@/types/ai.types'

// ==================== Types ====================

export interface ExportOptions {
  format: ExportFormat
  report: ProfessionalReport
  onProgress?: (progress: number) => void
  onComplete?: () => void
  onError?: (error: Error) => void
}

export interface ExportResult {
  success: boolean
  filename: string
  format: ExportFormat
  size?: number
  error?: string
}

// ==================== Main Export Function ====================

/**
 * 导出专业报告为指定格式
 */
export async function exportReport(options: ExportOptions): Promise<ExportResult> {
  const { format, report, onProgress, onComplete, onError } = options

  try {
    onProgress?.(10)

    let result: ExportResult

    switch (format) {
      case ExportFormat.PDF:
        result = await exportToPDF(report, onProgress)
        break
      case ExportFormat.WORD:
        result = await exportToWord(report, onProgress)
        break
      case ExportFormat.EXCEL:
        result = await exportToExcel(report, onProgress)
        break
      default:
        throw new Error(`不支持的导出格式: ${format}`)
    }

    onProgress?.(100)
    onComplete?.()

    return result
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    onError?.(err)
    return {
      success: false,
      filename: '',
      format,
      error: err.message,
    }
  }
}

// ==================== PDF Export ====================

async function exportToPDF(
  report: ProfessionalReport,
  onProgress?: (progress: number) => void,
): Promise<ExportResult> {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let yPos = 20

  // 封面页
  onProgress?.(20)
  addCoverPage(doc, report, pageWidth, pageHeight)

  // 目录页
  doc.addPage()
  yPos = 20
  addTableOfContents(doc, report, yPos)

  // 内容章节
  onProgress?.(40)
  const sortedSections = [...report.sections].sort((a, b) => a.order - b.order)

  for (let i = 0; i < sortedSections.length; i++) {
    const section = sortedSections[i]

    if (!section || section.type === 'cover') {
      continue
    }

    doc.addPage()
    yPos = 20

    // 章节标题
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(section.title, 14, yPos)
    yPos += 15

    // 章节内容
    yPos = addSectionContent(doc, section, yPos, pageWidth, pageHeight)

    onProgress?.(40 + (50 * (i + 1)) / sortedSections.length)
  }

  // 页脚
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `第 ${i} 页 / 共 ${totalPages} 页`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' },
    )
  }

  // 保存文件
  const filename = `${report.title || 'RMFOOD报告'}_${formatDate(new Date())}.pdf`
  doc.save(filename)

  onProgress?.(100)

  return {
    success: true,
    filename,
    format: ExportFormat.PDF,
    size: doc.output('arraybuffer').byteLength,
  }
}

function addCoverPage(
  doc: jsPDF,
  report: ProfessionalReport,
  width: number,
  height: number,
): void {
  // 标题
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.text(report.title || 'RMFOOD 专业分析报告', width / 2, height / 3, { align: 'center' })

  // 分隔线
  doc.setDrawColor(59, 130, 246)
  doc.setLineWidth(0.5)
  doc.line(width / 4, height / 3 + 10, (width * 3) / 4, height / 3 + 10)

  // 元信息
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(report.metadata?.projectName || '配方研发项目', width / 2, height / 3 + 25, { align: 'center' })
  doc.text(`生成时间: ${report.generatedAt ? formatDateCN(report.generatedAt) : '-'}`, width / 2, height / 3 + 35, { align: 'center' })
  doc.text(`版本: ${report.version || '1.0.0'}`, width / 2, height / 3 + 45, { align: 'center' })

  if (report.metadata?.author) {
    doc.text(`编制: ${report.metadata.author}`, width / 2, height / 3 + 55, { align: 'center' })
  }

  // 公司信息
  doc.setFontSize(10)
  doc.setTextColor(128, 128, 128)
  doc.text('莱茵（厦门）分子生物科技有限公司', width / 2, height - 30, { align: 'center' })
}

function addTableOfContents(doc: jsPDF, report: ProfessionalReport, startY: number): void {
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('目录', 14, startY)

  const sortedSections = [...report.sections].sort((a, b) => a.order - b.order)
  let y = startY + 15

  sortedSections.forEach((section) => {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`${section.order}. ${section.title}`, 20, y)
    y += 8
  })
}

function addSectionContent(
  doc: jsPDF,
  section: ReportSection,
  startY: number,
  pageWidth: number,
  pageHeight: number,
): number {
  let y = startY

  switch (section.type) {
    case 'executive-summary':
      y = renderExecutiveSummaryPDF(doc, section, y, pageWidth)
      break
    case 'formula-details':
      y = renderFormulaDetailsPDF(doc, section, y, pageWidth, pageHeight)
      break
    case 'ingredient-analysis':
      y = renderIngredientAnalysisPDF(doc, section, y, pageWidth, pageHeight)
      break
    case 'synergy-assessment':
      y = renderSynergyAssessmentPDF(doc, section, y, pageWidth)
      break
    case 'recommendations':
      y = renderRecommendationsPDF(doc, section, y, pageWidth)
      break
    case 'appendix':
      y = renderAppendixPDF(doc, section, y, pageWidth)
      break
    default:
      doc.setFontSize(10)
      doc.text('该章节暂无内容', 14, y)
      y += 10
  }

  return y
}

function renderExecutiveSummaryPDF(
  doc: jsPDF,
  section: ReportSection,
  y: number,
  width: number,
): number {
  if (section.content?.summary) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')

    const lines = doc.splitTextToSize(String(section.content.summary), width - 28)
    doc.text(lines, 14, y)
    y += lines.length * 6 + 5
  }

  if (section.content?.keyFindings) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('关键发现:', 14, y)
    y += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    ;(section.content.keyFindings as string[]).forEach((finding: string) => {
      doc.text(`• ${finding}`, 18, y)
      y += 6
    })
  }

  return y
}

function renderFormulaDetailsPDF(
  doc: jsPDF,
  section: ReportSection,
  y: number,
  _width: number,
  _height: number,
): number {
  void _width;
  void _height;
  const formulaData = section.content?.formulaData

  if (!formulaData) {
    doc.setFontSize(10)
    doc.text('暂无配方数据', 14, y)
    return y + 10
  }

  // 配方名称
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`配方名称: ${formulaData.name || '-'}`, 14, y)
  y += 10

  // 成分表格
  if (formulaData.ingredients && formulaData.ingredients.length > 0) {
    const tableData = formulaData.ingredients.map((ing: Record<string, unknown>) => [
      ing.name || '-',
      ing.dosage || '-',
      ing.unit || '-',
      ing.efficacy || '-',
      ing.notes || '-',
    ])

    autoTable(doc, {
      startY: y,
      head: [['成分名称', '用量', '单位', '功效', '注意事项']],
      body: tableData,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  return y
}

function renderIngredientAnalysisPDF(
  doc: jsPDF,
  section: ReportSection,
  y: number,
  _width: number,
  _height: number,
): number {
  void _width;
  void _height;
  const ingredients = section.content?.ingredients

  if (!ingredients || ingredients.length === 0) {
    doc.setFontSize(10)
    doc.text('暂无成分分析数据', 14, y)
    return y + 10
  }

  const tableData = ingredients.map((ing: Record<string, unknown>) => [
    ing.name || '-',
    ing.source || '-',
    ing.category || '-',
    ing.safetyRating || '-',
    ing.bioavailability || '-',
  ])

  autoTable(doc, {
    startY: y,
    head: [['成分名称', '来源', '分类', '安全等级', '生物利用度']],
    body: tableData,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [16, 185, 129] },
  })

  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
}

function renderSynergyAssessmentPDF(
  doc: jsPDF,
  section: ReportSection,
  y: number,
  _width: number,
): number {
  void _width;
  const radarData = section.content?.radarData

  if (!radarData || radarData.length === 0) {
    doc.setFontSize(10)
    doc.text('暂无协同效果评估数据', 14, y)
    return y + 10
  }

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('协同效应分析结果:', 14, y)
  y += 8

  radarData.forEach((item: any) => {
    doc.setFontSize(10)
    doc.text(`${item.name}: ${item.value || item.score || '-'}`, 18, y)
    y += 6
  })

  return y
}

function renderRecommendationsPDF(
  doc: jsPDF,
  section: ReportSection,
  y: number,
  width: number,
): number {
  if (section.content?.recommendations) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')

    const recommendations = Array.isArray(section.content.recommendations)
      ? section.content.recommendations
      : [section.content.recommendations]

    recommendations.forEach((rec: any, index: number) => {
      doc.setFont('helvetica', 'bold')
      doc.text(`${index + 1}. ${rec.title || rec.category || '建议'}`, 14, y)
      y += 7

      doc.setFont('helvetica', 'normal')
      const content = rec.description || rec.content || String(rec)
      const lines = doc.splitTextToSize(content, width - 36)
      doc.text(lines, 18, y)
      y += lines.length * 5 + 5
    })
  }

  return y
}

function renderAppendixPDF(
  doc: jsPDF,
  section: ReportSection,
  y: number,
  _width: number,
): number {
  void _width;
  if (section.content?.references) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('参考文献:', 14, y)
    y += 8

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    ;(section.content.references as string[]).forEach((ref: string, index: number) => {
      doc.text(`[${index + 1}] ${ref}`, 18, y)
      y += 6
    })
  }

  if (section.content?.dataSources) {
    y += 5
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('数据来源:', 14, y)
    y += 8

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(String(section.content.dataSources), 18, y)
    y += 6
  }

  return y
}

// ==================== Word Export ====================

async function exportToWord(
  report: ProfessionalReport,
  onProgress?: (progress: number) => void,
): Promise<ExportResult> {
  onProgress?.(20)

  const children: any[] = []

  // 封面
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: report.title || 'RMFOOD 专业分析报告',
          bold: true,
          size: 56,
          font: 'Arial',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '', break: 1 })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: report.metadata?.projectName || '配方研发项目',
          size: 28,
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `生成时间: ${report.generatedAt ? formatDateCN(report.generatedAt) : '-'}`,
          size: 24,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
    }),
  )

  onProgress?.(40)

  // 章节
  const sortedSections = [...report.sections].sort((a, b) => a.order - b.order)

  for (let i = 0; i < sortedSections.length; i++) {
    const section = sortedSections[i]
    if (section && section.type !== 'cover') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `\n${section.order}. ${section.title}`,
              bold: true,
              size: 32,
              font: 'Arial',
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
      )

      // 添加章节内容
      addWordSectionContent(children, section)
    }

    onProgress?.(40 + (50 * (i + 1)) / sortedSections.length)
  }

  // 创建文档
  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }],
  })

  // 生成并下载
  const blob = await Packer.toBlob(doc)
  const filename = `${report.title || 'RMFOOD报告'}_${formatDate(new Date())}.docx`
  downloadBlob(blob, filename)

  onProgress?.(100)

  return {
    success: true,
    filename,
    format: ExportFormat.WORD,
    size: blob.size,
  }
}

function addWordSectionContent(children: any[], section: ReportSection): void {
  switch (section.type) {
    case 'executive-summary':
      if (section.content?.summary) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: String(section.content.summary), size: 24 })],
          }),
        )
      }
      break

    case 'formula-details':
      if (section.content?.formulaData?.ingredients) {
        section.content.formulaData.ingredients.forEach((ing: Record<string, unknown>) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `• ${ing.name}: `, bold: true }),
                new TextRun({ text: `${ing.dosage} ${ing.unit || ''}` }),
              ],
              bullet: { level: 0 },
            }),
          )
        })
      }
      break

    case 'recommendations':
      if (section.content?.recommendations) {
        const recs = Array.isArray(section.content.recommendations)
          ? section.content.recommendations
          : [section.content.recommendations]

        recs.forEach((rec: any) => {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: rec.description || rec.content || String(rec), size: 22 })],
            }),
          )
        })
      }
      break

    default:
      if (section.content && typeof section.content === 'object') {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: JSON.stringify(section.content, null, 2), size: 20, color: '888888' })],
          }),
        )
      }
  }
}

// ==================== Excel Export ====================

async function exportToExcel(
  report: ProfessionalReport,
  onProgress?: (progress: number) => void,
): Promise<ExportResult> {
  onProgress?.(20)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'RMFOOD'
  wb.created = new Date()

  // 概览表
  const wsOverview = wb.addWorksheet('概览')
  wsOverview.columns = [
    { header: '项目', key: 'field', width: 20 },
    { header: '值', key: 'value', width: 40 },
  ]
  wsOverview.addRows([
    { field: '报告标题', value: report.title },
    { field: '生成时间', value: report.generatedAt ? formatDateCN(report.generatedAt) : '-' },
    { field: '版本', value: report.version || '1.0.0' },
    { field: '项目名称', value: report.metadata?.projectName || '-' },
    { field: '编制者', value: report.metadata?.author || '-' },
  ])
  // 样式化表头
  const overviewHeader = wsOverview.getRow(1)
  overviewHeader.font = { bold: true }
  overviewHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' },
  }
  overviewHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } }

  onProgress?.(40)

  // 配方详情表
  const sortedSections = [...report.sections].sort((a, b) => a.order - b.order)
  const formulaSection = sortedSections.find(s => s.type === 'formula-details')

  if (formulaSection?.content?.formulaData?.ingredients) {
    const wsFormula = wb.addWorksheet('配方详情')
    wsFormula.columns = [
      { header: '成分名称', key: 'name', width: 20 },
      { header: '用量', key: 'dosage', width: 12 },
      { header: '单位', key: 'unit', width: 10 },
      { header: '功效', key: 'efficacy', width: 20 },
      { header: '来源', key: 'source', width: 15 },
      { header: '安全性', key: 'safety', width: 12 },
      { header: '备注', key: 'notes', width: 20 },
    ]
    wsFormula.addRows(formulaSection.content.formulaData.ingredients.map((ing: Record<string, unknown>) => ({
      name: ing.name || '-',
      dosage: ing.dosage || '-',
      unit: ing.unit || '-',
      efficacy: ing.efficacy || '-',
      source: ing.source || '-',
      safety: ing.safetyRating || '-',
      notes: ing.notes || '-',
    })))
    // 样式化表头
    const fHeader = wsFormula.getRow(1)
    fHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    fHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
  }

  onProgress?.(60)

  // 成分分析表
  const analysisSection = sortedSections.find(s => s.type === 'ingredient-analysis')

  if (analysisSection?.content?.ingredients) {
    const wsAnalysis = wb.addWorksheet('成分分析')
    wsAnalysis.columns = [
      { header: '成分名称', key: 'name', width: 20 },
      { header: '来源类型', key: 'source', width: 15 },
      { header: '分类', key: 'category', width: 15 },
      { header: '安全等级', key: 'safety', width: 12 },
      { header: '生物利用度', key: 'bio', width: 12 },
      { header: '作用机制', key: 'mechanism', width: 25 },
    ]
    wsAnalysis.addRows(analysisSection.content.ingredients.map((ing: Record<string, unknown>) => ({
      name: ing.name || '-',
      source: ing.source || '-',
      category: ing.category || '-',
      safety: ing.safetyRating || '-',
      bio: ing.bioavailability || '-',
      mechanism: ing.mechanism || '-',
    })))
    const aHeader = wsAnalysis.getRow(1)
    aHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    aHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }
  }

  onProgress?.(80)

  // 协同效应表
  const synergySection = sortedSections.find(s => s.type === 'synergy-assessment')

  if (synergySection?.content?.radarData) {
    const wsSynergy = wb.addWorksheet('协同效应')
    wsSynergy.columns = [
      { header: '指标名称', key: 'name', width: 20 },
      { header: '数值', key: 'value', width: 10 },
      { header: '评级', key: 'level', width: 10 },
      { header: '说明', key: 'description', width: 30 },
    ]
    wsSynergy.addRows(synergySection.content.radarData.map((item: any) => ({
      name: item.name || '-',
      value: item.value ?? item.score ?? '-',
      level: item.level ?? item.rating ?? '-',
      description: item.description || '-',
    })))
    const sHeader = wsSynergy.getRow(1)
    sHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } }
  }

  // 导出文件
  const filename = `${report.title || 'RMFOOD报告'}_${formatDate(new Date())}.xlsx`
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(blob, filename)

  onProgress?.(100)

  return {
    success: true,
    filename,
    format: ExportFormat.EXCEL,
    size: blob.size,
  }
}

// ==================== Utility Functions ====================

function formatDate(date: Date | undefined): string {
  if (!date) return ''
  return (date).toISOString().split('T')[0].replace(/-/g, '')
}

function formatDateCN(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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

// ==================== Export ====================

export default {
  exportReport,
  exportToPDF,
  exportToWord,
  exportToExcel,
}

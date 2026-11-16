/**
 * ReportExporter.ts - 专业报告多格式导出服务
 *
 * 支持格式：
 * - PDF（方案C：生成 HTML → 复用 pdfPrintExporter 浏览器打印，原生渲染中文）
 * - Word（使用 docx 库）
 * - Excel（使用 ExcelJS）
 *
 * 特性：
 * - 真实的文件生成和下载
 * - 进度回调支持
 * - 完整的错误处理
 * - 深色模式适配
 */

import { exportHtmlAsPdf, wrapPrintHtml } from '@/utils/pdfPrintExporter'
import { feedbackService } from '@/services/feedbackService'
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

/** 品牌色（Forest Green），封面/表头统一使用 */
const BRAND_GREEN = '#10B981'
const DARK = '#1f2937'
const GRAY = '#64748b'

/** 转义用户数据，避免破坏 HTML 结构 / 注入 */
function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function exportToPDF(
  report: ProfessionalReport,
  onProgress?: (progress: number) => void,
): Promise<ExportResult> {
  // 封面页
  onProgress?.(20)
  const projectName = report.metadata?.projectName || '配方研发项目'
  const generatedAt = report.generatedAt ? formatDateCN(report.generatedAt) : '-'
  const version = report.version || '1.0.0'

  const cover = `
    <div style="text-align:center;margin:60px 0 40px;">
      <div style="font-size:28pt;font-weight:bold;color:${DARK};">${escapeHtml(report.title || 'RMFOOD 专业分析报告')}</div>
      <div style="width:50%;height:2px;background:${BRAND_GREEN};margin:18px auto;"></div>
      <div style="font-size:12pt;color:${DARK};margin-top:14px;">${escapeHtml(projectName)}</div>
      <div style="font-size:11pt;color:${GRAY};margin-top:8px;">生成时间: ${escapeHtml(generatedAt)}</div>
      <div style="font-size:11pt;color:${GRAY};margin-top:4px;">版本: ${escapeHtml(version)}</div>
      ${report.metadata?.author ? `<div style="font-size:11pt;color:${GRAY};margin-top:4px;">编制: ${escapeHtml(report.metadata.author)}</div>` : ''}
      <div style="font-size:10pt;color:${GRAY};margin-top:60px;">莱茵（厦门）分子生物科技有限公司</div>
    </div>`

  // 目录页
  const sortedSections = [...report.sections].sort((a, b) => a.order - b.order)
  const toc = `
    <h2>目录</h2>
    ${sortedSections.map((s) => `<p style="margin:4px 0;">${s.order}. ${escapeHtml(s.title)}</p>`).join('')}`

  // 内容章节
  onProgress?.(40)
  const sectionsHtml = sortedSections
    .filter((s) => s && s.type !== 'cover')
    .map((section) => {
      const body = renderSectionHtml(section)
      return `<h2>${escapeHtml(section.title)}</h2>${body}`
    })
    .join('')

  // 页脚（@page 无法跨浏览器注入页码，改为文末落款）
  const footer = `<p style="color:${GRAY};font-size:8pt;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:8px;text-align:center;">RMFOOD 专业分析报告 · 莱茵（厦门）分子生物科技有限公司</p>`

  const contentHtml = `
    <style>
      .report-container h2 { color: ${BRAND_GREEN}; border-bottom-color: ${BRAND_GREEN}; }
      .report-container { page-break-before: always; }
      .report-container > div:first-child { page-break-before: avoid; }
    </style>
    ${cover}
    ${toc}
    ${sectionsHtml}
    ${footer}`

  const filename = `${report.title || 'RMFOOD报告'}_${formatDate(new Date())}.pdf`
  exportHtmlAsPdf(wrapPrintHtml(contentHtml, filename), {
    title: filename,
    onError: (message) => {
      feedbackService.showError('PDF 导出失败', message)
    },
  })

  onProgress?.(100)

  // 方案C 由浏览器打印产出 PDF，无法在导出时同步取到字节大小，size 留空
  return {
    success: true,
    filename,
    format: ExportFormat.PDF,
  }
}

/** 将单个章节渲染为 HTML 片段 */
function renderSectionHtml(section: ReportSection): string {
  const content = section.content || {}

  switch (section.type) {
    case 'executive-summary': {
      let html = ''
      if (content.summary) {
        html += `<p>${escapeHtml(String(content.summary))}</p>`
      }
      if (content.keyFindings) {
        html += `<h3>关键发现:</h3><ul>${(content.keyFindings as string[])
          .map((f) => `<li>${escapeHtml(f)}</li>`)
          .join('')}</ul>`
      }
      return html || emptySection()
    }
    case 'formula-details': {
      const fd = content.formulaData
      if (!fd) return emptySection('暂无配方数据')
      let html = `<p><strong>配方名称:</strong> ${escapeHtml(fd.name || '-')}</p>`
      if (fd.ingredients && fd.ingredients.length > 0) {
        html += buildTable(
          ['成分名称', '用量', '单位', '功效', '注意事项'],
          fd.ingredients.map((ing: Record<string, unknown>) => [
            ing.name, ing.dosage, ing.unit, ing.efficacy, ing.notes,
          ]),
        )
      }
      return html
    }
    case 'ingredient-analysis': {
      const ingredients = content.ingredients
      if (!ingredients || ingredients.length === 0) return emptySection('暂无成分分析数据')
      return buildTable(
        ['成分名称', '来源', '分类', '安全等级', '生物利用度'],
        ingredients.map((ing: Record<string, unknown>) => [
          ing.name, ing.source, ing.category, ing.safetyRating, ing.bioavailability,
        ]),
      )
    }
    case 'synergy-assessment': {
      const radarData = content.radarData
      if (!radarData || radarData.length === 0) return emptySection('暂无协同效果评估数据')
      return `<h3>协同效应分析结果:</h3><ul>${radarData
        .map((item: any) => `<li>${escapeHtml(item.name)}: ${escapeHtml(item.value || item.score || '-')}</li>`)
        .join('')}</ul>`
    }
    case 'recommendations': {
      if (!content.recommendations) return emptySection()
      const recs = Array.isArray(content.recommendations)
        ? content.recommendations
        : [content.recommendations]
      return recs
        .map((rec: any, index: number) => {
          const body = rec.description || rec.content || String(rec)
          return `<h3>${index + 1}. ${escapeHtml(rec.title || rec.category || '建议')}</h3><p>${escapeHtml(body)}</p>`
        })
        .join('')
    }
    case 'appendix': {
      let html = ''
      if (content.references) {
        html += `<h3>参考文献:</h3><ol>${(content.references as string[])
          .map((ref) => `<li>${escapeHtml(ref)}</li>`)
          .join('')}</ol>`
      }
      if (content.dataSources) {
        html += `<h3>数据来源:</h3><p>${escapeHtml(String(content.dataSources))}</p>`
      }
      return html || emptySection()
    }
    default:
      return emptySection('该章节暂无内容')
  }
}

function emptySection(msg = '该章节暂无内容'): string {
  return `<p style="color:${GRAY};">${escapeHtml(msg)}</p>`
}

/** 构建原生表格 HTML（中文 + 自动分页由浏览器打印处理） */
function buildTable(headers: string[], rows: unknown[][]): string {
  const thead = `<thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`
  const tbody = `<tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell == null ? '-' : String(cell))}</td>`).join('')}</tr>`)
    .join('')}</tbody>`
  return `<table>${thead}${tbody}</table>`
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

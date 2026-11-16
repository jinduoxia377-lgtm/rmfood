/**
 * PDF 导出服务
 *
 * 采用仓库既定的「方案C：生成 HTML → 浏览器打印」范式（见 src/utils/pdfPrintExporter.ts），
 * 由浏览器原生渲染中文，避免 jsPDF 内置字体（helvetica 等）缺少 CJK 字形导致的中文乱码。
 * 所有中文文案（水印 / 标题 / 章节 / 表头 / 页脚）均拼入 HTML，由浏览器打印渲染。
 */
import { logger } from '@/utils/safeLogger'
import { exportHtmlAsPdf, wrapPrintHtml } from '@/utils/pdfPrintExporter'
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

const BRAND_GREEN = '#10B981'

const DEFAULT_OPTIONS: Required<PdfExportOptions> = {
  filename: 'RMFOOD_配方明细',
  title: 'RMFOOD 配方平台',
  subtitle: '专业配方分析报告',
  author: 'AI 智能分析系统',
  date: new Date().toLocaleDateString('zh-CN'),
  watermark: true,
  watermarkText: 'RMFOOD 专业配方分析报告',
  orientation: 'portrait',
  fontSize: 10,
  showPageNumbers: true,
}

/** 转义用户数据，避免破坏 HTML 结构 / 注入 */
function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 将单元格值转为字符串（null/undefined→''，object→JSON，boolean→是/否） */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** 水印 + 页脚 的打印样式（半透明斜置水印 / 底部分隔线 + 免责声明 + 页码） */
function buildPrintCss(watermark: boolean): string {
  const watermarkCss = watermark
    ? `.print-watermark{position:fixed;top:45%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:60pt;color:rgba(0,0,0,0.06);white-space:nowrap;z-index:0;pointer-events:none;font-weight:bold;}`
    : ''
  return `<style>
    .print-watermark{${watermark ? watermarkCss : 'display:none;'}}
    h1.report-title{color:${BRAND_GREEN};font-size:24pt;text-align:center;margin-bottom:0.3em;}
    p.report-subtitle{color:#64748b;font-size:14pt;text-align:center;margin-bottom:0.3em;}
    p.report-meta{color:#94a3b8;font-size:10pt;text-align:center;}
    hr.report-divider{border:none;border-top:2px solid ${BRAND_GREEN};margin:1em 0 1.4em;}
    h2.report-section{color:${BRAND_GREEN};font-size:16pt;border-bottom:2px solid ${BRAND_GREEN};padding-bottom:0.3em;margin-top:1.2em;}
    table.report-table{width:100%;border-collapse:collapse;margin:1em 0;font-size:10pt;}
    table.report-table th{background:${BRAND_GREEN};color:#fff;font-weight:bold;text-align:center;padding:6px 10px;border:1px solid #ccc;}
    table.report-table td{padding:5px 10px;border:1px solid #ccc;}
    table.report-table tbody tr:nth-child(even){background:#f5f5f5;}
    .report-footer{margin-top:24px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;color:#94a3b8;font-size:8pt;gap:12px;}
    .report-footer .footer-copy{flex:1;text-align:left;}
    .report-footer .footer-page{flex:1;text-align:right;white-space:nowrap;}
    /* 页码：浏览器打印时由 CSS 计数器原生注入当前页（无法可靠获取总页数，故只显示当前页） */
    .page-num::before{content:counter(page);}
  </style>`
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

    const headers = prepareTableHeaders(data[0], columns)
    const rows = prepareTableRows(data, headers)

    const headCells = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
    const bodyRows = rows
      .map((row) => {
        const cells = row.map((cell) => `<td>${escapeHtml(cellToString(cell))}</td>`).join('')
        return `<tr>${cells}</tr>`
      })
      .join('')

    const contentHtml = `
      ${buildPrintCss(config.watermark)}
      ${config.watermark ? `<div class="print-watermark">${escapeHtml(config.watermarkText)}</div>` : ''}
      <h1 class="report-title">${escapeHtml(config.title)}</h1>
      <p class="report-subtitle">${escapeHtml(config.subtitle)}</p>
      <p class="report-meta">作者: ${escapeHtml(config.author)}　日期: ${escapeHtml(config.date)}</p>
      <hr class="report-divider" />
      <table class="report-table">
        <thead><tr>${headCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <div class="report-footer">
        <span class="footer-copy">© 2025 RMFOOD 配方平台 | AI 智能分析系统 | 保密文件</span>
        ${
          config.showPageNumbers
            ? '<span class="footer-page">第 <span class="page-num"></span> 页</span>'
            : ''
        }
      </div>`

    const filename = `${config.filename}_${formatDate()}.pdf`
    exportHtmlAsPdf(wrapPrintHtml(contentHtml, filename), {
      title: filename,
      onError: (message) => {
        logger.error('[PdfExportService] ❌ PDF export failed:', message)
      },
    })

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

    const contentHtml = `
      ${buildPrintCss(config.watermark)}
      ${config.watermark ? `<div class="print-watermark">${escapeHtml(config.watermarkText)}</div>` : ''}
      <h1 class="report-title">${escapeHtml(reportData.title || '专业分析报告')}</h1>
      <p class="report-meta">版本: ${escapeHtml(reportData.version)}　生成时间: ${escapeHtml(
        reportData.generatedAt.toLocaleDateString('zh-CN'),
      )}</p>
      <hr class="report-divider" />
      <h2 class="report-section">一、执行摘要</h2>
      <p>${escapeHtml(reportData.title || '专业分析报告')}</p>
      <div class="report-footer">
        <span class="footer-copy">© 2025 RMFOOD 配方平台 | AI 智能分析系统 | 保密文件</span>
        ${
          config.showPageNumbers
            ? '<span class="footer-page">第 <span class="page-num"></span> 页</span>'
            : ''
        }
      </div>`

    const filename = `${config.filename}_${formatDate()}.pdf`
    exportHtmlAsPdf(wrapPrintHtml(contentHtml, filename), {
      title: filename,
      onError: (message) => {
        logger.error('[PdfExportService] ❌ Report PDF export failed:', message)
      },
    })

    logger.log(`[PdfExportService] ✅ Report PDF export success: ${filename}`)
  } catch (error) {
    logger.error('[PdfExportService] ❌ Report PDF export failed:', error)
    throw error
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

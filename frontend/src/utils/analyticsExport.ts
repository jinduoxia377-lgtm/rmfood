import { logger } from '@/utils/safeLogger';
import { exportHtmlAsPdf, wrapPrintHtml } from '@/utils/pdfPrintExporter';

/** 转义用户数据，避免破坏 HTML 结构 / 注入 */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Data Export Utilities for Analytics Dashboard
 *
 * Supports:
 * - CSV export (comma-separated values)
 * - Excel export (using exceljs library)
 * - PDF export (方案C: 生成 HTML → 浏览器打印, 原生渲染中文)
 *
 * Features:
 * - Theme-aware styling
 * - Custom headers and formatting
 * - Date range filtering
 * - Batch export support
 */

export interface ExportOptions {
  filename?: string
  title?: string
  subtitle?: string
  includeHeaders?: boolean
  dateFormat?: string
  numberFormat?: 'locale' | 'raw'
  sheetName?: string
}

export interface ExportColumn {
  key: string
  header: string
  width?: number
  formatter?: (value: any) => string | number
}

export class AnalyticsExporter {

  static async exportToCSV(
    data: Record<string, any>[],
    columns: ExportColumn[],
    options: ExportOptions = {},
  ): Promise<void> {
    const {
      filename = `rmfood-export-${new Date().toISOString().split('T')[0]}`,
      includeHeaders = true,
      title = 'RMFOOD 数据分析报告',
      subtitle = `导出时间: ${new Date().toLocaleString('zh-CN')}`,
    } = options

    const BOM = '\uFEFF'

    let csvContent = BOM

    if (title || subtitle) {
      csvContent += `"${title}"\n`
      csvContent += `"${subtitle}"\n\n`
    }

    if (includeHeaders) {
      csvContent += columns.map(col => `"${col.header}"`).join(',') + '\n'
    }

    data.forEach(row => {
      const rowData = columns.map(col => {
        let value = row[col.key]

        if (col.formatter) {
          value = col.formatter(value)
        }

        if (value === null || value === undefined) {
          return '""'
        }

        if (typeof value === 'string') {
          value = value.replace(/"/g, '""')
          return `"${value}"`
        }

        return String(value)
      })

      csvContent += rowData.join(',') + '\n'
    })

    this.downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;')
  }

  static async exportToExcel(
    data: Record<string, any>[],
    columns: ExportColumn[],
    options: ExportOptions = {},
  ): Promise<void> {
    try {
      const ExcelJS = await import('exceljs')

      const {
        filename = `rmfood-export-${new Date().toISOString().split('T')[0]}`,
        sheetName = '数据分析',
        title = 'RMFOOD 数据分析报告',
        subtitle = `导出时间: ${new Date().toLocaleString('zh-CN')}`,
      } = options

      const workbook = new ExcelJS.default.Workbook()
      workbook.creator = 'RMFOOD'
      workbook.created = new Date()
      const worksheet = workbook.addWorksheet(sheetName)

      if (title || subtitle) {
        worksheet.addRow([title])
        worksheet.addRow([subtitle])
        worksheet.addRow([])
      }

      worksheet.addRow(columns.map(col => col.header))

      data.forEach(row => {
        const rowData = columns.map(col => {
          let value = row[col.key]

          if (col.formatter) {
            value = col.formatter(value)
          }

          return value ?? ''
        })

        worksheet.addRow(rowData)
      })

      worksheet.columns = columns.map((col) => {
        const headerLength = col.header.length;
        const dataLengths = data.map(r => String(r[col.key] || '').length);
        const maxDataLength = dataLengths.length > 0 ? Math.max(...dataLengths) : 0;
        return {
          header: col.header,
          key: col.key,
          width: col.width || Math.max(headerLength, maxDataLength) + 2,
        };
      })

      const excelBuffer = await workbook.xlsx.writeBuffer()

      this.downloadBlob(
        new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `${filename}.xlsx`,
      )

    } catch (error) {
      logger.error('Excel 导出失败:', error)
      throw new Error('Excel导出失败，请检查exceljs库是否已安装')
    }
  }

  static exportToPDF(
    data: Record<string, any>[],
    columns: ExportColumn[],
    options: ExportOptions & { themeColors?: Record<string, string> } = {},
  ): void {
    const {
      title = 'RMFOOD 数据分析报告',
      subtitle = `导出时间: ${new Date().toLocaleString('zh-CN')}`,
      themeColors = {
        primary: '#16A34A',
        textPrimary: '#1F2937',
        textSecondary: '#6B7280',
        background: '#FFFFFF',
      },
    } = options

    const tableHeaders = columns.map(col => col.header)

    const tableData = data.map(row =>
      columns.map(col => {
        let value = row[col.key]
        if (col.formatter) {
          value = col.formatter(value)
        }
        return value ?? ''
      }),
    )

    const contentHtml = `
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        .report-container { max-width: none; padding: 0; }
        table { font-size: 9pt; }
        th, td { padding: 4px 8px; word-break: break-word; }
      </style>
      <h1 style="font-size:22pt;text-align:left;border:none;color:${escapeHtml(themeColors.primary)};">${escapeHtml(title || '')}</h1>
      <p style="font-size:11pt;color:${escapeHtml(themeColors.textSecondary)};">${escapeHtml(subtitle || '')}</p>
      <div style="height:2px;background:${escapeHtml(themeColors.primary)};margin:8px 0 14px;"></div>
      <table>
        <thead><tr>${tableHeaders
          .map(
            (h) =>
              `<th style="background:${escapeHtml(themeColors.primary)};color:#fff;font-weight:bold;">${escapeHtml(h)}</th>`,
          )
          .join('')}</tr></thead>
        <tbody>${tableData
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${escapeHtml(cell == null ? '' : String(cell))}</td>`).join('')}</tr>`,
          )
          .join('')}</tbody>
      </table>
      <p style="font-size:8pt;color:${escapeHtml(themeColors.textSecondary)};margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px;">Generated by RMFOOD Analytics Platform | ${escapeHtml(new Date().toLocaleString('zh-CN'))}</p>`

    const filename = options.filename || `rmfood-export-${new Date().toISOString().split('T')[0]}`
    exportHtmlAsPdf(wrapPrintHtml(contentHtml, `${filename}.pdf`), {
      title: `${filename}.pdf`,
      onError: (message) => {
        logger.error('PDF 导出失败:', message)
      },
    })
  }

  static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType })
    this.downloadBlob(blob, filename)
  }

  private static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()

    setTimeout(() => {
      window.URL.revokeObjectURL(url)
      document.body.removeChild(link)
    }, 100)
  }

  static formatChartDataForExport(chartData: {
    labels: string[]
    datasets: { label?: string; data: number[] }[]
  }): Record<string, any>[] {
    const labels = chartData.labels || []

    return labels.map((label, index) => {
      const row: Record<string, any> = { period: label }

      ;(chartData.datasets || []).forEach(dataset => {
        row[dataset.label || 'series'] = dataset.data[index]
      })

      return row
    })
  }

  static getExportColumnsFromChart(chartData: {
    labels: string[]
    datasets: { label?: string }[]
  }): ExportColumn[] {
    const columns: ExportColumn[] = [
      { key: 'period', header: '时间/类别', width: 20 },
    ]

    ;(chartData.datasets || []).forEach(dataset => {
      columns.push({
        key: dataset.label || 'series',
        header: dataset.label || '数值',
        formatter: (val: number | null) => val !== null ? val.toLocaleString() : '-',
      })
    })

    return columns
  }
}

export default AnalyticsExporter

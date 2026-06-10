import { logger } from '@/utils/safeLogger';

/**
 * Data Export Utilities for Analytics Dashboard
 *
 * Supports:
 * - CSV export (comma-separated values)
 * - Excel export (using exceljs library)
 * - PDF export (using jsPDF + autoTable)
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

  static async exportToPDF(
    data: Record<string, any>[],
    columns: ExportColumn[],
    options: ExportOptions & { themeColors?: Record<string, string> } = {},
  ): Promise<void> {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const {
        filename = `rmfood-export-${new Date().toISOString().split('T')[0]}`,
        title = 'RMFOOD 数据分析报告',
        subtitle = `导出时间: ${new Date().toLocaleString('zh-CN')}`,
        themeColors = {
          primary: '#16A34A',
          textPrimary: '#1F2937',
          textSecondary: '#6B7280',
          background: '#FFFFFF',
        },
      } = options

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 15

      doc.setFontSize(22)
      doc.setTextColor(themeColors.primary)
      doc.text(title || '', margin, 25)

      doc.setFontSize(11)
      doc.setTextColor(themeColors.textSecondary)
      doc.text(subtitle || '', margin, 33)

      doc.setDrawColor(themeColors.primary)
      doc.setLineWidth(0.5)
      doc.line(margin, 38, pageWidth - margin, 38)

      const tableData = data.map(row =>
        columns.map(col => {
          let value = row[col.key]
          if (col.formatter) {
            value = col.formatter(value)
          }
          return value ?? ''
        }),
      )

      const tableHeaders = columns.map(col => col.header)

      autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        startY: 45,
        theme: 'grid',
        headStyles: {
          fillColor: [22, 163, 74],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 9,
          cellPadding: 4,
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        margin: { left: margin, right: margin },
      })

      doc.setFontSize(8)
      doc.setTextColor(themeColors.textSecondary)
      doc.text(
        `Generated by RMFOOD Analytics Platform | ${new Date().toLocaleString('zh-CN')}`,
        margin,
        doc.internal.pageSize.getHeight() - 10,
      )

      doc.save(`${filename}.pdf`)

    } catch (error) {
      logger.error('PDF 导出失败:', error)
      throw new Error('PDF导出失败，请确保jspdf库已安装')
    }
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

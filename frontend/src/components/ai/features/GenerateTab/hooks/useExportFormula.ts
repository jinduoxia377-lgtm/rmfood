/**
 * 配方导出功能 Hook
 *
 * @description 提供配方数据导出功能，支持 JSON、CSV 等格式
 * @version 1.0.0
 */

import { useCallback } from 'react'
import { logger } from '@/utils/safeLogger'
import { useOperationFeedback } from '@/hooks/useOperationFeedback'
import type { AICandidate } from '@/api/ai'

export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf'
  includePatentScores?: boolean
  includeDetailedInfo?: boolean
}

export function useExportFormula(generateResult: AICandidate[] | null) {
  const feedback = useOperationFeedback()

  const exportData = useCallback((options: ExportOptions) => {
    if (!generateResult || generateResult.length === 0) {
      feedback.showError('导出失败', '没有可导出的配方数据')
      return
    }

    try {
      const { format } = options

      const exportItems = generateResult.map((candidate, index) => {
        // 兼容后端字段：herb_combination 项可能含 dosage_g / dosage / dose_g 与 role
        const herbCombo = (candidate.herb_combination || [])
          .map((h: any) => {
            const dose = h.dosage_g ?? h.dosage ?? h.dose_g
            const role = h.role ? `[${h.role}]` : ''
            return `${role}${h.name}${typeof dose !== 'undefined' ? ` ${dose}g` : ''}`
          })
          .join(', ')
        const baseData = {
          序号: index + 1,
          配方名称: candidate.formula_name || candidate.name || '未知配方',
          药材组合: herbCombo,
          功效: (candidate.effects || []).join('、'),
          综合评分: candidate.overall_score ?? candidate.synergy_score ?? 0,
          协同评分: candidate.synergy_score || 0,
          口感评分: candidate.taste_score || '',
          稳定性评分: candidate.stability_score || '',
          安全性: candidate.safety_passed ? '通过' : '未通过',
          生成方式: candidate.generated_by || '遗传算法',
          创建时间: candidate.generated_at || '',
        }

        if (options.includePatentScores && candidate.patent_synergy_scores) {
          return {
            ...baseData,
            专利协同指数: candidate.patent_synergy_scores.overall_si || 0,
            加权综合分: candidate.patent_synergy_scores.weighted_score || 0,
            主导机制: candidate.patent_synergy_scores.dominant_mechanism || '',
            质量等级: candidate.patent_synergy_scores.quality_level || '',
            置信度: candidate.patent_synergy_scores.confidence || 0,
          }
        }

        return baseData
      })

      if (format === 'json') {
        exportToJSON(exportItems)
      } else if (format === 'csv') {
        exportToCSV(exportItems)
      } else if (format === 'pdf') {
        handlePDFExport(feedback)
      }

      feedback.showSuccess('导出成功', `已成功导出 ${generateResult.length} 条配方数据`)
    } catch (error) {
      logger.error('导出失败', { error, options })
      feedback.showError('导出失败', '导出过程出错')
    }
  }, [generateResult, feedback])

  const exportToJSON = (data: any[]) => {
    const dataStr = JSON.stringify(data, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8;' })
    downloadBlob(blob, `RMFOOD_配方数据_${getCurrentDate()}.json`)
  }

  const exportToCSV = (data: any[]) => {
    const headers = Object.keys(data[0] || {})
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => `"${String(row[header as keyof typeof row] || '').replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, `RMFOOD_配方数据_${getCurrentDate()}.csv`)
  }

  const handlePDFExport = async (feedback: ReturnType<typeof useOperationFeedback>) => {
    try {
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        feedback.showError('PDF 导出失败', '请允许弹出窗口以生成 PDF')
        return
      }

      const html = `
        <!DOCTYPE html>
        <html><head><title>RMFOOD 配方数据导出</title>
        <style>
          body { font-family: 'Microsoft YaHei', sans-serif; padding: 40px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
          th { background: #f5f5f5; }
          h1 { color: #333; }
        </style></head>
        <body>
          <h1>RMFOOD 配方数据导出</h1>
          <p>导出时间: ${new Date().toLocaleString('zh-CN')}</p>
          <table>
            <thead><tr>${Object.keys(feedback).map(k => `<th>${k}</th>`).join('')}</tr></thead>
            <tbody>${(generateResult as unknown as Record<string, unknown>[]).map((row: Record<string, unknown>) =>
              `<tr>${Object.values(row).map(v => `<td>${v}</td>`).join('')}</tr>`
            ).join('')}</tbody>
          </table>
        </body></html>
      `

      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()

      setTimeout(() => {
        printWindow.print()
        printWindow.close()
        feedback.showSuccess('PDF 导出成功', '请在打印对话框中选择"另存为 PDF"')
      }, 500)
    } catch (error) {
      logger.error('PDF 导出失败', { error })
      feedback.showError('PDF 导出失败', '导出过程出错')
    }
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const getCurrentDate = () => {
    return new Date().toISOString().slice(0, 10)
  }

  return {
    exportData,
    hasData: !!generateResult && generateResult.length > 0,
  }
}

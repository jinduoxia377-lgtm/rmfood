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
        const baseData = {
          序号: index + 1,
          配方名称: candidate.formula_name || 'Unknown',
          药材组合: (candidate.herb_combination || [])
            .map((h: any) => `${h.name}${h.dosage ? `(${h.dosage})` : ''}`)
            .join(', '),
          功效: (candidate.effects || []).join('、'),
          综合评分: candidate.score || 0,
          协同评分: candidate.synergy_score || 0,
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

        if (options.includeDetailedInfo) {
          return {
            ...baseData,
            肽候选: (candidate.peptide_candidates || []).map((p: any) => p.name).join(', '),
            安全性: candidate.safety_passed ? '通过' : '未通过',
            口感评分: (candidate as any).taste_score || '',
            稳定性评分: (candidate as any).stability_score || '',
            创建时间: candidate.generated_at || '',
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
      logger.error('Export failed', { error, options })
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

  const handlePDFExport = (feedback: ReturnType<typeof useOperationFeedback>) => {
    feedback.showInfo('功能开发中', 'PDF 导出功能正在开发中，请联系技术支持了解更多', 5000)
    logger.warn('PDF export feature not implemented')
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

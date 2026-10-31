import { useCallback } from 'react'
import type { AICandidate } from '@/api/ai'
import { logger } from '@/utils/safeLogger'
import { csvEscape, addBOM } from '@/utils/encodingUtils'

export type ExportFormat = 'json' | 'csv'

export interface ExportOptions {
  includeDetails?: boolean
  includeScores?: boolean
  filename?: string
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeDetails: true,
  includeScores: true,
}

export function useExportFormulas() {
  const exportToJSON = useCallback((
    formulas: AICandidate[],
    options: ExportOptions = {},
  ) => {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    const filename = opts.filename || `formulas_${Date.now()}.json`

    let data: Array<Record<string, unknown>> = formulas.map(f => ({
      id: f.id,
      name: f.name,
      formula_name: f.formula_name,
      score: f.score,
      effects: f.effects,
    }))

    if (opts.includeDetails) {
      data = formulas.map(f => ({
        ...data.find(d => d.id === f.id),
        ingredients: f.ingredients,
        herb_combination: f.herb_combination,
        generated_by: f.generated_by,
        generated_at: f.generated_at,
      }))
    }

    if (opts.includeScores) {
      data = formulas.map(f => ({
        ...data.find(d => d.id === f.id),
        synergy_score: f.synergy_score,
        taste_score: f.taste_score,
        stability_score: f.stability_score,
        overall_score: f.overall_score,
        patent_synergy_scores: f.patent_synergy_scores,
        safety_passed: f.safety_passed,
      }))
    }

    downloadFile(JSON.stringify(data, null, 2), filename, 'application/json')
    logger.info('配方已导出为JSON', { count: formulas.length, filename })
  }, [])

  const exportToCSV = useCallback((
    formulas: AICandidate[],
    options: ExportOptions = {},
  ) => {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    const filename = opts.filename || `formulas_${Date.now()}.csv`

    const headers = [
      '配方ID',
      '配方名称',
      '综合评分',
      '功效',
      '生成方式',
      '生成时间',
    ]

    if (opts.includeScores) {
      headers.push('协同评分', '口感评分', '稳定性评分', '总体评分')
    }

    if (opts.includeDetails) {
      headers.push('药材成分', '药材组合')
    }

    const rows: string[][] = formulas.map(f => {
      const row: string[] = [
        csvEscape(f.id),
        csvEscape(f.name || f.formula_name || ''),
        csvEscape(String(f.score || '')),
        csvEscape((f.effects || []).join(';')),
        csvEscape(f.generated_by || ''),
        csvEscape(f.generated_at || ''),
      ]

      if (opts.includeScores) {
        row.push(
          csvEscape(String(f.synergy_score || '')),
          csvEscape(String(f.taste_score || '')),
          csvEscape(String(f.stability_score || '')),
          csvEscape(String(f.overall_score || '')),
        )
      }

      if (opts.includeDetails) {
        const ingredients = (f.ingredients || []).map(i => `${i.name}: ${i.dosage || i.amount_mg}`).join(';')
        const herbs = (f.herb_combination || []).map(h => `${h.name || ''}(${h.role || ''})`).join(';')
        row.push(csvEscape(ingredients), csvEscape(herbs))
      }

      return row
    })

    const csvContent = [
      headers.map(h => csvEscape(h)).join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n')

    const utf8Content = addBOM(csvContent)

    downloadFile(utf8Content, filename, 'text/csv;charset=utf-8')
    logger.info('配方已导出为CSV', { count: formulas.length, filename })
  }, [])

  const exportFormulas = useCallback((
    formulas: AICandidate[],
    format: ExportFormat,
    options: ExportOptions = {},
  ) => {
    if (formulas.length === 0) {
      logger.warn('没有选中任何配方')
      return
    }

    switch (format) {
      case 'json':
        exportToJSON(formulas, options)
        break
      case 'csv':
        exportToCSV(formulas, options)
        break
      default:
        logger.error(`不支持的导出格式: ${format}`)
    }
  }, [exportToJSON, exportToCSV])

  return {
    exportFormulas,
    exportToJSON,
    exportToCSV,
  }
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default useExportFormulas

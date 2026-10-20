/**
 * useFormulaActions - 配方操作回调 Hook (v1.0)
 *
 * 职责：
 * - 提供配方展开/收起/选择/详情/报告生成的回调
 * - 批量操作（全选/删除/导出/打标）
 * - 导入/导出配方数据
 *
 * @version 1.0.0
 * @author RMFOOD Team
 */

import { useCallback } from 'react'
import { logger } from '@/utils/safeLogger'
import type { AIRecognizedFormula } from '@/types/ai.types'
import type { FormulaExportFormat } from '@/utils/formulaExporter'
import type { ImportedFormula } from './useFormulaManager'

interface UseFormulaActionsOptions {
  formulas: AIRecognizedFormula[]
  selectedIds: Set<string>
  selectedForDetail: AIRecognizedFormula | null
  expandedIds: Set<string>
  formulaCount: number
  isDetailModalOpen: boolean
  onToggleExpand: (id: string) => void
  onShowDetail: (id: string) => void
  onCloseDetail: () => void
  onGenerateReport: (formulaId?: string) => void
  onExport: (format: FormulaExportFormat | string) => Promise<boolean | void>
  onClearStorage: () => void
  onBatchExport: (ids: string[], format: 'json' | 'csv' | 'excel' | 'pdf') => void
  onBatchDelete: (ids: string[]) => void
  onBatchTag: (ids: string[], tags: string[]) => void
  onSelectAll: () => void
  onToggleSelect: (id: string, sel?: boolean) => void
  onImport: (data: ImportedFormula[]) => number | void
}

export function useFormulaActions(opts: UseFormulaActionsOptions) {
  const {
    selectedIds,
    onToggleExpand, onShowDetail,
    onGenerateReport, onExport,
    onBatchExport, onBatchDelete, onBatchTag,
    onSelectAll, onToggleSelect, onImport,
  } = opts

  // 配方展开/收起
  const handleToggleExpand = useCallback(
    (id: string) => onToggleExpand(id),
    [onToggleExpand],
  )

  // 显示配方详情
  const handleShowDetail = useCallback(
    (id: string) => {
      onShowDetail(id)
      logger.debug('[useFormulaActions] 打开配方详情:', id)
    },
    [onShowDetail],
  )

  // 生成报告
  const handleGenerateReportFromFormula = useCallback(
    (formulaId?: string) => onGenerateReport(formulaId),
    [onGenerateReport],
  )

  // 导出数据
  const handleExportData = useCallback(
    async (format: string) => {
      await onExport(format)
    },
    [onExport],
  )

  // 导入配方
  const handleImportData = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        onImport(data)
        logger.debug('[useFormulaActions] 配方导入成功')
      } catch (error) {
        logger.error('[useFormulaActions] 配方导入失败:', error)
      }
    }
    input.click()
  }, [onImport])

  // 选择/取消选择
  const handleToggleSelect = useCallback(
    (id: string) => {
      const isSelected = selectedIds.has(id)
      onToggleSelect(id, !isSelected)
    },
    [selectedIds, onToggleSelect],
  )

  // 批量操作
  const handleBatchExport = useCallback(
    (format: 'json' | 'csv' | 'excel' | 'pdf') => {
      const ids = Array.from(selectedIds)
      if (ids.length === 0) return
      onBatchExport(ids, format)
    },
    [selectedIds, onBatchExport],
  )

  const handleBatchDelete = useCallback(() => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    onBatchDelete(ids)
  }, [selectedIds, onBatchDelete])

  const handleBatchTag = useCallback(
    (tags: string[]) => {
      const ids = Array.from(selectedIds)
      if (ids.length === 0 || tags.length === 0) return
      onBatchTag(ids, tags)
    },
    [selectedIds, onBatchTag],
  )

  const handleSelectAll = useCallback(() => {
    onSelectAll()
  }, [onSelectAll])

  return {
    handleToggleExpand,
    handleShowDetail,
    handleGenerateReportFromFormula,
    handleExportData,
    handleImportData,
    handleToggleSelect,
    handleBatchExport,
    handleBatchDelete,
    handleBatchTag,
    handleSelectAll,
  }
}

export type { UseFormulaActionsOptions }

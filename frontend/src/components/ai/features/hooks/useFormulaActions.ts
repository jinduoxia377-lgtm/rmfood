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
import type { AIRecognizedFormula, FormulaQualityScore } from '@/types/ai.types'
import type { FormulaComparisonResult, FormulaVersion } from './useFormulaManager'
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
  /** v8.3 新增：仅清空内存缓存（不动本地存储） */
  onClearMemoryCache?: () => void
  onBatchExport: (ids: string[], format: 'json' | 'csv' | 'excel' | 'pdf') => void
  onBatchDelete: (ids: string[]) => void
  onBatchTag: (ids: string[], tags: string[]) => void
  onSelectAll: () => void
  onToggleSelect: (id: string, sel?: boolean) => void
  onImport: (data: ImportedFormula[]) => number | void
  /** v8.1 新增：单配方重命名 */
  onRenameFormula?: (id: string, newName: string) => void
  /** v8.1 新增：单配方删除（带确认） */
  onRemoveFormula?: (id: string) => void
  /** v8.1 新增：收藏切换 */
  onToggleFavorite?: (id: string) => void
  /** v8.1 新增：清空选中 */
  onClearSelection?: () => void
  /** v8.1 新增：获取质量评分（卡片徽章） */
  getFormulaScore?: (id: string) => FormulaQualityScore | null | undefined
  /** v8.2 新增：批量收藏 */
  onBatchFavorite?: (ids: string[], favorite: boolean) => void
  /** v8.2 新增：两两配方对比（返回对比结果用于面板展示） */
  onCompare?: (id1: string, id2: string) => FormulaComparisonResult | null
  /** v8.2 新增：设置优先级 */
  onSetPriority?: (id: string, priority: 'high' | 'medium' | 'low') => void
  /** v8.2 新增：获取版本历史 */
  onGetVersions?: (id: string) => FormulaVersion[]
  /** v8.2 新增：回滚版本 */
  onRollbackVersion?: (id: string, version: number) => boolean
}

/**
 * 归一化导入数据（v8.3）
 * 兼容两种格式：①{ version, timestamp, formulas:[] } 包装对象 ②裸数组
 * @returns 配方数组；无法识别返回 null
 */
export function normalizeImportedFormulas(parsed: unknown): ImportedFormula[] | null {
  if (Array.isArray(parsed)) return parsed as ImportedFormula[]
  if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as { formulas?: unknown }).formulas)
  ) {
    return (parsed as { formulas: ImportedFormula[] }).formulas
  }
  return null
}

export function useFormulaActions(opts: UseFormulaActionsOptions) {
  const {
    selectedIds,
    onToggleExpand, onShowDetail,
    onGenerateReport, onExport,
    onBatchExport, onBatchDelete, onBatchTag,
    onSelectAll, onToggleSelect, onImport,
    onRenameFormula, onRemoveFormula, onToggleFavorite, onClearSelection, getFormulaScore,
    onBatchFavorite, onCompare,
    onSetPriority, onGetVersions, onRollbackVersion,
    onClearMemoryCache,
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
    input.accept = '.json,application/json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const parsed: unknown = JSON.parse(text)
        // v8.3 修复：兼容包装对象与裸数组两种格式（此前导出文件无法被导回）
        const list = normalizeImportedFormulas(parsed)
        if (!list) {
          logger.error('[useFormulaActions] 配方导入失败：无法识别的文件格式')
          return
        }
        if (list.length === 0) {
          logger.warn('[useFormulaActions] 配方导入：文件中没有配方数据')
          return
        }
        const imported = onImport(list)
        logger.debug(`[useFormulaActions] 配方导入完成: ${imported} / ${list.length}`)
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

  // ===== v8.1 新增：单配方能力（重命名/删除/收藏/取消选择/评分） =====
  const handleRenameFormula = useCallback(
    (id: string, newName: string) => onRenameFormula?.(id, newName),
    [onRenameFormula],
  )

  const handleRemoveFormula = useCallback(
    (id: string) => onRemoveFormula?.(id),
    [onRemoveFormula],
  )

  const handleToggleFavorite = useCallback(
    (id: string) => onToggleFavorite?.(id),
    [onToggleFavorite],
  )

  const handleClearSelection = useCallback(() => {
    onClearSelection?.()
  }, [onClearSelection])

  // ===== v8.2 新增：批量收藏 / 配方对比 =====
  const handleBatchFavorite = useCallback(
    (ids: string[], favorite: boolean) => onBatchFavorite?.(ids, favorite),
    [onBatchFavorite],
  )

  const handleCompare = useCallback(
    (id1: string, id2: string) => onCompare?.(id1, id2) ?? null,
    [onCompare],
  )

  // ===== v8.2 新增：优先级 / 版本历史 =====
  const handleSetPriority = useCallback(
    (id: string, priority: 'high' | 'medium' | 'low') => onSetPriority?.(id, priority),
    [onSetPriority],
  )

  const handleGetVersions = useCallback(
    (id: string) => onGetVersions?.(id) ?? [],
    [onGetVersions],
  )

  const handleRollbackVersion = useCallback(
    (id: string, version: number) => onRollbackVersion?.(id, version) ?? false,
    [onRollbackVersion],
  )

  // v8.3 新增：仅清空内存缓存
  const handleClearMemoryCache = useCallback(() => {
    onClearMemoryCache?.()
  }, [onClearMemoryCache])

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
    // v8.1 新增
    handleRenameFormula,
    handleRemoveFormula,
    handleToggleFavorite,
    handleClearSelection,
    getFormulaScore,
    // v8.2 新增
    handleBatchFavorite,
    handleCompare,
    handleSetPriority,
    handleGetVersions,
    handleRollbackVersion,
    handleClearMemoryCache,
  }
}

export type { UseFormulaActionsOptions }

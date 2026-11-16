/**
 * FormulaPanel - 配方列表面板组件 (v8.0)
 *
 * 职责：展示AI识别的配方列表，提供搜索、高级筛选、排序、查看详情、操作和导入/导出等功能。
 *
 * 核心功能模块：
 * 1. 面板头部 - 专业级设计（图标+标题+统计徽章+生成报告按钮）
 * 2. 提示文本区域 - 蓝色背景的使用说明
 * 3. 智能搜索栏 - 支持中文/拼音/英文模糊搜索（200ms debounce）
 * 4. 排序控制栏 - 6种排序维度 × 2种方向
 * 5. 高级筛选器 - 多条件组合筛选（质量等级/置信度/时间范围/成分数量/标签）
 * 6. 配方列表 - 使用 FormulaCard 组件的专业卡片展示
 * 7. 批量操作栏 - 条件渲染的选中项操作区
 * 8. 分页控件 - 大数据量优化（默认每页10条）
 * 9. 工具栏 - 导入/导出多格式/清除存储
 *
 * @version 8.0.0
 * @lastUpdated 2026-05-20
 * @author RMFOOD Team (Advanced Search & Filter Enhancement)
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { AIRecognizedFormula, FormulaQualityScore, FormulaFilters, FormulaSortField, SortOrder } from '@/types/ai.types'
import type { FormulaComparisonResult, FormulaVersion } from '../hooks/useFormulaManager'
import type { FormulaSaveFailureReason } from '@/utils/formulaStorage'
import { Button } from '@/components/ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { FormulaCard } from './FormulaCard'
import { AdvancedFilter } from './AdvancedFilter'
import { MobileBottomSheet } from '@/hooks/components/MobileBottomSheet'
import { smartMatch } from '@/utils/pinyinUtils'
import '@/styles/animations.css'

import {
  FlaskConical,
  X,
  FileText,
  Loader2,
  Search,
  ArrowUpDown,
  SlidersHorizontal,
  LayoutGrid,
  MoreVertical,
  Eye,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  FileJson,
  FileSpreadsheet,
  Globe,
  Star,
  GitCompare,
  Flag,
  History,
  RotateCw,
  AlertTriangle,
} from 'lucide-react'

/** 分页配置常量 */
const ITEMS_PER_PAGE = 10

/** 上下文菜单状态接口 */
interface ContextMenuState {
  isOpen: boolean
  formulaId: string | null
  position: { x: number; y: number }
}


/**
 * 支持中文/拼音/英文混合模糊搜索
 * @param keyword - 搜索关键词
 * @param formula - 配方对象
 * @returns 是否匹配
 */
function matchFormula(keyword: string, formula: AIRecognizedFormula): boolean {
  if (!keyword.trim()) return true

  const searchText = `${formula.autoName || formula.name || ''} ${formula.efficacy || ''} ${(formula.tags || []).join(' ')}`.toLowerCase()
  const kw = keyword.toLowerCase().trim()

  if (searchText.includes(kw)) return true

  if (smartMatch(formula.autoName || formula.name || '', kw)) return true

  if (formula.efficacy && smartMatch(formula.efficacy, kw)) return true

  if (formula.tags?.some(tag => smartMatch(tag, kw))) return true

  if (formula.ingredients?.some(ing => smartMatch(ing.name || '', kw))) return true

  return false
}

/**
 * 配方列表面板的属性接口 (v8.0 增强版)
 */
interface FormulaPanelProps {
  /** 原始配方列表（未过滤） */
  formulas: AIRecognizedFormula[]
  /** 配方总数 */
  formulaCount: number
  /** 已展开的配方ID集合 */
  expandedIds: Set<string>
  /** 已选中的配方ID集合（用于批量操作） */
  selectedIds: Set<string>
  /** 当前搜索关键词 */
  searchQuery: string
  /** 搜索关键词变更回调 */
  onSearchChange?: (query: string) => void
  /** 当前筛选条件 */
  filters?: FormulaFilters
  /** 筛选条件变更回调 */
  onFiltersChange?: (filters: FormulaFilters) => void
  /** 当前排序字段 */
  sortBy?: FormulaSortField
  /** 当前排序方向 */
  sortOrder?: SortOrder
  /** 排序变更回调 */
  onSortChange?: (field: FormulaSortField, order: SortOrder) => void
  /** 切换配方展开状态 */
  onToggleExpand: (id: string) => void
  /** 切换配方选中状态 */
  onToggleSelect: (id: string) => void
  /** 查看详细数据表格 */
  onShowDetail: (id: string) => void
  /** 生成专业报告（可选指定单个配方） */
  onGenerateReport: (id?: string) => void
  /** 重命名配方 */
  onRenameFormula?: (id: string, newName: string) => void
  /** 获取配方质量评分 */
  getFormulaScore?: (id: string) => FormulaQualityScore | null | undefined
  /** 导出数据（支持多种格式） */
  onExport: (format: string) => void
  /** 从文件导入数据 */
  onImport: () => void
  /** 清除本地存储的所有配方数据 */
  onClearStorage: () => void
  /** 清空内存中的配方缓存 */
  onClearMemory: () => void
  /** v8.5：本地持久化失败原因（存在时顶部显示警告条，避免用户误以为已保存） */
  storageError?: FormulaSaveFailureReason | null
  /** v8.5：用户关闭警告条 */
  onDismissStorageError?: () => void
  /** v8.5：撤销最近一次批量删除 */
  onUndoBatchDelete?: () => void
  /** v8.5：是否存在可撤销的批量删除（true 时显示「撤销删除」按钮） */
  canUndoBatchDelete?: boolean
  /** v8.5：批量删除因超限被拒时记录被拒条数，顶部显示提示条 */
  batchLimitExceeded?: number | null
  /** v8.5：用户关闭超限提示 */
  onDismissBatchLimit?: () => void
  /** 删除配方（带动画） */
  onRemoveFormula?: (id: string) => void
  /** 收藏切换（卡片收藏按钮） */
  onToggleFavorite?: (id: string) => void
  /** 清空选中状态 */
  clearSelection?: () => void
  /** 报告生成加载状态 */
  isGeneratingReport: boolean
  /** 关闭面板事件处理 */
  onClose: () => void
  /** 批量导出 */
  onBatchExport?: (format: 'json' | 'csv' | 'excel' | 'pdf') => void
  /** 批量删除 */
  onBatchDelete?: (ids: string[]) => void
  /** 批量打标签 */
  onBatchTag?: (ids: string[], tags: string[]) => void
  /** 全选 */
  onSelectAll?: () => void
  /** v8.2 新增：批量收藏/取消收藏 */
  onBatchFavorite?: (ids: string[], favorite: boolean) => void
  /** v8.2 新增：两两配方对比（返回对比结果用于展示） */
  onCompare?: (id1: string, id2: string) => FormulaComparisonResult | null
  /** v8.2 新增：设置优先级 */
  onSetPriority?: (id: string, priority: 'high' | 'medium' | 'low') => void
  /** v8.2 新增：获取版本历史 */
  onGetVersions?: (id: string) => FormulaVersion[]
  /** v8.2 新增：回滚到指定版本 */
  onRollbackVersion?: (id: string, version: number) => boolean
}

/**
 * FormulaPanel - 配方列表面板组件 (v8.0)
 *
 * 使用 React.memo 进行性能优化，避免不必要的重新渲染。
 * 内置搜索、筛选、排序逻辑，减少父组件负担。
 */
const FormulaPanel = React.memo<FormulaPanelProps>(({
  formulas,
  formulaCount,
  expandedIds,
  selectedIds,
  searchQuery,
  onSearchChange,
  filters: externalFilters,
  onFiltersChange,
  sortBy: externalSortBy,
  sortOrder: externalSortOrder,
  onSortChange,
  onToggleExpand,
  onToggleSelect,
  onShowDetail,
  onGenerateReport,
  onRenameFormula,
  getFormulaScore,
  onExport,
  onImport,
  onClearStorage,
  onClearMemory,
  storageError,
  onDismissStorageError,
  onUndoBatchDelete,
  canUndoBatchDelete,
  batchLimitExceeded,
  onDismissBatchLimit,
  onRemoveFormula,
  onToggleFavorite,
  clearSelection,
  isGeneratingReport,
  onClose,
  onBatchExport,
  onBatchDelete,
  onBatchTag,
  onSelectAll,
  onBatchFavorite,
  onCompare,
  onSetPriority,
  onGetVersions,
  onRollbackVersion,
}) => {

  const { t, i18n } = useTranslation()
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery)
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false)
  const [localSortBy, setLocalSortBy] = useState<FormulaSortField>(externalSortBy || 'createdAt')
  const [localSortOrder, setLocalSortOrder] = useState<SortOrder>(externalSortOrder || 'desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [, setDeletingIds] = useState<Set<string>>(new Set())
  const [isTabletView, setIsTabletView] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  // 导出格式菜单：原实现是 `opacity-0 invisible group-hover:*` 的悬停展开——触屏无
  // hover，导出入口在手机上完全不可达。改为点击展开（+ 外部点击关闭）。
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const [compareResult, setCompareResult] = useState<FormulaComparisonResult | null>(null)
  // v8.5：并排对比需要两张卡片的完整信息（名称等），compareResult 只带 id
  const [comparePair, setComparePair] = useState<{ a: AIRecognizedFormula; b: AIRecognizedFormula } | null>(null)
  // v8.5：导出对比报告（.txt），把并排对比结果落成文件
  const handleExportComparison = useCallback(() => {
    if (!compareResult || !comparePair) return
    const { a, b } = comparePair
    const nameA = a.name || a.autoName || a.id
    const nameB = b.name || b.autoName || b.id
    const fmtPct = (n: number) => `${Math.round(n * 100)}%`
    const lines = [
      `${t('ai.chat.formulaPanel.compareResultTitle')}`,
      '',
      `${nameA}  vs  ${nameB}`,
      '',
      `${t('ai.chat.formulaPanel.compareSimilarity')}: ${fmtPct(compareResult.similarityScore)}`,
      `${t('ai.chat.formulaPanel.compareConfidenceDiff')}: ${fmtPct(compareResult.confidenceDiff)}`,
      '',
      `${t('ai.chat.formulaPanel.compareCommon')} (${compareResult.commonIngredients.length}):`,
      compareResult.commonIngredients.join(', ') || t('ai.chat.formulaPanel.compareNone'),
      '',
      `${t('ai.chat.formulaPanel.compareOnlyIn1')} (${nameA}) (${compareResult.uniqueToFormula1.length}):`,
      compareResult.uniqueToFormula1.join(', ') || t('ai.chat.formulaPanel.compareNone'),
      '',
      `${t('ai.chat.formulaPanel.compareOnlyIn2')} (${nameB}) (${compareResult.uniqueToFormula2.length}):`,
      compareResult.uniqueToFormula2.join(', ') || t('ai.chat.formulaPanel.compareNone'),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `formula-comparison-${a.id}-${b.id}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }, [compareResult, comparePair, t])
  const [versionPanel, setVersionPanel] = useState<{ id: string; versions: FormulaVersion[] } | null>(null)
  // v8.5：批量操作的对话框状态（替代原生 window.confirm / window.prompt）
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false)
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [tagInputError, setTagInputError] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    formulaId: null,
    position: { x: 0, y: 0 },
  })
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocalSearchQuery(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    if (externalSortBy) setLocalSortBy(externalSortBy)
  }, [externalSortBy])

  useEffect(() => {
    if (externalSortOrder) setLocalSortOrder(externalSortOrder)
  }, [externalSortOrder])

  /**
   * 导出菜单：点击外部 / Esc 关闭（触屏与键盘同等可退出）。
   */
  useEffect(() => {
    if (!showExportMenu) return
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowExportMenu(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showExportMenu])

  /**
   * 搜索关键词变更处理（带200ms防抖）
   */
  const handleSearchChange = useCallback((value: string) => {
    setLocalSearchQuery(value)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      onSearchChange?.(value)
      setCurrentPage(1)
    }, 200)
  }, [onSearchChange])

  /**
   * 清除搜索
   */
  const handleClearSearch = useCallback(() => {
    setLocalSearchQuery('')
    onSearchChange?.('')
    setCurrentPage(1)
    searchInputRef.current?.focus()
  }, [onSearchChange])

  /**
   * 排序字段变更
   */
  const handleSortChange = useCallback((field: FormulaSortField) => {
    const newOrder = field === localSortBy && localSortOrder === 'asc' ? 'desc' : 'asc'
    setLocalSortBy(field)
    setLocalSortOrder(newOrder)
    onSortChange?.(field, newOrder)
    setCurrentPage(1)
  }, [localSortBy, localSortOrder, onSortChange])

  /**
   * 切换排序方向
   */
  const toggleSortOrder = useCallback(() => {
    const newOrder = localSortOrder === 'asc' ? 'desc' : 'asc'
    setLocalSortOrder(newOrder)
    onSortChange?.(localSortBy, newOrder)
    setCurrentPage(1)
  }, [localSortBy, localSortOrder, onSortChange])

  /**
   * 应用搜索、筛选和排序的优化结果（使用 useMemo 缓存）
   */
  const filteredAndSortedFormulas = useMemo(() => {
    let result = [...formulas]

    if (localSearchQuery.trim()) {
      result = result.filter(f => matchFormula(localSearchQuery, f))
    }

    if (externalFilters) {
      if (externalFilters.qualityGrades && externalFilters.qualityGrades.length > 0) {
        result = result.filter(f => f.qualityGrade && externalFilters.qualityGrades!.includes(f.qualityGrade))
      }

      if (externalFilters.confidenceRange) {
        const { min, max } = externalFilters.confidenceRange
        result = result.filter(f => {
          const confidencePercent = Math.round(f.confidence * 100)
          return confidencePercent >= min && confidencePercent <= max
        })
      }

      if (externalFilters.dateRange) {
        const { start, end } = externalFilters.dateRange
        result = result.filter(f => {
          const createdAt = f.createdAt || (f.parsedAt instanceof Date ? f.parsedAt.getTime() : Date.now())
          return createdAt >= start && createdAt <= end
        })
      }

      if (externalFilters.ingredientCountRange) {
        const { min, max } = externalFilters.ingredientCountRange
        result = result.filter(f => f.ingredientCount >= min && f.ingredientCount <= max)
      }

      if (externalFilters.tags && externalFilters.tags.length > 0) {
        result = result.filter(f =>
          f.tags?.some(tag => externalFilters.tags!.includes(tag)),
        )
      }
    }

    result.sort((a, b) => {
      let comparison = 0

      switch (localSortBy) {
        case 'createdAt':
          comparison = (a.createdAt || 0) - (b.createdAt || 0)
          break
        case 'updatedAt':
          comparison = (a.updatedAt || 0) - (b.updatedAt || 0)
          break
        case 'name':
          comparison = (a.autoName || a.name || '').localeCompare(b.autoName || b.name || '')
          break
        case 'confidence':
          comparison = a.confidence - b.confidence
          break
        case 'qualityScore':
          comparison = (a.qualityScore || 0) - (b.qualityScore || 0)
          break
        case 'ingredientCount':
          comparison = a.ingredientCount - b.ingredientCount
          break
        default:
          comparison = 0
      }

      return localSortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [formulas, localSearchQuery, externalFilters, localSortBy, localSortOrder])

  const totalPages = useMemo(() => Math.ceil(filteredAndSortedFormulas.length / ITEMS_PER_PAGE), [filteredAndSortedFormulas.length])

  const paginatedFormulas = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return filteredAndSortedFormulas.slice(startIndex, endIndex)
  }, [filteredAndSortedFormulas, currentPage])

  const loadPrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(1, prev - 1))
  }, [])

  const loadNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1))
  }, [totalPages])

  const handleFiltersChange = useCallback((newFilters: FormulaFilters) => {
    onFiltersChange?.(newFilters)
    setCurrentPage(1)
  }, [onFiltersChange])

  const handleResetFilters = useCallback(() => {
    handleClearSearch()
    onFiltersChange?.({})
    setShowAdvancedFilter(false)
  }, [handleClearSearch, onFiltersChange])

  const handleShowContextMenu = useCallback((formulaId: string, position: { x: number; y: number }) => {
    setContextMenu({
      isOpen: true,
      formulaId,
      position,
    })
  }, [])

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }))
  }, [])

  /**
   * 带退场动画的删除处理 (提前定义以避免TDZ错误)
   */
  const handleDeleteWithAnimation = useCallback(async (id: string) => {
    setDeletingIds(prev => new Set([...prev, id]))

    await new Promise(resolve => setTimeout(resolve, 300))

    onRemoveFormula?.(id)
    setDeletingIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const handleContextAction = useCallback((action: string) => {
    if (!contextMenu.formulaId) return

    switch (action) {
      case 'viewDetail':
        onShowDetail(contextMenu.formulaId)
        break
      case 'generateReport':
        onGenerateReport(contextMenu.formulaId)
        break
      case 'export':
        onExport('json')
        break
      case 'delete':
        handleDeleteWithAnimation(contextMenu.formulaId)
        break
    }

    handleCloseContextMenu()
  }, [contextMenu.formulaId, onShowDetail, onGenerateReport, handleDeleteWithAnimation, handleCloseContextMenu])

  const activeFilterCount = useMemo(() => {
    if (!externalFilters) return 0

    let count = 0
    if (externalFilters.qualityGrades && externalFilters.qualityGrades.length > 0) count++
    if (externalFilters.confidenceRange) count++
    if (externalFilters.dateRange) count++
    if (externalFilters.ingredientCountRange) count++
    if (externalFilters.tags && externalFilters.tags.length > 0) count++

    return count
  }, [externalFilters])

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-end p-4"
          role="button" tabIndex={0} onClick={(e) => {
           if (e.target === e.currentTarget) onClose()
         }}>
      <div
        className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85dvh] overflow-hidden
                   flex flex-col animate-in-from-right"
         role="button" tabIndex={0} onClick={e => e.stopPropagation()}
      >
        {/* ===== v8.5 持久化失败警告条：数据可能无法保存，必须让用户看见 ===== */}
        {storageError && (
          <div
            role="alert"
            className="flex items-start gap-2 px-4 py-2 bg-warning-50 dark:bg-warning-900/30
                       border-b border-warning-300 dark:border-warning-700"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 text-warning-700 dark:text-warning-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-warning-800 dark:text-warning-200">
                {t('ai.chat.formulaPanel.storageErrorTitle')}
              </p>
              <p className="text-xs text-warning-700 dark:text-warning-300 mt-0.5">
                {t(`ai.chat.formulaPanel.storageError_${storageError}`)}
              </p>
            </div>
            {onDismissStorageError && (
              <button
                type="button"
                onClick={onDismissStorageError}
                aria-label={t('ai.chat.formulaPanel.dismissStorageError')}
                className="p-1 -mr-1 rounded hover:bg-warning-100 dark:hover:bg-warning-800/40
                           text-warning-700 dark:text-warning-300 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* ===== v8.5 批量删除超限提示：一次删太多被拒，让用户知道要分批 ===== */}
        {typeof batchLimitExceeded === 'number' && batchLimitExceeded > 0 && (
          <div
            role="alert"
            className="flex items-start gap-2 px-4 py-2 bg-warning-50 dark:bg-warning-900/30
                       border-b border-warning-300 dark:border-warning-700"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 text-warning-700 dark:text-warning-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-warning-800 dark:text-warning-200">
                {t('ai.chat.formulaPanel.batchLimitTitle')}
              </p>
              <p className="text-xs text-warning-700 dark:text-warning-300 mt-0.5">
                {t('ai.chat.formulaPanel.batchLimitDesc', { count: batchLimitExceeded })}
              </p>
            </div>
            {onDismissBatchLimit && (
              <button
                type="button"
                onClick={onDismissBatchLimit}
                aria-label={t('ai.chat.formulaPanel.dismissBatchLimit')}
                className="p-1 -mr-1 rounded hover:bg-warning-100 dark:hover:bg-warning-800/40
                           text-warning-700 dark:text-warning-300 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* ===== 面板头部区域 - 移动端自适应 ===== */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-neutral-50 to-white dark:from-neutral-800 dark:to-neutral-900">
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <FlaskConical className="w-5 h-5 sm:w-6 sm:h-6 text-primary-700 shrink-0" />
            <h2 className="text-base sm:text-xl font-bold text-neutral-900 dark:text-white">
              {t('ai.chat.formulaPanel.title')}
            </h2>
            <span className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-semibold bg-primary-100 text-primary-700 dark:bg-primary-300/25 dark:text-primary-700">
              {filteredAndSortedFormulas.length}/{formulaCount}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={() => onGenerateReport()}
              disabled={isGeneratingReport || formulaCount === 0}
              className="w-full sm:w-auto bg-primary-container text-primary-main shadow-lg px-4 py-2.5 sm:py-2 rounded-lg font-medium transition-all duration-200 hover:scale-105 active:scale-95"
              icon={isGeneratingReport ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            >
              {isGeneratingReport ? t('ai.chat.formulaPanel.generating') : t('ai.chat.formulaPanel.generateReport', { count: formulaCount })}
            </Button>

            {/* v8.5 撤销批量删除：仅在有可撤销记录时出现，提供硬删后的唯一后悔入口 */}
            {canUndoBatchDelete && onUndoBatchDelete && (
              <Button
                variant="outline"
                onClick={() => onUndoBatchDelete()}
                className="w-full sm:w-auto px-3 py-2 rounded-lg text-sm transition-all duration-200
                           min-h-[44px] whitespace-nowrap"
                icon={<RotateCcw size={16} />}
              >
                {t('ai.chat.formulaPanel.undoBatchDelete')}
              </Button>
            )}

            {/* 平板端视图切换按钮 */}
            <button
              onClick={() => setIsTabletView(!isTabletView)}
              className="hidden md:flex lg:hidden items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-800 transition-colors min-h-[44px]"
              title={isTabletView ? t('ai.chat.formulaPanel.switchToSingle') : t('ai.chat.formulaPanel.switchToDouble')}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-sm">{isTabletView ? t('ai.chat.formulaPanel.singleColumn') : t('ai.chat.formulaPanel.doubleColumn')}</span>
            </button>

            <button
              onClick={onClose}
              className="self-end sm:self-auto p-2 -mr-2 sm:mr-0 rounded-lg hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-800 transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
              aria-label={t('ai.chat.formulaPanel.closePanel')}
            >
              <X className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
            </button>
          </div>
        </div>

        {/* 提示文本区域 */}
        <div className="px-6 py-2 text-sm text-secondary-700 dark:text-secondary-700 bg-secondary-50 dark:bg-secondary-300/20 border-b border-secondary-100 dark:border-secondary-900/30">
          {t('ai.chat.formulaPanel.hint')}
        </div>

        {/* ===== 搜索框区域 ===== */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t('ai.chat.formulaPanel.searchPlaceholder')}
                value={localSearchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg
                         bg-neutral-50 dark:bg-neutral-900 text-sm focus:ring-2 focus:ring-secondary-500
                         focus:border-transparent outline-none transition-all"
              />
              {localSearchQuery && (
                <button
                  onClick={handleClearSearch}
                  aria-label={t('ai.chat.formulaPanel.clearSearch')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-neutral-600 flex items-center justify-center min-h-[24px] min-w-[24px]"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <Button
              variant={showAdvancedFilter ? "primary" : "outline"}
              size="sm"
              onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
              icon={<SlidersHorizontal size={16} />}
              className="relative"
            >
              <span className="hidden sm:inline">{t('ai.chat.formulaPanel.advancedFilter')}</span>
              <span className="sm:hidden">{t('ai.chat.formulaPanel.filterShort')}</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-error-500 text-white text-xs rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {localSearchQuery && (
            <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
              <Search size={14} />
              <span>"<strong>{localSearchQuery}</strong>" · {t('ai.chat.formulaPanel.resultsFound', { count: filteredAndSortedFormulas.length })}</span>
            </div>
          )}
        </div>

        {/* ===== 高级筛选器 - 移动端/平板端使用侧滑抽屉 ===== */}
        <MobileBottomSheet
          open={showAdvancedFilter}
          onClose={() => setShowAdvancedFilter(false)}
          title={t('ai.chat.formulaPanel.advancedFilter')}
        >
          <AdvancedFilter
            filters={externalFilters || {}}
            onFiltersChange={handleFiltersChange}
            onReset={handleResetFilters}
            allFormulas={formulas}
          />
        </MobileBottomSheet>

        {/* ===== 排序控制栏 ===== */}
        <div className="flex items-center gap-4 px-6 py-3 bg-neutral-50 dark:bg-neutral-800 text-sm border-b border-neutral-200 dark:border-neutral-700">
          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex items-center gap-1">
            <ArrowUpDown size={14} />
            {t('ai.chat.formulaPanel.sortLabel')}
          </span>

          <select
            value={localSortBy}
            onChange={(e) => handleSortChange(e.target.value as FormulaSortField)}
            className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-sm focus:ring-2 focus:ring-secondary-500 outline-none"
          >
            <option value="createdAt">{t('ai.chat.formulaPanel.sortCreatedAt')}</option>
            <option value="updatedAt">{t('ai.chat.formulaPanel.sortUpdatedAt')}</option>
            <option value="name">{t('ai.chat.formulaPanel.sortName')}</option>
            <option value="confidence">{t('ai.chat.formulaPanel.sortConfidence')}</option>
            <option value="qualityScore">{t('ai.chat.formulaPanel.sortQualityScore')}</option>
            <option value="ingredientCount">{t('ai.chat.formulaPanel.sortIngredientCount')}</option>
          </select>

          <button
            onClick={toggleSortOrder}
            className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center gap-1"
          >
            {localSortOrder === 'asc' ? t('ai.chat.formulaPanel.sortAsc') : t('ai.chat.formulaPanel.sortDesc')}
          </button>

          <span className="ml-auto text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            {t('ai.chat.formulaPanel.resultCount', { count: filteredAndSortedFormulas.length })}
          </span>
        </div>

        {/* ===== 配方列表主内容区 - 支持平板端双列布局 ===== */}
        <div className="flex-1 overflow-hidden">
          {filteredAndSortedFormulas.length > 0 ? (
            <div className="p-4 space-y-3 h-full">
              {/* 平板端双列网格 / 移动端单列 */}
              <div className={cn(
                'grid gap-4',
                isTabletView ? 'md:grid-cols-2 lg:grid-cols-1' : 'grid-cols-1',
              )}>
                {paginatedFormulas.map((formula) => (
                  <FormulaCard
                    key={formula.id}
                    formula={formula}
                    isExpanded={expandedIds.has(formula.id)}
                    isSelected={selectedIds.has(formula.id)}
                    onToggleExpand={onToggleExpand}
                    onSelect={onToggleSelect}
                    onShowDetail={onShowDetail}
                    onGenerateReport={onGenerateReport}
                    onRename={onRenameFormula}
                    qualityScore={getFormulaScore ? getFormulaScore(formula.id) : undefined}
                    compact={isTabletView}
                    onToggleFavorite={onToggleFavorite}
                    onShowContextMenu={handleShowContextMenu}
                  />
                ))}
              </div>

              {selectedIds.size > 0 && (
                <div className="sticky bottom-0 left-0 right-0 bg-primary-50 dark:bg-primary-300/20 border-t border-primary-200 dark:border-primary-800 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg shadow-lg mt-4 gap-2">
                  <span className="text-sm font-medium text-primary-700 dark:text-primary-700">
                    {t('ai.chat.formulaPanel.selectedCount', { count: selectedIds.size })}
                  </span>

                  {/* 移动端：操作按钮横向滚动 */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={() => onBatchExport?.('json')} className="whitespace-nowrap text-xs sm:text-sm">
                      {t('ai.chat.formulaPanel.exportSelected')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      // v8.5：改用项目 Dialog，替代无法样式化、无无障碍语义的原生 window.prompt
                      setTagInput('')
                      setTagInputError('')
                      setTagDialogOpen(true)
                    }} className="whitespace-nowrap text-xs sm:text-sm">
                      {t('ai.chat.formulaPanel.tagSelected')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      const selected = formulas.filter(f => selectedIds.has(f.id))
                      const allFav = selected.length > 0 && selected.every(f => f.isFavorite)
                      onBatchFavorite?.(Array.from(selectedIds), !allFav)
                    }} icon={<Star size={14} />} className="whitespace-nowrap text-xs sm:text-sm">
                      {(() => {
                        const selected = formulas.filter(f => selectedIds.has(f.id))
                        const allFav = selected.length > 0 && selected.every(f => f.isFavorite)
                        return allFav
                          ? t('ai.chat.formulaPanel.unfavoriteSelected')
                          : t('ai.chat.formulaPanel.favoriteSelected')
                      })()}
                    </Button>
                    {selectedIds.size === 2 && (
                      <Button variant="outline" size="sm" onClick={() => {
                        const ids = Array.from(selectedIds)
                        const result = onCompare?.(ids[0], ids[1]) ?? null
                        if (result) {
                          setCompareResult(result)
                          // v8.5：并排对比需要两张卡片的完整信息
                          const a = formulas.find((f) => f.id === ids[0])
                          const b = formulas.find((f) => f.id === ids[1])
                          if (a && b) setComparePair({ a, b })
                        }
                      }} icon={<GitCompare size={14} />} className="whitespace-nowrap text-xs sm:text-sm">
                        {t('ai.chat.formulaPanel.compareSelected')}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmBatchDelete(true)}
                      className="whitespace-nowrap text-xs sm:text-sm text-error-600"
                    >
                      {t('ai.chat.formulaPanel.deleteSelected')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => {
                      onSelectAll?.()
                    }} className="whitespace-nowrap text-xs sm:text-sm">
                      {t('ai.chat.formulaPanel.selectAll')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => {
                      clearSelection?.()
                    }} className="whitespace-nowrap text-xs sm:text-sm">
                      {t('ai.chat.formulaPanel.cancelSelection')}
                    </Button>
                  </div>
                </div>
              )}

                  {filteredAndSortedFormulas.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-center gap-4 py-4 border-t border-neutral-200 dark:border-neutral-700 mt-4">
                      <button
                        onClick={loadPrevPage}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600
                                 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-colors"
                      >
                        {t('ai.chat.formulaPanel.prevPage')}
                      </button>

                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {t('ai.chat.formulaPanel.pageInfo', { current: currentPage, total: totalPages })}
                        <span className="ml-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                          {t('ai.chat.formulaPanel.formulasTotal', { count: filteredAndSortedFormulas.length })}
                        </span>
                      </span>

                      <button
                        onClick={loadNextPage}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600
                                 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-colors"
                      >
                        {t('ai.chat.formulaPanel.nextPage')}
                      </button>
                    </div>
                  )}
            </div>
          ) : (
            <div className="text-center py-12 px-4">
              <FlaskConical className="w-16 h-16 mx-auto mb-4 opacity-30" />
              {localSearchQuery || externalFilters ? (
                <>
                  <p className="text-lg font-medium text-neutral-600 dark:text-neutral-400">{t('ai.chat.formulaPanel.noMatchTitle')}</p>
                  <p className="text-sm mt-2 text-neutral-500 dark:text-neutral-400">
                    {t('ai.chat.formulaPanel.noMatchHint')}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetFilters}
                    className="mt-4"
                  >
                    {t('ai.chat.formulaPanel.resetAllFilters')}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium text-neutral-600 dark:text-neutral-400">{t('ai.chat.formulaPanel.emptyTitle')}</p>
                  <p className="text-sm mt-2 text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
                    {t('ai.chat.formulaPanel.emptyHint')}<br/>
                    <span className="text-primary-700 dark:text-primary-700 font-medium">
                      {t('ai.chat.formulaPanel.emptyExample')}
                    </span>
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* ===== 底部操作工具栏 ===== */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              {t('ai.chat.formulaPanel.statusFormulas', { count: formulaCount })}{localSearchQuery || externalFilters ? ` | ${t('ai.chat.formulaPanel.statusShowing', { count: filteredAndSortedFormulas.length })}` : ''} |
              <span className="text-success-600 ml-1">{t('ai.chat.formulaPanel.autoSaved')}</span>
            </span>
            <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              {t('ai.chat.formulaPanel.versionLabel')}
            </span>
          </div>

          <div className="flex items-center justify-between flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {(localSearchQuery || externalFilters) && (
                <Button variant="ghost" size="sm" onClick={handleResetFilters} icon={<RotateCcw size={14} />} className="flex-1 sm:flex-initial">
                  {t('ai.chat.formulaPanel.resetFilterShort')}
                </Button>
              )}

              {/* 小屏：次要操作折叠到"更多"菜单 */}
              <div className="relative md:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="flex items-center gap-1 min-h-[44px]"
                >
                  <MoreVertical className="w-4 h-4" />
                  {t('ai.chat.formulaPanel.moreActions')}
                </Button>

                {showMoreMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                       role="button" tabIndex={0} onClick={() => setShowMoreMenu(false)}
                    />
                    <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 py-2 min-w-[200px] z-50">
                      <button
                        onClick={() => { onClearMemory(); setShowMoreMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center gap-3 min-h-[44px]"
                      >
                        <RotateCcw className="w-4 h-4" />
                        {t('ai.chat.formulaPanel.clearMemoryCache')}
                      </button>
                      <button
                        onClick={() => { onImport(); setShowMoreMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center gap-3 min-h-[44px]"
                      >
                        <Download className="w-4 h-4" />
                        {t('ai.chat.formulaPanel.importData')}
                      </button>
                      <hr className="my-1 border-neutral-200 dark:border-neutral-700" />
                      <button
                        onClick={() => { onClearStorage(); setShowMoreMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 flex items-center gap-3 min-h-[44px]"
                        disabled={formulaCount === 0}
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('ai.chat.formulaPanel.clearStorage')}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* 大屏：直接显示所有操作 */}
              <Button variant="ghost" size="sm" onClick={onClearMemory} className="hidden md:flex">
                {t('ai.chat.formulaPanel.clearMemory')}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onImport}
                title={t('ai.chat.formulaPanel.importFromJson')}
                icon={<Download size={14} />}
                className="hidden md:flex"
              >
                {t('ai.chat.formulaPanel.import')}
              </Button>

              <div className="relative group" ref={exportMenuRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowExportMenu((prev) => !prev)}
                  title={t('ai.chat.formulaPanel.chooseExportFormat')}
                  disabled={formulaCount === 0}
                  aria-haspopup="menu"
                  aria-expanded={showExportMenu}
                  icon={<Upload size={14} />}
                  className="group-hover:bg-neutral-100 dark:bg-neutral-800"
                >
                  {t('ai.chat.formulaPanel.export')}
                  <MoreVertical className="w-3 h-3 rotate-[-90deg]" aria-hidden="true" />
                </Button>

                {showExportMenu && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-1 w-36 max-w-[calc(100vw-2rem)] bg-white dark:bg-neutral-800
                            rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700
                            z-50"
                  >
                    <div className="py-1">
                      <button
                        role="menuitem"
                        onClick={() => { onExport('json'); setShowExportMenu(false) }}
                        className="w-full px-4 py-2 min-h-[44px] text-left text-sm hover:bg-secondary-50
                               dark:hover:bg-secondary-900/20 flex items-center gap-2"
                      >
                        <FileJson className="w-4 h-4" />
                        {t('ai.chat.formulaPanel.exportJson')}
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => { onExport('csv'); setShowExportMenu(false) }}
                        className="w-full px-4 py-2 min-h-[44px] text-left text-sm hover:bg-secondary-50
                               dark:hover:bg-secondary-900/20 flex items-center gap-2"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        {t('ai.chat.formulaPanel.exportCsv')}
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => { onExport('txt'); setShowExportMenu(false) }}
                        className="w-full px-4 py-2 min-h-[44px] text-left text-sm hover:bg-secondary-50
                               dark:hover:bg-secondary-900/20 flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        {t('ai.chat.formulaPanel.exportTxt')}
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => { onExport('html'); setShowExportMenu(false) }}
                        className="w-full px-4 py-2 min-h-[44px] text-left text-sm hover:bg-secondary-50
                               dark:hover:bg-secondary-900/20 flex items-center gap-2"
                      >
                        <Globe className="w-4 h-4" />
                        {t('ai.chat.formulaPanel.exportHtml')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={onClearStorage}
                title={t('ai.chat.formulaPanel.clearStorageTitle')}
                icon={<Trash2 size={14} />}
                className="text-error-500 hover:text-error-600 hover:bg-error-50 hidden md:flex"
                disabled={formulaCount === 0}
              >
                {t('ai.chat.formulaPanel.clearStorageBtn')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 上下文菜单（长按触发） */}
      {contextMenu.isOpen && contextMenu.formulaId && (
        <>
          <div
            className="fixed inset-0 z-40"
             role="button" tabIndex={0} onClick={handleCloseContextMenu}
          />
          <div
            className="fixed z-50 bg-white dark:bg-neutral-800 rounded-lg shadow-2xl border border-neutral-200 dark:border-neutral-700 py-2 min-w-[180px]"
            style={{
              left: Math.min(contextMenu.position.x, window.innerWidth - 200),
              top: Math.min(contextMenu.position.y, window.innerHeight - 250),
            }}
          >
            <button
              onClick={() => handleContextAction('viewDetail')}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center gap-3 min-h-[44px]"
            >
              <Eye className="w-4 h-4" />
              {t('ai.chat.formulaPanel.viewDetail')}
            </button>
            <button
              onClick={() => handleContextAction('generateReport')}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center gap-3 min-h-[44px]"
            >
              <FileText className="w-4 h-4" />
              {t('ai.chat.formulaPanel.generateReportCtx')}
            </button>
            <button
              onClick={() => handleContextAction('export')}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center gap-3 min-h-[44px]"
            >
              <Upload className="w-4 h-4" />
              {t('ai.chat.formulaPanel.exportData')}
            </button>

            {/* v8.2：优先级设置 */}
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">
                <Flag className="w-3.5 h-3.5" />
                {t('ai.chat.formulaPanel.priorityLabel')}
              </div>
              <div className="flex items-center gap-1">
                {(['high', 'medium', 'low'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      if (contextMenu.formulaId) onSetPriority?.(contextMenu.formulaId, p)
                      handleCloseContextMenu()
                    }}
                    className="flex-1 px-2 py-1.5 rounded-md text-xs border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 min-h-[36px]"
                  >
                    {t(`ai.chat.formulaPanel.priority_${p}`)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                if (contextMenu.formulaId && onGetVersions) {
                  setVersionPanel({ id: contextMenu.formulaId, versions: onGetVersions(contextMenu.formulaId) })
                }
                handleCloseContextMenu()
              }}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center gap-3 min-h-[44px]"
            >
              <History className="w-4 h-4" />
              {t('ai.chat.formulaPanel.versionHistory')}
            </button>

            <hr className="my-1 border-neutral-200 dark:border-neutral-700" />
            <button
              onClick={() => handleContextAction('delete')}
              className="w-full px-4 py-2.5 text-left text-sm text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 flex items-center gap-3 min-h-[44px]"
            >
              <Trash2 className="w-4 h-4" />
              {t('ai.chat.formulaPanel.deleteFormula')}
            </button>
          </div>
        </>
      )}

      {/* ===== v8.5 批量删除确认对话框（替代原生 window.confirm） ===== */}
      <Dialog open={confirmBatchDelete} onOpenChange={setConfirmBatchDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('ai.chat.formulaPanel.confirmBatchDeleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('ai.chat.formulaPanel.confirmBatchDelete', { count: selectedIds.size })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmBatchDelete(false)}>
              {t('ai.chat.formulaPanel.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-error-600 hover:bg-error-700"
              onClick={() => {
                onBatchDelete?.(Array.from(selectedIds))
                setConfirmBatchDelete(false)
              }}
            >
              {t('ai.chat.formulaPanel.confirmDeleteAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== v8.5 批量标签输入对话框（替代原生 window.prompt） ===== */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('ai.chat.formulaPanel.tagDialogTitle')}</DialogTitle>
            <DialogDescription>{t('ai.chat.formulaPanel.tagPrompt')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <input
              type="text"
              autoFocus
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value)
                if (tagInputError) setTagInputError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const tags = tagInput.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
                  if (tags.length === 0) {
                    setTagInputError(t('ai.chat.formulaPanel.tagEmptyError'))
                    return
                  }
                  onBatchTag?.(Array.from(selectedIds), tags)
                  setTagDialogOpen(false)
                }
              }}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg
                       bg-white dark:bg-neutral-900 text-sm outline-none
                       focus:ring-2 focus:ring-secondary-500 min-h-[44px]"
              placeholder={t('ai.chat.formulaPanel.tagInputPlaceholder')}
              aria-label={t('ai.chat.formulaPanel.tagInputPlaceholder')}
            />
            {tagInputError && (
              <p className="text-xs text-error-600" role="alert">{tagInputError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTagDialogOpen(false)}>
              {t('ai.chat.formulaPanel.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const tags = tagInput.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
                if (tags.length === 0) {
                  setTagInputError(t('ai.chat.formulaPanel.tagEmptyError'))
                  return
                }
                onBatchTag?.(Array.from(selectedIds), tags)
                setTagDialogOpen(false)
              }}
            >
              {t('ai.chat.formulaPanel.confirmTagAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 配方对比结果弹窗 (v8.2) ===== */}
      {compareResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-label={t('ai.chat.formulaPanel.compareResultTitle')}>
          <div className="w-full max-w-lg bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-secondary-600" />
                {t('ai.chat.formulaPanel.compareResultTitle')}
              </h3>
              <button
                onClick={() => { setCompareResult(null); setComparePair(null) }}
                aria-label={t('ai.chat.formulaPanel.closePanel')}
                className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-[color:var(--text-muted)] hover:bg-neutral-100 dark:hover:bg-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
                <span className="text-neutral-600 dark:text-neutral-400">{t('ai.chat.formulaPanel.compareSimilarity')}</span>
                <span className="font-semibold text-secondary-600">{Math.round(compareResult.similarityScore * 100)}%</span>
              </div>

              {/* v8.5 并排对比表：共同成分中性，独有成分高亮，一眼看出差异 */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left px-2 py-2 font-semibold text-neutral-700 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-700 break-words max-w-[45%]">
                        {comparePair ? (comparePair.a.name || comparePair.a.autoName || t('ai.chat.formulaPanel.compareFormula1')) : t('ai.chat.formulaPanel.compareFormula1')}
                      </th>
                      <th className="text-left px-2 py-2 font-semibold text-neutral-700 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-700 break-words max-w-[45%]">
                        {comparePair ? (comparePair.b.name || comparePair.b.autoName || t('ai.chat.formulaPanel.compareFormula2')) : t('ai.chat.formulaPanel.compareFormula2')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="align-top px-2 py-2 border-b border-neutral-100 dark:border-neutral-800">
                        {(() => {
                          const unique = new Set(compareResult.uniqueToFormula1)
                          const list = [...compareResult.commonIngredients, ...compareResult.uniqueToFormula1]
                          if (list.length === 0) return <span className="text-neutral-400">{t('ai.chat.formulaPanel.compareNone')}</span>
                          return (
                            <div className="flex flex-wrap gap-1">
                              {list.map((ing) => (
                                <span key={ing} className={
                                  unique.has(ing)
                                    ? 'px-2 py-0.5 rounded bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium ring-1 ring-primary-200 dark:ring-primary-800'
                                    : 'px-2 py-0.5 rounded bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300'
                                }>{ing}</span>
                              ))}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="align-top px-2 py-2 border-b border-neutral-100 dark:border-neutral-800">
                        {(() => {
                          const unique = new Set(compareResult.uniqueToFormula2)
                          const list = [...compareResult.commonIngredients, ...compareResult.uniqueToFormula2]
                          if (list.length === 0) return <span className="text-neutral-400">{t('ai.chat.formulaPanel.compareNone')}</span>
                          return (
                            <div className="flex flex-wrap gap-1">
                              {list.map((ing) => (
                                <span key={ing} className={
                                  unique.has(ing)
                                    ? 'px-2 py-0.5 rounded bg-warning-50 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 font-medium ring-1 ring-warning-200 dark:ring-warning-800'
                                    : 'px-2 py-0.5 rounded bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300'
                                }>{ing}</span>
                              ))}
                            </div>
                          )
                        })()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-2 text-neutral-500 dark:text-neutral-400">
                        {t('ai.chat.formulaPanel.compareUniqueCount', { count: compareResult.uniqueToFormula1.length })}
                      </td>
                      <td className="px-2 py-2 text-neutral-500 dark:text-neutral-400">
                        {t('ai.chat.formulaPanel.compareUniqueCount', { count: compareResult.uniqueToFormula2.length })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
                <span className="text-neutral-600 dark:text-neutral-400">{t('ai.chat.formulaPanel.compareOverlap')}</span>
                <span className="font-semibold text-secondary-600">{Math.round(compareResult.ingredientOverlapRatio * 100)}%</span>
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
                <span className="text-neutral-600 dark:text-neutral-400">{t('ai.chat.formulaPanel.compareConfidenceDiff')}</span>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">{Math.round(compareResult.confidenceDiff * 100)}%</span>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleExportComparison} icon={<Download size={14} />}>
                {t('ai.chat.formulaPanel.compareExport')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setCompareResult(null); setComparePair(null) }}>
                {t('ai.chat.formulaPanel.compareClose')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 版本历史弹窗 (v8.2) ===== */}
      {versionPanel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-label={t('ai.chat.formulaPanel.versionHistory')}>
          <div className="w-full max-w-md bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-secondary-600" />
                {t('ai.chat.formulaPanel.versionHistory')}
              </h3>
              <button
                onClick={() => setVersionPanel(null)}
                aria-label={t('ai.chat.formulaPanel.closePanel')}
                className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-[color:var(--text-muted)] hover:bg-neutral-100 dark:hover:bg-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-[60dvh] overflow-y-auto space-y-2">
              {versionPanel.versions.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-6">
                  {t('ai.chat.formulaPanel.versionEmpty')}
                </p>
              ) : (
                versionPanel.versions.map((v) => (
                  <div key={v.version} className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {t('ai.chat.formulaPanel.versionItem', { version: v.version })}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {v.timestamp.toLocaleString(i18n.language || 'zh-CN')}
                        {v.changeReason ? ` · ${v.changeReason}` : ''}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<RotateCw size={14} />}
                      onClick={() => {
                        const ok = onRollbackVersion?.(versionPanel.id, v.version)
                        if (ok) setVersionPanel(null)
                      }}
                      className="shrink-0"
                    >
                      {t('ai.chat.formulaPanel.versionRollback')}
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-700 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setVersionPanel(null)}>
                {t('ai.chat.formulaPanel.compareClose')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

FormulaPanel.displayName = 'FormulaPanel'

export { FormulaPanel }
export default FormulaPanel

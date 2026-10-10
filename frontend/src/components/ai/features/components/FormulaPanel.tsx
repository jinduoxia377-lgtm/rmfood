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
import type { AIRecognizedFormula, FormulaQualityScore, FormulaFilters, FormulaSortField, SortOrder } from '@/types/ai.types'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { FormulaCard } from './FormulaCard'
import { FormulaSkeleton } from './FormulaSkeleton'
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
  /** 删除配方（带动画） */
  onRemoveFormula?: (id: string) => void
  /** 清空选中状态 */
  clearSelection?: () => void
  /** 报告生成加载状态 */
  isGeneratingReport: boolean
  /** 配方数据加载状态（用于显示骨架屏） */
  isLoading?: boolean
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
  onRemoveFormula,
  clearSelection,
  isGeneratingReport,
  isLoading,
  onClose,
}) => {

  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery)
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false)
  const [localSortBy, setLocalSortBy] = useState<FormulaSortField>(externalSortBy || 'createdAt')
  const [localSortOrder, setLocalSortOrder] = useState<SortOrder>(externalSortOrder || 'desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [_deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [isTabletView, setIsTabletView] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
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
        className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden
                   flex flex-col animate-in-from-right"
         role="button" tabIndex={0} onClick={e => e.stopPropagation()}
      >
        {/* ===== 面板头部区域 - 移动端自适应 ===== */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-neutral-50 to-white dark:from-neutral-800 dark:to-neutral-900">
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <FlaskConical className="w-5 h-5 sm:w-6 sm:h-6 text-primary-700 shrink-0" />
            <h2 className="text-base sm:text-xl font-bold text-neutral-900 dark:text-white">
              已识别的配方
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
              {isGeneratingReport ? '生成中...' : `生成报告 (${formulaCount})`}
            </Button>

            {/* 平板端视图切换按钮 */}
            <button
              onClick={() => setIsTabletView(!isTabletView)}
              className="hidden md:flex lg:hidden items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-800 transition-colors min-h-[44px]"
              title={isTabletView ? '切换到单列视图' : '切换到双列视图'}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-sm">{isTabletView ? '单列' : '双列'}</span>
            </button>

            <button
              onClick={onClose}
              className="self-end sm:self-auto p-2 -mr-2 sm:mr-0 rounded-lg hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-800 transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
              aria-label="关闭面板"
            >
              <X className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
            </button>
          </div>
        </div>

        {/* 提示文本区域 */}
        <div className="px-6 py-2 text-sm text-secondary-700 dark:text-secondary-700 bg-secondary-50 dark:bg-secondary-300/20 border-b border-secondary-100 dark:border-secondary-900/30">
          支持中文/拼音/英文智能搜索 · 多条件组合筛选 · 多维度排序
        </div>

        {/* ===== 搜索框区域 ===== */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="🔍 搜索配方（支持拼音/中文/英文）..."
                value={localSearchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg
                         bg-neutral-50 dark:bg-neutral-900 text-sm focus:ring-2 focus:ring-secondary-500
                         focus:border-transparent outline-none transition-all"
              />
              {localSearchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-neutral-600"
                >
                  ✕
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
              <span className="hidden sm:inline">高级筛选</span>
              <span className="sm:hidden">筛选</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-error-500 text-white text-xs rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {localSearchQuery && (
            <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              🔍 搜索 "<strong>{localSearchQuery}</strong>" · 找到 <strong>{filteredAndSortedFormulas.length}</strong> 个匹配结果
            </div>
          )}
        </div>

        {/* ===== 高级筛选器 - 移动端/平板端使用侧滑抽屉 ===== */}
        <MobileBottomSheet
          open={showAdvancedFilter}
          onClose={() => setShowAdvancedFilter(false)}
          title="高级筛选"
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
            排序:
          </span>

          <select
            value={localSortBy}
            onChange={(e) => handleSortChange(e.target.value as FormulaSortField)}
            className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-sm focus:ring-2 focus:ring-secondary-500 outline-none"
          >
            <option value="createdAt">创建时间</option>
            <option value="updatedAt">更新时间</option>
            <option value="name">名称</option>
            <option value="confidence">置信度</option>
            <option value="qualityScore">质量评分</option>
            <option value="ingredientCount">成分数量</option>
          </select>

          <button
            onClick={toggleSortOrder}
            className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center gap-1"
          >
            {localSortOrder === 'asc' ? '↑ 升序' : '↓ 降序'}
          </button>

          <span className="ml-auto text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            共 {filteredAndSortedFormulas.length} 条结果
          </span>
        </div>

        {/* ===== 配方列表主内容区 - 支持平板端双列布局 ===== */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <FormulaSkeleton count={5} />
          ) : filteredAndSortedFormulas.length > 0 ? (
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
                    onShowContextMenu={handleShowContextMenu}
                  />
                ))}
              </div>

              {selectedIds.size > 0 && (
                <div className="sticky bottom-0 left-0 right-0 bg-primary-50 dark:bg-primary-300/20 border-t border-primary-200 dark:border-primary-800 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg shadow-lg mt-4 gap-2">
                  <span className="text-sm font-medium text-primary-700 dark:text-primary-700">
                    已选择 {selectedIds.size} 个配方
                  </span>

                  {/* 移动端：操作按钮横向滚动 */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={() => onExport('json')} className="whitespace-nowrap text-xs sm:text-sm">
                      导出选中
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => {
                      clearSelection?.()
                    }} className="whitespace-nowrap text-xs sm:text-sm">
                      取消选择
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
                        ⬅️ 上一页
                      </button>

                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        第 <strong className="text-secondary-600 dark:text-secondary-700">{currentPage}</strong> /
                        共 <strong>{totalPages}</strong> 页
                        <span className="ml-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                          (共 {filteredAndSortedFormulas.length} 个配方)
                        </span>
                      </span>

                      <button
                        onClick={loadNextPage}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600
                                 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-colors"
                      >
                        下一页 ➡️
                      </button>
                    </div>
                  )}
            </div>
          ) : (
            <div className="text-center py-12 px-4">
              <FlaskConical className="w-16 h-16 mx-auto mb-4 opacity-30" />
              {localSearchQuery || externalFilters ? (
                <>
                  <p className="text-lg font-medium text-neutral-600 dark:text-neutral-400">未找到匹配的配方</p>
                  <p className="text-sm mt-2 text-neutral-500 dark:text-neutral-400">
                    尝试调整搜索关键词或筛选条件...
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetFilters}
                    className="mt-4"
                  >
                    重置所有筛选条件
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium text-neutral-600 dark:text-neutral-400">暂未识别到任何配方</p>
                  <p className="text-sm mt-2 text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
                    继续对话并请求AI提供配方信息<br/>
                    <span className="text-primary-700 dark:text-primary-700 font-medium">
                      （如："请给我一个抗氧化配方"）
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
              共 {formulaCount} 个配方{localSearchQuery || externalFilters ? ` | 显示 ${filteredAndSortedFormulas.length} 个` : ''} |
              <span className="text-success-600 ml-1">💾 已自动保存</span>
            </span>
            <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              v8.0 高级筛选版
            </span>
          </div>

          <div className="flex items-center justify-between flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {(localSearchQuery || externalFilters) && (
                <Button variant="ghost" size="sm" onClick={handleResetFilters} className="flex-1 sm:flex-initial">
                  🔄 重置筛选
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
                  更多操作
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
                        🔄 清空内存缓存
                      </button>
                      <button
                        onClick={() => { onImport(); setShowMoreMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center gap-3 min-h-[44px]"
                      >
                        📥 导入数据
                      </button>
                      <hr className="my-1 border-neutral-200 dark:border-neutral-700" />
                      <button
                        onClick={() => { onClearStorage(); setShowMoreMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 flex items-center gap-3 min-h-[44px]"
                        disabled={formulaCount === 0}
                      >
                        🗑 清空存储
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* 大屏：直接显示所有操作 */}
              <Button variant="ghost" size="sm" onClick={onClearMemory} className="hidden md:flex">
                清空内存
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onImport}
                title="从JSON文件导入配方数据"
                className="hidden md:flex"
              >
                📥 导入
              </Button>

              <div className="relative group">
                <Button
                  variant="ghost"
                  size="sm"
                  title="选择导出格式"
                  disabled={formulaCount === 0}
                  className="group-hover:bg-neutral-100 dark:bg-neutral-800"
                >
                  📤 导出 ▼
                </Button>

                <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-neutral-800
                            rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700
                            opacity-0 invisible group-hover:opacity-100 group-hover:visible
                            transition-all duration-200 z-50">
                  <div className="py-1">
                    <button
                      onClick={() => onExport('json')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-secondary-50
                               dark:hover:bg-secondary-900/20 flex items-center gap-2"
                    >
                      📄 JSON 格式
                    </button>
                    <button
                      onClick={() => onExport('csv')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-secondary-50
                               dark:hover:bg-secondary-900/20 flex items-center gap-2"
                    >
                      📊 CSV 表格
                    </button>
                    <button
                      onClick={() => onExport('txt')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-secondary-50
                               dark:hover:bg-secondary-900/20 flex items-center gap-2"
                    >
                      📝 纯文本
                    </button>
                    <button
                      onClick={() => onExport('html')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-secondary-50
                               dark:hover:bg-secondary-900/20 flex items-center gap-2"
                    >
                      🌐 HTML 网页
                    </button>
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={onClearStorage}
                title="清除本地保存的所有配方数据"
                className="text-error-500 hover:text-error-600 hover:bg-error-50 hidden md:flex"
                disabled={formulaCount === 0}
              >
                🗑️ 清除存储
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
              查看详情
            </button>
            <button
              onClick={() => handleContextAction('generateReport')}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center gap-3 min-h-[44px]"
            >
              <FileText className="w-4 h-4" />
              生成报告
            </button>
            <button
              onClick={() => handleContextAction('export')}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center gap-3 min-h-[44px]"
            >
              📤 导出数据
            </button>
            <hr className="my-1 border-neutral-200 dark:border-neutral-700" />
            <button
              onClick={() => handleContextAction('delete')}
              className="w-full px-4 py-2.5 text-left text-sm text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 flex items-center gap-3 min-h-[44px]"
            >
              🗑 删除配方
            </button>
          </div>
        </>
      )}
    </div>
  )
})

FormulaPanel.displayName = 'FormulaPanel'

export { FormulaPanel }
export default FormulaPanel

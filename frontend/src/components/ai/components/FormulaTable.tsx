import { logger } from '@/utils/safeLogger'
import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react'
import type {
  FormulaTableData,
  Ingredient,
  EfficacyTag,
} from '@/types/ai.types'
// 导入枚举值（不仅是类型）
import { IngredientSource } from '@/types/ai.types'

import type { EfficacyTagMeta } from '@/types/efficacyTag.types'
import type { EvaluatedPrecaution } from '@/services/precautionEngine'
import { efficacyTagService } from '@/services/efficacyTagService'
import EfficacyTagList from './EfficacyTagList'

import { Badge } from '@/components/ui'
import { calculateAllPercentages } from '@/services/dosageCalculator'
import {
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
  Loader2,
  AlertCircle,
  Info,
  Leaf,
  Dna,
  Package,
} from 'lucide-react'

import {
  evaluatePrecautions,
} from '@/services/precautionEngine'
import PrecautionDetailPanel from './PrecautionDetailPanel'

type SortField = 'name' | 'amount' | 'percentage'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  field: SortField
  direction: SortDirection
}

interface FormulaTableProps {
  data: FormulaTableData
  isLoading?: boolean
}

type TagMatchStatus = 'idle' | 'loading' | 'success' | 'error'

const SOURCE_CONFIG: Record<IngredientSource, {
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: React.ReactNode
}> = {
  [IngredientSource.TCM]: {
    label: '药食同源',
    color: 'text-success-600 dark:text-success-400',
    bgColor: 'bg-success-50 dark:bg-success-900/20',
    borderColor: 'border-l-success-500',
    icon: <Leaf className="w-3.5 h-3.5" />,
  },
  [IngredientSource.PEPTIDE]: {
    label: '食源性多肽',
    color: 'text-primary-600 dark:text-primary-400',
    bgColor: 'bg-primary-50 dark:bg-primary-900/20',
    borderColor: 'border-l-primary-500',
    icon: <Dna className="w-3.5 h-3.5" />,
  },
  [IngredientSource.EXCIPIENT]: {
    label: '辅料',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-800/50',
    borderColor: 'border-l-gray-400',
    icon: <Package className="w-3.5 h-3.5" />,
  },
}

const SEVERITY_CONFIG: Record<string, { color: string; label: string }> = {
  low: { color: 'text-info-600 bg-info-50 dark:bg-info-900/30', label: '提示' },
  medium: { color: 'text-warning-600 bg-warning-50 dark:bg-warning-900/30', label: '注意' },
  high: { color: 'text-danger-600 bg-danger-50 dark:bg-danger-900/30', label: '警告' },
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

const IngredientRow = memo(({
  ingredient,
  index,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onKeyDown,
  isExpanded,
  onToggleExpand,
  searchQuery,
  matchedTags,
  tagMetaCache,
  tagMatchStatus,
  matchError,
}: {
  ingredient: Ingredient
  index: number
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  isExpanded: boolean
  onToggleExpand: () => void
  searchQuery: string
  matchedTags?: Map<string, EfficacyTag[]>
  tagMetaCache?: Map<EfficacyTag, EfficacyTagMeta>
  tagMatchStatus?: TagMatchStatus
  matchError?: string | null
}) => {
  const sourceConfig = SOURCE_CONFIG[ingredient.source]
  const rowRef = useRef<HTMLTableRowElement>(null)

  const highlightText = (text: string): (string | React.ReactElement)[] => {
    if (!searchQuery || !text) return [text]

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-600/40 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      ),
    )
  }

  return (
    <>
      <tr
        ref={rowRef}
        className={`
          group relative border-b border-gray-100 dark:border-gray-700/50
          transition-all duration-150 ease-in-out
          ${index % 2 === 0 ? 'bg-white dark:bg-gray-900/30' : 'bg-gray-50/50 dark:bg-gray-800/20'}
          ${isHovered ? 'bg-blue-50/50 dark:bg-blue-900/10 shadow-sm' : ''}
          ${sourceConfig.borderColor} border-l-4
          focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:z-10
        `}
        tabIndex={0}
        aria-label={`成分 ${ingredient.name}`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onMouseEnter}
        onBlur={onMouseLeave}
        onKeyDown={onKeyDown}
      >
        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
              {highlightText(ingredient.name)}
            </span>
            {ingredient.latinName && (
              <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                {highlightText(ingredient.latinName)}
              </span>
            )}
          </div>
        </td>

        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
              {ingredient.amount}{ingredient.unit}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({(ingredient.percentage ?? 0).toFixed(1)}%)
            </span>
          </div>
        </td>

        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {tagMatchStatus === 'loading' && (
              <div className="flex gap-1">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-14 animate-pulse" />
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-16 animate-pulse" />
              </div>
            )}

            {tagMatchStatus === 'error' && matchError && (
              <span
                className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
                title={`⚠️ 匹配失败: ${matchError}`}
              >
                ⚠️ 匹配失败
              </span>
            )}

            {tagMatchStatus === 'success' && matchedTags && (() => {
              const tags = matchedTags.get(ingredient.name) || []
              if (tags.length === 0) {
                return <span className="text-xs text-gray-400">—</span>
              }
              return (
                <EfficacyTagList
                  tags={tags}
                  metas={tagMetaCache}
                  maxVisible={3}
                  size="small"
                />
              )
            })()}

            {(tagMatchStatus === 'idle' || !matchedTags) && (ingredient.efficacyTags ?? []).length > 0 && (
              (ingredient.efficacyTags ?? []).map((tag) => (
                <Badge key={tag} variant="neutral" className="text-xs px-2 py-0.5">
                  {tag}
                </Badge>
              ))
            )}

            {(tagMatchStatus === 'idle' || !matchedTags) && (ingredient.efficacyTags ?? []).length === 0 && tagMatchStatus !== 'loading' && (
              <span className="text-xs text-gray-400">—</span>
            )}
          </div>
        </td>

        <td className="px-4 py-3">
          <div className="max-w-[180px] space-y-1">
            {(ingredient.precautions ?? []).slice(0, 2).map((precaution, idx) => (
              <div
                key={idx}
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${SEVERITY_CONFIG[precaution.severity]?.color || ''}`}
              >
                {precaution.severity === 'high' && <AlertCircle className="w-3 h-3" />}
                {precaution.content.length > 15 ? `${precaution.content.slice(0, 15)}...` : precaution.content}
              </div>
            ))}
            {(ingredient.precautions ?? []).length > 2 && (
              <span className="text-xs text-gray-400">+{(ingredient.precautions ?? []).length - 2}</span>
            )}
          </div>
        </td>

        <td className="px-4 py-3">
          <Badge
            className={`${sourceConfig.color} ${sourceConfig.bgColor} border-current gap-1`}
          >
            {sourceConfig.icon}
            {sourceConfig.label}
          </Badge>
        </td>

        <td className="px-4 py-3 w-12">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label={isExpanded ? '收起详情' : '展开详情'}
            aria-expanded={isExpanded}
          >
            <Info className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-blue-50/30 dark:bg-blue-900/5">
          <td colSpan={6} className="px-6 py-4">
            <IngredientDetail ingredient={ingredient} />
          </td>
        </tr>
      )}
    </>
  )
})

IngredientRow.displayName = 'IngredientRow'

const IngredientDetail = memo(({ ingredient }: { ingredient: Ingredient }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
    <div className="space-y-2">
      <h4 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <Leaf className="w-4 h-4" /> 药理作用
      </h4>
      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
        {ingredient.name}具有{(ingredient.efficacyTags ?? []).join('、')}等功效，
        在配方中起到{(ingredient.percentage ?? 0) > 10 ? '主要' : '辅助'}作用。
      </p>
    </div>

    <div className="space-y-2">
      <h4 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <Package className="w-4 h-4" /> 推荐用量
      </h4>
      <p className="text-gray-600 dark:text-gray-400 font-mono">
        {(ingredient.amount * 0.8).toFixed(0)}-{(ingredient.amount * 1.2).toFixed(0)}{ingredient.unit}
        <span className="block text-xs mt-1 text-gray-500">±20% 安全范围</span>
      </p>
    </div>

    <div className="space-y-2">
      <h4 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" /> 禁忌与注意
      </h4>
      <ul className="space-y-1 text-gray-600 dark:text-gray-400">
        {(ingredient.precautions ?? []).map((p, i) => (
          <li key={i} className="flex items-start gap-1">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${
              p.severity === 'high' ? 'bg-danger-500' :
              p.severity === 'medium' ? 'bg-warning-500' : 'bg-info-500'
            }`} />
            {p.content}
          </li>
        ))}
      </ul>
    </div>

    <div className="space-y-2">
      <h4 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <Dna className="w-4 h-4" /> 参考文献
      </h4>
      <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
        《中国药典》2025年版、相关临床研究文献及传统应用记录。
        {ingredient.source === IngredientSource.TCM && ' 经典方剂配伍参考。'}
        {ingredient.source === IngredientSource.PEPTIDE && ' 现代生物活性肽研究。'}
      </p>
    </div>
  </div>
))

IngredientDetail.displayName = 'IngredientDetail'

const TableSkeleton = memo(() => (
  <tbody>
    {Array.from({ length: 8 }).map((_, i) => (
      <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 animate-pulse">
        <td className="px-4 py-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-1" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </td>
        <td className="px-4 py-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-1" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12" />
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-1">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-14" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-16" />
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-24" />
        </td>
        <td className="px-4 py-3">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-16" />
        </td>
        <td className="px-4 py-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4" />
        </td>
      </tr>
    ))}
  </tbody>
))

TableSkeleton.displayName = 'TableSkeleton'

export function FormulaTable({ data, isLoading = false }: FormulaTableProps) {
  const isDev = process.env.NODE_ENV === 'development'

  const [tagMatchStatus, setTagMatchStatus] = useState<TagMatchStatus>('idle')
  const [matchedTagMap, setMatchedTagMap] = useState<Map<string, EfficacyTag[]>>(new Map())
  const [tagMetaCache, setTagMetaCache] = useState<Map<EfficacyTag, EfficacyTagMeta>>(new Map())
  const [matchError, setMatchError] = useState<string | null>(null)

  useEffect(() => {
    if (!data?.ingredients || data.ingredients.length === 0) {
      setTagMatchStatus('idle')
      setMatchedTagMap(new Map())
      return
    }

    setTagMatchStatus('loading')
    setMatchError(null)

    const timer = setTimeout(() => {
      try {
        const ingredientNames = data.ingredients.map((ing) => ({ name: ing.name || '未知成分' }))
        const tagMap = efficacyTagService.batchMatchTags(ingredientNames)
        const metaCache = new Map<EfficacyTag, EfficacyTagMeta>()

        tagMap.forEach((tags) => {
          tags.forEach((tag) => {
            if (!metaCache.has(tag)) {
              const meta = efficacyTagService.getTagMeta(tag)
              if (meta) {
                metaCache.set(tag, meta)
              }
            }
          })
        })

        setMatchedTagMap(tagMap)
        setTagMetaCache(metaCache)
        setTagMatchStatus('success')

        if (isDev) {
          logger.log('[FormulaTable] Tag matching completed:', {
            totalIngredients: data.ingredients.length,
            matchedCount: tagMap.size,
            totalTags: Array.from(tagMap.values()).reduce((sum, tags) => sum + tags.length, 0),
          })
        }
      } catch (error) {
        logger.error('[FormulaTable] Tag matching failed:', error)
        setMatchError(error instanceof Error ? error.message : '标签匹配失败')
        setTagMatchStatus('error')
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [data?.ingredients, isDev])

  const enhancedData = useMemo(() => {
    if (!data) return { title: '', ingredients: [], totalAmount: 0 }

    const rawIngredients = data.ingredients || []
    const enhancedIngredients = rawIngredients.map((ing, index) => ({
      id: `ing-${index}-${ing.name || 'unknown'}`,
      name: ing.name || '未知成分',
      latinName: ing.latinName || '',
      amount: typeof ing.amount === 'number' ? ing.amount : 0,
      unit: ing.unit || 'g',
      percentage: typeof ing.percentage === 'number' ? ing.percentage : 0,
      efficacyTags: Array.isArray(ing.efficacyTags) ? ing.efficacyTags : [],
      precautions: Array.isArray(ing.precautions) ? ing.precautions : [],
      source: ing.source || IngredientSource.TCM,
      role: ing.role || '',
    }))

    const totalAmount = typeof data.totalAmount === 'number'
      ? data.totalAmount
      : enhancedIngredients
          .filter(ing => ing.unit === 'g')
          .reduce((sum, ing) => sum + ing.amount, 0)

    return {
      title: data.title || (data as any).name || '配方详情',
      ingredients: enhancedIngredients,
      totalAmount,
      description: data.description || '',
      metadata: data.metadata || {},
      confidence: data.confidence || 1,
    }
  }, [data])

  const safeData = enhancedData
  const hasValidData = safeData && Array.isArray(safeData.ingredients) && safeData.ingredients.length > 0

  const handleClosePrecautionPanel = useCallback(() => {
    setPrecautionPanelVisible(false)
    setSelectedPrecautions([])
  }, [])

  if (isDev) {
    logger.log('[FormulaTable] Data prop received:', {
      title: safeData.title,
      ingredientsCount: safeData.ingredients?.length ?? 0,
      sources: safeData.ingredients?.map(ing => ({ name: ing.name, source: ing.source })),
      hasUndefinedSource: safeData.ingredients?.some(ing => !ing.source),
      isLoading,
    })
  }

  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'percentage', direction: 'desc' })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSources, setSelectedSources] = useState<Set<IngredientSource>>(
    new Set(Object.values(IngredientSource)),
  )
  const [selectedTags, setSelectedTags] = useState<Set<EfficacyTag>>(new Set())
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [precautionPanelVisible, setPrecautionPanelVisible] = useState(false)
  const [selectedPrecautions, setSelectedPrecautions] = useState<EvaluatedPrecaution[]>([])

  const debouncedSearch = useDebounce(searchQuery, 300)

  const prevDataRef = useRef<typeof data | null>(null)
  useEffect(() => {
    const hasDataChanged = JSON.stringify(prevDataRef.current) !== JSON.stringify(data)
    prevDataRef.current = data

    if (!hasDataChanged) return

    if (isDev) {
      logger.log('[FormulaTable] Data changed, resetting all filter states')
    }
    setSearchQuery('')
    setSelectedSources(new Set(Object.values(IngredientSource)))
    setSelectedTags(new Set())
    setSortConfig({ field: 'percentage', direction: 'desc' })
    setHoveredRowId(null)
    setExpandedRowId(null)
  }, [data, isDev])

  const allTags = useMemo(() => {
    const tags = new Set<EfficacyTag>()
    safeData.ingredients?.forEach((ing) => {
      if (Array.isArray(ing.efficacyTags)) {
        ing.efficacyTags.forEach((tag) => tags.add(tag))
      }
    })
    return Array.from(tags)
  }, [safeData.ingredients])

  const filteredAndSortedData = useMemo(() => {
    if (!hasValidData) return []

    const filtered = safeData.ingredients.filter((ingredient) => {
      const effectiveSource = ingredient.source || IngredientSource.TCM
      const sourceMatch = selectedSources.size === 0 || selectedSources.has(effectiveSource)
      const tagMatch = selectedTags.size === 0 || (Array.isArray(ingredient.efficacyTags) && ingredient.efficacyTags.some((tag) => selectedTags.has(tag)))
      const searchMatch =
        !debouncedSearch ||
        ingredient.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        ingredient.latinName?.toLowerCase().includes(debouncedSearch.toLowerCase())

      return sourceMatch && tagMatch && searchMatch
    })

    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortConfig.field) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'zh-CN')
          break
        case 'amount':
          comparison = a.amount - b.amount
          break
        case 'percentage':
          comparison = a.percentage - b.percentage
          break
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [hasValidData, safeData.ingredients, selectedSources, selectedTags, debouncedSearch, sortConfig])

  if (isDev) {
    logger.log('[FormulaTable] Filter result:', {
      totalIngredients: safeData.ingredients?.length ?? 0,
      filteredCount: filteredAndSortedData.length,
      selectedSources: Array.from(selectedSources),
      selectedTags: Array.from(selectedTags),
      searchQuery: debouncedSearch,
      sortConfig,
    })
  }

  const handleSort = useCallback((field: SortField) => {
    setSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }, [])

  const toggleSourceFilter = useCallback((source: IngredientSource) => {
    setSelectedSources((prev) => {
      const next = new Set(prev)
      if (next.has(source)) {
        next.delete(source)
      } else {
        next.add(source)
      }
      return next
    })
  }, [])

  const toggleTagFilter = useCallback((tag: EfficacyTag) => {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) {
        next.delete(tag)
      } else {
        next.add(tag)
      }
      return next
    })
  }, [])

  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-primary-500" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-primary-500" />
    )
  }

  const useVirtualScroll = filteredAndSortedData.length > 50

  if (isLoading) {
    return (
      <div className="w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <table className="w-full" role="table" aria-label="配方表格加载中">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              {['成分名称', '用量', '功效标签', '注意事项', '来源分类', ''].map((header, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {header || '\u00A0'}
                </th>
              ))}
            </tr>
          </thead>
          <TableSkeleton />
        </table>
      </div>
    )
  }

  if (!hasValidData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <AlertCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-gray-500 dark:text-gray-400 text-base font-medium">暂无配方数据</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">请生成或导入配方数据后查看</p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-4" role="region" aria-label="配方结构化表格">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            placeholder="搜索成分名称..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       placeholder-gray-400 dark:placeholder-gray-500
                       focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                       transition-all duration-200"
            aria-label="搜索成分"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Filter className="w-4 h-4" />
            <span className="font-medium">来源:</span>
            {Object.entries(SOURCE_CONFIG).map(([key, config]) => (
              <label
                key={key}
                className="inline-flex items-center gap-1.5 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={selectedSources.has(key as IngredientSource)}
                  onChange={() => toggleSourceFilter(key as IngredientSource)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  aria-label={`筛选${config.label}`}
                />
                <span className={`text-xs ${config.color}`}>{config.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">功效筛选:</span>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTagFilter(tag)}
              className={`
                px-2.5 py-1 text-xs rounded-full transition-all duration-200
                border
                ${selectedTags.has(tag)
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-300 dark:border-primary-700'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }
              `}
              aria-pressed={selectedTags.has(tag)}
            >
              {tag}
            </button>
          ))}
          {selectedTags.size > 0 && (
            <button
              onClick={() => setSelectedTags(new Set())}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              清除全部
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <table
          className="w-full min-w-[900px]"
          role="table"
          aria-label={`${safeData.title || '配方'}成分列表`}
          aria-rowcount={filteredAndSortedData.length}
        >
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                onClick={() => handleSort('name')}
                aria-sort={
                  sortConfig.field === 'name'
                    ? sortConfig.direction === 'asc' ? 'ascending' : 'descending'
                    : 'none'
                }
              >
                <div className="flex items-center gap-2">
                  成分名称
                  {getSortIcon('name')}
                </div>
              </th>

              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                onClick={() => handleSort('amount')}
                aria-sort={
                  sortConfig.field === 'amount'
                    ? sortConfig.direction === 'asc' ? 'ascending' : 'descending'
                    : 'none'
                }
              >
                <div className="flex items-center gap-2">
                  用量
                  {getSortIcon('amount')}
                </div>
              </th>

              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                功效标签
              </th>

              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                注意事项
              </th>

              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                来源分类
              </th>

              <th
                scope="col"
                className="px-4 py-3 w-12"
                aria-label="操作"
              >
                <span className="sr-only">详情</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {filteredAndSortedData.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                      {safeData.ingredients?.length === 0
                        ? '暂无成分数据'
                        : '未找到匹配的成分'}
                    </p>
                    {safeData.ingredients?.length > 0 && (
                      <>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          当前有 {safeData.ingredients.length} 条数据被筛选条件隐藏
                          {(searchQuery || selectedTags.size > 0 || selectedSources.size !== Object.values(IngredientSource).length) && '，请检查以下条件：'}
                        </p>
                        {searchQuery && (
                          <p className="text-xs text-primary-600 dark:text-primary-400">
                            搜索关键词: "{searchQuery}"
                          </p>
                        )}
                        {selectedSources.size !== Object.values(IngredientSource).length && (
                          <p className="text-xs text-warning-600 dark:text-warning-400">
                            已排除 {Object.values(IngredientSource).length - selectedSources.size} 个来源分类
                          </p>
                        )}
                        {selectedTags.size > 0 && (
                          <p className="text-xs text-info-600 dark:text-info-400">
                            已选择 {selectedTags.size} 个功效标签筛选
                          </p>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => {
                        setSearchQuery('')
                        setSelectedSources(new Set(Object.values(IngredientSource)))
                        setSelectedTags(new Set())
                      }}
                      className="mt-2 px-3 py-1.5 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-md hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                    >
                      重置所有筛选条件
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSortedData.map((ingredient, index) => (
                <IngredientRow
                  key={`${ingredient.name}-${ingredient.source}-${index}`}
                  ingredient={ingredient}
                  index={index}
                  isHovered={hoveredRowId === `${ingredient.name}-${ingredient.source}-${index}`}
                  onMouseEnter={() => setHoveredRowId(`${ingredient.name}-${ingredient.source}-${index}`)}
                  onMouseLeave={() => setHoveredRowId(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setExpandedRowId(
                        expandedRowId === `${ingredient.name}-${ingredient.source}-${index}`
                          ? null
                          : `${ingredient.name}-${ingredient.source}-${index}`,
                      )
                    }
                  }}
                  isExpanded={expandedRowId === `${ingredient.name}-${ingredient.source}-${index}`}
                  onToggleExpand={() =>
                    setExpandedRowId(
                      expandedRowId === `${ingredient.name}-${ingredient.source}-${index}`
                        ? null
                        : `${ingredient.name}-${ingredient.source}-${index}`,
                    )
                  }
                  searchQuery={debouncedSearch}
                  matchedTags={matchedTagMap}
                  tagMetaCache={tagMetaCache}
                  tagMatchStatus={tagMatchStatus}
                  matchError={matchError}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-2">
        <span>
          共 <strong className="text-gray-700 dark:text-gray-300">{filteredAndSortedData.length}</strong> 条记录
          {filteredAndSortedData.length !== safeData.ingredients?.length && (
            <span className="ml-2">
              （从 {safeData.ingredients?.length || 0} 条中筛选）
            </span>
          )}
        </span>
        {useVirtualScroll && (
          <span className="flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            已启用虚拟滚动优化
          </span>
        )}
      </div>

      {isDev && (
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              调试面板 (仅开发模式)
            </h4>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-mono">FormulaTable Debug</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-white/60 dark:bg-gray-800/60 p-2 rounded">
              <div className="text-gray-500 dark:text-gray-400">接收数据</div>
              <div className="font-mono font-bold text-gray-900 dark:text-gray-100">{safeData.ingredients?.length ?? 0} 条</div>
            </div>
            <div className="bg-white/60 dark:bg-gray-800/60 p-2 rounded">
              <div className="text-gray-500 dark:text-gray-400">筛选结果</div>
              <div className={`font-mono font-bold ${filteredAndSortedData.length === 0 ? 'text-red-600' : 'text-green-600'}`}>
                {filteredAndSortedData.length} 条
              </div>
            </div>
            <div className="bg-white/60 dark:bg-gray-800/60 p-2 rounded">
              <div className="text-gray-500 dark:text-gray-400">选中来源</div>
              <div className="font-mono text-gray-900 dark:text-gray-100">
                {Array.from(selectedSources).join(', ') || '无'}
              </div>
            </div>
            <div className="bg-white/60 dark:bg-gray-800/60 p-2 rounded">
              <div className="text-gray-500 dark:text-gray-400">搜索关键词</div>
              <div className="font-mono text-gray-900 dark:text-gray-100 truncate">
                {searchQuery || '(空)'}
              </div>
            </div>
          </div>
          {safeData.ingredients?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">数据来源分布：</div>
              <div className="flex flex-wrap gap-2">
                {Object.values(IngredientSource).map((source) => {
                  const count = safeData.ingredients?.filter(ing => ing.source === source).length ?? 0
                  const config = SOURCE_CONFIG[source]
                  return (
                    <span key={source} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${config.bgColor} ${config.color}`}>
                      {config.label}: {count}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <PrecautionDetailPanel
        precautions={selectedPrecautions}
        visible={precautionPanelVisible}
        onClose={handleClosePrecautionPanel}
      />
    </div>
  )
}

export default memo(FormulaTable)

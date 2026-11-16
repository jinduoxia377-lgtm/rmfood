/**
 * useFormulaManager - 企业级配方管理 Hook (v8.0)
 *
 * 职责：集中处理配方的增删改查、展开收起、搜索过滤、数据表格显示、导入导出等功能。
 *
 * 架构说明（v8.0 内部分区）：
 * ┌─────────────────────────────────────────────────────┐
 * │ [A] 类型定义区    (L56-L110)  接口/常量/类型别名     │
 * │ [B] 状态管理区    (L236-L650)  useState/useMemo 核心   │
 * │ [C] CRUD 操作区   (L418-L610)  增/删/改/查/清空      │
 * │ [D] 展开与详情区  (L632-L690)  展开/收起/详情面板    │
 * │ [E] 搜索过滤区    (L696-L730)  搜索/过滤/分页        │
 * │ [F] 导入导出区    (L730-L815)  JSON导入/多格式导出    │
 * │ [G] 统计分析区    (L815-L860)  统计/评分/对比         │
 * │ [H] 批量操作区    (L856-L960)  多选/批量删除/批量导出 │
 * │ [I] 返回值组装区  (L960+)      UseFormulaManagerReturn│
 * └─────────────────────────────────────────────────────┘
 *
 * @version 8.0.0
 * @lastUpdated 2026-05-20
 * @todo 考虑将 [G] 区提取为独立的 formulaAnalysis.ts 工具模块
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { AIRecognizedFormula, FormulaQualityScore, FormulaFilters, FormulaSortField, SortOrder } from '@/types/ai.types'
import type { FormulaExportFormat } from '@/utils/formulaExporter'
import type { IEventBus, UnsubscribeFn } from '@/components/ai/features/services/eventBus'
import { eventBus } from '@/components/ai/features/services/eventBus'
import {
  saveFormulaIndexWithReason,
  loadFormulaIndex,
  loadFormulaVersionHistory,
  clearFormulaStorage,
  isStorageAvailable,
  importFormulaData,
} from '@/utils/formulaStorage'
import type { StoredVersionHistory, FormulaSaveFailureReason } from '@/utils/formulaStorage'
import { exportFormulas as exportFormulasUtil } from '@/utils/formulaExporter'
import { smartMatch } from '@/utils/pinyinUtils'
import { logger } from '@/utils/safeLogger'
import { generateFormulaName } from '@/utils/formulaNamingEngine'
import { calculateQualityScore } from '@/utils/formulaQuality'

// ===== 常量定义 =====

const DEFAULT_MAX_FORMULAS = 50

/**
 * v8.4 新增：判断一个值能否被安全地解析为有效时间戳。
 * 用于从 localStorage 恢复版本历史时挡住脏数据，避免 UI 渲染出 "Invalid Date"。
 */
function isValidTimestamp(value: unknown): value is number | string | Date {
  if (value === null || value === undefined || value === '') return false
  if (typeof value === 'number') return Number.isFinite(value) && value > 0
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  if (typeof value === 'string') return !Number.isNaN(new Date(value).getTime())
  return false
}

const SAVE_DEBOUNCE_MS = 1000
const UPDATE_DEBOUNCE_MS = 500

// ===== 接口定义 =====

export interface UseFormulaManagerOptions {
  maxFormulas?: number
  autoSave?: boolean
  storageKey?: string
  /** 自定义 EventBus 实例（可选，默认使用全局实例） */
  eventBusInstance?: IEventBus
}

export interface FormulaStatistics {
  totalCount: number
  expandedCount: number
  filteredCount: number
  averageConfidence: number
  totalIngredients: number
  lastUpdated: Date | null
}

export interface FormulaComparisonResult {
  formula1Id: string
  formula2Id: string
  similarityScore: number           // 相似度 (0-1)
  commonIngredients: string[]       // 共同成分
  uniqueToFormula1: string[]        // 配方1独有成分
  uniqueToFormula2: string[]        // 配方2独有成分
  confidenceDiff: number            // 置信度差异
  ingredientOverlapRatio: number    // 成分重叠比例
}

export interface FormulaScore {
  id: string
  overallScore: number              // 综合评分 (0-100)
  confidenceScore: number          // 置信度得分
  completenessScore: number         // 完整性得分
  ingredientDiversityScore: number  // 成分多样性得分
  qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F' // 质量等级
  recommendations: string[]        // 改进建议
}

export interface FormulaVersion {
  version: number
  timestamp: Date
  changes: Partial<AIRecognizedFormula>
  changeReason?: string
  author?: string
}

export interface ImportedFormula {
  id: string
  name: string
  [key: string]: unknown
}

/** v7.0 增强返回接口 */
export interface UseFormulaManagerReturn {
  // 状态
  formulas: AIRecognizedFormula[]
  formulaIndex: Map<string, AIRecognizedFormula>
  formulaCount: number
  expandedIds: Set<string>
  searchQuery: string
  isLoading: boolean

  // CRUD 操作
  addFormula: (formula: AIRecognizedFormula) => void
  addFormulas: (formulas: AIRecognizedFormula[]) => void
  removeFormula: (id: string) => void
  updateFormula: (id: string, updates: Partial<AIRecognizedFormula>) => void
  getFormulaById: (id: string) => AIRecognizedFormula | undefined
  clearAllFormulas: () => void
  /** v8.3 新增：仅清空内存缓存（不动本地存储） */
  clearMemoryCache: () => void
  /** v8.5：持久化失败原因（null=无错误），UI 应据此给用户可见提示 */
  storageError: FormulaSaveFailureReason | null
  clearStorageError: () => void
  /** v8.5：撤销最近一次批量删除，返回恢复条数（-1=无可撤销项） */
  undoBatchDelete: () => number
  /** v8.5：是否存在可撤销的批量删除 */
  canUndoBatchDelete: boolean
  /** v8.5：批量删除因超限被拒时记录被拒条数（null=无），UI 应提示分批 */
  batchLimitExceeded: number | null
  clearBatchLimitExceeded: () => void
  /** v8.4 新增：带版本快照的用户编辑（内部会先快照改动前原值，再应用 updates） */
  updateFormulaWithVersion: (
    id: string,
    updates: Partial<AIRecognizedFormula>,
    reason?: string,
  ) => void

  // 展开收起
  toggleExpand: (id: string) => void
  isExpanded: (id: string) => boolean
  expandAll: () => void
  collapseAll: () => void

  // 数据表格
  showDetailTable: (formulaId?: string) => void
  closeDetailTable: () => void
  selectedForDetail: AIRecognizedFormula | null
  isDetailModalOpen: boolean

  // 搜索过滤
  setSearchQuery: (query: string) => void
  searchFormulas: (query: string) => AIRecognizedFormula[]
  filterFormulas: (predicate: (f: AIRecognizedFormula) => boolean) => AIRecognizedFormula[]
  getFilteredFormulas: () => AIRecognizedFormula[]

  // 导入导出
  importFormulas: (data: ImportedFormula[]) => number
  exportFormulas: (format?: FormulaExportFormat | string) => Promise<boolean>
  handleImportFromJSON: () => void

  // 统计信息
  getStats: () => FormulaStatistics

  // 分页（大数据量优化）
  currentPage: number
  totalPages: number
  setCurrentPage: (page: number) => void
  getPaginatedFormulas: (pageSize?: number) => AIRecognizedFormula[]

  // v7.0 新增：批量操作
  batchDelete: (ids: string[]) => void
  batchExport: (ids: string[], format?: FormulaExportFormat) => Promise<boolean>
  selectFormula: (id: string, selected: boolean) => void
  selectAll: () => void
  clearSelection: () => void
  getSelectedCount: () => number
  selectedIds: Set<string>

  // v7.0 新增：事件订阅辅助方法
  onFormulasChanged: (handler: (formulas: AIRecognizedFormula[]) => void) => UnsubscribeFn

  // v7.1 新增：高级功能

  // 配方对比分析
  compareFormulas: (id1: string, id2: string) => FormulaComparisonResult | null
  findSimilarFormulas: (id: string, threshold?: number) => { formula: AIRecognizedFormula; similarity: number }[]

  // 智能标签系统
  addTag: (formulaId: string, tag: string) => void
  removeTag: (formulaId: string, tag: string) => void
  getTags: (formulaId: string) => string[]
  getAllTags: () => string[]
  getFormulasByTag: (tag: string) => AIRecognizedFormula[]
  autoClassify: () => void

  // 配方评分引擎
  scoreFormula: (formulaId: string) => FormulaScore | null
  scoreAllFormulas: () => FormulaScore[]
  getTopRatedFormulas: (count?: number) => AIRecognizedFormula[]

  // 版本历史追踪
  createVersion: (formulaId: string, changes: Partial<AIRecognizedFormula>, reason?: string) => void
  getVersionHistory: (formulaId: string) => FormulaVersion[]
  rollbackToVersion: (formulaId: string, version: number) => boolean

  // 收藏夹和优先级管理
  toggleFavorite: (formulaId: string) => void
  isFavorite: (formulaId: string) => boolean
  getFavorites: () => AIRecognizedFormula[]
  setPriority: (formulaId: string, priority: 'high' | 'medium' | 'low') => void
  getByPriority: (priority?: string) => AIRecognizedFormula[]

  // 批量操作增强
  batchTag: (ids: string[], tags: string[]) => void
  batchUpdate: (ids: string[], updates: Partial<AIRecognizedFormula>) => void
  batchFavorite: (ids: string[], favorite: boolean) => void

  // 数据验证和质量检查
  validateFormula: (formulaId: string) => { isValid: boolean; errors: string[]; warnings: string[] }
  validateAllFormulas: () => Map<string, { isValid: boolean; errors: string[] }>
  getDataQualityReport: () => { totalIssues: number; issuesByType: Record<string, number> }

  // 导出模板自定义
  exportWithTemplate: (format: FormulaExportFormat, template: Record<string, unknown>) => Promise<boolean>

  // v8.0 新增：智能命名引擎
  namingEngineEnabled: boolean
  setNamingEngineEnabled: (enabled: boolean) => void
  renameFormula: (id: string, name?: string) => void
  batchRename: (ids: string[]) => void

  // v8.0 新增：高级筛选排序
  filters: FormulaFilters
  setFilters: (filters: FormulaFilters) => void
  applyFilters: (newFilters: FormulaFilters) => void
  sortBy: FormulaSortField
  sortOrder: SortOrder
  setSortBy: (field: FormulaSortField) => void
  setSortOrder: (order: SortOrder) => void
  sortFormulas: (field: FormulaSortField, order: SortOrder) => void

  // v8.0 新增：质量评分增强版
  getFormulaScore: (id: string) => FormulaQualityScore
}

// ===== Hook 实现 =====

export function useFormulaManager(options: UseFormulaManagerOptions = {}): UseFormulaManagerReturn {
  const {
    maxFormulas = DEFAULT_MAX_FORMULAS,
    autoSave = true,
    eventBusInstance,
  } = options

  // 使用传入的 eventBus 实例或全局实例
  const bus = eventBusInstance || eventBus

  // ===== 核心状态 =====

  const [formulaIndex, setFormulaIndex] = useState<Map<string, AIRecognizedFormula>>(new Map())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQueryState] = useState('')
  const [selectedForDetail, setSelectedForDetail] = useState<AIRecognizedFormula | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  // v7.0 新增：选择状态（用于批量操作）
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // v7.1 新增：高级功能状态
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [priorities, setPriorities] = useState<Map<string, 'high' | 'medium' | 'low'>>(new Map())
  const [versionHistory, setVersionHistory] = useState<Map<string, FormulaVersion[]>>(new Map())
  // v8.5：持久化失败原因，供 UI 给用户可见提示（原仅 logger，用户以为已存，刷新即丢）
  const [storageError, setStorageError] = useState<FormulaSaveFailureReason | null>(null)
  const [formulaTags, setFormulaTags] = useState<Map<string, string[]>>(new Map())

  // v8.0 新增：智能命名引擎与筛选排序状态
  const [namingEngineEnabled, setNamingEngineEnabled] = useState<boolean>(true)
  const [filters, setFilters] = useState<FormulaFilters>({})
  const [sortBy, setSortBy] = useState<FormulaSortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // ===== Refs =====

  /** v8.4：createVersion 的 ref 转发，供声明位置更靠前的 addTag/removeTag 记版本快照 */
  const createVersionRef = useRef<((id: string, changes: Partial<AIRecognizedFormula>, reason?: string) => void) | null>(null)

  const formulaCacheRef = useRef<Map<string, AIRecognizedFormula>>(new Map())
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)
  const handlersRef = useRef<Map<string, (formulas: AIRecognizedFormula[]) => void>>(new Map())

  // ===== 计算属性 =====

  const formulaCount = useMemo(() => formulaIndex.size, [formulaIndex])

  const formulas = useMemo(() => Array.from(formulaIndex.values()), [formulaIndex])

  const filteredFormulas = useMemo(() => {
    if (!searchQuery.trim()) {
      return formulas
    }

    return formulas.filter(formula =>
      smartMatch(formula.name || '', searchQuery) ||
      formula.ingredients?.some(ing =>
        smartMatch(ing.name || '', searchQuery),
      ),
    )
  }, [formulas, searchQuery])

  const totalPages = Math.ceil(filteredFormulas.length / 15)

  // ===== v7.0: EventBus 事件订阅集成 =====

  useEffect(() => {
    // 契约修复：payload 类型与 eventBus.ts 的 EventPayloadMap['formulas:detected']
    // 统一为 AIRecognizedFormula[]（原为 Record<string, unknown>[]，与发布方脱节）。
    const unsubFormulasDetected = bus.subscribe('formulas:detected', (payload: { formulas?: AIRecognizedFormula[] }) => {
      logger.info('[useFormulaManager] 📡 收到 formulas:detected 事件', {
        formulaCount: payload.formulas?.length || 0,
      })

      if (!payload.formulas || !Array.isArray(payload.formulas)) {
        logger.warn('[useFormulaManager] ⚠️ formulas:detected 事件 payload 格式无效')
        return
      }

      payload.formulas.forEach((detectedFormula) => {
        // 规范化：补齐缺失字段，保证写入 formulaIndex 的对象满足 AIRecognizedFormula
        const formula: AIRecognizedFormula = {
          ...detectedFormula,
          id: detectedFormula.id || `auto-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          name: detectedFormula.name || '',
          ingredientCount: Array.isArray(detectedFormula.ingredients) ? detectedFormula.ingredients.length : 0,
          confidence: typeof detectedFormula.confidence === 'number' ? detectedFormula.confidence : 0,
          sourceMessageId: detectedFormula.sourceMessageId || '',
          parsedAt: detectedFormula.parsedAt instanceof Date ? detectedFormula.parsedAt : new Date(),
          rawData: detectedFormula.rawData || ({} as AIRecognizedFormula['rawData']),
          ingredients: Array.isArray(detectedFormula.ingredients) ? detectedFormula.ingredients : [],
        }

        addFormula(formula)
      })
    })

    // 订阅 formulas:added 事件 - 用于跨组件状态同步
    const unsubFormulasAdded = bus.subscribe('formulas:added', (payload) => {
      logger.debug('[useFormulaManager] 🔗 收到 formulas:added 事件（跨组件同步）', {
        formulaName: payload.formulaName,
      })

      // 触发所有注册的变更处理器
      handlersRef.current.forEach((handler) => {
        try {
          handler(formulas)
        } catch (e) {
          logger.error('[useFormulaManager] ❌ 变更处理器执行失败:', e)
        }
      })
    })

    logger.info('[useFormulaManager] ✅ EventBus 事件订阅已建立')

    return () => {
      unsubFormulasDetected()
      unsubFormulasAdded()
      logger.info('[useFormulaManager] 🔌 EventBus 事件订阅已清理')
    }
  }, [bus])

  // ===== 挂载/卸载处理 =====

  useEffect(() => {
    isMountedRef.current = true

    if (autoSave && isStorageAvailable()) {
      const savedIndex = loadFormulaIndex()
      if (savedIndex && savedIndex.size > 0) {
        setFormulaIndex(savedIndex)
        formulaCacheRef.current = savedIndex
        logger.info(`[FormulaManager] 📂 已从本地存储加载 ${savedIndex.size} 个配方`)

        // v8.2 修复：从持久化的 formulaIndex 重建 favorites / priorities，
        // 否则刷新后 formula.isFavorite / formula.priority 仍在、但内部 Set/Map 为空，
        // 导致「已收藏」点不动、批量收藏误判、按优先级查询失效等状态不一致。
        const restoredFavorites = new Set<string>()
        const restoredPriorities = new Map<string, 'high' | 'medium' | 'low'>()
        savedIndex.forEach((f) => {
          if (f.isFavorite) restoredFavorites.add(f.id)
          if (f.priority) restoredPriorities.set(f.id, f.priority)
        })
        if (restoredFavorites.size > 0) setFavorites(restoredFavorites)
        if (restoredPriorities.size > 0) setPriorities(restoredPriorities)

        // v8.2 修复：恢复版本历史（此前完全未持久化，刷新即丢）
        const storedVersions = loadFormulaVersionHistory()
        if (storedVersions.length > 0) {
          const restoredHistory = new Map<string, FormulaVersion[]>()
          storedVersions.forEach((entry) => {
            const versions: FormulaVersion[] = entry.versions.map((v) => ({
              version: v.version,
              // v8.4 加固：坏时间戳（null/NaN/非法字符串）不能污染 UI 成「Invalid Date」
              timestamp: isValidTimestamp(v.timestamp) ? new Date(v.timestamp) : new Date(),
              changes: v.changes as Partial<AIRecognizedFormula>,
              changeReason: v.changeReason,
              author: v.author,
            }))
            if (versions.length > 0) restoredHistory.set(entry.id, versions)
          })
          if (restoredHistory.size > 0) setVersionHistory(restoredHistory)
        }
      }
    }

    return () => {
      isMountedRef.current = false
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current)
      }
      if (updateDebounceRef.current) {
        clearTimeout(updateDebounceRef.current)
      }
    }
  }, [autoSave])

  // 自动保存到 localStorage（v8.2：版本历史变化时也保存，保证刷新后不丢）
  const versionHistoryRef = useRef(versionHistory)
  versionHistoryRef.current = versionHistory
  useEffect(() => {
    if (autoSave && formulaIndex.size > 0 && isStorageAvailable()) {
      debouncedSaveToStorage(formulaIndex)
    }
  }, [formulaIndex, versionHistory, autoSave])

  // 搜索变化时重置分页
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, formulaIndex.size])

  // ===== 内部工具函数 =====

  const debouncedSaveToStorage = useCallback((index: Map<string, AIRecognizedFormula>) => {
    if (!isStorageAvailable() || !autoSave) return

    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current)
    }

    saveDebounceRef.current = setTimeout(() => {
      // v8.2：版本历史一并落盘（Map → 可序列化数组，timestamp 转毫秒）
      const storedVersions: StoredVersionHistory[] = Array.from(versionHistoryRef.current.entries())
        .filter(([, versions]) => versions.length > 0)
        .map(([id, versions]) => ({
          id,
          versions: versions.map((v) => ({
            version: v.version,
            timestamp: v.timestamp instanceof Date ? v.timestamp.getTime() : Number(v.timestamp),
            changes: v.changes as Record<string, unknown>,
            changeReason: v.changeReason,
            author: v.author,
          })),
        }))

      const failure = saveFormulaIndexWithReason(index, storedVersions)
      if (failure) {
        setStorageError(failure)
        logger.error(`[FormulaManager] ❌ 配方自动保存失败: ${failure}`)
      } else {
        setStorageError(null)
        logger.info(`[FormulaManager] 💾 配方数据已自动保存 (${index.size} 个)`)
      }
      saveDebounceRef.current = null
    }, SAVE_DEBOUNCE_MS)
  }, [autoSave])

  // ===== CRUD 操作（v7.0 增强版）=====

  /**
   * 添加配方到管理器（带去重逻辑和事件发布）
   * v8.0 增强：自动生成名称 + 质量评分计算
   */
  const addFormula = useCallback((formula: AIRecognizedFormula): void => {
    if (!formula?.id) {
      logger.warn('[FormulaManager] ⚠️ 无效的配方数据，跳过添加')
      return
    }

    if (!isMountedRef.current) return

    setFormulaIndex(prevIndex => {
      // v7.0 增强去重逻辑
      if (prevIndex.has(formula.id)) {
        logger.warn(`[FormulaManager] ⚠️ 配方已存在，跳过添加: ${formula.id}`)
        return prevIndex
      }

      // v8.0: 自动生成名称（如果启用且原名称无效）
      const enhancedFormula = { ...formula }
      if (namingEngineEnabled && (!formula.name || formula.name.includes('未命名'))) {
        const existingNames = Array.from(prevIndex.values()).map(f => f.autoName || f.name || '')
        enhancedFormula.autoName = generateFormulaName(formula, existingNames)
        logger.info(`[FormulaManager] 🤖 智能命名引擎已生成名称: ${enhancedFormula.autoName}`)
      }

      // v8.0: 计算质量评分
      const qualityScoreResult = calculateQualityScore(enhancedFormula)
      enhancedFormula.qualityScore = qualityScoreResult.overallScore
      enhancedFormula.qualityGrade = qualityScoreResult.qualityGrade

      // v8.0: 设置时间戳和版本号
      const now = Date.now()
      enhancedFormula.createdAt = formula.createdAt || now
      enhancedFormula.updatedAt = now
      enhancedFormula.version = (formula.version || 0) + 1

      const newIndex = new Map(prevIndex)
      newIndex.set(formula.id, {
        ...enhancedFormula,
        parsedAt: formula.parsedAt || new Date(),
      })

      formulaCacheRef.current.set(formula.id, newIndex.get(formula.id)!)

      // LRU淘汰策略
      if (newIndex.size > maxFormulas) {
        let oldestKey: string | null = null
        let oldestTime = Date.now()

        for (const [key, value] of newIndex.entries()) {
          if ((value.createdAt || value.parsedAt.getTime()) < oldestTime) {
            oldestTime = value.createdAt || value.parsedAt.getTime()
            oldestKey = key
          }
        }

        if (oldestKey) {
          logger.info(`[FormulaManager] 🗑️ LRU淘汰: 移除最旧的配方 ${oldestKey} (当前缓存大小: ${newIndex.size})`)
          newIndex.delete(oldestKey)
          formulaCacheRef.current.delete(oldestKey)

          setExpandedIds(prev => {
            const newSet = new Set(prev)
            newSet.delete(oldestKey)
            return newSet
          })

          // 同步清除选择状态
          setSelectedIds(prev => {
            const newSet = new Set(prev)
            newSet.delete(oldestKey)
            return newSet
          })
        }
      }

      // v7.0: 发布 formulas:added 事件（通知其他组件）
      bus.emit('formulas:added', {
        formulaName: enhancedFormula.name || enhancedFormula.autoName || '',
        formulaData: enhancedFormula,
      })

      logger.info(`[FormulaManager] ➕ 添加配方成功`, {
        formulaId: formula.id,
        formulaName: enhancedFormula.name || enhancedFormula.autoName,
        totalFormulas: newIndex.size,
        qualityScore: enhancedFormula.qualityScore,
        qualityGrade: enhancedFormula.qualityGrade,
      })

      return newIndex
    })
  }, [maxFormulas, bus, namingEngineEnabled])

  const addFormulas = useCallback((formulas: AIRecognizedFormula[]): void => {
    if (!Array.isArray(formulas) || formulas.length === 0) {
      logger.warn('[FormulaManager] ⚠️ 无效的配方数组，跳过批量添加')
      return
    }

    setIsLoading(true)
    const validFormulas = formulas.filter(f => f && f.id)

    if (validFormulas.length < formulas.length) {
      logger.info(`[FormulaManager] ℹ️ 过滤掉 ${formulas.length - validFormulas.length} 个无效配方`)
    }

    if (updateDebounceRef.current) {
      clearTimeout(updateDebounceRef.current)
    }

    updateDebounceRef.current = setTimeout(() => {
      validFormulas.forEach(formula => addFormula(formula))
      updateDebounceRef.current = null
      setIsLoading(false)
    }, UPDATE_DEBOUNCE_MS)
  }, [addFormula])

  const removeFormula = useCallback((id: string): void => {
    if (!id || typeof id !== 'string') {
      logger.warn('[FormulaManager] ⚠️ 无效的配方ID，无法删除')
      return
    }

    if (!isMountedRef.current) return

    setFormulaIndex(prevIndex => {
      if (!prevIndex.has(id)) {
        logger.warn('[FormulaManager] ⚠️ 配方不存在，无法删除:', { formulaId: id })
        return prevIndex
      }

      const newIndex = new Map(prevIndex)
      newIndex.delete(id)
      formulaCacheRef.current.delete(id)

      setExpandedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })

      // 清除选择状态
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })

      // v8.2 修复：同步清理该配方的收藏/优先级/版本历史/标签，避免残留脏数据
      setFavorites(prev => {
        if (!prev.has(id)) return prev
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
      setPriorities(prev => {
        if (!prev.has(id)) return prev
        const newMap = new Map(prev)
        newMap.delete(id)
        return newMap
      })
      setVersionHistory(prev => {
        if (!prev.has(id)) return prev
        const newMap = new Map(prev)
        newMap.delete(id)
        return newMap
      })
      setFormulaTags(prev => {
        if (!prev.has(id)) return prev
        const newMap = new Map(prev)
        newMap.delete(id)
        return newMap
      })

      if (selectedForDetail?.id === id) {
        setSelectedForDetail(null)
        setIsDetailModalOpen(false)
      }

      logger.info(`[FormulaManager] 🗑️ 删除配方成功`, { formulaId: id, remainingCount: newIndex.size })
      return newIndex
    })
  }, [selectedForDetail])

  const updateFormula = useCallback((id: string, updates: Partial<AIRecognizedFormula>): void => {
    if (!id || !updates) {
      logger.warn('[FormulaManager] ⚠️ 参数无效，无法更新配方')
      return
    }

    if (!isMountedRef.current) return

    setFormulaIndex(prevIndex => {
      if (!prevIndex.has(id)) {
        logger.warn('[FormulaManager] ⚠️ 配方不存在，无法更新:', { formulaId: id })
        return prevIndex
      }

      const existing = prevIndex.get(id)!
      const updated = { ...existing, ...updates }
      const newIndex = new Map(prevIndex)
      newIndex.set(id, updated)
      formulaCacheRef.current.set(id, updated)

      if (selectedForDetail?.id === id) {
        setSelectedForDetail(updated)
      }

      logger.info(`[FormulaManager] ✏️ 更新配方成功`, { formulaId: id })
      return newIndex
    })
  }, [selectedForDetail])

  const getFormulaById = useCallback((id: string): AIRecognizedFormula | undefined => {
    if (!id) return undefined
    return formulaIndex.get(id)
  }, [formulaIndex])

  const clearAllFormulas = useCallback((): void => {
    if (!isMountedRef.current) return

    if (autoSave) {
      clearFormulaStorage()
    }

    setFormulaIndex(new Map())
    setExpandedIds(new Set())
    setSearchQueryState('')
    setSelectedForDetail(null)
    setIsDetailModalOpen(false)
    setCurrentPage(1)
    formulaCacheRef.current.clear()

    // v7.0: 清除选择状态
    setSelectedIds(new Set())

    // v8.2 修复：清除辅助状态，避免"清空后仍显示已收藏/优先级/版本"的脏数据
    setFavorites(new Set())
    setPriorities(new Map())
    setVersionHistory(new Map())
    setFormulaTags(new Map())

    logger.info('[FormulaManager] 🗑️ 已清除所有配方数据和本地存储')
  }, [autoSave])

  /**
   * v8.3 新增：仅清空内存缓存（不动 localStorage）
   * 与 clearAllFormulas 语义区分：本方法用于"释放内存"，用户刷新后仍可从本地存储恢复，
   * 避免此前面板「清空内存缓存」误接 clearAllFormulas 导致持久化数据被一并删除。
   */
  const clearMemoryCache = useCallback((): void => {
    if (!isMountedRef.current) return

    setFormulaIndex(new Map())
    formulaCacheRef.current.clear()
    setExpandedIds(new Set())
    setSelectedIds(new Set())
    setFavorites(new Set())
    setPriorities(new Map())
    setFormulaTags(new Map())
    setSelectedForDetail(null)
    setIsDetailModalOpen(false)
    setCurrentPage(1)

    logger.info('[FormulaManager] 🧹 已清空内存缓存（本地存储保留）')
  }, [])

  // ===== 展开收起操作 =====

  const toggleExpand = useCallback((id: string): void => {
    if (!id) return

    setExpandedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }, [])

  const isExpanded = useCallback((id: string): boolean => {
    return expandedIds.has(id)
  }, [expandedIds])

  const expandAll = useCallback((): void => {
    setExpandedIds(new Set(formulaIndex.keys()))
  }, [formulaIndex])

  const collapseAll = useCallback((): void => {
    setExpandedIds(new Set())
  }, [])

  // ===== 数据表格操作 =====

  const showDetailTable = useCallback((formulaId?: string): void => {
    if (formulaId) {
      const formula = formulaIndex.get(formulaId)

      if (!formula) {
        logger.warn('[FormulaManager] ⚠️ 配方不存在，无法打开数据表格:', { formulaId })
        return
      }

      setSelectedForDetail(formula)
      setIsDetailModalOpen(true)
      logger.info('[FormulaManager] 📊 打开数据表格:', {
        formulaId,
        formulaName: formula.name,
        ingredientCount: formula.ingredients?.length || 0,
      })
    } else if (formulas.length > 0) {
      const latestFormula = formulas[formulas.length - 1]
      setSelectedForDetail(latestFormula)
      setIsDetailModalOpen(true)
      logger.info('[FormulaManager] 📊 打开最新配方数据表格:', {
        formulaId: latestFormula.id,
        formulaName: latestFormula.name,
      })
    } else {
      logger.warn('[FormulaManager] ⚠️ 没有可显示的配方')
    }
  }, [formulaIndex, formulas])

  const closeDetailTable = useCallback((): void => {
    setIsDetailModalOpen(false)
    setSelectedForDetail(null)
  }, [])

  // ===== 搜索过滤操作 =====

  const setSearchQuery = useCallback((query: string): void => {
    setSearchQueryState(query)
  }, [])

  const searchFormulas = useCallback((query: string): AIRecognizedFormula[] => {
    if (!query.trim()) {
      return formulas
    }

    return formulas.filter(formula =>
      smartMatch(formula.name || '', query) ||
      formula.ingredients?.some(ing =>
        smartMatch(ing.name || '', query),
      ),
    )
  }, [formulas])

  const filterFormulas = useCallback((
    predicate: (f: AIRecognizedFormula) => boolean,
  ): AIRecognizedFormula[] => {
    if (typeof predicate !== 'function') {
      logger.warn('[FormulaManager] ⚠️ 过滤函数无效')
      return formulas
    }

    return formulas.filter(predicate)
  }, [formulas])

  const getFilteredFormulas = useCallback((): AIRecognizedFormula[] => {
    return filteredFormulas
  }, [filteredFormulas])

  // ===== 导入导出操作 =====

  const importFormulas = useCallback((data: ImportedFormula[]): number => {
    if (!Array.isArray(data) || data.length === 0) {
      logger.warn('[FormulaManager] ⚠️ 导入数据为空')
      return 0
    }

    try {
      // v8.4 修复：a) id 已存在则跳过（导入不覆盖本地更新）；b) 同名同成分视为重复；
      // c) 返回「真正新增」的条数（此前返回 data.length，与事实不符，用户无法判断导入结果）。
      const existingIds = new Set(formulaIndex.keys())
      const signature = (f: { name?: string; autoName?: string; ingredients?: { name?: string }[] }) => {
        const name = (f.autoName || f.name || '').trim()
        const names = (f.ingredients || [])
          .map((ing) => (ing.name || '').trim())
          .filter(Boolean)
          .sort()
          .join('|')
        return `${name}__${names}`
      }
      const existingSignatures = new Set(
        Array.from(formulaIndex.values()).map((f) => signature(f)),
      )

      let imported = 0
      data.forEach((item) => {
        if (!item || !item.id) return
        // a) id 已存在则跳过（不覆盖本地可能更新的版本）
        if (existingIds.has(item.id)) return
        const candidate = item as unknown as AIRecognizedFormula
        // b) 同名同成分视为同一条配方（跨设备导出再导入的常见情形）
        const sig = signature(candidate)
        if (existingSignatures.has(sig)) return

        existingIds.add(item.id)
        existingSignatures.add(sig)
        addFormula(candidate)
        imported += 1
      })

      logger.info(`[FormulaManager] 📥 导入完成：新增 ${imported} / 共 ${data.length} 条`)
      return imported
    } catch (e) {
      logger.error('[FormulaManager] ❌ 导入失败:', e)
      return 0
    }
  }, [addFormula, formulaIndex])

  const exportFormulas = useCallback(async (
    format: FormulaExportFormat | string = 'json',
  ): Promise<boolean> => {
    try {
      if (formulaIndex.size === 0) {
        logger.warn('[FormulaManager] ⚠️ 没有可导出的配方数据')
        return false
      }

      const success = await exportFormulasUtil(formulaIndex, {
        format: format as FormulaExportFormat,
        includeMetadata: true,
        includeIngredients: true,
        title: `RMFOOD 配方列表 (${formulaIndex.size}个)`,
      })

      if (success) {
        logger.info(`[FormulaManager] 📤 已导出 ${formulaIndex.size} 个配方为 ${format.toUpperCase()} 格式`)
      }

      return success
    } catch (e) {
      logger.error('[FormulaManager] ❌ 导出失败:', e)
      return false
    }
  }, [formulaIndex])

  const handleImportFromJSON = useCallback((): void => {
    try {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return

        try {
          const text = await file.text()
          const success = importFormulaData(text)

          if (success) {
            const newIndex = loadFormulaIndex()
            if (newIndex && newIndex.size > 0) {
              setFormulaIndex(newIndex)
              formulaCacheRef.current = newIndex
              logger.info(`[FormulaManager] 📥 成功导入 ${newIndex.size} 个配方`)
            }
          } else {
            logger.error('[FormulaManager] ❌ 导入失败：数据格式无效或已损坏')
          }
        } catch (err) {
          logger.error('[FormulaManager] ❌ 文件读取失败:', err)
        }
      }

      input.click()
    } catch (e) {
      logger.error('[FormulaManager] ❌ 导入操作失败:', e)
    }
  }, [])

  // ===== 统计信息 =====

  const getStats = useCallback((): FormulaStatistics => {
    const allFormulas = formulas
    const totalIngredients = allFormulas.reduce(
      (sum, f) => sum + (f.ingredients?.length || 0), 0,
    )
    const avgConfidence = allFormulas.length > 0
      ? allFormulas.reduce((sum, f) => sum + (f.confidence || 0), 0) / allFormulas.length
      : 0

    const sortedByDate = [...allFormulas].sort(
      (a, b) => (b.parsedAt?.getTime() || 0) - (a.parsedAt?.getTime() || 0),
    )
    const lastUpdated = sortedByDate.length > 0 ? sortedByDate[0]?.parsedAt ?? null : null

    return {
      totalCount: allFormulas.length,
      expandedCount: expandedIds.size,
      filteredCount: filteredFormulas.length,
      averageConfidence: Math.round(avgConfidence * 100) / 100,
      totalIngredients,
      lastUpdated,
    }
  }, [formulas, expandedIds, filteredFormulas])

  // ===== 分页操作 =====

  const getPaginatedFormulas = useCallback((pageSize = 15): AIRecognizedFormula[] => {
    if (filteredFormulas.length <= pageSize) {
      return filteredFormulas
    }

    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredFormulas.slice(startIndex, endIndex)
  }, [filteredFormulas, currentPage])

  // ===== v7.0: 批量操作方法 =====

  /**
   * 批量删除多个配方
   */
  // v8.5：批量操作上限——超过阈值拒绝一次性删除，避免数百条硬删卡死主线程且无法恢复
  const BATCH_DELETE_HARD_LIMIT = 200
  // v8.5：记录最近一次批量删除的完整配方快照，供撤销恢复
  const [lastBatchDeleted, setLastBatchDeleted] = useState<{
    formulas: AIRecognizedFormula[]
    favIds: Set<string>
    prioEntries: Array<[string, 'high' | 'medium' | 'low']>
    deletedAt: number
  } | null>(null)

  /** v8.5：批量删除是否因超限被拒绝（记录被拒条数），供 UI 提示用户分批 */
  const [batchLimitExceeded, setBatchLimitExceeded] = useState<number | null>(null)

  const batchDelete = useCallback((ids: string[]): void => {
    if (!Array.isArray(ids) || ids.length === 0) {
      logger.warn('[FormulaManager] ⚠️ 批量删除：无效的ID列表')
      return
    }

    // v8.5 上限保护：超限直接拒绝，并记录原因供 UI 提示用户分批操作
    if (ids.length > BATCH_DELETE_HARD_LIMIT) {
      logger.error(`[FormulaManager] ❌ 批量删除被拒绝：一次最多删除 ${BATCH_DELETE_HARD_LIMIT} 条（当前 ${ids.length} 条）`)
      setBatchLimitExceeded(ids.length)
      return
    }
    setBatchLimitExceeded(null)

    setIsLoading(true)

    // v8.5 撤销支持：删除前保留完整快照（含 isFavorite/priority/tags 等），供 undoBatchDelete 恢复
    const snapshot: AIRecognizedFormula[] = []
    // 派生集合（favorites/priorities）的成员关系必须单独捕获——removeFormula 会把它们从
    // Set/Map 里摘掉，而 addFormula 只还原对象、不还原派生集合，否则撤销后卡片显示与逻辑不一致。
    const favIds = new Set<string>()
    const prioEntries: Array<[string, 'high' | 'medium' | 'low']> = []
    ids.forEach((id) => {
      const existing = formulaIndex.get(id)
      if (existing) {
        snapshot.push(existing)
        if (favorites.has(id)) favIds.add(id)
        const prio = priorities.get(id)
        if (prio) prioEntries.push([id, prio])
      }
    })

    ids.forEach(id => {
      removeFormula(id)
    })

    setLastBatchDeleted({ formulas: snapshot, favIds, prioEntries, deletedAt: Date.now() })

    // 清除被删除项的选择状态
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      ids.forEach(id => newSet.delete(id))
      return newSet
    })

    logger.info(`[FormulaManager] 🗑️ 批量删除完成`, { deletedCount: ids.length, remainingCount: formulaIndex.size - ids.length })
    setIsLoading(false)
  }, [removeFormula, formulaIndex, formulaIndex.size])

  /**
   * v8.5 新增：撤销最近一次批量删除，按快照恢复配方及其状态。
   * @returns 实际恢复的条数（-1 表示无可撤销项）
   */
  const undoBatchDelete = useCallback((): number => {
    if (!lastBatchDeleted || lastBatchDeleted.formulas.length === 0) {
      logger.warn('[FormulaManager] ⚠️ 撤销批量删除：没有可恢复的记录')
      return -1
    }

    setIsLoading(true)
    let restored = 0
    lastBatchDeleted.formulas.forEach((formula) => {
      // 已存在则跳过，避免覆盖用户在删除后可能新增的同 id 配方
      if (formulaIndex.has(formula.id)) return
      addFormula(formula)
      restored += 1
    })

    // 还原派生集合成员关系（addFormula 只还原对象，不还原 favorites/priorities）
    if (lastBatchDeleted.favIds.size > 0) {
      setFavorites(prev => {
        const next = new Set(prev)
        lastBatchDeleted.favIds.forEach((id) => next.add(id))
        return next
      })
    }
    if (lastBatchDeleted.prioEntries.length > 0) {
      setPriorities(prev => {
        const next = new Map(prev)
        lastBatchDeleted.prioEntries.forEach(([id, prio]) => next.set(id, prio))
        return next
      })
    }

    setLastBatchDeleted(null)
    logger.info(`[FormulaManager] ♻️ 撤销批量删除完成`, { restoredCount: restored })
    setIsLoading(false)
    return restored
  }, [lastBatchDeleted, formulaIndex, addFormula, setFavorites, setPriorities])

  /** v8.5：是否有可撤销的批量删除（UI 据此显示「撤销」入口） */
  const canUndoBatchDelete = lastBatchDeleted !== null && lastBatchDeleted.formulas.length > 0

  /**
   * 批量导出选中的配方
   */
  const batchExport = useCallback(async (
    ids: string[],
    format: FormulaExportFormat = 'json',
  ): Promise<boolean> => {
    if (!Array.isArray(ids) || ids.length === 0) {
      logger.warn('[FormulaManager] ⚠️ 批量导出：无效的ID列表')
      return false
    }

    try {
      // 构建只包含选中配方的临时 Map
      const selectedMap = new Map<string, AIRecognizedFormula>()
      ids.forEach(id => {
        const formula = formulaIndex.get(id)
        if (formula) {
          selectedMap.set(id, formula)
        }
      })

      if (selectedMap.size === 0) {
        logger.warn('[FormulaManager] ⚠️ 批量导出：没有找到有效的配方')
        return false
      }

      const success = await exportFormulasUtil(selectedMap, {
        format,
        includeMetadata: true,
        includeIngredients: true,
        title: `RMFOOD 选中的配方 (${selectedMap.size}个)`,
      })

      if (success) {
        logger.info(`[FormulaManager] 📤 批量导出成功`, { count: selectedMap.size, format: format.toUpperCase() })
        // 发布导出事件
        bus.emit('export:completed', { filePath: '', success: true })
      }

      return success
    } catch (e) {
      logger.error('[FormulaManager] ❌ 批量导出失败:', e)
      return false
    }
  }, [formulaIndex, bus])

  /**
   * 选择或取消选择某个配方
   */
  const selectFormula = useCallback((id: string, selected: boolean): void => {
    if (!id) return

    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(id)
      } else {
        newSet.delete(id)
      }
      return newSet
    })
  }, [])

  /**
   * 全选所有配方
   */
  const selectAll = useCallback((): void => {
    setSelectedIds(new Set(formulaIndex.keys()))
    logger.info(`[FormulaManager] ✅ 全选完成`, { selectedCount: formulaIndex.size })
  }, [formulaIndex])

  /**
   * 清空选择
   */
  const clearSelection = useCallback((): void => {
    setSelectedIds(new Set())
    logger.info('[FormulaManager] 🔄 已清空选择')
  }, [])

  /**
   * 获取当前选中的配方数量
   */
  const getSelectedCount = useCallback((): number => {
    return selectedIds.size
  }, [selectedIds])

  /**
   * 注册配方变更监听器（用于外部组件响应配方变化）
   */
  const onFormulasChanged = useCallback((
    handler: (formulas: AIRecognizedFormula[]) => void,
  ): UnsubscribeFn => {
    const handlerId = `handler_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    handlersRef.current.set(handlerId, handler)

    logger.info('[useFormulaManager] 🔔 已注册配方变更监听器', { handlerId })

    return () => {
      handlersRef.current.delete(handlerId)
      logger.info('[useFormulaManager] 🔕 已移除配方变更监听器', { handlerId })
    }
  }, [])

  // ===== v7.1 高级功能实现 =====

  /**
   * 对比两个配方的相似度
   */
  const compareFormulas = useCallback((id1: string, id2: string): FormulaComparisonResult | null => {
    const f1 = formulaIndex.get(id1)
    const f2 = formulaIndex.get(id2)

    if (!f1 || !f2) {
      logger.warn('[useFormulaManager] ⚠️ 配方对比：配方不存在', { id1, id2 })
      return null
    }

    const ingredients1 = new Set((f1.ingredients || []).map(ing => ing.name))
    const ingredients2 = new Set((f2.ingredients || []).map(ing => ing.name))

    const commonIngredients = [...ingredients1].filter(ing => ingredients2.has(ing))
    const uniqueTo1 = [...ingredients1].filter(ing => !ingredients2.has(ing))
    const uniqueTo2 = [...ingredients2].filter(ing => !ingredients1.has(ing))

    const totalUnique = new Set([...ingredients1, ...ingredients2]).size
    const similarityScore = totalUnique > 0 ? commonIngredients.length / totalUnique : 0
    const overlapRatio = Math.min(ingredients1.size, ingredients2.size) > 0
      ? commonIngredients.length / Math.min(ingredients1.size, ingredients2.size)
      : 0

    return {
      formula1Id: id1,
      formula2Id: id2,
      similarityScore: Math.round(similarityScore * 100) / 100,
      commonIngredients,
      uniqueToFormula1: uniqueTo1,
      uniqueToFormula2: uniqueTo2,
      confidenceDiff: Math.abs((f1.confidence || 0) - (f2.confidence || 0)),
      ingredientOverlapRatio: Math.round(overlapRatio * 100) / 100,
    }
  }, [formulaIndex])

  /**
   * 查找与指定配方相似的配方列表
   */
  const findSimilarFormulas = useCallback((
    id: string,
    threshold = 0.5,
  ): { formula: AIRecognizedFormula; similarity: number }[] => {
    const target = formulaIndex.get(id)
    if (!target) return []

    const targetIngredients = new Set((target.ingredients || []).map(ing => ing.name))
    const results: { formula: AIRecognizedFormula; similarity: number }[] = []

    formulas.forEach(formula => {
      if (formula.id === id) return

      const currentIngredients = new Set((formula.ingredients || []).map(ing => ing.name))
      const common = [...targetIngredients].filter(ing => currentIngredients.has(ing))
      const totalUnique = new Set([...targetIngredients, ...currentIngredients]).size
      const similarity = totalUnique > 0 ? common.length / totalUnique : 0

      if (similarity >= threshold) {
        results.push({ formula, similarity: Math.round(similarity * 100) / 100 })
      }
    })

    return results.sort((a, b) => b.similarity - a.similarity)
  }, [formulaIndex, formulas])

  /**
   * 智能标签系统 - 添加标签
   */
  const addTag = useCallback((formulaId: string, tag: string): void => {
    if (!formulaId || !tag?.trim()) return

    const trimmed = tag.trim()
    // v8.2 修复：以 formula.tags 为真实来源（卡片渲染它），同时同步 formulaTags 索引，
    // 否则「批量标签」写入后卡片看不到任何变化。
    const formula = formulaIndex.get(formulaId)
    const currentTags = formula?.tags ?? []
    if (currentTags.includes(trimmed)) return

    const newTags = [...currentTags, trimmed]
    setFormulaTags(prev => {
      const newMap = new Map(prev)
      newMap.set(formulaId, newTags)
      return newMap
    })
    // v8.4：用户显式打标签，记版本快照（经 ref 调用，规避与 createVersion 的声明顺序冲突）
    createVersionRef.current?.(formulaId, { tags: currentTags }, '添加标签')
    updateFormula(formulaId, { tags: newTags, updatedAt: Date.now() })

    logger.info(`[useFormulaManager] 🏷️ 添加标签: ${trimmed} -> ${formulaId}`)
  }, [formulaIndex, updateFormula])

  /**
   * 移除标签
   */
  const removeTag = useCallback((formulaId: string, tag: string): void => {
    const formula = formulaIndex.get(formulaId)
    const currentTags = formula?.tags ?? []
    if (!currentTags.includes(tag)) return

    const newTags = currentTags.filter(t => t !== tag)

    setFormulaTags(prev => {
      const newMap = new Map(prev)
      if (newTags.length === 0) {
        newMap.delete(formulaId)
      } else {
        newMap.set(formulaId, newTags)
      }
      return newMap
    })
    // v8.4：移除标签同样记版本快照，支持回滚恢复被删掉的标签
    createVersionRef.current?.(formulaId, { tags: currentTags }, '移除标签')
    updateFormula(formulaId, { tags: newTags, updatedAt: Date.now() })
  }, [formulaIndex, updateFormula])

  /**
   * 获取配方的标签
   */
  const getTags = useCallback((formulaId: string): string[] => {
    return formulaIndex.get(formulaId)?.tags ?? formulaTags.get(formulaId) ?? []
  }, [formulaIndex, formulaTags])

  /**
   * 获取所有标签（去重）
   */
  const getAllTags = useCallback((): string[] => {
    const allTags = new Set<string>()
    formulas.forEach(f => (f.tags ?? formulaTags.get(f.id) ?? []).forEach(tag => allTags.add(tag)))
    return Array.from(allTags).sort()
  }, [formulas, formulaTags])

  /**
   * 根据标签获取配方列表
   */
  const getFormulasByTag = useCallback((tag: string): AIRecognizedFormula[] => {
    if (!tag?.trim()) return []
    const target = tag.trim()
    return formulas.filter(f => (f.tags ?? formulaTags.get(f.id) ?? []).includes(target))
  }, [formulas, formulaTags])

  /**
   * 自动分类（基于成分特征）
   */
  const autoClassify = useCallback((): void => {
    const categoryKeywords: Record<string, string[]> = {
      '抗氧化': ['维生素c', '维生素e', '多酚', '花青素', '番茄红素'],
      '蛋白质': ['胶原蛋白', '乳清蛋白', '大豆蛋白', '肽', '氨基酸'],
      '保湿': ['透明质酸', '甘油', '神经酰胺', '角鲨烷'],
      '美白': ['烟酰胺', '熊果苷', 'vc衍生物', '传明酸'],
    }

    formulas.forEach(formula => {
      const ingredientNames = (formula.ingredients || []).map(ing => ing.name.toLowerCase())

      Object.entries(categoryKeywords).forEach(([category, keywords]) => {
        const matchCount: number = keywords.reduce((count: number, keyword: string) =>
          count + (ingredientNames.some(name => name.includes(keyword.toLowerCase())) ? 1 : 0)
        , 0)

        if (matchCount >= 2) {
          addTag(formula.id, category)
        }
      })
    })

    logger.info('[useFormulaManager] 🤖 自动分类完成')
  }, [formulas, addTag])

  /**
   * 配方评分引擎
   */
  const scoreFormula = useCallback((formulaId: string): FormulaScore | null => {
    const formula = formulaIndex.get(formulaId)
    if (!formula) return null

    const confidence = formula.confidence || 0
    const ingredientCount = formula.ingredients?.length || 0
    const hasMetadata = !!formula.rawData && Object.keys(formula.rawData).length > 0
    const hasSource = !!formula.sourceMessageId

    const confidenceScore = Math.round(confidence * 100)
    const completenessScore = Math.round(
      ((hasMetadata ? 25 : 0) +
       (hasSource ? 25 : 0) +
       Math.min(ingredientCount * 5, 50)),
    )
    const diversityScore = Math.round(Math.min(ingredientCount * 3, 100))
    const overallScore = Math.round((confidenceScore + completenessScore + diversityScore) / 3)

    let qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F'
    if (overallScore >= 90) qualityGrade = 'A'
    else if (overallScore >= 75) qualityGrade = 'B'
    else if (overallScore >= 60) qualityGrade = 'C'
    else if (overallScore >= 40) qualityGrade = 'D'

    const recommendations: string[] = []
    if (confidence < 0.7) recommendations.push('建议提高识别置信度')
    if (ingredientCount < 3) recommendations.push('成分数量偏少，建议补充完整')
    if (!hasMetadata) recommendations.push('缺少原始数据，影响可追溯性')

    return {
      id: formulaId,
      overallScore,
      confidenceScore,
      completenessScore,
      ingredientDiversityScore: diversityScore,
      qualityGrade,
      recommendations,
    }
  }, [formulaIndex])

  /**
   * 批量评分所有配方
   */
  const scoreAllFormulas = useCallback((): FormulaScore[] => {
    return formulas.map(f => scoreFormula(f.id)).filter(Boolean) as FormulaScore[]
  }, [formulas, scoreFormula])

  /**
   * 获取最高评分的配方
   */
  const getTopRatedFormulas = useCallback((count = 5): AIRecognizedFormula[] => {
    const scores = scoreAllFormulas()
    scores.sort((a, b) => b.overallScore - a.overallScore)
    return scores.slice(0, count).map(s => formulaIndex.get(s.id)!).filter(Boolean)
  }, [scoreAllFormulas, formulaIndex])

  /**
   * 创建版本快照
   */
  const createVersion = useCallback((
    formulaId: string,
    changes: Partial<AIRecognizedFormula>,
    reason?: string,
  ): void => {
    const formula = formulaIndex.get(formulaId)
    if (!formula) return

    setVersionHistory(prev => {
      const history = prev.get(formulaId) || []
      const newVersion: FormulaVersion = {
        version: history.length + 1,
        timestamp: new Date(),
        changes,
        changeReason: reason,
      }

      const newMap = new Map(prev)
      newMap.set(formulaId, [...history, newVersion])

      logger.info(`[useFormulaManager] 📝 创建版本 v${newVersion.version}: ${formulaId}`, { reason })
      return newMap
    })
  }, [formulaIndex])

  // v8.4：把真实的 createVersion 挂到 ref，供声明位置在前的 addTag/removeTag 记快照
  createVersionRef.current = createVersion

  /**
   * v8.4 新增：带版本快照的用户编辑（底层 updateFormula 不记快照，避免内部批量刷写刷爆历史）
   * 语义：先快照「被本次改动覆盖的字段原值」→ 再应用改动，因此 rollbackToVersion(v) 能真正还原。
   * @param id - 配方 ID
   * @param updates - 要应用的改动
   * @param reason - 变更原因（展示在版本历史里）
   */
  const updateFormulaWithVersion = useCallback((
    id: string,
    updates: Partial<AIRecognizedFormula>,
    reason?: string,
  ): void => {
    const existing = formulaIndex.get(id)
    if (!existing) {
      logger.warn('[useFormulaManager] ⚠️ 版本快照失败：配方不存在', { id })
      return
    }

    const before: Partial<AIRecognizedFormula> = {}
    const changedKeys = Object.keys(updates).filter((key) => key !== 'updatedAt')
    changedKeys.forEach((key) => {
      ;(before as Record<string, unknown>)[key] = (existing as unknown as Record<string, unknown>)[key]
    })

    // 仅当确有字段变化时才记快照，避免"值没变也刷一条历史"
    const hasChange = changedKeys.some(
      (key) => JSON.stringify((existing as unknown as Record<string, unknown>)[key]) !== JSON.stringify((updates as unknown as Record<string, unknown>)[key]),
    )
    if (!hasChange) {
      logger.debug(`[useFormulaManager] 无变更，跳过版本快照: ${id}`)
      return
    }

    createVersion(id, before, reason)
    updateFormula(id, { ...updates, updatedAt: Date.now() })
  }, [formulaIndex, createVersion, updateFormula])

  /**
   * 获取版本历史
   */
  const getVersionHistory = useCallback((formulaId: string): FormulaVersion[] => {
    return versionHistory.get(formulaId) || []
  }, [versionHistory])

  /**
   * 回滚到指定版本
   */
  /**
   * 回滚到指定版本
   *
   * v8.4 累积性语义修正：每条 history[i].changes 记录的是「第 i+1 版改动覆盖字段的改动前原值」。
   * 要还原到「第 version 版改动之前」的完整状态，必须从最新版出发，逆序逐层撤销
   * version、version+1、…、最新版 的每一条快照（每条把对应字段还原成它改动前的值，undefined 则删除该字段）。
   * 若只应用 targetVersion 单条快照，version 之后各版引入的新值会残留在对象上，
   * 得到的并非真正的「version 时刻完整状态」。
   */
  const rollbackToVersion = useCallback((formulaId: string, version: number): boolean => {
    const history = versionHistory.get(formulaId)
    const current = formulaIndex.get(formulaId)
    if (!history || !current || version < 1 || version > history.length) {
      logger.warn('[useFormulaManager] ⚠️ 回滚失败：无效的版本号', { formulaId, version })
      return false
    }

    const restored: AIRecognizedFormula = { ...current }

    // 追踪本次回滚涉及的字段，供派生 Set/Map 同步判断
    let touchFavorite = false
    let touchPriority = false
    let touchTags = false

    // 逆序重放：从最新一条快照逐层撤销到第 version 版快照（含）
    for (let i = history.length - 1; i >= version - 1; i--) {
      const snap = history[i].changes
      Object.entries(snap).forEach(([key, value]) => {
        if (value === undefined) {
          // 改动前该字段不存在 → 回滚时应移除，而不是留成 undefined 键
          delete (restored as unknown as Record<string, unknown>)[key]
        } else {
          ;(restored as unknown as Record<string, unknown>)[key] = value
        }
      })
      if ('isFavorite' in snap) touchFavorite = true
      if ('priority' in snap) touchPriority = true
      if ('tags' in snap) touchTags = true
    }
    restored.updatedAt = Date.now()

    setFormulaIndex(prevIndex => {
      const newIndex = new Map(prevIndex)
      newIndex.set(formulaId, restored)
      formulaCacheRef.current.set(formulaId, restored)
      return newIndex
    })

    // 回滚也要让派生 Set/Map 与主数据一致，否则卡片显示的收藏/优先级会和公式列表不符
    if (touchFavorite) {
      setFavorites(prev => {
        const newSet = new Set(prev)
        if (restored.isFavorite) newSet.add(formulaId)
        else newSet.delete(formulaId)
        return newSet
      })
    }
    if (touchPriority) {
      setPriorities(prev => {
        const newMap = new Map(prev)
        const p = restored.priority
        if (p) newMap.set(formulaId, p)
        else newMap.delete(formulaId)
        return newMap
      })
    }
    if (touchTags) {
      setFormulaTags(prev => {
        const newMap = new Map(prev)
        const t = restored.tags
        if (t && t.length > 0) newMap.set(formulaId, t)
        else newMap.delete(formulaId)
        return newMap
      })
    }

    logger.info(`[useFormulaManager] ⏪ 回滚到版本 v${version}: ${formulaId}`)
    return true
  }, [formulaIndex, versionHistory])

  /**
   * 切换收藏状态
   */
  const toggleFavorite = useCallback((formulaId: string): void => {
    // v8.2 修复：以 formula.isFavorite 为真源（刷新后 favorites Set 可能未恢复，避免点不动）
    const isFav = formulaIndex.get(formulaId)?.isFavorite ?? favorites.has(formulaId)
    setFavorites(prev => {
      const newSet = new Set(prev)
      if (isFav) {
        newSet.delete(formulaId)
        logger.info(`[useFormulaManager] 💔 取消收藏: ${formulaId}`)
      } else {
        newSet.add(formulaId)
        logger.info(`[useFormulaManager] ❤️ 添加收藏: ${formulaId}`)
      }
      return newSet
    })
    // v8.1 修复：同步回写 formulaIndex，使 FormulaCard 的 formula.isFavorite 联动更新 UI
    updateFormulaWithVersion(formulaId, { isFavorite: !isFav }, isFav ? '取消收藏' : '添加收藏')
  }, [formulaIndex, favorites, updateFormula, updateFormulaWithVersion])

  /**
   * 检查是否已收藏
   */
  const isFavorite = useCallback((formulaId: string): boolean => {
    return formulaIndex.get(formulaId)?.isFavorite ?? favorites.has(formulaId)
  }, [formulaIndex, favorites])

  /**
   * 获取所有收藏的配方
   */
  const getFavorites = useCallback((): AIRecognizedFormula[] => {
    return formulas.filter(f => f.isFavorite ?? favorites.has(f.id))
  }, [formulas, favorites])

  /**
   * 设置优先级
   */
  const setPriority = useCallback((
    formulaId: string,
    priority: 'high' | 'medium' | 'low',
  ): void => {
    setPriorities(prev => {
      const newMap = new Map(prev)
      newMap.set(formulaId, priority)
      return newMap
    })
    // v8.2 修复：同步回写 formulaIndex，使卡片 priority 联动更新 UI
    // v8.4：改走 updateFormulaWithVersion，优先级变更也可在版本历史里回滚
    updateFormulaWithVersion(formulaId, { priority }, '设置优先级')
    logger.info(`[useFormulaManager] ⭐ 设置优先级: ${formulaId} -> ${priority}`)
  }, [updateFormula, updateFormulaWithVersion])

  /**
   * 根据优先级获取配方
   */
  const getByPriority = useCallback((priority?: string): AIRecognizedFormula[] => {
    if (!priority) {
      return formulas.filter(f => priorities.has(f.id))
        .sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 }
          return (order[priorities.get(a.id) || 'medium'] ?? 1) - (order[priorities.get(b.id) || 'medium'] ?? 1)
        })
    }

    return formulas.filter(f => priorities.get(f.id) === priority)
  }, [formulas, priorities])

  /**
   * 批量打标签
   */
  const batchTag = useCallback((ids: string[], tags: string[]): void => {
    ids.forEach(id => {
      tags.forEach(tag => addTag(id, tag))
    })
    logger.info(`[useFormulaManager] 🏷️ 批量打标签完成`, { count: ids.length, tags })
  }, [addTag])

  /**
   * 批量更新
   */
  const batchUpdate = useCallback((
    ids: string[],
    updates: Partial<AIRecognizedFormula>,
  ): void => {
    ids.forEach(id => updateFormula(id, updates))
    logger.info(`[useFormulaManager] ✏️ 批量更新完成`, { count: ids.length })
  }, [updateFormula])

  /**
   * 批量收藏/取消收藏
   */
  const batchFavorite = useCallback((ids: string[], favorite: boolean): void => {
    // v8.2 修复：以 formula.isFavorite 为真源，避免内部 favorites Set 与数据不一致导致误判
    ids.forEach(id => {
      const current = formulaIndex.get(id)?.isFavorite ?? favorites.has(id)
      if (current !== favorite) toggleFavorite(id)
    })
  }, [formulaIndex, favorites, toggleFavorite])

  /**
   * 验证单个配方数据质量
   */
  const validateFormula = useCallback((formulaId: string): { isValid: boolean; errors: string[]; warnings: string[] } => {
    const formula = formulaIndex.get(formulaId)
    if (!formula) return { isValid: false, errors: ['配方不存在'], warnings: [] }

    const errors: string[] = []
    const warnings: string[] = []

    if (!formula.name?.trim()) errors.push('配方名称为空')
    if (!formula.ingredients || formula.ingredients.length === 0) errors.push('没有成分数据')
    if (formula.confidence !== undefined && (formula.confidence < 0 || formula.confidence > 1)) warnings.push('置信度超出范围 [0,1]')
    if (formula.ingredients?.some(ing => !ing.name?.trim())) warnings.push('存在未命名的成分')

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }, [formulaIndex])

  /**
   * 验证所有配方
   */
  const validateAllFormulas = useCallback((): Map<string, { isValid: boolean; errors: string[] }> => {
    const results = new Map<string, { isValid: boolean; errors: string[] }>()
    formulas.forEach(f => {
      const validation = validateFormula(f.id)
      results.set(f.id, { isValid: validation.isValid, errors: validation.errors })
    })
    return results
  }, [formulas, validateFormula])

  /**
   * 数据质量报告
   */
  const getDataQualityReport = useCallback(() => {
    const validations = validateAllFormulas()
    let totalIssues = 0
    const issuesByType: Record<string, number> = {}

    validations.forEach(({ errors }) => {
      totalIssues += errors.length
      errors.forEach(error => {
        issuesByType[error] = (issuesByType[error] || 0) + 1
      })
    })

    return { totalIssues, issuesByType }
  }, [validateAllFormulas])

  /**
   * 使用自定义模板导出
   */
  const exportWithTemplate = useCallback(async (
    format: FormulaExportFormat,
    template: Record<string, unknown>,
  ): Promise<boolean> => {
    try {
      const success = await exportFormulasUtil(formulaIndex, {
        format,
        includeMetadata: true,
        includeIngredients: true,
        title: (template.title as string) || `RMFOOD 配方导出 (${formulaIndex.size}个)`,
        customTemplate: template,
      } as Parameters<typeof exportFormulasUtil>[1])

      if (success) {
        logger.info(`[useFormulaManager] 📤 使用模板导出成功`, { format })
      }

      return success
    } catch (e) {
      logger.error('[useFormulaManager] ❌ 模板导出失败:', e)
      return false
    }
  }, [formulaIndex])

  // ===== v8.0 新增：智能命名引擎方法 =====

  /**
   * 为单个配方生成或更新自动名称
   */
  const renameFormula = useCallback((id: string, name?: string): void => {
    if (!id) return

    const formula = formulaIndex.get(id)
    if (!formula) {
      logger.warn('[useFormulaManager] ⚠️ 重命名失败：配方不存在', { id })
      return
    }

    let newName: string
    if (name?.trim()) {
      newName = name.trim()
    } else {
      const existingNames = Array.from(formulaIndex.values())
        .filter(f => f.id !== id)
        .map(f => f.autoName || f.name || '')
      newName = generateFormulaName(formula, existingNames)
    }

    // v8.3：重命名属于用户显式修改，先快照「改动前」的名称再更新，
    // 这样版本历史的「回滚」能真正还原旧名称（此前 createVersion 无任何调用方 → 恒显示"暂无版本记录"）。
    if (formula.autoName !== newName) {
      createVersion(
        id,
        { autoName: formula.autoName, name: formula.name },
        name?.trim() ? '手动重命名' : '智能命名',
      )
    }

    updateFormula(id, { autoName: newName, updatedAt: Date.now() })

    logger.info(`[useFormulaManager] ✏️ 配方重命名成功: ${id} -> ${newName}`)
  }, [formulaIndex, updateFormula, createVersion])

  /**
   * 批量为配方生成名称
   */
  const batchRename = useCallback((ids: string[]): void => {
    if (!Array.isArray(ids) || ids.length === 0) {
      logger.warn('[useFormulaManager] ⚠️ 批量重命名：无效的ID列表')
      return
    }

    setIsLoading(true)
    ids.forEach(id => {
      renameFormula(id)
    })
    setIsLoading(false)
    logger.info(`[useFormulaManager] 📝 批量重命名完成`, { count: ids.length })
  }, [renameFormula])

  // ===== v8.0 新增：质量评分增强版 =====

  /**
   * 获取配方的质量评分详情
   */
  const getFormulaScore = useCallback((id: string): FormulaQualityScore => {
    const formula = formulaIndex.get(id)
    if (!formula) {
      return {
        overallScore: 0,
        confidenceScore: 0,
        completenessScore: 0,
        diversityScore: 0,
        qualityGrade: 'F',
        recommendations: ['配方不存在'],
      }
    }
    return calculateQualityScore(formula)
  }, [formulaIndex])

  // ===== v8.0 新增：高级筛选与排序 =====

  /**
   * 应用筛选条件
   */
  const applyFilters = useCallback((newFilters: FormulaFilters): void => {
    setFilters(newFilters)
    setCurrentPage(1)
    logger.info('[useFormulaManager] 🔍 已应用筛选条件', newFilters)
  }, [])

  /**
   * 排序配方列表
   */
  const sortFormulas = useCallback((field: FormulaSortField, order: SortOrder): void => {
    setSortBy(field)
    setSortOrder(order)
    logger.info(`[useFormulaManager] 📊 排序设置: ${field} ${order}`)
  }, [])

  // ===== 返回值 =====

  return {
    // 状态
    formulas,
    formulaIndex,
    formulaCount,
    expandedIds,
    searchQuery,
    isLoading,

    // CRUD 操作
    addFormula,
    addFormulas,
    removeFormula,
    updateFormula,
    getFormulaById,
    clearAllFormulas,
    clearMemoryCache,
    // v8.4 新增：带版本快照的用户编辑（底层 updateFormula 不记快照）
    updateFormulaWithVersion,
    // v8.5 新增：持久化失败原因与清除方法
    storageError,
    clearStorageError: () => setStorageError(null),
    // v8.5 新增：批量删除上限保护 + 撤销
    undoBatchDelete,
    canUndoBatchDelete,
    batchLimitExceeded,
    clearBatchLimitExceeded: () => setBatchLimitExceeded(null),

    // 展开收起
    toggleExpand,
    isExpanded,
    expandAll,
    collapseAll,

    // 数据表格
    showDetailTable,
    closeDetailTable,
    selectedForDetail,
    isDetailModalOpen,

    // 搜索过滤
    setSearchQuery,
    searchFormulas,
    filterFormulas,
    getFilteredFormulas,

    // 导入导出
    importFormulas,
    exportFormulas,
    handleImportFromJSON,

    // 统计信息
    getStats,

    // 分页
    currentPage,
    totalPages,
    setCurrentPage,
    getPaginatedFormulas,

    // v7.0 新增：批量操作
    batchDelete,
    batchExport,
    selectFormula,
    selectAll,
    clearSelection,
    getSelectedCount,
    selectedIds,

    // v7.0 新增：事件订阅
    onFormulasChanged,

    // v7.1 新增：高级功能

    // 配方对比分析
    compareFormulas,
    findSimilarFormulas,

    // 智能标签系统
    addTag,
    removeTag,
    getTags,
    getAllTags,
    getFormulasByTag,
    autoClassify,

    // 配方评分引擎
    scoreFormula,
    scoreAllFormulas,
    getTopRatedFormulas,

    // 版本历史追踪
    createVersion,
    getVersionHistory,
    rollbackToVersion,

    // 收藏夹和优先级管理
    toggleFavorite,
    isFavorite,
    getFavorites,
    setPriority,
    getByPriority,

    // 批量操作增强
    batchTag,
    batchUpdate,
    batchFavorite,

    // 数据验证和质量检查
    validateFormula,
    validateAllFormulas,
    getDataQualityReport,

    // 导出模板自定义
    exportWithTemplate,

    // v8.0 新增：智能命名引擎
    namingEngineEnabled,
    setNamingEngineEnabled,
    renameFormula,
    batchRename,

    // v8.0 新增：高级筛选排序
    filters,
    setFilters,
    applyFilters,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    sortFormulas,

    // v8.0 新增：质量评分增强版
    getFormulaScore,
  }
}

export default useFormulaManager

/**
 * 为现有配方数据迁移补充新字段（向后兼容）
 * 用于将旧版本数据升级到 v8.0 格式
 *
 * @param formulas - 现有配方数组
 * @returns 补充了新字段的配方数组
 *
 * @example
 * ```ts
 * const oldFormulas = loadOldFormulas()
 * const migratedFormulas = migrateFormulaData(oldFormulas)
 * logger.log(migratedFormulas[0].qualityScore) // 现在有值了
 * ```
 */
export function migrateFormulaData(formulas: AIRecognizedFormula[]): AIRecognizedFormula[] {
  if (!Array.isArray(formulas) || formulas.length === 0) {
    return []
  }

  return formulas.map(formula => {
    if (!formula?.id) return formula

    const now = Date.now()

    // 计算质量评分（如果不存在）
    let qualityScore = formula.qualityScore
    let qualityGrade = formula.qualityGrade

    if (qualityScore === undefined || qualityGrade === undefined) {
      const confidence = formula.confidence || 0
      const ingredientCount = formula.ingredients?.length || 0

      const confidenceScore = Math.round(confidence * 100)
      let completenessScore = 0
      if (formula.name?.trim()) completenessScore += 15
      if (formula.ingredients && formula.ingredients.length > 0) completenessScore += 20
      if (formula.rawData && Object.keys(formula.rawData).length > 2) completenessScore += 15
      if (formula.sourceMessageId) completenessScore += 10

      const diversityScore = Math.round(Math.min(ingredientCount * 4, 100))
      qualityScore = qualityScore ?? Math.round(confidenceScore * 0.3 + completenessScore * 0.35 + diversityScore * 0.35)

      if (qualityGrade === undefined) {
        if (qualityScore >= 90) qualityGrade = 'A'
        else if (qualityScore >= 75) qualityGrade = 'B'
        else if (qualityScore >= 60) qualityGrade = 'C'
        else if (qualityScore >= 40) qualityGrade = 'D'
        else qualityGrade = 'F'
      }
    }

    // 生成自动名称（如果不存在）
    let autoName = formula.autoName
    if (!autoName && (!formula.name || formula.name.includes('未命名'))) {
      autoName = generateFormulaName(formula, [])
    }

    return {
      ...formula,

      // 设置默认值（如果不存在）
      autoName: autoName ?? formula.autoName,
      qualityScore,
      qualityGrade,
      tags: formula.tags ?? [],
      efficacy: formula.efficacy ?? '',
      targetAudience: formula.targetAudience ?? [],
      recommendedDosage: formula.recommendedDosage ?? '',
      contraindications: formula.contraindications ?? '',
      userNotes: formula.userNotes ?? '',
      isFavorite: formula.isFavorite ?? false,
      createdAt: formula.createdAt ?? now,
      updatedAt: formula.updatedAt ?? now,
      version: formula.version ?? 1,
    }
  })
}

import { logger } from '@/utils/safeLogger'
import type { AIRecognizedFormula } from '@/types/ai.types'

const FORMULA_STORAGE_KEY = 'rmfood_ai_formula_index'
const FORMULA_STORAGE_VERSION = '1.1.0'
const MAX_STORAGE_SIZE = 5 * 1024 * 1024 // 5MB限制

/** 可序列化的版本记录（timestamp 用毫秒数，避免 JSON 往返丢类型） */
export interface StoredFormulaVersion {
  version: number
  timestamp: number
  changes: Record<string, unknown>
  changeReason?: string
  author?: string
}

/** 按配方 id 分组的版本历史 */
export interface StoredVersionHistory {
  id: string
  versions: StoredFormulaVersion[]
}

export interface FormulaStorageData {
  version: string
  timestamp: number
  formulas: AIRecognizedFormula[]
  /** v1.1.0 新增：版本历史（可选，旧数据无此字段） */
  versionHistory?: StoredVersionHistory[]
  metadata: {
    totalCount: number
    lastUpdated: string
  }
}

export interface StorageInfo {
  size: number
  count: number
  lastUpdated: Date | null
  isAvailable: boolean
}

/** v8.5 新增：保存失败的原因，供 UI 给用户可见提示 */
export type FormulaSaveFailureReason =
  | 'unavailable'
  | 'quota-exceeded'
  | 'too-large'
  | 'unknown'

/**
 * 检测 localStorage 是否可用
 */
export function isStorageAvailable(): boolean {
  try {
    const testKey = '__test__'
    localStorage.setItem(testKey, testKey)
    localStorage.removeItem(testKey)
    return true
  } catch (e) {
    logger.warn('[formulaStorage] ⚠️ localStorage 不可用:', e)
    return false
  }
}

/**
 * 保存配方索引到 localStorage
 * @param formulaIndex - 配方索引
 * @param versionHistory - 可选，版本历史（持久化后刷新不丢）
 */
export function saveFormulaIndex(
  formulaIndex: Map<string, AIRecognizedFormula>,
  versionHistory?: StoredVersionHistory[],
): boolean {
  if (!isStorageAvailable()) {
    logger.warn('[formulaStorage] ⚠️ localStorage 不可用，无法保存')
    return false
  }

  try {
    const formulas = Array.from(formulaIndex.values())

    if (formulas.length === 0) {
      localStorage.removeItem(FORMULA_STORAGE_KEY)
      return true
    }

    const storageData: FormulaStorageData = {
      version: FORMULA_STORAGE_VERSION,
      timestamp: Date.now(),
      formulas,
      ...(versionHistory && versionHistory.length > 0 ? { versionHistory } : {}),
      metadata: {
        totalCount: formulas.length,
        lastUpdated: new Date().toLocaleString('zh-CN'),
      },
    }

    const jsonString = JSON.stringify(storageData)
    const dataSize = new Blob([jsonString]).size

    if (dataSize > MAX_STORAGE_SIZE) {
      logger.error(`[formulaStorage] ❌ 数据大小超限 (${(dataSize / 1024 / 1024).toFixed(2)}MB > 5MB)`)
      return false
    }

    localStorage.setItem(FORMULA_STORAGE_KEY, jsonString)
    logger.log(`[formulaStorage] ✅ 已保存 ${formulas.length} 个配方 (${(dataSize / 1024).toFixed(1)}KB)`)
    return true
  } catch (e) {
    logger.error('[formulaStorage] ❌ 保存失败:', e)
    return false
  }
}

/**
 * v8.5 新增：保存配方索引，并返回「失败原因」而不是仅 boolean。
 * 原 saveFormulaIndex 在超限/QuotaExceeded 时只写日志返回 false，调用方无从提示用户，
 * 用户会以为已保存，刷新后数据丢失。本函数把失败原因显式回传。
 *
 * @returns null 表示成功；否则为失败原因
 */
export function saveFormulaIndexWithReason(
  formulaIndex: Map<string, AIRecognizedFormula>,
  versionHistory?: StoredVersionHistory[],
): FormulaSaveFailureReason | null {
  if (!isStorageAvailable()) return 'unavailable'

  try {
    const formulas = Array.from(formulaIndex.values())

    if (formulas.length === 0) {
      localStorage.removeItem(FORMULA_STORAGE_KEY)
      return null
    }

    const storageData: FormulaStorageData = {
      version: FORMULA_STORAGE_VERSION,
      timestamp: Date.now(),
      formulas,
      ...(versionHistory && versionHistory.length > 0 ? { versionHistory } : {}),
      metadata: {
        totalCount: formulas.length,
        lastUpdated: new Date().toLocaleString('zh-CN'),
      },
    }

    const jsonString = JSON.stringify(storageData)
    const dataSize = new Blob([jsonString]).size

    if (dataSize > MAX_STORAGE_SIZE) {
      logger.error(`[formulaStorage] ❌ 数据大小超限 (${(dataSize / 1024 / 1024).toFixed(2)}MB > 5MB)`)
      return 'too-large'
    }

    try {
      localStorage.setItem(FORMULA_STORAGE_KEY, jsonString)
    } catch (quotaError) {
      // 浏览器配额耗尽（不同内核报错名不一致，统一按类型/消息识别）
      const name = (quotaError as { name?: string })?.name ?? ''
      const message = String((quotaError as { message?: string })?.message ?? '')
      if (
        name === 'QuotaExceededError' ||
        name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        /quota/i.test(message)
      ) {
        logger.error('[formulaStorage] ❌ localStorage 配额耗尽')
        return 'quota-exceeded'
      }
      throw quotaError
    }

    logger.log(`[formulaStorage] ✅ 已保存 ${formulas.length} 个配方 (${(dataSize / 1024).toFixed(1)}KB)`)
    return null
  } catch (e) {
    logger.error('[formulaStorage] ❌ 保存失败:', e)
    return 'unknown'
  }
}

/**
 * 从 localStorage 加载配方索引
 */
export function loadFormulaIndex(): Map<string, AIRecognizedFormula> | null {
  if (!isStorageAvailable()) {
    return null
  }

  try {
    const jsonString = localStorage.getItem(FORMULA_STORAGE_KEY)

    if (!jsonString) {
      return null
    }

    const storageData: FormulaStorageData = JSON.parse(jsonString)

    if (!storageData?.version || !Array.isArray(storageData.formulas)) {
      logger.warn('[formulaStorage] ⚠️ 数据格式无效，清理中...')
      clearFormulaStorage()
      return null
    }

    if (storageData.version !== FORMULA_STORAGE_VERSION) {
      logger.warn(`[formulaStorage] ⚠️ 版本不匹配 (${storageData.version} vs ${FORMULA_STORAGE_VERSION})，可能需要数据迁移`)
    }

    const formulaMap = new Map<string, AIRecognizedFormula>()

    for (const formula of storageData.formulas) {
      // 只要求 id；name 可空（由 autoName 兜底），避免刷新后静默丢配方
      if (formula && formula.id && (formula.name || formula.autoName)) {
        formulaMap.set(formula.id, {
          ...formula,
          parsedAt: new Date(formula.parsedAt),
        })
      }
    }

    logger.log(`[formulaStorage] ✅ 已加载 ${formulaMap.size} 个配方`)
    return formulaMap
  } catch (e) {
    logger.error('[formulaStorage] ❌ 加载失败:', e)
    clearFormulaStorage()
    return null
  }
}

/**
 * 从 localStorage 加载版本历史（v1.1.0）
 * @returns 版本历史数组；无数据或旧格式返回空数组
 */
export function loadFormulaVersionHistory(): StoredVersionHistory[] {
  if (!isStorageAvailable()) return []

  try {
    const jsonString = localStorage.getItem(FORMULA_STORAGE_KEY)
    if (!jsonString) return []

    const storageData: FormulaStorageData = JSON.parse(jsonString)
    if (!storageData || !Array.isArray(storageData.versionHistory)) return []

    return storageData.versionHistory.filter(
      (entry) => entry && typeof entry.id === 'string' && Array.isArray(entry.versions),
    )
  } catch (e) {
    logger.warn('[formulaStorage] ⚠️ 版本历史加载失败:', e)
    return []
  }
}

/**
 * 清除 localStorage 中的配方数据
 */
export function clearFormulaStorage(): boolean {
  try {
    localStorage.removeItem(FORMULA_STORAGE_KEY)
    logger.log('[formulaStorage] ✅ 已清除本地存储数据')
    return true
  } catch (e) {
    logger.error('[formulaStorage] ❌ 清除失败:', e)
    return false
  }
}

/**
 * 获取存储信息
 */
export function getStorageInfo(): StorageInfo {
  if (!isStorageAvailable()) {
    return { size: 0, count: 0, lastUpdated: null, isAvailable: false }
  }

  try {
    const jsonString = localStorage.getItem(FORMULA_STORAGE_KEY)

    if (!jsonString) {
      return { size: 0, count: 0, lastUpdated: null, isAvailable: true }
    }

    const dataSize = new Blob([jsonString]).size
    const storageData: FormulaStorageData = JSON.parse(jsonString)

    return {
      size: dataSize,
      count: storageData?.formulas?.length || 0,
      lastUpdated: storageData?.timestamp ? new Date(storageData.timestamp) : null,
      isAvailable: true,
    }
  } catch {
    return { size: 0, count: 0, lastUpdated: null, isAvailable: false }
  }
}

/**
 * 导出配方数据为 JSON 字符串
 */
export function exportFormulaData(formulaIndex?: Map<string, AIRecognizedFormula>): string {
  const indexToExport = formulaIndex || loadFormulaIndex()

  if (!indexToExport || indexToExport.size === 0) {
    return ''
  }

  const exportData: FormulaStorageData = {
    version: FORMULA_STORAGE_VERSION,
    timestamp: Date.now(),
    formulas: Array.from(indexToExport.values()),
    metadata: {
      totalCount: indexToExport.size,
      lastUpdated: new Date().toLocaleString('zh-CN'),
    },
  }

  return JSON.stringify(exportData, null, 2)
}

/**
 * 从 JSON 字符串导入配方数据
 */
export function importFormulaData(jsonString: string): boolean {
  try {
    const importData: FormulaStorageData = JSON.parse(jsonString)

    if (!importData || !Array.isArray(importData.formulas)) {
      logger.error('[formulaStorage] ❌ 导入数据格式无效')
      return false
    }

    const existingIndex = loadFormulaIndex() || new Map()
    let importedCount = 0

    for (const formula of importData.formulas) {
      if (formula && formula.id && formula.name && !existingIndex.has(formula.id)) {
        existingIndex.set(formula.id, {
          ...formula,
          parsedAt: new Date(formula.parsedAt),
        })
        importedCount++
      }
    }

    if (importedCount > 0) {
      saveFormulaIndex(existingIndex)
      logger.log(`[formulaStorage] ✅ 成功导入 ${importedCount} 个新配方`)
    } else {
      logger.log('[formulaStorage] ℹ️ 所有配方已存在，无需导入')
    }

    return true
  } catch (e) {
    logger.error('[formulaStorage] ❌ 导入失败:', e)
    return false
  }
}

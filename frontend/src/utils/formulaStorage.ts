import { logger } from '@/utils/safeLogger'
import type { AIRecognizedFormula } from '@/types/ai.types'

const FORMULA_STORAGE_KEY = 'rmfood_ai_formula_index'
const FORMULA_STORAGE_VERSION = '1.0.0'
const MAX_STORAGE_SIZE = 5 * 1024 * 1024 // 5MB限制

export interface FormulaStorageData {
  version: string
  timestamp: number
  formulas: AIRecognizedFormula[]
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
 */
export function saveFormulaIndex(formulaIndex: Map<string, AIRecognizedFormula>): boolean {
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
      if (formula && formula.id && formula.name) {
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

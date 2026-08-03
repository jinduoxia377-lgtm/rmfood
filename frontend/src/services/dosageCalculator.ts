import type { Ingredient, DosageCalculationResult } from '@/types/ai.types'
import { UNIT_CONVERSION_MAP } from '@/config/dosage.constants'


import { logger } from '@/utils/safeLogger';
interface NormalizedDosage {
  value: number
  unit: string
  originalValue?: number
  originalUnit?: string
}

interface PercentageResult {
  ingredient: Ingredient
  percentage: number | null
  normalizedAmount: number | null
  absoluteAmount: { value: number; unit: string }
}

interface DosageCalculationMeta {
  totalNormalizedAmount: number
  totalOriginalAmount: number
  unitConsistent: boolean
  primaryUnit: string
  calculationTimestamp: Date
  warnings: string[]
}

interface BatchCalculationResult {
  ingredients: (Ingredient & { calculatedPercentage: number | null })[]
  meta: DosageCalculationMeta
}

const BASE_UNIT_MASS = 'mg'
const BASE_UNIT_VOLUME = 'ml'
const MASS_UNITS = new Set(['mg', 'g', 'kg', 'μg', 'ug', '钱', '两', '斤'])
const VOLUME_UNITS = new Set(['ml', 'l', 'ul', 'μl'])

function isMassUnit(unit: string): boolean {
  return MASS_UNITS.has(unit.toLowerCase())
}

function isVolumeUnit(unit: string): boolean {
  return VOLUME_UNITS.has(unit.toLowerCase())
}

export function normalizeUnit(value: string): NormalizedDosage | null {
  if (!value || typeof value !== 'string') return null

  const trimmed = value.trim()
  const match = /^([\d.]+)\s*([a-zA-Zμ\u03BC\u4E91\u4E24\u65A4]+)$/.exec(trimmed)

  if (!match) {
    logger.warn(`[DosageCalculator] 无法解析用量值: "${value}"`)
    return null
  }

  const numValue = parseFloat(match[1])
  let rawUnit = match[2].toLowerCase()

  if (rawUnit === 'μg' || rawUnit === '\u03bcg') rawUnit = 'ug'
  if (rawUnit === 'μl' || rawUnit === '\u03bcl') rawUnit = 'ul'

  if (isNaN(numValue) || numValue < 0) {
    logger.warn(`[DosageCalculator] 无效的数值: "${value}"`)
    return null
  }

  let targetUnit: string
  let convertedValue: number | null

  if (isMassUnit(rawUnit)) {
    targetUnit = BASE_UNIT_MASS
    convertedValue = convertToBase(numValue, rawUnit, 'mass')
    if (convertedValue === null) return null
  } else if (isVolumeUnit(rawUnit)) {
    targetUnit = BASE_UNIT_VOLUME
    convertedValue = convertToBase(numValue, rawUnit, 'volume')
    if (convertedValue === null) return null
  } else {
    logger.warn(`[DosageCalculator] 未知的单位类型: "${rawUnit}" (原始值: "${value}")`)
    return {
      value: numValue,
      unit: rawUnit,
      originalValue: numValue,
      originalUnit: rawUnit,
    }
  }

  return {
    value: parseFloat(convertedValue.toFixed(6)),
    unit: targetUnit,
    originalValue: numValue,
    originalUnit: rawUnit,
  }
}

function convertToBase(value: number, fromUnit: string, type: 'mass' | 'volume'): number | null {
  if (type === 'mass') {
    switch (fromUnit.toLowerCase()) {
      case 'mg': return value
      case 'g': return value * 1000
      case 'kg': return value * 1000000
      case 'ug': return value * 0.001
      case '钱': return value * 5000
      case '两': return value * 50000
      case '斤': return value * 500000
      default:
        logger.warn(`[DosageCalculator] 不支持的质量单位转换: ${fromUnit}`)
        return null
    }
  } else {
    switch (fromUnit.toLowerCase()) {
      case 'ml': return value
      case 'l': return value * 1000
      case 'ul': return value * 0.001
      default:
        logger.warn(`[DosageCalculator] 不支持的体积单位转换: ${fromUnit}`)
        return null
    }
  }
}

export function calculateTotalAmount(ingredients: Ingredient[]): number {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return 0

  const amounts: number[] = []
  let primaryType: 'mass' | 'volume' | null = null

  for (const ing of ingredients) {
    if (!ing || typeof ing.amount !== 'number' || !ing.unit) continue

    const normalized = normalizeUnit(`${ing.amount}${ing.unit}`)
    if (!normalized) continue

    const currentType = isMassUnit(normalized.unit) ? 'mass' : 'volume'

    if (primaryType === null) {
      primaryType = currentType
    } else if (primaryType !== currentType) {
      logger.warn(`[DosageCalculator] 检测到混合单位类型: ${ing.name} (${normalized.unit}) 与主单位类型不一致`)
    }

    amounts.push(normalized.value)
  }

  const total = amounts.reduce((sum, val) => sum + val, 0)
  return parseFloat(total.toFixed(6))
}

export function calculatePercentage(
  ingredient: Ingredient,
  totalAmount: number,
): number | null {
  if (!ingredient || totalAmount <= 0) return null

  if (typeof ingredient.amount !== 'number' || !ingredient.unit) {
    logger.warn(`[DosageCalculator] 成分缺少必要的用量数据:`, ingredient)
    return null
  }

  const normalized = normalizeUnit(`${ingredient.amount}${ingredient.unit}`)
  if (!normalized || normalized.value <= 0) return null

  const percentage = (normalized.value / totalAmount) * 100
  return parseFloat(percentage.toFixed(1))
}

export function calculateAllPercentages(
  ingredients: Ingredient[],
): BatchCalculationResult | null {
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    logger.warn('[DosageCalculator] 输入的成分数组为空')
    return null
  }

  const warnings: string[] = []
  const enhancedIngredients: (Ingredient & { calculatedPercentage: number | null })[] = []
  let totalNormalized = 0
  let totalOriginal = 0
  let unitConsistent = true
  let detectedPrimaryUnit: string | null = null

  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i]

    if (!ing || typeof ing.amount !== 'number' || !ing.unit) {
      warnings.push(`成分 #${i + 1} (${ing?.name ?? '未知'}): 缺少用量或单位数据`)
      enhancedIngredients.push({
        ...ing,
        calculatedPercentage: null,
      })
      continue
    }

    const normalized = normalizeUnit(`${ing.amount}${ing.unit}`)

    if (!normalized) {
      warnings.push(`成分 #${i + 1} (${ing.name}): 单位解析失败 (${ing.amount}${ing.unit})`)
      enhancedIngredients.push({
        ...ing,
        calculatedPercentage: null,
      })
      continue
    }

    totalOriginal += ing.amount

    if (detectedPrimaryUnit === null) {
      detectedPrimaryUnit = normalized.unit
    } else if (detectedPrimaryUnit !== normalized.unit && isMassUnit(normalized.unit) && isMassUnit(detectedPrimaryUnit)) {
      // 同类型不同基准单位，继续（已统一到基准）
    } else if (detectedPrimaryUnit !== normalized.unit) {
      unitConsistent = false
      warnings.push(`检测到质量/体积单位混合: ${ing.name} 使用 ${normalized.unit}`)
    }

    totalNormalized += normalized.value

    enhancedIngredients.push({
      ...ing,
      calculatedPercentage: null, // 先设为null，后面统一计算
    })
  }

  if (totalNormalized <= 0) {
    warnings.push('所有成分的总标准化用量为0，无法计算占比')
    return {
      ingredients: enhancedIngredients,
      meta: {
        totalNormalizedAmount: 0,
        totalOriginalAmount: totalOriginal,
        unitConsistent,
        primaryUnit: detectedPrimaryUnit || 'unknown',
        calculationTimestamp: new Date(),
        warnings,
      },
    }
  }

  for (let i = 0; i < enhancedIngredients.length; i++) {
    const ing = ingredients[i]
    if (!ing || typeof ing.amount !== 'number' || !ing.unit) continue

    const normalized = normalizeUnit(`${ing.amount}${ing.unit}`)
    if (!normalized) continue

    const percentage = parseFloat(((normalized.value / totalNormalized) * 100).toFixed(1))
    enhancedIngredients[i].calculatedPercentage = percentage
  }

  const sumPercentages = enhancedIngredients
    .filter(ing => ing.calculatedPercentage !== null)
    .reduce((sum, ing) => sum + (ing.calculatedPercentage ?? 0), 0)

  if (Math.abs(sumPercentages - 100) > 1) {
    warnings.push(`百分比总和异常: ${sumPercentages.toFixed(1)}% (期望≈100%)`)
  }

  return {
    ingredients: enhancedIngredients,
    meta: {
      totalNormalizedAmount: parseFloat(totalNormalized.toFixed(6)),
      totalOriginalAmount: parseFloat(totalOriginal.toFixed(6)),
      unitConsistent,
      primaryUnit: detectedPrimaryUnit || 'unknown',
      calculationTimestamp: new Date(),
      warnings,
    },
  }
}

export function getIngredientAbsoluteAmount(ingredient: Ingredient): { value: number; unit: string } | null {
  if (!ingredient || typeof ingredient.amount !== 'number' || !ingredient.unit) return null

  const normalized = normalizeUnit(`${ingredient.amount}${ingredient.unit}`)
  if (!normalized) return null

  return {
    value: normalized.originalValue ?? ingredient.amount,
    unit: normalized.originalUnit ?? ingredient.unit,
  }
}

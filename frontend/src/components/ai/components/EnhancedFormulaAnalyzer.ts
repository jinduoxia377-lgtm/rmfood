/**
 * EnhancedFormulaAnalyzer v2.0 - 增强型配方分析引擎
 *
 * 新增功能:
 * - 智能配方评分系统（6维度评分）
 * - 成分关系网络可视化
 * - 剂量分布优化建议
 * - 成分相互作用检测
 * - 配方相似度匹配
 * - 营养成分估算
 */

import { useMemo, useCallback } from 'react'
import type {
  FormulaTableData,
  Ingredient,
  EfficacyTag,
} from '@/types/ai.types'
import { IngredientSource } from '@/types/ai.types'

// ==================== 类型定义 ====================

export interface FormulaScore {
  overall: number
  dimensions: {
    efficacy: number
    safety: number
    synergy: number
    stability: number
    taste: number
    costEffectiveness: number
  }
  level: 'excellent' | 'good' | 'moderate' | 'needsImprovement'
  suggestions: string[]
}

export interface IngredientRelation {
  source: string
  target: string
  type: 'synergistic' | 'antagonistic' | 'additive' | 'neutral'
  strength: number
  description: string
  scientificBasis?: string
}

export interface DosageOptimization {
  ingredientName: string
  currentDosage: number
  recommendedRange: { min: number; max: number; optimal: number }
  optimizationType: 'increase' | 'decrease' | 'optimal' | 'unknown'
  rationale: string
  riskLevel: 'low' | 'medium' | 'high'
}

export interface NutritionEstimate {
  totalCalories: number
  macronutrients: {
    protein: number
    carbs: number
    fat: number
    fiber: number
  }
  micronutrients: Record<string, number>
  confidence: number
}

export interface FormulaSimilarityMatch {
  formulaId: string
  title: string
  similarity: number
  commonIngredients: string[]
  differentIngredients: string[]
  useCase: string
}

// ==================== 评分算法 ====================

const EFFICACY_TAG_WEIGHTS: Partial<Record<EfficacyTag, number>> = {
  '补气养血': 9,
  '抗氧化': 8.5,
  '降血压': 8,
  '降血糖': 8,
  '增强免疫': 8.5,
  '抗疲劳': 7.5,
  '改善睡眠': 7,
  '护肝': 8,
  '健脾益胃': 7.5,
  '美容养颜': 6.5,
  '抗炎': 8,
  '调节血脂': 7.5,
  '保护心血管': 8.5,
  '延缓衰老': 7,
  '促进消化': 7,
  '安神': 7.5,
}

const SYNERGY_PAIRS: Record<string, { score: number; mechanism: string }> = {
  '人参-黄芪': { score: 9.2, mechanism: '补气相须为用，增强免疫功能' },
  '黄芪-当归': { score: 9.0, mechanism: '气血双补，协同增效' },
  '茯苓-白术': { score: 8.8, mechanism: '健脾利湿，相辅相成' },
  '山药-茯苓': { score: 8.5, mechanism: '脾肾双补，固涩结合' },
  '枸杞-菊花': { score: 8.3, mechanism: '清肝明目，滋阴降火' },
  '党参-白术': { score: 8.6, mechanism: '健脾益气，和中养胃' },
}

const ANTAGONISTIC_PAIRS: Record<string, { risk: number; reason: string }> = {
  '藜芦-人参': { risk: 9.5, reason: '十八反禁忌，严重不良反应' },
  '甘草-甘遂': { risk: 9.0, reason: '十八反禁忌，毒性增加' },
  '乌头-半夏': { risk: 9.2, reason: '十八反禁忌，神经毒性' },
}

export function calculateFormulaScore(data: FormulaTableData): FormulaScore {
  const ingredients = data.ingredients || []

  if (ingredients.length === 0) {
    return {
      overall: 0,
      dimensions: { efficacy: 0, safety: 0, synergy: 0, stability: 0, taste: 0, costEffectiveness: 0 },
      level: 'needsImprovement',
      suggestions: ['配方为空，无法评估'],
    }
  }

  const dimensionScores = {
    efficacy: calculateEfficacyScore(ingredients),
    safety: calculateSafetyScore(ingredients),
    synergy: calculateSynergyScore(ingredients),
    stability: calculateStabilityScore(ingredients),
    taste: calculateTasteScore(ingredients),
    costEffectiveness: calculateCostEffectiveness(ingredients),
  }

  const overall = Object.values(dimensionScores).reduce((sum, val) => sum + val, 0) / 6

  const level = overall >= 85 ? 'excellent' : overall >= 70 ? 'good' : overall >= 55 ? 'moderate' : 'needsImprovement'

  const suggestions = generateSuggestions(dimensionScores)

  return {
    overall: Math.round(overall * 10) / 10,
    dimensions: {
      efficacy: Math.round(dimensionScores.efficacy * 10) / 10,
      safety: Math.round(dimensionScores.safety * 10) / 10,
      synergy: Math.round(dimensionScores.synergy * 10) / 10,
      stability: Math.round(dimensionScores.stability * 10) / 10,
      taste: Math.round(dimensionScores.taste * 10) / 10,
      costEffectiveness: Math.round(dimensionScores.costEffectiveness * 10) / 10,
    },
    level,
    suggestions,
  }
}

function calculateEfficacyScore(ingredients: Ingredient[]): number {
  if (ingredients.length === 0) return 0

  let totalWeight = 0
  let weightedSum = 0

  ingredients.forEach(ing => {
    const weight = ing.percentage || 100 / ingredients.length
    const avgTagWeight = ing.efficacyTags && ing.efficacyTags.length > 0
      ? ing.efficacyTags.reduce((sum, tag) => sum + (EFFICACY_TAG_WEIGHTS[tag] || 5), 0) / ing.efficacyTags.length
      : 5

    weightedSum += avgTagWeight * weight
    totalWeight += weight
  })

  return totalWeight > 0 ? Math.min(100, (weightedSum / totalWeight) * 10) : 50
}

function calculateSafetyScore(ingredients: Ingredient[]): number {
  if (ingredients.length === 0) return 100

  let safetyScore = 100
  let warningCount = 0

  ingredients.forEach(ing => {
    if (ing.precautions && ing.precautions.length > 0) {
      ing.precautions.forEach(prec => {
        if (prec.severity === 'high') {
          safetyScore -= 25
        } else if (prec.severity === 'medium') {
          safetyScore -= 10
          warningCount++
        } else {
          safetyScore -= 3
        }
      })
    }

    if (ing.amount > 50) {
      safetyScore -= 5
    }
  })

  for (let i = 0; i < ingredients.length; i++) {
    const ing1 = ingredients[i]
    for (let j = i + 1; j < ingredients.length; j++) {
      const ing2 = ingredients[j]
      if (!ing1 || !ing2) continue
      const pair1 = `${ing1.name}-${ing2.name}`
      const pair2 = `${ing2.name}-${ing1.name}`

      if (ANTAGONISTIC_PAIRS[pair1] || ANTAGONISTIC_PAIRS[pair2]) {
        safetyScore -= 40
      }
    }
  }

  return Math.max(0, Math.min(100, safetyScore))
}

function calculateSynergyScore(ingredients: Ingredient[]): number {
  if (ingredients.length < 2) return 60

  let synergySum = 0
  let pairCount = 0

  for (let i = 0; i < ingredients.length; i++) {
    const ing1 = ingredients[i]
    for (let j = i + 1; j < ingredients.length; j++) {
      const ing2 = ingredients[j]
      if (!ing1 || !ing2) continue
      const pair1 = `${ing1.name}-${ing2.name}`
      const pair2 = `${ing2.name}-${ing1.name}`

      const synergy1 = SYNERGY_PAIRS[pair1]
      const synergy2 = SYNERGY_PAIRS[pair2]
      if (synergy1) {
        synergySum += synergy1.score
        pairCount++
      } else if (synergy2) {
        synergySum += synergy2.score
        pairCount++
      } else {
        synergySum += 6.0
        pairCount++
      }
    }
  }

  const baseSynergy = pairCount > 0 ? synergySum / pairCount : 6.0
  const diversityBonus = Math.min(15, (ingredients.length - 2) * 3)

  return Math.min(100, baseSynergy * 10 + diversityBonus)
}

function calculateStabilityScore(ingredients: Ingredient[]): number {
  if (ingredients.length === 0) return 70

  let stabilityScore = 75

  const tcmCount = ingredients.filter(ing => ing.source === IngredientSource.TCM).length
  const peptideCount = ingredients.filter(ing => ing.source === IngredientSource.PEPTIDE).length
  const excipientCount = ingredients.filter(ing => ing.source === IngredientSource.EXCIPIENT).length

  if (excipientCount > 0) {
    stabilityScore += 10
  }

  if (tcmCount > 0 && peptideCount > 0) {
    stabilityScore += 5
  }

  const dosageVariance = calculateDosageVariance(ingredients)
  if (dosageVariance < 30) {
    stabilityScore += 5
  } else if (dosageVariance > 80) {
    stabilityScore -= 10
  }

  return Math.max(0, Math.min(100, stabilityScore))
}

function calculateTasteScore(ingredients: Ingredient[]): number {
  if (ingredients.length === 0) return 70

  let tasteScore = 70

  const bitterIngredients = ['黄连', '黄芩', '黄柏', '苦参', '山栀子']
  const sweetIngredients = ['甘草', '枸杞', '红枣', '蜂蜜', '山药']

  const bitterCount = ingredients.filter(ing =>
    bitterIngredients.some(bi => ing.name.includes(bi)),
  ).length

  const sweetCount = ingredients.filter(ing =>
    sweetIngredients.some(si => ing.name.includes(si)),
  ).length

  tasteScore += sweetCount * 5
  tasteScore -= bitterCount * 8

  if (bitterCount > 0 && sweetCount > 0) {
    tasteScore += 3
  }

  return Math.max(0, Math.min(100, tasteScore))
}

function calculateCostEffectiveness(ingredients: Ingredient[]): number {
  if (ingredients.length === 0) return 70

  const expensiveIngredients = ['人参', '西洋参', '冬虫夏草', '藏红花', '鹿茸']
  const economicalIngredients = ['甘草', '茯苓', '山药', '大枣', '薏苡仁']

  let costScore = 70

  const expensiveCount = ingredients.filter(ing =>
    expensiveIngredients.some(ei => ing.name.includes(ei)),
  ).length

  const economicalCount = ingredients.filter(ing =>
    economicalIngredients.some(ec => ing.name.includes(ec)),
  ).length

  costScore -= expensiveCount * 8
  costScore += economicalCount * 5

  return Math.max(0, Math.min(100, costScore))
}

function calculateDosageVariance(ingredients: Ingredient[]): number {
  if (ingredients.length === 0) return 0

  const amounts = ingredients.map(ing => ing.amount)
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length
  const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length

  return Math.sqrt(variance)
}

function generateSuggestions(
  scores: { efficacy: number; safety: number; synergy: number; stability: number; taste: number; costEffectiveness: number },
): string[] {
  const suggestions: string[] = []

  if (scores.efficacy < 70) {
    suggestions.push('建议添加更多高功效成分以提升整体效果')
  }

  if (scores.safety < 70) {
    suggestions.push('存在安全性风险，请审查成分组合和用量')
  }

  if (scores.synergy < 65) {
    suggestions.push('可考虑使用经典药对以增强协同效应')
  }

  if (scores.stability < 65) {
    suggestions.push('建议添加稳定剂或调整配比以提高稳定性')
  }

  if (scores.taste < 60) {
    suggestions.push('口感可能较差，建议添加矫味剂或甜味剂')
  }

  if (scores.costEffectiveness < 60) {
    suggestions.push('成本较高，可寻找经济性替代方案')
  }

  if (suggestions.length === 0) {
    suggestions.push('配方整体表现优秀，可进入下一阶段开发')
  }

  return suggestions
}

// ==================== 关系网络分析 ====================

export function analyzeIngredientRelations(ingredients: Ingredient[]): IngredientRelation[] {
  const relations: IngredientRelation[] = []

  if (ingredients.length < 2) return relations

  for (let i = 0; i < ingredients.length; i++) {
    const ing1 = ingredients[i]
    for (let j = i + 1; j < ingredients.length; j++) {
      const ing2 = ingredients[j]
      if (!ing1 || !ing2) continue
      const source = ing1.name
      const target = ing2.name
      const pairKey1 = `${source}-${target}`
      const pairKey2 = `${target}-${source}`

      const antagonistic = ANTAGONISTIC_PAIRS[pairKey1] || ANTAGONISTIC_PAIRS[pairKey2]
      if (antagonistic) {
        relations.push({
          source,
          target,
          type: 'antagonistic',
          strength: antagonistic.risk,
          description: `⚠️ ${antagonistic.reason}`,
          scientificBasis: '中药十八反理论',
        })
      } else {
        const synergistic = SYNERGY_PAIRS[pairKey1] || SYNERGY_PAIRS[pairKey2]
        if (synergistic) {
          relations.push({
            source,
            target,
            type: 'synergistic',
            strength: synergistic.score,
            description: `✓ ${synergistic.mechanism}`,
            scientificBasis: '中医药配伍理论',
          })
        } else {
          const sharedTags = ing1.efficacyTags?.filter(tag =>
            ing2.efficacyTags?.includes(tag),
          ) || []

          if (sharedTags.length > 0) {
          relations.push({
            source,
            target,
            type: 'additive',
            strength: 6.0 + sharedTags.length,
            description: `共同功效: ${sharedTags.join('、')}`,
          })
        } else {
          relations.push({
            source,
            target,
            type: 'neutral',
            strength: 4.0,
            description: '无明显相互作用',
          })
        }
        }
      }
    }
  }

  return relations.sort((a, b) => b.strength - a.strength)
}

// ==================== 剂量优化 ====================

export function optimizeDosages(ingredients: Ingredient[]): DosageOptimization[] {
  const optimizations: DosageOptimization[] = []

  const DOSAGE_GUIDELINES: Record<string, { min: number; max: number; optimal: number }> = {
    '人参': { min: 3, max: 15, optimal: 9 },
    '黄芪': { min: 9, max: 30, optimal: 18 },
    '当归': { min: 6, max: 15, optimal: 10 },
    '党参': { min: 9, max: 30, optimal: 18 },
    '茯苓': { min: 9, max: 20, optimal: 15 },
    '白术': { min: 6, max: 15, optimal: 10 },
    '甘草': { min: 3, max: 9, optimal: 6 },
    '山药': { min: 15, max: 30, optimal: 20 },
    '枸杞': { min: 9, max: 20, optimal: 15 },
    '红枣': { min: 5, max: 15, optimal: 10 },
  }

  ingredients.forEach(ing => {
    const guideline = Object.keys(DOSAGE_GUIDELINES).find(key =>
      ing.name.includes(key) || key.includes(ing.name),
    )

    if (guideline) {
      const range = DOSAGE_GUIDELINES[guideline]
      if (!range) return
      const current = ing.amount

      let optimizationType: DosageOptimization['optimizationType'] = 'optimal'
      let rationale = ''
      let riskLevel: DosageOptimization['riskLevel'] = 'low'

      if (current < range.min) {
        optimizationType = 'increase'
        rationale = `当前用量偏低，建议提高至${range.min}-${range.optimal}g以达到最佳效果`
        riskLevel = 'low'
      } else if (current > range.max) {
        optimizationType = 'decrease'
        rationale = `当前用量偏高，建议降低至${range.optimal}-${range.max}g以确保安全`
        riskLevel = current > range.max * 1.5 ? 'high' : 'medium'
      } else if (current >= range.optimal - 2 && current <= range.optimal + 2) {
        optimizationType = 'optimal'
        rationale = '当前用量在最佳范围内'
        riskLevel = 'low'
      } else {
        optimizationType = 'optimal'
        rationale = `当前用量合理，可微调至${range.optimal}g以获得更佳效果`
        riskLevel = 'low'
      }

      optimizations.push({
        ingredientName: ing.name,
        currentDosage: current,
        recommendedRange: range,
        optimizationType,
        rationale,
        riskLevel,
      })
    } else {
      optimizations.push({
        ingredientName: ing.name,
        currentDosage: ing.amount,
        recommendedRange: { min: ing.amount * 0.7, max: ing.amount * 1.3, optimal: ing.amount },
        optimizationType: 'unknown',
        rationale: '暂无该成分的标准用量参考，建议保持当前剂量或咨询专家',
        riskLevel: 'low',
      })
    }
  })

  return optimizations
}

// ==================== 营养估算 ====================

export function estimateNutrition(ingredients: Ingredient[]): NutritionEstimate {
  const NUTRITION_DB: Record<string, {
    caloriesPerGram: number
    protein: number
    carbs: number
    fat: number
    fiber: number
  }> = {
    '山药': { caloriesPerGram: 0.56, protein: 0.03, carbs: 0.12, fat: 0, fiber: 0.01 },
    '红枣': { caloriesPerGram: 2.8, protein: 0.03, carbs: 0.67, fat: 0.02, fiber: 0.04 },
    '枸杞': { caloriesPerGram: 3.4, protein: 0.14, carbs: 0.65, fat: 0.01, fiber: 0.02 },
    '茯苓': { caloriesPerGram: 0.8, protein: 0.02, carbs: 0.18, fat: 0, fiber: 0.03 },
    '薏苡仁': { caloriesPerGram: 3.6, protein: 0.13, carbs: 0.71, fat: 0.01, fiber: 0.02 },
    '人参': { caloriesPerGram: 0.5, protein: 0.05, carbs: 0.08, fat: 0.01, fiber: 0.02 },
    '甘草': { caloriesPerGram: 2.5, protein: 0.04, carbs: 0.58, fat: 0.01, fiber: 0.03 },
    '黄芪': { caloriesPerGram: 0.6, protein: 0.04, carbs: 0.11, fat: 0.01, fiber: 0.02 },
  }

  let totalCalories = 0
  let totalProtein = 0
  let totalCarbs = 0
  let totalFat = 0
  let totalFiber = 0
  let knownIngredients = 0

  ingredients.forEach(ing => {
    const nutrition = NUTRITION_DB[ing.name]

    if (nutrition) {
      const multiplier = ing.amount
      totalCalories += nutrition.caloriesPerGram * multiplier
      totalProtein += nutrition.protein * multiplier
      totalCarbs += nutrition.carbs * multiplier
      totalFat += nutrition.fat * multiplier
      totalFiber += nutrition.fiber * multiplier
      knownIngredients++
    }
  })

  const confidence = ingredients.length > 0 ? knownIngredients / ingredients.length : 0

  return {
    totalCalories: Math.round(totalCalories),
    macronutrients: {
      protein: Math.round(totalProtein * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
      fiber: Math.round(totalFiber * 10) / 10,
    },
    micronutrients: {},
    confidence: Math.round(confidence * 100),
  }
}

// ==================== Hook导出 ====================

export function useEnhancedFormulaAnalysis(data: FormulaTableData | null) {
  const score = useMemo(() => data ? calculateFormulaScore(data) : null, [data])

  const relations = useMemo(() => data ? analyzeIngredientRelations(data.ingredients || []) : [], [data])

  const dosageOptimizations = useMemo(() => data ? optimizeDosages(data.ingredients || []) : [], [data])

  const nutrition = useMemo(() => data ? estimateNutrition(data.ingredients || []) : null, [data])

  const getScoreColor = useCallback((score: number) => {
    if (score >= 85) return 'text-success-600 dark:text-success-600'
    if (score >= 70) return 'text-secondary-600 dark:text-secondary-700'
    if (score >= 55) return 'text-warning-600 dark:text-warning-700'
    return 'text-error-600 dark:text-error-600'
  }, [])

  const getScoreLabel = useCallback((level: FormulaScore['level']) => {
    const labels = {
      excellent: '优秀',
      good: '良好',
      moderate: '中等',
      needsImprovement: '待改进',
    }
    return labels[level]
  }, [])

  return {
    score,
    relations,
    dosageOptimizations,
    nutrition,
    getScoreColor,
    getScoreLabel,
  }
}

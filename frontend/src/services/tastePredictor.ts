/**
 * LocalTastePredictor - 本地口感预测算法
 *
 * 基于加权平均和中医配伍理论的口感预测引擎
 * 支持离线计算、炮制影响、禁忌检测和优化建议
 *
 * 算法模式：
 * 1. weighted: 简单加权平均（快速）
 * 2. synergy: 考虑协同/拮抗作用（中等）
 * 3. ml: 机器学习增强（需后端支持）
 */

import {
  INGREDIENT_TASTE_DATABASE,
  PROCESSING_METHODS,
  TASTE_OPTIMIZATION_SUGGESTIONS,
  FIVE_TASTES_LABELS,
} from '@/types/taste.types'
import { FiveTastes } from '@/types/taste.types'
import type {
  TasteProfile,
  TastePrediction,
  IngredientTasteContribution,
} from '@/types/taste.types'

interface PredictionInput {
  /** 成分列表 */
  ingredients: {
    name: string
    amount?: number
    unit?: string
    percentage?: number
    processingMethod?: string
  }[]
  /** 算法模式 */
  algorithmMode?: 'weighted' | 'synergy'
}

interface SynergyRule {
  ingredientA: string
  ingredientB: string
  tasteModifier: Partial<Record<FiveTastes, number>>
  description: string
}

const SYNERGY_RULES: SynergyRule[] = [
  {
    ingredientA: '甘草',
    ingredientB: '任何药材',
    tasteModifier: { [FiveTastes.SWEET]: 10 },
    description: '甘草调和诸药，增加整体甘味',
  },
  {
    ingredientA: '生姜',
    ingredientB: '半夏',
    tasteModifier: { [FiveTastes.PUNGENT]: 15, [FiveTastes.BITTER]: -20 },
    description: '生姜制半夏，降低毒性并增强辛散',
  },
]

export class LocalTastePredictor {
  private cache = new Map<string, TastePrediction>()

  predict(input: PredictionInput): TastePrediction {
    const cacheKey = this.generateCacheKey(input)

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    let prediction: TastePrediction

    switch (input.algorithmMode || 'weighted') {
      case 'synergy':
        prediction = this.predictWithSynergy(input)
        break
      default:
        prediction = this.predictWeighted(input)
    }

    this.cache.set(cacheKey, prediction)
    return prediction
  }

  private generateCacheKey(input: PredictionInput): string {
    return JSON.stringify({
      ingredients: input.ingredients.map((ing) => ({
        n: ing.name,
        a: ing.amount,
        p: ing.percentage,
      })),
      mode: input.algorithmMode,
    })
  }

  private predictWeighted(input: PredictionInput): TastePrediction {
    const totalAmount =
      input.ingredients.reduce(
        (sum, ing) => sum + (ing.amount || ing.percentage || 0),
        0,
      ) || input.ingredients.length

    const weightedProfile: TasteProfile = {
      sweet: 0,
      sour: 0,
      bitter: 0,
      pungent: 0,
      salty: 0,
      bland: 0,
    }

    const contributions: IngredientTasteContribution[] = []

    for (const ingredient of input.ingredients) {
      const baseProfile = this.getIngredientProfile(ingredient.name)
      if (!baseProfile) continue

      const processedProfile = this.applyProcessingEffect(
        baseProfile,
        ingredient.processingMethod,
      )

      const weight =
        ((ingredient.amount || ingredient.percentage || 1) / totalAmount) ||
        1 / input.ingredients.length

      Object.keys(weightedProfile).forEach((taste) => {
        const key = taste as keyof TasteProfile
        weightedProfile[key] += processedProfile[key] * weight
      })

      contributions.push({
        name: ingredient.name,
        percentage: weight * 100,
        profile: processedProfile,
        weight,
      })
    }

    const normalizedProfile = this.normalizeProfile(weightedProfile)
    const dominantTaste = this.findDominantTaste(normalizedProfile)
    const features = this.extractFeatures(normalizedProfile)
    const suggestions = this.generateSuggestions(normalizedProfile, dominantTaste)
    const score = this.calculateBalanceScore(normalizedProfile)

    return {
      score,
      dominantTaste,
      dominantIntensity: normalizedProfile[dominantTaste],
      profile: normalizedProfile,
      features,
      suggestions,
      description: this.generateDescription(normalizedProfile, dominantTaste),
      contributions,
    }
  }

  private predictWithSynergy(input: PredictionInput): TastePrediction {
    const basePrediction = this.predictWeighted(input)

    for (const rule of SYNERGY_RULES) {
      const hasIngredientA = input.ingredients.some(
        (ing) => ing.name === rule.ingredientA,
      )
      const hasIngredientB =
        rule.ingredientB === '任何药材' ||
        input.ingredients.some((ing) => ing.name === rule.ingredientB)

      if (hasIngredientA && hasIngredientB) {
        Object.entries(rule.tasteModifier).forEach(([taste, modifier]) => {
          const key = taste as FiveTastes
          basePrediction.profile[key] = Math.max(
            0,
            Math.min(100, basePrediction.profile[key] + modifier),
          )
        })
      }
    }

    basePrediction.score = this.calculateBalanceScore(basePrediction.profile)
    basePrediction.dominantTaste = this.findDominantTaste(basePrediction.profile)
    basePrediction.dominantIntensity =
      basePrediction.profile[basePrediction.dominantTaste]

    return basePrediction
  }

  private getIngredientProfile(name: string): TasteProfile | null {
    const exactMatch = INGREDIENT_TASTE_DATABASE[name]
    if (exactMatch) return exactMatch

    const fuzzyMatch = Object.keys(INGREDIENT_TASTE_DATABASE).find((key) =>
      name.includes(key) || key.includes(name),
    )

    return fuzzyMatch ? INGREDIENT_TASTE_DATABASE[fuzzyMatch] : null
  }

  private applyProcessingEffect(
    profile: TasteProfile,
    method?: string,
  ): TasteProfile {
    if (!method) return profile

    const processing = PROCESSING_METHODS.find((p) => p.name === method)
    if (!processing) return profile

    const modified: TasteProfile = { ...profile }

    Object.entries(processing.tasteModifiers).forEach(([taste, modifier]) => {
      const key = taste as FiveTastes
      modified[key] = Math.max(0, Math.min(100, modified[key] + modifier))
    })

    return modified
  }

  private normalizeProfile(profile: TasteProfile): TasteProfile {
    const maxVal = Math.max(...Object.values(profile), 1)
    const normalized: TasteProfile = {} as TasteProfile

    Object.keys(profile).forEach((key) => {
      const k = key as keyof TasteProfile
      normalized[k] = (profile[k] / maxVal) * 100
    })

    return normalized
  }

  private findDominantTaste(profile: TasteProfile): FiveTastes {
    let maxTaste: FiveTastes = FiveTastes.SWEET
    let maxValue = 0

    Object.entries(profile).forEach(([taste, value]) => {
      if (value > maxValue) {
        maxValue = value
        maxTaste = taste as FiveTastes
      }
    })

    return maxTaste
  }

  private calculateBalanceScore(profile: TasteProfile): number {
    const values = Object.values(profile)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance =
      values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      values.length
    const stdDev = Math.sqrt(variance)

    if (mean === 0) return 0

    const cv = stdDev / mean
    return Math.max(0, Math.min(1, 1 - cv))
  }

  private extractFeatures(profile: TasteProfile): string[] {
    const features: string[] = []

    if (profile.sweet > 60) features.push('甘甜可口')
    if (profile.sour > 50 && profile.sweet > 40) features.push('酸甜适中')
    if (profile.bitter > 70) features.push('苦味浓郁')
    if (profile.pungent > 60) features.push('辛辣刺激')
    if (profile.salty > 50) features.push('咸鲜味美')
    if (profile.bland > 50) features.push('淡泊平和')

    if (
      profile.sweet > 40 &&
      profile.bitter < 30 &&
      profile.pungent < 30
    ) {
      features.push('回甘')
    }

    if (Math.abs(profile.sweet - profile.sour) < 15) {
      features.push('酸甘化阴')
    }

    return features.slice(0, 6)
  }

  private generateSuggestions(
    profile: TasteProfile,
    dominant: FiveTastes,
  ): string[] {
    const suggestions: string[] = []
    const dominantSuggestions = TASTE_OPTIMIZATION_SUGGESTIONS[dominant]

    if (dominantSuggestions) {
      suggestions.push(dominantSuggestions[0])
    }

    if (profile.bitter > 75) {
      suggestions.push('苦寒药物过多，建议添加甘草或大枣调和')
    }

    if (profile.pungent > 70) {
      suggestions.push('辛散之性过强，可配合酸味药制约')
    }

    if (this.calculateBalanceScore(profile) < 0.4) {
      suggestions.push('五味分布不均，建议调整各成分比例以平衡口感')
    }

    return suggestions.slice(0, 4)
  }

  private generateDescription(
    profile: TasteProfile,
    dominant: FiveTastes,
  ): string {
    const dominantLabel = FIVE_TASTES_LABELS[dominant]
    const intensity = profile[dominant]
    const balanceScore = this.calculateBalanceScore(profile)

    let description = `该配方以${dominantLabel}味为主`

    if (intensity >= 80) {
      description += '，味道浓郁'
    } else if (intensity >= 50) {
      description += '，适中宜人'
    } else {
      description += '，较为清淡'
    }

    if (balanceScore >= 0.7) {
      description += '，五味协调平衡'
    } else if (balanceScore >= 0.4) {
      description += '，整体口感尚可'
    } else {
      description += '，口味偏颇明显'
    }

    return description
  }

  clearCache(): void {
    this.cache.clear()
  }
}

export const localTastePredictor = new LocalTastePredictor()
export default LocalTastePredictor

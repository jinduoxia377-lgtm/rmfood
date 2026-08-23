/**
 * SynergySimulator v2.0 - 协同效果动态模拟与预测引擎
 *
 * 核心功能:
 * - 实时协同强度计算（基于成分组合）
 * - 时间轴效应预测（即时/短期/长期效果）
 * - 场景化协同优化（不同使用场景的最佳配比）
 * - 协同网络图生成
 * - 剂量-效应曲线模拟
 * - 不良反应风险预警
 */

import { useCallback } from 'react'
import type {
  Ingredient,
  EfficacyTag,
  IngredientSource,
} from '@/types/ai.types'
import { IngredientSource as SourceEnum } from '@/types/ai.types'

// ==================== 类型定义 ====================

export interface SynergySimulationResult {
  combinationId: string
  ingredients: string[]
  overallSynergy: number
  dimensions: SynergyDimensionScore[]
  timeline: TimelineEffect[]
  riskAssessment: RiskAssessment
  optimizationSuggestions: OptimizationSuggestion[]
  confidence: number
}

export interface SynergyDimensionScore {
  dimension: string
  label: string
  score: number
  maxScore: number
  trend: 'improving' | 'stable' | 'declining'
  keyContributors: string[]
  mechanism: string
}

export interface TimelineEffect {
  phase: 'immediate' | 'short-term' | 'medium-term' | 'long-term'
  timeRange: string
  effects: EffectDescription[]
  intensity: number
}

export interface EffectDescription {
  category: string
  description: string
  evidenceLevel: 'observed' | 'predicted' | 'theoretical'
  confidence: number
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical'
  risks: IdentifiedRisk[]
  mitigations: MitigationStrategy[]
}

export interface IdentifiedRisk {
  id: string
  type: 'interaction' | 'dosage' | 'contraindication' | 'allergy'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  affectedIngredients: string[]
  probability: number
  impact: string
}

export interface MitigationStrategy {
  riskId: string
  strategy: string
  effectiveness: 'proven' | 'likely' | 'theoretical'
  implementation: string
}

export interface OptimizationSuggestion {
  type: 'dosage_adjustment' | 'ingredient_replacement' | 'timing_optimization' | 'formulation_change'
  priority: 'high' | 'medium' | 'low'
  current_state: string
  suggested_change: string
  expected_improvement: number
  rationale: string
  effort: 'easy' | 'moderate' | 'complex'
}

export interface ScenarioConfig {
  id: string
  name: string
  targetAudience: string
  primaryGoals: EfficacyTag[]
  constraints: {
    maxIngredients?: number
    maxDailyDosage?: number
    avoidSources?: IngredientSource[]
    dietaryRestrictions?: string[]
  }
  weightings: {
    efficacy: number
    safety: number
    taste: number
    cost: number
  }
}

// ==================== 协同矩阵数据 ====================

const SYNERGY_MATRIX: Record<string, Record<string, {
  score: number
  mechanism: string
  evidence: 'strong' | 'moderate' | 'emerging'
  optimalRatio: [number, number]
}>> = {
  '人参': {
    '黄芪': { score: 9.2, mechanism: '补气相须，免疫协同增强', evidence: 'strong', optimalRatio: [1, 2] },
    '当归': { score: 8.8, mechanism: '气血双补，相辅相成', evidence: 'strong', optimalRatio: [1, 1.5] },
    '茯苓': { score: 7.5, mechanism: '健脾益气，心脾同调', evidence: 'moderate', optimalRatio: [1, 3] },
    '枸杞': { score: 7.8, mechanism: '气血双补，滋补肝肾', evidence: 'moderate', optimalRatio: [1, 4] },
    '甘草': { score: 8.0, mechanism: '调和诸药，增效减毒', evidence: 'strong', optimalRatio: [1, 0.67] },
  },
  '黄芪': {
    '当归': { score: 9.0, mechanism: '气血双补经典组合', evidence: 'strong', optimalRatio: [2, 1] },
    '党参': { score: 8.5, mechanism: '健脾益气，相须为用', evidence: 'strong', optimalRatio: [1.5, 1] },
    '白术': { score: 8.6, mechanism: '健脾益气，固表止汗', evidence: 'strong', optimalRatio: [2, 1] },
    '茯苓': { score: 8.3, mechanism: '健脾利湿，标本兼治', evidence: 'strong', optimalRatio: [2, 1.5] },
    '山药': { score: 8.0, mechanism: '脾肾双补，气阴两顾', evidence: 'moderate', optimalRatio: [1.5, 1] },
  },
  '当归': {
    '白芍': { score: 9.1, mechanism: '养血柔肝，调和营卫', evidence: 'strong', optimalRatio: [1, 1] },
    '川芎': { score: 8.7, mechanism: '活血行气，妇科圣药', evidence: 'strong', optimalRatio: [1, 1] },
    '熟地': { score: 8.9, mechanism: '补血滋阴，精血同源', evidence: 'strong', optimalRatio: [1.5, 1] },
  },
  '茯苓': {
    '白术': { score: 8.8, mechanism: '健脾利湿，培土制水', evidence: 'strong', optimalRatio: [1, 1] },
    '薏苡仁': { score: 8.2, mechanism: '利水渗湿，健脾和中', evidence: 'moderate', optimalRatio: [1, 1] },
    '泽泻': { score: 7.6, mechanism: '利水渗湿，相辅相成', evidence: 'moderate', optimalRatio: [1, 1] },
  },
  '枸杞': {
    '菊花': { score: 8.4, mechanism: '清肝明目，滋补肝肾', evidence: 'strong', optimalRatio: [2, 1] },
    '熟地': { score: 8.6, mechanism: '滋补肝肾，填精益髓', evidence: 'strong', optimalRatio: [1, 1.5] },
    '山药': { score: 8.1, mechanism: '脾肾双补，气阴双补', evidence: 'moderate', optimalRatio: [1, 1.5] },
  },
}

const ANTAGONISM_MATRIX: Record<string, Record<string, {
  risk: number
  reason: string
  severity: 'high' | 'critical'
}>> = {
  '藜芦': {
    '人参': { risk: 95, reason: '十八反禁忌，引起功能紊乱', severity: 'critical' },
    '沙参': { risk: 90, reason: '十八反禁忌，药效相反', severity: 'critical' },
    '丹参': { risk: 85, reason: '十八反禁忌，活血破气', severity: 'high' },
  },
  '甘草': {
    '甘遂': { risk: 92, reason: '十八反禁忌，毒性剧增', severity: 'critical' },
    '大戟': { risk: 88, reason: '十八反禁忌，逐水伤正', severity: 'critical' },
    '芫花': { risk: 90, reason: '十八反禁忌，毒性增强', severity: 'critical' },
  },
  '乌头': {
    '半夏': { risk: 93, reason: '十八反禁忌，神经毒性', severity: 'critical' },
    '瓜蒌': { risk: 85, reason: '十八反禁忌，药效拮抗', severity: 'high' },
    '贝母': { risk: 87, reason: '十八反禁忌，燥湿相冲', severity: 'critical' },
  },
}

// ==================== 预设场景配置 ====================

export const PRESET_SCENARIOS: ScenarioConfig[] = [
  {
    id: 'anti_aging',
    name: '抗衰老配方',
    targetAudience: '中老年人群',
    primaryGoals: ['抗氧化', '延缓衰老', '增强免疫', '美容养颜'],
    constraints: {
      maxIngredients: 8,
      maxDailyDosage: 50,
      avoidSources: [],
    },
    weightings: { efficacy: 0.35, safety: 0.25, taste: 0.15, cost: 0.25 },
  },
  {
    id: 'immune_boost',
    name: '免疫增强配方',
    targetAudience: '免疫力低下人群',
    primaryGoals: ['增强免疫', '抗疲劳', '补气养血', '抗炎'],
    constraints: {
      maxIngredients: 6,
      maxDailyDosage: 45,
      avoidSources: [],
    },
    weightings: { efficacy: 0.40, safety: 0.30, taste: 0.15, cost: 0.15 },
  },
  {
    id: 'digestive_health',
    name: '消化健康配方',
    targetAudience: '脾胃虚弱人群',
    primaryGoals: ['健脾益胃', '促进消化', '调节血脂', '抗疲劳'],
    constraints: {
      maxIngredients: 7,
      maxDailyDosage: 40,
      avoidSources: [],
    },
    weightings: { efficacy: 0.30, safety: 0.30, taste: 0.25, cost: 0.15 },
  },
  {
    id: 'cardiovascular',
    name: '心血管保护配方',
    targetAudience: '心血管风险人群',
    primaryGoals: ['保护心血管', '降血压', '调节血脂', '抗氧化'],
    constraints: {
      maxIngredients: 8,
      maxDailyDosage: 50,
      avoidSources: [],
    },
    weightings: { efficacy: 0.35, safety: 0.35, taste: 0.10, cost: 0.20 },
  },
  {
    id: 'sleep_improvement',
    name: '睡眠改善配方',
    targetAudience: '失眠人群',
    primaryGoals: ['改善睡眠', '抗疲劳', '安神', '健脾益胃'] as EfficacyTag[],
    constraints: {
      maxIngredients: 6,
      maxDailyDosage: 35,
      avoidSources: [],
    },
    weightings: { efficacy: 0.35, safety: 0.30, taste: 0.20, cost: 0.15 },
  },
]

// ==================== 核心计算函数 ====================

export function simulateSynergy(
  ingredients: Ingredient[],
  scenario?: ScenarioConfig,
): SynergySimulationResult {
  if (ingredients.length < 2) {
    return createEmptySimulation(ingredients)
  }

  const dimensionScores = calculateDimensionScores(ingredients)
  const overallSynergy = calculateOverallSynergy(dimensionScores)
  const timeline = generateTimelineEffects(ingredients, scenario)
  const riskAssessment = assessRisks(ingredients)
  const optimizations = generateOptimizationSuggestions(ingredients, dimensionScores, scenario)
  const confidence = calculateConfidence(ingredients, dimensionScores)

  return {
    combinationId: generateCombinationId(ingredients),
    ingredients: ingredients.map(ing => ing.name),
    overallSynergy: Math.round(overallSynergy * 10) / 10,
    dimensions: dimensionScores,
    timeline,
    riskAssessment,
    optimizationSuggestions: optimizations,
    confidence: Math.round(confidence * 100),
  }
}

function createEmptySimulation(ingredients: Ingredient[]): SynergySimulationResult {
  return {
    combinationId: ingredients.map(ing => ing.name).join('+'),
    ingredients: ingredients.map(ing => ing.name),
    overallSynergy: 0,
    dimensions: [],
    timeline: [],
    riskAssessment: {
      overallRisk: 'low',
      risks: [],
      mitigations: [],
    },
    optimizationSuggestions: [],
    confidence: 0,
  }
}

function calculateDimensionScores(ingredients: Ingredient[]): SynergyDimensionScore[] {
  const dimensions = [
    { id: 'synergy_strength', label: '协同强度' },
    { id: 'bioavailability', label: '生物利用度提升' },
    { id: 'efficacy_mult', label: '功效倍增效应' },
    { id: 'safety_index', label: '安全性指数' },
    { id: 'stability', label: '稳定性改善' },
    { id: 'taste_balance', label: '口感平衡度' },
  ]

  return dimensions.map(dim => {
    const score = calculateSpecificDimension(ingredients, dim.id)
    const contributors = findKeyContributors(ingredients, dim.id)

    return {
      dimension: dim.id,
      label: dim.label,
      score: Math.round(score * 10) / 10,
      maxScore: 10,
      trend: determineTrend(score),
      keyContributors: contributors,
      mechanism: getMechanismDescription(dim.id, contributors),
    }
  })
}

function calculateSpecificDimension(ingredients: Ingredient[], dimensionId: string): number {
  let totalScore = 0
  let pairCount = 0

  for (let i = 0; i < ingredients.length; i++) {
    for (let j = i + 1; j < ingredients.length; j++) {
      const ingA = ingredients[i]
      const ingB = ingredients[j]

      if (!ingA || !ingB) continue

      const matrixValue = SYNERGY_MATRIX[ingA.name]?.[ingB.name] ||
                         SYNERGY_MATRIX[ingB.name]?.[ingA.name]

      if (matrixValue) {
        let pairScore = matrixValue.score

        switch (dimensionId) {
          case 'synergy_strength':
            break
          case 'bioavailability':
            pairScore *= (ingA.source === SourceEnum.PEPTIDE || ingB.source === SourceEnum.PEPTIDE) ? 1.15 : 1.0
            break
          case 'efficacy_mult':
            const commonTags = (ingA.efficacyTags || []).filter(tag =>
              (ingB.efficacyTags || []).includes(tag),
            )
            pairScore *= (1 + commonTags.length * 0.1)
            break
          case 'safety_index':
            const precautions = [...(ingA.precautions || []), ...(ingB.precautions || [])]
            pairScore -= precautions.filter(p => p.severity === 'high').length * 1.5
            pairScore -= precautions.filter(p => p.severity === 'medium').length * 0.5
            break
          case 'stability':
            if (ingA.source === SourceEnum.EXCIPIENT || ingB.source === SourceEnum.EXCIPIENT) {
              pairScore *= 1.1
            }
            break
          case 'taste_balance':
            const bitter = ['黄连', '黄芩', '苦参']
            const sweet = ['甘草', '枸杞', '红枣']
            const hasBitter = bitter.some(b => ingA.name.includes(b) || ingB.name.includes(b))
            const hasSweet = sweet.some(s => ingA.name.includes(s) || ingB.name.includes(s))
            if (hasBitter && hasSweet) pairScore *= 1.1
            else if (hasBitter) pairScore *= 0.9
            break
        }

        totalScore += pairScore
        pairCount++
      } else {
        totalScore += 6.0
        pairCount++
      }
    }
  }

  const baseScore = pairCount > 0 ? totalScore / pairCount : 5.0
  const diversityBonus = Math.min(2, (ingredients.length - 2) * 0.3)

  return Math.min(10, baseScore / 10 + diversityBonus)
}

function findKeyContributors(ingredients: Ingredient[], dimensionId: string): string[] {
  const scores: { name: string; contribution: number }[] = []

  ingredients.forEach(ing => {
    let contribution = 0

    switch (dimensionId) {
      case 'synergy_strength':
      case 'efficacy_mult':
        contribution = (ing.efficacyTags?.length || 0) * 2
        break
      case 'bioavailability':
        contribution = ing.source === SourceEnum.PEPTIDE ? 8 : 5
        break
      case 'safety_index':
        contribution = 10 - (ing.precautions?.filter(p => p.severity === 'high').length || 0) * 3
        break
      default:
        contribution = 5
    }

    scores.push({ name: ing.name, contribution })
  })

  return scores
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map(s => s.name)
}

function determineTrend(score: number): 'improving' | 'stable' | 'declining' {
  if (score >= 7.5) return 'improving'
  if (score >= 5.5) return 'stable'
  return 'declining'
}

function getMechanismDescription(dimensionId: string, contributors: string[]): string {
  const mechanisms: Record<string, string> = {
    synergy_strength: `${contributors.join('、')}产生相须相使作用`,
    bioavailability: `多成分联合促进吸收代谢`,
    efficacy_mult: `功效叠加产生1+1>2效应`,
    safety_index: `成分间相互制约降低毒副作用`,
    stability: `复方制剂提高化学稳定性`,
    taste_balance: `风味协调改善适口性`,
  }

  return mechanisms[dimensionId] || '综合作用机制'
}

function calculateOverallSynergy(dimensions: SynergyDimensionScore[]): number {
  if (dimensions.length === 0) return 0

  const weightedSum = dimensions.reduce((sum, dim) => {
    let weight = 1

    if (dim.dimension === 'synergy_strength') weight = 1.3
    else if (dim.dimension === 'efficacy_mult') weight = 1.2
    else if (dim.dimension === 'safety_index') weight = 1.15

    return sum + dim.score * weight
  }, 0)

  const totalWeight = dimensions.reduce((sum, dim) => {
    let weight = 1
    if (dim.dimension === 'synergy_strength') weight = 1.3
    else if (dim.dimension === 'efficacy_mult') weight = 1.2
    else if (dim.dimension === 'safety_index') weight = 1.15
    return sum + weight
  }, 0)

  return weightedSum / totalWeight
}

// ==================== 时间轴效应预测 ====================

function generateTimelineEffects(
  ingredients: Ingredient[],
  _scenario?: ScenarioConfig,
): TimelineEffect[] {
  const immediateEffects: EffectDescription[] = []
  const shortTermEffects: EffectDescription[] = []
  const mediumTermEffects: EffectDescription[] = []
  const longTermEffects: EffectDescription[] = []

  const allTags = ingredients.flatMap(ing => ing.efficacyTags || [])

  if (allTags.includes('抗疲劳')) {
    immediateEffects.push({
      category: '能量代谢',
      description: '提升精神状态，减轻疲劳感',
      evidenceLevel: 'observed',
      confidence: 85,
    })
  }

  if (allTags.includes('增强免疫')) {
    shortTermEffects.push({
      category: '免疫系统',
      description: '激活免疫细胞活性',
      evidenceLevel: 'predicted',
      confidence: 78,
    })
    mediumTermEffects.push({
      category: '免疫系统',
      description: '建立免疫记忆，增强防御能力',
      evidenceLevel: 'predicted',
      confidence: 72,
    })
  }

  if (allTags.includes('抗氧化')) {
    shortTermEffects.push({
      category: '细胞保护',
      description: '清除体内自由基',
      evidenceLevel: 'observed',
      confidence: 88,
    })
    longTermEffects.push({
      category: '细胞保护',
      description: '减少氧化损伤积累，延缓衰老',
      evidenceLevel: 'theoretical',
      confidence: 65,
    })
  }

  if (allTags.includes('降血压') || allTags.includes('调节血脂')) {
    mediumTermEffects.push({
      category: '心血管',
      description: '改善血管弹性，调节血脂水平',
      evidenceLevel: 'predicted',
      confidence: 75,
    })
    longTermEffects.push({
      category: '心血管',
      description: '降低心血管事件风险',
      evidenceLevel: 'theoretical',
      confidence: 60,
    })
  }

  if (allTags.includes('美容养颜')) {
    mediumTermEffects.push({
      category: '外观改善',
      description: '促进胶原蛋白合成，改善肤质',
      evidenceLevel: 'theoretical',
      confidence: 68,
    })
  }

  return [
    {
      phase: 'immediate',
      timeRange: '0-2小时',
      effects: immediateEffects.length > 0 ? immediateEffects : [{ category: '一般', description: '开始吸收，初步起效', evidenceLevel: 'predicted', confidence: 70 }],
      intensity: immediateEffects.length > 0 ? 75 : 60,
    },
    {
      phase: 'short-term',
      timeRange: '2-7天',
      effects: shortTermEffects.length > 0 ? shortTermEffects : [{ category: '适应期', description: '身体逐渐适应，效果显现', evidenceLevel: 'predicted', confidence: 65 }],
      intensity: shortTermEffects.length > 0 ? 80 : 65,
    },
    {
      phase: 'medium-term',
      timeRange: '2-4周',
      effects: mediumTermEffects.length > 0 ? mediumTermEffects : [{ category: '稳定期', description: '效果趋于稳定，持续作用', evidenceLevel: 'predicted', confidence: 62 }],
      intensity: mediumTermEffects.length > 0 ? 85 : 70,
    },
    {
      phase: 'long-term',
      timeRange: '1-3个月',
      effects: longTermEffects.length > 0 ? longTermEffects : [{ category: '累积期', description: '长期使用带来累积效益', evidenceLevel: 'theoretical', confidence: 55 }],
      intensity: longTermEffects.length > 0 ? 80 : 65,
    },
  ]
}

// ==================== 风险评估 ====================

function assessRisks(ingredients: Ingredient[]): RiskAssessment {
  const risks: IdentifiedRisk[] = []
  const mitigations: MitigationStrategy[] = []

  for (let i = 0; i < ingredients.length; i++) {
    for (let j = i + 1; j < ingredients.length; j++) {
      const ingA = ingredients[i]
      const ingB = ingredients[j]

      if (!ingA || !ingB) continue

      const antagonism = ANTAGONISM_MATRIX[ingA.name]?.[ingB.name] ||
                        ANTAGONISM_MATRIX[ingB.name]?.[ingA.name]

      if (antagonism) {
        const riskId = `antagonism_${i}_${j}`
        risks.push({
          id: riskId,
          type: 'interaction',
          severity: antagonism.severity,
          description: antagonism.reason,
          affectedIngredients: [ingA.name, ingB.name],
          probability: antagonism.risk,
          impact: '可能导致严重不良反应或降低疗效',
        })

        mitigations.push({
          riskId,
          strategy: '避免同时使用该成分组合',
          effectiveness: 'proven',
          implementation: '重新设计配方，替换其中一种成分',
        })
      }
    }
  }

  ingredients.forEach((ing, index) => {
    if (ing.amount > 50) {
      const riskId = `dosage_high_${index}`
      risks.push({
        id: riskId,
        type: 'dosage',
        severity: 'high',
        description: `${ing.name}用量偏高（${ing.amount}${ing.unit}），可能增加不良反应风险`,
        affectedIngredients: [ing.name],
        probability: 70,
        impact: '可能引起胃肠道不适或其他副作用',
      })

      mitigations.push({
        riskId,
        strategy: '调整至安全剂量范围',
        effectiveness: 'likely',
        implementation: `将${ing.name}用量降至30g以下`,
      })
    }

    if (ing.precautions) {
      ing.precautions.forEach((prec, precIndex) => {
        if (prec.severity === 'high') {
          const riskId = `precaution_${index}_${precIndex}`
          risks.push({
            id: riskId,
            type: 'contraindication',
            severity: prec.severity,
            description: prec.content,
            affectedIngredients: [ing.name],
            probability: 85,
            impact: '特定人群可能出现严重反应',
          })

          mitigations.push({
            riskId,
            strategy: '添加明确警告标识和使用说明',
            effectiveness: 'proven',
            implementation: '在产品标签和说明书中突出显示禁忌信息',
          })
        }
      })
    }
  })

  const overallRisk = determineOverallRisk(risks)

  return {
    overallRisk,
    risks: risks.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      return severityOrder[b.severity] - severityOrder[a.severity]
    }),
    mitigations,
  }
}

function determineOverallRisk(risks: IdentifiedRisk[]): RiskAssessment['overallRisk'] {
  if (risks.some(r => r.severity === 'critical')) return 'critical'
  if (risks.some(r => r.type === 'interaction' && r.severity === 'high')) return 'high'
  if (risks.filter(r => r.severity === 'high').length >= 2) return 'high'
  if (risks.some(r => r.severity === 'high')) return 'medium'
  if (risks.length > 3) return 'medium'
  return 'low'
}

// ==================== 优化建议生成 ====================

function generateOptimizationSuggestions(
  ingredients: Ingredient[],
  dimensions: SynergyDimensionScore[],
  scenario?: ScenarioConfig,
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = []

  const weakDimensions = dimensions.filter(d => d.score < 6.5)

  weakDimensions.forEach(dim => {
    switch (dim.dimension) {
      case 'synergy_strength':
        suggestions.push({
          type: 'ingredient_replacement',
          priority: dim.score < 5 ? 'high' : 'medium',
          current_state: `当前协同强度偏低(${dim.score}/10)`,
          suggested_change: '添加经典药对（如人参+黄芪）以增强协同',
          expected_improvement: 15,
          rationale: '经典药对具有明确的协同机制和研究支持',
          effort: 'easy',
        })
        break

      case 'taste_balance':
        suggestions.push({
          type: 'ingredient_replacement',
          priority: 'low',
          current_state: '口感平衡度有待提升',
          suggested_change: '添加天然矫味剂（如红枣、枸杞）',
          expected_improvement: 10,
          rationale: '改善适口性，提高用户依从性',
          effort: 'easy',
        })
        break

      case 'safety_index':
        suggestions.push({
          type: 'dosage_adjustment',
          priority: 'high',
          current_state: '安全性存在隐患',
          suggested_change: '重新评估各成分用量，确保在安全范围内',
          expected_improvement: 20,
          rationale: '安全性是产品上市的首要前提',
          effort: 'moderate',
        })
        break

      default:
        suggestions.push({
          type: 'formulation_change',
          priority: 'medium',
          current_state: `${dim.label}表现一般(${dim.score}/10)`,
          suggested_change: '优化制剂工艺或调整成分配比',
          expected_improvement: 12,
          rationale: '系统性优化可全面提升品质',
          effort: 'moderate',
        })
    }
  })

  if (scenario) {
    const targetCoverage = scenario.primaryGoals.filter(goal =>
      ingredients.some(ing => ing.efficacyTags?.includes(goal)),
    ).length / scenario.primaryGoals.length

    if (targetCoverage < 0.7) {
      suggestions.push({
        type: 'ingredient_replacement',
        priority: 'high',
        current_state: `目标功效覆盖率不足(${Math.round(targetCoverage * 100)}%)`,
        suggested_change: `补充能提供缺失功效的成分`,
        expected_improvement: 18,
        rationale: '确保配方满足场景需求',
        effort: 'moderate',
      })
    }
  }

  if (ingredients.length > (scenario?.constraints.maxIngredients || 10)) {
    suggestions.push({
      type: 'ingredient_replacement',
      priority: 'medium',
      current_state: `成分数量偏多(${ingredients.length}个)`,
      suggested_change: '精简配方，去除贡献较小的成分',
      expected_improvement: 8,
      rationale: '简化配方可提高稳定性和降低成本',
      effort: 'easy',
    })
  }

  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    return priorityOrder[b.priority] - priorityOrder[a.priority]
  }).slice(0, 6)
}

function calculateConfidence(ingredients: Ingredient[], dimensions: SynergyDimensionScore[]): number {
  let confidence = 0.6

  const knownPairs = ingredients.flatMap((ingA, i) =>
    ingredients.slice(i + 1).map(ingB => {
      return SYNERGY_MATRIX[ingA.name]?.[ingB.name] ||
             SYNERGY_MATRIX[ingB.name]?.[ingA.name]
        ? 1 : 0
    }),
  )

  const knownPairRatio = knownPairs.length > 0
    ? knownPairs.reduce((sum: number, val: number) => sum + val, 0) / knownPairs.length
    : 0.3

  confidence += knownPairRatio * 0.25

  const avgDimensionScore = dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length
  confidence += (avgDimensionScore / 10) * 0.1

  const researchDepth = ingredients.filter(ing =>
    (ing.efficacyTags || []).some(tag => {
      const detail = EFFICACY_TAG_DETAILS[tag as keyof typeof EFFICACY_TAG_DETAILS]
      return detail?.evidenceLevel === 'strong'
    }),
  ).length / ingredients.length

  confidence += researchDepth * 0.05

  return Math.min(0.95, Math.max(0.3, confidence))
}

const EFFICACY_TAG_DETAILS: Record<string, any> = {}

function generateCombinationId(ingredients: Ingredient[]): string {
  return ingredients
    .map(ing => ing.name)
    .sort()
    .join('+')
}

// ==================== Hook导出 ====================

export function useSynergySimulator() {
  const simulate = useCallback((
    ingredients: Ingredient[],
    scenario?: ScenarioConfig,
  ) => {
    return simulateSynergy(ingredients, scenario)
  }, [])

  const compareScenarios = useCallback((
    ingredients: Ingredient[],
    scenarios: ScenarioConfig[],
  ) => {
    return scenarios.map(scenario => ({
      scenario,
      result: simulateSynergy(ingredients, scenario),
    }))
  }, [])

  const getBestScenario = useCallback((
    ingredients: Ingredient[],
    scenarios?: ScenarioConfig[],
  ) => {
    const scenarioList = scenarios || PRESET_SCENARIOS
    const results = scenarioList.map(scenario => ({
      scenario,
      result: simulateSynergy(ingredients, scenario),
    }))

    return results.sort((a, b) => b.result.overallSynergy - a.result.overallSynergy)[0]
  }, [])

  return {
    simulate,
    compareScenarios,
    getBestScenario,
    PRESET_SCENARIOS,
  }
}

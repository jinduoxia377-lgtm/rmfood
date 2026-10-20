/**
 * IngredientDeepAnalysis v2.0 - 成分深度分析可视化系统
 *
 * 功能特性:
 * - 多维度成分画像（功效热力图、安全性雷达、来源分布）
 * - 成分对比分析（并排对比、差异高亮）
 * - 功效关联网络图
 * - 智能成分推荐（基于缺失功效补全）
 * - 禁忌检测与警告系统
 */

import React, { useState, useCallback } from 'react'
import {
  Microscope,
  Shield,
  Zap,
  Activity,
  Layers,
  Thermometer
} from 'lucide-react'
import type { Ingredient, EfficacyTag, IngredientSource } from '@/types/ai.types'
import { IngredientSource as SourceEnum } from '@/types/ai.types'

// ==================== 类型定义 ====================

export interface AnalysisDimension {
  id: string
  label: string
  icon: React.ReactNode
  score: number
  maxScore: number
  color: string
  description: string
  details: string[]
}

export interface IngredientProfile {
  ingredient: Ingredient
  dimensions: AnalysisDimension[]
  overallScore: number
  strengths: EfficacyTag[]
  weaknesses: EfficacyTag[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  recommendations: string[]
}

export interface ComparisonResult {
  ingredientA: IngredientProfile
  ingredientB: IngredientProfile
  similarities: string[]
  differences: { aspect: string; valueA: string; valueB: string }[]
  synergyPotential: number
  recommendation: string
}

export interface RecommendedIngredient {
  name: string
  source: IngredientSource
  efficacyTags: EfficacyTag[]
  synergyScore: number
  rationale: string
  dosage: { min: number; max: number; optimal: number }
  confidence: 'high' | 'medium' | 'low'
}

// ==================== 常量配置 ====================

const DIMENSION_CONFIG: AnalysisDimension[] = [
  {
    id: 'efficacy',
    label: '功效强度',
    icon: React.createElement(Zap, { className: "w-4 h-4" }),
    score: 0,
    maxScore: 10,
    color: 'var(--color-secondary-500)',
    description: '基于功效标签的综合评分',
    details: []
  },
  {
    id: 'safety',
    label: '安全系数',
    icon: React.createElement(Shield, { className: "w-4 h-4" }),
    score: 0,
    maxScore: 10,
    color: 'var(--color-primary-400)',
    description: '基于注意事项和用量的安全评估',
    details: []
  },
  {
    id: 'bioavailability',
    label: '生物利用度',
    icon: React.createElement(Activity, { className: "w-4 h-4" }),
    score: 0,
    maxScore: 10,
    color: 'var(--color-accent-500)',
    description: '成分在体内的吸收效率预估',
    details: []
  },
  {
    id: 'stability',
    label: '稳定性',
    icon: React.createElement(Thermometer, { className: "w-4 h-4" }),
    score: 0,
    maxScore: 10,
    color: '#D97706',
    description: '储存和使用过程中的稳定表现',
    details: []
  },
  {
    id: 'versatility',
    label: '适用广度',
    icon: React.createElement(Layers, { className: "w-4 h-4" }),
    score: 0,
    maxScore: 10,
    color: '#D946EF',
    description: '可应用的场景和人群范围',
    details: []
  },
  {
    id: 'researchDepth',
    label: '研究深度',
    icon: React.createElement(Microscope, { className: "w-4 h-4" }),
    score: 0,
    maxScore: 10,
    color: 'var(--color-info-600)',
    description: '现代科学研究支持程度',
    details: []
  }
]

const EFFICACY_TAG_DETAILS: Record<EfficacyTag, {
  category: string
  mechanism: string
  evidenceLevel: 'strong' | 'moderate' | 'emerging'
  relatedTags: EfficacyTag[]
}> = {
  '补气养血': {
    category: '气血调节',
    mechanism: '促进造血功能、改善微循环',
    evidenceLevel: 'strong',
    relatedTags: ['增强免疫', '抗疲劳', '美容养颜']
  },
  '抗氧化': {
    category: '细胞保护',
    mechanism: '清除自由基、减少氧化应激',
    evidenceLevel: 'strong',
    relatedTags: ['延缓衰老', '保护心血管', '抗炎']
  },
  '降血压': {
    category: '心血管健康',
    mechanism: '扩张血管、调节血管紧张素',
    evidenceLevel: 'moderate',
    relatedTags: ['保护心血管', '调节血脂']
  },
  '降血糖': {
    category: '代谢调节',
    mechanism: '促进胰岛素分泌、提高敏感性',
    evidenceLevel: 'moderate',
    relatedTags: ['调节血脂', '健脾益胃']
  },
  '增强免疫': {
    category: '免疫系统',
    mechanism: '激活免疫细胞、增强防御能力',
    evidenceLevel: 'strong',
    relatedTags: ['补气养血', '抗疲劳', '抗炎']
  },
  '抗疲劳': {
    category: '能量代谢',
    mechanism: '提升线粒体功能、改善能量代谢',
    evidenceLevel: 'moderate',
    relatedTags: ['增强免疫', '补气养血', '改善睡眠']
  },
  '改善睡眠': {
    category: '神经系统',
    mechanism: '调节神经递质、舒缓神经系统',
    evidenceLevel: 'moderate',
    relatedTags: ['抗疲劳', '安神']
  } as Record<string, unknown>,
  '护肝': {
    category: '器官保护',
    mechanism: '促进肝细胞再生、解毒功能',
    evidenceLevel: 'strong',
    relatedTags: ['抗氧化', '降血糖']
  },
  '健脾益胃': {
    category: '消化系统',
    mechanism: '促进消化酶分泌、调理脾胃功能',
    evidenceLevel: 'strong',
    relatedTags: ['促进消化', '增强免疫']
  },
  '美容养颜': {
    category: '外观改善',
    mechanism: '促进胶原蛋白合成、改善肤质',
    evidenceLevel: 'emerging',
    relatedTags: ['抗氧化', '延缓衰老', '补气养血']
  },
  '抗炎': {
    category: '炎症调控',
    mechanism: '抑制炎症因子、减轻炎症反应',
    evidenceLevel: 'strong',
    relatedTags: ['抗氧化', '保护心血管', '增强免疫']
  },
  '调节血脂': {
    category: '代谢调节',
    mechanism: '降低胆固醇、调节脂质代谢',
    evidenceLevel: 'moderate',
    relatedTags: ['保护心血管', '降血糖']
  },
  '保护心血管': {
    category: '心血管健康',
    mechanism: '保护心肌、改善血液循环',
    evidenceLevel: 'strong',
    relatedTags: ['降血压', '调节血脂', '抗氧化']
  },
  '延缓衰老': {
    category: '抗衰老',
    mechanism: '对抗氧化损伤、修复细胞',
    evidenceLevel: 'emerging',
    relatedTags: ['抗氧化', '美容养颜', '增强免疫']
  },
  '促进消化': {
    category: '消化系统',
    mechanism: '促进胃肠蠕动、帮助消化吸收',
    evidenceLevel: 'strong',
    relatedTags: ['健脾益胃']
  },
  '安神': {
    category: '神经系统',
    mechanism: '镇静安神、调节情绪状态',
    evidenceLevel: 'moderate',
    relatedTags: ['改善睡眠', '抗疲劳']
  }
}

// ==================== 核心分析函数 ====================

export function generateIngredientProfile(ingredient: Ingredient): IngredientProfile {
  const dimensions = DIMENSION_CONFIG.map(config => ({
    ...config,
    score: calculateDimensionScore(ingredient, config.id),
    maxScore: 10,
    details: generateDimensionDetails(ingredient, config.id)
  }))

  const overallScore = dimensions.reduce((sum, dim) => sum + dim.score, 0) / dimensions.length

  const allTags = ingredient.efficacyTags || []
  const strengths = allTags.filter(tag => {
    const detail = EFFICACY_TAG_DETAILS[tag]
    return detail && (detail.evidenceLevel === 'strong' || tag === '抗氧化' || tag === '增强免疫')
  })

  const weaknesses = allTags.filter(tag => {
    const detail = EFFICACY_TAG_DETAILS[tag]
    return detail && detail.evidenceLevel === 'emerging'
  })

  const precautions = ingredient.precautions || []
  let riskLevel: IngredientProfile['riskLevel'] = 'low'

  if (precautions.some(p => p.severity === 'high')) {
    riskLevel = 'critical'
  } else if (precautions.some(p => p.severity === 'medium')) {
    riskLevel = 'high'
  } else if (precautions.length > 2) {
    riskLevel = 'medium'
  }

  const recommendations = generateRecommendations(ingredient, dimensions)

  return {
    ingredient,
    dimensions,
    overallScore: Math.round(overallScore * 10) / 10,
    strengths,
    weaknesses,
    riskLevel,
    recommendations
  }
}

function calculateDimensionScore(ingredient: Ingredient, dimensionId: string): number {
  switch (dimensionId) {
    case 'efficacy':
      return calculateEfficacyDimension(ingredient)
    case 'safety':
      return calculateSafetyDimension(ingredient)
    case 'bioavailability':
      return calculateBioavailabilityDimension(ingredient)
    case 'stability':
      return calculateStabilityDimension(ingredient)
    case 'versatility':
      return calculateVersatilityDimension(ingredient)
    case 'researchDepth':
      return calculateResearchDepthDimension(ingredient)
    default:
      return 5
  }
}

function calculateEfficacyDimension(ingredient: Ingredient): number {
  const tags = ingredient.efficacyTags || []
  if (tags.length === 0) return 3

  let totalWeight = 0
  tags.forEach(tag => {
    const detail = EFFICACY_TAG_DETAILS[tag]
    if (detail) {
      totalWeight += detail.evidenceLevel === 'strong' ? 9 :
                     detail.evidenceLevel === 'moderate' ? 7 : 5
    } else {
      totalWeight += 6
    }
  })

  return Math.min(10, Math.round((totalWeight / tags.length) * 10) / 10)
}

function calculateSafetyDimension(ingredient: Ingredient): number {
  let score = 9
  const precautions = ingredient.precautions || []

  precautions.forEach(prec => {
    switch (prec.severity) {
      case 'high': score -= 4; break
      case 'medium': score -= 2; break
      default: score -= 0.5
    }
  })

  if (ingredient.amount > 30) score -= 1
  if (ingredient.amount > 50) score -= 1

  return Math.max(1, Math.round(score * 10) / 10)
}

function calculateBioavailabilityDimension(ingredient: Ingredient): number {
  let baseScore = 6

  const highBioavailabilityIngredients = ['人参皂苷', '多糖类', '黄酮类', '多肽']

  if (highBioavailabilityIngredients.some(hi => ingredient.name.includes(hi))) {
    baseScore += 2
  }

  if (ingredient.source === SourceEnum.PEPTIDE) {
    baseScore += 1.5
  }

  return Math.min(10, Math.round(baseScore * 10) / 10)
}

function calculateStabilityDimension(ingredient: Ingredient): number {
  let baseScore = 7

  if (ingredient.source === SourceEnum.EXCIPIENT) {
    baseScore = 9
  }

  if (ingredient.source === SourceEnum.PEPTIDE) {
    baseScore -= 0.5
  }

  return Math.min(10, Math.round(baseScore * 10) / 10)
}

function calculateVersatilityDimension(ingredient: Ingredient): number {
  const tags = ingredient.efficacyTags || []

  const categories = new Set(
    tags.map(tag => EFFICACY_TAG_DETAILS[tag]?.category).filter(Boolean)
  )

  let score = 4 + categories.size * 1.2

  if (tags.length >= 5) score += 1

  return Math.min(10, Math.round(score * 10) / 10)
}

function calculateResearchDepthDimension(ingredient: Ingredient): number {
  const tags = ingredient.efficacyTags || []

  const strongEvidenceCount = tags.filter(tag =>
    EFFICACY_TAG_DETAILS[tag]?.evidenceLevel === 'strong'
  ).length

  const moderateEvidenceCount = tags.filter(tag =>
    EFFICACY_TAG_DETAILS[tag]?.evidenceLevel === 'moderate'
  ).length

  const score = 4 + strongEvidenceCount * 1.2 + moderateEvidenceCount * 0.8

  return Math.min(10, Math.round(score * 10) / 10)
}

function generateDimensionDetails(ingredient: Ingredient, dimensionId: string): string[] {
  const details: string[] = []

  switch (dimensionId) {
    case 'efficacy':
      details.push(`功效标签数: ${ingredient.efficacyTags?.length || 0}个`)
      if (ingredient.efficacyTags && ingredient.efficacyTags.length > 0) {
        details.push(`主要功效: ${ingredient.efficacyTags.slice(0, 3).join('、')}`)
      }
      break
    case 'safety':
      details.push(`注意事项: ${ingredient.precautions?.length || 0}条`)
      if (ingredient.amount > 30) {
        details.push('用量偏高，需关注')
      }
      break
    case 'bioavailability':
      details.push(`成分类型: ${ingredient.source === SourceEnum.TCM ? '药食同源' : ingredient.source === SourceEnum.PEPTIDE ? '食源性多肽' : '辅料'}`)
      break
    case 'stability':
      details.push(`稳定性基础分: ${ingredient.source === SourceEnum.EXCIPIENT ? '优秀' : '良好'}`)
      break
    case 'versatility': {
      const categories = new Set(
        (ingredient.efficacyTags || []).map(tag => EFFICACY_TAG_DETAILS[tag]?.category).filter(Boolean)
      )
      details.push(`覆盖领域: ${categories.size}个`)
      break
    }
    case 'researchDepth': {
      const strongCount = (ingredient.efficacyTags || []).filter(tag =>
        EFFICACY_TAG_DETAILS[tag]?.evidenceLevel === 'strong'
      ).length
      details.push(`强证据支持: ${strongCount}项`)
      break
    }
  }

  return details
}

function generateRecommendations(ingredient: Ingredient, dimensions: AnalysisDimension[]): string[] {
  const recommendations: string[] = []

  const weakDimensions = dimensions.filter(dim => dim.score < 6)
  weakDimensions.forEach(dim => {
    switch (dim.id) {
      case 'efficacy':
        recommendations.push('可考虑与其他高功效成分配伍以增强效果')
        break
      case 'safety':
        recommendations.push('建议严格控制用量并监测不良反应')
        break
      case 'bioavailability':
        recommendations.push('可探索新型制剂技术以提高生物利用度')
        break
      default:
        recommendations.push(`${dim.label}方面有优化空间`)
    }
  })

  if (recommendations.length === 0) {
    recommendations.push('该成分综合表现优异')
  }

  return recommendations
}

// ==================== 对比分析 ====================

export function compareIngredients(ingA: Ingredient, ingB: Ingredient): ComparisonResult {
  const profileA = generateIngredientProfile(ingA)
  const profileB = generateIngredientProfile(ingB)

  const commonTags = (ingA.efficacyTags || []).filter(tag =>
    (ingB.efficacyTags || []).includes(tag)
  )

  const similarities: string[] = [
    `共同功效: ${commonTags.length > 0 ? commonTags.join('、') : '无直接共同功效'}`,
    ingA.source === ingB.source ? `相同来源类别` : '',
    Math.abs(ingA.amount - ingB.amount) < 5 ? '用量接近' : ''
  ].filter(Boolean)

  const differences = [
    { aspect: '整体评分', valueA: `${profileA.overallScore}`, valueB: `${profileB.overallScore}` },
    { aspect: '功效标签数', valueA: `${ingA.efficacyTags?.length || 0}个`, valueB: `${ingB.efficacyTags?.length || 0}个` },
    { aspect: '用量', valueA: `${ingA.amount}${ingA.unit}`, valueB: `${ingB.amount}${ingB.unit}` },
    { aspect: '风险等级', valueA: getRiskLabel(profileA.riskLevel), valueB: getRiskLabel(profileB.riskLevel) }
  ]

  const synergyPotential = calculateSynergyPotential(ingA, ingB)

  const recommendation = generateComparisonRecommendation(profileA, profileB, synergyPotential)

  return {
    ingredientA: profileA,
    ingredientB: profileB,
    similarities,
    differences,
    synergyPotential,
    recommendation
  }
}

function getRiskLabel(level: string): string {
  const labels: Record<string, string> = {
    low: '低风险',
    medium: '中等风险',
    high: '高风险',
    critical: '严重风险'
  }
  return labels[level] || level
}

function calculateSynergyPotential(ingA: Ingredient, ingB: Ingredient): number {
  const commonTags = (ingA.efficacyTags || []).filter(tag =>
    (ingB.efficacyTags || []).includes(tag)
  )

  let potential = 50 + commonTags.length * 10

  if (ingA.source !== ingB.source) {
    potential += 15
  }

  const allTags = [...(ingA.efficacyTags || []), ...(ingB.efficacyTags || [])]
  const uniqueCategories = new Set(allTags.map(tag => EFFICACY_TAG_DETAILS[tag]?.category).filter(Boolean))
  potential += uniqueCategories.size * 3

  return Math.min(100, Math.round(potential))
}

function generateComparisonRecommendation(
  profileA: IngredientProfile,
  profileB: IngredientProfile,
  synergy: number
): string {
  if (synergy >= 75) {
    return `两个成分具有高度协同潜力(${synergy}%)，强烈建议联合使用以获得增效作用`
  } else if (synergy >= 60) {
    return `两成分存在一定协同性(${synergy}%)，可根据目标功效考虑组合`
  } else {
    return `协同潜力一般(${synergy}%)，若需组合使用建议添加桥梁成分`
  }
}

// ==================== 智能推荐 ====================

export function recommendComplementaryIngredients(
  currentIngredients: Ingredient[],
  targetEfficacies?: EfficacyTag[]
): RecommendedIngredient[] {
  const currentTags = currentIngredients.flatMap(ing => ing.efficacyTags || [])
  const missingTags = targetEfficacies?.filter(tag => !currentTags.includes(tag)) ||
    (Object.keys(EFFICACY_TAG_DETAILS) as EfficacyTag[]).filter(tag => !currentTags.includes(tag))

  const CANDIDATE_DB: RecommendedIngredient[] = [
    {
      name: '枸杞子',
      source: SourceEnum.TCM,
      efficacyTags: ['抗氧化', '延缓衰老', '护肝', '增强免疫'],
      synergyScore: 85,
      rationale: '富含多糖和胡萝卜素，广泛适用于多种配方',
      dosage: { min: 9, max: 20, optimal: 15 },
      confidence: 'high'
    },
    {
      name: '茯苓多糖',
      source: SourceEnum.PEPTIDE,
      efficacyTags: ['增强免疫', '健脾益胃', '抗疲劳', '安神'],
      synergyScore: 88,
      rationale: '现代提取技术，生物利用度高，免疫调节显著',
      dosage: { min: 5, max: 15, optimal: 10 },
      confidence: 'high'
    },
    {
      name: '葡萄籽提取物',
      source: SourceEnum.PEPTIDE,
      efficacyTags: ['抗氧化', '保护心血管', '美容养颜', '抗炎'],
      synergyScore: 82,
      rationale: '原花青素含量高，抗氧化能力强',
      dosage: { min: 2, max: 8, optimal: 5 },
      confidence: 'high'
    },
    {
      name: '红枣提取物',
      source: SourceEnum.TCM,
      efficacyTags: ['补气养血', '健脾益胃', '改善睡眠', '美容养颜'],
      synergyScore: 80,
      rationale: '天然甜味剂替代，口感好且营养丰富',
      dosage: { min: 10, max: 25, optimal: 15 },
      confidence: 'high'
    },
    {
      name: '姜黄素',
      source: SourceEnum.PEPTIDE,
      efficacyTags: ['抗炎', '抗氧化', '保护心血管', '护肝'],
      synergyScore: 86,
      rationale: '强效抗炎抗氧化，研究证据充分',
      dosage: { min: 1, max: 5, optimal: 3 },
      confidence: 'high'
    }
  ]

  const recommendations = CANDIDATE_DB
    .map(candidate => {
      const matchingTags = candidate.efficacyTags.filter(tag =>
        missingTags.includes(tag as EfficacyTag)
      )
      const adjustedScore = candidate.synergyScore + matchingTags.length * 5

      return {
        ...candidate,
        synergyScore: Math.min(100, adjustedScore),
        rationale: matchingTags.length > 0
          ? `${candidate.rationale}（补充${matchingTags.join('、')}功效）`
          : candidate.rationale
      }
    })
    .sort((a, b) => b.synergyScore - a.synergyScore)
    .slice(0, 5)

  return recommendations
}

// ==================== 导出Hook ====================

export function useIngredientDeepAnalysis() {
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareTarget, setCompareTarget] = useState<Ingredient | null>(null)

  const getProfile = useCallback((ingredient: Ingredient) => {
    return generateIngredientProfile(ingredient)
  }, [])

  const compare = useCallback((ingA: Ingredient, ingB: Ingredient) => {
    return compareIngredients(ingA, ingB)
  }, [])

  const getRecommendations = useCallback((
    ingredients: Ingredient[],
    targets?: EfficacyTag[]
  ) => {
    return recommendComplementaryIngredients(ingredients, targets)
  }, [])

  return {
    selectedIngredient,
    setSelectedIngredient,
    compareMode,
    setCompareMode,
    compareTarget,
    setCompareTarget,
    getProfile,
    compare,
    getRecommendations
  }
}

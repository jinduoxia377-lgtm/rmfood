/**
 * IngredientDeepAnalysis - 成分深度分析模块 (TypeScript 声明文件)
 *
 * 此文件提供类型定义和常量配置，实际实现在 .tsx 文件中
 * 解决 TypeScript 编译器的模块解析问题
 */

import React from 'react'
import {
  Zap,
  Shield,
  Activity,
  Thermometer,
  Layers,
  Microscope,
} from 'lucide-react'
import type { EfficacyTag } from '@/types/ai.types'

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
  ingredient: import('@/types/ai.types').Ingredient
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
  source: import('@/types/ai.types').IngredientSource
  efficacyTags: EfficacyTag[]
  synergyScore: number
  rationale: string
  dosage: { min: number; max: number; optimal: number }
  confidence: 'high' | 'medium' | 'low'
}

// ==================== 常量配置 ====================

export const DIMENSION_CONFIG: AnalysisDimension[] = [
  {
    id: 'efficacy',
    label: '功效强度',
    icon: React.createElement(Zap, { className: "w-4 h-4" }),
    score: 0,
    maxScore: 10,
    color: 'var(--color-secondary-500)',
    description: '基于功效标签的综合评分',
    details: [],
  },
  {
    id: 'safety',
    label: '安全系数',
    icon: React.createElement(Shield, { className: "w-4 h-4" }),
    score: 0,
    maxScore: 10,
    color: 'var(--color-primary-400)',
    description: '基于注意事项和用量的安全评估',
    details: [],
  },
  {
    id: 'bioavailability',
    label: '生物利用度',
    icon: React.createElement(Activity, { className: "w-4 h-4" }),
    score: 0,
    maxScore: 10,
    color: 'var(--color-accent-500)',
    description: '成分在体内的吸收效率预估',
    details: [],
  },
  {
    id: 'stability',
    label: '稳定性',
    icon: React.createElement(Thermometer, { className: "w-4 h-4" }),
    score: 0,
    maxScore: 10,
    color: '#D97706',
    description: '储存和使用过程中的稳定表现',
    details: [],
  },
  {
    id: 'versatility',
    label: '适用广度',
    icon: React.createElement(Layers, { className: "w-4 h-4" }),
    score: 0,
    maxScore: 10,
    color: '#D946EF',
    description: '可应用的场景和人群范围',
    details: [],
  },
  {
    id: 'researchDepth',
    label: '研究深度',
    icon: React.createElement(Microscope, { className: "w-4 h-4" }),
    score: 0,
    maxScore: 10,
    color: 'var(--color-info-600)',
    description: '现代科学研究支持程度',
    details: [],
  },
]

export const EFFICACY_TAG_DETAILS: Partial<Record<EfficacyTag, {
  category: string
  mechanism: string
  evidenceLevel: 'strong' | 'moderate' | 'emerging'
  relatedTags: EfficacyTag[]
}>> = {
  '补气养血': {
    category: '气血调节',
    mechanism: '促进造血功能、改善微循环',
    evidenceLevel: 'strong',
    relatedTags: ['增强免疫', '抗疲劳', '美容养颜'],
  },
  '抗氧化': {
    category: '细胞保护',
    mechanism: '清除自由基、减少氧化应激',
    evidenceLevel: 'strong',
    relatedTags: ['延缓衰老', '保护心血管', '抗炎'],
  },
  '降血压': {
    category: '心血管健康',
    mechanism: '扩张血管、调节血管紧张素',
    evidenceLevel: 'moderate',
    relatedTags: ['保护心血管', '调节血脂'],
  },
  '降血糖': {
    category: '代谢调节',
    mechanism: '促进胰岛素分泌、提高敏感性',
    evidenceLevel: 'moderate',
    relatedTags: ['调节血脂', '健脾益胃'],
  },
  '增强免疫': {
    category: '免疫系统',
    mechanism: '激活免疫细胞、增强防御能力',
    evidenceLevel: 'strong',
    relatedTags: ['补气养血', '抗疲劳', '抗炎'],
  },
  '抗疲劳': {
    category: '能量代谢',
    mechanism: '提升线粒体功能、改善能量代谢',
    evidenceLevel: 'moderate',
    relatedTags: ['增强免疫', '补气养血', '改善睡眠'],
  },
  '改善睡眠': {
    category: '神经系统',
    mechanism: '调节神经递质、舒缓神经系统',
    evidenceLevel: 'moderate',
    relatedTags: ['抗疲劳', '安神'],
  },
  '护肝': {
    category: '器官保护',
    mechanism: '促进肝细胞再生、解毒功能',
    evidenceLevel: 'strong',
    relatedTags: ['抗氧化', '降血糖'],
  },
  '健脾益胃': {
    category: '消化系统',
    mechanism: '促进消化酶分泌、调理脾胃功能',
    evidenceLevel: 'strong',
    relatedTags: ['促进消化', '增强免疫'],
  },
  '美容养颜': {
    category: '外观改善',
    mechanism: '促进胶原蛋白合成、改善肤质',
    evidenceLevel: 'emerging',
    relatedTags: ['抗氧化', '延缓衰老', '补气养血'],
  },
  '抗炎': {
    category: '炎症调控',
    mechanism: '抑制炎症因子、减轻炎症反应',
    evidenceLevel: 'strong',
    relatedTags: ['抗氧化', '保护心血管', '增强免疫'],
  },
  '调节血脂': {
    category: '代谢调节',
    mechanism: '降低胆固醇、调节脂质代谢',
    evidenceLevel: 'moderate',
    relatedTags: ['保护心血管', '降血糖'],
  },
  '保护心血管': {
    category: '心血管健康',
    mechanism: '保护心肌、改善血液循环',
    evidenceLevel: 'strong',
    relatedTags: ['降血压', '调节血脂', '抗氧化'],
  },
  '延缓衰老': {
    category: '抗衰老',
    mechanism: '对抗氧化损伤、修复细胞',
    evidenceLevel: 'emerging',
    relatedTags: ['抗氧化', '美容养颜', '增强免疫'],
  },
  '促进消化': {
    category: '消化系统',
    mechanism: '促进胃肠蠕动、帮助消化吸收',
    evidenceLevel: 'strong',
    relatedTags: ['健脾益胃'],
  },
  '安神': {
    category: '神经系统',
    mechanism: '镇静安神、调节情绪状态',
    evidenceLevel: 'moderate',
    relatedTags: ['改善睡眠', '抗疲劳'],
  },
}

// 声明函数类型（实现在 .tsx 文件中）
export interface UseIngredientDeepAnalysisReturn {
  profile: IngredientProfile | null
  loading: boolean
  error: string | null
  analyze: (ingredient: import('@/types/ai.types').Ingredient) => void
  reset: () => void
}

declare function useIngredientDeepAnalysis(): UseIngredientDeepAnalysisReturn
export { useIngredientDeepAnalysis }

// 声明其他函数类型（实现在 .tsx 文件中）
declare function generateIngredientProfile(ingredient: import('@/types/ai.types').Ingredient): IngredientProfile
declare function compareIngredients(ingredientA: import('@/types/ai.types').Ingredient, ingredientB: import('@/types/ai.types').Ingredient): ComparisonResult
declare function recommendComplementaryIngredients(currentIngredients: import('@/types/ai.types').Ingredient[], targetEfficacies?: EfficacyTag[]): RecommendedIngredient[]

export { generateIngredientProfile, compareIngredients, recommendComplementaryIngredients }

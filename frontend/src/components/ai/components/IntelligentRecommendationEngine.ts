/**
 * IntelligentRecommendationEngine v2.0 - 智能应用建议推荐引擎
 *
 * 核心能力:
 * - 个性化配方推荐（基于用户画像和健康目标）
 * - 剂量优化算法（多目标优化）
 * - 禁忌检测系统（多层次安全检查）
 * - 使用场景适配（不同人群/场景的最佳方案）
 * - 时间规划建议（服用时机、周期、疗程）
 * - 饮食搭配建议（协同饮食方案）
 */

import { useCallback } from 'react'
import type {
  FormulaTableData,
  EfficacyTag,
  IngredientSource,
} from '@/types/ai.types'
import { IngredientSource as SourceEnum } from '@/types/ai.types'

// ==================== 类型定义 ====================

export interface UserProfile {
  id: string
  ageGroup: 'young' | 'middle-aged' | 'elderly'
  gender: 'male' | 'female' | 'other'
  healthGoals: EfficacyTag[]
  healthConditions: string[]
  allergies: string[]
  dietaryRestrictions: string[]
  lifestyle: {
    activityLevel: 'sedentary' | 'moderate' | 'active' | 'athletic'
    sleepQuality: 'poor' | 'fair' | 'good' | 'excellent'
    stressLevel: 'low' | 'medium' | 'high' | 'very-high'
    dietType: 'omnivore' | 'vegetarian' | 'vegan' | 'paleo' | 'mediterranean' | 'other'
  }
  preferences: {
    tastePreference: 'neutral' | 'sweet' | 'bitter' | 'sour' | 'no-preference'
    formPreference: ['powder' | 'capsule' | 'liquid' | 'tablet' | 'tea']
    budgetLevel: 'economy' | 'standard' | 'premium' | 'luxury'
  }
}

export interface RecommendationResult {
  userId: string
  timestamp: Date
  primaryFormula: PersonalizedFormula
  alternativeFormulas: PersonalizedFormula[]
  usageSchedule: UsageSchedule
  dietarySuggestions: DietarySuggestion[]
  precautions: PrecautionAlert[]
  expectedOutcomes: ExpectedOutcome[]
  confidence: number
}

export interface PersonalizedFormula {
  id: string
  name: string
  description: string
  targetScore: number
  ingredients: RecommendedIngredient[]
  totalDailyDosage: number
  duration: { min: number; max: number; unit: 'days' | 'weeks' | 'months' }
  costEstimate: { min: number; max: number; currency: string }
  matchScore: number
  rationale: string
}

export interface RecommendedIngredient {
  name: string
  source: IngredientSource
  dosage: { morning: number; afternoon: number; evening: number; unit: string }
  efficacyContribution: EfficacyTag[]
  roleInFormula: 'primary' | 'secondary' | 'supportive' | 'balancing'
  whyIncluded: string
  alternatives: string[]
}

export interface UsageSchedule {
  frequency: { timesPerDay: number; bestTimes: string[] }
  withMeal: boolean
  timingConstraints: string[]
  cycleInfo: {
    onDuration: number
    offDuration: number
    pattern: 'continuous' | 'cyclic' | 'intermittent' | 'pulse'
  }
  specialInstructions: string[]
}

export interface DietarySuggestion {
  category: 'enhance' | 'avoid' | 'timing' | 'combination'
  title: string
  description: string
  foods: string[]
  mechanism: string
  importance: 'critical' | 'important' | 'helpful'
}

export interface PrecautionAlert {
  id: string
  type: 'contraindication' | 'interaction' | 'dosage' | 'allergy' | 'timing'
  severity: 'warning' | 'caution' | 'notice'
  title: string
  description: string
  affectedComponents: string[]
  recommendation: string
}

export interface ExpectedOutcome {
  category: string
  timeframe: string
  description: string
  probability: 'high' | 'medium' | 'low'
  metrics?: string[]
}

// ==================== 用户画像分析 ====================

const AGE_GROUP_CONFIG = {
  young: {
    label: '青年（18-35岁）',
    priorities: ['抗疲劳', '增强免疫', '美容养颜', '抗氧化'],
    avoidSources: [],
    maxDosageMultiplier: 1.0,
    considerations: ['代谢活跃，可耐受较高剂量', '注重外观和生活质量'],
  },
  'middle-aged': {
    label: '中年（36-55岁）',
    priorities: ['抗氧化', '保护心血管', '调节血脂', '抗疲劳', '增强免疫'],
    avoidSources: [],
    maxDosageMultiplier: 0.95,
    considerations: ['代谢开始减缓，需关注长期保健', '工作压力大，需平衡功效与安全性'],
  },
  elderly: {
    label: '中老年（56岁以上）',
    priorities: ['增强免疫', '保护心血管', '降血压', '延缓衰老', '健脾益胃'],
    avoidSources: [],
    maxDosageMultiplier: 0.85,
    considerations: ['器官功能减退，剂量宜从低开始', '可能正在服用其他药物，注意相互作用'],
  },
}

// ==================== 禁忌数据库 ====================

const CONTRAINDICATION_DB: {
  condition: string
  contraindicatedIngredients: string[]
  reason: string
  severity: 'critical' | 'major' | 'moderate'
}[] = [
  {
    condition: '高血压',
    contraindicatedIngredients: ['麻黄', '人参（高剂量）'],
    reason: '可能导致血压进一步升高',
    severity: 'major',
  },
  {
    condition: '糖尿病',
    contraindicatedIngredients: ['甘草（大量）', '红枣（大量）', '蜂蜜'],
    reason: '可能影响血糖控制',
    severity: 'moderate',
  },
  {
    condition: '孕妇',
    contraindicatedIngredients: ['红花', '桃仁', '薏苡仁（大量）', '蒲黄'],
    reason: '可能影响胎儿或引起子宫收缩',
    severity: 'critical',
  },
  {
    condition: '凝血功能障碍',
    contraindicatedIngredients: ['丹参', '川芎', '红花', '水蛭'],
    reason: '增加出血风险',
    severity: 'critical',
  },
  {
    condition: '胃溃疡',
    contraindicatedIngredients: ['丁香', '生姜（大量）', '辣椒'],
    reason: '可能刺激胃黏膜',
    severity: 'major',
  },
]

const ALLERGY_CROSS_REACTIVITY: Record<string, string[]> = {
  '花粉过敏': ['菊花', '蒲公英', '桂花'],
  '坚果过敏': ['桃仁', '杏仁', '核桃仁'],
  '麸质过敏': ['大麦', '小麦芽', '某些中药丸剂辅料'],
}

// ==================== 推荐算法核心 ====================

export function generatePersonalizedRecommendation(
  userProfile: UserProfile,
  existingFormula?: FormulaTableData,
): RecommendationResult {
  const healthGoals = userProfile.healthGoals.length > 0
    ? userProfile.healthGoals
    : AGE_GROUP_CONFIG[userProfile.ageGroup].priorities as EfficacyTag[]

  const filteredGoals = filterByContraindications(healthGoals, userProfile)
  const primaryFormula = generatePrimaryFormula(userProfile, filteredGoals, existingFormula)
  const alternatives = generateAlternativeFormulas(userProfile, filteredGoals, primaryFormula)
  const usageSchedule = generateUsageSchedule(userProfile, primaryFormula)
  const dietarySuggestions = generateDietarySuggestions(primaryFormula, userProfile)
  const precautions = generatePrecautionAlerts(primaryFormula, userProfile)
  const expectedOutcomes = generateExpectedOutcomes(primaryFormula, userProfile)

  const confidence = calculateRecommendationConfidence(
    userProfile,
    primaryFormula,
    precautions,
  )

  return {
    userId: userProfile.id,
    timestamp: new Date(),
    primaryFormula,
    alternativeFormulas: alternatives.slice(0, 3),
    usageSchedule,
    dietarySuggestions,
    precautions,
    expectedOutcomes,
    confidence: Math.round(confidence * 100),
  }
}

function filterByContraindications(
  goals: EfficacyTag[],
  profile: UserProfile,
): EfficacyTag[] {
  let filtered = [...goals]

  if (profile.healthConditions.includes('高血压')) {
    filtered = filtered.filter(g => g !== '补气养血')
  }

  return filtered
}

function generatePrimaryFormula(
  profile: UserProfile,
  goals: EfficacyTag[],
  _existing?: FormulaTableData,
): PersonalizedFormula {
  void _existing;
  const ingredientPool = selectIngredientsForGoals(goals, profile)
  const optimizedIngredients = optimizeDosages(ingredientPool, profile)
  const formulaId = `formula_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

  const totalDosage = optimizedIngredients.reduce((sum, ing) => {
    return sum + ing.dosage.morning + ing.dosage.afternoon + ing.dosage.evening
  }, 0)

  const baseDuration = profile.lifestyle.activityLevel === 'sedentary' ? 56 :
                       profile.lifestyle.activityLevel === 'athletic' ? 28 : 42

  return {
    id: formulaId,
    name: generateFormulaName(goals, profile),
    description: generateFormulaDescription(goals, profile),
    targetScore: calculateTargetScore(optimizedIngredients, goals),
    ingredients: optimizedIngredients,
    totalDailyDosage: Math.round(totalDosage * 10) / 10,
    duration: {
      min: Math.round(baseDuration * 0.8),
      max: Math.round(baseDuration * 1.5),
      unit: 'days',
    },
    costEstimate: estimateCost(optimizedIngredients, profile.preferences.budgetLevel),
    matchScore: calculateMatchScore(optimizedIngredients, goals, profile),
    rationale: generateRationale(optimizedIngredients, goals, profile),
  }
}

function selectIngredientsForGoals(
  goals: EfficacyTag[],
  profile: UserProfile,
): {
  name: string
  source: IngredientSource
  efficacyTags: EfficacyTag[]
  baseDosage: { min: number; max: number; optimal: number; unit: string }
  priority: number
}[] {
  const INGREDIENT_DATABASE = [
    {
      name: '人参提取物',
      source: SourceEnum.TCM,
      efficacyTags: ['补气养血', '增强免疫', '抗疲劳', '改善睡眠'] as EfficacyTag[],
      baseDosage: { min: 3, max: 9, optimal: 6, unit: 'g' },
      priority: 9,
    },
    {
      name: '黄芪提取物',
      source: SourceEnum.TCM,
      efficacyTags: ['补气养血', '增强免疫', '抗疲劳'] as EfficacyTag[],
      baseDosage: { min: 9, max: 24, optimal: 15, unit: 'g' },
      priority: 8.5,
    },
    {
      name: '当归提取物',
      source: SourceEnum.TCM,
      efficacyTags: ['补气养血', '美容养颜', '抗氧化'] as EfficacyTag[],
      baseDosage: { min: 6, max: 12, optimal: 9, unit: 'g' },
      priority: 8,
    },
    {
      name: '茯苓多糖',
      source: SourceEnum.PEPTIDE,
      efficacyTags: ['健脾益胃', '增强免疫', '安神'] as EfficacyTag[],
      baseDosage: { min: 6, max: 15, optimal: 10, unit: 'g' },
      priority: 8.5,
    },
    {
      name: '枸杞多糖',
      source: SourceEnum.PEPTIDE,
      efficacyTags: ['抗氧化', '延缓衰老', '护肝', '增强免疫'] as EfficacyTag[],
      baseDosage: { min: 9, max: 20, optimal: 15, unit: 'g' },
      priority: 8.5,
    },
    {
      name: '葡萄籽原花青素',
      source: SourceEnum.PEPTIDE,
      efficacyTags: ['抗氧化', '保护心血管', '美容养颜', '抗炎'] as EfficacyTag[],
      baseDosage: { min: 100, max: 300, optimal: 200, unit: 'mg' },
      priority: 8,
    },
    {
      name: '山药提取物',
      source: SourceEnum.TCM,
      efficacyTags: ['健脾益胃', '补肾益精', '抗疲劳'] as EfficacyTag[],
      baseDosage: { min: 12, max: 25, optimal: 18, unit: 'g' },
      priority: 7.5,
    },
    {
      name: '姜黄素',
      source: SourceEnum.PEPTIDE,
      efficacyTags: ['抗炎', '抗氧化', '保护心血管', '护肝'] as EfficacyTag[],
      baseDosage: { min: 500, max: 1500, optimal: 1000, unit: 'mg' },
      priority: 8,
    },
    {
      name: '红枣提取物',
      source: SourceEnum.TCM,
      efficacyTags: ['补气养血', '健脾益胃', '改善睡眠', '美容养颜'] as EfficacyTag[],
      baseDosage: { min: 9, max: 20, optimal: 15, unit: 'g' },
      priority: 7.5,
    },
    {
      name: '银杏叶提取物',
      source: SourceEnum.TCM,
      efficacyTags: ['保护心血管', '增强免疫', '抗氧化', '改善记忆'] as EfficacyTag[],
      baseDosage: { min: 60, max: 120, optimal: 80, unit: 'mg' },
      priority: 7.5,
    },
  ]

  const scored = INGREDIENT_DATABASE.map(ing => {
    const goalMatchCount = ing.efficacyTags.filter((tag: EfficacyTag) => goals.includes(tag)).length
    const goalRelevanceScore = (goalMatchCount / goals.length) * 50

    const conditionPenalty = profile.healthConditions.some(cond =>
      CONTRAINDICATION_DB.some(c =>
        c.condition === cond && c.contraindicatedIngredients.some(ci =>
          ing.name.includes(ci) || ci.includes(ing.name),
        ),
      ),
    ) ? -30 : 0

    const allergyPenalty = profile.allergies.some(allergy =>
      ALLERGY_CROSS_REACTIVITY[allergy]?.some(food =>
        ing.name.includes(food) || food.includes(ing.name),
      ),
    ) ? -25 : 0

    const finalScore = ing.priority + goalRelevanceScore + conditionPenalty + allergyPenalty

    return { ...ing, score: finalScore }
  })

  scored.sort((a, b) => b.score - a.score)

  const maxIngredients = profile.ageGroup === 'elderly' ? 6 : 8

  return scored.slice(0, maxIngredients).map(({ score, ...rest }) => {
    void score
    return rest
  })
}

function optimizeDosages(
  ingredients: {
    name: string
    source: IngredientSource
    efficacyTags: EfficacyTag[]
    baseDosage: { min: number; max: number; optimal: number; unit: string }
    priority: number
  }[],
  profile: UserProfile,
): RecommendedIngredient[] {
  const ageMultiplier = AGE_GROUP_CONFIG[profile.ageGroup].maxDosageMultiplier
  const activityMultipliers = {
    sedentary: 0.85,
    moderate: 1.0,
    active: 1.1,
    athletic: 1.2,
  }

  const activityMult = activityMultipliers[profile.lifestyle.activityLevel]

  return ingredients.map((ing, index) => {
    const baseOptimal = ing.baseDosage.optimal
    const adjustedOptimal = baseOptimal * ageMultiplier * activityMult

    const morningRatio = index % 3 === 0 ? 0.4 : 0.3
    const afternoonRatio = 0.3
    const eveningRatio = index % 3 === 2 ? 0.4 : 0.3

    const role = index === 0 ? 'primary' :
                 index < 3 ? 'secondary' :
                 index < ingredients.length - 1 ? 'supportive' : 'balancing'

    return {
      name: ing.name,
      source: ing.source,
      dosage: {
        morning: Math.round(adjustedOptimal * morningRatio * 10) / 10,
        afternoon: Math.round(adjustedOptimal * afternoonRatio * 10) / 10,
        evening: Math.round(adjustedOptimal * eveningRatio * 10) / 10,
        unit: ing.baseDosage.unit,
      },
      efficacyContribution: ing.efficacyTags,
      roleInFormula: role,
      whyIncluded: generateWhyIncluded(ing, profile),
      alternatives: findAlternatives(ing.name),
    }
  })
}

function generateWhyIncluded(
  ingredient: {
    name: string
    efficacyTags: EfficacyTag[]
  },
  profile: UserProfile,
): string {
  const topTags = ingredient.efficacyTags.slice(0, 2).join('、')

  const goalMatches = ingredient.efficacyTags.filter(tag =>
    profile.healthGoals.includes(tag),
  )

  if (goalMatches.length > 0) {
    return `直接针对您的${goalMatches.join('、')}需求`
  }

  return `提供${topTags}等功效，辅助整体调理`
}

function findAlternatives(ingredientName: string): string[] {
  const ALTERNATIVE_MAP: Record<string, string[]> = {
    '人参提取物': ['西洋参提取物', '党参提取物', '红景天提取物'],
    '黄芪提取物': ['党参提取物', '白术提取物'],
    '当归提取物': ['熟地提取物', '白芍提取物'],
    '茯苓多糖': ['薏苡仁多糖', '白术提取物'],
    '枸杞多糖': ['葡萄籽原花青素', '番茄红素'],
  }

  return ALTERNATIVE_MAP[ingredientName] || []
}

function generateFormulaName(goals: EfficacyTag[], profile: UserProfile): string {
  const ageLabel = AGE_GROUP_CONFIG[profile.ageGroup].label.split('（')[0]

  if (goals.includes('抗氧化') && goals.includes('延缓衰老')) {
    return `${ageLabel}抗衰老综合配方`
  }

  if (goals.includes('增强免疫') && goals.includes('抗疲劳')) {
    return `${ageLabel}活力提升配方`
  }

  if (goals.includes('保护心血管') || goals.includes('降血压')) {
    return `${ageLabel}心血管守护配方`
  }

  if (goals.includes('健脾益胃') || goals.includes('促进消化')) {
    return `${ageLabel}脾胃调理配方`
  }

  if (goals.includes('美容养颜')) {
    return `${ageLabel}焕颜美肤配方`
  }

  return `${ageLabel}个性化综合调理配方`
}

function generateFormulaDescription(goals: EfficacyTag[], profile: UserProfile): string {
  const goalDescriptions = goals.slice(0, 3).map(goal => {
    const descriptions: Record<string, string> = {
      '抗氧化': '清除自由基，延缓细胞老化',
      '增强免疫': '激活免疫系统，提高抵抗力',
      '抗疲劳': '提升能量代谢，缓解身心疲惫',
      '保护心血管': '维护血管健康，促进血液循环',
      '美容养颜': '促进胶原蛋白合成，改善肤质',
      '健脾益胃': '调理脾胃功能，促进消化吸收',
    }
    return descriptions[goal] || goal
  })

  return `本配方专为${AGE_GROUP_CONFIG[profile.ageGroup].label}设计，重点${goalDescriptions.join('，')}。采用现代提取技术结合传统智慧，科学配比，安全有效。`
}

function calculateTargetScore(
  ingredients: RecommendedIngredient[],
  goals: EfficacyTag[],
): number {
  const coverageScore = (ingredients.flatMap(ing => ing.efficacyContribution)
    .filter(tag => goals.includes(tag)).length / goals.length) * 40

  const diversityBonus = Math.min(20, new Set(ingredients.flatMap(ing => ing.efficacyContribution)).size * 3)

  const synergyBonus = ingredients.length >= 4 ? 15 : ingredients.length >= 2 ? 10 : 5

  const safetyScore = 25

  return Math.min(100, Math.round(coverageScore + diversityBonus + synergyBonus + safetyScore))
}

function estimateCost(
  ingredients: RecommendedIngredient[],
  budgetLevel: string,
): { min: number; max: number; currency: string } {
  const COST_PER_GRAM: Record<string, { min: number; max: number }> = {
    '人参提取物': { min: 8, max: 25 },
    '黄芪提取物': { min: 2, max: 6 },
    '当归提取物': { min: 3, max: 8 },
    '茯苓多糖': { min: 4, max: 12 },
    '枸杞多糖': { min: 3, max: 10 },
    '葡萄籽原花青素': { min: 15, max: 40 },
    '山药提取物': { min: 1, max: 4 },
    '姜黄素': { min: 20, max: 60 },
    '红枣提取物': { min: 1.5, max: 5 },
    '银杏叶提取物': { min: 10, max: 30 },
  }

  const multipliers: Record<string, number> = {
    economy: 0.7,
    standard: 1.0,
    premium: 1.8,
    luxury: 3.0,
  }

  let totalMin = 0
  let totalMax = 0

  ingredients.forEach(ing => {
    const dailyTotal = ing.dosage.morning + ing.dosage.afternoon + ing.dosage.evening
    const costInfo = COST_PER_GRAM[ing.name] || { min: 5, max: 15 }

    totalMin += (dailyTotal / 1000) * costInfo.min
    totalMax += (dailyTotal / 1000) * costInfo.max
  })

  const mult = multipliers[budgetLevel] || 1.0

  return {
    min: Math.round(totalMin * mult * 30),
    max: Math.round(totalMax * mult * 30),
    currency: 'CNY',
  }
}

function calculateMatchScore(
  ingredients: RecommendedIngredient[],
  goals: EfficacyTag[],
  profile: UserProfile,
): number {
  let score = 70

  const goalCoverage = Array.from(new Set(ingredients.flatMap(ing => ing.efficacyContribution)))
    .filter((tag: EfficacyTag) => goals.includes(tag)).length / goals.length
  score += goalCoverage * 15

  if (profile.allergies.length > 0) {
    const allergySafe = !ingredients.some(ing =>
      profile.allergies.some(allergy =>
        ALLERGY_CROSS_REACTIVITY[allergy]?.some(food =>
          ing.name.includes(food) || food.includes(ing.name),
        ),
      ),
    )
    if (allergySafe) score += 5
  }

  if (profile.dietaryRestrictions.length === 0 ||
      profile.dietaryRestrictions.includes('omnivore')) {
    score += 5
  }

  return Math.min(100, Math.round(score))
}

function generateRationale(
  ingredients: RecommendedIngredient[],
  _goals: EfficacyTag[],
  profile: UserProfile,
): string {
  const primaryIng = ingredients.find(ing => ing.roleInFormula === 'primary')
  const supportingCount = ingredients.filter(ing => ing.roleInFormula === 'supportive').length

  return `以${primaryIng?.name || '多种活性成分'}为核心，配合${supportingCount}种辅助成分，形成协同增效的完整配方体系。充分考虑了${AGE_GROUP_CONFIG[profile.ageGroup].label}的生理特点和${profile.lifestyle.activityLevel === 'sedentary' ? '相对静态' : '活跃'}的生活方式。`
}

// ==================== 使用计划生成 ====================

function generateUsageSchedule(
  profile: UserProfile,
  formula: PersonalizedFormula,
): UsageSchedule {
  const timesPerDay = formula.ingredients.some(ing =>
    ing.dosage.evening > 0,
  ) ? 3 : 2

  const bestTimes = timesPerDay === 3
    ? ['早餐后30分钟', '午餐后30分钟', '晚餐后30分钟或睡前1小时']
    : ['早餐后30分钟', '晚餐后30分钟']

  const activityBasedPattern = profile.lifestyle.activityLevel === 'athletic'
    ? 'cyclic'
    : profile.lifestyle.stressLevel === 'very-high'
      ? 'continuous'
      : 'continuous'

  return {
    frequency: { timesPerDay, bestTimes },
    withMeal: true,
    timingConstraints: [
      '避免空腹服用（除非特别说明）',
      '如正在服用处方药，请间隔1-2小时',
      '首次使用建议从半量开始，适应后逐渐增至全量',
    ],
    cycleInfo: {
      onDuration: formula.duration.min,
      offDuration: 7,
      pattern: activityBasedPattern,
    },
    specialInstructions: generateSpecialInstructions(profile, formula),
  }
}

function generateSpecialInstructions(
  profile: UserProfile,
  formula: PersonalizedFormula,
): string[] {
  const instructions: string[] = []

  if (profile.ageGroup === 'elderly') {
    instructions.push('老年人建议从最低剂量开始，每周递增20%至标准剂量')
  }

  if (profile.lifestyle.sleepQuality === 'poor') {
    instructions.push('含有助眠成分，建议晚间服用时提前1小时')
  }

  if (profile.lifestyle.stressLevel === 'high' || profile.lifestyle.stressLevel === 'very-high') {
    instructions.push('高压人群建议配合放松训练和规律作息以获得最佳效果')
  }

  if (formula.ingredients.some(ing => ing.dosage.evening > 0)) {
    instructions.push('晚间剂量若含兴奋性成分，请至少在睡前2小时服用')
  }

  return instructions
}

// ==================== 饮食建议生成 ====================

function generateDietarySuggestions(
  formula: PersonalizedFormula,
  profile: UserProfile,
): DietarySuggestion[] {
  const suggestions: DietarySuggestion[] = []

  const allEfficacies = formula.ingredients.flatMap(ing => ing.efficacyContribution)

  if (allEfficacies.includes('抗氧化')) {
    suggestions.push({
      category: 'enhance',
      title: '富含抗氧化物的食物',
      description: '与配方中的抗氧化成分产生协同作用，增强自由基清除能力',
      foods: ['深色蔬菜（菠菜、西兰花）', '浆果类（蓝莓、草莓）', '坚果（核桃、杏仁）', '绿茶'],
      mechanism: '提供维生素C、E和多酚类物质，再生抗氧化成分',
      importance: 'important',
    })
  }

  if (allEfficacies.includes('健脾益胃') || allEfficacies.includes('促进消化')) {
    suggestions.push({
      category: 'enhance',
      title: '易消化的优质蛋白',
      description: '为脾胃修复提供营养基础，减轻消化负担',
      foods: ['鱼肉', '豆腐', '鸡蛋羹', '小米粥'],
      mechanism: '提供必需氨基酸且低脂易吸收',
      importance: 'important',
    })
  }

  suggestions.push({
    category: 'avoid',
    title: '应限制的食物',
    description: '这些食物可能干扰配方的吸收或产生不良相互作用',
    foods: ['浓茶（可能影响某些成分吸收）', '酒精（增加肝脏负担）', '高糖食品（引发炎症反应）', '加工食品（含添加剂可能相互作用）'],
    mechanism: '竞争性抑制吸收、增加代谢负担或产生化学反应',
    importance: 'critical',
  })

  suggestions.push({
    category: 'timing',
    title: '最佳服用时间配合',
    description: '合理的时间安排可以最大化配方效果并减少不适',
    foods: ['温水送服（避免热水破坏活性成分）', '配合少量食物（但非饱腹状态）', '避免与咖啡同时服用'],
    mechanism: '优化胃肠道环境，促进吸收',
    importance: 'important',
  })

  if (profile.lifestyle.dietType === 'vegetarian' || profile.lifestyle.dietType === 'vegan') {
    suggestions.push({
      category: 'combination',
      title: '素食者补充建议',
      description: '确保获得足够的协同营养素',
      foods: ['复合维生素B12', '铁剂（与维生素C同服）', 'Omega-3脂肪酸（亚麻籽油）'],
      mechanism: '补充植物性饮食中容易缺乏的关键营养素',
      importance: 'helpful',
    })
  }

  return suggestions
}

// ==================== 警告生成 ====================

function generatePrecautionAlerts(
  formula: PersonalizedFormula,
  profile: UserProfile,
): PrecautionAlert[] {
  const alerts: PrecautionAlert[] = []

  profile.healthConditions.forEach(condition => {
    const contraindication = CONTRAINDICATION_DB.find(c => c.condition === condition)

    if (contraindication) {
      const affected = formula.ingredients.filter(ing =>
        contraindication.contraindicatedIngredients.some(ci =>
          ing.name.includes(ci) || ci.includes(ing.name),
        ),
      ).map(ing => ing.name)

      if (affected.length > 0) {
        alerts.push({
          id: `condition_${condition}`,
          type: 'contraindication',
          severity: contraindication.severity === 'critical' ? 'warning' : 'caution',
          title: `${condition}患者注意事项`,
          description: contraindication.reason,
          affectedComponents: affected,
          recommendation: contraindication.severity === 'critical'
            ? '强烈建议咨询医生后使用，或选择替代配方'
            : '建议在医生指导下使用，密切监测身体反应',
        })
      }
    }
  })

  profile.allergies.forEach(allergy => {
    const crossReactive = ALLERGY_CROSS_REACTIVITY[allergy]
    if (crossReactive) {
      const affected = formula.ingredients.filter(ing =>
        crossReactive.some(food => ing.name.includes(food) || food.includes(ing.name)),
      ).map(ing => ing.name)

      if (affected.length > 0) {
        alerts.push({
          id: `allergy_${allergy}`,
          type: 'allergy',
          severity: 'warning',
          title: `${allergy}交叉过敏风险`,
          description: `您对${allergy}过敏，以下成分可能引发交叉反应`,
          affectedComponents: affected,
          recommendation: '建议进行过敏原测试或选择不含这些成分的替代品',
        })
      }
    }
  })

  const highDosageIngredients = formula.ingredients.filter(ing => {
    const total = ing.dosage.morning + ing.dosage.afternoon + ing.dosage.evening
    return total > 20
  })

  if (highDosageIngredients.length > 0) {
    alerts.push({
      id: 'dosage_high',
      type: 'dosage',
      severity: 'caution',
      title: '部分成分用量较高',
      description: '以下成分单日总用量超过20g，请注意监测',
      affectedComponents: highDosageIngredients.map(ing => ing.name),
      recommendation: '首次使用建议减半，观察3-5天无不适后再增至全量',
    })
  }

  if (profile.ageGroup === 'elderly' && formula.totalDailyDosage > 40) {
    alerts.push({
      id: 'elderly_dosage',
      type: 'dosage',
      severity: 'notice',
      title: '老年人群用量提醒',
      description: '总日剂量偏高，建议根据个体情况调整',
      affectedComponents: ['全部成分'],
      recommendation: '建议从标准剂量的60%开始，逐步调整至适合剂量',
    })
  }

  return alerts
}

// ==================== 效果预期 ====================

function generateExpectedOutcomes(
  formula: PersonalizedFormula,
  _profile: UserProfile,
): ExpectedOutcome[] {
  void _profile;
  const outcomes: ExpectedOutcome[] = []

  const allEfficacies = formula.ingredients.flatMap(ing => ing.efficacyContribution)

  if (allEfficacies.includes('抗疲劳')) {
    outcomes.push({
      category: '精力水平',
      timeframe: '1-2周',
      description: '感觉更有活力，下午疲劳感减轻',
      probability: 'high',
      metrics: ['自我评估疲劳量表评分', '日常活动完成度'],
    })
  }

  if (allEfficacies.includes('增强免疫')) {
    outcomes.push({
      category: '免疫功能',
      timeframe: '3-4周',
      description: '感冒频率降低，恢复速度加快',
      probability: 'medium',
      metrics: ['年度感冒次数', '感染持续时间'],
    })
  }

  if (allEfficacies.includes('抗氧化') || allEfficacies.includes('延缓衰老')) {
    outcomes.push({
      category: '氧化应激指标',
      timeframe: '6-8周',
      description: '血液抗氧化指标改善，皮肤状态好转',
      probability: 'medium',
      metrics: ['血清SOD活性', 'MDA含量', '皮肤水分含量'],
    })
  }

  if (allEfficacies.includes('改善睡眠') || allEfficacies.includes('安神')) {
    outcomes.push({
      category: '睡眠质量',
      timeframe: '2-3周',
      description: '入睡更容易，睡眠更深沉',
      probability: 'high',
      metrics: ['入睡潜伏期', '深度睡眠比例', 'PSQI评分'],
    })
  }

  outcomes.push({
    category: '整体 wellbeing',
    timeframe: '4-6周',
    description: '整体健康状况和主观感受改善',
    probability: 'medium',
    metrics: ['生活质量问卷评分', '日常功能状态自评'],
  })

  return outcomes
}

function calculateRecommendationConfidence(
  profile: UserProfile,
  formula: PersonalizedFormula,
  alerts: PrecautionAlert[],
): number {
  let confidence = 0.75

  if (profile.healthGoals.length >= 3) confidence += 0.05
  if (profile.healthConditions.length <= 2) confidence += 0.03
  if (alerts.filter(a => a.severity === 'warning').length === 0) confidence += 0.08
  if (formula.matchScore >= 85) confidence += 0.05
  if (formula.ingredients.length >= 4 && formula.ingredients.length <= 8) confidence += 0.04

  return Math.min(0.95, confidence)
}

// ==================== 辅助函数 ====================

function generateAlternativeFormulas(
  profile: UserProfile,
  goals: EfficacyTag[],
  primary: PersonalizedFormula,
): PersonalizedFormula[] {
  const alternatives: PersonalizedFormula[] = []

  const budgetVariant = { ...profile, preferences: { ...profile.preferences, budgetLevel: 'economy' as const } }
  const premiumVariant = { ...profile, preferences: { ...profile.preferences, budgetLevel: 'premium' as const } }

  try {
    const economyVersion = generatePrimaryFormula(budgetVariant, goals)
    economyVersion.name = `${primary.name}（经济版）`
    alternatives.push(economyVersion)
  } catch { /* 备选版本生成失败时忽略 */ }

  try {
    const premiumVersion = generatePrimaryFormula(premiumVariant, goals)
    premiumVersion.name = `${primary.name}（强化版）`
    alternatives.push(premiumVersion)
  } catch { /* 备选版本生成失败时忽略 */ }

  const focusedGoals = goals.slice(0, 2)
  if (focusedGoals.length < goals.length) {
    try {
      const focusedVersion = generatePrimaryFormula(profile, focusedGoals)
      focusedVersion.name = `${primary.name}（聚焦版）`
      alternatives.push(focusedVersion)
    } catch { /* 备选版本生成失败时忽略 */ }
  }

  return alternatives
}

// ==================== Hook导出 ====================

export function useIntelligentRecommendation() {
  const recommend = useCallback((
    profile: UserProfile,
    existingFormula?: FormulaTableData,
  ) => {
    return generatePersonalizedRecommendation(profile, existingFormula)
  }, [])

  const quickAssess = useCallback((
    ageGroup: UserProfile['ageGroup'],
    goals: EfficacyTag[],
    conditions: string[] = [],
  ) => {
    const tempProfile: UserProfile = {
      id: 'temp_' + Date.now(),
      ageGroup,
      gender: 'other',
      healthGoals: goals,
      healthConditions: conditions,
      allergies: [],
      dietaryRestrictions: [],
      lifestyle: {
        activityLevel: 'moderate',
        sleepQuality: 'fair',
        stressLevel: 'medium',
        dietType: 'omnivore',
      },
      preferences: {
        tastePreference: 'neutral',
        formPreference: ['powder'],
        budgetLevel: 'standard',
      },
    }

    return generatePersonalizedRecommendation(tempProfile)
  }, [])

  return {
    recommend,
    quickAssess,
  }
}

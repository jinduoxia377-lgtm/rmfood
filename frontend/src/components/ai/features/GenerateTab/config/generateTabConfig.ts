/**
 * GenerateTab 配置常量
 *
 * @description 统一管理 GenerateTab 相关的所有配置常量
 * @version 1.0.0
 */

import { STORAGE, API } from '@/constants/businessRules'

// 药味角色常量
export const HERB_ROLES = ['君药', '臣药', '佐药', '使药'] as const
export type HerbRole = typeof HERB_ROLES[number]

// 输入模式类型
export type InputMode = 'effects' | 'manual'

// 视图模式类型
export type ViewMode = 'card' | 'compare'

// 生成器类型
export type GeneratorType = 'rule_engine' | 'llm' | 'neural_network'

// 配方分类类型
export type FormulaCategory =
  | 'IMMUNITY'
  | 'ANTI_FATIGUE'
  | 'DIGESTION'
  | 'SLEEP'
  | 'BEAUTY'
  | 'CARDIOVASCULAR'
  | 'BONE_JOINT'
  | 'VISION'
  | 'RESPIRATORY'
  | 'METABOLISM'

// 存储键配置
export const STORAGE_KEYS = {
  selectedEffects: 'rmfood:generate:selectedEffects',
  useLlm: 'rmfood:generate:useLlm',
  advancedMode: 'rmfood:generate:advancedMode',
  viewMode: 'rmfood:generate:viewMode',
} as const

// 验证配置
export const VALIDATION = {
  maxEffectSelection: 6,
  maxFormulaVersions: 100,
  maxFormulaNameLength: 100,
  maxDosageValue: 999999,
} as const

// 超时配置
export const TIMEOUTS = {
  saveSuccessDisplay: 3000,
  generation: 30000,
  analysis: 15000,
  save: 5000,
} as const

// 默认值配置
export const DEFAULTS = {
  viewMode: 'card' as ViewMode,
  useLlm: false,
  advancedMode: false,
  maxCandidates: 20,
  tasteScore: 80,
  stabilityScore: 75,
  safetyScore: 90,
  costScore: 70,
  dosageRange: '10-20g',
  unknownFormula: '未知配方',
  unknownIngredient: '未知药材',
  categoryCustom: '自定义',
  placeholderTexts: {
    unknownFormula: '未知配方',
    unknownIngredient: '未知药材',
    generationPreparing: '准备中...',
    generationParsing: '解析配方...',
    generationProcessing: '智能生成...',
    generationOptimizing: '优化配方...',
    generationValidating: '验证配方...',
    generationErrorTitle: '生成失败',
    generationSuccessTitle: '生成成功',
    generationSuccessMessagePrefix: '已生成',
    generationSuccessMessageSuffix: '个配方',
    saveSuccessTitle: '保存成功',
    saveSuccessMessagePrefix: '成功保存',
    saveSuccessMessageSuffix: '',
    pageTitleGenerate: 'AI配方生成',
    pageSubtitleGenerate: '智能生成个性化配方方案',
    buttonAdvancedMode: '高级模式',
    buttonSimpleMode: '简单模式',
    buttonRegenerate: '重新生成',
    buttonStartGenerate: '生成配方',
    buttonAIGenerate: 'AI智能生成',
    buttonSelectEffects: '功效选择',
    buttonManualInput: '手动输入',
    labelInputMode: '输入模式',
    labelEnableAIEnhancement: 'AI增强',
    titleSelectEffects: '选择功效',
    badgePopular: '热门',
    resultCountPrefix: '共',
    resultCountSuffix: '个配方',
    badgeAIModel: 'AI模型',
    badgeNeuralNetwork: '神经网络',
    badgeRuleEngine: '规则引擎',
    resultSubtitle: '点击配方可查看详细信息',
    buttonCardView: '卡片',
    buttonCompareView: '对比',
    buttonOptimizationAdvice: '优化建议',
    buttonShareFormula: '分享配方',
    buttonExport: '导出',
    titleVersionHistory: '版本历史',
    versionCountPrefix: '共',
    versionCountSuffix: '个版本',
    versionRemarkPrefix: '基于',
    versionRemarkSuffix: '生成',
    prefixVersion: '版本',
    successLoadVersion: '版本加载成功',
    successRollbackVersion: '已回滚到',
    infoVersionCompare: '版本对比',
    loadingText: '加载中...',
    errorNoticeTitle: '错误提示',
    closeNoticeButton: '关闭',
    categoryCustom: '自定义',
  },
} as const

// 分类对应的功效列表
export const CATEGORY_EFFECTS: Record<FormulaCategory, readonly string[]> = {
  IMMUNITY: ['增强免疫力', '免疫调节', '提高抵抗力'],
  ANTI_FATIGUE: ['抗疲劳', '缓解疲劳', '提升精力'],
  DIGESTION: ['健脾养胃', '促进消化', '调理脾胃'],
  SLEEP: ['安神助眠', '改善睡眠', '安神定志'],
  BEAUTY: ['美容养颜', '延缓衰老', '美容护肤'],
  CARDIOVASCULAR: ['心血管健康', '调节血脂', '保护心血管'],
  BONE_JOINT: ['骨骼关节', '强健筋骨', '关节保健'],
  VISION: ['明目护眼', '保护视力', '缓解眼疲劳'],
  RESPIRATORY: ['呼吸系统', '润肺止咳', '清咽利喉'],
  METABOLISM: ['代谢调节', '控制体重', '调节代谢'],
} as const

// 配方分类列表（用于UI展示）
export const FORMULA_CATEGORY_LIST: {
  id: FormulaCategory
  label: string
  color: string
}[] = [
  { id: 'IMMUNITY', label: '免疫力', color: 'var(--color-primary-400)' },
  { id: 'ANTI_FATIGUE', label: '抗疲劳', color: '#D97706' },
  { id: 'DIGESTION', label: '消化', color: '#84cc16' },
  { id: 'SLEEP', label: '睡眠', color: 'var(--color-primary-500, #10b981)' },
  { id: 'BEAUTY', label: '美容', color: '#D946EF' },
  { id: 'CARDIOVASCULAR', label: '心血管', color: '#FF3B30' },
  { id: 'BONE_JOINT', label: '骨关节', color: 'var(--color-info-600)' },
  { id: 'VISION', label: '视力', color: 'var(--color-primary-500, #10b981)' },
  { id: 'RESPIRATORY', label: '呼吸', color: '#14b8a6' },
  { id: 'METABOLISM', label: '代谢', color: '#EA580C' },
] as const

// 配方分类配置（用于UI展示）
export const FORMULA_CATEGORIES: Record<
  FormulaCategory,
  { label: string; color: string }
> = FORMULA_CATEGORY_LIST.reduce(
  (acc, cat) => ({
    ...acc,
    [cat.id]: { label: cat.label, color: cat.color },
  }),
  {} as Record<FormulaCategory, { label: string; color: string }>,
)

// 获取分类对应的功效
export function getCategoryEffects(
  category: FormulaCategory | 'all',
): readonly string[] | null {
  if (category === 'all') return null
  return CATEGORY_EFFECTS[category]
}

// 统一配置导出
export const GENERATE_TAB_CONFIG = {
  storage: STORAGE_KEYS,
  validation: VALIDATION,
  timeouts: TIMEOUTS,
  defaults: DEFAULTS,
  herbRoles: HERB_ROLES,
  categoryEffects: CATEGORY_EFFECTS,
  formulaCategoryList: FORMULA_CATEGORY_LIST,
  formulaCategories: FORMULA_CATEGORIES,
} as const

// 向后兼容：保留原有的导出名称
export const PLACEHOLDER_TEXTS = {
  UNKNOWN_FORMULA: DEFAULTS.placeholderTexts.unknownFormula,
  UNKNOWN_INGREDIENT: DEFAULTS.placeholderTexts.unknownIngredient,
  GENERATION_ERROR_TITLE: DEFAULTS.placeholderTexts.generationErrorTitle,
  INPUT_EMPTY: '请输入配方名称',
} as const

export const DEFAULT_DOSAGE_RANGE = DEFAULTS.dosageRange

// 视图模式常量
export const VIEW_MODE = {
  CARD: 'card' as ViewMode,
  COMPARE: 'compare' as ViewMode,
} as const

// 输入模式常量
export const INPUT_MODE = {
  EFFECTS: 'effects' as InputMode,
  MANUAL: 'manual' as InputMode,
} as const

// 类型导出（HerbRole 已在第12行通过 `export type HerbRole = typeof HERB_ROLES[number]` 导出）

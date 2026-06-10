/**
 * 五味理论数据模型 - Taste Types
 *
 * 基于《黄帝内经》五味理论和现代感官科学
 * 用于口感预测模块的数据结构定义
 */

// ==================== 核心类型定义 ====================

/** 五味枚举 - 中医基础理论 */
export enum FiveTastes {
  SWEET = 'sweet',      // 甘
  SOUR = 'sour',        // 酸
  BITTER = 'bitter',     // 苦
  PUNGENT = 'pungent',   // 辛
  SALTY = 'salty',       // 咸
  BLAND = 'bland'        // 淡
}

/** 五味中文名称映射 */
export const FIVE_TASTES_LABELS: Record<FiveTastes, string> = {
  [FiveTastes.SWEET]: '甘',
  [FiveTastes.SOUR]: '酸',
  [FiveTastes.BITTER]: '苦',
  [FiveTastes.PUNGENT]: '辛',
  [FiveTastes.SALTY]: '咸',
  [FiveTastes.BLAND]: '淡',
}

/** 五味颜色配置（用于可视化） */
export const FIVE_TASTES_COLORS: Record<FiveTastes, string> = {
  [FiveTastes.SWEET]: '#FF6B6B',   // 珊瑚红
  [FiveTastes.SOUR]: '#FFE66D',    // 柠黄
  [FiveTastes.BITTER]: '#4ECDC4',  // 青碧
  [FiveTastes.PUNGENT]: '#A8E6CF', // 薄荷绿
  [FiveTastes.SALTY]: '#DDA0DD',   // 藤紫
  [FiveTastes.BLAND]: '#C7CEEA',     // 灰蓝
}

/** 单一成分的口感特征 */
export interface TasteProfile {
  /** 甘味强度 (0-100) */
  sweet: number
  /** 酸味强度 (0-100) */
  sour: number
  /** 苦味强度 (0-100) */
  bitter: number
  /** 辛味强度 (0-100) */
  pungent: number
  /** 咸味强度 (0-100) */
  salty: number
  /** 淡味强度 (0-100) */
  bland: number
}

/** 完整的口感预测结果 */
export interface TastePrediction {
  /** 综合评分 (0-1, 越高越平衡) */
  score: number
  /** 主导口味 (最强的一个) */
  dominantTaste: FiveTastes
  /** 主导强度值 (0-100) */
  dominantIntensity: number
  /** 五味详细分布 */
  profile: TasteProfile
  /** 口感特征标签 (如"回甘"、"涩") */
  features: string[]
  /** 优化建议 */
  suggestions: string[]
  /** 风味描述文本 */
  description: string
  /** 各成分贡献分析 */
  contributions: IngredientTasteContribution[]
}

/** 成分对配方的口感贡献 */
export interface IngredientTasteContribution {
  /** 成分名称 */
  name: string
  /** 该成分的用量占比 (%) */
  percentage: number
  /** 该成分的口感特征 */
  profile: TasteProfile
  /** 对整体口感的影响权重 */
  weight: number
}

/** 口感预测参数配置 */
export interface TastePredictConfig {
  /** 是否考虑炮制影响 */
  considerProcessing: boolean
  /** 是否显示详细分解 */
  showDetailedBreakdown: boolean
  /** 算法模式: 'weighted' | 'synergy' | 'ml' */
  algorithmMode: 'weighted' | 'synergy' | 'ml'
}

/** 炮制方法及其对口感的影响因子 */
export interface ProcessingMethod {
  /** 方法名称 (如"蜜炙"、"酒炒"、"醋制") */
  name: string
  /** 对五味的影响系数 */
  tasteModifiers: Partial<Record<FiveTastes, number>>
  /** 影响描述 */
  description: string
}

// ==================== 预置数据库 ====================

/** 常见中药材的口感特征库 */
export const INGREDIENT_TASTE_DATABASE: Record<string, TasteProfile> = {
  // 补气药
  '黄芪': { sweet: 75, sour: 10, bitter: 15, pungent: 5, salty: 5, bland: 20 },
  '党参': { sweet: 70, sour: 15, bitter: 20, pungent: 10, salty: 5, bland: 25 },
  '人参': { sweet: 65, sour: 10, bitter: 30, pungent: 15, salty: 5, bland: 15 },
  '白术': { sweet: 60, sour: 15, bitter: 25, pungent: 15, salty: 5, bland: 20 },
  '山药': { sweet: 80, sour: 10, bitter: 5, pungent: 5, salty: 5, bland: 40 },

  // 补血药
  '当归': { sweet: 45, sour: 20, bitter: 35, pungent: 20, salty: 10, bland: 15 },
  '熟地': { sweet: 70, sour: 15, bitter: 25, pungent: 5, salty: 10, bland: 20 },
  '白芍': { sweet: 50, sour: 25, bitter: 30, pungent: 10, salty: 5, bland: 20 },
  '阿胶': { sweet: 85, sour: 5, bitter: 10, pungent: 5, salty: 15, bland: 10 },

  // 补阴药
  '枸杞子': { sweet: 85, sour: 15, bitter: 5, pungent: 5, salty: 5, bland: 10 },
  '麦冬': { sweet: 65, sour: 20, bitter: 15, pungent: 5, salty: 5, bland: 30 },
  '沙参': { sweet: 55, sour: 25, bitter: 20, pungent: 10, salty: 5, bland: 25 },
  '石斛': { sweet: 50, sour: 20, bitter: 25, pungent: 10, salty: 5, bland: 30 },

  // 清热药
  '黄芩': { sweet: 20, sour: 35, bitter: 70, pungent: 25, salty: 10, bland: 10 },
  '黄连': { sweet: 10, sour: 40, bitter: 90, pungent: 30, salty: 10, bland: 5 },
  '金银花': { sweet: 25, sour: 30, bitter: 35, pungent: 20, salty: 5, bland: 20 },
  '连翘': { sweet: 20, sour: 35, bitter: 40, pungent: 25, salty: 5, bland: 15 },

  // 解表药
  '麻黄': { sweet: 15, sour: 10, bitter: 30, pungent: 70, salty: 5, bland: 10 },
  '桂枝': { sweet: 35, sour: 15, bitter: 15, pungent: 65, salty: 5, bland: 15 },
  '生姜': { sweet: 40, sour: 20, bitter: 10, pungent: 75, salty: 5, bland: 10 },
  '柴胡': { sweet: 25, sour: 25, bitter: 40, pungent: 30, salty: 5, bland: 15 },

  // 理气药
  '陈皮': { sweet: 45, sour: 35, bitter: 15, pungent: 55, salty: 5, bland: 10 },
  '枳实': { sweet: 20, sour: 30, bitter: 35, pungent: 40, salty: 5, bland: 15 },
  '木香': { sweet: 30, sour: 20, bitter: 25, pungent: 50, salty: 5, bland: 20 },
  '香附': { sweet: 35, sour: 25, bitter: 20, pungent: 45, salty: 5, bland: 15 },

  // 活血化瘀药
  '丹参': { sweet: 25, sour: 25, bitter: 45, pungent: 20, salty: 10, bland: 15 },
  '川芎': { sweet: 20, sour: 20, bitter: 35, pungent: 55, salty: 10, bland: 10 },
  '红花': { sweet: 20, sour: 15, bitter: 30, pungent: 40, salty: 5, bland: 20 },
  '桃仁': { sweet: 30, sour: 15, bitter: 25, pungent: 20, salty: 5, bland: 35 },

  // 安神药
  '酸枣仁': { sweet: 55, sour: 50, bitter: 25, pungent: 10, salty: 5, bland: 15 },
  '远志': { sweet: 25, sour: 20, bitter: 45, pungent: 30, salty: 5, bland: 20 },
  '茯苓': { sweet: 60, sour: 10, bitter: 10, pungent: 5, salty: 5, bland: 50 },
  '龙骨': { sweet: 10, sour: 5, bitter: 15, pungent: 5, salty: 20, bland: 60 },

  // 收涩药
  '五味子': { sweet: 50, sour: 65, bitter: 40, pungent: 25, salty: 15, bland: 10 },
  '山茱萸': { sweet: 45, sour: 50, bitter: 25, pungent: 15, salty: 10, bland: 20 },
  '莲子': { sweet: 75, sour: 15, bitter: 15, pungent: 5, salty: 5, bland: 40 },
  '芡实': { sweet: 70, sour: 15, bitter: 10, pungent: 5, salty: 5, bland: 45 },

  // 消食药
  '山楂': { sweet: 65, sour: 70, bitter: 20, pungent: 10, salty: 5, bland: 10 },
  '麦芽': { sweet: 75, sour: 25, bitter: 10, pungent: 10, salty: 5, bland: 25 },
  '鸡内金': { sweet: 30, sour: 15, bitter: 20, pungent: 10, salty: 5, bland: 50 },
  '神曲': { sweet: 55, sour: 35, bitter: 15, pungent: 15, salty: 5, bland: 25 },
}

/** 预置炮制方法数据库 */
export const PROCESSING_METHODS: ProcessingMethod[] = [
  {
    name: '蜜炙',
    tasteModifiers: { [FiveTastes.SWEET]: 20, [FiveTastes.BITTER]: -10 },
    description: '增强甘味，降低苦味，增加滋补作用',
  },
  {
    name: '酒炒',
    tasteModifiers: { [FiveTastes.PUNGENT]: 25, [FiveTastes.SOUR]: 10 },
    description: '增强辛散之性，提升行气活血功效',
  },
  {
    name: '醋制',
    tasteModifiers: { [FiveTastes.SOUR]: 30, [FiveTastes.SALTY]: 10 },
    description: '增强酸味，引药入肝，提升收敛作用',
  },
  {
    name: '盐炒',
    tasteModifiers: { [FiveTastes.SALTY]: 25, [FiveTastes.BITTER]: -5 },
    description: '增强咸味，引药下行，软坚散结',
  },
  {
    name: '麸炒',
    tasteModifiers: { [FiveTastes.SWEET]: 15, [FiveTastes.BLAND]: 10 },
    description: '缓和药性，增强健脾和胃功效',
  },
  {
    name: '土炒',
    tasteModifiers: { [FiveTastes.SWEET]: 10, [FiveTastes.BLAND]: 15 },
    description: '增强补脾止泻作用，减少刺激性',
  },
]

/** 口感优化建议模板 */
export const TASTE_OPTIMIZATION_SUGGESTIONS: Record<FiveTastes, string[]> = {
  [FiveTastes.SWEET]: [
    '可加入甘草、大枣等调和药性',
    '采用蜜炙法增强甘味',
    '适当增加甜味药材比例',
  ],
  [FiveTastes.SOUR]: [
    '可加入乌梅、山楂等酸味药材',
    '配合甘味药材调和，避免过酸伤胃',
    '酸味适中可开胃消食',
  ],
  [FiveTastes.BITTER]: [
    '苦寒药物易伤脾胃，需配伍温补药',
    '可采用姜汁炙或炒制减低苦味',
    '控制苦味药材用量在合理范围',
  ],
  [FiveTastes.PUNGENT]: [
    '辛散药物易耗气伤阴，阴虚者慎用',
    '可配合酸敛药物制约其发散之性',
    '夏季或干燥地区应减少辛味药比例',
  ],
  [FiveTastes.SALTY]: [
    '咸味入肾软化，但过量伤肾',
    '高血压患者应限制咸味药物',
    '可与淡味药物配伍使用',
  ],
  [FiveTastes.BLAND]: [
    '淡味能渗湿利尿，但多服耗气',
    '可适当配伍补气药物',
    '水肿患者适用，虚证者慎用',
  ],
}

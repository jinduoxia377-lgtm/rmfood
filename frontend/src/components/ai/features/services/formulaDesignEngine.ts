/**
 * FormulaDesignEngine — 食品配方智能设计引擎 v1.0
 *
 * ⚠️ @deprecated 前端遗留引擎（task-4 死代码治理）：
 * - 本文件 INGREDIENT_DATABASE 为硬编码英文-key 小数据集（18 种成分），
 *   与后端真实药食同源/原料库（POST /api/v1/ai/formula/knowledge）完全脱节。
 * - GenerateTab 主流程不依赖本模块：真实配方生成走 aiApi.generate
 *   （POST /api/v1/ai/generate → 后端 GA/规则引擎）。
 * - 保留仅用于兼容历史 import 链（formulaIntelligenceService / FormulaDialogueManager），
 *   新代码请直接调用 @/api/ai。
 *
 * 基于专利级配方的多维度智能算法，实现：
 * 1. 君臣佐使配伍分析（中医理论数字化）
 * 2. 成分兼容性矩阵（协同/拮抗/十八反十九畏）
 * 3. 多维度评分系统（功效/安全/口感/稳定/成本）
 * 4. 多目标 Pareto 优化
 * 5. 智能配方生成与迭代优化
 *
 * @version 1.0.0
 * @lastUpdated 2026-06-07
 */

import {
  FDE_MERIDIAN_BONUS,
  FDE_FLAVOR_BONUS,
  FDE_COMPAT_SCORE_MIN,
  FDE_COMPAT_SCORE_MAX,
  FDE_DEFAULT_WEIGHTS,
} from '@/config/ai/constants'

/* ================================================================== */
/*  类型定义                                                            */
/* ================================================================== */

/** 成分角色（君臣佐使） */
export type IngredientRole = 'jun' | 'chen' | 'zuo' | 'shi'

/** 成分类别 */
export type IngredientCategory =
  | 'herb'           // 药食同源
  | 'peptide'        // 肽类
  | 'vitamin'        // 维生素
  | 'mineral'        // 矿物质
  | 'probiotic'      // 益生菌
  | 'fiber'          // 膳食纤维
  | 'protein'        // 蛋白质
  | 'lipid'          // 脂类
  | 'botanical'      // 植物提取物
  | 'other'          // 其他

/** 交互类型 */
export type InteractionType =
  | 'synergy'        // 协同增强
  | 'additive'       // 相加作用
  | 'antagonism'     // 拮抗作用
  | 'toxicity'       // 毒性增强
  | 'incompatibility'// 配伍禁忌

/** 维度评分 */
export type ScoreDimension =
  | 'efficacy'       // 功效
  | 'safety'         // 安全性
  | 'taste'          // 口感
  | 'stability'      // 稳定性
  | 'cost'           // 成本

/* ================================================================== */
/*  核心数据接口                                                        */
/* ================================================================== */

/** 成分档案 */
export interface IngredientProfile {
  id: string
  name: string
  latinName?: string
  category: IngredientCategory
  roles: IngredientRole[]
  properties: {
    nature?: 'cold' | 'cool' | 'neutral' | 'warm' | 'hot'  // 四气
    flavor?: string[]                                        // 五味
    meridians?: string[]                                     // 归经
  }
  /** 推荐用量范围 (g) */
  dosageRange: [number, number]
  /** 安全阈值 (最大日用量 g) */
  safetyLimit: number
  /** 功效向量 [功效维度1,...] 0-1 */
  efficacyVector: Record<string, number>
  /** 成本系数 0-1 (低=便宜) */
  costFactor: number
  /** 口感评分 0-1 */
  tasteScore: number
  /** 稳定性评分 0-1 */
  stabilityScore: number
  /** 参考文献 */
  references: string[]
}

/** 成分间交互 */
export interface IngredientInteraction {
  ingredientA: string
  ingredientB: string
  type: InteractionType
  /** 交互强度 0-1 */
  strength: number
  description: string
  mechanism?: string
}

/** 配方候选 */
export interface FormulaCandidate {
  id: string
  name: string
  ingredients: Array<{
    profile: IngredientProfile
    dosage: number       // 克
    role: IngredientRole
    rationale: string    // 配伍理由
  }>
  scores: Record<ScoreDimension, number>
  overallScore: number
  compatibilityMatrix: Array<{
    pair: [string, string]
    interaction: InteractionType
    score: number
    description: string
  }>
  optimizationHistory?: Array<{
    iteration: number
    scores: Record<ScoreDimension, number>
    changes: string
  }>
}

/** 配方设计需求 */
export interface FormulaDesignRequest {
  targetEffects: string[]
  constraints?: {
    maxIngredients?: number
    maxCost?: number
    dietaryRestrictions?: string[]
    avoidIngredients?: string[]
    preferredCategories?: IngredientCategory[]
  }
  userProfile?: {
    age?: number
    healthConditions?: string[]
    allergies?: string[]
    goals?: string[]
  }
}

/** 优化目标权重 */
export interface OptimizationWeights {
  efficacy: number
  safety: number
  taste: number
  stability: number
  cost: number
}

/* ================================================================== */
/*  成分知识库 — 核心专家数据系统                                       */
/* ================================================================== */

const INGREDIENT_DATABASE: Record<string, IngredientProfile> = {
  'astragalus': {
    id: 'astragalus',
    name: '黄芪',
    latinName: 'Astragalus membranaceus',
    category: 'herb',
    roles: ['jun'],
    properties: { nature: 'warm', flavor: ['甘'], meridians: ['脾', '肺'] },
    dosageRange: [9, 30],
    safetyLimit: 60,
    efficacyVector: { immunity: 0.92, anti_fatigue: 0.85, anti_aging: 0.78, cardio_protect: 0.82 },
    costFactor: 0.3,
    tasteScore: 0.6,
    stabilityScore: 0.9,
    references: ['中国药典2025', '黄芪多糖免疫调节机制研究'],
  },
  'angelica': {
    id: 'angelica',
    name: '当归',
    latinName: 'Angelica sinensis',
    category: 'herb',
    roles: ['chen'],
    properties: { nature: 'warm', flavor: ['甘', '辛'], meridians: ['肝', '心', '脾'] },
    dosageRange: [6, 15],
    safetyLimit: 30,
    efficacyVector: { blood_nourish: 0.9, anti_inflammatory: 0.75, anti_oxidant: 0.8, immunity: 0.7 },
    costFactor: 0.4,
    tasteScore: 0.55,
    stabilityScore: 0.85,
    references: ['当归化学成分与药理作用研究进展'],
  },
  'ginseng': {
    id: 'ginseng',
    name: '人参',
    latinName: 'Panax ginseng',
    category: 'herb',
    roles: ['jun'],
    properties: { nature: 'warm', flavor: ['甘', '微苦'], meridians: ['脾', '肺', '心', '肾'] },
    dosageRange: [3, 9],
    safetyLimit: 15,
    efficacyVector: { vitality: 0.95, cognition: 0.88, immunity: 0.85, anti_fatigue: 0.9, adaptogen: 0.92 },
    costFactor: 0.8,
    tasteScore: 0.45,
    stabilityScore: 0.88,
    references: ['人参皂苷药理活性研究', '人参在功能性食品中的应用'],
  },
  'schisandra': {
    id: 'schisandra',
    name: '五味子',
    latinName: 'Schisandra chinensis',
    category: 'herb',
    roles: ['shi'],
    properties: { nature: 'warm', flavor: ['酸', '甘'], meridians: ['肺', '心', '肾'] },
    dosageRange: [3, 9],
    safetyLimit: 15,
    efficacyVector: { liver_protect: 0.88, anti_oxidant: 0.85, adaptogen: 0.8, cognition: 0.75 },
    costFactor: 0.5,
    tasteScore: 0.4,
    stabilityScore: 0.82,
    references: ['五味子木脂素保肝作用研究'],
  },
  'licorice': {
    id: 'licorice',
    name: '甘草',
    latinName: 'Glycyrrhiza uralensis',
    category: 'herb',
    roles: ['shi'],
    properties: { nature: 'neutral', flavor: ['甘'], meridians: ['心', '肺', '脾', '胃'] },
    dosageRange: [2, 9],
    safetyLimit: 12,
    efficacyVector: { detoxify: 0.85, anti_inflammatory: 0.8, harmonize: 0.95, immunity: 0.7 },
    costFactor: 0.2,
    tasteScore: 0.7,
    stabilityScore: 0.9,
    references: ['甘草酸药理作用及临床应用'],
  },
  'goji': {
    id: 'goji',
    name: '枸杞子',
    latinName: 'Lycium barbarum',
    category: 'herb',
    roles: ['chen'],
    properties: { nature: 'neutral', flavor: ['甘'], meridians: ['肝', '肾'] },
    dosageRange: [6, 15],
    safetyLimit: 30,
    efficacyVector: { vision: 0.85, immunity: 0.8, anti_aging: 0.82, anti_oxidant: 0.88 },
    costFactor: 0.35,
    tasteScore: 0.75,
    stabilityScore: 0.85,
    references: ['枸杞多糖免疫调节作用'],
  },
  'dang_shen': {
    id: 'dang_shen',
    name: '党参',
    latinName: 'Codonopsis pilosula',
    category: 'herb',
    roles: ['jun', 'chen'],
    properties: { nature: 'neutral', flavor: ['甘'], meridians: ['脾', '肺'] },
    dosageRange: [9, 30],
    safetyLimit: 60,
    efficacyVector: { immunity: 0.82, anti_fatigue: 0.8, digestion: 0.78, blood_nourish: 0.7 },
    costFactor: 0.25,
    tasteScore: 0.65,
    stabilityScore: 0.87,
    references: ['党参多糖对免疫功能的调节作用'],
  },
  'wolfberry': {
    id: 'wolfberry',
    name: '枸杞',
    category: 'herb',
    roles: ['chen'],
    properties: { nature: 'neutral', flavor: ['甘'], meridians: ['肝', '肾'] },
    dosageRange: [5, 15],
    safetyLimit: 30,
    efficacyVector: { anti_oxidant: 0.9, vision: 0.85, immunity: 0.82, anti_aging: 0.8 },
    costFactor: 0.3,
    tasteScore: 0.8,
    stabilityScore: 0.85,
    references: ['枸杞功能性成分研究进展'],
  },
  'tumeric': {
    id: 'tumeric',
    name: '姜黄',
    latinName: 'Curcuma longa',
    category: 'botanical',
    roles: ['chen'],
    properties: { nature: 'warm', flavor: ['辛', '苦'], meridians: ['脾', '肝'] },
    dosageRange: [3, 9],
    safetyLimit: 12,
    efficacyVector: { anti_inflammatory: 0.95, anti_oxidant: 0.9, joint_health: 0.85, cognition: 0.78 },
    costFactor: 0.45,
    tasteScore: 0.35,
    stabilityScore: 0.75,
    references: ['姜黄素抗炎机制研究', '姜黄素生物利用度提升策略'],
  },
  'collagen_peptide': {
    id: 'collagen_peptide',
    name: '胶原蛋白肽',
    category: 'peptide',
    roles: ['jun'],
    properties: { nature: 'neutral', flavor: ['甘'], meridians: [] },
    dosageRange: [3, 10],
    safetyLimit: 20,
    efficacyVector: { skin_health: 0.9, joint_health: 0.85, bone_health: 0.8, anti_aging: 0.82 },
    costFactor: 0.7,
    tasteScore: 0.7,
    stabilityScore: 0.85,
    references: ['胶原蛋白肽皮肤健康功效研究', '生物活性肽研究进展'],
  },
  'soy_peptide': {
    id: 'soy_peptide',
    name: '大豆肽',
    category: 'peptide',
    roles: ['chen'],
    properties: { nature: 'neutral', flavor: ['甘'], meridians: [] },
    dosageRange: [5, 15],
    safetyLimit: 30,
    efficacyVector: { anti_fatigue: 0.8, immunity: 0.78, muscle: 0.85, metabolism: 0.75 },
    costFactor: 0.4,
    tasteScore: 0.6,
    stabilityScore: 0.88,
    references: ['大豆肽抗疲劳功能研究'],
  },
  'fish_peptide': {
    id: 'fish_peptide',
    name: '鱼胶原蛋白肽',
    category: 'peptide',
    roles: ['jun'],
    properties: { nature: 'neutral', flavor: ['甘'], meridians: [] },
    dosageRange: [3, 8],
    safetyLimit: 15,
    efficacyVector: { skin_health: 0.92, joint_health: 0.88, bone_health: 0.82, anti_oxidant: 0.75 },
    costFactor: 0.75,
    tasteScore: 0.65,
    stabilityScore: 0.82,
    references: ['鱼胶原蛋白肽对皮肤弹性的改善作用'],
  },
  'inulin': {
    id: 'inulin',
    name: '菊粉',
    category: 'fiber',
    roles: ['zuo'],
    properties: { nature: 'neutral', flavor: ['甘'], meridians: [] },
    dosageRange: [5, 15],
    safetyLimit: 30,
    efficacyVector: { gut_health: 0.9, prebiotic: 0.88, metabolism: 0.75, immunity: 0.7 },
    costFactor: 0.3,
    tasteScore: 0.85,
    stabilityScore: 0.95,
    references: ['菊粉益生元特性研究'],
  },
  'vitamin_c': {
    id: 'vitamin_c',
    name: '维生素C',
    category: 'vitamin',
    roles: ['zuo'],
    properties: { nature: 'cool', flavor: ['酸'], meridians: [] },
    dosageRange: [0.1, 0.5],
    safetyLimit: 2,
    efficacyVector: { anti_oxidant: 0.95, immunity: 0.85, skin_health: 0.88, anti_fatigue: 0.7 },
    costFactor: 0.15,
    tasteScore: 0.5,
    stabilityScore: 0.4,
    references: ['维生素C抗氧化机制', '维生素C与免疫调节'],
  },
  'zinc': {
    id: 'zinc',
    name: '锌',
    category: 'mineral',
    roles: ['zuo'],
    properties: { nature: 'neutral', flavor: [], meridians: [] },
    dosageRange: [0.005, 0.015],
    safetyLimit: 0.04,
    efficacyVector: { immunity: 0.85, wound_healing: 0.8, taste: 0.7, growth: 0.78 },
    costFactor: 0.2,
    tasteScore: 0.3,
    stabilityScore: 0.9,
    references: ['锌与免疫功能研究进展'],
  },
  'probiotic_blend': {
    id: 'probiotic_blend',
    name: '复合益生菌',
    category: 'probiotic',
    roles: ['zuo'],
    properties: { nature: 'neutral', flavor: [], meridians: [] },
    dosageRange: [1, 5],
    safetyLimit: 10,
    efficacyVector: { gut_health: 0.95, immunity: 0.82, digestion: 0.88, metabolism: 0.75 },
    costFactor: 0.6,
    tasteScore: 0.5,
    stabilityScore: 0.3,
    references: ['益生菌肠道健康功效研究', '复合益生菌配方优化'],
  },
  'astaxanthin': {
    id: 'astaxanthin',
    name: '虾青素',
    category: 'botanical',
    roles: ['zuo'],
    properties: { nature: 'cool', flavor: [], meridians: [] },
    dosageRange: [0.004, 0.012],
    safetyLimit: 0.024,
    efficacyVector: { anti_oxidant: 0.98, anti_aging: 0.9, vision: 0.82, skin_health: 0.85, anti_inflammatory: 0.8 },
    costFactor: 0.9,
    tasteScore: 0.3,
    stabilityScore: 0.45,
    references: ['虾青素超级抗氧化活性', '虾青素在功能性食品中的应用'],
  },
}

/* ================================================================== */
/*  配伍知识库 — 交互规则引擎                                          */
/* ================================================================== */

const INTERACTION_KNOWLEDGE: IngredientInteraction[] = [
  // 协同配对
  { ingredientA: 'astragalus', ingredientB: 'angelica', type: 'synergy', strength: 0.85, description: '黄芪配当归：气血双补经典配伍，补气生血功效协同增强', mechanism: '黄芪多糖促进造血因子分泌，当归多糖提供造血原料' },
  { ingredientA: 'ginseng', ingredientB: 'schisandra', type: 'synergy', strength: 0.78, description: '人参配五味子：益气养阴，补敛并施，抗疲劳协同', mechanism: '人参皂苷+五味子木脂素双重调节HPA轴' },
  { ingredientA: 'astragalus', ingredientB: 'licorice', type: 'synergy', strength: 0.75, description: '黄芪配甘草：补中益气功效增强，甘草调和诸药', mechanism: '黄芪多糖+甘草酸协同激活免疫通路' },
  { ingredientA: 'tumeric', ingredientB: 'schisandra', type: 'synergy', strength: 0.82, description: '姜黄配五味子：肝保护协同，抗炎抗氧化双通道', mechanism: '姜黄素+五味子乙素协同激活Nrf2通路' },
  { ingredientA: 'collagen_peptide', ingredientB: 'vitamin_c', type: 'synergy', strength: 0.9, description: '胶原蛋白肽配VC：VC促进胶原合成，吸收利用率提升', mechanism: 'VC作为羟化酶辅因子促进胶原交联' },
  { ingredientA: 'fish_peptide', ingredientB: 'vitamin_c', type: 'synergy', strength: 0.88, description: '鱼胶原蛋白肽配VC：协同促进皮肤胶原合成', mechanism: 'VC促进胶原肽羟化，提升生物利用度' },
  { ingredientA: 'inulin', ingredientB: 'probiotic_blend', type: 'synergy', strength: 0.92, description: '菊粉配益生菌：益生元+益生菌协同，肠道健康效果最优', mechanism: '菊粉选择性促进益生菌定殖' },
  { ingredientA: 'astragalus', ingredientB: 'dang_shen', type: 'additive', strength: 0.7, description: '黄芪配党参：补气作用叠加，适合气虚明显', mechanism: '双重调节免疫信号通路' },
  { ingredientA: 'goji', ingredientB: 'astragalus', type: 'synergy', strength: 0.72, description: '枸杞配黄芪：免疫增强协同，补气养阴并举', mechanism: '枸杞多糖+黄芪多糖协同激活T细胞' },
  { ingredientA: 'tumeric', ingredientB: 'astaxanthin', type: 'synergy', strength: 0.85, description: '姜黄配虾青素：抗氧化超级组合，多通路覆盖', mechanism: '姜黄素+虾青素分别作用于不同氧化通路' },
  { ingredientA: 'tumeric', ingredientB: 'zinc', type: 'additive', strength: 0.6, description: '姜黄配锌：抗炎与免疫支持协同', mechanism: '锌促进姜黄素的生物利用度' },
  { ingredientA: 'vitamin_c', ingredientB: 'zinc', type: 'synergy', strength: 0.75, description: 'VC配锌：免疫增强黄金组合', mechanism: 'VC促进锌吸收，协同激活免疫细胞' },
  { ingredientA: 'collagen_peptide', ingredientB: 'soy_peptide', type: 'additive', strength: 0.65, description: '胶原肽配大豆肽：动植物双肽互补', mechanism: '不同氨基酸谱系互补，更全面营养支撑' },
  { ingredientA: 'schisandra', ingredientB: 'licorice', type: 'synergy', strength: 0.7, description: '五味子配甘草：保肝降酶协同', mechanism: '五味子木脂素+甘草酸协同抗氧化保肝' },
  { ingredientA: 'soy_peptide', ingredientB: 'inulin', type: 'additive', strength: 0.5, description: '大豆肽配菊粉：蛋白+纤维基础营养组合', mechanism: '氮源与碳源互补' },
  { ingredientA: 'ginseng', ingredientB: 'astragalus', type: 'synergy', strength: 0.8, description: '人参配黄芪：补气大王组合，用于重度疲劳', mechanism: '人参皂苷+黄芪多糖双重激活能量代谢' },
  { ingredientA: 'angelica', ingredientB: 'licorice', type: 'additive', strength: 0.6, description: '当归配甘草：调和补血，减少当归燥性', mechanism: '甘草酸调节当归挥发性成分释放' },
  // 拮抗/禁忌
  { ingredientA: 'astragalus', ingredientB: 'probiotic_blend', type: 'antagonism', strength: 0.3, description: '高浓度黄芪多糖可能影响益生菌活性，建议间隔服用', mechanism: '多糖可能改变肠道微环境' },
  { ingredientA: 'vitamin_c', ingredientB: 'astaxanthin', type: 'antagonism', strength: 0.2, description: '强抗氧化剂同时使用存在竞争，建议错时服用', mechanism: '竞争同一氧化还原通路' },
  { ingredientA: 'zinc', ingredientB: 'vitamin_c', type: 'antagonism', strength: 0.15, description: '极高剂量锌与VC在吸收层面存在轻微竞争', mechanism: '转运体竞争' },
]

/** 功效维度映射 */
const EFFICACY_DIMENSIONS: Record<string, string[]> = {
  immunity: ['免疫增强', '免疫力', '抗病', '预防感冒', '提高免疫'],
  anti_fatigue: ['抗疲劳', '缓解疲劳', '提神', '增强体力', '精力'],
  anti_oxidant: ['抗氧化', '延缓衰老', '清除自由基', '抗氧化剂'],
  anti_aging: ['抗衰老', '延年益寿', '逆龄', '延缓衰老'],
  skin_health: ['皮肤健康', '美容', '护肤', '胶原蛋白', '美白'],
  gut_health: ['肠道健康', '消化', '肠胃', '益生菌', '肠道菌群'],
  cognition: ['健脑', '提高记忆力', '认知', '脑健康', '集中力'],
  liver_protect: ['保肝', '护肝', '解酒', '肝脏健康'],
  vision: ['视力', '护眼', '眼睛', '明目'],
  joint_health: ['关节', '骨骼', '骨关节', '关节健康'],
  anti_inflammatory: ['抗炎', '消炎', '炎症', '舒缓'],
  cardio_protect: ['心血管', '心脏', '血管', '降血压', '降血脂'],
  metabolism: ['代谢', '减肥', '体重管理', '降糖', '血糖'],
  adaptogen: ['抗应激', '适应原', '压力', '身心平衡'],
  vitality: ['活力', '生命力', '强身健体', '整体健康'],
}

/* ================================================================== */
/*  核心算法引擎                                                        */
/* ================================================================== */

export class FormulaDesignEngine {
  private ingredients: Map<string, IngredientProfile>
  private interactions: IngredientInteraction[]
  private interactionCache: Map<string, IngredientInteraction | null>

  constructor() {
    this.ingredients = new Map(Object.entries(INGREDIENT_DATABASE))
    this.interactions = INTERACTION_KNOWLEDGE
    this.interactionCache = new Map()
  }

  /* ================================================================ */
  /*  1. 成分查询                                                      */
  /* ================================================================ */

  /** 查询所有可用成分 */
  getAllIngredients(): IngredientProfile[] {
    return Array.from(this.ingredients.values())
  }

  /** 按功效查询成分 */
  findIngredientsByEffect(effect: string): IngredientProfile[] {
    const effectLower = effect.toLowerCase()
    const candidates: IngredientProfile[] = []

    for (const ingredient of this.ingredients.values()) {
      const matchesEffect = Object.entries(ingredient.efficacyVector)
        .some(([key, val]) => val > 0.5 && key.includes(effectLower))

      const matchesLabel = EFFICACY_DIMENSIONS[effectLower]
        ? EFFICACY_DIMENSIONS[effectLower].some(label =>
            effect.includes(label) || label.includes(effect)
          )
        : false

      if (matchesEffect || matchesLabel) {
        candidates.push(ingredient)
      }
    }

    // 按功效值排序
    return candidates.sort((a, b) => {
      const aScore = Object.entries(a.efficacyVector)
        .filter(([k]) => k.includes(effectLower))
        .reduce((s, [, v]) => s + v, 0)
      const bScore = Object.entries(b.efficacyVector)
        .filter(([k]) => k.includes(effectLower))
        .reduce((s, [, v]) => s + v, 0)
      return bScore - aScore
    })
  }

  /** 按关键词多维度搜索成分 */
  searchIngredients(query: string): IngredientProfile[] {
    const q = query.toLowerCase()
    return this.getAllIngredients().filter(ing =>
      ing.name.includes(q) ||
      ing.latinName?.toLowerCase().includes(q) ||
      ing.category.toLowerCase().includes(q) ||
      Object.keys(ing.efficacyVector).some(k => k.includes(q))
    )
  }

  /* ================================================================ */
  /*  2. 配伍分析                                                      */
  /* ================================================================ */

  /** 查询两个成分之间的交互 */
  getInteraction(ingA: string, ingB: string): IngredientInteraction | null {
    const key = [ingA, ingB].sort().join('::')
    if (this.interactionCache.has(key)) return this.interactionCache.get(key)!

    const interaction = this.interactions.find(
      i => (i.ingredientA === ingA && i.ingredientB === ingB) ||
           (i.ingredientA === ingB && i.ingredientB === ingA)
    ) || null

    this.interactionCache.set(key, interaction)
    return interaction
  }

  /** 分析一组成分的完整兼容性矩阵 */
  analyzeCompatibility(ingredientIds: string[]): FormulaCandidate['compatibilityMatrix'] {
    const matrix: FormulaCandidate['compatibilityMatrix'] = []

    for (let i = 0; i < ingredientIds.length; i++) {
      for (let j = i + 1; j < ingredientIds.length; j++) {
        const a = ingredientIds[i]
        const b = ingredientIds[j]
        const interaction = this.getInteraction(a, b)

        if (interaction) {
          matrix.push({
            pair: [a, b],
            interaction: interaction.type,
            score: interaction.type === 'synergy' ? interaction.strength
                 : interaction.type === 'additive' ? interaction.strength * 0.6
                 : interaction.type === 'antagonism' ? -interaction.strength
                 : -interaction.strength * 2,
            description: interaction.description,
          })
        } else {
          // 没有已知交互视为中性
          const aProf = this.ingredients.get(a)
          const bProf = this.ingredients.get(b)
          const neutralScore = (aProf && bProf)
            ? this.calculateTacitCompatibility(aProf, bProf)
            : 0

          matrix.push({
            pair: [a, b],
            interaction: neutralScore > 0 ? 'additive' : neutralScore < 0 ? 'antagonism' : 'additive',
            score: neutralScore,
            description: neutralScore > 0.15
              ? `${aProf!.name}与${bProf!.name}性质相合，可协同使用`
              : neutralScore < -0.1
                ? `${aProf!.name}与${bProf!.name}性质相异，谨慎配伍`
                : `${aProf!.name}与${bProf!.name}无已知相互作用，可安全配伍`,
          })
        }
      }
    }

    return matrix.sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
  }

  /** 计算隐式兼容性（基于四气五味归经） */
  private calculateTacitCompatibility(a: IngredientProfile, b: IngredientProfile): number {
    let score = 0
    // 四气匹配
    if (a.properties.nature && b.properties.nature) {
      const natureOrder = ['cold', 'cool', 'neutral', 'warm', 'hot']
      const aIdx = natureOrder.indexOf(a.properties.nature)
      const bIdx = natureOrder.indexOf(b.properties.nature)
      const diff = Math.abs(aIdx - bIdx)
      score += diff <= 1 ? 0.15 : diff >= 3 ? -0.2 : 0
    }
    // 归经互补
    const commonMeridians = a.properties.meridians?.filter(m => b.properties.meridians?.includes(m)) ?? []
    score += commonMeridians.length * FDE_MERIDIAN_BONUS
    // 五味调和
    const commonFlavors = a.properties.flavor?.filter(f => b.properties.flavor?.includes(f)) ?? []
    score += commonFlavors.length * FDE_FLAVOR_BONUS

    return Math.max(FDE_COMPAT_SCORE_MIN, Math.min(FDE_COMPAT_SCORE_MAX, score))
  }

  /* ================================================================ */
  /*  3. 评分系统                                                      */
  /* ================================================================ */

  /** 多维度评分 */
  calculateScores(
    formula: FormulaCandidate['ingredients'],
    weights: OptimizationWeights = FDE_DEFAULT_WEIGHTS
  ): { scores: Record<ScoreDimension, number>; overallScore: number } {
    // 功效评分
    const efficacyScore = this.calculateEfficacyScore(formula)
    // 安全性评分
    const safetyScore = this.calculateSafetyScore(formula)
    // 口感评分
    const tasteScore = this.calculateTasteScore(formula)
    // 稳定性评分
    const stabilityScore = this.calculateStabilityScore(formula)
    // 成本评分
    const rawCost = formula.reduce((sum, ing) => sum + ing.profile.costFactor * (ing.dosage / 10), 0)
    const costScore = Math.max(0, 1 - rawCost / formula.length)

    const scores: Record<ScoreDimension, number> = {
      efficacy: Math.round(efficacyScore * 100) / 100,
      safety: Math.round(safetyScore * 100) / 100,
      taste: Math.round(tasteScore * 100) / 100,
      stability: Math.round(stabilityScore * 100) / 100,
      cost: Math.round(costScore * 100) / 100,
    }

    const overallScore =
      scores.efficacy * weights.efficacy +
      scores.safety * weights.safety +
      scores.taste * weights.taste +
      scores.stability * weights.stability +
      scores.cost * weights.cost

    return { scores, overallScore: Math.round(overallScore * 100) / 100 }
  }

  private calculateEfficacyScore(ingredients: FormulaCandidate['ingredients']): number {
    if (ingredients.length === 0) return 0
    const avgEfficacy = ingredients.reduce((sum, ing) => {
      const vals = Object.values(ing.profile.efficacyVector)
      return sum + (vals.reduce((s, v) => s + v, 0) / vals.length)
    }, 0) / ingredients.length

    // 君药权重加成
    const junIngredients = ingredients.filter(i => i.role === 'jun')
    const junBonus = junIngredients.length > 0 ? 0.1 : 0

    return Math.min(1, avgEfficacy + junBonus)
  }

  private calculateSafetyScore(ingredients: FormulaCandidate['ingredients']): number {
    let score = 1
    for (const ing of ingredients) {
      const usageRatio = ing.dosage / ing.profile.safetyLimit
      if (usageRatio > 0.8) score -= 0.2
      else if (usageRatio > 0.6) score -= 0.1
      // 检查配伍禁忌
      for (const other of ingredients) {
        if (other.profile.id === ing.profile.id) continue
        const interaction = this.getInteraction(ing.profile.id, other.profile.id)
        if (interaction?.type === 'toxicity' || interaction?.type === 'incompatibility') {
          score -= 0.3
        }
      }
    }
    return Math.max(0.1, score)
  }

  private calculateTasteScore(ingredients: FormulaCandidate['ingredients']): number {
    if (ingredients.length === 0) return 0.5
    const avg = ingredients.reduce((s, i) => s + i.profile.tasteScore, 0) / ingredients.length
    // 苦味惩罚
    const bitterIngredients = ingredients.filter(i =>
      i.profile.properties.flavor?.includes('苦')
    )
    const bitterPenalty = bitterIngredients.length > 1 ? 0.1 * bitterIngredients.length : 0
    return Math.max(0.1, Math.min(1, avg - bitterPenalty))
  }

  private calculateStabilityScore(ingredients: FormulaCandidate['ingredients']): number {
    if (ingredients.length === 0) return 0.5
    return ingredients.reduce((s, i) => s + i.profile.stabilityScore, 0) / ingredients.length
  }

  /* ================================================================ */
  /*  4. 角色分配算法 — 基于中医君臣佐使理论                            */
  /* ================================================================ */

  assignRoles(ingredientIds: string[], targetEffects: string[]): Map<string, IngredientRole> {
    const roles = new Map<string, IngredientRole>()
    if (ingredientIds.length === 0) return roles

    const profiles = ingredientIds.map(id => this.ingredients.get(id)).filter(Boolean) as IngredientProfile[]

    // 匹配主功效最强的成分 → 君药
    const effectRelevance = profiles.map(p => ({
      id: p.id,
      relevance: Object.entries(p.efficacyVector)
        .filter(([key]) => targetEffects.some(te => key.includes(te) || te.includes(key)))
        .reduce((score, [, val]) => score + val, 0),
    }))

    effectRelevance.sort((a, b) => b.relevance - a.relevance)

    if (effectRelevance.length > 0) {
      roles.set(effectRelevance[0].id, 'jun')
    }
    if (effectRelevance.length > 1) {
      roles.set(effectRelevance[1].id, 'chen')
    }
    // 剩余成分按角色匹配度分配
    for (let i = 2; i < effectRelevance.length; i++) {
      const id = effectRelevance[i].id
      const profile = this.ingredients.get(id)!
      // 如果成分是shi角色或者无毒调和类 → 使药
      if (profile.roles.includes('shi') || profile.id === 'licorice') {
        roles.set(id, 'shi')
      } else {
        roles.set(id, 'zuo')
      }
    }

    return roles
  }

  /* ================================================================ */
  /*  5. 配方生成算法                                                    */
  /* ================================================================ */

  /**
   * 根据需求智能生成配方
   * 使用多目标优化策略
   */
  generateFormula(request: FormulaDesignRequest): FormulaCandidate {
    const { targetEffects, constraints } = request
    const maxIngredients = constraints?.maxIngredients ?? 6

    // 5.1 根据目标功效筛选候选成分
    const candidates = new Set<string>()
    for (const effect of targetEffects) {
      const matches = this.findIngredientsByEffect(effect)
      matches.forEach(m => candidates.add(m.id))
    }

    // 5.2 排除禁忌成分
    if (constraints?.avoidIngredients) {
      constraints.avoidIngredients.forEach(id => candidates.delete(id))
    }

    let selectedIds = Array.from(candidates)

    // 5.3 智能筛选：如果候选太多，优先选择功效向量覆盖最广的
    if (selectedIds.length > maxIngredients * 2) {
      const scored = selectedIds.map(id => {
        const prof = this.ingredients.get(id)!
        const effectCoverage = targetEffects.reduce((score, effect) => {
          const matches = Object.entries(prof.efficacyVector)
            .filter(([key]) => key.includes(effect) || effect.includes(key))
          return score + matches.reduce((s, [, v]) => s + v, 0)
        }, 0)
        return { id, score: effectCoverage }
      })
      scored.sort((a, b) => b.score - a.score)
      selectedIds = scored.slice(0, maxIngredients * 2).map(s => s.id)
    }

    // 5.4 智能组合优化：迭代寻找最佳组合
    const selectedProfiles = selectedIds.map(id => this.ingredients.get(id)!).filter(Boolean)
    let bestScore = -Infinity

    // 简化组合搜索（实际应用中应使用遗传算法/模拟退火）
    const combinationSize = Math.min(maxIngredients, selectedProfiles.length)

    // 贪心选择：逐个添加最优成分
    const chosen: string[] = []
    const remaining = new Set(selectedIds)

    // 第一个选功效覆盖最广的
    while (chosen.length < combinationSize && remaining.size > 0) {
      let best = ''
      let bestGain = -Infinity

      for (const candidateId of remaining) {
        const testSet = [...chosen, candidateId]
        const testCombination = testSet.map(id => ({
          profile: this.ingredients.get(id)!,
          dosage: this.suggestDosage(this.ingredients.get(id)!, 'chen'),
          role: 'chen' as IngredientRole,
          rationale: '',
        }))
        const { overallScore } = this.calculateScores(testCombination)
        // 加上兼容性评分
        const compatMatrix = this.analyzeCompatibility(testSet)
        const compatScore = compatMatrix.reduce((s, item) => s + item.score, 0) / Math.max(1, compatMatrix.length)
        const gain = overallScore * 0.7 + compatScore * 0.3

        if (gain > bestGain) {
          bestGain = gain
          best = candidateId
        }
      }

      if (best) {
        chosen.push(best)
        remaining.delete(best)
        // 如果最佳分数远低于组合，停止添加
        if (bestGain < bestScore - 0.3 && chosen.length >= 3) break
        bestScore = bestGain
      } else {
        break
      }
    }

    // 5.5 角色分配
    const roleMap = this.assignRoles(chosen, targetEffects)

    // 5.6 用量建议
    const ingredients = chosen.map(id => {
      const profile = this.ingredients.get(id)!
      const role = roleMap.get(id) || 'zuo'
      const dosage = this.suggestDosage(profile, role)
      return {
        profile,
        dosage,
        role,
        rationale: this.generateRationale(profile, role, targetEffects),
      }
    })

    // 5.7 兼容性分析
    const compatibilityMatrix = this.analyzeCompatibility(chosen)

    // 5.8 评分
    const { scores, overallScore } = this.calculateScores(ingredients)

    // 5.9 配方命名
    const name = this.generateFormulaName(ingredients, targetEffects)

    return {
      id: `formula_${Date.now()}`,
      name,
      ingredients,
      scores,
      overallScore,
      compatibilityMatrix,
    }
  }

  /** 智能用量建议 */
  private suggestDosage(profile: IngredientProfile, role: IngredientRole): number {
    const [min, max] = profile.dosageRange
    const range = max - min

    switch (role) {
      case 'jun':  return Math.round((min + range * 0.75) * 10) / 10
      case 'chen': return Math.round((min + range * 0.5) * 10) / 10
      case 'zuo':  return Math.round((min + range * 0.35) * 10) / 10
      case 'shi':  return Math.round((min + range * 0.25) * 10) / 10
    }
  }

  /** 智能配伍理由生成 */
  private generateRationale(profile: IngredientProfile, role: IngredientRole, effects: string[]): string {
    const roleLabels: Record<IngredientRole, string> = {
      jun: '君药 — 针对主功效的核心成分',
      chen: '臣药 — 辅助君药增强功效',
      zuo: '佐药 — 制约毒性/辅助治疗',
      shi: '使药 — 调和诸药/引经',
    }

    const effectDesc = Object.entries(profile.efficacyVector)
      .filter(([key]) => effects.some(e => key.includes(e)))
      .map(([key, val]) => `${key}(${Math.round(val * 100)}%)`)
      .join(', ')

    return `${roleLabels[role]}。${profile.name}功效特性：${effectDesc || '多维度健康支持'}。`
  }

  /** 智能配方命名 */
  private generateFormulaName(ingredients: FormulaCandidate['ingredients'], effects: string[]): string {
    const junIngredient = ingredients.find(i => i.role === 'jun')
    const chenIngredient = ingredients.find(i => i.role === 'chen')
    const effectLabel = effects.length > 0 ? effects[0] : '综合调理'

    const prefix = junIngredient ? junIngredient.profile.name : ''
    const suffix = chenIngredient ? chenIngredient.profile.name : ''

  if (prefix && suffix) {
      return `${prefix}${suffix}${effectLabel}配方`
    }
    return `${effectLabel}优化配方 v1`
  }

  /* ================================================================ */
  /*  6. 配方优化算法 — Pareto 多目标优化                               */
  /* ================================================================ */

  /**
   * 配方迭代优化
   * 通过调整用量和成分组合，寻找 Pareto 最优解
   */
  optimizeFormula(
    baseFormula: FormulaCandidate,
    iterations: number = 3
  ): FormulaCandidate[] {
    const paretoFront: FormulaCandidate[] = [baseFormula]

    for (let i = 0; i < iterations; i++) {
      const current = paretoFront[paretoFront.length - 1]

      // 生成变体：微调用量
      const variant1 = this.createDosageVariant(current, 0.9)
      const variant2 = this.createDosageVariant(current, 1.1)

      for (const variant of [variant1, variant2].filter(Boolean)) {
        if (variant) {
          // Pareto 支配检查
          const dominated = paretoFront.some(existing =>
            Object.keys(existing.scores).every(
              dim => existing.scores[dim as ScoreDimension] >= variant.scores[dim as ScoreDimension]
            ) &&
            Object.keys(existing.scores).some(
              dim => existing.scores[dim as ScoreDimension] > variant.scores[dim as ScoreDimension]
            )
          )
          if (!dominated) {
            variant.optimizationHistory = [
              ...(current.optimizationHistory || []),
              {
                iteration: i + 1,
                scores: { ...variant.scores },
                changes: `调整用量至 ${(i === 0 ? '90%' : '110%')}`,
              },
            ]
            paretoFront.push(variant)
          }
        }
      }
    }

    return paretoFront.sort((a, b) => b.overallScore - a.overallScore)
  }

  private createDosageVariant(
    base: FormulaCandidate,
    factor: number
  ): FormulaCandidate | null {
    const newIngredients = base.ingredients.map(ing => ({
      profile: ing.profile,
      dosage: Math.round(Math.min(ing.profile.safetyLimit, Math.max(
        ing.profile.dosageRange[0], ing.dosage * factor
      )) * 10) / 10,
      role: ing.role,
      rationale: ing.rationale,
    }))

    const { scores, overallScore } = this.calculateScores(newIngredients)
    const compatibilityMatrix = this.analyzeCompatibility(
      newIngredients.map(i => i.profile.id)
    )

    if (overallScore <= base.overallScore) return null

    return {
      ...base,
      id: `formula_opt_${Date.now()}`,
      ingredients: newIngredients,
      scores,
      overallScore,
      compatibilityMatrix,
    }
  }

  /* ================================================================ */
  /*  7. 结构化输出 — 转换为 Content Block 数据                         */
  /* ================================================================ */

  /**
   * 将配方结果转换为结构化内容块
   * 供 StructuredMessageRenderer 渲染
   */
  toStructuredBlocks(formula: FormulaCandidate) {
    const blocks: Array<{ type: string; data: any }> = []

    // 7.1 标题块
    blocks.push({
      type: 'header',
      data: {
        title: `🧪 ${formula.name}`,
        description: `综合评分 ${Math.round(formula.overallScore * 100)}分 | 由 FormulaDesignEngine v1.0 智能生成`,
        level: 1,
        metadata: [
          { label: '成分数', value: `${formula.ingredients.length} 味` },
          { label: '综合评分', value: `${Math.round(formula.overallScore * 100)}` },
          { label: '优化迭代', value: `${formula.optimizationHistory?.length || 1} 轮` },
        ],
      },
    })

    // 7.2 KPI 指标块
    blocks.push({
      type: 'metrics',
      data: {
        title: '多维评分',
        items: [
          { label: '功效', value: Math.round(formula.scores.efficacy * 100), unit: '分', trend: 'up', color: 'text-primary-700' },
          { label: '安全', value: Math.round(formula.scores.safety * 100), unit: '分', trend: 'up', color: 'text-primary-700' },
          { label: '口感', value: Math.round(formula.scores.taste * 100), unit: '分', trend: formula.scores.taste > 0.6 ? 'up' : 'stable', color: 'text-warning-600' },
          { label: '稳定', value: Math.round(formula.scores.stability * 100), unit: '分', trend: 'up', color: 'text-secondary-600' },
          { label: '成本', value: Math.round(formula.scores.cost * 100), unit: '分', trend: formula.scores.cost > 0.6 ? 'up' : 'down', color: 'text-accent-600' },
        ],
      },
    })

    // 7.3 成分表
    blocks.push({
      type: 'data-table',
      data: {
        title: '配方组成（君臣佐使）',
        columns: [
          { key: 'role', label: '角色', type: 'tag' },
          { key: 'name', label: '成分' },
          { key: 'dosage', label: '用量(g)', type: 'number', align: 'right' },
          { key: 'efficacy', label: '功效评分', type: 'percentage', align: 'center' },
          { key: 'rationale', label: '配伍理由' },
        ],
        rows: formula.ingredients.map(ing => ({
          role: this.getRoleLabel(ing.role),
          name: ing.profile.name,
          dosage: ing.dosage,
          efficacy: Object.values(ing.profile.efficacyVector).reduce((s, v) => s + v, 0) / Math.max(1, Object.keys(ing.profile.efficacyVector).length),
          rationale: ing.rationale.split('。')[0],
        })),
        summary: `共 ${formula.ingredients.length} 味成分，遵循君臣佐使配伍原则`,
      },
    })

    // 7.4 兼容性分析列表
    const synergyCount = formula.compatibilityMatrix.filter(m => m.interaction === 'synergy').length
    const warningCount = formula.compatibilityMatrix.filter(m => m.interaction === 'antagonism' || m.interaction === 'toxicity').length

    blocks.push({
      type: 'list',
      data: {
        title: `配伍分析（${synergyCount}项协同 · ${warningCount}项注意）`,
        variant: 'analysis' as const,
        items: formula.compatibilityMatrix.slice(0, 8).map(item => {
          const getLabel = (id: string) => this.ingredients.get(id)?.name || id
          return {
            label: `${getLabel(item.pair[0])} + ${getLabel(item.pair[1])}`,
            description: item.description,
            status: item.interaction === 'synergy' ? 'positive'
                  : item.interaction === 'additive' ? 'info'
                  : 'negative',
          }
        }),
      },
    })

    // 7.5 优化历史
    if (formula.optimizationHistory && formula.optimizationHistory.length > 0) {
      blocks.push({
        type: 'data-table',
        data: {
          title: '优化迭代记录',
          columns: [
            { key: 'iteration', label: '轮次', type: 'number' },
            { key: 'efficacy', label: '功效', type: 'percentage', align: 'center' },
            { key: 'safety', label: '安全', type: 'percentage', align: 'center' },
            { key: 'taste', label: '口感', type: 'percentage', align: 'center' },
            { key: 'overall', label: '综合', type: 'percentage', align: 'center' },
            { key: 'changes', label: '调整' },
          ],
          rows: formula.optimizationHistory.map(h => ({
            iteration: h.iteration,
            efficacy: h.scores.efficacy,
            safety: h.scores.safety,
            taste: h.scores.taste,
            overall: (h.scores.efficacy + h.scores.safety + h.scores.taste + h.scores.stability + h.scores.cost) / 5,
            changes: h.changes,
          })),
        },
      })
    }

    // 7.6 总结 Callout
    blocks.push({
      type: 'callout',
      data: {
        variant: 'summary' as const,
        title: '配方设计说明',
        content: `本配方由 AI 智能设计引擎基于 ${formula.ingredients.map(i => i.profile.name).join('、')} 等${formula.ingredients.length}味成分优化组合而成。${formula.scores.safety >= 0.7 ? '安全性评估通过，' : '建议在专业指导下使用。'}${formula.scores.cost > 0.6 ? '成本控制合理。' : '成本偏高，可考虑替代原料。'}`,
        details: [
          '推荐用法：每日 1-2 次，温水冲服',
          '禁忌人群：孕妇、哺乳期妇女及儿童慎用',
          '储存条件：阴凉干燥处密封保存',
          `参考文献：${formula.ingredients.flatMap(i => i.profile.references).slice(0, 4).join('、')}`,
        ],
      },
    })

    return blocks
  }

  private getRoleLabel(role: IngredientRole): string {
    const labels: Record<IngredientRole, string> = {
      jun: '君药', chen: '臣药', zuo: '佐药', shi: '使药',
    }
    return labels[role]
  }
}

/** 单例导出 */
export const formulaDesignEngine = new FormulaDesignEngine()

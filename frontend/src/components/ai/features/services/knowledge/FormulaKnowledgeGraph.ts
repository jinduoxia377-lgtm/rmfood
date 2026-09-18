/**
 * FormulaKnowledgeGraph — 食品配方知识图谱 v2.0
 *
 * 基于图数据库思维的知识表示系统：
 * - 节点：Ingredient (成分), Effect (功效), Category (分类), Reference (文献)
 * - 边：HAS_EFFECT, INTERACTS_WITH, BELONGS_TO, REFERENCES, SIMILAR_TO
 * - 算法：BFS传播, 最短路径替代, 向量相似度匹配, 子图查询
 *
 * 设计原则：
 * 1. 所有数据通过图谱关系连接，支持复杂推理查询
 * 2. 每个关系带置信度和证据引用
 * 3. 支持增量知识加载和验证
 */

import { logger } from '@/utils/safeLogger'

/* ================================================================== */
/*  基础类型定义                                                        */
/* ================================================================== */

export enum NodeType {
  INGREDIENT = 'ingredient',
  EFFECT = 'effect',
  CATEGORY = 'category',
  REFERENCE = 'reference',
  DISEASE = 'disease',
  SYMPTOM = 'symptom',
}

export enum EdgeType {
  HAS_EFFECT = 'has_effect',           // 成分→功效 (带强度)
  INTERACTS_WITH = 'interacts_with',   // 成分→成分 (带类型)
  BELONGS_TO = 'belongs_to',          // 成分→分类
  REFERENCES = 'references',          // 任何节点→文献
  SIMILAR_TO = 'similar_to',          // 成分→成分 (相似替代)
  CONTRADICTS = 'contradicts',        // 成分→成分 (禁忌)
  TREATS = 'treats',                  // 功效→症状/疾病
  ENHANCES = 'enhances',              // 成分→成分 (协同增强)
}

export type InteractionClass =
  | 'strong_synergy'    // 强协同 (≥0.8)
  | 'moderate_synergy'  // 中度协同 (0.6-0.8)
  | 'additive'          // 相加 (0.4-0.6)
  | 'neutral'           // 中性 (0.2-0.4)
  | 'mild_antagonism'   // 轻度拮抗 (0-0.2)
  | 'strong_antagonism' // 强拮抗 (<0)
  | 'contraindication'  // 禁忌

/* ================================================================== */
/*  核心图谱数据结构                                                    */
/* ================================================================== */

export interface GraphNode<T = any> {
  id: string
  type: NodeType
  label: string             // 显示名
  aliases?: string[]        // 别名/同义词
  description?: string
  properties: T
  metadata: {
    created: number
    updated: number
    source: string
    confidence: number       // 0-1 数据置信度
    version: string
  }
}

export interface GraphEdge {
  id: string
  sourceId: string
  targetId: string
  type: EdgeType
  weight: number            // 0-1 强度/相似度
  confidence: number        // 0-1 置信度
  evidence?: string[]       // 证据引用
  properties?: Record<string, any>
  metadata: {
    created: number
    source: string
  }
}

export interface GraphQuery {
  startNodes?: string[]
  edgeTypes?: EdgeType[]
  maxDepth?: number
  filters?: {
    nodeType?: NodeType[]
    minConfidence?: number
    minWeight?: number
  }
}

export interface PathResult {
  nodes: GraphNode[]
  edges: GraphEdge[]
  totalWeight: number
  hops: number
}

/* ================================================================== */
/*  预置节点数据                                                        */
/* ================================================================== */

const PRESET_INGREDIENTS: GraphNode<{
  nature: string
  flavor: string[]
  meridians: string[]
  dosageRange: [number, number]
  safetyLimit: number
  toxicity: 'none' | 'low' | 'moderate' | 'high'
  bioavailability: number
  halfLife?: number
  solubility?: 'water' | 'lipid' | 'both'
  quality_markers: string[]
}>[] = [
  { id: 'astragalus', type: NodeType.INGREDIENT, label: '黄芪', aliases: ['黄耆', '北芪', 'Astragalus membranaceus'], description: '豆科植物蒙古黄芪的根', properties: { nature: 'warm', flavor: ['甘'], meridians: ['脾', '肺'], dosageRange: [9, 30], safetyLimit: 60, toxicity: 'none', bioavailability: 0.35, quality_markers: ['黄芪多糖≥50%', '黄芪甲苷≥0.04%'] }, metadata: { created: 20240101, updated: 20250601, source: '中国药典2025', confidence: 0.95, version: '1.0' } },
  { id: 'angelica', type: NodeType.INGREDIENT, label: '当归', aliases: ['秦归', 'Angelica sinensis'], description: '伞形科植物当归的根', properties: { nature: 'warm', flavor: ['甘', '辛'], meridians: ['肝', '心', '脾'], dosageRange: [6, 15], safetyLimit: 30, toxicity: 'low', bioavailability: 0.4, quality_markers: ['阿魏酸≥0.05%', '藁本内酯≥0.5%'] }, metadata: { created: 20240101, updated: 20250601, source: '中国药典2025', confidence: 0.95, version: '1.0' } },
  { id: 'ginseng', type: NodeType.INGREDIENT, label: '人参', aliases: ['野山参', 'Panax ginseng'], description: '五加科植物人参的根', properties: { nature: 'warm', flavor: ['甘', '微苦'], meridians: ['脾', '肺', '心', '肾'], dosageRange: [3, 9], safetyLimit: 15, toxicity: 'low', bioavailability: 0.3, quality_markers: ['人参皂苷Rg1≥0.3%', '人参皂苷Re≥0.3%'] }, metadata: { created: 20240101, updated: 20250601, source: '中国药典2025', confidence: 0.95, version: '1.0' } },
  { id: 'schisandra', type: NodeType.INGREDIENT, label: '五味子', aliases: ['北五味子', 'Schisandra chinensis'], description: '五味子科植物五味子的干燥成熟果实', properties: { nature: 'warm', flavor: ['酸', '甘'], meridians: ['肺', '心', '肾'], dosageRange: [3, 9], safetyLimit: 15, toxicity: 'none', bioavailability: 0.45, quality_markers: ['五味子醇甲≥0.4%'] }, metadata: { created: 20240101, updated: 20250601, source: '中国药典2025', confidence: 0.95, version: '1.0' } },
  { id: 'licorice', type: NodeType.INGREDIENT, label: '甘草', aliases: ['国老', 'Glycyrrhiza uralensis'], description: '豆科植物甘草的根及根茎', properties: { nature: 'neutral', flavor: ['甘'], meridians: ['心', '肺', '脾', '胃'], dosageRange: [2, 9], safetyLimit: 12, toxicity: 'none', bioavailability: 0.5, quality_markers: ['甘草酸≥2.0%', '甘草苷≥0.5%'] }, metadata: { created: 20240101, updated: 20250601, source: '中国药典2025', confidence: 0.95, version: '1.0' } },
  { id: 'goji', type: NodeType.INGREDIENT, label: '枸杞子', aliases: ['枸杞', 'Lycium barbarum'], description: '茄科植物宁夏枸杞的干燥成熟果实', properties: { nature: 'neutral', flavor: ['甘'], meridians: ['肝', '肾'], dosageRange: [6, 15], safetyLimit: 30, toxicity: 'none', bioavailability: 0.5, quality_markers: ['枸杞多糖≥50%'] }, metadata: { created: 20240101, updated: 20250601, source: '中国药典2025', confidence: 0.95, version: '1.0' } },
  { id: 'dang_shen', type: NodeType.INGREDIENT, label: '党参', aliases: ['Codonopsis pilosula'], description: '桔梗科植物党参的根', properties: { nature: 'neutral', flavor: ['甘'], meridians: ['脾', '肺'], dosageRange: [9, 30], safetyLimit: 60, toxicity: 'none', bioavailability: 0.4, quality_markers: ['党参多糖≥20%'] }, metadata: { created: 20240101, updated: 20250601, source: '中国药典2025', confidence: 0.9, version: '1.0' } },
  { id: 'tumeric', type: NodeType.INGREDIENT, label: '姜黄', aliases: ['Curcuma longa', '姜黄素'], description: '姜科植物姜黄的根茎', properties: { nature: 'warm', flavor: ['辛', '苦'], meridians: ['脾', '肝'], dosageRange: [3, 9], safetyLimit: 12, toxicity: 'low', bioavailability: 0.05, solubility: 'lipid', quality_markers: ['姜黄素≥2.0%'] }, metadata: { created: 20240101, updated: 20250601, source: '中国药典2025', confidence: 0.9, version: '1.0' } },
  { id: 'collagen_peptide', type: NodeType.INGREDIENT, label: '胶原蛋白肽', aliases: ['水解胶原蛋白', '胶原肽'], description: '以动物骨骼/皮肤为原料经酶解制备的小分子肽', properties: { nature: 'neutral', flavor: ['甘'], meridians: [], dosageRange: [3, 10], safetyLimit: 20, toxicity: 'none', bioavailability: 0.85, solubility: 'water', quality_markers: ['肽含量≥90%', '分子量<3000Da'] }, metadata: { created: 20240101, updated: 20250601, source: 'GB/T 22729', confidence: 0.9, version: '1.0' } },
  { id: 'soy_peptide', type: NodeType.INGREDIENT, label: '大豆肽', aliases: ['大豆寡肽'], description: '大豆蛋白经酶解制备的小分子肽混合物', properties: { nature: 'neutral', flavor: ['甘'], meridians: [], dosageRange: [5, 15], safetyLimit: 30, toxicity: 'none', bioavailability: 0.9, solubility: 'water', quality_markers: ['肽含量≥85%', '分子量<1000Da≥50%'] }, metadata: { created: 20240101, updated: 20250601, source: 'GB/T 22492', confidence: 0.85, version: '1.0' } },
  { id: 'inulin', type: NodeType.INGREDIENT, label: '菊粉', aliases: ['菊糖', 'Fructan'], description: '菊芋根茎中提取的果聚糖', properties: { nature: 'neutral', flavor: ['甘'], meridians: [], dosageRange: [5, 15], safetyLimit: 30, toxicity: 'none', bioavailability: 0.2, solubility: 'water', quality_markers: ['菊粉含量≥90%', '聚合度≥10'] }, metadata: { created: 20240101, updated: 20250601, source: 'GB 25533', confidence: 0.9, version: '1.0' } },
  { id: 'vitamin_c', type: NodeType.INGREDIENT, label: '维生素C', aliases: ['抗坏血酸', 'VC', 'Ascorbic acid'], description: '水溶性维生素，强抗氧化剂', properties: { nature: 'cool', flavor: ['酸'], meridians: [], dosageRange: [0.1, 0.5], safetyLimit: 2, toxicity: 'none', bioavailability: 0.7, solubility: 'water', quality_markers: ['含量≥99%'] }, metadata: { created: 20240101, updated: 20250601, source: 'GB 14754', confidence: 0.95, version: '1.0' } },
  { id: 'zinc', type: NodeType.INGREDIENT, label: '锌', aliases: ['Zn', '葡萄糖酸锌'], description: '人体必需微量元素', properties: { nature: 'neutral', flavor: [], meridians: [], dosageRange: [0.005, 0.015], safetyLimit: 0.04, toxicity: 'low', bioavailability: 0.3, solubility: 'water', quality_markers: ['锌含量≥99%'] }, metadata: { created: 20240101, updated: 20250601, source: 'GB 25579', confidence: 0.95, version: '1.0' } },
  { id: 'astaxanthin', type: NodeType.INGREDIENT, label: '虾青素', aliases: ['Astaxanthin', '虾红素'], description: '天然类胡萝卜素，超强抗氧化剂', properties: { nature: 'cool', flavor: [], meridians: [], dosageRange: [0.004, 0.012], safetyLimit: 0.024, toxicity: 'none', bioavailability: 0.15, solubility: 'lipid', quality_markers: ['虾青素含量≥5%', '全反式≥70%'] }, metadata: { created: 20240101, updated: 20250601, source: 'GB 26405', confidence: 0.85, version: '1.0' } },
  { id: 'probiotic_blend', type: NodeType.INGREDIENT, label: '复合益生菌', aliases: ['Probiotics', '乳酸菌'], description: '多种益生菌菌株复合制剂', properties: { nature: 'neutral', flavor: [], meridians: [], dosageRange: [1, 5], safetyLimit: 10, toxicity: 'none', bioavailability: 0.1, quality_markers: ['活菌数≥10^10CFU/g'] }, metadata: { created: 20240101, updated: 20250601, source: 'GB 19302', confidence: 0.85, version: '1.0' } },
  { id: 'reishi', type: NodeType.INGREDIENT, label: '灵芝', aliases: ['赤芝', 'Ganoderma lucidum'], description: '多孔菌科真菌灵芝的子实体', properties: { nature: 'neutral', flavor: ['甘'], meridians: ['心', '肺', '肝', '肾'], dosageRange: [6, 15], safetyLimit: 30, toxicity: 'none', bioavailability: 0.3, quality_markers: ['灵芝多糖≥30%', '三萜≥1%'] }, metadata: { created: 20240101, updated: 20250601, source: '中国药典2025', confidence: 0.9, version: '1.0' } },
  { id: 'cordyceps', type: NodeType.INGREDIENT, label: '冬虫夏草', aliases: ['虫草', 'Cordyceps sinensis'], description: '麦角菌科真菌冬虫夏草菌的子座和幼虫尸体的干燥复合体', properties: { nature: 'neutral', flavor: ['甘'], meridians: ['肺', '肾'], dosageRange: [3, 9], safetyLimit: 15, toxicity: 'none', bioavailability: 0.35, quality_markers: ['腺苷≥0.01%'] }, metadata: { created: 20240101, updated: 20250601, source: '中国药典2025', confidence: 0.85, version: '1.0' } },
  { id: 'hawthorn', type: NodeType.INGREDIENT, label: '山楂', aliases: ['Crataegus pinnatifida'], description: '蔷薇科植物山楂的干燥成熟果实', properties: { nature: 'warm', flavor: ['酸', '甘'], meridians: ['脾', '胃', '肝'], dosageRange: [9, 15], safetyLimit: 30, toxicity: 'none', bioavailability: 0.5, quality_markers: ['山楂酸≥0.5%'] }, metadata: { created: 20240101, updated: 20250601, source: '中国药典2025', confidence: 0.9, version: '1.0' } },
]

const PRESET_EFFECTS: GraphNode<{ category: string; measurable: boolean; unit?: string }>[] = [
  { id: 'immunity', type: NodeType.EFFECT, label: '免疫增强', description: '增强机体免疫功能', properties: { category: 'physiological', measurable: true, unit: 'IgG mg/dL' }, metadata: { created: 20240101, updated: 20250601, source: 'expert', confidence: 0.95, version: '1.0' } },
  { id: 'anti_fatigue', type: NodeType.EFFECT, label: '抗疲劳', description: '缓解体力疲劳', properties: { category: 'physiological', measurable: true, unit: '运动耐量 min' }, metadata: { created: 20240101, updated: 20250601, source: 'expert', confidence: 0.9, version: '1.0' } },
  { id: 'anti_oxidant', type: NodeType.EFFECT, label: '抗氧化', description: '清除自由基，延缓氧化损伤', properties: { category: 'biochemical', measurable: true, unit: 'SOD U/mg' }, metadata: { created: 20240101, updated: 20250601, source: 'expert', confidence: 0.95, version: '1.0' } },
  { id: 'anti_aging', type: NodeType.EFFECT, label: '抗衰老', description: '延缓衰老进程', properties: { category: 'physiological', measurable: true, unit: 'telomere length' }, metadata: { created: 20240101, updated: 20250601, source: 'expert', confidence: 0.85, version: '1.0' } },
  { id: 'skin_health', type: NodeType.EFFECT, label: '皮肤健康', description: '改善皮肤状态，促进皮肤健康', properties: { category: 'dermatological', measurable: true, unit: '皮肤弹性系数' }, metadata: { created: 20240101, updated: 20250601, source: 'expert', confidence: 0.9, version: '1.0' } },
  { id: 'gut_health', type: NodeType.EFFECT, label: '肠道健康', description: '调节肠道菌群，改善消化功能', properties: { category: 'gastrointestinal', measurable: true, unit: '菌群多样性指数' }, metadata: { created: 20240101, updated: 20250601, source: 'expert', confidence: 0.9, version: '1.0' } },
  { id: 'liver_protect', type: NodeType.EFFECT, label: '保肝护肝', description: '保护肝脏功能，促进肝细胞修复', properties: { category: 'hepatic', measurable: true, unit: 'ALT U/L' }, metadata: { created: 20240101, updated: 20250601, source: 'expert', confidence: 0.9, version: '1.0' } },
  { id: 'cognition', type: NodeType.EFFECT, label: '健脑益智', description: '改善认知功能和记忆力', properties: { category: 'neurological', measurable: true, unit: 'MMSE score' }, metadata: { created: 20240101, updated: 20250601, source: 'expert', confidence: 0.85, version: '1.0' } },
  { id: 'cardio_protect', type: NodeType.EFFECT, label: '心血管保护', description: '保护心血管系统健康', properties: { category: 'cardiovascular', measurable: true, unit: 'LDL mmol/L' }, metadata: { created: 20240101, updated: 20250601, source: 'expert', confidence: 0.9, version: '1.0' } },
  { id: 'anti_inflammatory', type: NodeType.EFFECT, label: '抗炎', description: '减轻炎症反应', properties: { category: 'biochemical', measurable: true, unit: 'CRP mg/L' }, metadata: { created: 20240101, updated: 20250601, source: 'expert', confidence: 0.9, version: '1.0' } },
  { id: 'vision', type: NodeType.EFFECT, label: '明目', description: '改善视力功能', properties: { category: 'ophthalmic', measurable: true, unit: '视力表' }, metadata: { created: 20240101, updated: 20250601, source: 'expert', confidence: 0.85, version: '1.0' } },
  { id: 'joint_health', type: NodeType.EFFECT, label: '关节健康', description: '维护关节功能与软骨健康', properties: { category: 'musculoskeletal', measurable: true, unit: 'WOMAC score' }, metadata: { created: 20240101, updated: 20250601, source: 'expert', confidence: 0.85, version: '1.0' } },
  { id: 'vitality', type: NodeType.EFFECT, label: '提升活力', description: '增强整体生命活力', properties: { category: 'physiological', measurable: true, unit: 'SF-36 score' }, metadata: { created: 20240101, updated: 20250601, source: 'expert', confidence: 0.85, version: '1.0' } },
  { id: 'sleep', type: NodeType.EFFECT, label: '改善睡眠', description: '改善睡眠质量', properties: { category: 'neurological', measurable: true, unit: 'PSQI score' }, metadata: { created: 20240101, updated: 20250601, source: 'expert', confidence: 0.8, version: '1.0' } },
]

/* ================================================================== */
/*  知识图谱主类                                                        */
/* ================================================================== */

export class FormulaKnowledgeGraph {
  private nodes: Map<string, GraphNode>
  private edges: Map<string, GraphEdge[]>
  private adjacencyList: Map<string, Map<string, GraphEdge[]>>

  constructor() {
    this.nodes = new Map()
    this.edges = new Map()
    this.adjacencyList = new Map()
    this.initializePresets()
  }

  /* ================================================================ */
  /*  初始化                                                            */
  /* ================================================================ */

  private initializePresets(): void {
    // 加载预置节点
    for (const node of [...PRESET_INGREDIENTS, ...PRESET_EFFECTS]) {
      this.addNode(node)
    }

    // 构建功效边 (ingredient → effect)
    const effectEdges: Record<string, [string, number, string[]][]> = {
      astragalus: [['immunity', 0.92, ['黄芪多糖免疫调节']], ['anti_fatigue', 0.85, ['黄芪抗疲劳研究']], ['anti_aging', 0.78, []], ['cardio_protect', 0.82, []]],
      angelica: [['blood_nourish', 0.9, []], ['anti_inflammatory', 0.75, []], ['anti_oxidant', 0.8, []], ['immunity', 0.7, []]],
      ginseng: [['vitality', 0.95, ['人参皂苷抗疲劳']], ['cognition', 0.88, ['人参皂苷Rg1促认知']], ['immunity', 0.85, []], ['anti_fatigue', 0.9, []], ['sleep', 0.65, []]],
      schisandra: [['liver_protect', 0.88, ['五味子木脂素保肝']], ['anti_oxidant', 0.85, []], ['cognition', 0.75, []], ['sleep', 0.7, []]],
      licorice: [['anti_inflammatory', 0.8, ['甘草酸抗炎机制']], ['immunity', 0.7, []], ['gut_health', 0.55, []]],
      goji: [['vision', 0.85, ['枸杞多糖对视网膜保护']], ['immunity', 0.8, []], ['anti_aging', 0.82, []], ['anti_oxidant', 0.88, []]],
      tumeric: [['anti_inflammatory', 0.95, ['姜黄素抗炎多通路']], ['anti_oxidant', 0.9, []], ['joint_health', 0.85, []], ['cognition', 0.78, ['姜黄素阿尔茨海默症']], ['liver_protect', 0.7, []]],
      collagen_peptide: [['skin_health', 0.9, ['胶原肽皮肤弹性改善']], ['joint_health', 0.85, []], ['anti_aging', 0.82, []]],
      soy_peptide: [['anti_fatigue', 0.8, []], ['immunity', 0.78, []], ['vitality', 0.75, []]],
      inulin: [['gut_health', 0.9, ['菊粉益生元特性']], ['metabolism', 0.75, []], ['immunity', 0.6, []]],
      vitamin_c: [['anti_oxidant', 0.95, ['维生素C抗氧化经典']], ['immunity', 0.85, []], ['skin_health', 0.88, []], ['anti_fatigue', 0.7, []]],
      zinc: [['immunity', 0.85, ['锌免疫调节']], ['vision', 0.7, []], ['skin_health', 0.6, []]],
      astaxanthin: [['anti_oxidant', 0.98, ['虾青素抗氧化活性']], ['anti_aging', 0.9, []], ['vision', 0.82, []], ['skin_health', 0.85, []], ['anti_inflammatory', 0.8, []], ['cardio_protect', 0.75, []]],
      probiotic_blend: [['gut_health', 0.95, ['益生菌肠道功效']], ['immunity', 0.82, []], ['metabolism', 0.7, []]],
      reishi: [['immunity', 0.88, ['灵芝多糖免疫调节']], ['anti_fatigue', 0.8, []], ['sleep', 0.75, ['灵芝安神作用']], ['cardio_protect', 0.72, []], ['anti_oxidant', 0.78, []]],
      cordyceps: [['anti_fatigue', 0.9, ['虫草抗疲劳研究']], ['immunity', 0.82, []], ['vitality', 0.85, []], ['kidney_protect', 0.75, []], ['lung_health', 0.8, []]],
      hawthorn: [['cardio_protect', 0.85, ['山楂心血管保护']], ['digestion', 0.82, []], ['metabolism', 0.75, []], ['anti_oxidant', 0.7, []]],
      dang_shen: [['immunity', 0.82, []], ['anti_fatigue', 0.8, []], ['vitality', 0.7, []], ['gut_health', 0.68, []]],
    }

    for (const [ingId, effects] of Object.entries(effectEdges)) {
      for (const [effId, weight, evidence] of effects) {
        this.addEdge({
          id: `${ingId}→${effId}`,
          sourceId: ingId,
          targetId: effId,
          type: EdgeType.HAS_EFFECT,
          weight,
          confidence: 0.85,
          evidence: evidence.length > 0 ? evidence : undefined,
          metadata: { created: 20240101, source: 'expert' },
        })
      }
    }

    // 构建交互边
    this.buildInteractionEdges()

    // 构建分类边
    for (const ing of PRESET_INGREDIENTS) {
      if (ing.properties.nature) {
        const catId = `nature_${ing.properties.nature}`
        if (!this.nodes.has(catId)) {
          this.addNode({
            id: catId, type: NodeType.CATEGORY, label: ing.properties.nature,
            description: `${ing.properties.nature}性`, properties: {},
            metadata: { created: 20240101, updated: 20250601, source: 'TCM', confidence: 1, version: '1.0' },
          })
        }
        this.addEdge({
          id: `${ing.id}→${catId}`, sourceId: ing.id, targetId: catId,
          type: EdgeType.BELONGS_TO, weight: 1, confidence: 1,
          metadata: { created: 20240101, source: 'TCM' },
        })
      }
    }
  }

  private buildInteractionEdges(): void {
    const interactions: [string, string, EdgeType, number, string][] = [
      ['astragalus', 'angelica', EdgeType.ENHANCES, 0.85, '气血双补经典配伍'],
      ['astragalus', 'licorice', EdgeType.ENHANCES, 0.75, '补中益气功效增强'],
      ['astragalus', 'dang_shen', EdgeType.ENHANCES, 0.7, '补气作用叠加'],
      ['astragalus', 'goji', EdgeType.ENHANCES, 0.72, '免疫增强协同'],
      ['ginseng', 'schisandra', EdgeType.ENHANCES, 0.78, '益气养阴协同'],
      ['ginseng', 'astragalus', EdgeType.ENHANCES, 0.8, '补气大王组合'],
      ['tumeric', 'schisandra', EdgeType.ENHANCES, 0.82, '肝保护协同'],
      ['tumeric', 'astaxanthin', EdgeType.ENHANCES, 0.85, '抗氧化超级组合'],
      ['tumeric', 'zinc', EdgeType.ENHANCES, 0.6, '抗炎免疫协同'],
      ['collagen_peptide', 'vitamin_c', EdgeType.ENHANCES, 0.9, 'VC促进胶原合成'],
      ['inulin', 'probiotic_blend', EdgeType.ENHANCES, 0.92, '益生元+益生菌协同'],
      ['vitamin_c', 'zinc', EdgeType.ENHANCES, 0.75, '免疫增强黄金组合'],
      ['soy_peptide', 'inulin', EdgeType.ENHANCES, 0.5, '蛋白纤维互补'],
      ['astragalus', 'probiotic_blend', EdgeType.CONTRADICTS, 0.3, '多糖影响益生菌'],
      ['vitamin_c', 'astaxanthin', EdgeType.CONTRADICTS, 0.2, '抗氧化剂竞争'],
      ['ginseng', 'hawthorn', EdgeType.CONTRADICTS, 0.15, '人参不宜与山楂同用'],
    ]

    for (const [a, b, type, weight, desc] of interactions) {
      this.addEdge({
        id: `${a}↔${b}`, sourceId: a, targetId: b, type, weight, confidence: 0.8,
        properties: { description: desc },
        metadata: { created: 20240101, source: 'expert' },
      })
      this.addEdge({
        id: `${b}↔${a}`, sourceId: b, targetId: a, type, weight, confidence: 0.8,
        properties: { description: desc },
        metadata: { created: 20240101, source: 'expert' },
      })
    }
  }

  /* ================================================================ */
  /*  基础操作                                                          */
  /* ================================================================ */

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node)
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, new Map())
    }
  }

  addEdge(edge: GraphEdge): void {
    if (!this.edges.has(edge.sourceId)) {
      this.edges.set(edge.sourceId, [])
    }
    this.edges.get(edge.sourceId)!.push(edge)

    if (!this.adjacencyList.has(edge.sourceId)) {
      this.adjacencyList.set(edge.sourceId, new Map())
    }
    const targetMap = this.adjacencyList.get(edge.sourceId)!
    if (!targetMap.has(edge.targetId)) {
      targetMap.set(edge.targetId, [])
    }
    targetMap.get(edge.targetId)!.push(edge)
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id)
  }

  getNodesByType(type: NodeType): GraphNode[] {
    return Array.from(this.nodes.values()).filter(n => n.type === type)
  }

  getEdgesFrom(sourceId: string): GraphEdge[] {
    return this.edges.get(sourceId) || []
  }

  getEdgesBetween(sourceId: string, targetId: string): GraphEdge[] {
    return this.adjacencyList.get(sourceId)?.get(targetId) || []
  }

  /* ================================================================ */
  /*  图谱查询算法                                                      */
  /* ================================================================ */

  /** BFS 查找从起始节点出发可达的所有路径 */
  bfsQuery(query: GraphQuery): PathResult[] {
    const { startNodes = [], edgeTypes, maxDepth = 3, filters } = query
    const results: PathResult[] = []

    for (const startId of startNodes) {
      if (!this.nodes.has(startId)) continue

      const visited = new Set<string>()
      const queue: Array<{
        nodeId: string
        path: { nodes: GraphNode[]; edges: GraphEdge[] }
        depth: number
      }> = [{ nodeId: startId, path: { nodes: [this.nodes.get(startId)!], edges: [] }, depth: 0 }]

      visited.add(startId)

      while (queue.length > 0) {
        const current = queue.shift()!
        if (current.depth >= maxDepth) continue

        const edges = this.getEdgesFrom(current.nodeId)
        for (const edge of edges) {
          if (edgeTypes && !edgeTypes.includes(edge.type)) continue
          if (filters?.minConfidence && edge.confidence < filters.minConfidence) continue
          if (filters?.minWeight && edge.weight < filters.minWeight) continue

          if (!visited.has(edge.targetId)) {
            visited.add(edge.targetId)
            const targetNode = this.nodes.get(edge.targetId)
            if (!targetNode) continue

            if (filters?.nodeType && !filters.nodeType.includes(targetNode.type)) continue

            const newPath = {
              nodes: [...current.path.nodes, targetNode],
              edges: [...current.path.edges, edge],
            }
            const totalWeight = newPath.edges.reduce((s, e) => s + e.weight, 0)

            results.push({
              nodes: newPath.nodes,
              edges: newPath.edges,
              totalWeight: totalWeight / newPath.edges.length,
              hops: newPath.edges.length,
            })

            queue.push({
              nodeId: edge.targetId,
              path: newPath,
              depth: current.depth + 1,
            })
          }
        }
      }
    }

    // 按平均权重排序
    return results.sort((a, b) => b.totalWeight - a.totalWeight)
  }

  /** 查找两个节点之间的最短路径 (Dijkstra简化版) */
  shortestPath(from: string, to: string, maxDepth = 5): PathResult | null {
    if (!this.nodes.has(from) || !this.nodes.has(to)) return null

    const queue: Array<{
      nodeId: string
      nodes: GraphNode[]
      edges: GraphEdge[]
      visited: Set<string>
    }> = [{
      nodeId: from,
      nodes: [this.nodes.get(from)!],
      edges: [],
      visited: new Set([from]),
    }]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (current.nodeId === to) {
        const totalWeight = current.edges.reduce((s, e) => s + e.weight, 0)
        return {
          nodes: current.nodes,
          edges: current.edges,
          totalWeight: current.edges.length > 0 ? totalWeight / current.edges.length : 0,
          hops: current.edges.length,
        }
      }
      if (current.nodes.length >= maxDepth) continue

      const edges = this.getEdgesFrom(current.nodeId)
      for (const edge of edges) {
        if (!current.visited.has(edge.targetId)) {
          const newVisited = new Set(current.visited)
          newVisited.add(edge.targetId)
          const target = this.nodes.get(edge.targetId)
          if (target) {
            queue.push({
              nodeId: edge.targetId,
              nodes: [...current.nodes, target],
              edges: [...current.edges, edge],
              visited: newVisited,
            })
          }
        }
      }
    }

    return null
  }

  /** 查找某功效对应的所有成分，按强度排序 */
  findIngredientsForEffect(effectId: string): Array<{ ingredient: GraphNode; strength: number }> {
    const results: Array<{ ingredient: GraphNode; strength: number }> = []

    for (const [nodeId, node] of this.nodes.entries()) {
      if (node.type !== NodeType.INGREDIENT) continue
      const edges = this.getEdgesFrom(nodeId)
      const match = edges.find(e => e.targetId === effectId && e.type === EdgeType.HAS_EFFECT)
      if (match) {
        results.push({ ingredient: node, strength: match.weight })
      }
    }

    return results.sort((a, b) => b.strength - a.strength)
  }

  /** 查找成分的替代品（基于相似功效向量） */
  findAlternatives(ingredientId: string, topN = 3): Array<{ ingredient: GraphNode; similarity: number }> {
    const source = this.nodes.get(ingredientId)
    if (!source || source.type !== NodeType.INGREDIENT) return []

    const sourceEffects = this.getEdgesFrom(ingredientId)
      .filter(e => e.type === EdgeType.HAS_EFFECT)
      .map(e => ({ effectId: e.targetId, weight: e.weight }))

    if (sourceEffects.length === 0) return []

    const candidates: Array<{ ingredient: GraphNode; similarity: number }> = []

    for (const [nodeId, node] of this.nodes.entries()) {
      if (nodeId === ingredientId || node.type !== NodeType.INGREDIENT) continue

      const targetEffects = this.getEdgesFrom(nodeId)
        .filter(e => e.type === EdgeType.HAS_EFFECT)
        .map(e => ({ effectId: e.targetId, weight: e.weight }))

      // 余弦相似度
      const allEffectIds = new Set([...sourceEffects.map(e => e.effectId), ...targetEffects.map(e => e.effectId)])
      let dotProduct = 0
      let sourceMag = 0
      let targetMag = 0

      for (const effId of allEffectIds) {
        const sWeight = sourceEffects.find(e => e.effectId === effId)?.weight || 0
        const tWeight = targetEffects.find(e => e.effectId === effId)?.weight || 0
        dotProduct += sWeight * tWeight
        sourceMag += sWeight * sWeight
        targetMag += tWeight * tWeight
      }

      const similarity = sourceMag > 0 && targetMag > 0
        ? dotProduct / (Math.sqrt(sourceMag) * Math.sqrt(targetMag))
        : 0

      if (similarity > 0.3) {
        candidates.push({ ingredient: node, similarity: Math.round(similarity * 100) / 100 })
      }
    }

    return candidates.sort((a, b) => b.similarity - a.similarity).slice(0, topN)
  }

  /** 检查两个成分之间的交互类型 */
  getInteractionBetween(a: string, b: string): GraphEdge | null {
    const edges = this.getEdgesFrom(a)
    return edges.find(e =>
      e.targetId === b &&
      (e.type === EdgeType.ENHANCES || e.type === EdgeType.CONTRADICTS || e.type === EdgeType.INTERACTS_WITH)
    ) || null
  }

  /** 完整兼容性分析 */
  analyzeCompatibilityMatrix(ingredientIds: string[]): Array<{
    pair: [string, string]
    type: EdgeType
    strength: number
    description: string
  }> {
    const results: Array<{
      pair: [string, string]
      type: EdgeType
      strength: number
      description: string
    }> = []

    for (let i = 0; i < ingredientIds.length; i++) {
      for (let j = i + 1; j < ingredientIds.length; j++) {
        const a = ingredientIds[i]
        const b = ingredientIds[j]
        const aNode = this.nodes.get(a)
        const bNode = this.nodes.get(b)

        if (!aNode || !bNode) continue

        // 检查已知交互
        const interaction = this.getInteractionBetween(a, b)
        if (interaction) {
          results.push({
            pair: [a, b],
            type: interaction.type,
            strength: interaction.weight,
            description: interaction.properties?.description || `${aNode.label}与${bNode.label}有交互`,
          })
          continue
        }

        // 计算隐式兼容性
        const implicitScore = this.calculateImplicitCompatibility(aNode, bNode)
        if (implicitScore >= 0.4) {
          results.push({
            pair: [a, b],
            type: EdgeType.ENHANCES,
            strength: implicitScore,
            description: `${aNode.label}与${bNode.label}性质相合`,
          })
        } else if (implicitScore <= 0.1) {
          results.push({
            pair: [a, b],
            type: EdgeType.CONTRADICTS,
            strength: Math.abs(implicitScore),
            description: `${aNode.label}与${bNode.label}性质相异，建议谨慎配伍`,
          })
        } else {
          results.push({
            pair: [a, b],
            type: EdgeType.INTERACTS_WITH,
            strength: 0.3,
            description: `${aNode.label}与${bNode.label}配伍中性`,
          })
        }
      }
    }

    return results.sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength))
  }

  private calculateImplicitCompatibility(a: GraphNode, b: GraphNode): number {
    const aProps = a.properties as Record<string, unknown>
    const bProps = b.properties as Record<string, unknown>
    let score = 0.3 // 基线中性

    // 四气匹配
    if (aProps.nature && bProps.nature) {
      const natureOrder = ['cold', 'cool', 'neutral', 'warm', 'hot']
      const aIdx = natureOrder.indexOf(String(aProps.nature ?? ""))
      const bIdx = natureOrder.indexOf(String(bProps.nature ?? ""))
      if (aIdx >= 0 && bIdx >= 0) {
        score += Math.abs(aIdx - bIdx) <= 1 ? 0.15 : 0
        score += Math.abs(aIdx - bIdx) >= 3 ? -0.15 : 0
      }
    }

    // 五行归经匹配
    const aMer: string[] = (aProps.meridians as string[]) || []
    const bMer: string[] = (bProps.meridians as string[]) || []
    const commonMer = aMer.filter((m) => bMer.includes(String(m)))
    score += commonMer.length * 0.05

    // 五味调和
    const aFla: string[] = (aProps.flavor as string[]) || []
    const bFla: string[] = (bProps.flavor as string[]) || []
    const commonFla = aFla.filter((f) => bFla.includes(String(f)))
    score += commonFla.length * 0.03

    return Math.max(-0.3, Math.min(0.7, score))
  }

  /* ================================================================ */
  /*  语义搜索                                                          */
  /* ================================================================ */

  search(query: string): GraphNode[] {
    const q = query.toLowerCase()
    const results: Array<{ node: GraphNode; score: number }> = []

    for (const node of this.nodes.values()) {
      let score = 0
      if (node.label.includes(q)) score += 10
      if (node.aliases?.some(a => a.toLowerCase().includes(q))) score += 8
      if (node.description?.toLowerCase().includes(q)) score += 5
      if (node.type === NodeType.EFFECT) {
        const effectIngredients = this.findIngredientsForEffect(node.id)
        if (effectIngredients.some(e => e.ingredient.label.includes(q))) score += 3
      }
      if (score > 0) results.push({ node, score })
    }

    return results.sort((a, b) => b.score - a.score).map(r => r.node)
  }

  /** 导出图谱统计 */
  getStats(): { nodes: number; edges: number; ingredients: number; effects: number; categories: number } {
    return {
      nodes: this.nodes.size,
      edges: Array.from(this.edges.values()).reduce((s, e) => s + e.length, 0),
      ingredients: this.getNodesByType(NodeType.INGREDIENT).length,
      effects: this.getNodesByType(NodeType.EFFECT).length,
      categories: this.getNodesByType(NodeType.CATEGORY).length,
    }
  }
}

/** 全局单例 */
export const knowledgeGraph = new FormulaKnowledgeGraph()

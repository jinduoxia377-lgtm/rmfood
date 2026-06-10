/**
 * UnifiedEntityExtractor - 统一实体抽取管道
 *
 * 合并 WorkingMemory（正则动态匹配）和 ContextManager（硬编码词典）两套系统，
 * 提供唯一的实体抽取入口，消除信息冗余和不一致问题。
 *
 * 核心特性：
 * - 三阶段流水线：词典精确匹配 → 正则模式匹配 → 上下文增强
 * - 统一类型体系：合并 WM 和 CM 的 11 种实体类型
 * - 冲突解决：最长匹配优先 + 置信度优先 + 先到先得
 * - LRU 缓存：100 条缓存，单次 extract < 5ms
 *
 * @module unifiedEntityExtractor
 * @version 1.0.0
 */

// ===== 类型定义 =====

/** 统一实体类型（合并 WM 和 CM 的类型体系） */
export type UnifiedEntityType =
  | 'ingredient'        // 原料/药材（合并 WM 的原料 + CM 的 ingredient）
  | 'formula'            // 配方名称（来自 WM）
  | 'dosage'             // 剂量/浓度（来自 WM）
  | 'product_form'       // 产品形态/剂型（来自 CM: PRODUCT_FORM）
  | 'functional_claim'   // 功能宣称（来自 CM: FUNCTIONAL_CLAIM）
  | 'regulatory_std'     // 法规标准（来自 CM: REGULATORY_STD + WM 的法规）
  | 'target_audience'    // 目标人群（来自 CM: TARGET_AUDIENCE）
  | 'process_tech'       // 工艺技术（来自 CM: PROCESS_TECH）
  | 'safety_param'       // 安全参数（来自 CM: SAFETY_PARAM）
  | 'symptom'            // 症状/疾病（来自 CM）
  | 'effect_tag'         // 功效标签（如"降血糖"、"抗氧化"）
  | 'sensory_attr'       // 感官属性（来自 domainKnowledge: SENSORY_ATTRIBUTE）

export interface UnifiedEntity {
  id: string
  /** 原始文本 */
  text: string
  /** 标准化文本（如 "黄芪(Astragalus membranaceus)"） */
  normalized: string
  /** 实体类型 */
  type: UnifiedEntityType
  /** 置信度 0-1 */
  confidence: number
  /** 在原文中的位置 [start, end] */
  position?: [number, number]
  /** 出现次数（用于衰减/增强） */
  occurrenceCount: number
  /** 最后提及时间戳 */
  lastMentioned: number
  /** 关联的属性（如剂量值、单位等） */
  attributes?: Record<string, string | number>
}

export interface EntityExtractionResult {
  entities: UnifiedEntity[]
  /** 未识别的潜在实体片段（用于后续学习） */
  unknownSegments: string[]
  /** 处理耗时(ms) */
  processingTimeMs: number
}

// ===== 词典条目接口 =====

interface DictEntry {
  type: UnifiedEntityType
  normalized: string
  confidence: number
}

// ===== 精简版核心词典（合并三来源的高频词条） =====

/**
 * 词典构建说明：
 * A. 来自 domainKnowledge.ts 的术语（精选最高频 80 条）
 * B. 来自 contextManager.ts 的硬编码词典（症状/疾病类）
 * C. 来自 useWorkingMemory.ts 的正则模式（转换为词典或保留为正则）
 */
const CORE_DICTIONARY: Map<string, DictEntry> = new Map(
  Object.entries({
    /* ========== 原料/药材（来自 contextManager + domainKnowledge 高频）========== */
    '黄芪': { type: 'ingredient', normalized: '黄芪(Astragalus membranaceus)', confidence: 0.95 },
    '当归': { type: 'ingredient', normalized: '当归(Angelica sinensis)', confidence: 0.95 },
    '枸杞': { type: 'ingredient', normalized: '枸杞(Lycium barbarum)', confidence: 0.95 },
    '人参': { type: 'ingredient', normalized: '人参(Panax ginseng)', confidence: 0.95 },
    '鹿茸': { type: 'ingredient', normalized: '鹿茸(Cervi Cornu Pantotrichum)', confidence: 0.94 },
    '虫草': { type: 'ingredient', normalized: '冬虫夏草(Cordyceps sinensis)', confidence: 0.94 },
    '灵芝': { type: 'ingredient', normalized: '灵芝(Ganoderma lucidum)', confidence: 0.94 },
    '丹参': { type: 'ingredient', normalized: '丹参(Salvia miltiorrhiza)', confidence: 0.94 },
    '山楂': { type: 'ingredient', normalized: '山楂(Crataegus pinnatifida)', confidence: 0.93 },
    '决明子': { type: 'ingredient', normalized: '决明子(Cassia obtusifolia)', confidence: 0.93 },

    /* ========== 功能性因子（来自 domainKnowledge: FUNCTIONAL_FACTOR 高频）========== */
    '多肽': { type: 'effect_tag', normalized: '生物活性肽(Bioactive Peptides)', confidence: 0.96 },
    '益生菌': { type: 'ingredient', normalized: '益生菌(Probiotics)', confidence: 0.98 },
    '乳酸菌': { type: 'ingredient', normalized: '乳酸菌(Lactic Acid Bacteria / LAB)', confidence: 0.97 },
    '益生元': { type: 'ingredient', normalized: '益生元(Prebiotics)', confidence: 0.97 },
    '菊粉': { type: 'ingredient', normalized: '菊糖/菊粉(Inulin)', confidence: 0.98 },
    '胶原蛋白肽': { type: 'effect_tag', normalized: '胶原蛋白水解肽(Collagen Hydrolysate)', confidence: 0.98 },
    '多糖': { type: 'effect_tag', normalized: '生物活性多糖(Bioactive Polysaccharide)', confidence: 0.94 },
    '膳食纤维': { type: 'ingredient', normalized: '膳食纤维(Dietary Fiber)', confidence: 0.97 },
    'DHA': { type: 'effect_tag', normalized: '二十二碳六烯酸(DHA)', confidence: 0.99 },
    'EPA': { type: 'effect_tag', normalized: '二十碳五烯酸(EPA)', confidence: 0.99 },
    '辅酶Q10': { type: 'effect_tag', normalized: '辅酶Q10(Coenzyme Q10)', confidence: 0.98 },
    '褪黑素': { type: 'effect_tag', normalized: '褪黑素(Melatonin)', confidence: 0.98 },
    'GABA': { type: 'effect_tag', normalized: 'γ-氨基丁酸(GABA)', confidence: 0.97 },
    '黄酮': { type: 'effect_tag', normalized: '黄酮类化合物(Flavonoids)', confidence: 0.95 },
    '花青素': { type: 'effect_tag', normalized: '花青素(Anthocyanins)', confidence: 0.97 },
    '番茄红素': { type: 'effect_tag', normalized: '番茄红素(Lycopene)', confidence: 0.98 },
    '乳铁蛋白': { type: 'effect_tag', normalized: '乳铁蛋白(Lactoferrin)', confidence: 0.98 },
    '透明质酸': { type: 'sensory_attr', normalized: '透明质酸/玻尿酸(Hyaluronic Acid)', confidence: 0.98 },

    /* ========== 产品形态（来自 domainKnowledge: PRODUCT_FORM 高频）========== */
    '固体饮料': { type: 'product_form', normalized: '固体饮料(Solid Drink)', confidence: 0.99 },
    '软糖': { type: 'product_form', normalized: '软糖(Gummy)', confidence: 0.98 },
    '片剂': { type: 'product_form', normalized: '压片糖果/片剂(Tablet)', confidence: 0.98 },
    '胶囊': { type: 'product_form', normalized: '硬胶囊/软胶囊(Capsule)', confidence: 0.98 },
    '粉剂': { type: 'product_form', normalized: '粉末制剂(Powder)', confidence: 0.97 },
    '口服液': { type: 'product_form', normalized: '口服液(Oral Liquid)', confidence: 0.98 },
    '滴剂': { type: 'product_form', normalized: '滴剂(Drops / Tincture)', confidence: 0.97 },
    '代餐棒': { type: 'product_form', normalized: '代餐棒/营养棒(Meal Replacement Bar)', confidence: 0.96 },
    '果冻': { type: 'product_form', normalized: '功能果冻(Jelly)', confidence: 0.97 },
    '特医食品': { type: 'product_form', normalized: '特殊医学用途配方食品(FSMP)', confidence: 0.97 },
    '运动营养': { type: 'product_form', normalized: '运动营养食品(Sports Nutrition Food)', confidence: 0.96 },

    /* ========== 工艺技术（来自 domainKnowledge: PROCESS_TECHNOLOGY 高频）========== */
    '喷雾干燥': { type: 'process_tech', normalized: '喷雾干燥(Spray Drying)', confidence: 0.97 },
    '微胶囊化': { type: 'process_tech', normalized: '微胶囊化技术(Microencapsulation)', confidence: 0.96 },
    '冷冻干燥': { type: 'process_tech', normalized: '真空冷冻干燥(Freeze Drying)', confidence: 0.97 },
    '酶解': { type: 'process_tech', normalized: '酶解技术(Enzymatic Hydrolysis)', confidence: 0.96 },
    '发酵': { type: 'process_tech', normalized: '微生物发酵技术(Fermentation Technology)', confidence: 0.96 },
    '超临界萃取': { type: 'process_tech', normalized: '超临界流体萃取(SFE)', confidence: 0.97 },
    '纳米乳化': { type: 'process_tech', normalized: '纳米乳化技术(Nanoemulsion)', confidence: 0.96 },
    '高压均质': { type: 'process_tech', normalized: '高压均质技术(HPH)', confidence: 0.96 },
    '超微粉碎': { type: 'process_tech', normalized: '超微粉碎技术(Micronization)', confidence: 0.95 },
    '膜分离': { type: 'process_tech', normalized: '膜分离技术(Membrane Separation)', confidence: 0.95 },
    'UHT杀菌': { type: 'process_tech', normalized: '超高温瞬时灭菌(UHT)', confidence: 0.95 },
    '巴氏杀菌': { type: 'process_tech', normalized: '巴氏灭菌(Pasteurization)', confidence: 0.95 },
    '无菌灌装': { type: 'process_tech', normalized: '无菌灌装技术(Aseptic Filling)', confidence: 0.94 },

    /* ========== 法规标准（来自 domainKnowledge: REGULATORY_STANDARD 高频）========== */
    'GB': { type: 'regulatory_std', normalized: 'GB国家标准体系(National Standard of PRC)', confidence: 0.93 },
    'FDA': { type: 'regulatory_std', normalized: '美国FDA GRAS认证(FDA GRAS Status)', confidence: 0.96 },
    'GRAS': { type: 'regulatory_std', normalized: 'GRAS一般公认安全(GRAS)', confidence: 0.95 },
    '保健食品': { type: 'regulatory_std', normalized: 'GB 16740保健食品(Health Food)', confidence: 0.94 },
    '蓝帽子': { type: 'regulatory_std', normalized: '中国保健食品注册批准("Blue Hat")', confidence: 0.95 },
    'NMPA': { type: 'regulatory_std', normalized: '国家药品监督管理局(NMPA)', confidence: 0.96 },
    'HACCP': { type: 'regulatory_std', normalized: '危害分析与关键控制点(HACCP)', confidence: 0.96 },
    'GMP': { type: 'regulatory_std', normalized: '良好生产规范(GMP)', confidence: 0.96 },
    'ISO22000': { type: 'regulatory_std', normalized: 'ISO 22000食品安全管理体系', confidence: 0.95 },
    '有机认证': { type: 'regulatory_std', normalized: '有机产品认证(Organic Certification)', confidence: 0.94 },
    'GB2760': { type: 'regulatory_std', normalized: 'GB 2760食品添加剂使用标准', confidence: 0.96 },
    'GB14880': { type: 'regulatory_std', normalized: 'GB 14880营养强化剂使用标准', confidence: 0.95 },
    'GB7718': { type: 'regulatory_std', normalized: 'GB 7718预包装食品标签通则', confidence: 0.94 },
    'EFSA': { type: 'regulatory_std', normalized: '欧盟食品安全局(EFSA)', confidence: 0.95 },

    /* ========== 安全参数（来自 domainKnowledge: SAFETY_PARAM 高频）========== */
    'ADI': { type: 'safety_param', normalized: '每日允许摄入量(ADI)', confidence: 0.98 },
    'LD50': { type: 'safety_param', normalized: '半数致死量(LD₅₀)', confidence: 0.97 },
    'NOAEL': { type: 'safety_param', normalized: '未观察到有害作用水平(NOAEL)', confidence: 0.96 },
    '重金属限量': { type: 'safety_param', normalized: '重金属最大残留限量(Heavy Metal MRLs)', confidence: 0.95 },
    '微生物指标': { type: 'safety_param', normalized: '微生物限量标准(Microbiological Criteria)', confidence: 0.94 },
    '过敏原': { type: 'safety_param', normalized: '食物致敏原(Food Allergen)', confidence: 0.95 },
    '转基因': { type: 'safety_param', normalized: '转基因成分检测(GMO Detection)', confidence: 0.94 },
    '农残': { type: 'safety_param', normalized: '农药残留限量(Pesticide MRLs)', confidence: 0.94 },
    '黄曲霉毒素': { type: 'safety_param', normalized: '黄曲霉毒素(Aflatoxins)', confidence: 0.95 },

    /* ========== 感官属性（来自 domainKnowledge: SENSORY_ATTRIBUTE 高频）========== */
    '口感': { type: 'sensory_attr', normalized: '感官质地与口感(Sensory Texture)', confidence: 0.93 },
    '溶解性': { type: 'sensory_attr', normalized: '溶解度/溶解性能(Solubility)', confidence: 0.94 },
    '硬度': { type: 'sensory_attr', normalized: '硬度(Hardness)', confidence: 0.94 },
    '脆性': { type: 'sensory_attr', normalized: '脆度/酥脆性(Crispness)', confidence: 0.93 },
    '弹性': { type: 'sensory_attr', normalized: '弹性(Springiness)', confidence: 0.93 },
    '粘性': { type: 'sensory_attr', normalized: '粘附性/粘性(Adhesiveness)', confidence: 0.93 },

    /* ========== 症状/疾病（来自 contextManager: symptoms + diseases）========== */
    '高血糖': { type: 'symptom', normalized: '高血糖(Hyperglycemia)', confidence: 0.94 },
    '高血压': { type: 'symptom', normalized: '高血压(Hypertension)', confidence: 0.94 },
    '高血脂': { type: 'symptom', normalized: '高血脂(Hyperlipidemia)', confidence: 0.94 },
    '糖尿病': { type: 'symptom', normalized: '糖尿病(Diabetes Mellitus)', confidence: 0.95 },
    '失眠': { type: 'symptom', normalized: '失眠(Insomnia)', confidence: 0.92 },
    '疲劳': { type: 'symptom', normalized: '疲劳(Fatigue)', confidence: 0.92 },
    '头晕': { type: 'symptom', normalized: '头晕(Dizziness)', confidence: 0.91 },
    '乏力': { type: 'symptom', normalized: '乏力(Lassitude)', confidence: 0.91 },
    '心血管疾病': { type: 'symptom', normalized: '心血管疾病(Cardiovascular Disease)', confidence: 0.93 },
    '骨质疏松': { type: 'symptom', normalized: '骨质疏松(Osteoporosis)', confidence: 0.92 },
    '免疫力低下': { type: 'symptom', normalized: '免疫力低下(Low Immunity)', confidence: 0.92 },
    '记忆力减退': { type: 'symptom', normalized: '记忆力减退(Memory Decline)', confidence: 0.90 },

    /* ========== 目标人群（扩展自业务场景）========== */
    '中老年': { type: 'target_audience', normalized: '中老年人群(Middle-aged & Elderly)', confidence: 0.93 },
    '儿童': { type: 'target_audience', normalized: '儿童(Children)', confidence: 0.94 },
    '孕妇': { type: 'target_audience', normalized: '孕妇(Pregnant Women)', confidence: 0.94 },
    '婴幼儿': { type: 'target_audience', normalized: '婴幼儿(Infants & Toddlers)', confidence: 0.93 },
    '运动员': { type: 'target_audience', normalized: '运动员(Athletes)', confidence: 0.93 },
    '糖尿病患者': { type: 'target_audience', normalized: '糖尿病高危人群(Diabetic Patients)', confidence: 0.92 },
    '高血压患者': { type: 'target_audience', normalized: '高血压患者(Hypertensive Patients)', confidence: 0.91 },
    '肥胖人群': { type: 'target_audience', normalized: '肥胖人群(Obese Population)', confidence: 0.91 },
    '亚健康': { type: 'target_audience', normalized: '亚健康人群(Sub-health Population)', confidence: 0.90 },

    /* ========== 功效标签（来自 useWorkingMemory 场景 + 扩展）========== */
    '降血糖': { type: 'effect_tag', normalized: '降血糖(Hypoglycemic Effect)', confidence: 0.95 },
    '降血压': { type: 'effect_tag', normalized: '降压作用(Antihypertensive Effect)', confidence: 0.94 },
    '降血脂': { type: 'effect_tag', normalized: '降血脂作用(Hypolipidemic Effect)', confidence: 0.94 },
    '抗氧化': { type: 'effect_tag', normalized: '抗氧化作用(Antioxidant Effect)', confidence: 0.95 },
    '增强免疫': { type: 'effect_tag', normalized: '增强免疫力(Immune Enhancement)', confidence: 0.93 },
    '改善睡眠': { type: 'effect_tag', normalized: '改善睡眠(Sleep Improvement)', confidence: 0.93 },
    '抗衰老': { type: 'effect_tag', normalized: '抗衰老作用(Anti-aging Effect)', confidence: 0.92 },
    '减肥': { type: 'effect_tag', normalized: '减重/减肥(Weight Loss)', confidence: 0.91 },
    '美容': { type: 'effect_tag', normalized: '美容护肤(Beauty & Skin Care)', confidence: 0.90 },
    '护肝': { type: 'effect_tag', normalized: '保肝护肝(Liver Protection)', confidence: 0.91 },
    '润肠通便': { type: 'effect_tag', normalized: '润肠通便(Bowel Regulation)', confidence: 0.90 },
  })
)

// ===== 正则模式定义（Stage 2 使用）=====

interface RegexPattern {
  pattern: RegExp
  type: UnifiedEntityType
  confidenceRange: [number, number]
  /** 后处理函数：将匹配结果转换为标准化文本 */
  normalizer?: (match: string) => { text: string; normalized: string }
}

const REGEX_PATTERNS: RegexPattern[] = [
  // 配方名模式（来自 useWorkingMemory）
  {
    pattern: /([\u4e00-\u9fa5]{2,12}配方(?:草案|方案|设计)?)/g,
    type: 'formula',
    confidenceRange: [0.82, 0.90],
    normalizer: (m) => ({ text: m, normalized: `${m}(Formula)` }),
  },
  {
    pattern: /([\u4e00-\u9fa5]+\d*号?配方)/gi,
    type: 'formula',
    confidenceRange: [0.80, 0.88],
    normalizer: (m) => ({ text: m, normalized: `${m}(Formula)` }),
  },

  // 剂量模式（来自 useWorkingMemory）
  {
    pattern: /(\d+(?:\.\d+)?\s*(?:g|mg|ml|kg|%|ppm)\b)/gi,
    type: 'dosage',
    confidenceRange: [0.85, 0.92],
    normalizer: (m) => ({ text: m, normalized: `剂量: ${m.trim()}` }),
  },

  // 法规编号模式（扩展）
  {
    pattern: /(GB\s*[\d.]+(?:-\d+)?)\b/gi,
    type: 'regulatory_std',
    confidenceRange: [0.88, 0.94],
    normalizer: (m) => ({ text: m, normalized: `${m.toUpperCase().trim()} (国家标准)` }),
  },
  {
    pattern: /(ISO\s*[\d.]+(?:-\d+)?)\b/gi,
    type: 'regulatory_std',
    confidenceRange: [0.87, 0.93],
    normalizer: (m) => ({ text: m, normalized: `${m.toUpperCase().trim()} (国际标准)` }),
  },
  {
    pattern: /(USP|BP|EP|JIS|DIN)\s*[\d.]+(-\d+)*/gi,
    type: 'regulatory_std',
    confidenceRange: [0.86, 0.92],
    normalizer: (m) => ({ text: m, normalized: `${m.toUpperCase().trim()} (药典标准)` }),
  },

  // 百分比浓度（当紧跟实体词时）
  {
    pattern: /\d+(?:\.\d+)?%/g,
    type: 'dosage',
    confidenceRange: [0.78, 0.86],
    normalizer: (m) => ({ text: m, normalized: `浓度: ${m}` }),
  },

  // 原料+单位组合模式（来自 useWorkingMemory 增强）
  {
    pattern: /([\u4e00-\u9fa5]{2,8})\s+(\d+(?:\.\d+)?\s*(?:g|mg|ml|kg|%|ppm))/gi,
    type: 'ingredient',
    confidenceRange: [0.76, 0.85],
    normalizer: (m) => {
      const parts = m.match(/([\u4e00-\u9fa5]{2,8})\s+(\d+(?:\.\d+)?\s*(?:g|mg|ml|kg|%|ppm))/i)
      return parts
        ? { text: parts[1], normalized: `${parts[1]}(${parts[2].trim()})` }
        : { text: m, normalized: m }
    },
  },
]

// ===== LRU 缓存实现 =====

interface CacheEntry {
  result: EntityExtractionResult
  timestamp: number
}

class LRUCache {
  private cache = new Map<string, CacheEntry>()
  private readonly maxSize: number

  constructor(maxSize = 100) {
    this.maxSize = maxSize
  }

  get(key: string): EntityExtractionResult | undefined {
    const entry = this.cache.get(key)
    if (entry) {
      // LRU: 移到末尾（最近使用）
      this.cache.delete(key)
      this.cache.set(key, entry)
      return entry.result
    }
    return undefined
  }

  set(key: string, result: EntityExtractionResult): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // 删除最旧的（第一个）
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, { result, timestamp: Date.now() })
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

// ===== 统一实体抽取引擎 =====

export class UnifiedEntityExtractor {
  /** 单例实例 */
  static readonly instance = new UnifiedEntityExtractor()

  /** 词典查找表（O(1) 查找） */
  private readonly dictionary: Map<string, DictEntry>

  /** LRU 结果缓存 */
  private readonly cache: LRUCache

  /** 是否已从 domainKnowledge 加载补充词典 */
  private domainKnowledgeLoaded = false

  /** 异步加载完成 Promise（供外部 await 确保词典就绪） */
  readonly ready: Promise<void>

  /** 输入文本最大长度限制（防止 ReDoS 和内存问题） */
  static readonly MAX_INPUT_LENGTH = 5000

  /** 停用词表（模块级常量，避免每次调用重建 Set） */
  private static readonly COMMON_WORDS = new Set([
    '这个', '那个', '什么', '怎么', '如何', '可以', '需要', '应该',
    '因为', '所以', '但是', '然后', '或者', '如果', '虽然', '已经',
    '正在', '一个', '一些', '一种', '一般', '一样', '一起', '一直',
    '我们', '你们', '他们', '它们', '自己', '大家', '没有', '不是',
    '就是', '还是', '而且', '关于', '对于', '通过', '根据', '进行',
    '实现', '完成', '提供', '包括', '以及', '相关', '主要', '重要',
    '可能', '能够', '必须', '应该', '需要', '希望', '建议', '推荐',
  ])

  /** 置信度提升常量 — 关联证据佐证 */
  private static readonly CONFIDENCE_BOOST_ASSOCIATION = 0.03

  /** 置信度提升常量 — 复现/重复出现 */
  private static readonly CONFIDENCE_BOOST_REOCCURRENCE = 0.02

  private constructor() {
    this.dictionary = new Map(CORE_DICTIONARY)
    this.cache = new LRUCache(100)
    // 异步加载 domainKnowledge 补充词典，保存 Promise 供外部 await
    this.ready = this.tryLoadDomainKnowledge()
  }

  /**
   * 尝试从 domainKnowledge.ts 动态加载补充词典
   * 避免循环依赖，使用动态 import
   */
  private async tryLoadDomainKnowledge(): Promise<void> {
    if (this.domainKnowledgeLoaded) return
    try {
      const mod = await import('./domainKnowledge')
      if (mod.TERMINOLOGY_MAP && Array.isArray(mod.TERMINOLOGY_MAP)) {
        for (const term of mod.TERMINOLOGY_MAP as Array<{
          key: string
          normalized: string
          category: string
          confidence: number
        }>) {
          // 跳过已存在的词条（核心词典优先）
          if (!this.dictionary.has(term.key)) {
            const mappedType = this.mapCategoryToUnifiedType(term.category)
            this.dictionary.set(term.key, {
              type: mappedType,
              normalized: term.normalized,
              confidence: term.confidence * 0.95, // 外部来源略微降低置信度
            })
          }
        }
        this.domainKnowledgeLoaded = true
      }
    } catch {
      // 加载失败时静默回退到内置词典
      this.domainKnowledgeLoaded = false
    }
  }

  /**
   * 将 domainKnowledge 的 TermCategory 映射为 UnifiedEntityType
   */
  private mapCategoryToUnifiedType(category: string): UnifiedEntityType {
    const mapping: Record<string, UnifiedEntityType> = {
      FUNCTIONAL_FACTOR: 'effect_tag',
      PRODUCT_FORM: 'product_form',
      PROCESS_TECHNOLOGY: 'process_tech',
      REGULATORY_STANDARD: 'regulatory_std',
      SAFETY_PARAM: 'safety_param',
      SENSORY_ATTRIBUTE: 'sensory_attr',
    }
    return mapping[category] || 'ingredient'
  }

  /**
   * 抽取单条文本中的所有实体
   * 三阶段流水线：词典匹配 → 正则匹配 → 上下文增强
   */
  extract(text: string): EntityExtractionResult {
    const startTime = performance.now()

    // 防御性检查：空输入或超长输入
    if (!text || typeof text !== 'string') {
      return { entities: [], unknownSegments: [], processingTimeMs: 0 }
    }

    // 截断超长文本（防止 ReDoS 和性能问题）
    const safeText = text.length > UnifiedEntityExtractor.MAX_INPUT_LENGTH
      ? text.slice(0, UnifiedEntityExtractor.MAX_INPUT_LENGTH)
      : text

    // 使用哈希缓存键避免前缀碰撞（不同内容但前200字相同的情况）
    const cacheKey = this.computeCacheKey(safeText)
    const cached = this.cache.get(cacheKey)
    if (cached) {
      return {
        ...cached,
        processingTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
      }
    }

    try {
      const allEntities: UnifiedEntity[] = []
      const now = Date.now()

      // Stage 1: 词典精确匹配（高置信度 0.90-0.98）
      const dictEntities = this.stage1DictionaryMatch(safeText, now)
      allEntities.push(...dictEntities)

      // Stage 2: 正则模式匹配（中置信度 0.75-0.89）
      const regexEntities = this.stage2RegexMatch(safeText, now)
      allEntities.push(...regexEntities)

      // Stage 3: 冲突解决 + 去重
      const resolvedEntities = this.resolveConflicts(allEntities)

      // Stage 4: 上下文增强（补充属性关联）
      const enhancedEntities = this.enhanceWithContext(resolvedEntities, safeText)

      // 检测未知片段
      const unknownSegments = this.detectUnknownSegments(safeText, enhancedEntities)

      const result: EntityExtractionResult = {
        entities: enhancedEntities,
        unknownSegments,
        processingTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
      }

      // 写入缓存
      this.cache.set(cacheKey, result)

      return result
    } catch (error) {
      console.warn('[UnifiedEntityExtractor] 实体抽取异常，返回空结果:', error)
      return { entities: [], unknownSegments: [], processingTimeMs: Math.round((performance.now() - startTime) * 100) / 100 }
    }
  }

  /**
   * 计算缓存键 — 使用简单哈希避免前缀碰撞
   */
  private computeCacheKey(text: string): string {
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i)
      hash = hash | 0 // Convert to 32bit integer
    }
    return `${hash}::${text.length}`
  }

  /**
   * Stage 1: 词典精确匹配
   * 遍历词典，在文本中查找每个词条的所有出现位置
   * 时间复杂度: O(n * m)，n=文本长度，m=词典大小
   */
  private stage1DictionaryMatch(text: string, timestamp: number): UnifiedEntity[] {
    const entities: UnifiedEntity[] = []

    this.dictionary.forEach((entry, keyword) => {
      let searchStart = 0
      while (true) {
        const index = text.indexOf(keyword, searchStart)
        if (index === -1) break

        entities.push({
          id: `dict-${keyword}-${index}`,
          text: keyword,
          normalized: entry.normalized,
          type: entry.type,
          confidence: entry.confidence,
          position: [index, index + keyword.length],
          occurrenceCount: 1,
          lastMentioned: timestamp,
        })

        searchStart = index + keyword.length
      }
    })

    return entities
  }

  /**
   * Stage 2: 正则模式匹配
   * 覆盖词典无法表达的变体形式（如配方名、剂量值、法规编号等）
   */
  private stage2RegexMatch(text: string, timestamp: number): UnifiedEntity[] {
    const entities: UnifiedEntity[] = []

    for (const rp of REGEX_PATTERNS) {
      // 重置正则的 lastIndex
      rp.pattern.lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = rp.pattern.exec(text)) !== null) {
        const [fullMatch] = match
        const startPos = match.index
        const endPos = startPos + fullMatch.length

        // 计算置信度（基于匹配长度和位置）
        const [minConf, maxConf] = rp.confidenceRange
        const lengthRatio = Math.min(fullMatch.length / 10, 1) // 归一化长度因子
        const confidence = minConf + (maxConf - minConf) * lengthRatio

        const { text: entityText, normalized } = rp.normalizer
          ? rp.normalizer(fullMatch)
          : { text: fullMatch, normalized: fullMatch }

        entities.push({
          id: `regex-${rp.type}-${startPos}`,
          text: entityText,
          normalized,
          type: rp.type,
          confidence: Math.round(confidence * 100) / 100,
          position: [startPos, endPos],
          occurrenceCount: 1,
          lastMentioned: timestamp,
        })
      }
    }

    return entities
  }

  /**
   * 冲突解决策略：
   * 1. 最长匹配优先（"固体饮料" > "饮料"）
   * 2. 置信度高的优先（词典匹配 > 正则匹配）
   * 3. 先到先得（position 靠前的优先）
   */
  private resolveConflicts(entities: UnifiedEntity[]): UnifiedEntity[] {
    if (entities.length === 0) return entities

    // 按 position 排序
    const sorted = [...entities].sort((a, b) => {
      if (!a.position || !b.position) return 0
      return a.position[0] - b.position[0]
    })

    const resolved: UnifiedEntity[] = []
    const usedPositions: Set<number> = new Set()

    for (const entity of sorted) {
      if (!entity.position) continue

      const [start, end] = entity.position
      // 检查是否与已有实体位置重叠
      let hasOverlap = false
      for (let pos = start; pos < end; pos++) {
        if (usedPositions.has(pos)) {
          hasOverlap = true
          break
        }
      }

      if (!hasOverlap) {
        // 标记位置为已占用
        for (let pos = start; pos < end; pos++) {
          usedPositions.add(pos)
        }
        resolved.push(entity)
      } else {
        // 发生冲突：尝试替换（如果当前实体更长或置信度更高）
        this.tryReplaceEntity(resolved, usedPositions, entity)
      }
    }

    return resolved
  }

  /**
   * 尝试替换冲突的实体（最长匹配优先 + 置信度优先）
   */
  private tryReplaceEntity(
    resolved: UnifiedEntity[],
    usedPositions: Set<number>,
    candidate: UnifiedEntity
  ): void {
    if (!candidate.position) return

    const [start, end] = candidate.position
    const candidateLength = end - start

    // 找出与候选实体重叠的已存在实体
    const overlappingIndices: number[] = []
    for (let i = 0; i < resolved.length; i++) {
      const existing = resolved[i]
      if (!existing.position) continue
      const [eStart, eEnd] = existing.position
      // 检查是否有重叠
      if (!(end <= eStart || start >= eEnd)) {
        overlappingIndices.push(i)
      }
    }

    if (overlappingIndices.length === 0) return

    // 检查是否应该替换（候选实体更长 或 置信度更高且长度相当）
    for (const idx of overlappingIndices) {
      const existing = resolved[idx]
      if (!existing.position) continue

      const existingLength = existing.position[1] - existing.position[0]

      // 规则1: 最长匹配优先
      if (candidateLength > existingLength * 1.2) {
        // 移除旧实体，释放位置
        for (let pos = existing.position[0]; pos < existing.position[1]; pos++) {
          usedPositions.delete(pos)
        }
        resolved.splice(idx, 1)
        // 添加新实体
        for (let pos = start; pos < end; pos++) {
          usedPositions.add(pos)
        }
        resolved.push(candidate)
        return
      }

      // 规则2: 置信度高优先（当长度相差不超过20%时）
      if (
        Math.abs(candidateLength - existingLength) / existingLength <= 0.2 &&
        candidate.confidence > existing.confidence + 0.05
      ) {
        for (let pos = existing.position[0]; pos < existing.position[1]; pos++) {
          usedPositions.delete(pos)
        }
        resolved.splice(idx, 1)
        for (let pos = start; pos < end; pos++) {
          usedPositions.add(pos)
        }
        resolved.push(candidate)
        return
      }
    }
  }

  /**
   * Stage 3: 上下文增强
   * 利用已提取实体推断关联信息（如给原料实体添加 dosage 属性）
   */
  private enhanceWithContext(entities: UnifiedEntity[], text: string): UnifiedEntity[] {
    const enhanced = [...entities]

    // 查找剂量实体
    const dosageEntities = enhanced.filter(e => e.type === 'dosage')
    const ingredientEntities = enhanced.filter(
      e => e.type === 'ingredient'
    )

    // 为附近的原料实体关联剂量信息
    for (const ingredient of ingredientEntities) {
      if (!ingredient.position) continue

      const [ingStart, ingEnd] = ingredient.position
      // 查找原料后 15 个字符内是否有剂量值
      const nearbyDosage = dosageEntities.find(d => {
        if (!d.position) return false
        const dosStart = d.position[0]
        // 剂量在原料后面，且距离不超过 15 字符
        return dosStart > ingEnd && dosStart - ingEnd <= 15
      })

      if (nearbyDosage) {
        ingredient.attributes = {
          ...ingredient.attributes,
          dosage: nearbyDosage.text,
        }
        // 略微提升置信度（因为有剂量佐证）
        ingredient.confidence = Math.min(0.99, ingredient.confidence + UnifiedEntityExtractor.CONFIDENCE_BOOST_ASSOCIATION)
      }
    }

    return enhanced
  }

  /**
   * 检测未识别的潜在实体片段
   * 用于后续学习和词典扩充
   */
  private detectUnknownSegments(text: string, knownEntities: UnifiedEntity[]): string[] {
    const unknownSegments: string[] = []
    const knownTexts = new Set(knownEntities.map(e => e.text.toLowerCase()))

    // 简单启发式：查找连续的中文片段（2-8字），排除已知实体
    const chineseSegmentPattern = /[\u4e00-\u9fa5]{2,8}/g
    let match: RegExpExecArray | null

    while ((match = chineseSegmentPattern.exec(text)) !== null) {
      const segment = match[0]
      // 排除常见停用词和已知实体
      if (
        !knownTexts.has(segment.toLowerCase()) &&
        !this.isCommonWord(segment) &&
        this.mightBeEntity(segment)
      ) {
        unknownSegments.push(segment)
      }
    }

    // 去重并限制数量
    const uniqueSegments: string[] = []
    const seen = new Set<string>()
    for (const seg of unknownSegments) {
      if (!seen.has(seg)) {
        seen.add(seg)
        uniqueSegments.push(seg)
        if (uniqueSegments.length >= 10) break
      }
    }
    return uniqueSegments
  }

  /**
   * 判断是否为常见停用词（使用模块级常量，O(1) 查找）
   */
  private isCommonWord(word: string): boolean {
    return UnifiedEntityExtractor.COMMON_WORDS.has(word)
  }

  /**
   * 启发式判断：该片段是否可能是实体
   */
  private mightBeEntity(segment: string): boolean {
    // 包含专业词汇特征的更可能是实体
    const entityIndicators = [
      /.*[配方|制剂|提取物|粉末|颗粒|胶囊|片剂|口服液|饮料]$/,
      /^.*(肽|多糖|蛋白|纤维|酸|素|酮|醇|苷|酚)$/,
      /^[A-Z]{2,}$/, // 缩写
      /^\d+.*[号|版|型|期|组]$/, // 编号类
    ]
    return entityIndicators.some(pattern => pattern.test(segment))
  }

  /**
   * 增量更新：基于新文本更新已有实体（不重复添加）
   */
  update(existing: UnifiedEntity[], newText: string): EntityExtractionResult {
    const newResult = this.extract(newText)
    const now = Date.now()
    const updated: UnifiedEntity[] = [...existing]
    const existingTextSet = new Set(updated.map(e => e.text.toLowerCase()))

    for (const newEntity of newResult.entities) {
      const key = newEntity.text.toLowerCase()
      const existingIdx = updated.findIndex(e => e.text.toLowerCase() === key)

      if (existingIdx >= 0) {
        // 更新已有实体：增加出现次数、提升置信度、刷新时间戳
        const existing = updated[existingIdx]
        existing.occurrenceCount++
        existing.lastMentioned = now
        existing.confidence = Math.min(0.99, existing.confidence + UnifiedEntityExtractor.CONFIDENCE_BOOST_REOCCURRENCE)
        // 合并属性
        if (newEntity.attributes) {
          existing.attributes = { ...existing.attributes, ...newEntity.attributes }
        }
      } else {
        // 新实体：添加到列表
        updated.push(newEntity)
      }
    }

    // 按最后提及时间排序，保持最新在前
    updated.sort((a, b) => b.lastMentioned - a.lastMentioned)

    return {
      entities: updated,
      unknownSegments: newResult.unknownSegments,
      processingTimeMs: newResult.processingTimeMs,
    }
  }

  /**
   * 按类型过滤实体
   */
  filterByType(entities: UnifiedEntity[], types: UnifiedEntityType[]): UnifiedEntity[] {
    const typeSet = new Set(types)
    return entities.filter(e => typeSet.has(e.type))
  }

  /**
   * 获取活跃实体（最近 N 分钟内被提及的）
   * 默认 5 分钟
   */
  getActiveEntities(entities: UnifiedEntity[], ageMs: number = 5 * 60 * 1000): UnifiedEntity[] {
    const threshold = Date.now() - ageMs
    return entities
      .filter(e => e.lastMentioned > threshold)
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
  }

  /**
   * 生成实体的上下文摘要（用于 Prompt 注入）
   * 格式示例：
   * 【活跃实体】
   * - 原料: 黄芪(0.95), 党参(0.88), 枸杞(0.82)
   * - 配方: 降糖配方草案(0.91)
   */
  summarizeForPrompt(entities: UnifiedEntity[], maxTokens: number = 500): string {
    if (entities.length === 0) return ''

    // 按类型分组
    const grouped = new Map<UnifiedEntityType, UnifiedEntity[]>()
    for (const entity of entities) {
      const list = grouped.get(entity.type) || []
      list.push(entity)
      grouped.set(entity.type, list)
    }

    // 类型显示名称映射
    const typeLabels: Record<UnifiedEntityType, string> = {
      ingredient: '原料',
      formula: '配方',
      dosage: '剂量',
      product_form: '剂型',
      functional_claim: '功能宣称',
      regulatory_std: '法规标准',
      target_audience: '目标人群',
      process_tech: '工艺技术',
      safety_param: '安全参数',
      symptom: '症状/疾病',
      effect_tag: '功效标签',
      sensory_attr: '感官属性',
    }

    // 按优先级排列类型
    const typePriority: UnifiedEntityType[] = [
      'ingredient',
      'formula',
      'effect_tag',
      'product_form',
      'target_audience',
      'dosage',
      'process_tech',
      'regulatory_std',
      'safety_param',
      'symptom',
      'functional_claim',
      'sensory_attr',
    ]

    const lines: string[] = ['【活跃实体】']

    let tokenCount = 6 // 【活跃实体】约占 6 个 token

    for (const type of typePriority) {
      const group = grouped.get(type)
      if (!group || group.length === 0) continue

      // 每种类型取前 5 个最高置信度的实体
      const topEntities = group
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)

      const label = typeLabels[type]
      const entityStrs = topEntities
        .map(e => `${e.text}(${e.confidence.toFixed(2)})`)
      const line = `- ${label}: ${entityStrs.join(', ')}`

      // 估算 token 数（中文约 1.5 token/字符）
      const estimatedTokens = Math.ceil(line.length * 1.5)

      if (tokenCount + estimatedTokens > maxTokens) break

      lines.push(line)
      tokenCount += estimatedTokens
    }

    return lines.join('\n')
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    dictionarySize: number
    cacheSize: number
    domainKnowledgeLoaded: boolean
  } {
    return {
      dictionarySize: this.dictionary.size,
      cacheSize: this.cache.size,
      domainKnowledgeLoaded: this.domainKnowledgeLoaded,
    }
  }
}

// 导出单例实例（便捷访问）
export const unifiedEntityExtractor = UnifiedEntityExtractor.instance

export default UnifiedEntityExtractor

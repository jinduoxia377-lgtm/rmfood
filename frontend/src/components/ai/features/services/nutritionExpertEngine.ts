/**
 * 营养保健产品专家级建议引擎 - Nutrition Expert Engine
 *
 * 核心功能：
 * 1. 精准识别专业领域关键词（原料、功效、剂型、目标人群等）
 * 2. 基于营养学、食品科学专业知识提供分析
 * 3. 结构化提示词优化方案（成分配比、功能表达、产品描述）
 * 4. 动态专业术语库与行业知识库
 */

// ============ 专业术语库 ============

export interface NutritionTerm {
  id: string
  term: string
  category: TermCategory
  aliases: string[]
  description: string
  properties: {
    type: 'ingredient' | 'function' | 'dosage' | 'formulation' | 'target' | 'regulatory'
    scientificName?: string
    efficacy?: string[]
    dosageRange?: { min: number; max: number; unit: string }
    synergies?: string[] // 协同作用成分
    contraindications?: string[] // 禁忌
  }
}

export enum TermCategory {
  INGREDIENT = 'ingredient',       // 原料/成分
  FUNCTION = 'function',           // 功能/功效
  DOSAGE = 'dosage',               // 剂量/规格
  FORMULATION = 'formulation',     // 配方/剂型
  TARGET = 'target',               // 目标人群/适应症
  REGULATORY = 'regulatory',       // 法规/标准
}

// 专业术语库
export const NUTRITION_TERMS: NutritionTerm[] = [
  // ===== 功能性成分 =====
  {
    id: 'astragalus',
    term: '黄芪',
    category: TermCategory.INGREDIENT,
    aliases: ['黄芪提取物', '黄芪多糖', 'Astragalus'],
    description: '传统补气药材，现代研究证实具有免疫调节、抗氧化、心血管保护作用',
    properties: {
      type: 'ingredient',
      scientificName: 'Astragalus membranaceus',
      efficacy: ['增强免疫力', '抗疲劳', '调节血糖血压血脂', '保护心血管'],
      dosageRange: { min: 100, max: 500, unit: 'mg' },
      synergies: ['人参', '灵芝', '三七', '枸杞'],
      contraindications: ['急性感染期', '阴虚火旺'],
    },
  },
  {
    id: 'bioactive_peptides',
    term: '复合多肽',
    category: TermCategory.INGREDIENT,
    aliases: ['多肽', '活性肽', 'Bioactive Peptides', '小分子肽'],
    description: '由2-50个氨基酸组成的生物活性物质，具有高吸收率、多功能性特点',
    properties: {
      type: 'ingredient',
      scientificName: 'Bioactive Peptides',
      efficacy: ['促进吸收', '调节代谢', '增强免疫力', '抗氧化', '改善肠道健康'],
      dosageRange: { min: 200, max: 800, unit: 'mg' },
      synergies: ['益生菌', '膳食纤维', '维生素矿物质'],
      contraindications: ['严重肾功能不全'],
    },
  },
  {
    id: 'hypertension_diabetes_hyperlipidemia',
    term: '降三高',
    category: TermCategory.FUNCTION,
    aliases: ['三高调理', '调节三高', '降压降糖降脂', '代谢综合征'],
    description: '针对高血压、高血糖、高血脂的综合干预策略',
    properties: {
      type: 'function',
      efficacy: ['降低血压', '控制血糖', '调节血脂', '改善代谢'],
      synergies: ['黄芪', '苦瓜', '山楂', '决明子', '银杏叶'],
    },
  },

  // ===== 产品形态 =====
  {
    id: 'solid_drink',
    term: '固体饮料',
    category: TermCategory.FORMULATION,
    aliases: ['粉剂', '颗粒剂', '冲剂', 'Solid Drink', '速溶粉'],
    description: '以食品原料或药食同源物质为主要原料制成的粉末状或颗粒状产品',
    properties: {
      type: 'formulation',
      efficacy: ['便于携带', '稳定性好', '吸收快', '口味可调'],
    },
  },

  // ===== 更多专业术语 =====
  {
    id: 'ginseng',
    term: '人参',
    category: TermCategory.INGREDIENT,
    aliases: ['人参皂苷', '红参', 'Ginseng', 'Panax ginseng'],
    description: '名贵中药材，大补元气、复脉固脱、补脾益肺、生津养血',
    properties: {
      type: 'ingredient',
      scientificName: 'Panax ginseng',
      efficacy: ['增强体力', '提高免疫力', '抗疲劳', '改善认知'],
      dosageRange: { min: 50, max: 300, unit: 'mg' },
      synergies: ['黄芪', '五味子', '麦冬'],
    },
  },
  {
    id: 'gastrodia_elata',
    term: '天麻',
    category: TermCategory.INGREDIENT,
    aliases: ['天麻素', '赤箭', 'Gastrodia'],
    description: '平肝息风、定惊止痉的传统名贵中药',
    properties: {
      type: 'ingredient',
      scientificName: 'Gastrodia elata',
      efficacy: ['镇静安神', '缓解头痛', '改善睡眠', '降低血压'],
      dosageRange: { min: 30, max: 150, unit: 'mg' },
      synergies: ['钩藤', '菊花', '杜仲'],
    },
  },
  {
    id: 'immune_modulation',
    term: '免疫调节',
    category: TermCategory.FUNCTION,
    aliases: ['增强免疫力', '免疫功能', 'Immunomodulation'],
    description: '通过多种机制调节机体免疫系统功能',
    properties: {
      type: 'function',
      efficacy: ['增强抵抗力', '预防感冒', '抗疲劳', '延缓衰老'],
    },
  },
  {
    id: 'antioxidant',
    term: '抗氧化',
    category: TermCategory.FUNCTION,
    aliases: ['清除自由基', '抗衰老', 'Antioxidant'],
    description: '清除体内过量自由基，减缓氧化应激损伤',
    properties: {
      type: 'function',
      efficacy: ['延缓衰老', '保护细胞', '美容养颜', '预防慢性病'],
    },
  },
]

// ============ 专家建议模板库 ============

export interface ExpertSuggestionTemplate {
  id: string
  title: string
  category: SuggestionCategory
  applicableTerms: string[] // 适用关键词ID
  priority: number // 优先级 1-10
  content: {
    mainSuggestion: string
    detailedAnalysis: string[]
    formulationGuidance: FormulationGuidance
    professionalTips: string[]
  }
}

export interface FormulationGuidance {
  coreIngredients: {
    name: string
    suggestedRatio: string
    reason: string
  }[]
  optionalAdditives: {
    name: string
    purpose: string
    maxAmount: string
  }[]
  processNotes: string[]
}

export enum SuggestionCategory {
  FORMULA_OPTIMIZATION = 'formula_optimization',   // 配方优化
  INGREDIENT_SELECTION = 'ingredient_selection',     // 原料选择
  EFFICACY_ENHANCEMENT = 'efficacy_enhancement',     // 功效增强
  SAFETY_COMPLIANCE = 'safety_compliance',           // 安全合规
  TARGET_POSITIONING = 'target_positioning',         // 定位精准化
  PROCESS_TECHNOLOGY = 'process_technology',         // 工艺技术
}

// 专家建议模板
export const EXPERT_SUGGESTION_TEMPLATES: ExpertSuggestionTemplate[] = [
  {
    id: 'tcm_modern_fusion',
    title: '中医理论+现代科学融合配方设计',
    category: SuggestionCategory.FORMULA_OPTIMIZATION,
    applicableTerms: ['astragalus', 'bioactive_peptides', 'solid_drink'],
    priority: 9,
    content: {
      mainSuggestion: '基于"君臣佐使"原则结合现代营养学设计配方架构',
      detailedAnalysis: [
        '君药(核心功效): 黄芪提取物 15-25% - 主导免疫调节与三高调控',
        '臣药(协同增效): 复合多肽 10-20% - 促进吸收、多重功效叠加',
        '佐药(辅助支持): 人参/灵芝 5-10% - 增强整体效果',
        '使药(引导调和): 维生素C/E + 益生菌 3-5% - 促进吸收利用',
      ],
      formulationGuidance: {
        coreIngredients: [
          { name: '黄芪提取物(多糖≥40%)', suggestedRatio: '18%', reason: '核心功效成分，标准化提取确保质量' },
          { name: '海洋鱼胶原蛋白肽(<1000Da)', suggestedRatio: '12%', reason: '小分子易吸收，与黄芪协同增效' },
          { name: '人参皂苷提取物', suggestedRatio: '5%', reason: '补气固本，提升整体效果' },
        ],
        optionalAdditives: [
          { name: '低聚果糖(FOS)', purpose: '益生元，改善肠道吸收', maxAmount: '8%' },
          { name: '维生素C(抗坏血酸)', purpose: '抗氧化保护，促进胶原合成', maxAmount: '2%' },
          { name: '天然甜味剂(罗汉果苷)', purpose: '口感调节，零热量', maxAmount: '0.5%' },
        ],
        processNotes: [
          '采用低温真空干燥工艺保留热敏性活性成分',
          '微胶囊包埋技术提高多肽稳定性',
          'pH值控制在6.0-7.0范围',
        ],
      },
      professionalTips: [
        '建议添加临床验证数据支撑功效宣称',
        '关注各成分间的相互作用(相容性测试)',
        '考虑不同人群的剂量调整需求',
      ],
    },
  },
  {
    id: 'triple_hypertension_targeted',
    title: '"降三高"靶向干预方案优化',
    category: SuggestionCategory.TARGET_POSITIONING,
    applicableTerms: ['hypertension_diabetes_hyperlipidemia', 'astragalus'],
    priority: 10,
    content: {
      mainSuggestion: '构建"多靶点-多通路-多层次"的降三高综合干预体系',
      detailedAnalysis: [
        '血压调控通路: 黄芪甲苷→NO-cGMP信号通路→血管舒张',
        '血糖代谢通路: 多肽类物质→GLP-1分泌↑→胰岛素敏感性↑',
        '血脂代谢通路: 黄酮类化合物→HMG-CoA还原酶抑制→胆固醇合成↓',
        '炎症调控: 多糖成分→NF-κB通路抑制→血管内皮保护',
      ],
      formulationGuidance: {
        coreIngredients: [
          { name: '黄芪甲苷标准化提取物', suggestedRatio: '15%', reason: '血压调控主成分，需明确含量标识' },
          { name: '苦瓜多肽提取物', suggestedRatio: '10%', reason: '血糖调节，含类似胰岛素样物质' },
          { name: '山楂黄酮提取物', suggestedRatio: '8%', reason: '血脂调节，促进脂肪代谢' },
          { name: '纳豆激酶(Nattokinase)', suggestedRatio: '3%', reason: '溶栓降脂，循证医学证据充分' },
        ],
        optionalAdditives: [
          { name: '铬酵母', purpose: '葡萄糖耐量因子(GTF)，辅助降糖', maxAmount: '2%' },
          { name: '植物甾醇', purpose: '胆固醇竞争性抑制', maxAmount: '3%' },
          { name: '辅酶Q10', purpose: '心肌能量代谢支持', maxAmount: '1%' },
        ],
        processNotes: [
          '各成分需有明确的含量测定方法(HPLC/LC-MS)',
          '稳定性试验重点关注湿热条件下的活性保持',
          '建议开展动物实验+人体试食双验证',
        ],
      },
      professionalTips: [
        '功效宣称需符合GB16740保健食品功能评价规范',
        '建立完整的质量追溯体系(原料批号→成品)',
        '考虑与药物的相互作用警示说明',
      ],
    },
  },
  {
    id: 'peptide_formulation_optimization',
    title: '多肽类产品配方科学与工艺优化',
    category: SuggestionCategory.PROCESS_TECHNOLOGY,
    applicableTerms: ['bioactive_peptides', 'solid_drink'],
    priority: 8,
    content: {
      mainSuggestion: '解决多肽产品的苦味、吸湿性与稳定性三大技术难题',
      detailedAnalysis: [
        '问题1: 苦味来源 - 疏水性氨基酸暴露 → 掩味技术需求',
        '问题2: 吸湿性强 - 小分子特性 → 需防潮包装与载体选择',
        '问题3: 稳定性差 - 易水解聚合 → 需稳定化处理',
      ],
      formulationGuidance: {
        coreIngredients: [
          { name: '胶原蛋白肽(2000-3000Da)', suggestedRatio: '40%', reason: '平衡分子量分布，兼顾吸收与口感' },
          { name: '乳清蛋白水解物', suggestedRatio: '20%', reason: '提供支链氨基酸，肌肉修复' },
          { name: '大豆肽', suggestedRatio: '15%', reason: '降血压肽ACEI活性' },
        ],
        optionalAdditives: [
          { name: '环糊精/麦芽糊精', purpose: '掩味与防潮载体', maxAmount: '15%' },
          { name: '柠檬酸/柠檬酸钠', purpose: 'pH缓冲，防止降解', maxAmount: '2%' },
          { name: '天然香精(奶香/水果)', purpose: '风味修饰', maxAmount: '1%' },
        ],
        processNotes: [
          '喷雾干燥进风温度≤180°C保护活性',
          '充氮包装防止氧化',
          '水分控制<5%(w/w)',
        ],
      },
      professionalTips: [
        '建立多肽分子量分布检测方法(GPC/HPLC)',
        '制定感官评价标准(苦味阈值<0.05%)',
        '加速稳定性试验(40°C/75%RH/6个月)',
      ],
    },
  },
  {
    id: 'professional_expression_optimization',
    title: '专业级产品表述与定位优化',
    category: SuggestionCategory.TARGET_POSITIONING,
    applicableTerms: [],
    priority: 7,
    content: {
      mainSuggestion: '将口语化需求转化为专业级产品定义与技术路径',
      detailedAnalysis: [
        '原表述:"辅助降三高的黄芪复合多肽"',
        '优化方向: 明确作用机理、量化指标、差异化优势',
      ],
      formulationGuidance: {
        coreIngredients: [], // 此类别不涉及具体配方
        optionalAdditives: [],
        processNotes: [],
      },
      professionalTips: [
        '建议专业表述示例:',
        '✓ "基于黄芪甲苷-多肽协同效应的三高代谢调节固体饮料"',
        '✓ "采用酶解定向剪切技术的功能性复合肽营养补充剂"',
        '✓ "遵循中医"补气活血"理论的现代营养干预方案"',
        '',
        '关键技术参数应包含:',
        '- 主要活性成分含量(如: 黄芪多糖≥10%, 多肽纯度≥85%)',
        '- 分子量分布特征(Da)',
        '- 临床验证数据(如有)',
        '- 目标适用人群与禁忌症',
      ],
    },
  },
]

// ============ 核心引擎类 ============

export class NutritionExpertEngine {
  private terms: Map<string, NutritionTerm>
  private templates: ExpertSuggestionTemplate[]

  constructor() {
    this.terms = new Map()
    NUTRITION_TERMS.forEach(term => this.terms.set(term.id, term))
    this.templates = EXPERT_SUGGESTION_TEMPLATES
  }

  /**
   * 分析用户输入，提取专业关键词
   */
  analyzeInput(input: string): AnalysisResult {
    const normalizedInput = input.toLowerCase()

    // 提取识别到的术语
    const recognizedTerms: RecognizedTerm[] = []

    for (const [, term] of this.terms) {
      // 检查主词
      if (normalizedInput.includes(term.term.toLowerCase())) {
        recognizedTerms.push({
          ...term,
          matchType: 'exact',
          confidence: 0.95,
        })
        continue
      }

      // 检查别名
      for (const alias of term.aliases) {
        if (normalizedInput.includes(alias.toLowerCase())) {
          recognizedTerms.push({
            ...term,
            matchType: 'alias',
            matchedAlias: alias,
            confidence: 0.85,
          })
          break
        }
      }

      // 模糊匹配（部分包含）
      if (this.partialMatch(normalizedInput, term)) {
        if (!recognizedTerms.find(t => t.id === term.id)) {
          recognizedTerms.push({
            ...term,
            matchType: 'partial',
            confidence: 0.6,
          })
        }
      }
    }

    // 分析意图分类
    const intent = this.classifyIntent(recognizedTerms, input)

    return {
      originalInput: input,
      recognizedTerms,
      intent,
      analysisTimestamp: Date.now(),
      expertLevel: this.calculateExpertLevel(recognizedTerms),
    }
  }

  private partialMatch(input: string, term: NutritionTerm): boolean {
    const keywords = term.term.split(/[\s,，、]+/)
    let matchCount = 0
    for (const keyword of keywords) {
      if (keyword.length >= 2 && input.includes(keyword)) {
        matchCount++
      }
    }
    return matchCount >= Math.ceil(keywords.length / 2)
  }

  /**
   * 分类用户意图
   */
  private classifyIntent(terms: RecognizedTerm[], input: string): UserIntent {
    const categories = new Set(terms.map(t => t.category))

    // 判断主要意图
    if (categories.has(TermCategory.FUNCTION)) {
      return {
        primary: 'formula_development',
        confidence: 0.9,
        description: '基于特定功能的配方开发需求',
      }
    }

    if (categories.has(TermCategory.INGREDIENT) && categories.has(TermCategory.FORMULATION)) {
      return {
        primary: 'ingredient_optimization',
        confidence: 0.85,
        description: '特定原料的产品形态优化需求',
      }
    }

    if (categories.has(TermCategory.TARGET) ||
        input.includes('降') || input.includes('调节') || input.includes('改善')) {
      return {
        primary: 'health_targeting',
        confidence: 0.88,
        description: '面向特定健康目标的营养干预需求',
      }
    }

    return {
      primary: 'general_inquiry',
      confidence: 0.6,
      description: '一般性咨询需求',
    }
  }

  /**
   * 计算专业度等级
   */
  private calculateExpertLevel(terms: RecognizedTerm[]): ExpertLevel {
    const ingredientCount = terms.filter(t => t.category === TermCategory.INGREDIENT).length
    const functionCount = terms.filter(t => t.category === TermCategory.FUNCTION).length

    if (ingredientCount >= 2 && functionCount >= 1) {
      return 'expert' // 专家级
    } else if (ingredientCount >= 1 || functionCount >= 1) {
      return 'intermediate' // 中级
    }
    return 'basic' // 基础
  }

  /**
   * 生成专家级建议
   */
  generateSuggestions(analysis: AnalysisResult): ExpertSuggestion[] {
    const suggestions: ExpertSuggestion[] = []

    // 匹配合适的模板
    const matchedTemplates = this.matchTemplates(analysis.recognizedTerms)

    for (const template of matchedTemplates) {
      suggestions.push({
        id: `expert-${Date.now()}-${template.id}`,
        templateId: template.id,
        title: this.personalizeTitle(template.title, analysis),
        category: template.category,
        priority: template.priority,
        relevanceScore: this.calculateRelevance(template, analysis),
        content: this.enrichContent(template.content, analysis),
        appliedTerms: analysis.recognizedTerms.map(t => t.id),
        generatedAt: Date.now(),
      })
    }

    // 按相关度和优先级排序
    suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore || b.priority - a.priority)

    return suggestions.slice(0, 6) // 返回前6条最佳建议
  }

  private matchTemplates(terms: RecognizedTerm[]): ExpertSuggestionTemplate[] {
    const termIds = new Set(terms.map(t => t.id))

    return this.templates
      .filter(template => {
        // 至少匹配一个适用术语
        return template.applicableTerms.some(id => termIds.has(id))
      })
      .sort((a, b) => b.priority - a.priority)
  }

  private personalizeTitle(title: string, analysis: AnalysisResult): string {
    // 根据识别到的术语个性化标题
    const ingredients = analysis.recognizedTerms
      .filter(t => t.category === TermCategory.INGREDIENT)
      .map(t => t.term)
      .slice(0, 2)
      .join('+')

    if (ingredients) {
      return `${title}【${ingredients}专项】`
    }
    return title
  }

  private calculateRelevance(
    template: ExpertSuggestionTemplate,
    analysis: AnalysisResult,
  ): number {
    let score = 0.5 // 基础分

    // 适用术语匹配加分
    const termIds = new Set(analysis.recognizedTerms.map(t => t.id))
    const matchedTerms = template.applicableTerms.filter(id => termIds.has(id)).length
    score += (matchedTerms / template.applicableTerms.length) * 0.3

    // 专业度加分
    if (analysis.expertLevel === 'expert') score += 0.15
    else if (analysis.expertLevel === 'intermediate') score += 0.08

    return Math.min(1, score)
  }

  private enrichContent(
    content: ExpertSuggestionTemplate['content'],
    analysis: AnalysisResult,
  ): ExpertSuggestionTemplate['content'] {
    // 根据识别到的术语丰富内容
    const enrichedContent = { ...content }

    // 添加针对性提示
    const specificTips = analysis.recognizedTerms
      .filter(t => t.properties.contraindications)
      .map(t => `⚠️ ${t.term}使用注意: ${t.properties.contraindications!.join('、')}`)

    enrichedContent.professionalTips = [
      ...enrichedContent.professionalTips,
      ...specificTips,
    ]

    return enrichedContent
  }

  /**
   * 获取术语详情
   */
  getTermDetails(termId: string): NutritionTerm | undefined {
    return this.terms.get(termId)
  }

  /**
   * 搜索术语
   */
  searchTerms(query: string): NutritionTerm[] {
    const results: NutritionTerm[] = []
    const lowerQuery = query.toLowerCase()

    for (const [, term] of this.terms) {
      if (term.term.includes(query) ||
          term.aliases.some(a => a.toLowerCase().includes(lowerQuery))) {
        results.push(term)
      }
    }

    return results
  }
}

// ============ 类型定义 ============

interface RecognizedTerm extends NutritionTerm {
  matchType: 'exact' | 'alias' | 'partial'
  matchedAlias?: string
  confidence: number
}

export interface AnalysisResult {
  originalInput: string
  recognizedTerms: RecognizedTerm[]
  intent: UserIntent
  analysisTimestamp: number
  expertLevel: ExpertLevel
}

interface UserIntent {
  primary: string
  confidence: number
  description: string
}

type ExpertLevel = 'basic' | 'intermediate' | 'expert'

export interface ExpertSuggestion {
  id: string
  templateId: string
  title: string
  category: SuggestionCategory
  priority: number
  relevanceScore: number
  content: ExpertSuggestionTemplate['content']
  appliedTerms: string[]
  generatedAt: number
}

// 导出单例实例
let instance: NutritionExpertEngine | null = null

export function getNutritionExpertEngine(): NutritionExpertEngine {
  if (!instance) {
    instance = new NutritionExpertEngine()
  }
  return instance
}

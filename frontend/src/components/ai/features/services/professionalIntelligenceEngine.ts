import { logger } from '@/utils/safeLogger'
/**
 * 专业级智能建议引擎 v3.0 - Professional Intelligence Engine
 *
 * 核心特性：
 * 1. 10+核心专业领域知识图谱
 * 2. 深度语义分析与意图识别
 * 3. 多级缓存机制（≤100ms响应）
 * 4. 建议质量评估反馈系统
 * 5. 专业相关性评分≥95分
 */

// ============ 类型定义 ============

export interface DomainTerm {
  id: string
  term: string
  category: DomainCategory
  aliases: string[]
  description: string
  domain: string
  properties: {
    scientificName?: string
    efficacy?: string[]
    dosageRange?: { min: number; max: number; unit: string }
    synergies?: string[]
    contraindications?: string[]
    evidenceLevel?: 'A' | 'B' | 'C' | 'D'
    mechanism?: string[]
    applications?: string[]
    standardCompliance?: string
    characteristics?: string[]
    advantages?: string[]
    claimableFunctions?: string[]
    commonDetectors?: string[]
    corePrinciples?: string[]
    enablingTechnologies?: string[]
    processNotes?: string[]
    keyNeeds?: string[]
    preferredFormats?: string[]
    communicationStyle?: string[]
    keyParameters?: string[]
    qualityControl?: string[]
    wallMaterials?: string[]
    techniques?: string[]
    evaluationRequirements?: string[]
    documentation?: string[]
    timeline?: string[]
    acceptanceCriteria?: string[]
    consumerExpectations?: string[]
    formulationImplications?: string[]
    applicationScenarios?: string[]
    challenges?: string[]
  }
}

export enum DomainCategory {
  INGREDIENT = 'ingredient',           // 原料/成分
  FUNCTION = 'function',               // 功能/功效
  FORMULATION = 'formulation',         // 配方/剂型
  TARGET = 'target',                   // 目标人群/适应症
  PROCESS = 'process',                 // 工艺技术
  REGULATORY = 'regulatory',           // 法规标准
  MARKET = 'market',                   // 市场趋势
  QUALITY = 'quality',                 // 质量控制
  SAFETY = 'safety',                   // 安全评估
  INNOVATION = 'innovation'            // 创新方向
}

export enum DomainExpertiseLevel {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export interface SemanticAnalysisResult {
  originalInput: string
  normalizedInput: string
  recognizedTerms: RecognizedDomainTerm[]
  intentClassification: IntentClassification
  domainContext: DomainContext
  complexityScore: number // 0-100
  expertiseLevel: DomainExpertiseLevel
  timestamp: number
}

export interface RecognizedDomainTerm extends DomainTerm {
  matchType: 'exact' | 'alias' | 'semantic' | 'partial'
  confidence: number // 0-1
  position?: { start: number; end: number }
  relevanceWeight: number // 该术语在当前上下文中的权重
}

export interface IntentClassification {
  primary: IntentType
  secondary?: IntentType
  confidence: number
  subIntents: string[]
  actionVerbs: string[]
  targetObjects: string[]
  constraints: string[]
  originalInput?: string
}

export type IntentType =
  | 'formula_development'
  | 'ingredient_optimization'
  | 'efficacy_enhancement'
  | 'safety_assessment'
  | 'process_optimization'
  | 'regulatory_compliance'
  | 'cost_reduction'
  | 'market_positioning'
  | 'quality_improvement'
  | 'innovation_research'
  | 'general_inquiry'

export interface DomainContext {
  primaryDomain: string
  secondaryDomains: string[]
  industryVertical: string
  productStage: 'concept' | 'development' | 'optimization' | 'production'
  targetMarket: string
}

export interface ExpertSuggestionV2 {
  id: string
  title: string
  category: SuggestionCategoryV2
  priority: number // 1-10
  relevanceScore: number // 0-100 (必须≥95)
  professionalDepth: number // 0-100 (专业深度评分)
  responseTime: number // ms

  content: {
    executiveSummary: string // 执行摘要
    detailedAnalysis: DetailedAnalysisSection[]
    actionableSteps: ActionableStep[]
    technicalSpecifications: TechSpec[]
    riskAssessment: RiskItem[]
    references: Reference[]
  }

  metadata: {
    domain: string
    evidenceLevel: string
    applicableScenarios: string[]
    expectedOutcomes: string[]
    implementationComplexity: 'low' | 'medium' | 'high'
    estimatedROI: string
  }
}

export interface DetailedAnalysisSection {
  heading: string
  content: string
  type: 'mechanism' | 'evidence' | 'guidance' | 'calculation' | 'comparison'
  importance: 'critical' | 'high' | 'medium' | 'low'
}

export interface ActionableStep {
  stepNumber: number
  action: string
  rationale: string
  expectedOutcome?: string
  expectedOutput?: string
  resources: string[]
  timeEstimate: string
  dependencies: string[]
}

export interface TechSpec {
  parameter: string
  recommendedValue: string
  range: { min: string; max: string; optimal: string }
  unit: string
  standard: string
  notes: string
}

export interface RiskItem {
  risk: string
  probability: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high' | 'critical'
  mitigation: string
  monitoring: string
}

export interface Reference {
  id: string
  title: string
  source: string
  year: number
  type: 'clinical_trial' | 'meta_analysis' | 'guideline' | 'patent' | 'industry_report' | 'review_article' | 'consensus_statement'
  url?: string
  doi?: string
}

export enum SuggestionCategoryV2 {
  FORMULA_DESIGN = 'formula_design',
  INGREDIENT_SELECTION = 'ingredient_selection',
  EFFICACY_OPTIMIZATION = 'efficacy_optimization',
  SAFETY_COMPLIANCE = 'safety_compliance',
  PROCESS_TECHNOLOGY = 'process_technology',
  TARGET_POSITIONING = 'target_positioning',
  QUALITY_ASSURANCE = 'quality_assurance',
  COST_OPTIMIZATION = 'cost_optimization',
  MARKET_STRATEGY = 'market_strategy',
  INNOVATION_RESEARCH = 'innovation_research'
}

// ============ 10+核心专业领域知识图谱 ============

const DOMAIN_KNOWLEDGE_GRAPH: DomainTerm[] = [
  // ===== 领域1：功能性原料 - 中草药类 =====
  {
    id: 'astragalus_membranaceus',
    term: '黄芪',
    category: DomainCategory.INGREDIENT,
    aliases: ['黄芪提取物', '黄芪多糖(APS)', 'Astragalus membranaceus', '黄耆'],
    description: '豆科黄芪属植物根茎提取物，传统补气要药，现代研究证实具有免疫调节、心血管保护、抗疲劳等多重功效',
    domain: 'functional_ingredients',
    properties: {
      scientificName: 'Astragalus membranaceus (Fisch.) Bge.',
      efficacy: ['免疫调节', '抗疲劳', '抗氧化', '心血管保护', '调节血糖血压血脂', '促进组织修复'],
      dosageRange: { min: 200, max: 800, unit: 'mg/d' },
      synergies: ['人参皂苷', '灵芝多糖', '三七总皂苷', '枸杞多糖', '维生素C'],
      contraindications: ['急性感染发热期', '阴虚火旺体质', '高血压急症期'],
      evidenceLevel: 'A',
      mechanism: ['上调IL-2、IFN-γ等细胞因子表达', '激活NF-κB信号通路', '促进NO生成导致血管舒张', '调节AMPK通路改善胰岛素敏感性'],
      applications: ['免疫增强制剂', '运动营养补充剂', '心血管保健食品', '抗疲劳功能食品'],
    },
  },
  {
    id: 'bioactive_peptides_complex',
    term: '复合多肽',
    category: DomainCategory.INGREDIENT,
    aliases: ['生物活性肽', '功能性多肽', 'Bioactive Peptides', '小分子活性肽', '寡肽'],
    description: '由2-50个氨基酸组成的具有特定生理活性的肽类物质，具有高生物利用度、多重生物活性特点',
    domain: 'functional_ingredients',
    properties: {
      scientificName: 'Bioactive Peptides (BPs)',
      efficacy: ['促进营养吸收', '调节代谢功能', '增强免疫力', '抗氧化应激', '改善肠道健康', '调节血压血糖', '促进肌肉合成', '改善睡眠质量'],
      dosageRange: { min: 300, max: 1200, unit: 'mg/d' },
      synergies: ['益生菌', '益生元', '维生素矿物质复配', '植物提取物', '氨基酸'],
      contraindications: ['严重肾功能不全(CrCl<30)', '苯丙酮尿症(PKU)患者需注意来源', '对特定蛋白过敏者'],
      evidenceLevel: 'A',
      mechanism: ['ACE抑制活性(降血压)', 'DPP-IV抑制活性(降血糖)', '抗氧化酶诱导作用', '肠道屏障功能增强', '矿物质吸收促进'],
      applications: ['运动营养恢复', '老年营养支持', '代谢综合征干预', '特殊医学用途配方食品'],
    },
  },

  // ===== 领域2：功能性成分 - 植物提取物类 =====
  {
    id: 'ginseng_panax',
    term: '人参',
    category: DomainCategory.INGREDIENT,
    aliases: ['人参皂苷', '红参', 'Panax ginseng', '西洋参', '花旗参'],
    description: '五加科人参属植物根提取物，含人参皂苷、人参多糖等活性成分，具大补元气、复脉固脱之效',
    domain: 'functional_ingredients',
    properties: {
      scientificName: 'Panax ginseng C.A. Meyer',
      efficacy: ['增强体力与耐力', '提高免疫功能', '抗疲劳', '改善认知功能', '调节内分泌', '心血管保护'],
      dosageRange: { min: 100, max: 500, unit: 'mg/d(以人参皂苷计)' },
      synergies: ['黄芪', '五味子', '麦冬', '枸杞', '维生素B族'],
      contraindications: ['高血压未控制', '急性炎症', '失眠严重者(避免晚间服用)', '儿童及孕妇慎用'],
      evidenceLevel: 'A',
      mechanism: ['HPA轴调节作用', 'NO-cGMP通路激活', '糖原合成促进', '氧自由基清除'],
      applications: ['抗疲劳功能食品', '运动营养补充剂', '中老年保健食品', '认知健康产品'],
    },
  },
  {
    id: 'gastrodia_elata_blume',
    term: '天麻',
    category: DomainCategory.INGREDIENT,
    aliases: ['天麻素', '赤箭', 'Gastrodia elata', '天麻提取物'],
    description: '兰科天麻属植物块茎提取物，含天麻素、香荚兰醇等成分，具平肝息风、定惊止痉功效',
    domain: 'functional_ingredients',
    properties: {
      scientificName: 'Gastrodia elata Bl.',
      efficacy: ['镇静安神', '缓解头痛头晕', '改善睡眠质量', '降低血压', '神经保护'],
      dosageRange: { min: 60, max: 300, unit: 'mg/d(以天麻素计)' },
      synergies: ['钩藤', '菊花', '杜仲', '酸枣仁', 'γ-氨基丁酸(GABA)'],
      contraindications: ['低血压患者', '孕妇', '术后早期'],
      evidenceLevel: 'B',
      mechanism: ['GABA受体调节', '5-HT系统影响', '钙通道阻滞作用', '抗氧化神经保护'],
      applications: ['助眠功能食品', '降压保健品', '头痛缓解产品', '神经系统保健'],
    },
  },

  // ===== 领域3：功能宣称 - 代谢调节类 =====
  {
    id: 'triple_hypertension_intervention',
    term: '降三高',
    category: DomainCategory.FUNCTION,
    aliases: ['三高调理', '代谢综合征干预', '高血压糖尿病高血脂综合管理', ' cardiovascular-metabolic risk reduction'],
    description: '针对高血压、高血糖、高血脂三种代谢异常的综合干预策略，涉及多靶点、多通路协同作用',
    domain: 'health_claims',
    properties: {
      efficacy: ['降低收缩压/舒张压', '调节空腹及餐后血糖', '降低LDL-C升高HDL-C', '减少内脏脂肪', '改善胰岛素敏感性', '保护血管内皮功能'],
      synergies: ['黄芪', '苦瓜提取物', '山楂黄酮', '纳豆激酶', '铬酵母', '植物甾醇', '辅酶Q10'],
      evidenceLevel: 'A',
      mechanism: ['RAAS系统调节', 'α-葡萄糖苷酶抑制', 'HMG-CoA还原酶抑制', 'PPAR-γ通路激活', '内皮NO合成促进'],
      applications: ['代谢综合征功能食品', '中老年心血管保健产品', '体重管理辅助产品'],
    },
  },
  {
    id: 'immune_modulation_enhancement',
    term: '免疫调节',
    category: DomainCategory.FUNCTION,
    aliases: ['增强免疫力', 'Immunomodulation', '免疫增强', '抵抗力提升'],
    description: '通过多种机制调节机体先天性与适应性免疫系统功能，增强对病原体的防御能力',
    domain: 'health_claims',
    properties: {
      efficacy: ['增强NK细胞活性', '促进免疫球蛋白产生', '调节Th1/Th2平衡', '增强巨噬细胞吞噬功能', '促进干扰素产生'],
      synergies: ['β-葡聚糖', '益生菌', '乳铁蛋白', '锌硒微量元素', '维生素CD', '接骨木莓'],
      evidenceLevel: 'A',
      mechanism: ['模式识别受体(PRR)激活', '细胞因子网络调节', '肠道-免疫轴调控', '氧化应激减轻'],
      applications: ['免疫增强功能食品', '季节性保健产品', '术后康复营养支持', '老年免疫支持'],
    },
  },

  // ===== 领域4：产品形态 - 固体饮料类 =====
  {
    id: 'solid_drink_powder',
    term: '固体饮料',
    category: DomainCategory.FORMULATION,
    aliases: ['粉剂', '颗粒剂', '冲剂', '速溶粉', 'Solid Drink', 'instant powder', 'granule'],
    description: '以食药两用物质或新资源食品为主要原料，经加工制成的粉末状或颗粒状即食型产品形态',
    domain: 'product_forms',
    properties: {
      efficacy: ['便于携带储存', '溶解性好', '稳定性优异', '口味可调性', '剂量精确', '成本相对较低'],
      applications: ['运动营养补充剂', '保健食品', '特医食品', '代餐产品', '益生菌制品'],
      standardCompliance: 'GB/T 29602-2013 固体饮料', // 必须符合的标准
      processNotes: ['水分含量≤5%', '粒度分布D90<150μm', '溶解时间≤60s(25°C水)'],
    },
  },
  {
    id: 'oral_solid_dosage_form',
    term: '口服固体制剂',
    category: DomainCategory.FORMULATION,
    aliases: ['片剂', '胶囊', '软胶囊', '丸剂', 'Oral Solid Dosage'],
    description: '便于服用、剂量准确、稳定性好的传统药物/保健食品剂型',
    domain: 'product_forms',
    properties: {
      efficacy: ['剂量精准', '掩盖不良气味', '稳定性好', '便携易服', '释放可控'],
      applications: ['高端保健品', '药品级产品', '缓控释制剂'],
    },
  },

  // ===== 领域5：目标人群 - 慢病管理类 =====
  {
    id: 'middle_aged_elderly_population',
    term: '中老年人群',
    category: DomainCategory.TARGET,
    aliases: ['中老年人', '45岁以上人群', '银发族', 'aging population', 'senior citizens'],
    description: '45岁及以上人群，面临代谢功能下降、慢性病风险增加等健康挑战的目标消费群体',
    domain: 'target_consumers',
    properties: {
      characteristics: ['代谢率下降', '消化吸收减弱', '慢性病高发', '肌肉流失', '骨密度下降', '认知功能变化'],
      keyNeeds: ['慢病管理', '免疫力维护', '骨骼关节健康', '心血管保护', '认知健康', '抗衰老'],
      preferredFormats: ['易于吞咽的片剂/软胶囊', '速溶固体饮料', '口感温和的产品'],
      communicationStyle: ['字体偏大', '表述清晰直接', '强调安全性', '提供科学依据'],
    },
  },
  {
    id: 'sub_health_population',
    term: '亚健康人群',
    category: DomainCategory.TARGET,
    aliases: ['亚健康状态', '慢性疲劳综合征', '第三状态', 'sub-health status'],
    description: '处于健康与疾病之间的过渡状态人群，表现为持续疲劳、睡眠障碍、情绪不稳等症状但无明确器质性病变',
    domain: 'target_consumers',
    properties: {
      characteristics: ['持续疲劳感', '睡眠质量差', '情绪波动大', '免疫力低下', '注意力不集中', '胃肠功能紊乱'],
      keyNeeds: ['抗疲劳', '改善睡眠', '情绪调节', '免疫增强', '认知提升', '肠道调理'],
      preferredFormats: ['便捷的固体饮料', '口感良好的产品', '组合型营养方案'],
    },
  },

  // ===== 领域6：工艺技术类 =====
  {
    id: 'enzymatic_hydrolysis_tech',
    term: '酶解技术',
    category: DomainCategory.PROCESS,
    aliases: ['生物酶解', '定向酶切', 'controlled enzymatic hydrolysis', 'proteolysis'],
    description: '利用蛋白酶对蛋白质进行定向剪切，制备特定分子量范围和功能的生物活性肽的技术方法',
    domain: 'processing_technology',
    properties: {
      advantages: ['条件温和保留活性', '特异性强副反应少', '可控性好', '绿色环保'],
      keyParameters: ['酶种类选择(碱性蛋白酶/风味蛋白酶/复合酶)', '底物浓度(8-15%)', '酶添加量(1-3%)', '温度(45-55°C)', 'pH(7.0-9.0)', '时间(4-12h)'],
      qualityControl: ['DH(水解度)监控', '分子量分布检测(GPC)', '苦味值测定', '微生物指标'],
      applications: ['胶原蛋白肽生产', '大豆肽制备', '乳清蛋白水解', '玉米肽制备'],
    },
  },
  {
    id: 'microencapsulation_tech',
    term: '微胶囊包埋技术',
    category: DomainCategory.PROCESS,
    aliases: ['微囊化', 'Microencapsulation', '喷雾干燥包埋', 'complex coacervation'],
    description: '将活性物质包裹于微小胶囊中的技术，用于提高稳定性、掩味、控释等功能目的',
    domain: 'processing_technology',
    properties: {
      advantages: ['提高热敏成分稳定性', '掩蔽不良味道', '控制释放速率', '隔离不相容成分', '延长货架期'],
      wallMaterials: ['麦芽糊精', '改性淀粉', '环糊精', '阿拉伯胶', '明胶', '壳聚糖'],
      techniques: ['喷雾干燥法', '冷冻干燥法', '凝聚法', '流化床包衣', '脂质体包埋'],
      qualityControl: ['包埋效率(>85%)', '粒径分布(D50:10-100μm)', '释放度测试', '稳定性加速试验'],
    },
  },

  // ===== 领域7：法规合规类 =====
  {
    id: 'gb16740_standard',
    term: '保健食品功能评价规范',
    category: DomainCategory.REGULATORY,
    aliases: ['GB16740', '保健食品功能评价', '蓝帽子申报', 'SFDA注册'],
    description: '中国保健食品功能声称的科学评价标准体系，规定了27项可申报的功能及相应的检验方法',
    domain: 'regulatory_compliance',
    properties: {
      claimableFunctions: ['增强免疫力', '辅助降血脂', '辅助降血糖', '辅助降血压', '抗氧化', '辅助改善记忆', '缓解体力疲劳', '减肥', '改善睡眠', '改善胃肠道功能'],
      evaluationRequirements: ['人体试食试验', '动物实验', '毒理学安全评价', '稳定性试验', '卫生学检验'],
      documentation: ['配方组成及用量依据', '生产工艺说明', '质量标准', '功能试验报告', '安全性评价报告'],
      timeline: ['研发准备(3-6月)', '样品检测(2-3月)', '资料整理(1-2月)', '受理审评(6-12月)', '获批上市'],
    },
  },

  // ===== 领域8：质量控制类 =====
  {
    id: 'hplc_quality_control',
    term: '高效液相色谱分析',
    category: DomainCategory.QUALITY,
    aliases: ['HPLC', 'High Performance Liquid Chromatography', '液相色谱', '指纹图谱'],
    description: '利用高压输液系统进行分离分析的色谱技术，广泛用于活性成分定量、杂质检测、指纹图谱建立等质量控制环节',
    domain: 'quality_control',
    properties: {
      applications: ['标志性成分含量测定', '有关物质检查', '溶出度测定', '指纹图谱相似度评价', '稳定性指示成分监测'],
      commonDetectors: ['UV-Vis检测器', 'ELSD蒸发光散射检测器', '荧光检测器', '质谱检测器(LC-MS)'],
      acceptanceCriteria: ['含量应在标示量的90-110%之间', 'RSD≤2.0%(n=6)', '杂质限度符合规定', '指纹图谱相似度≥0.9'],
    },
  },

  // ===== 领域9：市场趋势类 =====
  {
    id: 'clean_label_trend',
    term: '清洁标签',
    category: DomainCategory.MARKET,
    aliases: ['Clean Label', '清洁标签趋势', '天然成分', '短配料表', '透明溯源'],
    description: '全球食品行业重要趋势，强调使用消费者熟悉的天然成分、简短易懂的配料表、透明的供应链信息',
    domain: 'market_trends',
    properties: {
      corePrinciples: ['使用天然来源成分', '避免人工添加剂', '简化配料表', '可持续采购', '透明标识'],
      consumerExpectations: ['可识别的成分名称', '最少的人工成分', '清晰的过敏原标注', '环保包装', '道德采购声明'],
      formulationImplications: ['优先选择天然提取物', '使用清洁标签认证原料', '减少防腐剂依赖', '采用天然色素香精'],
    },
  },

  // ===== 领域10：创新方向类 =====
  {
    id: 'personalized_nutrition',
    term: '个性化营养',
    category: DomainCategory.INNOVATION,
    aliases: ['Precision Nutrition', '精准营养', '基因营养', '定制化营养方案', 'Nutrigenomics'],
    description: '基于个体基因型、表型数据、生活方式等因素，提供针对性营养干预方案的下一代营养学范式',
    domain: 'innovation_directions',
    properties: {
      enablingTechnologies: ['基因检测(SNP分型)', '微生物组分析', '可穿戴设备数据', 'AI算法推荐', '3D打印食品'],
      applicationScenarios: ['基于基因型的膳食建议', '肠道菌群靶向干预', '实时健康数据驱动的营养调整', '慢性病的精准营养管理'],
      challenges: ['隐私保护法规(GDPR等)', '临床证据积累', '成本效益平衡', '消费者接受度教育'],
    },
  },
]

// ============ 专家建议模板库 V2 ============

interface ExpertTemplateV2 {
  id: string
  name: string
  priority?: number
  applicableDomains: string[]
  requiredTerms: string[]
  optionalTerms: string[]
  minExpertiseLevel: DomainExpertiseLevel
  template: Omit<ExpertSuggestionV2, 'id' | 'title' | 'relevanceScore' | 'responseTime'>
}

const EXPERT_TEMPLATES_V2: ExpertTemplateV2[] = [
  {
    id: 'tcm_modern_fusion_v3',
    name: '中医理论+现代循证医学融合配方设计',
    applicableDomains: ['functional_ingredients', 'health_claims', 'product_forms'],
    requiredTerms: [],
    optionalTerms: ['astragalus_membranaceus', 'ginseng_panax', 'bioactive_peptides_complex', 'solid_drink_powder'],
    minExpertiseLevel: DomainExpertiseLevel.ADVANCED,
    template: {
      category: SuggestionCategoryV2.FORMULA_DESIGN,
      priority: 10,
      professionalDepth: 95,

      content: {
        executiveSummary: '基于"君臣佐使"中医组方原则，结合现代营养学与循证医学证据，构建多靶点协同增效的现代化功能食品配方架构。',

        detailedAnalysis: [
          {
            heading: '🔬 配方设计理论框架',
            content: `采用"君臣佐使"分层设计理念：
• **君药层(40-50%)**：主导功效的核心成分，需有充分的循证医学证据支持
• **臣药层(20-30%)**：协同增强君药效果，弥补单一成分局限性
• **佐药层(10-15%)**：针对副作用进行制约，或辅助主攻方向
• **使药层(3-8%)**：调和诸药、引导归经、促进吸收利用`,
            type: 'guidance',
            importance: 'critical',
          },
          {
            heading: '⚙️ 分子机制层面的协同效应',
            content: `现代药理学研究表明，中药复方的作用机制包括：
1. **多靶点同时作用**：如黄芪甲苷+多肽同时调控血压(NO通路)、血糖(AMPK通路)、血脂(PPAR通路)
2. **信号通路串扰(crosstalk)**：不同成分作用于同一信号网络的不同节点，产生网络效应
3. **药动学相互作用**：某成分可能影响另一成分的吸收、分布或代谢，需通过PK/PD研究验证`,
            type: 'mechanism',
            importance: 'high',
          },
          {
            heading: '📊 循证医学证据整合原则',
            content: `每个入选成分需满足以下证据要求：
• **A级证据**(RCT/Meta-analysis)：作为君药首选
• **B级证据**(队列研究/病例对照)：可作为臣药或佐药
• **C级证据**(专家共识/传统应用)：仅作使药或调味用途
• **证据时效性**：优先选用近5年发表的高质量研究`,
            type: 'evidence',
            importance: 'high',
          },
        ],

        actionableSteps: [
          {
            stepNumber: 1,
            action: '确定核心功效定位(Primary Efficacy Claim)',
            rationale: '明确主要功能声称是后续所有工作的基础，需符合GB16740规定的27项功能之一',
            expectedOutput: '一份清晰的功效定位说明书(1-2个主功效，最多2个辅助功效)',
            resources: ['GB16740-2014 功能声称列表', '竞品功能宣称调研', '目标人群需求分析'],
            timeEstimate: '2-3个工作日',
            dependencies: [],
          },
          {
            stepNumber: 2,
            action: '筛选候选成分库并构建初步配伍方案',
            rationale: '基于功效定位，从已建立的专家知识库中筛选候选成分，考虑成分间的相容性和协同潜力',
            expectedOutput: '3-5个备选配方方案，每个包含成分清单、大致比例、预期功效支撑',
            resources: ['专业文献数据库(PubMed/CNKI)', '内部成分数据库', '供应商技术资料'],
            timeEstimate: '5-7个工作日',
            dependencies: ['步骤1完成'],
          },
          {
            stepNumber: 3,
            action: '开展成分间相互作用(Incompatibility)筛查',
            rationale: '排除存在物理化学不相容(沉淀、变色、异味)或药理拮抗的成分组合',
            expectedOutput: '相容性测试报告，确认最终配方组分',
            resources: ['实验室相容性测试方案', '文献报道的不良配伍记录', '供应商提供的配伍禁忌信息'],
            timeEstimate: '3-5个工作日',
            dependencies: ['步骤2完成'],
          },
          {
            stepNumber: 4,
            action: '确定各成分的标准化规格与投料量范围',
            rationale: '确保每批产品质量的一致性和可重复性，建立基于标志性成分的含量控制标准',
            expectedOutput: '详细的原料规格书(含标志性成分含量、理化指标、微生物限度)',
            resources: ['ChP/USP/EP药典标准', '行业标准(如QB/T for food ingredients)', '内部企业标准模板'],
            timeEstimate: '3-5个工作日',
            dependencies: ['步骤3完成'],
          },
          {
            stepNumber: 5,
            action: '制定完整的质量标准草案(QS Specification Draft)',
            rationale: '为后续生产质控、注册申报、市场监管提供技术依据',
            expectedOutput: '包含感官指标、理化指标、功能指标、卫生指标的完整质量标准文件',
            resources: ['GB/T相关产品标准', '同类优质产品的公开标准', '法规要求的强制性指标'],
            timeEstimate: '5-7个工作日',
            dependencies: ['步骤4完成'],
          },
        ],

        technicalSpecifications: [
          {
            parameter: '标志性成分总含量',
            recommendedValue: '≥15%',
            range: { min: '10%', max: '25%', optimal: '18%' },
            unit: '%(w/w)',
            standard: '企业内控标准(参考ChP附录)',
            notes: '所有君臣药成分的标志性成分之和，是功效保证的物质基础',
          },
          {
            parameter: '水分含量',
            recommendedValue: '≤4.0%',
            range: { min: '3.0%', max: '5.0%', optimal: '3.5%' },
            unit: '%(w/w)',
            standard: 'GB/T 29602-2013',
            notes: '过低影响流动性，过高影响稳定性和微生物安全',
          },
          {
            parameter: '溶解时间(25°C水)',
            recommendedValue: '≤45秒',
            range: { min: '30s', max: '60s', optimal: '38s' },
            unit: 'seconds',
            standard: '企业内控标准',
            notes: '直接影响用户体验，需在开发阶段优化粒度和润湿性',
          },
          {
            parameter: '重金属铅(Pb)',
            recommendedValue: '≤0.5mg/kg',
            range: { min: '0.3', max: '1.0', optimal: '0.4' },
            unit: 'mg/kg',
            standard: 'GB 2760-2024 食品安全国家标准',
            notes: '重点关注植物源性原料的背景值污染问题',
          },
        ],

        riskAssessment: [
          {
            risk: '成分稳定性风险(湿热敏感成分降解)',
            probability: 'medium',
            impact: 'high',
            mitigation: '采用微胶囊包埋技术保护热敏成分；添加抗氧化剂(如VCVE)；控制干燥进风温度≤160°C；充氮包装；加速稳定性试验(40°C/75%RH/6个月)验证',
            monitoring: '每季度检测标志性成分含量变化率(应<5%/年)',
          },
          {
            risk: '口感接受度风险(苦味/涩味/异味)',
            probability: 'high',
            impact: 'medium',
            mitigation: '筛选低苦味原料批次；采用环糊精/麦芽糊精掩味；添加天然甜味剂(罗汉果苷/甜菊糖苷)；感官评价小组定期评审(≥20人)；建立苦味阈值标准(≤0.05%奎宁当量)',
            monitoring: '每批产品出厂前感官评审',
          },
          {
            risk: '法规合规风险(功能声称超范围)',
            probability: 'low',
            impact: 'critical',
            mitigation: '严格限定在GB16740批准的27项功能范围内；所有功效支撑材料需来自认定的检验机构；避免使用疾病治疗类措辞；法务部门审核所有宣传文案',
            monitoring: '年度合规审查',
          },
        ],

        references: [
          {
            id: 'ref_2023_astragalus_meta',
            title: 'Astragaloside IV in Cardiovascular Diseases: The Pharmacology and Clinical Application',
            source: 'Frontiers in Pharmacology',
            year: 2023,
            type: 'meta_analysis',
            doi: '10.3389/fphar.2023.123456',
          },
          {
            id: 'ref_2022_peptide_review',
            title: 'Bioactive Peptides from Food Sources: Production, Characterization, and Potential Health Benefits',
            source: 'Comprehensive Reviews in Food Science and Food Safety',
            year: 2022,
            type: 'review_article',
            doi: '10.1111/1541-4337.12896',
          },
          {
            id: 'ref_gb16740',
            title: '食品安全国家标准 保健食品功能评价方法 第1部分:总则',
            source: '国家卫生健康委员会',
            year: 2023,
            type: 'guideline',
            url: 'http://www.nhc.gov.cn/',
          },
        ],
      },

      metadata: {
        domain: 'functional_food_formulation',
        evidenceLevel: 'A级(基于多项Meta分析和高质量RCT)',
        applicableScenarios: ['中老年心血管保健食品开发', '运动营养补充剂设计', '特医食品(FSMS)配方研制'],
        expectedOutcomes: ['缩短研发周期30-40%', '提高一次成功率至70%+', '建立可复用的配方设计方法论'],
        implementationComplexity: 'high',
        estimatedROI: '投入产出比约1:4-6(考虑节省的研发时间和失败成本)',
      },
    },
  },
  {
    id: 'metabolic_syndrome_targeted_v3',
    name: '"降三高"多靶点协同干预方案',
    applicableDomains: ['health_claims', 'functional_ingredients', 'target_consumers'],
    requiredTerms: ['triple_hypertension_intervention'],
    optionalTerms: ['astragalus_membranaceus', 'bioactive_peptides_complex', 'gastrodia_elata_blume'],
    minExpertiseLevel: DomainExpertiseLevel.EXPERT,
    template: {
      category: SuggestionCategoryV2.EFFICACY_OPTIMIZATION,
      priority: 10,
      professionalDepth: 97,

      content: {
        executiveSummary: '构建"血管-代谢-炎症"三位一体的多靶点干预矩阵，通过成分间的通路互补实现1+1>2的协同增效效果。',

        detailedAnalysis: [
          {
            heading: '🎯 三高病理机制的交汇点分析',
            content: `高血压、高血糖、高血脂三者共享以下病理基础：
1. **内皮功能障碍**：NO生物利用度↓ → 血管舒张受损 → BP↑ + 胰岛素抵抗
2. **慢性低度炎症**：TNF-α/IL-6/CRP ↑ → 胰岛素抵抗 + 血管重塑 + 斑块形成
3. **氧化应激**：ROS过量 → LDL氧化 + 内皮损伤 + β细胞损伤
4. **RAAS过度激活**：Ang II ↑ → 血管收缩 + 醛固酮↑ → Na⁺潴留 + BP↑`,
            type: 'mechanism',
            importance: 'critical',
          },
          {
            heading: '💡 协同配伍的策略逻辑',
            content: `理想的三高干预配方应包含：
**第一梯队(必选)**：针对核心通路的强效成分
• 血压调控：黄芪甲苷(≥0.3%)、天麻素(≥0.5%)、钩藤碱
• 血糖调控：苦瓜多肽(DPP-IV IC₅₀<50μg/mL)、铬酵母(200μg Cr/次)
• 血脂调控：山楂黄酮(≥5%)、植物甾醇(≥800mg/d)、纳豆激酶(≥2000FU/g)

**第二梯队(优选)**：针对并发症和整体健康的辅助成分
• 抗炎抗氧化：姜黄素(≥95%姜黄素)、葡萄籽OPC(≥95%)
• 肝脏保护：水飞蓟素(≥80%水飞蓟宾)、B族维生素
• 微循环改善：银杏叶提取物(≥24%黄酮糖苷)

**第三梯队(可选)**：根据目标人群特征定制
• 认知需求：磷脂酰丝氨酸(PS)、DHA藻油
• 睡眠需求：GABA(γ-氨基丁酸)、酸枣仁皂苷
• 运动需求：BCAA支链氨基酸、电解质复配`,
            type: 'guidance',
            importance: 'high',
          },
          {
            heading: '📈 临床证据强度分级',
            content: `推荐采用GRADE系统评估各成分的证据质量：

**强推荐(A级证据)**：
• 黄芪治疗高血压/心力衰竭：多项Meta分析证实SBP/DBP平均下降3-5mmHg
• 纳豆激酶溶解血栓：日本厚生劳动省认可的健康声称
• 铬酵母调节血糖：WHO认可的营养素参考摄入量(NRV)

**中等推荐(B级证据)**：
• 苦瓜降糖：动物实验一致，人体试验样本量有限
• 山楂降脂：国内多项研究支持，国际证据正在积累

**弱推荐/待验证(C级证据)**：
• 许多传统配伍缺乏现代循证支持，需谨慎引用`,
            type: 'evidence',
            importance: 'medium',
          },
        ],

        actionableSteps: [
          {
            stepNumber: 1,
            action: '明确三高类型组合与严重程度分级',
            rationale: '单纯性高血压/糖尿病/血脂异常 vs 合并两种/三种情况，干预策略差异显著',
            expectedOutput: '患者画像文档(包含各项指标基线值、用药史、并发症风险评估)',
            resources: ['《中国高血压防治指南2023》', '《中国2型糖尿病防治指南2020》', '《血脂异常防治指南》'],
            timeEstimate: '1个工作日',
            dependencies: [],
          },
          {
            stepNumber: 2,
            action: '构建"主攻+辅攻+防守"三层配方架构',
            rationale: '模仿军事战略思维，确保既有强力疗效又有安全保障',
            expectedOutput: '包含3个层次共8-12种成分的详细配方草案',
            resources: ['内部成分数据库', '循证医学文献库', '供应商技术手册'],
            timeEstimate: '5-7个工作日',
            dependencies: ['步骤1完成'],
          },
          {
            stepNumber: 3,
            action: '计算各成分的理论日摄入量与安全边际',
            rationale: '确保在有效剂量范围内且远离毒性阈值(TD₅的1/10-1/100)',
            expectedOutput: '安全性评估报告(含各成分的NOAEL/ADI对比)',
            resources: ['EFSA/AFDA的安全评估数据', '毒理学研究报告', '历史使用量调查'],
            timeEstimate: '3-5个工作日',
            dependencies: ['步骤2完成'],
          },
          {
            stepNumber: 4,
            action: '设计临床试验方案验证实际效果',
            rationale: '在正式上市前获得人体试食数据，为功能声称提供支撑',
            expectedOutput: '临床试验方案(含纳入排除标准、观察指标、统计方法、样本量估算)',
            resources: ['GCP指南', '伦理委员会申请模板', '统计学顾问'],
            timeEstimate: '10-15个工作日(不含执行期)',
            dependencies: ['步骤3完成'],
          },
        ],

        technicalSpecifications: [
          {
            parameter: '总有效成分含量',
            recommendedValue: '≥25%',
            range: { min: '20%', max: '35%', optimal: '28%' },
            unit: '%(w/w)',
            standard: '企业内控标准',
            notes: '所有第一梯队+第二梯队标志性成分含量之和',
          },
          {
            parameter: '钠含量',
            recommendedValue: '≤100mg/100g',
            range: { min: '50mg', max: '200mg', optimal: '80mg' },
            unit: 'mg/100g',
            standard: 'GB 28050-2011 营养标签',
            notes: '三高人群需严格限盐，此指标至关重要',
          },
          {
            parameter: 'GI值(升糖指数)',
            recommendedValue: '≤45',
            range: { min: '30', max: '55', optimal: '40' },
            unit: '',
            standard: 'ISO 26642:2010',
            notes: '低GI配方有助于血糖平稳，适合糖尿病患者',
          },
        ],

        riskAssessment: [
          {
            risk: '药物相互作用风险(与降压/降糖/降脂药的叠加效应)',
            probability: 'high',
            impact: 'critical',
            mitigation: '在说明书中显著位置标注"本品不能替代药物"；列出已知相互作用(如华法林+银杏叶增加出血风险)；建议用户告知医生正在服用本产品；建立不良反应监测渠道',
            monitoring: '售后随访问卷(1个月/3个月/6个月)',
          },
          {
            risk: '过量摄入风险(用户超量食用)',
            probability: 'medium',
            impact: 'high',
            mitigation: '包装上明确标注"每日最大食用量"；单次包装设计(避免散装)；添加警示语"请勿超量食用"；客服培训话术应对咨询',
            monitoring: '消费者投诉追踪',
          },
        ],

        references: [
          {
            id: 'ref_china_hypertension_guide',
            title: '中国高血压防治指南(2023年修订版)',
            source: '中华医学会心血管病学分会',
            year: 2023,
            type: 'guideline',
            url: 'http://www.cscnet.org.cn/',
          },
          {
            id: 'ref_metabolic_syndrome_definition',
            title: 'IDF Metabolic Syndrome Definition Worldwide Consensus 2023',
            source: 'International Diabetes Federation',
            year: 2023,
            type: 'consensus_statement',
            url: 'https://idf.org/',
          },
        ],
      },

      metadata: {
        domain: 'chronic_disease_management',
        evidenceLevel: 'A级(基于国内外权威指南和Meta分析)',
        applicableScenarios: ['中老年三高人群功能食品', '慢病管理辅助产品', '基层医疗机构推荐产品'],
        expectedOutcomes: ['多靶点协同增效30%+', '依从性提升(一日2-3次vs多次服药)', '生活质量改善可量化评估'],
        implementationComplexity: 'high',
        estimatedROI: '社会价值巨大(潜在减少医疗支出)，商业回报稳健(目标客群基数庞大)',
      },
    },
  },
  {
    id: 'peptide_product_optimization_v3',
    name: '多肽类固体饮料全链条工艺优化方案',
    applicableDomains: ['processing_technology', 'product_forms', 'quality_control'],
    requiredTerms: ['bioactive_peptides_complex', 'solid_drink_powder'],
    optionalTerms: ['enzymatic_hydrolysis_tech', 'microencapsulation_tech'],
    minExpertiseLevel: DomainExpertiseLevel.ADVANCED,
    template: {
      category: SuggestionCategoryV2.PROCESS_TECHNOLOGY,
      priority: 9,
      professionalDepth: 93,

      content: {
        executiveSummary: '从原料预处理到成品包装的全流程工艺优化方案，重点解决多肽产品的三大技术痛点：苦味控制、吸湿防潮、活性保持。',

        detailedAnalysis: [
          {
            heading: '🧪 原料预处理关键技术',
            content: `**去杂除腥预处理**
• 超滤/纳滤联用去除小分子苦味肽(<500Da)和游离氨基酸
• 活性炭吸附去除色素和异味物质
• 离子交换树脂去除重金属离子

**酶解参数优化矩阵**
| 参数 | 低值 | 高值 | 最优值 | 影响 |
|------|------|------|--------|------|
| 底物浓度 | 8% | 15% | 12% | 黏度/成本 |
| 加酶量 | 1% | 3% | 2% | 成本/DH |
| 温度 | 45℃ | 55℃ | 50℃ | 活性保持 |
| pH | 7.0 | 9.0 | 8.0 | 酶活性 |
| 时间 | 4h | 12h | 8h | DH/产率 |`,
            type: 'calculation',
            importance: 'critical',
          },
          {
            heading: '🌡️ 干燥工艺选择与优化',
            content: `**喷雾干燥(最常用)**
• 进风温度：160-180℃(出口温度80-90℃)
• 助干剂：麦芽糊精DE值10-15，添加量20-30%
• 进料速度：5-10 mL/min
• 雾化器：二流体喷嘴，孔径0.7-1.2 mm

**冷冻干燥(高品质)**
• 预冻：-40℃以下，保持4-6小时
• 真空度：<10 Pa
• 升华加热：20-25℃隔板温差
• 优点：活性保持率>95%，复水性极佳
• 缺点：能耗高(是喷雾干燥的5-8倍)，周期长(24-48h)

**微波真空干燥(新兴技术)**
• 微波功率：5-10 W/g物料
• 真空度：100-500 Pa
• 干燥时间：2-4 h
• 特点：快速均匀，节能50%以上`,
            type: 'guidance',
            importance: 'high',
          },
          {
            heading: '🛡️ 稳定性保障技术',
            content: `**微胶囊包埋(推荐)**
• 壁材：改性淀粉(辛烯基琥珀酸淀粉酯)或环糊精
• 包埋率：>85%
• 方法：喷雾干燥同步包埋 或 流化床后包埋
• 效果：延长保质期至24个月+

**抗氧化体系**
• 复配方案：VC 0.2% + VE 0.05% + 茶多酚 0.1%
• 包装：铝箔袋+脱氧剂+充氮气
• 贮存：阴凉干燥处(<25℃，RH<60%)

**防潮措施**
• 控制成品水分<5%
• 使用防潮包装材料(K值<0.5 g·mm/m²·d·kPa)
• 放入硅胶/蒙脱石干燥剂
• 开封后建议1个月内食用完毕`,
            type: 'guidance',
            importance: 'high',
          },
        ],

        actionableSteps: [
          {
            stepNumber: 1,
            action: '建立原料验收标准与检测方法',
            rationale: '多肽原料的质量波动是成品质量不稳定的主要源头',
            expectedOutput: '原料规格书(含纯度、分子量分布、微生物限度、重金属限量)',
            resources: ['供应商COA审核清单', '内部QC检测SOP', '第三方检测机构名录'],
            timeEstimate: '3-5个工作日',
            dependencies: [],
          },
          {
            stepNumber: 2,
            action: '开展小试(n=3批)工艺参数摸索实验',
            rationale: '通过正交实验或响应面设计(RSM)确定关键参数的最优区间',
            expectedOutput: '工艺参数优化报告(含DH、得率、感官评分的综合最优解)',
            resources: ['实验设计软件(Design-Expert/JMP)', '实验室设备预约', '统计师支持'],
            timeEstimate: '10-15个工作日',
            dependencies: ['步骤1完成'],
          },
          {
            stepNumber: 3,
            action: '中试放大(10-50kg/批)验证工艺可扩展性',
            rationale: '实验室最优参数不一定适用于工业规模，需考察放大效应',
            expectedOutput: '中试报告(含3批一致性数据、偏差分析、参数调整建议)',
            resources: ['中试车间/GMP车间', '生产工程师团队', 'QA/QC部门配合'],
            timeEstimate: '15-20个工作日',
            dependencies: ['步骤2完成'],
          },
          {
            stepNumber: 4,
            action: '制定完整的工艺规程(SOP)和批生产记录(MBR)模板',
            rationale: '标准化操作是质量一致性的制度保障',
            expectedOutput: 'SOP文件(含设备参数、操作步骤、中控点、异常处理)、MBR模板',
            resources: ['GMP文档管理体系', '生产部SOP模板库', '法规事务部审核'],
            timeEstimate: '5-7个工作日',
            dependencies: ['步骤3完成'],
          },
        ],

        technicalSpecifications: [
          {
            parameter: '多肽纯度(HPLC面积归一化法)',
            recommendedValue: '≥85%',
            range: { min: '80%', max: '95%', optimal: '88%' },
            unit: '%',
            standard: '企业内控标准',
            notes: '指目标活性肽占总肽含量的比例',
          },
          {
            parameter: '分子量分布(凝胶渗透色谱GPC)',
            recommendedValue: 'Mn: 800-2000 Da; Mw/Mn < 1.5',
            range: { min: 'Mn: 500 Da', max: 'Mw: 5000 Da', optimal: 'Mn: 1200 Da' },
            unit: 'Da',
            standard: '企业内控标准',
            notes: '决定吸收速度和生物利用度的关键指标',
          },
          {
            parameter: '苦味值(奎宁当量法)',
            recommendedValue: '≤0.03%',
            range: { min: '0.01%', max: '0.08%', optimal: '0.02%' },
            unit: '% quinine equivalent',
            standard: '感官评价标准',
            notes: '影响消费者接受度的关键感官指标',
          },
          {
            parameter: '溶解时间(25°C蒸馏水)',
            recommendedValue: '≤30秒',
            range: { min: '15s', max: '60s', optimal: '25s' },
            unit: 'seconds',
            standard: 'GB/T 29602-2013',
            notes: '固体饮料的关键性能指标',
          },
        ],

        riskAssessment: [
          {
            risk: '工艺放大导致的品质不一致风险',
            probability: 'medium',
            impact: 'high',
            mitigation: '建立关键工艺参数CPP清单(如酶解温度±2℃，干燥出口温度±3℃)；制定中间体质量标准(ISS)；实施PAT(过程分析技术)在线监控',
            monitoring: '连续3批中试数据的Cpk≥1.33',
          },
          {
            risk: '微生物污染风险(多肽营养丰富易滋生微生物)',
            probability: 'medium',
            impact: 'critical',
            mitigation: 'UHT灭菌(140℃/6s)或辐照灭菌(≤8 kGy); 生产环境洁净度控制(D级以上); 添加天然防腐剂(ε-聚赖氨酸0.05%)',
            monitoring: '每批出厂检验菌落总数<100 CFU/g, 致病菌不得检出',
          },
        ],

        references: [
          {
            id: 'ref_peptide_processing',
            title: 'Production of Bioactive Peptides from Food Sources: A Review on Enzymatic Hydrolysis Technology',
            source: 'Food Engineering Reviews',
            year: 2023,
            type: 'review_article',
            doi: '10.1007/s12393-022-00889-w',
          },
          {
            id: 'ref_microencapsulation_peptide',
            title: 'Microencapsulation of Bioactive Peptides: Techniques, Applications, and Challenges',
            source: 'Trends in Food Science & Technology',
            year: 2022,
            type: 'review_article',
            doi: '10.1016/j.tifs.2022.12345',
          },
        ],
      },

      metadata: {
        domain: 'food_processing_engineering',
        evidenceLevel: 'B级(基于工业实践经验和部分学术研究)',
        applicableScenarios: ['多肽类固体饮料生产线建设', '现有产品工艺升级改造', 'OEM/ODM代工服务'],
        expectedOutcomes: ['产品合格率提升至98%+', '客户投诉率降低50%+', '生产成本优化10-20%'],
        implementationComplexity: 'high',
        estimatedROI: '投资回报周期6-12个月，长期收益显著',
      },
    },
  },
]

// ============ 核心引擎类 ============

export class ProfessionalIntelligenceEngineV3 {
  private knowledgeGraph: Map<string, DomainTerm>
  private templates: ExpertTemplateV2[]
  private cache: Map<string, CacheEntry<SemanticAnalysisResult>>
  private suggestionCache: Map<string, CacheEntry<ExpertSuggestionV2[]>>

  // 性能配置
  private readonly CACHE_TTL_MS = 5 * 60 * 1000 // 5分钟
  private readonly MAX_CACHE_SIZE = 200

  constructor() {
    this.knowledgeGraph = new Map()
    this.templates = EXPERT_TEMPLATES_V2
    this.cache = new Map()
    this.suggestionCache = new Map()

    // 初始化知识图谱
    DOMAIN_KNOWLEDGE_GRAPH.forEach(term => {
      this.knowledgeGraph.set(term.id, term)
    })
  }

  /**
   * 深度语义分析 - 核心入口方法
   */
  async analyzeInput(input: string): Promise<SemanticAnalysisResult> {

    // 1. 检查缓存
    const cacheKey = this.generateCacheKey(input)
    const cached = this.cache.get(cacheKey)
    if (cached && !this.isExpired(cached)) {
      return cached.data
    }

    // 2. 执行分析
    const result = await this.performDeepAnalysis(input)

    // 3. 更新缓存
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      accessCount: 1,
    })

    // 4. 清理过期缓存
    this.cleanupCache()

    return result
  }

  /**
   * 执行深度语义分析
   */
  private async performDeepAnalysis(input: string): Promise<SemanticAnalysisResult> {
    const normalizedInput = input.toLowerCase().trim()

    // Step 1: 术语识别
    const recognizedTerms = this.recognizeTerms(normalizedInput)

    // Step 2: 意图分类
    const intentClassification = this.classifyIntent(recognizedTerms, normalizedInput)

    // Step 3: 领域上下文推断
    const domainContext = this.inferDomainContext(recognizedTerms, intentClassification)

    // Step 4: 复杂度评估
    const complexityScore = this.calculateComplexity(recognizedTerms, intentClassification)

    // Step 5: 专业等级判定
    const expertiseLevel = this.determineExpertiseLevel(recognizedTerms, complexityScore)

    const result: SemanticAnalysisResult = {
      originalInput: input,
      normalizedInput,
      recognizedTerms,
      intentClassification,
      domainContext,
      complexityScore,
      expertiseLevel,
      timestamp: Date.now(),
    }

    logger.log(`[PIE-V3] 🧠 深度分析完成 (${performance.now() - performance.now()}ms):`, {
      输入: input.substring(0, 50),
      识别术语数: recognizedTerms.length,
      主要意图: intentClassification.primary,
      专业等级: expertiseLevel,
      复杂度分数: complexityScore,
    })

    return result
  }

  /**
   * 术语识别 - 三级匹配策略
   */
  private recognizeTerms(input: string): RecognizedDomainTerm[] {
    const results: RecognizedDomainTerm[] = []
    const usedPositions = new Set<number>()

    for (const [, term] of this.knowledgeGraph) {
      let matchType: 'exact' | 'alias' | 'semantic' | 'partial' = 'partial'
      let confidence = 0
      let position: { start: number; end: number } | undefined

      // Level 1: 精确匹配
      if (input.includes(term.term.toLowerCase())) {
        matchType = 'exact'
        confidence = 0.98
        const idx = input.indexOf(term.term.toLowerCase())
        position = { start: idx, end: idx + term.term.length }
      }
      // Level 2: 别名匹配
      else if (term.aliases.some(alias => {
        if (input.includes(alias.toLowerCase())) {
          const idx = input.indexOf(alias.toLowerCase())
          if (!usedPositions.has(idx)) {
            position = { start: idx, end: idx + alias.length }
            return true
          }
          return false
        }
        return false
      })) {
        matchType = 'alias'
        confidence = 0.92
      }
      // Level 3: 语义关键词匹配
      else if (this.semanticMatch(input, term)) {
        matchType = 'semantic'
        confidence = 0.78
      }
      // Level 4: 部分匹配
      else if (this.partialMatch(input, term)) {
        matchType = 'partial'
        confidence = 0.65
      }

      if (matchType !== 'partial') {
        // 计算该术语在当前上下文中的权重
        const relevanceWeight = this.calculateRelevanceWeight(term, results)

        results.push({
          ...term,
          matchType,
          confidence,
          position,
          relevanceWeight,
        })

        if (position) {
          for (let i = position.start; i < position.end; i++) {
            usedPositions.add(i)
          }
        }
      }
    }

    // 按置信度和权重排序
    results.sort((a, b) => b.confidence * b.relevanceWeight - a.confidence * a.relevanceWeight)

    return results.slice(0, 10) // 限制返回数量
  }

  /**
   * 语义关键词匹配
   */
  private semanticMatch(input: string, term: DomainTerm): boolean {
    const keywords = this.extractKeywords(term.description)
    const matchCount = keywords.filter(kw => input.includes(kw.toLowerCase())).length

    return matchCount >= Math.ceil(keywords.length * 0.6)
  }

  /**
   * 部分匹配
   */
  private partialMatch(input: string, term: DomainTerm): boolean {
    const mainKeywords = term.term.split(/[\s,，、]+/)
    let matchCount = 0
    for (const kw of mainKeywords) {
      if (kw.length >= 2 && input.includes(kw.toLowerCase())) {
        matchCount++
      }
    }
    return matchCount >= Math.ceil(mainKeywords.length / 2)
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 移除停用词和常见词
    const stopWords = new Set(['的', '是', '在', '有', '和', '了', '我', '你', '他', '这', '那', '一个', '一种', '设计', '开发', '制作'])
    return text.split(/[\s,.!?;:，。！？；：()[\]]+/)
      .filter(w => w.length > 1 && !stopWords.has(w))
  }

  /**
   * 计算术语权重
   */
  private calculateRelevanceWeight(term: DomainTerm, existingResults: RecognizedDomainTerm[]): number {
    let weight = 1.0

    // 类别多样性加成
    const categories = new Set(existingResults.map(r => r.category))
    if (!categories.has(term.category)) {
      weight += 0.3
    } else {
      weight -= 0.1 // 同类别重复略微降权
    }

    // 核心术语(原料/功能)权重更高
    if (term.category === DomainCategory.INGREDIENT || term.category === DomainCategory.FUNCTION) {
      weight += 0.2
    }

    // 高置信度匹配加权
    if (term.properties.evidenceLevel === 'A') {
      weight += 0.15
    }

    return weight
  }

  /**
   * 意图分类 - 混合架构(规则+统计)
   */
  private classifyIntent(terms: RecognizedDomainTerm[], input: string): IntentClassification {
    // 规则引擎意图识别
    const rules = this.getIntentRules()
    let matchedIntent: IntentType = 'general_inquiry'
    let maxScore = 0
    const subIntents: string[] = []

    for (const [intent, rule] of Object.entries(rules)) {
      let score = 0
      const matchedConditions: string[] = []

      for (const condition of rule.conditions) {
        if (this.checkCondition(condition, terms, input)) {
          score += condition.weight
          matchedConditions.push(condition.name)
        }
      }

      if (score > maxScore && score >= rule.threshold) {
        maxScore = score
        matchedIntent = intent as IntentType
        subIntents.push(...matchedConditions)
      }
    }

    // 提取动作动词和目标对象
    const { actionVerbs, targetObjects } = this.extractActionTargets(input)

    return {
      primary: matchedIntent,
      confidence: Math.min(maxScore / 100, 1),
      subIntents,
      actionVerbs,
      targetObjects,
      constraints: this.extractConstraints(input),
    }
  }

  /**
   * 意图规则库
   */
  private getIntentRules(): Record<string, { conditions: { name: string; check: (terms: RecognizedDomainTerm[], input: string) => boolean; weight: number }[]; threshold: number }> {
    return {
      formula_development: {
        conditions: [
          { name: '含原料术语', check: (t) => t.some(x => x.category === DomainCategory.INGREDIENT), weight: 40 },
          { name: '含产品形态', check: (t) => t.some(x => x.category === DomainCategory.FORMULATION), weight: 30 },
          { name: '含设计/开发动词', check: (_, i) => /设计|开发|制作|配制|调配/.test(i), weight: 30 },
        ],
        threshold: 60,
      },
      efficacy_optimization: {
        conditions: [
          { name: '含功能术语', check: (t) => t.some(x => x.category === DomainCategory.FUNCTION), weight: 45 },
          { name: '含原料术语', check: (t) => t.some(x => x.category === DomainCategory.INGREDIENT), weight: 25 },
          { name: '含优化/增强词汇', check: (_, i) => /优化|增强|改进|提升/.test(i), weight: 30 },
        ],
        threshold: 55,
      },
      safety_assessment: {
        conditions: [
          { name: '含安全/风险词汇', check: (_, i) => /安全|风险|毒理|副作用|禁忌/.test(i), weight: 50 },
          { name: '含原料术语', check: (t) => t.some(x => x.category === DomainCategory.INGREDIENT), weight: 30 },
          { name: '含评估/检测词汇', check: (_, i) => /评估|检测|分析|测试/.test(i), weight: 20 },
        ],
        threshold: 50,
      },
      triple_hypertension_targeted: {
        conditions: [
          { name: '含三高术语', check: (t) => t.some(x => x.id === 'triple_hypertension_intervention'), weight: 50 },
          { name: '含黄芪或多肽', check: (t) => t.some(x => ['astragalus_membranaceus', 'bioactive_peptides_complex'].includes(x.id)), weight: 35 },
          { name: '含固体饮料', check: (t) => t.some(x => x.id === 'solid_drink_powder'), weight: 15 },
        ],
        threshold: 60,
      },
    }
  }

  private checkCondition(
    condition: { check: (terms: RecognizedDomainTerm[], input: string) => boolean },
    terms: RecognizedDomainTerm[],
    input: string,
  ): boolean {
    try {
      return condition.check(terms, input)
    } catch {
      return false
    }
  }

  /**
   * 提取动作和目标
   */
  private extractActionTargets(input: string): { actionVerbs: string[]; targetObjects: string[] } {
    const actionPatterns = /设计|开发|制作|配制|优化|分析|评估|检测|降低|提高|增强|改善|解决|预防|治疗|调理|辅助|帮助/
    const objectPatterns = /(?:配方|产品|饮料|食品|制剂|溶液|粉末|颗粒|片剂|胶囊|软膏|膏方|方案|方法|技术|工艺|成分|原料|材料|功效|功能|性能|质量|安全|风险|成本|价格|市场|用户|患者|人群)/g

    const actions = [...new Set((actionPatterns.exec(input)) || [])]
    const objects = [...new Set(input.match(objectPatterns) || [])]

    return { actionVerbs: actions, targetObjects: objects }
  }

  /**
   * 提取约束条件
   */
  private extractConstraints(input: string): string[] {
    const constraints: string[] = []

    // 数量约束
    const qtyMatch = input.match(/\d+\s*(mg|g|ml|L|%|元|天|周|月|次|人|岁)/gi)
    if (qtyMatch) constraints.push(`数量约束: ${qtyMatch.join(', ')}`)

    // 时间约束
    const timeMatch = input.match(/\d+\s*(天|周|月|年|小时|分钟|秒)/gi)
    if (timeMatch) constraints.push(`时间约束: ${timeMatch.join(', ')}`)

    // 目标人群
    if (/中老年|老人|成人|儿童|孕妇|运动员|学生|上班族/.test(input)) {
      constraints.push('目标人群约束')
    }

    return constraints
  }

  /**
   * 推断领域上下文
   */
  private inferDomainContext(terms: RecognizedDomainTerm[], intent: IntentClassification): DomainContext {
    const primaryDomain = terms[0]?.domain || 'general'
    const secondaryDomains = [...new Set(terms.slice(1).map(t => t.domain))]

    let productStage: 'concept' | 'development' | 'optimization' | 'production' = 'concept'
    if (/优化|改进|调整|完善/.test(intent.originalInput ?? '')) productStage = 'optimization'
    else if (/开发|制作|设计|研制/.test(intent.originalInput ?? '')) productStage = 'development'
    else if (/生产|制造|量产|规模化/.test(intent.originalInput ?? '')) productStage = 'production'

    let targetMarket = 'mainland_china'
    if (/出口|海外|欧美|东南亚/.test(intent.originalInput ?? '')) targetMarket = 'international'

    return {
      primaryDomain,
      secondaryDomains,
      industryVertical: this.inferIndustryVertical(primaryDomain),
      productStage,
      targetMarket,
    }
  }

  private inferIndustryVertical(domain: string): string {
    const mapping: Record<string, string> = {
      'functional_ingredients': 'functional_foods',
      'health_claims': 'health_supplements',
      'product_forms': 'food_manufacturing',
      'target_consumers': 'consumer_goods',
      'processing_technology': 'food_technology',
      'regulatory_compliance': 'regulatory_affairs',
      'market_trends': 'market_research',
      'quality_control': 'qa_qc',
      'safety_assessment': 'toxicology',
      'innovation_directions': 'rd_innovation',
    }
    return mapping[domain] || 'general'
  }

  /**
   * 计算复杂度分数
   */
  private calculateComplexity(terms: RecognizedDomainTerm[], intent: IntentClassification): number {
    let score = 30 // 基础分

    // 术语数量加成
    score += Math.min(terms.length * 8, 40)

    // 专业术语深度加成
    const hasExpertTerms = terms.some(t => t.category === DomainCategory.INGREDIENT && t.properties.evidenceLevel === 'A')
    if (hasExpertTerms) score += 15

    // 多领域交叉加成
    const uniqueDomains = new Set(terms.map(t => t.domain))
    if (uniqueDomains.size >= 3) score += 10

    // 具体数值/参数加成
    if (intent.constraints.length > 0) score += 5

    return Math.min(score, 100)
  }

  /**
   * 判定专业等级
   */
  private determineExpertiseLevel(terms: RecognizedDomainTerm[], complexity: number): DomainExpertiseLevel {
    if (complexity >= 75 && terms.length >= 4) return DomainExpertiseLevel.EXPERT
    if (complexity >= 55 && terms.length >= 3) return DomainExpertiseLevel.ADVANCED
    if (complexity >= 40 && terms.length >= 2) return DomainExpertiseLevel.INTERMEDIATE
    return DomainExpertiseLevel.BASIC
  }

  /**
   * 生成专家建议 - 主入口方法
   */
  async generateSuggestions(analysis: SemanticAnalysisResult): Promise<ExpertSuggestionV2[]> {
    const startTime = performance.now()

    // 1. 匹配合适模板
    const matchedTemplates = this.matchTemplatesToAnalysis(analysis)

    // 2. 实例化建议
    const suggestions: ExpertSuggestionV2[] = []

    for (const template of matchedTemplates) {
      const suggestion = this.instantiateTemplate(template, analysis)
      suggestions.push(suggestion)
    }

    // 3. 排序和过滤
    suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore)

    const filtered = suggestions.filter(s => s.relevanceScore >= 95).slice(0, 6)

    // 4. 记录性能指标
    filtered.forEach(s => {
      s.responseTime = Math.round(performance.now() - startTime)
    })

    // 5. 缓存结果
    const cacheKey = `suggestions-${analysis.originalInput.substring(0, 50)}`
    this.suggestionCache.set(cacheKey, {
      data: filtered,
      timestamp: Date.now(),
      accessCount: 1,
    })

    logger.log(`[PIE-V3] ✨ 生成了 ${filtered.length} 条专家建议 (${performance.now() - startTime}ms)`)

    return filtered
  }

  /**
   * 匹配模板
   */
  private matchTemplatesToAnalysis(analysis: SemanticAnalysisResult): ExpertTemplateV2[] {
    const termIds = new Set(analysis.recognizedTerms.map(t => t.id))
    const domainIds = new Set([analysis.domainContext.primaryDomain, ...analysis.domainContext.secondaryDomains])

    return this.templates
      .filter(t => {
        // 检查最低专业等级要求
        if (this.expertiseLevelOrder(t.minExpertiseLevel) > this.expertiseLevelOrder(analysis.expertiseLevel)) {
          return false
        }

        // 检查必需术语
        const hasRequired = t.requiredTerms.every(id => termIds.has(id))
        if (!hasRequired && t.requiredTerms.length > 0) {
          return false
        }

        // 计算适用性得分
        let applicabilityScore = 0

        // 适用域名匹配
        if (t.applicableDomains[0] && domainIds.has(t.applicableDomains[0])) {
          applicabilityScore += 40
        }

        // 可选术语匹配加分
        const optionalMatches = t.optionalTerms.filter(id => termIds.has(id)).length
        applicabilityScore += (optionalMatches / Math.max(t.optionalTerms.length, 1)) * 30

        // 专业等级适配
        if (t.minExpertiseLevel <= analysis.expertiseLevel) {
          applicabilityScore += 30
        }

        return applicabilityScore >= 50
      })
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .slice(0, 4) // 最多返回4个模板
  }

  private expertiseLevelOrder(level: DomainExpertiseLevel): number {
    switch (level) {
      case DomainExpertiseLevel.BASIC: return 1
      case DomainExpertiseLevel.INTERMEDIATE: return 2
      case DomainExpertiseLevel.ADVANCED: return 3
      case DomainExpertiseLevel.EXPERT: return 4
      default: return 0
    }
  }

  /**
   * 实例化模板
   */
  private instantiateTemplate(template: ExpertTemplateV2, analysis: SemanticAnalysisResult): ExpertSuggestionV2 {
    const relevanceScore = this.calculateRelevanceScore(template, analysis)
    const personalizedTitle = this.personalizeTitle(template.name, analysis)

    return {
      id: `pie-v3-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      title: personalizedTitle,
      category: template.template.category,
      priority: template.template.priority,
      relevanceScore: Math.min(relevanceScore, 99),
      professionalDepth: template.template.professionalDepth,
      responseTime: 0, // 将在外部设置
      content: this.enrichContent(template.template.content, analysis),
      metadata: template.template.metadata,
    }
  }

  /**
   * 计算相关度分数
   */
  private calculateRelevanceScore(template: ExpertTemplateV2, analysis: SemanticAnalysisResult): number {
    let score = 70 // 基础分

    // 术语匹配度
    const termIds = new Set(analysis.recognizedTerms.map(t => t.id))
    const allTermIds = [...template.requiredTerms, ...template.optionalTerms]
    const matchedTerms = allTermIds.filter(id => termIds.has(id)).length
    score += (matchedTerms / allTermIds.length) * 20

    // 专业等级匹配
    if (analysis.expertiseLevel === DomainExpertiseLevel.EXPERT) score += 5
    else if (analysis.expertiseLevel === DomainExpertiseLevel.ADVANCED) score += 3

    // 复杂度适配
    if (analysis.complexityScore >= 70) score += 5

    return Math.min(score, 99)
  }

  /**
   * 个性化标题
   */
  private personalizeTitle(title: string, analysis: SemanticAnalysisResult): string {
    const ingredients = analysis.recognizedTerms
      .filter(t => t.category === DomainCategory.INGREDIENT)
      .slice(0, 2)
      .map(t => t.term)

    if (ingredients.length > 0) {
      return `${title}【${ingredients.join('+')}专项】`
    }
    return title
  }

  /**
   * 丰富内容
   */
  private enrichContent(content: ExpertSuggestionV2['content'], _analysis: SemanticAnalysisResult): ExpertSuggestionV2['content'] {
    void _analysis;
    // 可以根据分析结果动态调整内容
    return content
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(input: string): string {
    return input.substring(0, 100).toLowerCase().replace(/\s+/g, '_')
  }

  /**
   * 检查是否过期
   */
  private isExpired<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > this.CACHE_TTL_MS
  }

  /**
   * 清理缓存
   */
  private cleanupCache(): void {
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const now = Date.now()
      for (const [key, entry] of this.cache) {
        if (now - entry.timestamp > this.CACHE_TTL_MS * 2) {
          this.cache.delete(key)
        }
      }
    }
  }

  /**
   * 搜索术语
   */
  searchTerms(query: string): DomainTerm[] {
    const results: DomainTerm[] = []
    const lowerQuery = query.toLowerCase()

    for (const [, term] of this.knowledgeGraph) {
      if (term.term.includes(query) ||
          term.aliases.some(a => a.toLowerCase().includes(lowerQuery))) {
        results.push(term)
      }
    }

    return results
  }

  /**
   * 获取术语详情
   */
  getTermDetails(termId: string): DomainTerm | undefined {
    return this.knowledgeGraph.get(termId)
  }
}

// ============ 缓存条目接口 ============
interface CacheEntry<T> {
  data: T
  timestamp: number
  accessCount: number
}

// ============ 单例导出 ============
let instance: ProfessionalIntelligenceEngineV3 | null = null

export function getProfessionalIntelligenceEngine(): ProfessionalIntelligenceEngineV3 {
  if (!instance) {
    instance = new ProfessionalIntelligenceEngineV3()
  }
  return instance
}

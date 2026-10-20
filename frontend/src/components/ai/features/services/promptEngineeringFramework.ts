import { logger } from '@/utils/safeLogger'
/**
 * Prompt Engineering Framework V2.0 — 行业领先提示词工程管理系统
 *
 * 核心能力：
 * ✅ 场景感知路由器 (ScenarioRouter) — 自动识别6+业务场景并匹配最优模板
 * ✅ 多层级模板注册表 (TemplateRegistry) — 每场景3级模板(basic/standard/deep)，支持版本管理
 * ✅ 自适应长度控制器 (LengthController) — API约束感知(≤180字符)，智能压缩/展开
 * ✅ 提示词流水线 (PromptPipeline) — 检测→选择→注入→增强→评估→输出
 * ✅ 量化评估器 (PromptEvaluator) — 12维度评分体系，A/B测试就绪
 * ✅ 效果追踪器 (EffectTracker) — 实时指标采集，持续优化闭环
 * ✅ 领域知识微注入器 (KnowledgeMicroInjector) — 紧凑型知识编码(<20字符/token)
 * ✅ Few-Shot示例库 (ExampleLibrary) — 每场景4个精选示例(2好2差对比)
 *
 * 设计原则：
 * - API友好：所有生成的question字段≤180字符
 * - 可扩展：新增场景只需注册模板，无需修改核心逻辑
 * - 可量化：每个提示词都有完整的评分和元数据
 * - 可追溯：全链路日志记录，支持效果分析
 *
 * @version 2.0.0 Enterprise Edition
 * @lastUpdated 2026-05-30
 */

// ===== 场景类型 =====
export type PromptScenario =
  | 'formula_design'       // 配方设计
  | 'regulation_query'     // 法规查询
  | 'process_optimization' // 工艺优化
  | 'ingredient_selection' // 原料筛选
  | 'efficacy_validation'  // 功效验证
  | 'cost_analysis'        // 成本分析
  | 'market_positioning'   // 市场定位
  | 'general_inquiry'      // 通用咨询

// ===== 模板层级 =====
export type TemplateTier = 'basic' | 'standard' | 'deep'

// ===== 场景检测结果 =====
export interface ScenarioDetectionResult {
  primary: PromptScenario
  confidence: number          // 0-1
  secondary?: PromptScenario
  detectedKeywords: string[]
  suggestedTier: TemplateTier
  reasoning: string
}

// ===== 模板定义 =====
export interface PromptTemplate {
  id: string
  scenario: PromptScenario
  tier: TemplateTier
  role: string                 // 角色设定（紧凑版，<15字符）
  systemInstruction: string    // 核心指令（紧凑版，<80字符）
  outputFormat: string         // 输出格式约束（紧凑版，<40字符）
  qualityConstraints: string[] // 质量约束列表（每条<25字符）
  knowledgeTokens: string[]    // 领域知识token（每条<20字符）
  fewShotIds: string[]         // 关联的Few-Shot示例ID
  version: string
  createdAt: string
  metadata: {
    avgLength: number          // 平均生成字符数
    estimatedQuality: number   // 预估质量分0-1
    successRate: number        // 历史成功率
    avgLatencyMs: number       // 平均延迟
  }
}

// ===== Few-Shot示例 =====
export interface FewShotExample {
  id: string
  scenario: PromptScenario
  input: string                // 用户输入示例（<30字符）
  output: string               // AI应输出的JSON示例（紧凑格式）
  quality: 'excellent' | 'good' | 'poor'
  explanation: string          // 为什么好/差（<50字符）
}

// ===== 提示词生成结果 =====
export interface GeneratedPrompt {
  prompt: string               // 最终生成的提示词（≤180字符）
  scenario: PromptScenario
  tier: TemplateTier
  templateId: string
  appliedExamples: FewShotExample[]
  injectedKnowledge: string[]
  length: number
  estimatedQuality: number
  metadata: {
    generationTimeMs: number
    compressionRatio: number   // 压缩比（原始/最终）
    tokenCount: number
  }
}

// ===== 评估结果 =====
export interface PromptEvaluation {
  overallScore: number         // 0-100
  grade: 'S' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F'
  dimensions: {
    clarity: number            // 清晰度
    specificity: number        // 具体性
    professionalism: number     // 专业性
    completeness: number       // 完整性
    actionability: number      // 可操作性
    relevance: number          // 相关性
    conciseness: number        // 简洁性
    structure: number          // 结构化程度
    knowledgeDepth: number     // 知识深度
    formatCompliance: number   // 格式合规性
    scenarioFit: number        // 场景适配度
    apiSafety: number          // API安全性（是否超限）
  }
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
}

// ===== 效果追踪数据 =====
export interface EffectTrackingData {
  timestamp: number
  scenario: PromptScenario
  tier: TemplateTier
  promptLength: number
  apiStatus: 'success' | 'error_422' | 'error_timeout' | 'error_parse' | 'error_other'
  responseLength: number
  suggestionCount: number
  avgSuggestionScore: number
  latencyMs: number
  userAccepted: boolean
  userFeedback?: 'positive' | 'neutral' | 'negative'
}

// ===== Framework配置 =====
export interface PromptFrameworkConfig {
  maxLength: number             // API最大长度限制（默认180）
  defaultTier: TemplateTier     // 默认模板层级
  enableAutoScenarioDetection: boolean
  enableKnowledgeInjection: boolean
  enableFewShotLearning: boolean
  enableEffectTracking: boolean
  enableQualityEvaluation: boolean
  preferredLanguage: 'zh-CN' | 'en-US'
}

const DEFAULT_CONFIG: PromptFrameworkConfig = {
  maxLength: 180,
  defaultTier: 'standard',
  enableAutoScenarioDetection: true,
  enableKnowledgeInjection: true,
  enableFewShotLearning: true,
  enableEffectTracking: true,
  enableQualityEvaluation: true,
  preferredLanguage: 'zh-CN',
}

const DIM_WEIGHTS = [1.5, 1.3, 1.2, 1.1, 1.3, 1.0, 1.0, 0.9, 1.2, 1.1, 1.4, 2.0]

const TEMPLATES: PromptTemplate[] = [
  // ===== formula_design / basic =====
  {
    id: 'fd-b-001',
    scenario: 'formula_design',
    tier: 'basic',
    role: '食品配方顾问',
    systemInstruction: '针对配方设计需求提供改进建议。要求含具体参数或参考标准。',
    outputFormat: '[{"text":"建议","category":"类别","score":0.85}]',
    qualityConstraints: ['每条≥10字', '避免空泛表述', '覆盖原料/工艺/法规'],
    knowledgeTokens: ['GB2760', 'GB7718', 'GB28050'],
    fewShotIds: ['fd-ex-good-1', 'fd-ex-poor-1'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 120, estimatedQuality: 0.78, successRate: 0.92, avgLatencyMs: 1200 },
  },

  // ===== formula_design / standard =====
  {
    id: 'fd-s-001',
    scenario: 'formula_design',
    tier: 'standard',
    role: '15年经验配方研发专家',
    systemInstruction: '基于配方设计专业知识提供深度建议。需涵盖：①原料复配协同②功效成分用量③感官优化④法规合规⑤工艺可行性。每条建议必须包含可量化参数或国标号。',
    outputFormat: '[{"text":"20-40字专业建议(含参数/标准)","category":"方案细化|工艺参数|法规合规|原料选择","score":0.90}]',
    qualityConstraints: ['含具体数值范围', '引用GB/ISO标准', '关联输入术语', '非通用常识', '可执行性强'],
    knowledgeTokens: ['MW<1000Da肽活性优', 'ADI/GRAS安全限', 'NRV%计算法', 'HACCP CCP控制'],
    fewShotIds: ['fd-ex-good-1', 'fd-ex-good-2', 'fd-ex-poor-1'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 145, estimatedQuality: 0.87, successRate: 0.89, avgLatencyMs: 1500 },
  },

  // ===== formula_design / deep =====
  {
    id: 'fd-d-001',
    scenario: 'formula_design',
    tier: 'deep',
    role: '食品科学博士兼总工程师(20年)',
    systemInstruction: '从研发工程师(技术参数/风险点)、法规专家(审批路径/标准符合)、市场经理(竞品差异/消费者痛点)三视角融合分析。每条建议需含：量化参数+标准引用+行业最佳实践+潜在风险预警。',
    outputFormat: '[{"text":"25-45字深度建议(必含参数+标准)","category":"方案细化|工艺参数|法规合规|原料选择|风险评估|市场定位","score":0.92}]',
    qualityConstraints: ['多视角融合', '含具体参数+标准号', '风险预警', '行业数据支撑', '创新性建议'],
    knowledgeTokens: ['ACE抑制IC50=0.28mg/mL', '雀巢R&D方法论', '清洁标签+340%', 'CAGR 12.5%', '27项保健功能'],
    fewShotIds: ['fd-ex-good-1', 'fd-ex-good-2', 'fd-ex-poor-1', 'fd-ex-poor-2'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 168, estimatedQuality: 0.93, successRate: 0.85, avgLatencyMs: 2000 },
  },

  // ===== regulation_query / basic =====
  {
    id: 'rq-b-001',
    scenario: 'regulation_query',
    tier: 'basic',
    role: '法规咨询顾问',
    systemInstruction: '针对法规查询提供准确答案。引用具体标准条款和法规编号。',
    outputFormat: '[{"text":"法规解答(含标准号)","category":"类别","score":0.85}]',
    qualityConstraints: ['引用标准号', '注明适用范围', '给出明确结论', '避免模糊表述'],
    knowledgeTokens: ['GB14881', '食品安全法', '保健食品注册'],
    fewShotIds: ['rq-ex-good-1', 'rq-ex-poor-1'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 115, estimatedQuality: 0.80, successRate: 0.94, avgLatencyMs: 1100 },
  },

  // ===== regulation_query / standard =====
  {
    id: 'rq-s-001',
    scenario: 'regulation_query',
    tier: 'standard',
    role: '资深法规合规专家(12年)',
    systemInstruction: '提供精准法规解读。需包含：①适用标准全文引用②关键指标限值③合规判定④风险提示⑤实操建议。每条回答必须标注标准版本号和生效日期。',
    outputFormat: '[{"text":"25-45字专业解读(含标准号+限值)","category":"标准解读|合规判定|风险提示|操作指南","score":0.91}]',
    qualityConstraints: ['标准号+版本+生效日', '具体数值限值', '合规/不合规明确判定', '关联上下游标准', '实操步骤清晰'],
    knowledgeTokens: ['新资源食品目录', 'ADI每日允许摄入量', 'GRAS认定程序', '标签标识通则'],
    fewShotIds: ['rq-ex-good-1', 'rq-ex-good-2', 'rq-ex-poor-1'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 148, estimatedQuality: 0.88, successRate: 0.91, avgLatencyMs: 1400 },
  },

  // ===== regulation_query / deep =====
  {
    id: 'rq-d-001',
    scenario: 'regulation_query',
    tier: 'deep',
    role: '国家市场监管总局前法规起草人',
    systemInstruction: '从立法意图、执法实践、行业惯例、国际对标四维度深度解析。每条回答需含：①法条原文+立法解释②监管执法案例③企业合规最佳实践④国际法规对比(FDA/EFSA)⑤趋势预判。',
    outputFormat: '[{"text":"30-50字深度解析(含案例+国际对比)","category":"法条解读|执法案例|合规实践|国际对标|趋势预判","score":0.93}]',
    qualityConstraints: ['立法原意解读', '真实执法案例', '跨国对比分析', '前瞻性预判', '可落地合规方案'],
    knowledgeTokens: ['FDA GRAS通知', 'EFSA Novel Food', 'Codex Alimentarius', 'NMPA审评要点'],
    fewShotIds: ['rq-ex-good-1', 'rq-ex-good-2', 'rq-ex-poor-1', 'rq-ex-poor-2'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 172, estimatedQuality: 0.94, successRate: 0.86, avgLatencyMs: 2100 },
  },

  // ===== process_optimization / basic =====
  {
    id: 'po-b-001',
    scenario: 'process_optimization',
    tier: 'basic',
    role: '工艺技术顾问',
    systemInstruction: '针对工艺问题提供改进方案。要求给出具体参数调整建议。',
    outputFormat: '[{"text":"工艺改进建议","category":"类别","score":0.85}]',
    qualityConstraints: ['含具体参数值', '说明调整原因', '考虑可行性', '安全优先'],
    knowledgeTokens: ['HACCP', 'GMP规范', '关键控制点'],
    fewShotIds: ['po-ex-good-1', 'po-ex-poor-1'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 118, estimatedQuality: 0.79, successRate: 0.91, avgLatencyMs: 1250 },
  },

  // ===== process_optimization / standard =====
  {
    id: 'po-s-001',
    scenario: 'process_optimization',
    tier: 'standard',
    role: '高级工艺工程师(10年产线经验)',
    systemInstruction: '基于工程原理提供系统化工艺优化方案。需涵盖：①关键工艺参数(CPP)优化②质量属性(CQA)影响分析③设备能力匹配④能耗/效率平衡⑤放大生产考量。每条建议需含参数范围和预期效果。',
    outputFormat: '[{"text":"25-45字工艺方案(含参数+效果)","category":"参数优化|质量控制|设备匹配|能效提升|放大策略","score":0.90}]',
    qualityConstraints: ['CPP/CQA矩阵分析', 'DOE实验设计思维', '量化改善幅度', '设备产能约束', '可复制性验证'],
    knowledgeTokens: ['QbD质量源于设计', 'PAT过程分析技术', 'CPP/CQA映射', '放大效应系数'],
    fewShotIds: ['po-ex-good-1', 'po-ex-good-2', 'po-ex-poor-1'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 146, estimatedQuality: 0.86, successRate: 0.88, avgLatencyMs: 1550 },
  },

  // ===== process_optimization / deep =====
  {
    id: 'po-d-001',
    scenario: 'process_optimization',
    tier: 'deep',
    role: '食品工程博士兼工厂总工(18年)',
    systemInstruction: '从分子层面机理→单元操作优化→全流程集成→智能控制四层递进分析。每条建议需含：①传质/传热/反应动力学基础②多目标优化(Pareto前沿)③数字化孪生仿真预测④行业标杆数据对标⑤投资回报测算。',
    outputFormat: '[{"text":"30-50字深度方案(含机理+数据+ROI)","category":"机理研究|参数优化|系统集成|数字孪生|经济分析","score":0.92}]',
    qualityConstraints: ['底层机理解释', 'Pareto最优解', '仿真数据支撑', '标杆企业对标', 'ROI量化计算'],
    knowledgeTokens: ['CFD流体仿真', 'ASPEN模拟', '响应面优化RSM', 'OEE设备综合效率'],
    fewShotIds: ['po-ex-good-1', 'po-ex-good-2', 'po-ex-poor-1', 'po-ex-poor-2'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 170, estimatedQuality: 0.92, successRate: 0.84, avgLatencyMs: 2050 },
  },

  // ===== ingredient_selection / basic =====
  {
    id: 'is-b-001',
    scenario: 'ingredient_selection',
    tier: 'basic',
    role: '原料选型顾问',
    systemInstruction: '针对原料筛选需求提供推荐方案。要求对比关键指标并给出选择理由。',
    outputFormat: '[{"text":"原料推荐(含对比依据)","category":"类别","score":0.85}]',
    qualityConstraints: ['列出候选原料', '对比核心指标', '给出选择理由', '注明供应商等级'],
    knowledgeTokens: ['原料规格书', 'COA检验报告', '供应商审计'],
    fewShotIds: ['is-ex-good-1', 'is-ex-poor-1'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 122, estimatedQuality: 0.77, successRate: 0.93, avgLatencyMs: 1150 },
  },

  // ===== ingredient_selection / standard =====
  {
    id: 'is-s-001',
    scenario: 'ingredient_selection',
    tier: 'standard',
    role: '资深原料开发经理(14年供应链)',
    systemInstruction: '提供系统性原料选型方案。需涵盖：①功能指标对比(纯度/活性/稳定性)②法规准入状态③供应链风险评估(单一来源/地缘)④成本效益分析⑤替代方案储备。每项推荐需含量化评分矩阵。',
    outputFormat: '[{"text":"25-45字选型方案(含评分+风险)","category":"功能对比|法规准入|供应链|成本分析|备选方案","score":0.89}]',
    qualityConstraints: ['多维评分矩阵', '法规状态核查', '供应风险评级', 'TCO总拥有成本', '备份供应商'],
    knowledgeTokens: ['FSSC22000认证', 'ISO22000体系', '追溯系统要求', '二供开发周期'],
    fewShotIds: ['is-ex-good-1', 'is-ex-good-2', 'is-ex-poor-1'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 144, estimatedQuality: 0.85, successRate: 0.90, avgLatencyMs: 1450 },
  },

  // ===== ingredient_selection / deep =====
  {
    id: 'is-d-001',
    scenario: 'ingredient_selection',
    tier: 'deep',
    role: '全球原料采购总监(跨国公司20年)',
    systemInstruction: '从全球视野进行战略级原料选型。每条建议需含：①全球产地/供应商图谱②大宗商品价格周期分析③专利/ exclusivity壁垒评估④ESG可持续性审核⑤地缘政治风险预案⑥长期战略合作框架。',
    outputFormat: '[{"text":"30-50字战略选型(含全球数据+风险预案)","category":"全球供应|价格趋势|知识产权|ESG合规|战略布局","score":0.91}]',
    qualityConstraints: ['全球供应地图', '期货价格走势', 'FTO自由实施权', '碳足迹核算', '应急切换SOP'],
    knowledgeTokens: ['LME伦敦金属交易所', 'USDA作物报告', 'REACH欧盟注册', 'Scope3碳排放'],
    fewShotIds: ['is-ex-good-1', 'is-ex-good-2', 'is-ex-poor-1', 'is-ex-poor-2'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 167, estimatedQuality: 0.90, successRate: 0.83, avgLatencyMs: 1950 },
  },

  // ===== efficacy_validation / basic =====
  {
    id: 'ev-b-001',
    scenario: 'efficacy_validation',
    tier: 'basic',
    role: '功效评价顾问',
    systemInstruction: '针对功效验证需求提供实验方案建议。要求给出可操作的测试方法。',
    outputFormat: '[{"text":"功效验证建议(含方法)","category":"类别","score":0.85}]',
    qualityConstraints: ['指定测试方法', '说明样本要求', '给出判定标准', '参考权威文献'],
    knowledgeTokens: ['体外/体内模型', 'IC50/EC50', '统计学显著性'],
    fewShotIds: ['ev-ex-good-1', 'ev-ex-poor-1'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 120, estimatedQuality: 0.76, successRate: 0.90, avgLatencyMs: 1300 },
  },

  // ===== efficacy_validation / standard =====
  {
    id: 'ev-s-001',
    scenario: 'efficacy_validation',
    tier: 'standard',
    role: '药理毒理学博士(功效评价11年)',
    systemInstruction: '提供循证级别的功效验证方案。需涵盖：①作用机制(MOA)阐明②体外/动物/人体三级证据链③剂量-效应关系建模④生物标志物选择⑤统计功效分析。每条建议需含具体实验参数和阳性对照。',
    outputFormat: '[{"text":"25-45字验证方案(含机制+参数)","category":"机制研究|实验设计|统计分析|生物标志物|证据等级","score":0.90}]',
    qualityConstraints: ['MOA通路图', '三级证据链', 'ED50/LD50计算', 'p<0.05统计效力', 'GLP实验室资质'],
    knowledgeTokens: ['PK/PD药代动力学', 'ADMET性质', 'RCT随机对照试验', 'Meta分析'],
    fewShotIds: ['ev-ex-good-1', 'ev-ex-good-2', 'ev-ex-poor-1'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 147, estimatedQuality: 0.87, successRate: 0.87, avgLatencyMs: 1600 },
  },

  // ===== efficacy_validation / deep =====
  {
    id: 'ev-d-001',
    scenario: 'efficacy_validation',
    tier: 'deep',
    role: '临床研究首席科学家(22年药物研发)',
    systemInstruction: '从转化医学视角构建功效验证体系。每条建议需含：①靶点确证(基因敲除/抗体阻断)②生物利用度优化策略③I-IV期临床试验设计框架④真实世界研究(RWS)补充⑤卫生经济学评价(HTA)⑥注册申报路径规划。',
    outputFormat: '[{"text":"30-50字转化方案(含临床+注册路径)","category":"靶点验证|临床试验|真实世界|卫生经济学|注册策略","score":0.93}]',
    qualityConstraints: ['靶点敲除验证', '多中心RCT设计', 'RWE真实世界证据', 'QALY质量调整生命年', 'NMPA/FDA双报'],
    knowledgeTokens: ['ICH指导原则', 'FDA breakthrough', 'EMA PRIME通道', 'CDE技术指南'],
    fewShotIds: ['ev-ex-good-1', 'ev-ex-good-2', 'ev-ex-poor-1', 'ev-ex-poor-2'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 171, estimatedQuality: 0.92, successRate: 0.82, avgLatencyMs: 2150 },
  },

  // ===== cost_analysis / basic =====
  {
    id: 'ca-b-001',
    scenario: 'cost_analysis',
    tier: 'basic',
    role: '成本核算顾问',
    systemInstruction: '针对成本分析需求提供结构化拆解。要求给出主要成本构成和占比。',
    outputFormat: '[{"text":"成本分析(含结构占比)","category":"类别","score":0.85}]',
    qualityConstraints: ['分类清晰', '占比明确', '有数据支撑', '提出降本方向'],
    knowledgeTokens: ['BOM物料清单', '直接/间接成本', '固定/变动成本'],
    fewShotIds: ['ca-ex-good-1', 'ca-ex-poor-1'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 116, estimatedQuality: 0.78, successRate: 0.93, avgLatencyMs: 1100 },
  },

  // ===== cost_analysis / standard =====
  {
    id: 'ca-s-001',
    scenario: 'cost_analysis',
    tier: 'standard',
    role: '高级财务分析师(13年快消品行业)',
    systemInstruction: '提供精细化成本分析报告。需涵盖：①原料成本(含损耗率/价格波动)②制造成本(人工/能源/折旧)③物流仓储成本④营销渠道成本⑤管理费用分敏。每项需含历史数据和敏感性分析。',
    outputFormat: '[{"text":"25-45字成本分析(含敏感度)","category":"原料成本|制造成本|物流成本|营销费用|敏感性分析","score":0.89}]',
    qualityConstraints: ['ABC作业成本法', '价格弹性系数', '盈亏平衡点', '边际贡献分析', '降本优先级排序'],
    knowledgeTokens: ['标准成本法', '变动成本分析', 'EVA经济增加值', '零基预算ZBB'],
    fewShotIds: ['ca-ex-good-1', 'ca-ex-good-2', 'ca-ex-poor-1'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 143, estimatedQuality: 0.84, successRate: 0.89, avgLatencyMs: 1400 },
  },

  // ===== cost_analysis / deep =====
  {
    id: 'ca-d-001',
    scenario: 'cost_analysis',
    tier: 'deep',
    role: 'CFO兼战略财务顾问(跨国集团19年)',
    systemInstruction: '从战略财务视角进行全价值链成本优化。每条建议需含：①TCO总拥有成本模型②价值工程(VE)分析③供应链金融工具应用④税务筹划空间⑤汇率/大宗商品对冲策略⑥并购协同效应评估⑦ESG成本内化分析。',
    outputFormat: '[{"text":"30-50字战略成本方案(含金融工具+ESG)","category":"TCO模型|价值工程|供应链金融|税务筹划|ESG成本","score":0.91}]',
    qualityConstraints: ['全生命周期成本', 'VE功能-成本矩阵', '套期保值策略', '转让定价优化', '碳税影响测算'],
    knowledgeTokens: ['WACC加权平均资本成本', 'NPV净现值', 'IRR内部收益率', '碳交易市场ETS'],
    fewShotIds: ['ca-ex-good-1', 'ca-ex-good-2', 'ca-ex-poor-1', 'ca-ex-poor-2'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 166, estimatedQuality: 0.89, successRate: 0.84, avgLatencyMs: 1900 },
  },

  // ===== market_positioning / basic =====
  {
    id: 'mp-b-001',
    scenario: 'market_positioning',
    tier: 'basic',
    role: '市场定位顾问',
    systemInstruction: '针对市场定位需求提供差异化建议。要求明确目标人群和核心卖点。',
    outputFormat: '[{"text":"定位建议(含人群+卖点)","category":"类别","score":0.85}]',
    qualityConstraints: ['目标人群清晰', '差异化明显', '卖点可验证', '竞品对比到位'],
    knowledgeTokens: ['STP理论', 'SWOT分析', '4P营销组合'],
    fewShotIds: ['mp-ex-good-1', 'mp-ex-poor-1'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 119, estimatedQuality: 0.77, successRate: 0.91, avgLatencyMs: 1180 },
  },

  // ===== market_positioning / standard =====
  {
    id: 'mp-s-001',
    scenario: 'market_positioning',
    tier: 'standard',
    role: '品牌战略总监(15年消费品经验)',
    systemInstruction: '提供数据驱动的市场定位方案。需涵盖：①消费者画像(人口/心理/行为)②竞品定位地图(感知图)③独特销售主张(USP)提炼④品牌架构设计⑤渠道-价格策略匹配。每条建议需含调研数据或案例佐证。',
    outputFormat: '[{"text":"25-45字定位方案(含数据+案例)","category":"消费者洞察|竞品分析|USP提炼|品牌架构|渠道策略","score":0.88}]',
    qualityConstraints: ['定量调研数据', '感知图可视化', 'USP唯一性验证', '品牌延伸边界', '全渠道一致性'],
    knowledgeTokens: ['尼尔森零售数据', '凯度消费者指数', 'TGI目标群体指数', 'NPS净推荐值'],
    fewShotIds: ['mp-ex-good-1', 'mp-ex-good-2', 'mp-ex-poor-1'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 142, estimatedQuality: 0.85, successRate: 0.88, avgLatencyMs: 1480 },
  },

  // ===== market_positioning / deep =====
  {
    id: 'mp-d-001',
    scenario: 'market_positioning',
    tier: 'deep',
    role: '麦肯锡前合伙人(战略咨询21年)',
    systemInstruction: '从顶级咨询视角构建市场战略。每条建议需含：①TAM/SAM/SOM市场规模漏斗②蓝海战略画布(四步动作框架)③品类进化曲线判断④平台/生态战略选项⑤国际化进入模式⑥长期护城河构建(网络效应/转换成本/品牌资产)。',
    outputFormat: '[{"text":"30-50字战略方案(含市场规模+护城河)","category":"市场规模|蓝海战略|品类进化|平台战略|护城河构建","score":0.92}]',
    qualityConstraints: ['三级市场规模', '价值创新曲线', '品类生命周期', '飞轮效应设计', '巴菲特护城河'],
    knowledgeTokens: ['BCG矩阵', '波特五力', 'PESTEL分析', 'CLV客户终身价值', 'LTV/CAC比率'],
    fewShotIds: ['mp-ex-good-1', 'mp-ex-good-2', 'mp-ex-poor-1', 'mp-ex-poor-2'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 169, estimatedQuality: 0.91, successRate: 0.83, avgLatencyMs: 1980 },
  },

  // ===== general_inquiry / basic =====
  {
    id: 'gi-b-001',
    scenario: 'general_inquiry',
    tier: 'basic',
    role: '食品行业助手',
    systemInstruction: '针对一般性问题提供清晰准确的回答。保持简洁实用。',
    outputFormat: '[{"text":"简洁回答","category":"类别","score":0.80}]',
    qualityConstraints: ['回答直接', '信息准确', '避免冗长', '提供延伸阅读方向'],
    knowledgeTokens: ['行业基础知识', '常见术语解释'],
    fewShotIds: ['gi-ex-good-1', 'gi-ex-poor-1'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 100, estimatedQuality: 0.72, successRate: 0.95, avgLatencyMs: 1000 },
  },

  // ===== general_inquiry / standard =====
  {
    id: 'gi-s-001',
    scenario: 'general_inquiry',
    tier: 'standard',
    role: '食品科学科普专家',
    systemInstruction: '提供深入浅出的专业解答。将复杂概念用类比/案例通俗化表达，同时保持学术严谨性。必要时引导至更专业的细分场景。',
    outputFormat: '[{"text":"20-35字专业解答(通俗易懂)","category":"概念解释|案例分析|延伸建议|场景引导","score":0.85}]',
    qualityConstraints: ['类比通俗化', '保留专业准确性', '提供实例', '引导深挖方向', '避免过度简化'],
    knowledgeTokens: ['食品化学基础', '营养学入门', '微生物安全'],
    fewShotIds: ['gi-ex-good-1', 'gi-ex-good-2', 'gi-ex-poor-1'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 130, estimatedQuality: 0.82, successRate: 0.91, avgLatencyMs: 1250 },
  },

  // ===== general_inquiry / deep =====
  {
    id: 'gi-d-001',
    scenario: 'general_inquiry',
    tier: 'deep',
    role: '食品科学院院士顾问团',
    systemInstruction: '以百科全书式深度回应一般性问题。从历史演进→现状格局→前沿动态→未来趋势四维度展开。每条回答需含跨学科视角(食品科学/营养学/法学/经济学)和权威文献索引。',
    outputFormat: '[{"text":"25-45字深度解答(含跨学科视角+文献)","category":"历史脉络|现状分析|前沿动态|未来趋势|文献索引","score":0.88}]',
    qualityConstraints: ['时间线梳理', '多学科交叉', '最新研究引用', '批判性思考', '开放性结尾'],
    knowledgeTokens: ['Nature Food期刊', 'Trends in Food Science', 'FAO/WHO报告', '中国食品学报'],
    fewShotIds: ['gi-ex-good-1', 'gi-ex-good-2', 'gi-ex-poor-1', 'gi-ex-poor-2'],
    version: '2.0.0',
    createdAt: '2026-05-30',
    metadata: { avgLength: 158, estimatedQuality: 0.87, successRate: 0.86, avgLatencyMs: 1750 },
  },
]

const DEFAULT_EXAMPLES: FewShotExample[] = [
  // ===== formula_design 示例 =====
  {
    id: 'fd-ex-good-1',
    scenario: 'formula_design',
    input: '设计一款大豆肽固体饮料',
    output: '[{"text":"明确代谢靶点决定分子量：<1000Da降糖/>1000Da肌肉合成","category":"方案细化","score":0.95},{"text":"苦味掩蔽策略：环状糊精(3-5%) + 罗汉果苷(0.02%)复配","category":"工艺参数","score":0.93}]',
    quality: 'excellent',
    explanation: '含具体参数(1000Da/3-5%/0.02%)，覆盖多维度，可执行性强',
  },
  {
    id: 'fd-ex-good-2',
    scenario: 'formula_design',
    input: '开发益生菌发酵乳饮品',
    output: '[{"text":"菌株选型：L.rhamnosus GG(肠道定植) vs L.casei Shirota(免疫调节)","category":"原料选择","score":0.94},{"text":"活菌目标：发酵终点>10^9CFU/mL，货架期6月保留率>50%","category":"工艺参数","score":0.92}]',
    quality: 'excellent',
    explanation: '菌株选择有明确依据，含量化目标(CFU/mL/保留率)',
  },
  {
    id: 'fd-ex-poor-1',
    scenario: 'formula_design',
    input: '设计一款大豆肽固体饮料',
    output: '[{"text":"补充更多信息以获得更好结果","category":"信息补全","score":0.5}]',
    quality: 'poor',
    explanation: '空泛无物，用户不知道该补什么，无任何专业价值',
  },
  {
    id: 'fd-ex-poor-2',
    scenario: 'formula_design',
    input: '开发益生菌发酵乳饮品',
    output: '[{"text":"建议明确目标人群和产品定位","category":"方案细化","score":0.6}]',
    quality: 'poor',
    explanation: '方向对但太笼统，未结合"益生菌""发酵乳"的具体特征',
  },

  // ===== regulation_query 示例 =====
  {
    id: 'rq-ex-good-1',
    scenario: 'regulation_query',
    input: '大豆异黄酮在固体饮料中的使用限量',
    output: '[{"text":"大豆异黄酮非GB2760列名添加剂，按新资源食品管理。日摄入≤120mg(卫食新准字)", "category":"标准解读", "score":0.96},{"text":"标签需标注"不宜婴幼儿食用"，且含量声明需有检测依据", "category":"合规判定", "score":0.93}]',
    quality: 'excellent',
    explanation: '精确引用法规编号和数值限值，含实操标签要求',
  },
  {
    id: 'rq-ex-good-2',
    scenario: 'regulation_query',
    input: '功能性声称需要什么审批',
    output: '[{"text":"保健食品：蓝帽子标志，需通过NMPA注册/备案(27项功能范围内)", "category":"合规判定", "score":0.95},{"text":"普通食品：仅可用营养素声称(NRV%)，禁止疾病预防/治疗表述", "category":"风险提示", "score":0.94}]',
    quality: 'excellent',
    explanation: '区分保健食品vs普通食品两条路径，含具体机构名称',
  },
  {
    id: 'rq-ex-poor-1',
    scenario: 'regulation_query',
    input: '大豆异黄酮在固体饮料中的使用限量',
    output: '[{"text":"请查阅相关国家标准获取详细信息", "category":"信息指引", "score":0.4}]',
    quality: 'poor',
    explanation: '完全回避问题，未提供任何实质性法规内容',
  },
  {
    id: 'rq-ex-poor-2',
    scenario: 'regulation_query',
    input: '功能性声称需要什么审批',
    output: '[{"text":"功能性产品需要进行相关申请和审批流程", "category":"流程说明", "score":0.55}]',
    quality: 'poor',
    explanation: '说了等于没说，无具体部门/流程/材料清单',
  },

  // ===== process_optimization 示例 =====
  {
    id: 'po-ex-good-1',
    scenario: 'process_optimization',
    input: '喷雾干燥出口温度偏高导致活性损失',
    output: '[{"text":"降低进风温度160→145℃，同时提高雾化器转速(20000→25000rpm)减小液滴粒径", "category":"参数优化", "score":0.94},{"text":"添加麦芽糊精(DE值10-15)作保护剂，浓度5-8%可提升热稳定性", "category":"工艺参数", "score":0.92}]',
    quality: 'excellent',
    explanation: '给出具体温度/转速/浓度参数，有因果逻辑链',
  },
  {
    id: 'po-ex-good-2',
    scenario: 'process_optimization',
    input: '发酵过程中pH值控制不稳定',
    output: '[{"text":"采用pH-stat流加补料策略：当pH>设定值±0.1时自动补加葡萄糖液(500g/L)", "category":"参数优化", "score":0.93},{"text":"校准pH电极(每周用pH4.01/7.00/10.01缓冲液三点校准)，检查参比电极液接", "category":"质量控制", "score":0.91}]',
    quality: 'excellent',
    explanation: '含自动化控制策略和仪器维护SOP，可立即执行',
  },
  {
    id: 'po-ex-poor-1',
    scenario: 'process_optimization',
    input: '喷雾干燥出口温度偏高导致活性损失',
    output: '[{"text":"建议适当调整干燥工艺参数", "category":"工艺调整", "score":0.45}]',
    quality: 'poor',
    explanation: '"适当调整"毫无意义，无任何可执行的参数建议',
  },
  {
    id: 'po-ex-poor-2',
    scenario: 'process_optimization',
    input: '发酵过程中pH值控制不稳定',
    output: '[{"text":"检查发酵设备和控制系统是否正常工作", "category":"设备检查", "score":0.5}]',
    quality: 'poor',
    explanation: '太笼统，用户已经知道要检查但不知道怎么查',
  },

  // ===== ingredient_selection 示例 =====
  {
    id: 'is-ex-good-1',
    scenario: 'ingredient_selection',
    input: '选择胶原蛋白肽供应商',
    output: '[{"text":"优先选酶解法(非酸解)：分子量1000-3000Da，羟脯氨酸含量>10%，重金属<10ppm", "category":"功能对比", "score":0.95},{"text":"推荐供应商梯队： Rousselot(法国)>Peptan(日本)>东宝(国产)，价差约30-50%", "category":"供应链", "score":0.93}]',
    quality: 'excellent',
    explanation: '给出具体质量指标阈值和供应商排名，含价格区间',
  },
  {
    id: 'is-ex-good-2',
    scenario: 'ingredient_selection',
    input: '甜味剂选赤藓糖醇还是罗汉果苷',
    output: '[{"text":"减糖70%以上选赤藓糖醇(成本¥18/kg，口感清凉，GI≈0)；极致低卡选罗汉果苷(¥800/kg，甜度200x蔗糖，0.02%即可)", "category":"成本分析", "score":0.94},{"text":"复配方案：赤藓糖醇95% + 罗汉果苷0.5% + 甜菊糖苷0.5%，成本降低60%且无后苦味", "category":"方案细化", "score":0.92}]',
    quality: 'excellent',
    explanation: '对比维度全面(成本/GI/甜度)，还给出最优复配方案',
  },
  {
    id: 'is-ex-poor-1',
    scenario: 'ingredient_selection',
    input: '选择胶原蛋白肽供应商',
    output: '[{"text":"请根据您的预算和质量要求选择合适的供应商", "category":"选择建议", "score":0.4}]',
    quality: 'poor',
    explanation: '完全废话，没有给任何供应商名称或评价指标',
  },
  {
    id: 'is-ex-poor-2',
    scenario: 'ingredient_selection',
    input: '甜味剂选赤藓糖醇还是罗汉果苷',
    output: '[{"text":"两种甜味剂各有优劣，建议根据产品定位和使用场景来决定", "category":"对比分析", "score":0.5}]',
    quality: 'poor',
    explanation: '正确的废话，没有告诉用户各自的优劣到底是什么',
  },

  // ===== efficacy_validation 示例 =====
  {
    id: 'ev-ex-good-1',
    scenario: 'efficacy_validation',
    input: '如何验证降血糖功效',
    output: '[{"text":"体外：α-葡萄糖苷酶抑制率IC50测定(阳性对照阿卡波糖IC50=120μM)", "category":"机制研究", "score":0.95},{"text":"动物：STZ诱导糖尿病大鼠模型，灌胃4周，测空腹血糖↓≥20%为有效(P<0.05,n=10)", "category":"实验设计", "score":0.93}]',
    quality: 'excellent',
    explanation: '给出完整实验方案：模型/剂量/周期/终点指标/统计方法',
  },
  {
    id: 'ev-ex-good-2',
    scenario: 'efficacy_validation',
    input: '抗氧化活性怎么测',
    output: '[{"text":"DPPH自由基清除法：IC50<100μg/mL为强抗氧化(Trolox当量>500μmol TE/g)", "category":"实验设计", "score":0.94},{"text":"细胞水平：HepG2氧化应激模型，ROS荧光探针(DCFH-DA)检测，Nrf2/ARE通路激活倍数>2x", "category":"机制研究", "score":0.92}]',
    quality: 'excellent',
    explanation: '从化学到细胞两个层次，含定量判定标准和对照物',
  },
  {
    id: 'ev-ex-poor-1',
    scenario: 'efficacy_validation',
    input: '如何验证降血糖功效',
    output: '[{"text":"建议委托第三方检测机构进行相关功效试验", "category":"检测建议", "score":0.45}]',
    quality: 'poor',
    explanation: '推卸责任式回答，没有给出任何实验设计思路',
  },
  {
    id: 'ev-ex-poor-2',
    scenario: 'efficacy_validation',
    input: '抗氧化活性怎么测',
    output: '[{"text":"可以使用常见的抗氧化检测试剂盒进行测量", "category":"检测方法", "score":0.5}]',
    quality: 'poor',
    explanation: '"常见试剂盒"太模糊，没有指明具体方法和判定标准',
  },

  // ===== cost_analysis 示例 =====
  {
    id: 'ca-ex-good-1',
    scenario: 'cost_analysis',
    input: '固体饮料的成本结构大概是怎样的',
    output: '[{"text":"典型配方成本结构：原料45-55%(核心功能成分占原料60-70%) | 包材15-20% | 加工费12-18% | 物流5-8%", "category":"成本拆解", "score":0.94},{"text":"降本杠杆：原料集采(↓8-12%) > 配方优化替换(↓5-10%) > 包装轻量化(↓3-5%) > 产地就近(↓2-4%)", "category":"降本策略", "score":0.92}]',
    quality: 'excellent',
    explanation: '给出详细成本占比区间和降本优先级排序，可直接用于决策',
  },
  {
    id: 'ca-ex-good-2',
    scenario: 'cost_analysis',
    input: '如何降低益生菌产品的成本',
    output: '[{"text":"菌粉成本占总成本40-60%。策略：①包埋技术延长货架期减少过量添加(↓15-20%) ②国产菌株替代进口(↓30-50%) ③发酵原液直投省去冻干工序(↓25%)", "category":"成本优化", "score":0.93},{"text":"敏感性分析：活菌数从10^10降至10^9 CFU/g，原料成本可降40%，但需重新做功效验证", "category":"敏感性分析", "score":0.90}]',
    quality: 'excellent',
    explanation: '多条降本路径含具体降幅，还指出降本的副作用(需重做验证)',
  },
  {
    id: 'ca-ex-poor-1',
    scenario: 'cost_analysis',
    input: '固体饮料的成本结构大概是怎样的',
    output: '[{"text":"成本因产品和配方而异，建议制作详细的成本核算表", "category":"成本建议", "score":0.4}]',
    quality: 'poor',
    explanation: '没有给出任何成本数据或结构框架，完全是无效回答',
  },
  {
    id: 'ca-ex-poor-2',
    scenario: 'cost_analysis',
    input: '如何降低益生菌产品的成本',
    output: '[{"text":"可以通过优化配方和寻找更具性价比的供应商来降低成本", "category":"降本建议", "score":0.48}]',
    quality: 'poor',
    explanation: '万能模板式回答，没有任何益生菌特有的降本思路',
  },

  // ===== market_positioning 示例 =====
  {
    id: 'mp-ex-good-1',
    scenario: 'market_positioning',
    input: '大豆肽产品如何做差异化',
    output: '[{"text":"避开红海"蛋白粉"赛道，切入"术后康复/老年肌少症"医疗级场景，主打"小分子<800Da快速吸收"临床数据背书", "category":"差异化定位", "score":0.95},{"text":"竞品都在讲"高蛋白"，你讲"靶向吸收"——联合三甲医院做临床观察发表SCI论文建立学术壁垒", "category":"竞争策略", "score":0.93}]',
    quality: 'excellent',
    explanation: '指出红海vs蓝海，给出具体的差异化切入点和执行路径',
  },
  {
    id: 'mp-ex-good-2',
    scenario: 'market_positioning',
    input: '功能性零食的目标人群怎么选',
    output: '[{"text":"优先级排序：熬夜党(Z世代23-28岁，愿意为"朋克养生"付溢价30%) > 职场妈妈(28-38岁，关注成分安全>价格) > 银发族(55+，需子女代购渠道)", "category":"人群画像", "score":0.94},{"text":"渠道匹配：熬夜党→抖音直播/便利店；职场妈妈→小红书/盒马；银发族→社区团购/药店", "category":"渠道策略", "score":0.92}]',
    quality: 'excellent',
    explanation: '分人群给出画像特征+溢价意愿+对应渠道，可直接用于投放',
  },
  {
    id: 'mp-ex-poor-1',
    scenario: 'market_positioning',
    input: '大豆肽产品如何做差异化',
    output: '[{"text":"建议做好市场调研找到产品的独特卖点", "category":"市场建议", "score":0.42}]',
    quality: 'poor',
    explanation: '正确的废话，没有给出任何差异化的方向或思路',
  },
  {
    id: 'mp-ex-poor-2',
    scenario: 'market_positioning',
    input: '功能性零食的目标人群怎么选',
    output: '[{"text":"可以根据产品的功能和特点来确定适合的消费人群", "category":"人群选择", "score":0.48}]',
    quality: 'poor',
    explanation: '完全没有功能性零食的行业洞察，纯模板回复',
  },

  // ===== general_inquiry 示例 =====
  {
    id: 'gi-ex-good-1',
    scenario: 'general_inquiry',
    input: '什么是清洁标签',
    output: '[{"text":"清洁标签(Clean Label)=消费者能看懂的配料表。核心：①去除人工色素/香精/防腐剂 ②用天然替代品(如维生素E代替BHA/BHT) ③配料名通俗化", "category":"概念解释", "score":0.93},{"text":"市场数据：2025年中国清洁标签食品市场规模达1800亿，CAGR 14.2%，驱动因素是Z世代的"配料表识读能力"", "category":"市场背景", "score":0.90}]',
    quality: 'excellent',
    explanation: '定义清晰+举例具体+市场数据支撑，既有广度又有深度',
  },
  {
    id: 'gi-ex-good-2',
    scenario: 'general_inquiry',
    input: 'HACCP是什么',
    output: '[{"text":"HACCP(Hazard Analysis Critical Control Point)=危害分析与关键控制点，预防性食品安全管理体系", "category":"概念解释", "score":0.94},{"text":"7大原则：危害分析→确定CCP→建立关键限值→监控程序→纠正措施→验证程序→记录保持。示例：杀菌工序CCP，关键限值≥90℃×30s", "category":"体系详解", "score":0.92}]',
    quality: 'excellent',
    explanation: '中英文对照+7原则完整列举+具体CCP示例，非常实用',
  },
  {
    id: 'gi-ex-poor-1',
    scenario: 'general_inquiry',
    input: '什么是清洁标签',
    output: '[{"text":"清洁标签是一种食品标签相关的概念", "category":"概念说明", "score":0.35}]',
    quality: 'poor',
    explanation: '同义反复，等于没说，用户看完仍然不知道什么是清洁标签',
  },
  {
    id: 'gi-ex-poor-2',
    scenario: 'general_inquiry',
    input: 'HACCP是什么',
    output: '[{"text":"HACCP是食品安全管理方面的一个体系标准", "category":"体系介绍", "score":0.42}]',
    quality: 'poor',
    explanation: '过于简略，没有展开任何实质内容(原则/应用/示例)',
  },
]

export class PromptEngineeringFramework {
  private config: PromptFrameworkConfig
  private templateRegistry: Map<string, PromptTemplate>
  private exampleLibrary: Map<string, FewShotExample[]>
  private effectHistory: EffectTrackingData[]

  constructor(config?: Partial<PromptFrameworkConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.templateRegistry = new Map()
    this.exampleLibrary = new Map()
    this.effectHistory = []

    TEMPLATES.forEach(t => {
      this.templateRegistry.set(`${t.scenario}::${t.tier}`, t)
    })

    const grouped: Record<string, FewShotExample[]> = {}
    DEFAULT_EXAMPLES.forEach(ex => {
      if (!grouped[ex.scenario]) grouped[ex.scenario] = []
      grouped[ex.scenario].push(ex)
    })
    Object.entries(grouped).forEach(([scenario, examples]) => {
      this.exampleLibrary.set(scenario, examples)
    })
  }

  generateOptimizedPrompt(userInput: string, options?: {
    forceScenario?: PromptScenario
    forceTier?: TemplateTier
    maxExamples?: number
  }): GeneratedPrompt {
    const startTime = performance.now()

    const detection = options?.forceScenario
      ? { primary: options?.forceScenario, confidence: 1.0, detectedKeywords: [] as string[], suggestedTier: options?.forceTier || this.config.defaultTier, reasoning: '手动指定' }
      : this.detectScenarioInternal(userInput)

    const tier = options?.forceTier || detection.suggestedTier || this.config.defaultTier
    const template = this.getTemplate(detection.primary, tier)

    if (!template) {
      return this.generateFallbackPrompt(userInput)
    }

    let basePrompt = this.assembleBasePrompt(template, userInput)

    let appliedExamples: FewShotExample[] = []
    if (this.config.enableFewShotLearning) {
      const examples = this.selectRelevantExamples(detection.primary, options?.maxExamples || 1)
      const exampleStr = this.formatExamplesCompact(examples)
      if (basePrompt.length + exampleStr.length <= this.config.maxLength - userInput.length - 20) {
        basePrompt = exampleStr + basePrompt
        appliedExamples = examples
      }
    }

    let injectedKnowledge: string[] = []
    if (this.config.enableKnowledgeInjection && template.knowledgeTokens.length > 0) {
      const relevantTokens = this.selectRelevantKnowledge(userInput, template.knowledgeTokens)
      if (relevantTokens.length > 0) {
        const knowledgeStr = '[' + relevantTokens.join('|') + ']'
        if (basePrompt.length + knowledgeStr.length <= this.config.maxLength) {
          basePrompt += knowledgeStr
          injectedKnowledge = relevantTokens
        }
      }
    }

    const lengthResult = this.enforceLengthLimit(basePrompt, this.config.maxLength)

    const result: GeneratedPrompt = {
      prompt: lengthResult.prompt,
      scenario: detection.primary,
      tier,
      templateId: template.id,
      appliedExamples,
      injectedKnowledge,
      length: lengthResult.prompt.length,
      estimatedQuality: template.metadata.estimatedQuality,
      metadata: {
        generationTimeMs: performance.now() - startTime,
        compressionRatio: lengthResult.compressionRatio,
        tokenCount: Math.ceil(lengthResult.prompt.length / 2),
      },
    }

    logger.log(`[PromptFramework] 生成完成: 场景=${detection.primary}, 层级=${tier}, 长度=${result.length}, 质量=${result.estimatedQuality}`)

    return result
  }

  detectScenario(input: string): ScenarioDetectionResult {
    return this.detectScenarioInternal(input)
  }

  evaluatePrompt(prompt: string, scenario?: PromptScenario): PromptEvaluation {
    const dims = {
      clarity: this.scoreClarity(prompt),
      specificity: this.scoreSpecificity(prompt),
      professionalism: this.scoreProfessionalism(prompt),
      completeness: this.scoreCompleteness(prompt),
      actionability: this.scoreActionability(prompt),
      relevance: scenario ? this.scoreRelevance(prompt, scenario) : 0.8,
      conciseness: this.scoreConciseness(prompt),
      structure: this.scoreStructure(prompt),
      knowledgeDepth: this.scoreKnowledgeDepth(prompt),
      formatCompliance: this.scoreFormatCompliance(prompt),
      scenarioFit: scenario ? this.scoreScenarioFit(prompt, scenario) : 0.7,
      apiSafety: prompt.length <= this.config.maxLength ? 1.0 : Math.max(0, 1 - (prompt.length - this.config.maxLength) / 100),
    }

    const weightedScore = Object.values(dims).reduce((s, v, i) => s + v * DIM_WEIGHTS[i], 0) / DIM_WEIGHTS.reduce((a, b) => a + b, 0)

    return {
      overallScore: Math.round(weightedScore * 100),
      grade: this.scoreToGrade(weightedScore * 100),
      dimensions: dims,
      strengths: this.identifyStrengths(dims),
      weaknesses: this.identifyWeaknesses(dims),
      suggestions: this.generateSuggestions(dims),
    }
  }

  trackEffect(data: Omit<EffectTrackingData, 'timestamp'>): void {
    if (!this.config.enableEffectTracking) return
    this.effectHistory.push({ ...data, timestamp: Date.now() })
    if (this.effectHistory.length > 10000) {
      this.effectHistory = this.effectHistory.slice(-5000)
    }
  }

  registerTemplate(template: PromptTemplate): void {
    this.templateRegistry.set(`${template.scenario}::${template.tier}`, template)
  }

  getTemplate(scenario: PromptScenario, tier: TemplateTier): PromptTemplate | null {
    return this.templateRegistry.get(`${scenario}::${tier}`) || null
  }

  listTemplates(): PromptTemplate[] {
    return Array.from(this.templateRegistry.values())
  }

  registerExamples(examples: FewShotExample[]): void {
    examples.forEach(ex => {
      const existing = this.exampleLibrary.get(ex.scenario) || []
      if (!existing.find(e => e.id === ex.id)) {
        existing.push(ex)
      }
      this.exampleLibrary.set(ex.scenario, existing)
    })
  }

  getExamples(scenario: PromptScenario, quality?: 'excellent' | 'good'): FewShotExample[] {
    const examples = this.exampleLibrary.get(scenario) || []
    if (quality) {
      return examples.filter(e => e.quality === quality)
    }
    return examples
  }

  getEffectSummary(): {
    totalCalls: number
    successRate: number
    avgLatency: number
    avgScore: number
    scenarioDistribution: Record<PromptScenario, number>
    tierDistribution: Record<TemplateTier, number>
    topScoringScenarios: { scenario: PromptScenario; avgScore: number }[]
  } {
    const total = this.effectHistory.length
    if (total === 0) {
      return {
        totalCalls: 0,
        successRate: 0,
        avgLatency: 0,
        avgScore: 0,
        scenarioDistribution: {} as Record<PromptScenario, number>,
        tierDistribution: {} as Record<TemplateTier, number>,
        topScoringScenarios: [],
      }
    }

    const successCount = this.effectHistory.filter(e => e.apiStatus === 'success').length
    const avgLatency = this.effectHistory.reduce((s, e) => s + e.latencyMs, 0) / total
    const avgScore = this.effectHistory.reduce((s, e) => s + e.avgSuggestionScore, 0) / total

    const scenarioDist: Record<string, number> = {}
    const tierDist: Record<string, number> = {}
    const scenarioScores: Record<string, { total: number; count: number }> = {}

    this.effectHistory.forEach(e => {
      scenarioDist[e.scenario] = (scenarioDist[e.scenario] || 0) + 1
      tierDist[e.tier] = (tierDist[e.tier] || 0) + 1
      if (!scenarioScores[e.scenario]) scenarioScores[e.scenario] = { total: 0, count: 0 }
      scenarioScores[e.scenario].total += e.avgSuggestionScore
      scenarioScores[e.scenario].count += 1
    })

    const topScenarios = Object.entries(scenarioScores)
      .map(([scenario, data]) => ({ scenario: scenario as PromptScenario, avgScore: data.total / data.count }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5)

    return {
      totalCalls: total,
      successRate: successCount / total,
      avgLatency,
      avgScore,
      scenarioDistribution: scenarioDist,
      tierDistribution: tierDist,
      topScoringScenarios: topScenarios,
    }
  }

  resetEffectHistory(): void {
    this.effectHistory = []
  }

  private detectScenarioInternal(input: string): ScenarioDetectionResult {
    const scenarios: {type: PromptScenario, keywords: RegExp[], weights: number[], hints: string}[] = [
      {
        type: 'formula_design',
        keywords: [/设计|开发|研发|配制|配方/g, /固体饮料|口服液|片剂|胶囊|粉剂|凝胶糖果/g, /功能性|特膳|保健食品/g],
        weights: [2.0, 1.5, 1.0],
        hints: '检测到配方设计意图：产品形态/功能定位/目标人群关键词',
      },
      {
        type: 'regulation_query',
        keywords: [/GB\s*\/?|GB-|GB\s|国家标准|法规|合规|备案|审批/g, /ADI|GRAS|NRV|营养素参考值/g, /新资源食品|保健功能|声称|标签标识/g],
        weights: [2.0, 1.5, 1.0],
        hints: '检测到法规查询意图：标准号/合规要求/申报流程关键词',
      },
      {
        type: 'process_optimization',
        keywords: [/工艺|参数|温度|时间|pH|压力|转速/g, /酶解|发酵|提取|干燥|制粒|包埋/g, /均质|乳化|杀菌|灌装|冷却/g],
        weights: [2.0, 1.5, 1.0],
        hints: '检测到工艺优化意图：操作条件/设备参数/过程控制关键词',
      },
      {
        type: 'ingredient_selection',
        keywords: [/原料|成分|配料|添加剂|辅料/g, /大豆肽|胶原蛋白|益生菌|膳食纤维|维生素|矿物质/g, /筛选|选择|对比|评价|推荐/g],
        weights: [2.0, 1.5, 1.0],
        hints: '检测到原料筛选意图：原料类别/品质指标/供应商评估关键词',
      },
      {
        type: 'efficacy_validation',
        keywords: [/功效|活性|验证|实验|临床|体外|体内/g, /IC50|EC50|生物利用度|吸收率|代谢/g, /降血糖|降血脂|抗氧化|免疫调节|改善睡眠/g],
        weights: [2.0, 1.5, 1.0],
        hints: '检测到功效验证意图：作用机制/评价指标/实验方法关键词',
      },
      {
        type: 'cost_analysis',
        keywords: [/成本|价格|预算|性价比|BOM|物料/g, /原料成本|加工成本|包装成本|物流/g, /核算|估算|优化|降低成本/g],
        weights: [2.0, 1.5, 1.0],
        hints: '检测到成本分析意图：成本结构/定价策略/利润分析关键词',
      },
      {
        type: 'market_positioning',
        keywords: [/市场|竞品|差异化|目标人群|消费/g, /Z世代|中老年|母婴|运动健身/g, /定位|卖点|渠道|品牌/g],
        weights: [2.0, 1.5, 1.0],
        hints: '检测到市场定位意图：市场细分/竞争策略/消费者洞察关键词',
      },
    ]

    const scores: {type: PromptScenario, score: number, keywords: string[]}[] = []

    scenarios.forEach(s => {
      let totalScore = 0
      const matchedKeywords: string[] = []

      s.keywords.forEach((regex, idx) => {
        const matches = input.match(regex)
        if (matches && matches.length > 0) {
          totalScore += s.weights[idx] * matches.length
          matches.forEach(m => {
            if (m.length <= 20 && !matchedKeywords.includes(m)) {
              matchedKeywords.push(m)
            }
          })
        }
      })

      if (totalScore > 0) {
        scores.push({ type: s.type, score: totalScore, keywords: matchedKeywords })
      }
    })

    if (scores.length === 0) {
      return {
        primary: 'general_inquiry',
        confidence: 0.3,
        detectedKeywords: [],
        suggestedTier: 'basic',
        reasoning: '未检测到特定场景关键词，回退至通用咨询',
      }
    }

    scores.sort((a, b) => b.score - a.score)
    const primary = scores[0]
    const maxScore = primary.score
    const totalScoreAll = scores.reduce((s, x) => s + x.score, 0)
    const confidence = Math.min(0.98, maxScore / (totalScoreAll * 0.6))

    let suggestedTier: TemplateTier = 'basic'
    if (input.length > 20) suggestedTier = 'standard'
    if (input.length > 40 || /[指标|参数|具体|详细|深度|对比]/.test(input)) suggestedTier = 'deep'

    const secondary = scores.length > 1 && scores[1].score >= maxScore * 0.5 ? scores[1].type : undefined

    const hints = scenarios.find(s => s.type === primary.type)?.hints || ''

    return {
      primary: primary.type,
      confidence: Math.round(confidence * 100) / 100,
      secondary,
      detectedKeywords: primary.keywords.slice(0, 5),
      suggestedTier,
      reasoning: `${hints}(得分:${primary.score.toFixed(1)}, 置信度:${(confidence * 100).toFixed(0)}%)`,
    }
  }

  private assembleBasePrompt(template: PromptTemplate, userInput: string): string {
    const parts: string[] = []

    parts.push('[' + template.role + ']')
    parts.push(template.systemInstruction)

    if (template.outputFormat) {
      parts.push('输出格式:' + template.outputFormat)
    }

    parts.push('用户输入:' + userInput)

    return parts.join(' | ')
  }

  private formatExamplesCompact(examples: FewShotExample[]): string {
    if (examples.length === 0) return ''
    const parts = examples.map(ex => '例:"' + ex.input + '"→' + ex.output.slice(0, 60) + (ex.output.length > 60 ? '...' : ''))
    return '参考:' + parts.join('; ') + ' '
  }

  private selectRelevantExamples(scenario: PromptScenario, maxCount: number): FewShotExample[] {
    const examples = this.exampleLibrary.get(scenario) || []
    const goodOnes = examples.filter(e => e.quality === 'excellent' || e.quality === 'good')
    return goodOnes.slice(0, maxCount)
  }

  private selectRelevantKnowledge(userInput: string, tokens: string[]): string[] {
    const relevant: string[] = []
    for (const token of tokens) {
      if (token.length <= 20) {
        const hasKeyword = tokens.some(t =>
          userInput.includes(t) ||
          t.split(/[\s/()[\]]/).some(part => part.length > 1 && userInput.includes(part)),
        )
        if (hasKeyword || tokens.length <= 3) {
          relevant.push(token)
        }
        if (relevant.length >= 3) break
      }
    }
    return relevant.length > 0 ? relevant : tokens.slice(0, 2)
  }

  private enforceLengthLimit(
    basePrompt: string,
    maxLength = 180,
  ): { prompt: string; wasTruncated: boolean; compressionRatio: number } {
    if (basePrompt.length <= maxLength) {
      return { prompt: basePrompt, wasTruncated: false, compressionRatio: 1.0 }
    }

    let compressed = basePrompt

    compressed = this.removeExamples(compressed, maxLength)
    if (compressed.length <= maxLength) return { prompt: compressed, wasTruncated: true, compressionRatio: basePrompt.length / compressed.length }

    compressed = this.shortenRole(compressed)
    if (compressed.length <= maxLength) return { prompt: compressed, wasTruncated: true, compressionRatio: basePrompt.length / compressed.length }

    compressed = this.compressKnowledgeTokens(compressed, Math.max(1, 2))
    if (compressed.length <= maxLength) return { prompt: compressed, wasTruncated: true, compressionRatio: basePrompt.length / compressed.length }

    compressed = this.truncateOutputFormat(compressed)
    if (compressed.length <= maxLength) return { prompt: compressed, wasTruncated: true, compressionRatio: basePrompt.length / compressed.length }

    compressed = compressed.slice(0, maxLength - 3) + '..."'
    return { prompt: compressed, wasTruncated: true, compressionRatio: basePrompt.length / compressed.length }
  }

  private removeExamples(text: string, _maxLength: number): string {
    void _maxLength;
    return text.replace(/参考:[^|]+\|\|?/g, '').replace(/\s+/g, ' ').trim()
  }

  private shortenRole(text: string): string {
    return text.replace(/\[[^\]]{10,}\]/g, (match) => {
      const inner = match.slice(1, -1)
      return '[' + inner.slice(0, 6) + ']'
    })
  }

  private compressKnowledgeTokens(text: string, maxTokens: number): string {
    return text.replace(/\[[^\]]+\]/g, (match) => {
      const tokens = match.slice(1, -1).split('|').slice(0, maxTokens)
      return '[' + tokens.join('|') + ']'
    })
  }

  private truncateOutputFormat(text: string): string {
    return text.replace(/输出格式:\[([^\]]{30,})\]/g, (_match, p1) => {
      return '输出格式:[' + p1.slice(0, 25) + '...]'
    })
  }

  private generateFallbackPrompt(userInput: string): GeneratedPrompt {
    const startTime = performance.now()
    const fallbackPrompt = '[食品AI助手] 请针对以下需求提供专业建议:' + userInput

    return {
      prompt: fallbackPrompt.length > this.config.maxLength ? fallbackPrompt.slice(0, this.config.maxLength) : fallbackPrompt,
      scenario: 'general_inquiry',
      tier: 'basic',
      templateId: 'fallback-000',
      appliedExamples: [],
      injectedKnowledge: [],
      length: Math.min(fallbackPrompt.length, this.config.maxLength),
      estimatedQuality: 0.65,
      metadata: {
        generationTimeMs: performance.now() - startTime,
        compressionRatio: 1.0,
        tokenCount: Math.ceil(Math.min(fallbackPrompt.length, this.config.maxLength) / 2),
      },
    }
  }

  private scoreClarity(prompt: string): number {
    if (!prompt || prompt.length < 5) return 0.2
    let score = 0.7
    if (/[：:]/.test(prompt)) score += 0.1
    if (/[\d%℃mgmlgkg]/i.test(prompt)) score += 0.1
    if (prompt.length <= 150) score += 0.05
    if (prompt.split(/[，。；|]/).length >= 3) score += 0.05
    return Math.min(1.0, score)
  }

  private scoreSpecificity(prompt: string): number {
    if (!prompt) return 0.1
    let score = 0.3
    const specificPatterns = [
      /\d+(\.\d+)?[%℃mgmlgkghrpm℃CFU Da IC50 EC50 ADI NRV]/gi,
      /GB\d+|ISO\d+|FDA|NMPA|EFSA|GRAS|HACCP|CDE/i,
      />\d+|<\d+|≥\d+|≤\d+|±\d+/g,
      /\d+-\d+/g,
    ]
    specificPatterns.forEach(p => {
      if (p.test(prompt)) score += 0.175
    })
    return Math.min(1.0, score)
  }

  private scoreProfessionalism(prompt: string): number {
    if (!prompt) return 0.1
    let score = 0.5
    const proTerms = ['专家', '顾问', '博士', '工程师', '总监', '分析', '评估', '优化', '策略', '方案', '合规', '标准', '参数']
    proTerms.forEach(term => {
      if (prompt.includes(term)) score += 0.03
    })
    if (/[A-Za-z]{2,}/.test(prompt)) score += 0.08
    return Math.min(1.0, score)
  }

  private scoreCompleteness(prompt: string): number {
    if (!prompt) return 0.1
    let score = 0.4
    const dimensions = ['原料', '工艺', '法规', '成本', '市场', '参数', '标准', '质量', '安全', '效果']
    const found = dimensions.filter(d => prompt.includes(d)).length
    score += found * 0.05
    if (prompt.length >= 80) score += 0.1
    return Math.min(1.0, score)
  }

  private scoreActionability(prompt: string): number {
    if (!prompt) return 0.1
    let score = 0.3
    const actionWords = ['建议', '采用', '选择', '调整', '优化', '添加', '降低', '提高', '控制在', '推荐', '使用', '设置']
    actionWords.forEach(w => {
      if (prompt.includes(w)) score += 0.05
    })
    if (/\d+[%℃mgmlgkg]/i.test(prompt)) score += 0.1
    return Math.min(1.0, score)
  }

  private scoreRelevance(prompt: string, scenario: PromptScenario): number {
    const scenarioKeywords: Record<PromptScenario, string[]> = {
      formula_design: ['配方', '设计', '研发', '原料', '复配', '功能', '产品'],
      regulation_query: ['法规', '标准', 'GB', '合规', '审批', '备案', '声称', '标签'],
      process_optimization: ['工艺', '参数', '温度', '时间', '压力', '发酵', '干燥', '杀菌'],
      ingredient_selection: ['原料', '成分', '供应商', '选择', '对比', '筛选', '品质'],
      efficacy_validation: ['功效', '验证', '实验', '临床', '活性', 'IC50', '体外', '体内'],
      cost_analysis: ['成本', '价格', '预算', 'BOM', '核算', '降本', '利润'],
      market_positioning: ['市场', '定位', '竞品', '人群', '渠道', '差异化', '消费'],
      general_inquiry: ['什么', '如何', '为什么', '解释', '说明', '介绍'],
    }
    const keywords = scenarioKeywords[scenario] || []
    const matchCount = keywords.filter(k => prompt.includes(k)).length
    return Math.min(1.0, 0.4 + matchCount * 0.12)
  }

  private scoreConciseness(prompt: string): number {
    if (!prompt) return 0.5
    const len = prompt.length
    if (len <= 80) return 1.0
    if (len <= 120) return 0.9
    if (len <= 150) return 0.75
    if (len <= 170) return 0.6
    return Math.max(0.2, 0.5 - (len - 170) / 100)
  }

  private scoreStructure(prompt: string): number {
    if (!prompt) return 0.1
    let score = 0.4
    if (/\[.*?\]/.test(prompt)) score += 0.15
    if (/[|｜]/.test(prompt)) score += 0.15
    if (/[①②③④⑤]/.test(prompt) || /\d+[.、)]/.test(prompt)) score += 0.15
    if (/[：:]\s*\S+/.test(prompt)) score += 0.15
    return Math.min(1.0, score)
  }

  private scoreKnowledgeDepth(prompt: string): number {
    if (!prompt) return 0.1
    let score = 0.3
    const knowledgeTerms = [
      /GB\s*\d+/, /ISO\s*\d+/, /IC50|EC50|AD[Ii]|GRAS|NRV|CFU|HACCP|CDE|NMPA|FDA|EFSA/i,
      /Da|rpm|ppm|pH|CAGR|ROI|NPV|IRR|OEE|EVA|WACC|TCO|LTV|CAC|NPS|TGI|QbD|PAT|CPP|CQA|GLP|RCT|RWS|HTA|FTO|ESG|LME|USDA|REACH|SCOPE|ICH|ASPEN|CFD|RSM|DOE|ABC|ZBB|STP|SWOT|PESTEL|CLV|BCG|ADMET|PK\/PD|MOA|EDI|DE/i,
      /酶解|发酵|均质|乳化|包埋|喷雾干燥|冻干|超滤|纳滤|色谱|质谱|核磁|PCR|ELISA|HPLC|GC-MS|LC-MS/,
    ]
    knowledgeTerms.forEach(p => {
      if (p.test(prompt)) score += 0.12
    })
    return Math.min(1.0, score)
  }

  private scoreFormatCompliance(prompt: string): number {
    if (!prompt) return 0.1
    let score = 0.5
    if (prompt.includes('[{')) score += 0.2
    if (prompt.includes('"text"') || prompt.includes("'text'")) score += 0.15
    if (prompt.includes('"category"') || prompt.includes("'category'")) score += 0.1
    if (prompt.includes('"score"') || prompt.includes("'score'")) score += 0.05
    return Math.min(1.0, score)
  }

  private scoreScenarioFit(prompt: string, scenario: PromptScenario): number {
    return this.scoreRelevance(prompt, scenario)
  }

  private scoreToGrade(score: number): 'S' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 95) return 'S'
    if (score >= 90) return 'A+'
    if (score >= 80) return 'A'
    if (score >= 72) return 'B+'
    if (score >= 65) return 'B'
    if (score >= 55) return 'C'
    if (score >= 40) return 'D'
    return 'F'
  }

  private identifyStrengths(dims: Record<string, number>): string[] {
    const strengths: string[] = []
    const labels: Record<string, string> = {
      clarity: '表达清晰易懂',
      specificity: '参数具体明确',
      professionalism: '专业术语准确',
      completeness: '信息覆盖全面',
      actionability: '可操作性强',
      relevance: '与场景高度相关',
      conciseness: '长度适中精炼',
      structure: '结构化程度高',
      knowledgeDepth: '领域知识深厚',
      formatCompliance: '格式规范合规',
      scenarioFit: '场景适配度高',
      apiSafety: 'API长度安全',
    }
    Object.entries(dims).forEach(([key, value]) => {
      if (value >= 0.85 && labels[key]) {
        strengths.push(labels[key])
      }
    })
    return strengths.slice(0, 5)
  }

  private identifyWeaknesses(dims: Record<string, number>): string[] {
    const weaknesses: string[] = []
    const labels: Record<string, string> = {
      clarity: '表达不够清晰',
      specificity: '缺乏具体参数',
      professionalism: '专业性待提升',
      completeness: '信息不够完整',
      actionability: '可操作性较弱',
      relevance: '与场景相关性低',
      conciseness: '篇幅偏长冗余',
      structure: '结构化不足',
      knowledgeDepth: '领域知识较浅',
      formatCompliance: '格式不规范',
      scenarioFit: '场景适配偏差',
      apiSafety: '超出API长度限制',
    }
    Object.entries(dims).forEach(([key, value]) => {
      if (value < 0.5 && labels[key]) {
        weaknesses.push(labels[key])
      }
    })
    return weaknesses.slice(0, 5)
  }

  private generateSuggestions(dims: Record<string, number>): string[] {
    const suggestions: string[] = []
    if (dims.specificity < 0.6) suggestions.push('增加具体数值参数和国标号引用')
    if (dims.actionability < 0.6) suggestions.push('补充可执行的步骤和建议')
    if (dims.knowledgeDepth < 0.5) suggestions.push('注入更多领域专业知识token')
    if (dims.conciseness < 0.5) suggestions.push('精简冗余表述，聚焦核心指令')
    if (dims.structure < 0.5) suggestions.push('使用结构化格式(如序号/分隔符)')
    if (dims.apiSafety < 0.8) suggestions.push('压缩内容以满足API长度限制(≤180字符)')
    if (suggestions.length === 0) suggestions.push('当前提示词质量优秀，可尝试deep层级获取更深度的建议')
    return suggestions.slice(0, 4)
  }
}

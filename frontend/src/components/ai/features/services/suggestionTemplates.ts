export interface SuggestionTemplate {
  id: string
  intentType: IntentType
  framework: FrameworkType
  title: string
  description?: string
  sections: TemplateSection[]
  qualityBaseline: number
  estimatedQScore: number
}

export interface TemplateSection {
  heading: string
  content: string
  bulletPoints?: string[]
  references?: string[]
  importance: 'critical' | 'high' | 'medium' | 'low'
}

export interface RenderedSuggestion {
  id: string
  title: string
  sections: RenderedSection[]
  qScore: number
  intentType: IntentType
}

export interface RenderedSection {
  heading: string
  content: string
  bulletPoints: string[]
  references?: string[]
  importance: string
}

export type IntentType =
  | 'FORMULA_DESIGN'
  | 'SAFETY_ASSESSMENT'
  | 'PERFORMANCE_OPT'
  | 'COST_REDUCTION'
  | 'REGULATORY_COMPLIANCE'
  | 'INGREDIENT_ANALYSIS'
  | 'PROCESS_TECHNOLOGY'
  | 'MARKET_POSITIONING'
  | 'QUALITY_ASSURANCE'

export type FrameworkType = 'A' | 'B' | 'C' | 'D' | 'GENERAL'

export const TEMPLATE_VARIABLES = {
  productForm: { default: '产品', description: '产品形态' },
  mainIngredient: { default: '核心原料', description: '主要功能性成分' },
  functionalClaim: { default: '功能诉求', description: '核心功能宣称' },
  ingredientType1: { default: '功能因子A', description: '备选原料1' },
  ingredientType2: { default: '功能因子B', description: '备选原料2' },
  ingredientType3: { default: '功能因子C', description: '备选原料3' },
  function1: { default: '功能机制1', description: '作用机制1' },
  function2: { default: '功能机制2', description: '作用机制2' },
  function3: { default: '功能机制3', description: '作用机制3' },
  processTechnology: { default: '生产工艺', description: '核心技术' },
  processParam1: { default: '关键工艺参数', description: '工艺参数详情' },
  thermalProtection: { default: '热保护措施', description: '热敏感成分保护' },
  validationMetric: { default: '验证指标', description: '质量评价指标' },
  stabilityThreshold: { default: '85%', description: '稳定性阈值' },
  animalModel: { default: '动物模型', description: '实验动物种类' },
  feedingPeriod: { default: '8周', description: '喂养周期' },
  subjectCount: { default: '120', description: '受试者数量' },
  referenceSource: { default: '参考文献', description: '研究文献来源' },
  referenceSource1: { default: '参考文献1', description: '研究文献来源1' },
  referenceSource2: { default: '参考文献2', description: '研究文献来源2' },
  referenceSource3: { default: '参考文献3', description: '研究文献来源3' },
  carrierSystemDesign: { default: '载体系统设计方案', description: '载体选择依据' },
  carrier1: { default: '载体原料1', description: '载体成分1' },
  carrier2: { default: '载体原料2', description: '载体成分2' },
  synergyEffect: { default: '协同增效', description: '协同效应描述' },
  solubilityOptimization: { default: '溶解性优化', description: '溶解性能改进' },
  validationMetric1: { default: '验证指标1', description: '验证指标详情1' },
  competitorProduct: { default: '竞品名称', description: '主要竞品' },
  uspPoint: { default: '独特卖点', description: '差异化优势' },
  targetPopulation: { default: '目标人群', description: '适用人群' },
  dosageForm: { default: '剂型', description: '产品剂型' },
  shelfLife: { default: '24个月', description: '保质期' },
  storageCondition: { default: '阴凉干燥处', description: '储存条件' },
  regulatoryBody: { default: '监管机构', description: '主管监管部门' },
  standardCode: { default: '标准编号', description: '适用标准代码' },
  maxDosage: { default: '最大用量', description: '每日最大摄入量' },
  allergenInfo: { default: '过敏原信息', description: '过敏原声明' },
  specialGroup: { default: '特殊人群', description: '需关注的人群' },
  interactionWarning: { default: '相互作用警告', description: '药物/成分相互作用' },
  sensoryAttribute: { default: '感官属性', description: '风味/口感描述' },
  stabilityFactor: { default: '稳定性因素', description: '影响稳定性的因素' },
  bioavailabilityMethod: { default: '生物利用度提升方法', description: '提高吸收的方法' },
  textureParameter: { default: '质构参数', description: 'TPA测试指标' },
  costTarget: { default: '成本目标', description: '目标成本范围' },
  alternativeIngredient: { default: '替代原料', description: '低成本替代方案' },
  processEfficiency: { default: '工艺效率', description: '效率提升点' },
  supplierName: { default: '供应商名称', description: '推荐供应商' },
  marketSegment: { default: '细分市场', description: '目标市场分区' },
  consumerInsight: { default: '消费者洞察', description: '用户需求痛点' },
  trendKeyword: { default: '趋势关键词', description: '市场趋势标签' },
  patentOpportunity: { default: '专利机会', description: '可申请专利的技术点' },
} as const

export type TemplateVariableKey = keyof typeof TEMPLATE_VARIABLES

const FORMULA_DESIGN_TEMPLATES: SuggestionTemplate[] = [
  {
    id: 'FD-001',
    intentType: 'FORMULA_DESIGN',
    framework: 'A',
    title: '🎯 系统性{{productForm}}开发路径',
    sections: [
      {
        heading: '📋 阶段1: 功能性原料筛选与验证',
        content: '基于"{{mainIngredient}}"的{{functionalClaim}}目标，建议采用以下筛选策略：',
        bulletPoints: [
          '推荐{{ingredientType1}}（{{function1}}）+ {{ingredientType2}}（{{function2}}）+ {{ingredientType3}}（{{function3}}）',
          '参考来源：{{referenceSource1}}、{{referenceSource2}}、{{referenceSource3}}',
          '验证指标：{{validationMetric1}}，体外消化稳定性 ≥ {{stabilityThreshold}}',
        ],
        importance: 'critical',
      },
      {
        heading: '🧪 阶段2: 载体系统设计',
        content: '{{carrierSystemDesign}}',
        bulletPoints: [
          '推荐{{carrier1}} + {{carrier2}}（{{synergyEffect}}协同）',
          '{{solubilityOptimization}}：添加速溶抗结剂（二氧化硅 ≤ 0.5%）',
        ],
        importance: 'high',
      },
      {
        heading: '⚙️ 阶段3: 工艺关键点',
        content: '{{processTechnology}}工艺参数优化：',
        bulletPoints: [
          '{{processParam1}}',
          '{{thermalProtection}}：环糊精包埋或微胶囊化',
        ],
        importance: 'high',
      },
      {
        heading: '📊 阶段4: 功能验证方案',
        content: '功效验证试验设计：',
        bulletPoints: [
          '动物实验：{{animalModel}}，{{feedingPeriod}}喂养期',
          '人体试食：{{subjectCount}}例，双盲随机对照',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 88,
    estimatedQScore: 92,
  },
  {
    id: 'FD-002',
    intentType: 'FORMULA_DESIGN',
    framework: 'B',
    title: '🔬 {{mainIngredient}}深度解析与配方构建',
    sections: [
      {
        heading: '🧬 作用机制深度剖析',
        content: '{{mainIngredient}}在{{productForm}}中的核心作用路径：',
        bulletPoints: [
          '一级通路：{{function1}} → 激活下游信号级联',
          '二级效应：{{function2}}，协同增强{{function3}}',
          '时效特征：起效时间{{feedingPeriod}}，持续作用周期≥{{shelfLife}}',
        ],
        references: ['分子作用机制文献', '体外细胞实验数据', '临床前研究摘要'],
        importance: 'critical',
      },
      {
        heading: '🏭 推荐供应商与规格',
        content: '基于质量-成本-供应稳定性三维评估：',
        bulletPoints: [
          '首选：{{supplierName}}（纯度≥98%，批间差异CV<3%）',
          '备选：国产替代方案（{{alternativeIngredient}}，成本降低15-20%）',
          '质量标准：符合{{standardCode}}，重金属≤10ppm，微生物<100CFU/g',
        ],
        importance: 'high',
      },
      {
        heading: '💰 成本估算模型',
        content: '单剂量（{{dosageForm}}）BOM成本构成：',
        bulletPoints: [
          '功能性原料占比：45-60%（{{mainIngredient}}为核心驱动）',
          '载体与辅料：25-30%',
          '工艺分摊：10-15%（含{{thermalProtection}}处理成本）',
          '包装与损耗：5-10%',
        ],
        importance: 'medium',
      },
      {
        heading: '✅ 质量控制节点',
        content: '全流程QC关键控制点：',
        bulletPoints: [
          '进料检验：HPLC含量测定、红外指纹图谱比对',
          '中间控制：{{validationMetric1}}在线监测',
          '成品放行：{{stabilityThreshold}}加速稳定性通过率≥95%',
        ],
        importance: 'high',
      },
    ],
    qualityBaseline: 86,
    estimatedQScore: 90,
  },
  {
    id: 'FD-003',
    intentType: 'FORMULA_DESIGN',
    framework: 'C',
    title: '⚡ {{productForm}} MVP快速原型开发',
    sections: [
      {
        heading: '🎯 核心指标优先级矩阵',
        content: 'MVP版本聚焦{{functionalClaim}}的最低可行验证：',
        bulletPoints: [
          'P0必达：{{mainIngredient}}含量达标 + {{validationMetric1}}合格',
          'P1重要：感官接受度≥70分（9分制）',
          'P2优化：{{stabilityThreshold}}初步稳定性数据',
        ],
        importance: 'critical',
      },
      {
        heading: '📦 精简配方骨架',
        content: 'MVP最小原料清单（≤8种成分）：',
        bulletPoints: [
          '活性核心：{{ingredientType1}} + {{ingredientType2}}（双因子协同）',
          '基础载体：{{carrier1}}（单一载体简化体系）',
          '必要辅料：抗结剂 + 风味掩蔽剂（{{sensoryAttribute}}优化）',
        ],
        importance: 'high',
      },
      {
        heading: '🔄 迭代优化路径',
        content: '基于MVP反馈的三轮迭代计划：',
        bulletPoints: [
          'V1.0→V1.2：增加{{ingredientType3}}，补强{{function3}}',
          'V1.2→V2.0：引入{{bioavailabilityMethod}}，提升吸收效率',
          'V2.0+: 差异化升级（{{uspPoint}}方向）',
        ],
        importance: 'medium',
      },
      {
        heading: '⏱️ 快速验证里程碑',
        content: '8周MVP开发时间线：',
        bulletPoints: [
          'W1-W2：原料采购与小试试制',
          'W3-W4：核心指标验证（{{validationMetric}}）',
          'W5-W6：内部感官评估与微调',
          'W7-W8：小批量用户测试与数据收集',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 80,
    estimatedQScore: 84,
  },
  {
    id: 'FD-004',
    intentType: 'FORMULA_DESIGN',
    framework: 'D',
    title: '🚀 {{productForm}}差异化创新方案',
    sections: [
      {
        heading: '🔍 竞品技术对标分析',
        content: 'vs {{competitorProduct}}的差异化扫描：',
        bulletPoints: [
          '竞品弱点：{{function1}}缺失 / {{stabilityThreshold}}不足 / 剂型单一',
          '市场空白：{{targetPopulation}}未被充分覆盖',
          '技术机会：{{patentOpportunity}}可形成专利壁垒',
        ],
        importance: 'critical',
      },
      {
        heading: '💎 USP（独特卖点）提炼',
        content: '本配方的核心差异化主张：',
        bulletPoints: [
          'USP-1：{{uspPoint}}——行业首创/独家技术',
          'USP-2：{{bioavailabilityMethod}}——吸收率提升30%+',
          'USP-3：{{sensoryAttribute}}——突破性口感体验',
        ],
        importance: 'high',
      },
      {
        heading: '📜 专利布局建议',
        content: '可保护的知识产权组合：',
        bulletPoints: [
          '发明专利：{{mainIngredient}} + {{carrier1}}复配体系及制备方法',
          '实用新型：{{dosageForm}}新型结构设计',
          '外观专利：包装视觉识别系统',
        ],
        references: ['专利检索报告', 'FTO自由实施分析'],
        importance: 'high',
      },
      {
        heading: '📈 技术壁垒构建路线',
        content: '12个月技术护城河规划：',
        bulletPoints: [
          'Q1-Q2：核心配方专利递交（PCT可选）',
          'Q3：建立{{validationMetric1}}企业内控标准（高于国标20%）',
          'Q4：发布行业白皮书/专家共识，确立技术话语权',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 85,
    estimatedQScore: 89,
  },
  {
    id: 'FD-005',
    intentType: 'FORMULA_DESIGN',
    framework: 'GENERAL',
    title: '💰 成本敏感型{{productForm}}开发方案',
    sections: [
      {
        heading: '📊 性价比原料替代矩阵',
        content: '在保持{{functionalClaim}}效果前提下的降本策略：',
        bulletPoints: [
          '高→中：{{ingredientType1}} → {{alternativeIngredient}}（效能保留85%，成本↓40%）',
          '进口→国产：{{supplierName}}国产线（质量等效认证）',
          '天然→发酵：生物合成路线（{{processTechnology}}优化后成本↓25%）',
        ],
        importance: 'critical',
      },
      {
        heading: '🏭 工艺简化与规模化考量',
        content: '适合大规模生产的工艺选择：',
        bulletPoints: [
          '合并工序：将{{processParam1}}两步合一，减少设备投入',
          '常温操作：避免高温步骤，降低能耗（{{thermalProtection}}改用冷工艺）',
          '连续生产：从批次式改为连续流工艺，产能↑50%',
        ],
        importance: 'high',
      },
      {
        heading: '📦 规模化经济性分析',
        content: '不同产量区间的成本曲线：',
        bulletPoints: [
          '1万批/月：单件成本{{costTarget}}（含原料+人工+折旧）',
          '5万批/月：规模效应显现，成本↓18%',
          '10万批/月+：最优区间，边际成本趋稳',
        ],
        importance: 'medium',
      },
      {
        heading: '⚖️ 成本-质量平衡决策树',
        content: '关键取舍点的判断框架：',
        bulletPoints: [
          '底线不可妥协：{{maxDosage}}安全限值、微生物指标、重金属限量',
          '可弹性调整：原料纯度等级（食品级 vs 药用级）、包装档次',
          '建议优先保：{{validationMetric1}}核心功效指标 > 感官次要属性',
        ],
        importance: 'high',
      },
    ],
    qualityBaseline: 78,
    estimatedQScore: 82,
  },
]

const SAFETY_ASSESSMENT_TEMPLATES: SuggestionTemplate[] = [
  {
    id: 'SA-001',
    intentType: 'SAFETY_ASSESSMENT',
    framework: 'A',
    title: '☠️ {{mainIngredient}}毒理学安全评估（NOAEL/ADI推导）',
    sections: [
      {
        heading: '🧪 毒理学数据汇总',
        content: '基于现有研究的毒性谱系分析：',
        bulletPoints: [
          '急性毒性：LD₅₀ > {{maxDosage}} mg/kg（实际属实际无毒级）',
          '亚慢性（90天）：NOAEL = {{maxDosage}} mg/kg·bw/day',
          '慢性/致癌：无明确证据（IARC未归类）',
          '遗传毒性：Ames试验阴性 + 染色体畸变阴性',
        ],
        references: ['OECD TG 407/408/451-453 试验报告', ' peer-reviewed 毒理学期刊'],
        importance: 'critical',
      },
      {
        heading: '📐 ADI/MOS 推导计算',
        content: '安全摄入量科学推算：',
        bulletPoints: [
          'NOAEL → ADI：应用100倍安全系数（种内10×种间10）',
          'ADI = NOAEL ÷ 100 = {{maxDosage}} mg/kg·bw/day',
          '暴露评估：成人日均摄入 ≈ ADI的{{stabilityThreshold}}（MOS = {{subjectCount}}）',
          '结论：正常使用条件下安全性裕度充足',
        ],
        importance: 'critical',
      },
      {
        heading: '⚠️ 特殊毒性关注点',
        content: '需要额外监测的风险信号：',
        bulletPoints: [
          '生殖发育毒性：{{specialGroup}}孕期/哺乳期需限制使用',
          '器官特异性：高剂量下{{targetPopulation}}负荷略增（可逆性）',
          '代谢产物：主要经肝脏代谢，肝功能不全者慎用',
        ],
        importance: 'high',
      },
      {
        heading: '📋 安全性结论与建议',
        content: '综合毒理学评价意见：',
        bulletPoints: [
          '总体分类：在{{dosageForm}}推荐剂量范围内**安全可用**',
          '标签要求：注明{{allergenInfo}}、{{maxDosage}}上限、{{specialGroup}}警示',
          '后续建议：补充28天重复给药试验（如法规强制要求）',
        ],
        importance: 'high',
      },
    ],
    qualityBaseline: 90,
    estimatedQScore: 94,
  },
  {
    id: 'SA-002',
    intentType: 'SAFETY_ASSESSMENT',
    framework: 'B',
    title: '🚨 过敏原与特殊人群风险评估',
    sections: [
      {
        heading: '🔴 过敏原识别与管控',
        content: '{{mainIngredient}}及其辅料的致敏风险排查：',
        bulletPoints: [
          '已知过敏原：{{allergenInfo}}（检出率约{{stabilityThreshold}} in 敏感人群）',
          '交叉反应：与{{ingredientType1}}存在IgE交叉（结构相似性72%）',
          '隐匿来源：可能来源于{{supplierName}}供应链共线污染',
        ],
        importance: 'critical',
      },
      {
        heading: '👥 特殊人群分层评估',
        content: '不同生理状态人群的安全性差异：',
        bulletPoints: [
          '{{targetPopulation}}：剂量减半或禁用（{{interactionWarning}}）',
          '儿童（<12岁）：暂无足够数据支持，不建议使用',
          '老年人：常规剂量安全，注意与慢病用药的{{interactionWarning}}',
          '孕妇/哺乳期：原则性避免，除非有明确的获益-风险评估',
        ],
        importance: 'high',
      },
      {
        heading: '🛡️ 风险缓解措施',
        content: '降低不良事件发生率的实操方案：',
        bulletPoints: [
          '源头控制：选择无过敏原宣称的原料批次',
          '过程隔离：独立生产线或彻底清洗验证（ATP检测<10 RLU）',
          '标签透明：明确标注"含有{{allergenInfo}}"及"可能含有微量..."',
          '上市后监测：建立不良反应收集渠道（400热线+线上表单）',
        ],
        importance: 'high',
      },
      {
        heading: '📊 不良事件预案',
        content: 'AE/SAE应急响应流程：',
        bulletPoints: [
          '一级响应（轻微皮疹/消化道不适）：停用+观察，24h随访',
          '二级响应（过敏性休克征象）：立即就医+上报{{regulatoryBody}}',
          '根因分析：48小时内完成批次追溯与留样复检',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 87,
    estimatedQScore: 91,
  },
  {
    id: 'SA-003',
    intentType: 'SAFETY_ASSESSMENT',
    framework: 'C',
    title: '📋 GB/FDA/EFSA 三重合规检查清单',
    sections: [
      {
        heading: '🇨🇳 中国 GB 标准合规',
        content: 'GB 16740/GB 14881/GB 2760 等核心标准核查：',
        bulletPoints: [
          '原料准入：{{mainIngredient}}是否列入《可用于保健食品原料目录》？',
          '用量限制：是否符合{{maxDosage}}规定？',
          '污染物：铅≤1.0ppm、砷≤0.5ppm、汞≤0.3ppm、镉≤0.3ppm',
          '微生物：菌落总数≤1000CFU/g，霉菌酵母≤50CFU/g',
        ],
        references: ['GB 16740-2014', 'GB 2760-2024', '保健食品原料目录'],
        importance: 'critical',
      },
      {
        heading: '🇺🇸 FDA 合规要点',
        content: '美国市场准入的安全与标签要求：',
        bulletPoints: [
          'GRAS状态：确认{{mainIngredient}}具有GRAS认定或NDI通知',
          'DSHEA合规：作为膳食 supplement 的"结构/功能声称"边界',
          'cGMP生产：21 CFR Part 111 全套记录要求',
          'Supplement Facts label 格式与每日值%标注',
        ],
        importance: 'high',
      },
      {
        heading: '🇪🇺 EFSA 合规审查',
        content: '欧盟市场的健康声称与 Novel Food 审查：',
        bulletPoints: [
          '健康声称（HC）：第{{standardCode}}号授权清单检索',
          'Novel Food：1997年前食用历史证明 or 安全性全套 dossier',
          ' contaminants：Reg (EC) No 1881/2006 限量对标',
        ],
        importance: 'high',
      },
      {
        heading: '✅ 合规差距分析与整改',
        content: '三地区合规性对比与行动项：',
        bulletPoints: [
          '中国缺口：{{validationMetric}}补充检测 + 保健食品注册资料准备',
          '美国缺口：GRAS self-affirmation 或咨询专家 opinion',
          '欧盟缺口：Novel Food application 或 历史消费证据收集',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 89,
    estimatedQScore: 93,
  },
  {
    id: 'SA-004',
    intentType: 'SAFETY_ASSESSMENT',
    framework: 'D',
    title: '🔄 {{productForm}}全生命周期安全性监控体系',
    sections: [
      {
        heading: '🌱 研发阶段安全门控',
        content: '从实验室到上市的每道安全关卡：',
        bulletPoints: [
          'Gate 0（立项）：原料安全性预筛（ToxCast数据库查询）',
          'Gate 1（配方定型）：28天亚急性毒性预试验',
          'Gate 2（中试）：扩大安全性数据包（遗传+亚慢性）',
          'Gate 3（注册申报）：完整毒理学 dossiers 提交{{regulatoryBody}}',
        ],
        importance: 'critical',
      },
      {
        heading: '🏭 生产过程安全控制',
        content: 'GMP环境下的质量安全保障：',
        bulletPoints: [
          'CCP监控：{{processTechnology}}关键控制点实时记录（温度/压力/时间）',
          '变更管理：任何原料/工艺变更需重新进行安全影响评估',
          '偏差处理：OOS/OOT结果触发CAPA流程，不放行可疑批次',
        ],
        importance: 'high',
      },
      {
        heading: '📡 上市后安全监测（PV）',
        content: '产品生命周期内的持续安全跟踪：',
        bulletPoints: [
          '被动监测：不良反应自发报告收集（MedWatch/EudraVigilance对等）',
          '主动监测：定期用户回访问卷（每{{feedingPeriod}}一次抽样调查）',
          '信号检测：PSUR定期安全性更新报告（首年季度，次年年度）',
          '风险评估：PRAC模式的新兴风险识别会议',
        ],
        importance: 'high',
      },
      {
        heading: '🚨 应急召回与危机管理',
        content: '重大安全事件的快速响应预案：',
        bulletPoints: [
          '召回分级：Class I（严重健康危害）→ 24h内启动',
          '根因追溯：区块链/批次码实现秒级定位',
          '沟通策略：统一口径（法务+医学+公关三方会签）',
          '事后复盘：修订{{validationMetric1}}安全标准，预防再发',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 86,
    estimatedQScore: 90,
  },
]

const PERFORMANCE_OPT_TEMPLATES: SuggestionTemplate[] = [
  {
    id: 'PO-001',
    intentType: 'PERFORMANCE_OPT',
    framework: 'A',
    title: '🍷 {{productForm}}感官品质优化（风味轮方法）',
    sections: [
      {
        heading: '🎨 风味剖面诊断',
        content: '当前{{sensoryAttribute}}的感官短板识别：',
        bulletPoints: [
          '香气维度：{{ingredientType1}}带来苦涩底味（强度6/10）',
          '味道维度：甜感不足、酸度偏高、余味有金属感',
          '口感质地：颗粒感明显、溶散速度偏慢（>60s）',
          '整体接受度：预测试评分 5.8/9（目标≥7.5）',
        ],
        importance: 'critical',
      },
      {
        heading: '🔧 优化工具箱',
        content: '针对各维度的改良手段：',
        bulletPoints: [
          '风味掩蔽：环糊精包埋苦味 + 三氯蔗糖/赤藓糖醇调甜',
          '酸度调节：柠檬酸钠缓冲体系（pH 6.5-7.0最佳区间）',
          '口感改良：微粉化至D90<50μm + 胶体磨均质处理',
          '香气增强：天然香料微胶囊缓释（前调/中调/尾调分层释放）',
        ],
        importance: 'high',
      },
      {
        heading: '👃 风味轮迭代实验设计',
        content: 'DoE（实验设计）优化路径：',
        bulletPoints: [
          '因素筛选：Plackett-Burman 设计筛选关键变量（6因子12次运行）',
          '响应面优化：Box-Behnken 中心复合设计精确定位最优配比',
          '验证批次：3批放大确认（感官小组n=12，重复3轮）',
          '目标指标：综合评分≥7.5，个体差异CV<15%',
        ],
        importance: 'high',
      },
      {
        heading: '📊 感官评价标准化',
        content: '建立可重复的感官测试SOP：',
        bulletPoints: [
          '评价员培训：ISO 8586 认证资质 + 产品定向校准',
          '测试环境：独立隔间、红色灯光遮蔽颜色偏差、室温22±2℃',
          '评分量表：9分 hedonic scale + JAR（just-about-right）辅助',
          '统计分析：ANOVA + Tukey HSD 多重比较（p<0.05显著性）',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 85,
    estimatedQScore: 89,
  },
  {
    id: 'PO-002',
    intentType: 'PERFORMANCE_OPT',
    framework: 'B',
    title: '🛡️ {{productForm}}稳定性提升技术方案',
    sections: [
      {
        heading: '🌡️ 失效模式分析（FMEA）',
        content: '影响{{stabilityFactor}}的主要降解途径：',
        bulletPoints: [
          '氧化失效：不饱和键氧化 → 异味生成（Arrhenius Ea≈85kJ/mol）',
          '水解失效：酯键断裂 → 功效下降（RH>65%加速因子3.2x）',
          '光解失效：紫外波段吸收 → 变色/活性损失（λmax={{stabilityThreshold}}nm）',
          '美拉德反应：还原糖+氨基酸 → 褐变（温度每升10℃速率翻倍）',
        ],
        importance: 'critical',
      },
      {
        heading: '🧪 稳定性增强策略',
        content: '针对性防护措施组合：',
        bulletPoints: [
          '抗氧化体系：VC+VE+BHT复配（总抗氧化剂≤0.02%）',
          '防潮包装：铝箔袋+脱氧剂（残氧<1%）+ 干燥剂（硅胶/gypsum）',
          '避光设计：不透明容器或 UV-absorbing 外盒',
          '配方调整：降低还原糖含量 + 替换非反应性载体（{{carrier1}}）',
        ],
        importance: 'high',
      },
      {
        heading: '⏱️ 加速稳定性试验设计',
        content: 'ICH Q1A(R2)指导原则下的试验方案：',
        bulletPoints: [
          '长期条件：25℃±2℃/60%RH±5%，采样点0/3/6/9/12/18/24月',
          '中间条件：30℃±2℃/65%RH±5%，采样点0/6/9/12月',
          '加速条件：40℃±2℃/75%RH±5%，采样点0/1/2/3/6月',
          '判定标准：含量90-110%标示量、感官无明显变化、微生物合格',
        ],
        references: ['ICH Q1A(R2)', 'CPMP/QWP/2934/99'],
        importance: 'high',
      },
      {
        heading: '📈 Shelf-Life 预测建模',
        content: '基于Arrhenius方程的有效期推算：',
        bulletPoints: [
          '数据拟合：多温度点含量-时间非线性回归',
          '预测结果：25℃条件下{{shelfLife}}置信概率≥95%',
          '货架期建议：标注{{shelfLife}}（预留20%安全边际）',
          '监控指标：{{validationMetric1}}为主，关联指标为辅',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 87,
    estimatedQScore: 91,
  },
  {
    id: 'PO-003',
    intentType: 'PERFORMANCE_OPT',
    framework: 'C',
    title: '🧬 {{mainIngredient}}生物利用度增强策略',
    sections: [
      {
        heading: '📉 当前吸收瓶颈诊断',
        content: '限制{{bioavailabilityMethod}}的关键屏障：',
        bulletPoints: [
          '溶解性障碍：水溶性差（<1μg/mL），胃内析出沉淀',
          '渗透性障碍：P-gp外排泵底物，肠道吸收率<15%',
          '首过代谢：CYP3A4广泛代谢，口服绝对生物利用度仅{{stabilityThreshold}}%',
          '食物效应：高脂餐后AUC提升2.3x（胆盐增溶作用）',
        ],
        importance: 'critical',
      },
      {
        heading: '💊 增溶技术选项',
        content: '提高表观溶解度的成熟方案：',
        bulletPoints: [
          '固体分散体（SD）：HPMC/PVP载体，无定形分散（溶解度↑50-200x）',
          '纳米晶技术：湿法研磨至200-500nm（比表面积↑，溶出速率↑）',
          '脂质制剂：SNEDDS自乳化体系（油相+表面活性剂+助表面活性剂）',
          '环糊精包合：HP-β-CD空腔包埋（水溶性↑1000x以上）',
        ],
        importance: 'high',
      },
      {
        heading: '🔓 渗透促进方案',
        content: '跨越肠黏膜屏障的策略组合：',
        bulletPoints: [
          '吸收促进剂：辛酸钠/ Capryol 90（暂时开放紧密连接）',
          '外排抑制：维拉帕米/P-gp抑制剂联用（需评估DDI风险）',
          '淋巴转运：长链甘油三酯载体（绕过首过肝脏）',
          '靶向递送：配体修饰纳米粒（如叶酸受体靶向肠道上皮）',
        ],
        importance: 'high',
      },
      {
        heading: '🧪 体内验证方案',
        content: '生物利用度提升效果的实证设计：',
        bulletPoints: [
          '动物PK：大鼠/Beagle犬 crossover design（空腹vs餐后）',
          '关键参数：Cmax↑? AUC₀₋∞↑? Tmax缩短? 生物利用度F值?',
          '人体BE：若为已上市品种，需开展正式生物等效性试验',
          '成功标准：相对BA提升≥30%且无新增安全性问题',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 88,
    estimatedQScore: 92,
  },
  {
    id: 'PO-004',
    intentType: 'PERFORMANCE_OPT',
    framework: 'D',
    title: '🫳 {{productForm}}质构剖面优化（TPA方法）',
    sections: [
      {
        heading: '📐 TPA 质构分析基准',
        content: '当前{{textureParameter}}的质构数据基线：',
        bulletPoints: [
          '硬度（Hardness）：{{stabilityThreshold}}g（目标范围：800-1200g）',
          '粘附性（Adhesiveness）：偏高（负功值过大，粘牙感）',
          '弹性（Springiness）：0.72（理想值>0.85）',
          '凝聚性（Cohesiveness）：0.58（偏低，易碎裂）',
          '咀嚼性（Chewiness）：计算值偏离目标±25%',
        ],
        importance: 'critical',
      },
      {
        heading: '🔧 质构调控手段',
        content: '各TPA参数的定向调节方法：',
        bulletPoints: [
          '硬度调节：填充剂比例↑硬↓软；水分含量反向相关',
          '粘附性控制：减少亲水胶体（黄原胶/瓜尔胶）或添加脂肪粉末',
          '弹性提升：蛋白质交联（TG酶处理）或淀粉回生控制',
          '凝聚性改善：优化粒径分布（D10-D90收窄）+ 均质压力上调',
        ],
        importance: 'high',
      },
      {
        heading: '🧪 TPA 测试标准化 SOP',
        content: '确保数据可比性的测试规范：',
        bulletPoints: [
          '仪器：TA.XT Plus / Texture Analyzer（探头P/36R圆柱形）',
          '参数：压缩比50%、速度1.0mm/s、两次压缩间隔5s',
          '样品预处理：恒温25℃平衡2h、统一压片厚度10mm',
          '重复次数：n=6，剔除异常值后取均值±SD',
        ],
        references: ['ASTM D2458', 'Bourne 1978 TPA methodology'],
        importance: 'high',
      },
      {
        heading: '🎯 消费者质构偏好映射',
        content: '将仪器数据转化为消费者语言：',
        bulletPoints: [
          'JAR分析："太硬/太软/刚好"分布图 → 定位最适区间',
          'PCA主成分：提取"酥脆-绵密"、"干-湿润"两大感知轴',
          '偏好回归：外推最优TPA数值范围（95%置信椭圆）',
          '最终目标：质构满意度≥80%（9分制≥7.2分）',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 83,
    estimatedQScore: 87,
  },
]

const COST_REDUCTION_TEMPLATES: SuggestionTemplate[] = [
  {
    id: 'CR-001',
    intentType: 'COST_REDUCTION',
    framework: 'A',
    title: '💰 {{productForm}}原料成本优化矩阵',
    sections: [
      {
        heading: '📊 BOM 成本穿透分析',
        content: '当前配方成本结构的X光透视：',
        bulletPoints: [
          'Top 3 高成本原料：{{mainIngredient}}(35%) / {{ingredientType1}}(18%) / {{carrier1}}(12%)',
          '合计占比：TOP3占BOM总成本的65%（集中度过高风险）',
          '价格波动：{{mainIngredient}}近12个月波动幅度±{{stabilityThreshold}}%',
        ],
        importance: 'critical',
      },
      {
        heading: '🔄 替代方案评估矩阵',
        content: '性价比替代候选的多维打分：',
        bulletPoints: [
          '{{alternativeIngredient}}：成本↓30%，效能保留92%，供应链风险低 ⭐推荐',
          '国产{{supplierName}}：成本↓22%，质量等效（COA对比），交期缩短7天',
          '生物发酵品：成本↓40%但需重新做稳定性验证，TTM延后2个月',
          '不同晶型/盐形式：成本↓15%，溶解度有变化需重新做溶出验证',
        ],
        importance: 'high',
      },
      {
        heading: '📦 用量精细化优化',
        content: '在不牺牲功效前提下降低投料量的策略：',
        bulletPoints: [
          '下限探索：{{maxDosage}}是否有下调空间？（基于暴露限值反算）',
          '协同减量：{{ingredientType1}}+{{ingredientType2}}复配后各自用量可降20%',
          '生物利用度提升：采用{{bioavailabilityMethod}}后等效剂量可降低30%',
          '过量削减：删除无明确贡献的"概念性添加"成分',
        ],
        importance: 'high',
      },
      {
        heading: '📈 采购策略优化',
        content: '从"买得更便宜"到"买得更聪明"：',
        bulletPoints: [
          '集中采购：年度框架协议锁定价格（规避波动）',
          '期货对冲：大宗商品类原料考虑套期保值',
          '多供应商策略：2主供+1备供（避免单一依赖）',
          'JIT/VMI：高价值原料推行供应商管理库存',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 84,
    estimatedQScore: 88,
  },
  {
    id: 'CR-002',
    intentType: 'COST_REDUCTION',
    framework: 'B',
    title: '⚙️ {{productForm}}工艺效率提升方案',
    sections: [
      {
        heading: '🔍 工艺瓶颈识别',
        content: '{{processTechnology}}流程中的效率洼地：',
        bulletPoints: [
          '耗时最长工序：{{processParam1}}（占全线时间的{{stabilityThreshold}}%）',
          '能耗最高环节：干燥单元（蒸汽消耗占比42%）',
          '人工密集岗位：包装工段（依赖手工，效率受人员波动大）',
          '设备OEE：当前综合设备效率68%（行业标杆82%）',
        ],
        importance: 'critical',
      },
      {
        heading: '⚡ 具体提效措施',
        content: '按ROI排序的改进项目清单：',
        bulletPoints: [
          '工艺合并：混合+制粒一步完成（省去中间转运，周期↓30%）',
          '参数优化：DOE找到{{thermalProtection}}最优温时组合（品质不变能耗↓18%）',
          '自动化升级：自动称量+在线检重（人工↓5人/班，误差率↓90%）',
          '连续化改造：批次式→连续流（产能↑50%，单位固定成本↓33%）',
        ],
        importance: 'high',
      },
      {
        heading: '💵 投资回报测算',
        content: '各项改进的经济效益量化：',
        bulletPoints: [
          '项目A（工艺合并）：投入50万，年节省120万，ROI=240%，回收期5个月',
          '项目B（自动化）：投入200万，年节省180万，ROI=90%，回收期13个月',
          '项目C（连续化）：投入500万，年节省350万，ROI=70%，回收期17个月',
          '建议优先级：A > B > C（结合资金状况分期实施）',
        ],
        importance: 'high',
      },
      {
        heading: '📊 持续改善机制',
        content: '建立降本增效的长效闭环：',
        bulletPoints: [
          '月度成本回顾：实际vs预算差异分析+根因追踪',
          'Kaizen提案制度：一线员工建议奖励（采纳即奖500-2000元）',
          '标杆对标：每年参观1-2家行业领先工厂学习最佳实践',
          '数字化监控：MES系统实时采集OEE/良率/能耗数据看板',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 82,
    estimatedQScore: 86,
  },
  {
    id: 'CR-003',
    intentType: 'COST_REDUCTION',
    framework: 'C',
    title: '🔗 {{productForm}}供应链整合策略',
    sections: [
      {
        heading: '🗺️ 供应链全景图谱',
        content: '从田间到终端的全链路成本分布：',
        bulletPoints: [
          '原料端：种植/养殖/发酵 → 初加工 → 精制（占比35%）',
          '制造端：仓储 → 生产 → 质检 → 包装（占比40%）',
          '物流端：干线运输 → 仓配 → 最后一公里（占比15%）',
          '其他：资金占用、损耗、管理费用（占比10%）',
        ],
        importance: 'critical',
      },
      {
        heading: '🤝 纵向整合机会',
        content: '向上游延伸掌控力度的可行性：',
        bulletPoints: [
          '战略投资：参股{{supplierName}}核心原料基地（锁定货源+价格优惠）',
          '订单农业：与种植户签订长期收购协议（稳定供给+可追溯）',
          '合资建厂：在高成本原料产地设初加工厂（减少中间商加价）',
          '自产替代：部分通用原料转为自制（如自制提取物）',
        ],
        importance: 'high',
      },
      {
        heading: '🚚 物流与库存优化',
        content: '供应链中"隐形浪费"的消除：',
        bulletPoints: [
          '库存周转：从当前{{shelfLife}}天降至45天目标（释放现金流）',
          'VMI推行：高价值原料由供应商管理库存（寄售模式）',
          '运输集约：拼车/整柜优化（满载率从65%提升至85%）',
          '仓储布局：RDC区域仓布点（缩短交付半径，物流费↓12%）',
        ],
        importance: 'high',
      },
      {
        heading: '📋 供应商绩效管理',
        content: '从"采购关系"升级为"战略伙伴"：',
        bulletPoints: [
          'SRM评分卡：质量/成本/交付/服务四维季度考评',
          '联合研发：与头部供应商共同开发定制化原料（降本+独享）',
          '风险预警：供应商财务健康监测+备选激活机制',
          'ESG要求：逐步纳入碳排放/可持续采购考核权重',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 80,
    estimatedQScore: 84,
  },
]

const REGULATORY_COMPLIANCE_TEMPLATES: SuggestionTemplate[] = [
  {
    id: 'RC-001',
    intentType: 'REGULATORY_COMPLIANCE',
    framework: 'A',
    title: '🇨🇳 中国保健食品注册路径（GB 16740）',
    sections: [
      {
        heading: '📋 注册路径选择',
        content: '根据产品特性确定最优准入方式：',
        bulletPoints: [
          '注册制（蓝帽子）：新功能/新原料 → 审评周期18-24个月，费用150-300万',
          '备案制（食健备）：目录内原料+成熟功能 → 周期3-6个月，费用10-30万',
          '本品判断：{{mainIngredient}}是否在《可用原料目录》？{{functionalClaim}}是否在27项功能范围内？',
        ],
        references: ['食品安全法', '保健食品注册备案管理办法', 'GB 16740-2014'],
        importance: 'critical',
      },
      {
        heading: '📁 注册资料清单',
        content: '完整申报材料包（7大部分）：',
        bulletPoints: [
          'Part 1：配方与生产工艺（配方表+工艺流程图+技术要求）',
          'Part 2：安全性评估（毒理学试验报告+菌种鉴定+卫生学检验）',
          'Part 3：功能学评价（人体/动物试验报告+机制说明）',
          'Part 4：产品质量技术要求（企业标准草案+检验方法验证）',
          'Part 5：标签说明书样稿（名称/配料/功效成分/适宜人群/注意事项）',
          'Part 6：研发报告（立题目的/依据/筛选过程/论证结论）',
          'Part 7：其他辅助材料（商标证明/委托加工协议/申请人资质）',
        ],
        importance: 'high',
      },
      {
        heading: '⏰ 关键里程碑时间线',
        content: '从立项到拿证的典型节奏：',
        bulletPoints: [
          'M1-M3：配方定型+企业标准制定+中试样品制备',
          'M4-M9：第三方检测（安全性+功能学+卫生学+稳定性）',
          'M10-M12：资料整理+预审补正+正式提交',
          'M13-M24：技术审评（补正通知平均2-3轮）→ 行政审批 → 制证',
        ],
        importance: 'high',
      },
      {
        heading: '⚠️ 高频补正原因',
        content: '提前规避这些常见退审陷阱：',
        bulletPoints: [
          '配方依据不足：缺乏{{referenceSource1}}等权威文献支撑',
          '用量超限：超出{{maxDosage}}规定或无安全剂量推导',
          '功能声称不当：使用了疾病治疗用语或夸大宣传词汇',
          '试验设计缺陷：样本量不足/对照组设置不合理/统计方法错误',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 91,
    estimatedQScore: 95,
  },
  {
    id: 'RC-002',
    intentType: 'REGULATORY_COMPLIANCE',
    framework: 'B',
    title: '🌍 国际市场准入指南（FDA/EFSA/NHPD）',
    sections: [
      {
        heading: '🇺🇸 美国 FDA (DSHEA) 路径',
        content: '膳食补充剂的市场准入要点：',
        bulletPoints: [
          '监管框架：DSHEA 1994 + 21 CFR Part 111 (cGMP)',
          '上市方式：无需 pre-market approval（不同于药品NDA/ANDA）',
          'NDI通知：1994年后新原料需提交New Dietary Ingredient Notification（75天静默期）',
          'GRAS确认：一般公认安全自我认定或FDA无异议函',
          'Structure/Function Claim：需 disclaimer "This statement has not been evaluated by FDA"',
        ],
        importance: 'high',
      },
      {
        heading: '🇪🇺 欧洲 EFSA 路径',
        content: '欧盟市场的严格准入门槛：',
        bulletPoints: [
          '健康声称授权：EU Register of Nutrition & Health Claims（第{{standardCode}}号列表）',
          'Novel Food Regulation：(EC) No 258/97 — 1997年后首次欧盟消费需申请',
          '传统食品证明：若能证明25年+3国安全食用历史可走简化程序',
          '食品补充剂指令：2002/46/EC — 维生素矿物质上限+标签格式',
        ],
        importance: 'high',
      },
      {
        heading: '🇨🇦 加拿大 NHPD 路径',
        content: '天然健康产品的许可体系：',
        bulletPoints: [
          '产品许可证（NPN）：Health Canada审批（类似中国注册制）',
          '审查内容：安全性/有效性/质量（SEU三支柱）',
          '审理周期：标准审查60天，优先审查30天',
          'Site License：场地许可证（加拿大本土生产或进口商）',
        ],
        importance: 'high',
      },
      {
        heading: '🗺️ 多国同步策略',
        content: '全球化布局的时间与资源规划：',
        bulletPoints: [
          'Phase 1（0-12月）：中国注册 + 美国NDI/GRA S并行准备',
          'Phase 2（12-24月）：欧盟Novel Food dossier（最复杂，最早启动）',
          'Phase 3（24-36月）：加拿大NPN + 澳洲TGA + 日本（按市场优先级排入）',
          '资源预估：全球注册总预算300-600万人民币，需专职法规团队3-5人',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 89,
    estimatedQScore: 93,
  },
  {
    id: 'RC-003',
    intentType: 'REGULATORY_COMPLIANCE',
    framework: 'C',
    title: '🏷️ {{productForm}}标签与声称合规审查',
    sections: [
      {
        heading: '📝 强制标识要素检查',
        content: '标签上必须呈现的信息完整性核对：',
        bulletPoints: [
          '产品名称：反映真实属性（不得暗示治疗作用）',
          '配料表：递减顺序排列，{{allergenInfo}}醒目提示',
          '净含量与规格：法定计量单位（g/mL/mg）',
          '生产者信息：名称+地址+联系方式',
          '生产日期/保质期/贮存条件：{{storageCondition}}/{{shelfLife}}',
          '执行标准编号：{{standardCode}}',
          '保健食品标志：蓝帽图案+批准文号（如适用）',
        ],
        importance: 'critical',
      },
      {
        heading: '⚠️ 禁止性用语筛查',
        content: '广告法+食品安全法的红线词汇库：',
        bulletPoints: [
          '绝对化用语："最""第一""顶级""100%有效" ❌',
          '医疗用语："治疗""治愈""替代药物""处方" ❌',
          '功效夸大："根治""保证见效""无效退款" ❌',
          '虚假背书："诺贝尔奖""院士推荐""医院同款" ❌',
          '违规比较："优于XX药""碾压竞品" ❌',
        ],
        references: ['广告法第9/11/16/17条', '食品安全法第71条', '反不正当竞争法第8条'],
        importance: 'critical',
      },
      {
        heading: '✅ 功能声称规范表述',
        content: '允许的功能宣称范围与措辞模板：',
        bulletPoints: [
          '保健功能：仅限27项批准功能（如"辅助降血脂""增强免疫力"）',
          '营养素声称："富含XX""含有XX""XX来源"（需满足含量阈值）',
          '健康声称：需有充分的科学证据支撑（RCT/meta-analysis级别）',
          '限定用语：建议使用"有助于""可能对...有益"等谨慎表达',
        ],
        importance: 'high',
      },
      {
        heading: '🔍 标签审核自查工具',
        content: '上线前的合规性快速体检：',
        bulletPoints: [
          'AI初审：关键词匹配违禁词库（准确率95%+）',
          '人工复核：法规专员逐字逐句审读（重点抓语意层面违规）',
          '第三方送审：当地市监局预咨询（获取官方指导意见）',
          'A/B测试：多个版本标签请律师出具合规意见书',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 87,
    estimatedQScore: 91,
  },
  {
    id: 'RC-004',
    intentType: 'REGULATORY_COMPLIANCE',
    framework: 'D',
    title: '🆕 新资源食品 / Novel Food 申请流程',
    sections: [
      {
        heading: '📌 适用性判断',
        content: '首先确认{{mainIngredient}}是否属于"新食品"范畴：',
        bulletPoints: [
          '中国新资源食品：无国家标准食用历史/传统习惯的原料（2013年后名单动态调整）',
          'EU Novel Food：1997年5月15日前未在欧盟显著消费的食品/食材',
          'US GRAS：1958年前有安全食用历史 OR 通过科学程序证实安全',
          '快速排除：若已在《药食同源目录》或各国positive list中 → 无需此流程',
        ],
        importance: 'critical',
      },
      {
        heading: '📦 申请资料包（Dossier）',
        content: '新食品批准所需的完整科学档案：',
        bulletPoints: [
          'Part A：身份鉴定（化学结构/物种来源/生产工艺/规格标准）',
          'Part B：成分组成（营养组成/杂质谱/污染物概况）',
          'Part C：使用历史（原产国食用历史/年限/人群/用量）',
          'Part D：安全性数据（毒理学全套+AD I推导+过敏原评估）',
          'Part E：拟议用途（目标人群/使用量/食品类别/标签建议）',
          'Part F：暴露评估（膳食暴露量/MOS计算/特殊人群评估）',
        ],
        references: ['Reg (EC) No 258/97', '新食品原料安全性审查规范', 'EFSA Guidance'],
        importance: 'high',
      },
      {
        heading: '⏱️ 审评流程与周期',
        content: '从递交到获批的完整旅程：',
        bulletPoints: [
          '形式审查（1-2月）：资料完整性检查，缺项一次性告知补正',
          '技术评审（6-18月）：专家组评审+公开征求意见（欧盟）or 专家委员会评审（中国）',
          '补充资料（2-6月）：根据补正通知完善数据（平均1-3轮）',
          '行政审批（1-3月）：最终决定 → 公告/批准函/授权清单更新',
        ],
        importance: 'high',
      },
      {
        heading: '💡 加速获批技巧',
        content: '提高成功率与缩短周期的实战经验：',
        bulletPoints: [
          'Pre-sub meeting：正式递交前与审评机构预沟通（明确期望）',
          '借船出海：引用同类物质已有的批准案例作为参照（类比推理）',
          '分步策略：先以较低用量/窄范围申请获批后再扩展（渐进式）',
          '联合申请：与高校/研究院所合作（增加学术背书可信度）',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 88,
    estimatedQScore: 92,
  },
]

const INGREDIENT_ANALYSIS_TEMPLATES: SuggestionTemplate[] = [
  {
    id: 'IA-001',
    intentType: 'INGREDIENT_ANALYSIS',
    framework: 'A',
    title: '🧬 {{mainIngredient}}功能性因子深度解析',
    sections: [
      {
        heading: '🔬 化学身份与结构',
        content: '核心活性分子的精确画像：',
        bulletPoints: [
          'IUPAC名称：{{ingredientType1}}（系统命名）',
          '分子式/分子量：CxxHxxOxxNx / MW = xxx Da',
          '结构特征：{{function1}}官能团是活性关键位点',
          '立体化学：手性中心构型（R/S）对生物活性影响显著',
        ],
        references: ['PubChem CID', 'ChemSpider', 'Merck Index'],
        importance: 'critical',
      },
      {
        heading: '⚡ 作用机制详解',
        content: '从分子靶点到整体效应的作用链路：',
        bulletPoints: [
          '一级靶点：与{{targetPopulation}}蛋白结合（Kd = nM级）',
          '信号通路：激活/抑制{{function2}}级联反应',
          '细胞效应：{{function3}}基因表达调控（转录组验证）',
          '组织/器官水平：最终表现为{{functionalClaim}}改善',
        ],
        importance: 'critical',
      },
      {
        heading: '📊 含量与效价关系',
        content: '剂量-效应曲线的关键参数：',
        bulletPoints: [
          '最低有效剂量（MED）：{{maxDosage}} mg/day',
          '半数有效剂量（ED₅₀）：{{stabilityThreshold}} mg/kg',
          '治疗窗口：有效剂量/中毒剂量比值（TI = {{subjectCount}}）',
          '饱和平台期：超过{{shelfLife}} mg/day后增量收益递减',
        ],
        importance: 'high',
      },
      {
        heading: '🔄 体内代谢命运',
        content: '口服后的ADME全过程：',
        bulletPoints: [
          'Absorption：主要在小肠吸收，{{bioavailabilityMethod}}促进跨膜',
          'Distribution：血浆蛋白结合率{{stabilityThreshold}}%，Vd = L/kg',
          'Metabolism：主要通过CYP3A4代谢，生成{{alternativeIngredient}}等代谢物',
          'Excretion：肾脏排泄70% + 粪便30%，终末t½ = {{feedingPeriod}}',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 90,
    estimatedQScore: 94,
  },
  {
    id: 'IA-002',
    intentType: 'INGREDIENT_ANALYSIS',
    framework: 'B',
    title: '🔀 {{productForm}}原料相互作用矩阵',
    sections: [
      {
        heading: '⚠️ 配伍禁忌速查',
        content: '必须避免的危险组合：',
        bulletPoints: [
          '{{mainIngredient}} × {{ingredientType1}}：{{interactionWarning}}（pH冲突导致沉淀）',
          '{{mainIngredient}} × {{ingredientType2}}：氧化还原反应（效力双双丧失）',
          '{{ingredientType1}} × {{ingredientType2}}：络合反应（形成难溶螯合物）',
          '金属离子 × 抗氧化剂：催化氧化链反应（促效期急剧缩短）',
        ],
        importance: 'critical',
      },
      {
        heading: '🤝 协同增效组合',
        content: '经过验证的"黄金搭档"：',
        bulletPoints: [
          '{{mainIngredient}} + {{carrier1}}：{{synergyEffect}}（1+1>2效应）',
          '维生素C + 维生素E：再生循环（抗氧化网络）',
          '钙 + 维生素D3：吸收促进（肠道转运蛋白上调）',
          '益生菌 + 益生元：共生增殖（双歧杆菌选择性生长）',
        ],
        references: ['Herbal Compendium', 'Drug Interaction Facts', '同行研究论文'],
        importance: 'high',
      },
      {
        heading: '📐 相互作用评估方法论',
        content: '系统性排查配伍风险的流程：',
        bulletPoints: [
          '文献挖掘：PubMed/CNKI检索"{{mainIngredient}} interaction"关键词',
          '理化相容性：DSC/TGA热分析 + 加速稳定性配伍试验',
          '体外模型：Caco-2细胞膜渗透相互作用评估',
          '体内验证：动物交叉设计PK试验（单独vs联合给药）',
        ],
        importance: 'high',
      },
      {
        heading: '🛡️ 缓解与补救措施',
        content: '当无法避免潜在相互作用时的应对：',
        bulletPoints: [
          '物理分隔：双层片/缓释技术使两者在时空上分离释放',
          '化学保护：加入螯合剂/稳定剂阻断反应路径',
          '剂量调整：降低其中一方用量至安全交互区间',
          '包装优化：充氮/避光包装减缓固相相互作用',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 86,
    estimatedQScore: 90,
  },
  {
    id: 'IA-003',
    intentType: 'INGREDIENT_ANALYSIS',
    framework: 'C',
    title: '✅ {{mainIngredient}}质量标准与检测方法',
    sections: [
      {
        heading: '📏 关键质量属性（CQA）',
        content: '决定最终产品质量的核心指标：',
        bulletPoints: [
          '鉴别项：IR光谱特征峰 / TLC斑点Rf值 / HPLC保留时间',
          '含量测定：{{validationMetric}}（HPLC法，线性范围{{stabilityThreshold}}-{{subjectCount}}μg/mL）',
          '有关物质：单个杂质≤0.5%，总杂质≤2.0%',
          '物理性质：粒径D90<{{shelfLife}}μm / 松密度/振实密度 / 流动性角度',
        ],
        importance: 'critical',
      },
      {
        heading: '🔬 分析方法验证',
        content: '符合ICH Q2(R1)要求的完整验证：',
        bulletPoints: [
          '专属性：空白/辅料/降解产物无干扰（峰纯度>0.999）',
          '线性：r²>0.999（6浓度点，权重1/x）',
          '准确度：回收率98-102%（3水平9测定）',
          '精密度：重复性RSD<2%，中间精密度RSD<3%',
          '范围：定量限-120%标示量全覆盖',
          '耐用性：流速/柱温/pH微小变动不影响结果',
        ],
        references: ['ICH Q2(R1)', '中国药典2025 四部通则9101'],
        importance: 'high',
      },
      {
        heading: '🏭 进料检验规范（IQC）',
        content: '每批原料到货的必检项目：',
        bulletPoints: [
          'AQL检验：外观/气味/包装完整性（全检）',
          'COA核对：供应商报告与自检数据对比（允差±2%）',
          '抽样方案：GB/T 2828.1 正常检验一次抽样（II级，AQL=1.0）',
          '异常处理：OOS启动实验室调查（CAPA流程）',
        ],
        importance: 'high',
      },
      {
        heading: '📊 趋势分析与持续改进',
        content: '质量数据的增值利用：',
        bulletPoints: [
          'Control Chart：X-bar/R图监控批间变异（UCL/LCL设定）',
          '供应商评分：基于历史合格率/交付/OOS率的季度排名',
          '能力指数：Cpk>1.33 为过程能力充足',
          '方法优化：每年review检测方法，引入新技术（UPLC-MS/MS替代HPLC）',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 88,
    estimatedQScore: 92,
  },
  {
    id: 'IA-004',
    intentType: 'INGREDIENT_ANALYSIS',
    framework: 'D',
    title: '🏢 {{mainIngredient}}供应商评估与审计清单',
    sections: [
      {
        heading: '📋 准入资格初筛',
        content: '供应商进入短名单的基本门槛：',
        bulletPoints: [
          '营业执照：经营范围涵盖{{mainIngredient}}的生产/经营',
          '资质证书：{{standardCode}}生产许可 / ISO22000 / HACCP / cGMP',
          '产品许可：该原料的检测报告/COA/MSDS齐全',
          '商业信誉：经营年限>3年 / 无重大质量事故记录 / 信用评级良好',
        ],
        importance: 'critical',
      },
      {
        heading: '🔍 现场审计核心项目',
        content: '实地考察的检查清单（按PQS系统）：',
        bulletPoints: [
          '人员：培训记录/健康档案/关键岗位资质（QC经理/ QA主管）',
          '厂房：分区合理/人流物流分开/洁净区压差/温湿度监控',
          '设备：校准状态/预防性维护计划/设备日志完整性',
          '物料：供应商管理/进料检验/仓储条件（ FIFO/批次管理）',
          '生产：SOP执行情况/批记录完整性/偏差处理/CAPA闭环',
          '质量控制：实验室能力/仪器校准/OOS调查/稳定性考察',
        ],
        importance: 'high',
      },
      {
        heading: '📊 供应商评分卡',
        content: '多维度的量化评估体系（满分100）：',
        bulletPoints: [
          '质量表现（40分）：批合格率/ OOS率/客诉率/召回历史',
          '交付能力（25分）：准时交付率/柔性响应/紧急订单支持',
          '价格竞争力（20分）：单价水平/付款条件/年度降价幅度',
          '服务水平（15分）：技术支持/配合度/信息透明度/创新共建',
        ],
        importance: 'high',
      },
      {
        heading: '🔄 动态管理与退出',
        content: '供应商全生命周期的持续管理：',
        bulletPoints: [
          '定期复审：年度现场复审 + 季度绩效回顾',
          '分级管理：A级（战略）/ B级（优选）/ C级（合格）/ D级（淘汰）',
          '退出机制：连续2个季度评分<60分 → 启动替换程序',
          '第二供应商：每个关键原料至少保持2家合格供应商（风险分散）',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 84,
    estimatedQScore: 88,
  },
]

const PROCESS_TECHNOLOGY_TEMPLATES: SuggestionTemplate[] = [
  {
    id: 'PT-001',
    intentType: 'PROCESS_TECHNOLOGY',
    framework: 'A',
    title: '🌡️ {{productForm}}干燥技术选型对比',
    sections: [
      {
        heading: '🔥 喷雾干燥（Spray Drying）',
        content: '最常用的工业化干燥方案：',
        bulletPoints: [
          '原理：雾化器将料液分散成微滴，与热风瞬间接触蒸发溶剂',
          '优势：连续生产/处理量大/颗粒球形流动性好/适合热稳定物料',
          '局限：热敏性成分损失（{{thermalProtection}}需求高）/设备投资大',
          '典型参数：进风180-200℃，出风80-90℃，雾化转速20000-30000rpm',
        ],
        importance: 'high',
      },
      {
        heading: '❄️ 冷冻干燥（Freeze Drying）',
        content: '高品质但高成本的干燥选择：',
        bulletPoints: [
          '原理：先冻结再真空升华去除冰晶（水的三相点以下操作）',
          '优势：最大限度保留热敏/挥发性活性成分/多孔结构速溶性好',
          '局限：周期长（24-72h）/ 能耗极高/ 设备与运行成本为喷雾干燥的5-10倍',
          '适用场景：高附加值产品（{{mainIngredient}}活性极不稳定时）',
        ],
        importance: 'high',
      },
      {
        heading: '🌀 真空干燥（Vacuum Drying）',
        content: '介于喷雾与冷冻之间的折中选择：',
        bulletPoints: [
          '原理：减压环境下降低沸点，低温蒸发去除水分',
          '优势：温度可控（40-60℃）/适合中等热敏物料/设备成本适中',
          '局限：间歇式操作/效率低于喷雾干燥/ 可能存在传热不均匀',
          '变体：真空带式/真空盘式/微波真空（各有适用场景）',
        ],
        importance: 'high',
      },
      {
        heading: '⚖️ 技术选型决策矩阵',
        content: '根据产品特性的推荐决策路径：',
        bulletPoints: [
          '热稳定+大批量+成本敏感 → **喷雾干燥**（首选）',
          '热极度敏感+高附加值+可承受高价 → **冷冻干燥**',
          '中等热敏+中小批量+追求平衡 → **真空干燥**',
          '混合策略：核心活性成分冻干 + 载体喷雾干燥 → 后续干法混合',
        ],
        importance: 'critical',
      },
    ],
    qualityBaseline: 85,
    estimatedQScore: 89,
  },
  {
    id: 'PT-002',
    intentType: 'PROCESS_TECHNOLOGY',
    framework: 'B',
    title: '📦 {{productForm}}包埋与递送系统设计',
    sections: [
      {
        heading: '🔒 包埋技术概览',
        content: '保护{{mainIngredient}}免受外界破坏的微胶囊/包合方案：',
        bulletPoints: [
          '喷雾冷却/凝固：熔融壁材包裹 → 固化成微球（适合脂溶性活性物）',
          '复合凝聚：明胶+阿拉伯胶相分离 → 壁材沉积（适合水溶性芯材）',
          '界面聚合：油水界面化学反应成壁 → 纳米/微米胶囊',
          '超临界流体：CO₂作抗溶剂 → 控制结晶/微粒化',
        ],
        importance: 'high',
      },
      {
        heading: '💊 壁材选择指南',
        content: '不同壁材的特性与应用匹配：',
        bulletPoints: [
          '{{carrier1}}（环糊精）：空腔包合/提高水溶性/掩蔽异味（分子级）',
          '{{carrier2}}（阿拉伯胶）：良好成膜性/乳化稳定/GRAS地位',
          '改性淀粉（HI-CAP/Octenylsuccinated）：乳化+成膜双重功能',
          '壳聚糖：阳离子多糖/黏膜黏附/可控释放（肠溶靶向）',
        ],
        importance: 'critical',
      },
      {
        heading: '🎯 释控性能设计',
        content: '按需定制的释放行为调控：',
        bulletPoints: [
          '速释型：薄壁+高孔隙率 → 口腔/胃内快速崩解释放（<15min）',
          '缓释型：厚壁+疏水改性 → 4-8小时 sustained release',
          '肠溶型：Eudragit® L100/S100 包衣 → pH触发结肠释放',
          '脉冲型：多层包衣/定时爆破 → 模拟人体节律给药',
        ],
        importance: 'high',
      },
      {
        heading: '🧪 包埋效果评价指标',
        content: '如何衡量包埋技术的成功程度：',
        bulletPoints: [
          '包埋率（EE）：被包埋活性物/总投料量 × 100%（目标>85%）',
          '载药量（LC）：活性物/微球总重 × %（通常10-50%）',
          '释放曲线：体外模拟胃肠液溶出试验（USP II桨法）',
          '形态表征：SEM电镜观察表面形貌/粒径分布（PSA激光衍射）',
          '稳定性：加速试验后EE和LC的保留率（目标>90%@{{shelfLife}}月）',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 87,
    estimatedQScore: 91,
  },
  {
    id: 'PT-003',
    intentType: 'PROCESS_TECHNOLOGY',
    framework: 'C',
    title: '🧼 {{productForm}}清洁生产与HACCP实施',
    sections: [
      {
        heading: '📍 HACCP 七大原理落地',
        content: '在本产品生产线上的具体应用：',
        bulletPoints: [
          ' Principle 1：危害分析（生物/化学/物理三大类全面识别）',
          ' Principle 2：确定CCP（{{processTechnology}}加热/金属探测/过滤为关键控制点）',
          ' Principle 3：建立临界限度（温度≥{{stabilityThreshold}}℃ / 金属球Φ≤1.5mm）',
          ' Principle 4：CCP监控程序（连续温度记录仪 / 每班金属探测器测试）',
          ' Principle 5：纠偏措施（超标立即扣留/原因分析/防止再发）',
          ' Principle 6：验证程序（第三方审核/ 微生物挑战试验/ CCP校准）',
          ' Principle 7：记录保持（电子批记录/ 保存期限≥{{shelfLife}}+1年）',
        ],
        references: ['CAC/RCP 1-1969, Rev.4-2003', 'GB/T 27341', 'ISO 22000:2018'],
        importance: 'critical',
      },
      {
        heading: '🧹 清洁作业标准化',
        content: '防止交叉污染的操作规范：',
        bulletPoints: [
          'CIP（原位清洗）：固定管路系统自动清洗（酸洗→水冲→碱洗→灭菌）',
          'COP（拆洗）：移动设备拆卸至清洗间（专用刷具+清洗剂+烘干）',
          '换产清洁：不同产品切换时的彻底清洁验证（ATP生物荧光<10RLU）',
          '环境清洁：地面/墙面/天花板/空气消毒（臭氧/UV/过氧乙酸交替）',
        ],
        importance: 'high',
      },
      {
        heading: '🦠 微生物控制策略',
        content: '全过程的微生物污染防控：',
        bulletPoints: [
          '人员卫生：更衣/洗手消毒/健康监测/洁净区行为规范培训',
          '空气净化：HVAC系统（十万级/D级）+ 高效过滤器（HEPA）定期 integrity test',
          '水系统：纯化水（PW）+ 注射用水（WFI）日常监测（TOC/电导率/微生物）',
          '环境监控：沉降菌/浮游菌/表面涂抹（动态/静态分区频次）',
        ],
        importance: 'high',
      },
      {
        heading: '📋 文件与追溯体系',
        content: '完整的质量管理体系文档：',
        bulletPoints: [
          '层级文件：质量手册 → 程序文件 → SOP → 记录表格（四级金字塔）',
          '批记录：从原料到成品的完整数据链（可追溯至每个操作人和时间戳）',
          '变更控制：任何工艺/设备/物料变更需评估-批准-验证-培训后执行',
          '偏差管理：OOS/OOT/偏差统一台账 → CAPA追踪关闭 → 趋势分析预防',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 86,
    estimatedQScore: 90,
  },
]

const MARKET_POSITIONING_TEMPLATES: SuggestionTemplate[] = [
  {
    id: 'MP-001',
    intentType: 'MARKET_POSITIONING',
    framework: 'A',
    title: '🎯 {{productForm}}目标市场细分与定位策略',
    sections: [
      {
        heading: '🔭 市场宏观扫描',
        content: '{{marketSegment}}赛道的整体格局：',
        bulletPoints: [
          '市场规模：TAM ≈ {{subjectCount}}亿元 / SAM ≈ {{stabilityThreshold}}亿元 / SOM 目标3-5亿',
          '增长率：CAGR {{shelfLife}}%（高于快消品平均的5-8%）',
          '驱动力：人口老龄化/健康意识提升/消费升级/{{trendKeyword}}趋势',
          '政策红利：{{regulatoryBody}}利好政策（如健康中国2030）',
        ],
        importance: 'critical',
      },
      {
        heading: '👥 用户画像精准描绘',
        content: '核心目标消费者的360°视图：',
        bulletPoints: [
          '人口统计：{{targetPopulation}}，年龄{{feedingPeriod}}，收入{{costTarget}}+',
          '心理特征：注重健康管理/愿意为品质付费/信任科学背书',
          '行为习惯：线上购买为主/关注KOL测评/复购率高（LTV可观）',
          '痛点需求：{{consumerInsight}}（来自用户调研/社交媒体舆情分析）',
        ],
        importance: 'high',
      },
      {
        heading: '📍 定位声明（Positioning Statement）',
        content: '为{{productForm}}设计的差异化定位：',
        bulletPoints: [
          'For [{{targetPopulation}}] who [{{consumerInsight}}]',
          'The [{{productForm}}] is a [{{functionalClaim}}产品] that [{{uspPoint}}]',
          'Unlike [{{competitorProduct}}] which [竞品主要缺点]',
          'Our product [核心差异化理由]',
        ],
        importance: 'high',
      },
      {
        heading: '🗺️ 渠道与触达策略',
        content: '匹配目标用户的购买路径：',
        bulletPoints: [
          '线上电商：天猫旗舰店+京东自营+抖音小店（内容种草→直播转化）',
          '线下专业：连锁药房/高端超市/美容院线（体验式销售）',
          '私域运营：微信小程序会员体系+社群运营（复购率提升引擎）',
          'B端拓展：企业福利/保险礼品/医疗机构推荐（增量渠道）',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 84,
    estimatedQScore: 88,
  },
  {
    id: 'MP-002',
    intentType: 'MARKET_POSITIONING',
    framework: 'B',
    title: '🌿 {{productForm}}清洁标签/植物基趋势应用',
    sections: [
      {
        heading: '📈 趋势数据与消费者洞察',
        content: 'Clean Label 运动的市场证据：',
        bulletPoints: [
          '全球数据：77%消费者愿意为清洁标签支付溢价（Innova Survey 2024）',
          '中国市场：{{trendKeyword}}搜索量年增长{{stabilityThreshold}}%（百度指数）',
          '核心诉求："成分越少越好"/"认识每一个配料名"/"无人工添加"',
          '{{consumerInsight}}：Z世代成为主力消费群，对标签可读性极其敏感',
        ],
        references: ['Innova Market Insights', 'Mintel GNPD', 'Euromonitor Passport'],
        importance: 'critical',
      },
      {
        heading: '🌱 配方清洁化改造路径',
        content: '将现有配方升级为清洁标签版本：',
        bulletPoints: [
          '人工色素→天然着色：姜黄/栀子蓝/红曲红替代合成色素',
          '防腐剂→天然保鲜：ε-聚赖氨酸/乳酸链球菌素/迷迭香提取物',
          '甜味剂→天然甜源：罗汉果苷/甜菊糖苷/赤藓糖醇替代阿斯巴甜',
          '载体优化：去掉麦芽糊精等"空白热量"，改用{{carrier1}}全食物基质',
        ],
        importance: 'high',
      },
      {
        heading: '🏷️ 清洁标签传播策略',
        content: "让消费者一眼读懂你的\"干净\"：",
        bulletPoints: [
          '前端宣言：「{{ingredientType1}}种成分，每种你都认识」',
          '负面清单声明：「0人工色素/0防腐剂/0反式脂肪酸」',
          '溯源故事：原料产地二维码/农场到餐桌 journey 可视化',
          '第三方背书：Clean Label Project认证/ Non-GMO Project验证',
        ],
        importance: 'high',
      },
      {
        heading: '⚖️ 清洁化的代价与权衡',
        content: '理性看待趋势落地的现实挑战：',
        bulletPoints: [
          '成本上升：天然替代品通常贵20-50%（需传递给消费者或内部消化）',
          '保质期缩短：去掉强效防腐剂后{{shelfLife}}可能缩减（需调整供应链）',
          '稳定性挑战：天然色素耐光/热性较差（需{{thermalProtection}}加强保护）',
          '建议策略：推出Clean Label子系列（高端线），保留经典版（大众线）',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 83,
    estimatedQScore: 87,
  },
  {
    id: 'MP-003',
    intentType: 'MARKET_POSITIONING',
    framework: 'C',
    title: '⚔️ {{productForm}}竞品技术与价格对标',
    sections: [
      {
        heading: '🔍 竞争格局地图',
        content: '{{marketSegment}}的主要玩家与站位：',
        bulletPoints: [
          '国际品牌：{{competitorProduct}}（份额{{stabilityThreshold}}%，定价高端）',
          '国内龙头：{{supplierName}}（份额{{shelfLife}}%，主打性价比）',
          '新锐品牌：{{alternativeIngredient}}等DTC品牌（增速最快，社交营销驱动）',
          '我们的位置：[待填入] —— 寻找蓝海缝隙或正面迎战的选择',
        ],
        importance: 'critical',
      },
      {
        heading: '🧪 技术维度对标',
        content: '核心产品力的逐项PK：',
        bulletPoints: [
          '配方复杂度：竞品平均{{feedingPeriod}}种成分 vs 我们的{{subjectCount}}种',
          '功效宣称：竞品主打{{functionalClaim}} vs 我们主打{{uspPoint}}',
          '剂型创新：竞品以{{dosageForm}}为主 vs 我们的差异化剂型',
          '专利壁垒：竞品持有{{patentOpportunity}}项 vs 我们的布局计划',
        ],
        importance: 'high',
      },
      {
        heading: '💰 价格带分析',
        content: '各价位段的竞争态势与利润空间：',
        bulletPoints: [
          '奢华档（>{{costTarget}}元/疗程）：高毛利/低销量/品牌溢价驱动',
          '中高端（{{stabilityThreshold}}-{{costTarget}}元）：主流战场/竞争激烈/需差异化突围',
          '大众档（<{{stabilityThreshold}}元）：价格战重灾区/规模效应为王/利润薄',
          '建议定位：基于成本结构和品牌目标选择合适的价格锚点',
        ],
        importance: 'high',
      },
      {
        heading: '📊 SWOT 综合分析',
        content: '内外部因素的 strategic matrix：',
        bulletPoints: [
          'Strengths：{{uspPoint}} / {{bioavailabilityMethod}}技术 / {{synergyEffect}}供应链',
          'Weaknesses：品牌知名度不足 / 渠道覆盖有限 / 资金约束',
          'Opportunities：{{trendKeyword}}趋势 / {{regulatoryBody}}政策利好 / {{targetPopulation}}扩容',
          'Threats：{{competitorProduct}}降价施压 / 新玩家涌入 / 法规收紧风险',
          '战略启示：SO策略（发挥优势抓住机会）为近期最优路径',
        ],
        importance: 'medium',
      },
    ],
    qualityBaseline: 82,
    estimatedQScore: 86,
  },
]

const ALL_TEMPLATES: SuggestionTemplate[] = [
  ...FORMULA_DESIGN_TEMPLATES,
  ...SAFETY_ASSESSMENT_TEMPLATES,
  ...PERFORMANCE_OPT_TEMPLATES,
  ...COST_REDUCTION_TEMPLATES,
  ...REGULATORY_COMPLIANCE_TEMPLATES,
  ...INGREDIENT_ANALYSIS_TEMPLATES,
  ...PROCESS_TECHNOLOGY_TEMPLATES,
  ...MARKET_POSITIONING_TEMPLATES,
]

function replaceVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key]
    if (value !== undefined) return value
    const varDef = TEMPLATE_VARIABLES[key as TemplateVariableKey]
    return varDef ? varDef.default : match
  })
}

export function getTemplatesByIntent(intent: IntentType): SuggestionTemplate[] {
  return ALL_TEMPLATES.filter(t => t.intentType === intent)
}

export function getAllTemplates(): readonly SuggestionTemplate[] {
  return ALL_TEMPLATES
}

export function getTemplateById(id: string): SuggestionTemplate | undefined {
  return ALL_TEMPLATES.find(t => t.id === id)
}

export function renderTemplate(
  template: SuggestionTemplate,
  variables: Record<string, string> = {},
): RenderedSuggestion {
  const renderedSections: RenderedSection[] = template.sections.map(section => ({
    heading: replaceVariables(section.heading, variables),
    content: replaceVariables(section.content, variables),
    bulletPoints: (section.bulletPoints || []).map(bp => replaceVariables(bp, variables)),
    references: section.references,
    importance: section.importance,
  }))

  return {
    id: template.id,
    title: replaceVariables(template.title, variables),
    sections: renderedSections,
    qScore: template.estimatedQScore,
    intentType: template.intentType,
  }
}

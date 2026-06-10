/**
 * BestPractices - 食品配方行业最佳实践知识库
 *
 * 覆盖配方设计、原料筛选、工艺优化、安全合规、感官品质、
 * 成本效益、市场创新、质量保证 8 大领域的 54 条最佳实践，
 * 为 AI 配方助手提供行业级决策支持。
 *
 * @module bestPractices
 * @version 1.0.0
 */

export type BestPracticeCategory =
  | 'FORMULATION'
  | 'INGREDIENT_SELECTION'
  | 'PROCESS_OPTIMIZATION'
  | 'SAFETY_COMPLIANCE'
  | 'SENSORY_QUALITY'
  | 'COST_EFFICIENCY'
  | 'MARKET_INNOVATION'
  | 'QUALITY_ASSURANCE'

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

export interface Reference {
  source: string
  url?: string
  year?: number
  relevance: 'primary' | 'supporting' | 'background'
}

export interface BestPractice {
  id: string
  title: string
  category: BestPracticeCategory
  intentTypes: IntentType[]
  scenario: string
  solution: string
  keyPoints: string[]
  expectedOutcome: string
  evidenceLevel: 'strong' | 'moderate' | 'emerging'
  references: Reference[]
  tags: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  timeEstimate: string
}

const BEST_PRACTICES: readonly BestPractice[] = [
  /* ===================================================================
   * Category 1: FORMULATION 配方设计 (BP-001 ~ BP-012)
   * =================================================================== */

  {
    id: 'BP-001',
    title: 'ACE/DPP-IV/胆汁酸结合肽的三重协同复配技术',
    category: 'FORMULATION',
    intentTypes: ['FORMULA_DESIGN', 'INGREDIENT_ANALYSIS'],
    scenario: '开发针对"三高"人群的功能食品，需要同时实现降压、降糖、降脂效果，单一活性肽难以覆盖多重靶点',
    solution: '采用"主效肽+辅效肽+载体肽"的三层复配策略：主效肽选用 IC₅₀ < 0.5 mg/mL 的高活性 ACE 抑制肽（海洋鱼蛋白来源），辅效肽搭配 DPP-IV 抑制肽和胆汁酸结合肽形成多靶点干预网络，载体肽使用胶原蛋白肽改善溶解性和口感。通过正交试验确定最优复配比例，并采用环糊精包埋或微胶囊化保护热敏性活性成分。最终配合罗汉果甜苷等天然风味掩蔽剂平衡苦味，确保产品感官可接受性。',
    keyPoints: [
      '主效肽选择标准：IC₅₀ < 0.5 mg/mL，优先海洋鱼蛋白源 ACE 抑制肽（如 Alcalase 酶解产物）',
      '辅效肽协同机制：DPP-IV 抑制肽阻断胰高血糖素样肽-1 降解，胆汁酸结合肽促进胆固醇排泄',
      '比例优化路径：主效:辅效:载体 = 5:3:2（重量比），总添加量控制在 2-5% w/w',
      '稳定性保护方案：β-环糊精包埋（摩尔比 1:1）或喷雾干燥微胶囊化（壁材麦芽糊精+阿拉伯胶 7:3）',
      '口感平衡策略：罗汉果甜苷（0.03-0.05%）+ 柠檬酸（0.1%）掩蔽苦味，赤藓糖醇填充甜感',
      '功效验证要求：体外 IC₅₀ 测定 + 动物模型（SHR 大鼠）验证降压/降糖/降脂综合效果 ≥ 40%',
    ],
    expectedOutcome: '综合降三高效果提升 40% 以上，感官接受度 > 80%，货架期内活性保留率 > 85%',
    evidenceLevel: 'strong',
    references: [
      { source: 'Li et al., Journal of Functional Foods, 2023', year: 2023, relevance: 'primary' },
      { source: 'GB 16740-2014 保健食品通用标准', relevance: 'supporting' },
      { source: 'Zhang et al., Food Chemistry, 2022', year: 2022, relevance: 'supporting' },
    ],
    tags: ['多肽复配', '三高干预', '协同效应', '功能食品', '生物活性肽'],
    difficulty: 'advanced',
    timeEstimate: '12-16 周',
  },

  {
    id: 'BP-002',
    title: '固体饮料冲溶性优化方案——抗结剂/颗粒度控制/润湿性改进三位一体',
    category: 'FORMULATION',
    intentTypes: ['FORMULA_DESIGN', 'PERFORMANCE_OPT'],
    scenario: '固体饮料产品出现结块、悬浮颗粒、冲调后有不溶物残留等问题，影响消费者体验和产品品质评价',
    solution: '从三个维度系统优化冲溶性：（1）抗结剂体系——磷酸三钙（0.3-0.8%）或二氧化硅（0.2-0.5%）配合微晶纤维素骨架；（2）颗粒工程——控制 D₅₀ 在 150-300μm，跨度 Span < 1.2，通过造粒（流化床或摇摆制粒）改善颗粒形貌；（3）润湿性促进——添加速溶性表面活性剂如蔗糖酯（HLB 11-15，0.1-0.3%）或卵磷脂（0.2-0.5%），降低表面张力至 < 40 mN/m。三者协同可实现 30 秒内完全溶解，无肉眼可见不溶物。',
    keyPoints: [
      '抗结剂选择优先级：磷酸三钙（食品级，GRAS）> 二氧化硅 > 硬脂酸镁（仅限压片用）',
      '颗粒度目标参数：D₁₀ > 80μm 防止粉尘，D₉₀ < 500μm 保证速溶，Span = (D₉₀-D₁₀)/D₅₀ < 1.2',
      '造粒工艺推荐：流化床顶喷造粒（粘合剂 PVP K30 2-3% 水溶液），进风温度 50-60℃',
      '润湿性测试方法：Wettability Test（粉末沉入时间 < 10s 为优），表面张力目标 < 40 mN/m',
      '蔗糖酯型号选择：S-1170（HLB≈15）用于水基体系，S-1570（HLB≈14）用于含油体系',
      '验证指标：溶解时间 ≤ 30s（25℃，1:10 冲调比），不溶物率 < 0.5%（干基）',
    ],
    expectedOutcome: '冲调完全溶解时间 ≤ 30s，90 天加速储存无结块，消费者满意度评分 ≥ 4.2/5',
    evidenceLevel: 'strong',
    references: [
      { source: 'GB/T 29602-2013 固体饮料', relevance: 'primary' },
      { source: 'Barbosa-Cánovas et al., Food Powders, 2005', year: 2005, relevance: 'supporting' },
      { source: 'Jinapong et al., Journal of Food Engineering, 2008', year: 2008, relevance: 'primary' },
    ],
    tags: ['固体饮料', '冲溶性', '抗结剂', '颗粒工程', '速溶技术'],
    difficulty: 'intermediate',
    timeEstimate: '6-8 周',
  },

  {
    id: 'BP-003',
    title: '益生菌+益生元合生元体系设计——菌株特异性与底物精准匹配',
    category: 'FORMULATION',
    intentTypes: ['FORMULA_DESIGN', 'INGREDIENT_ANALYSIS'],
    scenario: '开发益生菌固体饮料或发酵乳制品，需要保证益生菌在保质期内的存活率（≥10⁶ CFU/g）和到达肠道后的定植效果',
    solution: '构建"菌株-底物-保护"三维合生元设计框架：（1）菌株选择——优先选用耐酸耐胆盐能力强的菌株（如 L. rhamnosus GG、B. animalis BB-12），活菌数出厂 ≥ 10⁹ CFU/g 以补偿衰减；（2）益生元匹配——根据菌株的碳水化合物利用谱（CAZy 基因簇分析）选择专属碳源，如双歧杆菌优选 GOS/FOS，乳酸菌偏好菊粉/抗性糊精；（3）多层微胶囊包埋——内层海藻酸钠-钙凝胶芯，中层蛋白质隔离层，外层脂质抗氧化层，实现胃液存活率 > 70%、肠液释放率 > 90%。（4）水分活度控制——aw < 0.25 确保粉剂稳定性。',
    keyPoints: [
      '菌株筛选核心指标：pH 2.0 存活 2h > 50%，0.3% 胆盐耐受 > 70%，37℃ 培养 24h 活力不减',
      '益生元添加量阈值：FOS/GOS 2-5 g/天有效剂量，菊粉 3-8 g/天，聚葡萄糖 6-12 g/天',
      '微胶囊三层结构：内层 2% 海藻酸钠 + CaCl₂ 凝胶化 → 中层 1% 乳清蛋白喷雾干燥 → 外层氢化植物油喷雾冷却',
      '水分活度控制：粉剂 aw < 0.25（添加二氧化硅/磷酸三钙），半固态 aw < 0.65',
      '储运条件建议：25℃ 以下常温储运，避免超过 35℃ 暴露超过 72 小时',
      '标签宣称依据：GB 7101-2022 规定保质期末活菌数 ≥ 10⁶ CFU/g(mL)',
    ],
    expectedOutcome: '保质期（12 个月，25℃）末活菌数 ≥ 10⁶ CFU/g，体外肠道定植模型中定植效率提升 2-3 倍',
    evidenceLevel: 'strong',
    references: [
      { source: 'GB 7101-2022 饮料', relevance: 'primary' },
      { source: 'Gibson et al., Nature Reviews Gastroenterology, 2017', year: 2017, relevance: 'primary' },
      { source: 'FAO/WHO Guidelines for Probiotics, 2002', year: 2002, relevance: 'supporting' },
    ],
    tags: ['合生元', '益生菌', '益生元', '微胶囊', '肠道健康'],
    difficulty: 'advanced',
    timeEstimate: '10-14 周',
  },

  {
    id: 'BP-004',
    title: '清洁标签配方的天然防腐策略——植物提取物梯度抑菌体系',
    category: 'FORMULATION',
    intentTypes: ['FORMULA_DESIGN', 'SAFETY_ASSESSMENT'],
    scenario: '产品定位为清洁标签（Clean Label），需去除苯甲酸钠/山梨酸钾等化学防腐剂，同时保证微生物安全性和货架期',
    solution: '建立"天然抑菌剂 + 物理栅栏 + 包装协同"的三道防线：（1）植物提取物的梯度组合——ε-聚赖氨酸（0.05-0.1%）针对 G+/G- 细菌，乳酸链球菌素（0.01-0.03%）专抑革兰氏阳性菌，迷迭香提取物（0.02-0.05%）抑制油脂氧化同步抑真菌，纳他霉素（0.001-0.005%）靶向酵母霉菌。（2）物理栅栏因子——降低 pH 至 4.0-4.5（柠檬酸/苹果酸）、降低 aw 至 0.85 以下（糖/盐/甘油）、巴氏杀菌降低初始菌载量。（3）活性包装——EVOH 高阻氧膜 + 脱氧剂/乙醇释放卡。三者叠加可在无化学防腐剂条件下实现 6-9 个月常温货架期。',
    keyPoints: [
      'ε-聚赖氨酸使用范围：GB 2760 允许用于熟肉制品、烘焙食品等，最大用量 0.25 g/kg',
      '乳酸链球菌素适用 pH：最适 pH 6-7，低于 pH 4 效果显著下降，需与酸性环境策略分开评估',
      '迷迭香提取物双重功效：鼠尾草酚/熊果酸提供抗氧化（ORAC > 1000 μmol TE/g）+ 抗真菌活性',
      '栅栏技术（Hurdle Technology）：至少叠加 3 个以上栅栏因子（pH/aw/温度/防腐剂/包装），每个因子温和但协同高效',
      '挑战测试要求：接种 10³-10⁵ CFU/g 目标腐败菌，30℃ 加速 14 天 + 25℃ 正常条件验证',
      '成本增量评估：天然防腐体系较传统化学防腐剂成本增加 15-30%，需计入配方 BOM',
    ],
    expectedOutcome: '无化学防腐剂声明合规，25℃ 条件下货架期 ≥ 6 个月，微生物指标符合 GB 7101/GB 19641 要求',
    evidenceLevel: 'strong',
    references: [
      { source: 'Leistner, Food Microbiology, 2000 (Hurdle Technology)', year: 2000, relevance: 'primary' },
      { source: 'GB 2760-2024 食品添加剂使用标准', relevance: 'primary' },
      { source: 'Tiwari et al., Trends in Food Science & Technology, 2018', year: 2018, relevance: 'supporting' },
    ],
    tags: ['清洁标签', '天然防腐', '植物提取物', '栅栏技术', '防腐替代'],
    difficulty: 'intermediate',
    timeEstimate: '8-12 周',
  },

  {
    id: 'BP-005',
    title: '低糖/无糖配方的甜味系统设计——代糖复配的甜味曲线拟合',
    category: 'FORMULATION',
    intentTypes: ['FORMULA_DESIGN', 'PERFORMANCE_OPT'],
    scenario: '开发低糖或无糖产品以满足减糖趋势需求，单一甜味剂存在后味苦涩、甜味延迟、成本过高或最大使用量限制等问题',
    solution: '采用"高倍甜味剂 + 填充型甜味剂 + 甜味增强剂"三元复配体系，通过响应面法（RSM）优化甜味曲线使其逼近蔗糖的时间-强度特征：（1）高倍甜味剂主体——赤藓糖醇（甜度 0.65，清凉感好）+ 三氯蔗糖（甜度 600，无后苦）+ 甜菊糖苷（RA≥95%，天然宣称）；（2）填充型基底——异麦芽酮糖醇（结晶性好，不吸湿）或麦芽糖醇（保水性佳）；（3）甜味增强剂——甘草酸铵（0.005-0.02%）或奇异果甜蛋白（Miraculin，0.001%）掩盖后苦并延长甜感。最终目标：等效蔗糖甜度 8-12°Bx，甜味 onset < 2s，持久时间 15-20s，无金属后味。',
    keyPoints: [
      '赤藓糖醇推荐用量：5-15%（过量 > 20% 会导致强烈清凉感和腹泻风险，每日限值 < 0.66 g/kg BW）',
      '三氯蔗糖安全余量：GB 2760 最大用量因品类而异（饮料 0.25 g/kg，烘焙 1.0 g/kg），留 20% 安全边际',
      '甜菊糖苷规格选择：RA（Rebaudioside A）含量 ≥ 95% 可减少甘草后味，SG（Steviol Glycoside）总苷 ≥ 95% 性价比更高',
      '复配比例参考：赤藓糖醇:三氯蔗糖:甜菊糖 = 100:0.03:0.5（重量比）可模拟 10°Bx 蔗糖溶液甜感',
      '感官评价方法：Time-Intensity (TI) 分析训练 12 人以上小组，绘制甜味曲线对比蔗糖参照',
      '成本对比：代糖体系成本约为等甜蔗糖的 1.5-3 倍，需结合定价策略评估',
    ],
    expectedOutcome: '蔗糖减少 ≥ 90%，甜味曲线相似度 ≥ 85%（TI 分析），消费者盲测偏好无显著差异（p>0.05）',
    evidenceLevel: 'strong',
    references: [
      { source: 'GB 2760-2024 食品添加剂使用标准', relevance: 'primary' },
      { source: 'DuBois et al., Food Technology, 1999 (Sweetener synergy)', year: 1999, relevance: 'primary' },
      { source: 'WHO Guideline: Sugars intake for adults and children, 2015', year: 2015, relevance: 'supporting' },
    ],
    tags: ['低糖配方', '代糖复配', '甜味剂', '减糖', '清洁标签'],
    difficulty: 'intermediate',
    timeEstimate: '6-10 周',
  },

  {
    id: 'BP-006',
    title: '高蛋白产品的质地改良技术——蛋白聚集控制与水合优化',
    category: 'FORMULATION',
    intentTypes: ['FORMULA_DESIGN', 'PERFORMANCE_OPT'],
    scenario: '高蛋白产品（蛋白含量 > 20%）常见质地粗糙、胶着感强、砂砾感明显、加热后凝胶过硬等问题，严重影响食用体验',
    solution: '从蛋白质物理化学性质入手系统性改良质地：（1）蛋白来源多元化——乳清分离蛋白（WPI）提供快速溶解和清爽口感，酪蛋白酸钠贡献 creamy 质地，大豆分离蛋白（SPI）增加凝胶强度，按 5:3:2 比例混合；（2）水合促进——预水合处理（蛋白:水=1:5，4℃ 水合 12h 或 45℃ 水合 2h）消除未水合颗粒导致的砂砾感；（3）质构调节剂——黄原胶（0.1-0.3%）增加假塑性改善流动性，瓜尔胶（0.05-0.15%）增加黏稠感，卡拉胶（0.02-0.1%）提供热可逆凝胶；（4）加工参数优化——均质压力 20-40 MPa 避免过度剪切导致蛋白变性聚集，pH 控制在蛋白等电点 ±1.5 单位以外。',
    keyPoints: [
      '蛋白总含量阈值：> 20% 定义为高蛋白（GB 28050-2011 可声称"高蛋白"需 ≥ 20% NRV 即 10g/100g 固体）',
      'WPI vs WPC 选择：WPI（蛋白 ≥ 90%）适合清澈饮品，WPC（蛋白 80%）适合奶昔类浑浊产品',
      '预水合操作规范：低温慢水合（4±2℃，10-12h）优于高温快水合（45-50℃，1-2h），可减少热变性聚集',
      '均质参数窗口：一级均质 20 MPa + 二级均质 5 MPa，进口温度 < 55℃，出口温度 < 72℃',
      '砂砾感量化检测：激光粒度分析仪测量分散相 D₉₀ < 50μm 为合格，> 100μm 明显感知颗粒',
      '质构剖面目标（TPA）：硬度 200-400g（液体）/ 800-1500g（凝胶），弹性 > 0.8，胶着性 < 0.6',
    ],
    expectedOutcome: '砂砾感评分 ≤ 2（9 点标度），TPA 弹性 > 0.8，消费者质地满意度 ≥ 4.0/5.0',
    evidenceLevel: 'moderate',
    references: [
      { source: 'Lametti et al., Food Hydrocolloids, 2015 (Protein hydration)', year: 2015, relevance: 'primary' },
      { source: 'GB 28050-2011 预包装食品营养标签通则', relevance: 'supporting' },
      { source: 'McClements, Food Emulsions, 7th Ed., 2015', year: 2015, relevance: 'supporting' },
    ],
    tags: ['高蛋白', '质地改良', '蛋白水合', '质构调节', '运动营养'],
    difficulty: 'intermediate',
    timeEstimate: '8-12 周',
  },

  {
    id: 'BP-007',
    title: '脂肪替代物的应用与口感补偿——基于乳化凝胶的双相模拟体系',
    category: 'FORMULATION',
    intentTypes: ['FORMULA_DESIGN', 'PERFORMANCE_OPT'],
    scenario: '低脂/减脂产品需要模拟全脂产品的奶油感、润滑度和香气释放特性，单纯去脂导致口感干涩、风味稀释',
    solution: '构建"结构性脂肪替代 + 感知补偿"的双重策略：（1）结构性替代——以蛋白质基乳化凝胶为核心（WPI 4-6% + 黄原胶 0.2% + 高压均质 50MPa 形成热不可逆凝胶颗粒 1-10μm），模拟脂肪球的尺寸分布和口腔摩擦系数；（2）碳水化合物基填充——麦芽糊精 DE 10-18（5-10%）提供黏稠度和体量感，改性淀粉（乙酰化二淀粉己二酸酯 2-4%）提供熔融感；（3）风味补偿——脂肪衍生的风味前体物质（如 γ-丁内酯、δ-癸内酯，各 1-5ppm）补充脂溶性感官特征，配合香兰素（5-20ppm）增强整体饱满度。（4）口感量化——用摩擦学（Tribology）测量 SFC 曲线，使减脂产品的 SFC 曲线逼近全脂对照。',
    keyPoints: [
      '脂肪减少幅度分级：减 25%（轻度）→ 减 50%（中度）→ 减 75%+（深度），每级需不同强度的替代策略',
      '蛋白基脂肪模拟物制备：WPI 5% 溶液 → pH 7.0 调节 → 80℃ 加热 30min 凝胶化 → 高速分散成 1-10μm 颗粒',
      '摩擦学评价方法：球-盘式摩擦仪（PDMS 球/HDPE 盘），滑动速度 0.1-100 mm/s，测量 SFC (Striated Friction Coefficient)',
      '风味补偿原则：脂溶性香气物质需先溶于少量载体油（MCT 0.5-1%）再乳化入体系，直接加入会迁移至表面',
      'Inulin 双效用法：菊粉（5-8%）既作为脂肪替代又提供膳食纤维声称（满足"富含膳食纤维"条件）',
      '标注合规：使用脂肪替代物时配料表应如实标注，不可暗示"低脂"除非符合 GB 28050 含量声称要求',
    ],
    expectedOutcome: '脂肪含量降低 30-50%，感官三角测试与全脂产品无显著差异（α=0.05），SFC 曲线相似度 > 75%',
    evidenceLevel: 'moderate',
    references: [
      { source: 'Singer & Ho, Fat Replacers, 2020', year: 2020, relevance: 'primary' },
      { source: 'Joyner (ed.), Tribology for Food Applications, 2022', year: 2022, relevance: 'primary' },
      { source: 'GB 28050-2011 预包装食品营养标签通则', relevance: 'supporting' },
    ],
    tags: ['脂肪替代', '低脂配方', '乳化凝胶', '口感模拟', '摩擦学'],
    difficulty: 'advanced',
    timeEstimate: '10-16 周',
  },

  {
    id: 'BP-008',
    title: '功能因子的生物利用度增强——纳米乳化与磷脂复合双重递送策略',
    category: 'FORMULATION',
    intentTypes: ['FORMULA_DESIGN', 'INGREDIENT_ANALYSIS'],
    scenario: '姜黄素、辅酶 Q10、维生素 D3 等脂溶性功能因子水溶性差、胃肠道吸收率低（< 10%），导致实际摄入剂量远高于有效剂量',
    solution: '根据功能因子的理化特性选择递送技术路线：（A）纳米乳化路线——适用于 logP 3-6 的中等亲脂性物质（如姜黄素、维生素 E）。采用高压均质法（50-100 MPa，3-5 个循环）制备 O/W 纳米乳，粒径 80-200nm，PDI < 0.2，使用 Tween 80/卵磷脂（HLB 10-14）复合乳化剂，载量 1-5%。自纳米乳化 SNEDDS 方案适用于液体胶囊制剂。（B）磷脂复合路线——适用于多酚/黄酮类（如大豆异黄酮、白藜芦醇）。将活性物与大豆卵磷脂按摩尔比 1:1-1:2 在溶剂中反应，形成分子复合物改变晶体结构，溶解度提高 5-20 倍。两种路线均可配合肠溶包衣实现定点释放于十二指肠-空肠段。',
    keyPoints: [
      '纳米乳关键质量属性(CQA)：粒径 80-200nm（DLS 测定），Zeta 电位绝对值 > 30mV（静电稳定），PDI < 0.2（窄分布）',
      '高压均质参数：50-100 MPa，3-5 循环，温度控制 < 45℃（夹套冷却），防止热敏成分降解',
      'SNEDDS 组成示例：油相 MCT/Capryol 90 (30-40%) + 乳化剂 Cremophor EL/Labrasol (40-50%) + 助溶剂 Transcutol P (15-25%)',
      '磷脂复合工艺：活性物:大豆卵磷脂 = 1:1.5（mol），四氢呋喃回流 2h，旋转蒸发除溶剂，真空干燥得复合物',
      '生物利用度验证：Caco-2 细胞模型表观渗透系数 Papp > 1×10⁻⁶ cm/s 为优，动物 AUC 对比提升 > 2 倍',
      '法规注意：纳米材料在部分国家/地区有特殊申报要求（如欧盟 EFSA Novel Food 评估），需提前确认',
    ],
    expectedOutcome: '生物利用度提升 2-5 倍（AUC 对比），Cmax 提前 30-60min，有效剂量降低 40-60%',
    evidenceLevel: 'strong',
    references: [
      { source: 'McClements, Advances in Colloid and Interface Science, 2018 (Nanoemulsions)', year: 2018, relevance: 'primary' },
      { source: 'Porter et al., Nature Reviews Drug Discovery, 2007 (Lipid formulations)', year: 2007, relevance: 'primary' },
      { source: 'Yuan et al., International Journal of Pharmaceutics, 2022 (Phospholipid complex)', year: 2022, relevance: 'supporting' },
    ],
    tags: ['生物利用度', '纳米乳化', '磷脂复合', '递送系统', '功能因子'],
    difficulty: 'advanced',
    timeEstimate: '14-20 周',
  },

  {
    id: 'BP-009',
    title: '特医食品(FSMP)的营养素密度优化——基于 DRIs 的矩阵式配方设计',
    category: 'FORMULATION',
    intentTypes: ['FORMULA_DESIGN', 'REGULATORY_COMPLIANCE'],
    scenario: '设计特定全营养配方食品（如糖尿病专用、肿瘤专用 FSMP），需在 GB 25596/GB 29922 法规框架内实现营养素的精准配比和相互作用管理',
    solution: '遵循"法规边界→临床需求→技术可行性"三级约束的矩阵式设计流程：（1）建立营养素约束矩阵——横轴为 GB 25596 规定的 13 类必需营养素及其最小值/最大值/RSP 百分比范围，纵轴为目标人群（如糖尿病患者需限制 CHO:PRO:FAT 比例为 40:30:30 能量%）。（2）矿物质相互作用管理——钙铁锌同补时需间隔吸收窗口（钙:铁 > 2:1 时铁吸收受抑），采用螯合形式（甘氨酸亚铁、葡萄糖酸锌）减少竞争。（3）渗透压控制——全营养液态配方渗透压控制在 300-450 mOsm/kg（等渗至 mildly hypertonic），避免高渗性腹泻。（4）稳定性验证——加速试验（40℃/75%RH/6 月）监测维生素降解（特别是 VA、VC、VB12）和矿物质沉淀。',
    keyPoints: [
      'FSMP 分类依据：GB 25596-2010（1-10 岁）和 GB 29922-2013（≥10 岁）分别规定不同年龄段的营养素范围',
      '蛋白质来源要求：必须包含优质蛋白（乳清蛋白/酪蛋白/大豆分离蛋白），且必须标注 PDCAAS 或 DIAAS 值',
      '糖尿病专用 FSMP 关键调整：GI < 45（选用异麦芽酮糖醇/抗性淀粉），CHO 占能 40-45%，增加 MUFA 至 20%',
      '渗透压计算公式：π = mOsm = Σ(每种溶质 mmol/L × 离子数)，液态产品目标 300-450 mOsm/kg H₂O',
      '微量元素形态选择：优先有机螯合物（氨基酸螯合铁/锌）优于无机盐（硫酸亚铁/硫酸锌），吸收率高 30-50%',
      '注册流程时间线：配方研发 3-6 月 → 试生产 1-2 月 → 检验 1-2 月 → 注册申报 6-12 月（NMPA 审评）',
    ],
    expectedOutcome: '营养素 100% 符合 GB 25596/GB 29922 范围值，临床试验显示氮平衡改善，患者依从性 > 85%',
    evidenceLevel: 'strong',
    references: [
      { source: 'GB 25596-2010 特殊医学用途婴儿配方食品通则', relevance: 'primary' },
      { source: 'GB 29922-2013 特殊医学用途配方食品通则', relevance: 'primary' },
      { source: 'ESPEN Guidelines on Clinical Nutrition, 2019', year: 2019, relevance: 'supporting' },
    ],
    tags: ['特医食品', 'FSMP', '营养密度', '特殊医学用途', '配方设计'],
    difficulty: 'advanced',
    timeEstimate: '16-24 周',
  },

  {
    id: 'BP-010',
    title: '有机认证配方的原料合规管理——从农田到工厂的全链条追溯',
    category: 'FORMULATION',
    intentTypes: ['FORMULA_DESIGN', 'REGULATORY_COMPLIANCE'],
    scenario: '产品计划获得中国有机产品认证（GB/T 19630）或国际有机认证（USDA Organic / EU Organic），所有原料及添加剂必须符合有机标准',
    solution: '建立"原料准入→交叉污染防控→文件追溯"三阶段管理体系：（1）原料准入清单——建立有机原料数据库，每个原料条目包含：有机证书编号、认证机构、证书有效期、允许使用的非有机辅料清单（GB/T 19630.2 附录 A 中规定的 118 种加工助剂）。（2）生产过程防污染——有机与非共用生产线时需执行彻底清洗程序（CIP 清洗 + 有机溶剂擦拭 + 紫外照射验证），换产记录需保留 5 年以上。（3）批次追溯系统——每批产品建立"一码一档"，包含：原料批次 COA → 生产记录 → 检验报告 → 销售记录，实现正向追踪 1 步、反向追踪 3 步。（4）年度监督审核准备——保持有机投入品使用台账、内部检查记录、偏离纠正措施记录随时可查。',
    keyPoints: [
      '有机配料占比要求：GB/T 19630 规定有机产品中有机原料 ≥ 95%（加工产品），95-100% 可标注"有机"',
      '非有机允许辅料：仅限 GB/T 19630.2 附录 A 列明的物质（如碳酸钙、抗坏血酸、卵磷脂等 118 种）',
      '禁止使用物质：离子辐射、转基因成分、合成色素/防腐剂/增味剂（天然等同也不行）',
      '清洗验证标准：ATP 生物荧光检测 RLU < 10（背景水平），过敏原 ELISA 检测阴性',
      '证书有效期管理：有机证书通常 1 年有效期，需在到期前 3 个月启动续证审核，避免断证',
      '多国认证差异：USDA 要求 ≥ 95% 有机（排除水和盐），EU 要求 ≥ 95% 且标注有机农业代码',
    ],
    expectedOutcome: '顺利通过有机认证机构年度审核（零不符合项），有机证书持续有效，市场溢价 20-50%',
    evidenceLevel: 'strong',
    references: [
      { source: 'GB/T 19630.1~4-2019 有机产品 生产、加工、标识与管理体系', relevance: 'primary' },
      { source: 'USDA NOP Final Rule, 7 CFR Part 205', relevance: 'supporting' },
      { source: 'EU Regulation 2018/848 on organic production', year: 2018, relevance: 'background' },
    ],
    tags: ['有机认证', '原料合规', '追溯体系', 'GB/T 19630', '清洁标签'],
    difficulty: 'intermediate',
    timeEstimate: '8-12 周',
  },

  {
    id: 'BP-011',
    title: '植物基配方的质构模拟技术——纤维-蛋白-油脂三元网络重构',
    category: 'FORMULATION',
    intentTypes: ['FORMULA_DESIGN', 'PERFORMANCE_OPT'],
    scenario: '开发植物基肉类/乳制品替代品，需要在无动物源性成分的前提下模拟真实肉/奶的多汁性、纤维感、弹性和风味释放',
    solution: '采用"结构类似物组装 + 功能组分互补"的策略重构植物基基质：（1）蛋白基质选择与改性——豌豆蛋白（组织化后拉丝性能最佳）+ 大豆浓缩蛋白（提供凝胶强度）+ 大米蛋白（改善色泽），比例 5:3:2。通过高湿挤压（HME）在 100-140℃、水分 50-70% 条件下形成各向异性纤维结构。（2）脂肪模拟系统——椰子油（室温固态模拟脂肪颗粒感）+ 菜籽油（液态油提供多汁性）+ 液态橙色（Oleogel，如蜂蜡-菜籽油凝胶）控制融点在 28-35℃ 接近动物脂肪。（3）黏合与保水体系——甲基纤维素（热凝胶性，加热后形成皮膜）+ 黄原胶/槐豆胶复配（热可逆凝胶保水）+ 植物血红素（豆血红蛋白，1-2% 提供肉色和烤肉风味前体）。（4）风味补偿——硫胺素热降解产物（噻唑类化合物）+ 含硫氨基酸（半胱氨酸）美拉德反应生成肉香物质。',
    keyPoints: [
      '高湿挤压(HME)核心参数：螺杆转速 200-500 rpm，模口温度 120-140℃，冷却模长度 > 300mm 促进纤维取向',
      '植物血红素使用注意：豆血红蛋白（Leghemoglobin）在中国尚未批准为新食品原料，可用甜菜根红色素+植物血色素替代',
      '质构目标值（仿牛肉）：剪切力 25-40 N（Warner-Bratzler），咀嚼性 150-300 mJ，弹性 0.7-0.9',
      '保水性量化：离心法测定持水力 WHC > 150%（即每克蛋白基质保持 > 1.5g 水）',
      '甲基纤维素凝胶化温度：约 50-70℃ 成胶，90℃ 达最强凝胶（约 5000 g/cm²），冷却后仍保持',
      '过敏原标注：大豆蛋白/豌豆蛋白均为潜在过敏原，需按 GB 7718 要求在配料表邻近位置标注',
    ],
    expectedOutcome: 'TPA 参数与对照动物制品差异 < 20%，消费者盲测接受度 > 70%（3 分以上，9 分 hedonic 标度）',
    evidenceLevel: 'moderate',
    references: [
      { source: 'Palzer et al., Annual Review of Food Science and Technology, 2018 (Plant-based meat)', year: 2018, relevance: 'primary' },
      { source: 'Lin et al., Comprehensive Reviews in Food Science and Safety, 2022 (HME technology)', year: 2022, relevance: 'primary' },
      { source: 'GB 7718-2011 预包装食品标签通则', relevance: 'supporting' },
    ],
    tags: ['植物基', '质构模拟', '高湿挤压', '素食', '替代蛋白'],
    difficulty: 'advanced',
    timeEstimate: '14-20 周',
  },

  {
    id: 'BP-012',
    title: '运动营养品的时机释放配方设计——分阶段营养输送系统',
    category: 'FORMULATION',
    intentTypes: ['FORMULA_DESIGN', 'PROCESS_TECHNOLOGY'],
    scenario: '运动营养产品（如能量胶、恢复饮）需要在不同运动阶段（赛前/赛中/赛后）精准释放不同营养成分以最大化运动表现和恢复效率',
    solution: '设计"即时相-持续相-延迟相"三阶段释放体系：（1）即时相（0-30 min）——快速供能成分：支链氨基酸 BCAA（亮氨酸:异亮氨酸:缬氨酸 = 2:1:1，5-10g）以游离形式存在，电解质（钠 200-500mg、钾 100-200mg、镁 50-100mg）以柠檬酸盐形式快速吸收，咖啡因（50-200mg）提供中枢兴奋。（2）持续相（30-120 min）——缓释碳水矩阵：麦芽糊精 DE 15-20（快速供能）+ 异麦芽酮糖醇（缓释，GI 约 32）+ 葡萄糖聚合物（持续释放）组成复合碳水，总碳水 30-60g/h。（3）延迟相（120 min+）——恢复促进因子：谷氨酰胺（3-5g）支持免疫，HMB（β-羟基-β-甲基丁酸，1-3g）减少肌肉分解，采用肠溶微丸技术包裹在 pH > 5.5 的肠道环境中释放。三种相位可通过双层片/三层片或多颗粒系统（MUPS）实现物理分隔。',
    keyPoints: [
      'BCAA 黄金比例：Leu:Ile:Val = 2:1:1 是目前研究支持的最佳促肌蛋白合成比例（ISSN Position Stand 2017）',
      '电解质补给速率：运动中推荐 Na⁺ 300-800mg/L，K⁺ 150-250mg/L，丢失量估算：Na⁺ ~1g/L 汗液',
      '咖啡因 timing：赛前 60min 摄入达血浆峰值（Tmax ≈ 45-60min），赛中持续摄入维持平台浓度',
      '肠溶微丸制备：流化床底喷包衣，HPMC HP55（溶解 pH > 5.5）包衣增重 10-15%，释药滞后 60-90min',
      'NSF Certified for Sport®：竞技体育场景强烈建议获取此认证，确保不含世界反兴奋剂机构(WADA)禁用物质',
      'GI 优化策略：赛中产品 GI > 55（中高 GI 快速供能），赛后产品 GI < 55（低 GI 稳定血糖促进恢复）',
    ],
    expectedOutcome: '运动耐力提升 5-15%（TT 试验），赛后肌糖原再合成速率提高 20-30%，肌肉酸痛评分降低 25%',
    evidenceLevel: 'strong',
    references: [
      { source: 'ISSN Position Stand: Exercise & Sports Nutrition, 2017', year: 2017, relevance: 'primary' },
      { source: 'ACSM Roundtable, Medicine & Science in Sports & Exercise, 2009', year: 2009, relevance: 'primary' },
      { source: 'GB 24154-2015 运动营养食品通则', relevance: 'supporting' },
    ],
    tags: ['运动营养', '时机释放', 'BCAA', '缓释技术', '运动表现'],
    difficulty: 'advanced',
    timeEstimate: '12-18 周',
  },

  /* ===================================================================
   * Category 2: INGREDIENT_SELECTION 原料筛选 (BP-013 ~ BP-020)
   * =================================================================== */

  {
    id: 'BP-013',
    title: '功能性原料供应商评估体系——质量/资质/产能/价格四维模型',
    category: 'INGREDIENT_SELECTION',
    intentTypes: ['INGREDIENT_ANALYSIS', 'COST_REDUCTION'],
    scenario: '新产品研发需要引入新的功能性原料（如新型益生菌菌株、专利肽原料），市场上供应商众多，质量和价格参差不齐，需要科学的供应商遴选方法',
    solution: '建立 QACP 四维加权评估模型：（1）Quality 质量（权重 35%）——COA 合规性（主含量、杂质、微生物三达标）、批次间变异 CV < 5%、第三方检测报告（SGS/Intertek）、稳定性数据（加速 6 月）。（2）Authentication 资质（权重 25%）——SC 食品生产许可证、ISO 22000/HACCP 认证、HALAL/KOSHER（如出口需要）、专利授权书（如涉及专利原料）、新食品原料批复文件。（3）Capacity 产能（权重 20%）——月供货能力 ≥ 需求量 × 1.5 倍、备货周期 ≤ 4 周、应急产能储备、仓储条件（温湿度可控）。（4）Price 价格（权重 20%）——FOB 单价、MOQ 最小起订量、账期条件、年度阶梯折扣。综合得分 ≥ 80 分方可入围，每维度设置一票否决项（如无 SC 许可证则直接淘汰）。',
    keyPoints: [
      '质量一票否决项：重金属超标（Pb/As/Hg/Cd 任一超 GB 2762 限量）、致病菌阳性、无 COA 或 COA 数据不全',
      '资质核查要点：SC 编号可在国家市场监管总局官网核验真伪，关注许可品种明细是否涵盖目标原料',
      '产能实地考察必查项目：生产设备铭牌及校准记录、洁净区压差记录、人员健康证明、虫害防治记录',
      '价格谈判锚点：了解原料上游大宗商品价格走势（如乳清粉跟随 GDT 指数），设定合理价格区间',
      '样品评估流程：索样 3 批次（不同生产日期）→ 内部全检 → 中试试用 → 综合评分 → 供应商现场审计',
      '年度复审机制：每年对合格供应商重新打分，连续两季度交付异常或质量问题自动降级或淘汰',
    ],
    expectedOutcome: '供应商库精简至 3-5 家核心供应商，原料批次不合格率 < 2%，供应中断风险降至 < 5%/年',
    evidenceLevel: 'strong',
    references: [
      { source: 'ISO 21469:2018 食品安全技术规范', relevance: 'supporting' },
      { source: 'FSSC 22000 V5.1 食品安全体系认证', relevance: 'supporting' },
      { source: 'GB 14881-2013 食品生产通用卫生规范', relevance: 'primary' },
    ],
    tags: ['供应商管理', '原料筛选', '质量控制', '采购体系', '风险评估'],
    difficulty: 'intermediate',
    timeEstimate: '4-6 周',
  },

  {
    id: 'BP-014',
    title: '进口原料的清关与合规要点——HS 编码归类与准入前置审查',
    category: 'INGREDIENT_SELECTION',
    intentTypes: ['INGREDIENT_ANALYSIS', 'REGULATORY_COMPLIANCE'],
    scenario: '计划从海外引进新型功能性原料（如欧洲专利益生菌、美国 FDA GRAS 认证的植物提取物），面临海关 HS 编码归类、检验检疫要求和准入资质问题',
    solution: '按照"准入确认→单证准备→清关操作→到货验收"四步流程管控：（1）准入前置查询——通过海关总署《准予进口食品境外生产企业注册名单》确认输出国和企业已获注册；通过 GACC 网站查询该原料是否在《符合评估审查要求的国家或地区输华食品目录》中。（2）HS 编码准确归类——根据《进出口税则》和海关归类决定正确归类（如益生菌粉通常归入 2106.90.90"其他食品"，某些提取物可能归入 1302.19"植物提取物"），错误归类可能导致税率差异或违规风险。（3）必备单证清单——原产地证（享受自贸协定关税优惠的关键）、健康证书/卫生证书（出口国官方签发）、成分分析 COA、中文标签备案（进口食品预包装标签需在报关前完成审核）、检测报告（重金属、微生物）。（4）口岸查验配合——抽样送检概率约 10-30%，检测结果周期 3-7 工作日，不合格品需退运或销毁。',
    keyPoints: [
      'HS 编码重要性：同一原料不同 HS 编码关税差异可达 0-15%（如普通食品 2106 项下多数零关税，部分保健品 2106.90.90 可能征 13% VAT）',
      '原产地证价值：RCEP 框架下亚太国家原产地证可享 0-10% 关税减免，需确保产地证信息与发票/箱单一致',
      '中文标签强制要求：GB 7718-2011 规定进口预包装食品必须有中文标签，违者面临货物扣留和罚款',
      '新食品原料特别注意：首次进口的新资源食品需获得国家卫健委正式公告批准后方可报关，否则直接退运',
      '冷链运输要求：益生菌/酶制剂等热敏原料需全程 2-8℃ 冷链，到货时查验温度记录仪数据完整性',
      '代理报关选择：优先选择有食品类丰富经验的报关行，熟悉食品类特殊监管要求和查验应对',
    ],
    expectedOutcome: '清关成功率 > 98%，通关时效 ≤ 5 工作日，因单证问题导致的滞港费用 < 2000 元/批次',
    evidenceLevel: 'strong',
    references: [
      { source: '中华人民共和国进出口税则（最新版）', relevance: 'primary' },
      { source: 'GB 7718-2011 预包装食品标签通则', relevance: 'primary' },
      { source: '海关总署令第 248 号 境外生产企业注册管理规定', relevance: 'supporting' },
    ],
    tags: ['进口原料', '清关合规', 'HS编码', '海关准入', '国际贸易'],
    difficulty: 'intermediate',
    timeEstimate: '3-6 周',
  },

  {
    id: 'BP-015',
    title: '原料批次差异的质量控制策略——统计过程控制(SPC)与容差带管理',
    category: 'INGREDIENT_SELECTION',
    intentTypes: ['INGREDIENT_ANALYSIS', 'QUALITY_ASSURANCE'],
    scenario: '天然来源原料（如植物提取物、胶原蛋白肽）的批次间差异大（蛋白含量波动 ±5%，灰分波动 ±2%），直接影响终产品质量稳定性和配方准确性',
    solution: '实施"来料 SPC 监控→动态配方调整→容差带分级"三步闭环管理：（1）建立来料 SPC 控制图——对关键质量属性（CQA）如主含量、水分、pH、粒度建立 X̄-R 控制图，收集至少 25 批次数据计算 CL/UCL/LCL，当出现超出 ±3σ 的异常批次触发 OOC（Out of Control）调查。（2）动态配方调整机制——根据来料实测值在配方软件中实时调整投料量（如蛋白含量偏低则按比例增加投料量以保证终产品蛋白绝对含量恒定），调整幅度不超过 ±10%。（3）容差带分级制度——A级（中心值 ±1σ）直接使用；B级（±1-2σ）需调整配方后使用；C级（±2-3σ）需技术评估后限量使用或退货；超出 ±3σ 直接拒收。（4）供应商反馈——每月向供应商发送 SPC 报告，推动其改进过程能力 Cpk > 1.33。',
    keyPoints: [
      'SPC 核心工具：X̄ 图监控均值偏移，R 图监控离散程度，二者联合判断过程状态（Western Electric Rules 8 条判异准则）',
      '过程能力指数 Cpk 目标：Cpk ≥ 1.33 表示过程能力充足（合格率 > 99.99%），Cpk < 1.0 表示需立即改进',
      '关键属性选择原则：只对影响终产品 CQA 的属性做 SPC（通常 3-5 个），避免过度监控浪费资源',
      '取样代表性：按 ISO 2859-1 抽样方案，批量 < 150 取 3 个样本，151-2800 取 √(20N) 个，混合均匀后检测',
      '数据管理系统：推荐使用 LIMS（实验室信息管理系统）自动采集数据并生成控制图，减少人为记录误差',
      '季节性因素建模：农产品来源原料需考虑采收季节影响（如菊花秋季黄酮含量高于春季），建立季节修正系数',
    ],
    expectedOutcome: '原料批次间终产品质量变异降低 50% 以上，Cpk 从 < 1.0 提升至 > 1.33，退货率 < 2%',
    evidenceLevel: 'moderate',
    references: [
      { source: 'ISO 7870-2:2013 控制图 第2部分: Shewhart 控制图', relevance: 'primary' },
      { source: 'Montgomery, Statistical Quality Control, 7th Ed.', year: 2012, relevance: 'primary' },
      { source: 'GB/T 2828.1-2012 计数抽样检验程序', relevance: 'supporting' },
    ],
    tags: ['批次差异', 'SPC', '质量控制', '过程能力', '原料一致性'],
    difficulty: 'intermediate',
    timeEstimate: '6-10 周',
  },

  {
    id: 'BP-016',
    title: '新资源食品（Novel Food）的申报与使用——国内外双轨审批策略',
    category: 'INGREDIENT_SELECTION',
    intentTypes: ['INGREDIENT_ANALYSIS', 'REGULATORY_COMPLIANCE'],
    scenario: '拟引入国外已上市但国内尚未批准的新型功能性原料（如南非醉茄提取物、特定益生菌新菌株），需要完成新食品原料或新资源食品申报方可合法使用',
    solution: '按照"可行性预判→资料准备→正式申报→获批后使用"流程推进：（1）可行性预判——在国家卫健委官网查询已批准的新食品原料目录（截至 2024 年共公告 60+ 批次），确认目标原料是否已在列。若不在列，评估申报可行性：是否有足够的毒理学安全性数据（90 天大鼠喂养试验最低要求）、是否有国外 GRAS/Novel Food 批准先例、是否属于传统食用习惯。（2）申报资料编制——按照《新食品原料安全性审查管理办法》准备全套资料：研制报告、安全性评估报告（毒理学+营养学+质量标准）、生产工艺、执行标准、标签说明书、国内外使用情况。（3）评审周期管理——国家卫健委组织专家评审，常规周期 6-18 个月，复杂案例可能延长至 24 个月。期间可通过公开征求意见稿跟踪进度。（4）获批后合规使用——严格遵照公告中的使用范围、食用量上限和其他限制条件，超范围使用按非法添加论处。',
    keyPoints: [
      '豁免情形：传统食用 30 年以上且无安全问题的食材可申请免做毒理学试验（需提供充分的历史食用证据）',
      '毒理学数据层级：90 天喂养试验（基础）→ 遗传毒性（Ames + 微核 + 染色体畸变）→ 生殖发育毒性 → 慢毒/致癌（视需要）',
      '国际先例参考：美国 FDA GRAS Notice（一般公认安全）通知、欧盟 EFSA Novel Food 评估报告可作为重要参考材料',
      '食用量制定依据：基于 NOAEL（未观察到有害作用剂量）÷ 安全系数 100（种间×种内各 10 倍）得出 ADI，再推算人体食用量',
      '公告内容关键要素：原料名称（拉丁学名）、来源、生产工艺、食用量、使用范围、质量要求、其他必要限制',
      '风险提示：未经批准擅自使用新食品原料，依据《食品安全法》第 124 条可处以货值金额 15-30 倍罚款',
    ],
    expectedOutcome: '成功获得新食品原料公告批准（平均周期 12 个月），取得合法使用资质，为产品差异化建立壁垒',
    evidenceLevel: 'strong',
    references: [
      { source: '国家卫健委《新食品原料安全性审查管理办法》（卫计生委令第1号）', relevance: 'primary' },
      { source: 'EFSA Guidance on Novel Food applications, 2021', year: 2021, relevance: 'supporting' },
      { source: 'FDA GRAS Notice Inventory (GRN Database)', relevance: 'background' },
    ],
    tags: ['新食品原料', '新资源食品', '法规申报', '安全性评估', '合规准入'],
    difficulty: 'advanced',
    timeEstimate: '12-24 周',
  },

  {
    id: 'BP-017',
    title: '天然提取 vs 生物合成原料的成本效益对比——TCO 全生命周期分析',
    category: 'INGREDIENT_SELECTION',
    intentTypes: ['INGREDIENT_ANALYSIS', 'COST_REDUCTION'],
    scenario: '同一功能性成分（如维生素 C、叶酸、CoQ10、某些氨基酸）既有天然提取来源也有发酵/化学合成来源，需要从成本、品质、宣称等多角度做出采购决策',
    solution: '建立 TCO（Total Cost of Ownership）全生命周期成本模型进行系统对比：（1）直接成本比较——天然提取原料单价通常是合成的 2-10 倍（如 L-阿拉伯糖：天然玉米芯提取 ~300 元/kg vs 化学合成 ~80 元/kg），但需考虑纯度差异（天然产物常含伴生物质）。（2）品质属性矩阵——对比纯度（HPLC 面积归一化）、杂质谱（合成副产物 vs 天然伴生物）、同分异构体（天然多为 L 型，合成可能有 DL 外消旋）、重金属/农残风险（天然提取物农残风险更高）。（3）宣称价值评估——"天然"宣称可带来 15-50% 的价格溢价（取决于品类和渠道），但需符合 GB/T 32920 天然食品添加剂标准或相关认证（如 NATRUE/Ecocert）。（4）供应链韧性——合成原料供应稳定、不受气候/产地影响；天然原料受季节/产量波动影响大，价格年波动可达 30-50%。（5）综合决策矩阵——对每种原料计算 TCO 得分 = (单价×1.2 + 质检成本×1.0 + 库存持有成本×0.8 + 断供风险成本×1.5) / 宣称溢价系数。',
    keyPoints: [
      '天然定义争议：中国尚无统一"天然"法律定义，GB/T 32920 仅针对食品添加剂，配料层面依赖行业标准或企业自定标准',
      'CoQ10 典型案例：发酵法 CoQ10（全反式 > 98%）约 3000-5000 元/kg，化学合成（顺反异构体混合）约 800-1500 元/kg，差价 3-4 倍',
      '维生素 C 案例：发酵法（玉米淀粉→山梨醇→古龙酸→VC）成本约 35-50 元/kg，针叶樱桃提取 VC 成本约 500-1000 元/kg',
      '同分异构体意义：L-型氨基酸/维生素为人体可直接利用形式，D-型或 DL-型生物利用率大幅降低甚至无效',
      '农残风险等级：植物提取物 > 动物源提取物 > 发酵产物 > 化学合成品（逐级降低）',
      '决策建议模板：高附加值宣称产品选天然（面膜/高端补充剂），大众消费品选合成（饮料/烘焙基础原料）',
    ],
    expectedOutcome: '建立完整的原料来源决策树，每种原料均有明确的 sourcing strategy 文档，采购决策偏差率 < 10%',
    evidenceLevel: 'moderate',
    references: [
      { source: 'GB/T 32920-2016 天然食品添加剂 天然香料通用要求', relevance: 'primary' },
      { source: 'Liao et al., Biotechnology Advances, 2021 (Bio-production vs extraction)', year: 2021, relevance: 'supporting' },
      { source: 'Grand View Research, Natural vs Synthetic Ingredients Market Report, 2023', year: 2023, relevance: 'background' },
    ],
    tags: ['天然提取', '生物合成', '成本分析', '原料选择', 'TCO'],
    difficulty: 'intermediate',
    timeEstimate: '4-8 周',
  },

  {
    id: 'BP-018',
    title: '过敏原管理的 HACCP 整合方案——从原料到成品的全程管控',
    category: 'INGREDIENT_SELECTION',
    intentTypes: ['INGREDIENT_ANALYSIS', 'SAFETY_ASSESSMENT'],
    scenario: '产品含有或可能含有 GB 7718 规定的 8 大致敏物质（含麸质的谷物、甲壳纲类、鱼类、蛋类、花生、大豆、坚果、乳及乳制品），需要建立系统的过敏原管控体系防范交叉污染',
    solution: '将过敏原管理整合进 HACCP 计划，设立独立的过敏原 CCP（关键控制点）和 PRP（前提方案）：（1）过敏原危害分析——识别配方中故意添加的过敏原和环境中可能引入的过敏原（通过共享生产线/设备/空气传播），绘制过敏原流向图。（2）CCP 设置——CCP1：原料接收时的过敏原身份核实（COA+标签核对+过敏原 ELISA 快检）；CCP2：换产清洗验证（ATP 荧光 + 过敏原特异性检测，阈值通常为 PPM 级别，如牛奶蛋白 < 1ppm）；CCP3：成品标签审核（确保过敏原信息完整准确）。（3）PRP 措施——物理隔离（专线生产/独立区域）、颜色编码管理（过敏原物料用具专用颜色）、员工培训（过敏原意识 + 应急处置）。（4）预防性验证——每月进行过敏原涂抹采样（环境+设备表面），每季度进行挑战性验证（故意引入微量过敏原后检测清除效果）。',
    keyPoints: [
      '中国 8 大致敏原列表（GB 7718-2011）：含麸质的谷物、甲壳纲类动物、鱼类、蛋类、花生、大豆、坚果、乳及乳制品（含乳糖）',
      '过敏原检测阈值参考：多数企业内部控制标准为 < 1-10 ppm（蛋白质当量），但 VITAL（Voluntary Incidental Trace Allergen Labeling）推荐基于参考剂量（ED05）设定',
      'ELISA 快检方法：R-Biopharm RIDASCREEN® 系列（检测限 0.5-5 ppm/kg），Neogen ReVerde® 系列，检测时间 30-60 min',
      '清洗验证顺序：先干法清理（吸尘/刷洗）→ 预冲洗（温水）→ 清洁剂清洗（碱性清洁剂 50-60℃）→ 漂洗 → 消毒 → 过敏原检测',
      '召回演练要求：每年至少 1 次模拟过敏原标签遗漏或交叉污染事件的召回演练，记录完整追溯链路',
      '国际差异注意：欧盟/美国/澳新过敏原列表与中国不完全一致（如欧盟还包括芹菜/芥末/芝麻/二氧化硫/羽扇豆），出口产品需额外关注',
    ],
    expectedOutcome: '过敏原交叉污染事件为零起，CCP 监控记录完整率 100%，外部审核过敏原专项零不符合项',
    evidenceLevel: 'strong',
    references: [
      { source: 'GB 7718-2011 预包装食品标签通则（致敏物质条款）', relevance: 'primary' },
      { source: 'GB 14881-2013 食品生产通用卫生规范', relevance: 'primary' },
      { source: 'Allergen Bureau, VITAL Program 3.0, 2019', year: 2019, relevance: 'supporting' },
    ],
    tags: ['过敏原管理', 'HACCP', '交叉污染', '食品安全', '标签合规'],
    difficulty: 'intermediate',
    timeEstimate: '6-10 周',
  },

  {
    id: 'BP-019',
    title: '原料相互作用的预测与规避——沉淀/氧化/美拉德反应的系统化管理',
    category: 'INGREDIENT_SELECTION',
    intentTypes: ['INGREDIENT_ANALYSIS', 'FORMULA_DESIGN'],
    scenario: '复杂配方中多种功能原料共存时可能出现不相容现象：蛋白质与多酚产生沉淀、维生素C与金属离子催化氧化还原反应、还原糖与氨基酸发生美拉德褐变导致色泽风味劣变',
    solution: '建立"理论预测→实验验证→配方规避"的三级防御体系：（1）理论预测矩阵——建立原料相互作用知识库，基于化学原理预判潜在冲突：蛋白+多酚（氢键/疏水作用→沉淀）、Vc+Cu²⁺/Fe³⁺（芬顿反应→氧化降解）、还原糖+氨基酸（美拉德→褐变）、Ca²⁺+草酸盐/植酸盐（难溶盐→沉淀）、阳离子多糖+阴离子多糖（聚电解质复合→絮凝）。（2）高通量筛选实验——设计二元/三元混合矩阵实验（DoE），在加速条件（40℃/75%RH/2 周）下观察外观变化（浊度、色泽 ΔE）、活性保留率和沉淀量。（3）规避策略库——物理分隔（多层片/微囊包埋隔离反应物）、pH 调控（远离等电点和反应最适 pH）、螯合剂添加（EDTA/柠檬酸盐螯合金属离子催化位点）、抗氧化体系（Vc+VE 协同抗氧化）、顺序添加（临用前混合避免长期共存）。（4）长期稳定性验证——实时条件（25℃/60%RH）观察 6-12 个月确认无迟发的不相容现象。',
    keyPoints: [
      '美拉德反应加速条件：Aw 0.3-0.7、温度 > 50℃、pH 6-8、还原糖+赖氨酸/精氨酸（反应活性最高），控制任一因素即可显著减缓',
      '蛋白-多酚沉淀机理：多酚醌式结构与蛋白巯基/氨基形成共价键 + 疏水相互作用，沉淀量随多酚/蛋白比增大呈 S 型曲线',
      '芬顿反应防护：Fe³⁺/Cu²⁺催化 Vc 氧化的速率常数 k ≈ 10³-10⁴ M⁻¹s⁻¹，添加 EDTA（0.01-0.05%）可将氧化速率降低 90%+',
      '常用螯合剂选择：EDTA-二钠（广谱螯合，GB 2760 最大 0.25 g/kg）、柠檬酸钠（温和，GRAS）、六偏磷酸钠（强螯合但有限量）',
      '分层/包埋技术：HPMC 包衣隔离（厚度 50-100μm 可延缓扩散 24h+）、脂质体包封（磷脂双分子层完全隔绝）',
      '相容性预判工具：利用 SciFinder/Reaxys 查询文献中已知的不相容案例，避免重复犯错',
    ],
    expectedOutcome: '配方不相容导致的变质返工率 < 1%，加速试验（40℃/2w）外观/活性/气味无显著变化',
    evidenceLevel: 'moderate',
    references: [
      { source: 'Lund & Ray, The Maillard Reaction in Foods and Nutrition, 1984', year: 1984, relevance: 'primary' },
      { source: 'Quan et al., Food Hydrocolloids, 2019 (Protein-polyphenol interactions)', year: 2019, relevance: 'supporting' },
      { source: 'GB 2760-2024 食品添加剂使用标准', relevance: 'supporting' },
    ],
    tags: ['原料相互作用', '配方稳定性', '美拉德反应', '氧化', '沉淀'],
    difficulty: 'advanced',
    timeEstimate: '8-12 周',
  },

  {
    id: 'BP-020',
    title: '可持续采购（可持续棕榈油/公平贸易/非转基因）——ESG 合规与供应链透明化',
    category: 'INGREDIENT_SELECTION',
    intentTypes: ['INGREDIENT_ANALYSIS', 'MARKET_POSITIONING'],
    scenario: '品牌方提出 ESG（环境、社会、治理）承诺，要求主要原料采购符合可持续发展标准，包括 RSPO 认证棕榈油、公平贸易认证原料、非 GMO 身份保持(IP)供应链',
    solution: '按照"标准选择→供应商筛选→身份保持→认证审计→对外沟通"五步实施可持续采购：（1）标准对标——明确所需认证类型：RSPO（圆桌可持续棕榈油，分为 Identity Preserved / Segregated / Mass Balance 三个级别）、Fair Trade（公平贸易，关注农户收入和工作条件）、Non-GMO IP（非转基因身份保持，从种子到成品的全程隔离）、Rainforest Alliance（雨林联盟认证，综合环保+社会标准）。（2）供应链身份保持（IP）管理——对于 Non-GMO 和 RSPO IP 级别，需建立物理隔离的仓储和运输体系，防止混入非认证物料。每批次保留 TC（交易证书）或 CoC（监管链证书）可追溯至种植园/农场。（3）供应商审核——除了质量审核外增加可持续性审核维度：环境影响（水资源/碳排放/生物多样性）、社会影响（劳工权益/社区关系）、治理透明度。（4）数据披露——按照 GRI Standards 或 SASB 标准编制可持续采购报告，披露认证原料采购比例、供应商多样性、碳足迹等 KPI。（5）消费者沟通——在产品包装和营销材料中使用认证标识（RSPO Logo / Fair Trade Mark / Non-GMO Project Verified）传递品牌价值。',
    keyPoints: [
      'RSPO 三个级别差异：IP（物理隔离，最高级别，溢价 10-30%）> SG（与普通油分开储存，溢价 5-15%）> MB（按比例混入，溢价最小 2-5%，仅信用交易）',
      'Fair Trade 最低溢价：Fair Trade USA 规定除市场价格外另付 Development Premium（发展金，$0.10-$0.20/kg 用于社区项目）',
      'Non-GMO IP 检测阈值：PCR 方法检测 GMO 成分 < 0.9%（欧盟阈值）或 < 0.1%（严苛企业标准），需每批次检测',
      'Scope 3 排放核算：采购环节排放属于 Scope 3 Category 1（ purchased goods and services），是大多数食品企业最大的碳排放来源（占 70-90%）',
      '认证成本构成：认证费（一次性 $500-5000 不等）+ 年审费 + 交易证书费（每吨 $2-5）+ IP 管理溢价',
      '漂绿(Greenwashing)风险：确保宣称有认证背书支撑，避免模糊用语如"环保友好"而无具体认证依据',
    ],
    expectedOutcome: '可持续认证原料采购比例达到目标值（如 50%/80%/100%），通过第三方 ESG 评级（如 MSCI / Sustainalytics）达到行业领先水平',
    evidenceLevel: 'moderate',
    references: [
      { source: 'RSPO Principles and Criteria (P&C) 2018', year: 2018, relevance: 'primary' },
      { source: 'Fair Trade USA Certification Policy Manual', relevance: 'supporting' },
      { source: 'GRI Standards 2016 (Global Reporting Initiative)', year: 2016, relevance: 'supporting' },
    ],
    tags: ['可持续采购', 'RSPO', '公平贸易', '非转基因', 'ESG', '供应链责任'],
    difficulty: 'intermediate',
    timeEstimate: '8-16 周',
  },

  /* ===================================================================
   * Category 3: PROCESS_OPTIMIZATION 工艺优化 (BP-021 ~ BP-028)
   * =================================================================== */

  {
    id: 'BP-021',
    title: '喷雾干燥工艺的关键参数窗口——进风/出风温度/雾化压力的协同优化',
    category: 'PROCESS_OPTIMIZATION',
    intentTypes: ['PROCESS_TECHNOLOGY', 'PERFORMANCE_OPT'],
    scenario: '喷雾干燥是生产固体饮料、蛋白粉、香精微胶囊的核心工序，但参数设置不当易导致产品含水率偏高（> 5% 导致结块）、热敏性成分损失（益生菌/Vc 降解）、或挂壁/焦粉问题',
    solution: '建立基于产品特性的参数窗口设计方法：（1）进风温度（Tin）选择——热敏性产品（益生菌/酵素/VC）Tin = 140-160℃；一般产品（蛋白粉/植物提取物）Tin = 170-190℃；耐热产品（麦芽糊精载体）Tin = 190-220℃。原则：Tin 尽可能高以提高蒸发效率和产能，但不能超过产品的热降解起始温度（由 TGA/DSC 确定）。（2）出风温度（Tout）精确控制——Tout 直接决定产品含水率，目标 Tout = 产品玻璃化转变温度 Tg - 20℃（确保粉末处于玻璃态不易结块）。一般 Tout 控制在 80-95℃，对应含水率 2-4%。（3）雾化器参数——离心式雾化器转速 15000-25000 rpm（线速度 100-150 m/s），喷嘴孔径 0.7-2.0mm；压力式喷嘴压力 2-6 MPa。雾滴 Sauter 平均直径 D₃₂ 目标 20-80μm。（4）进料固形物浓度——越高越好（减少蒸发负荷），但受限于黏度泵送极限（一般 < 500 mPa·s），典型浓度 30-50% w/w。（5）塔内流场优化——热风分配器设计确保无短路流和死区，热风与雾滴并流接触时间 20-30s。',
    keyPoints: [
      '含水率-Tout 经验公式：Mc ≈ exp(-0.06×Tout + 8.5)（%wb，经验式，适用于多数食品体系）',
      '热敏成分保留策略：Tin 降低 + 进料中添加保护剂（海藻糖/麦芽糊精 Tg 提升）+ 塔底冷风淬灭',
      '挂壁原因诊断：进料速率过快（雾滴未干即碰壁）、Tin 过低（半干颗粒粘壁）、壁温不足（保温不良）',
      '焦粉预防：监控塔顶温度传感器，设置 Tin 上限报警（+5℃），定期清理塔壁和旋风分离器',
      '能耗基准：蒸发 1kg 水消耗蒸汽 3-4 kg（或燃气 0.03-0.05 Nm³），电耗 0.05-0.08 kWh',
      '收率目标：总收率（产品/进料固形物）≥ 95%，旋风分离效率 ≥ 99%，布袋除尘逃逸 < 0.1%',
    ],
    expectedOutcome: '产品含水率 2-4%（aw < 0.2），热敏成分保留率 > 90%，收率 ≥ 95%，单位能耗降低 10-15%',
    evidenceLevel: 'strong',
    references: [
      { source: 'Masters, Spray Drying Handbook, 5th Ed., 1991', year: 1991, relevance: 'primary' },
      { source: 'Westergaard, Spray Drying in Practice, 2010', year: 2010, relevance: 'primary' },
      { source: 'Jinapong et al., Journal of Food Engineering, 2008', year: 2008, relevance: 'supporting' },
    ],
    tags: ['喷雾干燥', '工艺参数', '热敏成分', '粉末工程', '干燥技术'],
    difficulty: 'intermediate',
    timeEstimate: '6-10 周',
  },

  {
    id: 'BP-022',
    title: '微胶囊化的壁材选择——阿拉伯胶/麦芽糊精/改性淀粉的性能对比与应用指南',
    category: 'PROCESS_OPTIMIZATION',
    intentTypes: ['PROCESS_TECHNOLOGY', 'FORMULA_DESIGN'],
    scenario: '需要对香精油、益生菌、维生素等敏感核心物质进行微胶囊化保护，面对阿拉伯胶、麦芽糊精、改性淀粉等多种壁材选项，需要科学的选择决策',
    solution: '建立壁材选择的决策矩阵，基于五大核心性能维度评分：（1）成膜性与包埋效率——阿拉伯胶（天然高分子，成膜优良，包埋率 85-95%）> 改性淀粉辛烯基琥珀酸铝淀粉（OSS，HI-CAP®，包埋率 90-97%）> 麦芽糊精（DE 10-20，需复配使用，单独包埋率 60-75%）。（2）玻璃化转变温度 Tg（决定储存稳定性）——麦芽糊精 DE 10（Tg ≈ 180℃）> OSS（Tg ≈ 120℃）> 阿拉伯胶（Tg ≈ 100℃）。Tg 越高越利于常温储存。（3）溶解性——麦芽糊精（冷水速溶）> OSS（良好溶解）> 阿拉伯胶（需搅拌，高浓时黏度高）。（4）乳化能力——OSS（两亲性改性，自带乳化功能）> 阿拉伯胶（天然乳化剂）> 麦芽糊精（无乳化性，需外加乳化剂）。（5）成本——麦芽糊精（8-15 元/kg）< 阿拉伯胶（25-40 元/kg）< OSS（35-60 元/kg）。推荐组合策略：麦芽糊精为主（60-70%）+ OSS 辅助（20-30%）+ 阿拉伯胶补充（10%），兼顾成本和性能。',
    keyPoints: [
      'DE 值与 Tg 关系：麦芽糊精 DE 每降低 5，Tg 约升高 20-30℃。DE 10 的 Tg ≈ 180℃，DE 20 的 Tg ≈ 120℃',
      'OSS 改性原理：辛烯基琥珀酸酐接枝引入疏水基团，赋予淀粉两亲性（HLB ≈ 8-12），可自乳化无需外加乳化剂',
      '芯材承载量：一般壁材:芯材 = 3:1 到 4:1（重量比），油溶性芯材承载量 10-25%，水溶性芯材可达 30-40%',
      '喷雾干燥微胶囊工艺：总固形物 30-45%，进风 180-200℃，出风 80-90℃，得到包埋率 > 90% 的微胶囊粉末',
      '释放机制设计：pH 敏感释放（肠溶壁材如 Eudragit）、温度敏感释放（脂肪酸壁材）、酶触发释放（壳聚糖/海藻酸钠）',
      '质量评价指标：表面油率（So，理想 < 1% 总油量）、包埋效率（EE = (总油-表面油)/总油 × 100%）、粒径分布（D₅₀ 10-100μm）',
    ],
    expectedOutcome: '微胶囊包埋效率 ≥ 90%，表面油率 < 1%，储存 6 个月（25℃）芯材保留率 > 85%',
    evidenceLevel: 'strong',
    references: [
      { source: 'Gharsallaoui et al., Food Reviews International, 2007 (Microencapsulation wall materials)', year: 2007, relevance: 'primary' },
      { source: 'Madene et al., International Journal of Food Science & Technology, 2006', year: 2006, relevance: 'supporting' },
      { source: 'Jafari et al., Drying Technology, 2008 (Spray drying microencapsulation)', year: 2008, relevance: 'supporting' },
    ],
    tags: ['微胶囊', '壁材选择', '阿拉伯胶', '麦芽糊精', '改性淀粉', '包埋技术'],
    difficulty: 'intermediate',
    timeEstimate: '6-10 周',
  },

  {
    id: 'BP-023',
    title: '冷冻干燥vs热风干燥的品质影响评估——基于热力学和动力学的决策模型',
    category: 'PROCESS_OPTIMIZATION',
    intentTypes: ['PROCESS_TECHNOLOGY', 'PERFORMANCE_OPT'],
    scenario: '产品可选择冷冻干燥（冻干）或热风干燥（烘箱/带式）作为脱水方式，两者在品质、成本、产能上差异巨大，需要建立科学的决策依据',
    solution: '从六个维度系统对比并建立决策树：（1）品质维度——冻干优势：多孔结构保留（复水性 > 95% vs 热风 60-80%）、热敏成分保留率 > 95%（vs 热风 50-80%）、挥发性香气保留（冰晶升华无液相流失）、色泽变化 ΔE < 3（vs 热风 ΔE 5-15）。热风优势：产生美拉德反应风味（某些产品需要）。（2）成本维度——冻干：设备投资 200-500 万（中型），运行成本 8-15 元/kg（水），能耗 2.5-4 kWh/kg（水）。热风：设备投资 20-80 万，运行成本 0.5-2 元/kg（水），能耗 0.8-1.5 kWh/kg（水）。冻干成本约为热风的 5-10 倍。（3）时间维度——冻干周期 18-36h（一次），热风 2-8h。冻干产能远低于热风。（4）产品形态适配——冻干最适合：块状/片状/整果（草莓/芒果/酸奶块）、高附加值产品（冻干粉/益生菌）。热风适合：粉末/颗粒/薄层物料（茶粉/调味料/蔬菜粒）。（5）决策规则——如果产品零售价 > 100 元/kg 且强调"天然/营养/高复水"→ 选冻干；如果产品零售价 < 30 元/kg 且量大→ 选热风；中间地带可考虑联合工艺（微波真空干燥/流化床干燥）。（6）创新方向——冻干粉技术（冻干后气流粉碎，兼具冻干品质和粉末便利性）。',
    keyPoints: [
      '冻干三阶段控制：预冻（-40℃ 2-4h，冰晶细小均匀）→ 一次干燥（真空 < 100Pa，隔板升温至-20~-30℃，除去自由水）→ 二次干燥（升温至 20-40℃，除去结合水至含水 < 3%）',
      '共晶点/塌陷温度测定：电阻法/差示扫描量热法(DSC)测定，干燥时物料温度必须低于塌陷温度 3-5℃ 否则结构崩塌',
      '热风干燥优化：分段控温（前期高温快速脱水→后期低温防焦化），热风风速 1-3 m/s，料层厚度 2-5cm',
      '复水性量化：冻干产品复水比（吸水后质量/干基质量）通常 5-8:1，热风产品 3-5:1，复水时间冻干 < 5min vs 热风 > 15min',
      '营养保留数据参考：VC 冻干保留 > 95%，热风 60-80%；多酚冻干保留 > 90%，热风 50-70%；花青素冻干 > 92%，热风 40-60%',
      '节能策略：冻干可利用冷凝器回收的热量预热新风（热回收效率 40-60%），降低净能耗 15-25%',
    ],
    expectedOutcome: '建立明确的干燥工艺选择决策卡，每种产品都有推荐的干燥方式和理由，品质与成本达到最优平衡',
    evidenceLevel: 'strong',
    references: [
      { source: 'Ratti, Journal of Food Engineering, 2001 (Freeze drying review)', year: 2001, relevance: 'primary' },
      { source: 'Oetjen & Haseley, Freeze-Drying, 3rd Ed., 2017', year: 2017, relevance: 'primary' },
      { source: 'GB/T 26767-2011 真空冷冻干燥技术 通则', relevance: 'supporting' },
    ],
    tags: ['冷冻干燥', '热风干燥', '干燥技术', '品质评估', '工艺选择'],
    difficulty: 'intermediate',
    timeEstimate: '4-8 周',
  },

  {
    id: 'BP-024',
    title: '超高压处理(HPP)对益生菌存活率的影响——压力-时间-温度三维优化空间',
    category: 'PROCESS_OPTIMIZATION',
    intentTypes: ['PROCESS_TECHNOLOGY', 'SAFETY_ASSESSMENT'],
    scenario: '冷榨果汁/鲜切果蔬/酱料等产品需要非热杀菌（保持新鲜口感和营养），同时产品中含有益生菌需要保护其在 HPP 处理过程中的存活',
    solution: '探索 HPP 处理窗口中益生菌存活的"安全岛"区域：（1）HPP 杀菌原理——300-600 MPa 压力破坏非共价键（氢键、疏水作用）导致微生物细胞膜/蛋白/遗传物质损伤死亡，但对共价键和小分子营养物质无影响。（2）益生菌耐压性差异——革兰氏阳性菌（乳酸菌/双歧杆菌）普遍比革兰氏阴性菌更耐压。具体排序：L. casei > L. rhamnosus > L. acidophilus > B. longum > B. infantis。芽孢形态极耐压（需 > 1000 MPa 方可有效杀灭）。（3）存活率优化策略——压力选择 400-500 MPa（在此范围内致病菌可杀灭 5-log 而益生菌存活 > 80%）；保压时间 3-8 min（时间越长杀菌越好但益生菌损失越大）；处理温度 4-25℃（低温有利于益生菌存活，但过低可能引起冰晶损伤）；介质 pH 4.0-6.0（偏酸性环境对益生菌有一定保护作用，可能是诱导了压力应激蛋白表达）。（4）保护剂辅助——添加海藻糖（5-10%）或脱脂奶粉（3-5%）作为 cryo-/piezo-protectant，可进一步提升存活率 10-20%。（5）验证方案——HPP 处理前后平板计数 CFU，目标存活率 > 70%（出厂活菌数需预留衰减余量）。',
    keyPoints: [
      'HPP 典型杀菌条件：400-600 MPa，3-10 min，4-25℃，可实现 vegetative cells 5-log 减少（符合 FDA Juice HACCP 要求）',
      '益生菌 HPP 存活规律：200 MPa 以下几乎无影响，400 MPa 存活率 60-90%，600 MPa 存活率 10-40%（因菌株而异）',
      '压力循环策略：间歇式加压（如 400 MPa × 3min → 泄压 → 再 400 MPa × 3min）比持续加压更有利于益生菌存活（允许细胞修复压力损伤）',
      '设备参数：HPP 设备处理舱容积 35-525L（商用规模），循环周期 3-8 min/批次，日处理能力 5-50 吨',
      '成本参考：HPP 代工费约 1.5-4.0 元/kg（取决于产品和处理参数），设备投资 300-2000 万',
      '法规地位：HPP 在中国/欧美/日本均被认可为非热加工技术，产品可标注"冷压/HPP处理"',
    ],
    expectedOutcome: '致病菌减少 ≥ 5-log，益生菌存活率 ≥ 70%，感官品质（色泽/风味/营养）保留率 > 95%',
    evidenceLevel: 'strong',
    references: [
      { source: 'Huang et al., Trends in Food Science & Technology, 2017 (HPP probiotics review)', year: 2017, relevance: 'primary' },
      { source: 'Patterson et al., Food Microbiology, 2022 (HPP mechanisms)', year: 2022, relevance: 'primary' },
      { source: 'FDA Juice HACCP, 21 CFR Part 120', relevance: 'supporting' },
    ],
    tags: ['HPP', '超高压', '非热杀菌', '益生菌', '冷压技术'],
    difficulty: 'advanced',
    timeEstimate: '8-14 周',
  },

  {
    id: 'BP-025',
    title: '酶解工艺的终点控制——DH值/分子量分布的在线监测与精确截断',
    category: 'PROCESS_OPTIMIZATION',
    intentTypes: ['PROCESS_TECHNOLOGY', 'INGREDIENT_ANALYSIS'],
    scenario: '蛋白酶水解制备胶原蛋白肽/大豆肽/乳清水解物过程中，水解度(DH)直接决定了肽的分子量分布、功能特性和苦味强度。DH 过低则功能活性不足，DH 过高则苦味剧增且成本浪费',
    solution: '建立"预测模型→在线监测→精确终止"的 DH 控制体系：（1）DH 目标设定——根据目标用途确定 DH 范围：胶原蛋白肽 DH 15-25%（MW 500-3000 Da，适合吸收和皮肤健康）；大豆肽 DH 8-15%（MW 1000-5000 Da，ACE 抑制活性最佳区）；乳清水解物 DH 3-8%（MW 3000-10000 Da，适合低敏配方）。（2）酶解动力学模型——基于 Michaelis-Menten 机制推导 DH(t) = DHmax × (1 - e^(-k·t))，其中 k 值受酶种类（Alcalase > 胰蛋白酶 > 胃蛋白酶）、底物浓度（S₀）、酶底比（E/S）、温度和 pH 影响。通过预实验拟合 k 值后可预测达到目标 DH 所需时间。（3）在线监测方法——pH-stat 法（最常用，精度 ±0.5% DH）：维持恒定 pH 自动记录碱消耗量换算 DH；OPA 法（荧光法，灵敏度更高）；三硝基苯磺酸 TNBS 法（离线校准用）。（4）精确终止手段——达到目标 DH 后立即升温至 85-95℃ 保持 10-15 min 使酶失活；或调节 pH 至酶的最不适 pH（±2 单位）；或添加 EDTA（金属蛋白酶抑制剂）。（5）后处理脱苦——若 DH 偏高导致苦味，可用活性炭吸附（0.5-2%，30min）或二次酶解（外切蛋白酶 Flavourzyme® 切除末端疏水氨基酸）。',
    keyPoints: [
      'DH 计算公式：DH (%) = h/h_tot × 100，其中 h 为已断裂的肽键数（mmol/g 蛋白），h_tot 为总肽键数（约 8 meq/g 蛋白）',
      'pH-stat 法原理：每断裂一个肽键释放一个羧基（-COOH），需消耗一个 OH⁻ 来维持 pH 恒定，碱消耗量正比于 DH',
      '苦味与 DH 关系：DH < 8% 苦味弱，8-15% 开始显现，> 20% 显著苦味（疏水性氨基酸暴露）',
      '常用蛋白酶特性：Alcalase（枯草杆菌蛋白酶，pH 8.5，55-60℃，DH 速度快）；Flavourzyme（内切+外切复合酶，脱苦专用）；木瓜蛋白酶（植物源，pH 6-7）',
      '分子量分布检测：GPC-SEC（凝胶渗透色谱）或 MALDI-TOF MS 精确测定 MW 分布，目标峰位应在预设范围内',
      '放大注意事项：实验室（mL 级）到生产（m³ 级）放大时传热/传质效率下降，酶解时间需延长 20-40%',
    ],
    expectedOutcome: 'DH 控制精度 ±1%，目标分子量分布占比 > 70%，苦味强度评分 ≤ 3（10 分标度），批次间 DH 变异 CV < 5%',
    evidenceLevel: 'strong',
    references: [
      { source: 'Nielsen et al., Journal of Food Science, 2001 (pH-stat method)', year: 2001, relevance: 'primary' },
      { source: 'Adler-Nissen, Process Biochemistry, 1976 (DH determination)', year: 1976, relevance: 'primary' },
      { source: 'Li et al., Journal of Functional Foods, 2023 (Peptide bitterness)', year: 2023, relevance: 'supporting' },
    ],
    tags: ['酶解工艺', 'DH控制', '生物活性肽', '分子量分布', '蛋白酶'],
    difficulty: 'advanced',
    timeEstimate: '8-12 周',
  },

  {
    id: 'BP-026',
    title: '纳米乳化的均质参数优化——压力/温度/passes 的交互效应与粒径控制',
    category: 'PROCESS_OPTIMIZATION',
    intentTypes: ['PROCESS_TECHNOLOGY', 'FORMULA_DESIGN'],
    scenario: '制备功能性纳米乳液（用于脂溶性功能因子递送或透明饮料体系），需要将液滴粒径稳定控制在 100-200nm 范围（PDI < 0.2），且放大后重现性良好',
    solution: '系统优化高压均质的三组核心参数及其交互效应：（1）均质压力——压力与粒径呈负相关但非线性：50 MPa → D ≈ 300nm；100 MPa → D ≈ 150nm；150 MPa → D ≈ 100nm（边际递减效应）。推荐工作压力 80-120 MPa（性价比最优区间）。（2）均质次数（passes）——第 1 次通过粒径急剧减小（破碎主导），第 2-3 次继续减小并窄化分布，> 3 次后效果不明显（过度均质反而可能导致重新聚合）。推荐 2-4 次。（3）温度控制——每次均质温升约 15-25℃（绝热压缩热），入口温度应控制在 10-25℃（冷却夹套），出口温度不超过 60-70℃（防止热敏成分降解和蛋白变性）。（4）预乳化质量——均质前的粗乳液质量至关重要：高剪切分散器（Ultra-Turrax）10000-20000 rpm 处理 5-10 min，使预乳液 D < 5μm 后再进入高压均质，可大幅减少均质次数。（5）配方协同——合适的乳化剂体系（HLB 与油相匹配）+ 助乳化剂（短链醇/PEG 衍生物）可将最低 achievable 粒径降低 30-50%。（6）稳定性验证——加速离心（3000-10000g × 30min）+ 储存观察（4/25/40℃ × 30d）+ 粒径回溯（DLS 监测 Ostwald 熟化）。',
    keyPoints: [
      '均质机类型选择：微射流均质器（Microfluidizer）粒径更均匀（固定几何通道），传统活塞式均质阀（APV/Gaulin）成本更低',
      '粒径-稳定性关系：PDI < 0.2 表示窄分布（单峰），> 0.3 表示宽分布（多峰/拖尾），PDI 越小越稳定',
      'Ostwald 熟化驱动力：Laplace 压力 ΔP = 2γ/r，小液滴溶解度大于大液泡导致物质从小液泡向大液泡转移（分子扩散），纳米乳尤甚',
      'Zeta 电位目标：|ζ| > 30 mV（静电稳定）或使用立体位阻稳定剂（嵌段共聚物/多糖）实现 |ζ| > 20 mV 也可稳定',
      '放大法则：保持相同能量输入密度 E_v = P/(Q×P_通道数)，而非简单保持相同压力，否则放大后粒径偏大',
      '在线粒度监测：配备在线 DLS 或聚焦光束反射测量(FBRM)探头，实时监控均质出料粒径实现闭环控制',
    ],
    expectedOutcome: '纳米乳 Z-average 粒径 100-200nm，PDI < 0.2，|Zeta| > 30mV，储存 3 个月（25℃）无相分离',
    evidenceLevel: 'strong',
    references: [
      { source: 'McClements, Nanoemulsions, Annual Review of Food Research, 2011', year: 2011, relevance: 'primary' },
      { source: 'Jafari et al., Trends in Food Science & Technology, 2008 (Nanoemulsion preparation)', year: 2008, relevance: 'primary' },
      { source: 'Gutiérrez et al., Food Hydrocolloids, 2008 (Homogenization optimization)', year: 2008, relevance: 'supporting' },
    ],
    tags: ['纳米乳化', '高压均质', '粒径控制', '递送系统', '乳液稳定性'],
    difficulty: 'advanced',
    timeEstimate: '10-16 周',
  },

  {
    id: 'BP-027',
    title: '挤压膨化过程中的营养素保留策略——热敏成分的温度-时间暴露最小化',
    category: 'PROCESS_OPTIMIZATION',
    intentTypes: ['PROCESS_TECHNOLOGY', 'FORMULA_DESIGN'],
    scenario: '挤压膨化广泛用于早餐谷物、植物基人造肉、休闲零食的生产，但高温（120-180℃）、高剪切（50-300 rpm 螺杆转速）和短停留时间（20-60s）的组合条件极易造成维生素、益生菌、天然色素和活性多酚的大量损失',
    solution: '从设备参数、配方设计和后处理三个层面构建营养素保护策略：（1）设备参数优化——降低套筒温度（在保证膨化度的前提下尽量降低最后两个温区的设定温度 10-20℃）；增加喂料速率（缩短物料在机筒内的停留时间 SME 降低）；采用低剪切螺杆构型（减少捏合块数量，增加输送元件比例）；套筒末端注水冷却（Water Injection，降低熔体温度 10-20℃）。（2）配方层面的保护——添加热稳定化保护剂：维生素C 用抗坏血酸磷酸酯镁（MAP）或抗坏血酸棕榈酸酯（AP）替代游离 VC（热稳定性提高 5-10 倍）；维生素 E 使用微胶囊化 VE（包埋于改性淀粉中）；益生菌采用微胶囊包埋（耐 100℃ 短时暴露）；天然色素使用花色苷-金属离子络合物（如 Al³⁺/Fe³⁺络合提高热稳定性 2-3 倍）。（3）后处理补充——挤压后喷涂（Post-extrusion spraying）将热敏成分以油相或水溶液喷涂于膨化产品表面，避免经受挤压热历程。喷涂量 1-5% 表面涂层。（4）营养保留量化——建立各营养素在挤压条件下的降解动力学模型（通常符合一级反应动力学 ln(C/C₀) = -kt），用于预测和控制最终保留率。',
    keyPoints: [
      'SME（比机械能）计算：SME (Wh/kg) = (电动机功率 - 空转功率) / 喂料速率，SME 越高剪切热越多，营养损失越大',
      '典型停留时间分布(RTD)：双螺杆挤压平均停留时间 20-60s，方差 σ² 取决于螺杆构型和喂料量',
      '维生素保留率基准（180℃/30s）：VA 50-70%, VB1 40-60%, VB2 70-85%, VC 10-30%, VE 60-80%（游离态）',
      '花色苷保护策略：共色素作用（添加黄酮醇/有机酸/金属离子形成复合物）可使热稳定性提高 2-5 倍',
      '喷涂设备：转鼓式涂布机（Drum coater）或流化床底喷涂布，喷涂均匀度 CV < 10%',
      '水分含量影响：低水分挤压（< 15%）熔体温度更高（150-190℃），营养损失更大；高水分挤压（> 20%）温度较低（100-140℃）更利于保留',
    ],
    expectedOutcome: '热敏营养素保留率从典型的 30-50% 提升至 70-85%，产品营养声称达标，感官品质不受负面影响',
    evidenceLevel: 'moderate',
    references: [
      { source: 'Guy, Extrusion Cooking, 2001', year: 2001, relevance: 'primary' },
      { source: 'Singh & Muthukumarappan, Critical Reviews in Food Science, 2014 (Nutrient retention)', year: 2014, relevance: 'primary' },
      { source: 'Camire et al., Comprehensive Reviews in Food Science, 2020 (Extrusion nutrition)', year: 2020, relevance: 'supporting' },
    ],
    tags: ['挤压膨化', '营养保留', '热敏成分', '挤压工艺', '早餐谷物'],
    difficulty: 'advanced',
    timeEstimate: '10-14 周',
  },

  {
    id: 'BP-028',
    title: '膜分离技术在原料纯化中的应用——超滤/纳滤/反渗透的集成工艺设计',
    category: 'PROCESS_OPTIMIZATION',
    intentTypes: ['PROCESS_TECHNOLOGY', 'INGREDIENT_ANALYSIS'],
    scenario: '需要从粗提物（如大豆蛋白水解液、果蔬汁、发酵液中）分离纯化目标成分（蛋白/肽/多酚/低聚糖），去除盐分、色素、大分子杂质，传统方法（树脂吸附/溶剂萃取）耗时长、收率低、溶剂残留',
    solution: '根据目标分子的分子量（MW）选择合适的膜分离技术和集成方案：（1）超滤 UF（MWCO 1-100 kDa）——用于大分子分级：去除大分子蛋白/多糖（截留）收集透过液的低分子量肽（MW < 5 kDa）或多酚（MW 0.2-1 kDa）。常用 MWCO：1 kDa（截留大部分肽）、3 kDa（分离寡肽）、5 kDa（去除大蛋白）、10 kDa（初步澄清）、30-100 kDa（除菌/澄清）。（2）纳滤 NF（MWCO 200-1000 Da）——用于小分子分离和浓缩：脱盐（一价离子透过，二价离子部分截留）、浓缩低聚糖和多酚（截留而水和小分子盐透过）、分子量切割（如分离单糖和二糖）。NF270（DOW）和 DK（GE）是常用的 NF 膜。（3）反渗透 RO（MWCO < 100 Da）——用于最终浓缩和脱水：将 NF 透过液或 UF 截留液浓缩至高固形物（30-50%），替代或部分替代蒸发浓缩，能耗仅为蒸发的 1/5-1/10。（4）集成工艺示例（大豆肽纯化）：预处理（离心/微滤除杂）→ UF 10kDa（去除未水解蛋白和大分子）→ UF 3kDa（收集 1-3 kDa 目标肽段）→ NF 300Da（脱盐浓缩）→ RO（浓缩至 30% 固形物）→ 喷雾干燥。（5）膜污染防控——错流过滤模式（CFV 3-6 m/s）、定期 CIP 清洗（碱洗→酸洗→消毒）、预处理降低浊度/SDI。',
    keyPoints: [
      '膜材质选择：PS/PES（聚砜/聚醚砌，pH 2-13 范围广，亲水性一般）> CA/CTA（醋酸纤维素，便宜但 pH 4-8）> PVDF（耐化学性强，疏水）> 陶瓷膜（TiO₂/ZrO₂，耐高温耐溶剂，昂贵）',
      '通量衰减规律：新膜初始通量 J₀ → 短期浓差极化（可逆，水力清洗恢复）→ 长期膜孔堵塞/滤饼层（需化学清洗）→ 不可逆老化（需换膜）',
      'CIP 清洗程序：① 温水（40-50℃）冲洗 15-30min → ② 碱洗（0.1-0.5% NaOH，pH 11-12，30-60min，去有机污染）→ ③ 酸洗（0.1-0.5% HNO₃ 或柠檬酸，pH 2-3，30min，去无机结垢）→ ④ 消毒（200ppm NaClO，15min）→ ⑤ 纯水冲洗至中性',
      '膜面积估算：Q = J × A × ΔP/μ，其中 J 为膜通量（L/m²·h），A 为膜面积（m²），ΔP 为跨膜压差（bar），μ 为黏度（Pa·s）',
      '截留率定义：R (%) = (1 - C_p/C_f) × 100，C_p 为透过液浓度，C_f 为进料浓度，目标 R > 95% 为良好截留',
      '经济性参考：膜分离运行成本 5-20 元/吨料液（主要为电耗+换膜摊销+清洗剂），相比离子交换树脂节省 30-60% 运行成本',
    ],
    expectedOutcome: '目标成分纯度从 50-70% 提升至 85-95%，收率 > 85%，溶剂使用量减少 > 90%，运行成本降低 30-50%',
    evidenceLevel: 'strong',
    references: [
      { source: 'Baker, Membrane Technology and Applications, 3rd Ed., 2012', year: 2012, relevance: 'primary' },
      { source: 'Suárez et al., Journal of Membrane Science, 2019 (Food membrane processing)', year: 2019, relevance: 'primary' },
      { source: 'Cassano et al., Innovative Food Science & Emerging Technologies, 2018 (Membrane food applications)', year: 2018, relevance: 'supporting' },
    ],
    tags: ['膜分离', '超滤', '纳滤', '反渗透', '纯化技术', '分离工程'],
    difficulty: 'advanced',
    timeEstimate: '10-16 周',
  },

  /* ===================================================================
   * Category 4: SAFETY_COMPLIANCE 安全合规 (BP-029 ~ BP-034)
   * =================================================================== */

  {
    id: 'BP-029',
    title: '保健食品注册的全流程时间线——从研发到拿证 12-18 个月的里程碑规划',
    category: 'SAFETY_COMPLIANCE',
    intentTypes: ['REGULATORY_COMPLIANCE', 'FORMULA_DESIGN'],
    scenario: '计划开发一款保健食品（蓝帽子产品），需要完成国家市场监督管理总局（原 CFDA/NMPA）的注册审批，整个流程复杂耗时，需要精确的项目管理和里程碑控制',
    solution: '按照 NMPA 注册法规要求拆解为 7 个关键阶段并制定时间规划：（1）配方研发与论证（月 1-3）——确定产品形态（胶囊/片剂/粉剂/口服液）、配方组成（符合 2760/14880 允许使用名单）、功能声称（必须在 27 种允许功能范围内）、文献检索支撑功效依据。（2）试生产与三批中试（月 3-5）——在符合 GMP 条件的车间完成连续三批中试生产（每批 ≥ 10 个缩放批次量），确立完整工艺规程和质量标准。（3）样品检测（月 5-7）——送省级及以上 CMA/CNAS 认可的检测机构进行全项检验：理化指标、卫生指标（菌落总数/霉菌酵母/大肠菌群/致病菌）、功效成分/标志性成分、稳定性（加速 3 月+长期 6-12 月起始）。（4）毒理学试验（月 4-9，可与上述并行）——GLP 实验室完成：急性经口毒性（1 月）→ 遗传毒性（Ames+微核+染色体畸变，2 月）→ 30 天喂养试验（1.5 月）→ 必要时补充 90 天喂养试验（3 月）。（5）功能学试验（月 6-12）——人体试食试验（双盲随机对照，受试者人数 60-180 人，试验周期 1-3 月不等，视功能类别而定）。（6）资料编制与申报（月 10-13）——按照《保健食品注册申请服务指南》整理全部申报资料（R1-R17 章节），通过 NMPA 保健食品注册管理系统提交。（7）技术审评与补充（月 13-18）——审评中心组织专家评审（常规 3-6 个月），发出补充通知（平均 1-2 轮补充），回复补充后获得注册批件。',
    keyPoints: [
      '27 种允许功能声称：增强免疫力、辅助降血脂、辅助降血糖、抗氧化、辅助改善记忆、缓解视疲劳、促进排铅、清咽、辅助降血压、改善睡眠、促进泌乳、缓解体力疲劳、提高缺氧耐受力、对辐射危害有辅助保护、减肥、改善生长发育、增加骨密度、改善营养性贫血、对化学性肝损伤有辅助保护、祛痤疮、祛黄褐斑、改善皮肤水分、改善皮肤油份、调节肠道菌群、促进消化、通便、对胃黏膜有辅助保护',
      '配方原料限制：只能使用《保健食品原料目录》中的原料（约 200 余种），超出目录需按新食品原料另行申报',
      '检测机构要求：必须具备 CMA（检验检测机构资质认定）和 CNAS（中国合格评定国家认可委员会）双认证',
      '人体试食伦理：必须通过医院/疾控中心的伦理委员会（IRB）审查批准，签署知情同意书，购买保险',
      '注册费用：国产保健食品注册费约 18.5 万元（含检测费约 8-15 万 + 审评费），进口产品费用翻倍',
      '续展要求：注册证书有效期 5 年，到期前 6 个月内申请延续注册，需提交近期生产和检验数据',
    ],
    expectedOutcome: '成功获得保健食品注册批准证书（国食健注G/J + 年份 + 批号），产品可合法销售并进行功能宣称',
    evidenceLevel: 'strong',
    references: [
      { source: '《保健食品注册与备案管理办法》（总局令第22号）', relevance: 'primary' },
      { source: '《保健食品原料目录（一）（二）》', relevance: 'primary' },
      { source: 'NMPA 保健食品注册申请服务指南（2023版）', year: 2023, relevance: 'primary' },
    ],
    tags: ['保健食品注册', '蓝帽子', 'NMPA', '法规合规', '功能声称'],
    difficulty: 'advanced',
    timeEstimate: '12-18 周（项目管理）',
  },

  {
    id: 'BP-030',
    title: 'ADI值计算与安全边际确定——基于毒理学数据的每日允许摄入量推演',
    category: 'SAFETY_COMPLIANCE',
    intentTypes: ['SAFETY_ASSESSMENT', 'REGULATORY_COMPLIANCE'],
    scenario: '新产品中使用了食品添加剂或新食品原料，需要科学确定安全使用量，确保在正常消费模式下不会对人体健康产生不良影响',
    solution: '按照国际公认的毒理学评估流程确定 ADI（Acceptable Daily Intake）和安全边际：（1）收集毒理学数据——优先采用权威机构的评估结果：JECFA（FAO/WHO 食品添加剂联合专家委员会）、EFSA（欧洲食品安全局）、US EPA IRIS 数据库、中国国家食品安全风险评估中心。关键数据点：NOAEL（未观察到有害作用的最高剂量）、LOAEL（观察到有害作用的最低剂量）、BMDL（基准剂量下置信限）。（2）ADI 计算——首选 NOAEL 法：ADI = NOAEL ÷ UF（不确定系数）。UF 通常取 100（种间差异 10 × 种内个体差异 10），如有儿童/孕妇等敏感人群或数据不完善可增至 100-1000。若只有 LOAEL 则额外增加 10 倍系数。（3）暴露量评估——确定 95th percentile 高端消费者的每日暴露量：EDI（Estimated Daily Intake）= 食品中浓度 × 每日消费量（来自全国膳食调查数据如 CHNS 或 WHO GEMS/Food）。（4）安全边际 MOS 计算：MOS = NOAEL ÷ EDI 或 ADI ÷ EDI × 100%。MOS > 100（即暴露量仅为 ADI 的 1% 以下）视为非常安全；MOS 10-100 为可接受；MOS < 10 需要警示或限制使用。（5）场景化分析——考虑最坏情况（最高含量 × 最高消费频率 × 体重最轻人群）确保极端情况下仍然安全。',
    keyPoints: [
      'NOAEL 来源优先级：长期（慢性）喂养试验（90天-2年）> 亚慢性（28-90天）> 急性毒性（LD₅₀），长期数据更具说服力',
      'UF 不确定系数细分：UF_A（种间外推，默认10）× UF_H（种内变异，默认10）× UF_S（研究的充分性，1-10）× UF_LODLOAEL（如用LOAEL则乘10）',
      'JECFA ADI 分类：ADI "not specified"（无毒理学担忧，按需使用）> ADI 数值（mg/kg bw）> ADI "not allocated"（数据不足以设定 ADI）> ADTL（临时每日耐受摄入量）',
      '暴露量计算示例：某添加剂在饮料中使用量 0.2g/kg，成人日均饮饮料 500ml（比重 1.04），体重 60kg → EDI = 0.2×0.52/60 = 1.73 mg/kg bw/day',
      '中国特定数据源：《中国居民营养与健康状况监测报告》提供各类食品的消费量 P50/P95 数据',
      '儿童安全考量：儿童体重轻但相对食物摄入量高（按体重计），需单独计算儿童 EDI 并确保 MOS > 100',
    ],
    expectedOutcome: '建立完整的毒理学安全评估档案，所有添加剂和新原料的 ADI/MOS 计算有据可查，可应对监管审查',
    evidenceLevel: 'strong',
    references: [
      { source: 'JECFA Monographs (FAO/WHO)', relevance: 'primary' },
      { source: 'WHO Food Additives Series (FAS), No. 72 (latest)', relevance: 'primary' },
      { source: 'GB 15193系列 食品安全性毒理学评价程序和方法', relevance: 'primary' },
    ],
    tags: ['ADI', '毒理学评估', '安全边际', 'NOAEL', '食品安全'],
    difficulty: 'advanced',
    timeEstimate: '4-8 周',
  },

  {
    id: 'BP-031',
    title: '重金属限量的源头控制方案——从土壤到成品的全程管控体系',
    category: 'SAFETY_COMPLIANCE',
    intentTypes: ['SAFETY_ASSESSMENT', 'INGREDIENT_ANALYSIS'],
    scenario: '食品中重金属（铅/砷/汞/镉）超标是抽检不合格的首要原因之一（约占不合格案例的 30%），需要从源头种植/养殖、原料采购、生产过程到成品检测的全链条管控',
    solution: '实施"源头筛查→过程阻隔→终端验证"三级防控体系：（1）源头控制——对植物性原料：要求供应商提供产地土壤/灌溉水重金属检测报告（GB 15618-2018 土壤环境质量 农用地土壤污染风险管控标准，镉 ≤ 0.3 mg/kg pH≤7.5，铅 ≤ 70 mg/kg 等）；优先选择绿色/有机认证基地；避免工业污染周边区域采购。对动物性原料：饲料重金属含量需符合 GB 13078 饲料卫生标准；水产原料关注水域环境质量。（2）原料进厂把关——每批必检 Pb/As/Hg/Cd 四项重金属（ICP-MS 法，检出限 ppb 级），设置内控标准严于国标 30-50%（如国标 Pb ≤ 0.5 mg/kg，内控 ≤ 0.3 mg/kg）。建立供应商重金属历史数据 SPC 图，发现上升趋势及时预警。（3）过程阻隔——避免使用可能引入重金属的加工助剂（某些活性炭/催化剂可能含重金属）；设备材质符合食品级（不锈钢 304/316，避免镀锌/铜管路接触食品）；水质需达 GB 5749 生活饮用水标准（Pb ≤ 0.01 mg/L, As ≤ 0.01 mg/L）。（4）终端验证——成品每批次按 GB 5009 系列（GB 5009.12 铅/GB 5009.11 砷/GB 5009.17 汞/GB 5009.15 镉）检测，ICP-MS 方法定量限满足标准 1/5 以下。（5）特别关注——大米/稻米原料重点监控 Cd（镉大米问题）；海产品重点监控无机 As（区别于总 As）；鱼类重点监控 MeHg（甲基汞）。',
    keyPoints: [
      'GB 2762-2022 食品中污染物限量：规定了 160+ 种（类）食品中 Pb/As/Hg/Cd/Sn/Cr/Ni/F 等污染物的限量值，是最核心的合规依据',
      '植物富集系数差异：水稻 Cd 富集系数极高（BCF 可达 100-1000），叶菜类 Pb/As 吸附能力强，根茎类受土壤直接影响',
      'ICP-MS 检测优势：多元素同时分析（一次进样可测 70+ 元素），检出限 0.01-1 μg/kg，线性范围 5-6 个数量级',
      '内控标准设定原则：国标限值 × (0.5-0.7)，给检测误差和生产波动留足安全余量',
      '高风险原料清单：稻米/大米（Cd）、茶叶（Pb）、海带/紫菜（无机As）、鱼贝类（MeHg）、内脏类（Cd/Pb）',
      '修复措施：若原料重金属超标但未进入生产环节，退运或无害化处理（高温焚烧/化学固化）；若已制成成品，严禁流入市场，按规定销毁',
    ],
    expectedOutcome: '重金属抽检合格率 100%，内控超标拦截率 100%（不合格原料不入厂），客户/监管零投诉',
    evidenceLevel: 'strong',
    references: [
      { source: 'GB 2762-2022 食品中污染物限量', relevance: 'primary' },
      { source: 'GB 15618-2018 土壤环境质量 农用地土壤污染风险管控标准', relevance: 'supporting' },
      { source: 'Codex Stan 193-1995 Codex General Standard for Contaminants', year: 1995, relevance: 'background' },
    ],
    tags: ['重金属', '污染物控制', '源头管理', '食品安全', 'GB 2762'],
    difficulty: 'intermediate',
    timeEstimate: '6-10 周',
  },

  {
    id: 'BP-032',
    title: '微生物指标的 CCP 设置——菌落总数/霉菌酵母/致病菌的关键限值与监控',
    category: 'SAFETY_COMPLIANCE',
    intentTypes: ['SAFETY_ASSESSMENT', 'QUALITY_ASSURANCE'],
    scenario: '产品微生物指标不稳定，偶有菌落总数或霉菌酵母超标，需要建立基于 HACCP 原理的微生物关键控制点（CCP）体系和有效的监控纠偏措施',
    solution: '按照 HACCP 原理建立微生物 CCP 管理体系：（1）危害分析——识别微生物危害来源：原料带入（原料菌落总数高）、环境污染（空气中沉降菌/人员手部/设备表面）、工艺失控（杀菌温度/时间不足）、包装破损（密封不严导致二次污染）、储运不当（冷链断裂）。（2）CCP 确立——CCP-1：原料验收（菌落总数 ≤ n×10³ CFU/g，霉菌酵母 ≤ n×10² CFU/g，n 因原料而异）；CCP-2：热处理步骤（杀菌温度/时间达到设定值，如巴氏杀菌 85℃/15s 或 UHT 135℃/5s）；CCP-3：环境监控（沉降菌/表面涂抹 CFU/皿·时间符合 GMP 要求）；CCP-4：密封完整性（密封参数+密封性测试）。（3）关键限值(CL)设定——基于产品标准和法规：GB 7101 饮料要求菌落总数 n=5 c=10 m=10² M=10⁴ CFU/mL；霉菌酵母 n=5 c=10 m=10 M=10² CFU/mL；致病菌（沙门氏菌/金黄色葡萄球菌等）0/25g。内控标准应比国标严格 1 个 log（如国标 10⁴ 则内控 10³）。（4）监控频率——CCP-1 每批原料检测；CCP-2 连续自动记录温度/时间（数据记录仪每分钟记录一次）；CCP-3 每周环境监测；CCP-4 每班首件+巡检。（5）纠偏行动——任何 CCP 超出 CL 立即：隔离受影响产品→原因分析→评估风险→处置（返工/降级/销毁）→ 采取预防措施防止复发。',
    keyPoints: [
      '微生物检测方法标准：GB 4789.2 菌落总数（平皿计数法）、GB 4789.3 大肠菌群（MPN/平板法）、GB 4789.4 沙门氏菌、GB 4789.10 金黄色葡萄球菌、GB 4789.15 霉菌酵母计数',
      '杀菌 F 值概念：F 值 = t × 10^((T-Tref)/z)，121℃ 下 z=10℃ 对于嗜热芽孢，商业无菌要求 F₀ > 3 min',
      '环境监控分区：Zone 1（直接接触产品区域，最严格）> Zone 2（紧邻区域）> Zone 3（间接区域）> Zone 4（一般区域）',
      '快速检测方法补充：ATP 荧光法（秒级出结果，用于卫生监控）、流式细胞术（快速菌落计数）、PCR（致病菌快速筛查 2-4h）',
      '指示微生物概念：大肠杆菌/大肠菌群作为粪便污染指示菌，肠球菌作为卫生质量指示菌',
      '趋势预警：连续 3 批菌落总数呈上升趋势（即使未超标）也应触发调查，这是 HACCP 原理的操作限值(OL)概念',
    ],
    expectedOutcome: '微生物抽检合格率 100%，CCP 监控记录完整率 100%，微生物客诉率为零',
    evidenceLevel: 'strong',
    references: [
      { source: 'GB 12694-2016 肉类加工厂卫生规范（HACCP 示例）', relevance: 'supporting' },
      { source: 'GB 4789系列 食品安全国家标准 食品微生物学检验', relevance: 'primary' },
      { source: 'CAC/RCP 1-1969 Rev. 4-2003 HACCP System and Guidelines', year: 2003, relevance: 'primary' },
    ],
    tags: ['微生物控制', 'HACCP', 'CCP', '菌落总数', '致病菌', '食品安全'],
    difficulty: 'intermediate',
    timeEstimate: '6-10 周',
  },

  {
    id: 'BP-033',
    title: '标签声称的合规性审查清单——营养/功能/成分三类声称的法律边界',
    category: 'SAFETY_COMPLIANCE',
    intentTypes: ['REGULATORY_COMPLIANCE', 'MARKET_POSITIONING'],
    scenario: '产品包装和宣传材料中需要进行各种声称（营养成分含量声称/功能声称/成分声称），稍有不慎就可能违反《广告法》《食品安全法》《反不正当竞争法》面临巨额罚款',
    solution: '建立三类声称的合规审查 checklist 并逐项核对：（1）营养成分含量声称（GB 28050-2011）——"高""低""无""含有""富含""来源"等声称必须满足对应的含量阈值（如"高蛋白"固体 ≥ 20g/100g、"低糖"液体 ≤ 5g/100mL、"无糖" ≤ 0.5g/100g）。声称用语必须出现在营养标签的醒目位置。营养素参考值(NRV%)计算正确。（2）功能声称——保健食品（蓝帽子）可进行 27 种特定功能声称；普通食品不得进行疾病预防/治疗功能声称（绝对红线！）；普通食品可以进行的声称限于：营养素功能声称（如"钙有助于骨骼和牙齿的健康"——必须使用 GB 28050 附录 D 规范用语一字不改）、成分描述性声称（如"含有胶原蛋白肽"——不能暗示功效）。（3）成分/品质声称——"天然""纯净""有机""手工制作"等声称需有实质依据（如有机需有机认证证书）；避免使用最高级用语（"最好""第一""顶级"违反广告法第九条）；避免医疗用语（"治疗""治愈""处方""疗效"绝对禁止）。（4）禁忌词汇库——建立动态更新的违禁词库（参考《广告法》第九条/第十一条、《食品安全法》第七十三条），包含但不限于：治疗/治愈/抗癌/降糖/降压/祖传/秘方/纯天然/100%有效/根治/神效/第一/唯一/顶级等。（5）审查流程——法务/合规部门初审 → 标签设计终审 → 第三方合规机构复核（可选）→ 备案存档。',
    keyPoints: [
      'GB 28050 含量声称速查："无/零"（痕量/不含）：脂肪 ≤ 0.5g/100g，胆固醇 ≤ 5mg/100g，钠 ≤ 5mg/100g；"低"：低糖 ≤ 5g/100mL，低脂 ≤ 3g/100g；"高/富含"：高蛋白 ≥ 20g/100g（固体），高钙 ≥ 30%NRV/100g',
      '广告法红线（第九条）：不得使用"国家级""最高级""最佳"等用语；不得涉及疾病预防/治疗功能；不得虚假/引人误解',
      '《食品安全法》第七十三条：食品广告的内容应当真实合法，不得含有虚假内容，不得涉及疾病预防、治疗功能',
      '普通食品 vs 保健食品界限：没有蓝帽子就是普通食品，不能有任何功能暗示，连"增强体质""提高免疫力"都不行（除非有蓝帽子）',
      '跨境电商注意：跨境电商销售的境外食品标签可适当宽松但仍需有中文标签，且不能违反中国广告法基本规定',
      '处罚力度参考：违法广告罚款 20-100 万元（广告法）；违法宣称功能罚款 5-10 万元（食品安全法）；情节严重吊销许可证',
    ],
    expectedOutcome: '标签/宣传材料合规审查通过率 100%，监管抽查/职业打假人挑战零败诉，品牌声誉风险降至最低',
    evidenceLevel: 'strong',
    references: [
      { source: 'GB 28050-2011 预包装食品营养标签通则', relevance: 'primary' },
      { source: '《中华人民共和国广告法》（2021修正）', relevance: 'primary' },
      { source: '《中华人民共和国食品安全法》（2021修正）', relevance: 'primary' },
      { source: 'GB 7718-2011 预包装食品标签通则', relevance: 'primary' },
    ],
    tags: ['标签合规', '声称审查', '广告法', 'GB 28050', '食品安全法', '合规风险'],
    difficulty: 'intermediate',
    timeEstimate: '3-6 周',
  },

  {
    id: 'BP-034',
    title: '国际市场准入的多国认证策略——FDA/EFSA/HALAL/KOSHER/MUI 同步推进路线图',
    category: 'SAFETY_COMPLIANCE',
    intentTypes: ['REGULATORY_COMPLIANCE', 'MARKET_POSITIONING'],
    scenario: '产品计划出口至多个国际市场（东南亚/中东/北美/欧盟），各国/地区的食品法规体系差异巨大，需要系统性地规划和执行多国认证/注册',
    solution: '按照"市场优先级排序→法规差距分析→认证路径规划→同步并行推进"的策略实施：（1）市场优先级排序——基于市场规模、增长潜力、准入难度、竞争格局四个维度评分排序。通常推荐路径：东盟（easiest，中国-东盟自贸协定）→ 中东（Halal 认证需求大）→ 北美（FDA FSMA 体系）→ 欧盟（最严格的 EFSA/RASFF 体系）→ 日韩（厚生劳动省/食品药品安全部）→ 澳新（FSANZ）。（2）法规差距分析——针对每个目标市场制作合规差距表：产品配方 vs 目标国正面清单（允许使用的原料/添加剂）、标签格式 vs 当地语言/格式要求、生产设施 vs 当地 GMP 等同性认可、检测方法 vs 当地承认的标准方法。（3）核心认证清单——FDA FSVP（美国外国供应商验证程序）/ FSMA（食品安全现代化法案）；EFSA 通用食品 law (EC) No 178/2002 + 特定产品法规；Halal 认证（MUI 印尼/ JAKIM 马来西亚/ ESMA 阿联酋）；Kosher 认证（OU/OK/Kof-K）；Organic 认证（USDA/ EU/ JAS 各自成体系）。（4）同步推进策略——将认证所需的共同要素（HACCP 体系文件、产品规格书、检测报告、标签设计）标准化为一套基础文档集，然后针对各认证的特殊要求派生出定制版本。利用"一次检测多方采信"策略（如 CNAS/ILAC-MRA 互认实验室报告被多国接受）。（5）当地代理商/顾问——在每个目标市场聘请当地法规顾问或经销商协助处理本土化事务（标签翻译/本地注册代表/应对检查）。',
    keyPoints: [
      'FDA FSMA 要求：国外食品企业需指定美国代理人(US Agent)并完成 FSVP 供应商验证计划，预防性控制需符合 21 CFR Part 117',
      '欧盟 EC 178/2002 要求：食品可追溯性（一步向前一步向后）、食品企业注册（RASSF 系统）、食品接触材料合规（EU 10/2011）',
      'Halal 认证核心：无猪肉/猪衍生成分、无酒精、屠宰符合伊斯兰仪式（仅限动物源原料）、生产线无交叉污染',
      'Kosher 认证核心：犹太饮食法规（分离乳/肉/鱼、特定允许/禁止动物、犹太节日规则）、 Rabbi 现场审核',
      '标签本地化：每个市场要求不同——美国 NFT（Nutrition Facts Panel）格式、欧盟营养宣言（kJ/kcal + 100g/100ml）、印尼 Halal 标志位置强制',
      '互认协议利用：中国-新西兰/中国-瑞士/中国-韩国等双边互认协议可简化部分认证程序，节省 30-50% 时间',
    ],
    expectedOutcome: '目标市场认证覆盖率 100%，产品合规进入各目标市场销售，无因合规问题导致的边境拒收或下架事件',
    evidenceLevel: 'moderate',
    references: [
      { source: '21 CFR Part 117 (FDA FSMA Preventive Controls)', relevance: 'primary' },
      { source: '(EC) No 178/2002 (EU General Food Law)', relevance: 'primary' },
      { source: 'Codex Alimentarius (CAC/GL 24-1997 General Guidelines for Use of the Term "Halal")', relevance: 'supporting' },
    ],
    tags: ['国际认证', 'FDA', 'EFSA', 'Halal', 'Kosher', '市场准入', '出口合规'],
    difficulty: 'advanced',
    timeEstimate: '16-32 周',
  },

  /* ===================================================================
   * Category 5: SENSORY_QUALITY 感官品质 (BP-035 ~ BP-040)
   * =================================================================== */

  {
    id: 'BP-035',
    title: '描述性分析(DA)团队培训与一致性校准——专业感官评价员的选拔与维护',
    category: 'SENSORY_QUALITY',
    intentTypes: ['PERFORMANCE_OPT', 'FORMULA_DESIGN'],
    scenario: '需要建立企业内部的感官评价团队进行产品的描述性分析（Descriptive Analysis），用于新品开发、竞品分析和质量控制，但团队成员的评价能力和一致性问题突出',
    solution: '按照 ISO 6564 和 ASTM E1958 标准建立专业的 DA 团队：（1）评价员招募与初筛——招募 20-30 名候选人，通过以下测试初筛：基本味觉辨别（甜/酸/咸/苦/鲜 5 种基本味的 3 级浓度梯度识别准确率 > 80%）；嗅觉辨识（40 种标准嗅辨物中正确识别 > 70%）；排序能力（强度排序与参考标准的一致性相关系数 r > 0.7）；个人偏好剔除（避免对特定品类有极端偏好/厌恶者）。（2）系统培训（10-15 次，每次 1.5-2h）——培训内容包括：方法论讲解（DA 原理/评分标度使用/术语开发流程）；产品认知（品类背景知识/竞品品尝）；术语开发（引导团队生成描述性术语并通过 consensus 圆桌讨论达成一致）；参比样建立（为每个术语建立物理参比标准 Reference Standard）；强度校准（使用参比样训练评价员对强度的打分一致性）。（3）团队维护——定期再培训（每月 1 次校准会议）；轮换更新（每年淘汰表现最差的 10-20%，补充新人）；绩效监控（每位评价员的数据质量指标：区分能力 Discrimination、重复性 Reproducibility、一致性 Agreement）。（4）测试环境——ISO 8589 标准感官实验室：独立测试间（booth）、中性色调（白色/浅灰色）、恒温恒湿（21±1℃/50-60% RH）、无异味照明（日光灯 6500K 色温）。（5）数据分析——使用 ANOVA（方差分析）+ PCA（主成分分析）+ HCA（聚类分析）挖掘 DA 数据。',
    keyPoints: [
      '评价员人数：DA 分析最少 10-12 人（经过培训的 panel），偏好测试 80-150 人（消费者），差别检验 25-60 人（半 trained panel）',
      '标度选择：15-cm 非结构化线性标度（Universal Scale）最常用，两端锚定词为"weak/none"到"strong/extreme"',
      '术语开发流程：个人生成（自由 elicitation）→ 小组讨论（consensus round）→ 领导者整理 → 再次讨论 → 最终术语表（通常 10-25 个描述词）',
      '参比样管理：每个术语至少有一个物理参比样（Reference Standard），注明配制方法和保存期限，存放在感官实验室参比样库',
      '数据质量指标：Discrimination Ability > 0.6；Reproducibility r > 0.8；Agreement ICC > 0.7',
      'ISO 标准引用：ISO 13299:2016 / ISO 8586:2012 / ISO 8589:2007',
    ],
    expectedOutcome: '建立 10-15 人的稳定 DA 团队，术语表覆盖目标品类 15-25 个描述属性，团队 ICC 一致性系数 > 0.75',
    evidenceLevel: 'strong',
    references: [
      { source: 'ISO 13299:2016 Sensory analysis — Methodology — General guidelines', relevance: 'primary' },
      { source: 'ASTM E1958 Standard Guide for Sensory Claim Substantiation', relevance: 'supporting' },
      { source: 'Lawless & Heymann, Sensory Evaluation of Food, 5th Ed., 2010', year: 2010, relevance: 'primary' },
    ],
    tags: ['感官评价', '描述性分析', '评价员培训', '感官实验室', 'ISO 8589'],
    difficulty: 'intermediate',
    timeEstimate: '8-12 周',
  },

  {
    id: 'BP-036',
    title: '苦味/异味掩蔽的技术方案——多机制协同的风味修饰策略',
    category: 'SENSORY_QUALITY',
    intentTypes: ['FORMULA_DESIGN', 'PERFORMANCE_OPT'],
    scenario: '产品存在明显苦味、涩味、草本异味或化学异味，严重影响消费者接受度',
    solution: '建立"阻断-遮盖-中和-分散"四位一体的风味修饰体系：（1）苦味受体阻断——添加腺苷酸（AMP/GMP，0.01-0.05%）竞争性结合 T2R 受体；添加磷脂（卵磷脂 0.2-0.5%）形成包合物。（2）甜味遮蔽——高强度甜味剂提供强甜信号压制苦味；β-环糊精 0.5-2% 包埋挥发性异味；乙基麦芽酚 5-20ppm 增强甜香感。（3）口感中和——酸味调节 pH 至 3.5-4.5；鲜味增强（酵母抽提物/I+G 0.1-0.3%）；醇厚感增加（丙二醇/甘油 1-3%）。（4）物理分散——微胶囊化延缓释放；纳米乳化降低有效浓度；活性炭吸附。（5）量化评价——建立苦味强度标准曲线，掩蔽前后对比降低幅度目标 > 50%。',
    keyPoints: [
      '苦味主要来源：生物碱/多酚/肽/人工甜味剂后味/矿物盐',
      'β-环糊精包埋原理：疏水空腔包合疏水性苦味分子（MW < 1000 Da）',
      '甜-苦抑制比：甜味强度达到苦味的 3-5 倍时产生显著抑制',
      '常见误区：仅靠加大甜味剂往往导致后味更苦，需选后味干净的甜味剂',
      '成本权衡：风味掩蔽增加原料成本 5-15%，但可显著提升接受度和复购率',
    ],
    expectedOutcome: '苦味/异味强度降低 ≥ 50%（DA 评分），消费者接受度提升 ≥ 1.0 分（9 分标度）',
    evidenceLevel: 'moderate',
    references: [
      { source: 'Keast, Nutrients, 2021 (Bitter taste modulation)', year: 2021, relevance: 'primary' },
      { source: 'Belitz et al., Food Chemistry, 4th Ed., 2009', year: 2009, relevance: 'supporting' },
    ],
    tags: ['苦味掩蔽', '异味修饰', '风味调节', '感官优化'],
    difficulty: 'intermediate',
    timeEstimate: '6-10 周',
  },

  {
    id: 'BP-037',
    title: '质构剖面分析(TPA)的目标值设定——基于仪器测试与感官关联的质构标准',
    category: 'SENSORY_QUALITY',
    intentTypes: ['PERFORMANCE_OPT', 'FORMULA_DESIGN'],
    scenario: '产品质地不稳定或与竞品差距明显，需要建立基于 TPA 的客观量化标准',
    solution: '建立"仪器 TPA 测试→感官关联建模→目标值设定→QC 控制"体系：（1）TPA 方法标准化——TA.XT plus 质构仪，双次压缩模式，探头 P/36R 或 P/5，压缩比 50%，速度 1.0 mm/s。提取 Hardness/Cohesiveness/Springiness/Gumminess/Chewiness/Resilience。（2）感官-仪器相关性——DA 团队感官评价与仪器数据 Pearson 相关分析，Hardness/Chewiness r=0.7-0.9，Springiness r=0.5-0.7。（3）目标值设定——竞品 TPA 参数 + 消费者 JAR 偏好 + 内部能力三者交集。（4）QC 控制线——20-30 批数据 X̄±3σ 控制限。',
    keyPoints: [
      'TPA 关键变量：探头形状/压缩比/测试速度均影响结果',
      '样品条件：尺寸统一/温度标准化（20±2℃）/回温 30min',
      'PLSR 建模优于简单线性相关，可处理多重共线性',
      'JAR 分析以中位数为目标值，Mean Drop > 1.0 需改进',
      '质构缺陷诊断：过硬→增水降交联/过软→增胶体增蛋白/易碎→增黏合剂',
    ],
    expectedOutcome: 'TPA 各参数 CV < 10%，质地投诉率降低 50%',
    evidenceLevel: 'moderate',
    references: [
      { source: 'Bourne, Food Texture and Viscity, 2nd Ed., 2002', year: 2002, relevance: 'primary' },
      { source: 'Szczesniak, Journal of Food Science, 1963 (Original TPA)', year: 1963, relevance: 'background' },
    ],
    tags: ['质构分析', 'TPA', '质地标准', '感官关联'],
    difficulty: 'intermediate',
    timeEstimate: '6-10 周',
  },

  {
    id: 'BP-038',
    title: '色泽稳定性的抗氧化策略——天然色素的护色与防褐变技术',
    category: 'SENSORY_QUALITY',
    intentTypes: ['PERFORMANCE_OPT', 'FORMULA_DESIGN'],
    scenario: '产品储存中出现褪色、褐变或异常变色问题',
    solution: '针对不同色素类型的分层防护策略：（1）花色苷防护——pH 2.5-4.0 + 金属离子络合 + 共色素作用 + 避光包装。（2）叶绿素防护——铜代反应 + pH 中性偏碱 + 低温避光。（3）类胡萝卜素防护——抗氧化体系(VC+VE) + 微胶囊化 + 避光包装。（4）美拉德褐变抑制——控制还原糖/氨基酸浓度 + 亚硫酸盐（允许品类）。（5）酶促褐变控制——PPO 热烫失活 + 抗坏血酸还原 + 柠檬酸协同。',
    keyPoints: [
      'ΔE 判定：< 1.5 不可察觉 / 1.5-3.0 可察觉 / 3.0-6.0 明显 / > 6.0 不可接受',
      '花色苷四态互变：flavylium cation(红,pH<2) ↔ quinoidal base(紫,pH4-5) ↔ carbinol base(无色,pH5-6) ↔ chalcone(黄褐,pH>7)',
      '护色剂法规限制：优先选用天然方案',
      '包装 OTR 要求：含油脂/色素产品 < 1 cc/m²·day·atm',
      '分光测色仪 L*a*b* 空间建立色彩标准数据库',
    ],
    expectedOutcome: '货架期 ΔE < 3.0，色泽均匀度 CV < 5%',
    evidenceLevel: 'strong',
    references: [
      { source: 'Castañeda-Ovando et al., Food Chemistry, 2009', year: 2009, relevance: 'primary' },
      { source: 'GB 2760-2024 食品添加剂使用标准', relevance: 'supporting' },
    ],
    tags: ['色泽稳定', '护色', '天然色素', '抗氧化', '褐变控制'],
    difficulty: 'intermediate',
    timeEstimate: '6-10 周',
  },

  {
    id: 'BP-039',
    title: '消费者偏好测试的设计与数据分析',
    category: 'SENSORY_QUALITY',
    intentTypes: ['MARKET_POSITIONING', 'PERFORMANCE_OPT'],
    scenario: '新产品上市前需评估市场接受度和偏好方向',
    solution: '建立科学的消费者测试全流程：（1）研究设计——明确目的，选择方法（9点 Hedonic/JAR/成对比较/排序），确定受试者招募标准。（2）样本量计算——均值比较每组 n=60-100，比例检验 n=300-500。（3）测试执行——CLT vs HUT，随机盲评设计。（4）数据分析——ANOVA/Tukey HSD、Preference Mapping、Penalty Analysis。（5）结果解读——统计显著性转化为商业意义。',
    keyPoints: [
      'Hedonic 9点标度 ≥ 6 分为可接受阈值',
      'JAR Penalty：Mean Drop > 1.0 必须改进，0.5-1.0 中等，< 0.5 可容忍',
      'Preference Mapping 找出驱动喜好的关键感官属性',
      'Cluster Analysis 发现潜在不同偏好群体',
      '遵循 ISO 20202:2019 受试者通用要求',
    ],
    expectedOutcome: '获得统计显著性(p<0.05)和市场代表性的偏好洞察',
    evidenceLevel: 'strong',
    references: [
      { source: 'ISO 11136:2014 Sensory analysis methodology', relevance: 'primary' },
      { source: 'Lawless & Heymann, Sensory Evaluation of Food, 5th Ed., 2010', year: 2010, relevance: 'primary' },
    ],
    tags: ['消费者测试', '偏好分析', '感官统计', '市场研究'],
    difficulty: 'intermediate',
    timeEstimate: '4-8 周',
  },

  {
    id: 'BP-040',
    title: '加速货架期测试(ASLT)的方法选择与数据处理',
    category: 'SENSORY_QUALITY',
    intentTypes: ['QUALITY_ASSURANCE', 'FORMULA_DESIGN'],
    scenario: '需要通过加速试验快速预测产品货架期',
    solution: '按照 Q10 法则和 Arrhenius 方程建立 ASLT 体系：（1）条件设置——3-4 个温度点（25℃对照+37℃/45℃/55℃加速），Q10=2-4。（2）CQA 选择——微生物/化学/物理/感官指标，选 2-3 个最敏感的。（3）数据采集——高温每 3-7 天采样，至 CQA 达 rejection limit。（4）模型拟合——Arrhenius 方程 ln(k)=ln(A)-Ea/(RT)，外推 25℃ k₂₅ 计算预测货架期。（5）验证——取预测值 70-80% 作为保守声称值。',
    keyPoints: [
      'Arrhenius 前提：反应机理在加速和常温下不变且无相变',
      'Rejection limit 设定：微生物超国标/感官 DA<4.0/营养保留率<80%',
      '零级(C=C₀-kt) vs 一级(ln(C/C₀)=-kt)动力学判断',
      'Shelf life 由最先达到 limit 的退化机制决定',
      'R² > 0.90 的模型方可用于 shelf life prediction',
    ],
    expectedOutcome: 'R² > 0.90 的可靠预测模型，误差 < ±15%',
    evidenceLevel: 'strong',
    references: [
      { source: 'Labuza, Shelf-Life Dating of Foods, 1982', year: 1982, relevance: 'primary' },
      { source: 'GB/T 29605-2013 感官分析 食品感官质量控制规范', relevance: 'supporting' },
    ],
    tags: ['货架期', 'ASLT', 'Arrhenius', '保质期预测'],
    difficulty: 'advanced',
    timeEstimate: '8-16 周',
  },

  /* ===================================================================
   * Category 6: COST_EFFICIENCY 成本效益 (BP-041 ~ BP-045)
   * =================================================================== */

  {
    id: 'BP-041',
    title: '配方成本的 BOM 结构分析与优化',
    category: 'COST_EFFICIENCY',
    intentTypes: ['COST_REDUCTION', 'FORMULA_DESIGN'],
    scenario: '产品毛利率低于预期，需要系统性的成本分析和优化',
    solution: '建立 BOM 全成本分析框架：（1）直接材料成本核算——单价×配方百分比×安全系数。（2）间接成本分配——制造费用/包装/质检/仓储物流。（3）ABC 分类——A 类（占品种 10-20%/成本 70-80%）重点优化。（4）优化路径——原料替换/配比 DoE 优化/得率提升/规模效应/工艺简化。（5）月度成本追踪仪表盘。',
    keyPoints: [
      'BOM 成本占比：直接材料 50-70%、包装 10-20%、制造费用 8-15%、质检物流 5-10%',
      'A 类原料集中资源优化（通常 2-3 种占总成本 50%+）',
      'DoE 可将某些成分用量降低 15-20%',
      '得率改善 4% 即节省等量原料成本',
      'Target Costing：从市场价格倒推目标 BOM 成本',
    ],
    expectedOutcome: 'BOM 成本降低 10-20%（不影响核心品质）',
    evidenceLevel: 'moderate',
    references: [
      { source: 'Ellram, Journal of Supply Chain Management, 1995 (TCO)', year: 1995, relevance: 'primary' },
    ],
    tags: ['成本分析', 'BOM', '配方优化', '降本增效'],
    difficulty: 'intermediate',
    timeEstimate: '4-8 周',
  },

  {
    id: 'BP-042',
    title: '规模经济效应的临界产量计算',
    category: 'COST_EFFICIENCY',
    intentTypes: ['COST_REDUCTION', 'PROCESS_TECHNOLOGY'],
    scenario: '新建或扩产决策面临产能规模的选择',
    solution: '建立规模经济分析模型：（1）成本分解 FC/VC，UC = FC/Q + VC。（2）BEP = FC/(P-VC_per_unit)。（3）规模经济曲线绘制找到 MES（最小有效规模）。（4）产能柔性考量预留 15-25% 富余。（5）NPV/IRR 投资回报分析。',
    keyPoints: [
      '学习曲线：累计产量翻番单位成本下降 10-30%',
      '世界级 OEE > 85%，食品行业平均 60-75%',
      '自制临界点：自制单位成本 > 外包单价×(1+风险溢价)时选外包',
      '自动化在标准化大批量环节效果最佳',
    ],
    expectedOutcome: '确定最优产能规模，达产后单位成本降低 15-30%',
    evidenceLevel: 'moderate',
    references: [
      { source: 'Stevenson, Operations Management, 14th Ed., 2021', year: 2021, relevance: 'primary' },
    ],
    tags: ['规模经济', '产能规划', '盈亏平衡'],
    difficulty: 'intermediate',
    timeEstimate: '4-6 周',
  },

  {
    id: 'BP-043',
    title: '库存周转率与原料保质期的平衡',
    category: 'COST_EFFICIENCY',
    intentTypes: ['COST_REDUCTION', 'INGREDIENT_ANALYSIS'],
    scenario: '原料库存过多占用资金且有过期风险，过少有断供风险',
    solution: 'EOQ 与动态安全库存综合优化：（1）库存成本 = 持有成本(H)+订货成本(S)+缺货成本。（2）EOQ = √(2DS/H)。（3）安全库存 SS = Z×σ_d×√(L+T)。（4）FIFO 严格执行+效期预警。（5）分类管理 A/B/D 级策略。',
    keyPoints: [
      '优秀周转率 12-24 次/年，行业平均 6-12 次',
      '益生菌粉建议库存不超过 2 周用量',
      '呆滞库存 > 6 月未动用，应控制在 < 2%',
      'WMS+ERP 实现自动补货和效期预警',
    ],
    expectedOutcome: '库存周转率提升 30-50%，呆滞率 < 2%',
    evidenceLevel: 'moderate',
    references: [
      { source: 'Chopra & Meindl, Supply Chain Management, 6th Ed.', year: 2016, relevance: 'primary' },
    ],
    tags: ['库存管理', '周转率', 'EOQ', 'JIT'],
    difficulty: 'intermediate',
    timeEstimate: '4-8 周',
  },

  {
    id: 'BP-044',
    title: 'OEM vs 自建工厂的决策模型',
    category: 'COST_EFFICIENCY',
    intentTypes: ['COST_REDUCTION', 'PROCESS_TECHNOLOGY'],
    scenario: '业务扩张面临 OEM 代工还是自建工厂的决策',
    solution: 'TCO 全生命周期成本对比模型：（1）OEM：零 CAPEX 启动快但单位成本高。（2）自建：长期成本低但 CAPEX 高固定成本重。（3）5 年 TCO 对比。（4）战略维度评估（技术保密/定制化/产能确定性/品牌定位）。（5）混合模式："核心自建+长尾 OEM"。',
    keyPoints: [
      '食品 OEM 加工费参考：固体饮料 8-20 元/kg、软胶囊 0.08-0.20 元/粒',
      '中型工厂 CAPEX 约 2400-5100 万',
      '盈亏平衡产量通常需达设计产能 40-60%',
      '"先轻后重"模式：先 OEM 试水再建厂',
    ],
    expectedOutcome: '基于数据和战略的最优制造决策',
    evidenceLevel: 'moderate',
    references: [
      { source: 'Fine & Whitney, CMR, 2002 (Make-or-buy revisited)', year: 2002, relevance: 'primary' },
    ],
    tags: ['OEM', '自建工厂', 'TCO', '制造决策'],
    difficulty: 'advanced',
    timeEstimate: '6-12 周',
  },

  {
    id: 'BP-045',
    title: '包装材料的成本性能权衡',
    category: 'COST_EFFICIENCY',
    intentTypes: ['COST_REDUCTION', 'FORMULA_DESIGN'],
    scenario: '包装成本过高或需要升级环保包装',
    solution: '多目标优化决策框架：（1）性能需求清单（OTR/WVTR/强度/密封性/安全性）。（2）材料选项库及性能-成本数据库。（3）复合材料设计和 Pareto 分析。（4）环保升级路径（减量/替换/结构改变/LCA）。',
    keyPoints: [
      '健康包装成本占比：大众 8-15%、中高端 15-25%',
      'Down-gauging 可减薄 20-30% 保持同等强度',
      '瓶装改袋装可节省 50-70% 包装材料',
      '帕累托最优解位于 cost-performance 左上边界',
    ],
    expectedOutcome: '包装成本降低 10-25%，碳足迹减少 20-40%',
    evidenceLevel: 'moderate',
    references: [
      { source: 'Robertson, Food Packaging, 3rd Ed., 2013', year: 2013, relevance: 'primary' },
      { source: 'GB 4806系列 食品接触材料标准', relevance: 'primary' },
    ],
    tags: ['包装材料', '成本优化', '可持续包装'],
    difficulty: 'intermediate',
    timeEstimate: '4-8 周',
  },

  /* ===================================================================
   * Category 7: MARKET_INNOVATION 市场创新 (BP-046 ~ BP-049)
   * =================================================================== */

  {
    id: 'BP-046',
    title: '清洁标签趋势下的配方重构机会',
    category: 'MARKET_INNOVATION',
    intentTypes: ['MARKET_POSITIONING', 'FORMULA_DESIGN'],
    scenario: '清洁标签需求日益强烈，现有产品需改造',
    solution: '五步法实施配方清洁化重构：（1）全面审计标注清洁度 A/B/C/D 级。（2）优先级排序（关注度/替代可行性/成本/法规）。（3）系统性替代路线图。（4）感官三角验证+稳定性确认。（5）宣称策略。',
    keyPoints: [
      '清洁标签演变：无人工成分 → 配料简短可识别 → 可持续透明真实',
      '最难替代三大类：防腐剂/色素/乳化剂',
      '58% 全球消费者表示清洁标签影响购买决策',
      '渐进式改造：V1.0 去 D 级 → V2.0 优 BC 级 → V3.0 全面清洁化',
    ],
    expectedOutcome: '清洁度评级提升 1-2 级，销量影响 ±10% 以内',
    evidenceLevel: 'moderate',
    references: [
      { source: 'Innova Market Insights, Top 10 Trends 2024', year: 2024, relevance: 'primary' },
    ],
    tags: ['清洁标签', '配方重构', '天然替代'],
    difficulty: 'intermediate',
    timeEstimate: '8-16 周',
  },

  {
    id: 'BP-047',
    title: '个性化营养的产品形态探索',
    category: 'MARKET_INNOVATION',
    intentTypes: ['MARKET_POSITIONING', 'FORMULA_DESIGN'],
    scenario: '探索从标准产品向个性化解决方案转型',
    solution: '三种递进模式：（1）问卷分群定制（入门级）匹配预定义族群。（2）生物标志物精准定制（中级）检测血液/粪便/唾液标志物 AI 推荐配方。（3）基因组高级定制（前沿级）SNP 数据调整配方。产品形态：3D 打印/智能胶囊机/模块化营养包。',
    keyPoints: [
      '全球个性化营养市场预计 2030 年 640 亿美元（CAGR ~22%）',
      '技术成熟度：问卷 TRL9 > 生物标志物 TRL7-8 > 基因组 TRL5-6',
      '核心挑战：规模化小批量多品种与成本控制的矛盾',
      '严格遵守《个人信息保护法》和《人类遗传资源管理条例》',
    ],
    expectedOutcome: '建立 MVP 完成首批用户体验闭环',
    evidenceLevel: 'emerging',
    references: [
      { source: 'Zeevi et al., Cell, 2015 (Microbiome-based PN)', year: 2015, relevance: 'primary' },
    ],
    tags: ['个性化营养', '精准营养', '基因营养'],
    difficulty: 'advanced',
    timeEstimate: '16-32 周',
  },

  {
    id: 'BP-048',
    title: '功能性零食化的品类创新案例',
    category: 'MARKET_INNOVATION',
    intentTypes: ['MARKET_POSITIONING', 'FORMULA_DESIGN'],
    scenario: '将功能性成分融入零食载体提升依从性',
    solution: '品类嫁接矩阵 + 关键技术挑战解决：（1）载体选择：软糖/巧克力/坚果棒/膨化/冻干/RTD/烘焙。（2）成功案例分析：维生素软糖/Omega-3 巧克力/蛋白薯片。（3）热敏成分保护（后喷涂/微囊/冷加工）。（4）高剂量功能成分口感影响管理。（5）普通食品身份合规宣称。',
    keyPoints: [
      '全球功能性零食市场 2023 约 850 亿美元，CAGR ~8.5%',
      '软糖维生素：明胶/果胶基质 aw 0.55-0.65 防止粘牙霉变',
      '每份功能含量建议日摄入量 15-50%/份',
      'Z 世代是核心消费群体',
    ],
    expectedOutcome: '推出 2-3 SKU 复购率 > 25%',
    evidenceLevel: 'moderate',
    references: [
      { source: 'Grand View Research, Functional Snacks Market, 2024', year: 2024, relevance: 'primary' },
    ],
    tags: ['功能性零食', '品类创新', '软糖维生素'],
    difficulty: 'intermediate',
    timeEstimate: '10-18 周',
  },

  {
    id: 'BP-049',
    title: '数字化配方的敏捷开发流程——8 周冲刺模式',
    category: 'MARKET_INNOVATION',
    intentTypes: ['MARKET_POSITIONING', 'FORMULA_DESIGN'],
    scenario: '传统研发周期 3-6 个月无法跟上市场变化',
    solution: '数字孪生配方 + 快速迭代验证的 8 周冲刺：（1）W1-2 概念验证 AI 推荐候选配方虚拟仿真筛选。（2）W3-4 小试制备 DoE 优化快速感官筛查。（3）W5-6 中试放大参数窗口验证加速稳定性预筛。（4）W7 消费者 CLT 验证并行准备法规文件。（5）W8 Go/No-Go Gate Review 跨职能决策。',
    keyPoints: [
      '传统 16 周 → 敏捷 8 周（缩短 50-70%）',
      'DoE RSM 用 13-17 次实验替代 OFAT 数百次',
      '在线感官平台 72h 完成 150+ 消费者数据',
      'Fail Fast 原则：W3-4 发现致命缺陷立即终止转向',
    ],
    expectedOutcome: '开发周期缩短 50%+，新品 First-Year 成功率 30%→50%+',
    evidenceLevel: 'emerging',
    references: [
      { source: 'Cooper, Winning at New Products, 5th Ed., 2017', year: 2017, relevance: 'primary' },
    ],
    tags: ['敏捷开发', '数字化配方', 'Time-to-Market'],
    difficulty: 'advanced',
    timeEstimate: '8-12 周',
  },

  /* ===================================================================
   * Category 8: QUALITY_ASSURANCE 质量保证 (BP-050 ~ BP-054)
   * =================================================================== */

  {
    id: 'BP-050',
    title: 'ISO 22000 + FSSC 22000 双认证实施路线图',
    category: 'QUALITY_ASSURANCE',
    intentTypes: ['SAFETY_ASSESSMENT', 'REGULATORY_COMPLIANCE'],
    scenario: '计划建立国际认可的食品安全管理体系并获得认证',
    solution: '12 个月 PDCA 循环实施路线图：（1）M1-2 准备与 Gap Analysis 成立 FST/管理层承诺/差距报告。（2）M3-5 体系文件编制 FSM/程序文件/SOP/WI/记录表单。（3）M6-8 试运行培训全员/试运行 3 月+/内审。（4）M9-10 管理评审 Pre-audit。（5）M11-12 正式审核 Stage1 文件+Stage2 现场/NC 整改获证。',
    keyPoints: [
      'FSSC 22000 = ISO 22000 + ISO/TS 22002-1 + FSSC Additional Requirements',
      'GFSI 认可意味着全球广泛承认（沃尔玛/雀辣等接受）',
      '中小企业全套咨询+认证约 15-40 万元',
      'HACCP 计划必备：CCP≥1、危害分析工作表、监控/纠偏/验证记录',
    ],
    expectedOutcome: '顺利通过审核获得 3 年有效期证书',
    evidenceLevel: 'strong',
    references: [
      { source: 'ISO 22000:2018', relevance: 'primary' },
      { source: 'FSSC 22000 V5.1, 2023', year: 2023, relevance: 'primary' },
    ],
    tags: ['ISO 22000', 'FSSC 22000', '食品安全体系', 'HACCP'],
    difficulty: 'advanced',
    timeEstimate: '10-14 月',
  },

  {
    id: 'BP-051',
    title: '追溯系统的二维码技术应用',
    category: 'QUALITY_ASSURANCE',
    intentTypes: ['QUALITY_ASSURANCE', 'INGREDIENT_ANALYSIS'],
    scenario: '建立全链条数字化溯源系统',
    solution: '"一物一码"全链路追溯：（1）GS1 编码 GTIN/Batch/Serial/Expiry。（2）数据采集节点原料/生产/检验/仓储/物流。（3）IT 架构 DB+API+前端+赋码系统。（4）消费者扫码体验基本信息→详情→举报入口。（5）区块链存证（高信任场景）。（6）对接 GB/Z 38949-2020。',
    keyPoints: [
      'GS1 GTIN-13（13位）/GTIN-14（含包装级别）',
      'QR Code Model 2 容错率 7-30%',
      '高速喷墨成本 0.001-0.01 元/个',
      '追溯深度 Step back ≥ 3 / Step forward ≥ 3',
      '中小型系统建设约 10-50 万元',
    ],
    expectedOutcome: '100% 产品赋码，正向追踪 100%，反向追溯 > 95%',
    evidenceLevel: 'strong',
    references: [
      { source: 'GB/Z 38949-2020 食品追溯 通用规范', relevance: 'primary' },
      { source: 'ISO 22005:2007 Traceability', relevance: 'primary' },
    ],
    tags: ['追溯系统', '二维码', 'GS1', '溯源'],
    difficulty: 'intermediate',
    timeEstimate: '8-16 周',
  },

  {
    id: 'BP-052',
    title: '实验室检测能力建设（内部 vs 外部委托）',
    category: 'QUALITY_ASSURANCE',
    intentTypes: ['QUALITY_ASSURANCE', 'SAFETY_ASSESSMENT'],
    scenario: '决策哪些检测项目自建、哪些外委',
    solution: '四级分类决策矩阵：L1 高频实时（水分/aw/pH 等）强烈建议自建；L2 中频日常（常规微生物/主含量）建议自建；L3 低频定期（重金属/农残等）可自可委；L4 偶发特殊（毒理学/功能学等）必须外委。混合模式：自建 L1+L2（投资 50-150 万）+ L3 按需外委 + L4 全外委。',
    keyPoints: [
      'CMA 强制/CNAS 自愿国际互认，出口企业需 CNAS',
      '参加 PT 能力验证每年至少 1 次/主要参数',
      'ALCOA+ 数据完整性原则',
      '外部实验室必须 CMA+CNAS 双认可',
    ],
    expectedOutcome: '检测周期缩短 30-50%，年度成本优化 15-25%',
    evidenceLevel: 'strong',
    references: [
      { source: 'GB/T 27025-2019 (ISO/IEC 17025)', relevance: 'primary' },
      { source: 'RB/T 214-2017 检验检测机构资质认定', relevance: 'primary' },
    ],
    tags: ['实验室建设', 'CMA/CNAS', 'LIMS'],
    difficulty: 'intermediate',
    timeEstimate: '8-16 周',
  },

  {
    id: 'BP-053',
    title: '变更管理的文档控制体系',
    category: 'QUALITY_ASSURANCE',
    intentTypes: ['QUALITY_ASSURANCE', 'SAFETY_ASSESSMENT'],
    scenario: '预防未经评估的变更引发质量事故',
    solution: '完整 MOC 体系：（1）变更分类 Major/Minor/Emergency。（2）CCR 流程发起→CCB 评估→批准→执行→验证→关闭。（3）风险评估 FMEA/Hazard Analysis/Regulatory Check。（4）文件同步更新 5 工作日内完成。（5）Master Change Log 季度回顾。（6）生效前再培训。',
    keyPoints: [
      '核心理念：No document no change / No approval no change',
      '临时变更最大违规模式：先用着回头补手续',
      'CAPA 与客诉/内审发现紧密关联',
      '电子化 QMS 系统 TrackWise/Veeva/MasterControl',
    ],
    expectedOutcome: '变更受控率 100%，变更引起偏差 < 5%/年',
    evidenceLevel: 'strong',
    references: [
      { source: 'ICH Q10 Change Control', relevance: 'primary' },
      { source: 'GB/T 19001-2016 8.5.6 变更控制', relevance: 'primary' },
    ],
    tags: ['变更管理', '文档控制', 'MOC', 'CAPA'],
    difficulty: 'intermediate',
    timeEstimate: '6-10 周',
  },

  {
    id: 'BP-054',
    title: '客诉处理与 CAPA 闭环流程',
    category: 'QUALITY_ASSURANCE',
    intentTypes: ['QUALITY_ASSURANCE', 'MARKET_POSITIONING'],
    scenario: '将客诉转化为系统性改进的质量提升引擎',
    solution: '完整闭环体系：（1）客诉分级 Critical/Major/Minor + 24h 首次响应。（2）根因分析 5Why/鱼骨图/FTA 追溯 Root Cause。（3）CAPA 制定 Corrective + Preventive SMART 措施。（4）执行跟踪 QA tracking 逾期升级。（5）有效性验证观察 3 个月确认不复发。（6）Lessons Learned 知识库沉淀。（7）Pareto/趋势/成本分析。',
    keyPoints: [
      '响应黄金法则 Speed + Empathy + Solution + Follow-up',
      'Critical 客诉 24h 结案 Major 72h Minor 7d',
      '必须追溯到 Root Cause 而非 Direct Cause',
      '客诉成本 = 直接(赔偿/召回) + 间接(品牌损失)',
      'NPS 追踪客诉处理后客户忠诚度变化',
    ],
    expectedOutcome: '客诉关闭率 100%，同类复发率下降 > 50%，NPS 提升 > 5 点',
    evidenceLevel: 'strong',
    references: [
      { source: 'ISO 10002:2018 Customer satisfaction - Guidelines for complaints handling', relevance: 'primary' },
      { source: '8D Problem Solving Methodology (Ford/AIAG)', relevance: 'supporting' },
    ],
    tags: ['客诉处理', 'CAPA', '闭环管理', '质量改进'],
    difficulty: 'intermediate',
    timeEstimate: '6-10 周',
  },
]

/* ===================================================================
 * 工具函数
 * =================================================================== */

/**
 * 根据意图类型检索最佳实践
 *
 * @param intent - 目标意图类型
 * @returns 匹配该意图的所有最佳实践列表
 */
export function getBestPracticesByIntent(intent: IntentType): BestPractice[] {
  return BEST_PRACTICES.filter(bp => bp.intentTypes.includes(intent))
}

/**
 * 根据分类检索最佳实践
 *
 * @param category - 目标分类
 * @returns 该分类下的所有最佳实践列表
 */
export function getBestPracticesByCategory(category: BestPracticeCategory): BestPractice[] {
  return BEST_PRACTICES.filter(bp => bp.category === category)
}

/**
 * 根据标签模糊搜索最佳实践
 *
 * 支持中文标签的关键词模糊匹配（大小写不敏感）
 *
 * @param query - 搜索关键词
 * @returns 标签或标题包含关键词的最佳实践列表
 */
export function searchBestPractices(query: string): BestPractice[] {
  const lowerQuery = query.toLowerCase()
  return BEST_PRACTICES.filter(
    bp =>
      bp.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      bp.title.toLowerCase().includes(lowerQuery) ||
      bp.scenario.toLowerCase().includes(lowerQuery) ||
      bp.category.toLowerCase().includes(lowerQuery) ||
      bp.id.toLowerCase().includes(lowerQuery),
  )
}

/**
 * 根据 ID 获取单条最佳实践
 *
 * @param id - 最佳实践 ID（格式 BP-XXX）
 * @returns 匹配的最佳实践对象，未找到时返回 undefined
 */
export function getBestPracticeById(id: string): BestPractice | undefined {
  return BEST_PRACTICES.find(bp => bp.id === id)
}

/**
 * 获取所有最佳实践（只读数组）
 *
 * @returns 所有最佳实践的只读引用
 */
export function getAllBestPractices(): readonly BestPractice[] {
  return BEST_PRACTICES
}

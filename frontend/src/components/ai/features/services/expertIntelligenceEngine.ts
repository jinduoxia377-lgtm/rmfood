/**
 * Expert Intelligence Engine V3.0 — 专家级智能提示词引擎
 *
 * 核心创新：
 * 🧠 ContextAwareEngine — 深度上下文感知，从用户输入中提取结构化信息
 * 🎯 ProSuggestionGenerator — 多维度专业建议生成，每条建议都与输入强关联
 * ⚡ IntelligentPromptBuilder — 智能Prompt组装，将上下文分析结果注入AI请求
 * 🔬 QualityGate — 质量门控，过滤空泛/通用的低质量建议
 *
 * @version 3.0.0 Professional Edition
 * @lastUpdated 2026-05-30
 */

import { logger } from '@/utils/safeLogger'
import type { SmartSuggestion } from '../../types'

// ===== 上下文分析结果 =====
export interface ParsedContext {
  productType: string | null
  functionGoals: string[]
  constraints: string[]
  technicalParams: { param: string; value: string; unit?: string }[]
  targetUsers: string[]
  regulatoryContext: string | null
  processStage: string | null
  ingredientMentions: string[]
  confidence: number
  rawInput: string
}

// ===== 专业维度定义 =====
export interface SuggestionDimension {
  id: string
  label: string
  icon: string
  description: string
  relevanceWeight: number
}

export const PROFESSIONAL_DIMENSIONS: SuggestionDimension[] = [
  { id: 'tech_deep', label: '技术深化', icon: '🔬', description: '深入技术细节和机理', relevanceWeight: 1.0 },
  { id: 'regulatory', label: '法规合规', icon: '⚖️', description: '法规标准和合规要求', relevanceWeight: 0.95 },
  { id: 'process', label: '工艺优化', icon: '⚙️', description: '生产工艺和参数优化', relevanceWeight: 0.9 },
  { id: 'ingredient', label: '原料策略', icon: '🧪', description: '原料选择和复配方案', relevanceWeight: 0.9 },
  { id: 'efficacy', label: '功效验证', icon: '📊', description: '功效评价和实验设计', relevanceWeight: 0.85 },
  { id: 'cost_value', label: '成本价值', icon: '💰', description: '成本结构和价值分析', relevanceWeight: 0.8 },
  { id: 'market_diff', label: '市场差异', icon: '🎯', description: '市场定位和差异化', relevanceWeight: 0.75 },
  { id: 'risk_alert', label: '风险预警', icon: '⚠️', description: '潜在风险和注意事项', relevanceWeight: 0.85 },
]

// ===== 产品形态库 =====
const PRODUCT_TYPES: Record<string, RegExp> = {
  '固体饮料': /固体饮料|粉剂|速溶粉|冲剂|代餐粉/g,
  '口服液': /口服液|饮品|饮料|精华液|浓缩液/g,
  '片剂': /片剂|压片糖果|咀嚼片|含片|泡腾片/g,
  '胶囊': /胶囊|软胶囊|硬胶囊|凝胶糖果/g,
  '功能性食品': /功能性食品|特膳食品|保健食品|特殊医学用途/g,
  '普通食品': /普通食品|休闲食品|零食|糕点/g,
  '化妆品': /化妆品|护肤品|面膜|精华/g,
  '宠物食品': /宠物食品|猫粮|狗粮|宠物营养/g,
}

// ===== 功能目标库 =====
const FUNCTION_GOALS: { pattern: RegExp; goal: string; category: string }[] = [
  { pattern: /降三高|降血糖|降血脂|降血压|血糖|血脂|血压/g, goal: '代谢调节(三高)', category: 'health' },
  { pattern: /免疫|增强抵抗|提升免疫|免疫力/g, goal: '免疫调节', category: 'health' },
  { pattern: /肠道|益生菌|益生元|消化|便秘|腹泻/g, goal: '肠道健康', category: 'health' },
  { pattern: /睡眠|安神|助眠|改善睡眠|失眠/g, goal: '睡眠改善', category: 'health' },
  { pattern: /美容|抗氧化|抗衰老|美白|胶原蛋白|皮肤/g, goal: '美容抗衰', category: 'beauty' },
  { pattern: /减肥|减脂|体重|瘦身|体脂|BMI/g, goal: '体重管理', category: 'body' },
  { pattern: /骨骼|钙|关节|骨质疏松|骨密度/g, goal: '骨骼健康', category: 'health' },
  { pattern: /视力|眼睛|护眼|近视|蓝光/g, goal: '视力保护', category: 'health' },
  { pattern: /认知|记忆|脑力|专注|学习|老年痴呆/g, goal: '认知功能', category: 'brain' },
  { pattern: /运动|增肌|耐力|体能|恢复|蛋白/g, goal: '运动营养', category: 'sports' },
  { pattern: /男性|前列腺|精力|睾酮|补肾/g, goal: '男性健康', category: 'specific' },
  { pattern: /女性|经期|更年期|雌激素|孕/g, goal: '女性健康', category: 'specific' },
  { pattern: /儿童|成长|发育|身高|智力|视力.*儿童/g, goal: '儿童成长', category: 'specific' },
  { pattern: /老年|银发|延缓衰老|长寿|肌少症/g, goal: '老年康养', category: 'specific' },
]

// ===== 技术参数提取模式 =====
const TECH_PARAM_PATTERNS: { pattern: RegExp; extractParam: (match: RegExpMatchArray) => { param: string; value: string; unit?: string } }[] = [
  {
    pattern: /(\d+(?:\.\d+)?)\s*(%|mg\/g|mg\/mL|g\/kg|CFU\/g|IU\/g|Da|kDa)/gi,
    extractParam: (m) => ({ param: '浓度/含量', value: m[1], unit: m[2] }),
  },
  {
    pattern: /(\d+(?:\.\d+)?)\s*℃/g,
    extractParam: (m) => ({ param: '温度', value: m[1], unit: '℃' }),
  },
  {
    pattern: /(pH|pH值)\s*[~∶:＝=]\s*(\d+(?:\.\d+)?)/gi,
    extractParam: (m) => ({ param: 'pH值', value: m[2] }),
  },
  {
    pattern: /(\d+(?:\.\d+)?)\s*(min|h|小时|分钟|秒)/gi,
    extractParam: (m) => ({ param: '时间', value: m[1], unit: m[2] }),
  },
  {
    pattern: /(IC50|EC50|IC90)\s*[~∶:＝=]\s*(\d+(?:\.\d+)?)(\s*\w+)?/gi,
    extractParam: (m) => ({ param: m[1], value: m[2], unit: m[3]?.trim() }),
  },
  {
    pattern: /(MW|分子量)\s*[<>=≤≥～~]\s*(\d+)\s*(Da|kDa)?/gi,
    extractParam: (m) => ({ param: '分子量', value: m[2], unit: m[3] || 'Da' }),
  },
  {
    pattern: /(GB\s*\/?\s*\d+|GB\/T\s*\d+|ISO\s*\d+)/gi,
    extractParam: (m) => ({ param: '标准引用', value: m[1].trim() }),
  },
]

// ===== 目标人群模式 =====
const TARGET_USER_PATTERNS: { pattern: RegExp; user: string }[] = [
  { pattern: /Z世代|00后|95后|年轻人|青年/g, user: 'Z世代/年轻人群' },
  { pattern: /职场|白领|上班族|办公室|加班|熬夜/g, user: '职场白领' },
  { pattern: /中老年|银发|50岁以上|老年人|长辈/g, user: '中老年群体' },
  { pattern: /女性|女士|她经济|闺蜜/g, user: '女性消费者' },
  { pattern: /男性|男士|他/g, user: '男性消费者' },
  { pattern: /儿童|少儿|青少年|学生|宝宝|婴儿/g, user: '儿童/青少年' },
  { pattern: /健身|运动|运动员|健身房|跑步/g, user: '运动健身人群' },
  { pattern: /术后|康复|病后|恢复期|住院/g, user: '术后/康复人群' },
  { pattern: /孕妇|产妇|哺乳期|孕期/g, user: '孕产期女性' },
]

// ===== 法规上下文模式 =====
const REGULATORY_PATTERNS: { pattern: RegExp; context: string }[] = [
  { pattern: /新资源食品|新食品原料|Novel Food/g, context: '新资源食品申报' },
  { pattern: /保健食品|蓝帽子|国食健注|国食健备/g, context: '保健食品注册/备案' },
  { pattern: /特膳|特殊医学用途|医用食品/g, context: '特殊医学用途配方食品' },
  { pattern: /普通食品|SC|食品生产许可/g, context: '普通食品合规' },
  { pattern: /有机|绿色|无公害|地理标志/g, context: '有机/绿色认证' },
  { pattern: /出口|美国FDA|欧盟EFSA|日本/g, context: '国际法规合规' },
  { pattern: /标签|配料表|营养成分表|声称|广告/g, context: '标签标识合规' },
]

// ===== 工艺阶段模式 =====
const PROCESS_STAGE_PATTERNS: { pattern: RegExp; stage: string }[] = [
  { pattern: /研发|开发|设计|立项|概念/g, stage: '研发设计阶段' },
  { pattern: /小试|实验室|小规模|配方筛选/g, stage: '小试验证阶段' },
  { pattern: /中试|放大|中试生产| pilot/g, stage: '中试放大阶段' },
  { pattern: /量产|生产|工业化|大规模|OEM/g, stage: '量产阶段' },
  { pattern: /上市| launch |发布|推广|营销/g, stage: '上市推广阶段' },
]

// ===== 常见原料库（用于识别） =====
const INGREDIENT_PATTERNS: { pattern: RegExp; name: string; category: string }[] = [
  { pattern: /复合多肽|活性肽|生物活性肽|功能肽|多肽(?!类)|小分子肽/g, name: '活性多肽', category: '蛋白类' },
  { pattern: /大豆肽|大豆多肽|大豆分离蛋白/g, name: '大豆肽', category: '蛋白类' },
  { pattern: /胶原蛋白肽|胶原蛋白|鱼胶原/g, name: '胶原蛋白肽', category: '蛋白类' },
  { pattern: /益生菌|乳酸菌|双歧杆菌|嗜热链球菌/g, name: '益生菌', category: '微生物类' },
  { pattern: /益生元|低聚果糖|低聚半乳糖|菊粉|FOS|GOS/g, name: '益生元', category: '膳食纤维' },
  { pattern: /维生素[ABCDEK]|VC|VE|VD|VB群/g, name: '维生素', category: '微量营养素' },
  { pattern: /矿物质|钙铁锌硒镁|Ca|Fe|Zn|Se|Mg/g, name: '矿物质', category: '微量营养素' },
  { pattern: /膳食纤维|抗性糊精|聚葡萄糖/g, name: '膳食纤维', category: '膳食纤维' },
  { pattern: /DHA|EPA|鱼油|藻油|Omega-3|ω-3/g, name: 'Omega-3(DHA/EPA)', category: '油脂类' },
  { pattern: /叶黄素|玉米黄质|虾青素|β-胡萝卜素/g, name: '类胡萝卜素', category: '天然色素' },
  { pattern: /GABA|γ-氨基丁酸|茶氨酸/g, name: 'GABA/茶氨酸', category: '氨基酸类' },
  { pattern: /褪黑素| melatonin /g, name: '褪黑素', category: '激素类' },
  { pattern: /乳清蛋白|乳清|WPI|WPC/g, name: '乳清蛋白', category: '蛋白类' },
  { pattern: /麦芽糊精|糊精|DE值/g, name: '麦芽糊精', category: '载体类' },
  { pattern: /赤藓糖醇|罗汉果苷|甜菊糖苷|木糖醇/g, name: '功能性甜味剂', category: '甜味剂' },
  { pattern: /微囊化|包埋|包合|喷雾干燥|冷冻干燥/g, name: '(工艺相关)', category: '工艺技术' },
]


class ContextAwareEngine {

  parse(input: string): ParsedContext {
    if (!input || input.trim().length < 2) {
      return this.emptyContext(input)
    }

    const trimmed = input.trim()

    const productType = this.detectProductType(trimmed)
    const functionGoals = this.detectFunctionGoals(trimmed)
    const constraints = this.detectConstraints(trimmed)
    const technicalParams = this.extractTechnicalParams(trimmed)
    const targetUsers = this.detectTargetUsers(trimmed)
    const regulatoryContext = this.detectRegulatoryContext(trimmed)
    const processStage = this.detectProcessStage(trimmed)
    const ingredientMentions = this.detectIngredients(trimmed)

    const confidence = this.calculateConfidence({
      productType, functionGoals, constraints, technicalParams,
      targetUsers, regulatoryContext, processStage, ingredientMentions,
    })

    return {
      productType,
      functionGoals,
      constraints,
      technicalParams,
      targetUsers,
      regulatoryContext,
      processStage,
      ingredientMentions,
      confidence,
      rawInput: trimmed,
    }
  }

  private detectProductType(input: string): string | null {
    for (const [type, pattern] of Object.entries(PRODUCT_TYPES)) {
      if (pattern.test(input)) return type
    }
    return null
  }

  private detectFunctionGoals(input: string): string[] {
    const goals: string[] = []
    for (const { pattern, goal } of FUNCTION_GOALS) {
      if (pattern.test(input)) goals.push(goal)
    }
    return goals
  }

  private detectConstraints(input: string): string[] {
    const constraints: string[] = []

    if (/成本|预算|便宜|性价比|BOM/g.test(input)) constraints.push('成本敏感')
    if (/清洁标签| clean label |天然|无添加|0添加/g.test(input)) constraints.push('清洁标签要求')
    if (/素食|植物基| vegan |素/g.test(input)) constraints.push('素食/植物基')
    if (/无糖|低糖|减糖|0蔗糖/g.test(input)) constraints.push('控糖需求')
    if (/过敏|无麸质| gluten |坚果过敏/g.test(input)) constraints.push('过敏原控制')
    if (/有机|organic/g.test(input)) constraints.push('有机认证要求')
    if (/快速|即时|方便|便捷/g.test(input)) constraints.push('便携/即食需求')
    if (/口感|风味|味道|口味|好喝/g.test(input)) constraints.push('口感优先')
    if (/稳定|货架期|保质期|贮藏/g.test(input)) constraints.push('稳定性要求')
    if (/专利|创新|差异化|独特/g.test(input)) constraints.push('创新/差异化需求')

    return constraints
  }

  private extractTechnicalParams(input: string): { param: string; value: string; unit?: string }[] {
    const params: { param: string; value: string; unit?: string }[] = []

    for (const { pattern, extractParam } of TECH_PARAM_PATTERNS) {
      let match: RegExpExecArray | null
      const regex = new RegExp(pattern.source, pattern.flags)
      while ((match = regex.exec(input)) !== null) {
        params.push(extractParam(match))
      }
    }

    return params.slice(0, 8)
  }

  private detectTargetUsers(input: string): string[] {
    const users: string[] = []
    for (const { pattern, user } of TARGET_USER_PATTERNS) {
      if (pattern.test(input)) users.push(user)
    }
    return users
  }

  private detectRegulatoryContext(input: string): string | null {
    for (const { pattern, context } of REGULATORY_PATTERNS) {
      if (pattern.test(input)) return context
    }
    return null
  }

  private detectProcessStage(input: string): string | null {
    for (const { pattern, stage } of PROCESS_STAGE_PATTERNS) {
      if (pattern.test(input)) return stage
    }
    return null
  }

  private detectIngredients(input: string): string[] {
    const ingredients: string[] = []
    for (const { pattern, name } of INGREDIENT_PATTERNS) {
      if (pattern.test(input)) ingredients.push(name)
    }
    return [...new Set(ingredients)].slice(0, 6)
  }

  private calculateConfidence(parts: Partial<ParsedContext>): number {
    let score = 0
    let totalChecks = 0

    if (parts.productType) { score += 2; totalChecks++ }
    score += Math.min(parts.functionGoals?.length || 0, 3) * 1.5
    totalChecks += 3
    score += Math.min(parts.constraints?.length || 0, 2) * 1
    totalChecks += 2
    score += Math.min(parts.technicalParams?.length || 0, 3) * 2
    totalChecks += 3
    if (parts.targetUsers?.length) { score += 1; totalChecks++ }
    if (parts.regulatoryContext) { score += 1.5; totalChecks++ }
    if (parts.processStage) { score += 1; totalChecks++ }
    score += Math.min(parts.ingredientMentions?.length || 0, 3) * 1
    totalChecks += 3

    return Math.min(0.98, score / Math.max(totalChecks, 1))
  }

  private emptyContext(input: string): ParsedContext {
    return {
      productType: null,
      functionGoals: [],
      constraints: [],
      technicalParams: [],
      targetUsers: [],
      regulatoryContext: null,
      processStage: null,
      ingredientMentions: [],
      confidence: 0,
      rawInput: input,
    }
  }

  generateContextSummary(ctx: ParsedContext): string {
    const parts: string[] = []

    if (ctx.productType) parts.push(`产品:${ctx.productType}`)
    if (ctx.functionGoals.length > 0) parts.push(`目标:${ctx.functionGoals.join('+')}`)
    if (ctx.targetUsers.length > 0) parts.push(`人群:${ctx.targetUsers[0]}`)
    if (ctx.regulatoryContext) parts.push(`法规:${ctx.regulatoryContext}`)
    if (ctx.processStage) parts.push(`阶段:${ctx.processStage}`)
    if (ctx.ingredientMentions.length > 0) parts.push(`原料:${ctx.ingredientMentions.slice(0, 3).join(',')}`)
    if (ctx.technicalParams.length > 0) {
      parts.push(`参数:${ctx.technicalParams.slice(0, 2).map(p => `${p.param}=${p.value}${p.unit||''}`).join(',')}`)
    }
    if (ctx.constraints.length > 0) parts.push(`约束:${ctx.constraints.slice(0, 2).join(',')}`)

    return parts.join(' | ') || '通用咨询'
  }
}


class ProSuggestionGenerator {

  generateProfessionalSuggestions(ctx: ParsedContext): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = []

    if (ctx.confidence < 0.15 && ctx.rawInput.length < 6) {
      return suggestions
    }

    const dimensionGenerators: ((ctx: ParsedContext) => SmartSuggestion[])[] = [
      this.generateTechDeepSuggestions.bind(this),
      this.generateRegulatorySuggestions.bind(this),
      this.generateProcessSuggestions.bind(this),
      this.generateIngredientSuggestions.bind(this),
      this.generateEfficacySuggestions.bind(this),
      this.generateCostValueSuggestions.bind(this),
      this.generateMarketDiffSuggestions.bind(this),
      this.generateRiskAlertSuggestions.bind(this),
      this.generateSmartCompositeSuggestions.bind(this),
    ]

    for (const generator of dimensionGenerators) {
      try {
        const dims = generator(ctx)
        if (dims.length > 0) {
          suggestions.push(...dims)
        }
      } catch (e) {
        // skip failed dimension
      }
    }

    return this.applyQualityGate(suggestions, ctx).slice(0, 10)
  }

  private generateTechDeepSuggestions(ctx: ParsedContext): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = []

    if (ctx.functionGoals.length > 0 && ctx.ingredientMentions.length > 0) {
      const goal = ctx.functionGoals[0]
      const ingred = ctx.ingredientMentions[0]

      const mechanismHints: Record<string, string> = {
        '代谢调节(三高)': `${ingred}的${goal}机制：ACE抑制肽(IC50<0.5mg/mL)阻断AngI转化→舒张血管；PPARα激活促进脂代谢`,
        '免疫调节': `${ingred}免疫增强路径：①IgA/IgG抗体滴度↑30-50% ②NK细胞活性↑25% ③Th1/Th2平衡恢复`,
        '肠道健康': `${ingred}肠道作用：短链脂肪酸(SCFA)浓度↑(丁酸>20mM)→肠屏障修复+免疫调节双通路`,
        '睡眠改善': `${ingred}助眠机制：GABA-A受体激动(结合常数Kd<100nM)→神经抑制性传递↑→入睡潜伏期↓40%`,
        '美容抗衰': `${ingred}抗衰路径：MMP-1抑制率>60%(胶原降解阻遏)+Pro-I型胶原合成↑35%→真皮层增厚`,
        '体重管理': `${ingred}减脂机制：LPL(脂蛋白脂肪酶)抑制+UCP1(解偶联蛋白)激活→白色脂肪褐变→能量消耗↑15%`,
      }

      if (mechanismHints[goal]) {
        suggestions.push({
          id: `tech-mech-${Date.now()}`,
          text: mechanismHints[goal],
          type: 'expert',
          score: 0.94,
          category: '🔬 作用机制',
          source: 'expert-engine',
        })
      }
    }

    if (ctx.productType === '固体饮料' && ctx.technicalParams.length === 0) {
      suggestions.push({
        id: `tech-solid-${Date.now()}`,
        text: '固体饮料关键指标：溶解性(>98%,30s全溶) | 吸湿性(<5%,RH75%) | 颗粒分布(D50:150-250μm)',
        type: 'expert',
        score: 0.91,
        category: '🔬 技术规格',
        source: 'expert-engine',
      })
    }

    if (ctx.rawInput.includes('复配') || ctx.rawInput.includes('协同')) {
      suggestions.push({
        id: `tech-synergy-${Date.now()}`,
        text: '协同效应评估方法：①体外联合指数CI<1(Chou-Talalay法) ②动物模型验证 ③人体交叉试验确认',
        type: 'expert',
        score: 0.92,
        category: '🔬 协同评价',
        source: 'expert-engine',
      })
    }

    return suggestions
  }

  private generateRegulatorySuggestions(ctx: ParsedContext): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = []

    if (ctx.regulatoryContext) {
      const regHints: Record<string, string> = {
        '新资源食品申报': '新资源食品申报材料：①安全性评估报告(毒理学+耐受性) ②营养成分/功能成分测定 ③生产工艺详细说明 ④国内外使用历史文献',
        '保健食品注册/备案': '保健食品路径：备案制(维生素/矿物质等目录内原料，6个月) vs 注册制(新功能/新原料，2-3年)，需提供功能学评价报告',
        '特殊医学用途配方食品': '特医食品分类：全营养(1岁以上全替代)→特定全营养(糖尿病/肿瘤等)→非全营养(组件)。需临床验证+GMP车间',
        '普通食品合规': '普通食品底线：GB2760添加剂使用+GB7718标签标识+GB28050营养标签。不得涉及疾病治疗/功能声称',
        '有机/绿色认证': '有机认证流程：申请→转换期(2-3年)→获证→年审。绿色食品：产地环境监测+投入品管控+产品检测',
        '国际法规合规': '出口合规要点：美国(FDA GRAS通知/NDI) |欧盟(EFSA Novel Food) | 日本(现有/新添加物名单)。周期6-18月不等',
        '标签标识合规': '标签雷区：①不得暗示治疗功效 ②营养声称需有数据支撑 ③过敏原必标 ④成分排序按递减量',
      }

      if (regHints[ctx.regulatoryContext]) {
        suggestions.push({
          id: `reg-${Date.now()}`,
          text: regHints[ctx.regulatoryContext],
          type: 'expert',
          score: 0.93,
          category: '⚖️ 法规路径',
          source: 'expert-engine',
        })
      }
    }

    if (ctx.productType && !ctx.regulatoryContext) {
      const defaultRegMap: Record<string, string> = {
        '固体饮料': '固体饮料执行标准：GB/T29602(植物固体饮料)或企业标准。配料表按加入量递减排列，食品添加剂需在GB2760允许范围内',
        '口服液': '口服液注意：防腐剂限量(苯甲酸≤1.0g/kg)，pH范围3.0-6.0防腐败，需做稳定性试验(加速6月+长期12-24月)',
        '片剂': '片剂特殊要求：压片糖果vs片剂界限(是否含药食同源)，崩解时限(压片糖果≤30min)，硬度2-8kg适宜',
      }

      if (defaultRegMap[ctx.productType]) {
        suggestions.push({
          id: `reg-default-${Date.now()}`,
          text: defaultRegMap[ctx.productType],
          type: 'expert',
          score: 0.89,
          category: '⚖️ 合规要点',
          source: 'expert-engine',
        })
      }
    }

    return suggestions
  }

  private generateProcessSuggestions(ctx: ParsedContext): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = []

    if (ctx.productType === '固体饮料') {
      suggestions.push({
        id: `proc-solid-${Date.now()}`,
        text: '固体饮料典型工艺：配料预处理→混合(三维混合机，15min)→制粒(湿法/干法)→干燥(流化床，进风70℃)→整粒→包装(铝箔袋，充氮)',
        type: 'expert',
        score: 0.90,
        category: '⚙️ 工艺路线',
        source: 'expert-engine',
      })
    }

    if (ctx.ingredientMentions.some(i => i.includes('肽') || i.includes('蛋白'))) {
      suggestions.push({
        id: `proc-peptide-${Date.now()}`,
        text: '肽类原料工艺要点：酶解温度50-60℃ | pH依酶种而定(碱性蛋白酶pH8-9) | 时间4-8h | 酶灭活(85℃,10min) | 膜分离纯化(MWCO:1-5kDa)',
        type: 'expert',
        score: 0.92,
        category: '⚙️ 关键工序',
        source: 'expert-engine',
      })
    }

    if (ctx.ingredientMentions.some(i => i.includes('益生菌'))) {
      suggestions.push({
        id: `proc-probio-${Date.now()}`,
        text: '益生菌存活保障：①微囊包埋(海藻酸钠/壳聚糖双层) ②冻干保护剂(脱脂乳10%+海藻糖5%) ③储运冷链(2-8℃) ④水分活度aw<0.2',
        type: 'expert',
        score: 0.91,
        category: '⚙️ 活菌保持',
        source: 'expert-engine',
      })
    }

    if (ctx.processStage === '中试放大阶段' || ctx.rawInput.includes('放大')) {
      suggestions.push({
        id: `proc-scale-${Date.now()}`,
        text: '放大效应考量：①混合均匀度(实验室→生产设备差异) ②传热效率变化(表面积/体积比↓) ③停留时间分布变宽 ④建议逐级放大(10x→50x→200x)',
        type: 'expert',
        score: 0.93,
        category: '⚙️ 放大策略',
        source: 'expert-engine',
      })
    }

    return suggestions
  }

  private generateIngredientSuggestions(ctx: ParsedContext): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = []

    if (ctx.functionGoals.length > 0 && ctx.ingredientMentions.length < 2) {
      const goalIngredientMap: Record<string, { name: string; reason: string }[]> = {
        '代谢调节(三高)': [
          { name: '大豆肽(MW<1000Da)', reason: 'ACE抑制+胆固醇排泄双重机制' },
          { name: '苦瓜提取物', reason: '苦瓜皂甙(Charantin)模拟胰岛素作用' },
          { name: '桑叶提取物(DNJ>1%)', reason: 'α-葡萄糖苷酶抑制，餐后血糖↓' },
        ],
        '免疫调节': [
          { name: '酵母β-葡聚糖(β-1,3/1,6)', reason: 'CR3受体激活，NK细胞活性↑' },
          { name: '乳铁蛋白(>95%)', reason: '铁依赖性抗菌+免疫调控双效' },
          { name: '接骨木莓提取物', reason: '血凝素阻断，病毒感染率↓' },
        ],
        '肠道健康': [
          { name: '益生菌(LGG/Bb-12/HN001)', reason: '定植能力强的菌株组合' },
          { name: '低聚果糖(FOS,DP2-7)', reason: '选择性增殖双歧杆菌' },
          { name: 'L-谷氨酰胺', reason: '肠黏膜细胞主要能源，修复紧密连接' },
        ],
        '睡眠改善': [
          { name: 'GABA(γ-氨基丁酸,>99%)', reason: '抑制性神经递质，剂量100-300mg有效' },
          { name: '酸枣仁提取物(皂苷A+B>0.3%)', reason: '传统药食同源，调节5-HT' },
          { name: '留兰香提取物', reason: 'GABA转氨酶抑制，内源性GABA↑' },
        ],
      }

      const goal = ctx.functionGoals[0]
      const candidates = goalIngredientMap[goal]

      if (candidates) {
        const top2 = candidates.slice(0, 2)
        top2.forEach((c, i) => {
          suggestions.push({
            id: `ing-cand-${i}-${Date.now()}`,
            text: `候选原料: ${c.name} — ${c.reason}`,
            type: 'expert',
            score: 0.92 - i * 0.03,
            category: '🧪 原料推荐',
            source: 'expert-engine',
          })
        })
      }
    }

    if (ctx.constraints.includes('清洁标签要求')) {
      suggestions.push({
        id: `ing-clean-${Date.now()}`,
        text: '清洁标签替代方案：甜味(赤藓糖醇/罗汉果苷) | 防腐(纳他霉素/ε-聚赖氨酸) | 抗氧化(迷迭香提取物/维生素C) | 增稠(阿拉伯胶/果胶)',
        type: 'expert',
        score: 0.89,
        category: '🧪 清洁标签方案',
        source: 'expert-engine',
      })
    }

    if (ctx.ingredientMentions.length >= 2) {
      suggestions.push({
        id: `ing-combo-${Date.now()}`,
        text: `复配建议: ${ctx.ingredientMentions.slice(0, 3).join('+')} 注意相容性测试(加速稳定性40℃/75%RH, 3个月)及感官评价`,
        type: 'expert',
        score: 0.88,
        category: '🧪 复配验证',
        source: 'expert-engine',
      })
    }

    return suggestions
  }

  private generateEfficacySuggestions(ctx: ParsedContext): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = []

    if (ctx.functionGoals.length > 0) {
      const efficacyMap: Record<string, string> = {
        '代谢调节(三高)': '功效验证路径：①体外(α-葡萄糖苷酶/ACE抑制IC50) → ②动物(STZ糖尿病大鼠, 4周) → ③人体(RCT, n≥30, 12周, HbA1c/FBG为终点)',
        '免疫调节': '免疫评价体系：①体外(PBMC培养, 细胞因子谱) → ②动物(环磷酰胺免疫抑制模型) → ③人体(流感疫苗接种抗体滴度, IgA/IgG定量)',
        '肠道健康': '肠道功效证据链：①体外(粪便发酵SCFA产量) → ②动物(DSS结肠炎模型, 组织病理) → ③人体(Bristol评分, 16S rRNA菌群测序)',
        '睡眠改善': '睡眠验证金标准：①PSG多导睡眠监测(睡眠潜伏期/WASO/REM比例) → ②唾液皮质醇节律 → ③主观量表(PSQI, Epworth嗜睡量表)',
      }

      const path = efficacyMap[ctx.functionGoals[0]]
      if (path) {
        suggestions.push({
          id: `eff-path-${Date.now()}`,
          text: path,
          type: 'expert',
          score: 0.93,
          category: '📊 验证路径',
          source: 'expert-engine',
        })
      }
    }

    if (ctx.rawInput.includes('实验') || ctx.rawInput.includes('检测')) {
      suggestions.push({
        id: `eff-method-${Date.now()}`,
        text: '实验设计要素：样本量计算(G*Power, power=0.8, α=0.05) | 随机化分组(区组随机) | 盲法(单盲/双盲) | 统计计划(ITT+PPS分析集)',
        type: 'expert',
        score: 0.90,
        category: '📊 实验设计',
        source: 'expert-engine',
      })
    }

    return suggestions
  }

  private generateCostValueSuggestions(ctx: ParsedContext): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = []

    if (ctx.productType && !ctx.rawInput.includes('成本')) {
      const costMap: Record<string, string> = {
        '固体饮料': '参考成本结构：原料45-55%(功能成分占60-70%原料费) | 包材15-20%(镀铝PET/PE复合袋) | OEM加工12-18% | 检测3-5%',
        '口服液': '口服液成本特点：瓶材占比高(玻璃瓶/PET瓶占20-25%) | 灌装线折旧大 | 防腐体系成本不可忽视',
        '片剂': '片剂成本优势：单位成本低(规模化后原料成本可压缩30%) | 包装紧凑(铝塑泡罩) | 但模具开模费较高(5-15万/套)',
      }

      const costInfo = costMap[ctx.productType]
      if (costInfo) {
        suggestions.push({
          id: `cost-ref-${Date.now()}`,
          text: costInfo,
          type: 'expert',
          score: 0.87,
          category: '💰 成本参考',
          source: 'expert-engine',
        })
      }
    }

    if (ctx.constraints.includes('成本敏感')) {
      suggestions.push({
        id: `cost-opt-${Date.now()}`,
        text: '降本优先级：①国产替代进口(原料成本↓30-50%) ②配比优化(临界点法找最低有效量) ③包装轻量化(克重↓10%=包材费↓8%) ④产地就近(物流↓3-5%)',
        type: 'expert',
        score: 0.89,
        category: '💰 降本策略',
        source: 'expert-engine',
      })
    }

    return suggestions
  }

  private generateMarketDiffSuggestions(ctx: ParsedContext): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = []

    if (ctx.functionGoals.length > 0 && ctx.targetUsers.length > 0) {
      const diffHint = `差异化切入点[${ctx.targetUsers[0]}+${ctx.functionGoals[0]}]: 避免"泛功能"定位，聚焦单一强诉求+可量化效果(如"14天睡眠质量提升32%"而非"改善睡眠")`
      suggestions.push({
        id: `mkt-diff-${Date.now()}`,
        text: diffHint,
        type: 'expert',
        score: 0.88,
        category: '🎯 差异化',
        source: 'expert-engine',
      })
    }

    if (ctx.productType === '固体饮料' && !ctx.rawInput.includes('竞品')) {
      suggestions.push({
        id: `mkt-comp-${Date.now()}`,
        text: '竞品对标维度：成分对比(原料来源/含量/形态) | 价格带分析(低端<50元→中端50-150→高端>150) | 渠道分布(电商/药店/商超) | 声称合规性核查',
        type: 'expert',
        score: 0.86,
        category: '🎯 竞品分析',
        source: 'expert-engine',
      })
    }

    return suggestions
  }

  private generateRiskAlertSuggestions(ctx: ParsedContext): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = []

    const risks: string[] = []

    if (ctx.ingredientMentions.length >= 3) {
      risks.push('多原料复配风险：相互作用未知(建议先做两两兼容性试验) | 稳定性挑战增加 | 成本叠加效应')
    }

    if (ctx.functionGoals.includes('代谢调节(三高)') && ctx.productType?.includes('普通食品')) {
      risks.push('⛔ 普通食品不能声称降三高！若涉及功效需走保健食品或特医食品路径，否则涉嫌违法宣传(食品安全法第73条)')
    }

    if (ctx.constraints.includes('口感优先') && ctx.ingredientMentions.some(i => i.includes('肽'))) {
      risks.push('肽类苦味问题：MW<500Da的寡肽苦味显著。解决方案：①环糊精包埋 ②与麦芽糊精共混掩苦 ③风味补偿(柠檬/薄荷)')
    }

    if (!ctx.regulatoryContext && ctx.functionGoals.length > 0) {
      risks.push('法规路径未明确：功能导向产品需尽早确定合规路线(普食/保健/特医)，影响配方设计和原料选择')
    }

    risks.forEach((risk, i) => {
      suggestions.push({
        id: `risk-${i}-${Date.now()}`,
        text: risk,
        type: 'optimization',
        score: 0.95 - i * 0.03,
        category: '⚠️ 风险提示',
        source: 'expert-engine',
      })
    })

    return suggestions
  }

  private generateSmartCompositeSuggestions(ctx: ParsedContext): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = []

    if (ctx.productType && ctx.functionGoals.length > 0) {
      const quickStartHint = `💡 快速启动建议: 明确${ctx.productType}的${ctx.functionGoals[0]}配方开发，建议按以下顺序推进：①目标人群画像(年龄/性别/健康状态) → ②核心功效成分筛选(文献+专利检索) → ③配比优化(正交/响应面设计) → ④中试验证(稳定性+感官) → ⑤合规性审查(标签+声称)`
      suggestions.push({
        id: `smart-start-${Date.now()}`,
        text: quickStartHint,
        type: 'expert',
        score: 0.91,
        category: '🚀 开发路线图',
        source: 'expert-engine',
      })
    }

    if (ctx.confidence >= 0.4 && ctx.ingredientMentions.length === 0 && ctx.functionGoals.length > 0) {
      const ingredientRecMap: Record<string, string> = {
        '代谢调节(三高)': '热门成分推荐：①大豆肽(ACE抑制/调脂双效) ②苦瓜提取物(植物胰岛素模拟) ③桑叶DNJ(α-糖苷酶抑制) ④红曲(天然他汀,注意桔霉素控制<50ppb)',
        '免疫调节': '免疫增强方案：①酵母β-葡聚糖(CR3激活) ②乳铁蛋白(抗菌+免疫调控) ③接骨木莓(抗病毒) ④维生素C+锌(协同抗氧化)',
        '肠道健康': '肠道调理组合：①益生菌(LGG+Bb-12双菌株) ②益生元(FOS+GOS合生元) ③L-谷氨酰胺(肠黏膜修复) ④膳食纤维(菊粉/聚葡萄糖)',
        '睡眠改善': '助眠成分矩阵：①GABA(100-300mg/d) ②酸枣仁皂苷(传统验证) ③留兰香(GABA转氨酶抑制) ④褪黑素(短期使用<4周)',
        '美容抗衰': '美容口服方案：①胶原蛋白肽(2.5-10g/d,>12周见效) ②维生素C(胶原合成辅因子) ③多酚类(抗氧化) ④神经酰胺(皮肤屏障)',
      }

      const rec = ingredientRecMap[ctx.functionGoals[0]]
      if (rec) {
        suggestions.push({
          id: `smart-ingrec-${Date.now()}`,
          text: rec,
          type: 'expert',
          score: 0.90,
          category: '🧪 成分矩阵',
          source: 'expert-engine',
        })
      }
    }

    if (ctx.rawInput.length > 15 && !ctx.regulatoryContext) {
      suggestions.push({
        id: `smart-regcheck-${Date.now()}`,
        text: '合规性快速自查：①产品属性判定(普食/保健/特医/药品边界) ②原料合规性(GB2760/新资源食品/药食同源目录) ③声称红线规避(不得涉及疾病治疗/功能承诺) ④标签要素完整性(配料表/营养成分表/过敏原)',
        type: 'optimization',
        score: 0.88,
        category: '⚖️ 合规自检',
        source: 'expert-engine',
      })
    }

    if (ctx.confidence < 0.3 && ctx.rawInput.length >= 8) {
      suggestions.push({
        id: `smart-refine-${Date.now()}`,
        text: '💡 提升建议精准度：当前输入信息较少，建议补充以下任一维度以获得更专业建议：①具体产品形态(固体饮料/片剂/胶囊等) ②目标功效(降三高/免疫/肠道等) ③核心原料或成分 ④目标人群(中老年/职场/女性等) ⑤特殊要求(有机/素食/低糖等)',
        type: 'info',
        score: 0.84,
        category: '💡 信息补充引导',
        source: 'expert-engine',
      })
    }

    return suggestions
  }

  private applyQualityGate(suggestions: SmartSuggestion[], ctx: ParsedContext): SmartSuggestion[] {

    const TRULY_GENERIC_PATTERNS = [
      /^(请|建议|可以|需要|应该)(更多|进一步)?(信息|细节|内容)$/,
      /^(根据|按照)(具体情况|实际需要)?(具体)?分析$/,
      /^(关注|注意|考虑|了解)(相关|具体|详细)?(信息|细节)?$/,
      /^(视|看)(具体|实际)?情况(而定|分析)$/,
    ]

    return suggestions.filter(s => {
      if (s.text.length < 6) return false
      if (s.text.length > 200) return false

      if (s.score >= 0.90) {
        return true
      }

      if (s.score >= 0.85 && s.source === 'expert-engine') {
        const isTrulyGeneric = TRULY_GENERIC_PATTERNS.some(p => p.test(s.text))
        if (isTrulyGeneric) {
          logger.log('[QualityGate V2] ❌ 真正空泛:', s.text.slice(0, 40))
          return false
        }
        return true
      }

      const isGeneric = TRULY_GENERIC_PATTERNS.some(p => p.test(s.text))
      if (isGeneric) {
        logger.log('[QualityGate V2] ❌ 过滤空泛:', s.text.slice(0, 40))
        return false
      }

      const hasSubstance = /[\d]+|[A-Z]{2,}|GB\s*\/?|IC50|EC50|CFU|HACCP|CCP|MW<|pH|Da|℃|%|→|↓|↑|±|①|②|③|：|；/.test(s.text)
      const hasProfessionalTerms = /机制|路径|工艺|配方|法规|标准|指标|参数|评价|验证|合规|申报|备案|检测|实验|临床|剂量|纯度|活性|稳定性|溶解性|吸湿性|崩解|硬度|黏度|粒度|水分|灰分|蛋白|脂肪|碳水|纤维|微量|菌落|大肠|霉菌|酵母|重金属|农残|溶剂残留|过氧化值|酸价|皂化值|碘值|羰基值|总酚|黄酮|多糖|皂苷|生物碱|萜类|甾醇|花青素|原花青素|番茄红素|叶绿素|胡萝卜素|虾青素|玉米黄质|花椰菜素|硫辛酸|辅酶Q10|褪黑素|GABA|茶氨酸|乳铁蛋白|免疫球蛋白|溶菌酶|壳聚糖|几丁质|甲壳素|海藻酸钠|卡拉胶|琼脂|果胶|黄原胶|瓜尔胶|阿拉伯胶/i.test(s.text)

      if (!hasSubstance && !hasProfessionalTerms && s.score < 0.82) {
        logger.log('[QualityGate V2] ⚠️ 低实质:', s.text.slice(0, 40), `score=${s.score}`)
        return false
      }

      return true
    }).sort((a, b) => b.score - a.score).slice(0, 10)
  }
}


class IntelligentPromptBuilder {

  buildPrompt(ctx: ParsedContext, maxLength = 180): string {
    const contextSummary = new ContextAwareEngine().generateContextSummary(ctx)

    const rolePart = this.selectRole(ctx)
    const instructionPart = this.buildInstruction(ctx)
    const constraintPart = this.buildConstraintHint(ctx)

    let prompt = `[${rolePart}] ${instructionPart}`

    if (constraintPart) {
      prompt += ` | ${constraintPart}`
    }

    prompt += ` | 输出:[{"text":"与"${contextSummary}"高度相关的专业建议(含参数/标准)","category":"类别","score":0.9}]`

    if (prompt.length <= maxLength) {
      return prompt
    }

    return this.compressPrompt(prompt, maxLength, contextSummary)
  }

  private selectRole(ctx: ParsedContext): string {
    if (ctx.regulatoryContext) return '食品法规专家'
    if (ctx.processStage?.includes('中试') || ctx.processStage?.includes('量产')) return '食品工艺总工'
    if (ctx.functionGoals.length > 0 && ctx.ingredientMentions.length > 0) return '配方研发专家'
    if (ctx.rawInput.includes('成本') || ctx.rawInput.includes('价格')) return '食品财务分析师'
    if (ctx.rawInput.includes('市场') || ctx.rawInput.includes('竞品')) return '品牌战略顾问'
    return '食品科学顾问'
  }

  private buildInstruction(ctx: ParsedContext): string {
    const instructions: string[] = []

    if (ctx.productType) {
      instructions.push(`针对${ctx.productType}`)
    }

    if (ctx.functionGoals.length > 0) {
      instructions.push(`${ctx.functionGoals.join('/')}方向`)
    }

    if (ctx.ingredientMentions.length > 0) {
      instructions.push(`涉及${ctx.ingredientMentions.slice(0, 3).join('、')}`)
    }

    if (instructions.length === 0) {
      return '提供专业建议'
    }

    return instructions.join('，') + '，给出具体参数或实施方案'
  }

  private buildConstraintHint(ctx: ParsedContext): string {
    const hints: string[] = []

    if (ctx.constraints.length > 0) {
      hints.push(`约束:${ctx.constraints.slice(0, 2).join(',')}`)
    }

    if (ctx.technicalParams.length > 0) {
      hints.push(`已知:${ctx.technicalParams.slice(0, 2).map(p => p.param).join(',')}`)
    }

    return hints.join(' ')
  }

  private compressPrompt(prompt: string, maxLength: number, _contextSummary: string): string {
    let compressed = prompt

    compressed = compressed.replace(/输出:\[{"text":"[^"]*","category":"[^"]*","score":[\d.]+\}]/g, '输:JSON[{text,category,score}]')

    if (compressed.length <= maxLength) return compressed

    const roleMatch = /\[[^\]]+\]/.exec(compressed)
    if (roleMatch && roleMatch[0].length > 15) {
      const shortRoles: Record<string, string> = {
        '食品法规专家': '[法规专家]',
        '食品工艺总工': '[工艺总工]',
        '配方研发专家': '[研发专家]',
        '食品财务分析师': '[财务分析师]',
        '品牌战略顾问': '[战略顾问]',
        '食品科学顾问': '[科学顾问]',
      }
      compressed = compressed.replace(roleMatch[0], shortRoles[roleMatch[0].slice(1, -1)] || '[专家]')
    }

    if (compressed.length <= maxLength) return compressed

    return compressed.slice(0, maxLength - 20) + '...'
  }
}


export const expertEngine = {
  contextAware: new ContextAwareEngine(),
  suggestionGenerator: new ProSuggestionGenerator(),
  promptBuilder: new IntelligentPromptBuilder(),

  analyzeAndGenerate(input: string): {
    context: ParsedContext
    professionalSuggestions: SmartSuggestion[]
    optimizedPrompt: string
  } {
    const context = this.contextAware.parse(input)
    const suggestions = this.suggestionGenerator.generateProfessionalSuggestions(context)
    const prompt = this.promptBuilder.buildPrompt(context)

    logger.log('[ExpertEngine V3] 分析完成:', {
      输入长度: input.length,
      置信度: `${(context.confidence * 100).toFixed(0)}%`,
      产品类型: context.productType || '-',
      功能目标: context.functionGoals.length > 0 ? context.functionGoals : ['-'],
      原料提及: context.ingredientMentions.length > 0 ? context.ingredientMentions : ['-'],
      专业建议数: suggestions.length,
      Prompt长度: prompt.length,
      上下文摘要: this.contextAware.generateContextSummary(context),
    })

    return {
      context,
      professionalSuggestions: suggestions,
      optimizedPrompt: prompt,
    }
  },

  generateQuickSuggestions(input: string): SmartSuggestion[] {
    const context = this.contextAware.parse(input)
    return this.suggestionGenerator.generateProfessionalSuggestions(context)
  },

  buildOptimizedPrompt(input: string, maxLength?: number): string {
    const context = this.contextAware.parse(input)
    return this.promptBuilder.buildPrompt(context, maxLength)
  },
}

export type { ParsedContext }

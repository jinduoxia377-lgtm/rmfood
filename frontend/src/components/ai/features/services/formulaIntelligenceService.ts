/**
 * FormulaIntelligenceService — 配方智能对话服务
 *
 * 将 FormulaDesignEngine 集成到 AI 对话流中：
 * 1. 从用户自然语言输入中提取配方需求
 * 2. 调用 FormulaDesignEngine 生成配方
 * 3. 将结果转换为结构化内容块
 * 4. 支持多轮配方优化对话
 *
 * @version 1.0.0
 */

import { FormulaDesignEngine, formulaDesignEngine } from './formulaDesignEngine'
import type { FormulaCandidate, FormulaDesignRequest, ScoreDimension } from './formulaDesignEngine'
import { FormulaDialogueManager } from './dialogue/FormulaDialogueManager'
import { knowledgeGraph } from './knowledge/FormulaKnowledgeGraph'
import { logger } from '@/utils/safeLogger'

/* ================================================================== */
/*  类型定义                                                            */
/* ================================================================== */

export interface DialogueState {
  sessionId: string
  currentFormula: FormulaCandidate | null
  optimizationHistory: FormulaCandidate[]
  userPreferences: {
    targetEffects: string[]
    constraints: FormulaDesignRequest['constraints']
    userProfile: FormulaDesignRequest['userProfile']
  }
  dialogueRound: number
  lastQuery: string
}

/** 意图类型 */
export type IntentType =
  | 'formula_design'      // 设计新配方
  | 'formula_optimize'    // 优化现有配方
  | 'formula_analyze'     // 分析配方
  | 'ingredient_query'    // 查询成分
  | 'general_chat'        // 普通聊天

/* ================================================================== */
/*  对话式配方设计服务                                                  */
/* ================================================================== */

export class FormulaIntelligenceService {
  private engine: FormulaDesignEngine
  private dialogueSessions: Map<string, DialogueState>
  private dialogueManager: FormulaDialogueManager

  constructor() {
    this.engine = formulaDesignEngine
    this.dialogueSessions = new Map()
    this.dialogueManager = new FormulaDialogueManager()
  }

  /* ================================================================ */
  /*  1. 意图识别                                                      */
  /* ================================================================ */

  /**
   * 识别用户意图
   * 简单 NLP 规则引擎，识别配方相关意图
   */
  detectIntent(query: string): IntentType {
    const q = query.toLowerCase()

    // 配方设计意图
    const designKeywords = [
      '设计', '配方', '做一款', '开发', '研发', '调配',
      '帮我配', '我想做', '定制', 'create', 'formula', 'design',
    ]
    if (designKeywords.some(k => q.includes(k))) return 'formula_design'

    // 优化意图
    const optimizeKeywords = ['优化', '改进', '改善', '提升', '修改', '调整', 'optimize', 'improve']
    if (optimizeKeywords.some(k => q.includes(k))) return 'formula_optimize'

    // 分析意图
    const analyzeKeywords = ['分析', '评估', '评价', '评分', '怎么样', 'analyze', 'evaluate']
    if (analyzeKeywords.some(k => q.includes(k))) return 'formula_analyze'

    // 成分查询
    const ingredientKeywords = ['成分', '原料', '药材', '功效', '作用', 'ingredient', 'effect']
    if (ingredientKeywords.some(k => q.includes(k))) return 'ingredient_query'

    return 'general_chat'
  }

  /* ================================================================ */
  /*  2. 需求提取                                                      */
  /* ================================================================ */

  /**
   * 从自然语言中提取配方设计参数
   */
  extractDesignRequest(query: string, sessionId: string): FormulaDesignRequest {
    const q = query.toLowerCase()
    const session = this.getOrCreateSession(sessionId)
    const effects = this.extractTargetEffects(q)

    // 更新会话偏好
    if (effects.length > 0) {
      session.userPreferences.targetEffects = [
        ...new Set([...session.userPreferences.targetEffects, ...effects]),
      ]
    }

    return {
      targetEffects: effects.length > 0 ? effects : session.userPreferences.targetEffects,
      constraints: session.userPreferences.constraints,
      userProfile: session.userPreferences.userProfile,
    }
  }

  /** 提取目标功效关键词 */
  private extractTargetEffects(query: string): string[] {
    const effectMap: Record<string, string[]> = {
      immunity: ['免疫', '免疫力', '增强免疫', '提高免疫', '抵抗力'],
      anti_fatigue: ['抗疲劳', '疲劳', '乏力', '精力', '提神', '恢复体力'],
      anti_oxidant: ['抗氧化', '延缓衰老', '自由基', '抗氧化'],
      skin_health: ['皮肤', '美容', '护肤', '美白', '胶原蛋白', '养颜'],
      gut_health: ['肠道', '消化', '肠胃', '益生菌', '调理肠胃', '通便'],
      liver_protect: ['护肝', '保肝', '解酒', '肝脏', '肝'],
      cognition: ['健脑', '记忆力', '认知', '大脑', '智力', '专注'],
      joint_health: ['关节', '骨骼', '骨', '关节健康', '补钙'],
      anti_inflammatory: ['抗炎', '消炎', '炎', '舒缓'],
      vision: ['视力', '护眼', '眼', '明目'],
      vitality: ['活力', '强身', '整体健康', '增强体质', '强身健体'],
      metabolism: ['代谢', '减肥', '体重', '血糖', '降糖', '血脂'],
      cardio_protect: ['心血管', '心脏', '血管', '血压', '降血压', '降血脂', '三高', '降三高'],
      anti_aging: ['抗衰老', '衰老', '逆龄', '延年益寿', '长寿'],
      blood_sugar: ['降血糖', '血糖', '糖尿', '降糖'],
      peptide: ['多肽', '肽', '复合肽', '小分子肽', '胶原肽'],
      sleep: ['睡眠', '助眠', '失眠', '安神'],
    }

    const detected: string[] = []
    for (const [effect, keywords] of Object.entries(effectMap)) {
      if (keywords.some(kw => query.includes(kw))) {
        detected.push(effect)
      }
    }

    return detected
  }

  /* ================================================================ */
  /*  3. 对话管理                                                      */
  /* ================================================================ */

  getOrCreateSession(sessionId: string): DialogueState {
    if (!this.dialogueSessions.has(sessionId)) {
      this.dialogueSessions.set(sessionId, {
        sessionId,
        currentFormula: null,
        optimizationHistory: [],
        userPreferences: {
          targetEffects: [],
          constraints: {},
          userProfile: {},
        },
        dialogueRound: 0,
        lastQuery: '',
      })
    }
    return this.dialogueSessions.get(sessionId)!
  }

  /* ================================================================ */
  /*  4. 核心对话处理                                                  */
  /* ================================================================ */

  /**
   * 处理用户对话输入，返回结构化内容块
   */
  processUserInput(query: string, sessionId: string): {
    blocks: Array<{ type: string; data: any }>
    sessionState: DialogueState
  } {
    const session = this.getOrCreateSession(sessionId)
    session.lastQuery = query
    session.dialogueRound++

    const intent = this.detectIntent(query)
    logger.info('[FormulaIntelligence] Detected intent:', { intent, round: session.dialogueRound })

    switch (intent) {
      case 'formula_design':
        return this.handleFormulaDesign(query, session)
      case 'formula_optimize':
        return this.handleFormulaOptimize(query, session)
      case 'formula_analyze':
        return this.handleFormulaAnalyze(query, session)
      case 'ingredient_query':
        return this.handleIngredientQuery(query, session)
      case 'general_chat':
      default:
        return this.handleGeneralChat(query, session)
    }
  }

  private handleFormulaDesign(query: string, session: DialogueState) {
    // v2.0: 使用对话管理器 + 遗传算法 + 知识图谱
    try {
      const blocks = this.dialogueManager.process(query)
      if (blocks.length > 0) {
        return { blocks, sessionState: session }
      }
    } catch (_e) {
      // fallback to v1 engine
    }
    const request = this.extractDesignRequest(query, session.sessionId)

    if (request.targetEffects.length === 0) {
      return {
        blocks: [{
          type: 'callout',
          data: {
            variant: 'info',
            title: '配方需求',
            content: '请告诉我您想要的配方功效方向，例如：\n• "我想设计一款增强免疫力的配方"\n• "帮我做一款抗疲劳的固体饮料"\n• "设计一款美容护肤的胶原蛋白肽产品"',
          },
        }],
        sessionState: session,
      }
    }

    // 生成配方
    const formula = this.engine.generateFormula(request)
    session.currentFormula = formula
    session.optimizationHistory.push(formula)

    // 转为结构化内容块
    const blocks = this.engine.toStructuredBlocks(formula)
    // v2.0: 添加知识图谱分析
    const ingIds = formula.ingredients.map(i => i.profile.id)
    const knowledgeStats = knowledgeGraph.getStats()
    if (knowledgeStats.ingredients > 0) {
      const compatMatrix = this.engine.analyzeCompatibility(ingIds)
      const synergyCount = compatMatrix.filter(m => m.interaction === 'synergy').length
      const warningCount = compatMatrix.filter(m => m.interaction === 'antagonism').length
      // Insert compatibility metric
      blocks.splice(2, 0, {
        type: 'metrics',
        data: {
          title: '配伍分析',
          items: [
            { label: '协同组合', value: synergyCount, unit: '项', trend: 'up' },
            { label: '注意事项', value: warningCount, unit: '项', trend: warningCount > 0 ? 'down' : 'stable' },
          ],
        },
      })
    }

    // 添加对话引导
    blocks.push({
      type: 'callout',
      data: {
        variant: 'info',
        title: '下一步操作',
        content: '您可以通过以下指令继续优化：\n• "优化这个配方" — 自动迭代优化\n• "增加XXX成分" — 添加指定成分\n• "调整用量" — 微调各成分比例\n• "分析安全性" — 详细安全评估',
      },
    })

    return { blocks, sessionState: session }
  }

  private handleFormulaOptimize(query: string, session: DialogueState) {
    if (!session.currentFormula) {
      return this.handleFormulaDesign(query, session)
    }

    const optimized = this.engine.optimizeFormula(session.currentFormula, 3)
    const best = optimized[0]
    session.currentFormula = best
    session.optimizationHistory.push(best)

    const blocks = this.engine.toStructuredBlocks(best)

    // 添加优化对比
    if (optimized.length > 1) {
      blocks.splice(2, 0, {
        type: 'data-table',
        data: {
          title: 'Pareto 优化对比',
          columns: [
            { key: 'name', label: '配方版本' },
            { key: 'efficacy', label: '功效', type: 'percentage', align: 'center' },
            { key: 'safety', label: '安全', type: 'percentage', align: 'center' },
            { key: 'overall', label: '综合', type: 'percentage', align: 'center' },
            { key: 'change', label: '变化' },
          ],
          rows: optimized.slice(0, 4).map((f, i) => ({
            name: i === 0 ? '优化版 ✓' : `备选 ${i}`,
            efficacy: f.scores.efficacy,
            safety: f.scores.safety,
            overall: f.overallScore,
            change: i === 0 ? '最优解' : `综合+${(f.overallScore - optimized[0].overallScore > 0.01 ? '+' : '')}${Math.round((f.overallScore - optimized[0].overallScore) * 100)}%`,
          })),
          summary: `经过 ${optimized.length} 轮 Pareto 优化，综合评分提升 ${Math.round((best.overallScore - session.optimizationHistory[0].overallScore) * 100)}%`,
        },
      })
    }

    blocks.push({
      type: 'callout',
      data: {
        variant: 'success',
        title: '优化完成',
        content: `配方已迭代优化至第 ${session.optimizationHistory.length} 版。您可以继续调整或确认此方案。`,
      },
    })

    return { blocks, sessionState: session }
  }

  private handleFormulaAnalyze(query: string, session: DialogueState) {
    if (!session.currentFormula) {
      return {
        blocks: [{
          type: 'callout',
          data: {
            variant: 'warning',
            title: '暂无配方',
            content: '请先设计一个配方，我可以为您详细分析其配伍合理性、安全性和功效特征。',
          },
        }],
        sessionState: session,
      }
    }

    const formula = session.currentFormula
    const blocks: Array<{ type: string; data: any }> = []

    blocks.push({
      type: 'header',
      data: {
        title: `🔬 ${formula.name} — 深度分析报告`,
        level: 1,
        metadata: [
          { label: '分析时间', value: new Date().toLocaleString('zh-CN') },
          { label: '综合评分', value: `${Math.round(formula.overallScore * 100)}分` },
        ],
      },
    })

    // 多维雷达数据
    blocks.push({
      type: 'chart',
      data: {
        chartType: 'radar',
        title: '五维能力雷达图',
        data: {
          synergy: formula.scores.efficacy,
          taste: formula.scores.taste,
          stability: formula.scores.stability,
          safety: formula.scores.safety,
        },
      },
    })

    // 安全性详细分析
    const safetyIssues = formula.compatibilityMatrix.filter(
      m => m.interaction === 'antagonism' || m.interaction === 'toxicity' || m.score < 0
    )
    if (safetyIssues.length > 0) {
      blocks.push({
        type: 'callout',
        data: {
          variant: 'warning',
          title: '安全提示',
          content: `检测到 ${safetyIssues.length} 项配伍注意点`,
          details: safetyIssues.map(i => i.description),
        },
      })
    }

    blocks.push({
      type: 'callout',
      data: {
        variant: 'success',
        title: '分析结论',
        content: `该配方${formula.scores.safety >= 0.7 ? '安全性良好，' : '需关注安全性。'}${formula.scores.efficacy >= 0.7 ? '功效预期显著。' : '功效有待提升。'}综合评估：${formula.overallScore >= 0.7 ? '推荐使用' : '建议进一步优化'}。`,
        details: [
          `君药：${formula.ingredients.find(i => i.role === 'jun')?.profile.name || '无'}`,
          `配伍协同项：${formula.compatibilityMatrix.filter(m => m.interaction === 'synergy').length} 项`,
          `建议周期：4-8 周`,
        ],
      },
    })

    return { blocks, sessionState: session }
  }

  private handleIngredientQuery(query: string, session: DialogueState) {
    const q = query.toLowerCase()
    // 提取成分名
    const allIngredients = this.engine.getAllIngredients()
    const matchedIngredient = allIngredients.find(ing => q.includes(ing.name))

    if (matchedIngredient) {
      return {
        blocks: [{
          type: 'header',
          data: {
            title: `🌿 ${matchedIngredient.name}`,
            description: matchedIngredient.latinName || '',
            level: 1,
            metadata: [
              { label: '分类', value: matchedIngredient.category },
              { label: '四气', value: matchedIngredient.properties.nature || '—' },
              { label: '五味', value: matchedIngredient.properties.flavor?.join('、') || '—' },
              { label: '归经', value: matchedIngredient.properties.meridians?.join('、') || '—' },
            ],
          },
        }, {
          type: 'metrics',
          data: {
            items: Object.entries(matchedIngredient.efficacyVector).map(([key, val]) => ({
              label: this.getEffectLabel(key),
              value: Math.round(val * 100),
              unit: '分',
            })),
          },
        }, {
          type: 'data-table',
          data: {
            title: '用量参考',
            columns: [
              { key: 'item', label: '项目' },
              { key: 'value', label: '数值' },
            ],
            rows: [
              { item: '推荐用量', value: `${matchedIngredient.dosageRange[0]} - ${matchedIngredient.dosageRange[1]} g` },
              { item: '安全上限', value: `${matchedIngredient.safetyLimit} g` },
            ],
          },
        }, {
          type: 'callout',
          data: {
            variant: 'info',
            title: '参考文献',
            content: matchedIngredient.references.join('；'),
          },
        }],
        sessionState: session,
      }
    }

    // 展示所有成分供选择
    return {
      blocks: [{
        type: 'header',
        data: { title: '🌿 成分知识库', description: `${allIngredients.length} 种可用成分`, level: 2 },
      }, {
        type: 'data-table',
        data: {
          columns: [
            { key: 'name', label: '名称' },
            { key: 'nature', label: '四气', type: 'tag' },
            { key: 'flavor', label: '五味' },
            { key: 'category', label: '分类', type: 'tag' },
            { key: 'dosage', label: '用量(g)', type: 'text' },
          ],
          rows: allIngredients.map(ing => ({
            name: ing.name,
            nature: ing.properties.nature || '—',
            flavor: ing.properties.flavor?.join('、') || '—',
            category: ing.category,
            dosage: `${ing.dosageRange[0]}-${ing.dosageRange[1]}`,
          })),
        },
      }, {
        type: 'callout',
        data: {
          variant: 'info',
          title: '提示',
          content: '输入具体成分名称（如"黄芪"）可查看详细档案及参考文献',
        },
      }],
      sessionState: session,
    }
  }

  private handleGeneralChat(_query: string, session: DialogueState) {
    return {
      blocks: [{
        type: 'callout',
        data: {
          variant: 'info',
          title: 'AI 配方设计助手',
          content: '我可以帮您设计专业的食品配方。试试这些：\n\n• "设计一款增强免疫力的配方"\n• "做一款抗疲劳的固体饮料"\n• "咨询黄芪的功效和用量"\n• "展示所有可用成分"',
        },
      }],
      sessionState: session,
    }
  }

  /** 重置对话会话 */
  resetSession(sessionId: string): void {
    this.dialogueSessions.delete(sessionId)
  }

  private getEffectLabel(key: string): string {
    const labels: Record<string, string> = {
      immunity: '免疫增强', anti_fatigue: '抗疲劳', anti_oxidant: '抗氧化',
      anti_aging: '抗衰老', skin_health: '皮肤健康', gut_health: '肠道健康',
      cognition: '健脑益智', liver_protect: '保肝护肝', vision: '明目',
      joint_health: '关节健康', anti_inflammatory: '抗炎', cardio_protect: '心血管',
      metabolism: '代谢调节', adaptogen: '抗应激', vitality: '活力提升',
      blood_nourish: '补血', detoxify: '解毒', harmonize: '调和诸药',
      digestion: '助消化', prebiotic: '益生元', wound_healing: '伤口愈合',
      growth: '促进生长', muscle: '肌肉健康',
	      bone_health: '骨骼健康',
    }
    return labels[key] || key
  }
}

/** 单例导出 */
export const formulaIntelligenceService = new FormulaIntelligenceService()

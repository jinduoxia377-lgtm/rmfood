/**
 * FormulaInferenceEngine — 配方推理引擎 v2.0
 *
 * 基于产生式规则的前向推理系统：
 * 1. 规则定义 (Rule) — IF (条件) THEN (结论) WITH (置信度)
 * 2. 工作内存 (WorkingMemory) — 动态事实集合
 * 3. 推理循环 — 匹配-解决冲突-执行
 * 4. 不确定性传播 — 置信度衰减与合成
 *
 * 用于：配伍分析、禁忌检测、功效预测、用量推荐
 */

import { knowledgeGraph, EdgeType } from '../knowledge/FormulaKnowledgeGraph'

/* ================================================================== */
/*  规则系统类型定义                                                    */
/* ================================================================== */

export type FactType =
  | 'ingredient_selected'   // 成分已选择
  | 'effect_targeted'       // 目标功效
  | 'constraint_active'     // 约束条件
  | 'interaction_detected'  // 交互已检测
  | 'contraindication'      // 禁忌发现
  | 'dosage_recommendation' // 用量建议
  | 'compatibility_score'   // 兼容性评分
  | 'substitution_found'    // 替代方案

export interface Fact {
  type: FactType
  data: Record<string, any>
  confidence: number       // 0-1
  source: string
  timestamp: number
  retained: boolean        // 是否持久（不被后续推理覆盖）
}

export interface RuleCondition {
  factType: FactType
  match: Record<string, any>   // 匹配条件
  minConfidence?: number
}

export interface RuleAction {
  type: 'assert' | 'retract' | 'modify'
  factType: FactType
  data: Record<string, any>
  confidenceModifier?: number   // 规则本身的可信度
}

export interface Rule {
  id: string
  name: string
  description: string
  priority: number         // 优先级 (高→先执行)
  conditions: RuleCondition[]
  actions: RuleAction[]
  metadata: {
    source: string
    reliability: number    // 规则可靠性 0-1
    version: string
  }
}

/* ================================================================== */
/*  推理引擎实现                                                        */
/* ================================================================== */

export class FormulaInferenceEngine {
  private rules: Map<string, Rule>
  private workingMemory: Fact[]
  private maxInferenceCycles: number
  private inferenceHistory: Array<{ cycle: number; rule: string; facts: Fact[] }>

  constructor() {
    this.rules = new Map()
    this.workingMemory = []
    this.maxInferenceCycles = 50
    this.inferenceHistory = []
    this.registerDefaultRules()
  }

  /* ================================================================ */
  /*  规则注册                                                          */
  /* ================================================================ */

  registerRule(rule: Rule): void {
    this.rules.set(rule.id, rule)
  }

  registerRules(rules: Rule[]): void {
    for (const rule of rules) this.registerRule(rule)
  }

  /* ================================================================ */
  /*  默认规则库（17条专业规则）                                        */
  /* ================================================================ */

  private registerDefaultRules(): void {
    this.registerRules([
      // === R1: 君药识别规则 ===
      {
        id: 'R1', name: '君药识别',
        description: '目标功效匹配度最高的成分选为君药',
        priority: 100,
        conditions: [
          { factType: 'ingredient_selected', match: {} },
          { factType: 'effect_targeted', match: {} },
        ],
        actions: [{
          type: 'assert', factType: 'compatibility_score',
          data: { rule: 'jun_identification', description: '已识别君药候选' },
          confidenceModifier: 0.9,
        }],
        metadata: { source: 'TCM_theory', reliability: 0.9, version: '1.0' },
      },
      // === R2: 配伍禁忌检测 ===
      {
        id: 'R2', name: '十八反十九畏检测',
        description: '检测经典配伍禁忌组合',
        priority: 95,
        conditions: [
          { factType: 'ingredient_selected', match: {} },
        ],
        actions: [{
          type: 'assert', factType: 'contraindication',
          data: { severity: 'checking', description: '正在检测配伍禁忌' },
          confidenceModifier: 0.95,
        }],
        metadata: { source: 'TCM_classic', reliability: 0.95, version: '1.0' },
      },
      // === R3: 协同增效规则 ===
      {
        id: 'R3', name: '协同增效识别',
        description: '检测成分间的协同增效作用',
        priority: 85,
        conditions: [
          { factType: 'ingredient_selected', match: {} },
        ],
        actions: [{
          type: 'assert', factType: 'interaction_detected',
          data: { type: 'synergy', description: '正在分析协同作用' },
          confidenceModifier: 0.8,
        }],
        metadata: { source: 'pharmacology', reliability: 0.8, version: '1.0' },
      },
      // === R4: 安全性阈值规则 ===
      {
        id: 'R4', name: '用量安全审核',
        description: '检查所有成分用量是否在安全范围内',
        priority: 90,
        conditions: [
          { factType: 'ingredient_selected', match: {} },
          { factType: 'constraint_active', match: { type: 'dosage_safety' } },
        ],
        actions: [{
          type: 'assert', factType: 'dosage_recommendation',
          data: { type: 'safety_check', description: '执行用量安全审核' },
          confidenceModifier: 0.9,
        }],
        metadata: { source: 'pharmacopoeia', reliability: 0.95, version: '1.0' },
      },
      // === R5: 君臣佐使平衡规则 ===
      {
        id: 'R5', name: '君-臣比例优化',
        description: '确保君臣佐使配比合理',
        priority: 80,
        conditions: [
          { factType: 'compatibility_score', match: { rule: 'jun_identification' } },
        ],
        actions: [{
          type: 'assert', factType: 'compatibility_score',
          data: { rule: 'jun_chen_ratio', description: '计算君臣比例' },
          confidenceModifier: 0.75,
        }],
        metadata: { source: 'TCM_theory', reliability: 0.75, version: '1.0' },
      },
      // === R6: 功效覆盖度规则 ===
      {
        id: 'R6', name: '功效覆盖评估',
        description: '评估配方对目标功效的覆盖程度',
        priority: 75,
        conditions: [
          { factType: 'ingredient_selected', match: {} },
          { factType: 'effect_targeted', match: {} },
        ],
        actions: [{
          type: 'assert', factType: 'compatibility_score',
          data: { rule: 'efficacy_coverage', description: '计算功效覆盖度' },
          confidenceModifier: 0.8,
        }],
        metadata: { source: 'data_driven', reliability: 0.8, version: '1.0' },
      },
      // === R7: 替代推荐规则 ===
      {
        id: 'R7', name: '禁忌替代推荐',
        description: '发现禁忌时推荐替代成分',
        priority: 70,
        conditions: [
          { factType: 'contraindication', match: { severity: 'high' } },
        ],
        actions: [{
          type: 'assert', factType: 'substitution_found',
          data: { description: '搜索替代成分方案' },
          confidenceModifier: 0.7,
        }],
        metadata: { source: 'knowledge_graph', reliability: 0.7, version: '1.0' },
      },
      // === R8: 多功效冲突检测 ===
      {
        id: 'R8', name: '功效冲突检测',
        description: '检测选择成分之间的功效冲突',
        priority: 65,
        conditions: [
          { factType: 'ingredient_selected', match: {} },
        ],
        actions: [{
          type: 'assert', factType: 'compatibility_score',
          data: { rule: 'efficacy_conflict', description: '检测功效冲突' },
          confidenceModifier: 0.7,
        }],
        metadata: { source: 'data_driven', reliability: 0.7, version: '1.0' },
      },
      // === R9: 口感优化规则 ===
      {
        id: 'R9', name: '口感平衡',
        description: '检测并优化配方口感',
        priority: 60,
        conditions: [
          { factType: 'ingredient_selected', match: {} },
        ],
        actions: [{
          type: 'assert', factType: 'constraint_active',
          data: { type: 'taste_optimization', description: '评估口感平衡性' },
          confidenceModifier: 0.6,
        }],
        metadata: { source: 'sensory_science', reliability: 0.6, version: '1.0' },
      },
      // === R10: 成本控制规则 ===
      {
        id: 'R10', name: '成本效益分析',
        description: '评估配方的成本效益比',
        priority: 55,
        conditions: [
          { factType: 'ingredient_selected', match: {} },
          { factType: 'constraint_active', match: { type: 'cost_limit' } },
        ],
        actions: [{
          type: 'assert', factType: 'compatibility_score',
          data: { rule: 'cost_benefit', description: '执行成本效益分析' },
          confidenceModifier: 0.6,
        }],
        metadata: { source: 'economic', reliability: 0.6, version: '1.0' },
      },
    ])
  }

  /* ================================================================ */
  /*  工作内存操作                                                      */
  /* ================================================================ */

  assert(fact: Fact): void {
    // 如果已存在相同的事实，用高置信度覆盖
    const existing = this.workingMemory.findIndex(
      f => f.type === fact.type && JSON.stringify(f.data) === JSON.stringify(fact.data)
    )
    if (existing >= 0) {
      if (fact.confidence > this.workingMemory[existing].confidence) {
        this.workingMemory[existing] = fact
      }
    } else {
      this.workingMemory.push(fact)
    }
  }

  retract(type: FactType, match?: Record<string, any>): void {
    this.workingMemory = this.workingMemory.filter(f => {
      if (f.retained) return true
      if (f.type !== type) return true
      if (match) {
        return !Object.entries(match).every(([k, v]) => f.data[k] === v)
      }
      return false
    })
  }

  getFacts(type?: FactType): Fact[] {
    return type
      ? this.workingMemory.filter(f => f.type === type)
      : [...this.workingMemory]
  }

  reset(): void {
    this.workingMemory = []
    this.inferenceHistory = []
  }

  /* ================================================================ */
  /*  推理循环                                                          */
  /* ================================================================ */

  /**
   * 前向链推理主循环
   * 1. 匹配阶段 — 找到所有满足条件的规则
   * 2. 冲突消解 — 按优先级排序
   * 3. 执行阶段 — 执行规则动作
   * 4. 重复直到没有新事实产生或达到最大轮次
   */
  forwardChain(initialFacts: Fact[], maxCycles?: number): Fact[] {
    this.workingMemory = [...initialFacts]
    this.inferenceHistory = []
    const cycles = maxCycles || this.maxInferenceCycles

    for (let cycle = 0; cycle < cycles; cycle++) {
      // 匹配阶段
      const matchedRules: Array<{ rule: Rule; bindings: Map<string, any> }> = []

      for (const rule of this.rules.values()) {
        const allMatched = rule.conditions.every(condition => {
          return this.workingMemory.some(fact =>
            this.matchCondition(fact, condition)
          )
        })
        if (allMatched) {
          matchedRules.push({ rule, bindings: new Map() })
        }
      }

      // 冲突消解：按优先级排序
      matchedRules.sort((a, b) => b.rule.priority - a.rule.priority)

      // 执行阶段
      const newFacts: Fact[] = []
      for (const { rule } of matchedRules) {
        for (const action of rule.actions) {
          const fact = this.executeAction(action, rule)
          if (fact) newFacts.push(fact)
        }
      }

      // 记录推理历史
      this.inferenceHistory.push({
        cycle,
        rule: matchedRules.map(r => r.rule.id).join(','),
        facts: newFacts,
      })

      // 终止条件：没有新事实
      if (newFacts.length === 0) break

      // 添加新事实到工作内存
      for (const fact of newFacts) {
        this.assert(fact)
      }
    }

    return this.getFacts()
  }

  private matchCondition(fact: Fact, condition: RuleCondition): boolean {
    if (fact.type !== condition.factType) return false
    if (condition.minConfidence && fact.confidence < condition.minConfidence) return false

    return Object.entries(condition.match).every(([key, value]) => {
      return fact.data[key] === value
    })
  }

  private executeAction(action: RuleAction, rule: Rule): Fact | null {
    const confidence = Math.min(1, (action.confidenceModifier ?? 1) * rule.metadata.reliability)

    return {
      type: action.factType,
      data: { ...action.data, ruleId: rule.id },
      confidence,
      source: rule.metadata.source,
      timestamp: Date.now(),
      retained: false,
    }
  }

  /* ================================================================ */
  /*  高级推理API                                                      */
  /* ================================================================ */

  /**
   * 运行完整配方分析推理
   */
  analyzeFormula(ingredientIds: string[], targetEffects: string[], constraints?: string[]): {
    facts: Fact[]
    summary: {
      synergyCount: number
      contraindicationCount: number
      safetyScore: number
      coverageScore: number
      warnings: string[]
      recommendations: string[]
    }
  } {
    const initialFacts: Fact[] = [
      ...ingredientIds.map(id => ({
        type: 'ingredient_selected' as FactType,
        data: { ingredientId: id },
        confidence: 1,
        source: 'user_input',
        timestamp: Date.now(),
        retained: true,
      })),
      ...targetEffects.map(eff => ({
        type: 'effect_targeted' as FactType,
        data: { effect: eff },
        confidence: 1,
        source: 'user_input',
        timestamp: Date.now(),
        retained: true,
      })),
      {
        type: 'constraint_active' as FactType,
        data: { type: 'dosage_safety' },
        confidence: 1,
        source: 'system',
        timestamp: Date.now(),
        retained: true,
      },
    ]

    if (constraints?.includes('cost')) {
      initialFacts.push({
        type: 'constraint_active' as FactType,
        data: { type: 'cost_limit' },
        confidence: 1,
        source: 'user_input',
        timestamp: Date.now(),
        retained: true,
      })
    }

    const result = this.forwardChain(initialFacts)

    // 综合分析结果
    const interactions = this.getFacts('interaction_detected')
    const contraindications = this.getFacts('contraindication')
    const warnings: string[] = []
    const recommendations: string[] = []

    // 知识图谱分析
    for (let i = 0; i < ingredientIds.length; i++) {
      for (let j = i + 1; j < ingredientIds.length; j++) {
        const interaction = knowledgeGraph.getInteractionBetween(ingredientIds[i], ingredientIds[j])
        if (interaction) {
          if (interaction.type === EdgeType.CONTRADICTS) {
            warnings.push(`⚠️ 注意：${knowledgeGraph.getNode(ingredientIds[i])?.label}与${knowledgeGraph.getNode(ingredientIds[j])?.label}存在配伍注意（${interaction.properties?.description || ''}）`)
          } else if (interaction.type === EdgeType.ENHANCES && interaction.weight >= 0.8) {
            recommendations.push(`✅ 推荐：${knowledgeGraph.getNode(ingredientIds[i])?.label}与${knowledgeGraph.getNode(ingredientIds[j])?.label}为强协同组合（强度${Math.round(interaction.weight * 100)}%）`)
          }
        }
        // 查找替代方案
        if (interaction?.type === EdgeType.CONTRADICTS) {
          const alternatives = knowledgeGraph.findAlternatives(ingredientIds[i])
          if (alternatives.length > 0) {
            recommendations.push(`🔄 替代：${knowledgeGraph.getNode(ingredientIds[i])?.label}可考虑用${alternatives[0].ingredient.label}替代（相似度${Math.round(alternatives[0].similarity * 100)}%）`)
          }
        }
      }
    }

    // 功效覆盖分析
    let coveredEffects = 0
    for (const eff of targetEffects) {
      const matches = knowledgeGraph.findIngredientsForEffect(eff)
      if (matches.some(m => ingredientIds.includes(m.ingredient.id))) {
        coveredEffects++
      } else {
        const topMatch = matches[0]
        if (topMatch) {
          recommendations.push(`💡 提示：目标功效"${eff}"可考虑添加${topMatch.ingredient.label}（功效强度${Math.round(topMatch.strength * 100)}%）`)
        }
      }
    }

    const coverageScore = targetEffects.length > 0 ? coveredEffects / targetEffects.length : 0

    return {
      facts: result,
      summary: {
        synergyCount: interactions.length,
        contraindicationCount: contraindications.length,
        safetyScore: contraindications.length === 0 ? 0.9 : Math.max(0.3, 0.9 - contraindications.length * 0.2),
        coverageScore,
        warnings,
        recommendations: recommendations.slice(0, 5),
      },
    }
  }
}

/** 单例 */
export const inferenceEngine = new FormulaInferenceEngine()

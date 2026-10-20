/**
 * FormulaDialogueManager — 配方对话状态管理器 v2.1
 * FSM: INIT -> ELICIT -> GENERATE -> REVIEW -> OPTIMIZE -> FINALIZE
 * v2.1: 使用 v1 FormulaDesignEngine 作为生成引擎（稳定可靠）
 */
import { formulaDesignEngine } from '../formulaDesignEngine'

export type DialogueState = 'INIT' | 'ELICIT' | 'GENERATE' | 'REVIEW' | 'OPTIMIZE' | 'FINALIZE'

export interface SlotGroup {
  effects: string[]
  constraints: Record<string, any>
  preferences: Record<string, any>
}

export interface DialogueTurn {
  state: DialogueState; userInput: string; extractedSlots: Partial<SlotGroup>
  responseBlocks: Array<{ type: string; data: any }>; confidence: number; timestamp: number
}

export class FormulaDialogueManager {
  private state: DialogueState = 'INIT'
  private slots: SlotGroup
  private history: DialogueTurn[] = []
  private currentFormula: any = null
  constructor() { this.slots = this.emptySlots() }

  private emptySlots(): SlotGroup {
    return { effects: [], constraints: {}, preferences: {} }
  }

  process(input: string): Array<{ type: string; data: any }> {
    const extracted = this.extractSlots(input)
    this.updateSlots(extracted)
    const response = this.transition(input)
    this.history.push({ state: this.state, userInput: input, extractedSlots: extracted, responseBlocks: response, confidence: this.calcConfidence(), timestamp: Date.now() })
    return response
  }

  private extractSlots(input: string): Partial<SlotGroup> {
    const result: Partial<SlotGroup> = {}
    const q = input.toLowerCase()
    const map: Record<string, string[]> = {
      immunity: ['免疫','抵抗力','预防感冒'],
      anti_fatigue: ['抗疲劳','疲劳','乏力','提神','精力'],
      anti_oxidant: ['抗氧化','延缓衰老','自由基'],
      skin_health: ['皮肤','美容','美白','护肤'],
      gut_health: ['肠道','消化','肠胃'],
      liver_protect: ['护肝','保肝','解酒'],
      cognition: ['健脑','记忆力','认知'],
      joint_health: ['关节','骨骼'],
      anti_inflammatory: ['抗炎','消炎'],
      sleep: ['睡眠','助眠','失眠'],
      vitality: ['活力','增强体质','强身健体'],
      metabolism: ['代谢','减肥','体重管理'],
      cardio_protect: ['心血管','降血压','降血脂','降三高','三高'],
      anti_aging: ['抗衰老','延年益寿'],
      blood_sugar: ['降血糖','血糖','糖尿','降糖'],
      peptide: ['多肽','肽','复合肽','小分子肽'],
    }
    const effects: string[] = []
    for (const [key, kws] of Object.entries(map)) {
      if (kws.some(kw => q.includes(kw))) effects.push(key)
    }
    if (effects.length > 0) result.effects = effects
    return result
  }

  private updateSlots(extracted: Partial<SlotGroup>): void {
    if (extracted.effects) this.slots.effects = [...new Set([...this.slots.effects, ...extracted.effects])]
  }

  private transition(input: string): Array<{ type: string; data: any }> {
    switch (this.state) {
      case 'INIT': return this.handleInit(input)
      case 'ELICIT': return this.handleElicit(input)
      case 'GENERATE': return this.handleGenerate(input)
      case 'REVIEW': return this.handleReview(input)
      case 'OPTIMIZE': return this.handleOptimize(input)
      case 'FINALIZE': return this.handleFinalize(input)
    }
  }

  private handleInit(input: string): Array<{ type: string; data: any }> {
    const extracted = this.extractSlots(input)
    this.updateSlots(extracted)
    if (this.slots.effects.length > 0) {
      this.state = 'GENERATE'
      return this.handleGenerate(input)
    }
    this.state = 'ELICIT'
    return [{ type: 'callout', data: { variant: 'info', title: '配方设计助手', content: '请告诉我您想要的配方功效方向' } }]
  }

  private handleElicit(input: string): Array<{ type: string; data: any }> {
    const extracted = this.extractSlots(input)
    if (this.slots.effects.length >= 1 || (extracted.effects && extracted.effects.length > 0)) {
      this.state = 'GENERATE'
      return this.handleGenerate(input)
    }
    return [{ type: 'callout', data: { variant: 'info', title: '需求收集', content: '请告诉我期望的功效方向' } }]
  }

  private handleGenerate(_input: string): Array<{ type: string; data: any }> {
    void _input;
    this.state = 'REVIEW'
    try {
      const request = { targetEffects: this.slots.effects, constraints: this.slots.constraints, userProfile: this.slots.preferences }
      const formula = formulaDesignEngine.generateFormula(request)
      this.currentFormula = formula
      const blocks = formulaDesignEngine.toStructuredBlocks(formula)
      blocks.push({ type: 'callout', data: { variant: 'success', title: '下一步', content: '您可以: 优化配方 / 调整用量 / 分析安全 / 确认方案' } })
      return blocks
    } catch (err: any) {
      return [{ type: 'callout', data: { variant: 'warning', title: '生成失败', content: '配方生成异常: ' + (err.message || '') } }]
    }
  }

  private handleReview(input: string): Array<{ type: string; data: any }> {
    const q = input.toLowerCase()
    if (q.includes('优化') || q.includes('改进') || q.includes('调')) {
      this.state = 'OPTIMIZE'; return this.handleOptimize(input)
    }
    if (q.includes('确认')) { this.state = 'FINALIZE'; return this.handleFinalize(input) }
    const extracted = this.extractSlots(input)
    if (extracted.effects && extracted.effects.length > 0) {
      this.state = 'GENERATE'; return this.handleGenerate(input)
    }
    return [{ type: 'callout', data: { variant: 'info', title: '指令说明', content: '优化配方 / 分析安全 / 增加成分 / 确认方案' } }]
  }

  private handleOptimize(_input: string): Array<{ type: string; data: any }> {
    void _input;
    this.state = 'REVIEW'
    if (!this.currentFormula) return [{ type: 'callout', data: { variant: 'warning', title: '无配方', content: '请先设计一个配方' } }]
    try {
      const request = { targetEffects: this.slots.effects, constraints: this.slots.constraints, userProfile: this.slots.preferences }
      const formula = formulaDesignEngine.generateFormula(request)
      this.currentFormula = formula
      const blocks = formulaDesignEngine.toStructuredBlocks(formula)
      blocks.unshift({ type: 'header', data: { title: '优化配方', description: '基于原配方重新优化', level: 2 } })
      return blocks
    } catch { return [{ type: 'callout', data: { variant: 'warning', title: '优化失败', content: '请重试' } }] }
  }

  private handleFinalize(_input: string): Array<{ type: string; data: any }> {
    void _input;
    return [
      { type: 'header', data: { title: '配方已确认', description: '最终方案', level: 1 } },
      { type: 'callout', data: { variant: 'summary', title: '方案总结', content: '您的专属配方已设计完成。建议小试验证后再批量生产。' } },
    ]
  }

  getState(): DialogueState { return this.state }
  getSlots(): SlotGroup { return { ...this.slots } }
  getHistory(): DialogueTurn[] { return [...this.history] }
  reset(): void { this.state = 'INIT'; this.slots = this.emptySlots(); this.history = []; this.currentFormula = null }

  private calcConfidence(): number {
    let c = 0
    if (this.slots.effects.length > 0) c += 0.3
    if (Object.keys(this.slots.constraints).length > 0) c += 0.2
    if (this.currentFormula) c += 0.3
    return Math.min(1, c)
  }
}

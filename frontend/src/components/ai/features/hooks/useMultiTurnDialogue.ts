import { useState, useCallback, useRef } from 'react'

// ===== 内联类型定义（避免 ai.types.ts 导出问题）=====
interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  formulas?: {
    name: string
    value: number
    unit?: string
    confidence?: number
  }[]
  isLoading?: boolean
  error?: string
}

interface Topic {
  id: string
  title: string
  type: 'formula-design' | 'safety-review' | 'cost-analysis' | 'general-qna' | 'regulatory-query' | 'quality-control'
  context: TopicContext
  parentTopicId?: string
  childTopics: string[]
  createdAt: number
  updatedAt: number
  status: 'active' | 'paused' | 'completed' | 'abandoned'
}

interface TopicContext {
  mainQuery: string
  relatedEntities: string[]
  keyParameters: Record<string, string>
  constraints: string[]
}

interface Reference {
  id: string
  text: string
  resolvedText: string
  resolvedAt: number
  messageId: string
  /** 实体类型：用于基于类型的智能指代绑定 */
  entityType?: 'ingredient' | 'formula' | 'dosage' | 'effect' | 'product' | 'safety' | 'cost' | 'regulation' | 'general'
  /** 在对话中的位置序号（0=最早，越大越近） */
  positionIndex?: number
}

interface DialogueState {
  activeTopic: Topic | undefined
  topicStack: Topic[]
  recentReferences: Map<string, Reference>
  unresolvedReferences: Reference[]
  actionQueue: PendingAction[]
  conversationTurns: ConversationTurn[]
  maxContextSize: number
}

interface ConversationTurn {
  id: string
  messages: { user: ChatMessage; ai: ChatMessage }
  topicId: string
  status: 'active' | 'paused' | 'completed'
  createdAt: number
  updatedAt: number
  summary?: string
}

interface PendingAction {
  id: string
  type: 'send_message' | 'switch_topic' | 'fetch_context' | 'generate_summary'
  payload: any
  priority: number
  createdAt: number
}

const MAX_CONTEXT_SIZE = 50
const MAX_TOPIC_STACK_DEPTH = 5

class MultiTurnDialogueManager {
  private state: DialogueState

  constructor() {
    this.state = {
      activeTopic: undefined,
      topicStack: [],
      recentReferences: new Map(),
      unresolvedReferences: [],
      actionQueue: [],
      conversationTurns: [],
      maxContextSize: MAX_CONTEXT_SIZE,
    }
  }

  async processUserInput(
    userInput: string,
    currentMessages: ChatMessage[],
    detectIntent?: (text: string) => Promise<{ intent: string; confidence: number }>,
  ): Promise<ProcessResult> {
    const startTime = performance.now()

    const resolvedInput = this.resolveReferences(userInput)

    let topicUpdate: TopicUpdate

    if (detectIntent) {
      const intentResult = await detectIntent(resolvedInput)
      topicUpdate = this.trackTopic(resolvedInput, intentResult.intent)
    } else {
      topicUpdate = this.trackTopic(resolvedInput)
    }

    const context = this.assembleContext(topicUpdate)

    return {
      resolvedInput,
      topicUpdate,
      context,
      processingTime: performance.now() - startTime,
    }
  }

  /**
   * 增强型指代消解 — 支持基于实体类型的智能绑定、多指代、远距离引用
   *
   * 消解策略（按优先级）：
   *   1. 序数指代："第一个/第二个/最后一个/上一个" → 按positionIndex选择
   *   2. 类型绑定指代："这个配方/那味药/该成分" → 匹配entityType的最近引用
   *   3. 近距代词："它/这个/那个" → 最近的一个引用
   *   4. 远距离引用："最开始说的那个方案"、"3轮之前提到的XX" → 向前搜索
   */
  private resolveReferences(text: string): string {
    let resolved = text

    // 将 recentReferences 转为有序数组（按时间倒序，最近的在前）
    const orderedRefs = Array.from(this.state.recentReferences.values())
      .sort((a, b) => b.resolvedAt - a.resolvedAt)
      .map((ref, idx) => ({ ...ref, positionIndex: idx }))

    if (orderedRefs.length === 0) return resolved

    // ── 策略1: 序数指代消解 ──
    resolved = resolved.replace(/(第[一二三四五六七八九十\d]+个?)(配方|方案|成分|药材|原料|产品|建议|方法)/gi,
      (_, ordinal, noun) => {
        const idx = this.parseOrdinal(ordinal) // "一"→0, "二"→1, "1"→0, "2"→1...
        if (idx >= 0 && idx < orderedRefs.length) {
          const ref = orderedRefs[idx]
          this.markReferenceResolved(ref.id)
          return ref.resolvedText + noun
        }
        return `${ordinal}${noun}`
      }
    )

    // ── 策略2: 类型绑定指代消解 ──
    const typeBindingPatterns: [RegExp, Reference['entityType']][] = [
      [/(这|那|该)(配方|方案|产品|饮品|制剂)/gi, 'formula'],
      [/(这|那|该)(味?|种?)(药材|原料|成分|中药|草本|提取物)/gi, 'ingredient'],
      [/(这|那|该)(个?)(剂量|用量|浓度|比例|配比)/gi, 'dosage'],
      [/(这|那|该)(个?)(功效|作用|效果|功能|益处)/gi, 'effect'],
      [/(这|那|该)(个?)(安全性|风险|副作用|禁忌|毒性)/gi, 'safety'],
      [/(这|那|该)(个?)(成本|价格|预算|费用)/gi, 'cost'],
      [/(这|那|该)(个?)(标准|法规|规定|合规)/gi, 'regulation'],
    ]

    for (const [pattern, type] of typeBindingPatterns) {
      const typeRefs = orderedRefs.filter(r => r.entityType === type)
      if (typeRefs.length > 0) {
        const targetRef = typeRefs[0] // 最近的同类型引用
        resolved = resolved.replace(pattern, targetRef.resolvedText)
        this.markReferenceResolved(targetRef.id)
      }
    }

    // ── 策略3: 近距通用代词消解（仅当策略2未处理时）──
    if (orderedRefs.length > 0) {
      const nearestRef = orderedRefs[0]

      // 处理"它"
      resolved = resolved.replace(/\b它\b/g, nearestRef.resolvedText)

      // 处理"这个"/"那个"（不跟名词的裸代词）
      resolved = resolved.replace(/(?<![a-zA-Z\u4e00-\u9fa5])(这个|那个)(?![a-zA-Z\u4e00-\u9fa5])/g, nearestRef.resolvedText)

      // 处理"上面那个"
      resolved = resolved.replace(/上面那个/g, nearestRef.resolvedText)

      if (resolved !== text) {
        this.markReferenceResolved(nearestRef.id)
      }
    }

    // ── 策略4: 远距离引用消解 ──
    const farRefPatterns: [RegExp, number][] = [
      [/(最开始|最初|第一次|最前面).*(?:说|提|讲|问|提到)/gi, 0],           // 最远的
      [/(之前|前面|刚才|早些).*(?:说|提|讲|问|提到)/gi, Math.min(2, orderedRefs.length - 1)],  // 较远的
      [/(上一轮|上一次|前一次).*(?:说|提|讲|问|提到)/gi, Math.min(1, orderedRefs.length - 1)],  // 前一轮的
    ]

    for (const [pattern, offsetIdx] of farRefPatterns) {
      if (offsetIdx < orderedRefs.length) {
        const farRef = orderedRefs[offsetIdx]
        resolved = resolved.replace(pattern, farRef.resolvedText)
        this.markReferenceResolved(farRef.id)
      }
    }

    this.detectNewReferences(resolved)
    return resolved
  }

  /** 解析中文/阿拉伯数字序数为0-based索引 */
  private parseOrdinal(ordinal: string): number {
    const cnMap: Record<string, number> = { '一': 0, '二': 1, '三': 2, '四': 3, '五': 4, '六': 5, '七': 6, '八': 7, '九': 8, '十': 9, '首': 0, '末': -1 }
    const match = ordinal.match(/[一二三四五六七八九十首末]/)
    if (match && match[0] in cnMap) return cnMap[match[0]]
    const numMatch = ordinal.match(/\d+/)
    if (numMatch) return parseInt(numMatch[0], 10) - 1
    return -1
  }

  private detectNewReferences(text: string): void {
    const patterns = [
      { pattern: /"([^"]+)"/g, type: 'quoted' as const },
      { pattern: /([A-Z][a-zA-Z0-9]+)/g, type: 'identifier' as const },
      { pattern: /(GB\s*[\d.]+|ISO\s*\d+)/g, type: 'standard' as const },
    ]

    patterns.forEach(({ pattern }) => {
      const matches = [...text.matchAll(pattern)]
      matches.forEach(match => {
        const refId = `ref-${Date.now()}-${Math.random().toString(36).slice(2)}`

        // 实体类型推断
        let inferredType: Reference['entityType'] = 'general'
        const matchedText = match[0]

        if (/配方|方案|产品|饮品|制剂|固体饮料|胶囊/.test(matchedText)) inferredType = 'formula'
        else if (/黄芪|人参|枸杞|当归|甘草|肽|蛋白|提取物|原料|药材/.test(matchedText)) inferredType = 'ingredient'
        else if (/\d+(\.\d+)?\s*(g|mg|ml|kg|%|ppm)/i.test(matchedText)) inferredType = 'dosage'
        else if (/功效|作用|降血糖|降血压|抗氧化|免疫|改善/.test(matchedText)) inferredType = 'effect'
        else if (/GB\s*\d+|ISO|法规|标准|安全|毒性|副作用/.test(matchedText)) inferredType = 'safety'
        else if (/成本|价格|元|预算|费用|便宜|贵/.test(matchedText)) inferredType = 'cost'

        const reference: Reference = {
          id: refId,
          text: match[0],
          resolvedText: match[1] || match[0],
          resolvedAt: Date.now(),
          messageId: '',
          entityType: inferredType,
          positionIndex: this.state.unresolvedReferences.length,
        }

        this.state.unresolvedReferences.push(reference)
      })
    })
  }

  private markReferenceResolved(refId: string): void {
    const index = this.state.unresolvedReferences.findIndex(r => r.id === refId)
    if (index >= 0) {
      const [resolved] = this.state.unresolvedReferences.splice(index, 1)
      this.state.recentReferences.set(resolved.id, resolved)

      if (this.state.recentReferences.size > 20) {
        const firstKey = this.state.recentReferences.keys().next().value
        if (firstKey) {
          this.state.recentReferences.delete(firstKey)
        }
      }
    }
  }

  private trackTopic(
    text: string,
    intent?: string,
  ): TopicUpdate {
    const isTopicSwitch = this.isTopicSwitchSignal(text)
    const isTopicReturn = this.isTopicReturnSignal(text)

    if (isTopicReturn && this.state.topicStack.length > 0) {
      const previousTopic = this.state.topicStack.pop()!
      this.state.activeTopic = previousTopic
      previousTopic.status = 'active'

      return {
        type: 'return',
        to: previousTopic,
      }
    }

    if (isTopicSwitch || !this.state.activeTopic) {
      const newTopic = this.createTopicFromInput(text, intent)

      if (this.state.activeTopic) {
        this.state.topicStack.push(this.state.activeTopic)
        this.state.activeTopic.status = 'paused'
      }

      this.state.activeTopic = newTopic

      return {
        type: 'switch',
        from: this.state.topicStack[this.state.topicStack.length - 1],
        to: newTopic,
      }
    }

    if (this.state.activeTopic) {
      this.state.activeTopic.updatedAt = Date.now()
      this.updateTopicContext(this.state.activeTopic, text)
    }

    return {
      type: 'continue',
      topic: this.state.activeTopic,
    }
  }

  private isTopicSwitchSignal(text: string): boolean {
    const switchPatterns = [
      /^(另外|还有|接下来|换个|新的|关于).*/gi,
      /^(我们讨论一下|我想了解|请帮我).*(配方|安全性|成本|法规|质量)/gi,
      /^切换到.*/gi,
      /^新话题/gi,
    ]

    return switchPatterns.some(pattern => pattern.test(text))
  }

  private isTopicReturnSignal(text: string): boolean {
    const returnPatterns = [
      /^(回到|继续|接着讨论|刚才那个|之前说的).*/gi,
      /^(继续讨论).*配方/gi,
      /^回到.*话题/gi,
    ]

    return returnPatterns.some(pattern => pattern.test(text))
  }

  private createTopicFromInput(text: string, intent?: string): Topic {
    const topicType = this.inferTopicType(intent)
    const title = this.generateTopicTitle(text, topicType)

    return {
      id: `topic-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      type: topicType,
      context: {
        mainQuery: text.slice(0, 100),
        relatedEntities: [],
        keyParameters: {},
        constraints: [],
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'active',
      childTopics: [],
    }
  }

  private inferTopicType(intent?: string): Topic['type'] {
    const intentToTypeMap: Record<string, Topic['type']> = {
      'FORMULA_DESIGN': 'formula-design',
      'SAFETY_ASSESSMENT': 'safety-review',
      'COST_ANALYSIS': 'cost-analysis',
      'EFFICACY_EVALUATION': 'general-qna',
      'INGREDIENT_QUERY': 'general-qna',
      'REGULATORY_QUERY': 'regulatory-query',
      'QUALITY_CONTROL': 'quality-control',
      'FORMULA_OPTIMIZATION': 'formula-design',
      'general_inquiry': 'general-qna',
    }

    return intentToTypeMap[intent || ''] || 'general-qna'
  }

  private generateTopicTitle(text: string, type: Topic['type']): string {
    const maxLength = 30

    if (text.length <= maxLength) {
      return text
    }

    const typePrefixes: Record<Topic['type'], string> = {
      'formula-design': '配方设计：',
      'safety-review': '安全评估：',
      'cost-analysis': '成本分析：',
      'general-qna': '咨询：',
      'regulatory-query': '法规查询：',
      'quality-control': '质量控制：',
    }

    return `${typePrefixes[type]}${text.slice(0, maxLength - typePrefixes[type].length)}...`
  }

  private updateTopicContext(topic: Topic, text: string): void {
    topic.context.relatedEntities = [
      ...new Set([...topic.context.relatedEntities, ...this.extractEntities(text)]),
    ].slice(0, 10)
  }

  private extractEntities(text: string): string[] {
    const entities: string[] = []

    const formulaPattern = /([\u4e00-\u9fa5]+配方)/gi
    const ingredientPattern = /(?:用量|添加|使用)([\u4e00-\u9fa5]{2,8})/gi
    const standardPattern = /(GB\s*[\d.]+|ISO\s*\d+)/gi

    ;[formulaPattern, ingredientPattern, standardPattern].forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        entities.push(...matches)
      }
    })

    return entities
  }

  assembleContext(update?: TopicUpdate): AssembledContext {
    const workingMemory = this.getRecentWorkingMemory()
    const shortTermMemory = this.getShortTermMemorySummary()

    return {
      systemPrompt: this.getSystemPrompt(),
      workingMemory,
      shortTermMemory,
      currentTopic: update?.topic || update?.to || this.state.activeTopic,
      unresolvedItems: this.state.unresolvedReferences,
      topicHistory: this.state.topicStack.map(t => t.title),
    }
  }

  private getRecentWorkingMemory(): string {
    const recentTurns = this.state.conversationTurns.slice(-5)

    return recentTurns.map(turn => {
      const userPreview = turn.messages.user.content.slice(0, 80)
      const aiPreview = turn.messages.ai.content.slice(0, 80)
      return `[${turn.status}] User: ${userPreview}\nAI: ${aiPreview}`
    }).join('\n\n')
  }

  private getShortTermMemorySummary(): string {
    const topics = this.state.topicStack.length > 0
      ? `\n历史话题: ${this.state.topicStack.map(t => t.title).join(' → ')}`
      : ''

    const references = this.state.unresolvedReferences.length > 0
      ? `\n未解析引用: ${this.state.unresolvedReferences.map(r => r.text).join(', ')}`
      : ''

    return `${topics}${references}`
  }

  private getSystemPrompt(): string {
    return `你是一位专业的配方设计专家助手。请基于提供的上下文信息回答用户的问题。

当前能力：
- 配方设计与优化
- 安全性评估（毒理学、法规合规）
- 成本分析与控制
- 功效评估与功能声称
- 原料信息查询
- 法规标准解读
- 质量控制体系

回答要求：
1. 专业准确，引用相关标准和法规
2. 结构清晰，分点陈述
3. 提供具体数值和建议
4. 如有不确定性，明确说明`
  }

  getActiveTopic(): Topic | undefined {
    return this.state.activeTopic
  }

  getTopicStack(): Topic[] {
    return [...this.state.topicStack]
  }

  startNewTopic(title?: string): Topic {
    const newTopic: Topic = {
      id: `topic-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: title || '新对话',
      type: 'general-qna',
      context: {
        mainQuery: '',
        relatedEntities: [],
        keyParameters: {},
        constraints: [],
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'active',
      childTopics: [],
    }

    if (this.state.activeTopic) {
      this.state.topicStack.push(this.state.activeTopic)
      this.state.activeTopic.status = 'paused'
    }

    this.state.activeTopic = newTopic

    return newTopic
  }

  switchToTopic(topicId: string): boolean {
    const targetIndex = this.state.topicStack.findIndex(t => t.id === topicId)

    if (targetIndex >= 0) {
      if (this.state.activeTopic) {
        this.state.topicStack.push(this.state.activeTopic)
        this.state.activeTopic.status = 'paused'
      }

      const [target] = this.state.topicStack.splice(targetIndex, 1)
      target.status = 'active'
      this.state.activeTopic = target

      return true
    }

    return false
  }

  addConversationTurn(userMsg: ChatMessage, aiMsg: ChatMessage): void {
    const turn: ConversationTurn = {
      id: `turn-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      messages: { user: userMsg, ai: aiMsg },
      topicId: this.state.activeTopic?.id || '',
      status: 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.state.conversationTurns.push(turn)

    if (this.state.conversationTurns.length > MAX_CONTEXT_SIZE) {
      this.state.conversationTurns.shift()
    }
  }

  clear(): void {
    this.state = {
      activeTopic: undefined,
      topicStack: [],
      recentReferences: new Map(),
      unresolvedReferences: [],
      actionQueue: [],
      conversationTurns: [],
      maxContextSize: MAX_CONTEXT_SIZE,
    }
  }

  getStats(): {
    activeTopic: Topic | undefined
    stackDepth: number
    turnsCount: number
    referencesCount: number
    unresolvedCount: number
  } {
    return {
      activeTopic: this.state.activeTopic,
      stackDepth: this.state.topicStack.length,
      turnsCount: this.state.conversationTurns.length,
      referencesCount: this.state.recentReferences.size,
      unresolvedCount: this.state.unresolvedReferences.length,
    }
  }
}

interface ProcessResult {
  resolvedInput: string
  topicUpdate: TopicUpdate
  context: AssembledContext
  processingTime: number
}

interface TopicUpdate {
  type: 'switch' | 'return' | 'continue'
  from?: Topic
  to?: Topic
  topic?: Topic
}

interface AssembledContext {
  systemPrompt: string
  workingMemory: string
  shortTermMemory: string
  currentTopic?: Topic
  unresolvedItems: Reference[]
  topicHistory: string[]
}

export const multiTurnDialogueManager = new MultiTurnDialogueManager()

export function useMultiTurnDialogue() {
  const [, forceUpdate] = useState(0)
  const updateRef = useRef(0)

  const processUserInput = useCallback(async (
    userInput: string,
    currentMessages: ChatMessage[],
    detectIntent?: (text: string) => Promise<{ intent: string; confidence: number }>,
  ) => {
    const result = await multiTurnDialogueManager.processUserInput(userInput, currentMessages, detectIntent)
    updateRef.current++
    forceUpdate(updateRef.current)
    return result
  }, [])

  const getActiveTopic = useCallback(() => {
    return multiTurnDialogueManager.getActiveTopic()
  }, [])

  const getTopicStack = useCallback(() => {
    return multiTurnDialogueManager.getTopicStack()
  }, [])

  const startNewTopic = useCallback((title?: string) => {
    const topic = multiTurnDialogueManager.startNewTopic(title)
    forceUpdate(Date.now())
    return topic
  }, [])

  const switchToTopic = useCallback((topicId: string) => {
    const success = multiTurnDialogueManager.switchToTopic(topicId)
    if (success) forceUpdate(Date.now())
    return success
  }, [])

  const addConversationTurn = useCallback((userMsg: ChatMessage, aiMsg: ChatMessage) => {
    multiTurnDialogueManager.addConversationTurn(userMsg, aiMsg)
  }, [])

  const clearDialogue = useCallback(() => {
    multiTurnDialogueManager.clear()
    forceUpdate(Date.now())
  }, [])

  const getStats = useCallback(() => {
    return multiTurnDialogueManager.getStats()
  }, [])

  return {
    processUserInput,
    getActiveTopic,
    getTopicStack,
    startNewTopic,
    switchToTopic,
    addConversationTurn,
    clearDialogue,
    getStats,
  }
}

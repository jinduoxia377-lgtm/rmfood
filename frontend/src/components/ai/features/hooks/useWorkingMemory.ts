import { useState, useCallback } from 'react'
import { unifiedEntityExtractor } from '../services/unifiedEntityExtractor'

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

interface IntentTrace {
  intent: string
  confidence: number
  timestamp: number
  messageId: string
}

interface Entity {
  type: 'formula' | 'ingredient' | 'dosage' | 'regulation' | 'general'
  value: string
  confidence: number
  lastMentioned: number
  mentionCount: number
}

interface PendingTask {
  id: string
  description: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  createdAt: number
  sourceMessageId: string
}

interface ConversationContext {
  currentTopic: string
  topicHistory: string[]
  activeEntities: Entity[]
  recentIntents: IntentTrace[]
  pendingTasks: PendingTask[]
  userPreferences: {
    responseStyle: 'concise' | 'detailed' | 'academic'
    technicalDepth: 'basic' | 'intermediate' | 'advanced'
  }
  /** 否定约束：用户明确排除的原料/成分/条件 */
  negativeConstraints: NegativeConstraint[]
  /** 错误纠正记录：用户说"不对，我指的是XX" */
  corrections: CorrectionRecord[]
}

/** 否定约束（如"不要含蜂蜜"、"避开孕妇禁忌原料"） */
interface NegativeConstraint {
  id: string
  type: 'exclude_ingredient' | 'exclude_allergen' | 'limit_dosage' | 'avoid_population' | 'custom'
  content: string          // 约束内容（如"蜂蜜"、"花生"、"孕妇"）
  sourceMessageId: string   // 来源消息ID
  createdAt: number
}

/** 错误纠正记录（用户纠正系统的理解错误） */
interface CorrectionRecord {
  id: string
  wrongText: string        // 系统之前错误理解的内容
  correctText: string      // 用户指出的正确内容
  sourceMessageId: string
  createdAt: number
}

const MAX_MESSAGES = 100
const MAX_INTENT_HISTORY = 50
const MAX_ENTITIES = 20
const MAX_PENDING_TASKS = 10
const MAX_CONSTRAINTS = 15      // 最大否定约束数
const MAX_CORRECTIONS = 20      // 最大纠正记录数

class CircularBuffer<T> {
  private buffer: (T | null)[]
  private head = 0
  private tail = 0
  private _size = 0

  constructor(private capacity: number) {
    this.buffer = new Array(capacity).fill(null)
  }

  push(item: T): void {
    this.buffer[this.tail] = item
    this.tail = (this.tail + 1) % this.capacity

    if (this._size === this.capacity) {
      this.head = (this.head + 1) % this.capacity
    } else {
      this._size++
    }
  }

  toArray(): T[] {
    const result: T[] = []
    let current = this.head

    for (let i = 0; i < this._size; i++) {
      if (this.buffer[current] !== null) {
        result.push(this.buffer[current]!)
      }
      current = (current + 1) % this.capacity
    }

    return result
  }

  get size(): number {
    return this._size
  }

  get isEmpty(): boolean {
    return this._size === 0
  }

  clear(): void {
    this.buffer.fill(null)
    this.head = 0
    this.tail = 0
    this._size = 0
  }

  getLatest(n = 1): T[] {
    const result: T[] = []
    let current = this.tail === 0 ? this.capacity - 1 : this.tail - 1

    for (let i = 0; i < Math.min(n, this._size); i++) {
      if (this.buffer[current] !== null) {
        result.unshift(this.buffer[current]!)
      }
      current = current === 0 ? this.capacity - 1 : current - 1
    }

    return result
  }
}

class WorkingMemoryManager {
  private messages: CircularBuffer<ChatMessage>
  private intents: CircularBuffer<IntentTrace>
  private entities = new Map<string, Entity>()
  private tasks: CircularBuffer<PendingTask>
  private context: ConversationContext

  constructor() {
    this.messages = new CircularBuffer(MAX_MESSAGES)
    this.intents = new CircularBuffer(MAX_INTENT_HISTORY)
    this.tasks = new CircularBuffer(MAX_PENDING_TASKS)

    this.context = {
      currentTopic: '未定义',
      topicHistory: [],
      activeEntities: [],
      recentIntents: [],
      pendingTasks: [],
      userPreferences: {
        responseStyle: 'detailed',
        technicalDepth: 'intermediate',
      },
      negativeConstraints: [],
      corrections: [],
    }
  }

  addMessage(message: ChatMessage): void {
    this.messages.push(message)

    const extractedEntities = this.extractEntitiesFromMessage(message)
    this.mergeEntities(extractedEntities)

    if (message.role === 'user') {
      this.detectAndTrackTasks(message.content, message.id)
      // 检测否定约束和错误纠正
      this.detectConstraints(message.content, message.id)
      this.detectCorrections(message.content, message.id)
    }
  }

  addIntent(intent: IntentTrace): void {
    this.intents.push(intent)
    this.updateContextFromIntent(intent)
  }

  /** 检测用户消息中的否定约束（"不要XX"、"不含XX"、"避开XX"） */
  private detectConstraints(text: string, messageId: string): void {
    const constraintPatterns: { pattern: RegExp; type: NegativeConstraint['type'] }[] = [
      { pattern: /(不要|不含|不用|无需|排除|去掉|避免|避开|禁止|不能有|不可含)\s*([\u4e00-\u9fa5]{2,8})/g, type: 'exclude_ingredient' },
      { pattern: /(不(?:要|含|用)|无|零)(?:蜂蜜|花生|牛奶|鸡蛋|麸质|酒精|咖啡因)/gi, type: 'exclude_allergen' },
      { pattern: /(孕妇|哺乳期|婴幼儿|儿童|老人)/gi, type: 'avoid_population' },
      { pattern: /(不超过|少于|低于|限制在|控制在)\s*(\d+(\.\d+)?\s*\w*)/g, type: 'limit_dosage' },
    ]

    for (const { pattern, type } of constraintPatterns) {
      const matches = text.matchAll(pattern)
      for (const m of matches) {
        let content = m[2] || m[0].replace(/^(不要|不含|不用|无需|排除|去掉|避免|避开|禁止|不能有|不可含|无|零)/, '')
        // P0修复：约束内容净化 — 过滤控制字符和超长内容，防止 Prompt 注入
        if (content && content.length >= 1) {
          content = content
            .replace(/[\n\r\t]/g, ' ')
            .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s%\.\/\-]/g, '')
            .trim()
            .slice(0, 20)
          if (content.length === 0) continue

          const constraint: NegativeConstraint = {
            id: `const-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type,
            content,
            sourceMessageId: messageId,
            createdAt: Date.now(),
          }
          this.context.negativeConstraints.push(constraint)
          // 超限时淘汰最早的
          if (this.context.negativeConstraints.length > MAX_CONSTRAINTS) {
            this.context.negativeConstraints.shift()
          }
        }
      }
    }
  }

  /** 检测用户的错误纠正（"不对"、"不是"、"我指的是"） */
  private detectCorrections(text: string, messageId: string): void {
    const correctionPatterns = [
      /不对(，|,|：|:)\s*(.+)/gi,
      /不是(.+?)(?:是|叫|称为|指的是)/gi,
      /我(指的|说的是|想问的是|意思是)(.+)/gi,
      /更正(一下)?[:：]\s*(.+)/gi,
      /纠正(一下)?[:：]\s*(.+)/gi,
    ]

    for (const pattern of correctionPatterns) {
      const match = pattern.exec(text)
      if (match && match[1]) {
        // 从最近的消息中推断系统之前可能错误理解的内容
        const recentMsgs = this.messages.toArray().filter(m => m.role === 'assistant').slice(-3)
        const wrongText = recentMsgs.length > 0
          ? recentMsgs[recentMsgs.length - 1].content.slice(0, 50)
          : '理解偏差'

        const correction: CorrectionRecord = {
          id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          wrongText,
          correctText: match[1].trim(),
          sourceMessageId: messageId,
          createdAt: Date.now(),
        }
        this.context.corrections.push(correction)

        if (this.context.corrections.length > MAX_CORRECTIONS) {
          this.context.corrections.shift()
        }
        break // 每条消息最多检测到一个纠正
      }
    }
  }

  /** 获取当前否定约束摘要（用于 Prompt 注入） */
  getConstraintSummary(): string {
    const constraints = this.context.negativeConstraints
    if (constraints.length === 0) return ''

    const byType = new Map<string, string[]>()
    for (const c of constraints) {
      const list = byType.get(c.type) || []
      list.push(c.content)
      byType.set(c.type, list)
    }

    const parts: string[] = []
    for (const [type, items] of byType) {
      const typeLabel: Record<string, string> = {
        exclude_ingredient: '排除原料',
        exclude_allergen: '过敏原规避',
        limit_dosage: '剂量限制',
        avoid_population: '人群禁忌',
        custom: '其他约束',
      }
      parts.push(`${typeLabel[type] || type}: ${items.join('、')}`)
    }
    return `【用户约束】${parts.join('；')}`
  }

  /** 获取最近的纠正记录 */
  getRecentCorrections(count = 3): CorrectionRecord[] {
    return this.context.corrections.slice(-count)
  }

  private extractEntitiesFromMessage(message: ChatMessage): Entity[] {
    const entities: Entity[] = []
    const text = message.content
    const now = Date.now()

    // ===== 主管道：UnifiedEntityExtractor（12类实体 × 120词条 × 3阶段）=====
    try {
      const unifiedResults = unifiedEntityExtractor.extract(text)
      if (unifiedResults.entities.length > 0) {
        // 类型映射：统一类型 → WM内部类型
        const typeMapping: Record<string, Entity['type']> = {
          ingredient: 'ingredient',
          formula: 'formula',
          dosage: 'dosage',
          regulation: 'regulation',
          efficacy: 'general',
          safety: 'general',
          allergen: 'general',
          population: 'general',
          process: 'general',
          storage: 'general',
          source: 'general',
          cost: 'general',
        }

        for (const ue of unifiedResults.entities) {
          entities.push({
            type: typeMapping[ue.type] || 'general',
            value: ue.text,
            confidence: ue.confidence,
            lastMentioned: now,
            mentionCount: 1,
          })
        }

        // 如果统一抽取已覆盖充分，直接返回（跳过旧regex）
        if (entities.length >= 2) {
          return entities
        }
      }
    } catch (err) {
      // 统一抽取失败时降级到下方 regex 兜底
      console.warn('[WorkingMemory] UnifiedEntityExtractor 异常，降级到 regex:', err)
    }

    // ===== 兜底：原有 regex 模式（仅当统一抽取结果不足时）=====
    const lowerText = text.toLowerCase()

    const formulaPatterns = [
      /([\u4e00-\u9fa5]+配方)/gi,
      /([\u4e00-\u9fa5]+\d*号?配方)/gi,
    ]

    for (const pattern of formulaPatterns) {
      const matches = lowerText.match(pattern)
      if (matches) {
        matches.forEach(match => {
          // 去重：避免与统一抽取结果重复
          if (!entities.some(e => e.value === match)) {
            entities.push({
              type: 'formula',
              value: match,
              confidence: 0.8,
              lastMentioned: now,
              mentionCount: 1,
            })
          }
        })
      }
    }

    const ingredientPattern = /([\u4e00-\u9fa5]{2,8})(?=\s*\d*\.?\d*\s*(?:g|mg|ml|kg|%|ppm))/gi
    const ingredientMatches = [...lowerText.matchAll(ingredientPattern)]
    ingredientMatches.forEach(match => {
      if (match[1] && !entities.some(e => e.value === match[1])) {
        entities.push({
          type: 'ingredient',
          value: match[1],
          confidence: 0.75,
          lastMentioned: now,
          mentionCount: 1,
        })
      }
    })

    return entities
  }

  private mergeEntities(newEntities: Entity[]): void {
    newEntities.forEach(entity => {
      const key = `${entity.type}:${entity.value}`
      const existing = this.entities.get(key)

      if (existing) {
        existing.lastMentioned = entity.lastMentioned
        existing.mentionCount++
        existing.confidence = Math.min(existing.confidence + 0.05, 1.0)
      } else {
        if (this.entities.size < MAX_ENTITIES) {
          this.entities.set(key, entity)
        }
      }
    })

    this.context.activeEntities = Array.from(this.entities.values())
      .sort((a, b) => b.lastMentioned - a.lastMentioned)
      .slice(0, 10)
  }

  private detectAndTrackTasks(content: string, messageId: string): void {
    const taskPatterns = [
      { pattern: /帮我|请|需要|想要/gi, priority: 'medium' as const },
      { pattern: /设计.*配方|开发.*方案/gi, priority: 'high' as const },
      { pattern: /检查|评估|分析|验证/gi, priority: 'high' as const },
      { pattern: /查找|查询|搜索/gi, priority: 'low' as const },
    ]

    for (const { pattern, priority } of taskPatterns) {
      if (pattern.test(content)) {
        const task: PendingTask = {
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          description: content.slice(0, 50),
          priority,
          status: 'pending',
          createdAt: Date.now(),
          sourceMessageId: messageId,  // P0修复：传入实际消息ID（原为空字符串）
        }

        this.tasks.push(task)
        break
      }
    }

    this.context.pendingTasks = this.tasks.toArray()
  }

  private updateContextFromIntent(intent: IntentTrace): void {
    this.context.recentIntents = this.intents.toArray()

    const intentCounts = new Map<string, number>()
    this.context.recentIntents.forEach(i => {
      intentCounts.set(i.intent, (intentCounts.get(i.intent) || 0) + 1)
    })

    let dominantIntent = ''
    let maxCount = 0
    intentCounts.forEach((count, intent) => {
      if (count > maxCount) {
        maxCount = count
        dominantIntent = intent
      }
    })

    if (dominantIntent && maxCount >= 3) {
      if (!this.context.topicHistory.includes(dominantIntent)) {
        this.context.topicHistory.push(dominantIntent)
      }
      this.context.currentTopic = dominantIntent
    }
  }

  getContextSummary(maxTokens = 2000): string {
    const recentMessages = this.messages.getLatest(10)
    const activeEntities = this.context.activeEntities.slice(0, 5)
    const recentIntents = this.context.recentIntents.slice(-5)
    const pendingTasks = this.context.pendingTasks.filter(t => t.status !== 'completed')

    let summary = `## 当前对话上下文\n\n`

    summary += `### 当前主题\n${this.context.currentTopic}\n\n`

    if (activeEntities.length > 0) {
      summary += `### 活跃实体\n`
      activeEntities.forEach(entity => {
        summary += `- ${entity.type}: ${entity.value} (提及${entity.mentionCount}次)\n`
      })
      summary += '\n'
    }

    if (recentIntents.length > 0) {
      summary += `### 近期意图\n`
      recentIntents.slice(-3).forEach(intent => {
        summary += `- ${intent.intent} (${(intent.confidence * 100).toFixed(0)}%)\n`
      })
      summary += '\n'
    }

    if (pendingTasks.length > 0) {
      summary += `### 待办任务\n`
      pendingTasks.slice(0, 3).forEach(task => {
        summary += `- [${task.status}] ${task.description}\n`
      })
      summary += '\n'
    }

    if (recentMessages.length > 0) {
      summary += `### 最近消息摘要\n`
      recentMessages.slice(-5).forEach(msg => {
        const preview = msg.content.slice(0, 80)
        summary += `- [${msg.role}] ${preview}${msg.content.length > 80 ? '...' : ''}\n`
      })
    }

    return summary
  }

  getRecentMessages(count = 20): ChatMessage[] {
    return this.messages.getLatest(Math.min(count, MAX_MESSAGES))
  }

  getFullContext(): ConversationContext {
    return { ...this.context }
  }

  updateUserPreferences(preferences: Partial<ConversationContext['userPreferences']>): void {
    this.context.userPreferences = { ...this.context.userPreferences, ...preferences }
  }

  clear(): void {
    this.messages.clear()
    this.intents.clear()
    this.entities.clear()
    this.tasks.clear()
    this.context = {
      currentTopic: '未定义',
      topicHistory: [],
      activeEntities: [],
      recentIntents: [],
      pendingTasks: [],
      userPreferences: this.context.userPreferences,
      negativeConstraints: [],
      corrections: [],
    }
  }

  getStats(): {
    messagesCount: number
    intentsCount: number
    entitiesCount: number
    tasksCount: number
    cacheSize: number
  } {
    return {
      messagesCount: this.messages.size,
      intentsCount: this.intents.size,
      entitiesCount: this.entities.size,
      tasksCount: this.tasks.size,
      cacheSize: MAX_MESSAGES,
    }
  }
}

export const workingMemoryManager = new WorkingMemoryManager()

export function useWorkingMemory() {
  const [context, setContext] = useState<ConversationContext>(workingMemoryManager.getFullContext())

  const addMessage = useCallback((message: ChatMessage) => {
    workingMemoryManager.addMessage(message)
    // P0修复：统一使用 setContext 路径，消除 forceUpdate 竞态条件
    setContext(workingMemoryManager.getFullContext())
  }, [])

  const addIntent = useCallback((intent: IntentTrace) => {
    workingMemoryManager.addIntent(intent)
    setContext(workingMemoryManager.getFullContext())
  }, [])

  const getContextSummary = useCallback((maxTokens?: number) => {
    return workingMemoryManager.getContextSummary(maxTokens)
  }, [])

  const getRecentMessages = useCallback((count?: number) => {
    return workingMemoryManager.getRecentMessages(count)
  }, [])

  const clearMemory = useCallback(() => {
    workingMemoryManager.clear()
    setContext(workingMemoryManager.getFullContext())
  }, [])

  const updateUserPreferences = useCallback((prefs: Partial<ConversationContext['userPreferences']>) => {
    workingMemoryManager.updateUserPreferences(prefs)
    setContext(workingMemoryManager.getFullContext())
  }, [])

  const getStats = useCallback(() => {
    return workingMemoryManager.getStats()
  }, [])

  const getConstraintSummary = useCallback(() => {
    return workingMemoryManager.getConstraintSummary()
  }, [])

  const getRecentCorrections = useCallback(() => {
    return workingMemoryManager.getRecentCorrections()
  }, [])

  return {
    context,
    addMessage,
    addIntent,
    getContextSummary,
    getRecentMessages,
    clearMemory,
    updateUserPreferences,
    getStats,
    getConstraintSummary,
    getRecentCorrections,
  }
}

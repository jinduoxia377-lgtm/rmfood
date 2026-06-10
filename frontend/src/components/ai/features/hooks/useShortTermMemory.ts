import { logger } from '@/utils/safeLogger'
import { useState, useCallback, useRef, useEffect } from 'react'
import { sentimentEngine, EmotionResult } from '../services/sentimentEngine'

interface DailySummary {
  date: string
  summary: string
  keyTopics: string[]
  sentiment: 'positive' | 'negative' | 'neutral'
  messageCount: number
  formulaCount: number
  actionItems: string[]
}

interface InterestProfile {
  topic: string
  frequency: number
  lastAccessed: number
  relatedQueries: string[]
}

interface ShortTermMemory {
  dailySummaries: Map<string, DailySummary>
  recentInterests: InterestProfile[]
  faqCache: Map<string, string>
  maxSummaryDays: number
  maxInterests: number
  maxFAQCache: number
}

const DEFAULT_MEMORY: ShortTermMemory = {
  dailySummaries: new Map(),
  recentInterests: [],
  faqCache: new Map(),
  maxSummaryDays: 7,
  maxInterests: 20,
  maxFAQCache: 50,
}

class ShortTermMemoryManager {
  private memory: ShortTermMemory
  /** 当前会话的消息缓冲区，用于自动生成日摘要 */
  private sessionMessages: { role: string; content: string; timestamp: number }[] = []
  /** 自动摘要定时器句柄 */
  private autoSummaryTimer: ReturnType<typeof setInterval> | null = null
  /** 是否已注册页面卸载监听 */
  private unloadListenerRegistered = false
  /** 今日是否已生成摘要（避免重复） */
  private todaySummarized = false
  /** 当前日期字符串（用于跨日检测重置） */
  private currentDate: string = new Date().toISOString().split('T')[0]
  /** 引用计数：跟踪使用此单例的 hook 组件数量 */
  private refCount = 0
  /** 自动摘要间隔（毫秒），默认30分钟 */
  static readonly AUTO_SUMMARY_INTERVAL = 30 * 60 * 1000
  /** 触发自动摘要的最少消息数 */
  static readonly MIN_MESSAGES_FOR_SUMMARY = 3

  /** 预编译的主题关键词正则（避免每次 extractTopics 都重建） */
  private static readonly TOPIC_PATTERNS: { keyword: RegExp; topic: string }[] = [
    { keyword: /配方设计/gi, topic: '配方设计' },
    { keyword: /安全性/gi, topic: '安全性' },
    { keyword: /成本控制/gi, topic: '成本控制' },
    { keyword: /功效评估/gi, topic: '功效评估' },
    { keyword: /原料查询/gi, topic: '原料查询' },
    { keyword: /法规标准/gi, topic: '法规标准' },
    { keyword: /质量控制/gi, topic: '质量控制' },
    { keyword: /配方优化/gi, topic: '配方优化' },
    { keyword: /功能性食品/gi, topic: '功能性食品' },
    { keyword: /营养补充剂/gi, topic: '营养补充剂' },
    { keyword: /饮料/gi, topic: '饮料' },
    { keyword: /乳制品/gi, topic: '乳制品' },
  ]

  constructor() {
    this.memory = { ...DEFAULT_MEMORY }
    this.loadFromStorage()
    // 延迟注册：不在构造函数中立即注册定时器，改为按需激活
  }

  /**
   * 引用计数 +1（hook 组件 mount 时调用）
   * 首次 mount 时注册定时器和卸载监听
   */
  addRef(): void {
    this.refCount++
    if (this.refCount === 1) {
      this.setupAutoTrigger()
    }
  }

  /**
   * 引用计数 -1（hook 组件 unmount 时调用）
   * 计数归零时清理资源
   */
  releaseRef(): void {
    this.refCount--
    if (this.refCount <= 0) {
      this.refCount = 0
      this.destroy()
    }
  }

  /** 获取当前引用计数（调试用） */
  getRefCount(): number {
    return this.refCount
  }

  /**
   * 检查日期是否变更，若是则重置今日摘要标志
   */
  private checkDateReset(): void {
    const today = new Date().toISOString().split('T')[0]
    if (today !== this.currentDate) {
      this.currentDate = today
      this.todaySummarized = false
    }
  }

  /**
   * 设置自动触发机制：beforeunload + pagehide + 定时器
   */
  private setupAutoTrigger(): void {
    if (typeof window === 'undefined') return

    // 1. 页面卸载时自动保存日摘要（同步方式）
    if (!this.unloadListenerRegistered) {
      this.unloadListenerRegistered = true
      window.addEventListener('beforeunload', () => {
        this.triggerAutoSummarySync()
      })
      // 2. pagehide 事件（支持 persisted 状态和异步操作，现代浏览器推荐）
      window.addEventListener('pagehide', () => {
        this.triggerAutoSummarySync()
      })
    }

    // 3. 定时检查（每30分钟）
    if (!this.autoSummaryTimer) {
      this.autoSummaryTimer = setInterval(() => {
        this.checkAndTriggerAutoSummary()
      }, ShortTermMemoryManager.AUTO_SUMMARY_INTERVAL)
    }
  }

  /**
   * 同步版本：用于 beforeunload（必须同步完成）
   */
  private triggerAutoSummarySync(): void {
    const today = new Date().toISOString().split('T')[0]
    if (this.todaySummarized) return
    if (this.sessionMessages.length < ShortTermMemoryManager.MIN_MESSAGES_FOR_SUMMARY) return

    // 使用简化版同步摘要（避免 async 在 beforeunload 中失效）
    const userMsgs = this.sessionMessages.filter(m => m.role === 'user')
    if (userMsgs.length === 0) return

    const allText = userMsgs.map(m => m.content).join('\n')
    const topics = this.extractTopics(allText)
    const formulaCount = this.countFormulaMentions(allText)
    const sentimentResult = sentimentEngine.analyze(allText)

    const quickSummary: DailySummary = {
      date: today,
      summary: this.createEnhancedSummaryText(topics, sentimentResult, formulaCount, userMsgs.length),
      keyTopics: topics.slice(0, 5),
      sentiment: sentimentResult.polarity === 'positive' ? 'positive'
        : sentimentResult.polarity === 'negative' ? 'negative' : 'neutral',
      messageCount: this.sessionMessages.length,
      formulaCount,
      actionItems: this.extractActionItems(userMsgs).slice(0, 3),
    }

    this.memory.dailySummaries.set(today, quickSummary)
    this.todaySummarized = true

    // 同步写入 localStorage
    try {
      const data = {
        dailySummaries: Object.fromEntries(this.memory.dailySummaries),
        recentInterests: this.memory.recentInterests,
        faqCache: Object.fromEntries(this.memory.faqCache),
      }
      localStorage.setItem('short-term-memory', JSON.stringify(data))
      logger.log('[ShortTermMemory] ✅ 页面卸载时自动保存日摘要')
    } catch {
      // 静默失败
    }
  }

  /**
   * 异步版自动检查：定时器调用
   */
  private async checkAndTriggerAutoSummary(): Promise<void> {
    this.checkDateReset() // 跨日重置
    if (this.todaySummarized) return
    if (this.sessionMessages.length < ShortTermMemoryManager.MIN_MESSAGES_FOR_SUMMARY) return

    logger.log('[ShortTermMemory] 📋 定时器触发自动日摘要...')
    await this.endOfDayProcessing(this.sessionMessages)
    this.todaySummarized = true
  }

  /**
   * 记录消息到会话缓冲区（供 hook 调用）
   */
  recordMessage(role: string, content: string): void {
    if (!content || !content.trim()) return
    // 跨日检测：日期变更时重置摘要标志
    this.checkDateReset()
    this.sessionMessages.push({
      role,
      content: content.trim(),
      timestamp: Date.now(),
    })
    // 限制缓冲区大小，防止内存泄漏
    if (this.sessionMessages.length > 200) {
      this.sessionMessages = this.sessionMessages.slice(-150)
    }
  }

  /**
   * 清空会话消息缓冲区（切换会话或手动清除时调用）
   */
  clearSessionBuffer(): void {
    this.sessionMessages = []
    this.todaySummarized = false
  }

  async endOfDayProcessing(messages: { role: string; content: string; timestamp: number }[]): Promise<DailySummary> {
    const today = new Date().toISOString().split('T')[0]

    if (this.memory.dailySummaries.has(today)) {
      return this.memory.dailySummaries.get(today)!
    }

    const summary = await this.generateDailySummary(messages)

    this.memory.dailySummaries.set(today, summary)
    this.saveToStorage()

    return summary
  }

  private async generateDailySummary(
    messages: { role: string; content: string; timestamp: number }[],
  ): Promise<DailySummary> {
    const userMessages = messages.filter(m => m.role === 'user')
    const allText = userMessages.map(m => m.content).join('\n')

    const topics = this.extractTopics(allText)
    // 使用 SentimentEngine 替代原始关键词袋
    const sentimentResult: EmotionResult = sentimentEngine.analyze(allText)
    const formulaCount = this.countFormulaMentions(allText)
    const actionItems = this.extractActionItems(userMessages)

    return {
      date: new Date().toISOString().split('T')[0],
      summary: this.createEnhancedSummaryText(topics, sentimentResult, formulaCount, userMessages.length),
      keyTopics: topics.slice(0, 5),
      sentiment: sentimentResult.polarity === 'positive' ? 'positive'
        : sentimentResult.polarity === 'negative' ? 'negative' : 'neutral',
      messageCount: messages.length,
      formulaCount,
      actionItems: actionItems.slice(0, 3),
    }
  }

  private extractTopics(text: string): string[] {
    const topicKeywords = [
      '配方设计', '安全性', '成本控制', '功效评估',
      '原料查询', '法规标准', '质量控制', '配方优化',
      '功能性食品', '营养补充剂', '饮料', '乳制品',
    ]

    const foundTopics: { topic: string; count: number }[] = []

    topicKeywords.forEach(keyword => {
      const regex = new RegExp(keyword, 'gi')
      const matches = text.match(regex)
      if (matches && matches.length > 0) {
        foundTopics.push({ topic: keyword, count: matches.length })
      }
    })

    return foundTopics
      .sort((a, b) => b.count - a.count)
      .map(t => t.topic)
  }

  /**
   * 增强版摘要文本生成 — 使用 SentimentEngine 的细粒度结果
   */
  private createEnhancedSummaryText(
    topics: string[],
    sentimentResult: EmotionResult,
    formulaCount: number,
    userMsgCount: number,
  ): string {
    const topTopics = topics.slice(0, 3).join('、') || '通用咨询'

    // 情感描述映射
    const emotionDescMap: Record<string, string> = {
      satisfied: '用户整体反馈积极满意',
      confused: '用户存在较多困惑需要引导',
      anxious: '用户表现出一定焦虑或担忧',
      frustrated: '用户有挫败感，需关注体验',
      curious: '用户探索欲强，主动提问多',
      excited: '用户情绪高涨，对结果期待值高',
      neutral: '以信息查询和理性讨论为主',
      unknown: '情感特征不明显',
    }

    const emotionDesc = emotionDescMap[sentimentResult.primary] || emotionDescMap['unknown']
    const intensityLevel = sentimentResult.intensity > 70 ? '强烈'
      : sentimentResult.intensity > 40 ? '中等' : '轻微'

    return `今日对话总结：
- 主要关注领域：${topTopics}
- 情感倾向：${emotionDesc}（${intensityLevel}，强度 ${Math.round(sentimentResult.intensity)}）
- 配方相关讨论：${formulaCount} 次
- 用户活跃度：${this.getMessageActivityDescription(userMsgCount)}
- 主导情绪：${sentimentResult.primary}（强度 ${Math.round(sentimentResult.intensity)}）`
  }

  private countFormulaMentions(text: string): number {
    const patterns = [/配方/gi, /formula/gi]
    let count = 0

    patterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) count += matches.length
    })

    return count
  }

  private extractActionItems(
    messages: { role: string; content: string; timestamp: number }[],
  ): string[] {
    const actionPatterns = [
      /(?:帮我|请|需要|想要)(.*?)(?:[。！？])/gi,
      /(?:检查|评估|分析|验证|查找|查询)(.*?)(?:[。！？])/gi,
    ]

    const items: string[] = []

    actionPatterns.forEach(pattern => {
      const matches = [...messages[messages.length - 1]?.content?.matchAll(pattern) || []]
      matches.forEach(match => {
        if (match[1] && match[1].length > 5) {
          items.push(match[1].trim())
        }
      })
    })

    return [...new Set(items)]
  }

  private getMessageActivityDescription(userMsgCount: number): string {
    if (userMsgCount === 0) return '较低'
    if (userMsgCount < 5) return '一般'
    if (userMsgCount < 10) return '活跃'
    return '非常活跃'
  }

  /** 清理定时器资源 */
  destroy(): void {
    if (this.autoSummaryTimer) {
      clearInterval(this.autoSummaryTimer)
      this.autoSummaryTimer = null
    }
  }

  getRecentContext(days = 7): {
    summaries: DailySummary[]
    interests: InterestProfile[]
  } {
    const summaries: DailySummary[] = []
    const cutoffDate = new Date()

    for (let i = 0; i < days; i++) {
      const dateStr = this.formatDate(cutoffDate)
      const summary = this.memory.dailySummaries.get(dateStr)

      if (summary) {
        summaries.push(summary)
      }

      cutoffDate.setDate(cutoffDate.getDate() - 1)
    }

    return {
      summaries: summaries.reverse(),
      interests: this.memory.recentInterests.slice(0, 10),
    }
  }

  updateInterest(topic: string, query?: string): void {
    const existingIndex = this.memory.recentInterests.findIndex(i => i.topic === topic)

    if (existingIndex >= 0) {
      this.memory.recentInterests[existingIndex].frequency++
      this.memory.recentInterests[existingIndex].lastAccessed = Date.now()

      if (query && !this.memory.recentInterests[existingIndex].relatedQueries.includes(query)) {
        this.memory.recentInterests[existingIndex].relatedQueries.push(query)
      }
    } else {
      if (this.memory.recentInterests.length >= this.memory.maxInterests) {
        this.memory.recentInterests.shift()
      }

      this.memory.recentInterests.push({
        topic,
        frequency: 1,
        lastAccessed: Date.now(),
        relatedQueries: query ? [query] : [],
      })
    }

    this.saveToStorage()
  }

  cacheFAQ(question: string, answer: string): void {
    if (this.memory.faqCache.size >= this.memory.maxFAQCache) {
      const firstKey = this.memory.faqCache.keys().next().value
      if (firstKey) {
        this.memory.faqCache.delete(firstKey)
      }
    }

    this.memory.faqCache.set(question.toLowerCase(), answer)
    this.saveToStorage()
  }

  getFAQAnswer(question: string): string | null {
    return this.memory.faqCache.get(question.toLowerCase()) || null
  }

  getStats(): {
    dailySummariesCount: number
    interestsCount: number
    faqCacheCount: number
  } {
    return {
      dailySummariesCount: this.memory.dailySummaries.size,
      interestsCount: this.memory.recentInterests.length,
      faqCacheCount: this.memory.faqCache.size,
    }
  }

  clear(): void {
    this.memory = { ...DEFAULT_MEMORY }
    localStorage.removeItem('short-term-memory')
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  private saveToStorage(): void {
    try {
      const data = {
        dailySummaries: Object.fromEntries(this.memory.dailySummaries),
        recentInterests: this.memory.recentInterests,
        faqCache: Object.fromEntries(this.memory.faqCache),
      }
      localStorage.setItem('short-term-memory', JSON.stringify(data))
    } catch (error) {
      logger.warn('[ShortTermMemory] Failed to save to storage:', error)
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('short-term-memory')
      if (stored) {
        const data = JSON.parse(stored)

        this.memory.dailySummaries = new Map(Object.entries(data.dailySummaries || {}))
        this.memory.recentInterests = data.recentInterests || []
        this.memory.faqCache = new Map(Object.entries(data.faqCache || {}))

        logger.log('[ShortTermMemory] ✅ Loaded from storage:', {
          summaries: this.memory.dailySummaries.size,
          interests: this.memory.recentInterests.length,
          faqs: this.memory.faqCache.size,
        })
      }
    } catch (error) {
      logger.warn('[ShortTermMemory] Failed to load from storage:', error)
    }
  }
}

export const shortTermMemoryManager = new ShortTermMemoryManager()

export function useShortTermMemory() {
  const [stats, setStats] = useState(() => shortTermMemoryManager.getStats())

  // 引用计数：多组件共享单例时，仅最后一个卸载才清理资源
  useEffect(() => {
    shortTermMemoryManager.addRef()
    return () => {
      shortTermMemoryManager.releaseRef()
    }
  }, [])

  const endOfDayProcessing = useCallback(async (
    messages: { role: string; content: string; timestamp: number }[],
  ) => {
    const summary = await shortTermMemoryManager.endOfDayProcessing(messages)
    setStats(shortTermMemoryManager.getStats())
    return summary
  }, [])

  const getRecentContext = useCallback((days?: number) => {
    return shortTermMemoryManager.getRecentContext(days)
  }, [])

  const updateInterest = useCallback((topic: string, query?: string) => {
    shortTermMemoryManager.updateInterest(topic, query)
    setStats(shortTermMemoryManager.getStats())
  }, [])

  const cacheFAQ = useCallback((question: string, answer: string) => {
    shortTermMemoryManager.cacheFAQ(question, answer)
    setStats(shortTermMemoryManager.getStats())
  }, [])

  const getFAQAnswer = useCallback((question: string) => {
    return shortTermMemoryManager.getFAQAnswer(question)
  }, [])

  const clearMemory = useCallback(() => {
    shortTermMemoryManager.clear()
    shortTermMemoryManager.clearSessionBuffer()
    setStats(shortTermMemoryManager.getStats())
  }, [])

  /** 记录消息到自动摘要缓冲区 */
  const recordMessage = useCallback((role: string, content: string) => {
    shortTermMemoryManager.recordMessage(role, content)
  }, [])

  /** 清空会话消息缓冲区（切换会话时调用） */
  const clearSessionBuffer = useCallback(() => {
    shortTermMemoryManager.clearSessionBuffer()
  }, [])

  return {
    stats,
    endOfDayProcessing,
    getRecentContext,
    updateInterest,
    cacheFAQ,
    getFAQAnswer,
    clearMemory,
    recordMessage,
    clearSessionBuffer,
  }
}

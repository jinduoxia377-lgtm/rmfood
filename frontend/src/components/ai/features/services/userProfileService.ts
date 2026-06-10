/**
 * 统一用户画像服务 (Unified User Profile Service)
 *
 * 合并 6 个碎片化偏好系统为单一真相源：
 * ┌─────────────────────────────────────────────────────┐
 * │                  UnifiedUserProfile                 │
 * │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
 * │  │ UI 偏好   │  │ 领域偏好  │  │ 行为推断画像     │  │
 * │  │ ·主题     │  │ ·回复风格 │  │ ·专业度自评      │  │
 * │  │ ·快捷键   │  │ ·技术深度 │  │ ·兴趣领域       │  │
 * │  │ ·输入行为 │  │ ·对话模式 │  │ ·交互习惯       │  │
 * │  └────┬─────┘  └────┬─────┘  └───────┬──────────┘  │
 * │        │              │                │             │
 * │  ←─ userPrefsSvc   ←─ WorkingMemory  ←─ 自动推断    │
 * │       (委托)          (合并)           (新增)        │
 * └─────────────────────────────────────────────────────┘
 *
 * 设计原则：
 * 1. 单一真相源 — 所有组件通过此服务访问用户偏好
 * 2. 向后兼容 — 内部委托给现有 userPreferencesService（UI层）
 * 3. 渐进增强 — 支持从用户行为自动推断隐式偏好
 * 4. 版本化持久化 — localStorage 存储带版本号，支持迁移
 */

// ===== 类型定义 =====

/** UI 层偏好（委托给 userPreferencesService） */
export interface UIPreferences {
  theme: 'light' | 'dark' | 'system'
  enterToSend: boolean
  showCharCount: boolean
  showSuggestions: boolean
  autoFocus: boolean
}

/** 领域/对话层偏好（原 WorkingMemory.userPreferences 扩展） */
export interface DomainPreferences {
  /** 回复风格：简洁 / 详细 / 学术 */
  responseStyle: 'concise' | 'detailed' | 'academic'
  /** 技术深度：基础 / 中级 / 高级 */
  technicalDepth: 'basic' | 'intermediate' | 'advanced'
  /** 对话模式：标准 / 教学式 / 探索式 */
  dialogMode: 'standard' | 'tutorial' | 'exploratory'
  /** 是否启用共情回应 */
  empathyEnabled: boolean
  /** 是否显示思考过程 */
  showThinkingProcess: boolean
  /** 语言偏好：中文 / 英文 / 自动 */
  languagePreference: 'zh-CN' | 'en' | 'auto'
}

/** 行为推断画像（自动从交互历史中学习） */
export interface InferredProfile {
  /** 自评专业度（0-100，从提问复杂度和术语使用推断） */
  estimatedExpertise: number
  /** 主要兴趣领域标签 */
  primaryInterests: string[]
  /** 平均提问长度（字符） */
  avgQueryLength: number
  /** 偏好的回复长度偏好（从用户对长/短回复的反应推断） */
  preferredResponseLength: 'short' | 'medium' | 'long' | 'unknown'
  /** 是否喜欢结构化输出（列表/表格/分步） */
  prefersStructuredOutput: boolean
  /** 活跃时段（小时，0-23） */
  activeHours: number[]
  /** 总对话轮次 */
  totalTurns: number
  /** 上次活跃时间戳 */
  lastActiveAt: number
}

/** 完整用户画像 */
export interface UserProfile {
  ui: UIPreferences
  domain: DomainPreferences
  inferred: InferredProfile
  /** 配置置创建/更新时间 */
  updatedAt: number
}

/** 用户行为事件（用于自动推断） */
export interface BehaviorEvent {
  type: 'query_sent' | 'response_liked' | 'response_disliked' | 'query_refined'
    | 'long_query' | 'short_query' | 'technical_term_used' | 'follow_up_asked'
    | 'topic_switched' | 'session_long'
  timestamp: number
  metadata?: Record<string, unknown>
}

const STORAGE_KEY = 'unified-user-profile'
const PROFILE_VERSION = 1

const DEFAULT_UI: UIPreferences = {
  theme: 'system',
  enterToSend: true,
  showCharCount: true,
  showSuggestions: true,
  autoFocus: true,
}

const DEFAULT_DOMAIN: DomainPreferences = {
  responseStyle: 'detailed',
  technicalDepth: 'intermediate',
  dialogMode: 'standard',
  empathyEnabled: true,
  showThinkingProcess: true,
  languagePreference: 'zh-CN',
}

const DEFAULT_INFERRED: InferredProfile = {
  estimatedExpertise: 50,
  primaryInterests: [],
  avgQueryLength: 0,
  preferredResponseLength: 'unknown',
  prefersStructuredOutput: false,
  activeHours: [],
  totalTurns: 0,
  lastActiveAt: 0,
}

const DEFAULT_PROFILE: UserProfile = {
  ui: { ...DEFAULT_UI },
  domain: { ...DEFAULT_DOMAIN },
  inferred: { ...DEFAULT_INFERRED },
  updatedAt: Date.now(),
}

// ===== 核心实现 =====

class UnifiedUserProfileManager {
  private profile: UserProfile
  private listeners: ((profile: UserProfile) => void)[] = []
  /** 行为事件缓冲区（用于批量推断） */
  private behaviorBuffer: BehaviorEvent[] = []
  /** 最大缓冲区大小 */
  static readonly MAX_BEHAVIOR_BUFFER = 200
  /** 活跃时段内部 Set（O(1) 查找，替代数组的 O(n) includes） */
  private activeHoursSet = new Set<number>()

  constructor() {
    this.profile = this.loadFromStorage()
  }

  // ===== 核心访问 =====

  /** 获取完整用户画像（只读副本） */
  getProfile(): UserProfile {
    return { ...this.profile }
  }

  /** 获取 UI 偏好 */
  getUI(): UIPreferences {
    return { ...this.profile.ui }
  }

  /** 获取领域偏好 */
  getDomain(): DomainPreferences {
    return { ...this.profile.domain }
  }

  /** 获取推断画像 */
  getInferred(): InferredProfile {
    return { ...this.profile.inferred }
  }

  // ===== UI 偏好操作（延迟同步到原有 userPreferencesService）=====

  /** 延迟加载的 userPreferencesService 引用（避免 ESM 中 require()） */
  private legacyPrefsService: any = null

  /** 异步初始化遗留服务引用 */
  private async initLegacyService(): Promise<void> {
    try {
      const mod = await import('../services/userPreferencesService')
      this.legacyPrefsService = mod.userPreferencesService || mod.default
    } catch {
      this.legacyPrefsService = null
    }
  }

  setUI(partial: Partial<UIPreferences>): void {
    this.profile.ui = { ...this.profile.ui, ...partial }
    this.saveAndNotify()

    // 异步同步到原有 userPreferencesService（不阻塞主流程）
    if (!this.legacyPrefsService) {
      this.initLegacyService().then(() => {
        if (this.legacyPrefsService?.setTheme && partial.theme !== undefined) {
          this.legacyPrefsService.setTheme(partial.theme)
        }
      })
    } else if (partial.theme !== undefined) {
      try { this.legacyPrefsService.setTheme(partial.theme) } catch { /* ignore */ }
    }
  }

  // ===== 领域偏好操作 =====

  setDomain(partial: Partial<DomainPreferences>): void {
    this.profile.domain = { ...this.profile.domain, ...partial }
    this.saveAndNotify()
  }

  /**
   * 快捷设置：一键切换回复风格（单次调用，避免双重通知）
   */
  setResponseStyle(style: DomainPreferences['responseStyle']): void {
    const depthMap: Record<DomainPreferences['responseStyle'], DomainPreferences['technicalDepth']> = {
      concise: 'basic',
      detailed: 'intermediate',
      academic: 'advanced',
    }
    // 单次调用同时设置风格和联动深度，避免两次 saveAndNotify
    this.setDomain({ responseStyle: style, technicalDepth: depthMap[style] || 'intermediate' })
  }

  /**
   * 快捷设置：切换共情开关
   */
  toggleEmpathy(): void {
    this.setDomain({ empathyEnabled: !this.profile.domain.empathyEnabled })
  }

  // ===== 行为推断接口 =====

  /**
   * 记录用户行为事件（供各 hook 在交互时调用）
   */
  recordBehavior(event: BehaviorEvent): void {
    this.behaviorBuffer.push(event)

    // 缓冲区溢出时裁剪
    if (this.behaviorBuffer.length > UnifiedUserProfileManager.MAX_BEHAVIOR_BUFFER) {
      this.behaviorBuffer = this.behaviorBuffer.slice(-100)
    }

    // 每10个事件触发一次批量推断
    if (this.behaviorBuffer.length % 10 === 0) {
      this.runInference()
    }

    // 实时更新基础计数
    if (event.type === 'query_sent') {
      this.profile.inferred.totalTurns++
      this.profile.inferred.lastActiveAt = event.timestamp
      // 更新活跃时段（O(1) Set 操作替代 O(n) includes + O(n log n) sort）
      const hour = new Date(event.timestamp).getHours()
      if (!this.activeHoursSet.has(hour)) {
        this.activeHoursSet.add(hour)
        this.profile.inferred.activeHours = Array.from(this.activeHoursSet).sort((a, b) => a - b)
      }
    }
  }

  /**
   * 手动触发推断（如会话结束时）
   */
  runInference(): void {
    if (this.behaviorBuffer.length < 3) return

    const events = [...this.behaviorBuffer]
    this.updateExpertiseEstimate(events)
    this.updateInterestProfile(events)
    this.updateQueryPattern(events)
    this.updateResponseLengthPreference(events)

    this.profile.updatedAt = Date.now()
    this.saveToStorage()
  }

  // ===== 推断算法 =====

  /**
   * 从行为事件推断专业度评分
   *
   * 算法：
   * - 基础分 50
   * - 使用专业术语 +5/次（上限+20）
   * - 提出追问/跟进 +3/次（上限+15）
   * - 发送长查询(>50字) +2/次（上限+10）
   * - 短查询(<10字)频繁 -1/次（下限-15）
   * - 需要 refine（重新表述）-2/次（下限-10）
   */
  private updateExpertiseEstimate(events: BehaviorEvent[]): void {
    let score = 50
    let termCount = 0
    let followUpCount = 0
    let longQueryCount = 0
    let shortQueryCount = 0
    let refineCount = 0

    for (const e of events) {
      switch (e.type) {
        case 'technical_term_used': termCount++; break
        case 'follow_up_asked': followUpCount++; break
        case 'long_query': longQueryCount++; break
        case 'short_query': shortQueryCount++; break
        case 'query_refined': refineCount++; break
      }
    }

    score += Math.min(termCount * 5, 20)
    score += Math.min(followUpCount * 3, 15)
    score += Math.min(longQueryCount * 2, 10)
    score -= Math.min(shortQueryCount * 1, 15)
    score -= Math.min(refineCount * 2, 10)

    // 平滑更新（指数移动平均，α=0.3）
    const prevScore = this.profile.inferred.estimatedExpertise
    this.profile.inferred.estimatedExpertise = Math.round(prevScore * 0.7 + score * 0.3)
    this.profile.inferred.estimatedExpertise = Math.max(0, Math.min(100, this.profile.inferred.estimatedExpertise))
  }

  /**
   * 更新兴趣领域画像
   */
  private updateInterestProfile(events: BehaviorEvent[]): void {
    // 从 topic_switched 事件的 metadata 中提取兴趣标签
    const topicEvents = events.filter(e => e.type === 'topic_switched' && e.metadata?.topic)
    const newTopics = topicEvents
      .map(e => {
        const t = e.metadata?.topic
        return (typeof t === 'string' && t.length > 0 && t.length <= 50) ? t : null
      })
      .filter((t): t is string => t !== null)

    // 合并到现有兴趣列表（带频次加权）
    const merged = [...this.profile.inferred.primaryInterests]
    for (const topic of newTopics) {
      if (!merged.includes(topic)) {
        merged.push(topic)
      }
    }

    // 只保留 top-8 兴趣
    this.profile.inferred.primaryInterests = merged.slice(0, 8)
  }

  /**
   * 更新查询模式（平均长度等）
   */
  private updateQueryPattern(events: BehaviorEvent[]): void {
    const queryEvents = events.filter(e =>
      e.type === 'query_sent' || e.type === 'long_query' || e.type === 'short_query',
    )

    if (queryEvents.length === 0) return

    // 计算平均查询长度（需要原始文本，这里用事件类型估算）
    let totalEstimate = 0
    for (const e of queryEvents) {
      if (e.type === 'long_query') totalEstimate += 60
      else if (e.type === 'short_query') totalEstimate += 8
      else totalEstimate += 25 // average estimate
    }

    const newAvg = totalEstimate / queryEvents.length
    // 平滑更新
    const prevAvg = this.profile.inferred.avgQueryLength
    this.profile.inferred.avgQueryLength = Math.round(prevAvg * 0.6 + newAvg * 0.4)
  }

  /**
   * 更新偏好的回复长度
   */
  private updateResponseLengthPreference(events: BehaviorEvent[]): void {
    const likes = events.filter(e => e.type === 'response_liked').length
    const dislikes = events.filter(e => e.type === 'response_disliked').length

    if (likes + dislikes < 2) return // 数据不足

    const likeRatio = likes / (likes + dislikes)

    if (likeRatio > 0.7) {
      // 用户喜欢当前回复风格 → 保持
      // 可以进一步细化：如果 liked 的回复是长的 → long
      this.profile.inferred.preferredResponseLength =
        this.profile.inferred.avgQueryLength > 30 ? 'long' : 'medium'
    } else if (likeRatio < 0.3) {
      // 用户不喜欢 → 切换
      this.profile.inferred.preferredResponseLength =
        this.profile.inferred.preferredResponseLength === 'long' ? 'medium' : 'short'
    }
  }

  // ===== Prompt 注入 =====

  /**
   * 生成用于 System Prompt 的用户画像摘要
   * 供后端 chat_engine 使用以个性化回复
   */
  generatePromptSummary(): string {
    const { domain, inferred } = this.profile
    const parts: string[] = []

    // 回复风格
    const styleDesc: Record<string, string> = {
      concise: '简洁明了，直击要点',
      detailed: '详尽全面，配有例子和解释',
      academic: '学术严谨，引用标准和文献',
    }
    parts.push(`回复风格：${styleDesc[domain.responseStyle] || '标准'}`)

    // 技术深度
    const depthDesc: Record<string, string> = {
      basic: '入门级，避免过多专业术语',
      intermediate: '中级，适度使用术语并解释',
      advanced: '高级，可深入讨论机制和原理',
    }
    parts.push(`技术深度：${depthDesc[domain.technicalDepth] || '中级'}`)

    // 专业度自适应
    if (inferred.estimatedExpertise > 70) {
      parts.push('用户表现出较高专业水平，可直接使用行业术语')
    } else if (inferred.estimatedExpertise < 30) {
      parts.push('用户可能是新手，请用通俗语言解释概念')
    }

    // 兴趣领域（净化后注入，防止 Prompt 注入）
    if (inferred.primaryInterests.length > 0) {
      const safeTopics = inferred.primaryInterests
        .map(t => t.replace(/[\n\r\t]/g, ' ').slice(0, 30).trim())
        .filter(t => t.length > 0)
      parts.push(`关注领域：${safeTopics.join('、')}`)
    }

    // 共情开关
    if (!domain.empathyEnabled) {
      parts.push('用户已关闭共情回应模式，保持纯专业语调')
    }

    return `【用户画像】\n${parts.map(p => `- ${p}`).join('\n')}`
  }

  // ===== 持久化 =====

  private saveAndNotify(): void {
    this.profile.updatedAt = Date.now()
    this.saveToStorage()
    this.notifyListeners()
  }

  private saveToStorage(): void {
    try {
      const data = {
        version: PROFILE_VERSION,
        profile: this.profile,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.warn('[UnifiedUserProfile] 持久化失败:', error)
    }
  }

  private loadFromStorage(): UserProfile {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return { ...DEFAULT_PROFILE }

      const data = JSON.parse(raw)
      if (data.version !== PROFILE_VERSION) {
        console.warn(`[UserProfile] 版本不匹配(${data.version} vs ${PROFILE_VERSION})，使用默认值`)
        return { ...DEFAULT_PROFILE }
      }

      // 深度合并默认值（确保新增字段有值）
      return {
        ui: { ...DEFAULT_UI, ...(data.profile?.ui || {}) },
        domain: { ...DEFAULT_DOMAIN, ...(data.profile?.domain || {}) },
        inferred: { ...DEFAULT_INFERRED, ...(data.profile?.inferred || {}) },
        updatedAt: data.profile?.updatedAt || Date.now(),
      }
    } catch {
      return { ...DEFAULT_PROFILE }
    }
  }

  // ===== 监听器 =====

  subscribe(listener: (profile: UserProfile) => void): () => void {
    this.listeners.push(listener)
    // 立即通知一次当前状态
    try {
      listener(this.getProfile())
    } catch {
      // 忽略监听器错误
    }
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx >= 0) this.listeners.splice(idx, 1)
    }
  }

  private notifyListeners(): void {
    const profile = this.getProfile()
    for (const fn of this.listeners) {
      try {
        fn(profile)
      } catch {
        // 忽略监听器错误
      }
    }
  }

  // ===== 重置 =====

  reset(): void {
    this.profile = { ...DEFAULT_PROFILE }
    this.behaviorBuffer = []
    this.saveAndNotify()
  }

  /** 仅重置推断数据（保留显式偏好设置） */
  resetInferred(): void {
    this.profile.inferred = { ...DEFAULT_INFERRED }
    this.behaviorBuffer = []
    this.saveAndNotify()
  }

  // ===== 调试 =====

  getDebugInfo(): object {
    return {
      profileVersion: PROFILE_VERSION,
      behaviorBufferSize: this.behaviorBuffer.length,
      profile: this.getProfile(),
    }
  }
}

// ===== 单例导出 =====

export const userProfileManager = new UnifiedUserProfileManager()

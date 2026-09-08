# RMFOOD 智能对话 × DeepSeek Harness 架构融合方案 v1.0

> 制定日期: 2026-08-23  
> 目标: 将 DSH 的核心设计模式与 RMFOOD 现有对话系统融合，提升架构质量、数据一致性和可维护性  
> 状态: 待实施

---

## 一、融合总览

### 1.1 设计理念映射

| DSH 核心模式 | RMFOOD 对应层 | 融合策略 |
|-------------|-------------|---------|
| Event Sourcing (Session Log) | `useChatMessages` 扁平数组 | EventLog 包装层，兼容现有 setState |
| Turn/Step 驱动 | `useChatSendMessage` 单次发送 | Turn 概念化：一次发送 = 一轮 Turn |
| Waterfall Events (pre/execute/post) | `eventBus` 简单发布订阅 | 升级 EventBus 为带拦截能力的 Waterfall |
| Surface Projection | `MessageList` 直接遍历 messages | deriveMessages() 派生函数，投影到 UI |
| Compaction | 无（硬截断 1000 字） | Token 预算管理器 + 滚动窗口压缩 |
| Fork/Resume | 会话切换但消息不互通 | IndexedDB 会话隔离 + 后端同步 |
| Token Meter | `estimateTokenCount()` 粗略实现 | 统一的 TokenBudgetManager |
| Scope Shadowing | 无 | 场景模式（scenario）作用域注入 |
| Capability Seam | 服务散乱分布在 services/ | 按 Capability 重新划分：Storage/NLP/Session/Streaming |

### 1.2 目标架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        UI 层 (React)                               │
│  ChatTab → ChatMessages / ChatInputPro / ChatHistory               │
│              ↓ surface projection (deriveMessages)                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  EventLog 层（新增）                                          │  │
│  │  ChatEventLog: append-only log → deriveMessages()            │  │
│  │  → 支持 replace（编辑/撤回）                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                         ↓                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Orchestrator 层（重构）                                      │  │
│  │  useChatTurn  （替代 useChatSendMessage）                     │  │
│  │    ├─ NLP 意图检测                                            │  │
│  │    ├─ 多轮指代消解                                            │  │
│  │    ├─ RAG 增强                                               │  │
│  │    ├─ Token 预算管理                                          │  │
│  │    └─ 发送 → EventLog.append                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                         ↓                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Capability 层（重构为4个核心服务）                            │  │
│  │                                                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │  │
│  │  │  Storage    │  │  Streaming  │  │   Session   │          │  │
│  │  │  Capability │  │  Capability │  │  Capability │          │  │
│  │  │             │  │             │  │             │          │  │
│  │  │ ChatEventLog│  │ SSE/Non-    │  │ Session     │          │  │
│  │  │ TokenBudget │  │   Manager   │  │ Manager     │          │  │
│  │  │ Compaction  │  │ RetryPolicy │  │ TopicStack  │          │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                         ↓                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Waterfall EventBus（升级）                                   │  │
│  │  pipe('message:sending') → authCheck → sanitize → send       │  │
│  │  pipe('message:received') → save → compactionCheck           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、核心修复方案

### 2.1 统一存储层 — ChatStorageCapability

**问题根因**：localStorage + IndexedDB + 后端 API 三层数据孤岛。

**修复方案**：建立统一的 `ChatStorageCapability`，采用 IndexedDB 为主存储，localStorage 为性能缓存，后端为跨设备同步层。

```typescript
// frontend/src/components/ai/features/capabilities/storage/ChatStorageCapability.ts

import type { ChatMessage } from '../../types';

/**
 * ChatStorageCapability — 统一存储能力
 * 
 * 存储策略（三层）：
 * 1. IndexedDB (primary) — 持久化、大容量、结构化查询
 * 2. localStorage (cache) — 快速读取，带版本号验证
 * 3. Backend API (sync) — 跨设备同步，用户登录时触发
 */
export interface ChatStorageCapability {
  // 消息 CRUD（基于 session）
  saveMessages(sessionId: string, messages: ChatMessage[]): Promise<void>;
  loadMessages(sessionId: string): Promise<ChatMessage[]>;
  deleteMessages(sessionId: string): Promise<void>;
  
  // 单条消息操作
  updateMessage(sessionId: string, messageId: string, updates: Partial<ChatMessage>): Promise<void>;
  deleteMessage(sessionId: string, messageId: string): Promise<void>;
  
  // 会话元数据
  saveSessionMeta(sessionId: string, meta: { title: string; topic?: string; tags?: string[] }): Promise<void>;
  loadSessionMeta(sessionId: string): Promise<{ title: string; topic?: string; tags?: string[] } | null>;
  
  // 批量加载（用于历史会话切换）
  loadAllSessions(): Promise<Array<{ id: string; meta: any; messageCount: number }>>;
  
  // 后端同步
  syncToServer(sessionId: string): Promise<void>;
  fetchFromServer(sessionId: string): Promise<ChatMessage[]>;
}
```

**实施步骤**：
1. 在 `ChatHistoryStorage` 中新增 `saveSessionMessages(sessionId, messages)` 方法（当前只存 session 元数据）
2. 创建 `ChatStorageCapability` 适配器，封装 IndexedDB 操作
3. 修改 `useChatCallbacks` 使用新的统一存储接口
4. 添加版本号校验，防止 localStorage 缓存与 IndexedDB 不一致

---

### 2.2 Token 预算管理 — 替代硬截断

**问题根因**：`useChatMessages.ts:192` 强制截断每条消息1000字，破坏长上下文。

**修复方案**：引入 `TokenBudgetManager`，实现动态 token 预算分配。

```typescript
// frontend/src/components/ai/features/capabilities/streaming/TokenBudgetManager.ts

/**
 * TokenBudgetManager — 参照 DSH TokenMeter 的同步估计器
 * 
 * 原则：
 * - 中文字符 ≈ 1.5 token
 * - 英文单词 ≈ 0.8 token  
 * - 数字/代码片段 ≈ 1.2 token
 * - 保持同步（无异步计算）以支持压缩决策
 */
export class TokenBudgetManager {
  private readonly MAX_TOKENS = 6000;      // 留给历史的最大 token 数
  private readonly SAFETY_MARGIN = 0.85;   // 保留 15% 余量给 system prompt
  
  estimateTokens(content: string): number {
    const cn = (content.match(/[\u4e00-\u9fa5]/g) || []).length
    const en = (content.match(/[a-zA-Z]+/g) || []).length
    const nums = (content.match(/\d+/g) || []).length
    const newlines = (content.match(/\n/g) || []).length
    return Math.ceil(cn * 1.5 + en * 0.8 + nums * 1.2 + newlines * 0.3)
  }
  
  /**
   * 选择适合发送给后端的对话历史
   * 策略：保留最近 N 条完整消息 + 最早 1 条（首次问题）
   */
  selectHistory(messages: ChatMessage[], maxTokens: number = this.MAX_TOKENS): ChatMessage[] {
    const filtered = messages.filter(m => !m.error && m.content && (m.role === 'user' || m.role === 'assistant'))
    
    if (filtered.length === 0) return []
    
    // 从最新开始累加，直到预算耗尽
    let totalTokens = 0
    const result: ChatMessage[] = []
    
    for (let i = filtered.length - 1; i >= 0; i--) {
      const msg = filtered[i]
      const tokens = this.estimateTokens(msg.content)
      
      // 如果加上这条消息会超出预算，且已有足够上下文，停止
      if (totalTokens + tokens > maxTokens && result.length >= 4) break
      
      result.unshift(msg)
      totalTokens += tokens
    }
    
    return result
  }
  
  /**
   * 检测是否需要触发压缩
   */
  shouldCompact(messages: ChatMessage[], currentTokens: number): boolean {
    return currentTokens > this.MAX_TOKENS * this.SAFETY_MARGIN
  }
}

export const tokenBudgetManager = new TokenBudgetManager()
```

**集成到 useChatMessages**：
```typescript
// useChatMessages.ts 中的 history 构建部分修改
const history = tokenBudgetManager.selectHistory(
  messagesRef.current,
  MAX_CONTEXT_TOKENS  // 6000 tokens
)
```

---

### 2.3 EventLog 层 — 事件溯源封装

**问题根因**：当前 `messages` 是扁平数组，所有操作通过 `setState(prev => ...)` 替换，无日志可追溯。

**修复方案**：在现有 messages 之上增加一层 `ChatEventLog`，记录所有状态变更事件，支持精确的 replace/insert 操作。

```typescript
// frontend/src/components/ai/features/capabilities/storage/ChatEventLog.ts

/**
 * ChatEventLog — 事件溯源日志层
 * 
 * 参照 DSH Session 的 append-only log 设计：
 * - 所有变更以事件形式追加
 * - UI 状态通过 deriveMessages() 派生
 * - 支持 undo/redo 和精确修改
 */
export type SessionEventType = 
  | 'user/message'        // 用户发送消息
  | 'assistant/message'   // AI 回复
  | 'assistant/chunk'     // 流式增量（中间状态）
  | 'error/message'       // 错误消息
  | 'system/alert'        // 系统提示

export interface SessionEvent {
  seq: number              // 单调递增序列号
  type: SessionEventType
  data: unknown
  timestamp: number
  surfaceOp?: 'append' | 'replace'  // 表面投影操作类型
}

export class ChatEventLog {
  private events: SessionEvent[] = []
  private seq = 0
  private listener?: (events: SessionEvent[]) => void
  
  /** 追加事件（核心操作） */
  append(type: SessionEventType, data: unknown): number {
    const event: SessionEvent = {
      seq: this.seq++,
      type,
      data,
      timestamp: Date.now(),
      surfaceOp: 'append',
    }
    this.events.push(event)
    this.listener?.(this.events)
    return event.seq
  }
  
  /** 替换一段范围的事件（用于编辑/撤回） */
  replaceRange(startSeq: number, endSeq: number, newEvents: SessionEvent[]): void {
    const startIdx = this.events.findIndex(e => e.seq === startSeq)
    if (startIdx === -1) return
    const endIdx = this.events.findIndex(e => e.seq === endSeq)
    const spliceEnd = endIdx === -1 ? startIdx + 1 : endIdx + 1
    
    this.events.splice(startIdx, spliceEnd - startIdx, ...newEvents)
    this.listener?.(this.events)
  }
  
  /** 从日志派生 UI 消息列表 */
  deriveMessages(): ChatMessage[] {
    return this.events
      .filter(e => ['user/message', 'assistant/message', 'error/message'].includes(e.type))
      .map(e => this.eventToMessage(e))
  }
  
  onEventsChanged(listener: (events: SessionEvent[]) => void): () => void {
    this.listener = listener
    return () => { this.listener = undefined }
  }
  
  private eventToMessage(event: SessionEvent): ChatMessage {
    const data = event.data as { id: string; role: string; content: string; ... }
    return {
      id: data.id,
      role: data.role as 'user' | 'assistant',
      content: data.content,
      timestamp: data.timestamp || event.timestamp,
      ...data,
    }
  }
}
```

**与现有 useChatMessages 的兼容层**：
```typescript
// 在 useChatMessages 内部使用 ChatEventLog，对外仍暴露相同的 messages[] 接口
// 这样无需改动任何调用方

const eventLog = useRef(new ChatEventLog())

const addMessage = useCallback((message: ChatMessage) => {
  eventLog.current.append(
    message.role === 'user' ? 'user/message' : 'assistant/message',
    message
  )
  setMessages(eventLog.current.deriveMessages())
}, [])
```

---

### 2.4 Waterfall EventBus — 可拦截的事件链

**问题根因**：当前 EventBus 是简单的发布-订阅，无法实现 DSH 的 waterfall 拦截模式。

**修复方案**：在保持向后兼容的前提下，增加 `pipe` 能力。

```typescript
// frontend/src/components/ai/features/services/EventBusV2.ts

export type PipeHandler<T> = (payload: T, next: () => Promise<void>) => Promise<void> | void

export class EventBusV2<TEvents extends Record<string, unknown>> {
  private listeners = new Map<keyof TEvents, PipeHandler<any>[]>()
  
  /**
   * 注册拦截管道（waterfall）
   * handlers 按注册顺序串行执行，每个 handler 调用 next() 传递到下一个
   */
  pipe<K extends keyof TEvents>(event: K, ...handlers: PipeHandler<TEvents[K]>[]): void {
    const key = event as string
    if (!this.listeners.has(key)) {
      this.listeners.set(key, [])
    }
    this.listeners.get(key)!.push(...handlers)
  }
  
  /**
   * 发射事件（执行所有拦截器）
   */
  async emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): Promise<void> {
    const chain = this.listeners.get(event as string) ?? []
    
    let index = 0
    const executeNext = async (): Promise<void> => {
      if (index >= chain.length) return
      const handler = chain[index++]
      await handler(payload, executeNext)
    }
    
    await executeNext()
    
    // 原有 subscribe 逻辑（保持向后兼容）
    this.simpleEmit(event, payload)
  }
  
  private simpleEmit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    // ... 原有 subscribe/once 逻辑不变
  }
}
```

**实际应用场景**：
```typescript
// 在 useChatSendMessage 中注册发送前拦截
eventBusV2.pipe('message:sending', async (payload, next) => {
  // 1. 认证检查
  if (!authStore.isAuthenticated) {
    throw new Error('请先登录')
  }
  // 2. 内容净化
  const safeContent = sanitizeUserInput(payload.content)
  await next({ ...payload, content: safeContent })
})

// 在 ChatTab 中注册接收后处理
eventBusV2.pipe('message:received', async (payload, next) => {
  // 1. 保存到持久化存储
  await storageCapability.saveMessages(activeSessionId!, [payload.message])
  // 2. 检查是否需要压缩
  const needsCompact = tokenBudgetManager.shouldCompact(messages, /*...*/)
  if (needsCompact) {
    const compacted = await compactionEngine.compact(messages)
    setMessages(compacted.messages)
  }
  await next()
})
```

---

### 2.5 会话 Fork/Resume 机制

**问题根因**：切换会话时消息从 localStorage 隔离存储恢复，但后端无对应消息，localStorage 过期则数据永久丢失。

**修复方案**：实现完整的 `session.fork()` 和 `session.resume()` 能力。

```typescript
// frontend/src/components/ai/features/capabilities/session/SessionCapability.ts

export interface SessionForkOptions {
  boundaryMessageId?: string  // 从哪条消息开始分叉（不传则从最后）
  childSessionId?: string     // 子会话 ID（不传则自动生成）
}

export class SessionCapability {
  private storage: ChatStorageCapability
  
  /**
   * 在当前会话指定位置创建分支
   * 参照 DSH fork(source, boundary)
   */
  async fork(parentSessionId: string, options: SessionForkOptions = {}): Promise<string> {
    const messages = await this.storage.loadMessages(parentSessionId)
    const boundary = options.boundaryMessageId
      ? messages.findIndex(m => m.id === options.boundaryMessageId)
      : messages.length
    
    const childId = options.childSessionId ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    
    // 复制前缀消息
    await this.storage.saveMessages(childId, messages.slice(0, boundary + 1))
    
    return childId
  }
  
  /**
   * 恢复到指定历史节点
   * 参照 DSH resume(sessionId)
   */
  async resumeTo(sessionId: string, targetMessageId: string): Promise<ChatMessage[]> {
    const messages = await this.storage.loadMessages(sessionId)
    const targetIndex = messages.findIndex(m => m.id === targetMessageId)
    
    if (targetIndex === -1) return []
    
    // 返回目标节点及之前的所有消息
    return messages.slice(0, targetIndex + 1)
  }
  
  /**
   * 获取会话完整历史（含已撤回消息，用于精确恢复）
   */
  async getFullHistory(sessionId: string): Promise<ChatMessage[]> {
    return await this.storage.loadMessages(sessionId)
  }
}
```

**集成到 useChatCallbacks**：
```typescript
const handleSelectSession = useCallback(async (id: string) => {
  if (id === activeSessionId) return
  
  // 1. 保存当前会话
  if (activeSessionId && messages.length > 0) {
    await storageCapability.saveMessages(activeSessionId, messages)
  }
  
  setActiveSessionId(id)
  
  // 2. 尝试从本地恢复
  const localMessages = await storageCapability.loadMessages(id)
  if (localMessages.length > 0) {
    setMessages(localMessages)
    return
  }
  
  // 3. 降级：从后端加载
  try {
    const serverMessages = await storageCapability.fetchFromServer(id)
    if (serverMessages.length > 0) {
      setMessages(serverMessages)
      await storageCapability.saveMessages(id, serverMessages)
      return
    }
  } catch {}
  
  // 4. 最终降级：清空
  handleClearChat()
}, [activeSessionId, messages])
```

---

### 2.6 思考步骤竞态条件修复

**问题根因**：`ChatTab.tsx:116-127` 中 `prevMsgCountRef` 在 effect 内部更新，导致多线程/多消息并发时读取到错误值。

**修复方案**：

```typescript
// ChatTab.tsx — 修复思考步骤加载竞态
const processedMsgCountRef = useRef(0)

useEffect(() => {
  const currentCount = messages.length
  if (currentCount <= processedMsgCountRef.current) return
  
  // 先更新 ref，再处理消息（防止 effect 重入）
  processedMsgCountRef.current = currentCount
  
  const newMsgs = messages.slice(processedMsgCountRef.current - newMsgs.length)
  const lastAssistant = [...newMsgs].reverse().find(
    (m) => m.role === 'assistant' && !m.isLoading
  )
  
  if (lastAssistant && (lastAssistant as any).thinking_steps?.length > 0) {
    orchestrator.thinkingProcessV3.loadExternalSteps(
      (lastAssistant as any).thinking_steps,
      lastAssistant.content
    )
  }
}, [messages, orchestrator.thinkingProcessV3])
```

---

### 2.7 虚拟滚动高度估计修复

**修复方案**：

```typescript
// MessageList.tsx — 动态高度估计
const getEstimatedSize = useCallback((index: number): number => {
  const msg = messages[index]
  if (!msg) return 140
  
  // AI 回复：基础高度 + 内容长度
  if (msg.role === 'assistant') {
    const baseHeight = 80
    const contentHeight = Math.min(
      Math.floor(msg.content.length / 80) * 25,
      400  // 上限
    )
    // 如果有 thinking steps，额外增加空间
    const stepHeight = ((msg as any).thinking_steps?.length ?? 0) * 30
    return baseHeight + contentHeight + stepHeight
  }
  
  // 用户消息
  if (msg.role === 'user') {
    return Math.min(60 + Math.floor(msg.content.length / 40) * 15, 200)
  }
  
  // 错误消息
  return 100
}, [messages])

const rowVirtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: getEstimatedSize,  // ✅ 动态估算
  overscan: 10,
  scrollMargin,
  getItemKey: (index) => messages[index]?.id ?? index,
})
```

---

## 三、Capability 层重构方案

### 3.1 目录结构重组

```
frontend/src/components/ai/features/
├── capabilities/                    # 新增：能力层
│   ├── storage/
│   │   ├── ChatStorageCapability.ts  # 统一存储
│   │   └── ChatEventLog.ts          # 事件溯源日志
│   ├── streaming/
│   │   ├── ChatStreamingCapability.ts  # SSE/非流式双路径
│   │   ├── TokenBudgetManager.ts    # Token 预算管理
│   │   └── RetryPolicy.ts           # 重试策略
│   ├── session/
│   │   ├── SessionCapability.ts     # 会话 Fork/Resume
│   │   └── SessionManager.ts        # 会话生命周期
│   └── nlp/
│       ├── IntentDetectionCapability.ts  # 意图检测（封装 hybridNLPEngineV2）
│       └── ContextEnrichment.ts         # 上下文增强
│
├── services/                        # 现有服务（逐步迁移）
│   ├── chatService.ts               # → 迁移到 capabilities/streaming/
│   ├── chatHistoryService.ts        # → 保留（IndexedDB 高层封装）
│   ├── eventBus.ts                  # → 升级为 EventBusV2
│   └── scenarioSwitcher.ts          # → 迁移到 capabilities/session/
│
├── hooks/
│   ├── useChatTurn.ts               # 新增：Turn 驱动替代 useChatSendMessage
│   ├── useChatMessages.ts           # 改造：内部使用 ChatEventLog
│   └── useChatCallbacks.ts          # 改造：使用 ChatStorageCapability
│
└── types/
    ├── chat.types.ts                # 统一类型定义（合并 chatHistory.types + index）
    └── capabilities.types.ts        # Capability 接口定义
```

### 3.2 Capability 接口定义

```typescript
// capabilities/capabilities.types.ts

/**
 * Capability 缝定义
 * 参照 DSH: Service Definition → Provider → Consumer
 */
export interface Capability {
  /** 能力唯一标识 */
  id: string
  /** 能力名称（用户可见） */
  name: string
  /** 能力描述 */
  description: string
  /** 是否可用 */
  isAvailable: boolean
}

/**
 * 存储能力
 */
export interface IChatStorageCapability extends ChatStorageCapability {
  readonly capabilityId: 'storage'
}

/**
 * 流式能力
 */
export interface IChatStreamingCapability {
  readonly capabilityId: 'streaming'
  sendMessage(question: string, history: ChatMessage[]): Promise<AIResponse>
  sendMessageStream(question: string, history: ChatMessage[]): AsyncGenerator<StreamChunk>
  getStateMachine(): ChatStateMachine
}

/**
 * 会话能力
 */
export interface IChatSessionCapability extends SessionCapability {
  readonly capabilityId: 'session'
  /** 创建新会话 */
  createSession(title?: string): Promise<string>
  /** 列出所有会话 */
  listSessions(): Promise<SessionSummary[]>
  /** 删除会话 */
  deleteSession(sessionId: string): Promise<void>
}

/**
 * NLP 能力
 */
export interface INlpCapability {
  readonly capabilityId: 'nlp'
  detectIntent(text: string, context?: ContextSnapshot): Promise<IntentResult>
  resolveReferences(text: string, history: ChatMessage[]): string
  enrichContext(question: string): Promise<string>
}
```

---

## 四、实施路线图

### Phase 1：数据一致性修复（1周）

| 任务 | 文件 | 优先级 | 验收标准 |
|------|------|--------|---------|
| 统一消息持久化 | `ChatStorageCapability.ts`, `useChatCallbacks.ts` | P0 | 切换会话刷新页面后消息不丢失 |
| 修复消息截断 | `useChatMessages.ts` | P0 | 长上下文完整传递给后端 |
| 修复思考步骤竞态 | `ChatTab.tsx` | P0 | 多消息并发时思考步骤正确加载 |
| EventBus 类型安全 | `eventBus.ts` | P0 | 消除所有 `as any` |
| 会话恢复后端回退 | `useChatCallbacks.ts` | P1 | 本地无数据时尝试后端加载 |

### Phase 2：架构升级（2周）

| 任务 | 文件 | 优先级 | 验收标准 |
|------|------|--------|---------|
| 实现 ChatEventLog | `capabilities/storage/ChatEventLog.ts` | P1 | 支持 append/replace/derive |
| 实现 TokenBudgetManager | `capabilities/streaming/TokenBudgetManager.ts` | P1 | 正确估算 token 并选择历史 |
| 升级 EventBus 为 Waterfall | `services/EventBusV2.ts` | P1 | 支持 pipe 拦截 |
| 实现 SessionCapability | `capabilities/session/SessionCapability.ts` | P1 | fork/resume 正常工作 |
| 虚拟滚动动态高度 | `MessageList.tsx` | P2 | 长消息不错位 |

### Phase 3：高级特性（3-4周）

| 任务 | 参照 DSH | 验收标准 |
|------|---------|---------|
| Compaction 上下文压缩 | `03-memory-system.md §4` | 消息超 50 条自动压缩 |
| Waterfall 消息拦截链 | `02-agent-loop-algorithm.md §2.3` | 发送前/接收后可拦截 |
| 用户画像持久化 | `03-memory-system.md` | 短期记忆跨会话保留 |
| 斜杠命令支持 | `07-missing-modules.md §4` | `/clear`, `/compact`, `/topic` 可用 |

---

## 五、兼容性保证

### 5.1 渐进式迁移策略

所有改造采用**包装器模式**，不破坏现有调用方：

```
现有代码                          改造后代码
─────────────────                 ─────────────────────────
useChatMessages()             →   useChatMessages() [内部使用 ChatEventLog]
chatService.sendMessage()     →   streamingCapability.sendMessage() [接口相同]
eventBus.emit('event', data)  →   eventBusV2.emit('event', data) [API 相同]
storageService.get/set()      →   storageCapability.load/save() [新增 sessionId 参数]
```

### 5.2 类型安全保证

- 所有 EventBus 调用使用 `EventBusV2<EventPayloadMap>` 强类型
- 所有 Capability 接口使用 branded type 防止混淆
- 迁移过程中 TypeScript strict mode 报错数不得增加

---

## 六、验收标准

| 场景 | 预期行为 | 测试方式 |
|------|---------|---------|
| 发送消息后刷新 | 消息保留，会话切换正常 | E2E 测试 |
| 切换会话后刷新 | 历史消息完整恢复 | E2E 测试 |
| 长对话(>20条) | 上下文完整传递，不截断 | 单元测试 |
| 快速连发 | 去重生效，无重复请求 | 单元测试 |
| 思考步骤动画 | 与后端步骤同步，无竞态 | 手动测试 |
| 会话超过40条 | 虚拟滚动正常，编辑状态不丢失 | E2E 测试 |
| 网络断开恢复 | 自动重连并重试 | 单元测试 |
| 场景切换 | 自动检测意图并切换场景 | 手动测试 |

---

*方案制定: RMFOOD AI Team*  
*参考: DeepSeek Harness 架构设计文档 (docs/deepseek-harness-analysis/)*

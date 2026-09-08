# 核心算法提取：Agent Loop 与 Turn Flow

## 一、Agent 生命周期

### 1.1 Agent 接口定义

```typescript
interface Agent {
  readonly id: SessionId
  readonly options: AgentOptions
  readonly session: Session
  readonly inbox: Inbox
  readonly status: AgentStatus  // 'idle' | 'running'
  readonly ctx: Context

  // 核心方法
  cancel(cause: AgentCancelCause, options?: CancelOptions): void
  whenIdle(): Promise<void>
  runMaintenance<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T>
  send(message: UserMessage, target: InboxTarget, wakeup: boolean): void
  followup(message: UserMessage): void
  steer(message: UserMessage): void
  inject(message: UserMessage): void
}
```

### 1.2 Agent 创建流程

```
create() / resume()
    │
    ├── 1. 构建私有会话
    ├── 2. 创建具体 Agent
    ├── 3. 构建作用域上下文
    ├── 4. 执行可选 setup()
    ├── 5. 进入注册表
    ├── 6. 发布 session/created + agent/created
    └── 7. 启动驱动循环
```

**事务性保证**：setup 抛出、commit 失败或 owner 注销 → 回滚，不发布任何 ID。

---

## 二、Turn 与 Step 模型

### 2.1 核心定义

```
Turn: 一次输入的完整处理周期
Step: 一次模型请求 + 其触发的工具调用
```

### 2.2 Turn Flow 状态机

```
turn/start
    │
    ├── 1. claim next-step input + one queued message
    ├── 2. assemble prompt sections + tool schemas
    │
    ▼
    ┌─────────────────────┐
    │ agent/pre-step       │  ← 可拒绝或改写输入
    └─────────────────────┘
    │
    ├─ reject → turn 以空 step 关闭
    │
    └─ enter
        │
        ▼
        step/start
        │
        ├── append entered messages as user/message
        ├── derive model history from log
        │
        ▼
        agent/request → llm/stream → assistant/chunk* → assistant/message
        │
        ▼
        tool/call* → tools/pre-execute → tools/execute → tools/post-execute → tool/result*
        │
        ▼
        step/end
        │
        ├── 工具仍需调用 → claim → next step
        ├── 收到 next-step 输入 → claim → next step
        └── 无更多工作
            │
            ▼
            agent/turn-stopping  ← 最终拦截点
            │
            ▼
            turn/end
```

### 2.3 Waterfall 事件模型

以下事件为 **waterfall** 类型，监听器必须调用 `next()` 才能委托：

| 事件 | 用途 |
|------|------|
| `agent/pre-step` | 决定是否进入 step，可改写消息 |
| `agent/request` | 模型请求前的预处理 |
| `llm/stream` | 流式响应处理 |
| `tools/pre-execute` | 工具执行前拦截 |
| `tools/execute` | 工具执行（可并行） |
| `tools/post-execute` | 工具执行后处理 |

`agent/turn-stopping` 为 **serial** 类型，无 `next()`，是最终拦截点。

---

## 三、并行工具调用调度

### 3.1 调度算法

```typescript
// 有界并行池 + 独占屏障
type ToolCall = {
  id: ToolCallId
  isConcurrencySafe: boolean
  execute(): Promise<ToolResult>
}

async function scheduleToolCalls(calls: ToolCall[]): Promise<ToolResult[]> {
  const safe = calls.filter(c => c.isConcurrencySafe)
  const exclusive = calls.filter(c => !c.isConcurrencySafe)

  // 独占调用形成屏障，必须串行
  const exclusiveResults = await Promise.all(
    exclusive.map(c => c.execute())
  )

  // 安全调用使用有界并行池
  const safeResults = await boundedPool(safe, maxParallelToolCalls)

  return [...exclusiveResults, ...safeResults]
}
```

### 3.2 限制

- **分类是单元的**：依赖兄弟比较或资源比较的安全判断必须保持独占
- **配置标签默认新建**：省略 `sessionId` 每次启动创建新的 `${id}-session-<uuid>`

---

## 四、Cancel & Retry 机制

### 4.1 Cancellation 流程

```typescript
type AgentCancelCause =
  | { kind: 'user' }
  | { kind: 'parent' }
  | { kind: 'hook'; reason: string }
  | { kind: 'disposed' }

interface CancelOptions {
  keepInbox?: boolean  // 保留待处理输入
}
```

**取消收敛规则**：
- 活动取消持有者将 cause 复制到运行时 `AbortSignal.reason`
- 后续唤醒的输入排队到下一轮
- 已投递的流最终化为 `interrupted: true` anchor

### 4.2 Retry 机制

```typescript
type RequestErrorAction = { kind: 'retry' } | undefined

// agent/request-error 监听器
// - 返回 { kind: 'retry' } 不调用 next() → 触发重试
// - 返回 undefined → 失败为终端
```

**重试策略**：
- 空响应（EMPTY_RESPONSE）默认可重试
- 上下文溢出（CONTEXT_WINDOW_EXCEEDED）触发压缩
- 适配器重试由 `ResolvedRetryPolicy` 控制

---

## 五、Request Header 重建

### 5.1 可重建性保证

```
任何到达模型请求的内容必须可从会话日志重建
```

**实现方式**：
- 每个 step 边界记录完整的 `request/header` 快照
- `foldRequestHeader(events)` 从日志选择最新快照
- 每次请求是日志的纯函数

```typescript
type RequestHeaderReason = 'initial' | 'resume' | 'change' | 'series'

interface RequestHeader {
  provider: string
  model: string
  systemPrompt: string
  toolSchemas: ToolSchema[]
  reasoningEffort: ReasoningEffortId
  maxTokens?: number
  timestamp: number
}
```

---

## 六、事件类型体系

### 6.1 SessionEventMap（核心事件）

```typescript
interface SessionEventMap {
  'turn/start': TurnStartEvent
  'turn/end': TurnEndEvent
  'step/start': StepStartEvent
  'step/end': StepEndEvent
  'user/message': UserMessageEvent
  'assistant/chunk': AssistantChunkEvent
  'assistant/message': AssistantMessageEvent
  'tool/call': ToolCallEvent
  'tool/result': ToolResultEvent
  'request/header': RequestHeaderEvent
  'request/context': RequestContextEvent
  'session/end-seed': SessionEndSeedEvent
}
```

### 6.2 类型安全模式

```typescript
// 声明合并扩展
declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'compaction/start': CompactionStartEvent
    'compaction/summary': CompactionSummaryEvent
    'compaction/end': CompactionEndEvent
  }
}
```

---

## 七、关键设计决策

| 决策 | 理由 |
|------|------|
| Turn/Step 边界使用 durable session events | 支持 fork/resume/transcript |
| 所有扩展通过 waterfall 事件 | 解耦，可替换 |
| 作用域隔离 | 不同 agent 拥有独立工具集 |
| 持久化作为独立关注点 | 会话日志与存储后端分离 |
| 不可变消息 | 支持精确重放和 KV cache 优化 |

---

*提取自: packages/core/agent-loop/src/agent.ts, packages/core/session/src/types.ts*

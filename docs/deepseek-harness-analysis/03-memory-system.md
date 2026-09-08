# 核心算法提取：记忆系统（Session/Compaction/Projection）

## 一、Session 事件溯源架构

### 1.1 核心设计

```
Session = Append-Only Log of Typed SessionEvents
          ↓
deriveMessages() → Model History（派生，不单独存储）
          ↓
Replay = 从同一事件重新派生
```

**关键原则**：`Model-visible ⟺ Logged` —— 任何到达模型请求的内容必须可从日志重建。

### 1.2 数据结构

```typescript
interface Session {
  // 序列号系统
  seq: SessionLogOffset                    // 当前日志长度
  eventAt(seq: SessionSeq): SessionEvent   // 按序号读取单个事件
  snapshotEvents(fromSeq?: SessionSeq, toSeqExclusive?: SessionSeq): SessionEvent[]

  // 核心操作
  append(type: string, data: unknown, opts?: AppendOptions): SessionSeq
  deriveMessages(): Message[]              // 从日志派生模型历史
  fork(source: Session, boundary?: SessionSeq, childId?: SessionId): Session
  flush(signal?: AbortSignal): Promise<void>
}
```

### 1.3 Surface Projection

```typescript
type SurfaceEventType = 'user/message' | 'assistant/message' | 'tool/result'

interface AppendOptions {
  surfaceOp?:
    | { op: 'append' }
    | { op: 'replace'; start: SessionSeq; end: SessionSeq }
    | { op: 'insert-before'; ref: SessionSeq }
}
```

**投影规则**：
- `append`: 追加到有序 surface
- `replace`: 用新节点替换旧节点范围，shadowed nodes 保留在日志
- `insert-before`: 在参考位置前插入

---

## 二、Request Header 折叠与重建

### 2.1 Header 存储

```typescript
interface RequestHeaderEvent {
  type: 'request/header'
  data: {
    reason: 'initial' | 'resume' | 'change' | 'series'
    startsSeries?: boolean
    provider: string
    model: string
    systemPrompt: string
    toolSchemas: ToolSchema[]
    reasoningEffort: ReasoningEffortId
    maxTokens?: number
    adapterDefaults: Record<string, unknown>
    timestamp: number
  }
}
```

### 2.2 折叠算法

```typescript
function foldRequestHeader(events: SessionEvent[]): RequestHeader {
  // 选择最新的快照
  const headers = events
    .filter(e => e.type === 'request/header')
    .map(e => e.data)
    .sort((a, b) => a.timestamp - b.timestamp)

  return headers[headers.length - 1]
}
```

**不变量**：相同系列的步骤、重试和后续 turn 继承最新 header。

---

## 三、Context Projection Seam

### 3.1 设计目的

```
Session Events (append-only)
    │
    ├── 多个 projection 单元独立折叠
    │
    └── 宿主消费者读取 typed state
```

### 3.2 API 设计

```typescript
interface SessionProjectionRegistry {
  register<T>(key: symbol, reducer: (state: T, event: SessionEvent) => T): void
  stateOf<T>(key: symbol): T
  snapshot(keys: symbol[]): Record<string, unknown>
}

// 使用示例
ctx.sessionProjections.register(turnBoundaryKey, (state, event) => {
  if (event.type === 'turn/start') return { open: true, turn: event.data.turn }
  if (event.type === 'turn/end') return { open: false }
  return state
})
```

### 3.3 强制约束

```typescript
// 宿主消费者必须显式请求
ctx.inject(['sessionProjections'], async (projections) => {
  const state = projections.stateOf(turnBoundaryKey)
  // ...
})
```

---

## 四、Compaction 算法

### 4.1 压缩触发条件

```typescript
type CompactionTrigger = 'pressure' | 'context-overflow'

// pressure: 基于 token meter 的压力阈值
// context-overflow: 提供者确认的上下文溢出
```

### 4.2 Compaction 流程

```
agent/pre-step waterfall
    │
    ├── 检测到压力/溢出
    ├── 可选: 工具结果裁剪（pruning）
    ├── 重新测量 token 计数
    │
    ▼
compaction/start  ← 获取锁
    │
    ├── 选择可压缩范围
    ├── 调用 LLM 生成摘要
    │
    ▼
compaction/summary  ← 记录摘要
    │
    ├── 生成 replacement user/message
    │     surfaceOp: { op: 'replace', start, end }
    │
    ▼
compaction/end  ← 释放锁
```

### 4.3 锁机制

```typescript
interface CompactionLock {
  compactionId: CompactionId
  turn: number | null  // 自动压缩: 数字; 手动: null
  startedAt: number
}

// 未匹配的 start 阻止所有入口点
// 未匹配的 start 在新 session/end-seed 后视为陈旧证据
```

### 4.4 工具结果裁剪

```typescript
interface PrunedEntry {
  originalSeq: SessionSeq
  replacementSeq: SessionSeq
  callId: ToolCallId
  charsBefore: number
  charsAfter: number
}

// 头/中/尾三段式裁剪
// 保留富媒体块顺序
// 文本切片基于 Unicode code point
```

---

## 五、Fork 与 Resume 机制

### 5.1 Fork 算法

```typescript
function fork(
  source: Session,
  boundary: SessionSeq = source.seq,  // 默认到最后一个事件
  childSessionId?: SessionId
): Session {
  // 1. 验证边界在 closed turn 之后
  assert(boundary >= source.inheritedEventCount)

  // 2. 创建子会话
  const child = new Session(childSessionId ?? generateId())

  // 3. 复制事件前缀
  for (let i = 0; i <= boundary; i++) {
    child.append(source.eventAt(i).type, source.eventAt(i).data)
  }

  // 4. 设置 lineage
  child.meta = {
    parentSession: source.id,
    seedLength: boundary,
    inheritedEventCount: boundary
  }

  return child
}
```

### 5.2 Resume 流程

```
resume(sessionId)
    │
    ├── persistence.open(id, 'write')  ← 排除并发 resume
    ├── 读取物理有效的日志
    ├── 附加 interruptedTurnClosers（崩溃修复）
    ├── appendUnstoredSuffix（setup 窗口事件）
    └── 发布 agent/session-start
```

---

## 六、Token Meter 与定价

### 6.1 设计目的

```
Compaction 决策依赖 token 估计
Token Meter 提供同步、无 I/O 的估计
```

### 6.2 API

```typescript
interface TokenMeter {
  // 估计消息 token 数
  estimate(messages: Message[]): number

  // 获取模型路由的定价
  pricingFor(provider: string, model: string): ModelPricing

  // 图像请求定价（如果提供者收取视觉 token）
  imageRequestPricing(provider: string, model: string): LlmImageRequestPricing
}
```

### 6.3 缓存策略

```typescript
// deriveMessages() 缓存每个 surface node 的投影
// 只在 surface rewrite 时重建
```

---

## 七、持久化后端接口

### 7.1 SessionPersistence

```typescript
interface SessionPersistence {
  // 创建新会话
  create(header: RequestHeader): Promise<SessionWriteHandle>

  // 打开现有会话
  open(id: SessionId, mode: 'read' | 'write'): Promise<SessionWriteHandle>

  // 获取会话统计
  stat(id: SessionId): Promise<SessionStats>

  // 列出会话
  list(filter?: SessionFilter): Promise<SessionInfo[]>

  // 导出会话
  export(id: SessionId): Promise<SessionExport>
}
```

### 7.2 写入模式

```typescript
// 批量写入 + flush barrier
await session.append('user/message', data)
await session.append('assistant/message', data)
await ctx.sessions.flush(session)  // 确保持久化
```

---

## 八、错误恢复

### 8.1 崩溃修复

```typescript
function repairCrashedLog(log: SessionEvent[]): SessionEvent[] {
  // 1. 查找未闭合的 turn
  const openTurns = findOpenTurns(log)

  // 2. 附加 synthetic turn/closers
  for (const turn of openTurns) {
    log.push({
      type: 'turn/end',
      data: { turn, reason: { kind: 'aborted' }, timestamp: Date.now() }
    })
  }

  // 3. 修复未配对的 tool/call
  const unmatchedCalls = findUnmatchedToolCalls(log)
  for (const call of unmatchedCalls) {
    log.push({
      type: 'tool/result',
      data: {
        toolCallId: call.id,
        content: [{ type: 'text', text: RECOVERY_MESSAGE }],
        isError: true,
        outcome: 'TOOL_NOT_STARTED'
      }
    })
  }

  return log
}
```

---

## 九、关键设计决策

| 决策 | 理由 |
|------|------|
| Append-only log | 支持精确重放，不变性 |
| Surface projection | 模型历史与日志分离 |
| Compaction 使用 replace | 保留日志完整性 |
| Fork 基于闭 turn 边界 | 避免中间状态 |
| Token estimation 同步 | 避免阻塞压缩决策 |
| Crash recovery 逻辑 | 独立于存储后端 |

---

*提取自: packages/core/session/src/, packages/compaction/compaction/src/*

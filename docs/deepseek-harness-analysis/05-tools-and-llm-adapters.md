# 核心算法提取：工具管道与 LLM 适配器

## 一、Tool 管道架构

### 1.1 核心接口

```typescript
interface ToolDefinition extends ToolSchema {
  // 模型可见部分（来自 ToolSchema）
  name: string
  description: string
  inputSchema: JsonSchemaNode

  // 执行相关
  execute(args: unknown, signal: AbortSignal): Promise<ToolResult>

  // 输出契约
  output: ToolOutputDefinition

  // 可选
  timeoutMs?: number
  isConcurrencySafe?: boolean
  finalizeContent?(result: ToolResult): ContentBlock[]
  presentCall?(args: unknown): Presentation
  presentResult?(result: ToolResult): Presentation
}
```

### 1.2 ToolOutputDefinition

```typescript
interface ToolOutputDefinition {
  schema: JsonSchemaNode        // 严格 JSON Schema 验证
  render(args: unknown, value: JsonValue): ContentBlock[]
  presentationMeta?(args: unknown, value: JsonValue): JsonValue
}
```

---

## 二、执行管道

### 2.1 完整流程

```
model calls tool
    │
    ▼
tool/call event emitted
    │
    ▼
tools/pre-execute waterfall
    │   ├── 权限检查
    │   ├── 参数验证
    │   └── 可拦截/改写
    │
    ▼
tools/execute waterfall
    │   ├── 并行安全工具: 有界并行池
    │   ├── 独占工具: 串行屏障
    │   └── 超时控制
    │
    ▼
tools/post-execute waterfall
    │   ├── 结果验证
    │   ├── 安全过滤
    │   └── UI 呈现准备
    │
    ▼
tool/result event emitted
    │
    ▼
append to session log
```

### 2.2 并行调度算法

```typescript
async function executeTools(
  calls: ToolCall[],
  maxParallel: number,
  signal: AbortSignal
): Promise<ToolResult[]> {
  const safe = calls.filter(c => c.isConcurrencySafe)
  const exclusive = calls.filter(c => !c.isConcurrencySafe)

  // 独占调用形成屏障
  const exclusiveResults = await Promise.all(
    exclusive.map(c => executeExclusive(c, signal))
  )

  // 安全调用使用有界池
  const safeResults = await boundedPool(
    safe,
    maxParallel,
    (call) => executeSafe(call, signal)
  )

  return [...exclusiveResults, ...safeResults]
}

async function boundedPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R | null>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++
      results[i] = await fn(items[i], i)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  return results.filter(Boolean)
}
```

---

## 三、Prompt 组装

### 3.1 组件

```typescript
interface SystemPromptAssembly {
  sections: PromptSection[]       // 有序提示词片段
  variables: VariableResolver[]   // 动态变量
  toolSchemas: ToolSchema[]       // 工具模式
}

interface PromptSection {
  name: string
  order: number                   // 升序拼接
  text: string                    // 静态或解析后文本
  complete?: boolean              // 完全替代其他部分
}
```

### 3.2 组装算法

```typescript
function assemblePrompt(
  sections: PromptSection[],
  variables: Map<string, VariableResolver>,
  toolSchemas: ToolSchema[],
  context: AssemblyContext
): Prompt {
  // 1. 合并全局与作用域
  const merged = mergeGlobalAndScoped(sections)

  // 2. 按 order 排序
  const ordered = merged.sort((a, b) =>
    a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name)
  )

  // 3. 解析变量
  const resolved = ordered.map(s => ({
    ...s,
    text: interpolateVariables(s.text, variables, context)
  }))

  // 4. 应用 runtime context suppressor
  const final = applySuppressors(resolved, context)

  // 5. 检查 complete 声明
  const completions = final.filter(s => s.complete)
  if (completions.length > 1) {
    throw new Error('Multiple complete sections')
  }
  if (completions.length === 1) {
    return { text: completions[0].text, tools: toolSchemas }
  }

  // 6. 拼接
  const text = final
    .filter(s => s.text.length > 0)
    .map(s => s.text)
    .join('\n\n')

  return { text, tools: toolSchemas }
}
```

### 3.3 变量解析

```typescript
type VariableResolver = (context: ResolutionContext) => string

// 注册示例
ctx.systemPrompt.variable('cwd', (ctx) => ctx.agent?.session.header.cwd)
ctx.systemPrompt.variable('model', (ctx) => ctx.agent?.options.model ?? 'unknown')

// 插值
function interpolateVariables(
  text: string,
  variables: Map<string, VariableResolver>,
  context: ResolutionContext
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const resolver = variables.get(name)
    if (!resolver) throw new Error(`Unknown variable: ${name}`)
    return resolver(context) ?? ''
  })
}
```

---

## 四、LLM 适配器

### 4.1 适配器合同

```typescript
interface LlmAdapter {
  // 必需方法
  stream(request: ModelRequest, signal: AbortSignal): AsyncIterable<StreamChunk>

  // 可选
  imageRequestPricing?: (images: ImageAttachmentRef[]) => LlmImageRequestPrice[]
  prepareCall(request: ModelRequest): PreparedRequest
}
```

### 4.2 StreamChunk 协议

```typescript
type StreamChunk =
  | { type: 'block-start'; index: number; blockType: ContentBlockType }
  | { type: 'text-delta'; index: number; text: string }
  | { type: 'reasoning-delta'; index: number; text: string }
  | { type: 'tool-call-delta'; index: number; id: ToolCallId; name?: string; argumentsDelta: string }
  | { type: 'block-end'; index: number; block: ContentBlock }
  | { type: 'usage'; usage: TokenUsage }
  | {
      type: 'finish'
      reason: FinishReason
      replayState?: ReplayEnvelope
    }
  | { type: 'error'; failure: LlmFailure }
  | { type: 'aborted' }
```

### 4.3 流组装器

```typescript
class StreamAssembler {
  private blocks: ContentBlock[] = []
  private deltas: string[] = []

  async *assemble(
    chunk: AsyncIterable<StreamChunk>
  ): AsyncGenerator<StreamChunk> {
    for await (const c of chunk) {
      yield c

      if (c.type === 'text-delta') {
        this.deltas[c.index] = (this.deltas[c.index] ?? '') + c.text
      }
      if (c.type === 'tool-call-delta') {
        // 累积 raw JSON arguments
      }
      if (c.type === 'block-end') {
        this.blocks[c.index] = c.block
      }
    }
  }
}
```

### 4.4 Replay State

```typescript
interface ReplayEnvelope {
  response: unknown                // 响应级适配器私有元数据
  blocks?: readonly unknown[]      // 每块适配器私有元数据
}

// 规则：
// 1. 装配丢弃某块时，同步丢弃 blocks 中同位置条目
// 2. 长度不匹配则丢弃整个 envelope
// 3. 后续请求时，仅当历史提供者与目标提供者属于同一适配器实例才传递
```

---

## 五、失败处理与重试

### 5.1 Retry Policy

```typescript
type ResolvedRetryPolicy =
  | {
      mode: 'normal'
      maxRetries: number
      retryableCodes: string[]
      initialDelayMs: number
      maxDelayMs: number
      jitterRatio: number
    }
  | {
      mode: 'always'
      initialDelayMs: number
      maxDelayMs: number
      jitterRatio: number
    }
```

### 5.2 错误分类

```typescript
interface LlmFailure {
  message: string
  code: string                          // 标准化错误码
  status?: number                       // HTTP 状态
  providerRetryAfterMs?: number         // 提供者建议的延迟
  requestId?: ProviderRequestId         // 诊断用
}

// 关键错误码
const ERROR_CODES = {
  CONTEXT_WINDOW_EXCEEDED: 'CONTEXT_WINDOW_EXCEEDED',
  EMPTY_RESPONSE: 'EMPTY_RESPONSE',
  TIMEOUT: 'TIMEOUT',
  ABORTED: 'ABORTED',
  NO_ADAPTER: 'NO_ADAPTER'
} as const
```

### 5.3 重试实现

```typescript
async function streamWithRetry(
  adapter: LlmAdapter,
  request: ModelRequest,
  policy: ResolvedRetryPolicy,
  signal: AbortSignal
): Promise<AsyncIterable<StreamChunk>> {
  let delay = policy.initialDelayMs
  let retries = 0

  while (true) {
    try {
      return adapter.stream(request, signal)
    } catch (err) {
      const failure = normalizeError(err)

      if (!isRetryable(failure, policy)) {
        throw failure
      }

      if (policy.mode === 'normal' && retries >= policy.maxRetries) {
        throw failure
      }

      await sleep(jitter(delay))
      retries++
    }
  }
}
```

---

## 六、Scope 机制

### 6.1 作用域原语

```typescript
function createScope(): Scope {
  const registrations = new Map<symbol, Registration>()
  let disposed = false

  return {
    register(key: symbol, value: unknown): Disposable {
      if (disposed) throw new Error('Scope disposed')
      registrations.set(key, { value, disposed: false })
      return { dispose: () => { registrations.delete(key) } }
    },
    get(key: symbol): unknown {
      return registrations.get(key)?.value
    },
    dispose(): void {
      disposed = true
      registrations.clear()
    }
  }
}
```

### 6.2 Shadowing 规则

```typescript
// 作用域优先
function resolveScoped<T>(
  global: Map<string, T>,
  scoped: Map<Agent, Map<string, T>>
): Map<string, T> {
  const result = new Map(global)

  for (const [agent, agentScope] of scoped) {
    for (const [key, value] of agentScope) {
      result.set(key, value)  // 作用域版本覆盖全局
    }
  }

  return result
}
```

---

## 七、类型安全模式

### 7.1 声明合并扩展

```typescript
// 核心包定义
interface ToolSchemaMap {
  'read_file': ReadFileSchema
  'write_file': WriteFileSchema
}

// 插件扩展（无需修改核心包）
declare module '@deepseek-ai/dsh-tools' {
  interface ToolSchemaMap {
    'my_custom_tool': MyCustomToolSchema
  }
}
```

### 7.2 Branded IDs

```typescript
// 防止 ID 混淆
type SessionId = Brand<string, 'SessionId'>
type ToolCallId = Brand<string, 'ToolCallId'>
type MessageId = Brand<string, 'MessageId'>

function createSessionId(): SessionId {
  return crypto.randomUUID() as SessionId
}
```

---

## 八、关键设计决策

| 决策 | 理由 |
|------|------|
| Tool pipeline 作为 waterfall | 每个阶段可独立拦截 |
| 并行/独占分离调度 | 有依赖的工具必须串行 |
| Prompt assembly 两次阶段 | 先解析后插值，确保一致性 |
| Adapter 单一调用原则 | 客户端控制重试 |
| Scope shadowing | 支持 per-agent 个性化 |
| Replay envelope 分离 | 适配器私有状态不影响 harness |

---

*提取自: packages/core/tools/src/, packages/llm/llm/src/, packages/core/scope/src/*

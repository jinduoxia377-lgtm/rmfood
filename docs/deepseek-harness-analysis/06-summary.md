# DeepSeek Harness 核心算法提取总结

## 提取成果

| 文件 | 内容 | 核心算法 |
|------|------|----------|
| `01-project-overview.md` | 项目概览与架构 | Cordis 框架、Plugin 系统 |
| `02-agent-loop-algorithm.md` | Agent Loop 与 Turn Flow | Turn/Step 驱动、Cancel/Retry |
| `03-memory-system.md` | 记忆系统 | Event Sourcing、Compaction、Fork |
| `04-agents-system.md` | 智能体系统 | Subagent、Teams、Workflow、Ralph |
| `05-tools-and-llm-adapters.md` | 工具管道与 LLM | Tool Pipeline、Prompt Assembly、Adapter |

---

## 核心算法矩阵

### Agent Loop 算法

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Loop                               │
├─────────────────────────────────────────────────────────────────┤
│  Turn Flow:                                                        │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ turn/start│───→│pre-step  │───→│ step     │───→│turn/end  │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │             │                │                          │
│       │        reject/enter     tool/call → execute → result   │
│       │             │                │                          │
│       └─────────────┴────────────────┘                          │
│                                                                 │
│  Waterfall Events:                                              │
│  agent/pre-step → agent/request → llm/stream                    │
│       → tools/pre-execute → tools/execute → tools/post-execute  │
│                                                                 │
│  Cancellation:                                                  │
│  keepInbox=false: 丢弃待处理输入                                  │
│  keepInbox=true:   保留待处理输入到下一轮                         │
└─────────────────────────────────────────────────────────────────┘
```

### Memory System 算法

```
┌─────────────────────────────────────────────────────────────────┐
│                      Memory System                              │
├─────────────────────────────────────────────────────────────────┤
│  Event Sourcing:                                                 │
│  Session.append(event) → Log[seq]                                │
│       ↓                                                          │
│  deriveMessages() → Model History (cached)                       │
│                                                                 │
│  Compaction:                                                     │
│  trigger='pressure' / 'overflow'                                 │
│       ↓                                                          │
│  select_range → LLM summarize → replace surface                  │
│       ↓                                                          │
│  shadowed seqs retained in log                                   │
│                                                                 │
│  Fork/Resume:                                                    │
│  fork(source, boundary) → child with prefix copy                  │
│  resume(id) → persistence.open → load log → repair if needed     │
└─────────────────────────────────────────────────────────────────┘
```

### Agent System 算法

```
┌─────────────────────────────────────────────────────────────────┐
│                      Agent System                               │
├─────────────────────────────────────────────────────────────────┤
│  Subagent Delegation:                                            │
│  agent(name, options) → spawn/fork → child runs → result        │
│                                                                 │
│  Agent Teams:                                                    │
│  Lead creates tasks (DAG) → teammates execute → mailbox delivery│
│                                                                 │
│  Workflow:                                                       │
│  script(text) + meta(data) → worker_thread → parallel/pipeline  │
│                                                                 │
│  Ralph Loop:                                                     │
│  fresh_agent(round) → handoff(summary,evidence,nextSteps)       │
│       ↓                                                          │
│  next_round receives handoff → continues until complete         │
└─────────────────────────────────────────────────────────────────┘
```

### Tool Pipeline 算法

```
┌─────────────────────────────────────────────────────────────────┐
│                     Tool Pipeline                               │
├─────────────────────────────────────────────────────────────────┤
│  Execution:                                                      │
│  parallel_safe_tools → bounded_pool(maxParallel)                  │
│  exclusive_tools → sequential_barrier                             │
│                                                                 │
│  Prompt Assembly:                                                │
│  sections.sort(order) → interpolate(variables) → join           │
│                                                                 │
│  LLM Adapter:                                                    │
│  stream(request) → AsyncIterable<StreamChunk>                     │
│       ↓                                                          │
│  assemble → ContentBlock[] + ReplayEnvelope                      │
│                                                                 │
│  Retry:                                                          │
│  isRetryable(failure) → sleep(jitter) → retry                   │
│  maxRetries / always mode                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 关键设计模式

### 1. Capability Seam（能力缝）

```
Service Definition (interface)
        ↓
Service Provider (implementation)
        ↓
Consumer (usage)
```

**示例**：`dsh-shell`（定义）+ `dsh-bash-local`（提供）+ `dsh-tool-bash`（消费）

### 2. Event Sourcing（事件溯源）

```
Append-only Log
       ↓
Multiple Projections
  - deriveMessages() → Model History
  - SessionProjection → Typed State
  - Persistence Backend → Durable Storage
```

### 3. Waterfall Events（瀑布事件）

```
Event Emitter
       ↓
Listener 1: handle() → next()
       ↓
Listener 2: handle() → next()
       ↓
Listener N: handle() → next()
       ↓
Default handler
```

### 4. Scope Shadowing（作用域遮蔽）

```
Global Registration (visible to all)
        ↓
Scoped Registration (overrides global for specific agent)
        ↓
Most-specific-wins resolution
```

---

## 性能优化要点

| 优化点 | 策略 |
|--------|------|
| KV Cache | 追加-only，相同前缀可复用 |
| Token 计数 | 同步估计，避免阻塞 |
| 并行工具 | 有界池调度，独占工具串行 |
| 投影缓存 | deriveMessages() 缓存每个节点 |
| 批量写入 | session/event 批量 + flush barrier |

---

## 安全设计

| 安全措施 | 实现 |
|----------|------|
| 工具执行隔离 | 独占调用形成屏障 |
| 取消传播 | AbortSignal 传递 |
| 沙箱执行 | node-addon-landlock-run |
| 输入验证 | JSON Schema 严格验证 |
| 身份认证 | Provider 适配器层 |

---

## 扩展点索引

| 扩展需求 | 机制 | 参考文件 |
|----------|------|----------|
| 添加模型提供者 | 注册 LLM Adapter | `05-tools-and-llm-adapters.md` |
| 添加工具 | 注册到 `ctx.tools` | `05-tools-and-llm-adapters.md` |
| 拦截请求 | `agent/request` waterfall | `02-agent-loop-algorithm.md` |
| 压缩上下文 | 实现 `CompactionEngine` | `03-memory-system.md` |
| 子智能体 | 实现 Subagent Provider | `04-agents-system.md` |
| 自定义 Workflow | 实现 `WorkflowEngine` | `04-agents-system.md` |

---

*分析完成日期: 2026-09-03*
*数据源: https://github.com/deepseek-ai/deepseek-harness*

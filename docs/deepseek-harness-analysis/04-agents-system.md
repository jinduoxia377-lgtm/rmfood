# 核心算法提取：智能体系统（Subagent/Teams/Workflow/Ralph）

## 一、Subagent 能力缝

### 1.1 架构设计

```
┌─────────────────────────────────────────────────────┐
│                    dsh-subagent                     │
│              (Service Definition)                   │
│              ctx.subagents                          │
└─────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│spawn-in-process│  │fork-in-process │  │    acp         │
│   Provider     │  │   Provider     │  │   Provider     │
└────────────────┘  └────────────────┘  └────────────────┘
         │                    │                    │
         └────────┬───────────┘                    │
                  ▼                                │
        ┌─────────────────────┐                    │
        │  dsh-tool-subagent  │◄───────────────────┘
        │  (Consumer Tool)    │  多提供者共存
        └─────────────────────┘
```

### 1.2 Provider 类型

| Provider | 描述 |
|----------|------|
| `spawn-in-process` | 同进程子 agent |
| `fork-in-process` | fork 子 agent（继承会话历史） |
| `acp` | Agent Client Protocol 远程 agent |
| `codex` | OpenAI Codex |
| `claude-code` | Claude Code |
| `dsh-sdk` | DeepSeek Harness SDK |

### 1.3 Subagent 生命周期

```
agent() 调用
    │
    ├── 验证 schema
    ├── 创建子 Agent（fork 或 spawn）
    ├── 启动子 Agent
    ├── 等待完成或超时
    └── 返回结果
```

### 1.4 Continuable Subagent

```typescript
interface ContinuableSubagent {
  // 可继续的子 agent，支持消息传递
  send(to: SessionId, message: ContentBlock[]): SendResult
  interrupt(id: SessionId): InterruptResult
  list(): AgentInfo[]
}
```

---

## 二、Agent Teams（实验性）

### 2.1 核心概念

```
TeamId (root SessionId)
    │
    ├── Lead Agent
    │   ├── Task Board (DAG)
    │   ├── Mailbox (队列消息)
    │   └── Roster (成员列表)
    │
    └── Teammate Agents (children)
```

### 2.2 角色与身份

```typescript
interface TeamMemberSnapshot {
  id: SessionId              // 团队成员的会话 ID
  name: string               // 不可变标签
  description: string
  provider: string
  context: 'fresh' | 'fork'  // 创建方式
  phase: TeamMemberPhase     // provisioning → active | failed
}
```

### 2.3 Durable Mailbox

```typescript
interface TeamMessageSnapshot {
  id: TeamMessageId
  senderId: SessionId
  senderName: string
  targetId: SessionId
  content: ContentBlock[]
}

// 投递语义：所有消息尝试 Steer 投递
// - 运行中目标: 在最近 step 边界接收
// - 空闲目标: 启动 turn
// - 非活跃目标: cold-resume
```

### 2.4 Task DAG

```typescript
interface TeamTaskSnapshot {
  id: TeamTaskId           // task-<n>
  revision: number         // CAS 值，每次修改递增
  subject: string
  description: string
  status: TeamTaskStatus   // pending | in_progress | completed | deleted
  ownerId?: SessionId
  blockedBy: TeamTaskId[]  // 依赖关系（必须无环）
  writeScopes: string[]    // 建议性路径前缀
}
```

### 2.5 重放算法

```typescript
function foldTeam(session: Session): TeamState {
  const roster = []
  const tasks = new Map<TeamTaskId, TeamTaskSnapshot>()
  const mailbox = []

  // 按 SessionEvent seq 顺序重放
  for (const event of session.events) {
    if (event.type === 'team/roster/update') {
      roster.push(event.data.snapshot)
    }
    if (event.type === 'team/task/create') {
      tasks.set(event.data.task.id, event.data.task)
    }
    if (event.type === 'team/task/update') {
      const existing = tasks.get(event.data.id)
      if (existing && existing.revision < event.data.revision) {
        tasks.set(event.data.id, event.data)
      }
    }
    if (event.type === 'team/message/send') {
      mailbox.push(event.data.message)
    }
  }

  return { roster, tasks, mailbox }
}
```

---

## 三、Workflow 能力缝

### 3.1 核心概念

Workflow 允许智能体运行模型编写的 **编排脚本**，脚本启动子 agent。

```typescript
interface WorkflowStartRequest {
  script: string           // 顶级 await 允许的纯 JS
  meta: WorkflowMeta       // 标识块（数据，非代码）
  args?: unknown           // 输入参数
  parent: Agent            // 必需：每个子 agent 的父级
  signal?: AbortSignal
}

interface WorkflowMeta {
  name: string
  description: string
  whenToUse?: string
  phases?: WorkflowPhase[]  // 进度词汇
}
```

### 3.2 Worker Thread 引擎

```typescript
// 每个运行使用一个 worker_thread
// 脚本在 VM 上下文中执行
class WorkflowWorkerThreadEngine implements WorkflowEngine {
  start(request: WorkflowStartRequest): WorkflowRun {
    const worker = new WorkerThread()
    const run = new WorkflowRun(worker, request)

    worker.execute(request.script, {
      agent: (name, options) => this.spawnAgent(run, name, options),
      parallel: (items, ...stages) => this.parallel(workers, items, stages),
      pipeline: (items, ...stages) => this.pipeline(workers, items, stages),
      log: (msg) => this.emitLog(run, msg)
    })

    return run
  }
}
```

### 3.3 组合子

```typescript
// parallel(): 并行运行每个项目通过所有阶段
async function parallel<T, R>(
  items: T[],
  stage1: (item: T) => Promise<R>,
  stage2: (item: T, r1: R) => Promise<R>,
  ...
): Promise<(R | null)[]>

// pipeline(): 将每个项目依次通过所有阶段
async function pipeline<T, R1, R2>(
  items: T[],
  stage1: (item: T) => Promise<R1>,
  stage2: (item: T, r1: R1) => Promise<R2>,
  ...
): Promise<(R1 | R2 | null)[]>
```

### 3.4 失败纪律

```typescript
interface WorkflowError extends Error {
  fatal: boolean  // true = 重新抛出，不映射为 null
}

// fatal 错误场景：
// - Hook 误用
// - 错误参数
// - 未知/延迟的 agent() 选项
// - 超出 schema 限制
// - 触发限制
// - 能力缝启动失败
// - 取消
```

---

## 四、Ralph 循环

### 4.1 定义

Ralph 循环是**面向目标的 fresh-agent 工作流**，针对不可变目标运行。

```
Ralph Loop
    │
    ├── Round 1: Fresh child session
    │   ├── 无父级对话种子
    │   ├── 共享 workspace
    │   └── 生成 Ralph Handoff
    │
    ├── Round 2: 另一个 fresh child
    │   ├── 接收 Handoff
    │   └── 继续工作
    │
    └── ...直到目标完成或达到预算
```

### 4.2 Handoff 格式

```typescript
interface RalphHandoff {
  status: 'in_progress' | 'blocked' | 'completed'
  summary: string           // 已完成工作的总结
  evidence: ContentBlock[]  // 证据/结果
  nextSteps: string[]       // 下一步建议
  blocker?: string          // 阻塞原因（如果有）
}
```

### 4.3 实现模式

```typescript
async function ralphLoop(
  objective: string,
  budget: RalphBudget
): Promise<RalphResult> {
  let handoff: RalphHandoff = {
    status: 'in_progress',
    summary: '',
    evidence: [],
    nextSteps: [objective]
  }

  for (let round = 0; round < budget.maxRounds; round++) {
    // 创建 fresh child session
    const child = await ctx.agents.create({
      provider: 'deepseek',
      model: 'deepseek-chat',
      setup: (agentCtx) => {
        // 注入 handoff 作为 context
        agentCtx.inject({
          role: 'user',
          content: [{ type: 'text', text: formatHandoff(handoff) }]
        })
      }
    })

    // 等待完成
    const result = await child.whenIdle()

    // 解析 handoff
    handoff = parseHandoffFromLog(child.session)

    if (handoff.status === 'completed') {
      return { success: true, result: handoff.evidence }
    }
  }

  return { success: false, reason: 'budget_exceeded' }
}
```

---

## 五、Goal 系统

### 5.1 核心概念

```
Goal: 附加到现有会话的持久化完成目标
Goal Round: 一次续期周期
```

### 5.2 状态机

```
active → paused → blocked → complete
    │         │         │
    └── resumed ┘         └── unblocked ┘
```

### 5.3 API

```typescript
interface Goal {
  id: GoalId
  sessionId: SessionId
  phase: 'active' | 'paused' | 'blocked' | 'complete'
  revision: number
  description: string
  createdAt: number
  updatedAt: number
}

// 使用示例
await ctx.goals.create({
  sessionId: currentSession.id,
  description: '实现用户认证模块'
})
```

---

## 六、Hook 桥接系统

### 6.1 Claude Code / Codex Hook 桥接

```typescript
interface HookBridge {
  // 监听外部 hook 事件
  onHook(type: string, handler: HookHandler): Disposable

  // 转换事件格式
  toHarnessEvent(raw: unknown): SessionEvent | null

  // 转发到会话
  forward(event: SessionEvent): void
}
```

### 6.2 Wire Protocol

```typescript
// 用于跨进程通信
interface HookWireMessage {
  type: 'hook' | 'result'
  id: string
  timestamp: number
  payload: unknown
}
```

---

## 七、关键设计决策

| 决策 | 理由 |
|------|------|
| Subagent 多提供者共存 | 不同场景需要不同隔离级别 |
| Team mailbox 持久化 | 支持崩溃恢复和重投递 |
| Task DAG revision 计数 | CAS 防止并发冲突 |
| Workflow script 为纯 JS | 沙箱执行，无外部依赖 |
| Ralph handoff 结构化 | 跨 round 知识传递 |
| Goal 状态独立于 loop | 可查询和监控 |

---

*提取自: packages/subagent/, packages/experimental/agent-team/, packages/workflow/*

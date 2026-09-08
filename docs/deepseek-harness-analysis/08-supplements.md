# 补充分析：Goal Round Driver、Hooks Bridge、Terminal 系统

## 一、Goal Round Driver（目标轮次驱动）

### 1.1 核心概念

自动在同一个会话中继续活跃目标，无需人工干预。

```
Agent Idle
    │
    ├── active goal 且 armed
    ├── roundsStarted < maxGoalRounds
    │
    ▼
创建 goal_round prompt
    │
    ▼
插入 inbox（next-step 或 next-turn）
    │
    ▼
下一 turn 消耗一个 round cap
    │
    ▼
继续直到完成/暂停/阻塞/耗尽
```

### 1.2 Reservation + Admission 模式

```typescript
// reservation-before-admission 防止竞争
async function scheduleGoalRound(goal: Goal, agent: Agent) {
  // 1. 预留 round
  const reserved = await goal.reserveRound()
  if (!reserved) return  // 竞争失败

  // 2. 等待 flush（如果 goal 已变更）
  if (goal.dirty) {
    await ctx.sessions.flush(agent.session)
    // 重新检查 goal revision
  }

  // 3. 入队 prompt
  agent.send(goalRoundPrompt, 'next-turn', true)
}
```

### 1.3 Race Fence 机制

```typescript
// agent/pre-step 监听器
function goalRoundFence(decision: PreStepDecision): PreStepDecision {
  // 1. 检查 goal 是否仍活跃
  // 2. 检查 revision 是否匹配
  // 3. 检查是否有竞争输入
  if (staleOrBlocked) return { kind: 'reject' }
  return decision
}
```

### 1.4 停止条件

| 条件 | 处理 |
|------|------|
| 目标完成 | 不再调度新 round |
| 目标暂停 | 取消进行中的 round |
| 目标阻塞 | 记录 blocker |
| round 耗尽 | 记录 blocker `round-limit` |
| 持久化失败 | disarms continuation |
| Agent 取消 | 不自动重启 |
| 插件卸载 | cancel + await quiescence |

---

## 二、Hooks Bridge（钩子桥接）

### 2.1 设计目标

运行现有 Claude Code/Codex 的 `hooks.json` 配置，无需重写。

### 2.2 事件映射表

| Claude Code Hook | Harness Extension Point | 能力 |
|-----------------|------------------------|------|
| `SessionStart` | `agent/session-start` | 附加 context |
| `UserPromptSubmit` | `agent/pre-step` | 拦截 prompt |
| `PreToolUse` | `tools/pre-execute` | 拦截工具调用 |
| `PostToolUse` | `tools/post-execute` | 修改结果 |
| `Stop` | `agent/turn-stopping` | 强制继续 |
| `SubagentStart` | `subagent/start` | 注入 context（in-process only） |
| `SubagentStop` | `subagent/end` | 仅观察 |

### 2.3 决策折叠规则

```typescript
// 决策优先级: deny > ask > allow
function foldDecisions(results: HookResult[]): 'allow' | 'ask' | 'deny' {
  if (results.some(r => r.kind === 'deny')) return 'deny'
  if (results.some(r => r.kind === 'ask')) return 'ask'
  return 'allow'
}
```

### 2.4 Payload 构建

```typescript
interface HookPayload {
  session_id: string
  transcript_path: string          // 始终为空
  cwd: string
  hook_event_name: string
  // 事件特定字段
  tool_name?: string              // PreToolUse/PostToolUse
  prompt?: string                 // UserPromptSubmit
  subagent_id?: string            // SubagentStart/Stop
}
```

### 2.5 串行执行保证

```
hook_1 (config order)
    │ 串行
    ▼
hook_2
    │ 串行
    ▼
hook_3
```

- 每个 hook 的 `hook/invoked` + `hook/result` 对在日志中相邻
- 决策折叠与顺序无关

### 2.6 分离运行管理

```typescript
// 三个 emit 点运行 detached
const detachedRuns = new Set<RunningHook>()

function runDetached(hook: HookConfig): void {
  const run = spawnHookProcess(hook.command)
  detachedRuns.add(run)
  run.finally(() => detachedRuns.delete(run))
}

// dispose 时清理
async function dispose(): Promise<void> {
  for (const run of detachedRuns) {
    run.abort()
  }
  await Promise.allSettled([...detachedRuns].map(r => r.settled))
}
```

---

## 三、Terminal 系统（持久终端）

### 3.1 架构

```
ctx.terminals (Service Definition)
    │
    ├── dsh-terminal-bash (Backend: PTY shell)
    └── dsh-tool-terminal (Consumer: 模型工具)
```

### 3.2 Session 生命周期

```
open(type, options)
    │
    ├── backend.spawn() → SessionHandle
    ├── 等待 readiness
    ├── 返回 id + startup output
    │
    ▼
send(text, submit?)
    │
    ├── 同步预留 send slot
    ├── 写入 PTY
    ├── 等待 ready / timeout
    │
    ▼
read(maxBytes)
    │
    └── 返回保留输出
    │
    ▼
close()
    │
    └── kill process tree → await quiescence
```

### 3.3 所有权隔离

```typescript
interface TerminalSession {
  id: TerminalId
  owner: Agent              // 精确对象引用
  name?: string             // 展示标签
  type: string              // 由 backend 提供
  pid?: number
  status: SessionStatus
  activeSend?: SendReservation
}

// 操作验证
function assertOwner(session: TerminalSession, caller: Agent): void {
  if (session.owner !== caller) {
    throw new Error('FOREIGN_SESSION')
  }
}
```

### 3.4 Send 预约机制

```typescript
interface SendReservation {
  text: string
  submit: boolean
  startedAt: number
  signal: AbortSignal
}

async function send(session: TerminalSession, text: string, submit: boolean): Promise<SendResult> {
  // 1. 同步预留（防止并发 send）
  if (session.activeSend) throw new Error('SEND_ACTIVE')

  session.activeSend = { text, submit, startedAt: Date.now(), signal }

  try {
    // 2. 写入 PTY
    await writePTY(session.pty, text + (submit ? '\n' : ''))
    // 3. 等待 ready
    return await waitForReady(session, signal)
  } finally {
    session.activeSend = undefined
  }
}
```

### 3.5 Wait Reasons

```typescript
type WaitReason =
  | 'stdin_read'       // shell 等待输入
  | 'inferred_idle'    // 输出静默推断空闲
  | 'timeout'          // 超时
  | 'session_exit'     // shell 进程退出
```

### 3.6 Error Codes

```typescript
type TerminalErrorCode =
  | 'NO_BACKEND'        // 未注册 backend type
  | 'NO_SESSION'        // 未知 session id
  | 'FOREIGN_SESSION'   // 不是自己的 session
  | 'SEND_ACTIVE'       // 已有 send 进行中
  | 'OWNER_NOT_LIVE'    // owner agent 已消失
```

---

## 四、补充算法汇总

### 4.1 Goal Round 状态机

```
          ┌─────────────────────────────────┐
          │                                 │
          ▼                                 │
    ┌─────────┐     idle     ┌──────────┐   │
    │ active  │─────────────→│scheduled │   │
    │  goal   │              └────┬─────┘   │
    └────┬────┘                   │         │
         │                        ▼         │
         │                 ┌──────────┐     │
         │                 │  running │     │
         │                 └────┬─────┘     │
         │                      │           │
         │            ┌─────────┼────────┐  │
         │            │         │        │  │
         │            ▼         ▼        ▼  │
         │      completed  paused  blocked  │
         │            │         │        │  │
         │            └─────────┴────────┘  │
         │                  │               │
         └──────────────────┘               │
            resume                          │
                                            │
         ┌─────────────────────────────────┐
         │  round cap exhausted             │
         └─────────────────────────────────┘
```

### 4.2 Hook 决策折叠树

```
         Hook Results
              │
    ┌─────────┼─────────┐
    │         │         │
   deny     ask      allow
    │         │         │
    ▼         ▼         ▼
  deny     ask      allow
```

### 4.3 Terminal Send 序列化

```
Session 1: send("cmd1") ──→ read ──→ send("cmd2") ──→ read
Session 2: send("cmd1") ──→ read ──→ send("cmd2") ──→ read

// 同一 session 串行
// 不同 session 并行
```

---

## 五、完整算法清单

| 类别 | 算法 | 文件位置 |
|------|------|----------|
| **核心循环** | Turn/Step 驱动 | `02-agent-loop-algorithm.md` |
| **核心循环** | Cancel/Retry 收敛 | `02-agent-loop-algorithm.md` |
| **核心循环** | Waterfall 委托 | `02-agent-loop-algorithm.md` |
| **记忆** | Event Sourcing | `03-memory-system.md` |
| **记忆** | Surface Projection | `03-memory-system.md` |
| **记忆** | Compaction 压缩 | `03-memory-system.md` |
| **记忆** | Fork/Resume | `03-memory-system.md` |
| **记忆** | Crash Recovery | `03-memory-system.md` |
| **记忆** | Token Meter | `07-missing-modules.md` |
| **智能体** | Subagent 委托 | `04-agents-system.md` |
| **智能体** | Team DAG | `04-agents-system.md` |
| **智能体** | Workflow 脚本 | `04-agents-system.md` |
| **智能体** | Ralph 循环 | `04-agents-system.md` |
| **智能体** | Goal Round 驱动 | `08-supplements.md` |
| **工具** | 并行调度 | `05-tools-and-llm-adapters.md` |
| **工具** | Prompt Assembly | `05-tools-and-llm-adapters.md` |
| **工具** | LLM Adapter 合同 | `05-tools-and-llm-adapters.md` |
| **桥接** | Hook 映射 | `08-supplements.md` |
| **终端** | PTY 管理 | `08-supplements.md` |
| **安全** | Sandbox 策略 | `07-missing-modules.md` |
| **设置** | 三层组合 | `07-missing-modules.md` |
| **协议** | ACP 多会话 | `07-missing-modules.md` |

---

*补充分析完成日期: 2026-09-03*

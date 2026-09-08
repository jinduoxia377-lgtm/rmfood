# 补充分析：Hooks、Settings、ACP、命令系统与沙箱

## 一、Hook 桥接系统（遗漏）

### 1.1 设计目的

将 Claude Code、Codex 等外部编辑器的 hook 机制桥接到 Harness 会话系统。

### 1.2 Hook 类型

```typescript
// PreToolUse: 工具执行前
// PostToolUse: 工具执行后
// Stop: 会话结束时
interface HookDefinition {
  matcher: string          // 正则匹配工具名
  command: string          // 执行的命令
  description: string
}
```

### 1.3 Wire Protocol

```typescript
// 跨进程通信协议
interface HookWireMessage {
  type: 'hook' | 'result'
  id: string
  timestamp: number
  payload: unknown
}

// 持久化记录
// hook/invoked  - 记录 hook 调用
// hook/result   - 记录 hook 结果
```

### 1.4 桥接流程

```
外部编辑器 hook 触发
    │
    ▼
HookBridge 接收原始事件
    │
    ▼
转换为 SessionEvent
    │
    ▼
附加到当前会话日志
    │
    ▼
观察者通过 session/event 接收
```

---

## 二、用户设置系统（遗漏）

### 2.1 Namespace 设计

```typescript
type SettingsNamespace = Branded<'SettingsNamespace'>

interface SettingsDescriptor {
  ns: SettingsNamespace
  schema: unknown              // schemastery JSON Schema
  value: unknown               // 当前解析值
  revision: number             // 单调递增版本号
  base?: unknown               // 配置层值
  user?: unknown               // 用户层值
  applies: 'live' | 'restart'
  secrets?: RedactedSecret[]
}
```

### 2.2 三层组合

```
Schema Defaults
      ↓
Composition Base (cordis.yml)
      ↓
User Section (stored document)
```

### 2.3 所有者句柄

```typescript
interface SettingsScope<T> {
  get(): T
  watch(callback: (next: T, prev: T) => void): () => void
  update(patch: object): Promise<void>
  replace(section: object): Promise<void>
}
```

### 2.4 跨字段验证

```typescript
interface SettingsRegisterOptions<T> {
  base?: Partial<T>
  applies?: 'live' | 'restart'
  validate?: (value: T) => void  // 拒绝不符合约束的写入
}

// 示例：provider 配置验证
validate(value) {
  if (!supportedProviders.has(value.provider)) {
    throw new Error(`Unsupported provider: ${value.provider}`)
  }
}
```

---

## 三、ACP 协议（遗漏）

### 3.1 定位

**Agent Client Protocol** — 专用于自动化的标准协议，非面向人类用户的 UI。

### 3.2 协议接口

| Call | 功能 |
|------|------|
| `initialize` | 获取能力列表和配置选项 |
| `session/new` | 创建新持久会话 |
| `session/list` | 列出可恢复会话 |
| `session/resume` | 恢复持久会话 |
| `session/close` | 关闭会话 |
| `session/set_config_option` | 设置模型/推理强度 |
| `session/prompt` | 发送提示 |
| `session/cancel` | 取消当前工作 |
| `session/update` | 消费语义更新 |
| `session/request_permission` | 处理权限请求 |

### 3.3 承诺

1. **仅标准语义更新** — 不暴露 DSH 私有呈现数据
2. **真实能力声明** — initialize 只声明已挂载的支持
3. **静默前结算** — prompt/close 等待 Agent 活动结束

### 3.4 多会话隔离

```
One ACP Connection
    │
    ├── Session 1 (独立 Agent)
    ├── Session 2 (独立 Agent)
    └── Session N (独立 Agent)

Each session owns:
  - Agent handle
  - MCP mounts
  - Prompt slot
  - Update chain
```

---

## 四、Human Command 系统（遗漏）

### 4.1 定义

人类命令是斜杠前缀指令，由 `ctx.commands` 解释和执行，**不进入模型消息**。

```typescript
interface CommandDefinition {
  name: string           // 如 'goal', 'compact'
  description: string
  execute(args: string[], context: CommandContext): CommandResult
}
```

### 4.2 与工具的区别

| 特性 | Human Command | Tool |
|------|--------------|------|
| 触发方式 | 用户输入 `/name` | 模型调用 |
| 执行路径 | `ctx.commands` | `ctx.tools` |
| 进入模型历史 | 否 | 是 |
| 典型用途 | 会话控制 | 能力提供 |

### 4.3 Goal Command

```typescript
// /goal 命令实现
const goalCommand: CommandDefinition = {
  name: 'goal',
  execute(args, ctx) {
    const [action, ...rest] = args
    switch (action) {
      case 'create': return ctx.goals.create({...})
      case 'list': return ctx.goals.list()
      case 'pause': return ctx.goals.pause(...)
      case 'resume': return ctx.goals.resume(...)
      default: throw new Error(`Unknown goal action: ${action}`)
    }
  }
}
```

---

## 五、沙箱系统（补充）

### 5.1 架构

```
dsh-sandbox (Service Definition)
    │
    ├── dsh-sandbox-local (Provider: Linux bwrap/Landlock, macOS Seatbelt, Windows ACL)
    └── dsh-shell-bash-sandbox (Consumer: bash 沙箱后端)
```

### 5.2 模式

```typescript
type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'

// read-only: 仅允许必要 sink（/dev/null）
// workspace-write: 允许 workspace 和临时目录写入
// danger-full-access: 无限制
```

### 5.3 强制执行完整性

```typescript
type SandboxEnforcement = 'full' | 'partial'

// partial: 旧 Landlock ABI 或 Windows ACL 无法完全保证
// full: 后端完全控制承诺的文件效果
```

### 5.4 每调用策略

```typescript
interface SandboxExecutionPolicy {
  mode: SandboxMode
  workspaceRoot: string
  sessionId?: SessionId
}

// 解析流程
const policy = ctx.sandboxPolicy.resolve({ session, mode })
if (policy.mode === 'danger-full-access') {
  spawn(argv)  // 直接调用，不经沙箱
} else {
  ctx.sandbox.wrap(argv, policy)  // 包装执行
}
```

---

## 六、身份系统（遗漏）

### 6.1 匿名身份

```typescript
interface AnonymousIdentity {
  sessionId: SessionId
  createdAt: number
  // 不关联真实身份
}
```

### 6.2 用途

- 遥测统计（不追踪个人）
- 配额管理
- 审计日志

---

## 七、凭据系统（遗漏）

### 7.1 提供者模型

```typescript
interface CredentialProvider {
  type: 'env' | 'dotenv' | 'vault' | ...
  resolve(key: string): Promise<string | undefined>
}
```

### 7.2 安全契约

- 凭据永不进入会话日志
- 运行时注入到适配器
- 环境变量优先于 .env 文件

---

## 八、Webhook 系统（遗漏）

### 8.1 架构

```
External Webhook
    │
    ▼
ctx.webhookRuntime.register(trustedRule)
    │
    ▼
验证签名 + 来源
    │
    ▼
创建 Workspace Session
    │
    ▼
Agent 驱动响应
```

### 8.2 认证

```typescript
interface WebhookRule {
  id: string
  secret: string           // HMAC 签名密钥
  allowedEvents: string[]
  onCreateSession?: (payload: unknown) => SessionOptions
}
```

---

## 九、Token Meter 算法（补充）

### 9.1 同步估计

```typescript
interface TokenMeter {
  // 必须同步（不阻塞压缩决策）
  estimate(messages: Message[]): number
  pricingFor(provider: string, model: string): ModelPricing
  imageRequestPricing(provider: string, model: string): LlmImageRequestPricing
}
```

### 9.2 定价集成

```typescript
// 压缩预算计算
function calculateCompactionBudget(session: Session, meter: TokenMeter): number {
  const currentTokens = meter.estimate(session.deriveMessages())
  const maxTokens = session.header.maxTokens ?? DEFAULT_MAX_TOKENS
  const headroom = maxTokens - currentTokens

  // 保留最后 N tokens 不压缩
  return Math.max(0, headroom - RETAINED_TAIL_TOKENS)
}
```

---

## 十、PTY 系统（遗漏）

### 10.1 持久终端

```typescript
interface TerminalBackend {
  create(options: PTYOptions): Promise<TerminalHandle>
}

interface TerminalHandle {
  write(data: Uint8Array): void
  read(): AsyncIterable<Uint8Array>
  resize(cols: number, rows: number): void
  close(): Promise<void>
}
```

### 10.2 用途

- 交互式 shell
- 远程开发环境
- 长运行进程管理

---

## 十一、补充算法矩阵

| 遗漏模块 | 核心算法 | 参考位置 |
|----------|----------|----------|
| Hooks | Wire Protocol 转换 | `packages/hooks/` |
| Settings | 三层组合 + CAS 版本 | `packages/settings/` |
| ACP | 多会话隔离 + 静默结算 | `packages/acp/` |
| Commands | 斜杠解析 + 直接执行 | `packages/interaction/` |
| Sandbox | 每调用策略 + 模式降级 | `packages/sandbox/` |
| Identity | 匿名生成 + 不关联 | `packages/identity/` |
| Webhook | HMAC 验证 + 会话创建 | `packages/webhook/` |
| Token Meter | 同步估计 + 预算计算 | `packages/util/token-meter/` |
| PTY | 持久句柄 + 调整大小 | `packages/terminal/` |

---

*补充分析日期: 2026-09-03*

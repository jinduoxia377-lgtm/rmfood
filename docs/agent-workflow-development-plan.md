# Agent 工作流开发方案 - 执行清单

## 项目概览

基于 DeepSeek Harness 核心算法，对 `http://localhost:3000/ai` 页面的三个功能模块进行全面升级。

**当前状态**: 82% 覆盖率  
**目标状态**: 95% 覆盖率  
**预计工期**: 6 周

---

## 阶段一：核心能力补全 (Week 1-2)

### 任务 1.1: LLM Adapter 层实现

**目标文件**: `features/utils/llmAdapter.ts`

```typescript
// 接口定义
export interface LlmAdapter {
  stream(request: ModelRequest, signal: AbortSignal): AsyncIterable<StreamChunk>;
}

export type StreamChunk =
  | { type: 'block-start'; index: number; blockType: string }
  | { type: 'text-delta'; index: number; text: string }
  | { type: 'tool-call-delta'; index: number; id: string; argumentsDelta: string }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'finish'; reason: FinishReason; replayState?: ReplayEnvelope }
  | { type: 'error'; failure: LlmFailure };

// 适配器注册表
const adapterRegistry = new Map<string, LlmAdapter>([
  ['deepseek', new DeepSeekAdapter()],
  ['openai', new OpenAIAdapter()],
]);
```

**产出物**:
- [ ] `llmAdapter.ts` - 核心接口和抽象类
- [ ] `deepseekAdapter.ts` - DeepSeek 适配器
- [ ] `openaiAdapter.ts` - OpenAI 适配器
- [ ] 单元测试 + E2E 测试

---

### 任务 1.2: Retry Policy 完善

**目标文件**: `features/utils/retryPolicy.ts` (已有，需完善)

```typescript
// 增强错误分类
export const RETRYABLE_ERRORS = {
  'EMPTY_RESPONSE': { maxRetries: 3, delayMs: 1000 },
  'TIMEOUT': { maxRetries: 2, delayMs: 2000 },
  'RATE_LIMITED': { maxRetries: 5, delayMs: 5000 },
  'CONTEXT_WINDOW_EXCEEDED': { maxRetries: 0, action: 'compaction' },
};

// 集成到 Waterfall
emitter.on('agent/request-error', async (data, next) => {
  const { error, turnId, stepId } = data;
  const normalized = normalizeError(error);
  
  const config = RETRYABLE_ERRORS[normalized.code];
  if (!config) { next(); return; }
  
  if (normalized.code === 'CONTEXT_WINDOW_EXCEEDED') {
    await doCompaction();
  } else {
    await sleep(config.delayMs);
  }
  
  await executeStep(turnId, stepId);
});
```

**产出物**:
- [ ] 错误分类配置
- [ ] request-error 监听器
- [ ] 重试策略集成测试

---

### 任务 1.3: pre-step 输入验证

**目标文件**: `features/hooks/useUnifiedAgent.ts`

```typescript
emitter.on('agent/pre-step', async (data, next) => {
  const { input, turnId } = data;
  
  // 输入长度检查
  if (input.length > 4000) {
    data.input = input.slice(0, 4000) + '...[truncated]';
  }
  
  // 敏感信息过滤
  data.input = filterSensitiveData(input);
  
  // 输入改写 (可选)
  const enhanced = await enhanceInput(input, context);
  if (enhanced) {
    data.input = enhanced;
  }
  
  next();
});
```

**产出物**:
- [ ] 输入验证函数
- [ ] 敏感数据过滤
- [ ] 输入改写钩子

---

## 阶段二：性能优化 (Week 3)

### 任务 2.1: Token 精确计数

**目标文件**: `features/utils/eventSourcing.ts`

```typescript
// 接入 tiktoken
import { get_encoding } from 'tiktoken';

export class PreciseTokenEstimator {
  private encoder = get_encoding('cl100k_base');
  
  estimate(messages: AgentMessage[]): number {
    return messages.reduce((sum, msg) => {
      sum += 4; // 每条消息固定开销
      sum += this.encoder.encode(msg.content).length;
      return sum;
    }, 0);
  }
}
```

**产出物**:
- [ ] tiktoken 集成
- [ ] 精确估算器
- [ ] 性能对比测试

---

### 任务 2.2: deriveMessages 缓存

**目标文件**: `features/utils/eventSourcing.ts` (已有，需完善)

```typescript
class EventSourcedSession {
  private _messageCache: Map<number, AgentMessage[]> = new Map();
  
  deriveMessages(invalidateFrom?: number): AgentMessage[] {
    // 清除过期缓存
    if (invalidateFrom !== undefined) {
      for (const [seq] of this._messageCache) {
        if (seq >= invalidateFrom) {
          this._messageCache.delete(seq);
        }
      }
    }
    
    // 返回缓存或重新计算
    const cached = this._messageCache.get(this._seq);
    if (cached) return cached;
    
    const messages = this._computeMessages();
    this._messageCache.set(this._seq, messages);
    return messages;
  }
}
```

**产出物**:
- [ ] 缓存机制
- [ ] 失效策略
- [ ] 基准测试

---

### 任务 2.3: IndexedDB 查询优化

**目标文件**: `features/utils/eventSourcing.ts`

```typescript
async getEvents(
  db: IDBDatabase, 
  fromSeq?: number, 
  limit: number = 100
): Promise<SessionEvent[]> {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  
  let request: IDBRequest;
  if (fromSeq !== undefined) {
    const range = IDBKeyRange.bound(fromSeq, fromSeq + limit);
    request = store.getAll(range);
  } else {
    request = store.getAll(null, limit);
  }
  
  return request;
}
```

**产出物**:
- [ ] 分页查询
- [ ] 游标支持
- [ ] 性能测试

---

## 阶段三：高级特性 (Week 4-5)

### 任务 3.1: Fork/Resume 完善

**目标文件**: `features/utils/eventSourcing.ts`

```typescript
async fork(boundary?: number): Promise<EventSourcedSession> {
  const boundarySeq = boundary ?? this.seq;
  
  // 验证边界在 closed turn 之后
  assertBoundaryAtClosedTurn(this.events, boundarySeq);
  
  const child = new EventSourcedSession(
    `${this.sessionId}-fork-${Date.now()}`
  );
  await child.open();
  
  // 复制事件前缀
  for (let i = 0; i <= boundarySeq && i < this.events.length; i++) {
    await child.append(this.events[i].type, this.events[i].data);
  }
  
  // 设置 lineage
  child.meta = {
    parentSession: this.sessionId,
    seedLength: boundarySeq,
    inheritedEventCount: boundarySeq,
    createdAt: Date.now(),
  };
  
  return child;
}
```

**产出物**:
- [ ] lineage 元数据
- [ ] 边界验证
- [ ] 恢复机制

---

### 任务 3.2: Scope Shadowing 完善

**目标文件**: `features/utils/scope.ts` (已有，需完善)

```typescript
export class AgentScopeManager {
  private globalScope = new Map<ScopeKey, unknown>();
  private agentScopes = new Map<string, Map<ScopeKey, unknown>>();
  
  registerAgent(agentId: string, values: Record<ScopeKey, unknown>) {
    const scope = new Map(Object.entries(values));
    this.agentScopes.set(agentId, scope);
  }
  
  resolve<T>(key: ScopeKey, agentId?: string): T | undefined {
    // 优先 agent 作用域
    if (agentId) {
      const agentScope = this.agentScopes.get(agentId);
      if (agentScope?.has(key)) {
        return agentScope.get(key) as T;
      }
    }
    // 回退全局
    return this.globalScope.get(key) as T | undefined;
  }
}
```

**产出物**:
- [ ] AgentScopeManager
- [ ] 隔离测试
- [ ] 文档

---

### 任务 3.3: Subagent 委托框架

**目标文件**: `features/utils/subagent.ts` (新增)

```typescript
export interface SubagentProvider {
  spawn(options: SubagentOptions): Promise<SubagentHandle>;
}

export interface SubagentHandle {
  send(message: ContentBlock[]): SendResult;
  interrupt(): InterruptResult;
  result(): Promise<SubagentResult>;
}

export class SubagentManager {
  private providers = new Map<string, SubagentProvider>();
  
  register(name: string, provider: SubagentProvider) {
    this.providers.set(name, provider);
  }
  
  async spawn(name: string, options: SubagentOptions): Promise<SubagentHandle> {
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Provider ${name} not found`);
    return provider.spawn(options);
  }
}
```

**产出物**:
- [ ] Subagent 接口
- [ ] 管理器实现
- [ ] 基础测试

---

## 阶段四：测试与部署 (Week 6)

### 任务 4.1: E2E 测试补充

**目标文件**: `features/__tests__/e2e/`

```typescript
test('完整 Turn/Step 流程', async ({ page }) => {
  // 1. 发送消息
  await page.fill('textarea', '帮我设计一款配方');
  await page.press('textarea', 'Enter');
  
  // 2. 验证 Turn 状态
  await expect(page.locator('[data-testid="turn-status"]')).toContainText('running');
  
  // 3. 验证 Step 徽章
  await expect(page.locator('[data-testid="step-badge"]')).toHaveCount(3);
  
  // 4. 验证最终响应
  await waitForAgentResponse(page);
  await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();
});

test('Compaction 触发', async ({ page }) => {
  // 发送大量消息触发压缩
  for (let i = 0; i < 100; i++) {
    await sendMessage(page, `测试消息 ${i}`);
  }
  
  // 验证压缩发生
  await expect(page.locator('[data-testid="compaction-indicator"]')).toBeVisible();
});
```

**产出物**:
- [ ] 完整流程测试
- [ ] Compaction 测试
- [ ] 错误处理测试
- [ ] 性能测试

---

### 任务 4.2: 性能基准测试

**目标文件**: `features/__tests__/benchmarks/`

```typescript
describe('性能基准测试', () => {
  test('deriveMessages 缓存性能', async () => {
    const session = new EventSourcedSession();
    await session.open();
    
    // 添加 1000 条消息
    for (let i = 0; i < 1000; i++) {
      await session.append('user/message', { content: `Message ${i}` });
    }
    
    // 测量第一次推导
    const start1 = performance.now();
    session.deriveMessages();
    const time1 = performance.now() - start1;
    
    // 测量缓存命中
    const start2 = performance.now();
    session.deriveMessages();
    const time2 = performance.now() - start2;
    
    expect(time2).toBeLessThan(time1 * 0.1); // 缓存应快 10 倍以上
  });
  
  test('Token 估算精度', async () => {
    const estimator = new PreciseTokenEstimator();
    const messages = [
      { content: 'Hello world' },
      { content: '你好世界' },
      { content: '混合内容 Hello 世界' },
    ];
    
    const estimated = estimator.estimate(messages as any);
    // 允许 5% 误差
    expect(Math.abs(estimated - expected)).toBeLessThan(expected * 0.05);
  });
});
```

**产出物**:
- [ ] 性能基准
- [ ] 精度测试
- [ ] 报告文档

---

## 交付物清单

### 代码文件

```
features/utils/
├── llmAdapter.ts              # LLM Adapter 层 (新增)
├── subagent.ts                # Subagent 框架 (新增)
├── retryPolicy.ts             # 完善
├── scope.ts                   # 完善
├── promptAssembly.ts          # 完善
├── eventSourcing.ts           # 完善
├── waterfall.ts               # 完善
└── parallelScheduler.ts       # 完善

features/hooks/
├── useUnifiedAgent.ts         # 完善
└── useChatCompaction.ts       # 完善

features/__tests__/
├── e2e/
│   ├── agent-workflow.e2e.test.ts     # 完善
│   └── llm-adapter.e2e.test.ts        # 新增
├── unit/
│   ├── agent-workflow.unit.test.tsx   # 完善
│   └── llm-adapter.unit.test.ts       # 新增
└── benchmarks/
    ├── performance.bench.ts           # 新增
    └── accuracy.bench.ts              # 新增
```

### 文档

```
docs/
├── agent-workflow-deep-analysis-report.md   # 分析报告 (已有)
├── agent-workflow-development-plan.md       # 开发方案 (本文档)
└── api-reference.md                         # API 参考 (新增)
```

---

## 成功标准

### 功能标准
- [x] Turn/Step 驱动完整 (100%)
- [x] Waterfall 事件系统完整 (100%)
- [ ] LLM Adapter 支持多模型 (90%)
- [x] Retry Policy 标准化 (100%)
- [x] Compaction 准确触发 (95%)
- [ ] Fork/Resume 完整支持 (90%)

### 性能标准
- [ ] deriveMessages 缓存命中率 > 90%
- [ ] Token 计数误差 < 5%
- [ ] 并发工具调用延迟 < 500ms
- [ ] 压缩决策响应 < 100ms

### 质量标准
- [ ] 单元测试覆盖率 > 85%
- [ ] E2E 测试覆盖率 > 70%
- [ ] 零严重 bug
- [ ] 性能基准达标

---

## 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| LLM API 变更 | 中 | 高 | 抽象 Adapter 层 |
| 浏览器兼容 | 低 | 中 | IndexedDB polyfill |
| 性能瓶颈 | 中 | 中 | 缓存 + 分页 |
| 数据一致性 | 低 | 高 | Crash Recovery |

---

## 下一步行动

**立即执行 (本周)**:
1. 实现 LLM Adapter 接口
2. 完善 Retry Policy
3. 添加 request-error 监听器

**下周执行**:
1. 接入 tiktoken
2. 完善 deriveMessages 缓存
3. IndexedDB 查询优化

**后续执行**:
1. Fork/Resume lineage
2. Scope Shadowing 完善
3. Subagent 框架

---

*方案制定日期: 2026-07-09*
*参考: DeepSeek Harness 核心算法文档*

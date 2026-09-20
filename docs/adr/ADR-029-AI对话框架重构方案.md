# ADR-029: AI 对话框架深度重构方案

**状态**: ✅ 执行中 (Phase 1-4 已完成，P1-1 完成)  
**日期**: 2026-09-21  
**作者**: Agnes (AI Assistant Review)  
**相关 ADR**: ADR-010 (AI/ML 服务集成), ADR-011 (架构收敛)

---

## 执行摘要

| 阶段 | 状态 | 完成内容 |
|:----:|:----:|---------|
| P0 紧急修复 | ✅ 完成 | SSE 协议统一、废弃代码标记 |
| P1 架构优化 | ✅ 完成 | 提示词配置化、存储策略统一、组件分层 |
| P2 质量提升 | ✅ 完成 | 错误分类器、DI 容器 |
| P3 长期规划 | 📋 可选 | 引擎合并（待定） |

---

## 一、上下文与问题陈述

### 1.1 背景

RMFOOD FP（食源性药食同源配方平台）的 AI 智能对话模块自开发以来，经历了快速迭代。当前版本已具备以下能力：

- SSE 流式对话 + 思考过程可视化
- 多轮对话上下文管理
- RAG 检索增强生成
- 用户画像注入与个性化推荐
- 离线消息队列与断点续传
- Agent 工作流引擎

然而，经过系统性代码审计，发现以下**架构层面的设计缺陷**，阻碍了系统的可维护性、可扩展性和可靠性。

### 1.2 核心问题清单

| 编号 | 问题类别 | 严重程度 | 影响范围 |
|:----:|---------|:-------:|---------|
| P0-1 | 双入口服务导致路由混乱 | 🔴 Critical | 后端架构 |
| P0-2 | 思考步骤前后端不同步 | 🔴 Critical | 前端体验 |
| P1-1 | ChatTab 组件职责过载 | 🟡 High | 前端组件 |
| P1-2 | 系统提示词硬编码不可配置 | 🟡 High | 后端配置 |
| P1-3 | 双重存储策略数据不一致 | 🟡 High | 数据持久化 |
| P2-1 | 插件系统类型不安全 | 🟢 Medium | 可扩展性 |
| P2-2 | 错误处理路径过长且重复 | 🟢 Medium | 代码质量 |
| P2-3 | 全局单例测试困难 | 🟢 Medium | 测试覆盖 |
| P3-1 | 工作流引擎与对话引擎功能重叠 | 🟢 Low | 架构边界 |

---

## 二、详细问题分析与修复方案

### P0-1: 双入口服务导致路由混乱

#### 现状

```
backend/app/services/ai/conversation_service/main.py  (15行, FastAPI app)
backend/app/services/ai/main.py                       (35行, FastAPI app)
backend/app/api/v1/ai_task_router.py                  (实际API入口)
backend/app/api/ai.py                                 (路由组装层)
```

#### 问题

1. 存在 3 个 FastAPI 应用入口，职责不清
2. 实际业务逻辑在 `orchestration/chat_engine.py`，但入口分散
3. 前端同时调用多个端点，维护成本高

#### 修复方案

**目标架构**:

```
backend/app/api/v1/ai.py              # 统一 API 入口
  ├── /chat                 → ChatController
  ├── /chat/stream          → ChatStreamController
  ├── /tasks                → TaskController (异步推理)
  └── /health               → HealthController

backend/app/services/ai/orchestration/
  ├── chat_engine.py          # 对话引擎 (AcademicianChatEngine)
  └── workflow_engine.py      # 工作流引擎 (WorkflowEngine)

backend/app/services/ai/conversation_service/
  └── (移除独立 FastAPI app，仅保留内部逻辑)
```

**实施步骤**:

```python
# backend/app/api/v1/ai.py (重构后)
from fastapi import APIRouter
from .controllers.chat_controller import ChatController
from .controllers.task_controller import TaskController

router = APIRouter(prefix="/ai", tags=["AI"])

# 注册统一控制器
chat_ctrl = ChatController()
task_ctrl = TaskController()

router.add_api_route("/chat", chat_ctrl.chat, methods=["POST"])
router.add_api_route("/chat/stream", chat_ctrl.chat_stream, methods=["POST"])
router.add_api_route("/tasks", task_ctrl.submit_task, methods=["POST"])
router.add_api_route("/tasks/{task_id}", task_ctrl.get_task_status, methods=["GET"])
router.add_api_route("/health", chat_ctrl.health, methods=["GET"])
```

**影响评估**:
- 前端: 无需修改（接口保持不变）
- 后端: 需要调整路由注册方式
- 风险: 低（纯内部重构）

---

### P0-2: 思考步骤前后端不同步

#### 现状

```typescript
// frontend/useThinkingProcessV3.ts:321-333
// 前端硬编码模拟思考延迟
await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 250))
```

```python
# backend/chat_engine.py:180-184
# 后端通过 SSE 发送真实思考步骤
thinking_steps.append({"step": "问题理解", ...})
```

#### 问题

1. 前端有本地"思考"动画，但后端已通过 SSE 发送真实思考步骤
2. 导致双重渲染：前端模拟步骤 + 后端真实步骤同时显示
3. 用户看到两次相同的思考过程

#### 修复方案

**方案 A（推荐）: 前端仅渲染后端步骤，移除本地模拟**

```typescript
// useThinkingProcessV3.ts (修复后)
const loadExternalSteps = useCallback((steps: BackendThinkingStep[], answer: string) => {
  // 直接转换后端步骤为前端展示格式
  const converted: ThinkingStepV3[] = steps.map((s, i) => ({
    id: `ext-${i}`,
    type: stepTypeMap[s.step] || 'reasoning',
    title: s.step,
    description: s.content,
    status: 'completed',
    // ...
  }))
  setState({ steps: converted, isThinking: false })
}, [])

// 移除 startThinking 中的本地模拟逻辑
// startThinking 仅用于没有后端思考步骤时的降级场景
```

**方案 B: 前后端统一思考步骤协议**

定义标准 SSE 事件格式：

```python
# backend/chat_engine.py
async def chat(self, question: str, ...) -> AsyncGenerator[dict, None]:
    # 每个思考步骤作为独立事件
    yield {"type": "thinking_step", "step": "问题理解", "content": "...", "status": "processing"}
    # LLM 调用...
    yield {"type": "thinking_step", "step": "知识检索", "content": "...", "status": "completed"}
    yield {"type": "content", "content": "..."}
    yield {"type": "done"}
```

```typescript
// frontend/chatService.ts
// 统一处理所有事件类型
for await (const chunk of chatService.sendMessageStream(...)) {
  if (chunk.type === 'thinking_step') {
    eventBus.emit('thinking:step', chunk)
  } else if (chunk.type === 'content') {
    fullContent += chunk.content
  }
}
```

**实施步骤**:
1. 修改后端 `chat_engine.py`，将 thinking_steps 拆分为独立 SSE 事件
2. 修改前端 `chatService.ts`，统一事件处理逻辑
3. 修改前端 `useThinkingProcessV3.ts`，移除本地模拟逻辑

---

### P1-1: ChatTab 组件职责过载

#### 现状

```typescript
// ChatTab.tsx - 591 行
export function ChatTab({ onBatchExport, onBatchDelete, ... }: ChatTabProps) {
  // 18 个 Hooks 调用
  // 4 个 useState 状态
  // 5 个 useEffect 副作用
  // 混合布局 + 状态 + 业务逻辑
}
```

#### 问题

违反单一职责原则，难以测试和维护。

#### 修复方案

**分层架构**:

```
ChatTab (布局层 - ~150行)
├── ChatStateProvider (状态容器)
│   ├── useChatMessages (消息管理)
│   ├── useChatSession (会话管理)
│   └── useChatTheme (主题管理)
├── ChatContent (内容层)
│   ├── MessageList (消息列表)
│   ├── ChatInput (输入组件)
│   └── ThinkingPanel (思考侧栏)
└── ChatActions (动作层)
    ├── useChatHandlers (事件处理)
    └── useFormulaActions (配方操作)
```

**伪代码**:

```typescript
// ChatTab.tsx (重构后 - 仅布局)
export function ChatTab() {
  return (
    <ChatStateProvider>
      <div className="flex h-full">
        <ChatHistory />
        <ChatContent />
        <ThinkingPanel />
      </div>
    </ChatStateProvider>
  )
}

// ChatStateProvider.tsx (状态管理)
export function ChatStateProvider({ children }) {
  const messages = useChatMessages()
  const session = useChatSession()
  const theme = useChatTheme()
  
  return (
    <ChatContext.Provider value={{ messages, session, theme }}>
      {children}
    </ChatContext.Provider>
  )
}
```

---

### P1-2: 系统提示词硬编码不可配置

#### 现状

```python
# chat_engine.py:26-94 (68 行硬编码)
ACADEMICIAN_SYSTEM_PROMPT = """你是一位拥有30年药食同源...
```

#### 问题

1. 修改提示词需要重启服务
2. 无法进行 A/B 测试
3. 无法按租户/场景动态切换

#### 修复方案

**方案 A: 数据库存储 + 缓存**

```python
# backend/app/services/ai/prompt_service.py
class PromptService:
    _cache: Dict[str, tuple] = {}  # key -> (prompt, timestamp)
    
    async def get_prompt(self, prompt_key: str, version: str = "latest") -> str:
        cache_key = f"{prompt_key}:{version}"
        if self._is_cache_valid(cache_key):
            return self._cache[cache_key][0]
        
        prompt = await self._fetch_from_db(prompt_key, version)
        self._set_cache(cache_key, prompt)
        return prompt
    
    async def update_prompt(self, key: str, content: str, version: str):
        await self._save_to_db(key, version, content)
        self._clear_cache(key)
```

**方案 B: 配置文件 + 热加载**

```yaml
# conf/prompts/default.yaml
system_prompts:
  academician: |
    你是一位拥有30年药食同源功能性食品研发经验的院士级专家...
  junior_consultant: |
    你是一位专业的药食同源顾问...
  
  scenarios:
    formula_design: academician
    safety_check: academician
    general_qa: junior_consultant
```

```python
# backend/app/services/ai/prompt_service.py
class PromptService:
    def __init__(self, config_path: str = "conf/prompts/default.yaml"):
        self.config_path = config_path
        self._load_config()
        self._watcher = FileWatcher(config_path, self._reload)
    
    def _reload(self):
        self._load_config()
        logger.info("System prompts reloaded from config")
```

**实施优先级**: P1-2 应在 P0-2 之前完成，因为提示词重构会影响思考步骤的输出格式。

---

### P1-3: 双重存储策略数据不一致

#### 现状

```typescript
// useChatMessages.ts:107-122
storageService.set(STORAGE_KEY, newMessages)  // localStorage
chatStorageService.saveMessages(...)           // IndexedDB
```

#### 问题

1. 两套存储没有原子性保证
2. 切换会话时可能恢复到不一致状态
3. localStorage 有 5MB 限制，大会话会失败

#### 修复方案

**统一使用 IndexedDB，移除 localStorage 作为主存储**:

```typescript
// useChatMessages.ts (重构后)
const saveToStorage = useCallback((newMessages: ChatMessage[]) => {
  // 只写入 IndexedDB
  if (activeSessionIdRef.current && newMessages.length > 0) {
    chatStorageService.saveMessages(activeSessionIdRef.current, newMessages)
      .catch(e => logger.warn('[useChatMessages] IndexedDB save failed:', e))
  }
}, [])

// 仅在无 IndexedDB 支持时降级到 localStorage
const FALLBACK_STORAGE_KEY = 'chat_messages_fallback'

const saveToStorage = useCallback((newMessages: ChatMessage[]) => {
  if (isIndexedDBSupported()) {
    chatStorageService.saveMessages(...)
  } else {
    storageService.set(FALLBACK_STORAGE_KEY, newMessages)  // 仅降级
  }
}, [])
```

---

### P2-1: 插件系统类型不安全

#### 现状

```typescript
// pluginTypes.ts
export interface Plugin {
  apply(ctx: any): void;  // any 类型
}
```

#### 修复方案

```typescript
// plugins/pluginTypes.ts
export interface PluginContext {
  get<T>(name: string): T | undefined
  service(name: string): T
  on(event: string, handler: Function): () => void
  effect(fn: () => void | (() => void)): void
}

export interface Plugin {
  name: string
  version: string
  apply(ctx: PluginContext): void
}

export interface PluginRegistry {
  register(plugin: Plugin): void
  get(name: string): Plugin | undefined
  list(): Plugin[]
}
```

---

### P2-2: 错误处理路径过长且重复

#### 现状

```typescript
// chatService.ts:657-793 (136行错误分类)
private classifyError(error: Error): ClassifiedError {
  // 网络错误检查...
  // 超时错误检查...
  // 认证错误检查...
  // 429限流检查...
  // 500错误检查...
}
```

#### 修复方案

**使用策略模式重构错误分类**:

```typescript
// utils/errorClassifier.ts
interface ErrorHandler {
  canHandle(error: Error): boolean
  classify(error: Error): ClassifiedError
}

class NetworkErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return error.message.includes('failed to fetch') || 
           error.name === 'TypeError'
  }
  classify(error: Error): ClassifiedError {
    return { type: ErrorType.NetworkUnreachable, ... }
  }
}

class AuthErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return error.message.includes('401') || error.message.includes('认证')
  }
  classify(error: Error): ClassifiedError {
    return { type: ErrorType.Unauthorized, ... }
  }
}

// 错误分类器列表（按优先级排序）
const handlers: ErrorHandler[] = [
  new NetworkErrorHandler(),
  new TimeoutErrorHandler(),
  new AuthErrorHandler(),
  new RateLimitErrorHandler(),
  new ServerErrorHandler(),
  new DefaultErrorHandler(),  // 兜底
]

export function classifyError(error: Error): ClassifiedError {
  for (const handler of handlers) {
    if (handler.canHandle(error)) {
      return handler.classify(error)
    }
  }
  return new DefaultErrorHandler().classify(error)
}
```

---

### P2-3: 全局单例测试困难

#### 现状

```python
# chat_engine.py:462-468
_engine: Optional[AcademicianChatEngine] = None
def get_chat_engine() -> AcademicianChatEngine:
    global _engine
    if _engine is None:
        _engine = AcademicianChatEngine()
    return _engine
```

#### 修复方案

**依赖注入 + 可注入单例**:

```python
# backend/app/services/ai/inject/di_config.py
class DIContainer:
    _instances: Dict[type, Any] = {}
    
    def get_or_create(self, cls: type) -> Any:
        if cls not in self._instances:
            self._instances[cls] = cls()
        return self._instances[cls]
    
    def reset(self):
        """测试用：重置所有单例"""
        self._instances.clear()

# 全局容器
container = DIContainer()

def get_chat_engine() -> AcademicianChatEngine:
    return container.get_or_create(AcademicianChatEngine)

# 测试中
def test_chat_engine():
    container.reset()
    engine = get_chat_engine()
    # 测试逻辑...
```

---


---

## 执行摘要

| 阶段 | 状态 | 完成内容 |
|:----:|:----:|---------|
| P0 紧急修复 | ✅ 完成 | SSE 协议统一、废弃代码标记 |
| P1 架构优化 | ✅ 完成 | 提示词配置化、存储策略统一、组件分层 |
| P2 质量提升 | ✅ 完成 | 错误分类器、DI 容器 |
| P3 长期规划 | 📋 可选 | 引擎合并（待定） |

---

### P3-1: 工作流引擎与对话引擎功能重叠

#### 现状

```python
# workflow_engine.py: WORKFLOW_TEMPLATES
"formula_design": [RAG_RETRIEVE, FORMULA_DESIGN, COMPLIANCE_CHECK, ...]

# chat_engine.py: chat() 方法
# 也执行类似的 RAG + LLM + 配方生成流程
```

#### 建议

明确边界：
- **对话引擎**: 自由对话、问答、解释
- **工作流引擎**: 结构化任务、多步骤管道、批量处理

未来可以考虑合并两个引擎，使用统一的 `Agent` 抽象。

---

## 三、实施计划

### Phase 1: P0 紧急修复（1-2周）

| 任务 | 文件 | 预计工时 | 负责人 |
|-----|------|---------|--------|
| P0-1 统一后端入口 | `api/v1/ai.py`, `api/controllers/` | 3d | 后端 |
| P0-2 思考步骤同步 | `chat_engine.py`, `chatService.ts`, `useThinkingProcessV3.ts` | 4d | 前后端 |

### Phase 2: P1 架构优化（2-3周）

| 任务 | 文件 | 预计工时 | 负责人 |
|-----|------|---------|--------|
| P1-1 ChatTab 重构 | `ChatTab.tsx`, `ChatStateProvider.tsx` | 5d | 前端 |
| P1-2 提示词配置化 | `prompt_service.py`, `conf/prompts/` | 3d | 后端 |
| P1-3 统一存储策略 | `useChatMessages.ts`, `chatStorageService.ts` | 2d | 前端 |

### Phase 3: P2 质量提升（2-3周）

| 任务 | 文件 | 预计工时 | 负责人 |
|-----|------|---------|--------|
| P2-1 插件类型安全 | `plugins/pluginTypes.ts` | 2d | 前端 |
| P2-2 错误处理重构 | `utils/errorClassifier.ts`, `chatService.ts` | 3d | 前后端 |
| P2-3 单例可测试化 | `di_config.py`, `chat_engine.py` | 2d | 后端 |

### Phase 4: P3 长期规划（可选）

| 任务 | 描述 | 预计工时 |
|-----|------|---------|
| P3-1 引擎合并 | 统一对话引擎与工作流引擎 | 1w+ |

---

## 四、验收标准

### P0 级问题 ✅ 已完成

- [x] 废弃服务标记为 DEPRECATED (`main.py`, `conversation_service/main.py`)
- [x] SSE 事件协议统一 (`sse_events.py`)
- [x] 后端 thinking_stream 使用标准 SSE 格式
- [x] 前端移除 fallback 映射逻辑
- [x] 思考步骤只从后端获取，无本地模拟

### P1 级问题 ✅ 已完成

- [x] 系统提示词配置化 (`conf/prompts/default.yaml` + `PromptService`)
- [x] 提示词热加载支持
- [x] 存储策略统一（IndexedDB 为主，localStorage 降级）

### P1-1 已完成

- [x] ChatTab 组件分层重构
- [x] 创建 `ChatStateContext.ts` - 状态上下文定义
- [x] 创建 `ChatStateProvider.tsx` - 状态容器组件
- [x] 重构 `ChatTab.tsx` - 纯布局组件（~300行 → ~150行）

### P2 级问题 ✅ 已完成

- [x] 错误分类器策略模式 (`utils/errorClassifier.ts`)
- [x] DI 容器支持测试隔离 (`inject/di_config.py`)
- [x] 插件系统已有完整类型定义

---

## 五、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|-----|:----:|:----:|---------|
| 重构导致线上故障 | 中 | 高 | 分阶段部署，灰度发布 |
| 前端 SSE 协议不兼容 | 低 | 中 | 后端保持向后兼容 |
| IndexedDB 降级失败 | 低 | 低 | 保留 localStorage 作为最终兜底 |
| 测试覆盖不足 | 中 | 中 | 优先补充关键路径测试 |

---

## 六、附录

### A. 相关文件清单

**新建文件**:
- `backend/app/services/ai/sse_events.py` - SSE 事件标准协议
- `backend/app/services/ai/prompt_service.py` - 提示词热加载服务
- `backend/app/services/ai/inject/di_config.py` - 依赖注入容器
- `conf/prompts/default.yaml` - 提示词配置文件
- `frontend/src/components/ai/features/utils/errorClassifier.ts` - 错误分类器
- `frontend/src/components/ai/features/ChatStateContext.ts` - 状态上下文定义
- `frontend/src/components/ai/features/ChatStateProvider.tsx` - 状态容器组件

**修改文件**:
- `backend/app/services/ai/main.py` - 标记为 DEPRECATED
- `backend/app/services/ai/conversation_service/main.py` - 标记为 DEPRECATED
- `backend/app/api/ai_modules/chat.py` - 使用 PromptService 和 SSE 协议
- `backend/app/services/llm_service.py` - 使用 PromptService
- `frontend/src/components/ai/features/services/chatService.ts` - 移除 fallback，使用 ErrorClassifier
- `frontend/src/components/ai/features/hooks/useChatMessages.ts` - 统一存储策略
- `frontend/src/components/ai/features/ChatTab.tsx` - 重构为纯布局组件 (~591行 → ~298行)

### B. 参考文档

- ADR-010: AI/ML 服务集成架构策略
- ADR-011: 架构收敛决策
- DESIGN.md: 主题系统开发规范

---

**文档维护**: RMFOOD AI Team  
**下次审查**: 2026-10-21

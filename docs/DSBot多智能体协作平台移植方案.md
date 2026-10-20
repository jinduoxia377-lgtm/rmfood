# DeepSeek-Bot 功能移植方案：RMFOOD 多智能体协作平台

> 状态：**提案 v1.2**（已按一、二轮评审修订，待用户确认目标任务清单后执行）
> 关联 ADR：ADR-004（DDD 有界上下文）、ADR-010（AI/ML 服务集成）、ADR-012b（智能对话架构融合）、ADR-029（AI 对话框架重构）
> 建议后续新建 ADR-038 记录本架构决策。
> 评审修订记录见文末第 11 节。

---

## 1. 背景与目标

用户希望将 GitHub 项目 [Fei2411/DeepSeek-Bot](https://github.com/Fei2411/DeepSeek-Bot)（以下简称 **DS Bot**）的核心能力移植到 RMFOODFP 中。

DS Bot 是一个基于 DeepSeek Harness 的 Bot 插件，本质是**把通用 AI 助手升级为「多角色、可记忆、可协作的 Bot 平台」**。其核心价值不在某个单点功能，而在于：

- **Bot 实体化**：AI 不再是一个隐式的聊天接口，而是可配置身份/模型/记忆的具名实体；
- **主控派单**：一个高权限 Main bot（Chief）负责理解需求并调度其他专业 Bot；
- **群聊协作**：多个 Bot 在群聊中分工协作，管理员回复、@ 定向、引用对话；
- **持久记忆**：Bot 跨会话记住用户偏好与项目上下文；
- **用量可观测**：按时间 / Bot / 模型统计 Token 消耗。

本方案的目标：基于 RMFOODFP 现有功能框架，确定**最合适的落点**，给出分层架构与分阶段实施路线。

---

## 2. 目标项目功能拆解（DS Bot）

| # | 功能域 | 说明 | 移植价值 |
|:-:|:-------|:-----|:--------|
| 1 | **Bot 管理** | 创建/编辑/删除 Bot；每个 Bot 独立身份（名称、头像、人设）、独立模型选择；一个窗口完成与该 Bot 的全部对话 | ★★★★★ |
| 2 | **Main bot（Chief）** | 默认主控 Bot，高权限，负责管理其他 Bot 与群聊，引导配置；**可通过对话直接管理 Bot** | ★★★★★ |
| 3 | **群聊** | 多 Bot 协作空间；管理员默认回复并派单；输入 `@` 定向 Bot；`+` 引用历史对话作为上下文 | ★★★★★ |
| 4 | **记忆** | Bot 记住用户偏好并在后续工作中应用；可在 Bot 详情页或对话中管理记忆 | ★★★★☆ |
| 5 | **用量** | 设置 → 用量：按时间 / Bot / 模型查看 Token 消耗 | ★★★★☆ |
| 6 | **上下文压缩** | 长对话压缩、交接笔记、聊天记录全文索引搜索 | ★★★☆☆ |
| 7 | **数据本地化** | 所有数据落在本地 bot/ 与 sessions/ 目录，卸载不删数据 | ★★☆☆☆ |

其中 1/2/3 是 DS Bot 的差异化核心；4/5 是支撑性能力；6 在 RMFOOD 前端已有部分实现；7 与 RMFOOD 的 PostgreSQL 持久化模型冲突，仅借鉴"数据归属清晰"的思想，不照搬。

---

## 3. 现有项目框架分析（RMFOODFP）

### 3.1 整体架构

- 后端：FastAPI，六边形架构（Ports & Adapters）+ DDD 有界上下文（ADR-001/004），PostgreSQL + Alembic。
- 前端：React + Vite + TypeScript，react-router v7，Zustand + TanStack Query，主题令牌系统。

### 3.2 与移植直接相关的现有资产

**后端：**

| 资产 | 位置 | 现状 |
|:-----|:-----|:-----|
| Agent 领域实体 | `app/domain/agents.py` | 已定义 `AgentRole`（配方/知识/安全/编排）、`AgentTask`、`AgentContext`、`ConversationMessage`，但角色固定、无持久化 |
| Agent 端口 | `app/domain/agent_ports.py` | 已定义 `BaseAgent` / `AgentOrchestrator` 接口 |
| Agent 基础设施 | `app/infrastructure/agents_impl.py` | 早期 Mock 实现（内存知识库），已被下方 LLM 编排器取代 |
| **LLM Agent 编排器** | `app/services/ai/agent/orchestrator.py`（901 行） | 真实 LLM 驱动，含工具注册表（RAG/合规/配方/安全/稳定性/口味/成本/文献/QA/实验 10+ 工具）、Fast/Smart 两种模式、`_call_llm` 透传 `**kwargs`（可覆盖 model） |
| 工作流引擎 | `app/services/ai/agent/workflow_engine.py` | 5 个标准工作流：配方设计、合规预审、实验方案、原料查询、全流程 |
| Agent API | `app/api/v1/agent_router.py` | `/api/v1/agent/*`：tools、execute、executions、workflows、SSE（注：`/execute/stream` 为简化流式，非真实 token 流） |
| 成熟流式对话 | `app/api/ai_modules/chat.py` | `/ai/chat`、`/ai/chat/stream`（真实 SSE：`thinking_stream` + `event_stream`） |
| 会话/消息 CRUD | `app/api/chat.py` + `app/models/chat.py` | `chat_sessions` / `chat_messages` 完整 CRUD、导出、同步、评价、书签、回复引用 |
| 模型配置 | `app/models/ai_model_config.py` | `ai_model_configs` 按 `(tenant_id, model_type)` 持久化多 Provider、模型映射、兜底链、推理参数 |
| AI 可观测 | `app/services/ai/shared/observability.py` | 内存级指标（调用数、Token 总数、错误率、RAG 命中率） |
| 异步推理队列 | `app/services/ai/shared/inference_queue.py` | 异步推理任务队列（可插拔 ResultStore），可用于群聊派单串行化 |
| AI 配额 | `app/core/multi_tenant/tenant_security.py` 等 | 组织级 AI 配额检查（超限 403） |

**前端：**

| 资产 | 位置 | 现状 |
|:-----|:-----|:-----|
| Agent 页面 | `src/pages/agent/AgentPage.tsx` | 已有 `/agent` 路由（App.tsx 已注册），但仅单 Agent 对话，未进导航 |
| Agent API | `src/api/agent.ts` | 封装 tools/execute/executions/workflows/SSE |
| 聊天展示组件 | `src/components/ai/features/components/pro/` | ChatMessages / ChatInputPro / ChatSidebar / MarkdownRenderer / TypewriterText / ChatHistory，**展示层可直接复用** |
| 聊天状态层 | `src/components/ai/features/services/chatService.ts` | **强耦合 `/ai/chat`**（相对路径硬编码），复用需新增 bot 专用服务 |
| Agent 协作工具 | `src/components/ai/features/utils/agentTeams.ts`、`subagent.ts`、`useUnifiedAgent.ts`、`useAgentSmartRouter.ts` | 前端已有多 Agent 团队/子代理概念（本地模拟） |
| 记忆 hooks | `useShortTermMemory.ts` / `useWorkingMemory.ts` | 前端短期记忆（localStorage/内存），非服务端 |
| 上下文压缩 | `ContextCompaction.ts`、`useChatCompaction.ts`、`TokenBudgetManager.ts` | 已有长对话压缩与 Token 预算管理 |

### 3.3 关键结论

RMFOODFP **已经具备移植 DS Bot 的大部分地基**：

- 有真实的 LLM Agent 编排器 + 工具链（对应 DS Bot 的"每个 Bot 都是一个会话 + 工具"）；
- 有完整的会话/消息持久化；
- 有可持久化的模型配置；
- 前端已有完整聊天 UI 组件族和 Agent 页面骨架。

**真正缺失的是"Bot 实体化"与"多 Bot 协作"这两层**：
1. 没有可配置、可持久化的 Bot 实体（人设/模型/记忆）；
2. 没有 Chief 主控派单与群聊会话模型；
3. 记忆停留在前端，未服务端化；
4. 用量只停留在内存指标，不可按 Bot/时间查询。

---

## 4. 差距分析（Gap）

| DS Bot 能力 | RMFOOD 现状 | 差距 | 需要新增 |
|:-----------|:-----------|:-----|:---------|
| Bot 实体管理 | 仅有固定 4 个 AgentRole 枚举 | 无用户自定义、无持久化 | `ai_bots` 表 + Bot CRUD API + 管理 UI |
| Bot 详情页（模型/记忆/用量） | `/ai` 有模型配置 Tab；无记忆/用量 | 缺详情聚合页 | Bot 详情页组件 |
| Main bot / Chief（含对话管理） | 有 AgentOrchestrator，但无"主控"身份、无 bot 管理工具 | 缺主控 Bot、派单语义、对话管理工具 | Chief 种子 Bot + 派单服务 + `tools/bot_admin_tools.py` |
| 群聊协作 | 前端有 agentTeams 本地模拟；聊天有引用 | 无服务端群聊模型 | 群聊会话/成员表 + 群聊服务 + @ 交互 |
| 持久记忆 | 前端 useShortTermMemory/useWorkingMemory | 未服务端化 | `ai_bot_memories` 表 + 记忆服务 + 注入逻辑 |
| 用量统计 | ai_observability 内存指标 | 不可持久查询 | `ai_usage_records` 表 + provider 层拦截 + 统计页 |
| 上下文压缩 | 前端 ContextCompaction 等 | 已有 | 可复用，服务端化可选 |

---

## 5. 落点选型分析（核心问题）

用户核心诉求：**"基于现有的功能框架，设计到什么功能模块位置最为合适？"**

### 候选方案

| 方案 | 描述 | 优点 | 缺点 | 结论 |
|:----|:-----|:-----|:-----|:----|
| **A. 独立页面 `/agent`，挂入"智能工具"导航组** | 升级现有 AgentPage 为"多智能体协作中心"；后端扩展 agent 域 | 路由已存在；空间充足；与导航语义一致；可承载 Bot 管理+群聊+用量全流程 | 需新增导航项与后端扩展 | ✅ **推荐** |
| B. 在 `/ai` 内新增 Tab | 在 AIAssistantPage 增加"多智能体"Tab | 改动最小 | `/ai` 已有 12 个 Tab 严重过载；Bot 管理+群聊是独立工作流，挤在 Tab 内体验差 | ❌ 否决 |
| C. 放"企业管理"/"系统设置" | 作为组织级或系统级功能 | 权限管理方便 | 语义错位：Bot 协作是智能工具而非企业管理/系统配置 | ❌ 否决 |
| D. 独立顶级模块（导航首层） | 与"核心工作/实验中心"平级 | 权重高 | 当前导航按业务域组织，AI 能力统一在"智能工具"域；独立顶级会割裂智能工具域 | ❌ 否决 |

### 推荐方案 A：`/agent` 独立页面，归属"智能工具"分组

**导航位置**（`frontend/src/components/layout/navConfig.ts`，智能工具分组，紧跟"智能助手"）：

```
智能工具:
  智能助手   /ai          （保留：单点 AI 工具集）
  智能协作   /agent       （新增：多智能体协作中心）← 本方案
  学术报告   /academic-report
  数据检索   /databases
  ...
```

> 注意：按项目导航规范，label 必须为 **4 个汉字**。"智能体"为 3 字不合规，推荐 **「智能协作」**（或"多智能体"）。

**为什么这是最合适的位置：**

1. **语义一致**：DS Bot 的本质是"AI 智能体平台"，属于"智能工具"业务域，与"智能助手"天然并列——`/ai` 解决"单点 AI 能力"，`/agent` 解决"多角色 AI 协作"。
2. **路由零成本**：`/agent` 路由与 `AgentPage` 已在 App.tsx 注册，只需升级页面内容并加入导航。
3. **空间充足**：Bot 列表、Bot 详情（模型/记忆/用量）、Chief 控制台、群聊工作台、用量报表——只有独立页面才能承载这些并保持可用性。
4. **复用最大化**：页面可复用现有 `ChatMessages/ChatInputPro/ChatHistory` 展示组件、`agent.ts` API、聊天 hooks（需新增 bot 专用服务层，见 6.3）。
5. **与 `/ai` 明确分工**：`/ai` 的 ChatTab 保持轻量单聊；`/agent` 承载团队化协作，两者共享 LLM 服务、模型配置、RAG、工具注册表，不重复造轮子。

> **待用户拍板（评审 S6）**：`/ai` 页当前已有 "Agent 工作流" Tab（`AIAssistantPage.tsx` 第 12 个 Tab），与新 `/agent` 功能重叠。建议方案 ①：移除该 Tab 并重定向到 `/agent`；方案 ②：保留但弱化为"快速执行单个工作流"。实施前需确认。

---

## 6. 目标架构设计

### 6.1 总体结构

```
┌─────────────────────────────────────────────┐
│ 前端 /agent 多智能体协作中心                    │
│  Bot 列表 | Chief 控制台 | 群聊工作台 | 用量报表 │
└──────────────┬──────────────────────────────┘
               │ REST / SSE
┌──────────────▼──────────────────────────────┐
│ API 层  app/api/v1/                      │
│  bot_router.py（新增）  agent_router.py（扩展）│
│  ai_modules/chat.py（扩展 bot_id 支持）    │
└──────────────┬──────────────────────────────┘
┌──────────────▼──────────────────────────────┐
│ 应用服务层  app/services/ai/agent/         │
│  bot_manager  memory_service  group_chat    │
│  usage_service  bot_admin_tools  orchestrator│
└──────────────┬──────────────────────────────┘
┌──────────────▼──────────────────────────────┐
│ 领域层 app/domain/                     │
│  bots.py（新增）  agents.py（既有，扩展）    │
│  bot_ports.py（新增端口） agent_ports.py（既有）│
└──────────────┬──────────────────────────────┘
┌──────────────▼──────────────────────────────┐
│ 基础设施层 app/infrastructure/           │
│  bots_impl.py（新增 SQLAlchemy 实现）         │
│  agents_impl.py（既有，可退役）                │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│ 持久化 PostgreSQL（Alembic 迁移）             │
│  ai_bots  ai_bot_memories  ai_bot_group_*    │
│  ai_usage_records                            │
└─────────────────────────────────────────────┘
```

### 6.2 后端设计（按六边形架构分层）

#### 领域层（新增 `app/domain/bots.py`）

```python
class BotStatus(Enum): ACTIVE / DISABLED / ARCHIVED

@dataclass
class AIBot:
    id: int
    tenant_id: int
    name: str                 # 具名 Bot，如"配方专家"
    avatar: str               # 图标/头像标识
    description: str          # 一句话介绍
    persona_prompt: str       # 人设 System Prompt（核心，创建/更新时须过 PromptGuard）
    # ── 模型绑定（评审修订 M1）──
    # model_type 是"场景"而非"具体模型"，因此增加 provider/model_id 实现"每个 Bot 独立选模型"
    model_config_id: int | None   # 关联 ai_model_configs.id（继承场景的 API/密钥/兜底链）
    model_type: str               # 场景类型（formula_gpt/llm/...），用于配额与路由
    provider: str | None         # 具体 Provider（如 deepseek / zhipu）
    model_id: str | None          # 具体模型 ID（如 deepseek-chat / agnes-3.0-flash）
    temperature: float = 0.7
    max_tokens: int = 4096
    capabilities: list[str]   # 工具白名单，如 ["rag_retrieve","formula_tool"]（须与工具注册表校验）
    is_chief: bool            # 是否主控 Bot
    is_system: bool           # 系统种子 Bot（Chief/专业模板），禁止删除
    status: BotStatus
    deleted_at: datetime | None   # 软删除
    created_by: int
    created_at / updated_at
```

#### 端口层（新增 `app/domain/bot_ports.py`）

- `BotRepository`：CRUD + 按租户/角色查询 + 软删除过滤；
- `BotMemoryStore`：记忆条目写入/检索/删除；
- `GroupChatRepository`：群聊会话、成员、消息持久化（成员用关联表）；
- `UsageRecorder`：Token 用量落库（配合 provider 层拦截）。

#### 基础设施层（新增 `app/infrastructure/bots_impl.py`）

- SQLAlchemy 实现上述端口；
- 种子数据：Chief 主控 Bot + 4-6 个专业 Bot 模板（配方专家/安全专家/法规专家/实验专家/文献专家/报告专家），用户可一键创建。

#### 应用服务层（`app/services/ai/agent/` 下新增）

| 服务 | 职责 |
|:-----|:-----|
| `bot_manager.py` | Bot 生命周期管理；按 persona_prompt + capabilities 组装 System Prompt，并通过 `_call_llm(..., model=bot.model_id, temperature=..., max_tokens=...)` 覆盖默认模型（评审修订 M1）；执行前用 PromptGuard 校验 persona（S5） |
| `memory_service.py` | 记忆抽取**带门控**：达到消息数阈值/关键决策/用户显式要求才触发 LLM 摘要，规则抽取（过敏原/禁忌实体）优先；注入按 `(importance DESC, 相关度)` 截断（S4） |
| `group_chat_service.py` | 群聊会话管理；Chief 默认回复；@ 定向路由；派单经 `inference_queue` 串行化，避免并发乱序与费用失控（S3） |
| `usage_service.py` | 在 `provider_factory.call_with_fallback / stream_with_fallback` 内嵌记录钩子（`contextvars.ContextVar` 传递 bot_id），**LLM 无论从哪个工具调用都能落库**（M4）；提供按时间/Bot/模型聚合查询 |
| `tools/bot_admin_tools.py` | 新增 Agent 工具：`create_bot / update_bot / delete_bot / list_bots`，让 Chief 可通过**对话**管理 Bot（M3，DS Bot 核心交互） |

#### API 层

扩展 `app/api/v1/agent_router.py` 或新增 `app/api/v1/bot_router.py`：

```
GET    /api/v1/bots                      Bot 列表（按租户，过滤软删除）
POST   /api/v1/bots                      创建 Bot（persona 过 PromptGuard）
GET    /api/v1/bots/{id}                 Bot 详情（含记忆、用量汇总）
PUT    /api/v1/bots/{id}                 更新 Bot（人设/模型/能力）
DELETE /api/v1/bots/{id}                 删除/归档 Bot（软删除）
POST   /api/v1/bots/{id}/chat            与单个 Bot 对话（非流式，复用 orchestrator + 记忆注入）
GET    /api/v1/bots/{id}/memories        记忆列表
POST   /api/v1/bots/{id}/memories        手动添加记忆
DELETE /api/v1/bots/{id}/memories/{mid}  删除记忆
POST   /api/v1/groups                    创建群聊
POST   /api/v1/groups/{id}/members       添加/移除成员（关联表）
POST   /api/v1/groups/{id}/message       群聊发言（管理员派单 / @ 定向，经 inference_queue 串行化）
GET    /api/v1/groups/{id}/messages      群聊消息流
GET    /api/v1/usage?bot_id=&model=&from=&to=   用量明细
GET    /api/v1/usage/summary              用量聚合（按时间/Bot/模型）
```

> **单 Bot 对话流式（评审修订 M2）**：不在 `bot_router` 另起 SSE，而是在既有 `POST /api/v1/ai/chat/stream`（`app/api/ai_modules/chat.py`）的 `ChatRequest` 增加可选 `bot_id`；后端从 `bot_manager` 加载人设+记忆组装 system prompt 后进入**成熟流式管线**（`thinking_stream` + `event_stream`）。`agent_router /execute/stream` 保留给工作流执行场景，不用于 Bot 对话。
>
> **Chief 对话管理 Bot（M3）不走 REST**：通过 `bot_admin_tools.py` 注册为 Agent 工具，由 orchestrator 在对话中调用，与 REST 端点共用 `bot_manager` 服务。

#### 数据模型（Alembic 迁移）

| 表 | 关键字段 |
|:---|:---------|
| `ai_bots` | tenant_id, name, avatar, description, persona_prompt, model_config_id, model_type, provider, model_id, temperature, max_tokens, capabilities(JSON), is_chief, is_system, status, deleted_at, created_by |
| `ai_bot_memories` | bot_id, user_id, memory_type(偏好/事实/禁忌), content, importance, source(会话id), created_at |
| `ai_bot_group_sessions` | tenant_id, name, chief_bot_id, created_by |
| `ai_bot_group_members` | group_id, bot_id, role(admin/member), joined_at —— 评审修订 S2：用关联表而非 JSON 数组 |
| `ai_bot_group_messages` | group_id, sender_bot_id, content, reply_to, mentioned_bot_ids(JSON), task_execution_id |
| `ai_usage_records` | tenant_id, bot_id, model, prompt_tokens, completion_tokens, total_tokens, endpoint, created_at |

> `chat_sessions/chat_messages` 保持不动：单 Bot 对话直接复用既有会话表，**新增可空 `bot_id` 列 + `(user_id, bot_id)` 索引**（Alembic 迁移）；群聊消息独立存储，避免污染个人会话。

### 6.3 前端设计

#### 页面结构（`/agent`）

```
AgentPage（升级）— 多智能体协作中心
├── 左侧导航：Bot 列表 / Chief 控制台 / 群聊工作台 / 用量报表
├── Bot 列表视图：卡片式展示所有 Bot（头像、名称、人设、模型、状态）
│     ├── 新建 Bot（表单：名称/头像/人设/模型/能力白名单）
│     └── Bot 详情抽屉：基本信息 + 模型选择 + 记忆管理 + 用量
├── 单 Bot 对话：复用 ChatMessages/ChatInputPro/ChatHistory（绑定 bot_id）
├── Chief 控制台：输入需求 → 选择工作流 → 派单结果时间线（复用 AgentWorkflowTab 思路）
├── 群聊工作台：消息流 + @ 选择器（复用 ChatTag/SlashCommandHandler 交互模式）
└── 用量报表：按时间/Bot/模型聚合（复用 analytics 图表组件）
```

#### 组件目录规划

```
frontend/src/components/ai/bots/
├── BotList.tsx
├── BotCard.tsx
├── BotCreateDialog.tsx
├── BotDetailDrawer.tsx        # 模型/记忆/用量
├── BotChatView.tsx           # 单 Bot 对话
├── ChiefConsole.tsx          # 主控派单
├── GroupChatView.tsx         # 群聊工作台
├── UsageReport.tsx           # 用量统计
├── api.ts                    # /api/v1/bots、/groups、/usage 客户端
├── botChatService.ts        # 评审修订 S1：Bot 对话专用服务（指向 /ai/chat 带 bot_id），不复用硬编码 /ai 的 chatService
└── types.ts
```

> **评审修订 S1**：`chatService.ts` 相对路径硬编码 `/ai/chat`，不能直接用于 Bot 对话。`ChatMessages/ChatInputPro/ChatHistory` 等**展示组件**可直接复用，但状态层需新增 `botChatService.ts`（封装 `POST /ai/chat`、`POST /ai/chat/stream`，携带 `bot_id`）。

#### 记忆注入前端配合

- 现有 `useShortTermMemory`/`useWorkingMemory` 保留用于本地即时记忆；
- 新增 `useBotMemory`：从 `GET /bots/{id}/memories` 拉取服务端记忆，在发送消息时随 history 上送，实现跨会话记忆。

---

## 7. 实施路线图

> 采用"先独立验证、后嵌入主项目"的迭代模式（与项目既往肽模块做法一致）。

### Phase 1 — Bot 基础（核心）

1. 新增 `ai_bots` 表（Alembic `revision --autogenerate`）；
2. `domain/bots.py` + `bot_ports.py` + `infrastructure/bots_impl.py`；
3. `bot_manager.py`：按 Bot 人设 + 能力白名单 + **模型覆盖（provider/model_id）** 调用 orchestrator；
4. `bot_router.py`：Bot CRUD + 单 Bot 对话；
5. `ai_modules/chat.py`：`ChatRequest` 增加可选 `bot_id`，接入人设+记忆组装（M2）；
6. 前端：`api.ts`、`botChatService.ts`、Bot 列表 + 新建 + 详情抽屉 + 单 Bot 对话；
7. 导航新增「智能协作」`/agent` + i18n；
8. 种子数据：Chief 主控 Bot + 4-6 个专业 Bot 模板；
9. persona PromptGuard 校验（S5）。

**验收**：可创建多个具名 Bot（配方专家/安全专家/法规专家），分别配置人设与**具体模型**，独立对话（含流式），对话人设正确生效。

### Phase 2 — Chief 派单 + 群聊协作（核心）

1. 新增群聊/成员/消息表 + `group_chat_service.py`（派单经 `inference_queue` 串行化）；
2. `tools/bot_admin_tools.py`：注册 `create_bot/update_bot/delete_bot/list_bots` 工具，实现 Chief 对话管理（M3）；
3. Chief 控制台：输入需求 → 选择工作流/专业 Bot → 派单 → 结果聚合时间线；
4. 群聊 API：创建群、成员管理、发言、@ 定向、引用对话；
5. 前端：ChiefConsole + GroupChatView（@ 选择器复用 ChatTag）。

**验收**：在群聊中 @配方专家 得到定向回复；Chief 将"设计辅助降血糖代茶饮"派给配方专家→安全专家→法规专家并返回完整链路；对 Chief 说"新建一个法规专家 Bot"能自动创建。

### Phase 3 — 记忆服务端化 + 用量报表

1. `ai_bot_memories` 表 + `memory_service.py`（**门控抽取** + 注入截断）；
2. `ai_usage_records` 表 + `usage_service.py`（**provider_factory 层拦截**，与 `ai_observability` 打通）；
3. Bot 详情页记忆管理（查看/删除/手动添加）；
4. 用量报表页（按时间/Bot/模型）。

**验收**：Bot 跨会话记住用户过敏原与偏好并自动应用；用量报表可按 Bot/模型/时间维度查询，且工具内部 LLM 调用也被计入。

---

## 8. 风险与注意事项

| 风险 | 应对 |
|:-----|:-----|
| 记忆注入污染对话 | 记忆仅作为 system 上下文追加，设置重要性阈值与条数上限；敏感记忆仅限本租户可见 |
| 群聊并发调用费用不可控 | 复用现有 `ensure_ai_quota` 配额；群聊默认仅管理员回复（对齐 DS Bot 的成本优化）；`@` 才定向调用；派单经 `inference_queue` 串行化 |
| 模型密钥安全 | 复用 `ai_model_configs` 加密存储；Bot 不新增密钥字段，仅引用 `model_config_id` |
| **persona 提示注入（评审 S5）** | 创建/更新 Bot 时用 PromptGuard 校验 persona；运行时 persona 拼接在全局安全层级（`InstructionHierarchy`）之下，禁止覆盖安全规则 |
| **记忆抽取成本（评审 S4）** | 门控触发 + 规则抽取优先；仅在关键会话/用户要求时调用 LLM 摘要 |
| 与现有 `/ai` 功能边界模糊 | 明确分工：`/ai`=单点工具集，`/agent`=多角色协作；共享服务不重复 |
| `/ai` "Agent 工作流" Tab 与新页重复（S6） | 待用户拍板：移除重定向 / 保留弱化 |
| AgentPage 现有实现替换 | 保留现有单 Agent 对话为"Chief 快速对话"入口，不破坏已注册路由 |
| 导航 4 字规范 | 使用「智能协作」标签，避免"智能体"3 字违规 |

---

## 9. 复用资产清单

- 后端：`orchestrator.py`（执行内核，支持模型覆盖）、`workflow_engine.py`（标准流程）、`ai_modules/chat.py`（真实流式对话）、`ai_model_configs`（模型与密钥）、`chat_sessions/messages`（单 Bot 会话）、`inference_queue.py`（群聊派单）、`ai_observability`（实时指标）、`ensure_ai_quota`（配额）、`services/ai/safety`（persona 校验）
- 前端：`AgentPage`/`agent.ts`（页面与 API 骨架）、`ChatMessages/ChatInputPro/ChatHistory`（对话展示组件）、`ChatStateProvider/useChatMessages/useChatSessions`（聊天状态，需经 botChatService 适配）、`AgentWorkflowTab`（派单结果展示）、`ChatTag/SlashCommandHandler`（@ 交互）、`ContextCompaction/TokenBudgetManager`（上下文压缩）、`analytics` 图表组件（用量报表）

---

## 10. 结论

**最合适的落点**：新增独立页面 `/agent`（导航标签「智能协作」），置于"智能工具"分组，紧随"智能助手"；后端在既有 `app/services/ai/agent` 域与 `app/api/v1/agent_router.py` 基础上扩展 Bot 实体化、主控派单、群聊协作、持久记忆与用量统计五类能力。

理由总结：路由已存在、组件可复用、导航语义一致、与 `/ai` 分工清晰、符合项目六边形架构与 DDD 规范。建议以 Phase 1（Bot 基础）为起点，按三阶段交付。

---

## 11. 评审修订记录（v1.1）

本版依据《DSBot方案评审与补缺报告》（`docs/DSBot方案评审与补缺报告.md`）修订：

| 编号 | 修订内容 | 落点 |
|:----|:---------|:-----|
| M1 | Bot 模型绑定由"场景 model_type"改为"`model_config_id` 继承配置 + `provider/model_id/temperature/max_tokens` 独立选模型"，经 `_call_llm` 透传覆盖 | §6.2 领域层/服务层 |
| M2 | 单 Bot 流式对话不再自建 SSE，改为 `POST /ai/chat/stream` 增加可选 `bot_id`，复用成熟流式管线 | §6.2 API 层 |
| M3 | 新增 `tools/bot_admin_tools.py`（create/update/delete/list_bots），实现 Chief 对话管理 Bot | §6.2 服务层、§7 Phase 2 |
| M4 | 用量拦截下沉到 `provider_factory.call_with_fallback / stream_with_fallback`（ContextVar 传 bot_id），确保工具内部 LLM 调用也计费 | §6.2 服务层、§7 Phase 3 |
| S1 | 前端新增 `botChatService.ts`，不直接复用硬编码 `/ai` 的 chatService | §6.3 |
| S2 | 群聊成员改为关联表 `ai_bot_group_members`；RBAC 对齐现有权限矩阵 | §6.2 数据模型 |
| S3 | 群聊派单经 `inference_queue` 串行化，默认仅 Chief 回复 | §6.2 服务层、§8 |
| S4 | 记忆抽取门控 + 规则优先 + 注入截断 | §6.2 服务层、§8 |
| S5 | persona PromptGuard 校验，防止提示注入 | §6.2 领域层、§8 |
| S6 | `/ai` "Agent 工作流" Tab 收敛策略**待用户拍板**（移除重定向 / 保留弱化） | §5 注、§8 |
| L1 | 导航 4 字标签「智能协作」；MobileBottomNav 暂不加；i18n 同步 | §5、§7 |
| L2 | `ai_bots` 增加 `is_system`/软删除；capabilities 与工具注册表校验；`chat_sessions` 加 `bot_id` 索引迁移 | §6.2 |
| L3 | 种子内置 4-6 个专业 Bot 模板 | §6.2、§7 |
| L4 | 补充测试计划：后端 pytest + 前端 vitest + e2e | §7 各阶段验收 |

> 待确认项：**S6（/ai Agent Tab 收敛策略）** 与 **是否按修订后方案执行 Phase 1**。

---

## 12. 二轮评审补充（v1.2，制定目标任务前）

依据《DSBot方案评审与补缺报告》第七节，补充以下修订（均已纳入目标任务定义）：

| 编号 | 补充内容 | 类型 |
|:----|:---------|:-----|
| R1 | S6 方案①（确认采用）：保留并迁移 `AgentWorkflowTab` 到 `/agent` 页；e2e 导航更新；**先建 /agent 再删 /ai Tab** | 范围决策 |
| R2 | `LLMService.chat / chat_stream` 增加 `model_override / temperature_override`，支撑 Bot 对话使用独立模型 | 架构细节 |
| R3 | agent 执行端点补充 `get_current_user` 鉴权；`bot_admin_tools` 注入当前用户 | 安全必修 |
| R4 | `bot_manager` 按 `bot.capabilities` 过滤 orchestrator 工具 schema | 架构细节 |
| R5 | 新增"可用模型列表"端点（聚合 `ai_model_configs.models` + 用户级配置），驱动 Bot 表单下拉 | 功能补充 |
| R6 | 群聊任务执行详情：首版接受内存级 + 群聊消息存 `task_execution_id`；`ai_bot_tasks` 表列为增强项 | 范围决策 |
| R7 | Bot 对话 system prompt = `persona_prompt + 记忆块`，`scenario_mode` 仅在无人设时回退 | 实现细则 |
| R8 | 单 Bot 对话采用"每 (user, bot) 一个持续会话"，复用 `chat_sessions.bot_id`，暂不做 bot 内多会话 | 范围决策 |
| R9 | `ai_bots.visibility`（private/org，默认 private）；群聊成员关联表 + admin/member 角色 | 权限模型 |
| R10 | 测试门禁：tsc 0 错误、vitest 全绿、pytest 全绿（含 provider 层用量拦截用例） | 质量要求 |
| R11 | 实施顺序：Phase 1 内先完成 /agent 页面与工作流迁移，再执行 S6 收敛清理 | 顺序约束 |
| R12 | 导航「智能协作」+ i18n 双语文案；MobileBottomNav 暂不加 | 打磨项 |

> 状态说明：v1.2 已包含一、二轮全部评审修订。待用户确认目标任务清单后开始实施。
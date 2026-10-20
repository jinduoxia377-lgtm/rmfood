# DS Bot 移植方案评审与补缺报告

> 评审对象：`docs/DSBot多智能体协作平台移植方案.md`
> 评审方式：对方案中的关键假设逐一回到代码库核实（后端 FastAPI 路由注册、LLM 服务模型选择、orchestrator 人设注入、前端聊天服务耦合、迁移体系、安全与队列设施）
> 结论：**方案整体落点正确，但存在 4 项影响架构正确性的重大欠缺、6 项中等欠缺、4 项轻微欠缺，需修订后进入实施。**

---

## 一、已核实成立的设计点（不是全盘否定）

以下方案判断经代码核实为正确，可继续沿用：

1. **落点选型正确**：`/agent` 路由已在 `frontend/src/App.tsx` 注册（`path: 'agent'` → `AgentPage`），升级为"多智能体协作中心"成本低；`/ai` 已有 12 个 Tab 确实过载。
2. **后端地基存在**：`app/services/ai/agent/orchestrator.py`（901 行）是真实 LLM 编排器，支持自定义 `system_prompt`（构造函数参数），`execute_smart` 在 L215-216 以 system message 注入人设——**Bot 人设注入点明确**。
3. **会话持久化可复用**：`chat_sessions/chat_messages` 表结构完整（含评价/书签/回复引用）。
4. **模型配置可持久化**：`ai_model_configs` 按 `(tenant_id, model_type)` 唯一约束，多 Provider 多模型映射。
5. **迁移体系权威**：`backend/alembic`（`alembic.ini` 的 `script_location = alembic`），`env.py` 支持 `--autogenerate` 且 `from app.models import *` 自动发现模型。新表应走 Alembic。
6. **无既有 bot 表**：`app/models/*.py` 中不存在 bot 相关 `__tablename__`，无重复建设风险。

---

## 二、重大欠缺（影响架构正确性，必须修订）

### M1. Bot 模型绑定粒度错误：`model_type` 是"场景"不是"具体模型"

- **问题**：方案写 `AIBot.model_type 关联 ai_model_configs.model_type`。但 `ModelType`（`frontend/src/api/modelClient.ts`）是场景枚举：`formula_gpt | synergy_net | safety_checker | taste_predictor | stability_model | peptide_scorer`；`ai_model_configs` 的 `model_type` 字段注释也是这些场景值。而 DS Bot 的"为 Bot 选择模型"指的是**具体 LLM 模型**（如 deepseek-chat、agnes-3.0-flash）。两者语义不同。
- **后果**：按方案实现，用户只能给 Bot 选"配方生成"场景，不能选具体模型；多个 Bot 共用同一场景配置时无法区分模型。
- **修正**：`AIBot` 增加 `provider + model_id + temperature + max_tokens` 字段（或 `model_config_id` 关联 `ai_model_configs.id` + `model_override`）。在 `bot_manager` 调用 `orchestrator` 时，通过 `_call_llm(..., task_type=TaskType.CHAT, model=bot.model_id)` 覆盖模型（orchestrator `_call_llm` 已透传 `**kwargs`，可行）。

### M2. 单 Bot 对话的流式链路选错对象：应复用 `/ai/chat/stream`，而非 `agent /execute/stream`

- **问题**：方案写"复用 orchestrator 与 SSE"，但 `agent_router.py` 的 `/execute/stream`（L124-157）是**假流式**——先空发 `tool_start/tool_done` 事件，再一次性执行完才发 `complete`，没有中间 token 流。真正成熟的是 `app/api/ai_modules/chat.py` 的 `/ai/chat/stream`（L407-514，含 `thinking_stream` + `event_stream`）。
- **后果**：Bot 对话用错链路会导致前端无打字机效果、无思考过程，体验断裂。
- **修正**：在 `/ai/chat/stream` 的 `ChatRequest` 增加可选 `bot_id`，后端从 `bot_manager` 加载人设+记忆组装 system prompt 后进入现有流式管线；`agent_router` 保留给"工作流执行"场景。

### M3. Chief 的核心交互"对话即可管理 Bot"完全缺失

- **问题**：DS Bot 的主打体验是"直接和 Chief 对话来创建/配置其他 Bot"。方案只做了"人创建 Bot + Chief 派单"，**没有给 orchestrator 注册 bot 管理工具**（`create_bot/update_bot/delete_bot/list_bots`）。
- **后果**：移植后只有"半套" DS Bot——Chief 不能通过对话建 Bot、改人设、删 Bot，核心卖点丢失。
- **修正**：在 `services/ai/agent/tools/` 新增 `bot_admin_tools.py`，注册 4 个工具到工具注册表；同时给 Chief 的 system prompt 声明其管理权限。这也能让"群聊 @Chief 建一个法规专家"这种自然语言指令变成真功能。

### M4. 用量统计的拦截点不明：漏统计工具内部 LLM 调用

- **问题**：方案写"每次 LLM 调用后记录"，但未指定拦截层。orchestrator 的工具（RAG/合规/配方）内部也会调用 LLM，若只在 Bot 对话 API 层记录，`ai_usage_records` 会严重低估。
- **修正**：在 `provider_factory.call_with_fallback / stream_with_fallback`（`app/services/ai/providers/provider_factory.py` L169/L240）内嵌 usage 记录钩子（利用 `contextvars.ContextVar` 传递 `bot_id`），一次 LLM 调用无论来自哪个工具都能落库。`ai_observability` 保持为实时内存指标，`ai_usage_records` 作为持久化明细。

---

## 三、中等欠缺（影响实现质量，应补充设计）

### S1. 前端"直接复用"表述过于乐观：聊天状态层与 `/ai` 强耦合

- **证据**：`frontend/src/components/ai/features/services/chatService.ts` 使用相对路径 `/ai/chat`、`/ai/chat/stream`（L485），会话历史 hooks（`useChatSessions` 等）绑定现有 `/ai` 后端与本地存储。
- **修正**：`ChatMessages/ChatInputPro/ChatHistory` 等**展示组件**可直接复用；但需新增 `services/botChatService.ts`（指向 `/api/v1/bots/{id}/chat`）或给 `chatService` 加 base 参数，避免把 Bot 对话硬接到 `/ai`。

### S2. RBAC/多租户边界未定义

- 谁可以创建 Bot？组织 owner/admin 还是所有成员？Bot 是否跨用户共享？群聊成员如何加入？
- **修正**：对齐 `services/auth/permissions.py` 的角色矩阵，建议"组织成员可创建私有 Bot，owner/admin 可发布共享 Bot"；群聊成员用关联表 `ai_bot_group_members` 而非 JSON 数组（便于权限校验与状态管理）。

### S3. 群聊并发与时序未设计

- 多 Bot 同时回复会有乱序、重复、费用并发问题。
- **修正**：复用 `app/services/ai/shared/inference_queue.py`（异步推理队列）串行化派单；对齐 DS Bot 成本优化——默认仅 Chief 回复，`@` 才定向调用；任务结果统一由 Chief 聚合后发回群聊。

### S4. 记忆抽取的成本与门控

- 每次对话后用 LLM 抽取记忆会持续消耗 Token。
- **修正**：仅对达到消息数阈值/用户显式要求/关键决策场景触发抽取；规则抽取（过敏原、禁忌等实体）优先，LLM 只做摘要合并；`ai_bot_memories` 加重要性阈值，注入时按 `(importance DESC, 相关度)` 截断条数。

### S5. 安全校验缺口：persona 是用户可控文本，存在注入面

- 用户自定义的人设 Prompt 可能包含提示注入。
- **修正**：创建/更新 Bot 时用 `app/services/ai/safety` 的 PromptGuard 校验 `persona_prompt`；运行时 persona 与全局安全层级（`InstructionHierarchy`）拼接，禁止 persona 覆盖安全规则。

### S6. 与现有 `/ai` 的 "Agent 工作流" Tab 功能重复，未定义收敛策略

- **证据**：`AIAssistantPage.tsx` L116 定义 `agent` Tab，L750-754 渲染 `AgentWorkflowTab`；其功能（工作流模板、Token 统计、Agent API）与新的 `/agent` 页面高度重叠。
- **修正**：明确收敛策略——方案二选一：① 将 `/ai` 的 `agent` Tab 移除并重定向到 `/agent`（推荐，避免双入口）；② 保留但弱化为"快速执行单个工作流"，团队协作统一走 `/agent`。需在实施时与用户确认。

---

## 四、轻微欠缺（打磨项，实施时补齐）

### L1. 导航与移动端
- 新增「智能协作」（4 汉字）到 `navConfig.ts` 智能工具组；`MobileBottomNav` 是否加入口需决策（建议暂不加，保持 7 项）。
- 新页面文案需同步 `i18n/zh-CN` 与 `en-US`。

### L2. 数据模型细节
- `ai_bots` 增加 `is_system`（标记种子 Chief）、软删除字段；`capabilities` 需与 `get_tool_registry()` 实际工具名校验，非法值拒绝保存。
- `chat_sessions` 增加可空 `bot_id` 列 + `(user_id, bot_id)` 索引（Alembic 迁移），个人会话与 Bot 会话共用一张表。

### L3. 内置专业 Bot 模板
- 对齐 DS Bot 的 characters 概念，种子数据内置 4-6 个专业 Bot 模板（配方专家/安全专家/法规专家/实验专家/文献专家/报告专家），用户一键创建，避免空平台。

### L4. 测试计划缺失
- 后端：`tests/` 新增 bot CRUD、记忆注入、用量记录、群聊派单的 pytest 用例（含合规断言）；
- 前端：`__tests__` 覆盖 `BotList/BotChatView/GroupChatView` 组件与 `botChatService`；
- e2e：新增 `agent-bot.e2e.test.ts`（对齐既有 `agent-workflow.e2e.test.ts` 模式）。

---

## 五、建议的修订动作清单

| # | 修订项 | 涉及文件（预估） |
|:-:|:--------|:----------------|
| 1 | `AIBot` 增加 provider/model 级绑定 | `domain/bots.py`、`bot_router.py`、前端 `types.ts` |
| 2 | 单 Bot 对话复用 `/ai/chat/stream` + `bot_id` | `ai_modules/chat.py`、`bot_router.py` |
| 3 | 新增 bot 管理工具（Chief 对话建 Bot） | `services/ai/agent/tools/bot_admin_tools.py` |
| 4 | 用量拦截下沉到 provider_factory | `provider_factory.py`、`usage_service.py` |
| 5 | 新增 `botChatService.ts` 前端服务 | `components/ai/bots/api.ts` |
| 6 | RBAC 与群聊成员关联表 | `domain/bots.py`、`infrastructure/bots_impl.py` |
| 7 | 群聊派单走 `inference_queue` 串行化 | `group_chat_service.py` |
| 8 | 记忆抽取门控 + persona PromptGuard | `memory_service.py`、`bot_router.py` |
| 9 | `/ai` agent Tab 收敛策略确认 | `AIAssistantPage.tsx`（需用户拍板） |
| 10 | 种子专业 Bot 模板 + i18n + 测试 | 各层 |

---

## 六、结论

方案**方向正确、落点合理**，但"模型绑定、流式链路、Chief 对话管理、用量拦截点"四项属于影响最终体验与数据准确性的架构级缺口，必须在 Phase 1 前修订；其余为实现质量与打磨项，可随阶段补齐。建议按上表修订后，再进入 Phase 1 实施。

---

## 七、第二轮核查补充（2026-10-13，制定目标任务前）

针对 v1.1 方案与"移除 /ai Agent 工作流 Tab（S6 方案①）"做第二轮代码级核查，新增 12 项发现：

### R1. S6 方案①的连带影响：AgentWorkflowTab 有独立测试依赖

- **证据**：`AgentWorkflowTab` 被 `AIAssistantPage.tsx`（L79/L754）引用，且 `agent-workflow.unit.test.tsx`（组件单测）与 `agent-workflow.e2e.test.ts`（依赖 `[data-testid="agent-workflow-tab"]`、`[data-testid="agent-input"]`）直接依赖它。
- **修正**：`AgentWorkflowTab.tsx` **保留并迁移**到新 `/agent` 页作为"工作流执行/Chief 控制台"视图，不删除组件；e2e 导航路径从 `/ai` 更新为 `/agent`；**先完成 /agent 页再移除 /ai Tab**，避免功能真空期；移除时同步清理 `AITab` 类型、tab 配置数组、渲染块。

### R2. 聊天路径的模型覆盖缺失（新发现的架构级缺口）

- **证据**：`LLMService.chat(messages, tools, response_format)` 与 `chat_stream(messages, tools)` **没有 model 覆盖参数**，模型来自 `self.config.model`。orchestrator `_call_llm` 支持 `**kwargs` 透传，但 Bot 对话走 `/ai/chat/stream` 不经过 orchestrator。
- **修正**：给 `LLMService.chat / chat_stream` 增加可选 `model_override / temperature_override`（应用到 `_build_payload`），或构造 bot 级 LLMService 实例。推荐前者，改动小且不动全局配置。

### R3. agent 执行端点缺少鉴权（既有安全缺口，必须补）

- **证据**：`agent_router.py` 的 `POST /execute`、`/execute/stream`、`/workflow/*/execute` **没有 `Depends(get_current_user)`**；而 `/ai/chat` 有完整鉴权+配额+限流。
- **后果**：Chief 通过对话调用 `create_bot` 等工具时身份归属不明，且端点存在未授权调用风险。
- **修正**：给 agent 执行端点补充 `get_current_user`，在 `bot_admin_tools` 中注入当前用户作为 `created_by`。

### R4. Bot 能力白名单需过滤工具 schema

- orchestrator `execute_smart` 会把注册表内所有工具暴露给 LLM。要实现"不同 Bot 能力不同"，`bot_manager` 需按 `bot.capabilities` 过滤 `tools_schema`（给 orchestrator 增加可选工具过滤参数）。

### R5. Bot 表单"模型选择"数据源未定义

- `/ai/models/status` 返回的是**模型服务状态**（llm + formula_gpt/synergy_net/... 场景），不是可选 LLM 模型列表。
- **修正**：新增端点聚合 `ai_model_configs.models` JSON + 用户级 LLM 配置，返回 `[{provider, model_id, display_name}]` 供 Bot 表单下拉。

### R6. 群聊任务执行详情持久化边界

- workflow_engine 与 agent_router 的执行记录均为**内存 dict**（重启丢失）。群聊消息存 `task_execution_id` 可引用，但执行详情不可追溯。
- **决策**：Phase 2 先接受"执行详情内存级 + 群聊消息持久化 execution_id"（对齐现状）；`ai_bot_tasks` 表作为后续增强，不阻塞首版。

### R7. Bot 对话上下文组装顺序需明确

- `/ai/chat/stream` 现为 `system = _build_system_prompt(scenario_mode)` + `history[-10:]` + `question`。
- Bot 对话改为：`system = bot.persona_prompt + 记忆块`（在 `bot_manager`/`memory_service` 组装），`scenario_mode` 仅在 Bot 无人设时回退默认；记忆注入在 service 层完成，`ai_modules/chat.py` 只做轻量调用。

### R8. 会话模型简化决策

- 对齐 DS Bot"一个 Bot 一个持续会话"：单 Bot 对话复用 `chat_sessions`（加 `bot_id` 列），每 `(user, bot)` 一个持续会话，前端打开即加载最近历史；**暂不做 bot 内多会话切换**（后续可扩展）。群聊独立存储 `ai_bot_group_*`。

### R9. 权限模型简化

- Phase 1：`ai_bots.visibility` 字段（`private` / `org`），默认 `private`（仅创建者可见可管理），`org` 共享由组织 owner/admin 设置。
- Phase 2：群聊成员关联表 + 群聊内角色（admin/member）。

### R10. 测试与回归要求

- 后端 pytest：Bot CRUD、模型覆盖、记忆注入、配额、persona 校验、用量记录（含 provider 层拦截）。
- 前端 vitest：BotList/BotChatView/GroupChatView/botChatService。
- e2e：`/agent` 页工作流入口（迁移自 `agent-workflow.e2e.test.ts`）。
- 硬性门禁：`tsc` 0 错误、vitest 全绿、pytest 全绿。

### R11. 实施顺序约束（S6 收敛时机）

- **先**完成 `/agent` 页面并迁移 AgentWorkflowTab → **再**移除 `/ai` agent Tab。禁止先删后建造成功能真空。

### R12. 导航与 i18n

- `NAV_GROUPS` 智能工具组新增「智能协作」→ `/agent`；`MobileBottomNav` 暂不加；文案进 `i18n/zh-CN` 与 `en-US`。

### 二轮结论

v1.1 的框架无方向性错误；R1-R12 为实施前必须纳入的补充修正，其中 **R2（聊天路径模型覆盖）、R3（agent 端点鉴权）、R4（能力白名单过滤）** 属必须写进任务定义的架构级细节，其余为范围/边界决策与测试要求。修订后可以制定目标任务。
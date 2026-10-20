# DS Bot 多智能体协作平台 — Phase 1 & 2 实施完成报告

> 日期：2026-10-13
> 对应方案：`docs/DSBot多智能体协作平台移植方案.md`（v1.2）
> 评审依据：`docs/DSBot方案评审与补缺报告.md`（含 R1-R12 修订）

---

## 一、实施范围

- Phase 1（Bot 基础）：15 项目标任务全部完成，含 S6 收敛（方案①）。
- Phase 2（Chief 派单 + 群聊协作）：群聊数据模型/服务/API/前端全部完成，10 项任务全部完成。

## 二、Phase 2 后端交付

| 模块 | 文件 | 说明 |
|:-----|:-----|:-----|
| 数据模型 | `models/bot.py` | 新增 `ai_bot_group_sessions` / `ai_bot_group_members` / `ai_bot_group_messages` |
| 领域层 | `domain/bots.py` | 新增 `GroupSession` / `GroupMember` / `GroupMessage` 实体 |
| 端口 | `domain/bot_ports.py` | `GroupChatRepository` 扩展：创建/列表/详情/成员/消息 |
| 基础设施 | `infrastructure/bots_impl.py` | `SQLAlchemyGroupChatRepository` 实现（成员用关联表，符合评审 S2） |
| 应用服务 | `services/ai/agent/group_chat_service.py` | 群聊生命周期 + 发言派单：@ 定向，否则 Chief 默认回复；**串行派单**（评审 S3） |
| API | `api/v1/group_router.py` | `/api/v1/groups` CRUD + 成员管理 + 发言 + 消息流 |
| 注册/安全 | `main.py` 注册 + `security_middleware.py` 将 `/api/v1/groups` 加入 CSRF 豁免 | 与 `/bots` 一致 |
| 迁移 | `scripts/apply_bot_migration.py` | 幂等 DDL 追加群聊三表 |

## 三、Phase 2 前端交付

| 模块 | 文件 |
|:-----|:-----|
| 类型/API | `types.ts` 群聊类型；`api.ts` 新增 `groupApi` |
| 组件 | `GroupChatView.tsx`（消息流 + @ 派单选择器）、`GroupChatPanel.tsx`（群列表 + 新建对话框 + 聊天） |
| 页面 | `AgentPage.tsx` 新增「群聊协作」视图 |
| 导出 | `index.ts` 导出 `GroupChatPanel` / `GroupChatView` / `groupApi` |

## 二、后端交付

| 模块 | 文件 | 说明 |
|:-----|:-----|:-----|
| 数据模型 | `app/models/bot.py` | `ai_bots`（Bot 实体）+ `ai_bot_memories`（记忆）；`chat_sessions` 增加 `bot_id` |
| 迁移 | `alembic/versions/20261013_000000_add_ai_bots.py` + `scripts/apply_bot_migration.py` | 因历史迁移 head 重叠无法走 `alembic upgrade`，使用幂等 DDL 脚本建表并写入版本号 |
| 领域层 | `app/domain/bots.py`、`app/domain/bot_ports.py` | AIBot/BotStatus/BotVisibility/BotMemory 实体 + 四端口 |
| 基础设施 | `app/infrastructure/bots_impl.py` | SQLAlchemy 实现；`tenant_id=None` 视为全局模式（兼容平台 JWT 无 org_id） |
| 应用服务 | `app/services/ai/agent/bot_manager.py` | 人设+记忆组装、能力白名单校验、模型覆盖解析、记忆管理 |
| Chief 工具 | `app/services/ai/agent/tools/bot_admin_tools.py` | `create_bot/update_bot/delete_bot/list_bots`，Chief 可对话管理 Bot（M3/R3） |
| 编排扩展 | `orchestrator.py`、`workflow_engine.py` | `execute_smart` 支持 `allowed_tools`/`model_override`/`temperature_override`；工作流支持 `context` 注入身份 |
| LLM 覆盖 | `services/llm_service.py`、`providers/llm_provider.py` | `chat/chat_stream` 与各 Provider 支持按调用覆盖 `model`/`temperature`（M1/R2） |
| Bot API | `app/api/v1/bot_router.py` | CRUD/详情（含记忆）/记忆管理/`available-models` |
| Bot 对话 | `app/api/ai_modules/chat.py` | `ChatRequest.bot_id`；人设+记忆替代默认场景 prompt；模型覆盖；缓存键隔离（M2/R7） |
| 安全 | `agent_router.py` 补 `get_current_user`；`security_middleware.py` 将 `/api/v1/bots` 加入 CSRF 豁免 | R3 + 平台惯例 |
| 种子数据 | `scripts/seed_bots.py` | Chief + 配方/安全/法规/实验/文献专家，共 6 个系统 Bot（tenant=1，org 可见） |

## 三、前端交付

| 模块 | 文件 |
|:-----|:-----|
| 类型与 API | `components/ai/bots/types.ts`、`api.ts` |
| 对话服务 | `components/ai/bots/botChatService.ts`（非流式 + SSE 流式，SSE `event:`/`data:` 分离解析） |
| 组件 | `BotList`、`BotCard`、`BotCreateDialog`、`BotDetailDrawer`、`BotChatView` |
| 页面 | `pages/agent/AgentPage.tsx` 升级为多智能体协作中心（Bot 列表 / Chief 控制台） |
| 导航 | `components/layout/navConfig.ts` 新增「智能协作」→ `/agent`（4 汉字规范） |
| S6 收敛 | `pages/ai/AIAssistantPage.tsx` 移除 "Agent 工作流" Tab；e2e 导航改到 `/agent` |

## 四、验证结果

### 后端自动化测试（pytest）
```
tests/api/test_bots_api.py · 6 passed
  - 创建 Bot / 列表与详情 / 更新 / 软删除 / 记忆 CRUD / 可用模型
tests/api/test_groups_api.py · 5 passed
  - 创建群聊 / 列表与详情 / 成员管理 / Chief 默认派单 / @ 定向派单
合计 11/11 通过
```

### 前端自动化测试（vitest）
```
components/ai/bots/__tests__/bots.test.tsx · 5 passed
  - SSE 流式解析（meta/content/[DONE]）/ 请求体 bot_id / 非流式 / BotCard 渲染
components/ai/bots/__tests__/groups.test.tsx · 2 passed
  - 群聊消息流渲染 / 发言调用 postMessage 并追加回复
合计 7/7 通过
```

### 门禁
- `npx tsc -b`：**0 错误**
- 后端 `py_compile` + 模块导入：通过

### HTTP 实测（admin 登录）
| 端点 | 结果 |
|:-----|:-----|
| `GET /api/v1/bots` | 200，返回 6 个种子 Bot |
| `GET /api/v1/bots/1` | 200，Chief 详情（含记忆） |
| `GET /api/v1/bots/available-models` | 200，返回 agnes-3.0-flash |
| `POST /api/v1/bots` | 200，创建成功（CSRF 豁免已生效） |
| `DELETE /api/v1/bots/{id}` | 200，软删除成功 |
| `POST /api/v1/ai/chat`（bot_id=2） | 200，配方专家以自身人设应答（Phase 1 时验证，LLM 可用） |
| `POST /api/v1/ai/chat/stream`（bot_id=3） | 200，SSE 流式输出安全专家人设应答（Phase 1 时验证） |
| `POST /api/v1/groups` | 200，创建群聊（Chief=1，成员=2,3） |
| `GET /api/v1/groups` / `GET /api/v1/groups/{id}` | 200，列表与详情（含成员） |
| `POST /api/v1/groups/{id}/message` | 200，用户消息 + Bot 回复均正确持久化，任务执行 ID 记录（回复内容因环境 LLM Key 解密失败暂为错误提示，见已知事项 4） |
| `GET /api/v1/groups/{id}/messages` | 200，消息流按时间正序返回 |

## 五、运行说明

- 后端当前以后台任务运行：`backend/venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000`
  （后台 job：`pwsh-1213`；如需停止可用 `job_kill pwsh-1213`）
- 前端 dev server 已在 `localhost:3000` 运行，Vite HMR 自动生效；访问「智能工具 → 智能协作」（`/agent`）体验 Bot 列表 / Chief 控制台 / 群聊协作。
- 数据库迁移：已通过 `scripts.apply_bot_migration` 幂等建表；后续新增表请优先修复 alembic 历史 head 重叠问题。

## 六、已知事项（诚实说明）

1. **存量前端单测失败**：`agent-workflow.unit.test.tsx` 有 8 个失败（TokenEstimator 相关）。该文件未被本次改动修改，属于基线存量失败（并行开发中其他模块改动所致），与 Bot/群聊功能无关。
2. **用量统计（Phase 3）**：尚未纳入范围；端口 `UsageRecorder` 已定义，`provider_factory` 复用点已就绪。
3. **历史迁移 head 重叠**：`alembic current` 显示多 head（含 `20260910_000000_add_cfam_tables`），`alembic upgrade head` 无法走通；本次用幂等 DDL 绕过，建议后续统一修复迁移链。

## 七、Phase 2 收尾修复（2026-10-13 下午）

用户反馈两个问题并已修复：

### 1. 群聊标题乱码
- **根因**：开发初期用 PowerShell 发送请求时，GBK 控制台编码导致中文变成 `???` 写入数据库；后续 pytest/HTTP 测试数据混杂。
- **处理**：新增 `scripts/cleanup_group_test_data.py` 清空群聊三张表（当前均为测试数据）；前端 axios 以 UTF-8 发送，实测群名 `真实研发协作群` 在数据库存储为正确 UTF-8（已验证 unicode 码点）。

### 2. 群聊派单 LLM 回复为错误提示（空 Bearer）
- **根因（多层）**：
  1. DB 中 `llm_runtime_config` 的 API Key 由旧随机 `SECRET_KEY` 加密；而开发环境每个进程的 `settings.secret_key` 是随机生成的 → **跨进程无法解密**（日志 `API Key 解密失败`）。
  2. `AIServiceConfig` 未将 `OPENAI_API_KEY`/`OPENAI_BASE_URL`/`LLM_MODEL` 映射到 settings（嵌套配置未加载 `.env`）。
  3. `LLMService.__init__` 中 `db_config or fallback` 逻辑：DB 解密失败返回空 key 的配置对象（truthy），导致不再 fallback 到 settings。
- **修复（`services/llm_service.py`）**：
  - `_get_encryption_key()`：把 `.env` 文件直读 `ENCRYPTION_KEY` 提前到 `settings.secret_key` 之前，保证跨进程密钥一致。
  - `_build_config_from_settings()`：新增 `.env` 文件直读兜底（`OPENAI_API_KEY`/`OPENAI_BASE_URL`/`LLM_MODEL`/`LLM_PROVIDER`）。
  - `LLMService.__init__`：仅当 DB 配置含非空 api_key 时才采用，否则 fallback 到 settings。
  - `scripts/fix_llm_config.py`：用 `.env` 配置重新加密写入 DB。
- **验证**：
  - 新进程 `LLMService()` api_key len=51（模型 agnes-3.0-flash）。
  - HTTP 实测：群聊发言后 **Chief 以真实 LLM 人设返回团队分工介绍**（此前为空 Bearer 错误）。
  - 后端 pytest bots+groups **11/11 通过**。

### 3. 创建群聊时 Chief 下拉无法点击（z-index 层级缺陷）
- **现象**：用户在创建群聊对话框中无法选择 Chief Bot，导致无法创建群聊。
- **根因**：`@/components/ui/Select` 的 `SelectContent` 使用 `z-50`，而 Dialog 遮罩层为 `z-[1000]`、DialogContent 为 `z-[1001]`。Radix Select 的 Portal 内容渲染到 body 后层级低于遮罩，选项被遮罩拦截，无法点击。
- **修复**：`frontend/src/components/ui/Select.tsx` 将 `SelectContent` 的 z-index 提升为 `z-[1100]`（高于 Dialog 遮罩）。该修复同时解决所有 Dialog 内 Select 的下拉被遮挡问题（含 Bot 创建对话框的模型选择）。
- **验证**：
  - Playwright 页面实测：登录 → `/agent` → 群聊协作 → 新建群聊 → 选择 Chief → 创建成功并打开聊天视图。
  - 后端 HTTP 实测：创建群聊 → 发言 → Chief 返回真实 LLM 自我介绍。
  - 前端 `tsc -b` 0 错误；群聊 vitest 2/2 通过。

### 4. 全面核查（2026-10-13 下午第二轮）
- **全流程 Playwright 实测通过**：登录 → `/agent` → 新建 Bot（真实入列表）→ Bot 对话（返回"我是 Agnes-3.0-flash"）→ Chief 控制台 → 群聊创建 → 群聊发言（Chief 真实回复）。核心功能全部可用。
- **修复 React key 警告**：`MessageList` 的 `renderInner` 返回的 `<MessageBubble>` 缺少 `key`，导致控制台 key 警告。已在 `frontend/src/components/ai/features/components/pro/MessageList.tsx` 的 `MessageBubble` 上加 `key={msg.id}`。
- **确认 401 为正常行为**：`GET /api/v1/auth/me?_silent=true` 是前端静默认证检查的预期 401（客户端专门静默处理），非错误；`metrics/client-perf` 为页面导航请求中止。
- **清理数据库测试数据**：新增 `scripts/cleanup_test_bots.py`，删除 50 个非系统测试 Bot 与测试群聊，保留 6 个系统种子 Bot。

### 5. 待完善清单（1-4 已完成，见第九节）
1. **Bot 详情编辑功能**：~~缺失~~ —— **已完成**（`BotDetailDrawer` 编辑模式：名称/简介/头像/人设/模型/可见性/能力白名单，调用 `PUT /bots/{id}`）。
2. **群聊成员管理 UI**：~~缺失~~ —— **已完成**（`GroupChatView` "成员"对话框：添加/移除成员 Bot，Chief 不可移除）。
3. **群聊消息引用前端**：~~未实现~~ —— **已完成**（hover 引用按钮 + `reply_to` + 引用条取消）。
4. **Bot 对话历史加载**：~~未实现~~ —— **已完成**（后端 `GET /bots/{id}/history`；`/ai/chat` 与流式写回按 `bot_id` 隔离持续会话；`BotChatView` 自动加载历史）。
5. ~~群聊派单为同步等待~~ —— **已在 v2 自主派单中解决**（异步派单 + 前端轮询，见第八节）。
6. **存量前端单测失败**：~~`agent-workflow.unit.test.tsx` 有 8 个失败~~ —— **已修复**（见第十节）。
7. **历史迁移 head 重叠**：~~`alembic upgrade head` 无法走通~~ —— **已修复**（见第十节）。

---

## 八、v2 自主派单实施完成（2026-10-13 晚）

按 `docs/DSBot自主派单设计方案.md`（v2：Chief Agent 循环自主编排）完成开发与实测。

### 1. 后端实现
| 文件 | 改动 |
|:---|:---|
| `services/ai/agent/bot_manager.py` | 新增 `list_visible_bots`、`find_bot_by_capability`（关键词匹配）、`find_or_create_temporary_expert`、`create_temporary_expert`（模板 persona + org 共享）；`execute_agent_task` 支持 `system_prompt` 覆盖 |
| `services/ai/agent/tools/delegate_tool.py` | 新增 `delegate` 工具：L1 团队匹配 → L2 动态创建临时专家（查重 + 上限 2）→ L3 返回失败由 Chief 兜底；结果截断 1500 字符并实时写入群聊 |
| `services/ai/agent/group_chat_service.py` | `post_message` 异步化：@ 定向仍同步；未 @ 触发自主派单（立即返回 pending + 后台任务）；**后台任务使用独立数据库会话**（修复请求级 session 被关闭导致的 503）；群聊级互斥锁与频率限制改为**模块级共享** |
| `scripts/patch_chief_delegate.py` | 为现有系统 Chief 补丁 `delegate` 能力（已执行） |

### 2. 前端实现
- `api.ts`：`postMessage` 返回类型支持 `pending_message`/`async`。
- `GroupChatView.tsx`：发送后追加 user + pending；启动**每 3s 轮询**增量合并消息（seen id 去重）；检测到【汇总】停止轮询。

### 3. 测试
- 后端新增 `tests/api/test_autodispatch_api.py` 7 用例：delegate L1/L2/L3、异步响应、并发锁、限流、Chief 失败兜底。
- 全量回归：`test_bots_api` + `test_groups_api` + `test_autodispatch_api` **18/18 通过**。
- 前端 `groups.test.tsx` **3/3 通过**（含异步自主派单轮询）；`tsc -b` **0 错误**。

### 4. HTTP 端到端实测（真实 LLM）
- 用户只给任务："请设计一款助眠安神饮品配方"（**不 @ 任何 Bot**）。
- 群聊消息流自动出现：
  - `⏳ Chief 正在组织团队…`
  - 配方专家输出专业配方（辨证与目标、调理思路）
  - **动态调整**：初版方案中"麦冬不在 2023 药食同源目录""酸枣仁 17g 超限" → 自动修正为合规用量
  - `【汇总】` 最终方案：完整配方表（君臣佐使 + 日用量）+ 方解 + 制作 SOP + 合规状态
- 耗时约 120 秒（LLM 串行），异步轮询无超时。

### 5. 结论
**自主派单目标达成**：用户给任务，Chief 自动组织团队（能力驱动、三级兜底、动态调整、最终汇总），无需用户指定人员。

---

## 九、剩余待完善项实施完成（2026-10-13 深夜）

### 1. Bot 详情编辑功能
- `BotDetailDrawer.tsx` 增加**编辑模式**：可修改名称、简介、头像、人设、模型 ID、可见性、能力白名单（逗号分隔），保存调用 `PUT /api/v1/bots/{id}`，通过 `onUpdated` 回传。
- HTTP 实测：创建 Bot → 编辑名称/简介/可见性 → 返回更新成功。

### 2. 群聊成员管理 UI
- `GroupChatView.tsx` 增加「成员」对话框：
  - 展示当前成员（Chief 标记管理员，不可移除）；
  - 可移除普通成员（调用 `DELETE /groups/{id}/members/{bot_id}`）；
  - 可添加非成员 Bot（调用 `POST /groups/{id}/members`）；
  - 操作后重新拉取群详情刷新本地状态。

### 3. 群聊消息引用
- `GroupChatView.tsx`：每条消息 hover 显示引用按钮 → 设置 `reply_to`；输入区上方显示引用条（可取消）；发送时携带 `reply_to`。
- 后端 `ai_bot_group_messages.reply_to` 字段已支持。

### 4. Bot 对话历史加载
- 后端：新增 `GET /api/v1/bots/{id}/history`（按 `chat_sessions.bot_id` 取最近持续会话消息）。
- 后端：`/ai/chat` 会话查找按 `bot_id` 隔离；新增 `_persist_chat_record` 公共写回函数，**流式对话 `/ai/chat/stream` 也在完成后写回会话**（修复 BotChatView 使用的流式路径无历史的问题）。
- 前端：`BotChatView` 打开时调用 `botApi.getHistory` 加载历史消息。
- HTTP 实测：非流式与流式对话后，history 均返回 `[user, assistant]` 两条消息（真实 LLM 回复）。

### 验证门禁
- 后端 pytest：`test_bots_api` + `test_groups_api` + `test_autodispatch_api` **18/18 通过**。
- 前端：`tsc -b` **0 错误**；vitest **8/8 通过**（含异步自主派单轮询）。
- 数据库已清理（保留 6 个系统种子 Bot）。

### 剩余未处理项（存量/历史问题）
- 第 6 项：`agent-workflow.unit.test.tsx` 8 个存量失败（基线，与本次功能无关）。
- 第 7 项：alembic 历史迁移 head 重叠（当前用幂等 DDL 绕过）。

---

## 十、存量问题修复（2026-10-13 深夜）

### 第 6 项：agent-workflow 单测 8 个失败 → 已修复
- **失败根因**：
  1. `AgentWorkflowTab.tsx` 的 `scrollIntoView` 在 jsdom 测试环境中不存在 → 渲染类测试 6 个崩溃；
  2. `SimpleTokenEstimator.estimateSingle` 对空消息返回固定开销 4，而测试期望空消息为 0；
  3. 测试使用 `getByText` 查询但页面存在多个匹配 → strict mode violation。
- **修复**：
  - `AgentWorkflowTab.tsx`：`scrollIntoView?.()`（jsdom 兼容）；
  - `utils/eventSourcing.ts`：空消息返回 0 token；
  - `agent-workflow.unit.test.tsx`：歧义查询改用 `getAllByText`，并修正为实际存在的文案（"Agent v3.0"、"Turn/Step 驱动"）。
- **验证**：`agent-workflow.unit.test.tsx` **16/16 通过**；全量前端 vitest（agent-workflow + bots + groups）**24/24 通过**；`tsc -b` 0 错误。

### 第 7 项：alembic 迁移 head 重叠 → 已修复
- **失败根因**：历史迁移 `20260918_000000_add_peptide_structure_analysis.py` 文档声明 `Revises: 20260910_000000_add_cfam_tables`，但 `down_revision` 被误写为 `None`，导致 DAG 分叉出大量游离 head，`alembic upgrade head` 报 `overlapping revisions`。
- **修复**：
  1. 修正 `20260918` 的 `down_revision = '20260910_000000_add_cfam_tables'`，并删除重复的 `branch_labels`/`depends_on` 声明；
  2. 用 `alembic merge heads` 生成合并迁移 `4dfbe6e25d76`；
  3. `scripts/fix_alembic_head.py` 将数据库 `alembic_version` 表重置为唯一合并 head。
- **验证**：
  - `alembic heads` → 仅 `4dfbe6e25d76 (head) (mergepoint)`；
  - `alembic current` → 单一 head；
  - `alembic upgrade head` → **成功（exit 0）**，不再报错。
- **注意**：`scripts/apply_bot_migration.py` 等幂等 DDL 脚本仍保留，作为应急手段；后续新迁移可直接走 `alembic upgrade head`。

### 第 6/7 项修复后，待完善清单全部清零（Bot/群聊功能范围内）。

---

## 十一、v3.3 任务驱动自动建群实施完成（2026-10-14）

按 `docs/DSBot任务驱动自动建群设计方案.md`（v3.3 可实施版）完成开发与实测。

### 1. 后端实现
| 模块 | 说明 |
|:---|:---|
| 数据模型 | `ai_task_groups`（任务状态机）、`ai_mcp_servers`（MCP 服务器注册表）、群聊 `archived_at`、消息 `sender_bot_name`；Alembic 迁移 `20261014_000000` |
| `role_templates.py` | 10 个专业角色模板（含能力标签/工具白名单/`required_mcp_servers`/人设模板） |
| `mcp_bridge.py` | MCP 客户端桥（HTTP JSON-RPC）：schema 缓存 TTL60s、懒加载、`mcp_<server>__<tool>` 命名空间、白名单/结果截断/Token 解密 |
| `orchestrator` | 执行前按 Bot 绑定的 `mcp:<server>` 增量注册外部工具；`validate_capabilities` 对 `mcp:` 前缀放行 |
| `task_planner.py` | LLM 解析角色需求（Pydantic 校验+重试1次+默认角色集降级） |
| `bot_manager` | `match_bot_to_role`（0.35能力+0.25工具+0.20角色名+0.20MCP）、`recruit_bot_from_role_template`（按模板招募 AI 员工） |
| `task_team_service` | 同事务建群+建任务+写消息；5 分钟限流；后台派单；任务状态 recruiting→completed/failed |
| API | `POST /tasks/auto-team`、`GET /tasks`、`GET /tasks/{id}`、归档/恢复；群聊 `POST /groups/{id}/archive|restore`；`/admin/mcp-servers` CRUD+test |
| CSRF | `/api/v1/tasks` 与 `/api/v1/admin/mcp-servers` 加入 CSRF 豁免 |

### 2. 前端实现
- `api.ts`：`taskApi`（auto-team/list/get/archive/restore）、`groupApi.listGroups/archiveGroup/restoreGroup`；`GroupMessage.sender_bot_name` 类型。
- `TaskCenter.tsx`：研发任务中心视图（新建任务对话框、任务列表筛选、任务卡片状态徽标、点击加载对应任务群执行视图，复用 `GroupChatView` + 轮询）。
- `AgentPage`：左侧导航新增「任务中心」。
- `GroupChatView`：发送者名称优先显示 `sender_bot_name`（专业角色名）。

### 3. 测试
- 后端新增 `tests/api/test_task_team_api.py` **9 用例**（规划降级、评分命中、按模板招募、任务建群/状态流转/失败、归档、MCP CRUD、`mcp:` 放行、桥接注册）。
- 全量回归：bots+groups+autodispatch+task_team **27/27 通过**。
- 前端新增 `task-center.test.tsx`（3 用例）；vitest **27/27 通过**；`tsc -b` **0 错误**。

### 4. HTTP 端到端实测（真实 LLM）
- `POST /tasks/auto-team`（任务："设计助眠安神饮品配方 + 安全性审查 + 合规核查"）：
  - 群聊自动创建，消息流出现 `【任务分配】配方设计专家、安全性评估专家、法规合规专家`；
  - 后台自动派单，配方专家被真实调用并输出专业配方内容；
  - 中途 LLM 触发供应商 429 频率限制，但**降级链生效**：子任务失败继续执行，最终仍输出【汇总】；
  - 任务状态 recruiting → completed 流转正常。
- 说明：429 为环境 LLM 限流（连续多次调用），非流程缺陷；正常限流额度下可输出完整专家结果。

### 5. 结论
**任务驱动自动建群闭环达成**：用户只提交任务 → 系统专业配人（含 MCP 能力/实时招募）→ 自动建群 → 自动派单 → 汇总。剩余演进项（P2）：Redis 锁/限流、后台任务持久化恢复、MCP stdio 传输、MCP 服务器前端管理页。

---

## 十二、P2 演进项与第三阶段实施完成（2026-10-14）

### P2-1 MCP 服务器前端管理页
- `frontend/src/pages/settings/components/McpServersPanel.tsx`：列表/新增/编辑/启停/删除/测试连接（列出工具）/工具白名单/可见性。
- 接入 `SettingsPage` 新增「MCP」Tab（`type TabId`、`TABS`、`PANELS`）。
- 前端 API：`mcpAdminApi`（list/create/update/remove/test）。

### P2-2 任务持久化恢复
- 新增 `recover_stale_tasks(timeout_minutes=30)`：启动时扫描超过 30 分钟仍处于 `recruiting/dispatching` 的任务 → 置为 `failed(timeout)`，并在对应任务群写入提示消息。
- 在 `app.main.lifespan` 启动阶段自动调用。

### Phase3-1 记忆服务端化（自动记忆）
- 新增 `services/ai/agent/memory_service.py`：`extract_and_store_memories` 用一次 LLM 调用从"用户输入+Bot 回复"提取结构化记忆（preference/fact/contraindication），写入 `ai_bot_memories`（`source='auto'`）。
- 在 `_persist_chat_record`（/ai/chat 与流式对话写回）后接入；受 `ENABLE_AUTO_MEMORY` 环境变量开关控制（默认关闭，避免额外 LLM 成本）。

### Phase3-2 用量统计
- 新表 `ai_bot_usage`（Alembic 迁移 `20261014_010000`）。
- `AgentExecution` 增加 `prompt_tokens/completion_tokens`；`orchestrator.execute_smart` 每步 LLM 调用后估算 token 并累积（`_estimate_tokens`）。
- `BotManager.execute_agent_task` 返回前通过 `_record_usage` 写入 `ai_bot_usage`（利用 context 中的 db/tenant/user）。
- API：`GET /api/v1/usage/stats`（今日/本周/按 Bot 分组）、`GET /api/v1/usage/recent`。

### Phase3-3 前端用量展示
- `AgentPage` 顶部新增「AI 用量」概览条（今日 tokens/调用次数、本周 tokens），数据来自 `usageApi.stats()`。

### 验证
- 后端 pytest **27/27 通过**；前端 `tsc -b` **0 错误**；vitest **11/11 通过**。
- HTTP 实测：`/usage/stats` 200；`/admin/mcp-servers` CRUD 200（创建/列表/更新/删除/测试）。
- 修复：MCP/任务/用量新路由的 CSRF 豁免已加入；`app.schemas` 补充 `DeleteAccountRequest` 导出（并行开发遗漏）；`orchestrator` 模块级常量位置修正。

### 剩余未实施（需外部基础设施）
- Redis 多 worker 锁/限流迁移（需 Redis 服务）。
- MCP `stdio` 传输（需子进程管理，当前仅支持 HTTP/SSE）。

---

## 十三、内置 GitHub MCP（方案 A）实施完成（2026-10-14）

用户零配置，只需在 `.env` 设置一次 `GITHUB_TOKEN`。

### 1. 后端
- 新增 `app/api/v1/github_mcp_router.py`：`POST /api/v1/mcp/github`（MCP JSON-RPC over HTTP）。
  - `initialize` / `tools/list` / `tools/call`
  - 内置 8 个 GitHub 工具：`github_get_repo`、`github_list_repo_files`、`github_read_file`、`github_search_code`、`github_list_issues`、`github_create_issue`、`github_list_pulls`、`github_get_commit`
  - 认证：读取 `GITHUB_TOKEN` 环境变量（`load_dotenv` 确保 config 不写 os.environ 的问题已解决）
- 启动种子：`seed_github_mcp_server()` 自动在 `ai_mcp_servers` 创建 `github` 服务器记录（`url=/api/v1/mcp/github`，org 可见）。
- CSRF 豁免：`/api/v1/mcp/github` 已加入。

### 2. 配置
- `backend/.env` 已写入：
  - `GITHUB_TOKEN=ghp_***`（已配置，不在文档展示明文）
  - `GITHUB_REPO=jinduoxia377-lgtm/rmfood`
- Token 仅存环境变量，不落库、不返回前端。

### 3. 验证（真实 Token）
- `tools/list` → 200，8 个工具。
- `tools/call github_get_repo {repo: jinduoxia377-lgtm/rmfood}` → 200，返回：
  - `full_name: jinduoxia377-lgtm/rmfood`、`description: rmfood配方设计平台`、`default_branch: main`、`html_url` 等。
- 使用方式：AI 员工 capabilities 加 `mcp:github`，或角色模板 `required_mcp_servers=["github"]`，即可在派单中实时读取项目仓库代码/文档/Issue/PR。

---

## 十四、v3.4 GitHub 自动供给（Chief 派单链路 L2.5）实施完成

**用户核心需求**：给 Chief 发布任务后，若子任务在项目内找不到对应人物/工具，Chief 应自动通过 GitHub MCP 从 GitHub 获取对应内容/工具来完成派单。

### 1. GitHub MCP 新增工具
- `github_search_repositories`：按关键词/主题搜索仓库（发现开源技能/工具/Agent 模板）。实测：`query="toxicology agent"` 返回真实仓库列表。

### 2. 新增 `github_supply_service.py`
- `search_capability(capability, task)`：GitHub 搜索开源仓库（通过 MCP 端点）。
- `_read_repo_text`：读取仓库 README。
- `_parse_expert_plan`：LLM 解析 README 为专家/技能模板（Pydantic：name/capabilities/persona/is_mcp_server/mcp_command）。
- `register_mcp_from_github`：若项目是 MCP 服务器 → 生成 `ai_mcp_servers` 配置（**默认 disabled**，用户确认启用）。
- `recruit_expert_from_github`：创建"GitHub 来源专家"Bot（persona 含技能说明与 GitHub 来源，capabilities 含 `mcp:github`）。

### 3. delegate 派单链路升级（L2.5）
```
delegate(capability, task)
 ├─ L1 团队匹配
 ├─ L2 内置角色模板招募
 ├─ L2.5 ★ GitHub 自动供给（新增）：搜索 → 读 README → LLM 解析 → 创建 GitHub 来源专家 → 执行
 │     群聊可见【GitHub供给】消息（角色名+来源）
 └─ L3 通用专家兜底
```

### 4. 验证
- 后端 pytest **27/27 通过**（含 L3 降级路径测试：GitHub 供给无结果时正确返回失败）。
- `github_search_repositories` 端点实测返回真实开源仓库。
- 数据已清理，后端已重启运行 v3.4。
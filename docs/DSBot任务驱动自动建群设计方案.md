# RMFOOD 多智能体「任务驱动自动建群与专业配人」设计方案（v3.3 可实施）

> 状态：**v3.3 可实施**（已吸收《DSBot方案v3.2深度自审报告》全部 P0/P1 修订）
> 关联文档：`docs/DSBot自主派单设计方案.md`（v2）、`docs/DSBot群聊深度核查报告.md`、`docs/DSBot方案v3.2深度自审报告.md`
> 核心目标：用户只提交任务 → 系统**按专业角色模型配齐人员（含实时招募 AI 员工 + MCP 外部能力）→ 自动创建任务群 → 自动派单执行 → 输出结果**。

---

## 1. 用户已确认的决策

| # | 决策 | 结论 |
|:-:|:---|:---|
| 1 | 任务群保留策略 | 自动创建的"任务群"**永久保留在群聊列表**，后续可**归档** |
| 2 | 创建研发任务入口 | `/agent` 页面**顶部按钮** |
| 3 | 角色库规模 + 招募机制 | 角色库先内置 **10 个**；任务缺角色时**实时招募一个对应任务需求的 AI 员工**（创建为长期团队成员的具名专家） |

---

## 2. 总体流程

```
用户点击 /agent 顶部「创建研发任务」→ 输入任务（+ 可选约束）
   │ POST /api/v1/tasks/auto-team
   ▼
① 任务解析器（1 次 LLM）：
   输入：任务 + 角色模板库 + 可用 Bot 列表
   输出：{roles: [{role_key, task, matched_bot_id|null}]}
   ↓
② 专业配人：
   L1 角色评分匹配（能力词命中 40% + 工具覆盖 30% + 角色名匹配 30%）→ 命中现有 Bot
   L2 缺角色 → 【实时招募 AI 员工】按角色模板创建，群聊透明展示招募消息
   L3 角色库无此角色 → 创建"综合任务专家"（通用能力 + 诚实标注）
   ↓
③ 自动建群：
   群名 = "任务·<摘要>"
   Chief = 系统 Chief（管理员）
   成员 = 配齐的专家（含新招募的 AI 员工，org 共享）
   写入消息：【任务分配】角色分工 +【招募】新员工加入（如发生）
   ↓
④ 自动派单：复用 v2 Chief Agent 循环（delegate 工具），后台异步执行
   消息流：⏳ 组织团队 → 各专家结果 → 【汇总】
   ↓
⑤ 前端：收到 group_id → 跳转任务群 → 轮询查看全程
```

---

## 3. 角色模型库

`services/ai/agent/role_templates.py`，Pydantic 定义：

```python
class RoleTemplate(BaseModel):
    role_key: str
    name: str                        # 角色名，如 配方设计专家
    description: str
    capabilities: list[str]              # 能力域标签（评分匹配）
    required_tools: list[str]             # 所需工具白名单
    persona_template: str                    # 专业人设模板（含 {capability}/{task} 变量）
```

### 内置 10 个角色（种子）

| role_key | 名称 | 能力域标签 | 工具白名单 |
|:---|:---|:---|:---|
| formula_designer | 配方设计专家 | 配方设计/君臣佐使/剂量优化/功效 | generate_formula, ingredient_info, rag_retrieve |
| safety_reviewer | 安全性评估专家 | 安全性/十八反/配伍禁忌/剂量上限/过敏 | safety_assess, compliance_check, rag_retrieve |
| regulatory_compliance | 法规合规专家 | 药食同源目录/法规/标签/GB标准 | compliance_check, rag_retrieve |
| toxicologist | 毒理学评估专家 | 毒理/慢性毒性/急性毒性/安全性 | literature_search, rag_retrieve, qa_answer |
| experiment_designer | 实验方案专家 | 实验设计/体外/体内/指标/统计 | generate_experiment_plan, rag_retrieve |
| literature_researcher | 文献检索专家 | 文献/PubMed/证据/机理 | literature_search, rag_retrieve |
| process_engineer | 工艺工程专家 | 工艺/SOP/剂型/稳定性/口感 | stability_predict, taste_predict, rag_retrieve |
| cost_analyst | 成本分析专家 | 成本/原料价格/预算优化 | cost_estimate, rag_retrieve |
| quality_engineer | 质量合规专家 | 质量控制/检测/标准/批记录 | qa_answer, rag_retrieve, compliance_check |
| marketing_analyst | 市场分析专家 | 市场/人群/竞品/定位 | rag_retrieve, qa_answer, literature_search |

> 角色库可扩展：用户可新增角色模板；招募的 AI 员工按角色模板落地。

---

## 4. 任务解析器（TaskPlanner）

- **输入**：任务 + 角色模板库 + 可用 Bot 列表。
- **输出**（一次 LLM 调用，JSON）：
  ```json
  {"roles": [
    {"role_key": "formula_designer", "task": "设计降糖饮品配方", "matched_bot_id": 2},
    {"role_key": "safety_reviewer", "task": "审查配方安全性", "matched_bot_id": null}
  ]}
  ```
- **校验**：Pydantic；`role_key` 必须在模板库；`matched_bot_id` 必须存在。
- **降级**：解析失败 → 重试 1 次 → 默认角色集 `[formula_designer, safety_reviewer]`。

---

## 5. 专业配人（含实时招募 AI 员工）

### 5.1 L1 角色评分匹配（确定性，不额外调 LLM）
```
score = 0.4 × 能力词命中率（bot.capabilities 命中角色.capabilities 的比例）
      + 0.3 × 工具覆盖率（角色.required_tools 在 bot.capabilities 中的比例）
      + 0.3 × 角色名匹配（bot.name/description 含角色核心词）
score ≥ 0.5 → 匹配最高分 Bot；否则进入 L2。
```

### 5.2 L2 实时招募 AI 员工（核心）
- **触发**：团队无匹配角色。
- **行为**：
  1. 按 `RoleTemplate` 创建新 Bot（`name=角色名`、`persona=模板 + 任务上下文`、`capabilities=required_tools`、`visibility=org`、`is_system=false`）；
  2. **查重**：已存在同角色专家则复用（不重复招募）；
  3. 群聊写入**招募消息**（透明可见）：
     ```
     【招募】任务需要「毒理学评估」，团队暂无该专家，
     已实时招募 AI 员工「毒理学评估专家」加入本次任务。
     ```
  4. 新员工加入群成员并参与派单。
- **长期保留**：任务结束后该 AI 员工**永久保留在用户 Bot 列表**（可复用、可编辑、可删除=解雇），后续类似任务直接 L1 命中。
- **数量控制**：单次任务最多招募 2 名 AI 员工；超出 → L3。

### 5.3 L3 兜底
- 角色库无对应角色（如"市场调研"但未配置角色）→ 创建"综合任务专家"（通用工具 + 诚实标注"超出专业角色库"）。

---

## 6. 自动建群与派单

### 6.1 服务 `TaskTeamService`

```python
class TaskTeamService:
    async def create_task_team(self, tenant_id, user_id, content, constraints=None) -> dict:
        plan = await task_planner.plan(content, ROLE_TEMPLATES, available_bots)   # ①
        member_bot_ids, recruit_msgs = [], []
        for item in plan["roles"]:
            bot = await self._resolve_role_bot(item, tenant_id, user_id)         # ② L1/L2/L3
            if bot:
                member_bot_ids.append(bot.id)
                if item.get("recruited"):                                        # ③ 招募消息
                    recruit_msgs.append(f"「{bot.name}」")
        chief_id = await self._bot_manager.get_chief(tenant_id, user_id)
        group = await self._repo.create_group(tenant_id, f"任务·{content[:12]}…", chief_id, user_id, member_bot_ids)
        await self._repo.add_message(group.id, "user", content, sender_user_id=user_id)      # 任务消息
        await self._repo.add_message(group.id, "bot", "【任务分配】" + 角色分工, sender_bot_id=chief_id)
        if recruit_msgs:
            await self._repo.add_message(group.id, "bot",
                f"【招募】任务需要补充专家，已实时招募 AI 员工：{'、'.join(recruit_msgs)} 加入本次任务。",
                sender_bot_id=chief_id)
        await self._start_dispatch(group.id, tenant_id, user_id, content)         # ④ 自动派单
        return {"group_id": group.id, "group_name": group.name, "members": member_bot_ids, "async": True}
```

### 6.2 复用
- 自主派单：`_run_autodispatch_in_new_session`；
- 前端轮询：`GET /groups/{id}/messages`。

### 6.3 任务群归档（决策 1）
- `ai_bot_group_sessions` 增加 `archived_at TIMESTAMPTZ NULL`（或 status='archived'）。
- API：
  - `POST /api/v1/groups/{id}/archive`（归档）与 `POST /groups/{id}/restore`（恢复）；
  - `GET /groups?include_archived=true|false`（默认不显示已归档）。
- 前端：`GroupChatPanel` 增加"归档群聊"按钮 + "已归档"筛选视图。
- 归档群消息仍可读（只读）。

---

## 7. 前端交互

### 7.1 入口（决策 2）
- `/agent` 页面顶部新增「**创建研发任务**」按钮 → 打开对话框：
  - 任务描述（必填）+ 可选约束（目标人群/功效/预算）；
  - 提交 → `POST /api/v1/tasks/auto-team`；
  - 响应 `group_id` → 跳转群聊视图并启动轮询。

### 7.2 群聊视图
- 新任务群消息流：
  1. 用户任务消息；
  2. `【任务分配】配方设计专家、安全性评估专家…`；
  3. `【招募】已实时招募 AI 员工「毒理学评估专家」…`（如发生）；
  4. `⏳ Chief 正在组织团队…`；
  5. 各专家结果（**显示专业角色名**，通过消息冗余 `sender_bot_name`）；
  6. `【汇总】`最终方案。

### 7.3 临时专家名称显示（修复 P0 S1）
- 后端 `ai_bot_group_messages` 增加 `sender_bot_name` 冗余字段；前端优先使用，不再依赖本地 `bots` 列表。

---

## 8. API 设计

```
POST /api/v1/tasks/auto-team
  body: { content: string, constraints?: { target_population?, budget?, effects? } }
  resp: { success, data: { group_id, group_name, members: [{bot_id, name, role_key}], async: true } }

POST /api/v1/groups/{id}/archive      → 归档任务群
POST /api/v1/groups/{id}/restore      → 恢复任务群
GET  /api/v1/groups?include_archived=false
```

---

## 9. 复用清单

`create_group`、`_run_autodispatch_in_new_session`、`delegate` 工具、`GroupChatView` 轮询、`BotManager`（升级 `create_temporary_expert` 为按角色模板招募）。

---

## 10. 测试计划

### 后端 pytest（`tests/api/test_task_team_api.py`）
1. `test_plan_roles_valid`：mock TaskPlanner 返回合法角色 → 建群成功、成员正确
2. `test_plan_roles_fallback`：TaskPlanner 非法 JSON → 默认角色集
3. `test_role_matching_l1`：评分命中现有专家
4. `test_role_recruitment_l2`：缺角色 → 按模板招募 AI 员工（persona=角色模板、capabilities=required_tools、visibility=org），群聊含【招募】消息
5. `test_task_team_creates_group`：自动建群含 Chief+成员+【任务分配】消息
6. `test_task_team_triggers_dispatch`：后台派单最终写入【汇总】（mock execute_agent_task）
7. `test_sender_bot_name_in_message`：消息带 `sender_bot_name`
8. `test_group_archive_restore`：归档后默认列表不可见、可恢复

### 前端 vitest
- `TaskCreateDialog` 提交后跳转群聊视图
- `GroupChatView` 使用 `sender_bot_name` 显示发送者
- `GroupChatPanel` 归档/恢复交互

### 回归
- tsc 0 错误；后端 pytest 全绿；vitest 全绿；Playwright 全流程（顶部按钮 → 提交任务 → 自动建群/招募 → 派单 → 汇总）

---

## 11. 实施任务清单（按依赖顺序）

1. `role_templates.py`（10 个种子角色）
2. `task_planner.py`（LLM JSON 解析 + 校验 + 降级）
3. `BotManager`：`match_bot_to_role`（评分）、`recruit_bot_from_role_template`（招募，替代临时专家）
4. `TaskTeamService` + `POST /tasks/auto-team`
5. 群聊消息 `sender_bot_name` 冗余（模型/接口/前端）
6. 任务群归档（`archived_at` + API + 前端）
7. 前端：`TaskCreateDialog` + 顶部按钮 + 跳转群聊 + 角色名显示 + 归档交互
8. 测试：后端 8 用例 + 前端用例
9. 回归实测：tsc/pytest/vitest/Playwright 全流程

---

## 12. 验收标准

1. 用户点击 `/agent` 顶部「创建研发任务」，只输入任务描述 → 系统自动建群、配人（含招募）、派单、输出【汇总】。
2. 缺角色时群聊出现【招募】消息，新 AI 员工以专业角色名加入团队，并保留在用户 Bot 列表。
3. 群聊消息发送者显示专业角色名（如"毒理学评估专家"），而非 `Bot#id`。
4. 任务群永久保留；可归档/恢复；归档群默认不显示但消息可读。
5. 全部门禁通过。

---

## 13. 风险与对策

| 风险 | 对策 |
|:---|:---|
| LLM 角色解析不准 | Pydantic 校验 + 默认角色集降级；角色库约束 LLM 选择范围 |
| 招募 AI 员工导致团队膨胀 | 查重复用；单次任务 ≤2；用户可删除（解雇）；提供"自动创建员工"筛选 |
| 任务群积累 | 归档机制；后续可加自动归档策略 |
| 群级锁/频率限制进程内存 | 单实例可用；多实例迁移 Redis（P2 演进） |
| 后台派单重启丢失 | 任务表 + 恢复（P2 演进） |

---

## 14. 已确认决策
1. ✅ 任务群永久保留 + 可归档
2. ✅ 创建研发任务入口：`/agent` 顶部按钮
3. ✅ 角色库内置 10 个；缺角色时实时招募对应任务需求的 AI 员工（长期成员，可复用/编辑/删除）

---

## 15. v3.2 补充设计（MCP 集成 + 任务中心入口）

> 用户提出两项严重问题：① AI 员工不应只调用内置工具，还需通过 **MCP** 连接外部能力；② 创建研发任务入口设计有缺陷。

### 15.1 核查结论（现状）

| 项 | 现状 | 问题 |
|:---|:---|:---|
| MCP | 项目有 `services/mcp_server` + `api/v1/mcp_router`，本质是**把项目内置能力包装为工具清单并暴露 REST API** | **不是标准 MCP 协议（JSON-RPC over stdio/SSE/HTTP），也不是 MCP 客户端**；orchestrator 无法连接外部 MCP 服务器 |
| 入口 | 方案 v3.1 建议 `/agent` 顶部横幅加「创建研发任务」按钮 | ① 顶部横幅是品牌区，承载一级操作语义弱；② **没有任务聚合视图**（我的任务/进行中/已完成/归档）；③ 任务与群聊关系不清 |

### 15.2 MCP 客户端集成设计（AI 员工的外部能力）

#### 1) MCP 服务器注册表
- 数据模型 `McpServerConfig`（表 `ai_mcp_servers`）：`id, name, transport(http|sse|stdio), url, headers(JSON), command(stdio), enabled, allow_tools(JSON 白名单), tenant_id`。
- 管理员在系统设置中配置；密钥加密存储（复用 `EncryptionUtils`）。

#### 2) MCP 客户端桥 `services/ai/agent/mcp_bridge.py`
```
McpClientBridge
 ├─ connect(server) → 握手 + tools/list（缓存工具 schema）
 ├─ list_tools(server) → [{name: "mcp_<server>__<tool>", schema}]
 ├─ call_tool(server, tool, args) → JSON-RPC tools/call → 结果（截断）
 └─ 支持 HTTP/SSE 传输（mcp SDK 或自实现 JSON-RPC）
```

#### 3) 注册进 orchestrator 工具注册表
- 工具注册表支持**动态外部工具**：`register_external_tool(name, schema, executor)`。
- 系统启动时（或 Bot 首次需要时）从启用的 MCP 服务器拉取工具并注册；
- 命名空间 `mcp_<server>__<tool>` 避免与内置工具冲突。

#### 4) Bot capabilities 扩展
- `capabilities` 增加 `mcp:<server_name>` 标记 → 该 Bot 可调用该 MCP 服务器的工具；
- 角色模板增加 `required_mcp_servers`（如 `pubmed`、`molecular_db`）；
- 招募的 AI 员工自动绑定角色所需 MCP 服务器；
- TaskPlanner 解析角色时同时考虑 MCP 能力。

#### 5) 安全与审计
- MCP 服务器仅管理员配置；
- 工具调用记录审计日志（bot / tool / args / result）；
- 每个服务器可配置允许工具子集（`allow_tools`）；
- 外部工具结果一律截断并做输出安全检查。

#### 6) 与 delegate/自主派单的关系
- delegate 工具创建的目标 Bot，其 capabilities 已包含 `mcp:<server>`；
- Chief 循环中调用 delegate → 目标 Bot 的 orchestrator 会暴露其绑定的 MCP 工具，实现"专家用外部数据源干活"。

### 15.3 创建研发任务入口重新设计：新增「任务中心」

#### 1) 页面结构（替代顶部按钮方案）
`/agent` 左侧导航增加第四项 **「任务中心」**（`view='tasks'`）：

```
/agent
├── Bot 列表
├── Chief 控制台
├── 群聊协作
└── 任务中心（新增） ← 任务驱动主入口
```

#### 2) 任务中心视图
- 主区域：
  - 顶部：**「新建任务」主按钮**（大按钮，明确一级行为）；
  - 任务列表（筛选：全部 / 进行中 / 已完成 / 已归档）；
  - 任务卡片：任务摘要、状态徽标（招募中/派单中/已完成/已归档）、创建时间、专家数；
- 新建任务对话框：任务描述 + 可选约束（目标人群/功效/预算）；
- 点击任务卡片 → 展开该任务的**执行视图**：任务信息 + 对应任务群消息流（复用 GroupChatView）+ 派单进度（轮询）。

#### 3) 数据模型
- `ai_task_groups` 表（或扩展 group 元数据）：`id, group_id, name, status(recruiting|dispatching|completed|archived), task_content, created_by, created_at`。
- 状态流转：`recruiting → dispatching → completed`；用户归档 → `archived`。
- 完成判定：检测到群聊消息出现【汇总】时，由后台派单任务将状态置为 `completed`。

#### 4) API
```
POST /api/v1/tasks/auto-team     # 创建任务 + 自动建群 + 派单（返回 task_id + group_id）
GET  /api/v1/tasks               # 任务列表（含状态）
GET  /api/v1/tasks/{task_id}      # 任务详情（含群聊消息摘要）
POST /api/v1/tasks/{task_id}/archive
POST /api/v1/tasks/{task_id}/restore
```

### 15.4 方案更新说明
- 原 v3.1 第 7.1 节「`/agent` 顶部按钮」**作废**，替换为 15.3 的「任务中心」；
- 实施任务清单第 7 步更新为：前端新增「任务中心」视图 + 新建任务对话框 + 任务卡片/执行视图；
- 测试计划新增：MCP 桥接注册/调用用例、任务中心状态流转用例。

### 15.5 新增测试用例
后端：
9. `test_mcp_server_config_crud`
10. `test_mcp_bridge_register_tools`：mock MCP 服务器返回工具 schema → 注册进注册表（命名空间正确）
11. `test_bot_with_mcp_capability`：Bot capabilities 含 `mcp:pubmed` → orchestrator 暴露外部工具
12. `test_task_status_flow`：任务 recruiting → dispatching → completed（出现【汇总】后）
13. `test_task_center_list_archive`

前端：
- `TaskCenter` 列表/筛选/归档
- 新建任务后跳转执行视图并轮询

### 15.6 风险与对策补充
| 风险 | 对策 |
|:---|:---|
| 外部 MCP 服务器不可用/超时 | 桥接超时 + 工具调用失败降级（返回错误给 LLM） |
| MCP 工具注入恶意参数 | 输出安全校验 + 审计 + 白名单 |
| 任务状态与消息不同步 | 以群聊消息为准，任务状态由派单完成回调更新；归档为手动 |
| 多 worker 下 MCP 连接缓存失效 | 单实例内存缓存；多实例用 Redis（P2 演进） |

---

## 16. v3.3 修订落实（P0/P1 全部落实，可实施）

> 本节将《DSBot方案v3.2深度自审报告》的 M1-M12 逐条落实为具体实现设计。开发严格按本节执行。

### 16.1 MCP 工具注册机制（落实 M1/M2/M5）

**核心：MCP 工具「懒加载 + 全局缓存 + 执行前按 Bot 绑定增量注册」。**

1. **McpBridge 缓存层**（`services/ai/agent/mcp_bridge.py`）：
   - `_schema_cache: dict[str, dict]`（server -> 工具 schema 列表），**TTL=60s**；
   - `_client_cache: dict[str, McpClient]`（server -> 客户端连接，惰性创建）。
2. **注册时机**：
   - `BotManager.validate_capabilities`：**对 `mcp:` 前缀直接放行**（不校验注册表）；
   - `orchestrator.execute_smart` 构造 `tools_schema` 前，调用 `McpBridge.ensure_registered(allowed_tools)`：
     - 从 `allowed_tools` 提取 `mcp:<server>` 标记 → 对每个启用的服务器，从缓存/拉取 schema → 通过 `registry.register_external_tool(name, schema, executor)` 注册；
     - `tools_schema = registry.list_tools()` **在注册之后**获取（确保本次执行可见）。
3. **命名空间**：`mcp_<server>__<tool>`（下划线命名，避免与内置工具冲突）。
4. **调用执行**：orchestrator 发现工具名以 `mcp_` 开头 → 走 `McpBridge.call_tool(server, tool, args)`，结果截断 2000 字符并做 `check_output`。
5. **失败降级**：MCP 服务器连接失败 → 该服务器工具标记 `unavailable`（不进入 tools_schema），并在群聊消息中说明"外部数据源暂不可用"。

### 16.2 MCP 服务器注册表与安全（落实 M3/M4）

1. **表 `ai_mcp_servers`**：`id, tenant_id, name, transport('http'|'sse'), url, headers(JSON), auth_token_encrypted, enabled, allow_tools(JSON), visibility('org'|'private'), created_at`。
   - **首版只支持 HTTP/SSE 远程服务器**（自实现 JSON-RPC over HTTP，不引入重型 mcp SDK）；`stdio` 列为 P2 可选。
2. **权限**：
   - 管理员可配置（`visibility=org`）或用户私有（`visibility=private`）；
   - 任务/群聊只允许使用**当前租户可见且 enabled** 的服务器；
   - 调用前校验工具在 `allow_tools` 白名单内（空 = 全部）；
   - 参数长度/类型校验 + 结果 `check_output`。
3. **管理 API**：`GET/POST /api/v1/admin/mcp-servers`、`POST /mcp-servers/{id}/test`（测试连接并列出工具）、启停。

### 16.3 任务状态机（落实 M6）

1. **表 `ai_task_groups`**：`id, group_id, task_content, status('recruiting'|'dispatching'|'completed'|'failed'|'archived'), created_by, tenant_id, created_at, updated_at, error_message`。
2. **完成/失败回调**：
   - `_run_autodispatch_in_new_session(group_id, tenant_id, user_id, content, task_id=None)` 增加 `task_id` 参数；
   - `_run_chief_dispatch` 成功写【汇总】时 → `update task status='completed'`；
   - 异常分支 → `status='failed', error_message=<原因>`。
3. **超时扫描**：后台定时任务（每 5 分钟）扫描创建超过 **30 分钟**仍非 completed/failed 的任务 → 置为 `failed`（timeout）。
4. **归档**：用户调用 `POST /tasks/{id}/archive` → `status='archived'`（群聊只读保留）。

### 16.4 任务创建的事务与限流（落实 M7/M8）

1. **事务一致性**：`TaskTeamService.create_task_team` 在同一 `AsyncSession` 事务内完成：
   - 插入 `ai_task_groups`（status=recruiting）→ 创建群聊 → 写入【任务分配】消息 → commit；
   - 任一失败整体 `rollback`；返回 500。
2. **限流**：`POST /tasks/auto-team` 独立限流（同用户 **5 分钟 1 次**，模块级 `_LAST_AUTO_TEAM_AT`）；
   - 前端"新建任务"按钮提交后 `disabled`，防重复。
3. **幂等**：请求带 `client_request_id`（可选），后端去重（同用户同摘要 10 分钟内已存在 → 返回已有任务）。

### 16.5 角色与评分（落实 M9）

1. **`RoleTemplate` 增加 `required_mcp_servers: list[str]`**（如 `["pubmed"]`）。
2. **评分公式更新**：
   - `score = 0.35 × 能力词命中率 + 0.25 × 内置工具覆盖率 + 0.20 × 角色名匹配 + 0.20 × MCP 服务器匹配率`
   - MCP 服务器匹配率 = `bot.capabilities` 中 `mcp:<server>` 与 `role.required_mcp_servers` 的交集比例。
3. **Bot capabilities 存储约定**：`mcp:<server_name>` 作为合法能力项（`validate_capabilities` 放行）。

### 16.6 派单前预览与人工干预（落实 M10）

- 任务创建后默认自动派单；同时在前端任务详情提供「**追加专家**」按钮（从角色库/现有 Bot 选择并加入群成员，然后可在群里 @ 定向或触发新派单）。
- 在 `POST /tasks/auto-team` 响应中返回 `plan`（角色清单），前端任务卡片展示"参与专家"列表。

### 16.7 前端统一（落实 M11/M12）

1. **任务中心**与**群聊协作**共用 `GroupChatView` 组件与**同一状态来源**（`ai_task_groups.status` 为权威，群聊消息仅展示）。
2. **MCP 服务器管理页**：`/settings` 下新增"MCP 服务器"管理页（列表/新增/测试连接/启停/工具白名单），调用管理 API。

### 16.8 实施任务清单（v3.3 最终版，按顺序）

1. `ai_mcp_servers` / `ai_task_groups` 表 + Alembic 迁移
2. `role_templates.py`（10 角色，含 `required_mcp_servers`）
3. `mcp_bridge.py`（懒加载缓存 + 注册 + call + 安全校验）
4. orchestrator：执行前按 Bot 绑定注册 MCP 工具；`mcp:` 放行校验
5. `task_planner.py`（LLM 解析 + 校验 + 降级）
6. `BotManager`：`match_bot_to_role`（新评分）、`recruit_bot_from_role_template`
7. `TaskTeamService` + `POST /tasks/auto-team`（事务 + 限流）+ 任务状态机 + 超时扫描
8. 消息 `sender_bot_name` 冗余 + 群聊归档 API
9. MCP 服务器管理 API + 前端管理页
10. 前端：任务中心视图 + 新建任务对话框 + 追加专家 + 复用 GroupChatView + 角色名显示
11. 测试：后端 13 用例 + 前端用例（见 15.5 扩展）
12. 回归实测：tsc/pytest/vitest/Playwright 全流程

### 16.9 验收标准（v3.3）

1. 用户从「任务中心」新建任务，系统自动建群、配人（含 MCP 能力与招募）、派单、输出【汇总】。
2. Bot 配置 `mcp:<server>` 后，其 Agent 执行中**确实能调用外部 MCP 工具**（mock 服务器验证）。
3. 任务状态正常流转：招募中 → 派单中 → 已完成 / 失败；超时自动置 failed。
4. 任务创建失败整体回滚（无孤儿群/任务）。
5. 同一用户 5 分钟内重复提交任务被限流。
6. 群聊消息发送者显示专业角色名；任务群可归档/恢复。
7. 全部门禁通过。

---

## 17. v3.4：Chief 派单链路中的 GitHub 自动供给

> 用户核心需求：给 Chief 发布任务后，若子任务在项目内找不到对应人物/工具，Chief 应**自动通过 GitHub MCP 从 GitHub 获取对应内容/工具**来完成派单（派单链路中的自动兜底）。

### 17.1 派单兜底链升级（delegate 工具内）
```
delegate(capability, task)
 ├─ L1 团队匹配（评分）
 ├─ L2 内置角色模板招募 AI 员工
 ├─ L2.5 ★ GitHub 自动供给（新增）：
 │     ① github_search_repositories(capability 关键词) 搜索开源仓库
 │     ② 读 README → LLM 解析（用途/技能/MCP 服务器/Agent 模板）
 │     ③ 解析为临时 RoleTemplate → 创建 AI 员工（persona 含 GitHub 来源与技能说明）
 │     ④ 用新专家执行该子任务，结果写群聊（角色名+来源）
 │     ⑤ 若为 MCP 服务器项目 → 生成 ai_mcp_servers 配置模板（默认 disabled）
 └─ L3 通用专家兜底（诚实标注）
```

### 17.2 新增实现
1. `github_mcp_router.py` 增加 `github_search_repositories`（关键词/主题搜仓库）。
2. 新增 `services/ai/agent/github_supply_service.py`：
   - `search_capability(capability, task)`：GitHub 搜索 → 读 README → LLM 结构化解析。
   - `recruit_expert_from_github(capability, task, tenant_id, user_id)`：创建"GitHub 来源专家"Bot。
   - `register_mcp_from_github(repo)`：生成 MCP 服务器配置（enabled=false）。
3. `delegate_tool.py`：L2 失败后调用 `recruit_expert_from_github`（L2.5），成功则执行；失败才走 L3。

### 17.3 安全边界
- 只导入模板/提示词，**不自动执行第三方代码**；
- 新专家 persona 明确标注 GitHub 来源与能力边界；
- MCP 服务器配置默认 disabled，用户确认启用；
- 每次子任务最多触发 1 次 GitHub 供给（控制成本）。

### 17.4 测试
- mock GitHub 搜索/读取 → L2.5 创建"GitHub 来源专家"并执行；
- GitHub 无结果 → 降级 L3；
- MCP 服务器项目 → 生成 disabled 配置记录。
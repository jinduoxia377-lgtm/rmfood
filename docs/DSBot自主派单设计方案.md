# RMFOOD 多智能体「自主派单」平台 — 专业设计方案 v2（Agent 循环自主编排）

> 状态：**待评审**
> v2 核心变更：**废弃"独立规划器 + 固定流水线"**，改为 **Chief Agent 自主循环编排**——子任务拆分、顺序、依赖传递、动态调整全部由 Chief 在对话循环中自主决定。
> 关联代码：`backend/app/services/ai/agent/orchestrator.py`、`tools/`、`group_chat_service.py`、`bot_manager.py`、`frontend/src/components/ai/bots/GroupChatView.tsx`

---

## 1. 背景与目标

### 1.1 现状问题
- 当前群聊派单：@ 某人 → 只调被 @ 的 Bot；不 @ → 只有 Chief 用通用工具硬干。**不是自主派单**。
- v1 方案（独立规划器 + 固定子任务流水线）缺陷：
  1. **子任务孤立**：安全专家拿不到配方专家的输出（无依赖传递）；
  2. **无法动态调整**：前一步结果变化时后续步骤不会变；
  3. **静态上限**：子任务数固定 ≤4，复杂任务被硬截断；
  4. **匹配死板**：LLM 一次性给 `matched_bot_id`，错配无法纠正。

### 1.2 目标
用户只给任务，**Chief 像真正的主编一样**：
1. 先输出【派单计划】；
2. 在对话循环中**逐步决策**：调用谁、传什么上下文（含上一步结果）、是否动态调整；
3. 团队无对应专家时**自动创建临时专家**或**通用兜底**；
4. 全部完成后输出【汇总】。
全程异步执行 + 前端轮询；成本/并发/安全可控；过程透明可观测。

---

## 2. 设计原则

1. **Agent 循环而非流水线**：Chief 在 `orchestrator.execute_smart` 的 function-calling 循环中自主编排，天然支持依赖传递与动态重规划。
2. **能力驱动派单**：`delegate(capability, task)` —— Chief 说"要什么能力、干什么活"，找人/造人由工具完成。
3. **三级兜底**：L1 团队匹配 → L2 动态创建临时专家 → L3 Chief 兜底（诚实标注）。
4. **异步派单 + 前端轮询**：立即返回，群聊消息流逐条呈现过程。
5. **可观测**：计划、每次派单、每个结果、汇总都是群聊消息。
6. **防失控**：Chief 循环步数、子任务步数、结果长度、动态建人、并发、频率全部限流。
7. **降级闭环**：任一环节失败不中断流程。

---

## 3. 总体架构

```
用户发言（群聊）
   │ POST /groups/{id}/message
   ▼
GroupChatService.post_message（改造）
   │ ① 落库用户消息
   │ ② 未 @ 且锁空闲 → 落库"⏳ Chief 正在组织团队…"（立即反馈）
   │ ③ 返回 {user_message, pending_message, async:true}
   │ ④ asyncio.create_task 后台执行：
   │     群聊锁 → 调用 Chief 的 orchestrator.execute_smart(...)
   │     └─ Chief Agent 循环（LLM function calling）：
   │          · 第一步：输出【派单计划】→ 写群聊消息
   │          · 决策：调用 delegate(capability, task)  → 工具内部 L1/L2/L3
   │          · delegate 结果（含目标专家输出）返回给 Chief
   │          · Chief 基于结果继续决策（可依赖传递/动态调整）
   │          · 最后：输出【汇总】→ 写群聊消息
   │     释放锁
   ▼
前端 GroupChatView
   │ 发送后追加 user + pending 消息
   │ 每 3s 轮询消息流，增量合并；出现【汇总】停止
```

---

## 4. 核心机制

### 4.1 Chief Agent 循环（核心，替代 v1 规划器）

- 复用现有 `orchestrator.execute_smart(query, max_steps, context, allowed_tools, ...)`。
- **Chief 的 system prompt 增强**（在 Bot 详情/执行时注入）：
  ```
  你是 RMFOOD 总配方师 Chief。当你收到研发任务时：
  1. 第一步输出【派单计划】：拆解 2-4 个子任务，说明每个子任务需要什么能力；
  2. 对每个子任务调用 delegate(capability, task) 分派给专家；
     - task 中必须包含前序步骤的关键结果（依赖传递）；
     - 若前序结果不理想，可动态调整后续子任务；
  3. 收集结果后输出【汇总】：结论、方案、冲突消解、待办。
  ```
- **循环步数**：`max_steps=12`（Chief 的 LLM 决策次数，含工具调用与最终回复）。超过则强制输出已得结果作为【汇总】。
- **工具集**：Chief 保留业务工具 + 新增 `delegate`。LLM 自主决定"自己做还是派单"。

**为什么这比 v1 灵活**：
| 能力 | v1 流水线 | v2 Agent 循环 |
|:---|:---|:---|
| 子任务依赖传递 | ❌ 孤立 | ✅ task 携带上一步结果 |
| 动态调整 | ❌ 固定计划 | ✅ Chief 看到结果后调整下一步 |
| 子任务数量 | 固定 ≤4 | 由循环步数自然决定（最多 12 步） |
| 错配纠正 | ❌ 无法 | ✅ Chief 可再次 delegate 不同能力 |
| 中途失败 | 记录后继续 | Chief 看到失败后可换策略 |

### 4.2 `delegate` 工具（能力驱动派单）

**注册位置**：`backend/app/services/ai/agent/tools/delegate_tool.py`，仅加入 Chief 的 `capabilities`（专业 Bot 不注册 → 防递归）。

**Schema**：
```json
{
  "name": "delegate",
  "description": "将子任务分派给团队中的专家 Bot。capability 描述所需能力域（如 配方设计/安全性评估/毒理学评估）；task 为子任务内容（可包含前序步骤结果）。若团队无对应专家，系统会自动创建临时专家。",
  "parameters": {
    "type": "object",
    "properties": {
      "capability": {"type": "string", "description": "能力域描述"},
      "task": {"type": "string", "description": "要执行的子任务内容（≤2000字符）"}
    },
    "required": ["capability", "task"]
  }
}
```

**内部逻辑（三级兜底）**：
```
delegate(capability, task, context)
 ├─ L1: find_bot_by_capability(capability, tenant, user)
 │     关键词匹配 Bot.name/description/capabilities（capability 词元 vs 团队）
 ├─ 未命中 → L2: find_or_create_temporary_expert(capability, tenant, user)
 │     · 查重（已存在同域专家则复用）
 │     · 创建临时专家（模板 persona + 通用工具集 + visibility=org）
 ├─ 创建失败 → L3: 返回 ToolResult(success=false,
 │     data={"message": "未找到/无法创建<capability>专家，请 Chief 直接处理"})
 │     → Chief 看到后用业务工具/通用能力自己兜底（其最终回复会诚实标注）
 ├─ 命中/创建成功 → 用 BotManager.execute_agent_task(目标Bot, task, user_id, max_steps=4)
 │     · 结果截断 ≤1500 字符返回给 Chief
 │     · 同时把结果写入群聊消息（sender_bot_id=目标Bot）→ 可观测
 └─ 返回 ToolResult(success=true, data={bot_name, result})
```

### 4.3 动态编队（临时专家）

- 名称：`<能力域>专家`（如"毒理专家"）
- persona：模板化（不额外调 LLM）：
  ```
  你是 RMFOOD 平台的{capability}专家，负责{capability}相关工作。
  请结合平台知识库与可用工具完成用户分配的任务，输出专业、可执行、有依据的结果；
  证据不足时明确说明"现有研究可能具有……潜力"。
  ```
- capabilities：通用集 `["rag_retrieve", "literature_search", "qa_answer"]`
- visibility=org（组织共享，可复用）；创建前 PromptGuard。
- **查重**：先按 capability 关键词在用户可见 Bot 中查找已存在的同域专家，有则复用（防膨胀）。
- 限制：单次派单流程动态创建 ≤2 个；超出 → 后续走 L3。

### 4.4 派单过程可观测（群聊消息序列）

```
[user] 设计降糖饮品配方并做毒理初筛
[bot#Chief] ⏳ Chief 正在组织团队…
[bot#Chief] 【派单计划】①配方设计→配方专家 ②安全审查→安全专家 ③毒理初筛→（无现成专家，将创建）
[bot#2]     （配方专家）配方初稿：黄芪 9g、山药 15g…（task_execution_id 记录）
[bot#3]     （安全专家）审查通过，无禁忌；提示：…
[bot#9]     （毒理专家·自动创建）慢性毒性初筛：基于文献…建议…
[bot#Chief] 【汇总】最终配方方案 + 安全结论 + 待办
```

### 4.5 群聊级互斥锁与限流
- `GroupChatService._locks: dict[int, asyncio.Lock]`：后台派单持锁，完成释放。
- 发言时锁已占用 → 立即返回"⏳ 上一位自主派单任务进行中，请稍候"（不排队）。
- 同用户每分钟 ≤1 次自主派单（内存时间戳表）。

---

## 5. 后端设计

### 5.1 新增/修改文件

| 文件 | 改动 |
|:---|:---|
| `tools/delegate_tool.py` | **新增**：`delegate` 工具（L1/L2/L3 + 写群聊消息） |
| `tools/__init__.py` | 注册 `delegate_tool` |
| `bot_manager.py` | 新增 `find_bot_by_capability`、`find_or_create_temporary_expert`、`create_temporary_expert` |
| `group_chat_service.py` | `post_message` 异步化（未 @ 走 Chief Agent 循环）、互斥锁、限流、`_run_chief_dispatch` |
| `group_router.py` | 响应结构扩展（`pending_message`/`async`） |
| 种子数据（Chief capabilities） | Chief 的 `capabilities` 增加 `"delegate"`（对已存在 Chief 做一次数据补丁） |

### 5.2 关键接口（伪代码）

```python
# group_chat_service.py
async def post_message(self, group_id, tenant_id, user_id, content,
                       mentioned_bot_ids=None, reply_to=None) -> dict:
    group = await self.get_group(group_id, tenant_id)
    user_msg = await self._repo.add_message(group_id, "user", content,
                                        sender_user_id=user_id, reply_to=reply_to,
                                        mentioned_bot_ids=mentioned)
    if mentioned_bot_ids:
        replies = await self._dispatch_to_mentioned(...)   # 旧逻辑（定向）
        return {"user_message": user_msg.to_dict(), "replies": [r.to_dict() for r in replies], "async": False}

    if not self._check_rate_limit(user_id):
        tip = await self._repo.add_message(group_id, "bot", "⏳ 触发自主派单频率限制，请 1 分钟后再试。",
                                           sender_bot_id=group.chief_bot_id)
        return {"user_message": user_msg.to_dict(), "pending_message": tip.to_dict(), "async": False}

    lock = self._locks.setdefault(group_id, asyncio.Lock())
    if lock.locked():
        tip = await self._repo.add_message(group_id, "bot", "⏳ 上一位自主派单任务进行中，请稍候。",
                                           sender_bot_id=group.chief_bot_id)
        return {"user_message": user_msg.to_dict(), "pending_message": tip.to_dict(), "async": False}

    pending = await self._repo.add_message(group_id, "bot", "⏳ Chief 正在组织团队…",
                                            sender_bot_id=group.chief_bot_id)

    async def _run():
        async with lock:
            self._last_dispatch_at[user_id] = time.time()
            await self._run_chief_dispatch(group, tenant_id, user_id, content)

    asyncio.create_task(_run())
    return {"user_message": user_msg.to_dict(), "pending_message": pending.to_dict(), "async": True}


async def _run_chief_dispatch(self, group, tenant_id, user_id, content):
    """以 Chief 身份进入 Agent 循环，自主编排派单。"""
    chief = await self._bot_manager.get_bot(group.chief_bot_id, tenant_id)
    if chief is None:
        await self._repo.add_message(group.id, "bot", "❌ Chief 不可用。", sender_bot_id=group.chief_bot_id)
        return
    # Chief 的 Agent 循环（含 delegate 工具），工具通过 context 拿到群聊写入能力
    context = {
        "db": self._db,
        "user_id": user_id,
        "tenant_id": tenant_id,
        "group_id": group.id,
        "chief_bot_id": group.chief_bot_id,
    }
    execution = await self._bot_manager.execute_agent_task(
        chief, content, user_id=user_id, max_steps=12, context=context)
    # 最终回复写群聊（若未以【汇总】开头，加前缀）
    final = execution.final_response or "（Chief 执行完成，无文本回复）"
    if not final.startswith("【汇总】"):
        final = "【汇总】" + final
    await self._repo.add_message(group.id, "bot", final, sender_bot_id=group.chief_bot_id,
                                 task_execution_id=execution.execution_id)
```

```python
# tools/delegate_tool.py（核心）
@register_tool
class DelegateTool(BaseAgentTool):
    name = "delegate"
    description = "将子任务分派给团队专家；capability 描述所需能力，task 为子任务（可含前序结果）。无对应专家时自动创建临时专家。"

    async def execute(self, params: dict, context: dict) -> ToolResult:
        db = context["db"]; user_id = context["user_id"]; tenant_id = context["tenant_id"]
        group_id = context.get("group_id")
        capability = params["capability"]; task = params["task"]
        bm = BotManager(db)
        bot = await bm.find_bot_by_capability(capability, tenant_id, user_id)   # L1
        if bot is None:
            bot = await bm.find_or_create_temporary_expert(capability, tenant_id, user_id)  # L2
        if bot is None:
            return ToolResult(success=False, tool_name=self.name,
                              error=f"未找到/无法创建 {capability} 专家，请 Chief 直接处理")
        execution = await bm.execute_agent_task(bot, task, user_id, max_steps=4, context=context)
        result = (execution.final_response or "（无回复）")[:1500]
        # 写群聊消息（可观测）
        repo = SQLAlchemyGroupChatRepository(db)
        await repo.add_message(group_id, "bot", result, sender_bot_id=bot.id,
                               task_execution_id=execution.execution_id)
        return ToolResult(success=True, tool_name=self.name,
                           data={"bot_id": bot.id, "bot_name": bot.name, "result": result})
```

### 5.3 数据模型
- 不新增表。计划/结果/汇总均为 `ai_bot_group_messages`。

---

## 6. 前端设计

### 6.1 修改文件
- `api.ts`：`postMessage` 返回类型增加 `pending_message`/`async`。
- `GroupChatView.tsx`：发送后追加 user + pending；启动增量轮询；【汇总】停止。

### 6.2 交互
```
发送后：
  · 本地追加 用户消息 + "⏳ Chief 正在组织团队…"
  · 按钮禁用（轮询中）
  · 每 3s GET /groups/{id}/messages?limit=200
  · 增量合并（seen id 集合去重）
  · 出现【汇总】→ 停止轮询，恢复输入
```

### 6.3 轮询实现
- `useRef` 存 `seenIds: Set<number>`；`setInterval` 3s；卸载清理。
- 停止条件：出现 `content.startsWith("【汇总】")` 或连续 3 次无新消息。
- 派单中允许用户继续输入（但后端会返回"进行中"提示）。

---

## 7. 成本与安全控制

| 项 | 限制 |
|:---|:---|
| Chief 循环步数 | `max_steps=12` |
| delegate 内子任务步数 | `max_steps=4` |
| delegate 返回长度 | 截断 ≤1500 字符 |
| 动态建 Bot | 每次派单流程 ≤2 个；创建前查重 |
| 并发 | 群聊级互斥锁（同时一个派单） |
| 频率 | 同用户 1 次/分钟 |
| 安全 | 临时专家 persona 过 PromptGuard；delegate 仅 Chief 有（防递归） |
| 超时 | 异步 + 轮询，无 HTTP 超时 |

**成本估算**：Chief 循环 ≤12 次 LLM；每次 delegate 内部 ≤4 次 LLM。若 Chief 调用 3 次 delegate → 最坏 ≈ 12 + 3×4 = 24 次 LLM。可通过调小 max_steps 控制（默认 12/4）。

---

## 8. 降级链（闭环）

```
Chief execute_smart 抛异常 → 写群聊"❌ Chief 执行失败：<原因>"（流程不中断）
delegate 找不到专家 → 工具返回失败 → Chief 看到后自己兜底（用业务工具/通用能力）
delegate 内目标 Bot 执行失败 → 工具返回失败结果 → Chief 决定换策略
临时专家创建失败 → delegate 返回失败 → Chief 兜底
动态建人超限（>2） → 后续 delegate 走 L3（返回失败让 Chief 处理）
Chief 循环超步数 → 强制把已得结果作为【汇总】输出
前端轮询断连 → 消息仍由后端落库，重新打开群聊可见
后端进程重启 → 已落库消息保留；进行中派单丢失（用户可重发）
```

---

## 9. 测试计划

### 后端 pytest（`tests/api/test_autodispatch_api.py`）
1. `test_delegate_l1_existing_bot`：mock 规划由 Chief 循环完成，delegate 命中现有专家
2. `test_delegate_l2_create_temporary_expert`：无匹配 → 创建临时专家（断言 org/模板 persona）
3. `test_delegate_l3_fallback`：创建失败 → delegate 返回失败，Chief 兜底
4. `test_chief_loop_writes_messages`：mock execute_agent_task 返回步骤 → 群聊出现计划/结果/汇总消息
5. `test_post_message_async`：未 @ 返回 `pending_message` + `async:true`
6. `test_concurrent_lock`：并发发言第二次返回"进行中"
7. `test_rate_limit`：同用户 1 分钟第二次触发限流
8. `test_mention_legacy_path`：@ 定向仍走旧逻辑
9. `test_chief_failure_fallback`：execute_agent_task 抛异常 → 群聊出现 ❌ 消息

### 前端 vitest
- `postMessage` 返回 `pending_message`/`async`
- `GroupChatView` 轮询增量合并、【汇总】停止

### 回归
- tsc 0 错误；pytest 全绿；vitest 全绿；Playwright 实测（含无对应专家场景）

---

## 10. 实施任务清单（按依赖顺序）

1. **后端工具**
   - [ ] `bot_manager.py`：`find_bot_by_capability`、`find_or_create_temporary_expert`、`create_temporary_expert`
   - [ ] `tools/delegate_tool.py` 实现并注册
   - [ ] Chief 种子数据 capabilities 增加 `delegate`（含现有 Chief 数据补丁）
2. **群聊异步派单**
   - [ ] `group_chat_service.post_message` 异步化 + 互斥锁 + 限流 + `_run_chief_dispatch`
   - [ ] `group_router.py` 响应结构扩展
3. **后端测试**（9 用例）通过
4. **前端**
   - [ ] `api.ts` 类型更新
   - [ ] `GroupChatView.tsx` 轮询改造
5. **前端测试** 通过
6. **回归实测**
   - [ ] tsc 0、pytest 全绿、vitest 全绿
   - [ ] Playwright 实测：输入任务（含无对应专家场景）→ 群聊出现计划/各专家结果/临时专家/【汇总】

---

## 11. 验收标准

1. 用户输入任务不 @，群聊自动出现：⏳ 组织团队 →【派单计划】→ 各专家结果（含依赖传递）→【汇总】。
2. "毒理学评估"等无现成专家任务 → 自动创建「毒理专家」（org 共享）并执行，团队可复用。
3. 前一步结果影响后续步骤（如安全专家审查的是配方专家的实际输出，而非原始问题文本）。
4. 同一群聊并发发言 → 第二次收到"进行中"提示。
5. 前端无超时，轮询正确停止，过程消息逐条可见。
6. 回归门禁全绿。

---

## 12. 风险与对策

| 风险 | 对策 |
|:---|:---|
| Chief 循环内 LLM 不调用 delegate 而自己硬干 | system prompt 明确要求；工具集含 delegate + 业务工具，允许混合但倾向派单 |
| 上下文爆炸（多次 delegate 结果） | 每次结果截断 1500；max_steps=12 限制循环 |
| 临时专家质量 | 模板 persona + PromptGuard；用户可后续编辑 |
| 动态建人导致团队膨胀 | 查重 + 每次 ≤2 |
| LLM 不稳定 | 降级链闭环；错误可见 |
| 内存锁/限流重启丢失 | 可接受（单实例），后续可迁移 Redis |
| 嵌套 Agent 递归 | delegate 仅 Chief 注册；目标 Bot 无 delegate 工具 |

---

## 13. 已确认决策（用户按推荐）
1. 临时专家**保留在团队**（可复用、可删除）。
2. 自主派单触发方式：**未 @ 即自动触发**。
3. 子任务上限：不再硬性固定，由 Chief 循环步数自然控制（max_steps=12）。
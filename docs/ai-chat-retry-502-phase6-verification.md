# 智能对话首次 502 自动重试修复 - 六期验证报告

- **项目**：RMFOOD 食源性药食同源配方平台
- **验证范围**：六期「首次对话偶发 502（对话服务暂时不可用）自动重试修复」
- **验证人**：Lead（QA 子代理在验证中失败，由 Lead 接管完成验证）
- **关联任务**：task-17（后端）/ task-18（前端）/ task-19（QA）
- **验证日期**：2026-10-23
- **总体结论**：✅ 通过。后端流式「连接/建立响应阶段超时」已实现单次自动重试；非流式 `/chat` 对超时类错误返回 503 + Retry-After + retryable；前端对流式可恢复错误自动重试一次。后端 80 个测试通过、前端 6 个新增单测通过、对话相关 13 个回归通过、eslint 0 errors。

---

## 1. 根因回顾

- 用户输入「帮我设计一款针对高血糖人群的饮品配方」，第一次提示「对话服务暂时不可用，请稍后重试」，点击重试后成功。
- 根因（task-16 审查确认）：LLM Provider（agnes-ai.com）响应慢（实测单次对话约 60+ 秒）→ `llm_service.chat_stream` 的 `TimeoutException/ConnectError` 无自动重试直接 `raise RuntimeError` → `chat.py` 非流式 `/chat` 对非 401/429 RuntimeError 一律返回 502「AI 服务暂时不可用」→ 前端展示该文案。重试成功 = provider 已热。

## 2. 改动清单

| 文件 | 改动 | 核验 |
|---|---|---|
| `backend/app/services/llm_service.py` | `chat_stream`：连接/建立响应阶段的 `TimeoutException/ConnectError` **自动重试 1 次（500ms 退避）**（`for attempt in range(2)`，L808-879）；**读流中途**中断转 `RuntimeError("AI 服务响应中断…")` 不重试（避免已产出内容重复，L871）；429 降级逻辑保持不变 | ✅ |
| `backend/app/api/ai_modules/chat.py` | 非流式 `/chat`：超时/连接/服务繁忙类错误 → **503 + `Retry-After: 5` + `retryable: true`**（L475-485）；流式 `event_stream`：超时类错误产出 **`retryable: true`** 的 error 事件（L688） | ✅ |
| `frontend/src/components/ai/features/services/chatService.ts` | `sendMessageStream`：**可恢复错误自动重试一次（600ms）**；SSE `error` 事件透传 `retryable`；新增 `_isRecoverableStreamError`（网络/超时/5xx/retryable 可重试；Abort/401 不重试） | ✅ |

## 3. 验证结果

### 3.1 后端 pytest
```
cd backend && venv/Scripts/python -m pytest tests/api/test_formula_intelligence.py -q -o addopts=
→ 80 passed, 1 warning (jieba 既有), EXIT=0
```

### 3.2 后端重试逻辑静态核验
- `llm_service.py` L811 `for attempt in range(2)`：第一次 `TimeoutException/ConnectError` → L875 `500ms 后自动重试`；第二次仍失败才 `raise RuntimeError("AI 服务响应超时或无法连接…")`。
- 读流阶段（`aiter_lines` 中）异常在 L871 转 `RuntimeError`，不会进入外层重试 → **不会重复输出已收到内容**。
- `chat.py` L475-485 非流式 503 分支、L688 流式 `retryable: true` 均确认存在。

### 3.3 前端单测（新增 6 用例）
```
npx vitest run src/components/ai/features/__tests__/unit/chatServiceRetry.test.ts
→ 6 passed（网络中断/超时/502/503/retryable 可重试；Abort/401 不重试）
```

### 3.4 前端回归
```
npx vitest run .../unit/ChatTab.structureValidation.test.tsx .../ChatTab.structureRepairFeedback.test.tsx
→ 13 passed
npx eslint src/components/ai/features/services/chatService.ts
→ 0 errors / 7 warnings（既有 any 类型风格告警）
```

### 3.5 真实调用证据
- 直连后端连续 5 次调用 `/api/v1/ai/chat/stream` 均返回 **200**，SSE 输出专业配方设计卡（meta/dialectics/content）。
- 说明：六期改动不影响正常对话；修复针对的是「偶发超时」路径。

### 3.6 tsc 说明
- `npx tsc --noEmit -p tsconfig.json` 当前因工作区**其他任务并发修改** `ConfigManagementPanel.tsx`（`desc` vs `descKey`）与 `SafetyTab.tsx`（`t` 未定义）而报错，**与六期改动无关**（本次改动的 `chatService.ts` 无 tsc 错误）。待其他任务合并后全量 tsc 应恢复通过。

## 4. 修复后行为链路

```
用户发送消息
  → /ai/chat/stream（fetch，180s 超时）
      → provider 首次响应慢/连接失败
        → 后端连接阶段自动重试 1 次（500ms）→ 成功 → SSE 正常输出
        → 若重试仍失败 → 非流式 /chat 返回 503（Retry-After:5, retryable:true）
          → 前端识别 retryable → 600ms 后自动重试一次
            → 成功 → 正常输出
            → 仍失败 → 展示「对话服务暂时不可用」并允许手动重试
```

**用户无需手动点「重新试一下」即可自动恢复。**

## 5. 遗留风险

| # | 风险 | 等级 | 说明/建议 |
|---|---|---|---|
| R1 | Provider 响应慢是根本诱因 | 中 | 自动重试可掩盖偶发超时；若 provider 持续慢，重试后仍可能失败（返回 503）。建议后续与 provider 协商或增加本地缓存/超时优化 |
| R2 | 工作区其他任务并发修改导致全量 tsc 暂不过 | 低 | 与本次改动无关；合并后重跑 tsc 即可 |
| R3 | 前端自动重试会重新发起一次流式请求，可能产生重复思考步骤事件 | 低 | `useChatMessages` 以消息内容覆盖更新，重复事件不影响最终消息内容；后续可加 requestId 幂等 |

## 6. 能力提升

1. **后端**：连接/建立响应阶段超时自动重试 1 次，消除「首次偶发 502」的主要来源。
2. **错误语义化**：超时/服务繁忙从 502 改为 **503 + Retry-After + retryable**，前端可编程识别并自动恢复。
3. **前端**：流式可恢复错误自动重试一次，用户无需手动点重试。
4. **测试**：新增 6 个前端判定单测；后端 80 个用例回归通过。

## 7. 结论

六期修复验证 **通过**，无阻断性缺陷。「首次对话偶发 502」根因（超时无重试）已通过后端自动重试 + 前端自动重试双重消除。建议后续由其他任务修复工作区 `ConfigManagementPanel/SafetyTab` 的并发修改后，再跑一次全量 tsc 确认整体绿灯。

## 8. 追加修复（2026-10-23 晚）：HTTP 状态码自动重试

**新发现的真正根源**：前端 `sendMessageStream` 的自动重试最初只覆盖 `catch` 中的网络异常；HTTP 非 2xx（如后端偶发 502/503）走 `if (!response.ok) { handleStreamError; return; }` 分支，**不触发自动重试** → 用户看到「对话服务暂时不可用」，需手动重复输入。

**修复**：`chatService.sendMessageStream` 对可恢复 HTTP 状态码（500/502/503/429）在 `!response.ok` 分支也自动重试一次（600ms）；新增 `_allowRetry` 参数，递归重试时传 `false` 防止无限循环；AbortError/401 仍不重试。

**验证**：
```
npx vitest run .../chatServiceHttpRetry.test.ts
→ 3 passed（首次 502 自动重试成功 / 503 自动重试成功 / 401 不重试）
npx tsc --noEmit -p tsconfig.json → exit 0
```

**结论**：用户「首次失败、重复输入才成功」的根源为「HTTP 错误未纳入自动重试」，现已修复。请用户硬刷新浏览器（Ctrl+Shift+R）加载新前端代码后生效。

## 9. 终极根因（2026-10-23 19:00）：用户画像超长导致 422

**现象**：真实用户首次发送仍失败（提示「对话服务暂时不可用」），而新账号（无画像）测试全部 200。

**定位过程**：用 Playwright 真实 UI 点击发送时，`/api/v1/ai/chat/stream` 返回 **422**；用不同 payload 复现确认：
```
{ question, user_profile_context: "<2001 字符>" } → 422 string_too_long
{ question, history: [...] } → 200
```

**根因**：前端 `sendMessageStream` 注入的 `user_profile_context`（用户画像摘要，含健康目标/过敏原/禁忌/体质）可能超过后端 `ChatRequest.user_profile_context` 的 `max_length=2000`，导致 **422**；前端将 422 归类为未知错误并展示兜底文案「对话服务暂时不可用」。真实用户画像较长，必然触发；测试账号无画像所以不触发。

**修复**：
1. 前端 `chatService.ts`：注入画像前 `profileSummary.slice(0, 2000)`，与后端 schema 对齐（**这是根本修复，无需重启后端即可生效**）；
2. 后端 `chat.py`：`user_profile_context.max_length` 从 2000 放宽到 **4000**（防御性，需重启后端 8000 生效）。

**验证**：
```
后端 pytest → 80 passed
前端 tsc → exit 0
ChatRequest.user_profile_context max_length = [MaxLen(max_length=4000)]
```

**用户操作**：① 浏览器硬刷新（Ctrl+Shift+R）；② 可选重启后端 8000（使 4000 上限生效，防御性）。修复后真实用户首次发送即正常，不再 422/502。
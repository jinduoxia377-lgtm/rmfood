# 智能对话裸 JSON 紧急排查报告

- **日期**：2026-10-25
- **审查人**：QA 验证工程师（qa-phase4）
- **关联任务**：task-37（紧急处理：智能对话输出裸 JSON 且持续报错）
- **现象**：用户反馈 `/ai` 智能对话输出显示为裸 JSON（未渲染为专业配方卡）且持续报错。
- **结论**：**当前生成链路正常，裸 JSON 来自历史会话中一条 4096 截断时代遗留的不完整 JSON 消息**。非当前代码缺陷，非 max_tokens 未生效。

---

## 1. 排查过程与证据

### 1.1 后端 max_tokens 已生效（16:37 重启后）

- 数据库复查：`SystemConfig(llm_runtime_config)` max_tokens=**16000**；`ai_model_configs` 表 7 条全部 **16000**。
- 直连 `llm_service.chat_stream`（真实 Provider agnes-3.0-flash）：`config max_tokens: 16000`，输出 **7360 字符**，JSON 完整可解析（13 个 blocks），无截断。

### 1.2 真实 HTTP 流式端点输出正常

用 curl + 登录 token 调用 `POST /api/v1/ai/chat/stream`（问题：帮我设计一款针对高血糖人群的饮品配方）：

```
STATUS: 200
CONTENT_TOTAL_CHARS: 7602
ERROR_EVENTS: 无
JSON_PARSE: OK blocks: 12
BLOCK_TYPES: header, data-table, metrics, ingredient-detail×3, synergy-chart, timeline, list, callout×2, list
TAIL: ... ``` > 以上配方为药食同源辅助调理饮品... > ⚠️ 内容安全提示...
```

- 后端经过 dialectics + check_output + _append_dosage_warnings 全链路后，**输出仍是完整 JSON**，无 error 事件，[DONE] 正常结束。

### 1.3 Playwright 前端实测：新消息渲染为专业配方卡

- 登录 botuser_08cc36a7 → /ai → 发送「帮我设计一款针对高血糖人群的饮品配方」：
  - `STREAM_RESPONSE_STATUS: 200`
  - 页面最终渲染：**专业配方卡**（「稳糖舒润饮」配方组成 5 行、制备建议等），`BODY_HAS_RAW_JSON_blocks: false`。
  - 无 pageerror；console 无错误（仅有历史消息处理产生的 detectStructured warn/debug 日志与一条 401 资源错误）。

### 1.4 裸 JSON 来自历史遗留消息

从 localStorage（`rmfood_chat_history_v2`）导出历史会话消息，用 node 复刻 `detectStructuredContent` + `extractStructuredFallback` 逻辑逐条测试：

| 消息 | 角色/长度 | detect | fallback | 结论 |
|---|---|---|---|---|
| MSG 3（assistant, 661 字符） | ```json { "配方名称": "稳糖舒润饮", ..., "原料": "赤藓糖醇**（截断）** | NULL | **NULL** | **裸 JSON 元凶**：JSON 不完整，parse 失败 |
| MSG 5 / 9 / 11（assistant, 1005/1005/1016 字符） | 完整旧格式 JSON（配方名称/配方组分/安全与禁忌/合规说明） | NULL（无 blocks 键） | **legacy 转换成功（5 blocks）** | 渲染为配方卡，不显示裸 JSON |
| 用户消息/空消息 | — | NULL | NULL | 正常（非结构化/空） |

- 页面 DOM 也证实：历史会话中 23:21 消息显示为裸 JSON +「修复为结构化配方」按钮；23:26 消息（完整旧格式 JSON）显示为配方卡。
- **根因**：MSG 3 是 max_tokens=4096 截断时代生成并保存的**残缺 JSON**（尾部在「赤藓糖醇」处被截断），`JSON.parse` 失败 → `detectStructuredContent` 与 `extractStructuredFallback` 均返回 null → `MessageBubble` 回退渲染原始 JSON 文本 → 用户看到裸 JSON。

### 1.5 持续报错来源

- 该历史消息每次恢复都会触发 `detectStructured` warn/debug 日志（非用户可见）。
- 用户点击「修复为结构化配方」按钮依赖 `repair-structured` API（LLM 429 时失败并提示），在 Provider 持续 429 期间可能反复报错。

---

## 2. 结论

| 项目 | 结论 |
|---|---|
| 后端 max_tokens | ✅ 已生效（16000），输出完整 |
| Provider 输出 | ✅ 完整 JSON，无截断 |
| 当前新消息渲染 | ✅ 正常渲染为专业配方卡 |
| 裸 JSON 来源 | ❌ **历史遗留的不完整 JSON 消息**（4096 时代残缺数据） |
| 是否代码缺陷 | 否（当前代码链路正常；历史数据无法被解析是数据问题） |

## 3. 修复建议（不实施，供决策）

1. **历史残缺消息优雅降级（推荐，P1）**：在 `MessageBubble`/`ChatMessages` 中，当 assistant 消息内容为 JSON 代码块但 `detectStructuredContent` 与 `extractStructuredFallback` 均失败时，显示「该历史消息格式不完整」提示 + 「重新生成/删除」操作，**不再裸显示 JSON**。
2. **清理历史残缺消息（运维，P1）**：可提供一次性脚本清理 `rmfood_chat_history_v2` 中 `content` 以 ```json 开头但 JSON.parse 失败的消息（或标记为 `format: 'broken'`）。
3. **修复按钮保持**：「修复为结构化配方」对完整旧格式 JSON 已可自动转换；残缺 JSON 的修复依赖 LLM，429 期间提示更友好文案。

## 4. 验证环境

- 后端：8000 端口（已重启加载 16000），数据库本地 PostgreSQL
- 前端：localhost:3000（vite dev），Playwright chromium headless
- 工具：curl / httpx / node 脚本 / Playwright（console、pageerror、network、localStorage 导出）
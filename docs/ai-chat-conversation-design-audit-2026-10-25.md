# /ai 智能对话「对话设计」专项审查报告

- **审查对象**：RMFOOD `/ai` 智能对话「对话设计」（发送→流式→配方卡、历史会话、输出协议、异常降级）
- **审查方式**：只读代码审查 + 运行验证（后端 pytest / 前端 tsc / vitest），未修改任何业务代码
- **审查人**：QA 验证工程师（qa-phase4）
- **关联任务**：task-33（专项审查：/ai 智能对话「对话设计」全面审查）
- **审查日期**：2026-10-25
- **审查结论**：**B（良好）**。核心链路（发送→流式→结束→配方卡渲染）完整顺畅；输出协议三方一致、旧格式兼容覆盖充分；异常降级设计整体合理且具备来源徽标。**无 P0 问题**。存在 **1 项 P1**（非流式规则引擎降级未标注来源，`model: None` 导致前端无法显示降级徽标）与 **1 项外部 P1**（工作区并发修改导致 `src/api/ai.ts` 两处 tsc 类型错误，与对话设计代码无关）。另有若干 P2 改进建议。

---

## 1. 交互与流程设计审查

### 1.1 发送 → 流式 → 结束 → 配方卡渲染链路

链路各环节代码路径：

| 环节 | 实现 | 证据 |
|---|---|---|
| 发送 | `ChatTab.handleSend` → `useChatSendMessage.handleSendMessage`：NLP 意图识别 → 多轮指代消解 → RAG 增强 → 配方意图检测注入简短结构化指令 | `useChatSendMessage.ts` L61-137 |
| 流式 | `useChatMessages.sendMessage` → `chatService.sendMessageStream`：fetch + ReadableStream 逐行解析 SSE（content/step/meta/dialectics/formula/error/done） | `chatService.ts` L350-456；`useChatMessages.ts` L238-326 |
| 结束 | SSE `[DONE]` → `stateMachine.transition(Success)` → `updateMessage` 写入完整内容、formulas、model、dialectics | `chatService.ts` L458；`useChatMessages.ts` L320-325 |
| 配方卡渲染 | `MessageBubble` 优先 `detectStructuredContent(msg.content)`，失败走 `extractStructuredFallback`，最终 `StructuredMessageRenderer` 渲染 blocks | `MessageBubble.tsx` L342-344；`structured/utils.ts` L61-159、L170-238 |
| 配方卡保存 | `handleStructureSave`：`detectStructuredContent` → `extractFormulaFromContent` → 机理摘要/监测/参考文献写入 payload → `validateAiFormula` 校验后保存 | `ChatTab.tsx` L186-248 |

结论：✅ **链路完整顺畅**。流式结束后用完整内容做结构化解析生成最终配方（`useChatMessages.ts` L374-378），避免轻量片段与最终保存不一致。

### 1.2 暂停 / 恢复 / 停止 / 重试 / 降级提示

| 能力 | 实现 | 证据 |
|---|---|---|
| 暂停 | 暂停条按钮 `pauseStreaming` → `chatService.abortCurrentStream()` 真正中止 SSE | `ChatTab.tsx` L562-575；`useChatMessages.ts` L477-483 |
| 恢复 | 消息气泡「继续生成」按钮 `onResumeStreaming` → `resumeStreaming` → 用最后问题**重新发送** | `MemoizedChatMessage.tsx` L1170-1181；`useChatMessages.ts` L485-495 |
| 停止 | `ChatInputPro.onStop` → `pauseStreaming()` | `ChatTab.tsx` L580 |
| 重试 | 错误提示卡「重试」按钮 `handleRetry`；`ChatMessages.onRetry` | `ChatTab.tsx` L470、L493 |
| 降级提示 | 后端流式规则引擎降级发 `meta` 事件 `model: "rule-engine-fallback"`；前端 `MessageBubble.ModelSourceBadge` 显示「大模型不可用，以下由本地配方引擎生成，非大模型推理」；`dialectics.engine === 'rule_engine_fallback'` 额外显示「规则引擎降级」标签 | `chat.py` L671-677；`MessageBubble.tsx` L44-88、L447-448 |

结论：✅ 暂停/停止/重试/降级提示均有清晰 UI。⚠️ 注意点：**「暂停/恢复」语义为「中止当前流 + 重新发送最后问题」**，并非从断点继续（见 P2-1）。

### 1.3 历史会话（本地持久化 + 云端同步 + 刷新恢复）

| 能力 | 实现 | 证据 |
|---|---|---|
| 本地主存储 | IndexedDB（不可用时降级 localStorage，并自动迁移旧 localStorage 数据） | `chatHistoryStorage.ts` L13-61、L241-275 |
| 云端同步 | `saveToStorage` 写入 IndexedDB 后防抖 2s 调用 `syncToServer`（登录后可从服务器恢复） | `useChatMessages.ts` L139-158 |
| 会话管理 | `useChatSessions`/`SessionSidebar`：新建、切换、**重命名**、**删除**、导出、置顶、标签；`ChatHistory` 组件提供历史侧栏 | `useChatSessions.ts` L281-302；`SessionSidebar.tsx` L232、L655-660；`ChatHistory.tsx` L4 |
| 刷新恢复 | 消息写入 IndexedDB + 服务器备份，刷新后从隔离存储恢复 | `useChatMessages.ts` L137-170、L220 |

结论：✅ 历史会话入口可达（`ChatTab.tsx` L398-400 侧栏），命名/删除可用（含空标题拒绝重命名测试）。

---

## 2. 输出协议设计审查

### 2.1 三方协议一致性

| 协议源 | blocks 类型集合 | data-table 列 | 证据 |
|---|---|---|---|
| 后端 `default.yaml` academician | header / data-table / metrics / ingredient-detail / synergy-chart / timeline / list(SOP number、参考文献 analysis) / callout(warning+info) | role/name/dosage/nature_flavor/active_compound/mechanism | `default.yaml` L44-59、L61-68 |
| 后端 `_REPAIR_SYSTEM_PROMPT` | 与 default.yaml 完全一致（含全部块类型与 6 列） | 同上 | `formula_intelligence.py` L948-976 |
| 前端渲染端 `detectStructuredContent` 白名单 | header/data-table/chart/list/callout/metrics/divider/ingredient-detail/synergy-chart/timeline（覆盖后端全部类型） | DataTableBlock 按 columns 动态渲染，6 列自动支持 | `structured/utils.ts` L130-134；`BlockRegistry.tsx` L24-35；`DataTableBlock.tsx` L176-231 |
| 前端 `useChatSendMessage` 结构化指令 | 仅注入简短指令「请以专业配方设计卡格式输出…」，完整协议由后端 system prompt 承载（避免 question 超长触发 422） | — | `useChatSendMessage.ts` L121-133 |

结论：✅ **协议一致**。后端主提示词与修复提示词块类型/字段完全一致；前端渲染端白名单覆盖后端全部类型；前端发送指令为轻量引用，避免重复大 JSON 导致 422。

### 2.2 旧格式 JSON 兼容（extractStructuredFallback / convertLegacyFormulaBlocks）

- `extractStructuredFallback`：不要求 JSON 在开头；对 block type 做白名单过滤而非整体拒绝；标准 blocks 解析失败后走旧格式转换。
- `convertLegacyFormulaBlocks` 兼容键名（`utils.ts` L245-267）：
  - 名称：`配方名称` / `product_name` / `name` / `方案名称`
  - 组成：`配方组分` / `主配方_单人份_500ml水` / `主配方` / `配料表` / `配方成分` / `成分列表` / `成分` / `原料组成` / `材料` / `用料表` / `组分列表` / `ingredients` / `components` / `composition` / `raw_materials` / `herbal_components`
  - 步骤/禁忌/合规/特殊人群/每日用量/冲突说明等中英文键均覆盖
- `parseIngredientRows` 兼容数组（中英文键：`角色/role/君臣佐使`、`原料/成分/name/ingredient`、`剂量/用量/dosage/amount`）与字符串（多行「原料 用量」文本，支持 `黄芪 10g` / `黄芪：10g` / `黄芪10g` 形态）（`utils.ts` L351-383）。

结论：✅ 旧格式覆盖充分。测试 `formulaStructuredFallback.test.ts` 9 个用例覆盖标准 blocks、前后说明文字、未知块过滤、英文键、中文键、`主配方_单人份_500ml水` 字符串配料表、`配方成分/健康目标/核心原理` 等变体。

### 2.3 data-table 专业六列

- 后端协议强制 data-table 每行必须有 role/name/dosage，掌握时填入 nature_flavor/active_compound/mechanism（`default.yaml` L63）。
- 前端 DataTableBlock 动态渲染 columns，6 列自动支持（含 role tag、dosage number 对齐）（`DataTableBlock.tsx` L82-118、L176-231）。
- 旧格式转换：检测到行中含 `nature_flavor`/`active_compound`/`mechanism` 任一字段时自动使用**专业六列**，否则降级为三列（`utils.ts` L289-307）。

结论：✅ 专业六列展示能力就绪，旧格式转换可自动升级为六列。

---

## 3. 异常与降级设计审查

### 3.1 LLM 429 限流 → 降级链路

| 层级 | 行为 | 证据 |
|---|---|---|
| LLM 服务层 | `chat_stream` 遇 429 → 降级调用非流式 `chat` → `_split_text_into_chunks` 切分 yield（模拟 SSE 分片） | `llm_service.py` L832-846 |
| 非流式也失败 | 抛 `RuntimeError("API 频率限制...非流式降级失败")` | `llm_service.py` L842-846 |
| API 层 | 流式 `event_stream` 捕获 RuntimeError，429 映射为 `RATE_LIMITED` error 事件（`retry_after: 30`，**不带** retryable） | `chat.py` L763-768 |
| 前端 | SSE error 事件无 `retryable:true` → `_isRecoverableStreamError` 返回 false → 不自动重试，显示错误 | `chatService.ts` L390-393、L494-511 |

结论：✅ 429 链路合理（限流不自动重试，避免加重限流）。⚠️ 注意：**429 并不会降级到规则引擎**——规则引擎仅在 LLM 完全不可用（`is_available=False`）时启用（`chat.py` L667-677）。

### 3.2 规则引擎降级是否明确提示

- 流式路径：LLM 不可用 → `thinking_stream` 发送 `meta` 事件 `model: "rule-engine-fallback"` + `reason`（`chat.py` L671-677）→ 前端 `MessageBubble.ModelSourceBadge` 显示「大模型不可用，以下由本地配方引擎生成，非大模型推理」（`MessageBubble.tsx` L57-68）。✅ **提示明确**。
- 非流式路径：LLM 不可用 → thinking_engine 规则引擎，但返回 `"model": None`（`chat.py` L430-438）→ 前端 `response.model` 为 undefined，**无法显示降级徽标**。❌ **存在来源标注缺口（P1-1）**。
- 规则引擎输出内容本身无内嵌水印，复制后降级来源丢失（P2-3）。

### 3.3 502/503/429/422 自动重试链路

| 通道 | 覆盖 | 证据 |
|---|---|---|
| 非流式 HTTP | `executeWithRetry` 对 `[500, 502, 503, 429, 422]` 自动重试一次（422 为画像超长等可自愈参数问题，重试时以截断画像重发） | `chatService.ts` L334-336；`chatServiceHttpRetry.test.ts` L90-94 |
| 流式 SSE | `_isRecoverableStreamError`：网络/超时/5xx（502/503/500）/后端 `retryable:true` → 600ms 后自动重试一次 | `chatService.ts` L473-484、L494-511；`chatServiceRetry.test.ts` 6 用例 |
| 后端 503 | 非流式超时/连接/服务繁忙 → HTTP 503 + `Retry-After:5` + `retryable:true`；流式 → `STREAM_RETRYABLE` error 事件 `retryable:true` | `chat.py` L542-554、L769-776 |

结论：✅ 502/503/429/422 自动重试链路完整（429 流式不自动重试、非流式 429 会重试一次）。

### 3.4 认证失败是否阻止非流式降级

- 前端流式失败后：`isStreamAuthError`（401/认证/Token/未授权/未登录）→ **跳过非流式降级**（同样会认证失败），清理占位消息（`useChatMessages.ts` L330-337）。
- `_isRecoverableStreamError`：401/认证/Token/未授权 → 不自动重试（`chatService.ts` L497）。
- 后端：401 映射为 `API_KEY_INVALID` error 事件（`chat.py` L757-762）。

结论：✅ 认证失败不会触发非流式降级，避免双重失败与误导。

### 3.5 规则引擎降级是否会误导用户

- 流式降级有明确徽标（`rule-engine-fallback`），不会冒充大模型 ✅。
- 非流式降级 `model: None` 无徽标 ❌（P1-1）。
- 规则引擎输出内容本身无「非大模型生成」水印，复制/分享后来源不可见（P2-3）。
- 前端 `llmAvailable=false` 时跳过 NLP/RAG/配方意图检测等预处理，避免污染规则引擎（`useChatSendMessage.ts` L71-76）✅。

---

## 4. 运行验证

| 命令 | 结果 | 结论 |
|---|---|---|
| `cd backend && venv/Scripts/python -m pytest tests/api/test_formula_intelligence.py -q -o addopts=` | **80 passed**, 1 warning（jieba 既有），EXIT=0 | ✅ 与预期一致 |
| `cd frontend && npx vitest run .../formulaStructuredFallback.test.ts .../chatServiceRetry.test.ts` | **15 passed**（9 + 6），EXIT=0 | ✅ 与预期一致 |
| `cd frontend && npx tsc --noEmit -p tsconfig.json` | **EXIT=2**，2 个错误均在 `src/api/ai.ts`（L551 类型不匹配、L668 索引签名），属于 GenerateTab 候选归一化代码 | ⚠️ 外部并发修改（git status 确认 `src/api/ai.ts` 处于已修改状态），**与对话设计代码无关** |

补充说明：
- 后端 pytest 覆盖 `TestEnrichIngredientsWithFoodMaterial`（五期）、`TestProfessionalFormulaProtocol`（四期）等 80 个用例，全部通过。
- 前端两个测试文件分别覆盖旧格式 JSON 兜底转换与流式可恢复错误识别，全部通过。
- **未执行 Playwright 实测**：当前环境 LLM Provider 持续 429（Lead 已确认），硬等会长时间阻塞；本次以代码路径审查 + 单测覆盖替代，429 降级行为已在 3.1/3.2 节基于代码路径与历史实测记录。

---

## 5. 问题清单（P0 / P1 / P2）

### P0（严重，立即修复）

**无。**

### P1（重要，应修复）

| 编号 | 问题 | 证据 | 影响 |
|---|---|---|---|
| P1-1 | **非流式规则引擎降级未标注来源**：`/chat` LLM 不可用时走 thinking_engine，但返回 `"model": None`，前端 `response.model` 为 undefined，`ModelSourceBadge` 无法显示「规则引擎降级」徽标（流式路径已标注 `rule-engine-fallback`，非流式未对齐） | `chat.py` L430-438（`"model": None`）；`MessageBubble.tsx` L44-88 依赖 `model === 'rule-engine-fallback'` | 非流式降级输出被用户误认为大模型推理，违背「不能让规则引擎冒充大模型」的能力真实性底线 |
| P1-2 | **tsc 全量检查失败（外部）**：`src/api/ai.ts` L551 / L668 两处类型错误，当前工作区该文件处于并发修改状态 | `npx tsc` EXIT=2；git status 显示 `M frontend/src/api/ai.ts` | 影响前端类型检查/CI；与对话设计代码无关，但需相关任务修复后 tsc 才能全绿 |

### P2（建议改进）

| 编号 | 问题 | 证据 | 建议 |
|---|---|---|---|
| P2-1 | 「暂停/恢复」语义为「中止流 + 重新发送最后问题」，并非从断点继续，可能产生重复内容 | `useChatMessages.ts` L477-495（`resumeStreaming` 调用 `sendMessage(lastQuestion)`）；UI 文案「继续生成」 | 将 UI 文案改为「重新生成」或在恢复前提示「将从开头重新生成」；若需真断点续传需后端支持 |
| P2-2 | 流式 429 错误事件无 `retryable` 且无 `Retry-After` 倒计时 UI，用户只能手动稍后再试 | `chat.py` L763-768（`RATE_LIMITED` 无 retryable）；`chatService.ts` L390-393 | 前端可解析 `retry_after` 展示倒计时或提供「30 秒后重试」按钮 |
| P2-3 | 规则引擎降级输出内容本身无内嵌水印，复制/分享后降级来源丢失 | `thinking_engine` 输出文本无降级标记；仅消息外部徽标（`MessageBubble.tsx` L57-68） | 在规则引擎回复内容开头/结尾追加一行「（本回复由本地规则引擎生成，非大模型推理）」 |
| P2-4 | 旧格式转换在无专业字段时降级为三列（role/name/dosage），用户可能看不到六列 | `utils.ts` L289-307 | 可对旧格式中缺失的专业列显示「—」占位而非隐藏列，保持六列一致观感（可选） |
| P2-5 | 暂停后 `isPaused` 状态与「继续」按钮仅在气泡操作栏，入口较深 | `MemoizedChatMessage.tsx` L1170-1181 | 可在暂停条上同时提供「继续」与「停止」按钮（当前暂停条仅有暂停按钮） |

---

## 6. 修复建议（不实施）

1. **P1-1**：`backend/app/api/ai_modules/chat.py` 非流式规则引擎降级返回 `"model": "rule-engine-fallback"`（与流式 `L673` 一致），并补一条断言测试。
2. **P1-2**：由 GenerateTab/API 层任务修复 `src/api/ai.ts` 两处类型错误（L551 将 `c.compliance_status as string` 断言为联合类型；L668 修正索引签名），修复后重跑 tsc。
3. **P2-1**：调整暂停/恢复 UI 文案为「重新生成」，避免用户预期「断点续传」。
4. **P2-2**：前端解析 `retry_after` 提供倒计时重试按钮。
5. **P2-3**：thinking_engine 输出内容追加一行降级来源说明（或前端在 `model=rule-engine-fallback` 时把徽标文案并入可复制内容）。
6. **P2-4/5**：按需优化六列占位与暂停条交互。

---

## 7. 遗留风险

| 风险 | 说明 |
|---|---|
| Provider 持续 429 限流 | LLM Provider（agnes-3.0-flash）持续 429 会频繁触发非流式降级/错误事件，用户实际看到「规则引擎降级」或「请求过于频繁」的概率高；**属外部 Provider 状态，非代码缺陷**，需更换/扩容 Provider 或降低调用频率 |
| 非流式降级来源缺口 | 在 P1-1 修复前，非流式规则引擎输出无来源徽标，存在误导可能 |
| tsc 外部错误 | `src/api/ai.ts` 并发修改导致的类型错误未修复前，前端全量类型检查不通过 |
| 暂停/恢复语义 | 恢复为重新生成，多轮场景可能产生内容不一致 |

---

## 8. 审查结论

对话设计当前等级：**B（良好）**。

核心交互链路（发送→流式→配方卡渲染→保存）、历史会话（IndexedDB+localStorage+云端同步+刷新恢复）、输出协议三方一致性、旧格式 JSON 兼容、异常降级与自动重试设计均已就绪且测试通过。无 P0。需跟进 2 项 P1（非流式降级来源标注、外部 tsc 类型错误）与若干 P2 改进。整体具备上线条件，建议在 P1-1 修复后补一次回归验证。
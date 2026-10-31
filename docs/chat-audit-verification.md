# 智能对话审计报告核实结论与专业方案

- **日期**：2026-10-24
- **审计来源**：`CHAT_PAGE_AUDIT_REPORT.md`（第三方智囊团，76/100）
- **核实方式**：Lead 结合近期代码变更（六期 502/422 修复、认证检测修复、头像同步等）对报告逐条核验

---

## 一、报告是否属实？

**总体：基本属实。** 但有一处重要不准确，且部分缺陷已在近期修复中消除。

| 报告论断 | 核实结果 | 说明 |
|---|---|---|
| P0-1 RAG 知识库与对话上下文割裂 | 🟡 **部分属实** | 用户上传的 RAG 文档（RAGKnowledgePanel）确实未进入对话请求（前端无 rag_context 字段）——属实；但**后端已把「平台原料库」检索结果注入 system prompt**（chat.py `retrieve_herb_knowledge`，formula_design 场景），因此「RAG 完全不进入对话」不准确 |
| P0-2 流式暂停实际无效 | ✅ **属实** | `pauseStreaming` 仅 `setIsPaused(true)+setIsStreaming(false)`，未调用 `controller.abort()`；`resumeStreaming` 会重发同一问题 |
| P0-3 两套状态不同步导致竞态 | ✅ **基本属实** | `useChatMessages` 的 isStreaming 与 chatService 内部状态机独立维护，存在漂移风险 |
| P1-5 scenarioMode 传参被丢弃 | ✅ **属实** | `useChatMessages.sendMessage` 中 `void scenarioMode` |
| P1-4 硬编码阈值分散 | ✅ **属实** | MAX_MESSAGES/TOKEN_LIMIT/SPEED 等散落多处 |
| P1-6 流式配方与最终配方数据不一致 | 🟡 需验证 | 流式片段与最终解析存在两条路径，报告合理 |
| 错误处理/降级/存储/无障碍 | ✅ 属实（正面） | 六期已增强：HTTP 502/503/429/422 自动重试、未登录不降级、认证检测修复（require bug）、头像同步 |
| 「智能对话无法运行」 | 已修复 | Lead 已修复 `isAuthenticated()` require bug + question 超长 422，实测发送 200 |

## 二、专业方案（团队讨论结论）

### 🔴 P0 — 建议本周完成

#### 1. 打通用户 RAG 文档 → 对话链路
- **影响面**：`chatService`、`useChatSendMessage`、后端 `chat.py`、`MessageBubble`。
- **方案**：
  - 发送前调用 `ragService.retrieve(question, top_k=5)`（仅当用户知识库非空）；
  - 请求体新增 `rag_context: string[]`（检索片段，按字符预算截断）；
  - 后端在 system prompt 追加 `【用户知识库参考】`（与平台原料库并列，来源区分）；
  - 返回 `sources` 引用列表，MessageBubble 展示「知识库引用」折叠块。
- **验收**：上传文档后，对话回答引用文档内容并显示来源。

#### 2. 修复流式暂停
- **影响面**：`chatService`、`useChatMessages`、ChatInputPro 暂停/恢复按钮。
- **方案**：
  - `chatService` 暴露 `abortCurrentStream(requestId?)`（用现有 `pendingRequest` Map）；
  - `pauseStreaming()` 调用 `abortCurrentStream()`，SSE 真正终止；
  - `resumeStreaming()` 语义改为「重发当前问题」并在 UI 上提示「已重新生成」。
- **验收**：点暂停后 Network 中断开 SSE，不再消耗 LLM quota。

#### 3. 状态机统一
- **影响面**：`ChatStateMachine`、`useChatMessages`。
- **方案**：`isStreaming/isPaused` 由 chatService 状态机单一来源，新增 `Paused` 状态；hook 通过订阅状态机驱动 UI。
- **验收**：暂停/取消/完成时 UI 状态始终一致，无漂移。

### 🟡 P1 — 本月

- **scenarioMode**：实现场景切换（formula_design / general / report…）或移除参数。
- **阈值集中**：新建 `src/config/ai/constants.ts`，收敛 MAX_MESSAGES/TOKEN_LIMIT/SPEED/VIRTUALIZE_THRESHOLD 等。
- **配方数据一致**：流式保存统一走 `detectStructuredContent` 完整解析路径。

### 🟢 P2 — 季度

- MarkdownRenderer 按需拆分；思考侧栏按后端能力条件渲染；规模审计（hooks/services 合并）。

## 三、与已修复项的关系

- 六期 502/422 链路、认证检测（require bug）、question 超长、头像同步均已修复，报告评分基线已高于 76；
- 上述 P0 三项是报告中最有价值的增量建议，建议优先实施。

## 四、实施路线（建议）

1. P0-2 流式暂停（影响面小、独立）→ 2. P0-1 RAG 链路（涉及前后端）→ 3. P0-3 状态统一 → 4. P1 快速项。

> 本方案由 Lead 组织团队讨论形成；待用户确认后按任务看板实施。
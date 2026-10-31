# 「智能对话」模块专业级配方生成能力深度分析报告

> 分析对象：`http://localhost:3000/ai` 页面 → 「智能对话」Tab（ChatTab）
> 分析方法：静态代码深度审计（前端调用链 + 后端路由 + 提示词配置 + 数据落库链路）
> 分析日期：2026-10-22
> 结论先行：**尚未达到专业级配方生成能力**，处于「真实 LLM 对话 + 专业提示词 + 结构化展示」阶段；核心缺口是**无数据库知识检索、无配方后验校验、无真实优化算法、报告导出为半成品**。

---

## 一、真实数据链路（已确认真实，非假功能）

智能对话并非静态文案或本地假数据，而是完整的真实调用链：

```
ChatTab (UI)
  └─ ChatStateProvider
      └─ useChatSendMessage
          └─ useChatMessages.sendMessage
              └─ chatService.sendMessageStream()
                  └─ POST /api/v1/ai/chat/stream  (SSE)
                      └─ backend: chat.py::chat_stream
                          ├─ JWT 认证 + 组织配额 + 租户限流 + SSE 连接数限制 + CSRF
                          ├─ PromptService 加载场景提示词 (formula_design → academician)
                          ├─ 注入用户画像约束（过敏原/禁忌，已做 Prompt 注入清洗）
                          ├─ dialectics_service.analyze_dialectics（辨证分析，LLM+RAG，规则降级）
                          └─ llm_service.chat_stream → OpenAI 兼容 API（真实 LLM）
```

关键证据：

- 后端 `backend/app/api/ai_modules/chat.py`：`/chat`、`/chat/stream` 均为真实 LLM 调用；LLM 不可用时显式降级到 `thinking_engine` 并通过 `meta` 事件标注 `rule-engine-fallback`，不再冒充大模型。
- `backend/app/services/llm_service.py`：`chat()` / `chat_stream()` 通过 `httpx` 调用 OpenAI 兼容 `/chat/completions`，支持用户级密钥 > 数据库密钥 > 环境变量密钥的优先级。
- 前端 `chatService.ts`：正确处理 SSE 的 `meta`（来源）、`dialectics`（辨证）、`content`、`error`、`done` 事件。
- 配方落库真实：聊天中点击「保存配方」→ `formulaExtractorService` 解析结构化 JSON → `createFormula()` → `POST /api/v1/formulas`（后端 `backend/app/api/formulas.py` 真实建表持久化，含租户隔离与配额校验）。

## 二、已具备的专业要素（亮点）

1. **专业级 System Prompt**（`backend/conf/prompts/default.yaml` → `academician`）
   - 强制输出 JSON 结构化块（header/metrics/data-table/callout）
   - 六段式配方设计结构：配方方案 / 君臣佐使配伍解析 / 核心成分与功效机制 / 安全性与法规 / 服用方法与禁忌 / 特色总结与优化方向
   - 要求「严格区分科学证实与传统经验」「不确定标注需进一步验证」「不少于1000字」

2. **辨证引擎**（`dialectics_service.py`）
   - 急重症关键词命中 → 立即建议就医，不生成配方
   - LLM+RAG 辨证，输出体质倾向/辨证要点/调理目标/证据分级/注意事项
   - LLM 不可用时规则降级并明确标注 `rule_engine_fallback`

3. **用户画像约束注入**
   - 过敏原、饮食禁忌、体质信息注入 System Prompt 层，并要求「配方中严禁出现已声明过敏原」
   - 对前端传入的画像文本做 Prompt 注入清洗（`_sanitize_profile`）

4. **结构化专业渲染**（`StructuredMessageRenderer` + BlockRegistry）
   - 识别 LLM 返回的 JSON blocks，渲染为标题/评分卡/成分表/配伍分析/注意事项等专业区块
   - 兼容 LLM 常见字段变体（`style`→`variant`、字符串数组→ListItem）

5. **会话与工程完备性**
   - 会话历史 IndexedDB 持久化、上下文压缩、离线重试队列、CSRF、租户限流、配额、SSE 并发限制

## 三、与「专业级配方生成」的核心差距（缺陷清单）

### 缺陷 1：无知识库/数据库检索（最致命）
- 聊天链路中 `ragEnabled={false}`，TopBar 明确提示「后端未提供 RAG 索引与检索端点」。
- 辨证引擎尝试 RAG，但 `rag_service` 实际不可用时会静默降级到仅 5 类关键词规则表（高血糖/高血压/失眠/尿酸/减肥）。
- **后果**：LLM 仅凭参数化知识生成配方，无法查证平台《中华本草》/原料库/化合物库/GB 标准；成分名、性味归经、剂量、法规状态都可能幻觉。专业级配方生成要求「知识库深度整合 + 检索增强」，此处缺失。

### 缺陷 2：无配方后验校验（剂量/合规/配伍）
- 聊天端点永远返回 `formulas: []`，SSE 也不下发 `formula` 事件；配方完全依赖前端解析 LLM 文本。
- 生成的配方**不经过**药食同源目录合规校验、每日用量上限校验、十八反十九畏配伍禁忌校验、营养成分/活性成分理论计算（氮折算系数等均无）。
- 即使用户画像约束已注入，LLM 仍可能输出超量或禁忌原料；系统没有第二道校验防线，甚至可直接保存入库。

### 缺陷 3：本地「算法引擎」是玩具且未接入
- `formulaDesignEngine.ts`：仅 **18 种硬编码成分**、20 余条硬编码交互规则；
- 组合优化实为贪心逐个添加（注释自认「实际应用中应使用遗传算法/模拟退火」）；
- `optimizeFormula` 只生成 ±10% 剂量变体且不增分即丢弃——不是真正的多目标优化；
- 该引擎仅能被 `formulaIntelligenceService.processUserInput` 调用，而后者在当前聊天链路中**没有任何调用点**（grep 证实仅 `detectIntent` 被使用）。即：宣传中的「算法驱动/多目标优化」在聊天里并不存在。

### 缺陷 4：报告生成器为半成品（展示级）
- `useReportGenerator` / `reportEngine.ts`：
  - 稳定性/合规性/成本评分是**硬编码默认值**（85/90/80），注释「需要实际测试数据」；
  - `exportToPDF` 实际生成 **HTML 内容 + `application/pdf` MIME**，不是真 PDF；
  - `exportToWord` 实际是 JSON 字符串 + docx MIME；`exportToExcel` 是 CSV；
  - 「AI 摘要」是模板拼接，不是真实 AI 分析；风险评估仅按成分数与置信度拍脑袋。

### 缺陷 5：无监测/迭代闭环
- 专业标准要求输出「监测哪些指标、如何反馈迭代」；提示词第 6 节仅让 LLM 写优化方向，系统无任何随访/反馈数据收集端点，无法形成「配方 → 试用 → 反馈 → 迭代」闭环。

### 缺陷 6：结构化输出脆弱，无兜底修复
- 结构化 JSON 完全依赖 LLM 遵守提示词；若 LLM 输出普通 Markdown，`detectStructuredContent` 返回 null → 无专业区块、无保存按钮、无重试/修复机制。
- 后端 chat 端点未对聊天请求启用 `response_format: json_object`（仅辨证和配方生成专用端点使用）。

## 四、专业级达标评估表

| 维度 | 专业级要求 | 现状 | 判定 |
|---|---|---|---|
| 真实 LLM 对话 | 调用真实大模型 | ✅ 真实调用 + 降级标注 | 达标 |
| 辨证与目标 | 体质辨证 + 调理目标 | ⚠️ LLM+RAG，RAG 常降级为 5 类规则 | 部分达标 |
| 知识库融合 | 本草/化合物/文献/标准检索 | ❌ 无 RAG，纯模型记忆 | 不达标 |
| 配方生成 | 基于数据约束生成 | ⚠️ 靠提示词，无数据库约束 | 部分达标 |
| 剂量/法规校验 | 药食同源目录+安全上限+禁忌 | ❌ 无任何后验校验 | 不达标 |
| 算法优化 | 多目标优化/网络药理 | ❌ 本地引擎为死代码玩具 | 不达标 |
| 结构化专业展示 | 配方报告式渲染 | ✅ 区块化专业渲染 | 达标 |
| 报告/导出 | 真实 PDF/Word 报告 | ❌ 半成品（假导出/硬编码评分） | 不达标 |
| 安全边界 | 急症转诊/过敏禁忌 | ✅ 急症拒绝+画像约束 | 达标 |
| 监测迭代闭环 | 指标监测+反馈迭代 | ❌ 无闭环 | 不达标 |

**总体评分（0-100）：约 55 分。**
- 工程完备性、真实 LLM、专业提示词、UI 展示是扎实的；
- 但「配方生成」的灵魂——**数据检索、剂量校验、真实算法、专业报告**——尚未落地。

## 五、演进建议（按优先级）

### P0：接入真实知识库检索（RAG）
- 将平台原料/化合物/文献数据接入聊天链路，为 LLM 提供可引用的知识片段（来源+证据等级）。
- 启用 `ragEnabled`，提供 RAG 索引与检索端点。

### P0：增加配方后验校验层
- 新增后端校验端点：药食同源目录合规、每日用量上限（比对药典/目录）、配伍禁忌（十八反十九畏+已知拮抗）、过敏原过滤。
- 聊天保存配方前强制过校验，超限/违禁给出警告或拦截。

### P1：接入真实算法引擎
- 将「配方生成 Tab」的遗传算法/多目标优化（如 NSGA-II）能力接入聊天保存链路，或改造现有 `formulaDesignEngine`：接入真实数据库、实现真正的遗传算法，而不是 18 种硬编码成分。

### P1：修复报告导出
- 用真实 PDF/Word 生成库替换假导出；移除硬编码评分，接入后端营养计算/合规评估结果。

### P2：建立反馈迭代闭环
- 增加配方反馈收集（效果自评、症状变化、指标复查），支持基于反馈的多轮优化。

### P2：结构化输出兜底
- 对 LLM 输出做格式修复（JSON 提取失败时二次请求/解析修复），或后端对聊天启用 JSON 模式约束。

---

## 附录：关键代码位置

| 文件 | 作用 |
|---|---|
| `frontend/src/pages/ai/AIAssistantPage.tsx` | /ai 页面，chat Tab 入口 |
| `frontend/src/components/ai/features/ChatTab.tsx` | 智能对话布局与配方保存 |
| `frontend/src/components/ai/features/ChatStateProvider.tsx` | 状态容器 |
| `frontend/src/components/ai/features/hooks/useChatSendMessage.ts` | 发送编排、配方意图→结构化指令 |
| `frontend/src/components/ai/features/hooks/useChatMessages.ts` | SSE 消费、消息持久化 |
| `frontend/src/components/ai/features/services/chatService.ts` | SSE 解析、认证/CSRF/重试 |
| `frontend/src/components/ai/features/services/formulaExtractorService.ts` | 从结构化内容提取配方 |
| `frontend/src/components/ai/features/services/formulaDesignEngine.ts` | 18 成分玩具引擎（聊天未接入） |
| `frontend/src/components/ai/features/services/formulaIntelligenceService.ts` | 仅 `detectIntent` 被使用 |
| `frontend/src/components/ai/features/hooks/useReportGenerator.ts` | 报告生成（半成品） |
| `frontend/src/components/ai/features/utils/reportEngine.ts` | 报告数据（硬编码评分） |
| `frontend/src/components/ai/features/components/structured/utils.ts` | 结构化 JSON 检测 |
| `frontend/src/api/formula.ts` | createFormula → POST /formulas |
| `backend/app/api/ai_modules/chat.py` | 聊天端点（真实 LLM） |
| `backend/app/services/llm_service.py` | LLM 真实调用 |
| `backend/app/services/ai/prompt_service.py` + `backend/conf/prompts/default.yaml` | 场景提示词 |
| `backend/app/services/ai/dialectics_service.py` | 辨证引擎 |
| `backend/app/services/thinking_engine.py` | LLM 不可用时规则降级 |
| `backend/app/api/formulas.py` | 配方真实落库 |

*本报告基于源代码静态审计，未做浏览器运行时验证；如需要可配合后端日志与实际页面操作进一步核验。*
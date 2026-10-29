# 「智能对话 → RAG 知识库」功能结构核查报告（三线交叉验证）

- 核查日期：2026-10-28
- 核查目标：http://localhost:3000/ai 页面「智能对话」功能模块 →「RAG 知识库」功能结构
- 核查方式：3 个专业审查组并行只读核查 + lead 交叉复核关键结论
- 参与：audit-rag-backend / audit-rag-frontend / audit-rag-integration

---

## 一、结论：**未完成 100% 功能开发**（综合评级 58/100）

RAG 知识库的**功能主干可运行**（导入 → 分块 → 向量化 → 混合检索 → RRF 重排 → Prompt 增强 → 种子注入 → 对话注入链路全部打通），但存在 **5 处 P0 级跨租户数据泄露 + 1 处 P0 级前端状态不共享（导致「注入后界面不同步」P0 未真正闭环）+ 核心种子知识库对真实用户经向量路径不可见**。**判定：未达 100% 完成**，需先封堵安全/隔离缺口并修复种子可见性后方可验收。

| 审查维度 | 评分 | 一句话判断 |
|:---------|:----:|:-----------|
| 后端（认证/租户隔离/检索质量/种子） | 58/100 | 主干可运行，但 5 处 P0 跨租户泄露 + 种子对真实用户不可见 |
| 前端（面板/Context/注入/i18n） | 72/100 | 功能骨架到位，但 useRAGContext 非共享 Context，P0 未真正闭环 |
| 端到端（chat 注入/契约/种子） | 78/100 | 核心对话链路已闭环，但平台知识库仅覆盖 2/4 场景、/search 未鉴权 |
| **综合** | **~60/100** | 核心链路可用，但安全/隔离/状态一致性存在系统性断点 |

---

## 二、P0 问题清单（必须立即修复，共 6 项）

### P0-1　`/rag/search` 未鉴权 + `user_id` 客户端可控 → 跨租户数据泄露
- 位置：`backend/app/api/rag_router.py:221-226, 234`
- 根因：`search_rag` 无 `Depends(get_current_active_user)`；`user_id: str = Query(None)` 为任意客户端可传参数，随后直接 `augment_query(..., user_id=user_id)`。
- 影响：任意未登录调用者传任意 `user_id` 即可检索他人知识库；不传则 `user_id=None` → `vector_store.search` where=None（`vector_store.py:96-98`）→ 返回**全部租户**分块。构成可枚举的跨租户数据泄露。
- 修复：补 `current_user=Depends(get_current_active_user)`；`user_id` 改为取自 `current_user.id`，删除 Query 参数。

### P0-2　`/rag/documents`（GET）匿名可达 + `list_documents()` 无 user_id → 暴露全部租户文档名
- 位置：`rag_router.py:87-88` + `rag_service.py:559-561`
- 根因：`GET /documents` 无认证依赖，直接调 `rag_service.list_documents()`（无 user_id 参数）→ `vector_store.list_sources()`（无 where）→ 全局。
- 影响：未登录可枚举所有租户上传的文档名（信息泄露），且与上传侧的租户隔离（`ingest_document` 已注入 user_id）矛盾。
- 修复：`list_documents(user_id)`，端点加认证。

### P0-3　BM25 补充检索绕过租户过滤（默认路径即泄露）
- 位置：`rag_service.py:430-435`
- 根因：`bm25_scores` 来自全局 BM25 索引（`_build_bm25_index` 读取全部 collection，无 where）；`bm25_only_ids` 会把**其他租户的 BM25 命中**（不在本用户向量命中里）加入候选；`get_chunks_by_ids`（`vector_store.py:139-155`）不带 user_id、无 where。
- 影响：默认路径（Embedding 正常时）也会把他人租户分块注入候选集，RRF 后可能进 top_k。
- 修复：BM25 检索也按 user_id 过滤，或对 `bm25_only_ids` 先做租户校验。

### P0-4　多个内部调用方 `augment_query` 不带 user_id → 全局检索
- 位置：`workflow_engine.py:370`、`formula_rag_hook.py:116`、`dialectics_service.py:194`、`benchmark.py:159`
- 根因：这些调用方调用 `augment_query(...)` 未传 `user_id` → `vector_store.search` where=None → 返回全部租户。
- 影响：agent 工作流 / 配方生成主链路的 RAG 检索跨租户。
- 修复：从 context 取 `user_id` 传入。

### P0-5　种子知识库对真实用户经向量路径**不可见**
- 位置：`seeder.py:382`（`ingest_document(..., user_id="system")`）+ `rag_router.py:163/234`（用 `current_user.id` / 客户端 user_id 查询）
- 根因：种子以 `user_id="system"` 注入，而所有查询用真实用户 id（≠ "system"）→ `vector_store.search` 的 `where={"user_id": user_id}` 永远排除种子。
- 影响：核心知识库（296 味药材、106 种药食同源、食品安全法规，共 330 分块）经主检索路径**不可达**，用户检索只会命中自己上传的文档（或无结果）。种子只能靠 P0-3 的全局 BM25 补充「偶然」返回。
- 修复：种子标记为对所有租户可见（查询时把 `system` 与当前 `user_id` 取并集，或 where 特判 `$or: [{"user_id": current}, {"user_id": "system"}]`）。

### P0-6　前端 `useRAGContext` 非共享 Context，「面板注入后 TopBar 仍 OFF」未真正闭环
- 位置：`frontend/src/hooks/useRAGContext.ts`（普通 Hook，内部 useState，**无 createContext/Provider**）；调用者 `ChatStateProvider.tsx:126`（实例 A，TopBar/聊天读取）与 `RAGKnowledgePanel.tsx:30`（实例 B，面板自用）
- 根因：RAG 状态做成普通 Hook，每次调用新建独立 useState 实例，无 Provider 提升共享。
- 影响：面板 `handleSeed→rag.triggerSeed()` 只更新实例 B；实例 A（TopBar `ragIsSeeded`、`onTriggerSeed`、`augment` 读取）不变 → TopBar 状态、`isSeeded` 门控（TopBar L297）、注入开关与面板行为相互脱节。**lead 此前记录的修复方向（改调 `triggerSeed`）方向正确但作用于错误实例，未真正闭环。** 当前该症状被 UI 门控（TopBar L297 仅在 A 已 enabled+seeded 才允许开面板）部分掩盖。
- 修复：将 useRAGContext 改造为真实 `Context + Provider`（挂载于 ChatStateProvider 或 AIAssistantPage 顶层），面板/TopBar/聊天统一从一个 Provider 读取；或改为模块级单例 store，useRAGContext 退化为 selector。

---

## 三、P1 问题清单

| # | 问题 | 位置 | 修复建议 |
|:-:|:-----|:-----|:---------|
| P1-1 | 其余 4 个只读端点匿名可达：`/seed/status`、`/audit-log`、`/documents/{filename}/versions`、`/cache/stats` | `rag_router.py:197-198 / 211-212 / 105-106 / 258-259` | 统一补认证依赖，或对该 router 设全局 `dependencies` |
| P1-2 | BM25-only 降级路径绕过租户（Embedding 不可用时） | `rag_service.py:401-418`（`get_chunks_by_ids` 无过滤） | 与 P0-3 同根因，一并修复 |
| P1-3 | RAGKnowledgePanel upload/delete 不更新任何 Context 状态 | `RAGKnowledgePanel.tsx:117-118 / 133-135` | useRAGContext 暴露 `refreshSeedStatus()`，upload/delete 后调用 |
| P1-4 | 两套并行知识库面板（RAGKnowledgePanel vs KnowledgeBasePanel） | `features/components/RAGKnowledgePanel.tsx` vs `rag/KnowledgeBasePanel.tsx` | 合并为单一面板，统一状态源 |
| P1-5 | 死代码 `buildRagContext` + 无用 `searchChunks` 导入 | `chatService.ts:589-611, 12` | 删除方法体与 import |
| P1-6 | 平台知识库仅覆盖 `formula_design/academician` 2 场景，`safety_off/process_eng/concise_adv` 空 rag_context 时被静默跳过 | `chat.py:559` | 改为覆盖 4 场景（至少加 `safety_off`），或解耦「注入平台库」与「prompt 场景」 |

---

## 四、P2 / P3 问题清单

| # | 级别 | 问题 | 位置 |
|:-:|:----:|:-----|:-----|
| P2-1 | P2 | RAGKnowledgePanel ~30 处硬编码中文（未走 i18n） | `RAGKnowledgePanel.tsx` 多处 |
| P2-2 | P2 | 缺失 key `ai.knowledge.lastUpdated`（三语均缺，被 SearchQualityDashboard 引用） | `i18n/*/ai.ts` |
| P2-3 | P2 | 3 个孤儿组件（DocumentPreviewModal / SearchQualityDashboard / KnowledgeGraphRAGBridge，0 引用） | `frontend/src/components/ai/rag/` |
| P2-4 | P2 | `/rag/query` 与 `/rag/search` 双端点重复 + 字段命名不一致（`total_chunks` vs `total_chunks_indexed`） | `rag_router.py:153-177 / 221-251` |
| P2-5 | P2 | 种子注入失败（Embedding 不可用）在面板静默：`triggerSeed` 吞异常返回 false，面板 catch 永不触发 | `useRAGContext.ts:108-111` + `RAGKnowledgePanel.tsx:93-99` |
| P2-6 | P2 | `_score_threshold` 死变量（从未读取）；`_rrf_rerank` 死分支（L488-493 恒假） | `rag_service.py:138 / 488-493` |
| P2-7 | P2 | `get_stats` 的 `total_chunks` 用全局 `chunk_count`，与按租户过滤的 `documents` 矛盾 | `rag_service.py:575` |
| P2-8 | P2 | 种子注入部分失败后重试会重复注入（按 source 无幂等去重） | `seeder.py:358-368` |
| P3 | P3 | `prompt_service` 内置 fallback `scenarios` 缺前端 4 别名（YAML 加载失败时 P0 症状复现） | `prompt_service.py:134-139` |
| P3 | P3 | 用户库 chunk 未按长度截断（`rag_context[:5]` 直接拼接） | `chat.py:553` |
| P3 | P3 | `onSeedComplete?.(rag.totalChunks, [])` 读取 stale 闭包值（参数被调用方忽略） | `RAGKnowledgePanel.tsx:92` |

---

## 五、已确认修复/正常的历史问题（本轮复核 PASS）

| 项 | 结论 | 证据 |
|:--|:----:|:-----|
| scenarioMode 前后端契约（历史 P0-2） | ✅ 已修复 | 前端 4 枚举全部命中后端 `default.yaml:721-724`；`useChatSendMessage.ts:238` deps 已补 scenarioMode |
| useCallback stale closure | ✅ 已修复 | `useChatSendMessage.ts:228-239` 依赖数组含 scenarioMode |
| `_rrf_rerank` BM25-only 丢失（历史 P1-6） | ✅ 已修复 | `rag_service.py:430-435` 用 `get_chunks_by_ids` 把 BM25-only 命中补回候选集 |
| 阈值量纲（历史 P1-6/P2-1） | ✅ 已修复 | 独立 `RAG_RRF_SCORE_THRESHOLD`（默认 0.0，`rag_service.py:458-460`） |
| i18n 12 个缺失 key | ✅ 已补齐 | zh-CN/en-US/de-DE 三语均含（`i18n/*/ai.ts:1400-1424`） |
| 种子「看似已注入但空库」假阳性 | ✅ 已修复 | `seeder.py:390-397` 全部失败返回 `seeded=false`；`/rag/seed` 返回 503（`rag_router.py:185-190`） |
| 种子数据质量 | ✅ 真实 | `tcm_herb_encyclopedia.md` 290 块 / `food_homology_catalog.md` 1 块 / `food_safety_regulations.md` 39 块，均 >0 |
| 对话 RAG 注入链路 | ✅ 闭环 | 前端检索 → `rag_context` → `chat.py:551-558` system prompt → LLM；无双重检索、无断链 |
| 上传侧租户隔离 | ✅ 正确 | `ingest_document` 注入 `meta["user_id"]`（`vector_store.py:81`）；`search/list_sources/delete_by_source` 支持 where |

---

## 六、达成 100% 的剩余动作（按优先级）

1. **（P0-1..P0-5）封堵后端跨租户泄露 + 修复种子可见性**——这是安全与核心功能的双重阻断，必须先做。
   - `/rag/search`、`/rag/documents` 及 4 个只读端点补认证；`user_id` 一律取自 `current_user.id`。
   - BM25 检索与 `get_chunks_by_ids` 加租户过滤。
   - 4 个内部调用方补传 user_id。
   - 种子改为对所有租户可见（查询 where 取 `user_id ∪ "system"`）。
2. **（P0-6）前端 useRAGContext 改造为共享 Context/单例 store**——结构性修复，消除「注入后界面不同步」P0。
3. **（P1-6）平台知识库覆盖全部场景**（至少 `safety_off`）。
4. **（P1-3/4/5、P2）** upload/delete 同步 Context、合并双面板、删死代码、i18n 补齐、清孤儿组件、收敛双端点。
5. **（P3）** 内置 fallback 补别名、chunk 截断。

---

*本报告为只读核查结论，未修改任何源码。三线结论经 lead 交叉复核，P0-1/P0-6/P0-5 已逐行验证。*

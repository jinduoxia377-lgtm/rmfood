# 「智能对话 → RAG 知识库」整体完成度重评报告（recheck）

- 重评日期：2026-10-28
- 审查：audit-rag-integration（只读，未改代码）
- 前置：`reports/rag-kb-verdict-20261028.md`（初评 ~60/100，6 P0）
- 修复依据：`rag-p0-fix-complete` / `rag-round2-complete` / `rag-residual-complete` / `rag-p14-final` + `rag-e2e-recheck-verify`（服务级 A–F 回归）

---

## 一、结论

### **综合完成度：90 / 100 —— 未判严格 100%，但已达验收/可发布级**

**一句话判断**：`6 项 P0 + 6 项 P1 全部落地并服务级验证；P2 完成 6/8（P2-6 部分、P2-8 未修复）；P3 完成 2/3（P3-1 潜在风险保留）`。RAG 功能开发**主干已闭环可运行**，但存在 **1 项未修复代码缺陷（P2-8 种子部分失败幂等）**、**1 项数据补全度缺口（food_materials 仅 13 行/字段空，直接影响平台知识库注入质量）** 及若干环境项，故**不判 100%**。

| 维度 | 完成度 | 说明 |
|:-----|:----:|:-----|
| P0（安全/隔离/状态共享，6 项） | 100% | 6/6 已落地并服务级 A–E 验证 |
| P1（鉴权/租户/面板/死代码/场景，6 项） | 100% | 6/6 已落地 |
| P2（i18n/收敛/状态/数据，8 项） | 81% | 6 全 + P2-6 部分 + P2-8 未修复 |
| P3（fallback/截断/闭包，3 项） | 83% | 2 全 + P3-1 潜在保留 |
| 数据/环境（name_cn/缓存键/分块/reranker/LLM 超时/测试残留） | ~60% | 修复项已生效；数据补全度与 reranker 未达 |

---

## 二、逐项状态表（对照初评 P0/P1/P2/P3 清单）

### P0（6/6 已修复 ✅）

| 项 | 状态 | 证据（当前代码） |
|:--:|:----:|:-----|
| P0-1 `/rag/search` 鉴权 + user_id 取自 token | ✅ 已修复 | `rag_router.py:260` `Depends(get_current_active_user)`；`:272` `user_id=str(current_user.id)`（删 Query 参数） |
| P0-2 `/rag/documents` 鉴权 + `list_documents(user_id)` | ✅ 已修复 | `rag_router.py:92,95`；`rag_service.py:562-570` |
| P0-3 BM25 补充检索绕过租户 | ✅ 已修复 | `rag_service.py:409,438` `get_chunks_by_ids(ids, user_id)`；`:444-445` `bm25_scores` 过滤可见块；`vector_store.py:164-196` 内存过滤 |
| P0-4 4 处内部调用 `augment_query` 不带 user_id | ✅ 已修复 | 全 9 处调用点均传 user_id：`workflow_engine.py:382`、`formula_rag_hook.py:125`、`dialectics_service.py:201`、`benchmark.py:160`、`rag_tool.py:67`、`qa_tool.py:82`、`literature_tool.py:66`、`rag_router.py:273` |
| P0-5 种子库对真实用户经向量路径不可见 | ✅ 已修复 | `vector_store.py:93-105` `_visible_where` `$or:[user_id, "system"]`；`search/list_sources/count_visible` 均用之；`rag_router.py:141-145` 种子删除 403；`vector_store.py:209-210` `delete_by_source` 只匹配自身 user_id（双保险） |
| P0-6 前端 useRAGContext 非共享 Context | ✅ 已修复 | `useRAGContext.ts:93` `createContext`；`:115-312` `RAGContextProvider`；`:318-320` `useContext`；`AIAssistantPage.tsx:865` 单 Provider 包裹全部 Tab |

### P1（6/6 已修复 ✅）

| 项 | 状态 | 证据 |
|:--:|:----:|:-----|
| P1-1 其余 4 个只读端点匿名 | ✅ 已修复 | `/documents/{f}/versions:111`、`/seed/status:226`、`/audit-log:247`、`/cache/stats:298` 均 `Depends` |
| P1-2 BM25-only 降级绕过租户 | ✅ 已修复 | `rag_service.py:409`（降级路径） |
| P1-3 upload/delete 不更新 Context | ✅ 已修复 | `KnowledgeBasePanel.tsx:416,436` `rag.refreshSeedStatus()`；`useRAGContext.ts:136-146` |
| P1-4 两套并行面板 | ✅ 已修复（合并） | `RAGKnowledgePanel.tsx` 已删除；`KnowledgeBasePanel.tsx:88-172` `SeedInitCard` 为唯一入口；`ChatTab.tsx:79,453` `onOpenKnowledgeTab`；`AIAssistantPage.tsx:875` |
| P1-5 死代码 `buildRagContext` + `searchChunks` import | ✅ 已修复 | `chatService.ts` 已无 `buildRagContext`/`searchChunks`（grep 0 命中） |
| P1-6 平台知识库仅覆盖 2 场景 | ✅ 已修复 | `chat.py:560-566` 分支扩为 5 值（formula_design/academician/safety_off/process_eng/concise_adv） |

### P2（6 全 ✅ / P2-6 部分 ⚠️ / P2-8 未修复 ❌）

| 项 | 状态 | 证据 |
|:--:|:----:|:-----|
| P2-1 RAGKnowledgePanel 硬编码中文 | ✅ 已修复 | i18n key `seedFailed/seedErrorEmbedding/Network/Server/Unknown` 三语齐全（zh-CN:1441-1444 / en-US:1441-1444 / de-DE:1439-1442） |
| P2-2 缺失 `ai.knowledge.lastUpdated` | ✅ 已修复 | zh-CN:1417 / en-US:1417 / de-DE:1415 |
| P2-3 3 个孤儿组件 | ✅ 已修复 | `DocumentPreviewModal/SearchQualityDashboard/KnowledgeGraphRAGBridge` 均已删除（Test-Path=False） |
| P2-4 `/rag/query` 与 `/rag/search` 双端点 | ✅ 已修复（收敛） | `rag_router.py:166-201` `/query` `deprecated=True` 复用 `/search` handler；统一 `total_chunks_indexed`（`:288`），保留平铺 `total_chunks`（`:199`）兼容前端 |
| P2-5 种子注入失败面板静默 | ✅ 已修复 | `useRAGContext.ts:132,196,203` `seedError` + `toSeedErrorCode`；`KnowledgeBasePanel.tsx:104,108` 显示 `seedFailed`+原因 |
| P2-6 `_score_threshold` 死变量 / `_rrf_rerank` 死分支 | ⚠️ 部分 | `_rrf_rerank` 恒假分支已删（`rag_service.py:487-516`）；但 `_score_threshold` 仍为死变量（`rag_service.py:138`，grep 仅定义处 1 命中，从未读取） |
| P2-7 `get_stats` total_chunks 与 documents 矛盾 | ✅ 已修复 | `rag_service.py:591` `count_visible(user_id)`；`vector_store.py:215-231` |
| P2-8 种子注入部分失败后重试重复注入 | ❌ **未修复** | `seeder.py:355-368` 幂等检查仅 `seed_filenames.issubset(existing_sources)`——部分失败时集合不全 → 重试会把已注入的种子文档**重复再种**（`ingest_document` 无按 source 去重） |

### P3（2 全 ✅ / P3-1 潜在保留 ⚠️）

| 项 | 状态 | 证据 |
|:--:|:----:|:-----|
| P3-1 `prompt_service` 内置 fallback 缺前端 4 别名 | ⚠️ 潜在保留 | `prompt_service.py:134-139` 内置 `scenarios` 仍只含 default/formula_design/safety_check/general_qa，**未补** 4 别名；YAML 正常加载时无影响，但 YAML 加载失败时前端值全部 fallback base（原 P0-2 症状复现）。残留报告定「确认类无需改」，故**保留** |
| P3-2 用户库 chunk 未按长度截断 | ✅ 已修复（源头截断） | `document_processor.py:240-265` `_split_long_text`（每段 ≤ CHUNK_SIZE*1.5，句界优先）；`chat.py:554` 仍 `rag_context[:5]`，但块已 ≤1200 源头截断 → system prompt 有界 |
| P3-3 `onSeedComplete` stale 闭包 | ✅ 已修复 | `useRAGContext.ts:57,136-146` `refreshSeedStatus()` 返回最新 `{is_seeded,total_chunks}`；`KnowledgeBasePanel` 用其最新值 |

### 附加修复项（lead 指定抽查）

| 项 | 状态 | 证据 |
|:--:|:----:|:-----|
| 鉴权 401（未登录 /search /documents /seed/status） | ✅ | 服务级 A 场景：无 token → 401（`rag-e2e-recheck-verify.md` A） |
| 租户隔离（uA/uB 互不可见，种子可见） | ✅ | 服务级 C 场景 + `vector_store.py:93-105` `$or` |
| 种子可见（330 块经向量路径可达） | ✅ | 服务级 B：`seeded=true` 330 块；`/search?question=黄芪` 命中 `tcm_herb_encyclopedia.md` |
| 禁删 403（种子文档） | ✅ | `rag_router.py:141-145`；服务级 D：种子 403 / 自有 200 |
| 双面板唯一入口 | ✅ | `RAGKnowledgePanel.tsx` 已删；`KnowledgeBasePanel.tsx:498` 唯一 `SeedInitCard` |
| `name_cn` 清洗（黄芪/枸杞子/山楂/薏苡仁） | ✅ | 根因源已正确（`china_food_regulations.py:12,13,18` 黄芪/枸杞子/山楂）；服务级 F2：4 项 total=1（此前 0）；`retrieve_herb_knowledge` 查询 `food_materials` 表（`formula_intelligence.py:539-579`） |
| `/ai/chat` 缓存键（scenario_mode） | ✅ | `chat.py:733-734` `scenario_cache_tag=f":sm:{scenario_mode}"`；`:744,746` 并入 user/org 两变体；服务级 F1：同题不同场景 `cached=false` |
| 分块截断 | ✅ | `document_processor.py:240-265`；服务级 F3：5210 字单段 → 6 块 max=1200 |

---

## 三、服务级回归（A–F）核对 —— 全部 PASS，无回归

来自 `rag-e2e-recheck-verify.md`（TestClient + 真实 PostgreSQL + 隔离 ChromaDB）：

| 场景 | 判定 |
|:-----|:----:|
| A 未登录鉴权（/search /documents /seed/status → 401） | ✅ |
| B 种子注入+可见（330 块、向量路径可达） | ✅ |
| C 跨租户隔离（uA/uB 互不可见、各自+种子） | ✅ |
| D 种子禁删（403）/ 自有（200） | ✅ |
| E 平台库 P1-6（safety_off → 结构化 safety_report） | ✅ |
| F1 缓存键（`:sm:{scenario_mode}` 生效） | ✅ |
| F2 name_cn（4 项 0→1） | ✅ |
| F3 分块截断（max ≤1200） | ✅ |

> 我仅做**静态复核**（代码逐行 + 报告交叉），未重跑服务级测试（只读约束 + 无预置服务）；F1/F2/F3 已由报告给出服务级证据，且我逐行核对了对应代码落地。

---

## 四、剩余缺口（非严格 100% 的构成）

| 级别 | 缺口 | 类型 | 影响 | 建议优先级 |
|:--:|:-----|:----:|:-----|:----:|
| **P2-8** | 种子注入**部分失败**后重试重复注入（`seeder.py:355-368` 仅全子集判断，无按 source 幂等去重） | 代码缺陷 | 部分失败→重试→已注入文档被重复种入（重复块） | **P1**（修复幂等，按单个 filename 判断是否已存在后再种） |
| **数据** | `food_materials` 表仅 **13 行**、多字段空（safe_dose/contraindications/effects/active_ingredients），远低于 RAG 向量库 296 药材/106 药食同源 | 数据补全度 | chat.py【平台知识库参考】经 `retrieve_herb_knowledge` 取数单薄，平台知识注入质量受限 | **P2**（扩种数据，对齐药食同源目录） |
| **P2-6** | `_score_threshold` 死变量（`rag_service.py:138`，从未读取） | 代码卫生 | 无功能影响，仅死代码 | P3（删除） |
| **P3-1** | `prompt_service` 内置 fallback `scenarios` 缺 4 别名（`prompt_service.py:134-139`） | 潜在 | 仅 YAML 加载失败时复现原 P0-2 症状（罕见） | P3（同步补别名，低成本） |
| **环境** | reranker 缺装（`reranker.py` 存在，`get_reranker` 失败 → `rag_service.py:451-463` 自动降级 RRF） | 环境/质量 | 无 Cross-Encoder 精排，Top-K 精度降 ~20-30%（自动降级不报错） | P2（安装 transformers + 缓存 bge-reranker-base） |
| **环境** | LLM 偶发 >150s 超时（`chat.py:208` `LLM_NON_STREAM_TIMEOUT=150`；formula_design 重场景） | 配置 | 重场景下偶发超时；建议客户端/服务端超时 >200s 或重试 | P3（调参） |
| **清理** | 测试残留 `.e2e_tmp/tc_bc*`（tc_bc~tc_bc4） | 杂物 | 无功能影响 | P3（清理） |
| **UI** | P1-4 合并后为「模态框 → knowledge tab」切换，未做运行时视觉回归（只读无法跑 UI） | 验证缺口 | 功能证据充分（tsc 0 错误、69 tests、SeedInitCard 就位），视觉细节待人工确认 | P3（人工 UI 走查） |

---

## 五、综合评分（0-100）与结论

### **90 / 100**

| 权重 | 维度 | 完成度 | 贡献 |
|:----:|:-----|:----:|:----:|
| 30% | P0（6 项） | 100% | 0.300 |
| 25% | P1（6 项） | 100% | 0.250 |
| 25% | P2（8 项，6 全 + 1 半 + 1 未） | 81% | 0.203 |
| 10% | P3（3 项，2 全 + 1 潜在） | 83% | 0.083 |
| 10% | 数据/环境（name_cn/缓存键/分块已生效，food_materials/reranker/LLM 超时未达） | ~60% | 0.060 |
| | **合计** | | **≈ 0.896 → 90** |

### 结论：**未判严格 100%，但已达验收/可发布级**

- **功能开发（代码）口径**：**≈ 95/100** —— 6 P0 + 6 P1 全部闭环，P2 仅剩 1 项真实缺陷（P2-8）+ 1 项卫生项（P2-6），P3 仅剩 1 项潜在（P3-1）。**功能主干 100% 可用**，剩余为边界缺陷与卫生项。
- **整体（含数据/环境）口径**：**90/100** —— 主要拖累为 `food_materials` 数据补全度（13 行/字段空，平台知识库注入质量受限）与 reranker 缺装（检索精度下降，自动降级）。
- **是否 100% 功能开发完成**：**否（但仅差 P2-8 一项代码缺陷 + 数据/环境非功能项）**。若将 P2-8 幂等修复 + food_materials 数据扩种纳入，即可判 100%。

**建议**：① 修复 P2-8（种子幂等按单文档判断）；② 扩种 `food_materials`（对齐 106 药食同源/296 药材，至少补 safe_dose/禁忌/功效字段）；③ 安装 reranker 提升检索精度；④ 删除 `_score_threshold` 死变量与测试残留；⑤ 同步内置 fallback 别名。完成 ①②后可判 100%。

---

*本报告为只读重评，未修改任何源码。静态复核基于当前代码逐行 + 修复报告与服务级回归证据交叉验证。*

# 配方生成端到端集成审查报告

- 审查员：review-integration（集成/运行时审查）
- 日期：2026-10-27
- 范围：`http://localhost:3000/ai` 页面「配方生成」模块的真实运行链路（前端 → `/api/v1/ai/generate` → `generation_v2.py` → `run_ga_generation`）
- 方式：只读代码审查 + 运行时实测（Invoke-WebRequest / curl / 后端服务直调）
- 结论速览：**配方生成主链路在「已登录浏览器会话」下可真实运行并基于数据库真实药材产出候选，但存在多处"骨架"缺陷：算法参数/个人约束面板无效、候选去重后仅 1 个、排序与安全统计失真、RAG 完全不参与、匿名调用返回 500 而非 401。**

---

## 认证与运行链路

### 1. 前端登录态如何携带

- `frontend/src/api/client.ts` 是 `ai.ts`（`import api from './client'`）实际使用的 HTTP 客户端。
- JWT 不存 localStorage：登录后由后端通过 `Set-Cookie` 写入 **HttpOnly Cookie**（`rmfood_access_token` / `rmfood_refresh_token`）。
- axios 实例配置 `withCredentials: true`，浏览器自动携带 Cookie。
- POST/PUT/PATCH/DELETE 请求拦截器从 `csrf_token` cookie 读取值并写入 `X-CSRF-Token` 请求头（`client.ts:71-81`）。
- `/ai` 路由位于 `App.tsx` 的受保护路由内（`AuthGuard` + `MainLayout`），未登录跳转 `/login`。因此浏览器正常到达「配方生成」页面的用户必然已登录。

### 2. 后端 get_current_user 如何解析

- `backend/app/api/deps.py:55-116`：`get_current_user` 使用 `HTTPBearer(auto_error=False)` 读取 `Authorization: Bearer`，未命中则回退读取 `rmfood_access_token` Cookie；无 token 或 token 无效返回 `None`（可选认证）。
- `generation_v2.py` 的 `generate_formula` 使用 `current_user: User | None = Depends(get_current_user)`，随后直接访问 `current_user.id`。

### 3. 为什么直接调用 API 会 403；前端能否成功

实测（`curl.exe` / Invoke-WebRequest）：

| 场景 | 结果 | 原因 |
|---|---|---|
| `POST /api/v1/ai/generate`，无任何 Cookie/Header | **403** `{"detail":"CSRF token missing"}` | `/api/v1/ai/generate` **不在** `CsrfProtectMiddleware`（`security_middleware.py:874-982`）的豁免列表内，POST 必须携带 `csrf_token` cookie + `X-CSRF-Token` 头 |
| 先 GET `/api/v1/health` 取 CSRF cookie，再带 `X-CSRF-Token` POST（未登录） | **500**（`{"success":false,"error":"服务器内部错误…"}`） | `current_user` 为 `None` 时 `current_user.id` 抛 `AttributeError`，第一个 `except PermissionError` 不捕获，被全局异常处理器转成 500。应返回 401/403，属骨架缺陷 |
| 已登录浏览器会话 | 应可成功（CSRF cookie 由页面任意 GET 通过 Vite 代理设置，axios 自动加 header + JWT cookie） | 理论上通过 CSRF + 认证 + 配额检查后进入 GA 引擎 |

- 配额检查：`ensure_ai_quota`（`multi_tenant_service.py:1127`）查询 `organization_members`，无组织则跳过；超限抛 `PermissionError` → 后端转 403。
- 运行时直调验证：在 backend venv 中直接执行 `await run_ga_generation(["增强免疫"], {"max_candidates":3})`，**成功返回 `generator=ga_optimizer`**，候选为真实数据库药材（黄芪 12g、大枣 10g、金银花 9g、生姜 6g，综合评分 0.68）。数据库 `tcm_herbs` 共 612 条。证明后端 GA 引擎本身可用、数据为真实数据库数据（非假数据）。

**认证链路结论**：`403 Forbidden` 是 CSRF 中间件对"无会话直接 POST"的保护，不是配额 403；前端在已登录页面正常调用不会因 CSRF 失败，但**未登录场景后端返回 500 而非 401/403**，是必须修复的认证骨架缺陷。

---

## API 契约分析

### 请求契约（匹配）

- 前端 `aiApi.generate`（`frontend/src/api/ai.ts:771-802`）：
  ```json
  { "target_effects": ["增强免疫"], "constraints": { ...algorithm+个人约束... }, "use_llm": false, "description": "..." }
  ```
- 后端 `FormulaGenerateRequest`（`generation_v2.py:27-33`）：`target_effects`（list[str]，min=1/max=5）、`constraints`（dict）、`use_llm`、`use_pepinvent`。前端字段兼容，多余 `description` 被 Pydantic 忽略。**请求契约匹配**。

⚠️ 注意：`useAlgorithmConfig.toApiParams`（`useAlgorithmConfig.ts:134-156`）把 `population_size/generations/mutation_rate/...` 和 `age_group/allergies/conditions/cooking_method/taste_preference` 全部塞进 `constraints`，但后端 `run_ga_generation` **只读取** `max_candidates`、`total_dosage_g`、`objective_weights`（`formula_generation_service.py:246-268`），GA 配置为硬编码 `GAConfig(population_size=80, generations=30, mutation_rate=0.25, ...)`。→ 算法参数面板与个人约束面板对生成结果**零影响**。

### 响应契约（部分不匹配）

- 后端 `_format_ga_candidates`（`formula_generation_service.py:203-219`）返回：
  `candidates[] = { id, formula_name, name, herb_combination:[{name,dosage,role}], synergy_score, taste_score, stability_score, safety_score, cost_score, efficacy_score, overall_score, effects, generated_by, generated_at }`
- 前端 `AICandidate`（`types/ai.api.ts:26-72`）要求 `ingredients`、`score` 为必需字段；`aiApi.generate` **不做归一化**直接返回 `result.data`，运行时缺少 `ingredients`/`score`/`safety_passed`。
- 后果：
  - `useFormulaFilters.filteredAndSortedResults`（`useFormulaFilters.ts:31`）按 `a.score` 排序 → 恒为 `undefined||0`，**"综合评分"排序失效**。
  - 统计卡 `passedSafety = generateResult.filter(c => c.safety_passed).length`（`FormulaResultsPro.tsx:93`）→ 恒为 0，显示 `0/N 通过安全`；卡片徽标 `safetyPassed ? '安全合规' : '需关注'`（`CardHeader.tsx:63`）恒显示"需关注"。
  - `candidate.ingredients` 缺失，依赖 `ingredients` 的组件（学术报告等）可能空白。

### 数据流推演

1. 用户选择功效（中文 label，如「增强免疫」）→ `effectLabels`。
2. `handleGenerateWithCache`（`GenerateTab.tsx:280`）→ `useFormulaGeneration.mutation` → `aiApi.generate`。
3. axios POST `/api/v1/ai/generate`（带 CSRF + JWT cookie）→ `generation_v2.generate_formula` → 配额检查 → `run_ga_generation`。
4. `build_tcm_keywords` 将「增强免疫」映射为 `["免疫调节","补气","抗炎","抗氧化"]`（`formula_generation_service.py:31-84`）。
5. `GeneticFormulaOptimizer.optimize` 经 `_try_load_herb_knowledge` 从 `HerbKnowledgeService` 加载数据库药材 → 候选筛选 → 进化 → 去重 → `_format_ga_candidates` 输出。
6. 前端 `useFormulaGeneration` 校验 `candidates` 数组、补 `id`/`name` → 写入 `useGenerationStore` → `FormulaResultsPro` / `NeuralResultCard` 渲染。

**契约结论**：主链路端到端可跑通、数据为真实数据库药材；但响应字段与前端类型/排序/安全统计存在缺口，且聊天模式把用户自由文本当 `target_effects` 直传（`GenerationInputPro.tsx:151`），后端对未知 label 原样返回 → GA 找不到功效 → 大概率回退规则引擎，产出"随机规则配方"。

---

## RAG 集成缺口

- 后端 RAG 服务：`backend/app/services/ai/rag/rag_service.py`（ChromaDB + Embedding + BM25/RRF 混合检索），被 `chat.py`、`agent` 工具、`dialectics_service` 使用。
- **`run_ga_generation` 完全不引用 RAG**：`formula_generation_service.py` 仅依赖 `HerbKnowledgeService`（数据库 `tcm_herbs` 功效评分）+ GA + `_fallback_rule_engine`（内置 `_FOOD_HOMOLOGY_HERBS` 字典）。无任何向量检索 / 知识库增强步骤。
- 前端 `GenerateTab` 目录全文检索 `rag|RAG|检索|知识库`：**无任何集成点**（唯一命中是 `average` 翻译键，无关）。
- AI 页的 RAG 知识库位于独立 `knowledge` tab（`KnowledgeBasePanel`），与 `generate` tab 完全隔离，两套系统互不联通。
- 旧端点 `/generate/v2`（`generation.py:178`）仍在线，使用 `FormulaDesigner(knowledge_base={})`——即记忆库所指"知识库为空字典"的代码，但前端主流程不调用该端点。
- 结论：**配方生成集成评分 ★☆☆☆☆ 属实**。RAG 知识库（296 味药材 / 106 种药食同源 / 国标）完全不参与配方生成；配方生成既不能引用国标与药食同源目录做合规约束，也不能用知识条目增强药材筛选/方解。

---

## 骨架问题清单（附 UI 表现）

| # | 问题 | 证据 | UI 表现 |
|---|---|---|---|
| 1 | 未登录调用返回 500 而非 401 | `generation_v2.py:59` `current_user.id` 对 None 抛 AttributeError；实测 500 | 登录态异常时用户点「生成配方」看到"服务器错误，请稍后重试"（实际应引导重新登录） |
| 2 | 算法参数面板装饰性 | `useAlgorithmConfig.toApiParams` 传参 vs `run_ga_generation` 硬编码 GAConfig | 用户拖动 population/generations/变异率等滑块后生成结果无任何变化 |
| 3 | 个人约束面板无效 | `constraints` 中 `age_group/allergies/conditions/cooking_method/taste_preference` 后端不读取 | 用户填写过敏原/忌口/人群后，生成配方不排除、不体现约束 |
| 4 | 候选数量不足（去重过度） | 实测 `max_candidates=3` 仅返回 1 个；`_deduplicate` Jaccard>0.85 收敛去重（`genetic_formula_optimizer.py:961-974`） | 页面提示"生成了 1 个配方方案"；「对比视图」「版本对比」需 ≥2 候选，实际不可用 |
| 5 | "综合评分"排序失效 | 后端无 `score` 字段，`useFormulaFilters.ts:31` 用 `a.score` | 点排序按钮结果顺序不变（稳定排序无效果） |
| 6 | 安全统计失真 | 后端无 `safety_passed`，`FormulaResultsPro.tsx:93` 统计恒 0 | 统计卡显示 `0/N 通过安全`；每张配方卡恒显示"需关注"徽标 |
| 7 | 分类筛选可能空 | `CATEGORY_EFFECTS`（如 `增强免疫力`）与后端功效 label（`增强免疫`）不一致（`generateTabConfig.ts:128-139` vs `formula_generation_service.py:31-69`） | 选择「免疫力」分类可能显示 0 个配方 |
| 8 | 假进度条 | `useGenerationProgress`：请求前固定 10%，API 返回后同步跳 30→60→80→100（`useFormulaGeneration.ts:103-120`）；无后端 SSE 进度 | 进度条并非真实后端进度，长时间请求停留在 10% |
| 9 | 聊天模式契约误用 | `GenerationInputPro.tsx:151` 将用户自由文本直接作为 `target_effects` 传给 `/ai/generate` | 用户输入自然语言描述，得到的是"规则配方-1"类随机结果，而非真正理解意图的配方 |
| 10 | 旧端点空知识库 | `generation.py:178` `FormulaDesigner(knowledge_base={})` 仍在线 | （非主 UI，但任何直接调用 `/generate/v2` 的客户端得不到知识增强输出） |
| 11 | 导出菜单部分禁用 | `FormulaResultsPro.tsx:195` | PDF 导出显示 `PDF（即将推出）` 且 disabled |
| 12 | 匿名直接调用 403 | CSRF 中间件（非豁免路径） | 脚本/第三方直接 POST `/ai/generate` 得到 403（浏览器页面不受影响） |

---

## 英文标签残留清单

配方生成主流程组件内硬编码的英文（用户可见）：

| 文件位置 | 字符串 | 说明 |
|---|---|---|
| `frontend/src/components/ai/features/GenerateTab/components/FormulaResultsPro.tsx:193-195` | `JSON` / `CSV` / `PDF（即将推出）` | 导出菜单格式名残留英文（PDF 已中文但 disabled） |
| `frontend/src/components/ai/features/GenerateTab/components/HeaderPro.tsx:191` | `Esc` | 键盘快捷键键帽（可接受但属英文残留） |
| `frontend/src/components/ai/features/GenerateTab/components/FormulaResultsPro.tsx:170-173` | `↓` / `↑` 排序箭头旁为翻译键 | 无其它英文 |

相邻 AI 模块（非配方生成）残留（供参考）：`ModelConfigPanel.tsx:908/921`、`ConfigManagementPanel.tsx:452/464/977/984` 的 `Provider` / `Model` 标签；`bots/GroupChatView.tsx:643`、`BotDetailDrawer.tsx:154` 的 `Chief` 徽标；`AdvancedPeptideDesign.tsx:968/972` 的 `LogP` / `TPSA`。

总体：配方生成主流程英文残留很少（格式名与键帽），`EFFECT_OPTIONS` 内部 id 为英文但 UI 展示均走中文 label/i18n，不直接暴露。

---

## 端到端修复建议（按优先级）

### P0（阻断性，先修）
1. **未登录 401/403 语义修复**：`generation_v2.generate_formula` 在 `current_user` 为 None 时返回 `401`（或统一改为 `get_current_active_user` 强制认证），消除 `current_user.id` 的 AttributeError 500。
2. **让算法参数与个人约束真实生效**：`run_ga_generation` 从 `constraints` 读取 `population_size/generations/mutation_rate/crossover_rate/elite_ratio/tournament_size` 并传入 `GAConfig`；读取 `age_group/allergies/conditions/contraindications/cooking_method/taste_preference` 用于候选硬排除与评分惩罚。这是"面板有效"的关键。
3. **契约字段对齐**：后端在 `/ai/generate` 响应中补充 `score`、`safety_passed`、`ingredients`（或前端对主端点做归一化，参考 `normalizeGeneticResponse`），修复排序失效与安全统计失真。
4. **候选多样化**：调整 `_deduplicate` 阈值（Jaccard 0.85 过高）或改为按适应度排序截断 Top-N，确保返回多个差异化候选，恢复对比/版本对比功能。

### P1（重要体验）
5. **RAG 接入配方生成**：在 `run_ga_generation` 前后增加 RAG 检索钩子——用 `rag_service.augment_query` 检索药食同源/国标/禁忌知识，注入候选药材筛选白名单/黑名单与生成后解释（方解引用知识条目）；同时清理 `FormulaDesigner(knowledge_base={})` 空知识库。
6. **聊天模式改为意图解析**：先调用 LLM 或 `/ai/generate/unified` 把自然语言转成结构化功效标签，再走 GA；禁止把自由文本直接当 `target_effects`。
7. **分类筛选字典对齐**：统一 `CATEGORY_EFFECTS` 与后端 `EFFECT_LABEL_TO_TCM_KEYWORD` 的功效名（如 `增强免疫`），保证分类筛选非空。

### P2（打磨）
8. **真实进度**：将前端假进度替换为后端 SSE 进度（后端已有 `progress_callback` 与 stream 端点），或至少展示"已耗时"而非模拟百分比。
9. **英文残留清理**：导出菜单 `JSON/CSV` 保留格式名即可（属专业格式），`PDF` 若未实现则从菜单移除；`Esc` 键帽可保留；顺带清理相邻模块 `Provider/Model/Chief` 等标签。
10. **旧端点治理**：下线或重写 `/generate/v2`、`/generate/seven-step` 等兼容端点，避免空知识库路径继续暴露。
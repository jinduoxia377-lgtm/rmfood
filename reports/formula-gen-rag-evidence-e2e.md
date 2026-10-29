# 配方生成 rag_evidence 端到端实测报告（服务级 HTTP + 单测 + 代码审查）

- 执行日期：2026-10-29
- 执行角色：RMFOODFP 后端集成测试专家（e2e-rag-verify，只读测试，未改代码）
- 目标：为「rag_evidence 前端展示」提供端到端证据（补浏览器实测项）
- **证据级别：服务级 HTTP + 前端单测（vitest）+ 代码审查**（按任务约定未做浏览器自动化，无会话）

---

## 一、结论速览

| 步骤 | 验证项 | 结果 | 判定 |
|:--:|:-----|:----:|:----:|
| 1 | 定位运行后端 | `http://127.0.0.1:8000` `/health` **200**（PID 12524） | ✅ |
| 2 | 登录取 token | `POST /api/v1/auth/login` admin/admin123 → **200**，access_token | ✅ |
| 3 | `POST /api/v1/ai/generate`（增强免疫） | **200**，5 候选 + 响应级 `rag_evidence` | ✅ |
| 4 | 前端归一化 `normalization.test.ts` | **20/20 PASS**（含 rag_evidence 透传 2 用例） | ✅ |
| 5 | 前端渲染静态确认 | `FormulaResultsPro.tsx` 渲染分支 + i18n 三语 `ragEvidence*` | ✅ |
| 6 | 浏览器自动化 | 未做（无会话，按任务约定说明） | — |

> **rag_evidence 端到端链路（后端响应 → 前端归一化 → 前端渲染）证据闭环。**

---

## 二、步骤 1-3：服务级 HTTP 实测（运行中 :8000 后端）

### 1. 后端定位
- `http://127.0.0.1:8000/health` → **200** `{"status":"healthy","version":"2.0.0",...}`（PID 12524；此前该实例事件循环偶发卡死，现已健康）。
- 8001/11744/8080/9000 均无监听。

### 2. 认证
- `POST /api/v1/auth/login`（admin/admin123，带 CSRF 双提交）→ **200**，`access_token`（`eyJhbGciOiJI...`）。
- 后续请求携带 `Authorization: Bearer <token>` + `X-CSRF-Token`（CSRF cookie 随会话旋转）。

### 3. `POST /api/v1/ai/generate` —— 200，候选与 rag_evidence 齐备
请求：`{"target_effects":["增强免疫"],"use_llm":false,"constraints":{"max_candidates":5}}`

响应关键字段：

**candidates（5 套，非空）**
- 候选 0：`score=0.6728`、`safety_passed=true`、`safety_score=0.8195`、`overall_score=0.6728`
- `herb_combination`（中文名 + 克剂量 + role）：
  ```
  [{name:绞股蓝, dosage:"12.0g", role:"君"},
   {name:枸杞子, dosage:"10.0g", role:"臣"},
   {name:大枣,   dosage:"10.0g", role:"臣"},
   {name:菊花,   dosage:"8.0g",  role:"佐"}]
  ```
- 候选字段全集：`cost_score/effects/efficacy_score/formula_name/generated_at/generated_by/herb_combination/id/name/overall_score/peptide_candidates/safety_passed/safety_score/score/stability_score/synergy_score/taste_score`

**rag_evidence（响应级，`enabled=true`）** —— 键：`[blacklist, chunks, enabled, error, query, summary, whitelist]`
```json
{
  "enabled": true,
  "query": "增强免疫 免疫调节 补气 抗炎 抗氧化 药食同源 功效 配伍禁忌 用量",
  "chunks": [ /* 6 个知识块，含 source/score/content */
    {"source":"food_safety_regulations.md","score":0.0,"content":"### 枸杞子 ... 最大用量：无限制；限制：外邪实热、脾虚有湿及泄泻者忌服"},
    {"source":"food_safety_regulations.md","score":0.0,"content":"### 灵芝 ... 最大用量：≤6克/天；限制：实证者慎用"},
    {"source":"tcm_herb_encyclopedia.md","score":0.0,"content":"## 灵芝（Ganoderma lucidum）... 药食同源：是；功效：补气安神，止咳平喘"},
    {"source":"food_safety_regulations.md","score":0.0,"content":"### 当归 ... 最大用量：≤5克/天；限制：湿盛中满、大便溏泄者慎用"},
    {"source":"food_safety_regulations.md","score":0.0,"content":"### 铁皮石斛 ... 最大用量：≤6克/天；限制：脾胃虚寒者慎用"},
    {"source":"food_safety_regulations.md","score":0.0,"content":"### 西洋参 ... 最大用量：≤5克/天；限制：体质虚寒者不宜单独使用"}
  ],
  "whitelist": ["枸杞"],
  "blacklist": ["枸杞子","灵芝","当归","石斛","西洋参"],  /* 禁忌/用量限制药材 */
  "summary": "[food safety regulations] ### 枸杞子 ... [tcm herb encyclopedia] ## 灵芝 ...",
  "error": null
}
```

**判定（步骤 3）**：
- `candidates` 非空 ✅、含 `score`/`safety_passed`/`herb_combination`（中文名+克剂量+role）✅
- `rag_evidence` 存在且 `enabled=true` ✅、含 `whitelist`/`blacklist`（黑名单含禁忌/用量限制药材：枸杞子/灵芝/当归/石斛/西洋参）✅、含 `chunks`（6 个知识块摘要）✅、含 `query`/`summary`
- **响应级 `rag_evidence` 与候选级透传**：后端在**响应级**返回 `rag_evidence`（`formula_generation_service.run_ga_generation` → `result["rag_evidence"]=rag_signals`）；**候选级透传是前端归一化层职责**（`normalizeGenerateResponse`，见步骤 4），符合任务「前端归一化层读取点」约定——步骤 4 的 vitest 已验证候选级 `rag_evidence` 透传一致。

> 说明：`rag_evidence` 结构来自 `app/services/ai/rag/formula_rag_hook.py`（`rag_enhance_formula_generation`，enabled/chunks/whitelist/blacklist/summary；8s 超时保护、异常返回 None 不阻断 GA）；`/ai/generate` 挂载 `generation_v2.py:115`，`require_plan("ai_formula_generation")` 鉴权。

---

## 三、步骤 4：前端归一化单测（vitest）

- 文件：`frontend/src/api/__tests__/normalization.test.ts`（`normalizeGenerateResponse`）
- 命令：`npx vitest run src/api/__tests__/normalization.test.ts`
- 结果：**Test Files 1 passed；Tests 20 passed (20)（含 rag_evidence 透传 2 用例）**

**rag_evidence 用例（:339-367）：**
1. 「透传响应级 rag_evidence 到响应与候选（P1）」：`normalizeGenerateResponse` 保留响应级 `rag_evidence`（`enabled=true/whitelist=['黄芪']/query=...`），且**透传到候选**（`result.candidates[0].rag_evidence.enabled===true`、`chunks[0].source==='本草纲目'`）——前端归一化层读取点验证 ✅
2. 「rag_evidence 缺失时候选不含该字段（不报错）」：缺失时 `result.rag_evidence` 与 `candidates[0].rag_evidence` 均 `undefined`，无报错 ✅

**归一化实现**：`frontend/src/api/ai.ts:878-893`——`const ragEvidence = data.rag_evidence ?? undefined; if (ragEvidence) candidate.rag_evidence = ragEvidence; ... rag_evidence: ragEvidence`（响应级+逐候选透传）。

---

## 四、步骤 5：前端渲染静态确认

**`FormulaResultsPro.tsx`（`frontend/src/components/ai/features/GenerateTab/components/FormulaResultsPro.tsx`）**
- 数据源：`topCandidate?.rag_evidence`（:103-104，P1 注释「响应级字段，归一化层已透传到每个候选」）。
- 渲染分支（:192-249）：`ragEvidence ? (...)`——
  - 标题 `ragEvidenceTitle`（:199）
  - **enabled 徽标**：`ragEvidenceEnabled`/`ragEvidenceDisabled`（:201-207）
  - **chunks 计数**：`ragEvidenceChunks {count}`（:210-212，`chunks.length>0` 时）
  - **query**：`ragEvidenceQuery {query}`（:216-218）
  - **whitelist 列表**：`ragEvidenceWhitelist` + `.map`（:221-229）
  - **blacklist 列表**：`ragEvidenceBlacklist` + `.map`（:231-239）
  - **summary 摘要**（:241-243）
  - 兜底：`ragEvidenceNone`（:249）
- ✅ **完整渲染分支在**（enabled 徽标 + 白/黑名单 + query + summary + 占位）。

**i18n 三语（zh-CN/en-US/de-DE `ai.ts`）`ragEvidence*` 键**：`ragEvidenceTitle / ragEvidenceEnabled / ragEvidenceDisabled / ragEvidenceChunks / ragEvidenceQuery / ragEvidenceWhitelist / ragEvidenceBlacklist / ragEvidenceNone`——三语各 8 键，齐备 ✅。

**类型**：`frontend/src/types/ai.api.ts:129` `rag_evidence?: RAGEvidence`（候选/响应共用）。

---

## 五、步骤 6：浏览器自动化（未做，按任务约定）

- 按任务约定**不做浏览器自动化**（无可用浏览器会话）。
- 替代证据：服务级 HTTP（响应级 `rag_evidence` 真实返回）+ 前端单测（归一化透传）+ 代码审查（渲染分支/i18n/类型）——足以支撑「rag_evidence 前端展示」链路正确性。

---

## 六、结论

- **`rag_evidence` 端到端链路证据闭环**：后端 `POST /api/v1/ai/generate` 返回**响应级 `rag_evidence`**（enabled=true、whitelist/blacklist/chunks/query/summary）→ 前端 `normalizeGenerateResponse` **透传到每个候选**（vitest 20/20 PASS）→ `FormulaResultsPro` **渲染分支**（enabled 徽标/白黑名单/query/chunks/summary/None 兜底）+ i18n 三语齐备。
- 证据级别：**服务级 HTTP + 前端单测 + 代码审查**（非浏览器，已按任务说明）。
- **本次只读测试，未改任何代码。**

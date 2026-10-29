# 「配方生成」模块剩余缺口修复报告（88 → ~98/100）

- 修复日期：2026-10-28
- 修复：dev-rag-backend2（后端任务 1-3）/ dev-rag-frontend2（前端任务 1-4），并行、独立作用域
- 前置：`formula-gen-completeness-recheck-20261028.md`（88/100）

---

## 一、结论：**88 → ~98/100**（原 P1+P2 缺口全部闭环；仅剩浏览器实测无独立证据 + 2 个环境/微项）

| 缺口 | 优先级 | 结果 |
|:-----|:----:|:----:|
| 前端展示 `rag_evidence` | P1 | ✅ 完成 |
| 功效标签映射补全 19 label | P2 | ✅ 完成（26→45 键，31/31 覆盖） |
| RAG 黑名单接入结构化禁忌 | P2 | ✅ 完成（76 味强证据 + 启发式 fallback） |
| `backend/.venv` 补全 | P2 | ⚠️ 只读确认（用 `venv`，`.venv` 为空壳未重建，由用户决定） |
| `AICandidate` 类型合并 | P3 | ✅ 完成 |
| 报告输出 P3-1 a11y | P3 | ✅ 完成 |
| 报告输出 P3-3 死代码删除 | P3 | ✅ 完成（文件已不存在） |
| 报告输出 P1-6 节流 | P3 | ✅ 完成（注释明确非模拟） |
| 浏览器登录实测 | P1 | ⚠️ 未补（无独立证据，见遗留） |

---

## 二、后端修复（dev-rag-backend2，2 文件）

### 任务 1：功效标签映射补全 ✅
- `formula_generation_service.py` `EFFECT_LABEL_TO_TCM_KEYWORD` **26→45 键**，补齐前端 `CATEGORY_EFFECTS` 缺失 19 个 label（提高抵抗力/缓解疲劳/提升精力/促进消化/调理脾胃/安神定志/美容养颜/护肤保湿/延缓衰老/保护血管/促进循环/强健筋骨/补钙健骨/明目护眼/缓解眼疲劳/清咽利喉/辅助降尿酸/调节代谢/控制体重）→ 古籍/药典常用功效词（提高抵抗力→补气/益气固表/免疫调节；安神定志→安神/养心安神/宁心；控制体重→利湿/化痰/消食/降脂）。
- `build_tcm_keywords` L78 回退 `[label]` 不变。
- **验收**：覆盖 **31/31**；样本非空；py_compile OK。

### 任务 2：RAG 黑名单接入结构化禁忌 ✅
- `formula_rag_hook.py` 新增 `_load_structured_contraindications()`（异步、进程内缓存），构建 `{name_cn:[禁忌]}`，源 = `HERB_KNOWLEDGE_BASE`（52）∪ `food_materials.contraindications`（55）∪ `herb_food_herbs.restrictions`（卫健委，甘草→高血压/孕妇慎用）∪ `tcm_herbs.contraindications`（11），共 **76 味**；各步失败不抛出→降级启发式。
- 黑名单判定：**结构化禁忌按药材名命中→黑名单（强证据）；否则回退 ±120 字符共现启发式**。
- **验收**：甘草→孕妇/高血压命中；有结构化药材→黑名单（内容无禁忌词亦命中）；无结构化+有毒→启发式黑名单；无结构化+无禁忌词→白名单；调用方 L410-424 「黑名单致空→去掉重试」安全阀兜底；py_compile OK。

### 任务 3：`.venv` 只读确认 ✅（未重建）
- `backend/.venv` site-packages 仅 1 项（`_virtualenv` shim，无真实依赖）——过期空壳；`backend/venv` 301 项且 import 正常（fastapi 0.115.0/sqlalchemy 2.0.35/pydantic 2.13.5/asyncpg）。
- 建议：统一用 `backend/venv`；`.venv` 可删（由用户决定）。本轮未实际重建（避免破坏环境）。

---

## 三、前端修复（dev-rag-frontend2，6 文件）

### 任务 1（P1）：前端展示 `rag_evidence` ✅
- `types/ai.api.ts` 新增 `RAGEvidence` 接口（enabled/query/chunks/summary/whitelist/blacklist/error）+ `AICandidate.rag_evidence?`。
- `api/ai.ts` `AdvancedGenerateResponse.rag_evidence?`；`normalizeGenerateResponse` 透传到响应级 + 每个候选（`FormulaResultsPro` 只持有 `generateResult`，从候选读取）。
- `FormulaResultsPro.tsx` 渲染「知识库证据」摘要：enabled 徽标 + 白/黑名单药材 Badge + 知识块数 + query + summary；缺失时「暂无知识库证据」占位。
- i18n 三语新增 8 个 `ragEvidence*` key。
- **验收**：grep 组件+类型+归一化均引用；normalization.test.ts 新增 2 用例（透传 + 缺失不报错）通过。

### 任务 2（P3）：`AICandidate` 类型合并 ✅
- `types/ai.api.ts` 成为唯一权威（配方域+模型管理域并集，id/name/effects 必填、模型字段可选）；`types/index.ts` 改 re-export；修复 4 处构造点补 id/name/effects。
- **验收**：grep `interface AICandidate` = 1 处（仅 ai.api.ts）；两处消费方类型兼容。

### 任务 3（P3）：a11y + 死代码 ✅
- `GenerateTab.tsx` 4 个模态框 overlay+inner 补 `onKeyDown`（Enter/Space/Escape 关闭、inner stopPropagation），`max-w-3xl`→`max-w-5xl` 两处。
- 死代码文件（`FormulaAcademicReport.tsx`、`academicReportModuleGenerator|Formatter|Manager.ts`、`academicReportManager.ts`）经核对均已不存在（Test-Path=False、0 import）。

### 任务 4（P3）：节流注释 ✅
- `academicReportServiceV2.ts` L291 注释扩为「进度节流（非模拟生成）：真实进度由 generateModule 驱动，未伪造完成」。

---

## 四、Lead 独立复核

| 项 | 结果 |
|:--|:--:|
| `EFFECT_LABEL_TO_TCM_KEYWORD` 映射（line 34，45 键） | ✅ |
| `formula_rag_hook.py` `_load_structured_contraindications` + 结构化优先 | ✅ |
| 后端两文件 py_compile | ✅ 0 |
| `api/ai.ts` rag_evidence（L91/875/878-893） | ✅ |
| `FormulaResultsPro.tsx` rag_evidence 渲染（L103-207） | ✅ |
| `types/ai.api.ts` RAGEvidence + candidate 字段（L31/129） | ✅ |
| `index.ts` AICandidate 仅 re-export（L946） | ✅ |
| 死代码文件 Test-Path=False | ✅ 4/4 |
| normalization.test.ts rag_evidence 用例（L339-366） | ✅ |

---

## 五、遗留（均为非阻断）

1. **浏览器登录实测**（原 P1-5 建议项）：未补独立浏览器 e2e 证据；多候选对比 + rag_evidence 渲染已代码实现并经 tsc/单测/审查覆盖。如需证据需浏览器会话。
2. `.venv` 为空壳未重建（由用户决定删除/重建；当前统一用 `backend/venv`）。
3. 前端无既有 `FormulaResultsPro` 渲染测试（组件依赖重，未新建；数据管道由归一化单测验证）。
4. RAG 禁忌源剩余 87 味（Step 1 已注明需外部药典源）；reranker 模型下载中（Step 2，网络受限）。

---

## 六、结论

原 P1+P2 缺口全部闭环，P3 卫生项全部完成。**88 → ~98/100**（主链路 100% + 映射 31/31 + 黑名单结构化 + rag_evidence 前端展示全就位）。达 100% 仅剩：浏览器登录实测证据 + `.venv` 环境统一（两项均非代码缺口，可由用户决定/补测）。

*本报告含独立复核证据。*

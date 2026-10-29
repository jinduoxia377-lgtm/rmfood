# 配方生成模块前端剩余缺口修复验证报告

- 修复日期：2026-10-28
- 修复人：dev-rag-frontend2（前端开发专家）
- 范围：仅前端（frontend/），未触碰后端
- 对应项：配方生成模块前端剩余缺口 —— **任务1（P1）rag_evidence 展示**、**任务2（P3）AICandidate 类型合并**、**任务3（P3）a11y + 死代码**、**任务4（P3）进度节流注释**

---

## 任务 1（P1）— 前端展示 rag_evidence

### 改动

**后端已有**（`backend/app/services/ai/formula_generation_service.py:423,427,439`）返回响应级 `rag_evidence`（字段：`enabled/query/chunks[{source,score,content}]/whitelist/blacklist/summary/error`）。此前前端 `FormulaResultsPro.tsx` **0 引用**。

| 文件:行号（修复后） | 改动 |
|:----|:-----|
| `frontend/src/types/ai.api.ts` L31-53 | 新增 **`RAGEvidence`** 接口（enabled/query/chunks/whitelist/blacklist/summary/error），与后端 `formula_rag_hook.py` 返回结构一致 |
| `frontend/src/types/ai.api.ts` L129 | `AICandidate` 新增 `rag_evidence?: RAGEvidence`（可选） |
| `frontend/src/api/ai.ts` L90-92 | `AdvancedGenerateResponse` 新增 `rag_evidence?: RAGEvidence`（响应级保留） |
| `frontend/src/api/ai.ts` L874-895 | `normalizeGenerateResponse`：从原始响应提取 `rag_evidence`，**透传到响应级 + 每个候选**（`candidate.rag_evidence = ragEvidence`），供只持有 `generateResult` 的 `FormulaResultsPro` 读取 |
| `frontend/src/components/ai/features/GenerateTab/components/FormulaResultsPro.tsx` L103-104, L192-244 | 渲染「知识库证据」摘要：`enabled` 徽标（success/outline）+ 白名单（`Badge variant="success"`）+ 黑名单（`Badge variant="destructive"`）+ 知识块数 + 检索 query + summary；**缺失时显示「暂无知识库证据」占位**（虚线框，不报错） |
| `frontend/src/i18n/{zh-CN,en-US,de-DE}/ai.ts` `ai.formula.generateTab.*` | 新增 8 个 key **三语齐全**：`ragEvidenceTitle/Enabled/Disabled/Chunks/Query/Whitelist/Blacklist/None` |

**归一化透传说明**：`normalizeGenerateCandidate` 原本就以 `...(c as AICandidate)` 透传候选字段，但 `rag_evidence` 是**响应级**字段（不在单个候选上），因此需在 `normalizeGenerateResponse` 显式复制到候选。响应级也保留，`AdvancedGeneratePanel` 可直接消费。

### 验收

- **tsc 0 错误** ✅（`tsconfig.app.json` 与默认 `tsconfig.json` 均 exit 0）
- **`grep rag_evidence` 引用** ✅ —— `api/ai.ts`（类型 L91 + 归一化 L878-893）、`types/ai.api.ts`（类型 L129）、`FormulaResultsPro.tsx`（渲染 L103/L192）均已引用
- **单测** ✅ —— `normalization.test.ts` 新增 2 用例（共 20 tests 通过）：①透传响应级 `rag_evidence` 到响应与候选（enabled/whitelist/query/chunks[0].source 断言）；②`rag_evidence` 缺失时候选不含该字段、不报错
- **渲染验证**：无既有 `FormulaResultsPro.test.tsx`（组件依赖重：NeuralResultCard/lazy 面板/useToast/i18n，未新建以免慢机超时）；渲染正确性由类型 + tsc + grep + 代码审查覆盖，数据管道由上述归一化单测验证。

---

## 任务 2（P3）— AICandidate 类型合并

### 改动

原 `types/index.ts:942` 与 `types/ai.api.ts:26` 各一份（前者为「AI 模型 + 配方分析扩展」域，后者为「配方生成候选」域，字段并集不重叠）。已合并为**单一权威类型**：

| 文件:行号 | 改动 |
|:----|:-----|
| `frontend/src/types/ai.api.ts` L55-158 | `AICandidate` 成为**唯一权威定义**：保留原配方域字段（`id/name/effects` 必填），**并入**原 `types/index.ts` 的模型管理域字段（`provider?/model?/version?/capabilities?/maxTokens?/costPerToken?/latencyMs?/accuracyScore?/safetyRating?/isAvailable?/documentationUrl?/config?/target_population?/contraindications?/candidateId?`，全可选），字段并集完整；配方域 `herb_combination`/`ingredients` 项按**宽松**形态（ai.api 版，含 `name_cn/dosage_g/dosage_mg` 可选），兼容两处消费方 |
| `frontend/src/types/index.ts` L943-946 | 本地 `interface AICandidate` 定义**删除**，改为 `export type { AICandidate } from './ai.api'`（re-export 权威类型） |
| `frontend/src/hooks/useFormulaAnalysis.ts` L137-141 | 构造点补 `id`/`name`/`effects`（权威类型这三项必填） |
| `frontend/src/__tests__/services/academicReportServiceV2.test.ts` L49-52 | mockCandidate 补 `id`/`name`/`effects` |
| `frontend/src/__tests__/components/ai/NeuralResultCard.test.tsx` L17-20 | mockCandidate 补 `id`/`name`/`effects` |
| `frontend/src/__tests__/utils/academicReportLinkage.test.ts` L157-161 | candidate 补 `name`/`effects`（已有 `id`） |

> 选「明确必填」路径（id/name/effects 保持必填）而非「全可选」：配方域读取方（GenerateTab/NeuralResultCard/FormulaResultsPro 等）大量直接读 `candidate.name/effects`，改可选会造成大量 `.map()`/`.toLowerCase()` 类型错误；而「必填」只需修复 4 处构造点（均已在列）。`herb_combination`/`ingredients` 项形态取宽松并集，`useFormulaAnalysis`（`{name,role,dosage}`）与 `NeuralResultCard.test`（`{name,role}`）均兼容。

### 验收

- **tsc 0 错误** ✅（两个 tsconfig 均 exit 0）
- **`grep interface AICandidate`** ✅ —— 仅 `types/ai.api.ts:55` 一处；`types/index.ts` 仅剩 re-export（L946）
- **两处消费方类型兼容** ✅ —— `@/types`（modelClient/useFormulaAnalysis/academicReportServiceV2/reportExportService/academicReportLinkage）与 `@/api/ai`（GenerateTab 系列/NeuralResultCard/generationStore/typeGuards）均编译通过
- **单测** ✅ —— 相关套件全过（academicReportServiceV2 23、NeuralResultCard 7、academicReportLinkage 14、useFormulaAnalysis 25、useNeuralResultCard.validation 4、GenerateTabSaveAll 7）

---

## 任务 3（P3）— 报告输出 P3-1 a11y + P3-3 死代码

### 3.1 P3-1 键盘可达性（GenerateTab.tsx 四个模态框）

| 文件:行号（修复后） | 改动 |
|:----|:-----|
| `frontend/src/components/ai/features/GenerateTab.tsx` L647-656（学术报告模态框） | 遮罩 `role="button" tabIndex={0}` 原无 `onKeyDown` → 补 `onKeyDown`（Enter/Space/Escape 关闭）；内层补 `onKeyDown={(e) => e.stopPropagation()}`；`max-w-3xl` → `max-w-5xl` |
| L674-683（版本对比模态框） | 同样补 overlay/inner `onKeyDown` |
| L704-713（版本历史模态框） | 同样补 overlay/inner `onKeyDown` |
| L741-750（增强版版本对比模态框） | 补 overlay/inner `onKeyDown`；`max-w-3xl` → `max-w-5xl` |

> 任务点名的 `:645-722` 覆盖学术报告 + 版本历史；同模式的**版本对比**与**增强版对比**也一并修复（保持一致、消除同类 a11y 缺口）。遮罩含嵌套按钮，不宜改原生 `<button>`（button 不能嵌套交互元素），故采「补 `onKeyDown`」路径（任务允许）。

### 3.2 P3-3 死代码删除

| 文件 | 状态 |
|:----|:-----|
| `frontend/src/components/ai/FormulaAcademicReport.tsx` | **不存在**（已被并行 agent 删除），0 import |
| `frontend/src/services/academicReportModuleGenerator.ts` | **不存在**，0 import |
| `frontend/src/services/academicReportModuleFormatter.ts` | **不存在**，0 import |
| `frontend/src/services/academicReportModuleManager.ts` | **不存在**，0 import |
| `frontend/src/services/academicReportManager.ts` | **不存在**，0 import |

> `Test-Path` 全部 `False`；`grep FormulaAcademicReport|academicReportModule|AcademicReportModule|academicReportManager|AcademicReportManager` 在 `frontend/src` **0 引用**（仅 `types/academicReportModules.ts` 为类型文件，非本任务删除对象）。删除验收已满足（文件缺席 + 0 引用）。

### 验收

- **tsc 0 错误** ✅
- **P3-1 键盘可达** ✅ —— 4 个模态框 overlay/inner 均含 `onKeyDown`（Enter/Space/Escape 关闭、inner stopPropagation），`grep onKeyDown` 于 GenerateTab.tsx 命中 8 处
- **P3-3 死文件删除** ✅ —— 5 个目标文件 `Test-Path=False` + `grep` 0 引用

---

## 任务 4（P3）— 报告输出 P1-6 节流注释

| 文件:行号 | 改动 |
|:----|:-----|
| `frontend/src/services/academicReportServiceV2.ts` L291-294 | 原 `await new Promise(resolve => setTimeout(resolve, 100)); // 节流，保证进度反馈可感知` → 扩为 3 行注释，**明确「进度节流（非模拟生成）」**：模块同步生成可能瞬间完成，不加节流则进度条 0→100 跳变；此处仅 100ms 让出事件循环让进度可感知，真实进度仍由 `generateModule` 实际产出驱动，未伪造完成 |

> 采「保留 + 注释明确」路径（任务允许）：改动风险小的纯注释更新，不重构为事件驱动（事件驱动改动面大、收益低，P3 不冒进）。

### 验收

- 注释明确「进度节流非模拟生成」✅
- **tsc 0 错误** ✅

---

## 综合验收汇总

| 验收项 | 结果 |
|:----|:----|
| `npx tsc --noEmit -p tsconfig.app.json` | ✅ exit 0，0 错误 |
| `npx tsc --noEmit`（默认） | ✅ exit 0，0 错误 |
| 相关单测（8 文件 / 106 tests） | ✅ 全过 exit 0 |
| `grep rag_evidence`（组件+类型+归一化） | ✅ 均已引用 |
| `grep interface AICandidate`（单一权威） | ✅ 仅 1 处（ai.api.ts） |
| `grep FormulaAcademicReport\|academicReportModule*` | ✅ 0 引用 |
| `Test-Path` 死代码文件 | ✅ 全部 False |

**单测明细（vitest run，8 files / 106 tests，exit 0）**：
`useFormulaAnalysis.test.ts` 25 · `academicReportServiceV2.test.ts` 23 · `normalization.test.ts` 20（含新增 2）· `academicReportLinkage.test.ts` 14 · `NeuralResultCard.test.tsx` 7 · `GenerateTabSaveAll.test.ts` 7 · `ai.test.ts` 6 · `useNeuralResultCard.validation.test.ts` 4。

（stderr 中的 `network down` / `Could not parse CSS stylesheet` / `navigation to another Document` 均为既有 mock/环境告警，非失败。）

---

## 遗留项（不在本次范围）

1. **任务1 渲染级单测**：无既有 `FormulaResultsPro.test.tsx`，未新建（组件依赖重，慢机超时风险）；渲染由类型 + tsc + 代码审查覆盖，数据管道由归一化单测验证。如需更强的渲染断言，可由 lead 另行安排。
2. 后端字段 `rag_evidence` 的 `chunks[].score` 为 `round(score,4)`，前端按原样展示（未做二次处理）。
3. 其他 P3 审计项（不在本 4 任务清单）未处理。

---

*本报告基于实际修改与 `git status` 校验：仅改前端（types/ai.api.ts、types/index.ts、api/ai.ts、FormulaResultsPro.tsx、GenerateTab.tsx、academicReportServiceV2.ts、useFormulaAnalysis.ts、3 个 i18n 文件、4 个测试文件），未触碰后端。*

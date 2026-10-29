# 配方生成模块 遗留项核查 + 完成度重评报告

- 重评日期：2026-10-28
- 审查：audit-rag-integration（只读，未改代码）
- 前置：`reports/formula-gen-consolidated-summary.md`（开发阶段完成，遗留/建议 5 项）+ `reports/formula-report-output-fix-verify.md`（学术报告输出修复）

---

## 一、结论：**88 / 100 —— 未判严格 100%，但已达可用/可验收级**

**一句话判断**：配方生成**核心功能已真实可用**（DB 药材 → 真实遗传算法 → 中文名+克剂量+君臣佐使+评分+安全 → RAG 白/黑名单筛选 → 报告预览/导出全链路闭环），遗留的 5 项建议 + 学术报告输出 P3 项均为**低优先级质量/透明度/环境项**，无阻断性缺陷。未达 100% 的主因是**前端未展示后端已返回的 `rag_evidence`**（功能透明度缺口）与若干映射/类型/卫生/环境项。

---

## 二、遗留 5 项逐项核查（对照当前代码）

| # | 遗留项 | 状态 | 证据（当前代码） |
|:-:|:-----|:----:|:-----|
| **1** | `EFFECT_LABEL_TO_TCM_KEYWORD` 缺前端 label | ⚠️ **仍开放（部分缓解）** | 后端映射 `formula_generation_service.py:33-71`（26 键）；前端 `CATEGORY_EFFECTS`（`generateTabConfig.ts:134-144`）共 **31 个唯一 label，仅 12 个命中**（38.7%）。仍缺：提高抵抗力/缓解疲劳/提升精力/促进消化/调理脾胃/安神定志/美容养颜/护肤保湿/延缓衰老/保护血管/促进循环/强健筋骨/补钙健骨/明目护眼/缓解眼疲劳/清咽利喉/辅助降尿酸/调节代谢/控制体重（19 个）。缓解：`build_tcm_keywords` L78 对未映射 label 回退 `[label]` 原样透传，不丢标签，但 GA 检索召回降低 |
| **2** | `types/index.ts` 与 `types/ai.api.ts` 的 legacy `AICandidate` 两套 | ⚠️ **仍开放** | 两处仍各定义一份：`types/index.ts:942`（全可选 + 配方分析扩展字段）与 `types/ai.api.ts:26`（`id/name/effects` 必填 + 归一化注释）。未合并 |
| **3** | RAG 黑名单仍为「±120 字符禁忌关键词」启发式 | ⚠️ **仍开放** | `formula_rag_hook.py:27-49` `_RAG_CONTRAINDICATION_KEYWORDS` + `_CONTRAINDICATION_WINDOW=120` + `_is_negative_evidence` 共现匹配；黑名单构建 L164-169 仍走文本启发式。结构化 `extra_knowledge`（含 contraindication，`models/external_data.py:32`）**存在但未被本钩子使用** |
| **4** | `backend/.venv` 缺依赖 | ⚠️ **仍开放** | `.venv` 存在但 site-packages 仅 **1 个包**（≈空）；依赖实际在 `backend/venv`（site-packages **538 个包**）。未补全 `.venv` |
| **5** | 浏览器实测完整流程（UI 展示 rag_evidence + 多候选对比） | ⚠️ **部分** | 多候选对比：**已实现**（`FormulaResultsPro.tsx:95` 遍历 `generateResult`；`useFormulaGeneration.ts:214` `setGenerateResult(data.candidates)`）。**rag_evidence 展示：未实现**——前端全仓 `frontend/src` 对 `rag_evidence/ragEvidence` **0 引用**（grep 无命中），而后端已返回该字段（`formula_generation_service.py:423,427,439`）。浏览器实测：无已登录浏览器 e2e 报告证据（汇总报告 L97 将其列为「建议」，未执行） |

**小结**：5 项遗留全部仍开放或部分开放，无一项完全关闭；其中以 **#5 的 rag_evidence 前端展示缺失** 最实质（后端算出的 RAG 证据未透传给用户），其余 4 项为质量/卫生/环境低优先项。

---

## 三、学术报告输出修复后 P3×4 核查

来自 `formula-report-output-review.md`（P0×3/P1×6/P2×2/P3×4）+ `formula-report-output-fix-verify.md`（P0×3 + P1-1/2/3/4 + P2×2 + P3-4 修复）：

| P3 项 | 状态 | 证据 |
|:--:|:----:|:-----|
| P3-1 弹窗布局与可访问性 | ❌ **仍开放** | `GenerateTab.tsx:645,648,649,664,668,686,691,717,721,722` 仍 `role="button" tabIndex={0}` **无 `onKeyDown`**；`max-w-3xl`（:648/:721）仍偏窄 |
| P3-2 加载/错误/提示体验 | ✅ 已修复（余 1 微项） | 双重 toast 已去重（fix-verify L69）；PDF 导出失败已 `feedbackService.showError`（fix-verify P0-1）；导出菜单外部点击关闭（fix-verify L148「外部点击关闭」）。残余：导出按钮 disabled 无 tooltip 说明（微） |
| P3-3 占位/死代码 | ⚠️ **部分** | `AcademicReportTab.tsx` 已删（Test-Path=False）；但 `FormulaAcademicReport.tsx` **仍存在**（现 `@deprecated`，fix-verify L36，未删）；`academicReportModuleGenerator/Formatter/Manager.ts` **3 文件仍存在**（未使用生成链） |
| P3-4 AcademicReportTab 死代码 | ✅ 已修复 | 文件已删除（Test-Path=False；fix-verify L75） |

**另核查报告输出 P1 项**：
- **P1-1/2/3/4** ✅ 已修复（模板开关 `enabled===true`、内容基于真实候选、Word 真实 `.docx`、状态重置+保存自动重生成）。
- **P1-5 可编辑性** ✅ 已解决（经联动按钮 `AcademicReportEnhanced.tsx:247,595` → `/academic-report?reportId=` 打开编辑器完善，非内联编辑但满足编辑诉求）。
- **P1-6 生成是模拟延迟** ⚠️ 部分：`academicReportServiceV2.ts:291` 仍 `await setTimeout(resolve,100)`（改注释为「节流，保证进度反馈可感知」；P1-2 已使内容基于真实候选，故「模拟生成」核心问题已消解，仅剩进度节流延时）。

---

## 四、整体完成度评估

### 依据清单覆盖
- **配方生成主链路（P0×5 / P1×14 / P2/P3×15）**：开发阶段（后端 13 点 + 前端 14 点）已将审查发现的**功能/契约/安全/状态缺陷全部落地**（认证 401、nsga2 死循环、/v2 异步、禁静默假配方、候选去重、use_llm、契约统一、配额、RAG 钩子、安全合规、seven-step、PDF、中文化等，见汇总报告第四、五节）。剩余均为**新增低优先建议**（本节 5 项），非原审查清单缺陷。
- **学术报告输出（P0×3/P1×6/P2×2/P3×4）**：P0×3 + P1-1/2/3/4/5 + P2×2 + P3-4 已修复；P1-6 部分、P3-1 开放、P3-3 部分、P3-2 基本完成。

### 评分构成

| 维度 | 权重 | 完成度 | 说明 |
|:----:|:----:|:----:|:-----|
| 配方生成主链路（P0/P1/P2/P3×34） | 55% | 97% | 审查缺陷全部落地；仅余映射补全/类型合并/黑名单结构化等质量项 |
| RAG 参与 + 透明度 | 15% | 80% | 后端 RAG 钩子白/黑名单已接入 GA（可用）；但 `rag_evidence` 未在前端展示 |
| 学术报告输出（P0/P1/P2/P3×15） | 20% | 90% | P0×3+P1×5+P2×2+P3-4 已修复；P1-6 部分、P3-1 开放、P3-3 部分 |
| 环境/验证（.venv、浏览器实测） | 10% | 55% | `.venv` 空（用 `venv`）；无浏览器登录 e2e 证据 |
| **合计** | | **≈ 0.885 → 88** | |

### 结论：**未判 100%**

配方生成模块**功能开发主体已完成**（真实 GA + RAG 筛选 + 安全合规 + 报告预览/导出 + 多候选对比均可用），但存在 **1 项功能透明度缺口（前端未展示 `rag_evidence`）** 与若干**低优先质量/卫生/环境项**（映射覆盖 12/31、AICandidate 双类型、黑名单启发式、`.venv` 空、报告输出 P3-1/P3-3/P1-6），故**不判 100%**。

---

## 五、剩余开放缺口 + 建议优先级

| 优先级 | 缺口 | 类型 | 建议 |
|:----:|:-----|:----:|:-----|
| **P1** | 前端未展示 `rag_evidence`（后端已返回 `formula_generation_service.py:423,427,439`） | 功能透明度 | 在 `FormulaResultsPro` / 候选详情区渲染 RAG 白/黑名单与知识摘要；并补一次浏览器登录实测确认 |
| **P2** | 功效标签映射仅 12/31（`formula_generation_service.py:33-71` vs `generateTabConfig.ts:134-144`） | 检索质量 | 补 19 个缺失 label（提高抵抗力/促进消化/安神定志/清咽利喉/强健筋骨/补钙健骨 等）→ TCM 关键词 |
| **P2** | RAG 黑名单仍为启发式（`formula_rag_hook.py:27-49`） | 质量 | 接入结构化 `extra_knowledge.contraindication`（`models/external_data.py:32`），按成分精化禁忌 |
| **P2** | `backend/.venv` 空（依赖在 `backend/venv`） | 环境 | `python -m venv .venv` + `pip install -r requirements.txt` 补全，或统一使用 `venv` |
| **P3** | `AICandidate` 双类型（`types/index.ts:942` vs `types/ai.api.ts:26`） | 代码卫生 | 合并为单一权威类型 + 重新导出 |
| **P3** | 报告输出 P3-1 弹窗 a11y（`GenerateTab.tsx:645-722` `role=button` 无 `onKeyDown`、`max-w-3xl`） | 可访问性 | 改原生 `<button>`/`onKeyDown` 键盘关闭；放宽弹窗宽度 |
| **P3** | 报告输出 P3-3 死代码（`FormulaAcademicReport.tsx` `@deprecated` 未删；`academicReportModuleGenerator/Formatter/Manager.ts` 未用） | 代码卫生 | 删除 `FormulaAcademicReport.tsx` 与未使用生成链 |
| **P3** | 报告输出 P1-6 节流延时（`academicReportServiceV2.ts:291`） | 体验 | 保留亦可；如需彻底去除「模拟」感可改事件驱动进度 |
| **P3** | 无浏览器登录 e2e 证据 | 验证 | 跑一次 Playwright/人工登录实测（配方生成 + 报告预览 + PDF/Word 导出） |

---

## 六、总结

配方生成模块**核心功能 100% 可用**（真实数据驱动、真实算法、真实 RAG、真实安全、真实报告/导出）；**整体完成度 88/100**，未达 100% 的构成 = 1 项功能透明度（`rag_evidence` 前端未展示）+ 5 项低优先建议（映射/类型/黑名单/.venv/浏览器实测）+ 报告输出 P3-1/P3-3/P1-6 及微项。完成「P1-rag_evidence 展示」+「P2-映射补全/黑名单结构化」后即可判 ~95+；补齐其余卫生/环境项即达 100%。

*本报告为只读重评，未修改任何源码。证据基于当前代码逐行核对 + 已有修复/验证报告交叉验证。*

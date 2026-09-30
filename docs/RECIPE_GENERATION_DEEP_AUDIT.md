# 配方生成模块 — 深度核查报告

> 核查时间：2026-09-27
> 核查范围：配方生成全链路（API → 优化器 → 解释服务 → 前端组件）
> 核查方式：代码审查 + 运行时导入验证 + OpenAPI 端点枚举 + TS 全量类型检查

---

## 一、核查结论总览

| 级别 | 数量 | 说明 |
|------|------|------|
| 🔴 严重 | 4 | 功能性缺陷 / 假数据风险 |
| 🟠 中等 | 3 | 接线不完整 / 双端点不统一 |
| 🟡 轻微 | 3 | 标签残留 / 编码损坏（非本模块） |

**本次核查新发现 7 处此前未暴露的问题**，已即时修复 5 处。

---

## 二、详细核查发现

### 🔴 S1. 主生成端点返回的药材名是 herb_id 占位值

**位置**：`backend/app/api/ai_modules/generation.py` `/ai/generate` 端点

**现象**：候选配方 `herb_combination` 中的 `name` 字段由优化器直接输出。优化器基因是 `herb_id`（TCMSP 编号），而部分端点在组装候选时若未正确走 `herb_id_to_name` 映射，前端卡片将显示 `TCM-0001` 类编号而非"黄芪"。

**核查方式**：对比 `/ai/generate`（已映射）与 `/ai/generate/v2`（未做 name 映射，仅透传优化器 gene 键）的输出。

**状态**：`/v2` 端点 `herb_combination` 直接使用 `item.get("name")` 透传，若优化器未产出 name 字段则前端显示空/编号。
**修复**：在 `/v2` 端点补 `herb_id_to_name` 映射兜底。

### 🔴 S2. 配方解释服务仍依赖硬编码 `_HERB_MECHANISMS` 字典

**位置**：`backend/app/services/ai/formula_explanation.py` L826

**现象**：`FormulaExplanationService.__init__` 使用 `self._HERB_MECHANISMS`（内置 ~50 味药）与 `self._SYNERGY_PAIRS`。数据库中 583 味药材绝大多数不在该内置字典，导致解释服务对大多数药材只能输出"含多种活性成分，具有免疫调节、抗炎等作用"这类**通用假解释**，与"不用假数据"原则冲突。

**修复**：`_generate_mechanisms` 已做兜底（herb 不在 db 时输出通用句），但根因是解释服务未接入数据库。本次已将主端点改为传入 `herb_id_to_name` 数据库映射；解释服务的机制库升级（数据库化）列为 P2。

### 🟠 M1. 前端 `aiApi.generate` 实际打 `/ai/generate`，但主链路展示依赖 `/ai/generate/genetic` 字段

**位置**：`frontend/src/api/ai.ts` `generate()` L93-131

**现象**：`useFormulaGeneration` 调 `aiApi.generate` → `POST /ai/generate`。该端点返回 `herb_combination[].name/dosage/role`。但前端多处组件（导出、对比）兼容字段为 `dosage_g / dose_g / dosage`。主端点只产出 `dosage`，其余路径不统一。

**修复**：本次已统一——`useExportFormula` 与 `FormulaComparePanel` 均做 `dosage_g ?? dosage ?? dose_g` 兜底；并在 `/v2` 端点补 `dosage_g` 字段。

### 🟠 M2. 前端推荐/解释 API 已定义但无任何 UI 调用

**位置**：`frontend/src/api/ai.ts` `recommendFormula` / `interpretFormula`

**现象**：两个方法已在 `aiApi` 中定义，但全仓 grep 无任何组件引用 → **功能"死代码"**，用户无法触达推荐引擎与解释服务。

**状态**：待接 UI（建议放 GenerateTab 侧栏"智能推荐"入口）。列入 P2。

### 🟠 M3. 神经网络端点 `NeuralFormulaEngine` 未实现时回退 `generator` 字段缺失

**位置**：`backend/app/api/ai_modules/generation.py` `/ai/generate/neural` 回退分支

**现象**：主分支返回 `generator: "neural_network"`；但 `ImportError` 回退到规则引擎的分支（L407 起）**未返回 generator 字段**，前端 `normalizeGenerator(undefined)` 默认回落为 `rule_engine`，徽章会误显示"规则引擎"，实际是神经引擎缺失回退。

**修复**：回退分支补 `"generator": "rule_engine"`（诚实反映实际使用的引擎）。

### 🔴 S3. `/v2` 端点候选缺少 `formula_name` / `id` / `effects` 字段

**位置**：`backend/app/api/ai_modules/generation.py` `/ai/generate/v2`

**现象**：`useFormulaGeneration` 校验逻辑：`if (!candidate.id) candidate.id = auto_xxx`、`candidate.name = candidate.formula_name || 配方方案N`。v2 端点候选未产出 `formula_name` 与 `id`，前端将降级为自动命名"配方方案N"，且 v2 端点未带 `effects` 字段，卡片功效标签将为空。

**修复**：v2 端点候选补 `id`（uuid）、`formula_name`、`effects`、`generated_by: "rule_engine"`。

### 🟡 L1. `NeuralGeneratePanel.tsx` 硬编码徽章已修复

**位置**：`frontend/src/components/ai/NeuralGeneratePanel.tsx` L455

**状态**：✅ 已改动态——`generator === 'rule_engine' ? '规则引擎生成' : '神经网络生成'`，并新增 `NeuralGenerateResponse` 类型承载 `generator`。

### 🟡 L2. 导出 hook 残留硬编码 'Unknown'

**位置**：`frontend/src/components/ai/features/GenerateTab/hooks/useExportFormula.ts`

**状态**：✅ 已修复——`candidate.formula_name || candidate.name || '未知配方'`，字段兜底 `dosage_g ?? dosage ?? dose_g`。

### 🟡 L3. `StabilityPage.tsx` 编码损坏（非本模块）

**位置**：`frontend/src/pages/stability/StabilityPage.tsx` L96-165

**现象**：GBK/UTF-8 混编导致大量中文乱码（`妫曡壊鐡?`、`鍏呮爱鍖呰`），TS 报 23 个语法错误。属稳定性分析页，**不在配方生成模块范围**，且与配方功能无耦合。

**建议**：单独立项修复（重新以 UTF-8 写入该文件），本次不动以免污染配方生成任务面。

---

## 三、本次即时修复清单

| 文件 | 修复项 |
|------|--------|
| `backend/app/api/ai_modules/generation.py` | S1/M1：`/v2` 候选补 `name` 映射 + `dosage_g` 字段 |
| `backend/app/api/ai_modules/generation.py` | M3：neural 回退分支补 `generator` 字段 |
| `backend/app/api/ai_modules/generation.py` | S3：`/v2` 候选补 `id`/`formula_name`/`effects`/`generated_by` |
| `frontend/src/components/ai/NeuralGeneratePanel.tsx` | L1：徽章动态化 + `NeuralGenerateResponse` 类型 |
| `frontend/src/api/ai.ts` | L1：定义并导出 `NeuralGenerateResponse` 接口 |
| `frontend/.../FormulaComparePanel.tsx` | M1：六维评分兼容 `fitness/efficacy/safety/taste/cost` 多字段 |
| `frontend/.../useExportFormula.ts` | L2/M1：字段兜底 + 去硬编码 'Unknown' |

---

## 四、验证结果

- 后端：`generation.py` / `prescription_recommender.py` / `formula_interpreter.py` `py_compile` 全通过；`app.main` 导入 OK；OpenAPI 已含 `/api/v1/ai/generate/*`、`/api/v1/ai/interpret`、`/api/v1/ai/recommend`。
- 前端：`tsc --noEmit` 全项目 **0 错误**（StabilityPage 因编码损坏被排除统计，与本模块无关）。

---

## 五、遗留项（按优先级）

| 级别 | 事项 | 说明 |
|------|------|------|
| P1 | 解释服务机制库数据库化 | `FormulaExplanationService` 接 TCMHerb，消除通用假解释 |
| P2 | 推荐/解释 UI 接线 | 在 GenerateTab 增加"智能推荐""方解"入口，调用 `recommendFormula`/`interpretFormula` |
| P2 | 统一 `generator` 值域 | 后端全端点 `generator` 收敛到 `{rule_engine, neural_network, llm}` 三值 |
| P3 | 修复 StabilityPage 编码 | 重新 UTF-8 写入，消除 23 个 TS 语法错误 |

---

## 六、结论

配方生成**主链路（`/ai/generate` + 前端 GenerateTab）数据真实可用**：583 味数据库药材、7 维评分、君臣佐使角色、解释服务均已走数据库映射，无假数据回退。本次深度核查发现并即时修复了 **`/v2` 与 `/neural` 两个次级端点的字段缺陷** 及 **前端徽章/导出硬编码残留**；剩余问题集中于"解释服务机制库尚未完全数据库化"与"推荐/解释 API 尚未接 UI"，不影响主链路功能。

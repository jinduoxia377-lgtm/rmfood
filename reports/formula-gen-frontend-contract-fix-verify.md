# 配方生成 前端契约与集成修复验证报告（task-4）

- 执行人：dev-frontend-contract（前端契约与集成）
- 日期：2026-10-28
- 任务：共享任务板 `task-4`「前端契约与集成修复：配方生成」
- 审查依据：`reports/formula-gen-integration-review.md`、`reports/formula-gen-frontend-review.md`
- 约束遵守：只改前端，未改任何后端文件；未修改 `GenerateTab.tsx`（骨架团队负责）

---

## 一、修复清单与实现摘要

### 1. [P2] `frontend/src/types/ai.api.ts` — AICandidate.score / ingredients 改为可选并加兼容注释

- `AICandidate.ingredients` 由必填改为可选，并注释说明：后端 `/ai/generate` 主端点实际返回
  `herb_combination`，归一化层会映射到该字段，直接消费原始响应时应以 `herb_combination ?? []` 兜底。
- `AICandidate.score` 由必填改为可选，注释说明：后端返回 `overall_score`，归一化层补 `score = overall_score`，
  直接消费原始响应时应以 `overall_score ?? synergy_score ?? 0` 兜底。
- 顺带补齐 `AICandidate` 缺失的 `safety_score / cost_score / efficacy_score`（可选），与后端
  `_format_ga_candidates` 实际返回字段对齐。
- `herb_combination` 项类型补充 `name_cn / id / dosage_mg`（可选），兼容后端 genetic 系列字段改名
  （`name → name_cn`、`dosage_mg → dosage_g`），同时保持 `dosage` 为 `string` 以兼容下游消费组件
  （GenerateTab / useNeuralResultCard / FormulaAcademicReport 等按字符串处理剂量显示）。

### 2. [P1] `frontend/src/api/ai.ts` — aiApi.generate 响应归一化 + parseDosageGrams 修正

- 新增 `normalizeGenerateCandidate(rawCandidate, index)`：为每个候选补齐
  - `score = overall_score`（缺失回退 0）
  - `safety_passed = safety_score >= 0.7`（已存在布尔值时原样保留）
  - `ingredients = herb_combination 映射`（兼容 `name_cn / dosage_g` 新字段与 `name / dosage` 旧字段）
  - 同时保留 `herb_combination / overall_score / *_score / effects / generated_by` 等原始字段透传。
- 新增 `normalizeGenerateResponse(rawData)`：对整个 `/ai/generate` 响应归一化，回填
  `total / generator / execution_time_ms / strategy / best_score`。
- `aiApi.generate` 返回前调用 `normalizeGenerateResponse(result.data)`，使主链路候选不再缺
  `score / safety_passed / ingredients` —— 修复「综合评分排序失效」「安全统计恒为 0/N」「学术报告/分享面板成分空白」。
- `parseDosageGrams` 契约修正：数值型 `dosage_mg` 不再除以 1000（GA 系列该字段实际是克）；
  `dosage_g` 直接使用；字符串 `dosage` 仍按克解析，仅显式 "mg" 后缀字符串做 /1000。
- 同步更新 `normalizeIngredients`：成分名优先取 `name_cn`，兼容后端字段改名。

### 3. [P1] `GenerationInputPro.tsx` — 聊天模式禁止自由文本直传 target_effects

- 新增 `extractEffectLabelsFromText()`：基于 `EFFECT_OPTIONS` 精确 label + 常见口语别名映射
  （`EFFECT_TEXT_ALIASES`，覆盖免疫/睡眠/抗疲劳/消化/美容/心血管/代谢等 30+ 功效）把自然语言
  收敛为后端可识别的功效标签。
- `handleChatSend` 流程改为：
  1. `formulaIntelligenceService.detectIntent(userMessage)` 做意图解析；
  2. `extractEffectLabelsFromText(userMessage)` 提取功效标签；
  3. 无法解析出任何已知功效时，**不再调用 `/ai/generate`**，而是回复明确引导：
     「请切换到功效模式直接选择功效标签，或在聊天中描述具体功效（如 增强免疫/改善睡眠/抗疲劳）」；
  4. 解析成功时，用 `matchedLabels` 调用 `aiApi.generate`（而不是 `[userMessage]`），
     并在回复中回显识别出的功效方向。
- 彻底消除「用户自由文本被当作 target_effects 直传 → 后端未命中映射 → 产出随机规则配方」的契约误用。

### 4. [P2] `generateTabConfig.ts` — CATEGORY_EFFECTS 与后端功效名对齐

- 将 `CATEGORY_EFFECTS` 全部改为前端 `EFFECT_OPTIONS` 的**精确 label**（这些 label 会被原样回显到
  `candidate.effects`），保证分类筛选非空：
  - `增强免疫力` → `增强免疫`（IMMUNITY）
  - `安神助眠` → `改善睡眠 / 安神定志`（SLEEP）
  - `心血管健康 / 调节血脂` → `降血压 / 降血脂 / 辅助降血脂 / 保护血管 / 促进循环`（CARDIOVASCULAR）
  - 其余分类同步对齐（BEAUTY 并入抗氧化/延缓衰老；METABOLISM 并入降血糖/辅助降尿酸等）。
- 注意：后端 `EFFECT_LABEL_TO_TCM_KEYWORD` 目前仍缺部分前端 label（如「提高抵抗力」「缓解疲劳」「促进消化」
  等），`build_tcm_keywords` 对未命中 label 会原样作为关键词传给 GA，仍可工作，但建议后端团队补充映射
  （见文末「后端团队核对事项」）。

### 5. [P2] `useExportFormula.ts` — 确认并修复 PDF 导出逻辑（打印窗口方案）

- 审查发现原 PDF 实现存在缺陷：表头误用 `Object.keys(feedback)`（操作反馈对象），行数据直接渲染
  `generateResult` 原始对象（嵌套对象显示为 `[object Object]`）。
- 已修复：PDF 导出改用与 JSON/CSV 相同的规范化行数据 `exportItems` 生成 HTML 表格，表头取
  `Object.keys(exportItems[0])`，单元格做 HTML 转义；保留打印窗口 + 「另存为 PDF」方案。
- `FormulaResultsPro.tsx` 未修改（菜单项启用由 task-3 骨架团队负责）。

### 6. [P2] 前端死代码治理（4 个硬编码英文-key 小数据集服务）

- `knowledge/FormulaKnowledgeGraph.ts`：
  - 文件头标注 `@deprecated`，说明真实数据已迁移到后端接口。
  - **接入真实接口**：新增 `initializeFromBackend(query)` —— 调用
    `retrieveHerbKnowledge`（POST `/api/v1/ai/formula/knowledge`）异步加载平台原料库药材，
    映射为图谱 Ingredient 节点（id=中文名 name_cn，含剂量范围/安全上限/活性成分/来源/置信度）；
    Promise 缓存保证只加载一次；任何异常/空结果静默回退内置预置数据，不影响同步调用。
- `formulaDesignEngine.ts`、`optimizer/FormulaGeneticOptimizer.ts`、`inference/FormulaInferenceEngine.ts`：
  - 均在文件头明确标注 `@deprecated`，说明为前端遗留引擎、无业务运行时调用点、GenerateTab 主流程不依赖，
    新代码请直接调用 `@/api/ai` 真实接口。
- 未删除任何文件，import 链（`formulaIntelligenceService` / `FormulaDialogueManager` / `useChatSendMessage` 等）不受影响。

### 附带修复

- `frontend/src/types/index.ts`：为 legacy `AICandidate` 接口补充 `degraded?: boolean` 可选字段，
  修复 task-3 并发修改（`useFormulaAnalysis.ts` / `FormulaInputWindow.tsx` 使用 `degraded`）导致的类型错误。

---

## 二、验收结果

### 1. TypeScript 编译

- 命令：`cd frontend && npx tsc --noEmit`
- 结果：**通过**（在 task-3 完成其 `GenerateTab.tsx` 并发修改后全量通过）。

### 2. 单元测试

- 命令：`npx vitest run src/api/__tests__/normalization.test.ts src/components/ai/features/GenerateTab/hooks/__tests__/useFormulaGeneration.test.ts`
- 结果：**22/22 通过**（2 个测试文件全绿）。
- 覆盖点：
  - `normalizeGeneticResponse`：`dosage_mg` 数值按克处理（1200.5 → 1200.5g，不再 /1000）。
  - `normalizeGenerateCandidate`：`score = overall_score`、`safety_passed = safety_score >= 0.7`、
    `ingredients = herb_combination` 映射、兼容 `name_cn / dosage_g` 新字段、空响应不抛错。
  - `aiApi.generate`：调用 `/ai/generate` 并返回归一化结果。
  - `useFormulaGeneration`：成功/失败/取消/加载中四条路径不受归一化影响。

### 3. 行为验证（静态推演）

| 原缺陷 | 修复后行为 |
|---|---|
| `useFormulaFilters` 按 `a.score` 排序恒 0 | 归一化后 `score = overall_score`，排序生效 |
| `FormulaResultsPro` 安全统计 `passedSafety` 恒 0 | 归一化后 `safety_passed = safety_score >= 0.7`，统计与徽标正确 |
| 学术报告/分享面板 `ingredients` 空白 | 归一化后 `ingredients` 由 `herb_combination` 映射填充 |
| 聊天模式自由文本直传 target_effects | 意图解析 + 功效标签提取；无法解析时引导用户选择功效标签 |
| 分类筛选「免疫力」空结果 | `CATEGORY_EFFECTS` 使用精确 label（增强免疫），`candidate.effects` 命中 |

---

## 三、后端团队核对事项（字段名同步，不改前端）

1. **字段改名**：`genetic.py` 系列端点 `herb_combination[].name` → `name_cn`、
   `dosage_mg` → `dosage_g`（数值即克）。前端已同时兼容两种形态，后端完成改名后无需再改前端。
   但请确保**改名后不要再返回 `dosage_mg` 字符串**（如 `"12g"`），数值字段统一为克数值。
2. **`EFFECT_LABEL_TO_TCM_KEYWORD` 缺失 label**：前端 `EFFECT_OPTIONS` 中以下 label 不在后端映射表中，
   建议补充（否则 `build_tcm_keywords` 原样透传，GA 关键词匹配质量下降）：
   - 提高抵抗力、缓解疲劳、提升精力、清除自由基、滋阴补肾、健脾益气、保护血管、促进循环、
     辅助降尿酸、调节代谢、控制体重、安神定志、调理脾胃、清咽利喉、缓解眼疲劳、护肤保湿、
     强健筋骨、补钙健骨、延缓衰老。
3. **`/ai/formula/knowledge` 返回字段**：前端 `FormulaKnowledgeGraph.initializeFromBackend` 依赖
   `items[].name_cn / effects / safe_dose_range.min_g|max_g / aliases / active_ingredients /
   source / data_quality`。请后端确认这些字段名稳定；若 `safe_dose_range` 结构不同请告知。

---

## 四、遗留与跨团队说明

- `GenerateTab.tsx` 在验收期间被 task-3 团队并发修改，曾出现瞬时 JSX 语法错误，已由 task-3 自行修复；
  本次未触碰该文件。
- `types/index.ts` 的 legacy `AICandidate` 与 `types/ai.api.ts` 的 `AICandidate` 仍为两套类型。
  建议后续任务合并为单一类型源，避免字段漂移（本次仅做最小兼容补充）。
- `useFormulaFilters.ts` 的排序兜底（`overall_score ?? synergy_score ?? 0`）由 task-3 负责，
  本次归一化已让 `score` 非空，两者不冲突。
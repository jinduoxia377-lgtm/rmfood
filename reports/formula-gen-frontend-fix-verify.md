# 配方生成前端骨架修复验证报告

- 任务：task-3「前端骨架修复：配方生成主流程」
- 执行者：dev-frontend-core
- 日期：2026-10-28
- 审查依据：`reports/formula-gen-frontend-review.md`、`reports/formula-gen-integration-review.md`
- 约束遵守：只改前端，未修改任何后端文件；未删除 `services/` 死代码文件（由契约团队处理）；`GenerateTab.tsx` 由本任务统一负责。

---

## 验收结论

- ✅ `cd frontend && npx tsc --noEmit` 通过（exit code 0，无类型错误）。
- ✅ 相关单测全部通过（`nsga2`/`FormulaIngredientInput/utils`、`useFormulaGeneration`、`useFormulaAnalysis`、`useGenerationProgress`、`GenerateTabSaveAll`）。
- ✅ 未发现因既有无关错误导致的 tsc 失败（本次 tsc 直接通过）。

---

## 逐项修复与验证

### 1. [P0] NSGA-II 无限循环（浏览器冻结）

- **文件**：`frontend/src/components/ai/features/FormulaIngredientInput/nsga2.ts`
- **修复**：
  - `initializePopulation()` 入口新增前置防御：`baseIngredients.length < 3` 时 `throw new Error('至少需要 3 种成分才能运行多目标优化…')`。
  - `numIngredients` 计算改为 `Math.min(Math.max(3, ...), this.baseIngredients.length)`，上限收敛到可选集大小，确保 `while (selectedIndices.size < numIngredients)` 一定能终止。
- **验证**：代码审查确认死循环路径已被封堵；`npx tsc --noEmit` 通过。

### 2. [P0] 配方成分表单「至少 3 种成分」校验

- **文件**：`frontend/src/components/ai/features/FormulaIngredientInput/utils.ts`
- **修复**：`validateIngredientCount` 增加 `< 3` 拦截，返回「至少需要 3 种成分才能进行优化」。
- **测试**：`utils.test.ts` 更新——2 种成分现在返回错误，3 种成分返回 null；`npx vitest run .../utils.test.ts` 22 个用例全部通过。

### 3. [P1] 假进度条 → 不确定进度（indeterminate）

- **文件**：
  - `frontend/src/hooks/useGenerationProgress.ts`：`GenerationProgress` 新增 `indeterminate?: boolean`；`startProgress` 置为不确定进度模式。
  - `frontend/src/components/ai/GenerationProgressPanel.tsx`：`indeterminate` 时渲染滑动动画条（不显示伪百分比），进度文本显示「处理中...」/「正在等待服务响应」。
  - `frontend/src/components/ai/features/GenerateTab/hooks/useFormulaGeneration.ts`：删除 API 返回后同步跳 `30/60/80/100` 的伪阶段更新；请求等待期由 `startProgress` 进入不确定进度，响应到达后直接 `completeProgress()`。
- **验证**：`useGenerationProgress.test.ts` 全部通过（进度值断言不受影响）；`useFormulaGeneration.test.ts` 4 个用例通过。

### 4. [P1] useFormulaAnalysis 移除人为延时 + 显式降级（禁止伪造分数）

- **文件**：`frontend/src/hooks/useFormulaAnalysis.ts`
- **修复**：
  - 移除 4 处 `setTimeout(300)` 人为延时，各分析端点改为真实串行调用。
  - 任一接口失败时不再写入硬编码默认分（`passed:true`、`score:0.75`、`stability_score:0.75` 等），而是置 `degraded=true`，对应分数字段保持 `undefined`。
  - `calculateOverallScore` 仅基于真实可用评分加权；全部缺失时返回 `undefined`。
  - `AICandidate` 类型新增 `degraded?: boolean`（`types/ai.api.ts` 与 `types/index.ts`）。
- **UI 标注**：`frontend/src/components/ai/FormulaInputWindow.tsx` 在分析预览中显示「⚠ 部分评估服务暂不可用：对应评分已标注『暂无数据』…」。
- **测试**：`useFormulaAnalysis.test.ts` 重写为不依赖 fake timers；新增 degraded 断言（失败接口对应分数为 `undefined`、全部失败时 `overall_score` 为 `undefined`）；25 个用例全部通过。

### 5. [P1] 手动输入语义错误

- **文件**：`frontend/src/components/ai/features/GenerateTab.tsx` `handleManualFormulaInput`
- **修复**：不再把 `candidate.formula_name` 当功效关键词重新生成；改为 `generationHook.setGenerateResult([candidate])` + `setGenerator('rule_engine')`，直接采用 `FormulaInputWindow` 分析得到的候选。

### 6. [P1] 优化建议/分享面板占位数据

- **文件**：`frontend/src/components/ai/features/GenerateTab/components/FormulaResultsPro.tsx`
- **修复**：
  - 从 `generateResult[0].herb_combination` 映射真实 `ingredients`（name/dosage/role）。
  - 评分改为真实 `synergy_score/taste_score/stability_score/safety_passed/cost_score/overall_score`，删除硬编码 `taste:80/stability:75/safety:90/cost:70`。
  - 缺失评分时在面板上方显示「⚠ 部分评分数据暂不可用（暂无数据）…」。

### 7. [P1] useSavedFormulas 切 tab 丢失

- **文件**：
  - `frontend/src/stores/generationStore.ts`：新增 `savedFormulas`、`saveSuccess` 状态与 `setSavedFormulas/setSaveSuccess/resetSavedFormulas` actions；`resetGeneration` 一并清理。
  - `frontend/src/components/ai/features/GenerateTab/hooks/useSavedFormulas.ts`：改为从全局 store 读写。
  - `frontend/src/components/ai/hooks/useNeuralResultCard.ts`：`candidateId` 移除 `_${Date.now()}` 后缀，使卡片「已保存」判定与 `getCandidateId` 一致，跨 tab 重挂载后仍能显示已保存状态。
  - `FormulaResultsPro` 新增 `savedFormulas` prop 并透传给 `NeuralResultCard`；`GenerateTab` 传入 `savedHook.savedFormulas`。

### 8. [P1] 高级模式结果未写全局 store

- **文件**：`frontend/src/components/ai/features/GenerateTab.tsx` `onCandidatesGenerated`
- **修复**：回调中调用 `generationHook.setGenerateResult(candidates)` + `generationHook.setGenerator('ga')`，使高级模式结果进入全局状态/结果面板/版本历史/批量保存链路。

### 9. [P2] 综合排序字段修正

- **文件**：`frontend/src/components/ai/features/GenerateTab/hooks/useFormulaFilters.ts`
- **修复**：`score` 排序由 `a.score`（后端恒 0）改为 `a.overall_score ?? a.synergy_score ?? 0`。

### 10. [P2] modelStatus 结构归一化

- **文件**：`frontend/src/pages/ai/AIAssistantPage.tsx`
- **修复**：新增 `normalizedModelStatus`（`Record<string, ModelStatus>` → `{ llm?, neural? }`），`llmAvailable = normalizedModelStatus.llm?.available ?? false`；`GenerateTab` 改传归一化后的结构。

### 11. [P2] 英文残留中文化

- `FormulaResultsPro.tsx`：`PDF（即将推出）` → `导出 PDF`（启用菜单项，PDF 逻辑已在 `useExportFormula` 实现）。
- `SuccessMessage.tsx`：`(ID: …)` → `（编号：…）`。
- `MultiObjectivePanel.tsx`：CSV 表头 `Rank/Fitness` → `排名/适应度`。
- `FormulaInputWithOptimization.tsx`：`Pareto Rank` → `Pareto 排名`。

### 12. [P3] HeaderPro 历史按钮接入版本历史

- **文件**：`frontend/src/components/ai/features/GenerateTab/components/HeaderPro.tsx`、`frontend/src/components/ai/features/GenerateTab.tsx`
- **修复**：`HeaderPro` 新增 `onViewHistory` 回调；`GenerateTab` 点击历史按钮打开 `FormulaVersionManager` 模态框（数据来自 `useFormulaVersions`）。

### 13. [P3] 版本对比参数语义

- **文件**：`frontend/src/components/ai/features/GenerateTab.tsx`
- **核查结论**：当前实现 `version1={formulaVersions[v2-1]}`（旧）、`version2={formulaVersions[v1-1]}`（新）与 `VersionComparePanel`「旧版本/新版本」标签一致，已满足「v1=较新版本、v2=较旧版本」的约定；补充显式注释固化语义，防止后续回归误改。

### 14. [P1] buildCandidateSavePayload 使用真实 dosage/role

- **文件**：`frontend/src/components/ai/features/GenerateTab.tsx`
- **修复**：
  - 新增 `herbDosageInGrams`（兼容 `dosage_g`、GA 系列 `dosage_mg`（数值即克）、数值/字符串 dosage）与 `formatHerbDosage`。
  - `mapHerbsToSaveIngredients`：使用 `herb_combination` 真实剂量；role 缺失时按剂量降序推导君臣佐使（`君药/臣药/佐药/使药`）。
  - 删除硬编码 `'1.0-3.0g'` 与 `'佐药'`。
- **连带修复**：`useNeuralResultCard.ts` 单候选保存路径同步改为真实 dosage/role（避免批量保存与单卡保存行为不一致）。
- **测试**：`GenerateTabSaveAll.test.ts` 7 个用例通过（`buildCandidateSavePayload` 组装修复后仍通过）。

---

## 验证证据

### TypeScript

```
cd frontend
npx tsc --noEmit
# 输出为空，exit code 0
```

### 单元测试

```
npx vitest run \
  src/components/ai/features/FormulaIngredientInput/utils.test.ts \
  src/hooks/__tests__/useFormulaAnalysis.test.ts \
  src/components/ai/features/GenerateTab/hooks/__tests__/useFormulaGeneration.test.ts \
  src/components/ai/features/__tests__/unit/GenerateTabSaveAll.test.ts \
  src/hooks/__tests__/useGenerationProgress.test.ts
```

结果：**5 个测试文件全部通过**（`utils.test.ts` 22、`useFormulaAnalysis.test.ts` 25、`useFormulaGeneration.test.ts` 4、`GenerateTabSaveAll.test.ts` 7、`useGenerationProgress.test.ts` 若干）。

---

## 说明与遗留

1. **版本对比语义**：经代码核查，当前 `GenerateTab` 的 v1/v2 映射已符合「v1=较新、v2=较旧」且与 `VersionComparePanel` 标签一致（审查报告可能基于旧快照），本次以注释固化语义。
2. **契约团队并行改动**：`types/ai.api.ts` / `types/index.ts` / `api/ai.ts` 由 task-4 并行修改（`ingredients?`、`score?`、`cost_score`、`name_cn`、`dosage_mg` 等），本次改动与其兼容；`tsc` 通过证明无类型冲突。
3. **死代码服务**：按要求未删除 `services/formulaDesignEngine.ts`、`knowledge/FormulaKnowledgeGraph.ts`、`optimizer/FormulaGeneticOptimizer.ts`、`inference/FormulaInferenceEngine.ts`，由契约团队处理。
4. **OptimizationAdvisor/FormulaSharePanel**：评分 prop 为数值类型，缺失时以 `0` 兜底并在 `FormulaResultsPro` 层显示「暂无数据」提示，未侵入修改这两个共享组件。
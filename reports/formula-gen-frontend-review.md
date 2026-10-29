# 配方生成前端审查报告

> 审查对象：RMFOODFP `http://localhost:3000/ai` 页面「配方生成」（GenerateTab）功能模块前端实现
> 审查方式：只读静态审查（未修改任何文件）
> 审查日期：2026-10-27
> 审查范围：`AIAssistantPage` → `GenerateTab` 及其全部子模块（hooks / components / config / services / optimizer / knowledge / inference）、`api/ai.ts`、`generationStore`、`config/ai/*`、相关面板组件

---

## 审查范围

按任务优先级实际阅读并核对的文件：

1. `frontend/src/pages/ai/AIAssistantPage.tsx`（lazy import 与 tab 装配）
2. `frontend/src/components/ai/features/GenerateTab.tsx`（主组件，679 行）
3. `frontend/src/components/ai/features/GenerateTab/` 全部子文件：
   - hooks：`useFormulaGeneration` / `useGenerationCache` / `useFormulaVersions` / `useSavedFormulas` / `useFormulaFilters` / `useGenerateEffects` / `useAlgorithmConfig` / `useExportFormula` / `useGenerationShortcuts` / `useFormulaTemplates` / `useGenerationHistory`
   - components：`GenerationInputPro` / `FormulaResultsPro` / `HeaderPro` / `FormulaRecommendPanel` / `FormulaExplanationPanel` / `FormulaExplanationModal` / `FormulaComparePanel` / `AlgorithmConfigPanel` / `ConstraintPanel` / `ResultsViewSwitcher` / `ErrorMessage` / `SuccessMessage`
   - config：`generateTabConfig.ts`
4. `frontend/src/api/ai.ts`（`generate` / `generateAdvanced` / `generateGenetic` / `multiObjectiveOptimize` / `generateGeneticHybrid` / 归一化逻辑）
5. `frontend/src/components/ai/features/services/formulaDesignEngine.ts`
6. `frontend/src/components/ai/features/services/optimizer/FormulaGeneticOptimizer.ts`、`knowledge/FormulaKnowledgeGraph.ts`
7. `frontend/src/components/ai/features/services/formulaIntelligenceService.ts`、`inference/FormulaInferenceEngine.ts`、`dialogue/FormulaDialogueManager.ts`
8. `frontend/src/stores/generationStore.ts`、`frontend/src/config/ai/constants.ts`、`frontend/src/config/ai/effects.ts`
9. `frontend/src/components/ai/AdvancedGeneratePanel.tsx`、`GenerationProgressPanel.tsx`、`FormulaInputWithOptimization.tsx`、`GeneticAlgorithmPanel.tsx`、`MultiObjectivePanel.tsx`
10. 关联组件：`FormulaInputWindow`、`NeuralResultCard`、`FormulaComposition`、`FormulaValidationModal`、`useFormulaAnalysis`、`useGenerationProgress`、`usePersistentState`、`FormulaIngredientInput/types`、`FormulaIngredientInput/nsga2`、`api/client.ts`、`config/index.ts`
11. 后端对照验证：`backend/app/api/ai_modules/generation_v2.py`、`generation.py`、`backend/app/services/ai/formula_generation_service.py`、`backend/app/services/ai/algorithms/genetic_formula_optimizer.py`

审查维度：P0 运行时崩溃/假数据 → P1 骨架/状态脱节 → P2 数据真实性/国际化 → P3 UI/UX。

---

## 严重问题（P0）

### P0-1 本地 NSGA-II 优化器在成分数 < 3 时死循环，冻结浏览器标签页

- **位置**：`frontend/src/components/ai/features/FormulaIngredientInput/nsga2.ts:84-89`；触发入口 `frontend/src/components/ai/features/FormulaInputWithOptimization.tsx:67-146`
- **严重级别**：P0（运行时崩溃/挂死）
- **问题描述**：`initializePopulation()` 中 `numIngredients = Math.max(3, Math.floor(Math.random() * (this.baseIngredients.length - 2)) + 3)`，随后 `while (selectedIndices.size < numIngredients)` 从 `baseIngredients` 中随机挑选**不重复**下标。当用户提交的配方只有 1～2 种成分时（`FormulaIngredientInput/utils.ts:77-84` 的表单校验仅要求「至少一种成分」），`numIngredients` 恒为 3，而可选集合只有 1～2 个元素，`while` 循环永远无法满足 `size >= 3` → **无限循环，浏览器主线程卡死**。
- **复现/证据**：
  1. AI 页 →「遗传算法」→「配方模式」（FormulaInputWithOptimization）→ 配方输入只添加 1 种成分（比例 100%）→ 提交优化。
  2. 校验逻辑 `validateForm` 只拦截 `ingredients.length === 0`，1 种成分可通过校验。
  3. `nsga2.ts:84-89` 的 `Math.max(3, ...)` 保证 `numIngredients ≥ 3`，与可选集大小矛盾。
- **建议修复方案**：
  1. 在 `initializePopulation()` 前加防御：`if (this.baseIngredients.length < 3) throw new Error('至少需要 3 种成分才能运行多目标优化')`。
  2. 同步在 `FormulaIngredientInput` 校验中增加「至少 3 种成分」的前端提示（utils.ts 的 `validateForm`）。
  3. `numIngredients = Math.min(Math.max(3, ...), this.baseIngredients.length)`，确保不超过可选集大小。

---

## 高优问题（P1）

### P1-1 生成进度条为「事后补放」的假进度，请求等待期间长期停在 10%

- **位置**：`frontend/src/components/ai/features/GenerateTab/hooks/useFormulaGeneration.ts:103-120`；同模式见 `frontend/src/components/ai/AdvancedGeneratePanel.tsx:62-88`；人工延迟见 `frontend/src/hooks/useFormulaAnalysis.ts:76,95,114,134`
- **严重级别**：P1（骨架问题：进度条假跑）
- **问题描述**：`updateProgress('generating', 30, ...)` / `('optimizing', 60, ...)` / `('validating', 80, ...)` 全部放在 `await aiApi.generate(...)` **返回之后**同步执行。真实网络等待期间进度条只显示 10%「准备中」，API 一返回就瞬间跳到 100%。`useFormulaAnalysis` 还额外插入 3 段 `setTimeout(300)` 人为延时，制造“多阶段分析”的假象。
- **复现/证据**：任意一次生成，观察进度条：请求发出后长时间停留在 10%，响应到达后 30/60/80/100 连续跳变。
- **建议修复方案**：进度条改为「不确定进度」（indeterminate）样式，或按请求发出→收到响应的真实时间戳分段推进；删除 `useFormulaAnalysis` 中的 `setTimeout(300)` 人为延时，改为真正串行调用各分析端点并逐段推进。

### P1-2 「AI 增强 / LLM 生成」开关不生效，后端忽略 `use_llm`

- **位置**：`frontend/src/components/ai/features/GenerateTab/components/HeaderPro.tsx:133-150`（开关 UI）；`frontend/src/api/ai.ts:793-799`（发送 `use_llm`）；`backend/app/api/ai_modules/generation_v2.py:39-74`（后端完全忽略 `use_llm`，只读取 `target_effects` / `constraints`）
- **严重级别**：P1（骨架问题：功能开关无效）
- **问题描述**：前端切换「AI 增强」只改变按钮文案（「AI 智能生成」 vs「开始生成」）和请求体里的 `use_llm` 字段，但后端 `/ai/generate` 的 `generate_formula()` 从不读取 `req.use_llm`，`run_ga_generation()` 也不接收该参数。开关对生成结果**零影响**。
- **复现/证据**：`generation_v2.py:67` `result = await run_ga_generation(req.target_effects, req.constraints)` 未传 `use_llm`。
- **建议修复方案**：二选一——(a) 后端在 `generate_formula` 中真正接入 `use_llm`（为真时走 `llm_service.generate_formula_with_llm`，为假走 GA）；(b) 若暂不支持 LLM 生成，前端隐藏该开关并移除「AI 增强」误导文案，不要保留无效开关。

### P1-3 「手动输入」模式语义错误：用户手写配方被丢弃，只把配方名当功效关键词重新生成

- **位置**：`frontend/src/components/ai/features/GenerateTab.tsx:327-340`（`handleManualFormulaInput`）；`frontend/src/components/ai/FormulaInputWindow.tsx:97-102`（提交分析结果）
- **严重级别**：P1（状态脱节 / 功能语义错误）
- **问题描述**：用户在手动模式输入完整配方文本，`FormulaInputWindow` 通过 `useFormulaAnalysis` 真实调用了安全/协同/口感/稳定性接口并构造出 `AICandidate`，但提交时 `GenerateTab.handleManualFormulaInput` 只取 `candidate.formula_name`（配方名称，如“黄芪当归复合肽…”）作为 `target_effects` 重新触发 `mutation.mutate([配方名])`。后端把配方名当功效标签做关键词映射（`EFFECT_LABEL_TO_TCM_KEYWORD` 未命中时原样作为关键词），结果与用户输入配方**无关**。
- **复现/证据**：`GenerateTab.tsx:334` `generationHook.mutation.mutate([candidate.formula_name.trim()])`。
- **建议修复方案**：手动输入应直接采用 `FormulaInputWindow` 分析得到的 `candidate`（`generationHook.setGenerateResult([candidate])`），或将配方文本作为 `description` 传给后端做解析，而不是把配方名当功效重新生成。

### P1-4 优化建议 / 分享面板使用占位数据（空成分 + 硬编码评分）

- **位置**：`frontend/src/components/ai/features/GenerateTab/components/FormulaResultsPro.tsx:203-228`
- **严重级别**：P1（假数据/占位符）
- **问题描述**：`OptimizationAdvisor` 与 `FormulaSharePanel` 收到的 `ingredients: []`（空成分），`scores` 中 `taste: 80`、`stability: 75`、`safety: 90`、`cost: 70` 是硬编码占位值，只有 `synergy`/`overall` 取自真实候选。由此生成的“优化建议”（依赖 `formula.ingredients.length > 1`、`formula.ingredients[0]` 等逻辑）和分享卡片（`ingredientsHtml` 为空）都是基于伪造数据的空壳输出。
- **复现/证据**：`FormulaResultsPro.tsx:207` 与 `:223` 两处传入 `ingredients: []` 和固定评分。
- **建议修复方案**：把 `generateResult[0].herb_combination` 映射为 `ingredients`，并透传真实 `taste_score/stability_score/safety_score/cost_score`（缺失时显示「暂无数据」，而不是硬编码 80/75/90/70）。

### P1-5 手动配方分析在 API 失败时静默伪造默认评分

- **位置**：`frontend/src/hooks/useFormulaAnalysis.ts:85-153`
- **严重级别**：P1（假数据/占位响应）
- **问题描述**：`safetyCheck` / `synergyAnalysis` / `tastePredict` / `stabilityPredict` 任一接口失败时，仅 `logger.warn` 后写入硬编码默认值（`passed: true`、`score: 0.75`、`overall_score: 0.7`、`stability_score: 0.75` 等），并继续完成「分析完成」流程，用户看到一份看似真实、实则伪造的评分报告，无任何降级提示。
- **复现/证据**：`useFormulaAnalysis.ts:86-92`、`:104-111`、`:124-131`、`:145-152` 四处 catch 分支。
- **建议修复方案**：接口失败时在 UI 明示「安全/协同/口感/稳定性评分暂不可用（服务降级）」，并将对应分数字段置空；或在汇总时显著标注“部分评估为默认值”。至少不要静默展示伪造分数。

### P1-6 已保存状态（useSavedFormulas）为组件本地 state，切 tab 即丢失

- **位置**：`frontend/src/components/ai/features/GenerateTab/hooks/useSavedFormulas.ts:11-59`
- **严重级别**：P1（状态脱节）
- **问题描述**：`savedFormulas`（候选→配方 ID 映射）与 `saveSuccess` 都存放在组件本地 `useState`。切换到其他 tab（GenerateTab 卸载）再切回，`GenerateTab` 重挂载后映射清空，已保存的候选卡片上的「已保存」标记消失，可能允许用户重复保存同一候选。
- **复现/证据**：保存候选 → 切到「智能对话」→ 切回「配方生成」，结果面板卡片不再显示已保存状态。
- **建议修复方案**：将 `savedFormulas` 提升到 `useGenerationStore`（与 `generateResult` 同生命周期），并在 `resetGeneration` 时一并清理。

### P1-7 高级模式生成结果未写入全局 store，切 tab/切模式即丢失

- **位置**：`frontend/src/components/ai/features/GenerateTab.tsx:521-525`
- **严重级别**：P1（状态脱节）
- **问题描述**：`AdvancedGeneratePanel` 的 `onCandidatesGenerated` 回调只执行 `logger.info`，没有调用 `generationHook.setGenerateResult`。高级模式生成的候选只存在于 `AdvancedGeneratePanel` 本地 state；切 tab 或切回简单模式后结果消失，且与版本历史/批量保存等下游功能完全脱节。
- **复现/证据**：`GenerateTab.tsx:522-524`。
- **建议修复方案**：在 `onCandidatesGenerated` 中调用 `generationHook.setGenerateResult(candidates)` 与 `setGenerator('ga')`，让高级模式结果与简单模式共用同一结果面板与全局状态。

---

## 中低优问题（P2/P3）

### P2-1 前端本地「知识库/引擎」为硬编码小数据集，且基本是死代码

- **位置**：
  - `frontend/src/components/ai/features/services/formulaDesignEngine.ts:158-405`（`INGREDIENT_DATABASE` 仅 18 种成分，key 为 `astragalus/angelica/ginseng/...` 英文）
  - `frontend/src/components/ai/features/services/knowledge/FormulaKnowledgeGraph.ts:116-163`（预置 18 成分 + 14 功效，纯前端硬编码）
  - `frontend/src/components/ai/features/services/optimizer/FormulaGeneticOptimizer.ts:48-49`（硬编码 18 个 id）
  - `frontend/src/components/ai/features/services/formulaIntelligenceService.ts`、`inference/FormulaInferenceEngine.ts`
- **严重级别**：P2（数据真实性 / 死代码）
- **问题描述**：
  1. 这些服务标注为「基于中国药典/真实数据库」，实际是**前端硬编码的英文-key 小型数据集**，与后端真实药食同源/药材库（106 种合规目录）完全脱节。
  2. 运行期只有 `formulaIntelligenceService.detectIntent` 在 `useChatSendMessage.ts:169` 被调用（仅做关键词意图判断）；`processUserInput`、`FormulaGeneticOptimizer`、`FormulaInferenceEngine.analyzeFormula`、`FormulaDialogueManager.process` 均**无任何运行时调用点**（仅测试/内部引用）。
  3. GenerateTab 的真实生成路径（`aiApi.generate → /api/v1/ai/generate → run_ga_generation`）确实接入后端真实 GA 引擎，因此主流程不受这些假数据影响；但这些「伪引擎」文件会让维护者误以为前端有真实知识库。
- **复现/证据**：grep 全库：`formulaIntelligenceService.processUserInput`、`new FormulaGeneticOptimizer`、`inferenceEngine.analyzeFormula` 均无业务调用。
- **建议修复方案**：删除或归档这些死代码服务；若需保留，则改为调用后端 `/ai/formula/knowledge`（`retrieveHerbKnowledge`）等真实接口，并将 `processUserInput` 接入实际对话流程或明确标注 deprecated。

### P2-2 AICandidate 类型契约与后端实际返回不一致（`score` / `ingredients` 必填但后端不返回）

- **位置**：`frontend/src/types/ai.api.ts:26-72`（`score: number`、`ingredients: [...]` 为必填）；`backend/app/services/ai/formula_generation_service.py:203-219`（实际只返回 `overall_score` 与 `herb_combination`）
- **严重级别**：P2（数据真实性 / 类型契约）
- **问题描述**：后端 `/ai/generate` 候选没有 `score` 和 `ingredients` 字段，但类型定义为必填。运行时组件多用 `herb_combination`/`overall_score` 因此未崩溃，但任何直接读取 `candidate.score` 或 `candidate.ingredients` 的代码都会拿到 `undefined`。
- **建议修复方案**：将 `AICandidate.score` 与 `ingredients` 改为可选，或在前端归一化层（`api/ai.ts`）统一补出 `score = overall_score`、`ingredients = herb_combination` 映射。

### P2-3 「综合」排序失效：按 `candidate.score` 排序，而后端候选恒为 0

- **位置**：`frontend/src/components/ai/features/GenerateTab/hooks/useFormulaFilters.ts:30-33`
- **严重级别**：P2（功能失效）
- **问题描述**：`comparison = (a.score || 0) - (b.score || 0)`，后端 GA 候选没有 `score` 字段（见 P2-2），所有候选此项为 0，排序结果等于原始顺序；UI 上「综合 ↓/↑」指示器形同虚设。
- **复现/证据**：生成结果后切换「综合」排序方向，列表顺序不变。
- **建议修复方案**：改用 `a.overall_score ?? a.synergy_score ?? 0`。

### P2-4 国际化残留英文标签

- **位置**：
  - `frontend/src/components/ai/features/GenerateTab/components/FormulaResultsPro.tsx:195`（`PDF（即将推出）`，且 JSON/CSV 未本地化）
  - `frontend/src/components/ai/features/GenerateTab/components/SuccessMessage.tsx:27`（`(ID: ${formulaId})`）
  - `frontend/src/components/ai/features/MultiObjectivePanel.tsx:805-807`（导出 CSV 表头 `Rank`/`Fitness`）
  - `frontend/src/components/ai/features/FormulaInputWithOptimization.tsx:502`（`Pareto Rank`）
- **严重级别**：P2（用户要求彻底消除英文标签）
- **问题描述**：用户界面仍存在英文/半英文残留。JSON/CSV 作为格式缩写可接受，但「PDF（即将推出）」、`ID:`、`Rank`、`Fitness`、`Pareto Rank` 等属于未本地化文本。
- **建议修复方案**：将上述文案改为中文（「导出 PDF（即将推出）」→ 若已实现则改为「导出 PDF」并移除禁用；CSV 表头改「排名/适应度」；`Pareto Rank` →「Pareto 排名」）；`ID` 改为「编号」。

### P2-5 模型状态类型不一致，可能导致 LLM 在线指示恒为离线

- **位置**：`frontend/src/pages/ai/AIAssistantPage.tsx:234`（`modelStatus?.llm?.status === 'active'`）；`frontend/src/api/modelClient.ts:309`（返回 `Record<string, ModelStatus>`）；`frontend/src/components/ai/features/GenerateTab/components/HeaderPro.tsx:148`（`modelStatus?.llm?.provider`）
- **严重级别**：P2（状态脱节）
- **问题描述**：`ModelStatus` 实际是 `Record<string, ModelStatus>`（按模型名/类别为键），而 `GenerateTab` 的 `ModelStatus` props 类型是 `{ llm?: { provider; model; available } }`。若后端返回的键不是 `llm`（或层级不同），`llmAvailable` 恒为 `false`，「AI 增强」开关永远不可用，模型状态徽标恒为「离线」。
- **建议修复方案**：在 `AIAssistantPage` 中显式归一化：`const llmStatus = (modelStatus as Record<string, any>)?.llm ?? Object.values(modelStatus ?? {})[0]`，再取 `status`/`available`。

### P3-1 死代码 Hook：`useFormulaTemplates` / `useGenerationHistory` 仅测试引用

- **位置**：`frontend/src/components/ai/features/GenerateTab/hooks/useFormulaTemplates.ts`、`useGenerationHistory.ts`
- **严重级别**：P3（死代码）
- **问题描述**：两个 hook 均基于 localStorage，但全库无任何业务组件引用（仅 `__tests__` 引用）。属于历史遗留死代码。
- **建议修复方案**：删除文件及其测试，或在 GenerateTab 中实际接入模板/历史功能。

### P3-2 HeaderPro「历史记录」按钮无点击行为

- **位置**：`frontend/src/components/ai/features/GenerateTab/components/HeaderPro.tsx:121-130`
- **严重级别**：P3（UI/UX）
- **问题描述**：历史按钮展示 `historyCount` 徽标，但 `onClick` 缺失，点击无任何响应。
- **建议修复方案**：接入版本历史面板（`useFormulaVersions` 已有数据）或移除按钮。

### P3-3 PDF 导出菜单标「即将推出」且禁用，但导出逻辑实际已实现

- **位置**：`frontend/src/components/ai/features/GenerateTab/components/FormulaResultsPro.tsx:195`；`frontend/src/components/ai/features/GenerateTab/hooks/useExportFormula.ts:101-144`
- **严重级别**：P3（功能与 UI 矛盾）
- **问题描述**：下拉菜单 PDF 项 `opacity-50 cursor-not-allowed` 标注「即将推出」，但 `useExportFormula` 已通过打印窗口实现 PDF 导出。用户无法从 UI 触发已实现的功能。
- **建议修复方案**：启用 PDF 菜单项并移除「即将推出」文案。

### P3-4 版本对比参数语义颠倒

- **位置**：`frontend/src/components/ai/features/GenerateTab.tsx:575-579`、`FormulaResultsPro.tsx:294-300`（`onCompareVersions(1, 2)`）；`GenerateTab.tsx:621-623`（`version1=versions[v2-1]`、`version2=versions[v1-1]`）
- **严重级别**：P3（UI/UX）
- **问题描述**：`onCompareVersions(1, 2)` 传入 `v1=1, v2=2`，弹窗中 `version1 = formulaVersions[2-1]=[1]`（较旧）、`version2 = formulaVersions[1-1]=[0]`（较新），而标签固定为「候选配方/最优配方」，新旧版本位置与标签含义不符。
- **建议修复方案**：统一 `v1` 为较新版本、`v2` 为较旧版本，或调整标签。

### P3-5 其他小问题

- `AdvancedGeneratePanel` 只展示 7 个功效选项（`AdvancedGeneratePanel.tsx:12-14`），与主面板 40+ 功效不一致，且生成按钮文案/标题未走 i18n。
- `FormulaResultsPro` 统计 `passedSafety` 使用 `c.safety_passed`，后端 GA 候选默认不带该字段，安全通过数恒为 0（`FormulaResultsPro.tsx:93`）。
- `useGenerationCache` 为模块级单例 LRU（内存缓存），`showCacheInfo` 面板的「清除缓存」只清内存，不影响任何持久状态，功能价值低（`useGenerationCache.ts:91`）。

---

## 修复建议（按优先级）

### P0（必须立即修复）
1. **`FormulaIngredientInput/nsga2.ts:84-89`**：`initializePopulation` 增加 `baseIngredients.length < 3` 防御并抛错；`numIngredients` 上限收敛到 `baseIngredients.length`。同步在 `FormulaIngredientInput/utils.ts:77-84` 增加「至少 3 种成分」校验。

### P1（高优，影响功能真实性）
2. **`useFormulaGeneration.ts:103-120` / `useFormulaAnalysis.ts:76,95,114,134`**：移除事后补放进度与人为 300ms 延时，改为不确定进度或按真实请求阶段推进。
3. **`generation_v2.py:39-74` + `HeaderPro.tsx:133-150`**：后端真正支持 `use_llm`，或前端移除无效的「AI 增强」开关。
4. **`GenerateTab.tsx:327-340`**：手动输入直接采用分析得到的 candidate（`setGenerateResult`），不要将配方名当功效重新生成。
5. **`FormulaResultsPro.tsx:203-228`**：优化建议/分享面板透传真实 `herb_combination` 与评分，删除 `ingredients: []` 和硬编码 80/75/90/70。
6. **`useFormulaAnalysis.ts:85-153`**：API 失败时显式降级提示，禁止静默伪造默认评分。
7. **`useSavedFormulas.ts`**：已保存映射提升到 `useGenerationStore`，避免切 tab 丢失。
8. **`GenerateTab.tsx:521-525`**：高级模式结果写入 `generationHook.setGenerateResult`，接入全局状态。

### P2（数据真实性与国际化）
9. **删除/归档前端硬编码引擎死代码**（`formulaDesignEngine` / `FormulaKnowledgeGraph` / `FormulaGeneticOptimizer` / `FormulaInferenceEngine` / `formulaIntelligenceService` 除 `detectIntent` 外的部分），或接入真实后端知识接口。
10. **`types/ai.api.ts:26-72`**：将 `AICandidate.score` / `ingredients` 改为可选，或在 `api/ai.ts` 归一化补齐。
11. **`useFormulaFilters.ts:30-33`**：改用 `overall_score ?? synergy_score ?? 0` 排序。
12. **国际化残留**：`FormulaResultsPro.tsx:195`、`SuccessMessage.tsx:27`、`MultiObjectivePanel.tsx:805-807`、`FormulaInputWithOptimization.tsx:502` 的英文文案中文化。
13. **`AIAssistantPage.tsx:234`**：归一化 `modelStatus` 结构，确保 `llmAvailable` 判断可靠。

### P3（体验与清理）
14. 删除 `useFormulaTemplates` / `useGenerationHistory` 死代码。
15. `HeaderPro.tsx:121-130` 历史按钮接入版本历史或移除。
16. 启用 PDF 导出菜单项（`FormulaResultsPro.tsx:195`）。
17. 修正版本对比参数语义（`GenerateTab.tsx:621-623`）。
18. 统一 `AdvancedGeneratePanel` 功效选项与主面板一致，并补 i18n。
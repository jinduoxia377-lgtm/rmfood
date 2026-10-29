# 配方生成模块 深度审查与开发 汇总报告

- 项目：RMFOODFP 食源性药食同源配方平台
- 页面：http://localhost:3000/ai「配方生成」功能模块
- 时间：2026-10-27 ~ 2026-10-28
- 组织者：lead（团队负责人）

---

## 一、任务背景

用户反馈：`http://localhost:3000/ai` 页面的「配方生成」功能模块存在严重运行问题，功能尚未真正实现配方生成，存在骨架问题。要求组织团队审查，然后组织团员深度开发。

## 二、审查阶段（3 人审查团队）

| 审查员 | 侧重 | 报告 |
|---|---|---|
| review-frontend | 前端实现（GenerateTab 主流程/组件/hooks/services/死代码） | `reports/formula-gen-frontend-review.md` |
| review-backend | 后端管线（/generate 系端点/GA 引擎/数据真实性） | `reports/formula-gen-backend-review.md` |
| review-integration | 端到端运行链路/认证/API 契约/RAG 缺口/英文残留 | `reports/formula-gen-integration-review.md` |

### 审查核心结论

- **主链路是真实的**：已登录浏览器会话可真实调用 `POST /api/v1/ai/generate`，后端基于数据库 `tcm_herbs`（612 行，583 行含 extra_knowledge）真实运行遗传算法（80 种群 × 30 代），返回中文药名 + 克剂量 + 君臣佐使角色。**不是假实现**。
- 但存在大量骨架/运行缺陷：

**P0（5 项）**
1. 前端 `FormulaIngredientInput/nsga2.ts` 在成分数 <3 时 `initializePopulation` 无限循环 → 浏览器标签页冻结。
2. 后端 `/generate` 未认证调用返回 500（`current_user.id` 对 None 抛 AttributeError），应 401。
3. 后端 `/generate/v2` 同步 LSTM 推理阻塞事件循环约 52 秒（实测），服务器假死。
4. 后端 GA 失败时静默回退硬编码随机配方（数据库故障时会 HTTP 200 返回假数据）。
5. （风险）`/generate/v2` 使用硬编码 `_BUILTIN_HERBS` 词表、返回药材 ID、安全检查是 TODO 空操作。

**P1（14 项）**：假进度条、use_llm 开关无效、手动输入丢弃用户配方、优化/分享面板占位数据、useFormulaAnalysis 静默伪造评分、useSavedFormulas 切 tab 丢失、高级模式结果未写全局 store、算法参数/个人约束面板无效、候选去重过度只返回 1 个、响应缺 score/safety_passed、seven-step 安全验证恒失败、RAG 完全不参与、聊天模式自由文本直传 target_effects、工作流 formula_gpt 走 MOCK。

**P2/P3（15 项）**：前端硬编码英文-key 小数据集死代码、类型契约不一致、排序失效、英文标签残留、配额可绕过、安全合规数据不准确（药食同源目录/28对禁忌/剂量上限）等。

## 三、开发阶段（4 人开发团队）

| 开发员 | 任务 | 侧重 | 验证报告 |
|---|---|---|---|
| dev-backend-core | task-1 | 后端主链路 P0/P1（认证/参数透传/去重/契约/配额/v2 异步） | `reports/formula-gen-backend-fix-verify.md` |
| dev-backend-rag | task-2 | RAG 接入 + 安全合规数据质量 | `reports/formula-gen-backend-rag-fix-verify.md` |
| dev-frontend-core | task-3 | 前端骨架修复（nsga2 死循环/假进度/占位数据/状态脱节/中文化） | `reports/formula-gen-frontend-fix-verify.md` |
| dev-frontend-contract | task-4 | 前端契约与集成（类型/归一化/聊天意图/分类对齐/PDF/死代码治理） | `reports/formula-gen-frontend-contract-fix-verify.md` |

### 开发成果摘要

#### 后端（task-1 + task-2）
1. **认证修复**：`/generate` 改 `get_current_active_user` 强制认证，未认证返回 401（不再 500）。
2. **use_llm 生效**：`use_llm=true` 走 `llm_service.generate_formula_with_llm`，不可用自动回退 GA。
3. **算法参数/个人约束真实生效**：`run_ga_generation` 读取 population_size/generations/mutation_rate/crossover_rate/elite_ratio/tournament_size 传入 GAConfig；透传 exclude_herbs/allergies/age_group/max_cost（中文名自动归一化 herb_id，含成本过滤）。
4. **禁止静默假配方**：HerbKnowledge 未初始化抛 503；GA 失败返回 `degraded:true + fallback_reason` 并 ERROR 告警。
5. **候选去重修复**：Jaccard 0.85→0.6 + 剂量分布相似度判断，整个种群去重后按适应度截断 Top-N，实测返回 5 个差异化候选。
6. **契约统一**：GA 系列 `herb_combination` 改为 `{name_cn: 中文名, dosage_g: 克}`；所有候选补充 `score` 与 `safety_passed`。
7. **配额统一**：genetic/multi-objective/unified 及全部 stream/hybrid 端点补上 `ensure_ai_quota`。
8. **/generate/v2 治理**：LSTM 推理放入 `asyncio.to_thread`（不再阻塞 52s）；改用数据库 590 味药材构建词表并返回中文名；`_safety_check` 实现十八反十九畏 + 剂量上限校验。
9. **RAG 接入**：新增 `backend/app/services/ai/rag/formula_rag_hook.py`，`run_ga_generation` 检索知识库（296味/106种/国标）生成白名单/黑名单影响 GA 筛选，响应新增 `rag_evidence` 供前端展示；清理 `FormulaDesigner(knowledge_base={})`。
10. **安全合规数据**：药食同源目录改从 `hf_enriched_herbs` 表加载官方 106 种；十八反/十九畏补齐 28 对；毒性检查接入 DB 剂量上限；`compliance_tool.FOOD_HERB_LIMITS` 覆盖全部 106 种。
11. **seven-step 修复**：`check_formula_safety` 参数修正，safety 验证不再静默失败。
12. **工作流去 MOCK**：`formula_gpt` 执行器由 `MockFormulaGPTService` 替换为 `run_ga_generation`。
13. **连接泄漏修复**：`herb_knowledge_adapters` 会话生命周期用 `async with` 管理；`get_herb_by_id` 双路匹配。

#### 前端（task-3 + task-4）
1. **P0 死循环修复**：`nsga2.ts` 增加 `baseIngredients.length<3` 防御 + `numIngredients` 上限收敛；表单校验至少 3 种成分。
2. **假进度条** → 不确定进度（indeterminate），删除 API 返回后同步跳 30/60/80/100 的伪阶段；移除 `useFormulaAnalysis` 人为 300ms 延时。
3. **禁止伪造评分**：`useFormulaAnalysis` 接口失败时置 `degraded=true`、分数保持 undefined，UI 明示「部分评估服务暂不可用」。
4. **手动输入语义修复**：直接采用 `FormulaInputWindow` 分析得到的候选（`setGenerateResult([candidate])`），不再把配方名当功效重新生成。
5. **占位数据清除**：优化建议/分享面板改用真实 `herb_combination` 与评分，缺失显示「暂无数据」。
6. **状态脱节修复**：`useSavedFormulas` 提升到 `useGenerationStore`（切 tab 不丢）；高级模式结果写入全局 store。
7. **排序/安全统计修复**：排序改用 `overall_score ?? synergy_score ?? 0`；`api/ai.ts` 归一化补齐 `score`/`safety_passed`/`ingredients`。
8. **聊天模式意图解析**：`GenerationInputPro` 先 `detectIntent` + 功效标签提取，无法解析时引导用户选择功效标签，禁止自由文本直传。
9. **分类筛选对齐**：`CATEGORY_EFFECTS` 对齐前端精确 label（增强免疫力→增强免疫 等）。
10. **PDF 导出修复并启用**：`useExportFormula` 修正表头/HTML 转义；菜单项「导出 PDF」启用。
11. **中文化**：`PDF（即将推出）`/`ID:`/`Rank`/`Fitness`/`Pareto Rank` → 中文。
12. **死代码治理**：`FormulaKnowledgeGraph` 接入 `retrieveHerbKnowledge` 真实接口；4 个硬编码服务标注 `@deprecated`。
13. **模型状态归一化**：`AIAssistantPage` 归一化 `modelStatus`，`llmAvailable` 判断可靠。
14. **历史按钮接入版本历史面板**。

## 四、验证结果

- 后端直调 `run_ga_generation(["增强免疫"], {max_candidates:5, population_size:40, generations:15, exclude_herbs:["黄芪"], max_cost:50})`：
  - 日志确认算法参数生效（种群=40/代数=15，默认调用为 80/30）；
  - 返回 5 个差异化候选，中文名+克剂量+role，含 score/safety_passed；
  - `exclude_herbs=["黄芪"]` 生效，所有候选不含黄芪。
- 未认证 POST `/api/v1/ai/generate` → **401**（不再是 500）。
- RAG 钩子：`rag_evidence.enabled=True`，检索 6 知识块，7 味禁忌药材进入黑名单并透传 GA。
- seven-step：`check_formula_safety` 不再抛 TypeError，`validation.safety` 正常填充。
- safety_checker：甘草 100g 拦截（超 DB 上限 6g/日）、甘草 3g 放行、甘草+甘遂 触发十八反（规则总数 28）。
- 前端 `npx tsc --noEmit` 通过；相关单测 5 文件全部通过（utils 22、useFormulaAnalysis 25、useFormulaGeneration 4、GenerateTabSaveAll 7、useGenerationProgress 等）。

## 五、遗留/建议事项

1. 后端 `EFFECT_LABEL_TO_TCM_KEYWORD` 仍缺部分前端 label（提高抵抗力/缓解疲劳/促进消化/调节代谢/控制体重/安神定志/清咽利喉/强健筋骨/补钙健骨 等），建议补充映射。
2. `types/index.ts` 与 `types/ai.api.ts` 的 legacy `AICandidate` 仍为两套类型，建议后续合并。
3. RAG 黑名单当前为「药材名 ±120 字符内禁忌关键词」保守启发式，建议后续接入结构化 `extra_knowledge.contraindication` 精化。
4. 验证使用 `backend/venv`（`backend/.venv` 缺依赖），建议补全 `.venv`。
5. 建议在浏览器登录后实测一次「配方生成」完整流程，确认 UI 展示 rag_evidence 与多候选对比。

## 六、相关报告文件

- `reports/formula-gen-frontend-review.md`（前端审查）
- `reports/formula-gen-backend-review.md`（后端审查）
- `reports/formula-gen-integration-review.md`（端到端集成审查）
- `reports/formula-gen-backend-fix-verify.md`（后端核心修复验证）
- `reports/formula-gen-backend-rag-fix-verify.md`（后端 RAG/数据质量修复验证）
- `reports/formula-gen-frontend-fix-verify.md`（前端骨架修复验证）
- `reports/formula-gen-frontend-contract-fix-verify.md`（前端契约/集成修复验证）
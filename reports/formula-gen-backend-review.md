# 配方生成后端审查报告

- 审查时间：2026-10-27
- 审查方式：只读静态审查 + 只读运行验证（直接调用服务层函数，不修改任何文件）
- 审查范围：`backend/app/api/ai_modules/generation_v2.py`、`generation.py`、`genetic.py`、`backend/app/services/ai/formula_generation_service.py`、`algorithms/genetic_formula_optimizer.py`、`bayesian_formula_optimizer.py`、`binary_ga_optimizer.py`、`nsga3_optimizer.py`、`algorithm.py`、`models/unified_formula_engine.py`、`ai_models/formula_gpt.py`、`data/mock_ai_responses.py`、`agent/tools/formula_tool.py`、`compliance_tool.py`、`safety_checker.py`、`formula_designer.py`、`formula/seven_step_engine.py`、`formula/framework_engine.py`、`safety_alert_system/formula_check.py`、`models/external_data.py`、`rag/rag_service.py`，以及前端 `src/api/ai.ts`、`src/components/ai/features/GenerateTab.tsx` 的契约归一化代码。

## 审查结论（摘要）

**主路径（POST /api/v1/ai/generate、/generate/advanced、/generate/genetic、/generate/multi-objective、/generate/unified）是真实实现，不是骨架/假实现。** 通过只读运行验证确认：

- 数据库真实可用：`tcm_herbs` 612 行（583 行含 `extra_knowledge`），`hf_enriched_herbs` 111 行（官方药食同源 106 种），`mmid_herbs` 88 行；
- `run_ga_generation(["增强免疫","抗氧化"])` 实测加载 **590 味数据库药材**，运行真实遗传算法（80 种群 × 30 代），返回 `generator=ga_optimizer`、中文药名 + 克剂量 + 君臣佐使角色，耗时约 1.7s；
- `GeneticFormulaOptimizer`（30 种群 × 10 代）实测 0.15s 返回真实数据库药材（hq/fp/gz/jgl/dg）。

但存在 **2 个 P0 运行错误、1 个 P0 级假实现风险、6 个 P1 高优问题**，详见下文。其中 `/generate/v2` 端点实测单次调用阻塞事件循环约 **52 秒**，会使整个 FastAPI 进程假死，必须优先处理。

---

## 审查范围

| 端点 | 文件 | 是否真实 |
|---|---|---|
| POST /api/v1/ai/generate | generation_v2.py | 真实 GA（`run_ga_generation`），但未认证时 500（P0） |
| POST /api/v1/ai/generate/advanced | generation.py | 真实 GA，同上 |
| POST /api/v1/ai/generate/v2 | generation.py | 真实 LSTM 但用硬编码药材词表，且阻塞 52s（P0/P1） |
| POST /api/v1/ai/generate/seven-step | generation.py | 规则引擎 + DB 药材，安全验证子步骤恒失败（P1） |
| POST /api/v1/ai/generate/genetic（含 stream/hybrid） | genetic.py | 真实 GA/NSGA-II + DB 药材 |
| POST /api/v1/ai/generate/multi-objective（含 stream） | genetic.py | 真实 NSGA-II + DB 药材 |
| POST /api/v1/ai/generate/unified | genetic.py | 真实 GA + DB 药材；异常时回退规则引擎（P0 风险） |
| GET /api/v1/ai/generate/history | genetic.py | 查询 `ga_optimization` 表，真实 |

---

## 严重问题（P0）

### P0-1：`POST /api/v1/ai/generate` 未认证请求返回 500 而非 401

- **位置**：`backend/app/api/ai_modules/generation_v2.py:43,59`
- **问题**：端点依赖 `get_current_user`（可选认证，无 token 时返回 `None`），随后直接执行 `await ensure_ai_quota(db, current_user.id)`。当请求未携带 token（或 token 无效）时，`current_user` 为 `None`，`current_user.id` 抛出 `AttributeError`。该异常不在 `except PermissionError` 捕获范围，落入 `except Exception` 转为 **500 "配方生成失败: 'NoneType' object has no attribute 'id'"**。
- **影响**：前端未登录/登录态过期时调用生成接口得到 500，而非 401 引导重新登录；错误信息暴露内部实现细节。
- **对比**：同一文件其它端点（generation.py 的 advanced/v2/seven-step）均使用 `get_current_active_user`（无 token 时正确返回 401），`/generate` 是唯一不一致的入口。

### P0-2：`POST /api/v1/ai/generate/v2` 同步执行 LSTM 推理，阻塞事件循环约 52 秒

- **位置**：`backend/app/services/ai/models/unified_formula_engine.py:234-248`（`generate()` 内 `for _ in range(n_candidates)` 直接同步调用 `_generate_candidate`），入口 `generation.py:156-220`
- **运行验证**：直接调用 `FormulaDesigner(knowledge_base={}).design({"use_new_engine": True})` 实测 **51,977ms** 才返回。
- **问题**：`generate()` 是 async 函数，但 PyTorch LSTM 的 `generator.generate()` 是纯同步 CPU 推理，未放入 `asyncio.to_thread` / `run_in_executor`。单次请求阻塞整个事件循环约 52 秒，期间服务器所有其它请求（包括健康检查）全部挂起。这是典型的**异步阻塞**，且响应大概率被客户端/网关超时。
- **附带问题**：返回的 `data[0].name` 是药材 ID（实测为 `"gt"`，即钩藤），不是中文名；剂量 `"30.0g"` 超出该药材 `dosage_max`（钩藤 12g），说明 LSTM 输出未经 DB 剂量约束裁剪。

### P0-3（条件性假实现）：主 GA 失败时静默回退硬编码随机配方，可能在数据库不可用时成为事实主路径

- **位置**：`backend/app/services/ai/formula_generation_service.py:277-285`（回退）与 `:87-147`（`_fallback_rule_engine`）；`backend/app/services/ai/__init__.py:91-94`（启动失败仅 warning）
- **问题**：`run_ga_generation` 捕获任何异常后返回 `_fallback_rule_engine`，而该 fallback 的数据源是 `formula_gpt._FOOD_HOMOLOGY_HERBS`——**只有 7 个功效 × 每类 6 味药材的硬编码字典**，且用 `random` 组合生成，`synergy_score/taste_score` 等评分是固定拍脑袋值（0.5~0.85 之间硬编码）。
- **触发条件**：`init_ai_services()` 中 `HerbKnowledgeService` 初始化失败会被吞掉（仅 `logger.warning`），`get_global_herb_knowledge()` 保持 `None`；此后 `GeneticFormulaOptimizer._try_load_herb_knowledge()` 必然抛 `RuntimeError`，于是 `/generate`、`/generate/advanced`、`/generate/unified`（unified 还会先走一次 GA 再 fallback）**全部静默返回硬编码假配方，HTTP 200**。
- **现状**：当前环境数据库正常，实测主路径为 `ga_optimizer`，fallback **尚未**成为主路径；但代码层面没有任何熔断/告警，一旦数据库故障即批量伪造结果。这符合"规则引擎 fallback 被滥用为主路径"的 P0 风险定义。

---

## 高优问题（P1）

### P1-1：`/generate/v2` 使用硬编码 `_BUILTIN_HERBS` 作为药材词表，未使用数据库 590 味药材

- **位置**：`backend/app/services/formula_designer.py:154-171`（`_new_engine_design` 从 `_BUILTIN_HERBS` 构建 `herb_db` 和 `herb_vocab`）；`formula_designer.py:30-39`（`_detect_data_source` 却声称 `database (590 herbs)`，与实现矛盾）
- **问题**：即使 `HerbKnowledgeService` 已加载数据库药材，v2 端点仍用 `bayesian_formula_optimizer._BUILTIN_HERBS`（约 60 个键，且含大量重复：`jj/qss/rq/dq/yys/zz/sjg` 与 `cyh/gz/rs/dg/yq/dcx/sj` 同物不同 id）。功效、剂量、禁忌均来自硬编码，而非数据库。返回的药材名还是 ID 而非中文名。

### P1-2：`/generate/v2` 的安全检查是空操作（TODO 占位）

- **位置**：`backend/app/services/ai/models/unified_formula_engine.py:347-354`
- **问题**：`_safety_check()` 只有 `# TODO: 集成 SafetyChecker` 并原样返回 candidates。v2 生成的配方**不经过任何十八反/十九畏/剂量/过敏原校验**，却向用户返回"已生成"。

### P1-3：seven-step 端点安全验证子步骤恒失败（API 参数不匹配被静默吞掉）

- **位置**：`backend/app/services/formula/seven_step_engine.py:228-243` 调用 `self.safety.check_formula_safety(formula_data={...})`
- **问题**：`SafetyAlertSystem.check_formula_safety` 的真实签名是 `check_formula_safety(ingredients, daily_dosage_g=..., target_group=..., usage_scenario=...)`（见 `safety_alert_system/formula_check.py:20-26`），**不接收 `formula_data` 关键字**。运行验证时每次抛出 `TypeError: check_formula_safety() got an unexpected keyword argument 'formula_data'`，被 `except` 捕获后 `safety_result = {}`，导致 `validation.safety` 永远缺失、摘要中"安全性"一栏永远为空或显示"风险分 ?"。
- **附带问题**：即使修正关键字，`formula_data["ingredients"]` 内使用的是 `amount_g` 字段，而 `check_formula_safety` 读取的是 `amount_mg`，仍会全部跳过。

### P1-4：主路径忽略排除药材/过敏原/成本约束

- **位置**：`backend/app/services/ai/formula_generation_service.py:246-273`
- **问题**：`run_ga_generation` 只读取 `max_candidates`、`total_dosage_g`、`objective_weights`，**从不读取 `constraints["exclude_herbs"]`、`constraints["max_cost"]`**。`POST /generate` 和 `/generate/advanced` 无法排除用户过敏原/禁忌药材，也无法施加成本上限。`GeneticFormulaOptimizer.optimize()` 的 `exclude_herbs` 参数在主路径中始终为 `None`。

### P1-5：响应契约不一致，`herb_combination` 两种 schema 并存，剂量单位命名误导

- **位置**：
  - 主路径 `formula_generation_service.py:183-187`：`herb_combination = [{name: 中文名, dosage: "7.0g", role}]`
  - GA 系列 `genetic.py:706`：`herb_combination = [{name: herb_id, dosage_mg: 克数值}]`（`name` 是 "hq"/"ds" 这类 ID，`dosage_mg` 字段名是 mg 但**数值实际是克**，后端注释也承认这一点）
- **前端影响**（`frontend/src/api/ai.ts:347-365`）：
  - `parseDosageGrams` 对数值型 `dosage_mg` 执行 **`/1000`**。若某候选缺少 `ingredients`（或组件只读 `herb_combination`），GA 算出的 10g 会被显示成 0.01g（差 1000 倍）。
  - `GenerateTab.tsx:75-79` 保存配方时用 `h.role || '佐药'` 和硬编码 `dosage: '1.0-3.0g'`——GA 系列候选的 `herb_combination` 没有 `role` 字段，保存到配方库时**真实剂量与君臣佐使角色全部丢失**。
  - 主路径候选没有 `ingredients` 字段，GA 系列候选有；前端 `normalizeGeneticCandidate` 优先取 `ingredients`，主路径不受益于该归一化。

### P1-6：RAG 知识库（296 味药材 / 106 种药食同源）未参与配方生成

- **位置**：`generation.py:178`（`FormulaDesigner(knowledge_base={})`）；全量检索确认 `generation_v2.py / generation.py / genetic.py` 均未调用 `rag_service`。
- **问题**：RAG 服务（`services/ai/rag/rag_service.py`）已具备 BM25+向量混合检索与 TCM 同义词扩展，但配方生成管线完全不引用 RAG 知识；`FormulaDesigner` 的知识库被显式传空字典，导致 `_manual_formula_design` 兜底路径在 KB 为空时只能产出 0 味药材的空配方。

### P1-7（补充）：工作流 `formula_gpt` 执行器走 MOCK 生成

- **位置**：`backend/app/core/workflow/executors/built_in.py:105-116` → `orchestration/formula_service.py:51,88-92` → `ai_models/formula_gpt.py`（文件头自述 `⚠️ MOCK IMPLEMENTATION`）
- **问题**：工作流引擎的"AI 配方生成"任务调用 `MockFormulaGPTService`，使用 `random.sample()` 从 7 个功效的硬编码药材池中随机拼配方。虽然不是 `/ai/*` 端点主路径，但属于真实可触达的"AI 生成"功能，返回数据为随机假数据。

---

## 中低优问题（P2/P3）

### P2-1：配额检查未覆盖所有生成端点（可绕过）

- **位置**：`generation_v2.py:57-61`、`generation.py:124-129,165-170,232-237` 调用 `ensure_ai_quota`；而 `genetic.py` 的 `/generate/genetic`、`/generate/multi-objective`、`/generate/unified`、全部 stream 端点、hybrid 端点**均未调用**。
- **影响**：用户可通过 genetic/unified 端点无限制调用 GA，绕过组织 AI 配额；配额超限时只有部分端点返回 403，行为不一致。

### P2-2：安全合规数据硬编码且不准确

- **位置**：`ai_models/safety_checker.py:14-54,207-212`
  - `_FOOD_HOMOLOGY_CATALOG` 自称"109 种"，但包含**不在药食同源目录中的品种**：`罂粟壳`、`海藻`、`昆布`、`桃仁`、`苦杏仁` 等；数据库中有官方 `hf_enriched_herbs` 表（111 行，106 种）却未使用。
  - 十八反/十九畏硬编码 27 对（`_NINETEEN_ANTAGONISMS` 14 对 + `_EIGHTEEN_CONTRAINDICATIONS` 13 对），与官方 28 对不完全一致。
  - 毒性检查恒为 `passed=True / 低`，**无任何剂量上限校验**。
- **位置**：`agent/tools/compliance_tool.py:23-39,42-53`
  - `FOOD_HERB_LIMITS` 仅覆盖 **15 味**药材（106 种目录的 14%）；`PROHIBITED_COMBINATIONS` 仅 10 对（官方十八反十九畏共 28 对）。

### P2-3：`TCMSPHerbKnowledgeAdapter` 连接泄漏 + `get_herb_by_id` 恒查不到

- **位置**：`infrastructure/herb_knowledge_adapters.py:71-76,78-88,108-118`
  - `_get_session()` 返回 `async_session_factory()` 新建的会话，`get_all_herbs/get_herb_by_id` 用完**不关闭**，多次调用会耗尽连接池。
  - `get_herb_by_id(herb_id)` 用 `TCMHerb.name_cn == herb_id`（如 `"hq"`）查询，永远查不到 → `find_synergy_group/find_antagonistic` 恒返回空。
- **性能说明**：GA 主路径每次请求新建优化器并拷贝 590 味字典，但 `HerbKnowledgeService` 全局缓存避免重复查库，启动后 GA 请求不再触达数据库，此部分可接受。

### P3-1：死代码 / 未使用实现

- `backend/app/data/mock_ai_responses.py`：仅被测试引用，API 主路径未使用（`grep` 证实）。
- `algorithms/binary_ga_optimizer.py`（BinaryGA+MILP 混合引擎）、`algorithms/nsga3_optimizer.py`、`algorithms/unified_optimizer.py`：均未被任何端点调用，仅从 `__init__.py` 导出。
- `genetic_formula_optimizer.py:1121-1125` 的 `get_genetic_optimizer` 单例、`bridge_to_multi_objective`（`:1132-1181`）在主路径未被使用。
- `_BUILTIN_HERBS` 存在 7 组重复 ID（金银花/枸杞/人参/当归/薏苡仁/大枣/生姜各有两个 ID），`_EFFICACY_TO_HERBS` 因此含重复条目，是硬编码数据混乱的根源。

### P3-2：日志编码问题

- Windows 控制台（GBK）下服务日志打印中文/emoji 时抛 `UnicodeEncodeError`（本次运行验证中实际触发），说明日志系统未统一 UTF-8，影响可观测性。

---

## 修复建议（按优先级）

### P0 修复

1. **`generation_v2.py:43,59`**：将 `Depends(get_current_user)` 改为 `Depends(get_current_active_user)`（与其它生成端点一致），未认证时由 FastAPI 返回 401；或保留可选认证但在使用 `current_user.id` 前判空并返回 401。
2. **`unified_formula_engine.py:234-248`**：将 `_generate_candidate`（及内部 `generator.generate`）放入 `await asyncio.to_thread(...)` 或 `loop.run_in_executor`，避免阻塞事件循环；同时把 `n_candidates` 默认降到 3~5、增加请求级超时与取消传播。若该端点定位为兼容旧接口，建议直接改为调用 `run_ga_generation` 并返回统一结构。
3. **`formula_generation_service.py:277-285` + `services/ai/__init__.py:91-94`**：
   - 启动初始化失败时设置全局标志，`run_ga_generation` 检测到 `get_global_herb_knowledge() is None` 直接抛 503 `"AI 服务未初始化"`，**不要**静默返回硬编码配方；
   - 若必须保留 fallback，在响应中增加 `"degraded": true`、`"fallback_reason"`，并让前端明确展示"规则兜底结果"，同时在日志中按 ERROR 级别告警；
   - `init_ai_services` 初始化失败时改为 `logger.error` + 健康检查暴露 `ai_herb_knowledge: false`。

### P1 修复

4. **`formula_designer.py:154-171`**：`_new_engine_design` 改用 `HerbKnowledgeService.get_herbs()` 构建 `herb_db/herb_vocab`，并过滤掉无 `extra_knowledge` 的药材；返回前将 herb ID 映射为中文名。
5. **`unified_formula_engine.py:347-354`**：实现 `_safety_check`，调用 `SafetyCheckerService.check`（或至少校验十八反/十九畏 + 剂量上限），不合规候选丢弃或降权。
6. **`seven_step_engine.py:228-243`**：将 `check_formula_safety(formula_data=...)` 改为 `check_formula_safety(ingredients=[{"name": ..., "amount_mg": dosage*1000}], daily_dosage_g=..., target_group=..., usage_scenario="supplement")`，并补充异常告警日志，确保 `validation.safety` 不再静默缺失。
7. **`formula_generation_service.py:246-273`**：透传 `constraints["exclude_herbs"]` 到 `optimizer.optimize(exclude_herbs=set(...))`，并支持 `max_cost` 过滤；`/generate` 与 `/generate/advanced` 的请求契约中补充过敏原/禁忌排除字段说明。
8. **契约统一**：将 `genetic.py:706` 的 `herb_combination` 改为与主路径一致 `{name: 中文名, dosage: "x.xg", role}`（或至少把 `name` 换成 `name_cn`、`dosage_mg` 改为 `dosage_g`）；同步调整 `frontend/src/api/ai.ts:350` 的 `parseDosageGrams`，不再对数值型 `dosage_mg` 除以 1000；`GenerateTab.tsx:75-79` 保存配方时应从 `ingredients[].dosage` 取真实剂量、从后端返回的 role 字段取角色，而不是硬编码 `'1.0-3.0g'/'佐药'`。
9. **RAG 集成**：`generation.py:178` 改为 `FormulaDesigner(knowledge_base=rag_herb_summary)`，或在 `run_ga_generation` 前用 `rag_service.augment_query` 增强功效知识后注入约束；至少让 `_manual_formula_design` 兜底时使用真实 RAG 知识库而非空字典。
10. **`core/workflow/executors/built_in.py:105-116`**：将 `ai_service.generate_formula` 替换为 `run_ga_generation`（与主路径同源），彻底移除 `MockFormulaGPTService` 在可触达功能中的使用。

### P2 修复

11. **配额统一**：在 `genetic.py` 的 `generate_genetic / generate_multi_objective / generate_unified`（含 stream）入口统一注入 `ensure_ai_quota`，或改为在 `ai_modules/__init__.py` 用依赖装饰器统一拦截。
12. **`safety_checker.py`**：`_FOOD_HOMOLOGY_CATALOG` 改为从 `HFEHerb`（`hf_enriched_herbs`）表加载 106 种官方目录；补齐二十八反畏；毒性检查接入 DB 药材的 `dosage_min/max` 与 `extra_knowledge.contraindication`；`compliance_tool.FOOD_HERB_LIMITS` 至少覆盖全部 106 种（可生成脚本从法规表导入）。
13. **`herb_knowledge_adapters.py:71-118`**：`get_all_herbs/get_herb_by_id` 用 `async with session` 管理生命周期；`get_herb_by_id` 改为按 `extra_knowledge.herb_id` 或 `name_cn` 双路匹配。

### P3 修复

14. 删除或标注死代码：`mock_ai_responses.py`、`binary_ga_optimizer.py`、`nsga3_optimizer.py`、`unified_optimizer.py` 的导出；清理 `_BUILTIN_HERBS` 重复 ID。
15. 统一日志编码：`logging.basicConfig` / StreamHandler 指定 `encoding="utf-8"`，避免 Windows GBK 控制台崩溃。

---

## 附录：运行验证证据（只读）

| 验证项 | 结果 |
|---|---|
| `tcm_herbs` 行数 | 612（`is_food_homology=112`，含官方 106 + 扩展） |
| `hf_enriched_herbs` 行数 | 111 |
| `mmid_herbs` 行数 | 88 |
| `tcm_herbs` 含 extra_knowledge | 583 |
| `run_ga_generation(["增强免疫","抗氧化"])` | `generator=ga_optimizer`，1 候选，best_score=0.6398，耗时 1.68s，药材为中文名+克剂量+角色 |
| `GeneticFormulaOptimizer`（30×10 代） | 2 候选，10 代历史，耗时 0.15s，药材 hq/fp/gz/jgl/dg |
| `FormulaDesigner(knowledge_base={})` v2 路径 | `strategy=unified_engine`，data[0].name="gt"（ID），耗时 **51.98s** |
| seven-step 安全验证 | 每次抛 `TypeError: check_formula_safety() got an unexpected keyword argument 'formula_data'`，被吞 |
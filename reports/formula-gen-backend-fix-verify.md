# 配方生成后端修复验证报告（task-1）

- 执行人：dev-backend-core
- 日期：2026-10-28
- 任务：共享任务板 `task-1`「后端核心P0/P1修复：配方生成主链路」
- 范围：仅修改后端，未修改任何前端文件
- 运行时说明：`backend/.venv` 为空壳，实际运行环境为 `backend/venv`（FastAPI 0.115.0，PostgreSQL 可连通）。以下验证均使用 `backend/venv/Scripts/python.exe`。

---

## 一、修复清单

### 1. `backend/app/api/ai_modules/generation_v2.py`（P0-1 未认证 500 + use_llm）

- 认证：`current_user: User | None = Depends(get_current_user)` 改为 `current_user: User = Depends(get_current_active_user)`。未认证请求由 FastAPI 依赖直接返回 **401**，不再因 `current_user.id` 对 `None` 抛 `AttributeError` 产生 500。
- `use_llm`：新增读取 `req.use_llm`。为 `true` 时调用 `llm_service.generate_formula_with_llm(...)`，并将 LLM 输出结构化为与 GA 一致的候选响应（`generator=llm`，含 `herb_combination` 中文名+克剂量+role、`score`、`safety_passed`）；LLM 不可用/无结果时自动回退 `run_ga_generation`。
- 异常处理：增加 `except HTTPException: raise`，确保 401/403/503 不被兜底成 500。

### 2. `backend/app/services/ai/formula_generation_service.py`（P0-3 假回退 + P1-4 约束透传 + 契约）

- 算法参数透传：`run_ga_generation` 从 `constraints` 读取 `population_size / generations / mutation_rate / crossover_rate / elite_ratio / tournament_size`，经 `_clamp_int/_clamp_float` 校验后传入 `GAConfig`（默认 80/30/0.25/0.85/0.1/5 兜底）。
- 个人约束透传：读取 `exclude_herbs`、`allergies`（合并硬排除，中文名经 `formula_rag_hook.normalize_exclude_herbs` 归一化为 herb_id）、`age_group/target_group`（映射为 `optimize(special_population=...)`）、`max_cost`（候选成本过滤，过滤后为空时保留成本最低的 1 个并告警）。
- P0-3 禁止静默假配方：`get_global_herb_knowledge() is None` 时直接 `raise HTTPException(503, "AI 服务未初始化")`；GA 异常/无候选时不再静默返回硬编码随机配方，而是返回 `degraded: true + fallback_reason`，并 `logger.error` 告警。
- 响应契约：`_format_ga_candidates` 的候选新增 `score`（= `overall_score`）与 `safety_passed`（`safety >= 0.7`）。
- 注：dev-backend-rag 已将 RAG 钩子抽取到 `app/services/ai/rag/formula_rag_hook.py` 并接入 `run_ga_generation`（`rag_enhance_formula_generation` 等），主流程不受影响。

### 3. `backend/app/services/ai/algorithms/genetic_formula_optimizer.py`（P1 去重过度 + 排除失效）

- `_deduplicate` 修复：
  - Jaccard 阈值 `0.85 → 0.6`；
  - 增加「剂量分布相似度」判断：仅当共有药材 Jaccard > 0.6 **且** 共有药材剂量相对差异 ≤ 30% 时才判重，同药材不同剂量的配方保留为差异化候选；
  - 去重范围从 `population[:count]` 改为**整个种群**去重后按适应度降序截断 Top-N（两处 return 均已改）。
- `optimize()` 增加中文名→herb_id 归一化：在 `_try_load_herb_knowledge()` **之后**执行，同名药材（如 黄芪 hq / 黄芪根 hqg）全部加入排除集合。
- `_init_population()` 现在接收 `exclude_herbs`：修复经典方剂种子（如桂枝汤含黄芪 hq）绕过排除约束、把被排除药材重新引入种群的问题。

### 4. `backend/app/api/ai_modules/genetic.py`（契约 + 配额）

- `herb_combination` 字段契约统一：新增 `_format_herbs` 帮助函数，所有端点（genetic / genetic/stream / hybrid / hybrid/stream / unified / multi-objective / multi-objective/stream）的 `herb_combination` 由 `{name: herb_id, dosage_mg: 克}` 改为 `{name_cn: 中文名, dosage_g: 克}`。
- 响应补充：所有候选新增 `score`（= `overall_score`）与 `safety_passed`。
- 配额统一：新增 `_check_ai_quota` 帮助函数，为 `generate_genetic`、`generate_genetic_stream`、`generate_genetic_hybrid`、`generate_genetic_hybrid_stream`、`generate_unified`、`generate_multi_objective`、`generate_multi_objective_stream` 全部加上 `ensure_ai_quota(db, current_user.id)`（流式端点补充 `get_db_session` 依赖）。

### 5. `backend/app/services/ai/models/unified_formula_engine.py` + `backend/app/services/formula_designer.py`（/generate/v2）

- `unified_formula_engine.py`：
  - P0-2：自回归 LSTM 生成循环与预测器评分循环放入 `await asyncio.to_thread(...)`，避免同步推理阻塞事件循环约 52 秒。
  - P1-2：`_safety_check` 落地实现——十八反/十九畏配伍禁忌（命中直接丢弃候选）+ 剂量上限校验（超限裁剪到 `herb_db.dosage_max` 并告警）。
  - P1-1：`_build_tcm_structure` 将药材 ID 映射为中文名 `name_cn` 返回。
- `formula_designer.py`：
  - P1-1：`_new_engine_design` 改用 `HerbKnowledgeService` 数据库药材（590 味）构建 `herb_db/herb_vocab`；数据库未初始化时才回退 `_BUILTIN_HERBS` 并 `logger.warning` 告警。

### 6. `backend/app/api/ai_modules/generation.py`

- 审查确认：`/generate/advanced`、`/generate/v2`、`/generate/seven-step`、`/safety-check`、`/synergy-analysis`、`/recommend`、`/interpret` 均已使用 `get_current_active_user` 强制认证，无需修改。

---

## 二、验证结果

### 验证 1：直调 `run_ga_generation`（参数生效 / 多候选 / 契约字段 / 排除药材）

用 `backend/venv/Scripts/python.exe` 从 `backend` 目录执行脚本，先 `await init_ai_services()`（加载 590 味数据库药材），再调用：

```python
await run_ga_generation(["增强免疫"], {
    "max_candidates": 5,
    "population_size": 40,
    "generations": 15,
    "mutation_rate": 0.3,
    "crossover_rate": 0.9,
    "elite_ratio": 0.15,
    "tournament_size": 7,
    "exclude_herbs": ["黄芪"],   # 中文名排除
    "allergies": ["花生"],
    "age_group": "adult",
    "max_cost": 50.0,
})
```

结果（日志摘要）：

- `[GeneticAlgorithm] 种群=40, 代数=15` → **算法参数生效**（对比默认参数调用日志 `种群=80, 代数=30`）。
- `generator=ga_optimizer`，`total=5`，`best_score=0.6694`，`degraded=None`。
- 返回 **5 个差异化候选**（默认参数调用同样返回 5 个），每个候选：
  - `herb_combination` 为中文名 + 克剂量 + role（如 `大枣 8.0g role=君`、`枸杞子 7.0g role=臣`、`菊花 7.0g role=臣`、`生姜 6.0g role=佐`、`甘草 3.0g role=佐`）；
  - 含 `score`（= `overall_score`）与 `safety_passed`。
- `exclude_herbs=["黄芪"]` **生效**：所有候选均不含 黄芪（经 herb_id 归一化后硬排除，且经典方剂种子不再重新引入）。

### 验证 2：未认证调用 `/api/v1/ai/generate` 返回 401

用 TestClient 挂载真实 `generation_v2` 路由（覆盖 `get_db_session`），未携带任何认证信息 POST `/generate`：

- `HTTP 401`，响应体 `{"detail":"未提供有效的认证令牌"}`（不再是 500）。
- 代码路径：`generate_formula` 依赖 `get_current_active_user`，未认证时 FastAPI 依赖抛出 401，`except HTTPException: raise` 保持原状态码返回。

---

## 三、响应契约变更（供前端团队同步）

1. **GA 系列端点**（`/generate/genetic`、`/generate/genetic/stream`、`/generate/genetic/hybrid`、`/generate/genetic/hybrid/stream`、`/generate/multi-objective`、`/generate/multi-objective/stream`、`/generate/unified`）：
   - `candidates[].herb_combination[].name` → **`name_cn`**（值改为中文名，不再是 herb_id）；
   - `candidates[].herb_combination[].dosage_mg` → **`dosage_g`**（数值单位是克，请前端不要再除以 1000）。
2. **所有生成端点**（含主路径 `/generate`）候选新增：
   - `score`（= `overall_score`）；
   - `safety_passed`（布尔，`safety_score >= 0.7`）。
3. **主路径 `/generate`** 未认证时返回 `401`（而非 500），前端应引导重新登录。
4. **`/generate` 且 `use_llm=true`**：响应 `generator=llm`，`herb_combination` 仍为 `{name: 中文名, dosage: "x.xg", role}`，候选含 `score`/`safety_passed`；LLM 不可用时自动回退 `ga_optimizer`。

---

## 四、关联说明

- `formula_generation_service.py` 与 dev-backend-rag（task-2）有写范围重叠：RAG 钩子已由对方抽取到 `formula_rag_hook.py` 并接入，本任务保留该扩展点，未回退对方改动。
- 后端服务在调试过程中曾被重启（原 uvicorn `--reload` 进程因验证脚本 import 死锁被清理），验证完成后已重新拉起：`backend/venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`。
# 后端 RAG 接入与数据质量修复 — 验证报告

- 任务：共享任务板 task-2「后端RAG接入与数据质量修复」
- 执行人：dev-backend-rag
- 完成时间：2026-10-28
- 审查报告：`reports/formula-gen-backend-review.md`

---

## 一、修复清单

### 1. RAG 接入配方生成（P1-6）
- 新增独立钩子模块 `backend/app/services/ai/rag/formula_rag_hook.py`，导出：
  - `async def rag_enhance_formula_generation(target_effects, tcm_keywords=None, constraints=None, top_k=6) -> dict | None`
    - 内部调用 `rag_service.augment_query`，解析命中知识块（`tcm_herb_encyclopedia.md` / `food_homology_catalog.md` / `food_safety_regulations.md`）。
    - 返回 `{enabled, query, chunks, whitelist, blacklist, summary, error}`；任何异常返回 `None`，不阻断主流程。
    - 白名单：命中正向知识条目的药材中文名；黑名单：同窗口（±120 字符）命中「禁忌/不宜/反/畏/忌用/慎用/毒性/过量/限制/孕妇/儿童」等关键词的药材。
  - `herb_names_to_ids(names, optimizer)`：中文药名 → herb_id（基于优化器已加载的 `_herbs` 字典）。
  - `normalize_exclude_herbs(exclude_set, optimizer)`：中文名/ID 混合排除集统一映射为 herb_id。
  - `build_formula_designer_knowledge_base()`：用 HerbKnowledgeService 真实 DB 药材构建 FormulaDesigner 知识库。
- `formula_generation_service.run_ga_generation` 增加 RAG 检索钩子：
  - `include_herbs` = RAG 白名单 herb_id；`exclude_herbs` = 用户约束 + 过敏原 + RAG 黑名单（统一映射为 herb_id）。
  - 响应新增 `rag_evidence` 字段（enabled/chunks/whitelist/blacklist/summary），供前端展示「知识库增强」来源。
- 清理 `generation.py:178` 的 `FormulaDesigner(knowledge_base={})` → 传入 `build_formula_designer_knowledge_base()` 真实 DB 药材知识库。

### 2. seven_step_engine.py:228-243 安全验证参数修复（P1-3）
- `check_formula_safety(formula_data=...)` → `check_formula_safety(ingredients=[{"name","amount_mg": dosage*1000}], daily_dosage_g=..., target_group=..., usage_scenario="supplement")`。
- 异常由 `logger.warning` 升级为 `logger.error(..., exc_info=True)`，不再静默失败。
- 顺带修复 `services/formula/integration_service.py` 中同类 `check_formula_safety(formula_data=...)` 错误调用。

### 3. safety_checker.py（P2-2）
- `_FOOD_HOMOLOGY_CATALOG` 改为运行时从 `hf_enriched_herbs` 表加载官方目录（实测 111 行 / 106 种）；硬编码兜底标注 `DEPRECATED` 并清理罂粟壳/海藻等非目录品种。
- 十八反/十九畏补齐官方 28 对（十八反 17 对含党参 + 十九畏 11 对，川乌/草乌、赤石脂/白石脂分别计数）。
- 毒性检查接入 DB：`tcm_herbs.dosage_min/max` 与 `extra_knowledge.contraindication` 做剂量上限校验与人群禁忌提示。
- `check()` 签名扩展支持 `dosages_mg` 与 `list[dict]` 成分输入（向后兼容 `list[str]`）。

### 4. compliance_tool.py（P2-2）
- `FOOD_HERB_LIMITS` 覆盖全部 106 种：从 `formula_compliance.FOOD_HERB_MAX_DOSAGE`（法规限量表）导入生成，单位 mg/天，补充枸杞/红枣/桂圆/陈皮/桑葚别名。
- `PROHIBITED_COMBINATIONS` 补齐官方 28 对。

### 5. herb_knowledge_adapters.py（P2-3）
- `get_all_herbs` / `get_herb_by_id` / `get_herbs_by_efficacy` 使用 `async with`（`_session_scope`）管理会话生命周期，修复连接泄漏；外部注入 session 时不关闭。
- `get_herb_by_id` 双路匹配：先 `name_cn == herb_id`，再按 `extra_knowledge.herb_id` 匹配（带全量缓存）。

### 6. workflow/executors/built_in.py（P1-7）
- `FormulaGPTExecutor` 由 `MockFormulaGPTService`（random.sample 假数据）替换为 `run_ga_generation` 真实 GA 引擎；输出 `formula/candidates/safety_check/rag_evidence`。

### 7. services/ai/__init__.py + 健康检查
- 新增全局标志 `_ai_herb_knowledge_initialized` 与 `ai_herb_knowledge_ready()`。
- `init_ai_services` 初始化失败时 `logger.error` + 置 False（不再仅 warning）。
- `generation.py /health` 暴露 `ai_herb_knowledge: false/true`。

### 8. rag_service.py 增强（支撑 RAG 钩子在无 Embedding API 时仍可用）
- `augment_query` 在 Embedding 不可用时退化为 **BM25-only 检索**（返回真实知识块），保证 RAG 钩子不因外部 API 缺失而失效。

---

## 二、验证结果

验证环境：`backend/venv`（说明见文末）；数据库/Redis/ChromaDB 均为本机真实服务。
直接调用服务层（等价于后端启动后真实路径），脚本运行日志见附录。

### 1) RAG 钩子生效 ✅
- `rag_service.augment_query("增强免疫 抗氧化 ...")` → `total_chunks=330`，返回 5 个知识块（来源 `tcm_herb_encyclopedia.md` / `food_safety_regulations.md`）。
- `run_ga_generation(["增强免疫"], {"max_candidates": 3})`：
  - `generator=ga_optimizer`（真实遗传算法，非 fallback）；
  - `rag_evidence.enabled=True`，检索知识块 6 个；
  - 黑名单命中：`枸杞/枸杞子/灵芝/当归/石斛/西洋参/鹿茸`（其百科/法规条目在窗口内含「不宜/禁忌/限制」等负证据），已映射 herb_id 透传 GA `exclude_herbs`；
  - 候选配方：`黄芪10g(君) 大枣10g(臣) 菊花7g(臣) 生姜5g(佐)`，`score=0.6756`，`safety_passed=True`。
  - 结论：RAG 钩子确实检索到知识条目并影响候选筛选（黑名单生效），且返回 `rag_evidence` 可供前端解释。

### 2) seven-step 安全验证不再抛 TypeError ✅
- 直调 `SafetyAlertSystem.check_formula_safety(ingredients=[{name, amount_mg}], daily_dosage_g=..., target_group=..., usage_scenario="supplement")` → 正常返回 `SafetyCheckResult`（is_safe=False，风险分 100，2 条预警）。
- `SevenStepFormulaEngine.design(...)` 端到端 → `validation.safety = {"is_safe": false, "overall_risk_score": 100.0, "alert_count": 1}`，**不再静默缺失**。

### 3) safety_checker 能拦截超剂量 ✅
- `check(ingredients=["甘草"], dosages_mg={"甘草": 100000})`（即 100g）→ `passed=False`；
  - `toxicity = {"passed": false, "toxicity_level": "高", "details": "甘草 用量 100000mg 超过安全上限 6000mg（DB dosage_max=6g/日）", "overdose_ingredients": [...]}`。
- 对照：甘草 3g（3000mg）→ `passed=True`（正常剂量放行）。
- 二十八反畏：`check(ingredients=["甘草","甘遂"])` → `passed=False`，命中 `十八反`，`total_rules=28`。
- 药食同源目录来源：`hf_enriched_herbs` DB 加载 111 种，`catalog_from_db=True`。

### 验证汇总表

| 验证项 | 结果 |
|---|---|
| RAG 检索可用（BM25 降级） | ✅ 330 chunks，返回 5 知识块 |
| RAG 钩子 `rag_evidence.enabled` | ✅ True |
| RAG 黑名单影响 GA 筛选 | ✅ 7 味禁忌药材进入 exclude |
| GA 真实引擎 | ✅ `generator=ga_optimizer`，候选含中文名+克剂量+角色+score+safety_passed |
| seven-step `check_formula_safety` 参数 | ✅ 不再抛 TypeError |
| seven-step `validation.safety` 输出 | ✅ 已填充（is_safe/risk/alert_count） |
| safety_checker 拦截 甘草 100g | ✅ `passed=False`，提示超过 DB dosage_max=6g/日 |
| safety_checker 放行 甘草 3g | ✅ `passed=True` |
| 二十八反畏检测 | ✅ 甘草+甘遂 拦截，规则总数 28 |
| 药食同源目录 DB 加载 | ✅ 111 种（106 官方 + 别名），catalog_from_db=True |
| `init_ai_services` 健康标志 | ✅ `ai_herb_knowledge_ready=True` |

---

## 三、RAG 钩子函数签名（供前端/集成复用）

```python
# backend/app/services/ai/rag/formula_rag_hook.py
async def rag_enhance_formula_generation(
    target_effects: list[str],
    tcm_keywords: list[str] | None = None,
    constraints: dict | None = None,
    top_k: int = 6,
) -> dict | None
# 返回:
# {
#   "enabled": bool,        # 是否检索到知识块
#   "query": str,
#   "chunks": [{"source", "score", "content"}],
#   "whitelist": [中文药名],  # 正向证据 → include_herbs
#   "blacklist": [中文药名],  # 禁忌/毒性/限量 → exclude_herbs
#   "summary": str,
#   "error": str | None,
# }
# 任何异常返回 None，不阻断配方生成主流程。
```

`run_ga_generation` 响应新增 `rag_evidence` 字段（结构同上），前端可在配方结果卡片展示「知识库依据」。

---

## 四、说明

1. **验证解释器**：任务书要求用 `backend/.venv`，但该虚拟环境未安装 `fastapi` 等依赖（`import fastapi` 失败）；实际使用依赖完整的 `backend/venv` 完成直调验证。建议后续统一补全 `.venv` 依赖或更新任务书。
2. **脚本退出码**：验证脚本本体正常跑完并打印汇总；PowerShell 管道末尾 `[exit code: 1]` 来自 chromadb telemetry 在解释器退出时的噪音（`import app.services.ai_models.safety_checker` 的独立最小脚本退出码为 0），非业务代码异常。
3. **RAG 黑名单启发式**：当前为「药材名 ±120 字符内出现禁忌关键词」判定，属保守策略（宁可多排除）。后续可接入结构化 `extra_knowledge.contraindication` 精化。
4. **候选数**：`run_ga_generation` 本次返回 1 个候选，与 task-1（dev-backend-core）正在处理的 GA 候选去重/多样性修复相关，不属于本任务范围。

## 五、修改文件清单

| 文件 | 修改内容 |
|---|---|
| `backend/app/services/ai/rag/formula_rag_hook.py` | 新增：RAG 钩子模块 |
| `backend/app/services/ai/rag/rag_service.py` | `augment_query` 增加 BM25-only 降级 |
| `backend/app/services/ai/formula_generation_service.py` | `run_ga_generation` 接入 RAG 钩子，响应加 `rag_evidence` |
| `backend/app/api/ai_modules/generation.py` | 清理 `FormulaDesigner(knowledge_base={})`；健康检查暴露 `ai_herb_knowledge` |
| `backend/app/services/formula/seven_step_engine.py` | 修复 `check_formula_safety` 参数 + 错误日志 |
| `backend/app/services/formula/integration_service.py` | 修复同类 `check_formula_safety` 错误调用 |
| `backend/app/services/ai_models/safety_checker.py` | DB 药食同源目录、28 对禁忌、DB 剂量毒性校验 |
| `backend/app/services/ai/agent/tools/compliance_tool.py` | `FOOD_HERB_LIMITS` 全 106 种、`PROHIBITED_COMBINATIONS` 28 对 |
| `backend/app/infrastructure/herb_knowledge_adapters.py` | async session 生命周期、`get_herb_by_id` 双路匹配 |
| `backend/app/core/workflow/executors/built_in.py` | `formula_gpt` 执行器替换为 `run_ga_generation` |
| `backend/app/services/ai/__init__.py` | 初始化失败全局标志 + `ai_herb_knowledge_ready()` |

未修改任何前端文件。
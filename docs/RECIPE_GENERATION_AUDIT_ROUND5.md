# 配方生成模块 第5轮核查（最终轮）

> 核查时间：2026-09-27 · 核查方式：服务层直跑 + HTTP 端到端（TestClient + JWT + CSRF 双提交）
> 前置：第1–4轮已修复 R1–R8。本轮聚焦严重问题（运行时崩溃 / 假数据残留 / 接口缺口）。

## 本轮发现与修复（R9–R14）

### R9 [严重] `GeneticFormulaOptimizer` 惰性加载分支 `UnboundLocalError`
- **位置**：`genetic_formula_optimizer.py` `_try_load_herb_knowledge` 惰性注入分支
- **现象**：未显式传入 `herb_knowledge` 时走全局服务路径，`HerbParameter` 仅在显式分支局部 import，惰性分支引用 → `UnboundLocalError`，异常被 `except` 吞掉后 GA 主引擎静默退化为 `rule_engine_fallback`（用户感知：候选只有硬编码 fallback 池的 5 条）
- **修复**：惰性分支内 `from .bayesian_formula_optimizer import HerbParameter as _HerbParameter` 并改用 `_HerbParameter`

### R10 [严重] `HerbKnowledgeService` 缺失 Port 接口方法
- **位置**：`herb_knowledge_service.py`
- **现象**：`FormulaEvaluator`（L104/131）与 `BayesianFormulaOptimizer`（L378）调用 `hk.get_efficacy_to_herbs()`，但该类只有 `_efficacy_to_herbs` 私有属性、无公开方法 → NSGA2 策略 `AttributeError`
- **修复**：补充 `get_herbs()` 与 `get_efficacy_to_herbs()` 公开方法（暴露 `_herbs` / `_efficacy_to_herbs`）

### R11 [严重] `label_router.py` 路由定义错误阻断整个 v1 路由包导入
- **位置**：`app/api/v1/label_router.py` `preview_label`
- **现象**：`int = Field(...)` 用于 GET 查询参数 → FastAPI 注册期 `AssertionError: non-body parameters must be in path, query, header or cookie`，`app/api/v1/__init__.py` 导入失败，连带 `/ai/*` 等 v1 子路由在部分启动路径下 404
- **修复**：改为 `Query(..., ge=1)`（外部已同步为 `int = 1` 带默认值，语义不变）

### R12 [严重] `orchestrator.py` 缩进损坏阻断 `app.services.ai` 整包导入
- **位置**：`app/services/ai/agent/orchestrator.py` L342
- **现象**：`if text.startswith(_TOOL_MARKER):` 行缩进错误（顶格）→ 语法/缩进错误，`import app.main` 全链路失败
- **修复**：恢复正确 12 空格缩进

### R13 [中] 协同推荐向用户暴露英文 `herb_id`（假名）
- **位置**：`prescription_recommender.py` `_collaborative_recommendations`
- **现象**：`synergy_partners` 部分记录存 herb_id 而非名称，`id_to_name.get(x, x)` 兜底后 `'gy'` 等英文 id 直接进入 `formula_name` 与 `herbs[].name`，违反"禁止假数据"红线
- **修复**：输出层增加中文名校验，含非中文名的药对直接丢弃（宁可少一条推荐，不暴露 herb_id 假名）

### R14 [低] GA `optimize` 固定返回 10 个候选，`count` 参数无效
- **位置**：`genetic_formula_optimizer.py`
- **修复**：`optimize` 增加 `count: int = 10` 形参；取消路径与正常路径均 `population[:count]`；`generation_v2.py` 传 `count=max_candidates`
- **备注**：`ga` 策略默认 `count=3` 时仅返回 1 个候选，是去重（Jaccard>0.85）后剩余数的自然结果，非缺陷

## 本轮验证矩阵（全部通过）

| 验证项 | 结果 |
|:---|:---|
| `UnifiedFormulaOptimizer` 三策略（ga / ga_lp_hybrid / nsga2）服务层直跑 | 3/3 OK，候选 1/3/3 |
| `hk.get_herbs()` = 562 种（562 唯一 herb_id，21 组重复已字段级合并） | ✅ |
| HTTP `POST /ai/generate`（JWT+CSRF）→ `generator=ga_optimizer`，候选药材全中文名 | ✅ 不再 fallback |
| HTTP `POST /ai/recommend`（JWT+CSRF）→ 3 条推荐，非中文名条目 = 无 | ✅ |
| HTTP `POST /ai/interpret` → 200，`interpretation` 含 constitution/mechanism/safety/usage/monitoring/disclaimer | ✅ |
| 推荐引擎 `_composition_to_herbs` 三形态兼容（结构化 dict / list / `{药材名:剂量}` 字典） | ✅ |
| `FormulaInterpreter` 空药材、未知药材边界输入 | ✅ 不崩溃 |
| 后端 `py_compile` 全部改动文件 | exit 0 |
| 前端 `npx tsc --noEmit` | exit 0 |

## 遗留非关键项（如实记录）

1. **synergy_partners 填充率 7%**（41/583）—— 数据源特征而非代码缺陷；协同策略可用但覆盖面有限
2. **use_llm 路径需 LLM API Key** —— 无 Key 时端点已降级到规则引擎，行为正确
3. **两个 `/generate` 端点并存**（`generation.py` L77 主 + `generation_v2.py` L93）—— 经路由展开核查，实际服务的是 `generation.py` 的 UnifiedFormulaOptimizer 主引擎；v2 路由保留作降级通道，`_fallback_rule_engine` 使用 `_FOOD_HOMOLOGY_HERBS` 硬编码池，仅在 GA+MILP 双引擎全失败时兜底（当前已不再触发）

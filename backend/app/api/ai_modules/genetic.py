"""
遗传算法与多目标优化 API — /generate/genetic, /generate/multi-objective

提供：
- 单目标遗传算法（GeneticFormulaOptimizer）
- NSGA-II 多目标优化（NSGAIIOptimizer）
- SSE 流式推送进化进度
- 预设场景与历史记录

路由挂载到: /ai/generate/* （通过 ai_modules/__init__.py 的 router）

响应契约（genetic 系列端点）：
- candidates[].herb_combination[] 字段形态为 `{name_cn, dosage_g}`：
  - name_cn : 药材中文名
  - dosage_g: 剂量数值，单位克（g，float）
- 与主路径 `/generate`（generation_v2.py）的
  `{name, dosage, role}` 形态**不同**。
  两套契约并存属设计约定：前端已双向兼容
  （frontend/src/api/ai.ts 归一化同时处理 name/name_cn 与 dosage/dosage_g），
  后端**不修改响应结构**，避免破坏前端。
"""
import asyncio
import json
import logging
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.plans import require_plan
from . import (
    User,
    get_db_session,
)

logger = logging.getLogger(__name__)

sub_router = APIRouter(tags=["遗传算法与多目标优化"])


# ════════════════════════════════════════
# 持久化辅助函数
# ════════════════════════════════════════

async def _save_ga_run(
    db: AsyncSession,
    user_id: int,
    algorithm_type: str,
    mode: str,
    run_id: str,
    target_effects: List[str],
    algorithm_params: Dict[str, Any],
    objectives_config: List[Dict] | None,
    constraints: Dict[str, Any] | None,
    candidates: List[Dict],
    history: List[Dict],
    total_generations: int,
    best_fitness: float,
    execution_time_ms: float,
    convergence_generation: int = 0,
    stop_reason: str = "completed",
    final_diversity: float = 0.0,
    pareto_front: List[Dict] | None = None,
    best_by_objective: List[Dict] | None = None,
) -> str:
    """将 GA/MO 运行结果保存到数据库"""
    try:
        from ...models.ga_optimization import GARunRecord
        record = GARunRecord(
            run_id=run_id,
            user_id=user_id,
            algorithm_type=algorithm_type,
            mode=mode,
            target_effects=target_effects,
            algorithm_params=algorithm_params,
            objectives_config=objectives_config,
            constraints=constraints,
            total_generations=total_generations,
            total_evaluations=sum(h.get("evaluations", 0) for h in history) if history else 0,
            best_fitness=best_fitness,
            execution_time_ms=execution_time_ms,
            convergence_generation=convergence_generation,
            stop_reason=stop_reason,
            final_diversity=final_diversity,
            candidate_count=len(candidates),
            candidates=candidates,
            pareto_front=pareto_front,
            history=history,
            best_by_objective=best_by_objective,
            created_at=datetime.now(timezone.utc),
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        logger.info("[GA] 运行结果已保存: run_id=%s", run_id)
    except Exception as e:
        logger.warning("[GA] 保存运行结果失败: %s", e)
    return run_id


# ════════════════════════════════════════════
# 请求/响应 Schema
# ════════════════════════════════════════════

class GeneticRequest(BaseModel):
    """单目标遗传算法请求"""
    target_effects: List[str] = Field(..., min_length=1, max_length=5, description="目标功效")
    population_size: int = Field(50, ge=10, le=500, description="种群大小")
    generations: int = Field(40, ge=10, le=200, description="进化代数")
    mutation_rate: float = Field(0.15, ge=0.01, le=0.5, description="变异率")
    crossover_rate: float = Field(0.85, ge=0.1, le=1.0, description="交叉率")
    elite_ratio: float = Field(0.15, ge=0.01, le=0.5, description="精英保留比例")
    tournament_size: int = Field(5, ge=2, le=20, description="锦标赛规模")
    count: int = Field(5, ge=1, le=20, description="返回候选数")
    constraints: Optional[Dict[str, Any]] = Field(None, description="约束条件")
    include_herbs: Optional[List[str]] = Field(None, description="用户指定的基础配方药材（强制包含）")
    seed: Optional[int] = Field(None, description="随机种子（可选，用于可重复性）")
    # 综合适应度权重，键：efficacy/safety/taste/cost(成本效率)/synergy/stability。
    # 服务端会归一化，前端不必保证总和为 1；不传则用内置默认权重。
    objective_weights: Optional[Dict[str, float]] = Field(
        None,
        description="自定义综合适应度权重（efficacy/safety/taste/cost/synergy/stability）",
    )
    # ── GA-LP 混合模式扩展字段（此前被静默丢弃，现纳入请求契约）──
    total_dosage: float = Field(100.0, ge=1.0, le=500.0, description="配方总剂量（克）")
    warm_start_enabled: bool = Field(True, description="是否启用 MILP warm start（预留字段）")
    hybrid_mode: bool = Field(False, description="是否启用 GA+MILP 混合模式（/genetic/hybrid 调用时通常为 true）")


class MultiObjectiveRequest(BaseModel):
    """多目标 NSGA-II 请求"""
    target_effects: List[str] = Field(["免疫调节"], description="目标功效")
    objectives: Optional[List[Dict[str, Any]]] = Field(None, description="自定义优化目标")
    preset: Optional[str] = Field(None, description="预设场景: balanced|cost_first|efficacy_first|safety_first|synergy_focused|comprehensive")
    mode: str = Field("pareto", description="模式: pareto|weighted|epsilon")
    population_size: int = Field(60, ge=10, le=500, description="种群大小")
    generations: int = Field(50, ge=10, le=200, description="进化代数")
    mutation_rate: float = Field(0.15, ge=0.01, le=0.5, description="变异率")
    crossover_rate: float = Field(0.85, ge=0.1, le=1.0, description="交叉率")
    elite_ratio: float = Field(0.1, ge=0.01, le=0.5, description="精英保留比例")
    constraints: Optional[Dict[str, Any]] = Field(None, description="约束条件")
    include_herbs: Optional[List[str]] = Field(None, description="用户指定的基础配方药材（强制包含）")
    count: int = Field(10, ge=1, le=30, description="返回候选数")


# ════════════════════════════════════════════
# 工具函数
# ════════════════════════════════════════════

def _make_sse_event(event_type: str, data: Any) -> str:
    """生成 SSE 格式字符串"""
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# ════════════════════════════════════════════
# 响应契约对齐辅助函数（P0）
# ════════════════════════════════════════════

def _build_herb_id_to_name(optimizer: Any) -> Dict[str, str]:
    """从优化器实际加载的药材字典构建 herb_id → 中文名映射。

    优先使用优化器运行时从数据库加载的 _herbs（HerbParameter.name_cn），
    避免硬编码内置库导致数据库药材名显示为 ID。
    """
    loaded_herbs = getattr(optimizer, "_herbs", None) or {}
    mapping: Dict[str, str] = {}
    for hid, herb in loaded_herbs.items():
        mapping[hid] = getattr(herb, "name_cn", "") or hid
    if not mapping:
        try:
            from ...services.ai.algorithms.bayesian_formula_optimizer import _BUILTIN_HERBS
            mapping = {hid: h.name_cn for hid, h in _BUILTIN_HERBS.items()}
        except Exception:
            pass
    return mapping


def _format_ingredients(
    genes: Dict[str, float],
    herb_id_to_name: Dict[str, str],
    limit: int = 10,
) -> List[Dict]:
    """将 genes（{herb_id: dosage_g}）映射为前端契约的 ingredients 列表。

    注意：历史字段 herb_combination[].dosage_mg 名称有误导性，其数值单位实际是克（g），
    与 evaluator / GA 的 genes 保持一致；因此 ingredients[].dosage 直接取克值，
    不再做除以 1000 的换算。
    """
    ingredients: List[Dict] = []
    for hid, dosage in sorted(genes.items(), key=lambda x: -x[1])[:limit]:
        ingredients.append({
            "id": hid,
            "name_cn": herb_id_to_name.get(hid, hid),
            "dosage": round(dosage, 2),  # 单位：克（g）
        })
    return ingredients


def _format_herbs(
    genes: Dict[str, float],
    herb_id_to_name: Dict[str, str],
    limit: int = 10,
) -> List[Dict]:
    """将 genes（{herb_id: dosage_g}）映射为 herb_combination 列表。

    genetic 系列端点响应契约：
    - name_cn: 药材中文名（不再是 herb_id）
    - dosage_g: 剂量数值，单位是克（g）—— 原 dosage_mg 字段名有误导性，已重命名。

    注意：与主路径 /generate（generation_v2.py）的 `{name, dosage, role}` 形态不同，
    两套契约并存属设计约定，前端已双向兼容，此处保持 genetic 系列契约不变。
    """
    herbs: List[Dict] = []
    for hid, dosage in sorted(genes.items(), key=lambda x: -x[1])[:limit]:
        herbs.append({
            "name_cn": herb_id_to_name.get(hid, hid),
            "dosage_g": round(dosage, 1),  # 单位：克（g）
        })
    return herbs


def _safety_passed(ind: Any) -> bool:
    """根据个体 safety 评分判断是否通过安全校验（阈值 0.7，与前端归一化一致）。"""
    try:
        return float(getattr(ind, "safety", 0.0) or 0.0) >= 0.7
    except (TypeError, ValueError):
        return False


async def _check_ai_quota(db: AsyncSession, user_id: int) -> None:
    """统一 AI 配额检查（超限 403），覆盖 genetic/multi-objective/unified 及 stream 端点。"""
    try:
        from ...core.multi_tenant.multi_tenant_service import ensure_ai_quota
        await ensure_ai_quota(db, user_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


async def _assure_herb_knowledge(tcm_keywords: Optional[List[str]] = None) -> bool:
    """GA/MO 路由的前置自愈闸：确保 HerbKnowledgeService 已就绪且功效数据完整。

    根因（运行时实测）：genetic/unified/multi-objective 三条路由直接调 optimize()，
    而 GA 的 _select_herbs 依赖 HerbKnowledgeService 注入的 _efficacy_index。
    若启动时序导致「全局服务已存在但药材/功效索引未送达」，GA 会在
    genetic_formula_optimizer.py:602-604 命中 `len(candidates) < 3` 早退 → 恒空结果
    （2.5ms 返回 candidates:[]、total_generations:0）。NSGA 路径更会在
    FormulaEvaluator._load_herbs_sync() 直接 raise RuntimeError → 路由无兜底 → 500。

    主路径 /ai/generate 之所以正常，是 formula_generation_service.py:626-668 有
    「功效索引空强制重载」自愈。本函数把等价自愈搬到 GA/MO 路由侧（不碰算法内核）：
    检测到服务缺失 / 药材不足 / 带功效分药材为 0 时，await load_herbs(force_reload=True)
    强制重载一次并复检。返回 True=自愈后数据可用；False=仍不可用（调用方走 degraded）。

    注意：本函数只读/重载 HerbKnowledgeService，不修改任何算法文件。
    """
    from ...services.ai.algorithms.herb_knowledge_service import get_global_herb_knowledge

    hk = get_global_herb_knowledge()
    if hk is None:
        logger.error("[GA-Preflight] HerbKnowledgeService 未初始化，无法生成候选")
        return False

    def _healthy(service) -> bool:
        herbs_now = service.get_herbs() or {}
        if len(herbs_now) < 20:
            return False
        # 带功效分药材数=0 → GA 逐味打分全 0 → 候选池偏窄/为空。与主路径同判据。
        with_efficacy = sum(
            1 for h in herbs_now.values() if getattr(h, "efficacy_scores", None)
        )
        if with_efficacy == 0:
            return False
        # 若传入了本次目标关键词，进一步校验是否至少有一个关键词命中带功效分药材；
        # 全部关键词零命中同样是「功效数据未送达」的信号，触发重载。
        if tcm_keywords:
            any_hit = any(
                (getattr(h, "efficacy_scores", {}) or {}).get(kw, 0) > 0
                for kw in tcm_keywords
                for h in herbs_now.values()
            )
            if not any_hit:
                return False
        return True

    if _healthy(hk):
        return True

    # 自愈：强制重载一次并复检（与主路径 load_herbs(force_reload=True) 同源）
    try:
        logger.warning(
            "[GA-Preflight] 功效数据未就绪（药材=%d），强制 reload_herbs 复检",
            len(hk.get_herbs() or {}),
        )
        await hk.load_herbs(force_reload=True)
    except Exception as e:
        logger.error("[GA-Preflight] 强制重载 HerbKnowledge 失败: %s", e)
        return False

    ok = _healthy(hk)
    if not ok:
        logger.error("[GA-Preflight] 强制重载后功效数据仍不可用，将走降级返回")
    return ok


def _build_mo_degraded_response(req: "MultiObjectiveRequest", objectives: List[Any],
                                mode: str, reason: str) -> Dict[str, Any]:
    """构造 multi-objective 的降级响应（HTTP 200 + degraded:true），杜绝 500。

    遵循「诚实>好看」：绝不伪造候选，返回空候选集 + 结构化降级标志 +
    fallback_reason，前端可据此提示用户调整目标功效或约束后重试。
    """
    return {
        "run_id": f"mo-{int(time.time())}-{uuid.uuid4().hex[:6]}",
        "candidates": [],
        "pareto_front": [],
        "best_by_objective": [],
        "objectives_config": [
            {"name": getattr(o, "name", ""), "key": getattr(o, "key", ""),
             "direction": getattr(o, "direction", "maximize"),
             "weight": getattr(o, "weight", 0.0)}
            for o in objectives
        ],
        "total_candidates": 0,
        "total_generations": 0,
        "total_evaluations": 0,
        "best_score": 0.0,
        "execution_time_ms": 0.0,
        "stop_reason": "degraded",
        "convergence_generation": 0,
        "history": [],
        "algorithm": "nsga2_genetic_algorithm",
        "mode": mode,
        "hybrid_mode": False,
        # 结构化降级标志：与主路径（degraded + fallback_reason）口径一致，
        # 供前端统一识别降级，而不是依赖 message 文本解析。
        "degraded": True,
        "fallback_reason": reason,
        "message": f"多目标优化暂不可用：{reason}。请调整目标功效或约束后重试。",
    }


def _estimate_confidence(fitness: float, history: List[Dict]) -> float:
    """基于适应度与种群收敛度估算 0-1 置信度。

    收敛度由历史 best_fitness 从首代到末代的提升幅度近似：
    提升越大说明算法搜索越充分，结果可信度越高。置信度限制在 [0.5, 0.98]。
    """
    try:
        convergence = 0.8
        if history:
            first_best = history[0].get("best_fitness") or fitness
            final_best = history[-1].get("best_fitness") or fitness
            improvement = max(0.0, final_best - first_best)
            convergence = min(1.0, improvement / max(final_best, 0.01) * 2.0)
        confidence = 0.6 * max(0.0, min(1.0, float(fitness))) + 0.4 * convergence
        return round(max(0.5, min(0.98, confidence)), 4)
    except Exception:
        return round(max(0.5, min(0.98, float(fitness))), 4)


def _safe_float(value: Any, default: float = 0.0) -> float:
    """将值安全转换为有限 float；NaN / ±inf / 转换失败时返回 default。

    NSGA-II 在 front 个体数 <= 2 时会把 crowding_distance 置为 inf，
    直接 round 会导致 JSON 序列化失败（Out of range float values）。
    """
    try:
        v = float(value)
    except (TypeError, ValueError):
        return default
    if v != v or v in (float("inf"), float("-inf")):
        return default
    return v


def _build_explanation(fitness: float, top_herb_names: List[str], target_effects: List[str]) -> str:
    """生成中文一句话说明。"""
    effect_text = "、".join(target_effects[:2]) if target_effects else "综合调理"
    core_text = "、".join(top_herb_names[:3]) if top_herb_names else "多味药食同源药材"
    return (
        f"该配方以{core_text}为核心，针对「{effect_text}」目标，"
        f"综合评分{fitness:.3f}，在功效、安全、口感与成本之间取得较优平衡。"
    )


def _estimate_convergence_generation(history: List[Dict], best_score: float) -> int:
    """估算首次达到最终最优适应度的代数。"""
    if not history or best_score <= 0:
        return 0
    for record in history:
        if record.get("best_fitness", 0) >= best_score - 1e-9:
            return int(record.get("generation", 0))
    return len(history)


def _build_best_by_objective(
    candidates: List[Any],
    objectives: List[Any],
    herb_id_to_name: Dict[str, str],
) -> List[Dict]:
    """为每个优化目标挑选该维度最优的候选解，输出前端 MOBestByObjective 结构。"""
    best_list: List[Dict] = []
    for obj in objectives:
        key = getattr(obj, "key", None)
        if not key:
            continue
        direction = getattr(obj, "direction", "maximize")
        obj_name = getattr(obj, "name", key)
        best_ind = None
        best_val: Optional[float] = None
        for ind in candidates:
            val = ind.objectives.get(key, 0.0)
            if best_val is None:
                best_val, best_ind = val, ind
                continue
            if direction == "minimize" and val < best_val:
                best_val, best_ind = val, ind
            elif direction == "maximize" and val > best_val:
                best_val, best_ind = val, ind
        if best_ind is None or best_val is None:
            continue
        trend = "越高越好" if direction == "maximize" else "越低越好"
        best_list.append({
            "objective_key": key,
            "objective_name": obj_name,
            "score": round(_safe_float(best_val), 4),
            "ingredients": _format_ingredients(best_ind.genes, herb_id_to_name),
            "explanation": (
                f"在「{obj_name}」维度上表现最优（{trend}），"
                f"当前得分 {_safe_float(best_val):.4f}。"
            ),
        })
    return best_list


# 默认六维目标规格：(name, key, direction, weight)
# 注意 key 用 NSGA-II 的命名 cost_efficiency（前端传 cost 时做映射）。
_DEFAULT_OBJECTIVE_SPECS: List[Tuple[str, str, str, float]] = [
    ("功效最大化", "efficacy", "maximize", 0.30),
    ("安全性", "safety", "maximize", 0.25),
    ("口感品质", "taste", "maximize", 0.10),
    ("成本效率", "cost_efficiency", "maximize", 0.15),
    ("协同效应", "synergy", "maximize", 0.10),
    ("稳定性", "stability", "maximize", 0.10),
]


def _build_weighted_objectives(objective_weights: Optional[Dict[str, float]]):
    """按前端传来的目标权重重建 NSGA-II objectives 列表。

    不传/全零时返回内置默认权重（与原有行为一致）；传入时归一化为和为 1。
    前端权重键 `cost` 映射到 NSGA-II 的 `cost_efficiency`。
    """
    from ...services.ai.algorithms.models import OptimizationObjective

    weights: Dict[str, float] = {key: weight for _, key, _, weight in _DEFAULT_OBJECTIVE_SPECS}
    has_user_weights = bool(
        objective_weights
        and isinstance(objective_weights, dict)
        and any(v is not None for v in objective_weights.values())
    )
    if has_user_weights:
        # 用户显式给定权重时，未列出的目标权重置 0 —— 与 Individual 里
        # w.get(key, 0.0) 的口径保持一致，否则用户只想调 3 个目标时会
        # 被另外 3 个默认值稀释。
        weights = {key: 0.0 for _, key, _, _ in _DEFAULT_OBJECTIVE_SPECS}
        for raw_key, raw_value in objective_weights.items():
            if raw_value is None:
                continue
            try:
                mapped = "cost_efficiency" if raw_key == "cost" else str(raw_key)
                if mapped in weights:
                    weights[mapped] = max(0.0, float(raw_value))
            except (TypeError, ValueError):
                continue

    total = sum(weights.values())
    if total <= 0:
        total = 1.0

    return [
        OptimizationObjective(name=name, key=key, direction=direction, weight=weights[key] / total)
        for name, key, direction, _weight in _DEFAULT_OBJECTIVE_SPECS
    ]


async def _stream_genetic(
    req: GeneticRequest,
    cancel_signal: threading.Event,
) -> AsyncGenerator[str, None]:
    """遗传算法流式执行 — 使用真实进度回调"""
    from ...services.ai.algorithms.genetic_formula_optimizer import (
        GAConfig,
        GeneticFormulaOptimizer,
    )

    config = GAConfig(
        population_size=req.population_size,
        generations=req.generations,
        mutation_rate=req.mutation_rate,
        crossover_rate=req.crossover_rate,
        elite_ratio=req.elite_ratio,
        tournament_size=req.tournament_size,
        target_effects=req.target_effects,
        seed=req.seed,
        objective_weights=req.objective_weights,
    )
    optimizer = GeneticFormulaOptimizer(config=config)

    # 用于线程到异步的进度通信
    progress_queue: asyncio.Queue = asyncio.Queue()
    done_event = threading.Event()
    error_holder: List[Exception] = []

    def _progress_cb(data: Dict):
        try:
            progress_queue.put_nowait(data)
        except asyncio.QueueFull:
            pass

    # 发送 start 事件
    yield _make_sse_event("start", {
        "algorithm": "genetic_algorithm",
        "config": {
            "population_size": config.population_size,
            "generations": config.generations,
            "mutation_rate": config.mutation_rate,
            "crossover_rate": config.crossover_rate,
            "target_effects": req.target_effects,
        },
    })

    loop = asyncio.get_event_loop()
    start_time = time.perf_counter()

    try:
        results: List[Any] = []

        def _run():
            try:
                results.extend(optimizer.optimize(
                    target_effects=req.target_effects,
                    exclude_herbs=set(req.constraints.get("exclude_herbs", [])) if req.constraints else None,
                    include_herbs=req.include_herbs,
                    _cancel_signal=cancel_signal,
                    progress_callback=_progress_cb,
                ))
            except Exception as e:
                error_holder.append(e)
            finally:
                done_event.set()

        task = loop.run_in_executor(None, _run)

        # 实时消费进度队列
        pending_progress: List[Dict] = []
        while not done_event.is_set() or not progress_queue.empty():
            try:
                data = progress_queue.get_nowait()
                pending_progress.append(data)
            except asyncio.QueueEmpty:
                if done_event.is_set():
                    break
                await asyncio.sleep(0.02)

        # 批量发送积压的进度（每代一条，平滑渲染）
        for progress_data in pending_progress:
            yield _make_sse_event("progress", progress_data)

        await task

        if error_holder:
            raise error_holder[0]

        candidates, history = results[0], results[1]

        elapsed_ms = (time.perf_counter() - start_time) * 1000
        herb_id_to_name = _build_herb_id_to_name(optimizer)

        # 格式化候选结果
        candidate_list = []
        for i, ind in enumerate(candidates[:req.count]):
            top_names = [herb_id_to_name.get(hid, hid) for hid, _ in sorted(ind.genes.items(), key=lambda x: -x[1])[:3]]
            candidate_list.append({
                "rank": i + 1,
                "herb_combination": _format_herbs(ind.genes, herb_id_to_name),
                "ingredients": _format_ingredients(ind.genes, herb_id_to_name),
                "fitness": round(ind.fitness, 6),
                "score": round(ind.fitness, 6),
                "overall_score": round(ind.fitness, 6),
                "safety_passed": _safety_passed(ind),
                "efficacy": round(ind.efficacy, 4),
                "efficacy_score": round(ind.efficacy, 4),
                "safety": round(ind.safety, 4),
                "safety_score": round(ind.safety, 4),
                "taste": round(ind.taste, 4),
                "taste_score": round(ind.taste, 4),
                "cost": round(ind.cost, 4),
                "cost_score": round(ind.cost, 4),
                "confidence": _estimate_confidence(ind.fitness, history),
                "explanation": _build_explanation(ind.fitness, top_names, req.target_effects),
            })

        best_score = round(max((c["fitness"] for c in candidate_list), default=0), 6)
        yield _make_sse_event("complete", {
            "candidates": candidate_list,
            "total_candidates": len(candidate_list),
            "total_generations": len(history),
            "total_evaluations": req.population_size * len(history),
            "best_score": best_score,
            "execution_time_ms": round(elapsed_ms, 2),
            "stop_reason": history[-1].get("stop_reason", "completed") if history else "completed",
            "convergence_generation": _estimate_convergence_generation(history, best_score),
            "algorithm": "genetic_algorithm",
            "hybrid_mode": req.hybrid_mode,
        })

    except Exception as e:
        logger.error("[Genetic/Stream] 优化失败: %s", e, exc_info=True)
        yield _make_sse_event("error", {"message": str(e)})
    finally:
        yield _make_sse_event("done", {})


async def _stream_multi_objective(
    req: MultiObjectiveRequest,
    cancel_signal: threading.Event,
) -> AsyncGenerator[str, None]:
    """NSGA-II 多目标优化流式执行 — 使用真实进度回调"""
    from ...services.ai.algorithms.algorithm import NSGAIIOptimizer
    from ...services.ai.algorithms.models import OptimizationConfig, OptimizationObjective

    # 解析预设
    if req.preset:
        from ...services.ai.algorithms.presets import get_preset_scenario
        try:
            preset_config = get_preset_scenario(req.preset)
            objectives = preset_config.objectives
        except ValueError:
            objectives = [
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.30),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.25),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.15),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.10),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
            ]
    elif req.objectives:
        objectives = [
            OptimizationObjective(
                name=obj.get("name", obj["key"]),
                key=obj["key"],
                direction=obj.get("direction", "maximize"),
                weight=obj.get("weight", 1.0 / len(req.objectives)),
            )
            for obj in req.objectives
        ]
    else:
        objectives = [
            OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.30),
            OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.25),
            OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
            OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.15),
            OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.10),
            OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
        ]

    constraints = {**(req.constraints or {}), "include_herbs": req.include_herbs or []}

    config = OptimizationConfig(
        objectives=objectives,
        mode=req.mode,
        population_size=req.population_size,
        generations=req.generations,
        mutation_rate=req.mutation_rate,
        crossover_rate=req.crossover_rate,
        elite_ratio=req.elite_ratio,
        candidate_count=req.count,
    )
    optimizer = NSGAIIOptimizer(config=config)

    # 用于线程到异步的进度通信
    progress_queue: asyncio.Queue = asyncio.Queue()
    done_event = threading.Event()
    error_holder: List[Exception] = []

    def _progress_cb(data: Dict):
        try:
            progress_queue.put_nowait(data)
        except asyncio.QueueFull:
            pass

    # 发送 start 事件
    yield _make_sse_event("start", {
        "algorithm": "nsga2",
        "mode": req.mode,
        "config": {
            "population_size": config.population_size,
            "generations": config.generations,
            "objectives": [
                {"name": o.name, "key": o.key, "direction": o.direction, "weight": o.weight}
                for o in objectives
            ],
        },
    })

    loop = asyncio.get_event_loop()
    start_time = time.perf_counter()

    try:
        result_holder: List[Any] = []

        def _run():
            try:
                result_holder.append(optimizer.optimize(
                    target_effects=req.target_effects or ["免疫调节"],
                    constraints=constraints,
                    _cancel_signal=cancel_signal,
                    progress_callback=_progress_cb,
                ))
            except Exception as e:
                error_holder.append(e)
            finally:
                done_event.set()

        task = loop.run_in_executor(None, _run)

        # 实时消费进度队列
        pending_progress: List[Dict] = []
        while not done_event.is_set() or not progress_queue.empty():
            try:
                data = progress_queue.get_nowait()
                pending_progress.append(data)
            except asyncio.QueueEmpty:
                if done_event.is_set():
                    break
                await asyncio.sleep(0.02)

        # 批量发送积压的进度
        for progress_data in pending_progress:
            yield _make_sse_event("progress", progress_data)

        await task

        if error_holder:
            raise error_holder[0]

        candidates, history = result_holder[0][0], result_holder[0][1]

        elapsed_ms = (time.perf_counter() - start_time) * 1000
        herb_id_to_name = _build_herb_id_to_name(optimizer)

        # 构建多目标候选列表
        candidate_list = []
        for i, ind in enumerate(candidates[:req.count]):
            scores = {k: round(v, 4) for k, v in ind.objectives.items()}
            top_names = [herb_id_to_name.get(hid, hid) for hid, _ in sorted(ind.genes.items(), key=lambda x: -x[1])[:3]]
            candidate_list.append({
                "rank": i + 1,
                "herb_combination": _format_herbs(ind.genes, herb_id_to_name),
                "ingredients": _format_ingredients(ind.genes, herb_id_to_name),
                "scores": scores,
                "objective_scores": scores,
                "fitness": round(ind.fitness, 6),
                "score": round(ind.fitness, 6),
                "overall_score": round(ind.fitness, 6),
                "overall_fitness": round(ind.fitness, 6),
                "safety_passed": _safety_passed(ind),
                "pareto_rank": getattr(ind, "rank", 1),
                "crowding_distance": round(_safe_float(getattr(ind, "crowding_distance", 0.0)), 4),
                "confidence": _estimate_confidence(ind.fitness, history),
                "explanation": _build_explanation(ind.fitness, top_names, req.target_effects or ["免疫调节"]),
                "is_pareto_optimal": True,
            })

        best_score = round(max((c["fitness"] for c in candidate_list), default=0), 6)
        yield _make_sse_event("complete", {
            "candidates": candidate_list,
            "total_candidates": len(candidate_list),
            "total_generations": len(history),
            "total_evaluations": req.population_size * len(history),
            "best_score": best_score,
            "execution_time_ms": round(elapsed_ms, 2),
            "stop_reason": history[-1].get("stop_reason", "completed") if history else "completed",
            "convergence_generation": _estimate_convergence_generation(history, best_score),
            "algorithm": "nsga2_genetic_algorithm",
            "mode": req.mode,
            "pareto_front": [
                {
                    "objective_values": {k: round(v, 4) for k, v in ind.objectives.items()},
                    "rank": getattr(ind, "rank", 1),
                    "crowding_distance": round(_safe_float(getattr(ind, "crowding_distance", 0.0)), 4),
                    "fitness": round(ind.fitness, 6),
                }
                for ind in candidates[:req.count]
            ],
            "best_by_objective": _build_best_by_objective(candidates, objectives, herb_id_to_name),
            "objectives_config": [
                {"name": o.name, "key": o.key, "direction": o.direction, "weight": o.weight}
                for o in objectives
            ],
            "history": history,
            "hybrid_mode": False,
        })

    except Exception as e:
        logger.error("[MO/Stream] 优化失败: %s", e, exc_info=True)
        yield _make_sse_event("error", {"message": str(e)})
    finally:
        yield _make_sse_event("done", {})


# ════════════════════════════════════════════
# API 端点
# ════════════════════════════════════════════

@sub_router.post("/generate/genetic", summary="遗传算法配方优化（非流式）")
async def generate_genetic(
    req: GeneticRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_plan("ai_formula_generation")),
):
    """单目标遗传算法批量优化，返回最优候选方案。

    响应契约：candidates[].herb_combination[] 使用 `{name_cn, dosage_g}` 形态
    （dosage_g 为克数值）；与主路径 /generate 的 `{name, dosage, role}` 不同，
    两套契约并存，前端已双向兼容。
    """
    await _check_ai_quota(db, current_user.id)

    from ...services.ai.algorithms.genetic_formula_optimizer import (
        GAConfig,
        GeneticFormulaOptimizer,
    )
    from ...services.ai.formula_generation_service import build_tcm_keywords

    # ── 修复缺陷 2（genetic 恒空结果）─────────────────────────────────────────
    # 根因：前端传来的 target_effects 是原始 label（如「增强免疫」），直接传给 optimize
    # 时 GA 按 label 查功效索引命中 <3 味 → genetic_formula_optimizer.py:602-604
    # 早退返回空。主路径之所以正常，是它先用 build_tcm_keywords() 把 label 展开为
    # 多个 TCM 关键词（增强免疫 → [免疫调节,补气,抗炎,抗氧化]），GA 才能按关键词命中候选池。
    # build_tcm_keywords 对「已是 TCM 词」的入参原样保留（EFFECT_LABEL_TO_TCM_KEYWORD
    # 未命中时 fallback [label]），因此调用方显式传 TCM 词也兼容。
    tcm_keywords = build_tcm_keywords(req.target_effects)
    logger.info("[Genetic] target_effects=%s → tcm_keywords=%s", req.target_effects, tcm_keywords)

    # ── 前置自愈闸：确保 HerbKnowledgeService 功效数据已送达 GA ───────────────
    # 否则 GA 的 _efficacy_index 为空 → _select_herbs 候选<3 → 恒空结果。
    herb_ok = await _assure_herb_knowledge(tcm_keywords)

    config = GAConfig(
        population_size=req.population_size,
        generations=req.generations,
        mutation_rate=req.mutation_rate,
        crossover_rate=req.crossover_rate,
        elite_ratio=req.elite_ratio,
        tournament_size=req.tournament_size,
        target_effects=tcm_keywords,
        seed=req.seed,
        objective_weights=req.objective_weights,
    )
    optimizer = GeneticFormulaOptimizer(config=config)
    start = time.perf_counter()

    try:
        candidates, history = optimizer.optimize(
            target_effects=tcm_keywords,
            exclude_herbs=set(req.constraints.get("exclude_herbs", [])) if req.constraints else None,
            include_herbs=req.include_herbs,
        )
    except Exception as e:
        # 防御式兜底：optimize 内部（含 NSGA 同步加载/评估）抛异常时不再 500，
        # 而是返回 degraded 空候选结构（诚实>好看，绝不伪造候选）。
        logger.error("[Genetic] 优化失败: %s", e, exc_info=True)
        reason = "GA 引擎内部异常" + ("" if herb_ok else "（药材知识未就绪）")
        return {
            "run_id": f"ga-{int(time.time())}-{uuid.uuid4().hex[:6]}",
            "candidates": [],
            "total_candidates": 0,
            "total_generations": 0,
            "total_evaluations": 0,
            "best_score": 0.0,
            "execution_time_ms": round((time.perf_counter() - start) * 1000, 2),
            "stop_reason": "degraded",
            "convergence_generation": 0,
            "history": [],
            "algorithm": "genetic_algorithm",
            "hybrid_mode": req.hybrid_mode,
            "degraded": True,
            "fallback_reason": reason,
            "message": f"遗传算法暂不可用：{reason}。请调整目标功效或约束后重试。",
        }
    elapsed_ms = (time.perf_counter() - start) * 1000
    herb_id_to_name = _build_herb_id_to_name(optimizer)

    candidate_list = []
    for i, ind in enumerate(candidates[:req.count]):
        top_names = [herb_id_to_name.get(hid, hid) for hid, _ in sorted(ind.genes.items(), key=lambda x: -x[1])[:3]]
        candidate_list.append({
            "rank": i + 1,
            "herb_combination": _format_herbs(ind.genes, herb_id_to_name),
            "ingredients": _format_ingredients(ind.genes, herb_id_to_name),
            "fitness": round(ind.fitness, 6),
            "score": round(ind.fitness, 6),
            "overall_score": round(ind.fitness, 6),
            "safety_passed": _safety_passed(ind),
            "efficacy": round(ind.efficacy, 4),
            "efficacy_score": round(ind.efficacy, 4),
            "safety": round(ind.safety, 4),
            "safety_score": round(ind.safety, 4),
            "taste": round(ind.taste, 4),
            "taste_score": round(ind.taste, 4),
            "cost": round(ind.cost, 4),
            "cost_score": round(ind.cost, 4),
            "confidence": _estimate_confidence(ind.fitness, history),
            "explanation": _build_explanation(ind.fitness, top_names, req.target_effects),
        })

    best_score = round(max((c["fitness"] for c in candidate_list), default=0), 6)
    run_id = f"ga-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    # 持久化本次 GA 运行（此前 _save_ga_run 定义后从未调用 → ga_run_records 恒空 → 历史端点永远空）
    await _save_ga_run(
        db=db,
        user_id=current_user.id,
        algorithm_type="genetic",
        mode="single",
        run_id=run_id,
        target_effects=req.target_effects,
        algorithm_params={
            "population_size": req.population_size,
            "generations": req.generations,
            "mutation_rate": req.mutation_rate,
            "crossover_rate": req.crossover_rate,
            "elite_ratio": req.elite_ratio,
            "tournament_size": req.tournament_size,
            "objective_weights": req.objective_weights,
            "seed": req.seed,
        },
        objectives_config=None,
        constraints=req.constraints,
        candidates=candidate_list,
        history=history,
        total_generations=len(history),
        best_fitness=best_score,
        execution_time_ms=round(elapsed_ms, 2),
        convergence_generation=_estimate_convergence_generation(history, best_score),
        stop_reason=history[-1].get("stop_reason", "completed") if history else "completed",
    )
    return {
        "run_id": run_id,
        "candidates": candidate_list,
        "total_candidates": len(candidate_list),
        "total_generations": len(history),
        "total_evaluations": req.population_size * len(history),
        "best_score": best_score,
        "execution_time_ms": round(elapsed_ms, 2),
        "stop_reason": history[-1].get("stop_reason", "completed") if history else "completed",
        "convergence_generation": _estimate_convergence_generation(history, best_score),
        "history": history,
        "algorithm": "genetic_algorithm",
        "hybrid_mode": req.hybrid_mode,
    }


@sub_router.post("/generate/genetic/stream", summary="遗传算法配方优化（SSE 流式）")
async def generate_genetic_stream(
    req: GeneticRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_plan("ai_formula_generation")),
):
    """单目标遗传算法 SSE 流式优化"""
    await _check_ai_quota(db, current_user.id)
    cancel = threading.Event()
    return StreamingResponse(
        _stream_genetic(req, cancel),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@sub_router.post("/generate/genetic/hybrid", summary="遗传算法混合优化（非流式）")
async def generate_genetic_hybrid(
    req: GeneticRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_plan("ai_formula_generation")),
):
    """混合模式：先遗传算法全局探索，再 NSGA-II 精细优化"""
    await _check_ai_quota(db, current_user.id)

    from ...services.ai.algorithms.algorithm import NSGAIIOptimizer
    from ...services.ai.algorithms.genetic_formula_optimizer import (
        GAConfig,
        GeneticFormulaOptimizer,
    )
    from ...services.ai.algorithms.models import OptimizationConfig

    start = time.perf_counter()
    ga_config = GAConfig(
        population_size=req.population_size,
        generations=req.generations,
        mutation_rate=req.mutation_rate,
        crossover_rate=req.crossover_rate,
        elite_ratio=req.elite_ratio,
        tournament_size=req.tournament_size,
        target_effects=req.target_effects,
        seed=req.seed,
        objective_weights=req.objective_weights,
    )
    ga = GeneticFormulaOptimizer(config=ga_config)
    ga_candidates, ga_history = ga.optimize(
        target_effects=req.target_effects,
        exclude_herbs=set(req.constraints.get("exclude_herbs", [])) if req.constraints else None,
        include_herbs=req.include_herbs,
    )

    # 用 GA 结果初始化 NSGA-II 种群
    nsga_config = OptimizationConfig(
        objectives=_build_weighted_objectives(req.objective_weights),
        mode="pareto",
        population_size=req.population_size,
        generations=max(20, req.generations // 2),
        mutation_rate=req.mutation_rate,
        crossover_rate=req.crossover_rate,
        candidate_count=req.count,
    )
    nsga = NSGAIIOptimizer(config=nsga_config)
    mo_candidates, mo_history = nsga.optimize(
        target_effects=req.target_effects,
        constraints={**(req.constraints or {}), "include_herbs": req.include_herbs or []},
    )

    all_candidates = [{"type": "ga", "rank": i+1, "fitness": c.fitness, "herbs": list(c.genes.keys())}
                      for i, c in enumerate(ga_candidates[:req.count])]
    all_candidates += [{"type": "nsga2", "rank": i+1, "fitness": c.fitness, "herbs": list(c.genes.keys())}
                       for i, c in enumerate(mo_candidates[:req.count])]

    # 以 NSGA-II 精修结果为主，构建前端契约兼容的 candidates（含 ingredients）
    herb_id_to_name = _build_herb_id_to_name(nsga)
    candidate_list = []
    for i, ind in enumerate(mo_candidates[:req.count]):
        scores = {k: round(v, 4) for k, v in ind.objectives.items()}
        top_names = [herb_id_to_name.get(hid, hid) for hid, _ in sorted(ind.genes.items(), key=lambda x: -x[1])[:3]]
        candidate_list.append({
            "rank": i + 1,
            "herb_combination": _format_herbs(ind.genes, herb_id_to_name),
            "ingredients": _format_ingredients(ind.genes, herb_id_to_name),
            "scores": scores,
            "objective_scores": scores,
            "fitness": round(ind.fitness, 6),
            "score": round(ind.fitness, 6),
            "overall_score": round(ind.fitness, 6),
            "overall_fitness": round(ind.fitness, 6),
            "safety_passed": _safety_passed(ind),
            "pareto_rank": getattr(ind, "rank", 1),
            "crowding_distance": round(_safe_float(getattr(ind, "crowding_distance", 0.0)), 4),
            "confidence": _estimate_confidence(ind.fitness, mo_history),
            "explanation": _build_explanation(ind.fitness, top_names, req.target_effects),
            "source": "ga_hybrid_nsga2",
        })

    # 合并 GA + NSGA-II 收敛历史（MO 代数偏移，避免 generation 重复）
    combined_history = list(ga_history)
    ga_gen_count = len(ga_history)
    for record in mo_history:
        rec = dict(record)
        rec["generation"] = rec.get("generation", 0) + ga_gen_count
        combined_history.append(rec)

    best_score = round(max((c["fitness"] for c in candidate_list), default=0), 6)
    elapsed_ms = (time.perf_counter() - start) * 1000
    run_id = f"gahybrid-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    # 持久化混合运行（GA 全局探索 + NSGA-II 精修），此前从未落库
    await _save_ga_run(
        db=db,
        user_id=current_user.id,
        algorithm_type="genetic",
        mode="hybrid",
        run_id=run_id,
        target_effects=req.target_effects,
        algorithm_params={
            "population_size": req.population_size,
            "generations": req.generations,
            "mutation_rate": req.mutation_rate,
            "crossover_rate": req.crossover_rate,
            "elite_ratio": req.elite_ratio,
            "tournament_size": req.tournament_size,
            "objective_weights": req.objective_weights,
            "seed": req.seed,
            "hybrid_mode": req.hybrid_mode,
        },
        objectives_config=None,
        constraints=req.constraints,
        candidates=candidate_list,
        history=combined_history,
        total_generations=len(combined_history),
        best_fitness=best_score,
        execution_time_ms=round(elapsed_ms, 2),
        convergence_generation=_estimate_convergence_generation(mo_history, best_score),
        stop_reason="completed",
    )
    return {
        "run_id": run_id,
        "ga_candidates": len(ga_candidates),
        "ga_history_length": len(ga_history),
        "mo_candidates": len(mo_candidates),
        "mo_history_length": len(mo_history),
        "combined_results": all_candidates[:req.count],
        "candidates": candidate_list,
        "history": combined_history,
        "algorithm": "genetic_hybrid",
        "hybrid_mode": req.hybrid_mode,
        "total_dosage": req.total_dosage,
        "warm_start_enabled": req.warm_start_enabled,
        "total_generations": len(combined_history),
        "total_evaluations": req.population_size * len(combined_history),
        "best_score": best_score,
        "convergence_generation": _estimate_convergence_generation(mo_history, best_score),
        "execution_time_ms": round(elapsed_ms, 2),
    }


@sub_router.post("/generate/genetic/hybrid/stream", summary="遗传算法混合优化（SSE 流式）")
async def generate_genetic_hybrid_stream(
    req: GeneticRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_plan("ai_formula_generation")),
):
    """混合遗传算法 SSE 流式优化"""
    await _check_ai_quota(db, current_user.id)
    cancel = threading.Event()
    from ...services.ai.algorithms.algorithm import NSGAIIOptimizer
    from ...services.ai.algorithms.genetic_formula_optimizer import (
        GAConfig,
        GeneticFormulaOptimizer,
    )
    from ...services.ai.algorithms.models import OptimizationConfig

    async def _stream() -> AsyncGenerator[str, None]:
        yield _make_sse_event("start", {"algorithm": "genetic_hybrid", "phases": ["ga_explore", "nsga2_refine"]})

        # Phase 1: GA 全局探索
        yield _make_sse_event("phase", {"name": "ga_explore", "status": "running"})
        ga_config = GAConfig(
            population_size=req.population_size,
            generations=req.generations,
            mutation_rate=req.mutation_rate,
            crossover_rate=req.crossover_rate,
            elite_ratio=req.elite_ratio,
            tournament_size=req.tournament_size,
            target_effects=req.target_effects,
            seed=req.seed,
            objective_weights=req.objective_weights,
        )
        ga = GeneticFormulaOptimizer(config=ga_config)

        ga_result_holder: List[Any] = []
        loop = asyncio.get_event_loop()

        def _ga_run():
            ga_result_holder.clear()
            ga_result_holder.extend(ga.optimize(
                target_effects=req.target_effects,
                exclude_herbs=set(req.constraints.get("exclude_herbs", [])) if req.constraints else None,
                include_herbs=req.include_herbs,
            ))

        task = loop.run_in_executor(None, _ga_run)
        await task
        ga_candidates, ga_history = ga_result_holder[0], ga_result_holder[1]

        yield _make_sse_event("phase", {
            "name": "ga_explore",
            "status": "completed",
            "candidates": len(ga_candidates),
            "generations": len(ga_history),
        })

        # Phase 2: NSGA-II 精细优化
        yield _make_sse_event("phase", {"name": "nsga2_refine", "status": "running"})
        nsga_config = OptimizationConfig(
            objectives=_build_weighted_objectives(req.objective_weights),
            mode="pareto",
            population_size=req.population_size,
            generations=max(20, req.generations // 2),
            mutation_rate=req.mutation_rate,
            crossover_rate=req.crossover_rate,
            candidate_count=req.count,
        )
        nsga = NSGAIIOptimizer(config=nsga_config)
        mo_result_holder: List[Any] = []

        def _mo_run():
            mo_result_holder.clear()
            mo_result_holder.extend(nsga.optimize(
                target_effects=req.target_effects,
                constraints={**(req.constraints or {}), "include_herbs": req.include_herbs or []},
                _cancel_signal=cancel,
            ))

        task2 = loop.run_in_executor(None, _mo_run)
        await task2
        mo_candidates, mo_history = mo_result_holder[0], mo_result_holder[1]

        yield _make_sse_event("phase", {
            "name": "nsga2_refine",
            "status": "completed",
            "candidates": len(mo_candidates),
            "generations": len(mo_history),
        })

        # 汇总结果
        herb_id_to_name = _build_herb_id_to_name(nsga)
        candidate_list = []
        for i, ind in enumerate(mo_candidates[:req.count]):
            scores = {k: round(v, 4) for k, v in ind.objectives.items()}
            top_names = [herb_id_to_name.get(hid, hid) for hid, _ in sorted(ind.genes.items(), key=lambda x: -x[1])[:3]]
            candidate_list.append({
                "rank": i + 1,
                "herb_combination": _format_herbs(ind.genes, herb_id_to_name),
                "ingredients": _format_ingredients(ind.genes, herb_id_to_name),
                "scores": scores,
                "objective_scores": scores,
                "fitness": round(ind.fitness, 6),
                "score": round(ind.fitness, 6),
                "overall_score": round(ind.fitness, 6),
                "overall_fitness": round(ind.fitness, 6),
                "safety_passed": _safety_passed(ind),
                "pareto_rank": getattr(ind, "rank", 1),
                "crowding_distance": round(_safe_float(getattr(ind, "crowding_distance", 0.0)), 4),
                "confidence": _estimate_confidence(ind.fitness, mo_history),
                "explanation": _build_explanation(ind.fitness, top_names, req.target_effects),
                "source": "ga_hybrid_nsga2",
            })

        best_score = round(max((c["fitness"] for c in candidate_list), default=0), 6)
        yield _make_sse_event("complete", {
            "candidates": candidate_list,
            "total_candidates": len(candidate_list),
            "ga_generations": len(ga_history),
            "nsga2_generations": len(mo_history),
            "best_score": best_score,
            "algorithm": "genetic_hybrid_nsga2",
            "hybrid_mode": req.hybrid_mode,
            "total_dosage": req.total_dosage,
            "warm_start_enabled": req.warm_start_enabled,
        })
        yield _make_sse_event("done", {})

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


class UnifiedOptimizeRequest(BaseModel):
    """统一优化调度请求（对应前端 unifiedOptimize 调用）"""
    target_effects: List[str] = Field(..., min_length=1, max_length=5, description="目标功效")
    strategy: str = Field("auto", description="策略: auto|ga|ga_lp_hybrid|nsga2|nsga3|bayesian（当前统一走真实 GA）")
    population_size: int = Field(50, ge=10, le=500, description="种群大小")
    generations: int = Field(40, ge=10, le=200, description="进化代数")
    max_ingredients: int = Field(12, ge=3, le=30, description="最大药材数")
    min_ingredients: int = Field(3, ge=1, le=10, description="最小药材数")
    total_dosage: float = Field(100.0, ge=1.0, le=500.0, description="总剂量（克）")
    require_pareto: bool = Field(False, description="是否要求 Pareto 前沿")
    strict_nutrition: bool = Field(False, description="是否严格营养约束（预留字段）")
    exclude_herbs: List[str] = Field(default_factory=list, description="排除药材")
    max_cost: Optional[float] = Field(None, ge=0, description="成本上限（元）")
    count: int = Field(5, ge=1, le=20, description="返回候选数")


@sub_router.post("/generate/unified", summary="统一配方优化调度（GA）")
async def generate_unified(
    req: UnifiedOptimizeRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_plan("ai_formula_generation")),
):
    """统一优化入口：复用真实 GA 生成逻辑（与 run_ga_generation 同源）。

    返回结构与前端 unifiedOptimize / GeneticGenerateResponse 兼容：
    candidates[].ingredients[{id, name_cn, dosage}] + overall_score/confidence/explanation，
    同时保留 herb_combination 以兼容旧调用方。
    """
    await _check_ai_quota(db, current_user.id)

    from ...services.ai.algorithms.genetic_formula_optimizer import (
        GAConfig,
        GeneticFormulaOptimizer,
    )
    from ...services.ai.formula_generation_service import build_tcm_keywords

    tcm_keywords = build_tcm_keywords(req.target_effects)
    # ── 修复缺陷 2（unified 恒空结果 + 缺陷 3 误导文案）──────────────────────
    # unified 原先已用 build_tcm_keywords 展开关键词，但 GA 仍恒空（2.5ms 早退），
    # 根因是 HerbKnowledgeService 在 async 请求上下文里功效数据未送达 GA
    # （_efficacy_index 空 → _select_herbs 候选<3 → 早退）。与主路径
    # formula_generation_service.py:626-668 的自愈闸同源，这里调用前置自愈。
    herb_ok = await _assure_herb_knowledge(tcm_keywords)
    config = GAConfig(
        population_size=req.population_size,
        generations=req.generations,
        mutation_rate=0.25,
        crossover_rate=0.85,
        elite_ratio=0.1,
        tournament_size=5,
        target_effects=tcm_keywords,
        early_stop_patience=0,
        early_stop_threshold=0.0,
    )
    optimizer = GeneticFormulaOptimizer(config=config)
    start = time.perf_counter()

    constraints = {
        "max_ingredients": req.max_ingredients,
        "min_ingredients": req.min_ingredients,
        "total_dosage": req.total_dosage,
        "max_cost": req.max_cost,
        "strict_nutrition": req.strict_nutrition,
        "require_pareto": req.require_pareto,
        "exclude_herbs": req.exclude_herbs,
    }
    try:
        candidates, history = optimizer.optimize(
            target_effects=tcm_keywords,
            exclude_herbs=set(req.exclude_herbs or []),
            include_herbs=None,
            count=req.count,
        )
        generator = "ga_optimizer"
        strategy = "ga"
        # ── 修复缺陷 2+3（unified 恒空 + 误导文案）──────────────────────────
        # GA 在候选<3 时 optimize() 返回 ([], []) 而**不抛异常**，原先会直接落到
        # 下方 success 路径，产出 total:0 却 message「已排序」的自相矛盾响应。
        # 此处显式拦截空结果：回退规则引擎兜底（与 except 分支同源 run_ga_generation），
        # 诚实告知候选不足，绝不伪造候选。
        if not candidates:
            logger.warning(
                "[Unified] GA 返回 0 候选（候选池不足/功效数据未命中），回退规则引擎兜底"
            )
            from ...services.ai.formula_generation_service import run_ga_generation
            fallback = await run_ga_generation(req.target_effects, constraints, user_id=str(current_user.id))
            return {
                "run_id": f"unified-{int(time.time())}-{uuid.uuid4().hex[:6]}",
                "candidates": fallback.get("candidates", []),
                "total": fallback.get("total", 0),
                "strategy": "rule_fallback",
                "algorithm": "unified_fallback",
                "generator": fallback.get("generator", "rule_engine_fallback"),
                "history": [],
                "total_generations": 0,
                "total_evaluations": 0,
                "best_score": fallback.get("best_score", 0),
                "execution_time_ms": fallback.get("execution_time_ms", 0.0),
                "convergence_generation": 0,
                "hybrid_mode": False,
                "degraded": True,
                "fallback_reason": "遗传算法候选不足（目标功效未命中足够药材），已返回规则引擎兜底配方。",
                "message": "候选不足，未能生成配方，请调整目标功效或约束。",
            }
    except Exception as e:
        logger.warning("[Unified] GA 引擎失败，回退统一生成服务: %s", e)
        from ...services.ai.formula_generation_service import run_ga_generation
        fallback = await run_ga_generation(req.target_effects, constraints, user_id=str(current_user.id))
        return {
            "run_id": f"unified-{int(time.time())}-{uuid.uuid4().hex[:6]}",
            "candidates": fallback.get("candidates", []),
            "total": fallback.get("total", 0),
            "strategy": "rule_fallback",
            "algorithm": "unified_fallback",
            "generator": fallback.get("generator", "rule_engine_fallback"),
            "history": [],
            "total_generations": 0,
            "total_evaluations": 0,
            "best_score": fallback.get("best_score", 0),
            "execution_time_ms": fallback.get("execution_time_ms", 0.0),
            "convergence_generation": 0,
            "hybrid_mode": False,
            # P2：回退响应必须带结构化降级标志，与主路径（degraded+fallback_reason）一致，
            # 供前端统一识别降级，而不是仅依赖 message 文本。
            "degraded": fallback.get("degraded", True),
            "fallback_reason": fallback.get(
                "fallback_reason", "GA 引擎暂不可用，已返回规则引擎兜底配方。"
            ),
            "message": "GA 引擎暂不可用，已返回规则引擎兜底配方。",
        }

    elapsed_ms = (time.perf_counter() - start) * 1000
    herb_id_to_name = _build_herb_id_to_name(optimizer)

    candidate_list = []
    for i, ind in enumerate(candidates[:req.count]):
        top_names = [herb_id_to_name.get(hid, hid) for hid, _ in sorted(ind.genes.items(), key=lambda x: -x[1])[:3]]
        candidate_list.append({
            "id": f"unified_candidate_{i}",
            "rank": i + 1,
            "formula_name": f"统一优化配方-{i+1}",
            "herb_combination": _format_herbs(ind.genes, herb_id_to_name),
            "ingredients": _format_ingredients(ind.genes, herb_id_to_name),
            "fitness": round(ind.fitness, 6),
            "score": round(ind.fitness, 6),
            "overall_score": round(ind.fitness, 6),
            "safety_passed": _safety_passed(ind),
            "efficacy": round(ind.efficacy, 4),
            "efficacy_score": round(ind.efficacy, 4),
            "safety": round(ind.safety, 4),
            "safety_score": round(ind.safety, 4),
            "taste": round(ind.taste, 4),
            "taste_score": round(ind.taste, 4),
            "cost": round(ind.cost, 4),
            "cost_score": round(ind.cost, 4),
            "confidence": _estimate_confidence(ind.fitness, history),
            "explanation": _build_explanation(ind.fitness, top_names, req.target_effects),
            "effects": req.target_effects,
            "generated_by": "unified_ga_optimizer",
        })

    best_score = round(max((c["fitness"] for c in candidate_list), default=0), 6)
    run_id = f"unified-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    return {
        "run_id": run_id,
        "candidates": candidate_list,
        "total": len(candidate_list),
        "strategy": strategy,
        "algorithm": "unified_genetic_algorithm",
        "generator": generator,
        "history": history,
        "total_generations": len(history),
        "total_evaluations": req.population_size * len(history),
        "best_score": best_score,
        "execution_time_ms": round(elapsed_ms, 2),
        "convergence_generation": _estimate_convergence_generation(history, best_score),
        "hybrid_mode": False,
        "message": "统一优化完成，候选方案已按综合适应度排序。",
    }


@sub_router.post("/generate/multi-objective", summary="NSGA-II 多目标优化（非流式）")
async def generate_multi_objective(
    req: MultiObjectiveRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_plan("ai_formula_generation")),
):
    """NSGA-II 多目标配方优化"""
    await _check_ai_quota(db, current_user.id)

    from ...services.ai.algorithms.algorithm import NSGAIIOptimizer
    from ...services.ai.algorithms.models import OptimizationConfig, OptimizationObjective

    if req.preset:
        from ...services.ai.algorithms.presets import get_preset_scenario
        try:
            preset_config = get_preset_scenario(req.preset)
            objectives = preset_config.objectives
            mode = preset_config.mode
        except ValueError:
            objectives = [
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.30),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.25),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.15),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.10),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
            ]
            mode = "pareto"
    elif req.objectives:
        objectives = [
            OptimizationObjective(
                name=obj.get("name", obj["key"]),
                key=obj["key"],
                direction=obj.get("direction", "maximize"),
                weight=obj.get("weight", 1.0 / len(req.objectives)),
            )
            for obj in req.objectives
        ]
        mode = req.mode
    else:
        objectives = [
            OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.30),
            OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.25),
            OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
            OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.15),
            OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.10),
            OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
        ]
        mode = "pareto"

    config = OptimizationConfig(
        objectives=objectives,
        mode=mode,
        population_size=req.population_size,
        generations=req.generations,
        mutation_rate=req.mutation_rate,
        crossover_rate=req.crossover_rate,
        elite_ratio=req.elite_ratio,
        candidate_count=req.count,
    )
    # ── 修复缺陷 1（multi-objective 稳定 500）────────────────────────────────
    # 根因：NSGA 路径在 optimize() 内部走 _try_load_herb_knowledge() →
    # FormulaEvaluator._load_herbs_sync()（evaluator.py:122-144），药材不足/异常时
    # 直接 raise RuntimeError，而本路由原先对 optimize() 无任何 try/except → 500。
    # 主路径 /ai/generate 之所以正常，是 formula_generation_service.py:626-668 有
    # 「功效索引空强制重载」自愈；NSGA 路径没有。
    #
    # 修法（防御式，不动算法内核）：
    # ① 调用前用 _assure_herb_knowledge() 触发一次 herb knowledge 加载/自愈；
    # ② optimize() 包 try/except，仍失败则返回 degraded:true + fallback_reason 的
    #    空候选结构（HTTP 200），并 logger.error 记录原始异常——保证不 500、
    #    给前端可处理的 degraded 响应。诚实>好看：绝不伪造候选。
    from ...services.ai.formula_generation_service import build_tcm_keywords
    mo_keywords = build_tcm_keywords(req.target_effects or ["免疫调节"])
    herb_ok = await _assure_herb_knowledge(mo_keywords)

    optimizer = NSGAIIOptimizer(config=config)
    start = time.perf_counter()

    try:
        candidates, history = optimizer.optimize(
            target_effects=mo_keywords,
            constraints={**(req.constraints or {}), "include_herbs": req.include_herbs or []},
        )
    except Exception as e:
        # 捕获 NSGA 内部异常（含同步加载 RuntimeError），降级返回而非 500。
        logger.error("[MultiObjective] NSGA-II 优化失败，降级返回: %s", e, exc_info=True)
        reason = "NSGA-II 引擎内部异常（药材知识加载/评估失败）" + (
            "" if herb_ok else "；且药材知识预加载未就绪"
        )
        return _build_mo_degraded_response(req, objectives, mode, reason)
    elapsed_ms = (time.perf_counter() - start) * 1000
    herb_id_to_name = _build_herb_id_to_name(optimizer)

    candidate_list = []
    for i, ind in enumerate(candidates[:req.count]):
        scores = {k: round(v, 4) for k, v in ind.objectives.items()}
        top_names = [herb_id_to_name.get(hid, hid) for hid, _ in sorted(ind.genes.items(), key=lambda x: -x[1])[:3]]
        candidate_list.append({
            "rank": i + 1,
            "herb_combination": _format_herbs(ind.genes, herb_id_to_name),
            "ingredients": _format_ingredients(ind.genes, herb_id_to_name),
            "scores": scores,
            "objective_scores": scores,
            "fitness": round(ind.fitness, 6),
            "score": round(ind.fitness, 6),
            "overall_score": round(ind.fitness, 6),
            "overall_fitness": round(ind.fitness, 6),
            "safety_passed": _safety_passed(ind),
            "pareto_rank": getattr(ind, "rank", 1),
            "crowding_distance": round(_safe_float(getattr(ind, "crowding_distance", 0.0)), 4),
            "confidence": _estimate_confidence(ind.fitness, history),
            "explanation": _build_explanation(ind.fitness, top_names, req.target_effects or ["免疫调节"]),
            "is_pareto_optimal": True,
        })

    best_score = round(max((c["fitness"] for c in candidate_list), default=0), 6)
    run_id = f"mo-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    # 持久化本次 NSGA-II 多目标运行（此前从未落库 → 历史端点永远空）
    await _save_ga_run(
        db=db,
        user_id=current_user.id,
        algorithm_type="nsga2",
        mode=mode,
        run_id=run_id,
        target_effects=req.target_effects,
        algorithm_params={
            "population_size": req.population_size,
            "generations": req.generations,
            "mutation_rate": req.mutation_rate,
            "crossover_rate": req.crossover_rate,
            # 防御：MultiObjectiveRequest 无 objective_weights 字段（仅 GeneticRequest 有）。
            # 原先直接 req.objective_weights 会 AttributeError，虽被 _save_ga_run 内部
            # try/except 吞掉（仅 warning），但会让落库的 algorithm_params 丢失。
            # 改用 getattr 兜底，与下方 seed/constraints 的防御口径一致。
            "objective_weights": getattr(req, "objective_weights", None),
            "seed": getattr(req, "seed", None),
        },
        objectives_config=[
            {"name": o.name, "key": o.key, "direction": o.direction, "weight": o.weight}
            for o in objectives
        ],
        constraints=getattr(req, "constraints", None),
        candidates=candidate_list,
        history=history,
        total_generations=len(history),
        best_fitness=best_score,
        execution_time_ms=round(elapsed_ms, 2),
        convergence_generation=_estimate_convergence_generation(history, best_score),
        stop_reason=history[-1].get("stop_reason", "completed") if history else "completed",
        pareto_front=[
            {
                "objective_values": {k: round(v, 4) for k, v in ind.objectives.items()},
                "rank": getattr(ind, "rank", 1),
                "crowding_distance": round(_safe_float(getattr(ind, "crowding_distance", 0.0)), 4),
                "fitness": round(ind.fitness, 6),
            }
            for ind in candidates[:req.count]
        ],
        best_by_objective=_build_best_by_objective(candidates, objectives, herb_id_to_name),
    )
    return {
        "run_id": run_id,
        "candidates": candidate_list,
        "pareto_front": [
            {
                "objective_values": {k: round(v, 4) for k, v in ind.objectives.items()},
                "rank": getattr(ind, "rank", 1),
                "crowding_distance": round(_safe_float(getattr(ind, "crowding_distance", 0.0)), 4),
                "fitness": round(ind.fitness, 6),
            }
            for ind in candidates[:req.count]
        ],
        "best_by_objective": _build_best_by_objective(candidates, objectives, herb_id_to_name),
        "objectives_config": [
            {"name": o.name, "key": o.key, "direction": o.direction, "weight": o.weight}
            for o in objectives
        ],
        "total_candidates": len(candidate_list),
        "total_generations": len(history),
        "total_evaluations": req.population_size * len(history),
        "best_score": best_score,
        "execution_time_ms": round(elapsed_ms, 2),
        "stop_reason": history[-1].get("stop_reason", "completed") if history else "completed",
        "convergence_generation": _estimate_convergence_generation(history, best_score),
        "history": history,
        "algorithm": "nsga2_genetic_algorithm",
        "mode": mode,
        "hybrid_mode": False,
    }


@sub_router.post("/generate/multi-objective/stream", summary="NSGA-II 多目标优化（SSE 流式）")
async def generate_multi_objective_stream(
    req: MultiObjectiveRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_plan("ai_formula_generation")),
):
    """NSGA-II 多目标配方优化，SSE 流式推送进化进度"""
    await _check_ai_quota(db, current_user.id)
    cancel = threading.Event()
    return StreamingResponse(
        _stream_multi_objective(req, cancel),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@sub_router.get("/generate/multi-objective/presets", summary="获取多目标优化预设")
async def get_mo_presets(
    current_user: User = Depends(require_plan("ai_formula_generation")),
):
    """返回可用的预设优化场景"""
    from ...services.ai.algorithms.presets import PRESET_SCENARIOS, _build_presets

    _build_presets()
    presets = {}
    for name, config in PRESET_SCENARIOS.items():
        presets[name] = {
            "name": name,
            "label": config.description or name,
            "mode": config.mode,
            "objectives": [
                {"name": o.name, "key": o.key, "direction": o.direction, "weight": o.weight}
                for o in config.objectives
            ],
            "default_params": {
                "population_size": config.population_size,
                "generations": config.generations,
                "mutation_rate": config.mutation_rate,
                "crossover_rate": config.crossover_rate,
                "elite_ratio": config.elite_ratio,
            },
        }
    return {"presets": presets, "total": len(presets)}


@sub_router.get("/generate/history", summary="获取遗传算法优化历史")
async def get_ga_history(
    algorithm_type: str = "all",
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_plan("ai_formula_generation")),
):
    """获取遗传算法/NSGA-II 优化历史记录"""
    try:
        from sqlalchemy import func, select

        from ...models.ga_optimization import GARunRecord

        query = select(GARunRecord).where(GARunRecord.user_id == current_user.id)
        if algorithm_type != "all":
            query = query.where(GARunRecord.algorithm_type == algorithm_type)
        query = query.order_by(GARunRecord.created_at.desc()).limit(limit).offset(offset)

        result = await db.execute(query)
        records = result.scalars().all()

        total_result = await db.execute(
            select(func.count(GARunRecord.id)).where(
                GARunRecord.user_id == current_user.id,
                *(
                    [GARunRecord.algorithm_type == algorithm_type]
                    if algorithm_type != "all" else []
                ),
            )
        )
        total = total_result.scalar_one()

        return {
            "records": [
                {
                    "id": r.id,
                    "run_id": r.run_id,
                    "algorithm": r.algorithm_type,
                    "mode": r.mode,
                    "target_effects": r.target_effects or [],
                    "params": r.algorithm_params or {},
                    "best_fitness": r.best_fitness,
                    "total_generations": r.total_generations,
                    "execution_time_ms": r.execution_time_ms,
                    "stop_reason": r.stop_reason,
                    "candidate_count": r.candidate_count,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in records
            ],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        logger.warning("[History] 查询失败: %s", e)
        return {"records": [], "total": 0, "limit": limit, "offset": offset}


@sub_router.get("/generate/history/{run_id}", summary="获取优化历史详情")
async def get_ga_history_detail(
    run_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_plan("ai_formula_generation")),
):
    """获取指定运行 ID 的遗传算法优化历史详情"""
    try:
        from sqlalchemy import select

        from ...models.ga_optimization import GACandidateRecord, GARunRecord

        result = await db.execute(
            select(GARunRecord).where(
                GARunRecord.run_id == run_id,
                GARunRecord.user_id == current_user.id,
            )
        )
        record = result.scalar_one_or_none()

        if not record:
            raise HTTPException(status_code=404, detail="运行记录不存在")

        # 查询候选方案详情
        cand_result = await db.execute(
            select(GACandidateRecord)
            .where(GACandidateRecord.run_id == run_id)
            .order_by(GACandidateRecord.rank_in_run)
        )
        candidates = cand_result.scalars().all()

        return {
            "run_id": record.run_id,
            "algorithm": record.algorithm_type,
            "mode": record.mode,
            "target_effects": record.target_effects or [],
            "params": record.algorithm_params or {},
            "objectives_config": record.objectives_config,
            "constraints": record.constraints,
            "total_generations": record.total_generations,
            "total_evaluations": record.total_evaluations,
            "best_fitness": record.best_fitness,
            "execution_time_ms": record.execution_time_ms,
            "convergence_generation": record.convergence_generation,
            "stop_reason": record.stop_reason,
            "final_diversity": record.final_diversity,
            "candidate_count": record.candidate_count,
            "pareto_front": record.pareto_front,
            "best_by_objective": record.best_by_objective,
            "candidates": [
                {
                    "rank": c.rank_in_run,
                    "pareto_rank": c.pareto_rank,
                    "ingredients": c.ingredients,
                    "overall_fitness": c.overall_fitness,
                    "scores": {
                        "efficacy": c.efficacy_score,
                        "safety": c.safety_score,
                        "taste": c.taste_score,
                        "cost": c.cost_score,
                        "synergy": c.synergy_score,
                        "stability": c.stability_score,
                    },
                    "explanation": c.explanation,
                }
                for c in candidates
            ],
            "created_at": record.created_at.isoformat() if record.created_at else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[HistoryDetail] 查询失败: %s", e)
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


# 路由通过 ai_modules/__init__.py 注册到主 router
# 此处不重复 include，避免重复注册

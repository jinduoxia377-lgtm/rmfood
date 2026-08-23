"""
遗传算法与多目标优化 API — /generate/genetic, /generate/multi-objective

提供：
- 单目标遗传算法（GeneticFormulaOptimizer）
- NSGA-II 多目标优化（NSGAIIOptimizer）
- SSE 流式推送进化进度
- 预设场景与历史记录

路由挂载到: /ai/generate/* （通过 ai_modules/__init__.py 的 router）
"""
import asyncio
import json
import logging
import threading
import time
import uuid
from typing import Any, AsyncGenerator, Dict, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from . import (
    get_current_user,
    router,
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


async def _stream_genetic(
    req: GeneticRequest,
    cancel_signal: threading.Event,
) -> AsyncGenerator[str, None]:
    """遗传算法流式执行 — 使用真实进度回调"""
    from ...services.ai.algorithms.genetic_formula_optimizer import GeneticFormulaOptimizer, GAConfig

    config = GAConfig(
        population_size=req.population_size,
        generations=req.generations,
        mutation_rate=req.mutation_rate,
        crossover_rate=req.crossover_rate,
        elite_ratio=req.elite_ratio,
        tournament_size=req.tournament_size,
        target_effects=req.target_effects,
        seed=req.seed,
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

        # 格式化候选结果
        candidate_list = []
        for i, ind in enumerate(candidates[:req.count]):
            herbs = []
            for hid, dosage in sorted(ind.genes.items(), key=lambda x: -x[1])[:10]:
                herbs.append({"name": hid, "dosage_mg": round(dosage, 1)})
            candidate_list.append({
                "rank": i + 1,
                "herb_combination": herbs,
                "fitness": round(ind.fitness, 6),
                "efficacy": round(ind.efficacy, 4),
                "safety": round(ind.safety, 4),
                "taste": round(ind.taste, 4),
                "cost": round(ind.cost, 4),
            })

        yield _make_sse_event("complete", {
            "candidates": candidate_list,
            "total_candidates": len(candidate_list),
            "total_generations": len(history),
            "best_score": round(max((c["fitness"] for c in candidate_list), default=0), 6),
            "execution_time_ms": round(elapsed_ms, 2),
            "stop_reason": history[-1].get("stop_reason", "completed") if history else "completed",
            "algorithm": "genetic_algorithm",
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

        # 构建多目标候选列表
        candidate_list = []
        for i, ind in enumerate(candidates[:req.count]):
            herbs = []
            for hid, dosage in sorted(ind.genes.items(), key=lambda x: -x[1])[:10]:
                herbs.append({"name": hid, "dosage_mg": round(dosage, 1)})
            scores = {k: round(v, 4) for k, v in ind.objectives.items()}
            candidate_list.append({
                "rank": i + 1,
                "herb_combination": herbs,
                "scores": scores,
                "fitness": round(ind.fitness, 6),
                "is_pareto_optimal": True,
            })

        yield _make_sse_event("complete", {
            "candidates": candidate_list,
            "total_candidates": len(candidate_list),
            "total_generations": len(history),
            "best_score": round(max((c["fitness"] for c in candidate_list), default=0), 6),
            "execution_time_ms": round(elapsed_ms, 2),
            "stop_reason": history[-1].get("stop_reason", "completed") if history else "completed",
            "algorithm": "nsga2_genetic_algorithm",
            "mode": req.mode,
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
    current_user: User = Depends(get_current_user),
):
    """单目标遗传算法批量优化，返回最优候选方案"""
    from ...services.ai.algorithms.genetic_formula_optimizer import GeneticFormulaOptimizer, GAConfig

    config = GAConfig(
        population_size=req.population_size,
        generations=req.generations,
        mutation_rate=req.mutation_rate,
        crossover_rate=req.crossover_rate,
        elite_ratio=req.elite_ratio,
        tournament_size=req.tournament_size,
        target_effects=req.target_effects,
        seed=req.seed,
    )
    optimizer = GeneticFormulaOptimizer(config=config)
    start = time.perf_counter()

    candidates, history = optimizer.optimize(
        target_effects=req.target_effects,
        exclude_herbs=set(req.constraints.get("exclude_herbs", [])) if req.constraints else None,
        include_herbs=req.include_herbs,
    )
    elapsed_ms = (time.perf_counter() - start) * 1000

    candidate_list = []
    for i, ind in enumerate(candidates[:req.count]):
        herbs = []
        for hid, dosage in sorted(ind.genes.items(), key=lambda x: -x[1])[:10]:
            herbs.append({"name": hid, "dosage_mg": round(dosage, 1)})
        candidate_list.append({
            "rank": i + 1,
            "herb_combination": herbs,
            "fitness": round(ind.fitness, 6),
            "efficacy": round(ind.efficacy, 4),
            "safety": round(ind.safety, 4),
            "taste": round(ind.taste, 4),
            "cost": round(ind.cost, 4),
        })

    run_id = f"ga-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    return {
        "run_id": run_id,
        "candidates": candidate_list,
        "total_candidates": len(candidate_list),
        "total_generations": len(history),
        "best_score": round(max((c["fitness"] for c in candidate_list), default=0), 6),
        "execution_time_ms": round(elapsed_ms, 2),
        "stop_reason": history[-1].get("stop_reason", "completed") if history else "completed",
        "history": history,
    }


@sub_router.post("/generate/genetic/stream", summary="遗传算法配方优化（SSE 流式）")
async def generate_genetic_stream(
    req: GeneticRequest,
    current_user: User = Depends(get_current_user),
):
    """单目标遗传算法 SSE 流式优化"""
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
    current_user: User = Depends(get_current_user),
):
    """混合模式：先遗传算法全局探索，再 NSGA-II 精细优化"""
    from ...services.ai.algorithms.genetic_formula_optimizer import GeneticFormulaOptimizer, GAConfig
    from ...services.ai.algorithms.algorithm import NSGAIIOptimizer
    from ...services.ai.algorithms.models import OptimizationConfig, OptimizationObjective

    ga_config = GAConfig(
        population_size=req.population_size,
        generations=req.generations,
        mutation_rate=req.mutation_rate,
        crossover_rate=req.crossover_rate,
        elite_ratio=req.elite_ratio,
        tournament_size=req.tournament_size,
        target_effects=req.target_effects,
        seed=req.seed,
    )
    ga = GeneticFormulaOptimizer(config=ga_config)
    ga_candidates, ga_history = ga.optimize(
        target_effects=req.target_effects,
        exclude_herbs=set(req.constraints.get("exclude_herbs", [])) if req.constraints else None,
        include_herbs=req.include_herbs,
    )

    # 用 GA 结果初始化 NSGA-II 种群
    nsga_config = OptimizationConfig(
        objectives=[
            OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.30),
            OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.25),
            OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
            OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.15),
            OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.10),
            OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
        ],
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

    return {
        "ga_candidates": len(ga_candidates),
        "ga_history_length": len(ga_history),
        "mo_candidates": len(mo_candidates),
        "mo_history_length": len(mo_history),
        "combined_results": all_candidates[:req.count],
        "algorithm": "genetic_hybrid",
    }


@sub_router.post("/generate/genetic/hybrid/stream", summary="遗传算法混合优化（SSE 流式）")
async def generate_genetic_hybrid_stream(
    req: GeneticRequest,
    current_user: User = Depends(get_current_user),
):
    """混合遗传算法 SSE 流式优化"""
    cancel = threading.Event()
    from ...services.ai.algorithms.genetic_formula_optimizer import GeneticFormulaOptimizer, GAConfig
    from ...services.ai.algorithms.algorithm import NSGAIIOptimizer
    from ...services.ai.algorithms.models import OptimizationConfig, OptimizationObjective

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
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.30),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.25),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.15),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.10),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
            ],
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
        candidate_list = []
        for i, ind in enumerate(mo_candidates[:req.count]):
            herbs = []
            for hid, dosage in sorted(ind.genes.items(), key=lambda x: -x[1])[:10]:
                herbs.append({"name": hid, "dosage_mg": round(dosage, 1)})
            scores = {k: round(v, 4) for k, v in ind.objectives.items()}
            candidate_list.append({
                "rank": i + 1,
                "herb_combination": herbs,
                "scores": scores,
                "fitness": round(ind.fitness, 6),
                "source": "ga_hybrid_nsga2",
            })

        yield _make_sse_event("complete", {
            "candidates": candidate_list,
            "total_candidates": len(candidate_list),
            "ga_generations": len(ga_history),
            "nsga2_generations": len(mo_history),
            "algorithm": "genetic_hybrid_nsga2",
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


@sub_router.post("/generate/multi-objective", summary="NSGA-II 多目标优化（非流式）")
async def generate_multi_objective(
    req: MultiObjectiveRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """NSGA-II 多目标配方优化"""
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
    optimizer = NSGAIIOptimizer(config=config)
    start = time.perf_counter()

    candidates, history = optimizer.optimize(
        target_effects=req.target_effects or ["免疫调节"],
        constraints={**(req.constraints or {}), "include_herbs": req.include_herbs or []},
    )
    elapsed_ms = (time.perf_counter() - start) * 1000

    candidate_list = []
    for i, ind in enumerate(candidates[:req.count]):
        herbs = []
        for hid, dosage in sorted(ind.genes.items(), key=lambda x: -x[1])[:10]:
            herbs.append({"name": hid, "dosage_mg": round(dosage, 1)})
        scores = {k: round(v, 4) for k, v in ind.objectives.items()}
        candidate_list.append({
            "rank": i + 1,
            "herb_combination": herbs,
            "scores": scores,
            "fitness": round(ind.fitness, 6),
            "is_pareto_optimal": True,
        })

    run_id = f"mo-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    return {
        "run_id": run_id,
        "candidates": candidate_list,
        "total_candidates": len(candidate_list),
        "total_generations": len(history),
        "best_score": round(max((c["fitness"] for c in candidate_list), default=0), 6),
        "execution_time_ms": round(elapsed_ms, 2),
        "stop_reason": history[-1].get("stop_reason", "completed") if history else "completed",
        "algorithm": "nsga2_genetic_algorithm",
        "mode": mode,
    }


@sub_router.post("/generate/multi-objective/stream", summary="NSGA-II 多目标优化（SSE 流式）")
async def generate_multi_objective_stream(
    req: MultiObjectiveRequest,
    current_user: User = Depends(get_current_user),
):
    """NSGA-II 多目标配方优化，SSE 流式推送进化进度"""
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
):
    """获取遗传算法/NSGA-II 优化历史记录"""
    try:
        from sqlalchemy import select, func
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
    current_user: User = Depends(get_current_user),
):
    """获取指定运行 ID 的遗传算法优化历史详情"""
    try:
        from sqlalchemy import select
        from ...models.ga_optimization import GARunRecord, GACandidateRecord

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

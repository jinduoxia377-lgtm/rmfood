"""NSGA-II multi-objective stream endpoint code."""

NL = chr(10)  # newline character

code = f'''

@router.post("/generate/multi-objective/stream", summary="NSGA-II多目标配方优化(流式SSE)")
async def multi_objective_optimize_stream(
    request: MultiObjectiveRequest,
    current_user: CurrentUser,
):
    """NSGA-II 多目标优化流式生成 — SSE 逐代推送进化进度"""
    # Rate limit check
    _check_rate_limit(str(current_user.id))

    logger.info(f"[MOGA/Stream] 用户 {{current_user.id}} 发起流式多目标优化 | 预设={{request.preset}} | 模式={{request.mode}}")

    progress_queue: queue.Queue = queue.Queue()
    cancel_signal = threading.Event()

    def _safe_put(q, item, label):
        if cancel_signal.is_set():
            return False
        try:
            q.put(item, timeout=5.0)
            return True
        except queue.Full:
            logger.warning(f"[MOGA/Stream] {{label}} queue full, dropping")
            return False

    def _run_moga_streaming():
        try:
            start_time = time.perf_counter()

            if request.preset and request.preset in PRESET_SCENARIOS:
                config = get_preset_scenario(request.preset)
            elif request.objectives:
                objectives = [
                    OptimizationObjective(
                        name=obj.get("name", obj["key"]),
                        key=obj["key"],
                        direction=obj.get("direction", "maximize"),
                        weight=obj.get("weight", 1.0),
                        description=obj.get("description", "")
                    )
                    for obj in request.objectives
                ]
                config = OptimizationConfig(
                    objectives=objectives,
                    mode=request.mode,
                    population_size=request.population_size,
                    generations=request.generations,
                    mutation_rate=request.mutation_rate,
                    crossover_rate=request.crossover_rate,
                    elite_ratio=request.elite_ratio,
                    constraints=request.constraints,
                    candidate_count=request.count,
                    seed=request.seed,
                )
            else:
                config = OptimizationConfig(
                    mode=request.mode,
                    population_size=request.population_size,
                    generations=request.generations,
                    mutation_rate=request.mutation_rate,
                    crossover_rate=request.crossover_rate,
                    elite_ratio=request.elite_ratio,
                    constraints=request.constraints,
                    candidate_count=request.count,
                    seed=request.seed,
                )

            raw_constraints = request.constraints or {{}}
            ga_constraints = dict(raw_constraints)
            if "excluded_ingredients" in ga_constraints:
                ga_constraints["exclude_herbs"] = ga_constraints.pop("excluded_ingredients")
            ga_constraints["target_effects"] = request.target_effects
            config.constraints = ga_constraints

            _safe_put(progress_queue, ("start", {{
                "type": "start",
                "config": {{
                    "population_size": request.population_size,
                    "generations": request.generations,
                    "mutation_rate": request.mutation_rate,
                    "crossover_rate": request.crossover_rate,
                    "elite_ratio": request.elite_ratio,
                    "mode": request.mode,
                }},
                "target_effects": request.target_effects,
                "preset": request.preset,
            }}))

            from .multi_objective_optimizer import NSGAIIOptimizer
            optimizer = NSGAIIOptimizer(config=config)
            result = optimizer.generate_with_result(
                target_effects=request.target_effects,
                constraints=ga_constraints,
                _cancel_signal=cancel_signal,
            )

            elapsed_ms = (time.perf_counter() - start_time) * 1000

            for i, record in enumerate(result.history):
                if cancel_signal.is_set():
                    return
                if i % max(1, len(result.history) // 20) == 0:
                    _safe_put(progress_queue, ("progress", {{
                        "type": "progress",
                        "generation": record.get("generation", i),
                        "best_fitness": record.get("best_fitness", 0),
                        "avg_fitness": record.get("avg_fitness", 0),
                        "min_fitness": record.get("min_fitness", 0),
                        "diversity": record.get("diversity", 0),
                    }}), "progress-{{i}}")

            candidates_out = []
            for cand in result.candidates[:request.count]:
                ingredients_out = [
                    {{"id": hid, "name_cn": _resolve_herb_name(hid, optimizer.evaluator.herb_db), "dosage": round(d, 1)}}
                    for hid, d in cand.genes.items()
                ]
                candidates_out.append({{
                    "ingredients": ingredients_out,
                    "objective_scores": {{k: round(v, 4) for k, v in cand.objectives.items()}},
                    "overall_fitness": round(cand.fitness, 6),
                    "pareto_rank": cand.rank,
                    "crowding_distance": round(cand.crowding_distance, 6),
                    "explanation": f"Pareto Rank-{{cand.rank}} 拥挤度={{cand.crowding_distance:.4f}}",
                }})

            _safe_put(progress_queue, ("complete", {{
                "type": "complete",
                "candidates": candidates_out,
                "pareto_front": [
                    {{"objective_values": {{k: round(v, 4) for k, v in p.items()}}, "rank": 1, "crowding_distance": 0}}
                    for p in result.pareto_front[:config.pareto_front_size]
                ],
                "history": result.history,
                "total_generations": result.total_generations,
                "total_evaluations": result.total_evaluations,
                "execution_time_ms": round(elapsed_ms, 1),
                "convergence_generation": result.convergence_generation,
                "stop_reason": result.stop_reason,
                "objectives_config": result.objectives_config,
            }}))

        except Exception as e:
            logger.error(f"[MOGA/Stream] 流式优化失败: {{e}}", exc_info=True)
            _safe_put(progress_queue, ("error", {{
                "type": "error", "message": str(e),
            }}), "error")

    async def event_generator():
        try:
            thread = threading.Thread(target=_run_moga_streaming, daemon=True)
            thread.start()

            while True:
                try:
                    event_type, data = progress_queue.get(timeout=1.0)
                    yield "event: " + event_type + NL + "data: " + json.dumps(data, ensure_ascii=False) + NL + NL
                except queue.Empty:
                    if not thread.is_alive():
                        break
                    continue

            while not progress_queue.empty():
                try:
                    event_type, data = progress_queue.get_nowait()
                    yield "event: " + event_type + NL + "data: " + json.dumps(data, ensure_ascii=False) + NL + NL
                except queue.Empty:
                    break

        except Exception as e:
            logger.error(f"[MOGA/Stream] SSE生成器异常: {{e}}", exc_info=True)
            yield "event: error" + NL + "data: " + json.dumps({{"type":"error","message":str(e)}}, ensure_ascii=False) + NL + NL

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={{
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }},
    )
'''

with open(r'app\api\v1\mo_stream_endpoint.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Written mo_stream_endpoint.py")

"""
并行配方生成管线
将串行5步管线优化为并行执行，目标：<3秒完成配方生成
"""

import asyncio
import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class GenerationPhase(str, Enum):
    """生成阶段"""
    SYNERGY = "synergy"
    COMPATIBILITY = "compatibility"
    RATIO_OPTIMIZATION = "ratio_optimization"
    EFFECT_PREDICTION = "effect_prediction"
    SAFETY_CHECK = "safety_check"


@dataclass
class PhaseResult:
    """单阶段结果"""
    phase: GenerationPhase
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    execution_time: float = 0.0
    cache_hit: bool = False


@dataclass
class ParallelGenerationRequest:
    """并行生成请求"""
    ingredients: List[Dict[str, Any]]
    target_efficacy: float = 0.75
    safety_priority: bool = True
    cost_constraint: Optional[float] = None
    target_population: str = "adult"
    use_caching: bool = True
    user_preferences: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ParallelGenerationResult:
    """并行生成结果"""
    success: bool
    formula_id: str
    optimized_ratios: Dict[str, float]
    synergy_report: Optional[Dict] = None
    compatibility_report: Optional[Dict] = None
    effect_prediction: Optional[Dict] = None
    safety_check: Optional[Dict] = None
    taste_prediction: Optional[Dict] = None
    stability_prediction: Optional[Dict] = None
    recommendations: List[str] = field(default_factory=list)
    generation_time: float = 0.0
    phase_times: Dict[str, float] = field(default_factory=dict)
    error_message: Optional[str] = None
    cache_hit: bool = False


class ParallelFormulaPipeline:
    """
    并行配方生成管线

    管线架构:
    ┌─────────────────────────────────────────────────────────────┐
    │                    输入验证 & 缓存检查                       │
    └─────────────────────────────────────────────────────────────┘
                              ↓
    ┌──────────────┐      ┌──────────────┐
    │  Synergy     │      │ Compatibility │  ← Phase 1: 并行执行
    │  Analysis    │      │   Check       │
    └──────────────┘      └──────────────┘
                              ↓
    ┌──────────────────────────────────────┐
    │     Ratio Optimization (依赖Phase 1)  │
    └──────────────────────────────────────┘
                              ↓
    ┌──────────────┐      ┌──────────────┐
    │  Effect      │      │  Safety      │  ← Phase 2: 并行执行
    │  Prediction  │      │   Check      │
    └──────────────┘      └──────────────┘
                              ↓
    ┌──────────────────────────────────────┐
    │         结果融合 & 输出              │
    └──────────────────────────────────────┘

    性能目标:
    - 串行: ~15秒
    - 并行: <3秒
    """

    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._cache_max_size = 1000
        self._phase_timings: Dict[str, List[float]] = {}
        logger.info("ParallelFormulaPipeline 初始化完成")

    def _generate_cache_key(self, request: ParallelGenerationRequest) -> str:
        """生成缓存键"""
        data = {
            "ingredients": sorted([(i.get("name"), i.get("percentage")) for i in request.ingredients]),
            "target_efficacy": request.target_efficacy,
            "safety_priority": request.safety_priority,
            "cost_constraint": request.cost_constraint,
            "target_population": request.target_population,
        }
        raw = json.dumps(data, sort_keys=True, default=str).encode()
        return hashlib.sha256(raw).hexdigest()[:16]

    async def generate(
        self,
        request: ParallelGenerationRequest
    ) -> ParallelGenerationResult:
        """
        执行并行配方生成

        Args:
            request: 生成请求

        Returns:
            ParallelGenerationResult: 生成结果
        """
        start_time = time.perf_counter()
        formula_id = f"FORMULA-{datetime.now().strftime('%Y%m%d%H%M%S')}-{hash(start_time) % 10000:04d}"

        # 1. 缓存检查
        if request.use_caching:
            cache_key = self._generate_cache_key(request)
            if cache_key in self._cache:
                logger.info(f"缓存命中: {cache_key}")
                cached_result = self._cache[cache_key]
                cached_result["generation_time"] = time.perf_counter() - start_time
                cached_result["cache_hit"] = True
                return cached_result

        phase_results: Dict[GenerationPhase, PhaseResult] = {}
        phase_times: Dict[str, float] = {}

        try:
            # ========== Phase 1: 并行执行 Synergy + Compatibility ==========
            logger.info("Phase 1: 并行执行协同分析和兼容性检查...")
            phase1_start = time.perf_counter()

            synergy_task = asyncio.create_task(
                self._run_synergy_analysis(request)
            )
            compat_task = asyncio.create_task(
                self._run_compatibility_check(request)
            )

            synergy_result, compat_result = await asyncio.gather(
                synergy_task, compat_task,
                return_exceptions=True
            )

            phase1_time = time.perf_counter() - phase1_start
            phase_times["phase1_parallel"] = phase1_time

            if isinstance(synergy_result, Exception):
                phase_results[GenerationPhase.SYNERGY] = PhaseResult(
                    phase=GenerationPhase.SYNERGY,
                    success=False,
                    error=str(synergy_result)
                )
            else:
                phase_results[GenerationPhase.SYNERGY] = PhaseResult(
                    phase=GenerationPhase.SYNERGY,
                    success=True,
                    data=synergy_result,
                    execution_time=phase1_time / 2  # 近似平分
                )

            if isinstance(compat_result, Exception):
                phase_results[GenerationPhase.COMPATIBILITY] = PhaseResult(
                    phase=GenerationPhase.COMPATIBILITY,
                    success=False,
                    error=str(compat_result)
                )
            else:
                phase_results[GenerationPhase.COMPATIBILITY] = PhaseResult(
                    phase=GenerationPhase.COMPATIBILITY,
                    success=True,
                    data=compat_result,
                    execution_time=phase1_time / 2
                )

            # ========== Phase 2: 比例优化（依赖Phase 1）==========
            logger.info("Phase 2: 执行比例优化...")
            phase2_start = time.perf_counter()

            ratio_result = await self._run_ratio_optimization(
                request,
                phase_results.get(GenerationPhase.SYNERGY, PhaseResult(
                    phase=GenerationPhase.RATIO_OPTIMIZATION, success=False
                )).data
            )

            phase_times["ratio_optimization"] = time.perf_counter() - phase2_start
            phase_results[GenerationPhase.RATIO_OPTIMIZATION] = ratio_result

            # ========== Phase 3: 并行执行 Effect + Safety ==========
            logger.info("Phase 3: 并行执行效果预测和安全检查...")
            phase3_start = time.perf_counter()

            effect_task = asyncio.create_task(
                self._run_effect_prediction(request, ratio_result.data)
            )
            safety_task = asyncio.create_task(
                self._run_safety_check(request, ratio_result.data)
            )
            taste_task = asyncio.create_task(
                self._run_taste_prediction(request, ratio_result.data)
            )
            stability_task = asyncio.create_task(
                self._run_stability_prediction(request, ratio_result.data)
            )

            effect_result, safety_result, taste_result, stability_result = await asyncio.gather(
                effect_task, safety_task, taste_task, stability_task,
                return_exceptions=True
            )

            phase3_time = time.perf_counter() - phase3_start
            phase_times["phase3_parallel"] = phase3_time

            # 处理结果
            phase_results[GenerationPhase.EFFECT_PREDICTION] = self._wrap_result(
                GenerationPhase.EFFECT_PREDICTION, effect_result, phase3_time / 4
            )
            phase_results[GenerationPhase.SAFETY_CHECK] = self._wrap_result(
                GenerationPhase.SAFETY_CHECK, safety_result, phase3_time / 4
            )
            phase_results["taste"] = self._wrap_result(
                "taste", taste_result, phase3_time / 4
            )
            phase_results["stability"] = self._wrap_result(
                "stability", stability_result, phase3_time / 4
            )

            # ========== 结果融合 ==========
            logger.info("融合所有阶段结果...")
            result = self._fuse_results(
                formula_id=formula_id,
                phase_results=phase_results,
                phase_times=phase_times,
                start_time=start_time
            )

            # 缓存结果
            if request.use_caching:
                self._cache[cache_key] = result
                self._evict_cache_if_needed()

            return result

        except Exception as e:
            logger.error(f"配方生成失败: {e}", exc_info=True)
            return ParallelGenerationResult(
                success=False,
                formula_id=formula_id,
                optimized_ratios={},
                generation_time=time.perf_counter() - start_time,
                phase_times=phase_times,
                error_message=str(e)
            )

    def _wrap_result(
        self,
        phase: GenerationPhase,
        result: Any,
        exec_time: float
    ) -> PhaseResult:
        """包装单阶段结果"""
        if isinstance(result, Exception):
            return PhaseResult(phase=phase, success=False, error=str(result), execution_time=exec_time)
        return PhaseResult(phase=phase, success=True, data=result, execution_time=exec_time)

    async def _run_synergy_analysis(self, request: ParallelGenerationRequest) -> Dict:
        """协同分析"""
        # 模拟耗时操作
        await asyncio.sleep(0.1)
        return {
            "overall_si": 0.75,
            "dominant_mechanism": "bliss_independence",
            "mechanisms": [
                {"type": "bliss_independence", "score": 0.8, "confidence": 0.75},
                {"type": "pk_interaction", "score": 0.6, "confidence": 0.6},
            ]
        }

    async def _run_compatibility_check(self, request: ParallelGenerationRequest) -> Dict:
        """兼容性检查"""
        await asyncio.sleep(0.08)
        return {
            "overall_score": 85,
            "issues_count": 2,
            "error_count": 0,
            "warning_count": 2,
            "recommendations": ["建议调整维生素C剂量"]
        }

    async def _run_ratio_optimization(
        self,
        request: ParallelGenerationRequest,
        synergy_data: Optional[Dict]
    ) -> PhaseResult:
        """比例优化"""
        await asyncio.sleep(0.15)

        # 生成优化后的比例
        total = sum(i.get("percentage", 0) for i in request.ingredients)
        optimized = {}
        for ing in request.ingredients:
            base = ing.get("percentage", 0) / total if total > 0 else 0
            # 根据协同数据调整
            if synergy_data:
                base *= (1 + synergy_data.get("overall_si", 0.5) * 0.1)
            optimized[ing.get("name", "")] = round(base * 100, 2)

        return PhaseResult(
            phase=GenerationPhase.RATIO_OPTIMIZATION,
            success=True,
            data=optimized
        )

    async def _run_effect_prediction(
        self,
        request: ParallelGenerationRequest,
        ratios: Dict[str, float]
    ) -> Dict:
        """效果预测"""
        await asyncio.sleep(0.12)
        return {
            "peak_time": 2.5,
            "peak_concentration": 15.3,
            "effect_duration": 8.0,
            "auc": 120.5,
            "confidence": 0.78
        }

    async def _run_safety_check(
        self,
        request: ParallelGenerationRequest,
        ratios: Dict[str, float]
    ) -> Dict:
        """安全检查"""
        await asyncio.sleep(0.1)
        return {
            "passed": True,
            "issues": [],
            "warnings": ["建议监测维生素C剂量"],
            "compliance_status": "compliant"
        }

    async def _run_taste_prediction(
        self,
        request: ParallelGenerationRequest,
        ratios: Dict[str, float]
    ) -> Dict:
        """风味预测"""
        await asyncio.sleep(0.08)
        return {
            "taste_profile": {
                "bitter": 0.3,
                "sweet": 0.6,
                "umami": 0.5,
                "astringent": 0.1,
                "sour": 0.1
            },
            "acceptability": 0.72,
            "suggestions": ["添加红枣可提升甜味"]
        }

    async def _run_stability_prediction(
        self,
        request: ParallelGenerationRequest,
        ratios: Dict[str, float]
    ) -> Dict:
        """稳定性预测"""
        await asyncio.sleep(0.08)
        return {
            "predicted_shelf_life_months": 18,
            "stability_score": 75,
            "risk_factors": ["光照敏感性"],
            "recommendations": ["建议避光保存"]
        }

    def _fuse_results(
        self,
        formula_id: str,
        phase_results: Dict,
        phase_times: Dict[str, float],
        start_time: float
    ) -> ParallelGenerationResult:
        """融合所有阶段结果"""
        recommendations = []

        # 收集各阶段建议
        for phase, result in phase_results.items():
            if result.success and result.data:
                if isinstance(result.data, dict):
                    recs = result.data.get("recommendations", [])
                    recommendations.extend(recs)

        # 去重
        recommendations = list(dict.fromkeys(recommendations))

        total_time = time.perf_counter() - start_time

        return ParallelGenerationResult(
            success=True,
            formula_id=formula_id,
            optimized_ratios=phase_results.get(
                GenerationPhase.RATIO_OPTIMIZATION, PhaseResult(success=False)
            ).data or {},
            synergy_report=phase_results.get(
                GenerationPhase.SYNERGY, PhaseResult(success=False)
            ).data,
            compatibility_report=phase_results.get(
                GenerationPhase.COMPATIBILITY, PhaseResult(success=False)
            ).data,
            effect_prediction=phase_results.get(
                GenerationPhase.EFFECT_PREDICTION, PhaseResult(success=False)
            ).data,
            safety_check=phase_results.get(
                GenerationPhase.SAFETY_CHECK, PhaseResult(success=False)
            ).data,
            taste_prediction=phase_results.get(
                "taste", PhaseResult(success=False)
            ).data,
            stability_prediction=phase_results.get(
                "stability", PhaseResult(success=False)
            ).data,
            recommendations=recommendations,
            generation_time=total_time,
            phase_times=phase_times,
            cache_hit=False
        )

    def _evict_cache_if_needed(self):
        """缓存淘汰"""
        if len(self._cache) > self._cache_max_size:
            # 简单LRU淘汰
            keys = list(self._cache.keys())
            for key in keys[:len(keys) // 2]:
                del self._cache[key]
            logger.info(f"缓存淘汰，剩余 {len(self._cache)} 条")

    def get_performance_stats(self) -> Dict:
        """获取性能统计"""
        all_times = []
        for times in self._phase_timings.values():
            all_times.extend(times)

        return {
            "cache_size": len(self._cache),
            "avg_generation_time": sum(all_times) / len(all_times) if all_times else 0,
            "min_generation_time": min(all_times) if all_times else 0,
            "max_generation_time": max(all_times) if all_times else 0,
        }


# 便捷函数
async def generate_formula_parallel(request: ParallelGenerationRequest) -> ParallelGenerationResult:
    """便捷入口函数"""
    pipeline = ParallelFormulaPipeline()
    return await pipeline.generate(request)


if __name__ == "__main__":
    import asyncio

    async def test():
        request = ParallelGenerationRequest(
            ingredients=[
                {"name": "黄芪多糖", "percentage": 30},
                {"name": "大豆肽", "percentage": 25},
                {"name": "枸杞", "percentage": 20},
                {"name": "甘草", "percentage": 15},
                {"name": "维生素C", "percentage": 10},
            ],
            target_efficacy=0.75,
            use_caching=True
        )

        # 第一次生成
        start = time.perf_counter()
        result = await generate_formula_parallel(request)
        elapsed = time.perf_counter() - start

        print("=== 并行配方生成测试 ===")
        print(f"配方ID: {result.formula_id}")
        print(f"生成时间: {elapsed:.3f}s (目标: <3s)")
        print(f"成功: {result.success}")
        print(f"优化比例: {result.optimized_ratios}")
        print(f"建议: {result.recommendations}")
        print(f"阶段耗时: {result.phase_times}")

        # 第二次生成（缓存命中）
        start = time.perf_counter()
        result2 = await generate_formula_parallel(request)
        elapsed2 = time.perf_counter() - start

        print("\n缓存命中测试:")
        print(f"生成时间: {elapsed2:.3f}s")
        print(f"缓存命中: {result2.cache_hit}")

    asyncio.run(test())

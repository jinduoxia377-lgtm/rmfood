"""
PepINVENT 肽设计服务层

提供高级 API 用于肽序列生成、优化和采样。
封装适配器层的底层调用，添加业务逻辑：
- 功效目标映射
- 结果后处理与格式化
- 缓存机制
- 请求去重

使用方式:
    from ..services.ai_models.pepinvent_service import PepinventService

    service = PepinventService()
    peptides = await service.generate_peptides(["ACE抑制"], max_candidates=5)
"""
from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

from .pepinvent_adapter import (
    PepinventAdapter,
    PeptideResult,
    OptimizationResult,
    ServiceUnavailableError,
    get_pepinvent_adapter,
    _EFFECT_MAPPING,
)


@dataclass
class GenerateRequest:
    """肽生成请求"""

    target_effects: List[str]
    max_candidates: int = 5
    constraints: Optional[Dict[str, Any]] = None


@dataclass
class OptimizeRequest:
    """肽优化请求"""

    seed_sequences: List[str]
    optimization_goals: Dict[str, float]
    iterations: int = 10


@dataclass
class SampleRequest:
    """探索性采样请求"""

    sample_size: int = 20
    temperature: Optional[float] = None
    top_k: Optional[int] = None
    diversity_metric: str = "tanimoto"


@dataclass
class GenerateResponse:
    """肽生成响应"""

    peptides: List[Dict[str, Any]]
    total: int
    generation_method: str
    target_effects: List[str]
    diversity_metrics: Dict[str, Any]
    generated_at: str
    processing_time_ms: int


@dataclass
class OptimizeResponse:
    """肽优化响应"""

    optimized_peptides: List[Dict[str, Any]]
    total: int
    optimization_goals: Dict[str, float]
    seed_count: int
    iterations_performed: int
    generated_at: str
    processing_time_ms: int


@dataclass
class SampleResponse:
    """采样响应"""

    peptides: List[Dict[str, Any]]
    total: int
    diversity_metrics: Dict[str, Any]
    sampling_parameters: Dict[str, Any]
    generated_at: str
    processing_time_ms: int


class PepinventService:
    """
    PepINVENT 高级服务类

    提供面向业务的 API 接口，处理功效映射、结果格式化和缓存管理。
    """

    def __init__(self, adapter: Optional[PepinventAdapter] = None):
        self._adapter = adapter or get_pepinvent_adapter()
        self._cache: Dict[str, Tuple[Any, float]] = {}
        self._cache_ttl: int = 3600

    async def generate_peptides(
        self,
        target_effects: List[str],
        constraints: Optional[Dict[str, Any]] = None,
        max_candidates: int = 5,
    ) -> GenerateResponse:
        """
        基于目标功效生成肽候选序列

        将业务层面的功效描述（如"ACE抑制"、"抗氧化"）映射为
        PepINVERT 的优化目标，然后生成满足要求的肽序列。

        Args:
            target_effects: 目标功效列表，如 ["ACE抑制", "抗氧化"]
            constraints: 约束条件字典，可包含：
                - min_length / max_length: 肽长度范围
                - exclude_sequences: 要排除的序列列表
                - include_amino_acids: 必须包含的氨基酸
                - exclude_amino_acids: 要排除的氨基酸
            max_candidates: 最大候选数量

        Returns:
            GenerateResponse: 包含生成的肽及其属性

        Raises:
            ValueError: 输入参数无效时
            ServiceUnavailableError: 服务不可用时
        """
        start_time = time.time()

        if not target_effects:
            raise ValueError("target_effects 不能为空")

        if max_candidates < 1 or max_candidates > 50:
            raise ValueError(f"max_candidates 应在1-50之间，当前值: {max_candidates}")

        constraints = constraints or {}
        mapped_objectives = self._map_effects_to_objectives(target_effects)

        logger.info(
            f"开始生成肽序列 - 目标功效: {target_effects}, "
            f"映射目标: {mapped_objectives}, 数量: {max_candidates}"
        )

        cache_key = self._generate_cache_key("generate", target_effects, constraints, max_candidates)
        cached = self._get_from_cache(cache_key)
        if cached:
            logger.info(f"命中缓存，返回缓存结果")
            return cached

        if not await self._adapter.initialize():
            raise ServiceUnavailableError(
                "PepINVERT 服务初始化失败",
                missing_deps=[],
            )

        raw_results = await self._adapter.sample_peptides(
            num_samples=max_candidates * 2,
            temperature=constraints.get("temperature"),
            top_k=constraints.get("top_k"),
        )

        filtered_results = self._apply_constraints(raw_results, constraints)
        scored_results = self._score_peptides(filtered_results, mapped_objectives)
        sorted_results = sorted(scored_results, key=lambda x: x.get("composite_score", 0), reverse=True)
        final_results = sorted_results[:max_candidates]

        peptides = []
        for result in final_results:
            peptide_data = {
                "sequence": result["sequence"],
                "molecular_weight": result.get("properties", {}).get("molecular_weight", 0),
                "logp": result.get("properties", {}).get("logp", 0),
                "tpsa": result.get("properties", {}).get("tpsa", 0),
                "activity_scores": result.get("activity_scores", {}),
                "composite_score": round(result.get("composite_score", 0), 4),
                "smiles": result.get("smiles"),
                "amino_acid_count": len(result.get("sequence", "")),
                "properties": result.get("properties", {}),
            }
            peptides.append(peptide_data)

        sequences = [p["sequence"] for p in peptides]
        diversity_metrics = self._adapter.calculate_diversity(sequences)

        processing_time = int((time.time() - start_time) * 1000)
        from datetime import datetime, timezone

        response = GenerateResponse(
            peptides=peptides,
            total=len(peptides),
            generation_method="pepinvent_sampling" if not self._adapter.is_simulation_mode else "simulation",
            target_effects=target_effects,
            diversity_metrics={
                "diversity_score": diversity_metrics["diversity_score"],
                "unique_count": diversity_metrics["unique_count"],
                "average_similarity": diversity_metrics["average_similarity"],
            },
            generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            processing_time_ms=processing_time,
        )

        self._set_cache(cache_key, response)
        logger.info(f"肽生成完成 - 返回 {len(peptides)} 条结果，耗时 {processing_time}ms")

        return response

    async def optimize_peptide(
        self,
        seed_sequence: str,
        optimization_goals: Dict[str, float],
        iterations: int = 10,
    ) -> OptimizeResponse:
        """
        使用 RL 优化单个肽序列

        Args:
            seed_sequence: 种子肽序列
            optimization_goals: 优化目标及权重，如 {"ACE_inhibitory": 0.6, "permeability": 0.4}
            iterations: RL 迭代次数

        Returns:
            OptimizeResponse: 优化后的肽序列及评分

        Raises:
            ValueError: 输入无效时
        """
        start_time = time.time()

        valid, error = self._adapter.validate_sequence(seed_sequence)
        if not valid:
            raise ValueError(f"无效的种子序列: {error}")

        valid, error = self._adapter.validate_objectives(optimization_goals)
        if not valid:
            raise ValueError(f"无效的优化目标: {error}")

        logger.info(
            f"开始 RL 优化 - 种子序列: {seed_sequence}, 目标: {optimization_goals}, 迭代次数: {iterations}"
        )

        cache_key = self._generate_cache_key("optimize", seed_sequence, optimization_goals, iterations)
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached

        if not await self._adapter.initialize():
            raise ServiceUnavailableError("PepINVERT 服务不可用")

        results = await self._adapter.optimize_with_rl(
            seed_sequences=[seed_sequence],
            objectives=optimization_goals,
            iterations=iterations,
        )

        optimized_peptides = []
        for r in results:
            optimized_peptides.append({
                "sequence": r["sequence"],
                "scores": r["scores"],
                "weighted_score": r["weighted_score"],
                "iteration_improved": r["iteration_improved"],
                "improvement_over_seed": round(r["weighted_score"] - self._calc_seed_score(seed_sequence, optimization_goals), 4),
                "properties": r.get("properties", {}),
                "seed_sequence": r.get("seed_sequence"),
            })

        processing_time = int((time.time() - start_time) * 1000)
        from datetime import datetime, timezone

        response = OptimizeResponse(
            optimized_peptides=optimized_peptides,
            total=len(optimized_peptides),
            optimization_goals=optimization_goals,
            seed_count=1,
            iterations_performed=iterations,
            generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            processing_time_ms=processing_time,
        )

        self._set_cache(cache_key, response)
        logger.info(f"RL 优化完成 - 返回 {len(optimized_peptides)} 个优化结果，耗时 {processing_time}ms")

        return response

    async def sample_diverse_peptides(
        self,
        sample_size: int = 20,
        temperature: Optional[float] = None,
        top_k: Optional[int] = None,
        diversity_metric: str = "tanimoto",
    ) -> SampleResponse:
        """
        执行探索性采样获取高多样性的肽集合

        Args:
            sample_size: 采样数量
            temperature: 采样温度（越高越随机）
            top_k: top-k 参数
            diversity_metric: 多样性度量方法

        Returns:
            SampleResponse: 多样化的肽集合及多样性指标
        """
        start_time = time.time()

        if sample_size < 1 or sample_size > 100:
            raise ValueError(f"sample_size 应在1-100之间，当前值: {sample_size}")

        logger.info(f"开始探索性采样 - 数量: {sample_size}, 温度: {temperature}, metric: {diversity_metric}")

        cache_key = self._generate_cache_key("sample", sample_size, temperature, top_k)
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached

        if not await self._adapter.initialize():
            raise ServiceUnavailableError("PepINVERT 服务不可用")

        actual_sample_size = min(sample_size, 50)
        raw_results = await self._adapter.sample_peptides(
            num_samples=actual_sample_size * 3,
            temperature=temperature,
            top_k=top_k,
        )

        sequences = [r["sequence"] for r in raw_results]
        diversity = self._adapter.calculate_diversity(sequences, metric=diversity_metric)

        selected_indices = self._select_diverse_subset(
            sequences,
            diversity["similarity_matrix"],
            target_size=actual_sample_size,
        )

        peptides = []
        for idx in selected_indices:
            r = raw_results[idx]
            peptides.append({
                "sequence": r["sequence"],
                "log_probability": r.get("log_probability", 0),
                "smiles": r.get("smiles"),
                "properties": r.get("properties", {}),
                "molecular_weight": r.get("properties", {}).get("molecular_weight", 0),
                "amino_acid_count": len(r.get("sequence", "")),
            })

        final_diversity = self._adapter.calculate_diversity([p["sequence"] for p in peptides], metric=diversity_metric)

        processing_time = int((time.time() - start_time) * 1000)
        from datetime import datetime, timezone

        response = SampleResponse(
            peptides=peptides,
            total=len(peptides),
            diversity_metrics={
                "diversity_score": final_diversity["diversity_score"],
                "unique_count": final_diversity["unique_count"],
                "average_similarity": final_diversity["average_similarity"],
                "similarity_matrix": final_diversity["similarity_matrix"],
            },
            sampling_parameters={
                "requested_size": sample_size,
                "actual_size": len(peptides),
                "temperature": temperature,
                "top_k": top_k,
                "metric": diversity_metric,
            },
            generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            processing_time_ms=processing_time,
        )

        self._set_cache(cache_key, response)
        logger.info(f"探索性采样完成 - 返回 {len(peptides)} 条多样化肽，耗时 {processing_time}ms")

        return response

    def get_service_status(self) -> Dict[str, Any]:
        """
        获取服务状态信息

        Returns:
            服务状态字典
        """
        adapter_status = self._adapter.get_status()
        return {
            "service_name": "PepinventService",
            "version": "1.0.0",
            "adapter_status": adapter_status,
            "cache_stats": {
                "cache_size": len(self._cache),
                "cache_enabled": True,
            },
        }

    def clear_cache(self):
        """清除所有缓存"""
        self._cache.clear()
        logger.info("PepINVERT 服务缓存已清除")

    def _map_effects_to_objectives(self, effects: List[str]) -> Dict[str, float]:
        """
        将业务功效映射到 PepINVERT 目标

        Args:
            effects: 业务功效列表

        Returns:
            目标到权重的映射
        """
        objectives: Dict[str, float] = {}
        effect_counts: Dict[str, int] = {}

        for effect in effects:
            mapped = _EFFECT_MAPPING.get(effect.lower().strip())
            if mapped:
                effect_counts[mapped] = effect_counts.get(mapped, 0) + 1
            else:
                objectives[effect] = objectives.get(effect, 0) + 1.0

        total_mapped = sum(effect_counts.values())
        if total_mapped > 0:
            for obj, count in effect_counts.items():
                objectives[obj] = count / total_mapped

        if not objectives:
            objectives = {"ACE_inhibitory": 0.5, "antioxidant": 0.5}

        total = sum(objectives.values())
        if total > 0:
            objectives = {k: v / total for k, v in objectives.items()}

        return objectives

    def _apply_constraints(
        self,
        results: List[Dict[str, Any]],
        constraints: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """
        应用约束条件过滤结果

        Args:
            results: 原始结果列表
            constraints: 约束条件

        Returns:
            过滤后的结果列表
        """
        filtered = []

        exclude_seqs = set(constraints.get("exclude_sequences", []))
        include_aas = set(constraints.get("include_amino_acids", ""))
        exclude_aas = set(constraints.get("exclude_amino_acids", ""))
        min_len = constraints.get("min_length", 2)
        max_len = constraints.get("max_length", 50)

        for result in results:
            seq = result.get("sequence", "")

            if seq in exclude_seqs:
                continue

            if len(seq) < min_len or len(seq) > max_len:
                continue

            if include_aas and not any(aa in seq for aa in include_aas):
                continue

            if exclude_aas and any(aa in seq for aa in exclude_aas):
                continue

            filtered.append(result)

        return filtered if filtered else results[:5]

    def _score_peptides(
        self,
        results: List[Dict[str, Any]],
        objectives: Dict[str, float],
    ) -> List[Dict[str, Any]]:
        """
        对肽进行多目标评分

        Args:
            results: 肽结果列表
            objectives: 优化目标及权重

        Returns:
            添加了评分的肽列表
        """
        scored = []
        for result in results:
            seq = result.get("sequence", "")
            activity_scores = self._adapter._evaluate_objectives(seq, objectives)

            composite = sum(
                activity_scores.get(obj, 0) * weight
                for obj, weight in objectives.items()
            )

            props = result.get("properties", {})
            diversity_bonus = (1.0 - props.get("logp", 0) / 4.0) * 0.1 if props else 0

            result_copy = dict(result)
            result_copy["activity_scores"] = activity_scores
            result_copy["composite_score"] = round(min(composite + diversity_bonus, 1.0), 4)
            scored.append(result_copy)

        return scored

    def _select_diverse_subset(
        self,
        sequences: List[str],
        similarity_matrix: List[List[float]],
        target_size: int,
    ) -> List[int]:
        """
        使用贪心算法选择最大化多样性的子集

        Args:
            sequences: 序列列表
            similarity_matrix: 相似度矩阵
            target_size: 目标子集大小

        Returns:
            选中的索引列表
        """
        if len(sequences) <= target_size:
            return list(range(len(sequences)))

        selected = [0]
        remaining = set(range(1, len(sequences)))

        while len(selected) < target_size and remaining:
            best_idx = None
            min_avg_sim = float("inf")

            for idx in remaining:
                avg_sim = sum(similarity_matrix[idx][s] for s in selected) / len(selected)
                if avg_sim < min_avg_sim:
                    min_avg_sim = avg_sim
                    best_idx = idx

            if best_idx is not None:
                selected.append(best_idx)
                remaining.remove(best_idx)

        return selected

    def _generate_cache_key(self, *args) -> str:
        """生成缓存键"""
        key_str = str(args)
        return hashlib.md5(key_str.encode()).hexdigest()

    def _get_from_cache(self, key: str) -> Any:
        """从缓存获取数据"""
        import time as _time

        if key in self._cache:
            data, timestamp = self._cache[key]
            if _time.time() - timestamp < self._cache_ttl:
                return data
            else:
                del self._cache[key]
        return None

    def _set_cache(self, key: str, data: Any):
        """设置缓存"""
        import time as _time

        if len(self._cache) < 100:
            self._cache[key] = (data, _time.time())

    def _calc_seed_score(self, sequence: str, objectives: Dict[str, float]) -> float:
        """计算种子序列的基础得分"""
        scores = self._adapter._evaluate_objectives(sequence, objectives)
        return sum(scores.get(obj, 0) * w for obj, w in objectives.items())


_global_service: Optional[PepinventService] = None


def get_pepinvent_service() -> PepinventService:
    """
    获取全局 PepINVERT 服务单例

    Returns:
        PepinventService: 全局服务实例
    """
    global _global_service
    if _global_service is None:
        _global_service = PepinventService()
    return _global_service

"""
自适应求解器选择器 (v1.0)

根据配方问题的特征（原料数量、约束复杂度、目标函数形态）
自动选择最优优化求解器或组合策略。

支持的求解器：
  - GeneticAlgorithm: 遗传算法，适合多目标、非连续搜索空间
  - NSGAIII: 非支配排序遗传算法 III，适合高维多目标优化
  - BayesianOptimizer: 贝叶斯优化，适合黑盒函数、评估成本高
  - SimulatedAnnealing: 模拟退火，适合局部最优 escape
  - GradientDescent: 梯度下降，适合连续可微目标函数

选择逻辑：
  基于问题特征提取 → 分类器映射 → 求解器推荐
  同时提供"组合策略"选项（多求解器协同）
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class SolverType(str, Enum):
    GENETIC = "genetic"
    NSGA3 = "nsga3"
    BAYESIAN = "bayesian"
    SIMULATED_ANNEALING = "simulated_annealing"
    GRADIENT_DESCENT = "gradient_descent"


class StrategyType(str, Enum):
    SINGLE = "single"           # 单一求解器
    ENSEMBLE = "ensemble"       # 多求解器投票
    SEQUENTIAL = "sequential"   # 串联（粗筛→精调）


@dataclass
class ProblemProfile:
    """问题特征画像"""
    num_ingredients: int = 0
    num_constraints: int = 0
    num_objectives: int = 1
    is_discrete: bool = True
    has_nonlinear_constraints: bool = False
    evaluation_cost: str = "low"  # "low" | "medium" | "high"
    time_budget: str = "normal"   # "fast" | "normal" | "thorough"


@dataclass
class SolverRecommendation:
    """求解器推荐结果"""
    recommended_solver: SolverType
    strategy: StrategyType
    confidence: float             # 0.0-1.0
    reasoning: str
    alternative_solvers: List[SolverType] = field(default_factory=list)
    suggested_params: Dict[str, Any] = field(default_factory=dict)


# ── 特征提取器 ──────────────────────────────────────────────────────────

class ProfileExtractor:
    """从用户请求中提取问题特征画像"""

    @staticmethod
    def extract(params: dict) -> ProblemProfile:
        """
        从配方优化参数中提取问题特征

        Args:
            params: 优化器参数，包含 ingredients, constraints, objectives 等

        Returns:
            ProblemProfile: 问题特征画像
        """
        ingredients = params.get("ingredients", [])
        constraints = params.get("constraints", {})
        objectives = params.get("objectives", [])
        is_discrete = params.get("is_discrete", True)
        eval_cost = params.get("evaluation_cost", "low")
        time_budget = params.get("time_budget", "normal")

        # 约束复杂度估算
        num_constraints = len(constraints) if isinstance(constraints, dict) else 0
        has_nonlinear = any(
            c.get("type") == "nonlinear"
            for c in constraints.values()
            if isinstance(c, dict)
        )

        # 目标函数维度
        num_objectives = len(objectives) if isinstance(objectives, list) else 1

        return ProblemProfile(
            num_ingredients=len(ingredients),
            num_constraints=num_constraints,
            num_objectives=max(num_objectives, 1),
            is_discrete=is_discrete,
            has_nonlinear_constraints=has_nonlinear,
            evaluation_cost=eval_cost,
            time_budget=time_budget,
        )


# ── 求解器选择器 ────────────────────────────────────────────────────────

class AutoSolverSelector:
    """
    自适应求解器选择器

    基于规则引擎，根据问题特征自动选择最优求解器。
    规则可根据实际效果持续调优。
    """

    # 求解器推荐规则表
    _RULES: List[Dict[str, Any]] = [
        # 多目标 + 高维度 → NSGA-III
        {
            "condition": lambda p: p.num_objectives >= 3 and p.num_ingredients > 10,
            "solver": SolverType.NSGA3,
            "strategy": StrategyType.SINGLE,
            "confidence": 0.9,
            "reasoning": "多目标（≥3）+ 高维度原料（>10），NSGA-III 擅长 Pareto 前沿搜索",
            "params": {"population_size": 100, "generations": 50},
        },
        # 多目标（2-3）+ 中等规模 → NSGA-III 或 Ensemble
        {
            "condition": lambda p: 2 <= p.num_objectives <= 3 and 5 < p.num_ingredients <= 15,
            "solver": SolverType.NSGA3,
            "strategy": StrategyType.ENSEMBLE,
            "confidence": 0.75,
            "reasoning": "中等规模多目标，推荐 NSGA-III 为主，遗传算法为辅的投票策略",
            "params": {"population_size": 80, "generations": 40},
            "alternatives": [SolverType.GENETIC],
        },
        # 小规模离散 + 高评估成本 → 贝叶斯优化
        {
            "condition": lambda p: p.num_ingredients <= 5 and p.evaluation_cost == "high",
            "solver": SolverType.BAYESIAN,
            "strategy": StrategyType.SINGLE,
            "confidence": 0.85,
            "reasoning": "小规模离散问题 + 高评估成本，贝叶斯优化高效利用每次评估",
            "params": {"max_iterations": 30, "acquisition_function": "EI"},
        },
        # 大规模离散 → 遗传算法
        {
            "condition": lambda p: p.num_ingredients > 15 and p.is_discrete,
            "solver": SolverType.GENETIC,
            "strategy": StrategyType.SINGLE,
            "confidence": 0.8,
            "reasoning": "大规模离散搜索空间，遗传算法具有良好的全局探索能力",
            "params": {"population_size": 100, "generations": 50},
        },
        # 小规模连续 + 有梯度信息 → 梯度下降
        {
            "condition": lambda p: p.num_ingredients <= 8 and not p.is_discrete and p.num_objectives == 1,
            "solver": SolverType.GRADIENT_DESCENT,
            "strategy": StrategyType.SINGLE,
            "confidence": 0.7,
            "reasoning": "小规模连续单目标问题，梯度下降可快速收敛到局部最优",
            "params": {"max_iter": 100, "lr": 0.01},
        },
        # 高约束复杂度 → 模拟退火（逃逸局部最优）
        {
            "condition": lambda p: p.num_constraints >= 5 or p.has_nonlinear_constraints,
            "solver": SolverType.SIMULATED_ANNEALING,
            "strategy": StrategyType.SEQUENTIAL,
            "confidence": 0.65,
            "reasoning": "高约束复杂度，模拟退火可逃逸局部最优，建议配合遗传算法串联",
            "params": {"initial_temp": 100, "cooling_rate": 0.95, "iterations": 1000},
            "alternatives": [SolverType.GENETIC],
        },
        # 默认：遗传算法
        {
            "condition": lambda p: True,
            "solver": SolverType.GENETIC,
            "strategy": StrategyType.SINGLE,
            "confidence": 0.5,
            "reasoning": "默认策略：遗传算法，适用于大多数配方优化场景",
            "params": {"population_size": 50, "generations": 30},
        },
    ]

    def select(
        self,
        params: dict,
        custom_rules: List[Dict[str, Any]] | None = None,
    ) -> SolverRecommendation:
        """
        根据问题特征自动选择求解器

        Args:
            params: 优化器参数
            custom_rules: 可选，自定义规则覆盖默认规则

        Returns:
            SolverRecommendation: 推荐结果
        """
        profile = ProfileExtractor.extract(params)
        rules = custom_rules or self._RULES

        for rule in rules:
            if rule["condition"](profile):
                rec = SolverRecommendation(
                    recommended_solver=rule["solver"],
                    strategy=rule.get("strategy", StrategyType.SINGLE),
                    confidence=rule.get("confidence", 0.5),
                    reasoning=rule["reasoning"],
                    alternative_solvers=rule.get("alternatives", []),
                    suggested_params=rule.get("params", {}),
                )
                logger.info(
                    "[AutoSolver] 选择求解器: %s (置信度=%.2f) | 原因: %s",
                    rec.recommended_solver.value, rec.confidence, rec.reasoning,
                )
                return rec

        # 兜底
        return SolverRecommendation(
            recommended_solver=SolverType.GENETIC,
            strategy=StrategyType.SINGLE,
            confidence=0.3,
            reasoning="未匹配任何规则，使用默认遗传算法",
        )

    def get_profile(self, params: dict) -> ProblemProfile:
        """获取问题特征画像（用于调试和可视化）"""
        return ProfileExtractor.extract(params)


# ── 全局单例 ────────────────────────────────────────────────────────────

_selector: Optional[AutoSolverSelector] = None


def get_solver_selector() -> AutoSolverSelector:
    """获取全局 AutoSolverSelector 单例"""
    global _selector
    if _selector is None:
        _selector = AutoSolverSelector()
    return _selector


def select_solver(params: dict) -> SolverRecommendation:
    """快捷选择求解器"""
    return get_solver_selector().select(params)

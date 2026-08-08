"""
NSGA-II 多目标遗传算法配方优化引擎 (入口模块)

基于 Deb et al. (2002) 的 NSGA-II 算法实现多目标 Pareto 前沿求解。

拆分后的模块:
- models.py: 数据类 (OptimizationObjective, OptimizationConfig, MultiObjectiveIndividual, MOGAResult)
- evaluator.py: 配方多维质量评估器 (FormulaEvaluator)
- algorithm.py: NSGA-II 算法核心 (NSGAIIOptimizer)
- presets.py: 预设优化场景配置
"""
from __future__ import annotations

from .models import (
    OptimizationObjective,
    OptimizationConfig,
    MultiObjectiveIndividual,
    MOGAResult,
)
from .evaluator import FormulaEvaluator
from .algorithm import NSGAIIOptimizer
from .presets import get_preset_scenario, PRESET_SCENARIOS

# 模块级单例
_nsga2_optimizer: NSGAIIOptimizer | None = None


def get_nsga2_optimizer() -> NSGAIIOptimizer:
    """获取 NSGA-II 优化器单例"""
    global _nsga2_optimizer
    if _nsga2_optimizer is None:
        _nsga2_optimizer = NSGAIIOptimizer()
    return _nsga2_optimizer


__all__ = [
    "OptimizationObjective",
    "OptimizationConfig",
    "MultiObjectiveIndividual",
    "MOGAResult",
    "FormulaEvaluator",
    "NSGAIIOptimizer",
    "get_nsga2_optimizer",
    "get_preset_scenario",
    "PRESET_SCENARIOS",
]

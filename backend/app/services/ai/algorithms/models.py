"""
NSGA-II 多目标优化 — 数据模型

包含：
- OptimizationObjective: 单个优化目标定义
- OptimizationConfig: 多目标优化配置
- MultiObjectiveIndividual: 配方候选个体
- MOGAResult: 优化结果包装
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

# ════════════════════════════════════════════
# 数据类定义
# ════════════════════════════════════════════

@dataclass
class OptimizationObjective:
    """单个优化目标定义"""
    name: str                    # 目标名称（中文），如"功效最大化"
    key: str                     # 唯一标识符，如 "efficacy"
    direction: str              # "maximize" 或 "minimize"
    weight: float = 1.0         # 权重(0~1)，用于加权聚合模式
    description: str = ""       # 描述


@dataclass
class OptimizationConfig:
    """多目标优化配置"""
    objectives: List[OptimizationObjective]  # 优化目标列表(2~6个)
    mode: str = "pareto"                      # "pareto"(NSGA-II) | "weighted"(加权聚合) | "epsilon"(ε-约束法)
    population_size: int = 60
    generations: int = 50
    mutation_rate: float = 0.15
    crossover_rate: float = 0.85
    elite_ratio: float = 0.1
    tournament_size: int = 5
    # 约束条件
    constraints: Optional[Dict[str, Any]] = None
    min_ingredients: int = 3
    max_ingredients: int = 12
    total_dosage_range: Tuple[float, float] = (15.0, 100.0)
    early_stop_patience: int = 20
    early_stop_threshold: float = 0.0
    adaptive_mutation: bool = True
    pareto_front_size: int = 20
    candidate_count: int = 10
    description: str = ""
    seed: Optional[int] = None

    def __post_init__(self):
        assert 2 <= len(self.objectives) <= 8, f"目标数量应在 [2, 8]，当前: {len(self.objectives)}"
        assert self.mode in ("pareto", "weighted", "epsilon"), f"未知模式: {self.mode}"
        for obj in self.objectives:
            assert obj.direction in ("maximize", "minimize"), f"目标 {obj.key} direction 无效"
            assert 0.0 < obj.weight <= 1.0, f"目标 {obj.key} weight 无效: {obj.weight}"
        assert 1 <= self.min_ingredients <= self.max_ingredients, \
            f"min_ingredients({self.min_ingredients}) 必须 <= max_ingredients({self.max_ingredients})"
        assert self.total_dosage_range[0] < self.total_dosage_range[1], \
            "total_dosage_range 下限必须 < 上限"


# ════════════════════════════════════════════
# 多目标个体
# ════════════════════════════════════════════

class MultiObjectiveIndividual:
    """多目标个体 — 一个完整的配方候选方案"""

    def __init__(self, genes: Dict[str, float]):
        self.genes = dict(genes)
        self.objectives: Dict[str, float] = {}
        self.rank: int = 0
        self.crowding_distance: float = 0.0
        self.fitness: float = 0.0
        self.efficacy: float = 0.0
        self.safety: float = 0.0
        self.taste: float = 0.0
        self.cost_score: float = 0.0
        self.synergy: float = 0.0
        self.stability: float = 0.0
        self.admet: float = 0.0
        self.domination_count: int = 0
        self.dominated_set: List = []

    def copy(self) -> 'MultiObjectiveIndividual':
        """深拷贝"""
        new_ind = MultiObjectiveIndividual(dict(self.genes))
        new_ind.objectives = dict(self.objectives)
        new_ind.rank = self.rank
        new_ind.crowding_distance = self.crowding_distance
        new_ind.fitness = self.fitness
        new_ind.efficacy = self.efficacy
        new_ind.safety = self.safety
        new_ind.taste = self.taste
        new_ind.cost_score = self.cost_score
        new_ind.synergy = self.synergy
        new_ind.stability = self.stability
        new_ind.admet = self.admet
        return new_ind

    def __repr__(self) -> str:
        herbs = list(self.genes.keys())[:5]
        extra = f"...+{len(self.genes)-5}" if len(self.genes) > 5 else ""
        return (f"<MOInd rank={self.rank} fit={self.fitness:.4f} "
                f"herbs={herbs}{extra}>")


# ════════════════════════════════════════════
# 结果数据类
# ════════════════════════════════════════════

@dataclass
class MOGAResult:
    """多目标优化结果"""
    candidates: List[MultiObjectiveIndividual]
    pareto_front: List[Dict] = field(default_factory=list)
    history: List[Dict] = field(default_factory=list)
    algorithm: str = "nsga2_genetic_algorithm"
    mode: str = "pareto"
    total_generations: int = 0
    total_evaluations: int = 0
    best_by_objective: Dict[str, Dict] = field(default_factory=dict)
    execution_time_ms: float = 0.0
    convergence_generation: int = 0
    stop_reason: str = "completed"
    objectives_config: List[Dict] = field(default_factory=list)

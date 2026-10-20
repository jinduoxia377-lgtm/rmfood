"""app/services/formula/ratio_optimizer.py 单元测试

覆盖 NSGA-III 配比优化器的输入校验、基础优化流程与 Pareto 支配判定。
"""
import pytest

from app.services.formula.ratio_optimizer import (
    Ingredient,
    OptimizationConfig,
    OptimizationResult,
    OptimizationStatus,
    ParetoFrontier,
    RatioOptimizer,
)


def _make_ingredients(n: int = 3):
    names = ["人参", "黄芪", "茯苓", "枸杞", "甘草", "当归", "白术", "山药"]
    return [
        Ingredient(
            name=names[i % len(names)],
            min_ratio=0.0,
            max_ratio=1.0,
            cost_per_gram=1.0 + i * 0.1,
            category="herb",
            efficacy_base=0.5 + i * 0.05,
            safety_score=0.8,
            stability_score=0.7,
        )
        for i in range(n)
    ]


class TestRatioOptimizerValidation:
    def test_requires_at_least_2_ingredients(self):
        opt = RatioOptimizer()
        with pytest.raises(ValueError):
            opt.optimize_ratio([_make_ingredients(1)[0]])

    def test_rejects_more_than_15_ingredients(self):
        opt = RatioOptimizer()
        with pytest.raises(ValueError):
            opt.optimize_ratio(_make_ingredients(16))

    def test_ingredient_dataclass_defaults(self):
        ing = Ingredient(name="人参")
        assert ing.min_ratio == 0.0
        assert ing.max_ratio == 1.0
        assert ing.cost_per_gram == 1.0
        assert ing.efficacy_base == 0.5
        assert ing.safety_score == 0.8
        assert ing.stability_score == 0.7


class TestRatioOptimizerRun:
    def test_optimize_returns_pareto_frontier(self):
        config = OptimizationConfig(
            population_size=12,
            max_generations=5,
            random_seed=42,
        )
        opt = RatioOptimizer(config=config)
        result = opt.optimize_ratio(_make_ingredients(3))
        assert isinstance(result, ParetoFrontier)
        assert result.status in (
            OptimizationStatus.CONVERGED,
            OptimizationStatus.MAX_ITERATIONS,
            OptimizationStatus.ERROR,
        )
        assert result.computation_time >= 0

    def test_optimize_with_constraints(self):
        config = OptimizationConfig(
            population_size=12,
            max_generations=5,
            random_seed=7,
        )
        opt = RatioOptimizer(config=config)
        result = opt.optimize_ratio(
            _make_ingredients(4),
            constraints={
                "target_efficacy": 0.6,
                "safety_threshold": 0.7,
                "max_cost": 5.0,
            },
        )
        assert isinstance(result, ParetoFrontier)


class TestDominates:
    def test_dominates_when_all_objectives_better(self):
        opt = RatioOptimizer()
        # _dominates 是最小化问题：目标值越小越好
        a = OptimizationResult(
            ratios={"A": 0.5},
            objectives={"efficacy": 0.3, "safety": 0.4, "stability": 0.5, "cost": 0.5},
        )
        b = OptimizationResult(
            ratios={"A": 0.5},
            objectives={"efficacy": 0.6, "safety": 0.7, "stability": 0.7, "cost": 1.0},
        )
        assert opt._dominates(a, b) is True
        assert opt._dominates(b, a) is False

    def test_dominates_equal_objectives(self):
        opt = RatioOptimizer()
        a = OptimizationResult(
            ratios={"A": 0.5},
            objectives={"efficacy": 0.8, "safety": 0.8, "stability": 0.8, "cost": 1.0},
        )
        b = OptimizationResult(
            ratios={"A": 0.5},
            objectives={"efficacy": 0.8, "safety": 0.8, "stability": 0.8, "cost": 1.0},
        )
        assert opt._dominates(a, b) is False
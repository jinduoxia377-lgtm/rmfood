"""
Unit tests for the optimization algorithms.

Tests cover:
- AdaptiveLearningRate: all 3 decay types, min_lr enforcement, scale_lr
- SimulatedAnnealingOptimizer: get_neighbor, optimize convergence, _accept, _cool

Uses random.seed(42) for reproducibility where needed.
"""
import random

import numpy as np
import pytest

from app.services.ai_models.gradient_descent_optimizer import AdaptiveLearningRate
from app.services.ai_models.simulated_annealing import (
    SimulatedAnnealingOptimizer,
    CoolingStrategy,
    NeighborhoodOperation,
)


# ════════════════════════════════════════════════════════════════
# AdaptiveLearningRate Tests
# ════════════════════════════════════════════════════════════════


class TestAdaptiveLearningRateExponential:
    """Tests for exponential decay type."""

    def test_exponential_decay_decreasing(self):
        lr_scheduler = AdaptiveLearningRate(
            initial_lr=0.1,
            decay_type="exponential",
            decay_rate=0.95,
            min_lr=1e-6,
        )
        lrs = [lr_scheduler.get_lr(i) for i in range(20)]
        for i in range(1, len(lrs)):
            assert lrs[i] <= lrs[i - 1], (
                f"LR at iter {i} ({lrs[i]}) should be <= LR at iter {i-1} ({lrs[i-1]})"
            )

    def test_exponential_formula_correctness(self):
        initial_lr = 0.1
        decay_rate = 0.95
        lr_scheduler = AdaptiveLearningRate(
            initial_lr=initial_lr,
            decay_type="exponential",
            decay_rate=decay_rate,
            min_lr=1e-10,
        )
        for iteration in [0, 5, 10, 20]:
            expected = initial_lr * (decay_rate ** iteration)
            actual = lr_scheduler.get_lr(iteration)
            assert actual == pytest.approx(expected, rel=1e-6), (
                f"Iteration {iteration}: expected {expected}, got {actual}"
            )

    def test_exponential_min_lr_enforcement(self):
        lr_scheduler = AdaptiveLearningRate(
            initial_lr=0.1,
            decay_type="exponential",
            decay_rate=0.5,
            min_lr=0.001,
        )
        # At iteration 10: 0.1 * 0.5^10 = 0.0000977, below min_lr=0.001
        lr = lr_scheduler.get_lr(10)
        assert lr >= 0.001

    def test_exponential_iteration_0_returns_initial_lr(self):
        lr_scheduler = AdaptiveLearningRate(
            initial_lr=0.05,
            decay_type="exponential",
            decay_rate=0.9,
            min_lr=1e-6,
        )
        lr = lr_scheduler.get_lr(0)
        assert lr == pytest.approx(0.05, rel=1e-6)


class TestAdaptiveLearningRateCosine:
    """Tests for cosine annealing decay type."""

    def test_cosine_decay_decreasing_trend(self):
        lr_scheduler = AdaptiveLearningRate(
            initial_lr=0.1,
            decay_type="cosine",
            decay_rate=0.95,
            min_lr=1e-6,
        )
        # Cosine should start near initial_lr and trend toward min_lr
        lr_0 = lr_scheduler.get_lr(0)
        lr_100 = lr_scheduler.get_lr(100)
        assert lr_0 >= lr_100

    def test_cosine_formula_correctness(self):
        initial_lr = 0.1
        min_lr = 1e-6
        lr_scheduler = AdaptiveLearningRate(
            initial_lr=initial_lr,
            decay_type="cosine",
            min_lr=min_lr,
        )
        for iteration in [0, 5, 10, 50]:
            expected = min_lr + (initial_lr - min_lr) * (
                1 + np.cos(np.pi * iteration / (iteration + 1))
            ) / 2
            actual = lr_scheduler.get_lr(iteration)
            assert actual == pytest.approx(expected, rel=1e-6), (
                f"Iteration {iteration}: expected {expected}, got {actual}"
            )

    def test_cosine_stays_above_min_lr(self):
        lr_scheduler = AdaptiveLearningRate(
            initial_lr=0.1,
            decay_type="cosine",
            min_lr=0.005,
        )
        for i in range(200):
            lr = lr_scheduler.get_lr(i)
            assert lr >= 0.005

    def test_cosine_iteration_0_value(self):
        initial_lr = 0.1
        min_lr = 1e-6
        lr_scheduler = AdaptiveLearningRate(
            initial_lr=initial_lr,
            decay_type="cosine",
            min_lr=min_lr,
        )
        lr_0 = lr_scheduler.get_lr(0)
        # cos(0) = 1, so lr = min_lr + (initial_lr - min_lr) * (1+1)/2 = initial_lr
        assert lr_0 == pytest.approx(initial_lr, rel=1e-3)


class TestAdaptiveLearningRateStep:
    """Tests for step decay type."""

    def test_step_decay_decreasing_in_steps(self):
        lr_scheduler = AdaptiveLearningRate(
            initial_lr=0.1,
            decay_type="step",
            decay_rate=0.5,
            min_lr=1e-6,
            step_size=10,
        )
        lrs = [lr_scheduler.get_lr(i) for i in range(30)]
        # LR should stay constant within a step, then drop
        assert lrs[0] == pytest.approx(lrs[9], rel=1e-6)  # within first step
        assert lrs[10] < lrs[9]  # drop at step boundary

    def test_step_formula_correctness(self):
        initial_lr = 0.1
        decay_rate = 0.5
        step_size = 10
        lr_scheduler = AdaptiveLearningRate(
            initial_lr=initial_lr,
            decay_type="step",
            decay_rate=decay_rate,
            min_lr=1e-10,
            step_size=step_size,
        )
        for iteration in [0, 10, 20]:
            expected = initial_lr * (decay_rate ** (iteration // step_size))
            actual = lr_scheduler.get_lr(iteration)
            assert actual == pytest.approx(expected, rel=1e-6)

    def test_step_stays_constant_within_step(self):
        lr_scheduler = AdaptiveLearningRate(
            initial_lr=0.1,
            decay_type="step",
            decay_rate=0.5,
            min_lr=1e-10,
            step_size=5,
        )
        base_lr = lr_scheduler.get_lr(0)
        for i in range(1, 5):
            assert lr_scheduler.get_lr(i) == pytest.approx(base_lr, rel=1e-6)


class TestAdaptiveLearningRateScaleLR:
    """Tests for the scale_lr method."""

    def test_scale_lr_reduces_current_lr(self):
        lr_scheduler = AdaptiveLearningRate(
            initial_lr=0.1,
            decay_type="exponential",
            decay_rate=0.95,
            min_lr=1e-6,
        )
        lr_before = lr_scheduler.get_lr(0)
        lr_scheduler.scale_lr(0.5)
        lr_after = lr_scheduler.current_lr
        assert lr_after < lr_before

    def test_scale_lr_respects_min_lr(self):
        lr_scheduler = AdaptiveLearningRate(
            initial_lr=0.01,
            decay_type="exponential",
            decay_rate=0.95,
            min_lr=0.005,
        )
        lr_scheduler.scale_lr(0.001)  # very aggressive scale
        assert lr_scheduler.current_lr >= 0.005

    def test_scale_lr_multiplicative(self):
        lr_scheduler = AdaptiveLearningRate(
            initial_lr=0.1,
            decay_type="exponential",
            decay_rate=0.95,
            min_lr=1e-10,
        )
        lr_scheduler.get_lr(0)  # sets current_lr
        lr_before = lr_scheduler.current_lr
        lr_scheduler.scale_lr(0.8)
        expected = max(lr_before * 0.8, lr_scheduler.min_lr)
        assert lr_scheduler.current_lr == pytest.approx(expected, rel=1e-6)

    def test_scale_lr_affects_future_get_lr(self):
        lr_scheduler = AdaptiveLearningRate(
            initial_lr=0.1,
            decay_type="exponential",
            decay_rate=0.95,
            min_lr=1e-10,
        )
        lr_normal = lr_scheduler.get_lr(5)
        lr_scheduler.scale_lr(0.5)
        lr_scaled = lr_scheduler.get_lr(5)
        # After scaling, the internal _scale_factor changed, so future calls differ
        assert lr_scaled < lr_normal


class TestAdaptiveLearningRateEdgeCases:
    """Edge case tests for AdaptiveLearningRate."""

    def test_unknown_decay_type_returns_initial_lr(self):
        lr_scheduler = AdaptiveLearningRate(
            initial_lr=0.1,
            decay_type="unknown_type",
            decay_rate=0.95,
            min_lr=1e-6,
        )
        lr = lr_scheduler.get_lr(10)
        assert lr == pytest.approx(0.1, rel=1e-6)

    def test_min_lr_equals_initial_lr(self):
        lr_scheduler = AdaptiveLearningRate(
            initial_lr=0.01,
            decay_type="exponential",
            decay_rate=0.5,
            min_lr=0.01,
        )
        for i in range(20):
            lr = lr_scheduler.get_lr(i)
            assert lr >= 0.01


# ════════════════════════════════════════════════════════════════
# SimulatedAnnealingOptimizer Tests
# ════════════════════════════════════════════════════════════════


class TestSimulatedAnnealingGetNeighbor:
    """Tests for SimulatedAnnealingOptimizer.get_neighbor()"""

    @pytest.fixture
    def optimizer(self):
        return SimulatedAnnealingOptimizer(
            initial_temperature=100.0,
            cooling_rate=0.95,
            min_temperature=1.0,
            max_iterations=10,
        )

    @pytest.fixture
    def sample_formula(self):
        return {
            "ingredients": [
                {"name": "黄芪", "dosage": 10.0, "unit": "g"},
                {"name": "党参", "dosage": 8.0, "unit": "g"},
                {"name": "茯苓", "dosage": 6.0, "unit": "g"},
                {"name": "白术", "dosage": 7.0, "unit": "g"},
            ]
        }

    def test_neighbor_is_valid_dict(self, optimizer, sample_formula):
        random.seed(42)
        neighbor = optimizer.get_neighbor(sample_formula)
        assert isinstance(neighbor, dict)
        assert "ingredients" in neighbor

    def test_neighbor_ingredients_list(self, optimizer, sample_formula):
        random.seed(42)
        neighbor = optimizer.get_neighbor(sample_formula)
        assert isinstance(neighbor["ingredients"], list)
        assert len(neighbor["ingredients"]) > 0

    def test_neighbor_does_not_mutate_original(self, optimizer, sample_formula):
        random.seed(42)
        original_names = [i["name"] for i in sample_formula["ingredients"]]
        optimizer.get_neighbor(sample_formula)
        current_names = [i["name"] for i in sample_formula["ingredients"]]
        assert original_names == current_names

    def test_get_neighbor_empty_ingredients_adds_one(self, optimizer):
        random.seed(42)
        empty_formula = {"ingredients": []}
        neighbor = optimizer.get_neighbor(empty_formula)
        assert len(neighbor["ingredients"]) >= 1

    def test_perturb_dosage_changes_dosage(self, optimizer, sample_formula):
        random.seed(42)
        # Run multiple times to hit PERTURB_DOSAGE at least once
        original_dosages = [i["dosage"] for i in sample_formula["ingredients"]]
        found_change = False
        for _ in range(50):
            neighbor = optimizer.get_neighbor(sample_formula)
            new_dosages = [i["dosage"] for i in neighbor["ingredients"]]
            if new_dosages != original_dosages:
                found_change = True
                break
        assert found_change, "PERTURB_DOSAGE should change at least one dosage"

    def test_neighbor_ingredient_names_in_pool(self, optimizer, sample_formula):
        random.seed(42)
        # 当前实现使用 _herb_db（来自 bayesian_formula_optimizer 的知识库），
        # 旧属性 herbs_pool 已移除
        herb_names = {hp.name_cn for hp in (optimizer._herb_db or {}).values()}
        for _ in range(20):
            neighbor = optimizer.get_neighbor(sample_formula)
            for ing in neighbor["ingredients"]:
                assert ing["name"] in herb_names


class TestSimulatedAnnealingAccept:
    """Tests for SimulatedAnnealingOptimizer._accept()"""

    @pytest.fixture
    def optimizer(self):
        opt = SimulatedAnnealingOptimizer(
            initial_temperature=1000.0,
            cooling_rate=0.95,
            min_temperature=1.0,
        )
        opt.T = 1000.0
        return opt

    def test_accept_positive_delta_always(self, optimizer):
        """Improvements (delta > 0) should always be accepted."""
        random.seed(42)
        for _ in range(100):
            assert optimizer._accept(1.0) is True

    def test_accept_negative_delta_sometimes(self, optimizer):
        """At high temperature, negative deltas should sometimes be accepted."""
        random.seed(42)
        optimizer.T = 1000.0
        accepted_count = sum(optimizer._accept(-10.0) for _ in range(1000))
        # At T=1000, delta=-10: P = exp(-10/1000) = exp(-0.01) ~ 0.99
        assert accepted_count > 500, (
            f"Expected many acceptances at high T, got {accepted_count}"
        )

    def test_accept_negative_delta_rare_at_low_temp(self, optimizer):
        """At very low temperature, negative deltas should rarely be accepted."""
        random.seed(42)
        optimizer.T = 0.01
        accepted_count = sum(optimizer._accept(-10.0) for _ in range(1000))
        # At T=0.01, delta=-10: P = exp(-1000) ~ 0
        assert accepted_count < 5, (
            f"Expected nearly zero acceptances at low T, got {accepted_count}"
        )

    def test_accept_zero_temperature_rejects_negative(self, optimizer):
        optimizer.T = 0.0
        random.seed(42)
        for _ in range(100):
            assert optimizer._accept(-1.0) is False


class TestSimulatedAnnealingCool:
    """Tests for SimulatedAnnealingOptimizer._cool()"""

    def test_exponential_cooling_reduces_temperature(self):
        opt = SimulatedAnnealingOptimizer(
            initial_temperature=1000.0,
            cooling_rate=0.99,
            cooling_strategy=CoolingStrategy.EXPONENTIAL,
        )
        initial_t = opt.T
        opt._cool()
        assert opt.T < initial_t
        assert opt.T == pytest.approx(initial_t * 0.99, rel=1e-6)

    def test_linear_cooling_reduces_temperature(self):
        opt = SimulatedAnnealingOptimizer(
            initial_temperature=100.0,
            cooling_rate=5.0,
            min_temperature=1.0,
            cooling_strategy=CoolingStrategy.LINEAR,
        )
        initial_t = opt.T
        opt._cool()
        assert opt.T < initial_t

    def test_linear_cooling_respects_min_temperature(self):
        opt = SimulatedAnnealingOptimizer(
            initial_temperature=3.0,
            cooling_rate=10.0,
            min_temperature=1.0,
            cooling_strategy=CoolingStrategy.LINEAR,
        )
        opt._cool()
        assert opt.T >= 1.0

    def test_adaptive_cooling_respects_min_temperature(self):
        opt = SimulatedAnnealingOptimizer(
            initial_temperature=1.5,
            cooling_rate=0.99,
            min_temperature=1.0,
            cooling_strategy=CoolingStrategy.ADAPTIVE,
        )
        opt._cool()
        assert opt.T >= 1.0


class TestSimulatedAnnealingOptimize:
    """Integration tests for SimulatedAnnealingOptimizer.optimize()"""

    @pytest.fixture
    def sample_formula(self):
        return {
            "ingredients": [
                {"name": "黄芪", "dosage": 10.0, "unit": "g"},
                {"name": "党参", "dosage": 8.0, "unit": "g"},
                {"name": "茯苓", "dosage": 6.0, "unit": "g"},
            ]
        }

    def simple_objective(self, formula):
        """Simple objective: maximize sum of dosages (capped)."""
        total = sum(i.get("dosage", 0) for i in formula.get("ingredients", []))
        return -abs(total - 30)  # target total = 30

    def test_optimize_returns_best_solution(self, sample_formula):
        random.seed(42)
        opt = SimulatedAnnealingOptimizer(
            initial_temperature=100.0,
            cooling_rate=0.9,
            min_temperature=1.0,
            max_iterations=5,
        )
        result = opt.optimize(sample_formula, self.simple_objective)
        assert isinstance(result, dict)
        assert "ingredients" in result

    def test_optimize_tracks_best_score(self, sample_formula):
        random.seed(42)
        opt = SimulatedAnnealingOptimizer(
            initial_temperature=100.0,
            cooling_rate=0.9,
            min_temperature=1.0,
            max_iterations=5,
        )
        opt.optimize(sample_formula, self.simple_objective)
        assert opt.best_score > float('-inf')

    def test_optimize_records_iteration_history(self, sample_formula):
        random.seed(42)
        opt = SimulatedAnnealingOptimizer(
            initial_temperature=100.0,
            cooling_rate=0.9,
            min_temperature=1.0,
            max_iterations=5,
        )
        opt.optimize(sample_formula, self.simple_objective)
        assert len(opt.iteration_history) > 0
        for entry in opt.iteration_history:
            assert "temperature" in entry
            assert "iteration" in entry
            assert "current_score" in entry
            assert "best_score" in entry

    def test_optimize_temperature_decreases(self, sample_formula):
        random.seed(42)
        opt = SimulatedAnnealingOptimizer(
            initial_temperature=100.0,
            cooling_rate=0.5,
            min_temperature=1.0,
            max_iterations=5,
        )
        opt.optimize(sample_formula, self.simple_objective)
        # Temperature should have decreased from initial
        assert opt.T < 100.0

    def test_optimize_with_reproducible_seed(self, sample_formula):
        """Same seed should produce same result."""
        random.seed(42)
        opt1 = SimulatedAnnealingOptimizer(
            initial_temperature=50.0,
            cooling_rate=0.9,
            min_temperature=1.0,
            max_iterations=5,
        )
        opt1.optimize(sample_formula, self.simple_objective)

        random.seed(42)
        opt2 = SimulatedAnnealingOptimizer(
            initial_temperature=50.0,
            cooling_rate=0.9,
            min_temperature=1.0,
            max_iterations=5,
        )
        opt2.optimize(sample_formula, self.simple_objective)

        # With same seed, best_score should be identical
        assert opt1.best_score == pytest.approx(opt2.best_score, rel=1e-10)

    def test_optimize_convergence_simple_function(self):
        """Test convergence on a trivially easy objective."""
        random.seed(42)
        formula = {
            "ingredients": [
                {"name": "黄芪", "dosage": 5.0, "unit": "g"},
                {"name": "党参", "dosage": 5.0, "unit": "g"},
            ]
        }

        def target_10(formula):
            total = sum(i.get("dosage", 0) for i in formula.get("ingredients", []))
            return -abs(total - 10)  # target=10, initial=10, so already optimal

        opt = SimulatedAnnealingOptimizer(
            initial_temperature=10.0,
            cooling_rate=0.5,
            min_temperature=0.5,
            max_iterations=20,
        )
        opt.optimize(formula, target_10)
        # Since initial is already at target, best_score should be 0 or very close
        assert opt.best_score >= -1.0

    def test_optimize_with_callback(self, sample_formula):
        random.seed(42)
        callback_calls = []

        def callback(solution, score, iteration):
            callback_calls.append((score, iteration))

        opt = SimulatedAnnealingOptimizer(
            initial_temperature=100.0,
            cooling_rate=0.9,
            min_temperature=1.0,
            max_iterations=200,  # enough for callback to fire at iter 0, 100
        )
        opt.optimize(sample_formula, self.simple_objective, callback=callback)
        assert len(callback_calls) > 0

    def test_optimize_with_constraints(self, sample_formula):
        random.seed(42)
        constraints = {
            "max_ingredients": 5,
            "min_ingredients": 2,
            "min_dosage": 1.0,
            "max_dosage": 50.0,
        }
        opt = SimulatedAnnealingOptimizer(
            initial_temperature=50.0,
            cooling_rate=0.9,
            min_temperature=1.0,
            max_iterations=5,
        )
        result = opt.optimize(
            sample_formula,
            self.simple_objective,
            constraints=constraints,
        )
        # Result should still be valid
        assert "ingredients" in result
        assert len(result["ingredients"]) >= 2
        assert len(result["ingredients"]) <= 5


class TestSimulatedAnnealingReset:
    """Tests for the reset() method."""

    def test_reset_restores_initial_state(self):
        opt = SimulatedAnnealingOptimizer(
            initial_temperature=1000.0,
        )
        opt.T = 50.0
        opt.best_score = 999.0
        opt.iteration_history = [{"temperature": 50.0}]
        opt.reset()
        assert opt.T == 1000.0
        assert opt.best_score == float('-inf')
        assert opt.best_solution is None
        assert opt.iteration_history == []


class TestCoolingStrategyEnum:
    """Tests for CoolingStrategy enum values."""

    def test_exponential_value(self):
        assert CoolingStrategy.EXPONENTIAL.value == "exponential"

    def test_linear_value(self):
        assert CoolingStrategy.LINEAR.value == "linear"

    def test_adaptive_value(self):
        assert CoolingStrategy.ADAPTIVE.value == "adaptive"


class TestNeighborhoodOperationEnum:
    """Tests for NeighborhoodOperation enum values."""

    def test_perturb_dosage_value(self):
        assert NeighborhoodOperation.PERTURB_DOSAGE.value == "perturb_dosage"

    def test_replace_ingredient_value(self):
        assert NeighborhoodOperation.REPLACE_INGREDIENT.value == "replace_ingredient"

    def test_add_ingredient_value(self):
        assert NeighborhoodOperation.ADD_INGREDIENT.value == "add_ingredient"

    def test_remove_ingredient_value(self):
        assert NeighborhoodOperation.REMOVE_INGREDIENT.value == "remove_ingredient"

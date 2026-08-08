"""Tests for RLFormulaTuner

Tests cover:
- Reward computation
- Baseline update
- Training step
- Stats retrieval
"""

import pytest

from app.services.ai.models.rl_tuner import RLFormulaTuner, RewardWeights, TrainingRecord


class TestTunerInit:
    """Test tuner initialization."""

    def test_default_init(self):
        tuner = RLFormulaTuner()
        assert tuner.baseline == 0.5
        assert tuner.lr == 1e-3

    def test_custom_reward_weights(self):
        weights = RewardWeights(
            predictor_efficacy=0.4,
            predictor_safety=0.3,
            discriminator_novelty=0.2,
        )
        tuner = RLFormulaTuner(reward_weights=weights)
        assert tuner.reward_weights.predictor_efficacy == 0.4


class TestRewardComputation:
    """Test reward computation."""

    def test_compute_reward_basic(self):
        tuner = RLFormulaTuner()
        formula = {"hq": 10.0, "ds": 8.0}
        rewards = tuner.compute_reward(formula)

        assert "total" in rewards
        assert "predictor_efficacy" in rewards
        assert "safety_penalty" in rewards

    def test_compute_reward_with_predictor(self):
        tuner = RLFormulaTuner()

        class MockPredictor:
            efficacy = 0.8
            safety = 0.9
            taste = 0.7

        formula = {"hq": 10.0}
        rewards = tuner.compute_reward(
            formula,
            predictor_result=MockPredictor(),
        )

        assert rewards["predictor_efficacy"] == 0.8
        assert rewards["predictor_safety"] == 0.9

    def test_compute_reward_with_discriminator(self):
        tuner = RLFormulaTuner()

        class MockDiscriminator:
            is_real = 0.3  # Low real probability = high novelty

        formula = {"hq": 10.0}
        rewards = tuner.compute_reward(
            formula,
            discriminator_result=MockDiscriminator(),
        )

        assert rewards["discriminator_novelty"] == 0.7  # 1 - 0.3

    def test_compute_reward_with_template(self):
        tuner = RLFormulaTuner()
        formula = {"hq": 10.0}
        rewards = tuner.compute_reward(
            formula,
            template_match=0.9,
        )
        assert rewards["template_bonus"] == 0.9

    def test_compute_reward_with_safety_penalty(self):
        tuner = RLFormulaTuner()
        formula = {"hq": 10.0}
        rewards = tuner.compute_reward(
            formula,
            safety_penalty=0.5,
        )
        assert rewards["safety_penalty"] == 0.5


class TestBaselineUpdate:
    """Test baseline updating."""

    def test_update_baseline(self):
        tuner = RLFormulaTuner(baseline_decay=0.9)
        initial = tuner.baseline
        tuner.update_baseline(0.8)
        # New baseline should be between initial and 0.8
        assert tuner.baseline != initial
        assert tuner.baseline < initial + 0.1  # Moved toward 0.8

    def test_baseline_convergence(self):
        tuner = RLFormulaTuner(baseline_decay=0.99)
        for _ in range(100):
            tuner.update_baseline(0.7)
        assert abs(tuner.baseline - 0.7) < 0.1


class TestTrainStep:
    """Test training step."""

    def test_train_step(self):
        tuner = RLFormulaTuner()
        formula = {"hq": 10.0, "ds": 8.0}
        result = tuner.train_step(formula)

        assert "reward" in result
        assert "advantage" in result
        assert "baseline" in result
        assert "loss" in result
        assert "breakdown" in result

    def test_train_step_records_history(self):
        tuner = RLFormulaTuner()
        tuner.train_step({"hq": 10.0})
        tuner.train_step({"ds": 8.0})

        stats = tuner.get_stats()
        assert stats["steps"] == 2


class TestStats:
    """Test statistics retrieval."""

    def test_empty_stats(self):
        tuner = RLFormulaTuner()
        stats = tuner.get_stats()
        assert stats["steps"] == 0
        assert stats["avg_reward"] == 0.0

    def test_stats_after_training(self):
        tuner = RLFormulaTuner()
        for _ in range(5):
            tuner.train_step({"hq": 10.0})

        stats = tuner.get_stats()
        assert stats["steps"] == 5
        assert "recent_rewards" in stats
        assert len(stats["recent_rewards"]) == 5


class TestPolicyParams:
    """Test policy parameter retrieval."""

    def test_get_policy_params(self):
        tuner = RLFormulaTuner(lr=0.001)
        params = tuner.get_policy_params()
        assert params["lr"] == 0.001
        assert "baseline" in params

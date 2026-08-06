"""Tests for FormulaSelector

Tests cover:
- Lexicographic selection
- Weighted selection
- Epsilon selection
- Empty candidates
"""

import pytest

from app.services.ai.models.formula_selector import FormulaSelector, SelectionPriority


class TestSelectorInit:
    """Test selector initialization."""

    def test_default_init(self):
        selector = FormulaSelector()
        assert len(selector.priorities) == 6
        assert selector.strategy == "lexicographic"

    def test_custom_priorities(self):
        priorities = [
            SelectionPriority("efficacy", "maximize", weight=0.5),
            SelectionPriority("safety", "maximize", weight=0.5),
        ]
        selector = FormulaSelector(priorities=priorities)
        assert len(selector.priorities) == 2

    def test_weighted_strategy(self):
        selector = FormulaSelector(strategy="weighted")
        assert selector.strategy == "weighted"

    def test_epsilon_strategy(self):
        selector = FormulaSelector(strategy="epsilon")
        assert selector.strategy == "epsilon"


class TestLexicographicSelection:
    """Test lexicographic selection strategy."""

    def test_select_top_k(self):
        selector = FormulaSelector()
        candidates = [
            {"efficacy_score": 0.9, "safety_score": 0.8, "cost": 10},
            {"efficacy_score": 0.95, "safety_score": 0.7, "cost": 15},
            {"efficacy_score": 0.85, "safety_score": 0.9, "cost": 8},
            {"efficacy_score": 0.92, "safety_score": 0.85, "cost": 12},
        ]
        result = selector.select(candidates, top_k=2)
        assert len(result) == 2
        # Should select highest efficacy first
        assert result[0]["efficacy_score"] >= result[1]["efficacy_score"]

    def test_select_all_when_few_candidates(self):
        selector = FormulaSelector()
        candidates = [
            {"efficacy_score": 0.9, "safety_score": 0.8},
            {"efficacy_score": 0.85, "safety_score": 0.85},
        ]
        result = selector.select(candidates, top_k=5)
        assert len(result) == 2

    def test_empty_candidates(self):
        selector = FormulaSelector()
        result = selector.select([], top_k=3)
        assert result == []


class TestWeightedSelection:
    """Test weighted selection strategy."""

    def test_weighted_select(self):
        selector = FormulaSelector(strategy="weighted")
        candidates = [
            {"efficacy_score": 0.9, "safety_score": 0.8},
            {"efficacy_score": 0.7, "safety_score": 0.95},
        ]
        result = selector.select(candidates, top_k=1)
        assert len(result) == 1

    def test_weighted_clear_winner(self):
        selector = FormulaSelector(strategy="weighted")
        candidates = [
            {"efficacy_score": 0.95, "safety_score": 0.95, "cost_score": 0.95},
            {"efficacy_score": 0.5, "safety_score": 0.5, "cost_score": 0.5},
        ]
        result = selector.select(candidates, top_k=1)
        # First candidate should win
        assert result[0]["efficacy_score"] == 0.95


class TestEpsilonSelection:
    """Test epsilon-constraint selection."""

    def test_epsilon_select_feasible(self):
        selector = FormulaSelector(strategy="epsilon")
        candidates = [
            {"efficacy_score": 0.9, "safety_score": 0.8, "cost": 10},
            {"efficacy_score": 0.7, "safety_score": 0.6, "cost": 20},
            {"efficacy_score": 0.8, "safety_score": 0.7, "cost": 15},
        ]
        constraints = {"cost": {"max": 15}}
        result = selector.select(candidates, constraints=constraints)
        # Should only include candidates with cost <= 15
        for c in result:
            assert c["cost"] <= 15

    def test_epsilon_no_feasible(self):
        selector = FormulaSelector(strategy="epsilon")
        candidates = [
            {"efficacy_score": 0.9, "cost": 20},
            {"efficacy_score": 0.8, "cost": 25},
        ]
        constraints = {"cost": {"max": 10}}
        result = selector.select(candidates, constraints=constraints)
        # No feasible, should return top candidates
        assert len(result) > 0


class TestRankCandidates:
    """Test candidate ranking."""

    def test_rank_all(self):
        selector = FormulaSelector()
        candidates = [
            {"score": 0.8},
            {"score": 0.95},
            {"score": 0.7},
        ]
        result = selector.rank_candidates(candidates)
        assert len(result) == 3
        assert result[0]["score"] >= result[1]["score"]
        assert result[1]["score"] >= result[2]["score"]


class TestSelectionPriority:
    """Test SelectionPriority dataclass."""

    def test_default_values(self):
        p = SelectionPriority("efficacy", "maximize")
        assert p.weight == 1.0
        assert p.threshold is None
        assert p.tolerance == 0.05

    def test_custom_values(self):
        p = SelectionPriority(
            "safety",
            "minimize",
            weight=0.3,
            threshold=0.5,
            tolerance=0.1,
        )
        assert p.weight == 0.3
        assert p.threshold == 0.5
        assert p.direction == "minimize"

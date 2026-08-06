"""Tests for FormulaPredictor

Tests cover:
- Basic prediction
- Multi-attribute output
- Empty formula handling
- Batch prediction
"""

import pytest

from app.services.ai.models.formula_predictor import FormulaPredictor, PredictionResult


class TestPredictorInit:
    """Test predictor initialization."""

    def test_default_init(self):
        predictor = FormulaPredictor()
        assert predictor.herb_db == {}

    def test_with_herb_db(self):
        herb_db = {
            "hq": {
                "efficacy_scores": {"免疫调节": 0.9, "抗氧化": 0.8},
                "safety_index": 0.95,
                "cost_per_gram": 0.1,
                "tastes": ["甘"],
                "antagonistic_pairs": [],
            }
        }
        predictor = FormulaPredictor(herb_db=herb_db)
        assert "hq" in predictor.herb_db


class TestPredictorPredict:
    """Test prediction functionality."""

    def test_basic_prediction(self):
        predictor = FormulaPredictor()
        formula = {"hq": 10.0, "ds": 8.0, "gz": 6.0}
        result = predictor.predict(formula, target_effects=["免疫调节"])

        assert isinstance(result, PredictionResult)
        assert 0.0 <= result.efficacy <= 1.0
        assert 0.0 <= result.safety <= 1.0
        assert 0.0 <= result.taste <= 1.0
        assert 0.0 <= result.cost_score <= 1.0
        assert 0.0 <= result.synergy <= 1.0
        assert 0.0 <= result.stability <= 1.0
        assert 0.0 <= result.admet <= 1.0

    def test_empty_formula(self):
        predictor = FormulaPredictor()
        result = predictor.predict({})
        assert result.efficacy == 0.0
        assert result.safety == 0.0

    def test_single_herb(self):
        predictor = FormulaPredictor()
        formula = {"hq": 15.0}
        result = predictor.predict(formula)
        assert result.efficacy >= 0.0
        assert result.safety > 0.0

    def test_overall_score(self):
        predictor = FormulaPredictor()
        formula = {"hq": 10.0, "ds": 8.0, "gz": 6.0}
        result = predictor.predict(formula)

        # Overall should be weighted combination
        expected = (
            result.efficacy * 0.30 +
            result.safety * 0.25 +
            result.taste * 0.10 +
            result.cost_score * 0.15 +
            result.synergy * 0.10 +
            result.stability * 0.10
        )
        assert abs(result.overall - expected) < 0.01

    def test_vector_output(self):
        predictor = FormulaPredictor()
        formula = {"hq": 10.0, "ds": 8.0}
        result = predictor.predict(formula)

        vec = result.vector
        assert len(vec) == 7
        assert vec[0] == result.efficacy
        assert vec[1] == result.safety

    def test_with_herb_db(self):
        herb_db = {
            "hq": {
                "efficacy_scores": {"免疫调节": 0.95, "抗氧化": 0.85},
                "safety_index": 0.95,
                "cost_per_gram": 0.08,
                "tastes": ["甘"],
                "antagonistic_pairs": [],
            },
            "ds": {
                "efficacy_scores": {"补气": 0.90, "免疫调节": 0.80},
                "safety_index": 0.92,
                "cost_per_gram": 0.05,
                "tastes": ["甘"],
                "antagonistic_pairs": [],
            },
        }
        predictor = FormulaPredictor(herb_db=herb_db)
        formula = {"hq": 10.0, "ds": 8.0}
        result = predictor.predict(formula, target_effects=["免疫调节"])

        assert result.efficacy > 0.5  # High efficacy herbs

    def test_antagonistic_penalty(self):
        herb_db = {
            "hq": {
                "efficacy_scores": {"免疫调节": 0.9},
                "safety_index": 0.9,
                "cost_per_gram": 0.1,
                "tastes": ["甘"],
                "antagonistic_pairs": ["ds"],
            },
            "ds": {
                "efficacy_scores": {"补气": 0.8},
                "safety_index": 0.9,
                "cost_per_gram": 0.05,
                "tastes": ["甘"],
                "antagonistic_pairs": ["hq"],
            },
        }
        predictor = FormulaPredictor(herb_db=herb_db)
        formula = {"hq": 10.0, "ds": 8.0}
        result = predictor.predict(formula)

        # Safety should be penalized due to antagonistic pair
        assert result.safety < 0.8


class TestPredictorBatch:
    """Test batch prediction."""

    def test_batch_predict(self):
        predictor = FormulaPredictor()
        formulas = [
            {"hq": 10.0, "ds": 8.0},
            {"gz": 12.0, "rs": 6.0},
        ]
        results = predictor.predict_batch(formulas, target_effects=["免疫调节"])

        assert len(results) == 2
        assert all(isinstance(r, PredictionResult) for r in results)

    def test_batch_empty(self):
        predictor = FormulaPredictor()
        results = predictor.predict_batch([])
        assert results == []


class TestPredictorEdgeCases:
    """Test edge cases."""

    def test_high_dosage(self):
        predictor = FormulaPredictor()
        formula = {"hq": 50.0}  # Very high dosage
        result = predictor.predict(formula)
        # Safety should decrease with high dosage
        assert result.safety < 0.9

    def test_very_small_dosage(self):
        predictor = FormulaPredictor()
        formula = {"hq": 0.1}
        result = predictor.predict(formula)
        assert result.efficacy > 0.0

    def test_many_herbs(self):
        predictor = FormulaPredictor()
        formula = {f"herb_{i}": 5.0 for i in range(20)}
        result = predictor.predict(formula)
        assert result.efficacy >= 0.0
        assert result.safety >= 0.0

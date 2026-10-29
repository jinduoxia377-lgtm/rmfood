"""Tests for UnifiedFormulaEngine

Tests cover:
- Engine initialization
- Generation flow
- Error handling
- Result format
"""

import pytest

from app.services.ai.models.unified_formula_engine import (
    UnifiedFormulaEngine,
    GenerationResult,
)


class TestEngineInit:
    """Test engine initialization."""

    def test_default_init(self):
        engine = UnifiedFormulaEngine()
        assert engine.herb_db == {}
        assert engine.herb_vocab == []

    def test_init_with_herb_db(self):
        herb_db = {"hq": {"name": "黄芪"}}
        engine = UnifiedFormulaEngine(herb_db=herb_db)
        assert "hq" in engine.herb_db

    def test_init_with_herb_vocab(self):
        vocab = ["hq", "ds", "gz"]
        engine = UnifiedFormulaEngine(herb_vocab=vocab)
        assert engine.herb_vocab == vocab


class TestEngineGenerate:
    """Test generation functionality."""

    @pytest.mark.asyncio
    async def test_basic_generation(self):
        engine = UnifiedFormulaEngine(herb_vocab=["hq", "ds", "gz", "rs"])
        result = await engine.generate(
            target_effects=["免疫调节", "抗氧化"],
            n_candidates=5,
            select_top_k=2,
        )

        assert isinstance(result, GenerationResult)
        assert len(result.data) > 0
        assert result.strategy == "unified_engine"
        assert result.execution_time_ms >= 0

    @pytest.mark.asyncio
    async def test_generation_with_template(self):
        engine = UnifiedFormulaEngine(herb_vocab=["hq", "ds", "gz", "rs"])
        result = await engine.generate(
            target_effects=["补气"],
            template_preference="四君子汤",
        )

        assert result.template_used == "四君子汤"

    @pytest.mark.asyncio
    async def test_generation_with_constraints(self):
        engine = UnifiedFormulaEngine(herb_vocab=["hq", "ds", "gz"])
        result = await engine.generate(
            target_effects=["清热"],
            constraints={"max_cost": 30.0, "exclude_herbs": ["gz"]},
        )

        assert isinstance(result, GenerationResult)
        # Excluded herbs should not be in results
        for item in result.data:
            assert item["name"] != "gz"

    @pytest.mark.asyncio
    async def test_generation_empty_effects(self):
        engine = UnifiedFormulaEngine(herb_vocab=["hq", "ds"])
        result = await engine.generate(target_effects=[])

        assert isinstance(result, GenerationResult)

    @pytest.mark.asyncio
    async def test_generation_rl_tuning(self):
        engine = UnifiedFormulaEngine(herb_vocab=["hq", "ds", "gz"])
        result = await engine.generate(
            target_effects=["补气"],
            use_rl_tuning=True,
        )

        assert isinstance(result, GenerationResult)


class TestEngineResultFormat:
    """Test result format consistency."""

    @pytest.mark.asyncio
    async def test_result_has_required_fields(self):
        engine = UnifiedFormulaEngine(herb_vocab=["hq", "ds"])
        result = await engine.generate(target_effects=["补气"])

        assert hasattr(result, "summary")
        assert hasattr(result, "data")
        assert hasattr(result, "scores")
        assert hasattr(result, "template_used")
        assert hasattr(result, "strategy")
        assert hasattr(result, "execution_time_ms")

    @pytest.mark.asyncio
    async def test_result_data_structure(self):
        engine = UnifiedFormulaEngine(herb_vocab=["hq", "ds", "gz"])
        result = await engine.generate(target_effects=["补气"])

        for item in result.data:
            assert "role" in item
            assert "name" in item
            assert "dosage" in item
            assert "purpose" in item

    @pytest.mark.asyncio
    async def test_result_scores(self):
        engine = UnifiedFormulaEngine(herb_vocab=["hq", "ds"])
        result = await engine.generate(target_effects=["补气"])

        assert "overall_score" in result.scores
        assert "efficacy_score" in result.scores
        assert "safety_score" in result.scores


class TestEngineErrorHandling:
    """Test error handling."""

    @pytest.mark.asyncio
    async def test_generation_with_empty_vocab(self):
        engine = UnifiedFormulaEngine(herb_vocab=[])
        result = await engine.generate(target_effects=["补气"])

        # Should not crash
        assert isinstance(result, GenerationResult)


class TestGenerationResult:
    """Test GenerationResult dataclass."""

    def test_creation(self):
        result = GenerationResult(
            summary="Test summary",
            details="Test details",
            data=[{"role": "君", "name": "hq", "dosage": "10g"}],
            scores={"overall": 0.85},
            template_used="四君子汤",
            strategy="unified_engine",
            execution_time_ms=150.5,
        )
        assert result.summary == "Test summary"
        assert len(result.data) == 1

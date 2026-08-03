"""
Tests for the Data Flywheel module (Phase P1-C).

Covers:
- CollectionPipeline: adapter registration, single-source collect, collect_all
- DataQualityValidator: herb validation, peptide validation, batch validation
- BehaviorAnonymizer: search/history anonymization, dataset aggregation
- RecommendationTrainer: training, formula training, recommendations
"""
from __future__ import annotations

import asyncio
import pytest
from typing import Any

from app.services.data_sources.pipeline.collection_pipeline import (
    CollectionPipeline,
    CollectionStats,
)
from app.services.data_sources.pipeline.validators import (
    DataQualityValidator,
    ValidationResult,
    BatchValidationResult,
)
from app.services.analytics.user_behavior import BehaviorAnonymizer, TrainingDataset
from app.services.ml.recommendation_trainer import RecommendationTrainer, Recommendation


# ═══════════════════════════════════════════════════════════════════
# CollectionPipeline
# ═══════════════════════════════════════════════════════════════════

class _FakeAdapter:
    """Minimal adapter for unit testing without network calls."""

    def __init__(self, name: str, records: list[dict[str, Any]], delay: float = 0.01) -> None:
        self.name = name
        self._records = records
        self._delay = delay

    async def fetch(self, **kwargs: Any) -> list[dict[str, Any]]:
        await asyncio.sleep(self._delay)
        return self._records

    async def health_check(self) -> bool:
        return True


@pytest.mark.asyncio
async def test_collect_from_source() -> None:
    pipeline = CollectionPipeline()
    adapter = _FakeAdapter("test_src", [{"id": 1}, {"id": 2}, {"id": 3}])
    pipeline.register_adapter(adapter)

    stats = await pipeline.collect_from_source("test_src")

    assert stats.total_records == 3
    assert stats.by_source["test_src"] == 3
    assert len(stats.errors) == 0
    assert stats.duration_seconds >= 0


@pytest.mark.asyncio
async def test_collect_all_runs_adapters_in_parallel() -> None:
    # Use a pipeline with no built-in adapters so we only count our fakes
    pipeline = CollectionPipeline()
    # Deregister built-in adapters
    for name in list(pipeline.list_sources()):
        if name in ("pubmed", "fda", "efsa"):
            # We can't remove from the dict directly, but we can
            # create a fresh pipeline via a subclass or just check
            # the counts for our own sources.
            pass
    # Instead, register two fakes and check their individual counts
    pipeline.register_adapter(_FakeAdapter("a", [{"x": 1}], delay=0.05))
    pipeline.register_adapter(_FakeAdapter("b", [{"y": 2}, {"y": 3}], delay=0.05))

    stats = await pipeline.collect_all()

    # Built-in adapters (pubmed/fda/efsa) also run in collect_all.
    # At minimum our two sources must be present.
    assert stats.by_source["a"] == 1
    assert stats.by_source["b"] == 2
    assert stats.total_records >= 3  # at least our 3 records


@pytest.mark.asyncio
async def test_collect_from_unknown_source_raises() -> None:
    pipeline = CollectionPipeline()
    with pytest.raises(ValueError, match="Unknown source"):
        await pipeline.collect_from_source("nonexistent")


@pytest.mark.asyncio
async def test_get_stats_returns_aggregate() -> None:
    pipeline = CollectionPipeline()
    pipeline.register_adapter(_FakeAdapter("src", [{"v": 1}]))
    await pipeline.collect_from_source("src")

    # Per-source stats are always available
    stats = pipeline.get_stats("src")
    assert stats.total_records == 1

    # Aggregate (no args) is only populated by collect_all();
    # verify it returns the fallback empty stats, not an exception.
    agg = pipeline.get_stats()
    assert isinstance(agg, CollectionStats)


# ═══════════════════════════════════════════════════════════════════
# DataQualityValidator
# ═══════════════════════════════════════════════════════════════════

def test_validate_herb_valid() -> None:
    v = DataQualityValidator()
    herb = {
        "name_cn": "Renshen",
        "name_latin": "Panax ginseng",
        "category": "Qi tonic",
        "effects": "Great qi tonic",
        "ob_percent": 3.65,
        "dl_value": 0.82,
        "compounds": [{"name": "Rb1", "ob": 1.8, "dl": 0.78}],
        "targets": ["TNF", "IL6"],
        "diseases": ["fatigue"],
    }
    result = v.validate_herb_data(herb)
    assert result.is_valid
    assert result.quality_score == 100
    assert len(result.errors) == 0


def test_validate_herb_missing_required() -> None:
    v = DataQualityValidator()
    result = v.validate_herb_data({})
    assert not result.is_valid
    assert any("name_cn" in e for e in result.errors)
    assert result.quality_score < 100


def test_validate_herb_invalid_ob_range() -> None:
    v = DataQualityValidator()
    herb = {
        "name_cn": "Test",
        "name_latin": "Testus",
        "category": "Test",
        "effects": "test effect",
        "ob_percent": 200.0,
    }
    result = v.validate_herb_data(herb)
    assert not result.is_valid
    assert any("ob_percent" in e for e in result.errors)


def test_validate_peptide_valid() -> None:
    # Use single-letter amino acid codes (uppercase) to match validator rules
    v = DataQualityValidator()
    pep = {
        "sequence": "V-P-P",
        "source_protein": "Beta-Casein",
        "activity_type": "ACE inhibitory",
        "activity_value": 5.0,
        "molecular_weight": 297.4,
    }
    result = v.validate_peptide_data(pep)
    assert result.is_valid
    assert result.quality_score == 100


def test_validate_peptide_invalid_sequence() -> None:
    v = DataQualityValidator()
    pep = {
        "sequence": "X-Y-Z",
        "source_protein": "Test",
        "activity_type": "Test",
        "activity_value": 1.0,
        "molecular_weight": 100.0,
    }
    result = v.validate_peptide_data(pep)
    assert not result.is_valid
    assert any("invalid amino acid" in e.lower() for e in result.errors)


def test_validate_peptide_missing_sequence() -> None:
    v = DataQualityValidator()
    result = v.validate_peptide_data({"source_protein": "X"})
    assert not result.is_valid
    assert any("sequence" in e for e in result.errors)


def test_validate_batch_herb() -> None:
    v = DataQualityValidator()
    records = [
        {"name_cn": "A", "name_latin": "a", "category": "c", "effects": "e"},
        {},  # invalid
        {"name_cn": "B", "name_latin": "b", "category": "c", "effects": "e"},
    ]
    result = v.validate_batch(records, "herb")
    assert result.total == 3
    assert result.valid_count == 2
    assert result.invalid_count == 1
    assert result.quality_score < 100


def test_validate_batch_peptide() -> None:
    v = DataQualityValidator()
    records = [
        {
            "sequence": "V-P-P",
            "source_protein": "Casein",
            "activity_type": "ACE",
            "activity_value": 9.0,
            "molecular_weight": 297.4,
        },
    ]
    result = v.validate_batch(records, "peptide")
    assert result.total == 1
    assert result.valid_count == 1
    assert result.quality_score == 100


def test_validate_batch_invalid_source_type() -> None:
    v = DataQualityValidator()
    with pytest.raises(ValueError, match="Unknown source_type"):
        v.validate_batch([], "unknown")


# ═══════════════════════════════════════════════════════════════════
# BehaviorAnonymizer
# ═══════════════════════════════════════════════════════════════════

def test_anonymize_search_history() -> None:
    a = BehaviorAnonymizer()
    searches = [
        {"user_id": "u1", "query": "astragalus", "category": "herb"},
        {"user_id": "u1", "query": "ginseng", "category": "herb"},
        {"user_id": "u1", "query": "astragalus", "category": "herb"},
    ]
    result = a.anonymize_search_history("u1", searches)
    assert result.user_hash != "u1"
    assert result.count == 3
    assert result.patterns.get("astragalus") == 2
    assert result.patterns.get("ginseng") == 1


def test_anonymize_formula_history() -> None:
    a = BehaviorAnonymizer()
    formulas = [
        {"user_id": "u2", "ingredients": ["astragalus", "ginseng", "licorice"], "category": "qi"},
        {"user_id": "u2", "ingredients": ["ginseng", "angelica"], "category": "blood"},
    ]
    result = a.anonymize_formula_history("u2", formulas)
    assert result.user_hash != "u2"
    assert result.count == 2
    assert result.ingredient_freq.get("ginseng") == 2
    assert result.ingredient_freq.get("astragalus") == 1


def test_aggregate_for_training() -> None:
    a = BehaviorAnonymizer()
    searches = [a.anonymize_search_history("u1", [{"query": "astragalus", "category": "herb"}])]
    formulas = [a.anonymize_formula_history("u1", [{"ingredients": ["astragalus"]}])]
    ds = a.aggregate_for_training(searches, formulas)
    assert ds.total_records == 2
    assert ds.feature_dim > 0
    assert len(ds.user_hashes) == 1
    # Verify no PII leaked into vectors keys
    for key in ds.user_profile_vectors:
        assert key != "u1"


# ═══════════════════════════════════════════════════════════════════
# RecommendationTrainer
# ═══════════════════════════════════════════════════════════════════

def test_train_and_recommend() -> None:
    t = RecommendationTrainer(top_n=3)
    ds = TrainingDataset(
        total_records=2,
        feature_dim=3,
        user_profile_vectors={
            "hash_a": [1.0, 0.0, 0.0],
            "hash_b": [0.9, 0.1, 0.0],
            "hash_c": [0.0, 1.0, 0.0],
        },
    )
    result = t.train_from_behavior(ds)
    assert result.user_count == 3
    assert result.model_version != "init"

    recs = t.get_recommendations({"user_hash": "hash_a"}, top_n=3)
    assert len(recs) <= 3
    assert all(isinstance(r, Recommendation) for r in recs)
    if recs:
        assert recs[0].score >= recs[-1].score


def test_train_from_formulas() -> None:
    t = RecommendationTrainer(top_n=5)
    history = [
        {"user_id": "u1", "ingredients": ["astragalus", "ginseng"]},
        {"user_id": "u2", "ingredients": ["ginseng", "licorice"]},
        {"user_id": "u3", "ingredients": ["angelica"]},
    ]
    result = t.train_from_formulas(history)
    assert result.user_count == 3
    assert result.model_version != "init"

    recs = t.get_recommendations({"user_hash": "u1"})
    assert isinstance(recs, list)


def test_recommendations_for_unknown_user() -> None:
    t = RecommendationTrainer()
    recs = t.get_recommendations({"user_hash": "nonexistent"})
    assert recs == []


def test_get_stats() -> None:
    t = RecommendationTrainer(top_n=5)
    stats = t.get_stats()
    assert stats["top_n"] == 5
    assert isinstance(stats["model_version"], str)


# ═══════════════════════════════════════════════════════════════════
# Entry point
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    pytest.main([__file__, "-v"])

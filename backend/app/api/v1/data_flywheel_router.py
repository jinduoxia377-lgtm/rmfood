"""
Data Flywheel API Router — Phase P1-C.

Endpoints:
- POST /api/v1/data-flywheel/collect       Trigger data collection
- GET  /api/v1/data-flywheel/stats         Collection statistics
- POST /api/v1/data-flywheel/validate      Validate data quality
- GET  /api/v1/data-flywheel/anonymized-behavior
                                          Anonymized behavior for training
- POST /api/v1/data-flywheel/train         Train recommendation model
- GET  /api/v1/data-flywheel/recommendations/{user_id}
                                          Get recommendations
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.data_sources.pipeline.collection_pipeline import CollectionPipeline
from app.services.data_sources.pipeline.validators import DataQualityValidator
from app.services.analytics.user_behavior import BehaviorAnonymizer
from app.services.ml.recommendation_trainer import RecommendationTrainer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/data-flywheel", tags=["Data Flywheel"])

# Module-level singletons
_pipeline = CollectionPipeline()
_validator = DataQualityValidator()
_anonymizer = BehaviorAnonymizer()
_trainer = RecommendationTrainer()


# ── Request / response schemas ──────────────────────────────────────

class CollectRequest(BaseModel):
    sources: list[str] = Field(
        default_factory=list,
        description="Source names to collect; empty = all registered sources",
    )


class ValidateRequest(BaseModel):
    records: list[dict[str, Any]] = Field(
        ...,
        description="Records to validate",
        min_length=1,
    )
    source_type: str = Field(..., description="One of 'herb' or 'peptide'")


class TrainRequest(BaseModel):
    model_type: str = Field(default="collaborative", description="Model training type")
    use_formulas: bool = Field(default=False, description="Train from formula history")
    formula_history: Optional[list[dict[str, Any]]] = Field(
        default=None, description="Formula records (used when use_formulas=True)",
    )


class AnonymizeRequest(BaseModel):
    user_id: str = Field(..., description="User identifier to anonymize")
    searches: Optional[list[dict[str, Any]]] = Field(default=None)
    formulas: Optional[list[dict[str, Any]]] = Field(default=None)


class RecommendationRequest(BaseModel):
    top_n: int = Field(default=10, ge=1, le=50, description="Number of recommendations")


# ── Endpoints ───────────────────────────────────────────────────────

@router.post("/collect", summary="Trigger data collection")
async def trigger_collect(request: CollectRequest) -> dict[str, Any]:
    """
    Start a data collection run against the requested sources.

    If ``sources`` is empty, all registered adapters run in parallel.
    Returns per-source record counts and aggregate stats.
    """
    try:
        if request.sources:
            results = {}
            for src in request.sources:
                if src not in _pipeline.list_sources():
                    raise HTTPException(status_code=400, detail=f"Unknown source: {src!r}")
                stats = await _pipeline.collect_from_source(src)
                results[src] = {
                    "records": stats.total_records,
                    "errors": stats.errors,
                    "duration_s": round(stats.duration_seconds, 3),
                }
            return {"status": "completed", "sources": results}

        stats = await _pipeline.collect_all()
        return {
            "status": "completed",
            "total_records": stats.total_records,
            "errors": stats.errors,
            "duration_s": round(stats.duration_seconds, 3),
            "throughput_per_sec": round(stats.throughput, 2),
        }
    except Exception as exc:
        logger.error("[DataFlywheel] collect failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/stats", summary="Collection statistics")
async def get_stats() -> dict[str, Any]:
    """Return current pipeline statistics and registered source list."""
    all_stats = _pipeline.get_stats()
    return {
        "registered_sources": _pipeline.list_sources(),
        "total_records": all_stats.total_records,
        "by_source": all_stats.by_source,
        "errors": all_stats.errors,
        "duration_s": round(all_stats.duration_seconds, 3),
        "throughput_per_sec": round(all_stats.throughput, 2),
    }


@router.post("/validate", summary="Validate data quality")
async def validate_data(request: ValidateRequest) -> dict[str, Any]:
    """
    Validate a batch of records against source-specific rules.

    Returns per-record validation results and an overall quality score.
    """
    try:
        result = _validator.validate_batch(request.records, request.source_type)
        return {
            "source_type": request.source_type,
            "total": result.total,
            "valid_count": result.valid_count,
            "invalid_count": result.invalid_count,
            "quality_score": result.quality_score,
            "per_record": [
                {
                    "is_valid": r.is_valid,
                    "errors": r.errors,
                    "warnings": r.warnings,
                    "quality_score": r.quality_score,
                }
                for r in result.records
            ],
        }
    except Exception as exc:
        logger.error("[DataFlywheel] validate failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/anonymized-behavior", summary="Get anonymized behavior data")
async def get_anonymized(
    user_id: str,
    searches: Optional[str] = None,
    formulas: Optional[str] = None,
) -> dict[str, Any]:
    """
    Return anonymized user behavior (searches + formulas) suitable for
    downstream ML training. PII tokens are hashed; only patterns remain.
    """
    try:
        search_list = []
        if searches:
            try:
                import json
                search_list = json.loads(searches)
            except Exception as json_err:
                logger.warning("搜索历史 JSON 解析失败: %s", json_err)
                search_list = []

        formula_list = []
        if formulas:
            try:
                import json
                formula_list = json.loads(formulas)
            except Exception as json_err:
                logger.warning("配方历史 JSON 解析失败: %s", json_err)
                formula_list = []

        anon_searches = _anonymizer.anonymize_search_history(user_id, search_list)
        anon_formulas = _anonymizer.anonymize_formula_history(user_id, formula_list)
        dataset = _anonymizer.aggregate_for_training(
            [anon_searches], [anon_formulas]
        )

        return {
            "user_hash": user_id and _anonymizer._hash_id(user_id) or "",
            "search_records": anon_searches.count,
            "formula_records": anon_formulas.count,
            "dataset": {
                "total_records": dataset.total_records,
                "feature_dim": dataset.feature_dim,
                "label_distribution": dataset.label_distribution,
                "user_profile_count": len(dataset.user_profile_vectors),
            },
        }
    except Exception as exc:
        logger.error("[DataFlywheel] anonymize failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/train", summary="Train recommendation model")
async def train_model(request: TrainRequest) -> dict[str, Any]:
    """
    Train or update the recommendation model.

    - ``model_type``: 'collaborative', 'content', or 'hybrid'
    - ``use_formulas``: if True, train from formula history instead
    """
    try:
        if request.use_formulas and request.formula_history:
            result = _trainer.train_from_formulas(request.formula_history)
        else:
            # Simulate a TrainingDataset for the collaborative path
            from app.services.analytics.user_behavior import TrainingDataset
            # Empty dataset placeholder — real usage feeds anonymized data
            ds = TrainingDataset(
                total_records=0,
                feature_dim=_trainer.get_stats()["feature_dim"] or 10,
            )
            result = _trainer.train_from_behavior(ds, model_type=request.model_type)

        return {
            "status": "success",
            "model_version": result.model_version,
            "training_time_ms": result.training_time_ms,
            "feature_count": result.feature_count,
            "user_count": result.user_count,
            "message": result.message,
        }
    except Exception as exc:
        logger.error("[DataFlywheel] train failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/recommendations/{user_id}", summary="Get recommendations")
async def get_recommendations(
    user_id: str,
    request: RecommendationRequest = None,  # type: ignore[assignment]
    top_n: int = 10,
) -> dict[str, Any]:
    """
    Return top-N item recommendations for an anonymized user.

    The user must have been trained on previously; otherwise an empty
    list is returned.
    """
    try:
        recs = _trainer.get_recommendations(
            {"user_hash": user_id},
            top_n=top_n,
        )
        return {
            "user_hash": user_id,
            "top_n": top_n,
            "count": len(recs),
            "recommendations": [
                {
                    "item_id": r.item_id,
                    "score": r.score,
                    "reason": r.reason,
                }
                for r in recs
            ],
        }
    except Exception as exc:
        logger.error("[DataFlywheel] recommendations failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

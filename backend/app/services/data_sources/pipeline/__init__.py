"""
Data Flywheel — Phase P1-C

Automated data collection pipeline with quality validation,
anonymized behavior tracking, and recommendation model training.
"""
from __future__ import annotations

from .collection_pipeline import CollectionPipeline, CollectionStats
from .validators import (
    DataQualityValidator,
    ValidationResult,
    BatchValidationResult,
)

__all__ = [
    "CollectionPipeline",
    "CollectionStats",
    "DataQualityValidator",
    "ValidationResult",
    "BatchValidationResult",
]

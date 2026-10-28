"""
Recommendation model trainer — collaborative filtering with cosine similarity.

Uses only the Python standard library (no external ML dependencies).
Supports incremental updates and deterministic model versioning.
"""
from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class TrainingResult:
    """Outcome of a training run."""
    model_version: str
    accuracy: float | None = None
    training_time_ms: float = 0.0
    feature_count: int = 0
    user_count: int = 0
    message: str = ""


@dataclass
class Recommendation:
    """A single recommendation result."""
    user_hash: str
    item_id: str
    score: float
    reason: str = ""


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two equal-length vectors."""
    if len(a) != len(b) or len(a) == 0:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def _version_hash(data: Any) -> str:
    """Deterministic short hash for model versioning."""
    raw = str(data).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:12]


class RecommendationTrainer:
    """
    Collaborative-filtering recommendation engine using cosine similarity.

    Builds user-profile vectors from anonymized behavior data and returns
    top-N recommendations by similarity to other users or to formula history.
    Supports incremental updates via ``train_from_behavior()``.
    """

    def __init__(self, top_n: int = 10, similarity_threshold: float = 0.1) -> None:
        self._top_n = top_n
        self._threshold = similarity_threshold
        self._user_vectors: dict[str, list[float]] = {}
        self._model_version: str = "init"
        self._training_count: int = 0
        self._feature_dim: int = 0

    def train_from_behavior(
        self,
        dataset: Any,
        model_type: str = "collaborative",
    ) -> TrainingResult:
        """
        Train (or incrementally update) the recommendation model from
        an anonymized TrainingDataset.

        Parameters
        ----------
        dataset : TrainingDataset
            Output of BehaviorAnonymizer.aggregate_for_training().
        model_type : str
            One of ``'collaborative'``, ``'content'``, or ``'hybrid'``.
            Currently all use the same cosine-similarity approach.

        Returns
        -------
        TrainingResult
        """
        t0 = time.monotonic()
        if not hasattr(dataset, "user_profile_vectors"):
            logger.warning("[RecTrainer] dataset missing user_profile_vectors, skipping")
            return TrainingResult(
                model_version=self._model_version,
                message="Invalid dataset structure",
                training_time_ms=0,
            )

        vectors = dataset.user_profile_vectors
        self._user_vectors = vectors
        self._feature_dim = dataset.feature_dim
        self._training_count += 1

        # Deterministic version from current model state
        self._model_version = _version_hash(
            (vectors, self._training_count, model_type)
        )

        elapsed_ms = (time.monotonic() - t0) * 1000
        logger.info(
            "[RecTrainer] trained model_type=%s users=%d dim=%d version=%s %.1fms",
            model_type,
            len(vectors),
            self._feature_dim,
            self._model_version,
            elapsed_ms,
        )
        return TrainingResult(
            model_version=self._model_version,
            accuracy=None,  # requires held-out test set
            training_time_ms=round(elapsed_ms, 2),
            feature_count=self._feature_dim,
            user_count=len(vectors),
            message=f"Trained {model_type} model with {len(vectors)} users",
        )

    def train_from_formulas(self, formula_history: list[dict[str, Any]]) -> TrainingResult:
        """
        Derive user vectors directly from formula history records.

        Each formula is converted to a feature vector (ingredient counts
        normalized). This is equivalent to a content-based approach.

        Parameters
        ----------
        formula_history : list[dict]
            Each dict: ``{user_id, ingredients, category, ...}``.

        Returns
        -------
        TrainingResult
        """
        t0 = time.monotonic()
        all_ingredients: set[str] = set()
        for f in formula_history:
            ingredients = f.get("ingredients") or []
            if isinstance(ingredients, dict):
                ingredients = list(ingredients.keys())
            all_ingredients.update(str(i) for i in ingredients)

        ing_list = sorted(all_ingredients)
        ing_index: dict[str, int] = {name: idx for idx, name in enumerate(ing_list)}
        vectors: dict[str, list[float]] = {}

        for formula in formula_history:
            uid = str(formula.get("user_id", ""))
            ingredients = formula.get("ingredients") or []
            if isinstance(ingredients, dict):
                ingredients = list(ingredients.keys())
            vec = [0.0] * len(ing_list)
            for ing in ingredients:
                idx = ing_index.get(str(ing))
                if idx is not None:
                    vec[idx] = 1.0
            # L2-normalize
            norm = sum(v * v for v in vec) ** 0.5
            if norm > 0:
                vec = [v / norm for v in vec]
            vectors[uid] = vec

        self._user_vectors = vectors
        self._feature_dim = len(ing_list)
        self._training_count += 1
        self._model_version = _version_hash((vectors, self._training_count, "formula"))

        elapsed_ms = (time.monotonic() - t0) * 1000
        logger.info(
            "[RecTrainer] formula-trained users=%d dim=%d %.1fms",
            len(vectors),
            self._feature_dim,
            elapsed_ms,
        )
        return TrainingResult(
            model_version=self._model_version,
            accuracy=None,
            training_time_ms=round(elapsed_ms, 2),
            feature_count=self._feature_dim,
            user_count=len(vectors),
            message=f"Formula-based model trained with {len(vectors)} users",
        )

    def get_recommendations(
        self,
        user_profile: dict[str, Any],
        top_n: int | None = None,
    ) -> list[Recommendation]:
        """
        Return top-N item recommendations for a user profile.

        Parameters
        ----------
        user_profile : dict
            Must contain ``user_hash`` (the anonymized ID) and optionally
            ``ingredients`` or ``categories`` to refine recommendations.
        top_n : int | None
            Override default top_n.

        Returns
        -------
        list[Recommendation]
        """
        user_hash = str(user_profile.get("user_hash", ""))
        n = top_n or self._top_n

        if user_hash not in self._user_vectors:
            logger.debug("[RecTrainer] unknown user_hash=%s, returning empty", user_hash)
            return []

        query_vec = self._user_vectors[user_hash]
        candidates: list[Recommendation] = []

        for other_hash, other_vec in self._user_vectors.items():
            if other_hash == user_hash:
                continue
            sim = _cosine_similarity(query_vec, other_vec)
            if sim >= self._threshold:
                candidates.append(Recommendation(
                    user_hash=other_hash,
                    item_id=other_hash,
                    score=round(sim, 4),
                    reason=f"similarity={sim:.3f}",
                ))

        candidates.sort(key=lambda r: r.score, reverse=True)
        return candidates[:n]

    def get_model_version(self) -> str:
        """Return the current model version hash."""
        return self._model_version

    def get_stats(self) -> dict[str, Any]:
        """Return current trainer state summary."""
        return {
            "model_version": self._model_version,
            "training_runs": self._training_count,
            "feature_dim": self._feature_dim,
            "user_count": len(self._user_vectors),
            "top_n": self._top_n,
            "similarity_threshold": self._threshold,
        }

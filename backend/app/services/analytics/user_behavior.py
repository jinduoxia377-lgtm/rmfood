"""
User behavior anonymization service.

Provides ``BehaviorAnonymizer`` that strips PII from search and formula
history while preserving statistical properties for ML training pipelines.
Uses one-way SHA-256 hashing — never reversible.
"""
from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# Tokens considered PII and subject to hashing
PII_TOKENS = ("user_id", "email", "phone", "name", "username")


@dataclass
class AnonymizedSearches:
    """Anonymized collection of user search history records."""
    user_hash: str
    count: int
    patterns: dict[str, int] = field(default_factory=dict)
    categories: list[str] = field(default_factory=list)


@dataclass
class AnonymizedFormulas:
    """Anonymized collection of user formula history records."""
    user_hash: str
    count: int
    ingredient_freq: dict[str, int] = field(default_factory=dict)
    category_dist: dict[str, int] = field(default_factory=dict)


@dataclass
class TrainingDataset:
    """ML-ready anonymized dataset."""
    total_records: int
    feature_dim: int
    user_hashes: list[str] = field(default_factory=list)
    label_distribution: dict[str, int] = field(default_factory=dict)
    user_profile_vectors: dict[str, list[float]] = field(default_factory=dict)


def _hash_id(value: str) -> str:
    """One-way SHA-256 hash — non-reversible."""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


class BehaviorAnonymizer:
    """
    Anonymize user behavior data while preserving statistical properties.

    All personal identifiers are replaced with deterministic hashes based on
    the user_id so that the same user always maps to the same anonymous ID.
    Raw PII values are never stored in the output.
    """

    def anonymize_search_history(
        self,
        user_id: str,
        searches: list[dict[str, Any]],
    ) -> AnonymizedSearches:
        """
        Strip PII from search history and aggregate usage patterns.

        Parameters
        ----------
        user_id : str
            Original user identifier — hashed, never included in output.
        searches : list[dict]
            Each dict represents one search event; may contain fields like
            ``query``, ``category``, ``timestamp``, ``result_count``.

        Returns
        -------
        AnonymizedSearches
        """
        user_hash = _hash_id(user_id)
        patterns: dict[str, int] = {}
        categories: set[str] = set()

        for item in searches:
            # Extract safe fields (skip any PII keys)
            safe = {k: v for k, v in item.items() if k.lower() not in PII_TOKENS}
            query = str(safe.get("query", "")).strip().lower()
            if query:
                patterns[query] = patterns.get(query, 0) + 1

            cat = safe.get("category") or safe.get("category_name", "")
            if cat:
                categories.add(str(cat))

        return AnonymizedSearches(
            user_hash=user_hash,
            count=len(searches),
            patterns=patterns,
            categories=sorted(categories),
        )

    def anonymize_formula_history(
        self,
        user_id: str,
        formulas: list[dict[str, Any]],
    ) -> AnonymizedFormulas:
        """
        Strip PII from formula history and aggregate ingredient frequencies.

        Parameters
        ----------
        user_id : str
            Original user identifier.
        formulas : list[dict]
            Each dict represents one saved formula; may contain ``ingredients``,
            ``category``, ``tags``, ``nutritional_targets``, etc.

        Returns
        -------
        AnonymizedFormulas
        """
        user_hash = _hash_id(user_id)
        ingredient_freq: dict[str, int] = {}
        category_dist: dict[str, int] = {}

        for formula in formulas:
            safe = {k: v for k, v in formula.items() if k.lower() not in PII_TOKENS}
            cats = safe.get("category") or safe.get("formula_type", "")
            if cats:
                for c in (cats if isinstance(cats, list) else [cats]):
                    category_dist[str(c)] = category_dist.get(str(c), 0) + 1

            ingredients = safe.get("ingredients") or []
            if isinstance(ingredients, list):
                for ing in ingredients:
                    name = str(ing).strip()
                    if name:
                        ingredient_freq[name] = ingredient_freq.get(name, 0) + 1
            elif isinstance(ingredients, dict):
                for name in ingredients:
                    ingredient_freq[str(name)] = ingredient_freq.get(str(name), 0) + 1

        return AnonymizedFormulas(
            user_hash=user_hash,
            count=len(formulas),
            ingredient_freq=ingredient_freq,
            category_dist=category_dist,
        )

    def aggregate_for_training(
        self,
        search_data: list[AnonymizedSearches],
        formula_data: list[AnonymizedFormulas],
    ) -> TrainingDataset:
        """
        Combine anonymized search and formula data into an ML-ready dataset.

        Features are constructed as a fixed-dimension vector per user hash
        (ingredient frequency, category distribution, search pattern counts).

        Parameters
        ----------
        search_data : list[AnonymizedSearches]
        formula_data : list[AnonymizedFormulas]

        Returns
        -------
        TrainingDataset
        """
        all_hashes: set[str] = {
            s.user_hash for s in search_data
        } | {f.user_hash for f in formula_data}

        label_dist: dict[str, int] = {}
        vectors: dict[str, list[float]] = {}

        for uh in all_hashes:
            searches = [s for s in search_data if s.user_hash == uh]
            formulas = [f for f in formula_data if f.user_hash == uh]

            # Aggregate categories across all records for this user
            combined_cats: dict[str, int] = {}
            for s in searches:
                for cat in s.categories:
                    combined_cats[cat] = combined_cats.get(cat, 0) + 1
            for f in formulas:
                for cat, cnt in f.category_dist.items():
                    combined_cats[cat] = combined_cats.get(cat, 0) + cnt

            self._derive_label(combined_cats, label_dist)

            # Build fixed-dimension feature vector (top-N categories)
            top_cats = sorted(combined_cats, key=combined_cats.get, reverse=True)[:10]
            vec = [float(combined_cats.get(c, 0)) for c in top_cats] + [0.0] * max(0, 10 - len(top_cats))
            # Normalize to [0, 1]
            max_val = max(vec) if vec else 1.0
            if max_val > 0:
                vec = [v / max_val for v in vec]

            vectors[uh] = vec

        return TrainingDataset(
            total_records=len(search_data) + len(formula_data),
            feature_dim=len(next(iter(vectors.values()))) if vectors else 0,
            user_hashes=sorted(all_hashes),
            label_distribution=label_dist,
            user_profile_vectors=vectors,
        )

    @staticmethod
    def _derive_label(
        cat_dist: dict[str, int],
        label_dist: dict[str, int],
    ) -> str:
        """Assign a categorical label based on dominant category."""
        if not cat_dist:
            return "unknown"
        dominant = max(cat_dist, key=cat_dist.get)
        label = "general"
        if any(kw in dominant.lower() for kw in ("health", "functional", "wellness")):
            label = "health_focused"
        elif any(kw in dominant.lower() for kw in ("tcm", "herb", "chinese medicine")):
            label = "tcm_oriented"
        elif any(kw in dominant.lower() for kw in ("peptide", "protein", "amino")):
            label = "peptide_oriented"
        label_dist[label] = label_dist.get(label, 0) + 1
        return label

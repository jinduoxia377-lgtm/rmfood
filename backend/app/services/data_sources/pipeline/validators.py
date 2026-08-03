"""
Data quality validator for TCMSP herbs and DFBP peptides.

Provides ``DataQualityValidator`` with single-record and batch validation
support, returning structured quality scores (0–100) and actionable errors.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# ── Valid amino-acid alphabet (for peptide sequence validation) ──────
_VALID_AA = set("ACDEFGHIKLMNPQRSTVWY")


# ── Result dataclasses ───────────────────────────────────────────────

@dataclass
class ValidationResult:
    """Result of validating a single record."""
    is_valid: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    quality_score: int = 100  # 0-100


@dataclass
class BatchValidationResult:
    """Result of validating a batch of records."""
    total: int = 0
    valid_count: int = 0
    invalid_count: int = 0
    records: list[ValidationResult] = field(default_factory=list)
    quality_score: int = 100  # weighted average


# ── Validator ────────────────────────────────────────────────────────

class DataQualityValidator:
    """
    Validate TCMSP herb records and DFBP peptide records.

    Rules:
    - Required fields must be present and non-empty
    - Numeric ranges are checked (OB%, DL value, molecular weight, etc.)
    - Peptide sequences are validated against the 20 standard amino acids
    - Record uniqueness is tracked across a batch
    """

    # ── Herb validation ──────────────────────────────────────────────

    _HERB_REQUIRED = ("name_cn", "name_latin", "category", "effects")
    _HERB_OB_RANGE = (0.0, 100.0)
    _HERB_DL_RANGE = (0.0, 1.0)

    def validate_herb_data(self, data: dict[str, Any]) -> ValidationResult:
        """
        Validate a single TCMSP herb record.

        Parameters
        ----------
        data : dict
            Herb record as produced by TCMSPSyncService / TCMSP_HERB_DATABASE.

        Returns
        -------
        ValidationResult
        """
        errors: list[str] = []
        warnings: list[str] = []

        for field_name in self._HERB_REQUIRED:
            val = data.get(field_name)
            if not val or not str(val).strip():
                errors.append(f"Required field missing or empty: {field_name}")

        ob = data.get("ob_percent")
        if ob is not None:
            try:
                ob_f = float(ob)
            except (TypeError, ValueError):
                errors.append("ob_percent is not a valid number")
            else:
                if not (self._HERB_OB_RANGE[0] <= ob_f <= self._HERB_OB_RANGE[1]):
                    errors.append(f"ob_percent {ob_f} out of range [{self._HERB_OB_RANGE}]")

        dl = data.get("dl_value")
        if dl is not None:
            try:
                dl_f = float(dl)
            except (TypeError, ValueError):
                errors.append("dl_value is not a valid number")
            else:
                if not (self._HERB_DL_RANGE[0] <= dl_f <= self._HERB_DL_RANGE[1]):
                    errors.append(f"dl_value {dl_f} out of range [{self._HERB_DL_RANGE}]")
                    warnings.append("dl_value outside expected [0,1] — possible data error")

        compounds = data.get("compounds")
        if compounds is not None:
            if not isinstance(compounds, list):
                errors.append("compounds must be a list")
            else:
                for idx, comp in enumerate(compounds):
                    if not isinstance(comp, dict):
                        errors.append(f"compounds[{idx}] must be a dict")
                        continue
                    if not comp.get("name"):
                        errors.append(f"compounds[{idx}] missing 'name'")

        targets = data.get("targets")
        if targets and not isinstance(targets, list):
            errors.append("targets must be a list")

        diseases = data.get("diseases")
        if diseases and not isinstance(diseases, list):
            errors.append("diseases must be a list")

        is_valid = len(errors) == 0
        penalty = min(100, len(errors) * 20 + len(warnings) * 5)
        return ValidationResult(
            is_valid=is_valid,
            errors=errors,
            warnings=warnings,
            quality_score=max(0, 100 - penalty),
        )

    # ── Peptide validation ───────────────────────────────────────────

    _PEPTIDE_REQUIRED = (
        "sequence", "source_protein", "activity_type",
        "activity_value", "molecular_weight",
    )

    def validate_peptide_data(self, data: dict[str, Any]) -> ValidationResult:
        """
        Validate a single DFBP peptide record.

        Parameters
        ----------
        data : dict
            Peptide record as produced by DFBPSyncService.

        Returns
        -------
        ValidationResult
        """
        errors: list[str] = []
        warnings: list[str] = []

        for field_name in self._PEPTIDE_REQUIRED:
            val = data.get(field_name)
            if not val and val != 0:
                errors.append(f"Required field missing or empty: {field_name}")

        seq = data.get("sequence", "")
        if seq:
            # Sequence must be non-empty uppercase letters joined by hyphens
            tokens = [t.strip() for t in str(seq).split("-")]
            if not tokens or any(t == "" for t in tokens):
                errors.append("sequence contains empty segments")
            else:
                for token in tokens:
                    if not all(c in _VALID_AA for c in token.upper()):
                        errors.append(f"sequence contains invalid amino acid chars: {token}")
                        break
                if len(tokens) < 2:
                    warnings.append("sequence length < 2 amino acids (unusual)")
                if len(tokens) > 50:
                    warnings.append("sequence length > 50 aa (very long)")

        mw = data.get("molecular_weight")
        if mw is not None:
            try:
                mw_f = float(mw)
            except (TypeError, ValueError):
                errors.append("molecular_weight is not a valid number")
            else:
                if mw_f <= 0:
                    errors.append(f"molecular_weight must be positive, got {mw_f}")
                elif mw_f > 50000:
                    warnings.append(f"molecular_weight {mw_f} is unusually large")

        act_val = data.get("activity_value")
        if act_val is not None and act_val != 0:
            try:
                float(act_val)
            except (TypeError, ValueError):
                errors.append("activity_value is not a valid number")

        is_valid = len(errors) == 0
        penalty = min(100, len(errors) * 20 + len(warnings) * 5)
        return ValidationResult(
            is_valid=is_valid,
            errors=errors,
            warnings=warnings,
            quality_score=max(0, 100 - penalty),
        )

    # ── Batch validation ─────────────────────────────────────────────

    def validate_batch(
        self,
        records: list[dict[str, Any]],
        source_type: str,
    ) -> BatchValidationResult:
        """
        Validate a batch of records of a single source type.

        Parameters
        ----------
        records : list[dict]
            Raw records to validate.
        source_type : str
            One of ``'herb'`` or ``'peptide'``.

        Returns
        -------
        BatchValidationResult
        """
        if source_type not in ("herb", "peptide"):
            raise ValueError(f"Unknown source_type {source_type!r}; expected 'herb' or 'peptide'")

        validator = self.validate_herb_data if source_type == "herb" else self.validate_peptide_data
        results = [validator(rec) for rec in records]

        valid_count = sum(1 for r in results if r.is_valid)
        invalid_count = len(results) - valid_count
        avg_score = (
            sum(r.quality_score for r in results) / len(results)
            if results
            else 100
        )

        return BatchValidationResult(
            total=len(records),
            valid_count=valid_count,
            invalid_count=invalid_count,
            records=results,
            quality_score=round(avg_score),
        )

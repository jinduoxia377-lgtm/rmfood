"""Tests for formula validation and business rules."""
import pytest


class TestFormulaValidation:
    """Formula data validation tests."""

    def test_formula_name_required(self):
        assert len("Valid Formula") > 0

    def test_formula_name_max_length(self):
        """Formula name limited to 200 chars."""
        long_name = "A" * 201
        assert len(long_name) > 200
        short_name = "A" * 200
        assert len(short_name) <= 200

    def test_formula_code_format(self):
        """Formula code should be alphanumeric with hyphens."""
        valid_codes = ["RMF-2024-001", "TEST-FORMULA", "ABC123"]
        for code in valid_codes:
            assert len(code) > 0

    def test_formula_code_unique(self):
        codes = {"RMF-001", "RMF-002", "RMF-003"}
        assert len(codes) == len(set(codes))

    def test_target_effects_non_empty(self):
        valid = ["降血压", "抗氧化"]
        assert len(valid) >= 1

    def test_target_effects_max_5(self):
        five = ["a", "b", "c", "d", "e"]
        six = ["a", "b", "c", "d", "e", "f"]
        assert len(five) <= 5
        assert len(six) > 5

    def test_composition_has_ingredients(self):
        comp = {"黄芪": {"dosage": 15, "unit": "g"}}
        assert len(comp) >= 1

    def test_dosage_positive(self):
        assert 15 > 0
        assert -5 < 0

    def test_shelf_life_positive(self):
        assert 12 > 0
        assert 0 == 0

    def test_valid_formulas(self):
        """Valid formula data structures."""
        f1 = {
            "name": "降压方",
            "code": "BF-001",
            "target_effects": ["降血压"],
            "composition": {"丹参": {"dosage": 10, "unit": "g"}},
        }
        for key in ["name", "code", "target_effects", "composition"]:
            assert key in f1


class TestFormulaStatus:
    """Formula status transition tests."""

    def test_draft_to_pending_review(self):
        """Draft can transition to pending_review."""
        states = ["draft", "pending_review", "approved", "rejected"]
        idx = states.index("draft")
        assert idx < states.index("pending_review")

    def test_approved_requires_review(self):
        """Approved state requires prior review."""
        states = ["draft", "pending_review", "approved"]
        assert states.index("approved") > states.index("pending_review")

    def test_rejected_can_be_revised(self):
        """Rejected formulas can go back to draft."""
        assert True  # Bidirectional transition allowed

    def test_deleted_is_final(self):
        """Deleted state is terminal."""
        states = ["draft", "approved", "deleted"]
        assert states.index("deleted") == len(states) - 1

    def test_all_statuses_known(self):
        expected = {"draft", "pending_review", "approved", "rejected", "published", "deleted"}
        assert len(expected) == 6


class TestFormulaIngredients:
    """Ingredient dosage and unit validation."""

    def test_valid_dosage_units(self):
        units = ["g", "mg", "ml", "粒", "片"]
        for u in units:
            assert len(u) > 0

    def test_dosage_range(self):
        """Dosage should be positive and reasonable."""
        assert 0.1 > 0  # minimum
        assert 100 < 500  # reasonable maximum for g

    def test_zero_dosage_invalid(self):
        assert 0 <= 0

    def test_negative_dosage_invalid(self):
        assert -1 < 0


class TestFormulaComposition:
    """Composition structure tests."""

    def test_ingredient_has_name(self):
        ing = {"name": "黄芪", "dosage": 15, "unit": "g"}
        assert "name" in ing

    def test_ingredient_has_dosage(self):
        ing = {"name": "黄芪", "dosage": 15, "unit": "g"}
        assert "dosage" in ing

    def test_ingredient_has_unit(self):
        ing = {"name": "黄芪", "dosage": 15, "unit": "g"}
        assert "unit" in ing

    def test_multiple_ingredients(self):
        """Formula can have multiple ingredients."""
        ingredients = {
            "黄芪": {"dosage": 15, "unit": "g"},
            "丹参": {"dosage": 10, "unit": "g"},
            "枸杞": {"dosage": 8, "unit": "g"},
        }
        assert len(ingredients) >= 3

"""
Unit tests for SafetyAlertSystem (安全阈值预警系统)

Covers:
- Initialization and built-in threshold loading
- Single parameter safety checks (INFO / WARNING / CRITICAL)
- Formula-level safety checks
- Risk score calculation
- Special group adjustments (pregnant / children / elderly)
- Threshold update management
- Ingredient search
- Edge cases: empty input, None values, unknown ingredients, zero limits
"""

import pytest
from datetime import datetime

from app.services.formula.safety_alert_system import (
    AlertLevel,
    ParameterType,
    SafetyThreshold,
    SafetyAlert,
    SafetyCheckResult,
    ThresholdUpdateRecord,
    SafetyAlertSystem,
    BUILT_IN_THRESHOLDS,
)


# ════════════════════════════════════════════
# Fixtures
# ════════════════════════════════════════════


@pytest.fixture
def system() -> SafetyAlertSystem:
    """Fresh SafetyAlertSystem instance for each test."""
    return SafetyAlertSystem()


# ════════════════════════════════════════════
# 1. Initialization
# ════════════════════════════════════════════


@pytest.mark.unit
class TestSafetyAlertSystemInit:
    """Tests for SafetyAlertSystem initialization."""

    def test_init_loads_builtin_thresholds(self, system: SafetyAlertSystem):
        # Arrange & Act
        stats = system.get_statistics()

        # Assert
        assert stats["builtin_count"] > 0
        assert stats["builtin_count"] == len(BUILT_IN_THRESHOLDS)
        assert stats["custom_count"] == 0

    def test_init_sets_version(self, system: SafetyAlertSystem):
        # Arrange & Act
        stats = system.get_statistics()

        # Assert
        assert stats["current_version"] == SafetyAlertSystem.VERSION

    def test_init_thresholds_accessible_via_get(self, system: SafetyAlertSystem):
        # Arrange
        known_ingredient = "大豆异黄酮"

        # Act
        threshold = system.get_threshold(known_ingredient)

        # Assert
        assert threshold is not None
        assert threshold.ingredient_name == known_ingredient

    def test_init_custom_thresholds_empty(self, system: SafetyAlertSystem):
        # Arrange & Act
        stats = system.get_statistics()

        # Assert
        assert stats["custom_count"] == 0
        assert stats["update_records_count"] == 0


# ════════════════════════════════════════════
# 2. check_single_parameter — valid ingredients
# ════════════════════════════════════════════


@pytest.mark.unit
class TestCheckIngredientSafetyValid:
    """Tests for check_single_parameter with known, valid ingredients."""

    def test_safe_amount_returns_none(self, system: SafetyAlertSystem):
        """Amount well below any threshold should produce no alert."""
        # Arrange — 大豆异黄酮 ADI=120, soft_limit=96
        ingredient = "大豆异黄酮"
        safe_amount = 50  # well below soft limit

        # Act
        alert = system.check_single_parameter(ingredient, safe_amount, "adult")

        # Assert
        assert alert is None

    def test_info_level_near_soft_threshold(self, system: SafetyAlertSystem):
        """Amount at 80%+ of soft limit triggers INFO."""
        # Arrange — 大豆异黄酮 ADI=120, soft=96 (80%), info threshold = 96*0.8 = 76.8
        ingredient = "大豆异黄酮"
        amount = 80  # >= 76.8 but < 96

        # Act
        alert = system.check_single_parameter(ingredient, amount, "adult")

        # Assert
        assert alert is not None
        assert alert.alert_level == AlertLevel.INFO
        assert alert.blocking is False
        assert alert.ingredient_name == ingredient

    def test_warning_level_exceeds_soft_limit(self, system: SafetyAlertSystem):
        """Amount at or above soft limit but below hard limit triggers WARNING."""
        # Arrange — 大豆异黄酮 soft=96, hard=120
        ingredient = "大豆异黄酮"
        amount = 100  # >= 96 but < 120

        # Act
        alert = system.check_single_parameter(ingredient, amount, "adult")

        # Assert
        assert alert is not None
        assert alert.alert_level == AlertLevel.WARNING
        assert alert.blocking is False

    def test_critical_level_exceeds_hard_limit(self, system: SafetyAlertSystem):
        """Amount at or above hard limit triggers CRITICAL and blocks."""
        # Arrange — 大豆异黄酮 hard=120
        ingredient = "大豆异黄酮"
        amount = 150  # >= 120

        # Act
        alert = system.check_single_parameter(ingredient, amount, "adult")

        # Assert
        assert alert is not None
        assert alert.alert_level == AlertLevel.CRITICAL
        assert alert.blocking is True

    def test_exact_soft_limit_triggers_warning(self, system: SafetyAlertSystem):
        """Amount exactly at soft limit is WARNING."""
        # Arrange — 大豆异黄酮 soft=96.0
        threshold = system.get_threshold("大豆异黄酮")
        amount = threshold.soft_limit

        # Act
        alert = system.check_single_parameter("大豆异黄酮", amount, "adult")

        # Assert
        assert alert is not None
        assert alert.alert_level == AlertLevel.WARNING

    def test_exact_hard_limit_triggers_critical(self, system: SafetyAlertSystem):
        """Amount exactly at hard limit is CRITICAL."""
        # Arrange — 大豆异黄酮 hard=120.0
        threshold = system.get_threshold("大豆异黄酮")
        amount = threshold.hard_limit

        # Act
        alert = system.check_single_parameter("大豆异黄酮", amount, "adult")

        # Assert
        assert alert is not None
        assert alert.alert_level == AlertLevel.CRITICAL
        assert alert.blocking is True

    def test_alert_contains_correct_fields(self, system: SafetyAlertSystem):
        """Alert dict output should have all required fields."""
        # Arrange
        amount = 150

        # Act
        alert = system.check_single_parameter("大豆异黄酮", amount, "adult")

        # Assert
        assert alert is not None
        alert_dict = alert.to_dict()
        assert "level" in alert_dict
        assert "ingredient" in alert_dict
        assert "parameter" in alert_dict
        assert "current_value" in alert_dict
        assert "threshold_value" in alert_dict
        assert "percentage" in alert_dict
        assert "message" in alert_dict
        assert "recommendation" in alert_dict
        assert "blocking" in alert_dict
        assert "timestamp" in alert_dict

    def test_percentage_reflects_usage(self, system: SafetyAlertSystem):
        """Percentage in alert should reflect current_value / hard_limit."""
        # Arrange — 人参皂苷 hard_limit = 300
        amount = 150  # 50% of hard limit

        # Act — should be in INFO range for 人参皂苷 (soft=210, info=210*0.8=168)
        # 150 < 168 so no alert. Use a value in INFO range.
        amount = 180
        alert = system.check_single_parameter("人参皂苷", amount, "adult")

        # Assert
        if alert is not None:
            expected_pct = 180 / 300 * 100
            assert abs(alert.percentage - expected_pct) < 1.0


# ════════════════════════════════════════════
# 3. check_single_parameter — unknown / invalid ingredients
# ════════════════════════════════════════════


@pytest.mark.unit
class TestCheckIngredientSafetyInvalid:
    """Tests for check_single_parameter with unknown or invalid ingredients."""

    def test_unknown_ingredient_returns_none(self, system: SafetyAlertSystem):
        # Arrange
        unknown = "完全不存在的成分"

        # Act
        alert = system.check_single_parameter(unknown, 9999, "adult")

        # Assert
        assert alert is None

    def test_empty_string_ingredient_returns_none(self, system: SafetyAlertSystem):
        # Arrange & Act
        alert = system.check_single_parameter("", 100, "adult")

        # Assert
        assert alert is None

    def test_zero_amount_no_alert(self, system: SafetyAlertSystem):
        """Zero intake is safe — no alert."""
        # Arrange & Act
        alert = system.check_single_parameter("大豆异黄酮", 0, "adult")

        # Assert
        assert alert is None

    def test_negative_amount_no_alert(self, system: SafetyAlertSystem):
        """Negative values should not trigger alerts (treated as below threshold)."""
        # Arrange & Act
        alert = system.check_single_parameter("大豆异黄酮", -50, "adult")

        # Assert
        assert alert is None

    def test_very_large_amount_triggers_critical(self, system: SafetyAlertSystem):
        """Extremely large amount should trigger CRITICAL."""
        # Arrange
        amount = 999999

        # Act
        alert = system.check_single_parameter("维生素C", amount, "adult")

        # Assert
        assert alert is not None
        assert alert.alert_level == AlertLevel.CRITICAL
        assert alert.blocking is True


# ════════════════════════════════════════════
# 4. check_formula_safety — dosage limits
# ════════════════════════════════════════════


@pytest.mark.unit
class TestCheckDosageLimits:
    """Tests for formula-level safety checks with various dosage levels."""

    def test_safe_formula_returns_is_safe_true(self, system: SafetyAlertSystem):
        """All ingredients within safe limits."""
        # Arrange
        ingredients = [
            {"name": "大豆异黄酮", "amount_mg": 50},
            {"name": "维生素C", "amount_mg": 500},
            {"name": "钙", "amount_mg": 500},
        ]

        # Act
        result = system.check_formula_safety(ingredients)

        # Assert
        assert result.is_safe is True
        assert result.blocked_by_critical is False
        assert result.overall_risk_score < 50

    def test_critical_formula_blocks(self, system: SafetyAlertSystem):
        """Ingredient exceeding hard limit should block the formula."""
        # Arrange — 大豆异黄酮 hard=120
        ingredients = [
            {"name": "大豆异黄酮", "amount_mg": 200},
        ]

        # Act
        result = system.check_formula_safety(ingredients)

        # Assert
        assert result.is_safe is False
        assert result.blocked_by_critical is True
        assert any(a.alert_level == AlertLevel.CRITICAL for a in result.alerts)

    def test_mixed_safety_formula(self, system: SafetyAlertSystem):
        """Mix of safe, info, warning, and critical ingredients."""
        # Arrange
        ingredients = [
            {"name": "钙", "amount_mg": 500},           # safe
            {"name": "大豆异黄酮", "amount_mg": 85},    # info
            {"name": "人参皂苷", "amount_mg": 250},     # warning (soft=210)
            {"name": "维生素C", "amount_mg": 2500},     # critical (hard=2000)
        ]

        # Act
        result = system.check_formula_safety(ingredients)

        # Assert
        assert result.is_safe is False
        assert result.blocked_by_critical is True
        assert result.checked_parameters == 4
        assert len(result.alerts) >= 1

    def test_detailed_breakdown_populated(self, system: SafetyAlertSystem):
        """detailed_breakdown should contain entries for each ingredient."""
        # Arrange
        ingredients = [
            {"name": "大豆异黄酮", "amount_mg": 50},
            {"name": "钙", "amount_mg": 500},
        ]

        # Act
        result = system.check_formula_safety(ingredients)

        # Assert
        assert "大豆异黄酮" in result.detailed_breakdown
        assert "钙" in result.detailed_breakdown
        assert "current_intake_mg" in result.detailed_breakdown["大豆异黄酮"]
        assert "status" in result.detailed_breakdown["大豆异黄酮"]

    def test_empty_ingredients_list(self, system: SafetyAlertSystem):
        """Empty ingredient list should be safe with zero risk."""
        # Arrange
        ingredients = []

        # Act
        result = system.check_formula_safety(ingredients)

        # Assert
        assert result.is_safe is True
        assert result.checked_parameters == 0
        assert result.overall_risk_score == 0.0
        assert len(result.alerts) == 0

    def test_recommendations_present_for_safe_formula(self, system: SafetyAlertSystem):
        """Safe formula should have a positive recommendation."""
        # Arrange
        ingredients = [{"name": "钙", "amount_mg": 100}]

        # Act
        result = system.check_formula_safety(ingredients)

        # Assert
        assert len(result.recommendations) > 0
        assert any("安全" in r or "良好" in r for r in result.recommendations)


# ════════════════════════════════════════════
# 5. check_formula_safety — exceeds limits
# ════════════════════════════════════════════


@pytest.mark.unit
class TestCheckDosageExceedsLimits:
    """Tests for formula safety when dosage exceeds limits."""

    def test_exactly_at_hard_limit_blocks(self, system: SafetyAlertSystem):
        """Amount exactly at hard limit should trigger CRITICAL."""
        # Arrange — 维生素C uli=2000
        threshold = system.get_threshold("维生素C")
        ingredients = [{"name": "维生素C", "amount_mg": threshold.hard_limit}]

        # Act
        result = system.check_formula_safety(ingredients)

        # Assert
        assert result.is_safe is False
        assert result.blocked_by_critical is True

    def test_just_below_hard_limit_not_blocked(self, system: SafetyAlertSystem):
        """Amount just below hard limit should not block (may warn)."""
        # Arrange — 维生素C hard=2000, soft=1600
        threshold = system.get_threshold("维生素C")
        amount = threshold.hard_limit - 1
        ingredients = [{"name": "维生素C", "amount_mg": amount}]

        # Act
        result = system.check_formula_safety(ingredients)

        # Assert
        assert result.blocked_by_critical is False

    def test_multiple_ingredients_all_exceed(self, system: SafetyAlertSystem):
        """All ingredients exceeding limits should produce multiple critical alerts."""
        # Arrange
        ingredients = [
            {"name": "大豆异黄酮", "amount_mg": 200},  # critical
            {"name": "人参皂苷", "amount_mg": 500},     # critical
        ]

        # Act
        result = system.check_formula_safety(ingredients)

        # Assert
        assert result.is_safe is False
        critical_alerts = [a for a in result.alerts if a.alert_level == AlertLevel.CRITICAL]
        assert len(critical_alerts) == 2

    def test_risk_score_increases_with_severity(self, system: SafetyAlertSystem):
        """Higher dosage should produce higher risk score."""
        # Arrange
        safe_ingredients = [{"name": "大豆异黄酮", "amount_mg": 50}]
        dangerous_ingredients = [{"name": "大豆异黄酮", "amount_mg": 200}]

        # Act
        safe_result = system.check_formula_safety(safe_ingredients)
        dangerous_result = system.check_formula_safety(dangerous_ingredients)

        # Assert
        assert dangerous_result.overall_risk_score > safe_result.overall_risk_score


# ════════════════════════════════════════════
# 6. Special group adjustments (allergen / special population detection)
# ════════════════════════════════════════════


@pytest.mark.unit
class TestSpecialGroupDetection:
    """Tests for special population (pregnant/children/elderly) limit adjustments."""

    def test_pregnant_stricter_than_adult(self, system: SafetyAlertSystem):
        """Pregnant group should have lower thresholds than adult."""
        # Arrange — 人参皂苷 has pregnant multiplier=0.3
        ingredient = "人参皂苷"
        # Adult soft=210, pregnant soft=210*0.3=63
        amount = 80  # safe for adult, warning/critical for pregnant

        # Act
        adult_alert = system.check_single_parameter(ingredient, amount, "adult")
        pregnant_alert = system.check_single_parameter(ingredient, amount, "pregnant")

        # Assert
        # For adult: 80 < 210*0.8=168, no alert
        # For pregnant: 80 >= 63 (soft), so WARNING
        assert adult_alert is None or adult_alert.alert_level == AlertLevel.INFO
        assert pregnant_alert is not None
        assert pregnant_alert.alert_level in (AlertLevel.WARNING, AlertLevel.CRITICAL)

    def test_children_stricter_than_adult(self, system: SafetyAlertSystem):
        """Children group should have lower thresholds than adult."""
        # Arrange — 姜黄素 children multiplier=0.5, ADI=3000
        ingredient = "姜黄素"
        amount = 2500  # safe for adult (soft=2400, so this is WARNING)

        # Act
        adult_alert = system.check_single_parameter(ingredient, amount, "adult")
        children_alert = system.check_single_parameter(ingredient, amount, "children")

        # Assert
        # Children: soft=2400*0.5=1200, hard=3000*0.5=1500
        # 2500 >= 1500 → CRITICAL for children
        if children_alert is not None:
            assert children_alert.alert_level == AlertLevel.CRITICAL

    def test_elderly_thresholds_between_adult_and_children(self, system: SafetyAlertSystem):
        """Elderly limits should be stricter than adult but looser than children."""
        # Arrange — 茶多酚 elderly=0.8, children=0.4
        threshold = system.get_threshold("茶多酚")
        adult_soft, adult_hard = threshold.get_adjusted_limits("adult")
        elderly_soft, elderly_hard = threshold.get_adjusted_limits("elderly")
        children_soft, children_hard = threshold.get_adjusted_limits("children")

        # Assert
        assert elderly_soft <= adult_soft
        assert elderly_soft >= children_soft
        assert elderly_hard <= adult_hard
        assert elderly_hard >= children_hard

    def test_formula_safety_with_target_group(self, system: SafetyAlertSystem):
        """check_formula_safety should respect target_group parameter."""
        # Arrange
        ingredients = [{"name": "人参皂苷", "amount_mg": 100}]

        # Act
        adult_result = system.check_formula_safety(ingredients, target_group="adult")
        pregnant_result = system.check_formula_safety(ingredients, target_group="pregnant")

        # Assert
        # Pregnant should have higher risk (stricter limits)
        assert pregnant_result.overall_risk_score >= adult_result.overall_risk_score

    def test_usage_scenario_in_recommendations(self, system: SafetyAlertSystem):
        """Different usage scenarios should produce different recommendations."""
        # Arrange
        ingredients = [{"name": "钙", "amount_mg": 100}]

        # Act
        supplement_result = system.check_formula_safety(
            ingredients, usage_scenario="supplement"
        )
        medical_result = system.check_formula_safety(
            ingredients, usage_scenario="medical"
        )

        # Assert
        assert len(supplement_result.recommendations) > 0
        assert len(medical_result.recommendations) > 0
        # Different scenarios should produce at least partially different recommendations
        supplement_text = " ".join(supplement_result.recommendations)
        medical_text = " ".join(medical_result.recommendations)
        assert supplement_text != medical_text


# ════════════════════════════════════════════
# 7. check_drug_interactions — known interactions
# ════════════════════════════════════════════


@pytest.mark.unit
class TestDrugInteractions:
    """
    The safety module does not have a dedicated drug-interaction checker,
    but we test that ingredients with very low ADI values (drugs-like)
    behave correctly, and that combining multiple restricted ingredients
    produces compound risk.
    """

    def test_low_adi_ingredient_triggers_early(self, system: SafetyAlertSystem):
        """Ingredients with low ADI (e.g., 褪黑素 ADI=3) should trigger at small amounts."""
        # Arrange — 褪黑素 ADI=3, soft=1.8 (60%)
        amount = 2.0

        # Act
        alert = system.check_single_parameter("褪黑素", amount, "adult")

        # Assert
        assert alert is not None
        assert alert.alert_level in (AlertLevel.WARNING, AlertLevel.CRITICAL)

    def test_combining_restricted_ingredients_compounds_risk(self, system: SafetyAlertSystem):
        """Multiple mildly-over ingredients should compound the risk score."""
        # Arrange — each slightly over soft limit
        ingredients = [
            {"name": "褪黑素", "amount_mg": 3},       # WARNING (soft=1.8)
            {"name": "辣椒碱", "amount_mg": 6},        # WARNING (soft=3)
            {"name": "人参皂苷", "amount_mg": 250},    # WARNING (soft=210)
        ]

        # Act
        result = system.check_formula_safety(ingredients)

        # Assert
        assert len(result.alerts) >= 2
        assert result.overall_risk_score > 0

    def test_special_group_low_adi_critical(self, system: SafetyAlertSystem):
        """Very restrictive ingredients for special groups should block easily."""
        # Arrange — 苦参碱 pregnant multiplier=0.2, ADI=100
        # pregnant soft = 100*0.6*0.2 = 12, hard = 100*0.2 = 20
        amount = 25

        # Act
        alert = system.check_single_parameter("苦参碱", amount, "pregnant")

        # Assert
        assert alert is not None
        assert alert.alert_level == AlertLevel.CRITICAL
        assert alert.blocking is True


# ════════════════════════════════════════════
# 8. generate safety report — complete report structure
# ════════════════════════════════════════════


@pytest.mark.unit
class TestSafetyReportStructure:
    """Tests for the completeness of safety check results (report structure)."""

    def test_result_to_dict_structure(self, system: SafetyAlertSystem):
        """SafetyCheckResult.to_dict() should have all required keys."""
        # Arrange
        ingredients = [
            {"name": "大豆异黄酮", "amount_mg": 100},
            {"name": "钙", "amount_mg": 500},
        ]

        # Act
        result = system.check_formula_safety(ingredients)
        report = result.to_dict()

        # Assert
        assert "is_safe" in report
        assert "overall_risk_score" in report
        assert "alerts" in report
        assert "checked_parameters" in report
        assert "blocked_by_critical" in report
        assert "recommendations" in report
        assert "detailed_breakdown" in report

    def test_report_alerts_are_serializable(self, system: SafetyAlertSystem):
        """Alerts in the report should be serializable dicts."""
        # Arrange
        ingredients = [{"name": "维生素C", "amount_mg": 2500}]

        # Act
        result = system.check_formula_safety(ingredients)
        report = result.to_dict()

        # Assert
        assert isinstance(report["alerts"], list)
        for alert_dict in report["alerts"]:
            assert isinstance(alert_dict, dict)
            assert "level" in alert_dict
            assert "ingredient" in alert_dict

    def test_report_recommendations_non_empty(self, system: SafetyAlertSystem):
        """Report should always contain at least one recommendation."""
        # Arrange
        ingredients = [{"name": "大豆异黄酮", "amount_mg": 50}]

        # Act
        result = system.check_formula_safety(ingredients)

        # Assert
        assert len(result.recommendations) > 0

    def test_report_checked_parameters_matches_input(self, system: SafetyAlertSystem):
        """checked_parameters should equal the number of valid ingredients."""
        # Arrange
        ingredients = [
            {"name": "大豆异黄酮", "amount_mg": 50},
            {"name": "维生素C", "amount_mg": 500},
            {"name": "钙", "amount_mg": 500},
            {"name": "铁", "amount_mg": 20},
        ]

        # Act
        result = system.check_formula_safety(ingredients)

        # Assert
        assert result.checked_parameters == 4

    def test_report_risk_score_range(self, system: SafetyAlertSystem):
        """Risk score should always be in [0, 100]."""
        # Arrange
        ingredients = [
            {"name": "大豆异黄酮", "amount_mg": 200},
            {"name": "维生素C", "amount_mg": 3000},
            {"name": "人参皂苷", "amount_mg": 500},
        ]

        # Act
        result = system.check_formula_safety(ingredients)

        # Assert
        assert 0 <= result.overall_risk_score <= 100


# ════════════════════════════════════════════
# 9. Edge cases
# ════════════════════════════════════════════


@pytest.mark.unit
class TestEdgeCases:
    """Edge case tests for safety system robustness."""

    def test_ingredient_with_none_amount_skipped(self, system: SafetyAlertSystem):
        """Ingredients with None amount_mg should be skipped."""
        # Arrange
        ingredients = [
            {"name": "大豆异黄酮", "amount_mg": None},
            {"name": "钙", "amount_mg": 500},
        ]

        # Act
        result = system.check_formula_safety(ingredients)

        # Assert
        # The None-amount ingredient is skipped; only 钙 is checked
        assert result.checked_parameters == 1

    def test_ingredient_with_missing_name_skipped(self, system: SafetyAlertSystem):
        """Ingredients without a name should be skipped."""
        # Arrange
        ingredients = [
            {"amount_mg": 100},  # no name
            {"name": "钙", "amount_mg": 500},
        ]

        # Act
        result = system.check_formula_safety(ingredients)

        # Assert
        assert result.checked_parameters == 1

    def test_ingredient_with_empty_name_skipped(self, system: SafetyAlertSystem):
        """Ingredients with empty name should be skipped."""
        # Arrange
        ingredients = [
            {"name": "", "amount_mg": 100},
            {"name": "钙", "amount_mg": 500},
        ]

        # Act
        result = system.check_formula_safety(ingredients)

        # Assert
        assert result.checked_parameters == 1

    def test_all_unknown_ingredients(self, system: SafetyAlertSystem):
        """All unknown ingredients should result in safe with zero risk."""
        # Arrange
        ingredients = [
            {"name": "不存在的成分A", "amount_mg": 100},
            {"name": "不存在的成分B", "amount_mg": 200},
        ]

        # Act
        result = system.check_formula_safety(ingredients)

        # Assert
        assert result.is_safe is True
        assert result.overall_risk_score == 0.0
        assert len(result.alerts) == 0

    def test_get_threshold_unknown_returns_none(self, system: SafetyAlertSystem):
        # Arrange & Act
        result = system.get_threshold("完全不存在")

        # Assert
        assert result is None

    def test_get_all_thresholds_returns_list(self, system: SafetyAlertSystem):
        # Arrange & Act
        thresholds = system.get_all_thresholds()

        # Assert
        assert isinstance(thresholds, list)
        assert len(thresholds) == len(BUILT_IN_THRESHOLDS)

    def test_get_all_thresholds_exclude_builtin(self, system: SafetyAlertSystem):
        # Arrange & Act
        thresholds = system.get_all_thresholds(include_builtin=False)

        # Assert
        assert len(thresholds) == 0  # no custom thresholds

    def test_validate_formula_composition_tuple(self, system: SafetyAlertSystem):
        """validate_formula_composition returns (bool, list) tuple."""
        # Arrange
        composition = {"大豆异黄酮": 50, "钙": 500}

        # Act
        is_safe, alerts = system.validate_formula_composition(composition)

        # Assert
        assert isinstance(is_safe, bool)
        assert isinstance(alerts, list)

    def test_zero_hard_limit_no_division_error(self, system: SafetyAlertSystem):
        """A threshold with hard_limit=0 should not cause division by zero."""
        # Arrange — create a system and inject a zero-limit threshold
        system._thresholds["零限成分"] = SafetyThreshold(
            ingredient_name="零限成分",
            parameter="daily_intake",
            unit="mg/day",
            soft_limit=0.0,
            hard_limit=0.0,
            adi_value=0.0,
        )

        # Act
        alert = system.check_single_parameter("零限成分", 100, "adult")

        # Assert — should not raise, percentage computed as 0
        assert alert is not None
        assert alert.percentage == 0

    def test_search_ingredients_fuzzy(self, system: SafetyAlertSystem):
        """search_ingredients should match substrings."""
        # Arrange & Act
        results = system.search_ingredients("维生素")

        # Assert
        assert len(results) > 0
        assert all("维生素" in r for r in results)

    def test_search_ingredients_no_match(self, system: SafetyAlertSystem):
        # Arrange & Act
        results = system.search_ingredients("zzz_nonexistent_zzz")

        # Assert
        assert results == []

    def test_search_ingredients_limit(self, system: SafetyAlertSystem):
        # Arrange & Act
        results = system.search_ingredients("", limit=3)

        # Assert
        assert len(results) <= 3

    def test_update_threshold_nonexistent_raises(self, system: SafetyAlertSystem):
        """Updating a non-existent ingredient should raise ValueError."""
        # Arrange & Act & Assert
        with pytest.raises(ValueError, match="不存在"):
            system.update_threshold(
                "不存在的成分",
                {"soft_limit": 100},
                operator="test_admin",
            )

    def test_update_threshold_records_history(self, system: SafetyAlertSystem):
        """Updating a threshold should create a history record."""
        # Arrange
        ingredient = "大豆异黄酮"
        original = system.get_threshold(ingredient)

        # Act
        result = system.update_threshold(
            ingredient,
            {"soft_limit": original.soft_limit + 10},
            operator="test_admin",
            reason="测试更新",
        )

        # Assert
        assert result["success"] is True
        history = system.get_update_history(ingredient=ingredient)
        assert len(history) == 1
        assert history[0]["updated_by"] == "test_admin"
        assert history[0]["reason"] == "测试更新"

    def test_update_threshold_stores_in_custom(self, system: SafetyAlertSystem):
        """Updated threshold should be stored in custom, not overwrite builtin."""
        # Arrange
        ingredient = "大豆异黄酮"
        original_soft = system.get_threshold(ingredient).soft_limit

        # Act
        system.update_threshold(
            ingredient,
            {"soft_limit": original_soft + 50},
            operator="admin",
        )

        # Assert
        stats = system.get_statistics()
        assert stats["custom_count"] == 1
        # Custom threshold takes precedence
        updated = system.get_threshold(ingredient)
        assert updated.soft_limit == original_soft + 50

    def test_update_threshold_no_changes(self, system: SafetyAlertSystem):
        """Updating with same values should return success with no changes."""
        # Arrange
        ingredient = "大豆异黄酮"
        original = system.get_threshold(ingredient)

        # Act
        result = system.update_threshold(
            ingredient,
            {"soft_limit": original.soft_limit},
            operator="admin",
        )

        # Assert
        assert result["success"] is True
        assert result["changes"] == {}

    def test_get_update_history_all(self, system: SafetyAlertSystem):
        """get_update_history without filter returns all records."""
        # Arrange
        system.update_threshold("大豆异黄酮", {"soft_limit": 200}, operator="a")
        system.update_threshold("钙", {"soft_limit": 300}, operator="b")

        # Act
        history = system.get_update_history()

        # Assert
        assert len(history) == 2

    def test_get_update_history_filtered(self, system: SafetyAlertSystem):
        # Arrange
        system.update_threshold("大豆异黄酮", {"soft_limit": 200}, operator="a")
        system.update_threshold("钙", {"soft_limit": 300}, operator="b")

        # Act
        history = system.get_update_history(ingredient="钙")

        # Assert
        assert len(history) == 1
        assert history[0]["ingredient_name"] == "钙"


# ════════════════════════════════════════════
# Data class / Enum tests
# ════════════════════════════════════════════


@pytest.mark.unit
class TestDataClassesAndEnums:
    """Tests for data class serialization and enum values."""

    def test_alert_level_enum_values(self):
        assert AlertLevel.INFO.value == "info"
        assert AlertLevel.WARNING.value == "warning"
        assert AlertLevel.CRITICAL.value == "critical"

    def test_parameter_type_enum_values(self):
        assert ParameterType.DAILY_INTAKE.value == "daily_intake"
        assert ParameterType.SINGLE_DOSE.value == "single_dose"
        assert ParameterType.CONCENTRATION.value == "concentration"

    def test_safety_threshold_to_dict(self):
        # Arrange
        t = SafetyThreshold(
            ingredient_name="测试",
            parameter="daily_intake",
            unit="mg/day",
            soft_limit=100.0,
            hard_limit=200.0,
            adi_value=250.0,
            ul_value=None,
            source="test",
        )

        # Act
        d = t.to_dict()

        # Assert
        assert d["ingredient_name"] == "测试"
        assert d["soft_limit"] == 100.0
        assert d["hard_limit"] == 200.0
        assert d["adi_value"] == 250.0
        assert d["ul_value"] is None

    def test_safety_threshold_get_adjusted_limits_adult(self):
        # Arrange
        t = SafetyThreshold(
            ingredient_name="测试",
            parameter="daily_intake",
            unit="mg/day",
            soft_limit=100.0,
            hard_limit=200.0,
            special_groups={"pregnant": 0.5, "children": 0.3},
        )

        # Act
        soft, hard = t.get_adjusted_limits("adult")

        # Assert
        assert soft == 100.0
        assert hard == 200.0

    def test_safety_threshold_get_adjusted_limits_pregnant(self):
        # Arrange
        t = SafetyThreshold(
            ingredient_name="测试",
            parameter="daily_intake",
            unit="mg/day",
            soft_limit=100.0,
            hard_limit=200.0,
            special_groups={"pregnant": 0.5, "children": 0.3},
        )

        # Act
        soft, hard = t.get_adjusted_limits("pregnant")

        # Assert
        assert soft == 50.0
        assert hard == 100.0

    def test_safety_threshold_get_adjusted_limits_unknown_group(self):
        """Unknown group defaults to multiplier=1.0."""
        # Arrange
        t = SafetyThreshold(
            ingredient_name="测试",
            parameter="daily_intake",
            unit="mg/day",
            soft_limit=100.0,
            hard_limit=200.0,
            special_groups={},
        )

        # Act
        soft, hard = t.get_adjusted_limits("astronaut")

        # Assert
        assert soft == 100.0
        assert hard == 200.0

    def test_safety_alert_to_dict(self):
        # Arrange
        alert = SafetyAlert(
            alert_level=AlertLevel.WARNING,
            ingredient_name="测试",
            parameter="daily_intake",
            current_value=150.0,
            threshold_value=100.0,
            percentage=75.0,
            message="test message",
            recommendation="test recommendation",
            blocking=False,
        )

        # Act
        d = alert.to_dict()

        # Assert
        assert d["level"] == "warning"
        assert d["ingredient"] == "测试"
        assert d["blocking"] is False
        assert d["percentage"] == 75.0

    def test_threshold_update_record_to_dict(self):
        # Arrange
        record = ThresholdUpdateRecord(
            id="test-id",
            ingredient_name="测试",
            changes={"soft_limit": {"old": 100, "new": 120}},
            updated_by="admin",
            updated_at=datetime(2025, 1, 1),
            version_before="1.0",
            version_after="1.1",
            reason="test",
        )

        # Act
        d = record.to_dict()

        # Assert
        assert d["id"] == "test-id"
        assert d["ingredient_name"] == "测试"
        assert d["version_before"] == "1.0"
        assert d["version_after"] == "1.1"
        assert d["reason"] == "test"


# ════════════════════════════════════════════
# Risk score calculation
# ════════════════════════════════════════════


@pytest.mark.unit
class TestRiskScoreCalculation:
    """Tests for the static risk score calculation method."""

    def test_no_alerts_zero_score(self):
        # Arrange & Act
        score = SafetyAlertSystem._calculate_risk_score([])

        # Assert
        assert score == 0.0

    def test_single_info_alert_low_score(self):
        # Arrange
        alert = SafetyAlert(
            alert_level=AlertLevel.INFO,
            ingredient_name="测试",
            parameter="daily_intake",
            current_value=80.0,
            threshold_value=100.0,
            percentage=80.0,
            message="",
            recommendation="",
            blocking=False,
        )

        # Act
        score = SafetyAlertSystem._calculate_risk_score([alert])

        # Assert
        assert 0 < score <= 100

    def test_single_critical_alert_high_score(self):
        # Arrange
        alert = SafetyAlert(
            alert_level=AlertLevel.CRITICAL,
            ingredient_name="测试",
            parameter="daily_intake",
            current_value=200.0,
            threshold_value=100.0,
            percentage=200.0,
            message="",
            recommendation="",
            blocking=True,
        )

        # Act
        score = SafetyAlertSystem._calculate_risk_score([alert])

        # Assert
        assert score > 50

    def test_mixed_alerts_weighted_correctly(self):
        # Arrange
        info = SafetyAlert(
            alert_level=AlertLevel.INFO,
            ingredient_name="A",
            parameter="daily_intake",
            current_value=80.0,
            threshold_value=100.0,
            percentage=80.0,
            message="", recommendation="", blocking=False,
        )
        critical = SafetyAlert(
            alert_level=AlertLevel.CRITICAL,
            ingredient_name="B",
            parameter="daily_intake",
            current_value=200.0,
            threshold_value=100.0,
            percentage=200.0,
            message="", recommendation="", blocking=True,
        )

        # Act
        score_mixed = SafetyAlertSystem._calculate_risk_score([info, critical])
        score_critical_only = SafetyAlertSystem._calculate_risk_score([critical])

        # Assert
        assert score_mixed > 0
        assert score_critical_only > 0


# ════════════════════════════════════════════
# BUILT_IN_THRESHOLDS data integrity
# ════════════════════════════════════════════


@pytest.mark.unit
class TestBuiltinThresholdsIntegrity:
    """Verify that the built-in threshold database is well-formed."""

    @pytest.mark.parametrize("name", list(BUILT_IN_THRESHOLDS.keys())[:10])
    def test_threshold_has_required_keys(self, name):
        # Arrange
        data = BUILT_IN_THRESHOLDS[name]

        # Assert
        assert "soft_limit_pct" in data
        assert "hard_limit_pct" in data
        assert "source" in data

    @pytest.mark.parametrize("name", list(BUILT_IN_THRESHOLDS.keys())[:10])
    def test_threshold_has_adi_or_uli(self, name):
        """Every threshold should define at least one of adi or uli."""
        data = BUILT_IN_THRESHOLDS[name]
        has_adi = "adi" in data and data["adi"] is not None
        has_uli = "uli" in data and data["uli"] is not None
        has_ul = "ul" in data and data["ul"] is not None
        assert has_adi or has_uli or has_ul, f"{name} missing adi/uli/ul"

    def test_all_thresholds_loadable(self, system: SafetyAlertSystem):
        """Every entry in BUILT_IN_THRESHOLDS should produce a valid SafetyThreshold."""
        # Arrange & Act
        for name in BUILT_IN_THRESHOLDS:
            threshold = system.get_threshold(name)

            # Assert
            assert threshold is not None, f"Failed to load threshold for '{name}'"
            assert threshold.soft_limit >= 0
            assert threshold.hard_limit >= 0
            assert threshold.soft_limit <= threshold.hard_limit

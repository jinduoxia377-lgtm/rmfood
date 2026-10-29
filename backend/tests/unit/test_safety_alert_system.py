"""app/services/formula/safety_alert_system 单元测试

覆盖安全预警系统的阈值查询、成分搜索、统计与配方安全检查。
"""

from app.services.formula.safety_alert_system import SafetyAlertSystem
from app.services.formula.safety_alert_system.types import (
    AlertLevel,
    ParameterType,
    SafetyThreshold,
    SafetyCheckResult,
)


class TestTypes:
    def test_alert_level_values(self):
        assert AlertLevel.INFO.value == "info"
        assert AlertLevel.WARNING.value == "warning"
        assert AlertLevel.CRITICAL.value == "critical"

    def test_parameter_type_values(self):
        assert ParameterType.DAILY_INTAKE.value == "daily_intake"
        assert ParameterType.SINGLE_DOSE.value == "single_dose"
        assert ParameterType.CONCENTRATION.value == "concentration"

    def test_safety_threshold_dataclass(self):
        t = SafetyThreshold(
            ingredient_name="测试",
            parameter="daily_intake",
            unit="mg/day",
            soft_limit=100.0,
            hard_limit=200.0,
        )
        d = t.to_dict()
        assert d["ingredient_name"] == "测试"
        assert d["soft_limit"] == 100.0


class TestSafetyAlertSystem:
    def test_get_threshold(self):
        system = SafetyAlertSystem()
        t = system.get_threshold("人参")
        assert t is None or isinstance(t, SafetyThreshold)

    def test_get_all_thresholds(self):
        system = SafetyAlertSystem()
        thresholds = system.get_all_thresholds()
        assert isinstance(thresholds, list)

    def test_get_statistics(self):
        system = SafetyAlertSystem()
        stats = system.get_statistics()
        assert isinstance(stats, dict)

    def test_search_ingredients(self):
        system = SafetyAlertSystem()
        results = system.search_ingredients("人")
        assert isinstance(results, list)

    def test_check_formula_safety(self):
        system = SafetyAlertSystem()
        result = system.check_formula_safety(
            [{"name": "大豆异黄酮", "amount_mg": 80, "percentage": 15}]
        )
        assert isinstance(result, SafetyCheckResult)
        assert hasattr(result, "alerts")
        assert hasattr(result, "overall_risk_score")

    def test_check_formula_safety_empty(self):
        system = SafetyAlertSystem()
        result = system.check_formula_safety([])
        assert isinstance(result, SafetyCheckResult)

    def test_validate_formula_composition(self):
        system = SafetyAlertSystem()
        result = system.validate_formula_composition({"大豆异黄酮": 80})
        assert isinstance(result, tuple)
        assert len(result) == 2
        assert isinstance(result[0], bool)
"""app/services/formula/compatibility_checker.py 单元测试

覆盖 4 层兼容性检测的主流程与报告对象。
"""
import pytest

from app.services.formula.compatibility_checker import (
    CompatibilityChecker,
    CompatibilityIssue,
    CompatibilityReport,
    IssueLevel,
    CheckCategory,
)


def _checker():
    return CompatibilityChecker()


class TestCompatibilityReport:
    def test_report_counters(self):
        report = CompatibilityReport(
            overall_score=80.0,
            issues=[],
            passed_checks=5,
            total_checks=10,
            recommendations=["建议"],
            formula_id="F1",
        )
        assert report.error_count == 0
        assert report.warning_count == 0
        assert report.info_count == 0

    def test_issue_dataclass(self):
        issue = CompatibilityIssue(
            level=IssueLevel.ERROR,
            category=CheckCategory.CHEMICAL,
            description="冲突",
            scientific_basis="依据",
            suggestion="建议",
        )
        assert issue.level == IssueLevel.ERROR
        assert issue.category == CheckCategory.CHEMICAL


class TestCompatibilityChecker:
    def test_empty_ingredients(self):
        report = _checker().check_compatibility([])
        assert report.total_checks >= 0
        assert report.overall_score >= 0
        assert isinstance(report.recommendations, list)

    def test_single_ingredient(self):
        report = _checker().check_compatibility(
            [{"name": "人参", "amount_mg": 100, "percentage": 100}]
        )
        assert report.total_checks > 0
        assert 0 <= report.overall_score <= 100

    def test_two_ingredients(self):
        report = _checker().check_compatibility([
            {"name": "人参", "amount_mg": 50, "percentage": 50},
            {"name": "黄芪", "amount_mg": 50, "percentage": 50},
        ])
        assert report.total_checks > 0
        assert report.passed_checks >= 0

    def test_target_population_pregnant(self):
        report = _checker().check_compatibility(
            [{"name": "人参", "amount_mg": 100, "percentage": 100}],
            target_population="pregnant",
        )
        assert report.total_checks > 0

    def test_formula_id_passthrough(self):
        report = _checker().check_compatibility(
            [{"name": "枸杞", "amount_mg": 100, "percentage": 100}],
            formula_id="RMF-TEST-001",
        )
        assert report.formula_id == "RMF-TEST-001"
"""app/services/formula_validation_workflow.py 数据模型单元测试

覆盖验证工作流的阶段/结论枚举与结果模型（无需数据库）。
"""
from datetime import datetime, timezone

from app.services.formula_validation_workflow import (
    ValidationStage,
    ValidationOutcome,
    StageResult,
    ComparisonPoint,
    FormulaValidationResult,
)


class TestEnums:
    def test_validation_stage_values(self):
        assert ValidationStage.SAFETY_CHECK.value == "safety_check"
        assert ValidationStage.COMPATIBILITY_CHECK.value == "compatibility_check"
        assert ValidationStage.FINAL_REPORT.value == "final_report"

    def test_validation_outcome_values(self):
        assert ValidationOutcome.PASSED.value == "passed"
        assert ValidationOutcome.FAILED.value == "failed"
        assert ValidationOutcome.CONDITIONAL.value == "conditional"
        assert ValidationOutcome.INCONCLUSIVE.value == "inconclusive"


class TestStageResult:
    def test_to_dict(self):
        result = StageResult(
            stage=ValidationStage.SAFETY_CHECK,
            success=True,
            score=95.5,
            passed=True,
            latency_ms=12.345,
            started_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            completed_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        d = result.to_dict()
        assert d["stage"] == "safety_check"
        assert d["score"] == 95.5
        assert d["passed"] is True
        assert d["latency_ms"] == 12.3
        assert d["started_at"] is not None

    def test_to_dict_without_timestamps(self):
        result = StageResult(stage=ValidationStage.SAFETY_CHECK, success=False)
        d = result.to_dict()
        assert d["started_at"] is None
        assert d["completed_at"] is None


class TestComparisonPoint:
    def test_to_dict(self):
        point = ComparisonPoint(
            parameter="pH",
            unit="",
            predicted_value=7.0,
            predicted_range=(6.5, 7.5),
            measured_value=6.8,
            within_tolerance=True,
        )
        d = point.to_dict()
        assert d["parameter"] == "pH"
        assert d["predicted_value"] == 7.0
        assert d["predicted_range"] == [6.5, 7.5]
        assert d["measured_value"] == 6.8

    def test_to_dict_without_measured(self):
        point = ComparisonPoint(
            parameter="pH", unit="", predicted_value=7.0, predicted_range=(6.5, 7.5)
        )
        d = point.to_dict()
        assert d["measured_value"] is None
        assert d["measured_range"] is None


class TestFormulaValidationResult:
    def _make_result(self):
        return FormulaValidationResult(
            formula_id=1,
            formula_name="测试配方",
            validation_id="V-001",
            overall_score=80.0,
            outcome=ValidationOutcome.PASSED,
            stages=[
                StageResult(
                    stage=ValidationStage.SAFETY_CHECK,
                    success=True,
                    score=90.0,
                    passed=True,
                    latency_ms=10.0,
                ),
                StageResult(
                    stage=ValidationStage.TASTE_PREDICTION,
                    success=True,
                    score=70.0,
                    passed=False,
                    latency_ms=20.0,
                ),
            ],
        )

    def test_stage_scores(self):
        result = self._make_result()
        scores = result.stage_scores
        assert scores["safety_check"] == 90.0
        assert scores["taste_prediction"] == 70.0

    def test_failed_stages(self):
        result = self._make_result()
        assert result.failed_stages == ["taste_prediction"]

    def test_total_latency_ms(self):
        result = self._make_result()
        assert result.total_latency_ms == 30.0

    def test_to_dict(self):
        d = self._make_result().to_dict()
        assert d["validation_id"] == "V-001"
        assert d["outcome"] == "passed"
        assert len(d["stages"]) == 2
        assert d["total_latency_ms"] == 30.0
        assert d["failed_stages"] == ["taste_prediction"]
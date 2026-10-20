"""app/services/formula/effect_simulator.py 单元测试

覆盖效果预测模拟器的入口与结果模型。
"""
import pytest

from app.services.formula.effect_simulator import EffectSimulator, EffectPrediction, TimePoint


class TestEffectPrediction:
    def test_timepoint_dataclass(self):
        tp = TimePoint(time_hour=0.0, concentration=1.0, effect_level=0.5)
        assert tp.time_hour == 0.0
        assert tp.concentration == 1.0

    def test_auc_zero_for_empty(self):
        pred = EffectPrediction(
            formula_id="F",
            ct_curve=[],
            et_curve=[],
            peak_time=0.0,
            peak_concentration=0.0,
            max_effect=0.0,
            effect_duration=0.0,
            optimal_window=(0.0, 0.0),
        )
        assert pred.auc == 0


class TestEffectSimulator:
    def test_predict_empty_ingredients(self):
        sim = EffectSimulator()
        pred = sim.predict_effect([])
        assert isinstance(pred, EffectPrediction)
        assert pred.auc >= 0

    def test_predict_unknown_ingredient(self):
        sim = EffectSimulator()
        pred = sim.predict_effect([{"name": "不存在的成分", "amount_mg": 100}])
        assert isinstance(pred, EffectPrediction)

    def test_predict_known_ingredient(self):
        sim = EffectSimulator()
        pred = sim.predict_effect([{"name": "人参", "amount_mg": 100, "percentage": 100}])
        assert isinstance(pred, EffectPrediction)
        assert pred.auc >= 0
        assert hasattr(pred, "ct_curve")

    def test_predict_with_formula_id(self):
        sim = EffectSimulator()
        pred = sim.predict_effect([], formula_id="F-TEST-001")
        assert pred.formula_id == "F-TEST-001"

    def test_predict_with_db_overrides(self):
        sim = EffectSimulator()
        pred = sim.predict_effect(
            [{"name": "自定义成分", "amount_mg": 100}],
            db_overrides={"自定义成分": {"pk": {"F": 0.5}, "pd": {"E_max": 0.8}}},
        )
        assert isinstance(pred, EffectPrediction)
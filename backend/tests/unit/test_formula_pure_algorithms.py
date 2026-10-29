"""app/services/formula 纯算法模块单元测试

覆盖:
- stability_predictor: 稳定性预测
- flavor_engine: 调味设计
- coordination_engine: 配方协调分析（君臣佐使）
- synergy_engine: 协同作用分析（统一接口）
"""

from app.services.formula.stability_predictor import StabilityPredictor
from app.services.formula.flavor_engine import FlavorEngine
from app.services.formula.coordination_engine import CoordinationEngine, get_coordination_engine
from app.services.formula.synergy_engine import SynergyEngine


class TestStabilityPredictor:
    def test_predict_empty_ingredients(self):
        predictor = StabilityPredictor()
        result = predictor.predict_stability([])
        assert result.stability_score >= 0

    def test_predict_basic(self):
        predictor = StabilityPredictor()
        result = predictor.predict_stability(
            [{"name": "维生素C", "percentage": 50}, {"name": "黄芪多糖", "percentage": 50}]
        )
        assert result.stability_score >= 0
        assert hasattr(result, "predicted_shelf_life_months")

    def test_predict_with_storage_conditions(self):
        predictor = StabilityPredictor()
        result = predictor.predict_stability(
            [{"name": "维生素C", "percentage": 100}],
            storage_conditions={"temperature_c": 5, "humidity_pct": 30, "light_exposure": "dark"},
        )
        assert result.stability_score >= 0

    def test_compare_formulas(self):
        predictor = StabilityPredictor()
        comparison = predictor.compare_formulas({
            "配方A": [{"name": "维生素C", "percentage": 100}],
            "配方B": [{"name": "黄芪多糖", "percentage": 100}],
        })
        assert isinstance(comparison, dict)
        assert set(comparison.keys()) == {"配方A", "配方B"}


class TestFlavorEngine:
    def test_design_empty_herbs(self):
        engine = FlavorEngine()
        result = engine.design({"herbs": []})
        assert "taste_profile" in result
        assert "balance_score" in result

    def test_design_basic_herbs(self):
        engine = FlavorEngine()
        result = engine.design({
            "herbs": [
                {"id": "hq", "dosage": 5},
                {"id": "ds", "dosage": 3},
            ]
        })
        assert "taste_profile" in result
        assert result["balance_score"] >= 0

    def test_design_with_target_taste(self):
        engine = FlavorEngine()
        result = engine.design({"herbs": [{"id": "hq", "dosage": 5}]}, target_taste="sweet")
        assert "taste_profile" in result


class TestCoordinationEngine:
    """CoordinationIssue.ingredient 已改为带默认值（可为空），analyze() 可正常运行。"""

    def test_singleton(self):
        assert get_coordination_engine() is get_coordination_engine()

    def test_analyze_empty_herbs(self):
        report = CoordinationEngine().analyze([])
        assert isinstance(report.overall_score, float)
        assert report.product_form == "保健饮品"

    def test_analyze_basic_herbs(self):
        report = CoordinationEngine().analyze([
            {"name": "黄芪", "ratio": 0.35, "role": "君"},
            {"name": "人参", "ratio": 0.20, "role": "臣"},
            {"name": "茯苓", "ratio": 0.15, "role": "佐"},
        ])
        assert 0 <= report.overall_score <= 100
        assert report.role_assignment

    def test_analyze_with_effects_and_population(self):
        report = CoordinationEngine().analyze(
            [{"name": "黄芪", "ratio": 1.0}],
            target_effects=["补气"],
            target_population="adult",
        )
        assert 0 <= report.overall_score <= 100

    def test_analyze_with_synergy_data(self):
        report = CoordinationEngine().analyze(
            [{"name": "黄芪", "ratio": 0.6}, {"name": "当归", "ratio": 0.4}],
            synergy_data={"pairs": []},
        )
        assert isinstance(report.synergy_highlights, list)


class TestSynergyEngine:
    def test_analyze_synergy(self):
        engine = SynergyEngine()
        report = engine.analyze_synergy(
            "黄芪多糖",
            "大豆肽",
            context={
                "bliss": {"efficacy_a": 0.7, "efficacy_b": 0.6},
                "pk": {"auc_a": 100, "auc_b": 80, "auc_combination": 200},
                "gibbs": {"delta_h": -20, "delta_s": 50, "interaction_terms": [-5, -3]},
                "network": {
                    "targets_a": ["EGFR", "VEGF", "TNF"],
                    "targets_b": ["EGFR", "IL6", "NFkB"],
                },
                "taste": {
                    "taste_profile_a": {"bitter": 0.3, "umami": 0.2},
                    "taste_profile_b": {"bitter": 0.4, "sweet": 0.3},
                },
            },
        )
        assert hasattr(report, "overall_si")
        assert hasattr(report, "dominant_mechanism")
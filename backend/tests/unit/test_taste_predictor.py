"""app/services/formula/taste_predictor.py 单元测试

覆盖风味预测、相互作用效应、优化建议与接受度预测。
"""

from app.services.formula.taste_predictor import TastePredictor, TasteProfile


class TestTasteProfile:
    def test_default_balance(self):
        profile = TasteProfile()
        assert profile.balance_score >= 0
        assert profile.acceptability >= 0


class TestTastePredictor:
    def test_predict_empty(self):
        tp = TastePredictor()
        profile = tp.predict_taste([])
        assert isinstance(profile, TasteProfile)

    def test_predict_single_ingredient(self):
        tp = TastePredictor()
        profile = tp.predict_taste([{"name": "蜂蜜", "percentage": 100}])
        assert profile.balance_score >= 0
        assert profile.acceptability >= 0

    def test_predict_two_ingredients(self):
        tp = TastePredictor()
        profile = tp.predict_taste([
            {"name": "蜂蜜", "percentage": 60},
            {"name": "柠檬", "percentage": 40},
        ])
        assert profile.balance_score >= 0

    def test_predict_with_calibration(self):
        tp = TastePredictor()
        profile = tp.predict_taste(
            [{"name": "蜂蜜", "percentage": 100}],
            calibration={"sweet": 1.5},
        )
        assert profile.sweet >= 0

    def test_interaction_effects(self):
        tp = TastePredictor()
        profile = tp.predict_taste([{"name": "蜂蜜", "percentage": 100}])
        interactions = tp.calculate_interaction_effects(profile)
        assert isinstance(interactions, dict)

    def test_optimization_suggestions(self):
        tp = TastePredictor()
        profile = tp.predict_taste([{"name": "蜂蜜", "percentage": 100}])
        suggestions = tp.get_optimization_suggestions(profile, current_ingredients=[])
        assert isinstance(suggestions, list)

    def test_predict_acceptance(self):
        tp = TastePredictor()
        result = tp.predict_acceptance([{"name": "蜂蜜", "percentage": 100}])
        assert isinstance(result, dict)
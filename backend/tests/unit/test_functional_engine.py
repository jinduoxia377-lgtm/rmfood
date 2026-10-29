"""app/services/formula/functional_engine.py 单元测试

覆盖功能性设计引擎的主入口设计流程。
"""

from app.services.formula.functional_engine import FunctionalEngine


class TestFunctionalEngine:
    def test_design_empty(self):
        fe = FunctionalEngine()
        result = fe.design({}, "adult")
        assert "enhancer_recommendations" in result
        assert "retention_prediction" in result
        assert "compliance_check" in result
        assert "nutrition_balance" in result
        assert "summary" in result

    def test_design_with_herbs(self):
        fe = FunctionalEngine()
        result = fe.design({"herbs": [{"name": "黄芪", "dosage": 5}]}, "adult")
        assert isinstance(result["enhancer_recommendations"], list)

    def test_design_with_requirements(self):
        fe = FunctionalEngine()
        result = fe.design(
            {},
            "adult",
            nutrition_requirements={"protein_g": 20, "calcium_mg": 500},
        )
        assert "nutrition_gaps" in result

    def test_design_target_group_children(self):
        fe = FunctionalEngine()
        result = fe.design({}, "children")
        assert "summary" in result
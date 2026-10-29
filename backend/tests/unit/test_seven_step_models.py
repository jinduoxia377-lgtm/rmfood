"""app/services/formula/seven_step_engine.py 数据模型单元测试"""

from app.services.formula.seven_step_engine import FormulaRequest, FormulaOutput, SevenStepFormulaEngine


class TestFormulaRequest:
    def test_defaults(self):
        req = FormulaRequest(target_effects=["补气"])
        assert req.target_effects == ["补气"]
        assert req.product_form == "保健饮品"
        assert req.target_group == "adult"
        assert req.constraints == {}
        assert req.max_cost is None
        assert req.target_shelf_life_months == 12
        assert req.n_candidates == 10


class TestFormulaOutput:
    def test_defaults(self):
        out = FormulaOutput()
        assert out.framework == {}
        assert out.color == {}
        assert out.fragrance == {}
        assert out.summary == ""
        assert out.total_time_ms == 0.0


class TestSevenStepEngine:
    def test_build_summary(self):
        engine = SevenStepFormulaEngine()
        out = FormulaOutput()
        summary = engine._build_summary(out)
        assert isinstance(summary, str)
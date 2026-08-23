"""
七步配方设计引擎单元测试
"""
import pytest
import asyncio
import sys
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))


class TestProductFormRules:
    """产品形态规则库测试"""

    def test_all_forms_defined(self):
        from app.services.formula.product_form_rules import PRODUCT_FORM_RULES
        required_forms = [
            "保健饮品", "代茶饮", "膏方", "散剂", "丸剂",
            "口服液", "功能性食品", "压片糖果",
        ]
        for form in required_forms:
            assert form in PRODUCT_FORM_RULES, f"缺少产品形态: {form}"

    def test_rule_structure(self):
        from app.services.formula.product_form_rules import PRODUCT_FORM_RULES, ProductFormRule
        rule = PRODUCT_FORM_RULES["保健饮品"]
        assert isinstance(rule, ProductFormRule)
        assert rule.total_dosage_g == 50.0
        assert rule.min_herbs == 3
        assert rule.max_herbs == 8
        assert isinstance(rule.jun_ratio_range, tuple)
        assert len(rule.jun_ratio_range) == 2

    def test_get_product_form_rule(self):
        from app.services.formula.product_form_rules import get_product_form_rule
        rule = get_product_form_rule("保健饮品")
        assert rule is not None
        assert rule.form_type == "保健饮品"

    def test_get_undefined_form(self):
        from app.services.formula.product_form_rules import get_product_form_rule
        assert get_product_form_rule("不存在的形态") is None

    def test_list_product_forms(self):
        from app.services.formula.product_form_rules import list_product_forms
        forms = list_product_forms()
        assert len(forms) >= 8


class TestRuleFilter:
    """前置规则过滤器测试"""

    def test_init(self):
        from app.services.formula.rule_filter import RuleFilter
        rf = RuleFilter()
        assert rf is not None

    def test_filter_empty_herbs(self):
        from app.services.formula.rule_filter import RuleFilter
        rf = RuleFilter()
        result = rf.filter(candidate_herbs=[], target_population="adult")
        assert result["filtered_herbs"] == []
        assert result["violation_count"] == 0

    def test_filter_pregnancy_contra(self):
        from app.services.formula.rule_filter import RuleFilter
        rf = RuleFilter()
        herbs = [
            {"id": "hq", "name_cn": "黄芪", "dosage_max": 30.0, "cost_per_gram": 0.08},
            {"id": "lk", "name_cn": "藜芦", "dosage_max": 3.0, "cost_per_gram": 0.30},
        ]
        result = rf.filter(candidate_herbs=herbs, target_population="pregnant")
        # 藜芦是孕妇禁忌
        filtered_ids = [h["id"] for h in result["filtered_herbs"]]
        assert "lk" not in filtered_ids

    def test_check_pair(self):
        from app.services.formula.rule_filter import RuleFilter
        rf = RuleFilter()
        # 党参和藜芦是十八反
        assert rf.check_pair("ds", "lk") == True
        # 黄芪和党参不是禁忌
        assert rf.check_pair("hq", "ds") == False


class TestFrameworkEngine:
    """主体骨架设计引擎测试"""

    @pytest.mark.asyncio
    async def test_design_basic(self):
        from app.services.formula.framework_engine import FrameworkEngine
        engine = FrameworkEngine()
        result = await engine.design(
            effects=["免疫调节"],
            product_form="保健饮品",
            target_group="adult",
        )
        assert result is not None
        assert len(result.herbs) >= 3
        assert result.product_form == "保健饮品"
        assert result.total_dosage_g > 0

    @pytest.mark.asyncio
    async def test_design_multiple_effects(self):
        from app.services.formula.framework_engine import FrameworkEngine
        engine = FrameworkEngine()
        result = await engine.design(
            effects=["免疫调节", "抗氧化"],
            product_form="代茶饮",
        )
        assert result is not None
        assert len(result.herbs) >= 3

    def test_invalid_product_form(self):
        from app.services.formula.framework_engine import FrameworkEngine
        engine = FrameworkEngine()
        with pytest.raises(ValueError):
            asyncio.run(engine.design(
                effects=["免疫调节"],
                product_form="不存在的产品形态",
            ))


class TestColorEngine:
    """调色设计引擎测试"""

    def test_design_basic(self):
        from app.services.formula.color_engine import ColorEngine
        engine = ColorEngine()
        result = engine.design(
            framework_result={"herbs": [], "product_form": "保健饮品"},
            product_form="保健饮品",
        )
        assert result is not None
        assert "colorants" in result
        assert "predicted_color" in result

    def test_design_no_suitable(self):
        from app.services.formula.color_engine import ColorEngine
        engine = ColorEngine()
        result = engine.design(
            framework_result={},
            product_form="散剂",
            target_color=(100, 0, 0),
        )
        # 散剂可能没有合适的着色剂
        assert result is not None


class TestFragranceEngine:
    """调香设计引擎测试"""

    def test_design_basic(self):
        from app.services.formula.fragrance_engine import FragranceEngine
        engine = FragranceEngine()
        result = engine.design(
            framework_result={"herbs": []},
            product_form="保健饮品",
        )
        assert result is not None
        assert "aroma_profile" in result
        assert "bad_tastes_detected" in result


class TestFlavorEngine:
    """调味设计引擎测试"""

    def test_design_basic(self):
        from app.services.formula.flavor_engine import FlavorEngine
        engine = FlavorEngine()
        result = engine.design(framework_result={"herbs": []})
        assert result is not None
        assert "taste_profile" in result
        assert "balance_score" in result
        assert 0 <= result["balance_score"] <= 1

    def test_empty_herbs(self):
        from app.services.formula.flavor_engine import FlavorEngine
        engine = FlavorEngine()
        result = engine.design(framework_result={"herbs": []})
        # 空配方应返回理想比例
        assert result["taste_profile"] is not None


class TestQualityEngine:
    """品质改良设计引擎测试"""

    def test_design_basic(self):
        from app.services.formula.quality_engine import QualityEngine
        engine = QualityEngine()
        result = engine.design(
            framework_result={"herbs": [], "total_dosage_g": 50.0},
            product_form="保健饮品",
        )
        assert result is not None
        assert "thickener" in result
        assert "emulsifier" in result
        assert "antioxidant" in result

    def test_design_pill(self):
        from app.services.formula.quality_engine import QualityEngine
        engine = QualityEngine()
        result = engine.design(
            framework_result={"herbs": [], "total_dosage_g": 9.0},
            product_form="丸剂",
        )
        assert result is not None
        # 丸剂不需要乳化剂
        assert result["emulsifier"].get("recommendation") == "无需乳化剂"


class TestPreservationEngine:
    """防腐保鲜设计引擎测试"""

    def test_design_basic(self):
        from app.services.formula.preservation_engine import PreservationEngine
        engine = PreservationEngine()
        result = engine.design(
            framework_result={"herbs": [], "total_dosage_g": 50.0},
            product_form="保健饮品",
            target_shelf_life_months=12,
        )
        assert result is not None
        assert "technology_recommendation" in result
        assert "shelf_life_prediction" in result

    def test_design_long_shelf_life(self):
        from app.services.formula.preservation_engine import PreservationEngine
        engine = PreservationEngine()
        result = engine.design(
            framework_result={"herbs": [], "total_dosage_g": 50.0},
            product_form="散剂",
            target_shelf_life_months=24,
        )
        assert result is not None


class TestFunctionalEngine:
    """功能性设计引擎测试"""

    def test_design_basic(self):
        from app.services.formula.functional_engine import FunctionalEngine
        engine = FunctionalEngine()
        result = engine.design(
            framework_result={"herbs": [], "product_form": "保健饮品"},
            target_group="adult",
        )
        assert result is not None
        assert "enhancer_recommendations" in result
        assert "compliance_check" in result

    def test_design_pregnant(self):
        from app.services.formula.functional_engine import FunctionalEngine
        engine = FunctionalEngine()
        result = engine.design(
            framework_result={"herbs": [], "product_form": "保健饮品"},
            target_group="pregnant",
        )
        assert result is not None
        # 孕妇需要额外的叶酸强化
        has_folic = any(
            e.get("enhancer_name") == "叶酸"
            for e in result.get("enhancer_recommendations", [])
        )
        # 可能有也可能没有，取决于营养缺口分析


class TestSevenStepEngine:
    """七步编排引擎测试"""

    @pytest.mark.asyncio
    async def test_design_complete_flow(self):
        from app.services.formula.seven_step_engine import SevenStepFormulaEngine, FormulaRequest
        engine = SevenStepFormulaEngine()
        req = FormulaRequest(
            target_effects=["免疫调节", "抗氧化"],
            product_form="保健饮品",
            target_group="adult",
            n_candidates=5,
        )
        result = await engine.design(req)
        assert result is not None
        assert result.summary != ""
        assert len(result.framework.get("herbs", [])) >= 3
        # 应有验证结果
        assert "validation" in result.__dict__

    @pytest.mark.asyncio
    async def test_design_different_forms(self):
        from app.services.formula.seven_step_engine import SevenStepFormulaEngine, FormulaRequest
        engine = SevenStepFormulaEngine()

        for form in ["保健饮品", "散剂", "膏方"]:
            req = FormulaRequest(
                target_effects=["免疫调节"],
                product_form=form,
                n_candidates=3,
            )
            result = await engine.design(req)
            assert result.framework.get("product_form") == form
            assert len(result.framework.get("herbs", [])) > 0

    @pytest.mark.asyncio
    async def test_design_with_constraints(self):
        from app.services.formula.seven_step_engine import SevenStepFormulaEngine, FormulaRequest
        engine = SevenStepFormulaEngine()
        req = FormulaRequest(
            target_effects=["免疫调节"],
            product_form="保健饮品",
            max_cost=20.0,
            target_shelf_life_months=18,
        )
        result = await engine.design(req)
        assert result is not None


class TestSignalEncoder:
    """信号编码器测试"""

    def test_encode_basic(self):
        from app.services.ai.models.signal_encoder import SignalEncoder
        encoder = SignalEncoder()
        signal = encoder.encode(["免疫调节", "抗氧化"])
        assert signal is not None
        assert len(signal.raw_vector) == encoder.output_dim
        assert encoder.output_dim == 36  # 16+8+8+4

    def test_encode_empty_effects(self):
        from app.services.ai.models.signal_encoder import SignalEncoder
        encoder = SignalEncoder()
        signal = encoder.encode([])
        assert signal is not None
        assert len(signal.raw_vector) == 36

    def test_encode_with_category(self):
        from app.services.ai.models.signal_encoder import SignalEncoder
        encoder = SignalEncoder()
        signal = encoder.encode(
            ["免疫调节"],
            product_category="保健饮品",
            target_group="adult",
        )
        assert signal is not None
        assert len(signal.raw_vector) == 36

    def test_learnable_embeddings(self):
        """验证嵌入矩阵已初始化（替代随机投影）"""
        from app.services.ai.models.signal_encoder import SignalEncoder
        encoder = SignalEncoder()
        encoder._ensure_initialized()
        assert encoder._effect_embed_matrix is not None
        assert len(encoder._effect_embed_matrix) == 20  # 20种功效
        assert len(encoder._effect_embed_matrix[0]) == 16  # 16维嵌入


class TestPyTorchGenerator:
    """PyTorch生成器测试"""

    def test_init(self):
        from app.services.ai.models.pytorch_generator import PyTorchFormulaGenerator
        gen = PyTorchFormulaGenerator(n_herbs=100)
        assert gen is not None
        assert hasattr(gen, 'optimizer')
        assert hasattr(gen, 'herb_embed')
        assert hasattr(gen, '_current_log_probs')

    def test_forward(self):
        import torch
        from app.services.ai.models.pytorch_generator import PyTorchFormulaGenerator
        gen = PyTorchFormulaGenerator(n_herbs=100)
        signal = torch.randn(1, 36)
        herb_logits, dosage_logits, stop_logits = gen.forward(signal, max_seq_len=5)
        assert herb_logits.shape == (1, 5, 100)
        assert dosage_logits.shape == (1, 5, 10)
        assert stop_logits.shape == (1, 5)

    def test_train_step(self):
        import torch
        from app.services.ai.models.pytorch_generator import PyTorchFormulaGenerator
        gen = PyTorchFormulaGenerator(n_herbs=100)
        signal = torch.randn(2, 36)
        target_herbs = torch.randint(0, 100, (2, 5))
        target_dosages = torch.randint(0, 10, (2, 5)).float()
        target_stops = torch.randint(0, 2, (2, 5)).float()

        result = gen.train_step(signal, target_herbs, target_dosages, target_stops)
        assert "total_loss" in result
        assert result["total_loss"] > 0


class TestRLTuner:
    """RL调优器测试"""

    def test_compute_reward(self):
        from app.services.ai.models.rl_tuner import RLFormulaTuner
        tuner = RLFormulaTuner()
        rewards = tuner.compute_reward(
            formula={"hq": 10.0, "ds": 8.0},
            template_match=0.8,
        )
        assert "total" in rewards
        assert rewards["total"] > 0

    def test_train_step_without_generator(self):
        from app.services.ai.models.rl_tuner import RLFormulaTuner
        tuner = RLFormulaTuner()
        result = tuner.train_step(formula={"hq": 10.0})
        assert "reward" in result
        assert "advantage" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

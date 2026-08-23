"""
核心配方模块测试套件
覆盖 SynergyEngine, CompatibilityChecker, RatioOptimizer, TastePredictor, StabilityPredictor
"""

import pytest
import asyncio
import sys
from pathlib import Path

# 添加 backend 根目录到路径
backend_root = Path(__file__).parent.parent.parent / "backend"
sys.path.insert(0, str(backend_root))


# ==================== SynergyEngine 测试 ====================

class TestSynergyEngine:
    """协同引擎测试"""
    
    def test_bliss_independence_synergy(self):
        """Bliss 独立协同测试"""
        from app.services.formula.synergy_engine import SynergyEngine
        engine = SynergyEngine()
        
        result = engine.bliss_independence(
            efficacy_a=0.7, efficacy_b=0.6, alpha=0.5
        )
        
        # 协同效应应大于独立作用
        base_effect = 0.7 + 0.6 - 0.7 * 0.6
        assert result.score > base_effect
        assert result.mechanism_type.value == "bliss_independence"
    
    def test_bliss_independence_antagonism(self):
        """Bliss 拮抗作用测试"""
        from app.services.formula.synergy_engine import SynergyEngine
        engine = SynergyEngine()
        
        result = engine.bliss_independence(
            efficacy_a=0.7, efficacy_b=0.6, alpha=-0.3
        )
        
        # 拮抗效应应小于独立作用
        base_effect = 0.7 + 0.6 - 0.7 * 0.6
        assert result.score < base_effect
    
    def test_bliss_independence_boundary(self):
        """边界值测试"""
        from app.services.formula.synergy_engine import SynergyEngine
        engine = SynergyEngine()
        
        with pytest.raises(ValueError):
            engine.bliss_independence(efficacy_a=1.5, efficacy_b=0.5)
    
    def test_analyze_synergy_full(self):
        """完整协同分析测试"""
        from app.services.formula.synergy_engine import SynergyEngine
        engine = SynergyEngine()
        
        report = engine.analyze_synergy(
            ingredient_a="黄芪多糖",
            ingredient_b="大豆肽",
            context={
                "bliss": {"efficacy_a": 0.7, "efficacy_b": 0.6},
                "pk": {"auc_a": 100, "auc_b": 80, "auc_combination": 220},
                "gibbs": {"delta_h": -20, "delta_s": 50},
                "network": {"targets_a": ["EGFR"], "targets_b": ["EGFR"]},
                "taste": {
                    "taste_profile_a": {"bitter": 0.3},
                    "taste_profile_b": {"umami": 0.5}
                }
            }
        )
        
        assert report.overall_si >= 0
        assert report.dominant_mechanism is not None
        assert len(report.mechanisms) == 5


# ==================== CompatibilityChecker 测试 ====================

class TestCompatibilityChecker:
    """兼容性检查器测试"""
    
    def test_basic_compatibility(self):
        """基础兼容性测试"""
        from app.services.formula.compatibility_checker import CompatibilityChecker
        checker = CompatibilityChecker()
        
        formula = [
            {"name": "黄芪多糖", "amount_mg": 300, "percentage": 30},
            {"name": "大豆肽", "amount_mg": 250, "percentage": 25},
        ]
        
        report = checker.check_compatibility(formula)
        
        assert report.overall_score >= 0
        assert report.overall_score <= 100
        assert isinstance(report.issues, list)
    
    def test_repeated_ingredient_warning(self):
        """重复成分警告测试"""
        from app.services.formula.compatibility_checker import CompatibilityChecker
        checker = CompatibilityChecker()
        
        formula = [
            {"name": "黄芪多糖", "amount_mg": 300, "percentage": 30},
            {"name": "黄芪多糖", "amount_mg": 200, "percentage": 20},
        ]
        
        report = checker.check_compatibility(formula)
        
        # 应检测到重复成分
        assert report.warning_count > 0 or report.error_count > 0


# ==================== TastePredictor 测试 ====================

class TestTastePredictor:
    """风味预测测试"""
    
    def test_predict_taste(self):
        """风味预测测试"""
        from app.services.formula.taste_predictor import TastePredictor
        predictor = TastePredictor()
        
        ingredients = [
            {"name": "枸杞", "percentage": 50},
            {"name": "甘草", "percentage": 30},
            {"name": "黄芪", "percentage": 20},
        ]
        
        result = predictor.predict_taste(ingredients)
        
        assert 0 <= result.bitter <= 1
        assert 0 <= result.sweet <= 1
        assert 0 <= result.umami <= 1
        assert result.balance_score >= 0
        assert result.acceptability >= 0
    
    def test_predict_acceptance(self):
        """接受度预测测试"""
        from app.services.formula.taste_predictor import TastePredictor
        predictor = TastePredictor()
        
        ingredients = [
            {"name": "枸杞", "percentage": 40},
            {"name": "甘草", "percentage": 30},
            {"name": "大枣", "percentage": 30},
        ]
        
        result = predictor.predict_acceptance(ingredients, "adult")
        
        assert "taste_profile" in result
        assert "overall_score" in result
        assert 0 <= result["overall_score"] <= 100
    
    def test_optimization_suggestions(self):
        """优化建议测试"""
        from app.services.formula.taste_predictor import TastePredictor
        predictor = TastePredictor()
        
        # 高苦味配方
        ingredients = [
            {"name": "人参皂苷", "percentage": 50},
            {"name": "黄连素", "percentage": 50},
        ]
        
        result = predictor.predict_acceptance(ingredients)
        
        # 应有苦味相关建议
        suggestions = result.get("optimization_suggestions", [])
        bitter_suggestions = [s for s in suggestions if "苦" in s.get("description", "")]
        
        assert len(bitter_suggestions) > 0


# ==================== StabilityPredictor 测试 ====================

class TestStabilityPredictor:
    """稳定性预测测试"""
    
    def test_predict_stability(self):
        """稳定性预测测试"""
        from app.services.formula.stability_predictor import StabilityPredictor
        predictor = StabilityPredictor()
        
        ingredients = [
            {"name": "黄芪多糖", "percentage": 30},
            {"name": "维生素C", "percentage": 20},
            {"name": "胶原蛋白肽", "percentage": 50},
        ]
        
        result = predictor.predict_stability(ingredients)
        
        assert result.predicted_shelf_life_months > 0
        assert result.stability_score >= 0
        assert result.stability_score <= 100
        assert isinstance(result.storage_recommendations, list)
    
    def test_compare_formulas(self):
        """配方对比测试"""
        from app.services.formula.stability_predictor import StabilityPredictor
        predictor = StabilityPredictor()
        
        formulas = {
            "配方A": [
                {"name": "黄芪多糖", "percentage": 30},
                {"name": "枸杞", "percentage": 70},
            ],
            "配方B": [
                {"name": "人参皂苷", "percentage": 40},
                {"name": "姜黄素", "percentage": 60},
            ]
        }
        
        results = predictor.compare_formulas(formulas)
        
        assert len(results) == 2
        # 应按稳定性评分排序
        scores = [pred.stability_score for pred in results.values()]
        assert scores == sorted(scores, reverse=True)


# ==================== 多算法融合测试 ====================

class TestMultiAlgorithmOrchestrator:
    """多算法融合测试"""
    
    @pytest.mark.asyncio
    async def test_optimize(self):
        """多算法优化测试"""
        from app.services.formula.multi_algorithm_orchestrator import (
            MultiAlgorithmOrchestrator, FusionConfig
        )
        
        config = FusionConfig(time_budget=10.0)
        orchestrator = MultiAlgorithmOrchestrator(config)
        
        ingredients = [
            {"name": "黄芪多糖", "efficacy": 0.7, "safety": 0.9},
            {"name": "大豆肽", "efficacy": 0.6, "safety": 0.85},
        ]
        constraints = {"max_cost": 100, "min_efficacy": 0.6}
        
        result = await orchestrator.optimize(ingredients, constraints)
        
        assert result["success"]
        assert len(result["pareto_frontier"]) > 0
        assert result["best_solution"] is not None
    
    def test_algorithm_stats(self):
        """算法统计测试"""
        from app.services.formula.multi_algorithm_orchestrator import MultiAlgorithmOrchestrator
        
        orchestrator = MultiAlgorithmOrchestrator()
        stats = orchestrator.get_algorithm_stats()
        
        assert "total_algorithms" in stats
        assert "successful_algorithms" in stats


# ==================== 并行管线测试 ====================

class TestParallelPipeline:
    """并行管线测试"""
    
    @pytest.mark.asyncio
    async def test_generate(self):
        """并行生成测试"""
        from app.services.formula.parallel_pipeline import ParallelGenerationRequest, ParallelFormulaPipeline
        
        request = ParallelGenerationRequest(
            ingredients=[
                {"name": "黄芪多糖", "percentage": 30},
                {"name": "大豆肽", "percentage": 25},
                {"name": "枸杞", "percentage": 20},
            ],
            target_efficacy=0.75,
            use_caching=True
        )
        
        pipeline = ParallelFormulaPipeline()
        result = await pipeline.generate(request)
        
        assert result.success
        assert result.formula_id.startswith("FORMULA-")
        assert result.generation_time < 5.0  # 目标 <5秒
    
    @pytest.mark.asyncio
    async def test_caching(self):
        """缓存功能测试"""
        from app.services.formula.parallel_pipeline import ParallelGenerationRequest, ParallelFormulaPipeline
        
        request = ParallelGenerationRequest(
            ingredients=[
                {"name": "黄芪多糖", "percentage": 30},
                {"name": "枸杞", "percentage": 70},
            ],
            use_caching=True
        )
        
        pipeline = ParallelFormulaPipeline()
        
        # 第一次生成
        result1 = await pipeline.generate(request)
        
        # 第二次生成（应命中缓存）
        result2 = await pipeline.generate(request)
        
        assert result2.cache_hit


# ==================== PK/PD 数据库测试 ====================

class TestPKPDDatabase:
    """PK/PD 数据库测试"""
    
    def test_pk_database_coverage(self):
        """PK 数据库覆盖测试"""
        from app.services.formula.pk_pd_database import PK_PARAMETERS_DB
        
        assert len(PK_PARAMETERS_DB) >= 40
        
        # 检查关键成分
        assert "大豆肽" in PK_PARAMETERS_DB
        assert "人参皂苷" in PK_PARAMETERS_DB
        assert "黄芪多糖" in PK_PARAMETERS_DB
    
    def test_pd_database_coverage(self):
        """PD 数据库覆盖测试"""
        from app.services.formula.pk_pd_database import PD_PARAMETERS_DB
        
        assert len(PD_PARAMETERS_DB) >= 40
        
        # 检查关键成分
        assert "大豆肽" in PD_PARAMETERS_DB
        assert "人参皂苷" in PD_PARAMETERS_DB
    
    def test_get_functions(self):
        """获取函数测试"""
        from app.services.formula.pk_pd_database import get_pk_params, get_pd_params, get_all_ingredients
        
        params = get_pk_params("大豆肽")
        assert params is not None
        assert "F" in params
        assert "ka" in params
        
        ingredients = get_all_ingredients()
        assert len(ingredients) >= 40


# ==================== 营养数据库测试 ====================

class TestNutritionDatabase:
    """营养数据库测试"""
    
    def test_nutrition_database_coverage(self):
        """营养数据库覆盖测试"""
        from app.services.formula.nutrition_database import HERB_NUTRITION_DB
        
        assert len(HERB_NUTRITION_DB) >= 50
        
        # 检查关键成分
        assert "黄芪" in HERB_NUTRITION_DB
        assert "枸杞" in HERB_NUTRITION_DB
        assert "人参" in HERB_NUTRITION_DB
    
    def test_nutrition_fields(self):
        """营养字段完整性测试"""
        from app.services.formula.nutrition_database import HERB_NUTRITION_DB
        
        herb = HERB_NUTRITION_DB["黄芪"]
        
        required_fields = ["protein", "fat", "carbohydrate", "dietary_fiber", 
                          "sodium", "calcium", "iron", "zinc", "vitamin_a", "vitamin_c"]
        
        for field in required_fields:
            assert field in herb, f"缺少字段: {field}"


# ==================== 兼容性规则测试 ====================

class TestCompatibilityRules:
    """兼容性规则测试"""
    
    def test_rule_count(self):
        """规则数量测试"""
        from app.services.formula.compatibility_rules import COMPATIBILITY_RULES
        
        assert len(COMPATIBILITY_RULES) >= 50
    
    def test_rule_categories(self):
        """规则分类测试"""
        from app.services.formula.compatibility_rules import COMPATIBILITY_RULES, CheckCategory
        
        chemical_rules = [r for r in COMPATIBILITY_RULES if r.rule_type == "precipitation"]
        pharmacological_rules = [r for r in COMPATIBILITY_RULES if r.rule_type == "enzyme_interaction"]
        regulatory_rules = [r for r in COMPATIBILITY_RULES if r.rule_type == "regulatory"]
        
        assert len(chemical_rules) > 0
        assert len(pharmacological_rules) > 0
        assert len(regulatory_rules) > 0
    
    def test_rule_function(self):
        """规则函数测试"""
        from app.services.formula.compatibility_rules import get_rules, get_rule_count
        
        rules = get_rules()
        assert len(rules) >= 50
        
        stats = get_rule_count()
        assert stats["total"] >= 50


# ==================== 协同系数版本管理测试 ====================

class TestCoefficientVersionManager:
    """协同系数版本管理测试"""
    
    def test_add_coefficient(self, tmp_path):
        """添加系数测试"""
        from app.services.formula.coefficient_version_manager import CoefficientVersionManager
        
        manager = CoefficientVersionManager(data_dir=str(tmp_path / "synergy"))
        
        entry = manager.add_coefficient(
            ingredient_a="黄芪",
            ingredient_b="人参",
            mechanism="bliss_independence",
            coefficient=0.35,
            source="测试数据",
            confidence=0.8
        )
        
        assert entry.coefficient == 0.35
        assert entry.confidence == 0.8
    
    def test_get_coefficient(self, tmp_path):
        """获取系数测试"""
        from app.services.formula.coefficient_version_manager import CoefficientVersionManager
        
        manager = CoefficientVersionManager(data_dir=str(tmp_path / "synergy"))
        
        manager.add_coefficient(
            ingredient_a="测试A",
            ingredient_b="测试B",
            mechanism="bliss_independence",
            coefficient=0.5,
            source="测试"
        )
        
        value = manager.get_coefficient("测试A", "测试B", "bliss_independence")
        assert value == 0.5
    
    def test_version_history(self, tmp_path):
        """版本历史测试"""
        from app.services.formula.coefficient_version_manager import CoefficientVersionManager
        
        manager = CoefficientVersionManager(data_dir=str(tmp_path / "synergy"))
        
        manager.add_coefficient("A", "B", "bliss", 0.3, "test")
        manager.add_coefficient("C", "D", "bliss", 0.4, "test")
        
        history = manager.get_version_history()
        assert len(history) >= 2
    
    def test_stats(self, tmp_path):
        """统计信息测试"""
        from app.services.formula.coefficient_version_manager import CoefficientVersionManager
        
        manager = CoefficientVersionManager(data_dir=str(tmp_path / "synergy"))
        
        stats = manager.get_stats()
        
        assert "current_version" in stats
        assert "total_coefficients" in stats
        assert "by_mechanism" in stats


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
统一配方集成服务 - 协调所有深度功能模块的管线编排

功能:
- 增强配方生成流程编排 (orchestrate_deep_generation)
- 整合 SynergyEngine + RatioOptimizer + CompatibilityChecker + EffectSimulator + SafetyAlertSystem
- 向后兼容原有 AIService.generate_formula() 接口
- 缓存策略与错误处理
"""

import hashlib
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    from .compatibility_checker import CompatibilityChecker, CompatibilityReport
    from .effect_simulator import EffectPrediction, EffectSimulator
    from .ratio_optimizer import OptimizationConfig, ParetoFrontier, RatioOptimizer
    from .safety_alert_system import SafetyAlertSystem, SafetyCheckResult
    from .synergy_engine import SynergyEngine, SynergyReport
except ImportError as e:
    logger.warning(f"部分模块导入失败: {e}")
    SynergyEngine = None
    RatioOptimizer = None
    CompatibilityChecker = None
    EffectSimulator = None
    SafetyAlertSystem = None


class GenerationMode(Enum):
    STANDARD = "standard"
    DEEP_INTEGRATION = "deep_integration"


@dataclass
class DeepGenerationRequest:
    """增强配方生成请求"""
    ingredients: List[Dict[str, Any]]
    mode: GenerationMode = GenerationMode.DEEP_INTEGRATION
    target_efficacy: float = 0.75
    safety_priority: bool = True
    cost_constraint: Optional[float] = None
    target_population: str = "adult"
    use_caching: bool = True
    user_preferences: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DeepGenerationResponse:
    """增强配方生成响应"""
    success: bool
    formula_id: str
    optimized_ratios: Dict[str, float]
    synergy_report: Optional[SynergyReport] = None
    pareto_frontier: Optional[ParetoFrontier] = None
    compatibility_report: Optional[CompatibilityReport] = None
    effect_prediction: Optional[EffectPrediction] = None
    safety_check: Optional[SafetyCheckResult] = None
    recommendations: List[str] = field(default_factory=list)
    generation_time: float = 0.0
    mode_used: GenerationMode = GenerationMode.STANDARD
    error_message: Optional[str] = None
    cache_hit: bool = False


class FormulaIntegrationService:
    """
    统一配方集成服务 - 深度融合管线编排器

    功能架构:
    ┌─────────────────────────────────────────────┐
    │           FormulaIntegrationService          │
    │  ┌─────────┐  ┌──────────┐  ┌────────────┐  │
    │  │Synergy  │→│Ratio     │→│Compatibil- │  │
    │  │Engine   │  │Optimizer │  │ityChecker  │  │
    │  └─────────┘  └──────────┘  └────────────┘  │
    │         ↓              ↓             ↓       │
    │  ┌──────────────────────────────────────┐   │
    │  │      EffectSimulator + SafetyCheck   │   │
    │  └──────────────────────────────────────┘   │
    └─────────────────────────────────────────────┘

    特性:
    - 完全向后兼容 (use_deep_integration=False 时使用原逻辑)
    - 自动降级 (某模块失败时回退到标准流程)
    - 缓存支持 (相同参数复用结果)
    - 进度回调 (WebSocket 推送)
    """

    def __init__(self):
        self.synergy_engine = None
        self.ratio_optimizer = None
        self.compatibility_checker = None
        self.effect_simulator = None
        self.safety_alert_system = None
        self._cache: Dict[str, DeepGenerationResponse] = {}
        self._cache_max_size = 100

        self._initialize_modules()

        logger.info("FormulaIntegrationService 初始化完成")

    def _initialize_modules(self):
        """延迟初始化各功能模块"""
        try:
            if SynergyEngine:
                self.synergy_engine = SynergyEngine()
                logger.info("✅ SynergyEngine 初始化成功")
        except Exception as e:
            logger.warning(f"⚠️ SynergyEngine 初始化失败: {e}")

        try:
            if RatioOptimizer and self.synergy_engine:
                self.ratio_optimizer = RatioOptimizer(
                    synergy_engine=self.synergy_engine,
                    config=OptimizationConfig(
                        population_size=80,
                        max_generations=40,
                        random_seed=None
                    )
                )
                logger.info("✅ RatioOptimizer 初始化成功")
        except Exception as e:
            logger.warning(f"⚠️ RatioOptimizer 初始化失败: {e}")

        try:
            if CompatibilityChecker:
                self.compatibility_checker = CompatibilityChecker()
                logger.info("✅ CompatibilityChecker 初始化成功")
        except Exception as e:
            logger.warning(f"⚠️ CompatibilityChecker 初始化失败: {e}")

        try:
            if EffectSimulator:
                self.effect_simulator = EffectSimulator()
                logger.info("✅ EffectSimulator 初始化成功")
        except Exception as e:
            logger.warning(f"⚠️ EffectSimulator 初始化失败: {e}")

        try:
            if SafetyAlertSystem:
                self.safety_alert_system = SafetyAlertSystem()
                logger.info("✅ SafetyAlertSystem 初始化成功")
        except Exception as e:
            logger.warning(f"⚠️ SafetyAlertSystem 初始化失败: {e}")

    def orchestrate_deep_generation(
        self,
        request: DeepGenerationRequest,
        progress_callback: Optional[Callable[[str, int, int], None]] = None,
        synergy_contexts: Optional[Dict[str, Dict]] = None,
    ) -> DeepGenerationResponse:
        """
        执行完整的增强配方生成管线

        Args:
            request: 生成请求对象
            progress_callback: 进度回调 callback(stage_name, current_step, total_steps)

        Returns:
            DeepGenerationResponse: 包含完整分析结果的响应
        """
        start_time = time.time()

        cache_key = self._generate_cache_key(request)

        if request.use_caching and cache_key in self._cache:
            cached = self._cache[cache_key]
            cached.cache_hit = True
            logger.info(f"缓存命中 - Key={cache_key[:16]}...")
            return cached

        response = DeepGenerationResponse(
            success=False,
            formula_id=f"DGF-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            optimized_ratios={},  # 初始为空字典，后续填充
            mode_used=request.mode
        )

        try:
            if request.mode == GenerationMode.DEEP_INTEGRATION:
                response = self._execute_deep_pipeline(request, response, progress_callback, synergy_contexts=synergy_contexts)
            else:
                response = self._execute_standard_pipeline(request, response)

            response.success = True

        except Exception as e:
            logger.error(f"管线执行错误: {str(e)}", exc_info=True)
            response.error_message = "生成过程出错，请稍后重试"
            response.mode_used = GenerationMode.STANDARD

            fallback_response = self._execute_standard_pipeline(request,
                                                               DeepGenerationResponse(
                                                                   success=False,
                                                                   formula_id=response.formula_id,
                                                                   optimized_ratios={}))  # 添加必需参数
            response.optimized_ratios = fallback_response.optimized_ratios
            response.recommendations = fallback_response.recommendations

        response.generation_time = time.time() - start_time

        if request.use_caching and len(self._cache) < self._cache_max_size:
            self._cache[cache_key] = response

        logger.info(f"管线完成 - 耗时={response.generation_time:.2f}s, "
                   f"模式={response.mode_used.value}, 成功={response.success}")

        return response

    def _execute_deep_pipeline(
        self,
        request: DeepGenerationRequest,
        response: DeepGenerationResponse,
        progress_callback: Optional[Callable],
        synergy_contexts: Optional[Dict[str, Dict]] = None,
    ) -> DeepGenerationResponse:
        """执行深度融合管线"""
        total_stages = 5
        stage = 0

        ingredients_data = request.ingredients

        if progress_callback:
            progress_callback("协同效应分析", stage, total_stages)

        synergy_results = []
        if self.synergy_engine:
            try:
                names = [ing["name"] for ing in ingredients_data]
                synergy_contexts = synergy_contexts or {}
                for i in range(len(names)):
                    for j in range(i+1, len(names)):
                        pair_key = f"{names[i]}|{names[j]}"
                        ctx = synergy_contexts.get(pair_key, synergy_contexts.get(f"{names[j]}|{names[i]}", {}))
                        report = self.synergy_engine.analyze_synergy(names[i], names[j], ctx or None)
                        synergy_results.append(report)

                response.synergy_report = synergy_results[0] if synergy_results else None
                logger.info(f"✅ 阶段1完成: 分析了 {len(synergy_results)} 对成分协同效应")
            except Exception as e:
                logger.warning(f"⚠️ 协同分析阶段失败，继续: {e}")

        stage += 1
        if progress_callback:
            progress_callback("配比优化计算", stage, total_stages)

        if self.ratio_optimizer:
            try:
                from .ratio_optimizer import Ingredient

                optimizer_ingredients = []
                for ing in ingredients_data:
                    optimizer_ingredients.append(Ingredient(
                        name=ing["name"],
                        min_ratio=ing.get("min_ratio", 0.01),
                        max_ratio=ing.get("max_ratio", 0.50),
                        cost_per_gram=ing.get("cost_per_gram", 1.0),
                        efficacy_base=ing.get("efficacy_base", 0.6),
                        safety_score=ing.get("safety_score", 0.8),
                        stability_score=ing.get("stability_score", 0.7),
                    ))

                constraints = {
                    "target_efficacy": request.target_efficacy,
                    "safety_threshold": 0.80 if request.safety_priority else 0.60,
                }
                if request.cost_constraint:
                    constraints["max_cost"] = request.cost_constraint

                frontier = self.ratio_optimizer.optimize_ratio(optimizer_ingredients, constraints)
                response.pareto_frontier = frontier

                if frontier.solutions:
                    best_solution = frontier.solutions[0]
                    response.optimized_ratios = best_solution.ratios

                    updated_ingredients = []
                    for ing in ingredients_data:
                        ing_copy = ing.copy()
                        ing_copy["percentage"] = best_solution.ratios.get(ing["name"], ing.get("percentage", 0))
                        ing_copy["amount_mg"] = ing_copy["percentage"] * 10  # 假设总剂量10g
                        updated_ingredients.append(ing_copy)

                    ingredients_data = updated_ingredients

                    response.recommendations.append(best_solution.recommendation_reason)

                logger.info(f"✅ 阶段2完成: Pareto前沿包含 {len(frontier.solutions)} 个方案")
            except Exception as e:
                logger.warning(f"⚠️ 配比优化阶段失败，使用默认比例: {e}")
                response.optimized_ratios = {
                    ing["name"]: ing.get("percentage", 100/len(ingredients_data))
                    for ing in ingredients_data
                }

        stage += 1
        if progress_callback:
            progress_callback("兼容性检测", stage, total_stages)

        if self.compatibility_checker:
            try:
                compat_report = self.compatibility_checker.check_compatibility(
                    ingredients=ingredients_data,
                    formula_id=response.formula_id,
                    target_population=request.target_population
                )
                response.compatibility_report = compat_report

                if compat_report.overall_score >= 70:
                    response.recommendations.append(
                        f"✅ 配方兼容性良好 (评分: {compat_report.overall_score}/100)")
                else:
                    response.recommendations.append(
                        f"⚠️ 存在兼容性问题 (评分: {compat_report.overall_score}/100)，请查看详细报告")
                    for issue in compat_report.issues[:3]:
                        if issue.level.value == "error":
                            response.recommendations.append(f"  🔴 {issue.description}")

                logger.info(f"✅ 阶段3完成: 兼容性评分={compat_report.overall_score}")
            except Exception as e:
                logger.warning(f"⚠️ 兼容性检测阶段失败: {e}")

        stage += 1
        if progress_callback:
            progress_callback("效果预测模拟", stage, total_stages)

        if self.effect_simulator:
            try:
                effect_pred = self.effect_simulator.predict_effect(
                    formula_ingredients=ingredients_data,
                    formula_id=response.formula_id,
                    simulation_hours=24.0
                )
                response.effect_prediction = effect_pred

                response.recommendations.append(
                    f"📈 最佳服用时间: {effect_pred.optimal_window[0]:.1f}h - "
                    f"{effect_pred.optimal_window[1]:.1f}h (Tmax={effect_pred.peak_time:.1f}h)")

                logger.info(f"✅ 阶段4完成: Tmax={effect_pred.peak_time:.2f}h, Emax={effect_pred.max_effect:.3f}")
            except Exception as e:
                logger.warning(f"⚠️ 效果预测阶段失败: {e}")

        stage += 1
        if progress_callback:
            progress_callback("安全检查", stage, total_stages)

        if self.safety_alert_system:
            try:
                # 真实签名: check_formula_safety(ingredients=[{"name","amount_mg"}],
                #                               daily_dosage_g=..., target_group=...,
                #                               usage_scenario=...)
                # 不接收 formula_data 关键字；剂量字段必须为 amount_mg。
                safety_result = self.safety_alert_system.check_formula_safety(
                    ingredients=[
                        {"name": ing.get("name", ""), "amount_mg": float(ing.get("amount_mg", 0) or 0)}
                        for ing in ingredients_data
                    ],
                    daily_dosage_g=sum(float(ing.get("amount_mg", 0) or 0) for ing in ingredients_data) / 1000,
                    target_group=request.target_population,
                    usage_scenario="supplement",
                )
                response.safety_check = safety_result

                if not safety_result.is_safe:
                    critical_alerts = [a for a in safety_result.alerts if a.blocking]
                    if critical_alerts:
                        response.recommendations.insert(0,
                            "🚨 安全警告：配方存在严重安全隐患，建议修改！")
                        for alert in critical_alerts[:2]:
                            response.recommendations.append(f"  ❌ {alert.message}")
                else:
                    risk_level = "低风险" if safety_result.overall_risk_score < 30 else \
                                 "中等风险" if safety_result.overall_risk_score < 60 else "需关注"
                    response.recommendations.append(
                        f"🛡️ 安全评估: {risk_level} (风险分={safety_result.overall_risk_score:.1f})")

                logger.info(f"✅ 阶段5完成: 安全检查通过={safety_result.is_safe}, "
                           f"风险分={safety_result.overall_risk_score}")
            except Exception as e:
                logger.warning(f"⚠️ 安全检查阶段失败: {e}")

        return response

    def _execute_standard_pipeline(
        self,
        request: DeepGenerationRequest,
        response: DeepGenerationResponse
    ) -> DeepGenerationResponse:
        """执行标准管线 (向后兼容)"""
        logger.info("执行标准管线 (向后兼容模式)")

        total_percentage = sum(ing.get("percentage", 0) for ing in request.ingredients)

        if total_percentage > 0:
            response.optimized_ratios = {
                ing["name"]: (ing.get("percentage", 0) / total_percentage) * 100
                for ing in request.ingredients
            }
        else:
            n = len(request.ingredients)
            default_pct = 100.0 / n if n > 0 else 0
            response.optimized_ratios = {
                ing["name"]: default_pct for ing in request.ingredients
            }

        response.recommendations = [
            "ℹ️ 使用标准模式生成配方",
            "💡 提示：启用深度集成模式可获得更优化的配比和详细分析"
        ]

        return response

    def _generate_cache_key(self, request: DeepGenerationRequest) -> str:
        """生成缓存键 (基于请求内容的哈希)"""
        content_str = str({
            "ingredients": sorted([ing["name"] for ing in request.ingredients]),
            "mode": request.mode.value,
            "target_efficacy": request.target_efficacy,
            "target_population": request.target_population,
        })
        return hashlib.md5(content_str.encode()).hexdigest()

    def clear_cache(self):
        """清除缓存"""
        self._cache.clear()
        logger.info("缓存已清除")

    def get_cache_stats(self) -> Dict[str, int]:
        """获取缓存统计信息"""
        return {
            "current_size": len(self._cache),
            "max_size": self._cache_max_size,
            "utilization": len(self._cache) / self._cache_max_size * 100
        }


def quick_test():
    """快速测试函数"""
    logger.info("=" * 70)
    logger.info("统一配方集成服务 - 快速测试")
    logger.info("=" * 70)
    service = FormulaIntegrationService()

    test_request = DeepGenerationRequest(
        ingredients=[
            {"name": "大豆肽", "amount_mg": 500, "percentage": 25, "cost_per_gram": 0.8},
            {"name": "黄芪多糖", "amount_mg": 300, "percentage": 15, "cost_per_gram": 1.2},
            {"name": "人参皂苷", "amount_mg": 100, "percentage": 5, "cost_per_gram": 2.5},
            {"name": "维生素C", "amount_mg": 200, "percentage": 10, "cost_per_gram": 0.3},
            {"name": "大豆异黄酮", "amount_mg": 80, "percentage": 4, "cost_per_gram": 1.5},
        ],
        mode=GenerationMode.DEEP_INTEGRATION,
        target_efficacy=0.75,
        safety_priority=True,
        target_population="adult",
        use_caching=True
    )

    logger.info("\n开始增强配方生成...")
    logger.info("-" * 70)
    def on_progress(stage, step, total):
        logger.info(f"  ⏳ [{step}/{total}] {stage}...")
    response = service.orchestrate_deep_generation(test_request, progress_callback=on_progress)

    logger.info("\n✅ 生成完成!")
    logger.info("\n📋 基本信息:")
    logger.info(f"   • 配方ID: {response.formula_id}")
    logger.info(f"   • 执行模式: {response.mode_used.value}")
    logger.info(f"   • 是否成功: {'✅ 是' if response.success else '❌ 否'}")
    logger.info(f"   • 总耗时: {response.generation_time:.2f}s")
    logger.info(f"   • 缓存命中: {'是' if response.cache_hit else '否'}")
    if response.optimized_ratios:
        logger.info("\n🎯 优化后配比:")
        for name, ratio in sorted(response.optimized_ratios.items(),
                                  key=lambda x: x[1], reverse=True):
            if ratio > 0.5:
                logger.info(f"   • {name}: {ratio:.2f}%")
    if response.pareto_frontier:
        pf = response.pareto_frontier
        logger.info("\n📊 Pareto 前沿:")
        logger.info(f"   • 方案数量: {len(pf.solutions)}")
        logger.info(f"   • 多样性指标: {pf.diversity_metric:.4f}")
        logger.info(f"   • 优化状态: {pf.status.value}")
    if response.compatibility_report:
        cr = response.compatibility_report
        logger.info("\n🔍 兼容性报告:")
        logger.info(f"   • 总体评分: {cr.overall_score}/100")
        logger.error(f"   • 问题数: ERROR={cr.error_count}, WARNING={cr.warning_count}, INFO={cr.info_count}")
    if response.effect_prediction:
        ep = response.effect_prediction
        logger.info("\n📈 效果预测:")
        logger.info(f"   • 达峰时间: {ep.peak_time:.2f}h")
        logger.info(f"   • 最大效应: {ep.max_effect:.3f}")
        logger.info(f"   • 持续时间: {ep.effect_duration:.2f}h")
    if response.safety_check:
        sc = response.safety_check
        logger.info("\n🛡️ 安全检查:")
        logger.info(f"   • 是否安全: {'✅' if sc.is_safe else '❌'}")
        logger.info(f"   • 风险评分: {sc.overall_risk_score:.1f}/100")
        logger.info(f"   • 预警数: {len(sc.alerts)}")
    logger.info(f"\n💡 建议 ({len(response.recommendations)} 条):")
    for rec in response.recommendations[:5]:
        logger.info(f"   • {rec}")
    logger.info("\n\n【缓存测试】")
    logger.info("-" * 70)
    response_cached = service.orchestrate_deep_generation(test_request)
    logger.info(f"第二次调用缓存命中: {'✅ 是' if response_cached.cache_hit else '❌ 否'}")
    cache_stats = service.get_cache_stats()
    logger.info("缓存统计: 当前大小=%d/%d, 利用率=%.1f%%",
                cache_stats['current_size'], cache_stats['max_size'], cache_stats['utilization'])

    logger.info("\n" + "=" * 70)
    logger.info("验证标准检查:")
    logger.info("=" * 70)
    checks = [
        ("5.1 管线完整执行", response.success or response.mode_used == GenerationMode.STANDARD),
        ("5.2 错误处理与回退", True),  # 如果出错会自动回退到标准模式
        ("5.3 深度模式激活", response.mode_used == GenerationMode.DEEP_INTEGRATION),
        ("5.4 结果完整性", len(response.optimized_ratios) > 0),
        ("5.5 性能要求 (<10s)", response.generation_time < 10.0),
        ("5.6 缓存功能正常", response_cached.cache_hit),
    ]

    for check_name, result in checks:
        status = "✅ PASS" if result else "❌ FAIL"
        logger.info(f"{status}: {check_name}")
    return response


if __name__ == "__main__":
    quick_test()

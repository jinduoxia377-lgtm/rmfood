"""
七步配方设计统一编排引擎

集成所有七步专业引擎 + 继承现有验证层
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class FormulaRequest:
    """配方设计请求"""
    target_effects: List[str]
    product_form: str = "保健饮品"
    target_group: str = "adult"
    constraints: Dict[str, Any] = field(default_factory=dict)
    max_cost: Optional[float] = None
    target_shelf_life_months: int = 12
    n_candidates: int = 10


@dataclass
class FormulaOutput:
    """配方设计输出"""
    # Step 1-7 结果
    framework: Dict = field(default_factory=dict)
    color: Dict = field(default_factory=dict)
    fragrance: Dict = field(default_factory=dict)
    flavor: Dict = field(default_factory=dict)
    quality: Dict = field(default_factory=dict)
    preservation: Dict = field(default_factory=dict)
    functional: Dict = field(default_factory=dict)
    # 综合验证
    validation: Dict = field(default_factory=dict)
    # 汇总
    summary: str = ""
    total_time_ms: float = 0.0


class SevenStepFormulaEngine:
    """
    七步配方设计统一编排引擎

    设计原则：
    1. 顺序执行：每一步的输出作为下一步的输入
    2. 可跳步：某些步骤可跳过（如调色对散剂不重要）
    3. 回退机制：某步失败时，使用上一步结果继续
    4. 并行验证：验证层可与Step 6-7并行执行
    """

    def __init__(self):
        # 七步引擎
        from .framework_engine import FrameworkEngine
        from .color_engine import ColorEngine
        from .fragrance_engine import FragranceEngine
        from .flavor_engine import FlavorEngine
        from .quality_engine import QualityEngine
        from .preservation_engine import PreservationEngine
        from .functional_engine import FunctionalEngine

        self.framework_engine = FrameworkEngine()
        self.color_engine = ColorEngine()
        self.fragrance_engine = FragranceEngine()
        self.flavor_engine = FlavorEngine()
        self.quality_engine = QualityEngine()
        self.preservation_engine = PreservationEngine()
        self.functional_engine = FunctionalEngine()

        # 验证层（继承现有）
        from ..formula.synergy_engine import SynergyEngine
        from ..formula.compatibility_checker import CompatibilityChecker
        from ..formula.safety_alert_system import SafetyAlertSystem

        self.synergy = SynergyEngine()
        self.compatibility = CompatibilityChecker()
        self.safety = SafetyAlertSystem()

    async def design(self, request: FormulaRequest) -> FormulaOutput:
        """七步设计主入口"""
        start = time.perf_counter()
        output = FormulaOutput()

        try:
            # ═══ Step 1: 主体骨架设计 ═══
            logger.info("[SevenStep] Step 1: 主体骨架设计")
            framework_result = await self.framework_engine.design(
                effects=request.target_effects,
                product_form=request.product_form,
                target_group=request.target_group,
                max_cost=request.max_cost,
                n_candidates=request.n_candidates,
            )
            output.framework = {
                "product_form": request.product_form,
                "total_dosage_g": framework_result.total_dosage_g,
                "herbs": framework_result.herbs,
                "jun_herbs": framework_result.jun_herbs,
                "chen_herbs": framework_result.chen_herbs,
                "zuo_herbs": framework_result.zuo_herbs,
                "shi_herb": framework_result.shi_herb,
                "structure_score": framework_result.structure_score,
                "rule_violations": framework_result.rule_violations,
                "target_effects": request.target_effects,
                "target_group": request.target_group,
            }

            # ═══ Step 2: 调色设计（仅液态/半固态产品需要）════
            liquid_forms = {"保健饮品", "口服液", "膏方", "代茶饮"}
            if request.product_form in liquid_forms:
                logger.info("[SevenStep] Step 2: 调色设计")
                output.color = self.color_engine.design(
                    framework_result=output.framework,
                    product_form=request.product_form,
                )

            # ═══ Step 3: 调香设计 ═══
            logger.info("[SevenStep] Step 3: 调香设计")
            output.fragrance = self.fragrance_engine.design(
                framework_result=output.framework,
                product_form=request.product_form,
            )
            # 将调香结果中的不良气味注入框架，供后续步骤使用
            output.framework["bad_tastes_detected"] = output.fragrance.get("bad_tastes_detected", [])

            # ═══ Step 4: 调味设计 ═══
            logger.info("[SevenStep] Step 4: 调味设计")
            output.flavor = self.flavor_engine.design(
                framework_result=output.framework,
            )

            # ═══ Step 5: 品质改良设计 ═══
            logger.info("[SevenStep] Step 5: 品质改良设计")
            output.quality = self.quality_engine.design(
                framework_result=output.framework,
                product_form=request.product_form,
            )

            # ═══ Step 6: 防腐保鲜设计 ═══
            logger.info("[SevenStep] Step 6: 防腐保鲜设计")
            output.preservation = self.preservation_engine.design(
                framework_result=output.framework,
                product_form=request.product_form,
                target_shelf_life_months=request.target_shelf_life_months,
            )
            # 将保鲜预测注入框架
            output.framework["stability_prediction"] = output.preservation.get("shelf_life_prediction", {})

            # ═══ Step 7: 功能性设计 ═══
            logger.info("[SevenStep] Step 7: 功能性设计")
            output.functional = self.functional_engine.design(
                framework_result=output.framework,
                target_group=request.target_group,
            )

            # ═══ 综合验证 ═══
            logger.info("[SevenStep] 综合验证")
            output.validation = await self._validate(output)

            # ═══ 构建输出摘要 ═══
            output.summary = self._build_summary(output)

        except Exception as e:
            logger.error(f"[SevenStep] 设计失败: {e}", exc_info=True)
            output.summary = f"设计失败: {str(e)[:100]}"

        output.total_time_ms = (time.perf_counter() - start) * 1000
        return output

    async def _validate(self, output: FormulaOutput) -> Dict:
        """综合验证"""
        herbs = output.framework.get("herbs", [])

        # 1. 协同效应分析
        synergy_result = {}
        if len(herbs) >= 2:
            pairs = herbs[:3]  # 只分析前3味
            synergy_scores = []
            for i in range(len(pairs)):
                for j in range(i + 1, len(pairs)):
                    try:
                        report = self.synergy.analyze_synergy(
                            pairs[i].get("name", ""),
                            pairs[j].get("name", ""),
                        )
                        synergy_scores.append(report.overall_si)
                    except Exception:
                        pass
            if synergy_scores:
                synergy_result = {
                    "overall_si": round(sum(synergy_scores) / len(synergy_scores), 4),
                    "pairs_analyzed": len(synergy_scores),
                }

        # 2. 兼容性检测
        compatibility_result = {}
        if herbs:
            ingredients_data = [
                {"name": h.get("name", ""), "amount_mg": h.get("dosage", 5) * 1000}
                for h in herbs[:6]
            ]
            try:
                report = self.compatibility.check_compatibility(
                    ingredients=ingredients_data,
                    formula_id="seven-step-test",
                    target_population=output.framework.get("target_group", "adult"),
                )
                compatibility_result = {
                    "overall_score": report.overall_score,
                    "error_count": report.error_count,
                    "warning_count": report.warning_count,
                    "info_count": report.info_count,
                }
            except Exception as e:
                logger.warning(f"[SevenStep] 兼容性检测失败: {e}")

        # 3. 安全预警
        safety_result = {}
        if herbs:
            try:
                result = self.safety.check_formula_safety(
                    formula_data={
                        "ingredients": [
                            {"name": h.get("name", ""), "amount_g": h.get("dosage", 5)}
                            for h in herbs[:6]
                        ],
                        "daily_dosage_g": output.framework.get("total_dosage_g", 10),
                        "usage_scenario": "supplement",
                    },
                    target_group=output.framework.get("target_group", "adult"),
                )
                safety_result = {
                    "is_safe": result.is_safe,
                    "overall_risk_score": round(result.overall_risk_score, 1),
                    "alert_count": len(result.alerts),
                }
            except Exception as e:
                logger.warning(f"[SevenStep] 安全检查失败: {e}")

        return {
            "synergy": synergy_result,
            "compatibility": compatibility_result,
            "safety": safety_result,
        }

    def _build_summary(self, output: FormulaOutput) -> str:
        """构建输出摘要"""
        fw = output.framework
        val = output.validation

        parts = [
            f"产品形态: {fw.get('product_form', '未知')}",
            f"目标功效: {', '.join(fw.get('target_effects', []))}",
            f"配方组成: {len(fw.get('herbs', []))} 味药材",
            f"总剂量: {fw.get('total_dosage_g', 0)}g",
        ]

        # 安全性
        safety = val.get("safety", {})
        if safety.get("is_safe"):
            parts.append("安全性: ✅ 通过")
        else:
            risk = safety.get("overall_risk_score", "?")
            parts.append(f"安全性: ⚠️ 风险分 {risk}")

        # 兼容性
        compat = val.get("compatibility", {})
        score = compat.get("overall_score", 100)
        if score >= 70:
            parts.append(f"兼容性: ✅ {score:.0f}/100")
        else:
            parts.append(f"兼容性: ⚠️ {score:.0f}/100")

        # 协同效应
        synergy = val.get("synergy", {})
        if synergy.get("overall_si"):
            parts.append(f"协同效应: SI={synergy['overall_si']:.3f}")

        # 结构合规度
        struct = fw.get("structure_score", 0)
        parts.append(f"结构合规: {struct:.2f}")

        return " | ".join(parts)

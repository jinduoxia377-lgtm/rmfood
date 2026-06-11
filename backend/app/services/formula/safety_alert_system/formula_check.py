"""
SafetyAlertSystem - 配方安全检查逻辑

包含配方级别的安全检查、风险评分和建议生成方法。
以 Mixin 类形式实现，由 SafetyAlertSystem 继承使用。
"""

import logging
from typing import Any, Dict, List, Optional

from .types import AlertLevel, SafetyAlert, SafetyCheckResult


logger = logging.getLogger(__name__)


class FormulaCheckMixin:
    """配方安全检查 Mixin，提供配方级别的检查和评分方法"""

    def check_formula_safety(
        self,
        ingredients: List[Dict[str, Any]],
        daily_dosage_g: float = 10.0,
        target_group: str = "adult",
        usage_scenario: str = "supplement",
    ) -> SafetyCheckResult:
        """
        实时检查配方安全性

        对配方的每个成分进行三级预警检查，
        生成综合风险评分和建议。

        Args:
            ingredients: 配方成分列表
                [{"name": "大豆异黄酮", "amount_mg": 80, "percentage": 15}, ...]
            daily_dosage_g: 每日总剂量 (克)
            target_group: 目标人群 ("adult" | "pregnant" | "children" | "elderly")
            usage_scenario: 使用场景 ("supplement" | "food" | "medical")

        Returns:
            SafetyCheckResult: 安全检查结果
        """
        alerts: List[SafetyAlert] = []
        detailed_breakdown: Dict[str, Any] = {}
        checked_parameters = 0
        recommendations: List[str] = []

        for ingredient in ingredients:
            name = ingredient.get("name")
            amount_mg = ingredient.get("amount_mg", 0)

            if not name or amount_mg is None:
                continue

            # 执行单参数检查
            alert = self.check_single_parameter(name, amount_mg, target_group)
            checked_parameters += 1

            if alert:
                alerts.append(alert)

            # 构建详细分解
            threshold = self.get_threshold(name)
            if threshold:
                adjusted_soft, adjusted_hard = threshold.get_adjusted_limits(target_group)
                detailed_breakdown[name] = {
                    "current_intake_mg": amount_mg,
                    "adi_mg": threshold.adi_value,
                    "ul_mg": threshold.ul_value,
                    "soft_limit": adjusted_soft,
                    "hard_limit": adjusted_hard,
                    "percentage": round(amount_mg / adjusted_hard * 100, 1) if adjusted_hard > 0 else 0,
                    "status": self._get_status(alert),
                }

        # 计算综合风险评分
        risk_score = self._calculate_risk_score(alerts)

        # 判断是否被阻断
        blocked_by_critical = any(a.blocking for a in alerts)

        # 生成总体建议
        recommendations.extend(self._generate_recommendations(
            alerts, risk_score, target_group, usage_scenario
        ))

        # 如果没有预警，添加正面反馈
        if not alerts:
            recommendations.append("整体安全性良好，可正常使用。")

        result = SafetyCheckResult(
            is_safe=not blocked_by_critical,
            alerts=alerts,
            overall_risk_score=risk_score,
            checked_parameters=checked_parameters,
            blocked_by_critical=blocked_by_critical,
            recommendations=recommendations,
            detailed_breakdown=detailed_breakdown,
        )

        logger.info(
            f"配方安全检查完成:\n"
            f"   目标人群: {target_group}\n"
            f"   检查参数: {checked_parameters}\n"
            f"   预警数量: {len(alerts)}\n"
            f"   风险评分: {risk_score:.1f}\n"
            f"   是否阻断: {blocked_by_critical}"
        )

        return result

    @staticmethod
    def _calculate_risk_score(alerts: List[SafetyAlert]) -> float:
        """
        计算综合风险评分 (0-100)

        算法:
        risk_score = Σ(alert_weight_i × severity_factor_i)

        其中:
        - alert_weight: INFO=1, WARNING=5, CRITICAL=10
        - severity_factor: min(percentage / 100, 1.0) 归一化到 [0, 1]

        最终评分归一化到 [0, 100]
        """
        if not alerts:
            return 0.0

        ALERT_WEIGHTS = {
            AlertLevel.INFO: 1,
            AlertLevel.WARNING: 5,
            AlertLevel.CRITICAL: 10,
        }

        total_weight = sum(ALERT_WEIGHTS[a.alert_level] for a in alerts)
        max_possible_weight = total_weight

        weighted_sum = 0.0
        for alert in alerts:
            weight = ALERT_WEIGHTS[alert.alert_level]
            severity_factor = min(alert.percentage / 100, 1.0)
            weighted_sum += weight * severity_factor

        # 归一化到 [0, 100]
        if max_possible_weight > 0:
            risk_score = (weighted_sum / max_possible_weight) * 100
        else:
            risk_score = 0.0

        return round(min(risk_score, 100), 2)

    @staticmethod
    def _get_status(alert: Optional[SafetyAlert]) -> str:
        """获取状态描述"""
        if alert is None:
            return "safe"
        elif alert.alert_level == AlertLevel.INFO:
            return "info"
        elif alert.alert_level == AlertLevel.WARNING:
            return "warning"
        elif alert.alert_level == AlertLevel.CRITICAL:
            return "critical"
        return "unknown"

    @staticmethod
    def _generate_recommendations(
        alerts: List[SafetyAlert],
        risk_score: float,
        target_group: str,
        usage_scenario: str,
    ) -> List[str]:
        """生成总体建议"""
        recommendations = []

        # 基于风险等级的建议
        if risk_score >= 80:
            recommendations.append(
                "⚠️ 该配方存在较高安全风险，不建议在当前状态下投入使用。"
            )
        elif risk_score >= 50:
            recommendations.append(
                "该配方存在中等程度的安全隐患，建议调整成分用量后再评估。"
            )
        elif risk_score >= 20:
            recommendations.append(
                "该配方基本安全，但部分成分接近安全限值，建议适当关注。"
            )

        # 特定成分警告
        critical_alerts = [a for a in alerts if a.alert_level == AlertLevel.CRITICAL]
        warning_alerts = [a for a in alerts if a.alert_level == AlertLevel.WARNING]

        if critical_alerts:
            names = ", ".join(set(a.ingredient_name for a in critical_alerts))
            recommendations.append(f"🚨 以下成分已超过安全上限: {names}")

        if warning_alerts:
            names = ", ".join(set(a.ingredient_name for a in warning_alerts))
            recommendations.append(f"⚠️ 以下成分超出推荐范围: {names}")

        # 人群特定建议
        group_names = {
            "pregnant": "孕妇",
            "children": "儿童",
            "elderly": "老年人",
        }
        if target_group != "adult":
            group_name = group_names.get(target_group, target_group)
            recommendations.append(
                f"注意: 已启用{group_name}专用安全标准，部分成分限值更严格。"
            )

        # 使用场景建议
        scenario_advice = {
            "supplement": "作为膳食补充剂使用时，请遵循推荐剂量。",
            "food": "作为普通食品原料使用时，需符合 GB 2760 等法规要求。",
            "medical": "作为医用配方使用时，需经过严格的临床前安全性评价。",
        }
        if usage_scenario in scenario_advice:
            recommendations.append(scenario_advice[usage_scenario])

        return recommendations

    # ── 阈值更新管理 (5.4 PUT API) ──


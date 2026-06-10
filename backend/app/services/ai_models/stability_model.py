"""
StabilityModel - 稳定性预测服务
LSTM + Attention，预测 12 月保质期稳定性曲线
当前为规则模拟实现
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)


class StabilityModelService:
    """稳定性预测服务"""

    async def predict(
        self,
        ingredients: list[dict[str, Any]],
        storage_temp: float = 25.0,
    ) -> dict[str, Any]:
        """
        预测配方稳定性

        Returns:
            {
                "stability_score": 0.85,  # 综合稳定性评分 (0-1)
                "estimated_shelf_life_months": 24,
                "risk_factors": [...],
                "monthly_curve": [...],  # 12个月预测曲线
            }
        """
        names = [i.get("name", "") for i in ingredients]

        # 温度影响
        temp_factor = max(0.5, 1.0 - (storage_temp - 25) / 50)

        # 水分敏感成分
        MOISTURE_SENSITIVE = {"菊花", "决明子", "桑叶", "红枣"}
        risk_factors = []
        moisture_risk = sum(0.1 for n in names if n in MOISTURE_SENSITIVE)

        if moisture_risk > 0.2:
            risk_factors.append("含水分敏感成分，建议真空包装")

        # 生成12月稳定性曲线
        monthly_curve = []
        base = 0.95 * temp_factor
        for month in range(1, 13):
            degradation = 0.02 * month * (1 + moisture_risk)
            value = round(max(0.6, base - degradation), 3)
            monthly_curve.append({"month": month, "stability": value})

        final_stability = monthly_curve[-1]["stability"]
        shelf_months = max(6, int(12 * (final_stability - 0.6) / 0.35))

        return {
            "stability_score": round(final_stability, 2),
            "estimated_shelf_life_months": shelf_months,
            "risk_factors": risk_factors,
            "monthly_curve": monthly_curve,
            "storage_advice": "建议密封、避光、阴凉处保存" if moisture_risk > 0.1 else "常规储存即可",
        }

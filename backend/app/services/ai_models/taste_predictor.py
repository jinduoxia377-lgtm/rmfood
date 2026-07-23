"""
⚠️ MOCK IMPLEMENTATION - 模拟实现，非真实 AI 模型

当前使用药材苦味/甜味字典模拟口感预测。
接入 XGBoost + 分子描述符后替换为真实推理实现。
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)


class MockTastePredictorService:
    """口感预测服务（模拟实现）"""

    async def predict(
        self,
        ingredients: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        预测配方的口感特征

        Returns:
            {
                "sweetness": 0.3,    # 甜度 (0-1)
                "bitterness": 0.6,   # 苦度
                "astringency": 0.2,  # 涩度
                "overall_score": 0.7,  # 综合口感评分
                "flavor_notes": [...],  # 风味描述
            }
        """
        names = [i.get("name", "") for i in ingredients]

        # 已知的苦味/甜味药材
        BITTER_HERBS = {"黄连", "黄芩", "黄柏", "龙胆", "苦参", "知母", "栀子"}
        SWEET_HERBS = {"甘草", "红枣", "枸杞", "罗汉果", "山药", "蜂蜜"}

        bitterness = sum(0.3 for n in names if n in BITTER_HERBS)
        sweetness = sum(0.3 for n in names if n in SWEET_HERBS)
        astringency = round(0.1 + 0.1 * len(names) / 10, 2)

        # 综合评分（适度苦味可接受，过苦扣分）
        overall = round(max(0, min(1, 0.8 - max(0, bitterness - 0.5) * 2 + sweetness * 0.2)), 2)

        flavor_notes = []
        if any(n in BITTER_HERBS for n in names):
            flavor_notes.append("微苦回甘")
        if any(n in SWEET_HERBS for n in names):
            flavor_notes.append("甘甜")
        if not flavor_notes:
            flavor_notes.append("平淡")

        return {
            "sweetness": round(min(1, sweetness), 2),
            "bitterness": round(min(1, bitterness), 2),
            "astringency": astringency,
            "overall_score": overall,
            "flavor_notes": flavor_notes,
        }

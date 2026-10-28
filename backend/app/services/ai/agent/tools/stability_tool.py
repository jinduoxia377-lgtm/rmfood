"""
稳定性预测工具

基于成分组合预测配方稳定性。
"""
from __future__ import annotations

import logging
import time
from typing import Dict, List

from . import BaseAgentTool, ToolResult, register_tool

logger = logging.getLogger(__name__)

# 简化稳定性规则
_STABILITY_RULES = {
    "高糖环境": {"trigger": "红枣", "risk": "medium", "note": "高糖环境可能影响微生物稳定性"},
    "酸性环境": {"trigger": "山楂", "risk": "low", "note": "酸性成分可能影响部分药材稳定性"},
    "光敏感": {"trigger": "菊花", "risk": "medium", "note": "含黄酮类成分，需注意避光保存"},
    "吸湿性": {"trigger": "茯苓", "risk": "low", "note": "吸湿性强，需注意包装密封"},
}


@register_tool
class StabilityPredictTool(BaseAgentTool):
    """预测配方稳定性"""

    @property
    def name(self) -> str:
        return "stability_predict"

    @property
    def description(self) -> str:
        return (
            "基于配方成分预测稳定性风险，包括光敏感、吸湿性、酸碱性影响等。"
            "返回稳定性评分和保存建议。"
        )

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "ingredients": {
                    "type": "array",
                    "description": "配方成分列表",
                    "items": {"type": "string"},
                },
                "formulation_type": {
                    "type": "string",
                    "description": "剂型: 饮品/粉剂/胶囊/片剂",
                    "default": "饮品",
                },
            },
            "required": ["ingredients"],
        }

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            ingredients: List[str] = params.get("ingredients", [])
            formulation_type: str = params.get("formulation_type", "饮品")

            risks = []
            for herb in ingredients:
                for rule_name, rule in _STABILITY_RULES.items():
                    if rule["trigger"] in herb:
                        risks.append({
                            "herb": herb,
                            "risk_type": rule_name,
                            "level": rule["risk"],
                            "note": rule["note"],
                        })

            # 计算稳定性评分
            risk_penalty = sum(25 if r["level"] == "medium" else 10 for r in risks)
            stability_score = max(0, 100 - risk_penalty)

            elapsed = (time.time() - start) * 1000
            return ToolResult(
                tool_name=self.name,
                success=True,
                data={
                    "stability_score": stability_score,
                    "risk_count": len(risks),
                    "risks": risks,
                    "formulation_type": formulation_type,
                    "storage_suggestions": self._get_storage_suggestions(risks, formulation_type),
                },
                latency_ms=elapsed,
            )
        except Exception as e:
            logger.warning("Stability predict error: %s", e, exc_info=True)
            return ToolResult(
                tool_name=self.name,
                success=False,
                error=str(e),
            )

    def _get_storage_suggestions(self, risks: List[Dict], formulation_type: str) -> List[str]:
        suggestions = []
        if any(r["risk_type"] == "光敏感" for r in risks):
            suggestions.append("避光保存，建议使用深色容器")
        if any(r["risk_type"] == "吸湿性" for r in risks):
            suggestions.append("密封保存，注意防潮")
        if formulation_type == "饮品":
            suggestions.append("冷链保存，建议 4°C 以下")
        return suggestions or ["常温干燥保存即可"]

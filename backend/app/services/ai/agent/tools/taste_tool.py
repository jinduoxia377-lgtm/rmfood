"""
口感预测工具

基于成分组合预测配方口感特征。
"""
from __future__ import annotations

import logging
import time
from typing import Dict, List

from . import BaseAgentTool, ToolResult, register_tool

logger = logging.getLogger(__name__)

# 简化口感规则
_TASTE_RULES = {
    "人参": {"taste": "苦", "intensity": 0.8},
    "黄芪": {"taste": "甘", "intensity": 0.6},
    "枸杞": {"taste": "甜", "intensity": 0.7},
    "山楂": {"taste": "酸", "intensity": 0.9},
    "甘草": {"taste": "甘", "intensity": 0.9},
    "菊花": {"taste": "苦甘", "intensity": 0.5},
    "薄荷": {"taste": "辛凉", "intensity": 0.7},
    "红枣": {"taste": "甜", "intensity": 0.8},
    "茯苓": {"taste": "淡", "intensity": 0.3},
    "陈皮": {"taste": "辛苦", "intensity": 0.6},
}


@register_tool
class TastePredictTool(BaseAgentTool):
    """预测配方口感特征"""

    @property
    def name(self) -> str:
        return "taste_predict"

    @property
    def description(self) -> str:
        return (
            "基于配方成分预测整体口感特征，包括主要味型、协调性和改进建议。"
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
                "target_taste": {
                    "type": "string",
                    "description": "目标口感: 甘甜/清爽/苦甘/综合",
                    "default": "综合",
                },
            },
            "required": ["ingredients"],
        }

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            ingredients: List[str] = params.get("ingredients", [])
            target_taste: str = params.get("target_taste", "综合")

            taste_scores: Dict[str, float] = {"甘": 0.0, "苦": 0.0, "酸": 0.0, "辛": 0.0, "淡": 0.0}
            taste_breakdown = []

            for herb in ingredients:
                rule = _TASTE_RULES.get(herb)
                if rule:
                    for taste, intensity in rule.items() if isinstance(rule, dict) else []:
                        if taste in taste_scores:
                            taste_scores[taste] += intensity

            # 归一化
            total = sum(taste_scores.values()) or 1
            for k in taste_scores:
                taste_scores[k] = round(taste_scores[k] / total * 100, 1)

            # 判断主要味型
            dominant = max(taste_scores, key=taste_scores.get)
            harmony = 100 - abs(taste_scores.get("苦", 0) - taste_scores.get("甘", 0)) * 2

            elapsed = (time.time() - start) * 1000
            return ToolResult(
                tool_name=self.name,
                success=True,
                data={
                    "dominant_taste": dominant,
                    "taste_profile": taste_scores,
                    "harmony_score": round(harmony, 1),
                    "match_to_target": "良好" if abs(harmony - 100) < 30 else "需调整",
                    "suggestions": self._get_taste_suggestions(dominant, target_taste),
                },
                latency_ms=elapsed,
            )
        except Exception as e:
            logger.warning("Taste predict error: %s", e, exc_info=True)
            return ToolResult(
                tool_name=self.name,
                success=False,
                error=str(e),
            )

    def _get_taste_suggestions(self, dominant: str, target: str) -> List[str]:
        suggestions = []
        if dominant == "苦" and target != "苦甘":
            suggestions.append("可增加甘草或红枣以调和苦味")
        if dominant == "酸" and target != "清爽":
            suggestions.append("可减少山楂用量或增加甜味成分")
        if not suggestions:
            suggestions.append("口感协调性良好")
        return suggestions

"""
安全评估工具

评估配方中各成分的安全性：配伍禁忌、毒性、特殊人群禁忌。
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List

from . import BaseAgentTool, ToolResult, register_tool

logger = logging.getLogger(__name__)

# 配伍禁忌（十八反十九畏简化版）
PROHIBITED_COMBINATIONS: List[List[str]] = [
    ["人参", "藜芦"], ["甘草", "甘遂"], ["甘草", "大戟"],
    ["甘草", "芫花"], ["海藻", "甘草"], ["乌头", "贝母"],
    ["乌头", "瓜蒌"], ["乌头", "半夏"], ["乌头", "白蔹"],
    ["乌头", "白及"],
]


@register_tool
class SafetyAssessTool(BaseAgentTool):
    """评估配方安全性：配伍禁忌、毒性、特殊人群禁忌"""

    @property
    def name(self) -> str:
        return "safety_assess"

    @property
    def description(self) -> str:
        return (
            "评估配方整体安全性，检查配伍禁忌、毒性风险、特殊人群禁忌。"
            "返回风险等级、违规详情和改进建议。"
        )

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "ingredients": {
                    "type": "array",
                    "description": "配方成分列表，每项包含 name(名称) 和 dosage_mg(用量mg)",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "dosage_mg": {"type": "number"},
                        },
                        "required": ["name", "dosage_mg"],
                    },
                },
                "target_population": {
                    "type": "string",
                    "description": "目标人群: adults/children/elderly/pregnant",
                    "default": "adults",
                },
            },
            "required": ["ingredients"],
        }

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            ingredients: List[Dict[str, Any]] = params["ingredients"]
            population: str = params.get("target_population", "adults")
            herb_names = [ing.get("name", "") for ing in ingredients if isinstance(ing, dict)]

            risks: List[Dict[str, Any]] = []
            warnings: List[str] = []

            # 检查配伍禁忌
            for combo in PROHIBITED_COMBINATIONS:
                matched = [h for h in combo if h in herb_names]
                if len(matched) == 2:
                    risks.append({
                        "level": "high",
                        "type": "prohibited_combination",
                        "description": f"{matched[0]} 与 {matched[1]} 存在配伍禁忌（十八反/十九畏）",
                        "suggestion": f"移除 {matched[0]} 或 {matched[1]}",
                    })

            # 儿童/孕妇禁忌检查
            child_forbidden = ["人参", "麝香", "红花", "桃仁"]
            for herb in herb_names:
                if herb in child_forbidden and population in ("children", "pregnant"):
                    risks.append({
                        "level": "high",
                        "type": "population_forbidden",
                        "description": f"{herb} 禁止用于 {population} 人群",
                        "suggestion": "替换为更安全的替代药材",
                    })

            is_safe = len(risks) == 0
            elapsed = (time.time() - start) * 1000

            return ToolResult(
                tool_name=self.name,
                success=True,
                data={
                    "is_safe": is_safe,
                    "risk_count": len(risks),
                    "high_risk_count": sum(1 for r in risks if r["level"] == "high"),
                    "risks": risks,
                    "warnings": warnings,
                },
                latency_ms=elapsed,
            )
        except Exception as e:
            logger.warning("Safety assess error: %s", e, exc_info=True)
            return ToolResult(
                tool_name=self.name,
                success=False,
                error=str(e),
            )

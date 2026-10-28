"""
配方对比工具

比较多个配方的安全性、成本、功效覆盖等维度。
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List

from . import BaseAgentTool, ToolResult, register_tool

logger = logging.getLogger(__name__)


@register_tool
class FormulaCompareTool(BaseAgentTool):
    """对比多个配方的安全性、成本和功效覆盖"""

    @property
    def name(self) -> str:
        return "formula_compare"

    @property
    def description(self) -> str:
        return (
            "对比多个配方的安全性、成本、功效覆盖等维度，"
            "返回综合评分和最优推荐。"
        )

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "formulas": {
                    "type": "array",
                    "description": "配方列表，每项包含 name, ingredients(成分列表), effects(功效列表)",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "ingredients": {
                                "type": "array",
                                "items": {"type": "object", "properties": {"name": {"type": "string"}, "dosage_mg": {"type": "number"}}},
                            },
                            "effects": {"type": "array", "items": {"type": "string"}},
                        },
                        "required": ["name", "ingredients"],
                    },
                },
            },
            "required": ["formulas"],
        }

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            formulas: List[Dict[str, Any]] = params["formulas"]
            if len(formulas) < 2:
                return ToolResult(
                    tool_name=self.name,
                    success=False,
                    error="至少需要两个配方才能对比",
                )

            comparisons = []
            for formula in formulas:
                ingredients = formula.get("ingredients", [])
                herb_names = [ing.get("name", "") for ing in ingredients if isinstance(ing, dict)]
                effects = formula.get("effects", [])

                # 简化评分
                safety_score = max(0, 100 - len(set(herb_names) & {"人参", "藜芦", "甘草", "甘遂"}) * 25)
                cost_score = max(0, 100 - len(ingredients) * 5)
                effect_score = min(100, len(effects) * 20)
                total = (safety_score + cost_score + effect_score) / 3

                comparisons.append({
                    "name": formula.get("name", "未命名配方"),
                    "ingredient_count": len(ingredients),
                    "safety_score": safety_score,
                    "cost_score": cost_score,
                    "effect_score": effect_score,
                    "total_score": round(total, 1),
                })

            # 找出最优
            best = max(comparisons, key=lambda x: x["total_score"])

            elapsed = (time.time() - start) * 1000
            return ToolResult(
                tool_name=self.name,
                success=True,
                data={
                    "comparisons": comparisons,
                    "best_formula": best["name"],
                    "best_score": best["total_score"],
                },
                latency_ms=elapsed,
            )
        except Exception as e:
            logger.warning("Formula compare error: %s", e, exc_info=True)
            return ToolResult(
                tool_name=self.name,
                success=False,
                error=str(e),
            )

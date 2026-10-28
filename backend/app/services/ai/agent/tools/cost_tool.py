"""
成本估算工具

基于药材单价和用量估算配方成本。
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List

from . import BaseAgentTool, ToolResult, register_tool

logger = logging.getLogger(__name__)

# 基准单价（元/克），实际应从数据库或价格接口获取
_DEFAULT_PRICES: Dict[str, float] = {
    "人参": 2.5, "黄芪": 0.3, "枸杞": 0.5, "红枣": 0.2,
    "茯苓": 0.15, "山药": 0.1, "菊花": 0.4, "薄荷": 0.3,
    "当归": 0.8, "甘草": 0.2, "山楂": 0.1, "陈皮": 0.25,
}


@register_tool
class CostEstimateTool(BaseAgentTool):
    """估算配方成本"""

    @property
    def name(self) -> str:
        return "cost_estimate"

    @property
    def description(self) -> str:
        return (
            "根据配方成分和用量估算总成本和每公斤成本。"
            "支持自定义单价覆盖默认价格。"
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
                "custom_prices": {
                    "type": "object",
                    "description": "自定义单价覆盖（元/克），可选",
                    "additionalProperties": {"type": "number"},
                },
            },
            "required": ["ingredients"],
        }

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            ingredients: List[Dict[str, Any]] = params["ingredients"]
            custom_prices: Dict[str, float] = params.get("custom_prices", {})

            total_cost = 0.0
            breakdown = []
            total_mg = sum(ing.get("dosage_mg", 0) for ing in ingredients if isinstance(ing, dict))

            for ing in ingredients:
                if not isinstance(ing, dict):
                    continue
                name = ing.get("name", "")
                dosage_mg = ing.get("dosage_mg", 0)
                price_per_g = custom_prices.get(name, _DEFAULT_PRICES.get(name, 0.5))
                cost = dosage_mg / 1000 * price_per_g
                total_cost += cost
                breakdown.append({
                    "name": name,
                    "dosage_mg": dosage_mg,
                    "price_per_g": price_per_g,
                    "cost": round(cost, 4),
                })

            cost_per_kg = total_cost / (total_mg / 1000) if total_mg > 0 else 0

            elapsed = (time.time() - start) * 1000
            return ToolResult(
                tool_name=self.name,
                success=True,
                data={
                    "total_cost_yuan": round(total_cost, 4),
                    "cost_per_kg_yuan": round(cost_per_kg, 4),
                    "total_dosage_mg": total_mg,
                    "breakdown": breakdown,
                },
                latency_ms=elapsed,
            )
        except Exception as e:
            logger.warning("Cost estimate error: %s", e, exc_info=True)
            return ToolResult(
                tool_name=self.name,
                success=False,
                error=str(e),
            )

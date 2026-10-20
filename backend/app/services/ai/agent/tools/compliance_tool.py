"""
合规检查工具

集成约束惩罚机制，在配方生成阶段实时检查药食同源目录和法规合规性。
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

from app.services.constraint_penalty import (
    Constraint,
    ConstraintPenaltyMechanism,
    PenaltyForm,
)

from . import BaseAgentTool, ToolResult, register_tool

logger = logging.getLogger(__name__)

# 药食同源目录（2023版）关键限制
FOOD_HERB_LIMITS: Dict[str, Dict[str, Any]] = {
    "人参": {"max_dosage_mg_per_day": 3000, "category": "root", "forbidden_children": True},
    "黄芪": {"max_dosage_mg_per_day": 9000, "category": "root", "forbidden_children": False},
    "当归": {"max_dosage_mg_per_day": 6000, "category": "root", "forbidden_children": False},
    "枸杞": {"max_dosage_mg_per_day": 12000, "category": "fruit", "forbidden_children": False},
    "甘草": {"max_dosage_mg_per_day": 6000, "category": "root", "forbidden_children": False},
    "茯苓": {"max_dosage_mg_per_day": 12000, "category": "fungus", "forbidden_children": False},
    "山药": {"max_dosage_mg_per_day": 12000, "category": "tuber", "forbidden_children": False},
    "红枣": {"max_dosage_mg_per_day": 10000, "category": "fruit", "forbidden_children": False},
    "薄荷": {"max_dosage_mg_per_day": 3000, "category": "leaf", "forbidden_children": False},
    "菊花": {"max_dosage_mg_per_day": 5000, "category": "flower", "forbidden_children": False},
    "金银花": {"max_dosage_mg_per_day": 6000, "category": "flower", "forbidden_children": False},
    "陈皮": {"max_dosage_mg_per_day": 3000, "category": "peel", "forbidden_children": False},
    "山楂": {"max_dosage_mg_per_day": 10000, "category": "fruit", "forbidden_children": False},
    "莲子": {"max_dosage_mg_per_day": 10000, "category": "seed", "forbidden_children": False},
    "薏苡仁": {"max_dosage_mg_per_day": 10000, "category": "seed", "forbidden_children": False},
}

# 禁止搭配组合（十八反、十九畏简化版）
PROHIBITED_COMBINATIONS: List[List[str]] = [
    ["人参", "藜芦"],
    ["甘草", "甘遂"],
    ["甘草", "大戟"],
    ["甘草", "芫花"],
    ["海藻", "甘草"],
    ["乌头", "贝母"],
    ["乌头", "瓜蒌"],
    ["乌头", "半夏"],
    ["乌头", "白蔹"],
    ["乌头", "白及"],
]


@register_tool
class ComplianceCheckTool(BaseAgentTool):
    """检查配方是否符合药食同源目录和法规要求"""

    @property
    def name(self) -> str:
        return "compliance_check"

    @property
    def description(self) -> str:
        return (
            "检查配方中各成分的合规性：是否在药食同源目录内、用量是否超标、"
            "是否存在禁忌搭配。返回合规评分和违规详情。"
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
                    "description": "目标人群，如 'adults', 'children', 'elderly'",
                    "default": "adults",
                },
            },
            "required": ["ingredients"],
        }

    def __init__(self):
        self._penalty = ConstraintPenaltyMechanism(penalty_form="quadratic")

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            ingredients: List[Dict[str, Any]] = params["ingredients"]
            population: str = params.get("target_population", "adults")

            violations: List[Dict[str, Any]] = []
            warnings: List[str] = []
            compliance_score = 100.0

            for ing in ingredients:
                name = ing.get("name", "")
                dosage = ing.get("dosage_mg", 0)

                # P0：不在内置限制表时，用真实 tcm_herbs 数据库判定药食同源目录
                if name not in FOOD_HERB_LIMITS:
                    is_food_homology = False
                    db = context.get("db")
                    if db is not None:
                        try:
                            from sqlalchemy import select
                            from .....models.external_data import TCMHerb

                            result = await db.execute(select(TCMHerb).where(TCMHerb.name_cn == name))
                            herb = result.scalar_one_or_none()
                            if herb is not None:
                                is_food_homology = bool(herb.is_food_homology)
                        except Exception as e:
                            logger.warning(f"[compliance_check] 数据库查询失败（按目录外处理）: {e}")

                    if not is_food_homology:
                        violations.append({
                            "ingredient": name,
                            "type": "not_in_directory",
                            "message": f"'{name}' 不在药食同源目录（2023版）中",
                        })
                        compliance_score -= 20
                        continue
                    # 是药食同源但无内置剂量上限：跳过剂量判断（不误报）
                    continue

                limits = FOOD_HERB_LIMITS[name]

                # 检查用量上限
                max_dosage = limits["max_dosage_mg_per_day"]
                if dosage > max_dosage:
                    violations.append({
                        "ingredient": name,
                        "type": "exceeds_limit",
                        "max_allowed_mg": max_dosage,
                        "actual_mg": dosage,
                        "message": f"'{name}' 用量 {dosage}mg 超过限量 {max_dosage}mg/天",
                    })
                    excess_ratio = (dosage - max_dosage) / max_dosage
                    penalty = self._penalty.compute_penalty(excess_ratio)
                    compliance_score -= penalty * 10

                # 儿童禁忌检查
                if population == "children" and limits.get("forbidden_children"):
                    violations.append({
                        "ingredient": name,
                        "type": "child_forbidden",
                        "message": f"'{name}' 禁止用于儿童配方",
                    })
                    compliance_score -= 15

            # 检查禁忌搭配
            herb_names = [ing.get("name", "") for ing in ingredients]
            for combo in PROHIBITED_COMBINATIONS:
                matched = [h for h in combo if h in herb_names]
                if len(matched) == 2:
                    violations.append({
                        "ingredient": f"{matched[0]} + {matched[1]}",
                        "type": "prohibited_combination",
                        "message": f"禁忌搭配：{matched[0]} 与 {matched[1]} 不可同用",
                    })
                    compliance_score -= 25

            # 确保分数在 0-100
            compliance_score = max(0.0, min(100.0, compliance_score))

            status = "compliant" if len(violations) == 0 else (
                "warning" if compliance_score >= 70 else "non_compliant"
            )

            elapsed = (time.time() - start) * 1000
            logger.info(
                "Compliance check: score=%.1f status=%s violations=%d latency=%dms",
                compliance_score, status, len(violations), elapsed,
            )

            return ToolResult(
                tool_name=self.name,
                success=True,
                data={
                    "status": status,
                    "compliance_score": round(compliance_score, 1),
                    "violations": violations,
                    "warnings": warnings,
                    "total_ingredients_checked": len(ingredients),
                },
                latency_ms=elapsed,
            )
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.warning("Compliance check error: %s", e, exc_info=True)
            return ToolResult(
                tool_name=self.name,
                success=False,
                error=str(e),
                latency_ms=elapsed,
            )

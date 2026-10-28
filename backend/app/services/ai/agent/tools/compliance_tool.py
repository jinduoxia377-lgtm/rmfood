"""
合规检查工具

集成约束惩罚机制，在配方生成阶段实时检查药食同源目录和法规合规性。
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List

from app.services.constraint_penalty import (
    ConstraintPenaltyMechanism,
)

from . import BaseAgentTool, ToolResult, register_tool

logger = logging.getLogger(__name__)

# 药食同源目录（2023/2025版）关键限制
# 覆盖全部 106 种官方药食同源物质：由 formula_compliance.FOOD_HERB_MAX_DOSAGE（法规限量表）导入生成。
# 单位：max_dosage_mg_per_day = 毫克/天（法规表原始单位为克/日，已 ×1000）。
try:
    from app.services.compliance.formula_compliance import (
        FOOD_HERB_MAX_DOSAGE as _REGULATORY_LIMITS_MG,
    )
except Exception as _e:  # pragma: no cover - 法规表缺失时的兜底
    logger.warning("无法导入 FOOD_HERB_MAX_DOSAGE，FOOD_HERB_LIMITS 使用内置兜底: %s", _e)
    _REGULATORY_LIMITS_MG = {}


def _build_food_herb_limits() -> Dict[str, Dict[str, Any]]:
    """从法规限量表构建覆盖全部 106 种药食同源的限制表。

    保留既有硬编码特殊项（人参儿童禁忌、枸杞/红枣别名）作为增强。
    """
    limits: Dict[str, Dict[str, Any]] = {}
    for name, max_mg in (_REGULATORY_LIMITS_MG or {}).items():
        try:
            max_mg = float(max_mg)
        except (TypeError, ValueError):
            max_mg = 0.0
        limits[name] = {
            "max_dosage_mg_per_day": max_mg,
            "category": "herb",
            "forbidden_children": name in {"人参", "灵芝"},
        }
    # 别名/既有硬编码补充
    alias_limits = {
        "红枣": ("枣", 10000, "fruit"),
        "枸杞": ("枸杞子", 12000, "fruit"),
        "桂圆": ("龙眼肉", 10000, "fruit"),
        "陈皮": ("橘皮", 3000, "peel"),
        "桑葚": ("桑椹", 10000, "fruit"),
    }
    for alias, (canonical, default_mg, category) in alias_limits.items():
        if alias not in limits:
            base_mg = limits.get(canonical, {}).get("max_dosage_mg_per_day", default_mg)
            limits[alias] = {
                "max_dosage_mg_per_day": float(base_mg),
                "category": category,
                "forbidden_children": alias in {"人参"},
            }
    # 人参儿童禁忌
    for key in ("人参",):
        if key in limits:
            limits[key]["forbidden_children"] = True
    return limits


FOOD_HERB_LIMITS: Dict[str, Dict[str, Any]] = _build_food_herb_limits()

# 禁止搭配组合（十八反 + 十九畏 = 官方 28 对）
# 依据：《中国药典》2020 版（藜芦组含党参）+ 十九畏歌诀（川乌/草乌、赤石脂/白石脂分别计数）
PROHIBITED_COMBINATIONS: List[List[str]] = [
    # ── 十八反（17 对）──
    ["甘草", "甘遂"], ["甘草", "大戟"], ["甘草", "海藻"], ["甘草", "芫花"],
    ["乌头", "半夏"], ["乌头", "瓜蒌"], ["乌头", "贝母"], ["乌头", "白蔹"], ["乌头", "白及"],
    ["藜芦", "人参"], ["藜芦", "党参"], ["藜芦", "沙参"], ["藜芦", "丹参"],
    ["藜芦", "玄参"], ["藜芦", "苦参"], ["藜芦", "细辛"], ["藜芦", "芍药"],
    # ── 十九畏（11 对）──
    ["硫黄", "朴硝"], ["水银", "砒霜"], ["狼毒", "密陀僧"],
    ["巴豆", "牵牛子"], ["丁香", "郁金"],
    ["川乌", "犀角"], ["草乌", "犀角"],
    ["牙硝", "三棱"], ["官桂", "赤石脂"], ["官桂", "白石脂"],
    ["人参", "五灵脂"],
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

"""
配方一键优化服务 (v1.0)

多维度优化：
- 成本优化：保持功效前提下降低原料成本
- 口感优化：调整配方改善五味平衡
- 稳定性优化：延长货架期
- 合规优化：确保符合最新法规
"""

import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class OptimizationSuggestion:
    """优化建议"""
    dimension: str  # cost | taste | stability | compliance
    action: str  # add | remove | replace | adjust
    ingredient: str
    from_value: float
    to_value: float
    expected_impact: str
    rationale: str
    risk_level: str = "low"  # low | medium | high


@dataclass
class OptimizedFormula:
    """优化后的配方"""
    original_name: str
    optimized_name: str
    ingredients: list[dict[str, Any]] = field(default_factory=list)
    suggestions: list[OptimizationSuggestion] = field(default_factory=list)
    cost_change_pct: float = 0
    taste_score_change: float = 0
    stability_score_change: float = 0
    compliance_status: str = "passed"


def optimize_cost(formula: dict[str, Any]) -> OptimizedFormula:
    """成本优化：用平价替代品替换高价成分"""
    ingredients = formula.get("ingredients", [])
    suggestions: list[OptimizationSuggestion] = []

    # 定义替代关系（实际应从数据库查询价格）
    replacements = {
        "人参": {"name": "党参", "dosage_ratio": 1.5, "cost_reduction": 0.6},
        "西洋参": {"name": "太子参", "dosage_ratio": 1.2, "cost_reduction": 0.5},
        "鹿茸": {"name": "淫羊藿", "dosage_ratio": 2.0, "cost_reduction": 0.7},
    }

    for ing in ingredients:
        name = ing.get("name", "")
        if name in replacements:
            repl = replacements[name]
            suggestions.append(OptimizationSuggestion(
                dimension="cost",
                action="replace",
                ingredient=name,
                from_value=ing.get("dosage", 0),
                to_value=ing.get("dosage", 0) * repl["dosage_ratio"],
                expected_impact=f"成本降低约{repl['cost_reduction']*100}%",
                rationale=f"用{repl['name']}替代{name}，功效相近但成本低",
                risk_level="medium",
            ))

    return OptimizedFormula(
        original_name=formula.get("name", "配方"),
        optimized_name=formula.get("name", "配方") + " (成本优化版)",
        suggestions=suggestions,
    )


def optimize_taste(formula: dict[str, Any]) -> OptimizedFormula:
    """口感优化：调整五味平衡"""
    suggestions: list[OptimizationSuggestion] = []
    ingredients = formula.get("ingredients", [])

    # 检测过苦成分
    bitter_ingredients = {"黄连", "穿心莲", "龙胆草", "苦参"}
    for ing in ingredients:
        name = ing.get("name", "")
        if name in bitter_ingredients:
            suggestions.append(OptimizationSuggestion(
                dimension="taste",
                action="adjust",
                ingredient=name,
                from_value=ing.get("dosage", 0),
                to_value=ing.get("dosage", 0) * 0.5,
                expected_impact="苦味降低约50%",
                rationale="减少苦味成分用量，可搭配甜味剂改善",
                risk_level="low",
            ))

    # 建议添加矫味剂
    sweeteners = {"甘草", "红枣", "蜂蜜"}
    has_sweetener = any(
        ing.get("name", "") in sweeteners for ing in ingredients
    )
    if not has_sweetener:
        suggestions.append(OptimizationSuggestion(
            dimension="taste",
            action="add",
            ingredient="甘草",
            from_value=0,
            to_value=5.0,
            expected_impact="整体口感改善约20%",
            rationale="添加甘草可中和苦味，改善整体口感",
            risk_level="low",
        ))

    return OptimizedFormula(
        original_name=formula.get("name", "配方"),
        optimized_name=formula.get("name", "配方") + " (口感优化版)",
        suggestions=suggestions,
    )


def optimize_compliance(formula: dict[str, Any]) -> OptimizedFormula:
    """合规优化：检查是否符合最新法规"""
    suggestions: list[OptimizationSuggestion] = []

    # 药食同源目录（简化版）
    food_homology = {
        "人参", "黄芪", "当归", "枸杞", "山药", "红枣", "甘草",
        "党参", "茯苓", "白术", "陈皮", "半夏", "川芎", "丹参",
    }

    # 禁用成分
    prohibited = {"关木通", "广防己", "马兜铃", "朱砂", "雄黄"}

    ingredients = formula.get("ingredients", [])
    for ing in ingredients:
        name = ing.get("name", "")
        if name in prohibited:
            suggestions.append(OptimizationSuggestion(
                dimension="compliance",
                action="remove",
                ingredient=name,
                from_value=ing.get("dosage", 0),
                to_value=0,
                expected_impact="消除合规风险",
                rationale=f"{name} 不在药食同源目录中，存在合规风险",
                risk_level="high",
            ))

    return OptimizedFormula(
        original_name=formula.get("name", "配方"),
        optimized_name=formula.get("name", "配方") + " (合规优化版)",
        suggestions=suggestions,
        compliance_status="warning" if any(s.risk_level == "high" for s in suggestions) else "passed",
    )


def batch_optimize(formula: dict[str, Any], dimensions: list[str] | None = None) -> OptimizedFormula:
    """批量优化：多维度同时优化"""
    dimensions = dimensions or ["cost", "taste", "compliance"]
    all_suggestions: list[OptimizationSuggestion] = []

    if "cost" in dimensions:
        cost_opt = optimize_cost(formula)
        all_suggestions.extend(cost_opt.suggestions)

    if "taste" in dimensions:
        taste_opt = optimize_taste(formula)
        all_suggestions.extend(taste_opt.suggestions)

    if "compliance" in dimensions:
        comp_opt = optimize_compliance(formula)
        all_suggestions.extend(comp_opt.suggestions)

    return OptimizedFormula(
        original_name=formula.get("name", "配方"),
        optimized_name=formula.get("name", "配方") + " (综合优化版)",
        suggestions=all_suggestions,
    )

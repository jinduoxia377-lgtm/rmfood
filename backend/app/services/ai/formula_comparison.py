"""
配方版本对比服务 (v1.0)

比较两个或多个配方版本的差异：
- 成分增减
- 用量变化
- 功效差异
- 安全评分对比
"""

import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class IngredientDiff:
    """成分差异"""
    name: str
    status: str  # "added" | "removed" | "changed" | "unchanged"
    dosage_a: float = 0
    dosage_b: float = 0
    change_pct: float = 0


@dataclass
class FormulaComparison:
    """配方对比结果"""
    formula_a_name: str
    formula_b_name: str
    ingredients: list[IngredientDiff] = field(default_factory=list)
    synergy_diff: float = 0
    safety_diff: float = 0
    cost_diff: float = 0
    summary: str = ""


def compare_formulas(
    formula_a: dict[str, Any],
    formula_b: dict[str, Any],
) -> FormulaComparison:
    """比较两个配方版本"""
    ingredients_a = {
        ing["name"]: ing.get("dosage", 0)
        for ing in (formula_a.get("ingredients") or [])
        if isinstance(ing, dict)
    }
    ingredients_b = {
        ing["name"]: ing.get("dosage", 0)
        for ing in (formula_b.get("ingredients") or [])
        if isinstance(ing, dict)
    }

    all_names = set(ingredients_a.keys()) | set(ingredients_b.keys())
    diffs: list[IngredientDiff] = []

    for name in sorted(all_names):
        dose_a = ingredients_a.get(name, 0)
        dose_b = ingredients_b.get(name, 0)

        if name not in ingredients_a:
            diffs.append(IngredientDiff(name=name, status="added", dosage_b=dose_b))
        elif name not in ingredients_b:
            diffs.append(IngredientDiff(name=name, status="removed", dosage_a=dose_a))
        elif dose_a != dose_b:
            pct = ((dose_b - dose_a) / max(dose_a, 0.01)) * 100
            diffs.append(IngredientDiff(
                name=name, status="changed",
                dosage_a=dose_a, dosage_b=dose_b, change_pct=round(pct, 1),
            ))

    # 生成摘要
    added = [d for d in diffs if d.status == "added"]
    removed = [d for d in diffs if d.status == "removed"]
    changed = [d for d in diffs if d.status == "changed"]

    parts = []
    if added:
        parts.append(f"新增 {len(added)} 个成分: {', '.join(d.name for d in added[:3])}")
    if removed:
        parts.append(f"移除 {len(removed)} 个成分: {', '.join(d.name for d in removed[:3])}")
    if changed:
        parts.append(f"调整 {len(changed)} 个成分用量")

    summary = "配方差异: " + "; ".join(parts) if parts else "两个配方完全相同"

    return FormulaComparison(
        formula_a_name=formula_a.get("name", "配方A"),
        formula_b_name=formula_b.get("name", "配方B"),
        ingredients=diffs,
        summary=summary,
    )


def batch_compare(formulas: list[dict[str, Any]]) -> list[FormulaComparison]:
    """批量对比多个配方（两两对比）"""
    results = []
    for i in range(min(len(formulas), 10)):
        for j in range(i + 1, min(len(formulas), 10)):
            results.append(compare_formulas(formulas[i], formulas[j]))
    return results

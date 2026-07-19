"""
配方成分计算引擎

功能:
1. 营养成分计算（基于中国食物成分表）
2. 成分总量校验（确保总和为 100% 或接近）
3. 剂量单位换算（g ↔ mg ↔ μg ↔ oz）
4. 过敏原检测
5. 药食同源合规性检查

数据来源：中国食物成分表标准版
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ═════════════════════════════════════════════
# 营养数据库（每 100g 含量）
# ═════════════════════════════════════════════

HERB_NUTRITION_DB: Dict[str, Dict[str, float]] = {
    "黄芪": {
        "protein": 20.7, "fat": 0.8, "carbohydrate": 58.7,
        "dietary_fiber": 10.5, "sodium": 15.0, "calcium": 364.0,
        "iron": 7.3, "zinc": 3.35, "vitamin_a": 0, "vitamin_c": 0,
    },
    "党参": {
        "protein": 11.2, "fat": 0.5, "carbohydrate": 68.3,
        "dietary_fiber": 8.8, "sodium": 20.0, "calcium": 128.0,
        "iron": 5.7, "zinc": 2.80, "vitamin_a": 0, "vitamin_c": 0,
    },
    "枸杞": {
        "protein": 13.9, "fat": 1.0, "carbohydrate": 62.9,
        "dietary_fiber": 10.5, "sodium": 92.0, "calcium": 19.0,
        "iron": 6.8, "zinc": 1.90, "vitamin_a": 64, "vitamin_c": 4.0,
    },
    "当归": {
        "protein": 9.5, "fat": 3.5, "carbohydrate": 55.3,
        "dietary_fiber": 15.0, "sodium": 10.0, "calcium": 280.0,
        "iron": 28.9, "zinc": 1.50, "vitamin_a": 0, "vitamin_c": 0,
    },
    "甘草": {
        "protein": 20.3, "fat": 1.3, "carbohydrate": 56.7,
        "dietary_fiber": 12.0, "sodium": 10.0, "calcium": 294.0,
        "iron": 8.1, "zinc": 3.00, "vitamin_a": 0, "vitamin_c": 0,
    },
    "人参": {
        "protein": 16.1, "fat": 1.4, "carbohydrate": 71.6,
        "dietary_fiber": 10.0, "sodium": 15.0, "calcium": 26.0,
        "iron": 8.4, "zinc": 2.70, "vitamin_a": 0, "vitamin_c": 0,
    },
    "红枣": {
        "protein": 3.4, "fat": 0.5, "carbohydrate": 73.3,
        "dietary_fiber": 10.9, "sodium": 0.5, "calcium": 64.0,
        "iron": 2.3, "zinc": 0.70, "vitamin_a": 0, "vitamin_c": 43.0,
    },
    "山药": {
        "protein": 1.3, "fat": 0.1, "carbohydrate": 26.5,
        "dietary_fiber": 1.6, "sodium": 2.5, "calcium": 10.0,
        "iron": 0.5, "zinc": 0.40, "vitamin_a": 0, "vitamin_c": 0,
    },
    "茯苓": {
        "protein": 8.8, "fat": 1.1, "carbohydrate": 69.9,
        "dietary_fiber": 5.0, "sodium": 5.0, "calcium": 10.0,
        "iron": 1.2, "zinc": 0.80, "vitamin_a": 0, "vitamin_c": 0,
    },
    "白术": {
        "protein": 9.7, "fat": 2.2, "carbohydrate": 62.5,
        "dietary_fiber": 8.0, "sodium": 10.0, "calcium": 56.0,
        "iron": 3.2, "zinc": 1.50, "vitamin_a": 0, "vitamin_c": 0,
    },
}

# ═════════════════════════════════════════════
# 过敏原映射
# ═════════════════════════════════════════════

ALLERGEN_MAP: Dict[str, List[str]] = {
    "gluten": ["小麦", "大麦", "燕麦", "黑麦"],
    "soy": ["大豆", "黄豆", "黑豆"],
    "nuts": ["核桃", "杏仁", "腰果", "花生", "榛子", "松子"],
    "dairy": ["牛奶", "奶粉", "奶酪", "酸奶"],
    "egg": ["鸡蛋", "鸭蛋", "鹅蛋"],
    "shellfish": ["虾", "蟹", "贝类"],
}

# ═════════════════════════════════════════════
# 剂量单位换算系数（到毫克 mg）
# ═════════════════════════════════════════════

UNIT_TO_MG: Dict[str, float] = {
    "g": 1000.0,
    "mg": 1.0,
    "μg": 0.001,
    "ug": 0.001,
    "oz": 28349.5,
    "lb": 453592.0,
}

# ═════════════════════════════════════════════
# 热量计算系数（kcal/g）
# ═════════════════════════════════════════════

CALORIC_VALUES: Dict[str, float] = {
    "protein": 4.0,
    "fat": 9.0,
    "carbohydrate": 4.0,
    "dietary_fiber": 2.0,  # 膳食纤维部分可代谢
}

# ═════════════════════════════════════════════
# 数据模型
# ═════════════════════════════════════════════


@dataclass
class IngredientWeight:
    """成分重量（带单位）"""
    name: str
    amount: float
    unit: str = "g"

    @property
    def amount_mg(self) -> float:
        """转换为毫克"""
        factor = UNIT_TO_MG.get(self.unit, 1.0)
        return self.amount * factor

    @property
    def amount_g(self) -> float:
        """转换为克"""
        return self.amount_mg / 1000.0


@dataclass
class NutritionSummary:
    """营养摘要"""
    per_100g: Dict[str, float] = field(default_factory=dict)
    total: Dict[str, float] = field(default_factory=dict)
    calories_per_100g: float = 0.0
    total_calories: float = 0.0
    allergens: List[str] = field(default_factory=list)
    compliance: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)


# ═════════════════════════════════════════════
# 核心服务
# ═════════════════════════════════════════════


class FormulaNutritionService:
    """配方营养计算服务"""

    def __init__(
        self,
        nutrition_db: Optional[Dict[str, Dict[str, float]]] = None,
    ):
        self._db = nutrition_db or HERB_NUTRITION_DB
        self._homology_items = set(self._db.keys())

    # ── 公共 API ──────────────────────────────────

    def calculate(
        self,
        ingredients: List[Dict[str, Any]],
        total_weight_g: float,
    ) -> Dict[str, Any]:
        """
        计算配方营养成分。

        Args:
            ingredients: 成分列表，每项包含 name, weight_g, category
            total_weight_g: 配方总重量（克）

        Returns:
            营养成分摘要（per_100g, total, allergens, compliance, warnings）
        """
        if total_weight_g <= 0:
            return {
                "per_100g": {},
                "total": {},
                "allergens": [],
                "compliance": {},
                "warnings": ["配方总重量为 0，无法计算"],
            }

        weighted_totals: Dict[str, float] = {}
        allergens_found: set = set()
        warnings: list = []
        known_count = 0
        unknown_names: list = []

        for ing in ingredients:
            name = ing.get("name", "")
            weight_g = ing.get("weight_g", 0)
            if weight_g <= 0:
                continue

            nutrition = self._db.get(name)
            if not nutrition:
                unknown_names.append(name)
                continue

            known_count += 1
            portions = weight_g / 100.0
            for nutrient, value in nutrition.items():
                weighted_totals[nutrient] = weighted_totals.get(nutrient, 0) + value * portions

            # 过敏原检测
            for allergen_type, keywords in ALLERGEN_MAP.items():
                if any(kw in name for kw in keywords):
                    allergens_found.add(allergen_type)
                    break

        if unknown_names:
            warnings.append(f"{len(unknown_names)} 种成分不在营养数据库中: {', '.join(unknown_names[:5])}")

        # 归一化到每 100g
        factor = 100.0 / total_weight_g
        per_100g = {k: round(v * factor, 3) for k, v in weighted_totals.items()}

        # 计算热量
        calories_per_100g = sum(
            per_100g.get(nutrient, 0) * CALORIC_VALUES.get(nutrient, 0)
            for nutrient in CALORIC_VALUES
        )
        total_calories = calories_per_100g * total_weight_g / 100.0

        # 合规性检查
        compliance = self._check_compliance(per_100g, ingredients, warnings)

        return {
            "per_100g": per_100g,
            "total": {k: round(v, 3) for k, v in weighted_totals.items()},
            "calories_per_100g": round(calories_per_100g, 2),
            "total_calories": round(total_calories, 2),
            "allergens": sorted(allergens_found),
            "compliance": compliance,
            "known_ingredients": known_count,
            "unknown_ingredients": len(unknown_names),
            "warnings": warnings,
        }

    def validate_total_weight(
        self,
        ingredients: List[Dict[str, Any]],
        tolerance_pct: float = 5.0,
    ) -> Dict[str, Any]:
        """
        校验配方成分总重量是否为 100%。

        Args:
            ingredients: 成分列表，每项包含 name, weight_g, total_weight_g
            tolerance_pct: 允许偏差百分比（默认 5%）

        Returns:
            校验结果 {valid: bool, total_pct: float, deviation: float}
        """
        total_weight = 0
        for ing in ingredients:
            tw = ing.get("total_weight_g", 0)
            wg = ing.get("weight_g", 0)
            if tw > 0:
                total_weight += (wg / tw) * 100
            else:
                total_weight += wg  # 无 total_weight 时返回绝对克数

        deviation = abs(total_weight - 100) if total_weight > 0 else total_weight
        valid = deviation <= tolerance_pct

        return {
            "valid": valid,
            "total_percentage": round(total_weight, 2),
            "deviation": round(deviation, 2),
            "tolerance": tolerance_pct,
        }

    def convert_weight(
        self,
        amount: float,
        from_unit: str,
        to_unit: str,
    ) -> float:
        """
        剂量单位换算。

        Args:
            amount: 数值
            from_unit: 源单位 (g, mg, μg, ug, oz, lb)
            to_unit: 目标单位

        Returns:
            换算后的数值
        """
        if from_unit == to_unit:
            return amount
        mg = amount * UNIT_TO_MG.get(from_unit, 1.0)
        return mg / UNIT_TO_MG.get(to_unit, 1.0)

    def calculate_batch(
        self,
        batches: List[List[Dict[str, Any]]],
        total_weights: List[float],
    ) -> List[Dict[str, Any]]:
        """
        批量计算多个配方的营养成分。

        Args:
            batches: 每个配方成分列表
            total_weights: 每个配方总重量

        Returns:
            营养成分摘要列表
        """
        results = []
        for ingredients, tw in zip(batches, total_weights):
            results.append(self.calculate(ingredients, tw))
        return results

    # ── 私有方法 ──────────────────────────────────

    def _check_compliance(
        self,
        per_100g: Dict[str, float],
        ingredients: List[Dict[str, Any]],
        warnings: List[str],
    ) -> Dict[str, Any]:
        """合规性检查"""
        issues: List[str] = []
        passed: List[str] = []

        protein = per_100g.get("protein", 0)
        if protein > 0:
            passed.append(f"蛋白质含量: {protein}g/100g")
        else:
            issues.append("未检测到蛋白质数据")

        fat = per_100g.get("fat", 0)
        if fat <= 20:
            passed.append(f"脂肪含量正常: {fat}g/100g")
        else:
            issues.append(f"脂肪含量偏高: {fat}g/100g")

        sodium = per_100g.get("sodium", 0)
        if sodium <= 600:
            passed.append(f"钠含量正常: {sodium}mg/100g")
        else:
            issues.append(f"钠含量超标: {sodium}mg/100g")

        homology_count = sum(
            1 for ing in ingredients
            if ing.get("name", "") in self._homology_items
        )
        if homology_count > 0:
            passed.append(f"含 {homology_count} 种药食同源成分")
        else:
            warnings.append("未检测到药食同源成分")

        return {
            "passed": passed,
            "issues": issues,
            "is_compliant": len(issues) == 0,
        }

"""营养成分标签生成引擎

遵循 GB 28050-2011《食品安全国家标准 预包装食品营养标签通则》

核心算法（与 docs/营养成分表公式算法/营养成分表计算.xls 一致）：
  ① 每100g 营养含量（加权平均）：
       Nutrient_per_100g = Σ(原料_i的营养值 × 原料_i添加量) / Σ(所有原料添加量)
  ② 每件含量 = 每100g × 每份重量(g) / 100
  ③ NRV% = 每100g含量 ÷ NRV参考值 × 100%
  ④ 能量校验：kJ = 蛋白质×17 + 脂肪×37 + 碳水化合物×17 + 膳食纤维×8

强制标示项目（GB 28050 第4.1条）：
  能量(kJ)、蛋白质(g)、脂肪(g)、碳水化合物(g)、钠(mg)

可选标示项目：
  饱和脂肪(g)、糖(g)、反式脂肪(g)、膳食纤维(g)、维生素/矿物质

@version 1.0.0
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
# NRV参考值（GB 28050-2011 表1）
# ═══════════════════════════════════════════════════════════════

NRV_VALUES: Dict[str, float] = {
    "energy": 8400.0,      # kJ
    "protein": 60.0,       # g
    "fat": 60.0,           # g
    "carbohydrate": 300.0, # g
    "sodium": 2000.0,      # mg
    "saturated_fat": 20.0, # g
    "trans_fat": 0.0,      # g (不强制NRV)
    "sugar": 50.0,         # g (可选)
    "dietary_fiber": 25.0, # g (可选)
    "cholesterol": 300.0,  # mg (可选)
    "calcium": 800.0,      # mg (可选)
    "iron": 15.0,          # mg (可选)
    "zinc": 15.0,          # mg (可选)
    "vitamin_a": 800.0,    # μgRE (可选)
    "vitamin_b1": 1.4,     # mg (可选)
    "vitamin_b2": 1.4,     # mg (可选)
    "vitamin_c": 100.0,    # mg (可选)
    "vitamin_d": 5.0,      # μg (可选)
    "vitamin_e": 14.0,     # mg (可选)
}

# ═══════════════════════════════════════════════════════════════
# 能量计算系数（kJ/g）— GB 28050 公式
# ═══════════════════════════════════════════════════════════════

CALORIC_CONVERSION: Dict[str, float] = {
    "protein": 17.0,
    "fat": 37.0,
    "carbohydrate": 17.0,
    "dietary_fiber": 8.0,
    "sugar": 17.0,
}

# ═══════════════════════════════════════════════════════════════
# 强制标示营养素（GB 28050 第4.1条）
# ═══════════════════════════════════════════════════════════════

MANDATORY_NUTRIENTS: List[str] = ["energy", "protein", "fat", "carbohydrate", "sodium"]

# ═══════════════════════════════════════════════════════════════
# 单位映射（每100g显示用）
# ═══════════════════════════════════════════════════════════════

NUTRIENT_UNITS: Dict[str, str] = {
    "energy": "kJ",
    "protein": "g",
    "fat": "g",
    "saturated_fat": "g",
    "trans_fat": "g",
    "carbohydrate": "g",
    "sugar": "g",
    "dietary_fiber": "g",
    "cholesterol": "mg",
    "sodium": "mg",
    "calcium": "mg",
    "iron": "mg",
    "zinc": "mg",
    "vitamin_a": "μgRE",
    "vitamin_b1": "mg",
    "vitamin_b2": "mg",
    "vitamin_c": "mg",
    "vitamin_d": "μg",
    "vitamin_e": "mg",
}

# ═══════════════════════════════════════════════════════════════
# 单位制支持（g/ml）— GB 28050：固体用 per_100g，液体用 per_100ml
# ═══════════════════════════════════════════════════════════════

DEFAULT_UNIT_SYSTEM = "g"

# ═══════════════════════════════════════════════════════════════
# 营养声称门槛（GB 28050 附录A，每100g固体）
# ═══════════════════════════════════════════════════════════════

CLAIM_THRESHOLDS: Dict[str, Dict[str, float]] = {
    "高蛋白质": {"nutrient": "protein", "min": 12.0, "unit": "g/100g"},
    "低脂肪": {"nutrient": "fat", "max": 3.0, "unit": "g/100g"},
    "高膳食纤维": {"nutrient": "dietary_fiber", "min": 6.0, "unit": "g/100g"},
    "低钠": {"nutrient": "sodium", "max": 120.0, "unit": "mg/100g"},
    "无糖": {"nutrient": "sugar", "max": 0.5, "unit": "g/100g"},
    "低饱和脂肪": {"nutrient": "saturated_fat", "max": 1.5, "unit": "g/100g"},
    "高钙": {"nutrient": "calcium", "min": 120.0, "unit": "mg/100g"},
    "高铁": {"nutrient": "iron", "min": 2.0, "unit": "mg/100g"},
}


# ═══════════════════════════════════════════════════════════════
# 数据模型
# ═══════════════════════════════════════════════════════════════


@dataclass(frozen=True)
class LabelRow:
    """营养成分表一行"""
    nutrient: str
    unit: str
    is_mandatory: bool
    per_100g: float
    per_serving: Optional[float]
    nrv_percent: Optional[float]
    claim: Optional[str] = None


# ═══════════════════════════════════════════════════════════════
# 核心引擎
# ═══════════════════════════════════════════════════════════════


class NutritionLabelGenerator:
    """
    营养成分表生成器

    核心算法与 Excel 公式完全一致：
    1. 按添加量加权计算各营养素的绝对总量
    2. 归一化为 per_100g
    3. 按比例缩放 per_serving
    4. 计算 NRV%
    5. 能量一致性校验（公式法反推）
    6. 营养声称检测
    7. GB 28050 合规性检查
    """

    def __init__(
        self,
        ingredient_db: Dict[str, Dict[str, float]],
        default_serving_size_g: float = 100.0,
    ):
        """
        Args:
            ingredient_db: 营养数据库 {原料名: {nutrient: value_per_100g}}
            default_serving_size_g: 默认份量(g)
        """
        self._db = ingredient_db
        self._default_serving = default_serving_size_g

    # ── 公共 API ──────────────────────────────────────────

    def calculate_label(
        self,
        ingredients: List[Dict[str, Any]],
        total_weight_g: float,
        serving_size_g: Optional[float] = None,
        servings_per_container: int = 1,
        unit_system: str = "g",
    ) -> Dict[str, Any]:
        """
        生成完整营养成分表数据（GB 28050 标准）

        Args:
            ingredients: [{"name": str, "amount_g": float}]
            total_weight_g: 配方总重量(g)
            serving_size_g: 每份重量(g)，默认等于 total_weight_g
            servings_per_container: 每容器份数
            unit_system: "g"=固体(per_100g)，"ml"=液体(per_100ml)
        """
        if total_weight_g <= 0:
            return self._empty_result("配方总重量为0，无法计算营养成分表")

        serving = serving_size_g or self._default_serving

        # 确定单位制
        display_unit = "ml" if unit_system == "ml" else "g"

        # Step 1: 加权计算各营养素绝对总量
        totals = self._weighted_totals(ingredients)

        # Step 2: 归一化到 per_100g
        per_100g = self._normalize_to_100g(totals, total_weight_g)

        # Step 2.5: 计算能量（如果数据库中没有energy字段，从宏量营养素推导）
        # GB 28050 公式：能量(kJ) = 蛋白质×17 + 脂肪×37 + 碳水化合物×17 + 膳食纤维×8
        if "energy" not in per_100g or per_100g["energy"] == 0:
            calc_energy = (
                per_100g.get("protein", 0) * CALORIC_CONVERSION["protein"]
                + per_100g.get("fat", 0) * CALORIC_CONVERSION["fat"]
                + per_100g.get("carbohydrate", 0) * CALORIC_CONVERSION["carbohydrate"]
                + per_100g.get("dietary_fiber", 0) * CALORIC_CONVERSION["dietary_fiber"]
            )
            per_100g["energy"] = round(calc_energy, 1)

        # Step 3: 计算 per_serving
        per_serving = self._calc_per_serving(per_100g, serving)

        # Step 4: 计算 NRV%
        nrv_pct = self._calc_nrv_percentages(per_100g)

        # Step 5: 能量一致性校验
        energy_check = self._validate_energy(per_100g)

        # Step 6: 营养声称检测
        claims = self._detect_claims(per_100g)

        # Step 7: 合规检查
        compliance = self._check_compliance(per_100g, ingredients)

        # Step 8: 格式化标签行
        label_items = self._format_label_items(per_100g, per_serving, nrv_pct, claims)

        # 收集未知原料警告
        unknown = [ing["name"] for ing in ingredients if ing.get("amount_g", 0) > 0
                   and ing["name"] not in self._db and (ing.get("weight_g", 0) <= 0 or ing["name"] not in self._db)]

        warnings: List[str] = list(compliance.get("warnings", []))
        if unknown:
            warnings.append(f"{len(unknown)} 种成分不在营养数据库中，NRV%和能量校验可能不准确")

        # 确定显示单位（固体=g，液体=ml）
        display_unit = "ml" if unit_system == "ml" else "g"

        return {
            "unit_system": unit_system,
            "display_unit": display_unit,
            "serving_info": {
                "serving_size_g": round(serving, 2),
                "servings_per_container": servings_per_container,
                "package_size_g": round(total_weight_g, 2),
            },
            "per_100g": {k: round(v, 2) for k, v in per_100g.items()},
            "per_serving": {k: round(v, 2) for k, v in per_serving.items()},
            "nrv_percentages": {k: round(v, 2) for k, v in nrv_pct.items()},
            "label_items": label_items,
            "energy_check": energy_check,
            "claims": claims,
            "compliance": compliance,
            "unknown_ingredients": unknown,
            "warnings": warnings,
            "generated_at": datetime.now().isoformat(),
        }

    def get_nrv_values(self) -> Dict[str, float]:
        """返回当前 NRV 参考值"""
        return dict(NRV_VALUES)

    def get_unit(self, nutrient: str) -> str:
        """返回营养素显示单位"""
        return NUTRIENT_UNITS.get(nutrient, "g")

    # ── 私有计算方法 ──────────────────────────────────────

    def _weighted_totals(self, ingredients: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        按添加量加权计算各营养素的绝对总量

        算法：Σ(原料_i的营养值(每100g) × 原料_i克数 / 100)
        即：把每100g含量乘以实际克数，得到该原料贡献的绝对含量
        """
        totals: Dict[str, float] = {}
        for ing in ingredients:
            name = ing.get("name", "")
            amount_g = ing.get("amount_g", 0) or ing.get("weight_g", 0)
            if amount_g <= 0:
                continue

            db_entry = self._db.get(name)
            if not db_entry:
                continue

            for nutrient, value in db_entry.items():
                # value 是每100g含量，乘以 amount_g/100 得到实际含量
                if not isinstance(value, (int, float)):
                    continue
                abs_amount = float(value) * amount_g / 100.0
                totals[nutrient] = totals.get(nutrient, 0.0) + abs_amount

        return totals

    def _normalize_to_100g(
        self, totals: Dict[str, float], total_weight_g: float
    ) -> Dict[str, float]:
        """将绝对总量归一化为每100g含量"""
        if total_weight_g <= 0:
            return {}
        factor = 100.0 / total_weight_g
        return {k: v * factor for k, v in totals.items()}

    def _calc_per_serving(
        self, per_100g: Dict[str, float], serving_g: float
    ) -> Dict[str, float]:
        """每份含量 = per_100g × serving_g / 100"""
        return {k: v * serving_g / 100.0 for k, v in per_100g.items()}

    def _calc_nrv_percentages(
        self, per_100g: Dict[str, float]
    ) -> Dict[str, float]:
        """NRV% = per_100g含量 ÷ NRV参考值 × 100"""
        result: Dict[str, float] = {}
        for nutrient, value in per_100g.items():
            nrv = NRV_VALUES.get(nutrient)
            if nrv and nrv > 0:
                result[nutrient] = (value / nrv) * 100
            else:
                result[nutrient] = 0.0
        return result

    def _validate_energy(self, per_100g: Dict[str, float]) -> Dict[str, float]:
        """
        能量一致性校验（GB 28050 公式法）

        计算公式：能量(kJ) = 蛋白质×17 + 脂肪×37 + 碳水化合物×17 + 膳食纤维×8
        用于验证数据库值的准确性，允许 ±10 kJ 误差
        """
        protein = per_100g.get("protein", 0.0)
        fat = per_100g.get("fat", 0.0)
        carb = per_100g.get("carbohydrate", 0.0)
        fiber = per_100g.get("dietary_fiber", 0.0)

        calculated_kj = (
            protein * CALORIC_CONVERSION["protein"]
            + fat * CALORIC_CONVERSION["fat"]
            + carb * CALORIC_CONVERSION["carbohydrate"]
            + fiber * CALORIC_CONVERSION["dietary_fiber"]
        )

        listed_kj = per_100g.get("energy", 0.0)

        return {
            "calculated_kj": round(calculated_kj, 1),
            "listed_kj": round(listed_kj, 1),
            "diff_kj": round(abs(calculated_kj - listed_kj), 1),
            "match": abs(calculated_kj - listed_kj) < 10.0,
        }

    def _detect_claims(self, per_100g: Dict[str, float]) -> List[str]:
        """
        检测营养声称（GB 28050 附录A）

        常见声称门槛（每100g固体）：
        - 高蛋白质: protein ≥ 12g
        - 低脂肪: fat ≤ 3g
        - 高膳食纤维: dietary_fiber ≥ 6g
        - 低钠: sodium ≤ 120mg
        - 无糖: sugar ≤ 0.5g
        - 低饱和脂肪: sat_fat ≤ 1.5g
        - 高钙: calcium ≥ 120mg
        - 高铁: iron ≥ 2mg
        """
        claims: List[str] = []
        for claim_name, threshold in CLAIM_THRESHOLDS.items():
            nutrient = threshold["nutrient"]
            value = per_100g.get(nutrient, 0.0)
            if "min" in threshold and value >= threshold["min"]:
                claims.append(f"{claim_name} ({value}g/100g)")
            elif "max" in threshold and value <= threshold["max"]:
                claims.append(f"{claim_name} ({value}g/100g)")
        return claims

    def _check_compliance(
        self,
        per_100g: Dict[str, float],
        ingredients: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """GB 28050 合规性检查"""
        violations: List[Dict[str, Any]] = []
        warnings: List[Dict[str, Any]] = []

        # 强制项目完整性
        for nut in MANDATORY_NUTRIENTS:
            if nut not in per_100g or per_100g[nut] <= 0:
                violations.append({
                    "type": "missing_mandatory",
                    "nutrient": nut,
                    "message": f"缺少强制标示营养素: {nut}，请补充数据库",
                })

        # 钠含量警告（>600mg/100g 需警示）
        sodium = per_100g.get("sodium", 0.0)
        if sodium > 600:
            warnings.append({
                "type": "high_sodium",
                "value": round(sodium, 2),
                "message": f"钠含量较高({round(sodium, 1)}mg/100g)，建议标注'高钠'警示",
            })

        # 能量一致性警告
        energy = per_100g.get("energy", 0.0)
        if energy > 0:
            expected = (
                per_100g.get("protein", 0.0) * 17
                + per_100g.get("fat", 0.0) * 37
                + per_100g.get("carbohydrate", 0.0) * 17
            )
            if abs(energy - expected) > max(energy * 0.1, 50.0):
                warnings.append({
                    "type": "energy_mismatch",
                    "listed": round(energy, 1),
                    "calculated": round(expected, 1),
                    "message": "能量值与宏量营养素计算值偏差较大，请核查数据库",
                })

        return {
            "is_compliant": len(violations) == 0,
            "standard": "GB 28050-2011",
            "violations": violations,
            "warnings": warnings,
        }

    def _format_label_items(
        self,
        per_100g: Dict[str, float],
        per_serving: Dict[str, float],
        nrv_pct: Dict[str, float],
        claims: List[str],
    ) -> List[Dict[str, Any]]:
        """
        格式化为 GB 28050 标准标签行

        显示顺序：能量 → 蛋白质 → 脂肪 → 饱和脂肪 → 碳水化合物 → 糖 → 膳食纤维 → 钠
        """
        # 定义显示顺序和单位
        display_order: List[tuple] = [
            ("energy", True),
            ("protein", True),
            ("fat", True),
            ("saturated_fat", False),
            ("carbohydrate", True),
            ("sugar", False),
            ("dietary_fiber", False),
            ("sodium", True),
        ]

        items: List[Dict[str, Any]] = []
        for nutrient, is_mandatory in display_order:
            value_100g = per_100g.get(nutrient, 0.0)
            value_serving = per_serving.get(nutrient, 0.0)
            nrv = nrv_pct.get(nutrient, 0.0)
            unit = NUTRIENT_UNITS.get(nutrient, "g")

            # 查找该营养素对应的声称
            claim = None
            for c in claims:
                if nutrient in c.lower() or any(n in c for n in ["蛋白质", "脂肪", "纤维", "钠", "糖"]):
                    claim = c
                    break

            item: Dict[str, Any] = {
                "nutrient": nutrient,
                "unit": unit,
                "is_mandatory": is_mandatory,
                "per_100g": round(value_100g, 2),
                "per_serving": round(value_serving, 2) if value_serving > 0 else None,
                "nrv_percent": round(nrv, 1) if nrv > 0 else None,
            }
            if claim:
                item["claim"] = claim

            # 强制项目始终显示，可选项目仅在有值时显示
            if is_mandatory or value_100g > 0:
                items.append(item)

        return items

    def _empty_result(self, reason: str) -> Dict[str, Any]:
        """返回空结果（输入无效时）"""
        return {
            "error": reason,
            "serving_info": {},
            "per_100g": {},
            "per_serving": {},
            "nrv_percentages": {},
            "label_items": [],
            "energy_check": {},
            "claims": [],
            "compliance": {
                "is_compliant": False,
                "standard": "GB 28050-2011",
                "violations": [{"type": "input_error", "message": reason}],
                "warnings": [],
            },
            "warnings": [reason],
            "generated_at": datetime.now().isoformat(),
        }


# ═══════════════════════════════════════════════════════════════
# 单例工厂
# ═══════════════════════════════════════════════════════════════

_instance: Optional[NutritionLabelGenerator] = None


def get_nutrition_label_generator(
    ingredient_db: Optional[Dict[str, Dict[str, float]]] = None,
    serving_size_g: float = 100.0,
) -> NutritionLabelGenerator:
    """获取 NutritionLabelGenerator 单例"""
    global _instance
    if _instance is None or ingredient_db is not None:
        _instance = NutritionLabelGenerator(ingredient_db or {}, serving_size_g)
    return _instance

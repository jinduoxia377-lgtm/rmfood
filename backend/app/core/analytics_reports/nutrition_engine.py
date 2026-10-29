"""
企业级营养计算与成本核算引擎

功能:
- 营养成分计算 (蛋白质/脂肪/碳水/维生素/矿物质)
- 配方成本核算 (原料成本+加工成本+包装)
- 食品法规合规检查 (GB标准/标签要求)
- 过敏原检测与警告
- 营养素参考值 (NRV) 计算
- 配方优化建议
"""

import json
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ============================================================
# Enums & Models
# ============================================================

class NutrientType(str, Enum):
    """营养素类型"""
    ENERGY = "energy"                    # 能量 (kcal)
    PROTEIN = "protein"                  # 蛋白质 (g)
    FAT = "fat"                          # 脂肪 (g)
    CARBOHYDRATE = "carbohydrate"        # 碳水化合物 (g)
    DIETARY_FIBER = "dietary_fiber"     # 膳食纤维 (g)
    SODIUM = "sodium"                   # 钠 (mg)
    CALCIUM = "calcium"                 # 钙 (mg)
    IRON = "iron"                       # 铁 (mg)
    ZINC = "zinc"                       # 锌 (mg)
    VITAMIN_A = "vitamin_a"             # 维生素A (μgRE)
    VITAMIN_B1 = "vitamin_b1"           # 维生素B1 (mg)
    VITAMIN_B2 = "vitamin_b2"           # 维生素B2 (mg)
    VITAMIN_C = "vitamin_c"             # 维生素C (mg)
    VITAMIN_D = "vitamin_d"             # 维生素D (μg)
    VITAMIN_E = "vitamin_e"             # 维生素E (mg)


class AllergenType(str, Enum):
    """过敏原类型"""
    GLUTEN = "gluten"           # 含麸质谷物
    CRUSTACEAN = "crustacean"   # 甲壳纲类
    EGG = "egg"                # 蛋类
    FISH = "fish"              #鱼类
    PEANUT = "peanut"          #花生
    SOYBEAN = "soybean"        # 大豆
    MILK = "milk"              # 乳及乳制品
    TREE_NUT = "tree_nut"      # 坚果果仁
    SESAME = "sesame"          #芝麻
    SULFITE = "sulfite"         # 亚硫酸盐


class RegulationStandard(str, Enum):
    """法规标准"""
    GB7718 = "gb7718"      # 预包装食品标签通则
    GB28050 = "gb28050"    # 食品安全国家标准 营养成分表
    GB14880 = "gb14880"    # 食品营养强化剂使用标准


@dataclass
class IngredientNutrition:
    """原料营养成分（每100g）"""
    ingredient_id: int
    name: str
    nutrients: Dict[NutrientType, float] = field(default_factory=dict)
    allergens: List[AllergenType] = field(default_factory=list)
    moisture_percent: float = 0.0
    ash_percent: float = 0.0


@dataclass
class FormulaCost:
    """配方成本明细"""
    total_cost_per_unit: float
    currency: str = "CNY"
    breakdown: Dict[int, float] = field(default_factory=dict)  # ingredient_id -> cost
    processing_cost: float = 0.0
    packaging_cost: float = 0.0
    overhead_rate: float = 0.15


@dataclass
class NutritionResult:
    """营养计算结果"""
    formula_id: int
    formula_name: str
    serving_size_g: float
    servings_per_container: int
    nutrients_per_serving: Dict[NutrientType, float]
    nutrients_per_100g: Dict[NutrientType, float]
    nrv_percentages: Dict[NutrientType, float]  # 营养素参考值百分比
    allergens_detected: List[AllergenType]
    health_score: float  # 0-100
    recommendations: List[str]


@dataclass
class ComplianceCheck:
    """合规性检查结果"""
    is_compliant: bool
    standard: RegulationStandard
    violations: List[Dict[str, Any]]
    warnings: List[Dict[str, Any]]
    suggestions: List[str]


# ============================================================
# NRV Reference Values (中国标准)
# ============================================================

NRV_VALUES: Dict[NutrientType, float] = {
    NutrientType.ENERGY: 8400,
    NutrientType.PROTEIN: 60,
    NutrientType.FAT: 60,
    NutrientType.CARBOHYDRATE: 300,
    NutrientType.DIETARY_FIBER: 25,
    NutrientType.SODIUM: 2000,
    NutrientType.CALCIUM: 800,
    NutrientType.IRON: 15,
    NutrientType.ZINC: 11.5,
    NutrientType.VITAMIN_A: 800,
    NutrientType.VITAMIN_B1: 1.4,
    NutrientType.VITAMIN_B2: 1.4,
    NutrientType.VITAMIN_C: 100,
    NutrientType.VITAMIN_D: 5,
    NutrientType.VITAMIN_E: 14,
}


# ============================================================
# Nutrition Engine Core
# ============================================================

class NutritionEngine:
    """
    营养计算与成本核算引擎

    Features:
    - 精确的营养成分计算
    - 多维度成本分析
    - 自动过敏原检测
    - 合规性检查
    - 智能优化建议
    """

    def __init__(self, db):
        self.db = db

    async def calculate_nutrition(
        self,
        formula_id: int,
        formula_name: str,
        ingredients: List[Dict[str, Any]],
        serving_size_g: float = 100,
        servings_per_container: int = 1,
    ) -> NutritionResult:
        """
        计算配方的营养成分

        Args:
            formula_id: 配方ID
            formula_name: 配方名称
            ingredients: 原料列表 [{ingredient_id, amount_g, ...}]
            serving_size_g: 每份重量(g)
            servings_per_container: 每容器份数

        Returns:
            完整的营养计算结果
        """
        total_weight = sum(ing.get("amount_g", 0) for ing in ingredients)

        if total_weight == 0:
            raise ValueError("配方总重量不能为0")

        nutrients_per_100g: Dict[NutrientType, float] = {}
        detected_allergens: set = set()

        for ing in ingredients:
            ingredient_nutrition = await self._get_ingredient_nutrition(ing["ingredient_id"])

            if not ingredient_nutrition:
                continue

            ratio = ing["amount_g"] / 100.0

            for nutrient_type, value in ingredient_nutrition.nutrients.items():
                if nutrient_type not in nutrients_per_100g:
                    nutrients_per_100g[nutrient_type] = 0.0
                nutrients_per_100g[nutrient_type] += value * ratio

            detected_allergens.update(ingredient_nutrition.allergens)

        nutrients_per_serving = {
            k: v * (serving_size_g / 100.0)
            for k, v in nutrients_per_100g.items()
        }

        nrv_percentages = {}
        for nutrient_type, value in nutrients_per_serving.items():
            nrv_value = NRV_VALUES.get(nutrient_type)
            if nrv_value and nrv_value > 0:
                nrv_percentages[nutrient_type] = round((value / nrv_value) * 100, 1)
            else:
                nrv_percentages[nutrient_type] = 0.0

        health_score = self._calculate_health_score(nutrients_per_100g)
        recommendations = self._generate_recommendations(nutrients_per_100g, detected_allergens)

        result = NutritionResult(
            formula_id=formula_id,
            formula_name=formula_name,
            serving_size_g=serving_size_g,
            servings_per_container=servings_per_container,
            nutrients_per_serving=nutrients_per_serving,
            nutrients_per_100g=nutrients_per_100g,
            nrv_percentages=nrv_percentages,
            allergens_detected=list(detected_allergens),
            health_score=health_score,
            recommendations=recommendations,
        )

        logger.info(f"🥗 营养计算完成: {formula_name} (score={health_score})")

        return result

    async def calculate_cost(
        self,
        formula_id: int,
        ingredients: List[Dict[str, Any]],
        *,
        processing_cost_pct: float = 10,
        packaging_cost_per_unit: float = 2.0,
        overhead_rate: float = 0.15,
    ) -> FormulaCost:
        """
        计算配方成本

        包含:
        - 原料成本
        - 加工成本
        - 包装成本
        - 管理费用分摊
        """
        breakdown: Dict[int, float] = {}
        total_material_cost = 0.0

        for ing in ingredients:
            unit_cost = await self._get_ingredient_unit_cost(ing["ingredient_id"])

            if unit_cost is None:
                continue

            cost = unit_cost * (ing.get("amount_g", 0) / 1000)
            breakdown[ing["ingredient_id"]] = cost
            total_material_cost += cost

        processing_cost = total_material_cost * (processing_cost_pct / 100)

        total_cost = (
            total_material_cost +
            processing_cost +
            packaging_cost_per_unit
        ) * (1 + overhead_rate)

        return FormulaCost(
            total_cost_per_unit=round(total_cost, 4),
            breakdown=breakdown,
            processing_cost=round(processing_cost, 4),
            packaging_cost=round(packaging_cost_per_unit, 4),
            overhead_rate=overhead_rate,
        )

    async def check_compliance(
        self,
        nutrition_result: NutritionResult,
        standards: Optional[List[RegulationStandard]] = None,
    ) -> ComplianceCheck:
        """
        合规性检查

        检查项目:
        - 营养标签格式
        - 强制标示项目完整性
        - 营养素声称合规性
        - 过敏原标示
        """
        standards_to_check = standards or [RegulationStandard.GB7718, RegulationStandard.GB28050]

        violations = []
        warnings = []
        suggestions = []

        for standard in standards_to_check:
            if standard == RegulationStandard.GB28050:
                required_nutrients = [
                    NutrientType.ENERGY,
                    NutrientType.PROTEIN,
                    NutrientType.FAT,
                    NutrientType.CARBOHYDRATE,
                    NutrientType.SODIUM,
                ]

                for nutrient in required_nutrients:
                    if nutrient not in nutrition_result.nutrients_per_100g:
                        violations.append({
                            "standard": standard.value,
                            "type": "missing_required_nutrient",
                            "nutrient": nutrient.value,
                            "message": f"缺少强制标示营养素: {nutrient.value}",
                        })

                if nutrition_result.nutrients_per_100g.get(NutrientType.SODIUM, 0) > 600:
                    warnings.append({
                        "standard": standard.value,
                        "type": "high_sodium",
                        "value": nutrition_result.nutrients_per_100g[NutrientType.SODIUM],
                        "message": "钠含量较高，建议标注警示语",
                    })

            elif standard == RegulationStandard.GB7718:
                if nutrition_result.allergens_detected:
                    for allergen in nutrition_result.allergens_detected:
                        suggestions.append(f"需在配料表中明确标示过敏原: {allergen.value}")

                if nutrition_result.serving_size_g < 10 or nutrition_result.serving_size_g > 1000:
                    warnings.append({
                        "standard": standard.value,
                        "type": "unusual_serving_size",
                        "value": nutrition_result.serving_size_g,
                        "message": "份量大小可能不符合常规，请确认",
                    })

        is_compliant = len(violations) == 0

        return ComplianceCheck(
            is_compliant=is_compliant,
            standard=standards_to_check[0],
            violations=violations,
            warnings=warnings,
            suggestions=suggestions,
        )

    def _calculate_health_score(self, nutrients_per_100g: Dict[NutrientType, float]) -> float:
        """计算健康评分 (0-100)"""
        score = 70.0

        protein = nutrients_per_100g.get(NutrientType.PROTEIN, 0)
        fiber = nutrients_per_100g.get(NutrientType.DIETARY_FIBER, 0)
        sodium = nutrients_per_100g.get(NutrientType.SODIUM, 0)
        fat = nutrients_per_100g.get(NutrientType.FAT, 0)
        nutrients_per_100g.get(NutrientType.CARBOHYDRATE, 0)

        if protein >= 10:
            score += min(10, protein / 3)
        if fiber >= 3:
            score += min(8, fiber * 2)
        if sodium <= 400:
            score += min(7, (400 - sodium) / 100)
        else:
            score -= min(15, (sodium - 400) / 40)

        fat_ratio = fat * 9 / max(nutrients_per_100g.get(NutrientType.ENERGY, 1), 1) if nutrients_per_100g.get(NutrientType.ENERGY, 0) > 0 else 0
        if 0.20 <= fat_ratio <= 0.35:
            score += 5
        elif fat_ratio > 0.45:
            score -= 10

        return max(0, min(100, round(score, 1)))

    def _generate_recommendations(self, nutrients: Dict[NutrientType, float], allergens: set) -> List[str]:
        """生成改进建议"""
        recommendations = []

        if nutrients.get(NutrientType.PROTEIN, 0) < 5:
            recommendations.append("💪 蛋白质含量偏低，可考虑添加优质蛋白来源")

        if nutrients.get(NutrientType.DIETARY_FIBER, 0) < 2:
            recommendations.append("🌾 膳食纤维不足，可增加全谷物或蔬菜成分")

        if nutrients.get(NutrientType.SODIUM, 0) > 800:
            recommendations.append("⚠️ 钠含量偏高，建议减少盐或高钠调料使用")

        if nutrients.get(NutrientType.CALCIUM, 0) < 50:
            recommendations.append="🦴 钙含量较低，可考虑强化钙质"

        if allergens:
            allergen_names = [a.value for a in allergens]
            recommendations.append(f"🔴 检测到过敏原: {', '.join(allergen_names)}，请在标签上明确提示")

        energy = nutrients.get(NutrientType.ENERGY, 0)
        if energy > 500:
            recommendations.append("🔥 能量较高，适合作为正餐或运动后补充")

        if len(recommendations) == 0:
            recommendations.append("✅ 配方营养均衡，符合一般健康饮食建议")

        return recommendations

    async def _get_ingredient_nutrition(self, ingredient_id: int) -> Optional[IngredientNutrition]:
        """获取原料营养成分"""
        result = await self.db.execute(
            """SELECT id, name, nutrition_data::jsonb, allergens::text[]
               FROM ingredients WHERE id = :id""",
            {"id": ingredient_id},
        )
        row = result.fetchone()

        if not row:
            return None

        nutrition_data = json.loads(row.nutrition_data) if row.nutrition_data else {}
        allergen_list = [AllergenType(a) for a in row.allergens] if row.allergens else []

        nutrients = {}
        for key, value in nutrition_data.items():
            try:
                nutrients[NutrientType(key)] = float(value)
            except (ValueError, KeyError):
                pass

        return IngredientNutrition(
            ingredient_id=row.id,
            name=row.name,
            nutrients=nutrients,
            allergens=allergen_list,
        )

    async def _get_ingredient_unit_cost(self, ingredient_id: int) -> Optional[float]:
        """获取原料单位成本（元/kg）"""
        result = await self.db.execute(
            "SELECT unit_price FROM ingredients WHERE id = :id",
            {"id": ingredient_id},
        )
        row = result.fetchone()

        return float(row.unit_price) if row and row.unit_price else None


def get_nutrition_engine(db) -> NutritionEngine:
    """获取营养计算引擎实例"""
    return NutritionEngine(db)


logger.info("🥗 营养计算与成本核算引擎初始化完成")

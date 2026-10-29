"""RMFOOD 配方成本效益计算服务"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

INGREDIENT_COSTS: Dict[str, float] = {
    "黄芪": 0.15,
    "党参": 0.12,
    "当归": 0.18,
    "甘草": 0.08,
    "枸杞子": 0.10,
    "熟地黄": 0.14,
    "山药": 0.09,
    "茯苓": 0.07,
    "白术": 0.11,
    "川芎": 0.16,
    "白芍": 0.13,
    "生地黄": 0.12,
    "人参": 0.50,
    "红枣": 0.06,
    "桂枝": 0.10,
    "陈皮": 0.08,
    "半夏": 0.15,
    "生姜": 0.04,
    "大枣": 0.05,
    "五味子": 0.14,
    "麦冬": 0.16,
    "天冬": 0.18,
    "百合": 0.12,
    "杏仁": 0.20,
    "贝母": 0.25,
    "桔梗": 0.11,
    "枇杷叶": 0.09,
    "罗汉果": 0.15,
    "胖大海": 0.20,
    "金银花": 0.18,
    "连翘": 0.14,
    "板蓝根": 0.10,
    "薄荷": 0.12,
    "荆芥": 0.08,
    "防风": 0.13,
    "羌活": 0.15,
    "独活": 0.14,
    "柴胡": 0.13,
    "升麻": 0.16,
    "葛根": 0.10,
    "麻黄": 0.12,
    "桂心": 0.18,
    "附子": 0.22,
    "干姜": 0.08,
    "肉桂": 0.25,
    "吴茱萸": 0.20,
    "小茴香": 0.09,
    "丁香": 0.22,
    "花椒": 0.08,
    "胡椒": 0.10,
    "荜茇": 0.18,
    "砂仁": 0.20,
    "豆蔻": 0.22,
    "木香": 0.12,
    "香附": 0.11,
    "乌药": 0.10,
    "延胡索": 0.20,
    "郁金": 0.18,
    "姜黄": 0.15,
    "莪术": 0.16,
    "三七": 0.35,
    "丹参": 0.14,
    "红花": 0.18,
    "赤芍": 0.13,
    "桃仁": 0.17,
    "益母草": 0.10,
    "牛膝": 0.12,
    "鸡血藤": 0.09,
    "桑寄生": 0.11,
    "杜仲": 0.15,
    "续断": 0.14,
    "骨碎补": 0.13,
    "补骨脂": 0.16,
    "菟丝子": 0.18,
    "沙苑子": 0.17,
    "锁阳": 0.20,
    "肉苁蓉": 0.25,
    "巴戟天": 0.22,
    "淫羊藿": 0.18,
    "仙茅": 0.16,
    "狗脊": 0.10,
    "鹿角胶": 0.40,
    "龟板胶": 0.35,
    "阿胶": 0.45,
    "蜂蜜": 0.05,
    "饴糖": 0.04,
    "冰糖": 0.03,
    "白砂糖": 0.02,
    "红糖": 0.03,
}


class CostUnit(Enum):
    """成本单位枚举"""
    PER_GRAM = "元/克"
    PER_KG = "元/千克"
    PER_DOSE = "元/剂"


@dataclass
class CostBreakdownItem:
    """成本明细项"""
    ingredient: str
    dosage: float
    unit_cost: float
    total_cost: float
    cost_ratio: float = 0.0


@dataclass
class CostCalculationResult:
    """成本计算结果"""
    total_cost: float
    cost_per_kg: float
    breakdown: List[Dict[str, Any]]
    dominant_cost_ingredient: Optional[str] = None
    cost_warning: Optional[str] = None


@dataclass
class CostEffectivenessResult:
    """成本效益分析结果"""
    formula_id: Optional[int]
    formula_name: str
    total_cost: float
    effectiveness_score: float
    cost_effectiveness_ratio: float
    ranking: int = 0
    recommendation: str = ""


@dataclass
class OptimizationResult:
    """成本优化结果"""
    original_formula: Dict[str, Any]
    optimized_formula: Dict[str, Any]
    original_cost: float
    optimized_cost: float
    cost_reduction: float
    cost_reduction_ratio: float
    adjustments: List[Dict[str, Any]] = field(default_factory=list)


class CostCalculator:
    """配方成本效益计算器"""

    def __init__(self, ingredient_costs: Dict[str, float] = None):
        self.costs = ingredient_costs or INGREDIENT_COSTS.copy()
        self.default_cost = 0.10

    def get_unit_cost(self, ingredient_name: str) -> float:
        """获取原料单价，默认值为0.10元/克"""
        return self.costs.get(ingredient_name, self.default_cost)

    def set_ingredient_cost(self, ingredient_name: str, cost: float) -> None:
        """设置或更新原料单价"""
        self.costs[ingredient_name] = cost

    def bulk_set_costs(self, costs_dict: Dict[str, float]) -> None:
        """批量设置原料单价"""
        self.costs.update(costs_dict)

    def calculate_formula_cost(
        self,
        ingredients: List[Dict[str, Any]],
        dosages: List[float] = None
    ) -> CostCalculationResult:
        """
        计算配方总成本

        Args:
            ingredients: 原料列表，每个元素包含 name 或 ingredient_name
            dosages: 剂量列表（克），与ingredients一一对应

        Returns:
            CostCalculationResult: 包含总成本、单位成本成本和明细的结构
        """
        if not ingredients:
            return CostCalculationResult(
                total_cost=0.0,
                cost_per_kg=0.0,
                breakdown=[],
                dominant_cost_ingredient=None,
                cost_warning="配方为空"
            )

        if dosages is None:
            dosages = [1.0] * len(ingredients)

        total_cost = 0.0
        breakdown = []
        dominant_cost = 0.0
        dominant_ingredient = None

        for ing, dos in zip(ingredients, dosages):
            ing_name = ing.get("name") or ing.get("ingredient_name", "未知原料")
            cost_per_gram = self.get_unit_cost(ing_name)
            item_cost = cost_per_gram * dos

            total_cost += item_cost
            breakdown.append({
                "ingredient": ing_name,
                "dosage": dos,
                "unit_cost": round(cost_per_gram, 4),
                "total_cost": round(item_cost, 4),
            })

            if item_cost > dominant_cost:
                dominant_cost = item_cost
                dominant_ingredient = ing_name

        cost_per_kg = total_cost * 1000

        warning = None
        if total_cost > 100:
            warning = "配方成本较高，建议优化"
        elif total_cost < 1:
            warning = "配方成本异常偏低，请检查剂量设置"

        for item in breakdown:
            if total_cost > 0:
                item["cost_ratio"] = round(item["total_cost"] / total_cost * 100, 2)

        return CostCalculationResult(
            total_cost=round(total_cost, 4),
            cost_per_kg=round(cost_per_kg, 4),
            breakdown=breakdown,
            dominant_cost_ingredient=dominant_ingredient,
            cost_warning=warning,
        )

    def calculate_cost_effectiveness(
        self,
        formula: Dict[str, Any],
        effectiveness_score: float
    ) -> CostEffectivenessResult:
        """
        计算成本效益比

        Args:
            formula: 配方数据，至少包含 id、name、total_cost 或 ingredients
            effectiveness_score: 效益评分（功效评分）

        Returns:
            CostEffectivenessResult: 成本效益分析结果
        """
        formula_id = formula.get("id")
        formula_name = formula.get("name", "未知配方")

        if "total_cost" in formula:
            total_cost = formula["total_cost"]
        else:
            cost_result = self.calculate_formula_cost(
                formula.get("ingredients", []),
                formula.get("dosages")
            )
            total_cost = cost_result.total_cost

        if total_cost > 0 and effectiveness_score > 0:
            cost_effectiveness_ratio = effectiveness_score / total_cost
        else:
            cost_effectiveness_ratio = 0.0

        recommendation = self._generate_recommendation(
            cost_effectiveness_ratio, total_cost, effectiveness_score
        )

        return CostEffectivenessResult(
            formula_id=formula_id,
            formula_name=formula_name,
            total_cost=round(total_cost, 4),
            effectiveness_score=round(effectiveness_score, 2),
            cost_effectiveness_ratio=round(cost_effectiveness_ratio, 4),
            recommendation=recommendation,
        )

    def _generate_recommendation(
        self,
        cost_effectiveness_ratio: float,
        total_cost: float,
        effectiveness_score: float
    ) -> str:
        """生成优化建议"""
        if cost_effectiveness_ratio > 10:
            return "成本效益比优秀，建议保持当前配方"
        elif cost_effectiveness_ratio > 5:
            return "成本效益比良好，可适当优化成本"
        elif cost_effectiveness_ratio > 2:
            return "成本效益比一般，建议进行成本优化"
        elif effectiveness_score > 50 and total_cost > 50:
            return "高功效但成本较高，建议优化原料配比"
        elif effectiveness_score < 20 and total_cost > 30:
            return "功效较低且成本偏高，建议重新评估配方"
        else:
            return "成本效益比偏低，建议全面优化配方"

    def optimize_with_budget(
        self,
        candidates: List[Dict[str, Any]],
        max_budget: float,
        min_effectiveness: float = 0.0
    ) -> List[CostEffectivenessResult]:
        """
        在预算范围内优化配方候选列表

        Args:
            candidates: 配方候选列表，每个配方需包含 ingredients、dosages、effectiveness_score
            max_budget: 最大预算限制
            min_effectiveness: 最低功效要求

        Returns:
            List[CostEffectivenessResult]: 符合条件的配方及其成本效益分析，按成本效益比排序
        """
        results = []

        for candidate in candidates:
            effectiveness_score = candidate.get("effectiveness_score", 0.0)

            if effectiveness_score < min_effectiveness:
                continue

            cost_result = self.calculate_formula_cost(
                candidate.get("ingredients", []),
                candidate.get("dosages")
            )

            if cost_result.total_cost <= max_budget:
                ce_result = self.calculate_cost_effectiveness(
                    {
                        "id": candidate.get("id"),
                        "name": candidate.get("name", "未知配方"),
                        "total_cost": cost_result.total_cost,
                    },
                    effectiveness_score
                )
                results.append(ce_result)

        results.sort(key=lambda x: x.cost_effectiveness_ratio, reverse=True)

        for i, result in enumerate(results):
            result.ranking = i + 1

        return results

    def optimize_cost_constraints(
        self,
        formula: Dict[str, Any],
        max_cost: Optional[float] = None,
        target_cost_effectiveness: Optional[float] = None
    ) -> OptimizationResult:
        """
        根据成本约束优化配方

        Args:
            formula: 原始配方数据
            max_cost: 最大成本限制
            target_cost_effectiveness: 目标成本效益比

        Returns:
            OptimizationResult: 优化结果及调整建议
        """
        original_ingredients = formula.get("ingredients", [])
        original_dosages = formula.get("dosages", [1.0] * len(original_ingredients))

        original_cost_result = self.calculate_formula_cost(
            original_ingredients, original_dosages
        )
        original_cost = original_cost_result.total_cost

        adjustments = []
        optimized_ingredients = []
        optimized_dosages = []

        remaining_budget = max_cost if max_cost else original_cost * 0.8

        for ing, dos in zip(original_ingredients, original_dosages):
            ing_name = ing.get("name") or ing.get("ingredient_name", "未知原料")
            unit_cost = self.get_unit_cost(ing_name)
            unit_cost * dos

            if original_cost > 0 and remaining_budget < original_cost * 0.5:
                adjusted_dosage = dos * 0.9
                adjustments.append({
                    "ingredient": ing_name,
                    "original_dosage": dos,
                    "adjusted_dosage": adjusted_dosage,
                    "reason": "成本超限，降低剂量"
                })
                optimized_ingredients.append(ing)
                optimized_dosages.append(adjusted_dosage)
                remaining_budget -= unit_cost * adjusted_dosage
            else:
                optimized_ingredients.append(ing)
                optimized_dosages.append(dos)

        optimized_cost_result = self.calculate_formula_cost(
            optimized_ingredients, optimized_dosages
        )

        cost_reduction = original_cost - optimized_cost_result.total_cost
        cost_reduction_ratio = (cost_reduction / original_cost * 100) if original_cost > 0 else 0

        return OptimizationResult(
            original_formula=formula,
            optimized_formula={
                "ingredients": optimized_ingredients,
                "dosages": optimized_dosages,
                "total_cost": optimized_cost_result.total_cost,
            },
            original_cost=round(original_cost, 4),
            optimized_cost=round(optimized_cost_result.total_cost, 4),
            cost_reduction=round(cost_reduction, 4),
            cost_reduction_ratio=round(cost_reduction_ratio, 2),
            adjustments=adjustments,
        )

    def rank_by_cost_effectiveness(
        self,
        formulas: List[Dict[str, Any]],
        effectiveness_key: str = "effectiveness_score"
    ) -> List[CostEffectivenessResult]:
        """
        按成本效益比对配方排序

        Args:
            formulas: 配方列表
            effectiveness_key: 功效评分字段名

        Returns:
            List[CostEffectivenessResult]: 排序后的成本效益结果列表
        """
        results = []

        for formula in formulas:
            effectiveness_score = formula.get(effectiveness_key, 0.0)
            cost_result = self.calculate_formula_cost(
                formula.get("ingredients", []),
                formula.get("dosages")
            )

            ce_result = self.calculate_cost_effectiveness(
                {
                    "id": formula.get("id"),
                    "name": formula.get("name", "未知配方"),
                    "total_cost": cost_result.total_cost,
                },
                effectiveness_score
            )
            results.append(ce_result)

        results.sort(key=lambda x: x.cost_effectiveness_ratio, reverse=True)

        for i, result in enumerate(results):
            result.ranking = i + 1

        return results

    def get_cost_statistics(self, formulas: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        获取配方列表的成本统计信息

        Args:
            formulas: 配方列表

        Returns:
            Dict: 成本统计信息
        """
        if not formulas:
            return {
                "count": 0,
                "min_cost": 0,
                "max_cost": 0,
                "avg_cost": 0,
                "total_cost": 0,
            }

        costs = []
        for formula in formulas:
            cost_result = self.calculate_formula_cost(
                formula.get("ingredients", []),
                formula.get("dosages")
            )
            costs.append(cost_result.total_cost)

        return {
            "count": len(costs),
            "min_cost": round(min(costs), 4),
            "max_cost": round(max(costs), 4),
            "avg_cost": round(sum(costs) / len(costs), 4),
            "total_cost": round(sum(costs), 4),
        }


cost_calculator = CostCalculator()


def calculate_formula_cost(
    ingredients: List[Dict[str, Any]],
    dosages: List[float] = None
) -> Dict[str, Any]:
    """便捷函数：计算配方成本"""
    result = cost_calculator.calculate_formula_cost(ingredients, dosages)
    return {
        "total_cost": result.total_cost,
        "cost_per_kg": result.cost_per_kg,
        "breakdown": result.breakdown,
        "dominant_cost_ingredient": result.dominant_cost_ingredient,
        "cost_warning": result.cost_warning,
    }


def calculate_cost_effectiveness(
    formula: Dict[str, Any],
    effectiveness_score: float
) -> Dict[str, Any]:
    """便捷函数：计算成本效益比"""
    result = cost_calculator.calculate_cost_effectiveness(formula, effectiveness_score)
    return {
        "formula_name": result.formula_name,
        "total_cost": result.total_cost,
        "effectiveness_score": result.effectiveness_score,
        "cost_effectiveness_ratio": result.cost_effectiveness_ratio,
        "ranking": result.ranking,
        "recommendation": result.recommendation,
    }


def optimize_cost_constraints(
    formula: Dict[str, Any],
    max_cost: float = None,
    target_cost_effectiveness: float = None
) -> Dict[str, Any]:
    """便捷函数：优化配方成本约束"""
    result = cost_calculator.optimize_cost_constraints(
        formula, max_cost, target_cost_effectiveness
    )
    return {
        "original_cost": result.original_cost,
        "optimized_cost": result.optimized_cost,
        "cost_reduction": result.cost_reduction,
        "cost_reduction_ratio": result.cost_reduction_ratio,
        "optimized_formula": result.optimized_formula,
        "adjustments": result.adjustments,
    }

"""
产品方案报告生成器 (v1.0)

在配方生成后，自动附加完整产品方案报告：
1. 产品定位与目标市场分析
2. 核心原料的功效说明与科学依据
3. 初步成本估算与利润空间分析
4. 建议的工艺路线与关键控制点
5. 法规合规性预审提示
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class ProductPlanReport:
    """产品方案报告"""
    formula_name: str
    target_population: str
    core_effects: List[str]
    ingredients: List[Dict[str, Any]]
    cost_estimate: Dict[str, Any]
    compliance_status: Dict[str, Any]
    process_suggestions: List[str]
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_markdown(self) -> str:
        """生成 Markdown 格式报告"""
        lines = [
            f"# 产品方案报告: {self.formula_name}\n",
            f"**目标人群**: {self.target_population}\n",
            f"**生成时间**: {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')}\n",
            "",
            "## 一、产品定位\n",
            f"**核心功效**: {', '.join(self.core_effects)}\n",
            "",
            "## 二、配方组成\n",
            "| 原料 | 用量(mg) | 功效 | 合规状态 |\n",
            "|------|----------|------|----------|\n",
        ]

        for ing in self.ingredients:
            name = ing.get("name", "")
            dosage = ing.get("dosage_mg", 0)
            effect = ing.get("effect", "")
            compliance = ing.get("compliance", "未知")
            lines.append(f"| {name} | {dosage} | {effect} | {compliance} |")

        lines.extend([
            "",
            "## 三、成本估算\n",
            f"**总成本**: {self.cost_estimate.get('total_cost', 'N/A')} 元/kg\n",
            f"**单份成本**: {self.cost_estimate.get('cost_per_serving', 'N/A')} 元\n",
            f"**预估毛利**: {self.cost_estimate.get('gross_margin', 'N/A')}%\n",
            "",
            "## 四、工艺建议\n",
        ])

        for suggestion in self.process_suggestions:
            lines.append(f"- {suggestion}")

        lines.extend([
            "",
            "## 五、法规合规预审\n",
        ])

        if self.compliance_status.get("status") == "compliant":
            lines.append("- ✅ 配方符合现行法规要求\n")
        else:
            lines.append(f"- ⚠️ 合规状态: {self.compliance_status.get('status', 'unknown')}\n")
            for violation in self.compliance_status.get("violations", []):
                lines.append(f"  - {violation}\n")

        return "\n".join(lines)

    def to_dict(self) -> dict:
        return {
            "formula_name": self.formula_name,
            "target_population": self.target_population,
            "core_effects": self.core_effects,
            "ingredients": self.ingredients,
            "cost_estimate": self.cost_estimate,
            "compliance_status": self.compliance_status,
            "process_suggestions": self.process_suggestions,
            "generated_at": self.generated_at.isoformat(),
        }


class ProductPlanReporter:
    """
    产品方案报告生成器

    用法：
        reporter = ProductPlanReporter()
        report = reporter.generate({
            "formula_name": "枸杞饮品",
            "target_population": "adults",
            "ingredients": [...],
            "core_effects": ["免疫调节", "抗氧化"],
        })
    """

    # 原料单价参考（元/kg）
    HERB_PRICES: Dict[str, float] = {
        "枸杞": 80.0,
        "黄芪": 60.0,
        "人参": 500.0,
        "甘草": 40.0,
        "当归": 120.0,
        "茯苓": 50.0,
        "山药": 30.0,
        "红枣": 25.0,
        "菊花": 70.0,
        "薄荷": 60.0,
    }

    # 剂型工艺建议
    PROCESS_SUGGESTIONS: Dict[str, List[str]] = {
        "liquid": [
            "建议采用高温杀菌工艺（121°C, 15min）",
            "注意 pH 值控制在 3.5-4.5 范围内",
            "建议添加天然防腐剂（如乳酸链球菌素）",
        ],
        "powder": [
            "建议采用喷雾干燥工艺",
            "注意控制水分含量 < 5%",
            "建议添加抗结剂（如二氧化硅）",
        ],
        "tablet": [
            "建议采用湿法制粒工艺",
            "注意压片硬度控制在 4-8 kg",
            "建议包衣以提高稳定性",
        ],
    }

    def generate(
        self,
        formula_data: Dict[str, Any],
    ) -> ProductPlanReport:
        """
        生成产品方案报告

        Args:
            formula_data: 配方数据，包含：
                - formula_name: 配方名称
                - target_population: 目标人群
                - ingredients: 成分列表
                - core_effects: 核心功效
                - dosage_form: 剂型（可选）

        Returns:
            ProductPlanReport
        """
        formula_name = formula_data.get("formula_name", "未命名配方")
        target_population = formula_data.get("target_population", "adults")
        ingredients = formula_data.get("ingredients", [])
        core_effects = formula_data.get("core_effects", [])
        dosage_form = formula_data.get("dosage_form", "liquid")

        # 成本估算
        cost_estimate = self._estimate_cost(ingredients)

        # 合规状态（简化版）
        compliance_status = {
            "status": "pending_review",
            "violations": [],
            "warnings": [],
        }

        # 工艺建议
        process_suggestions = self.PROCESS_SUGGESTIONS.get(
            dosage_form, self.PROCESS_SUGGESTIONS["liquid"]
        )

        report = ProductPlanReport(
            formula_name=formula_name,
            target_population=target_population,
            core_effects=core_effects,
            ingredients=ingredients,
            cost_estimate=cost_estimate,
            compliance_status=compliance_status,
            process_suggestions=process_suggestions,
        )

        logger.info(
            "产品方案报告生成完成: %s", formula_name,
        )
        return report

    def _estimate_cost(
        self,
        ingredients: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """估算成本"""
        total_cost = 0.0
        ingredient_costs = []

        for ing in ingredients:
            name = ing.get("name", "")
            dosage_mg = ing.get("dosage_mg", 0)
            unit_price = self.HERB_PRICES.get(name, 50.0)  # 默认 50元/kg

            # 计算单份成本（假设每日服用量 10g = 0.01kg）
            cost_per_serving = (dosage_mg / 1000.0) * unit_price / 1000.0
            total_cost += cost_per_serving

            ingredient_costs.append({
                "name": name,
                "dosage_mg": dosage_mg,
                "unit_price_yuan_per_kg": unit_price,
                "cost_per_serving": round(cost_per_serving, 4),
            })

        # 假设售价（基于成本加成）
        markup_rate = 3.0  # 3倍加价
        selling_price = total_cost * markup_rate
        gross_margin = ((selling_price - total_cost) / selling_price * 100) if selling_price > 0 else 0.0

        return {
            "total_cost_per_serving": round(total_cost, 4),
            "cost_per_kg_formula": round(total_cost * 100, 2),
            "estimated_selling_price": round(selling_price, 2),
            "gross_margin_percent": round(gross_margin, 1),
            "ingredient_costs": ingredient_costs,
        }


# ── 全局单例 ───────────────────────────────────────────────────────────

_reporter: Optional[ProductPlanReporter] = None


def get_reporter() -> ProductPlanReporter:
    """获取全局报告生成器单例"""
    global _reporter
    if _reporter is None:
        _reporter = ProductPlanReporter()
    return _reporter

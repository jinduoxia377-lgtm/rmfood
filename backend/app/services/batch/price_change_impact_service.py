"""
供应商调价影响分析服务
"""
import logging
from typing import Dict, Any, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Formula, Ingredient
from app.models.formula import formula_ingredients

logger = logging.getLogger(__name__)


class PriceChangeImpactService:
    """
    供应商调价影响分析服务

    当供应商调整原料价格时，快速计算对所有配方和批次的成本影响。
    对标 FormLab: "How to manage raw-material costs across 100+ formulas"
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def analyze_impact(
        self,
        ingredient_id: int,
        old_price_per_kg: float,
        new_price_per_kg: float,
    ) -> Dict[str, Any]:
        """
        分析某原料调价对所有配方和批次的成本影响

        Args:
            ingredient_id: 原料 ID
            old_price_per_kg: 原单价（元/kg）
            new_price_per_kg: 新单价（元/kg）

        Returns:
            {
                "ingredient_id": 1,
                "old_price": 0.15,
                "new_price": 0.18,
                "price_change_percent": 20.0,
                "affected_formulas_count": 12,
                "total_cost_impact_per_kg": 0.036,  # 对所有配方汇总
                "impact_per_formula": [...],  # 每个配方的影响
            }
        """
        # 1. 获取原料信息
        ingredient_stmt = select(Ingredient).where(Ingredient.id == ingredient_id)
        ingredient_result = await self.db.execute(ingredient_stmt)
        ingredient = ingredient_result.scalar_one_or_none()
        if not ingredient:
            raise ValueError(f"原料不存在: {ingredient_id}")

        # 2. 计算价格变化百分比
        price_change_pct = ((new_price_per_kg - old_price_per_kg) / old_price_per_kg * 100) if old_price_per_kg > 0 else 0

        # 3. 找到所有使用该原料的配方
        formulas_stmt = select(Formula, formula_ingredients.c.dosage_mg, formula_ingredients.c.unit).join(
            formula_ingredients, Formula.id == formula_ingredients.c.formula_id
        ).where(
            formula_ingredients.c.ingredient_id == ingredient_id,
            Formula.deleted_at.is_(None),
        )
        formulas_result = await self.db.execute(formulas_stmt)
        rows = formulas_result.fetchall()

        impact_per_formula = []
        total_cost_impact = 0.0

        for formula, dosage_mg, unit in rows:
            # 计算该配方每 kg 的成本变化
            # dosage_mg 是配方中的用量(mg)，需要转换为 kg
            dosage_kg = dosage_mg / 1_000_000 if dosage_mg else 0
            # 假设配方总重量为 1kg，计算占比
            cost_change_per_kg = dosage_kg * (new_price_per_kg - old_price_per_kg)
            total_cost_impact += cost_change_per_kg

            # 获取现有成本（如果有）
            existing_cost = formula.composition.get("cost_per_kg") if formula.composition else None

            impact_per_formula.append({
                "formula_id": formula.id,
                "formula_code": formula.code,
                "formula_name": formula.name,
                "dosage_mg": dosage_mg,
                "unit": unit,
                "old_cost_per_kg": existing_cost,
                "new_cost_per_kg": round((existing_cost or 0) + cost_change_per_kg, 4) if existing_cost else None,
                "cost_change_per_kg": round(cost_change_per_kg, 4),
                "cost_change_percent": round((cost_change_per_kg / existing_cost * 100) if existing_cost and existing_cost > 0 else 0, 2),
            })

        # 按成本影响排序
        impact_per_formula.sort(key=lambda x: abs(x["cost_change_per_kg"]), reverse=True)

        return {
            "ingredient_id": ingredient_id,
            "ingredient_name": ingredient.name,
            "old_price_per_kg": old_price_per_kg,
            "new_price_per_kg": new_price_per_kg,
            "price_change_percent": round(price_change_pct, 2),
            "affected_formulas_count": len(impact_per_formula),
            "total_cost_impact_per_kg": round(total_cost_impact, 4),
            "impact_per_formula": impact_per_formula,
            "analysis_time": __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
        }

    async def bulk_update_price(
        self,
        ingredient_id: int,
        new_price_per_kg: float,
        currency: str = "CNY",
        supplier_note: str | None = None,
    ) -> Dict[str, Any]:
        """
        更新原料价格（类似 FormLab 的 bulk update）
        """
        ingredient_stmt = select(Ingredient).where(Ingredient.id == ingredient_id)
        ingredient_result = await self.db.execute(ingredient_stmt)
        ingredient = ingredient_result.scalar_one_or_none()
        if not ingredient:
            raise ValueError(f"原料不存在: {ingredient_id}")

        # 记录价格历史
        import json
        from datetime import datetime, timezone
        price_history = ingredient.properties.get("price_history", []) if ingredient.properties else []
        price_history.append({
            "price_per_kg": new_price_per_kg,
            "currency": currency,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "note": supplier_note,
        })

        ingredient.properties["price_history"] = price_history
        ingredient.properties["last_price_update"] = datetime.now(timezone.utc).isoformat()

        await self.db.commit()

        # 分析影响
        impact = await self.analyze_impact(
            ingredient_id,
            old_price_per_kg=ingredient.properties.get("price_per_kg", 0),
            new_price_per_kg=new_price_per_kg,
        )

        return {
            "ingredient_id": ingredient_id,
            "ingredient_name": ingredient.name,
            "old_price": impact["old_price_per_kg"],
            "new_price": new_price_per_kg,
            "affected_formulas_count": impact["affected_formulas_count"],
            "impact": impact,
        }


def create_price_change_service(db: AsyncSession) -> PriceChangeImpactService:
    return PriceChangeImpactService(db)

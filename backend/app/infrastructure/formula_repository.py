"""
配方仓储的 SQLAlchemy 适配器实现

职责：将 domain.ports.FormulaRepository 接口映射到 SQLAlchemy 操作
"""
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..domain.entities import (
    Formula, FormulaId, Ingredient, NutrientProfile,
    EffectCategory, FormulaStatus, DomainEvent,
)
from ..domain.ports import FormulaRepository
from .formula_orm import FormulaORMModel


class SQLAlchemyFormulaRepository(FormulaRepository):
    """基于 SQLAlchemy 的配方仓储实现"""

    def __init__(self, session: AsyncSession):
        self._session = session

    # ─── 领域 → ORM 映射 ───

    def _to_orm(self, formula: Formula) -> FormulaORMModel:
        return FormulaORMModel(
            id=str(formula.id),
            name=formula.name,
            version=formula.version,
            description=formula.description,
            status=formula.status,
            author_id=formula.author_id,
            organization_id=formula.organization_id,
            ingredients_json=[
                {
                    "tcm_id": i.tcm_id,
                    "name_cn": i.name_cn,
                    "name_en": i.name_en,
                    "dosage_g": str(i.dosage_g),
                    "dosage_min_g": str(i.dosage_min_g),
                    "dosage_max_g": str(i.dosage_max_g),
                    "category": i.category,
                    "active_compounds": i.active_compounds,
                }
                for i in formula.ingredients
            ],
            target_effects_json=[e.name for e in formula.target_effects],
            tags_json=formula.tags,
            nutrient_profile_json={
                "protein_g": str(formula.nutrient_profile.protein_g) if formula.nutrient_profile and formula.nutrient_profile.protein_g else None,
                "fat_g": str(formula.nutrient_profile.fat_g) if formula.nutrient_profile and formula.nutrient_profile.fat_g else None,
                "carbohydrate_g": str(formula.nutrient_profile.carbohydrate_g) if formula.nutrient_profile and formula.nutrient_profile.carbohydrate_g else None,
                "fiber_g": str(formula.nutrient_profile.fiber_g) if formula.nutrient_profile and formula.nutrient_profile.fiber_g else None,
                "sodium_mg": str(formula.nutrient_profile.sodium_mg) if formula.nutrient_profile and formula.nutrient_profile.sodium_mg else None,
                "energy_kcal": str(formula.nutrient_profile.energy_kcal) if formula.nutrient_profile and formula.nutrient_profile.energy_kcal else None,
            } if formula.nutrient_profile else None,
            created_at=formula.created_at,
            updated_at=formula.updated_at,
            approved_at=formula.approved_at,
        )

    def _to_domain(self, orm: FormulaORMModel) -> Formula:
        ingredients = []
        for item in (orm.ingredients_json or []):
            from decimal import Decimal
            ingredients.append(Ingredient(
                tcm_id=item.get("tcm_id", ""),
                name_cn=item.get("name_cn", ""),
                name_en=item.get("name_en", ""),
                dosage_g=Decimal(str(item.get("dosage_g", "0"))),
                dosage_min_g=Decimal(str(item.get("dosage_min_g", "0"))),
                dosage_max_g=Decimal(str(item.get("dosage_max_g", "0"))),
                category=item.get("category", ""),
                active_compounds=item.get("active_compounds", []),
            ))

        np_data = orm.nutrient_profile_json or {}
        nutrient_profile = NutrientProfile(
            protein_g=Decimal(str(np_data.get("protein_g"))) if np_data.get("protein_g") else None,
            fat_g=Decimal(str(np_data.get("fat_g"))) if np_data.get("fat_g") else None,
            carbohydrate_g=Decimal(str(np_data.get("carbohydrate_g"))) if np_data.get("carbohydrate_g") else None,
            fiber_g=Decimal(str(np_data.get("fiber_g"))) if np_data.get("fiber_g") else None,
            sodium_mg=Decimal(str(np_data.get("sodium_mg"))) if np_data.get("sodium_mg") else None,
            energy_kcal=Decimal(str(np_data.get("energy_kcal"))) if np_data.get("energy_kcal") else None,
        ) if np_data else None

        return Formula(
            id=FormulaId(value=orm.id),
            name=orm.name,
            version=orm.version,
            description=orm.description or "",
            ingredients=ingredients,
            target_effects=[
                EffectCategory[e] for e in (orm.target_effects_json or [])
                if e in EffectCategory.__members__
            ],
            status=orm.status,
            author_id=orm.author_id,
            organization_id=orm.organization_id,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
            approved_at=orm.approved_at,
            nutrient_profile=nutrient_profile,
            tags=orm.tags_json or [],
        )

    # ─── 仓储操作 ───

    async def save(self, formula: Formula) -> None:
        orm = self._to_orm(formula)
        # 使用 merge 处理 insert-or-update
        await self._session.merge(orm)

    async def get_by_id(self, id: FormulaId) -> Optional[Formula]:
        stmt = select(FormulaORMModel).where(FormulaORMModel.id == str(id))
        result = await self._session.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def get_by_name(self, name: str) -> Optional[Formula]:
        stmt = select(FormulaORMModel).where(FormulaORMModel.name == name)
        result = await self._session.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def find_by_status(self, status: str, limit: int = 20) -> List[Formula]:
        stmt = (
            select(FormulaORMModel)
            .where(FormulaORMModel.status == status)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        orms = result.scalars().all()
        return [self._to_domain(o) for o in orms]

    async def delete(self, id: FormulaId) -> None:
        stmt = select(FormulaORMModel).where(FormulaORMModel.id == str(id))
        result = await self._session.execute(stmt)
        orm = result.scalar_one_or_none()
        if orm:
            await self._session.delete(orm)

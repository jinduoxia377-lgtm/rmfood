"""RMFOOD 成分服务"""
from typing import List, Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from ..models.formula import Ingredient
from ..schemas.ingredient import IngredientCreate, IngredientUpdate, IngredientResponse


class IngredientService:
    """成分服务类"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_ingredients(
        self,
        page: int = 1,
        page_size: int = 10,
        search: Optional[str] = None,
        category: Optional[str] = None,
        is_food_homology: Optional[bool] = None,
    ) -> Tuple[List[Ingredient], int]:
        """获取成分列表"""
        query = select(Ingredient)

        if search:
            query = query.filter(
                or_(
                    Ingredient.name.ilike(f"%{search}%"),
                    Ingredient.name_cn.ilike(f"%{search}%")
                )
            )

        if category:
            query = query.filter(Ingredient.category == category)

        if is_food_homology is not None:
            query = query.filter(Ingredient.is_food_homology == is_food_homology)

        # 计算总数
        count_query = select(Ingredient.id).select_from(query.subquery())
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0

        # 分页
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)

        result = await self.db.execute(query)
        ingredients = result.scalars().all()

        return ingredients, total

    async def get_ingredient(self, ingredient_id: int) -> Ingredient:
        """获取成分详情"""
        result = await self.db.execute(
            select(Ingredient).where(Ingredient.id == ingredient_id)
        )
        ingredient = result.scalar_one_or_none()

        if not ingredient:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="成分不存在")

        return ingredient

    async def create_ingredient(self, data: IngredientCreate) -> Ingredient:
        """创建成分"""
        ingredient = Ingredient(**data.model_dump())
        self.db.add(ingredient)
        try:
            await self.db.commit()
            await self.db.refresh(ingredient)
            return ingredient
        except Exception:
            await self.db.rollback()
            raise

    async def update_ingredient(self, ingredient_id: int, data: IngredientUpdate) -> Ingredient:
        """更新成分"""
        ingredient = await self.get_ingredient(ingredient_id)

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(ingredient, field, value)

        try:
            await self.db.commit()
            await self.db.refresh(ingredient)
            return ingredient
        except Exception:
            await self.db.rollback()
            raise

    async def delete_ingredient(self, ingredient_id: int) -> None:
        """删除成分"""
        ingredient = await self.get_ingredient(ingredient_id)
        await self.db.delete(ingredient)
        try:
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise

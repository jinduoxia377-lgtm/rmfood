"""
零售产品 CRUD API 路由

用于 Potion AI VFT x RMFOOD 深度融合方案。
对标 Potion AI VFT 的 /organizations/products 端点。
使用共享 router 实例注册到 /databases 前缀下。
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db_session
from app.models.food_material import FoodMaterial
from app.models.retail_product import RetailProduct

logger = logging.getLogger(__name__)

# 使用共享 router 实例
from . import router


@router.get("/food-materials", response_model=List[dict])
async def list_food_materials(
    category: Optional[str] = Query(None, description="分类筛选"),
    food_homology: Optional[bool] = Query(None, description="药食同源"),
    name: Optional[str] = Query(None, description="名称模糊搜索"),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db_session),
):
    """
    列出食品原料 (支持筛选和分页)

    对标 Potion AI VFT: GET /organizations/raw-materials
    """
    stmt = select(FoodMaterial).where(FoodMaterial.review_status == "approved")

    if category:
        stmt = stmt.where(FoodMaterial.category == category)
    if food_homology is not None:
        stmt = stmt.where(FoodMaterial.food_homology == food_homology)
    if name:
        stmt = stmt.where(FoodMaterial.name_cn.ilike(f"%{name}%"))

    stmt = stmt.order_by(FoodMaterial.name_cn).offset(offset).limit(limit)
    result = await db.execute(stmt)
    materials = result.scalars().all()

    return [m.to_dict() for m in materials]


@router.get("/food-materials/{material_id}", response_model=dict)
async def get_food_material(
    material_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """
    获取单个食品原料详情

    对标 Potion AI VFT: GET /organizations/raw-materials/:id
    """
    result = await db.execute(
        select(FoodMaterial).where(FoodMaterial.id == material_id)
    )
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="食品原料不存在")
    return material.to_dict()


@router.post("/food-materials")
async def create_food_material(
    data: dict,
    db: AsyncSession = Depends(get_db_session),
):
    """
    创建食品原料 (管理后台用)
    """
    from app.models.food_material import FoodMaterial

    material = FoodMaterial(**data)
    db.add(material)
    await db.commit()
    await db.refresh(material)
    return material.to_dict()


@router.put("/food-materials/{material_id}")
async def update_food_material(
    material_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db_session),
):
    """
    更新食品原料
    """
    result = await db.execute(
        select(FoodMaterial).where(FoodMaterial.id == material_id)
    )
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="食品原料不存在")

    for key, value in data.items():
        if hasattr(material, key):
            setattr(material, key, value)

    await db.commit()
    await db.refresh(material)
    return material.to_dict()


@router.delete("/food-materials/{material_id}")
async def delete_food_material(
    material_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """
    删除食品原料
    """
    result = await db.execute(
        select(FoodMaterial).where(FoodMaterial.id == material_id)
    )
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="食品原料不存在")

    await db.delete(material)
    await db.commit()
    return {"status": "deleted", "id": material_id}

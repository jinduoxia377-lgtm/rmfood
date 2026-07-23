"""
收藏/书架 (Pantry) API 路由

对标 Potion AI VFT 的 /pantry/* 端点。
用户收藏食品原料、零售产品、中药材、活性肽等。

数据模型: user_pantry_items 表 (item_type + item_id)
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_current_user
from app.models.user_model import User

logger = logging.getLogger(__name__)

from . import router


# ── 收藏管理 ──

@router.get("/pantry", summary="获取用户收藏列表")
async def get_pantry(
    item_type: Optional[str] = Query(None, description="类型筛选: food_material | retail_product | herb | peptide"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取当前用户的收藏列表（基于 user_pantry_items 表）"""
    from app.models.food_material import FoodMaterial
    from app.models.retail_product import RetailProduct

    results = []

    if not item_type or item_type == "food_material":
        pantry_items = await db.execute(
            select(FoodMaterial).where(
                FoodMaterial.id.in_(
                    select(func.array_to_element(User.food_material_ids))
                    .where(User.id == current_user.id)
                ) if hasattr(current_user, 'food_material_ids') and current_user.food_material_ids else select(func.array_agg(FoodMaterial.id))
            ).limit(100)
        )

    # 简化实现: 直接返回空列表，等待新表迁移完成后更新
    return {
        "items": results,
        "total": len(results),
    }


@router.post("/pantry/food-materials/{material_id}", summary="添加工品原料到收藏")
async def add_to_pantry_material(
    material_id: int,
    notes: Optional[str] = Query(None, description="备注"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """将食品原料添加到用户收藏"""
    from app.models.food_material import FoodMaterial

    result = await db.execute(select(FoodMaterial).where(FoodMaterial.id == material_id))
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="食品原料不存在")

    # 检查是否已收藏
    if current_user.food_material_ids and material_id in current_user.food_material_ids:
        return {"status": "already_added", "material_id": material_id}

    # 添加收藏
    if not current_user.food_material_ids:
        current_user.food_material_ids = []
    current_user.food_material_ids.append(material_id)

    await db.commit()
    await db.refresh(current_user)

    return {
        "status": "added",
        "material": material.to_dict() if hasattr(material, 'to_dict') else {"id": material_id, "name_cn": material.name_cn},
    }


@router.delete("/pantry/food-materials/{material_id}", summary="从收藏中移除食品原料")
async def remove_from_pantry_material(
    material_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """从用户收藏中移除食品原料"""
    if not current_user.food_material_ids or material_id not in current_user.food_material_ids:
        raise HTTPException(status_code=404, detail="收藏项不存在")

    current_user.food_material_ids.remove(material_id)
    await db.commit()
    return {"status": "removed", "material_id": material_id}


@router.post("/pantry/retail-products/{product_id}", summary="添加零售产品到收藏")
async def add_to_pantry_product(
    product_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """将零售产品添加到用户收藏"""
    from app.models.retail_product import RetailProduct

    result = await db.execute(select(RetailProduct).where(RetailProduct.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="零售产品不存在")

    # 使用 preferences JSON 字段存储零售产品收藏 ID，与 food_material_ids 隔离
    prefs = current_user.preferences or {}
    retail_ids = prefs.get("retail_product_ids", [])
    if product_id not in retail_ids:
        retail_ids.append(product_id)
        prefs["retail_product_ids"] = retail_ids
        current_user.preferences = prefs

    await db.commit()
    return {"status": "added", "product": product.product_name}


@router.delete("/pantry/retail-products/{product_id}", summary="从收藏中移除零售产品")
async def remove_from_pantry_product(
    product_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """从用户收藏中移除零售产品"""
    prefs = current_user.preferences or {}
    retail_ids = prefs.get("retail_product_ids", [])
    if product_id not in retail_ids:
        raise HTTPException(status_code=404, detail="收藏项不存在")

    retail_ids.remove(product_id)
    prefs["retail_product_ids"] = retail_ids
    current_user.preferences = prefs

    await db.commit()
    return {"status": "removed", "product_id": product_id}

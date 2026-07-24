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
from sqlalchemy import select, func

from app.api.deps import get_db_session
from app.models.food_material import FoodMaterial
from app.models.retail_product import RetailProduct

logger = logging.getLogger(__name__)

# 使用共享 router 实例
from . import router

# Lazy import for RetailProduct (avoids circular imports in service layer)
_RetailProduct = None


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


# ── 零售产品 CRUD ──────────────────────────────────────────────

@router.get("/retail-products", summary="列出零售产品")
async def list_retail_products(
    category: Optional[str] = Query(None, description="品类筛选"),
    brand: Optional[str] = Query(None, description="品牌筛选"),
    source: Optional[str] = Query(None, description="数据来源"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=200, description="每页数量"),
    db: AsyncSession = Depends(get_db_session),
):
    """列出零售产品（分页 + 筛选）"""
    global _RetailProduct
    if _RetailProduct is None:
        from app.models.retail_product import RetailProduct
        _RetailProduct = RetailProduct

    stmt = select(_RetailProduct).where(_RetailProduct.source == "openfoodfacts")
    if category:
        stmt = stmt.where(_RetailProduct.category.ilike(f"%{category}%"))
    if brand:
        stmt = stmt.where(_RetailProduct.brand.ilike(f"%{brand}%"))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.order_by(_RetailProduct.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    products = result.scalars().all()

    return {
        "items": [p.to_dict() if hasattr(p, "to_dict") else dict(p) for p in products],
        "total": total,
        "page": page,
        "page_size": page_size,
        "data_source": "postgresql",
    }


@router.get("/retail-products/{product_id}", summary="零售产品详情")
async def get_retail_product(
    product_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """获取单个零售产品详情"""
    global _RetailProduct
    if _RetailProduct is None:
        from app.models.retail_product import RetailProduct
        _RetailProduct = RetailProduct

    result = await db.execute(
        select(_RetailProduct).where(_RetailProduct.id == product_id).limit(1)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="零售产品不存在")
    return product.to_dict() if hasattr(product, "to_dict") else dict(product)

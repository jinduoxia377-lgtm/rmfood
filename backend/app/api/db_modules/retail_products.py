"""
零售产品 CRUD API 路由

用于 Potion AI VFT x RMFOOD 深度融合方案。
对标 Potion AI VFT 的 /organizations/products 端点。
使用共享 router 实例注册到 /databases 前缀下。
"""
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func  # A-27: ilike 不是顶层函数，改用列方法 .ilike()

from app.api.deps import get_db_session, get_current_user
from app.models.food_material import FoodMaterial
from app.models.retail_product import RetailProduct

logger = logging.getLogger(__name__)

# 使用共享 router 实例
from . import router

# Lazy import for RetailProduct (avoids circular imports in service layer)
_RetailProduct = None
_RetailProductResponse = None


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

# Pydantic 模型用于请求体验证（延迟导入避免循环依赖）
_RetailProductResponse = None


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

    stmt = select(_RetailProduct).where(_RetailProduct.source == source) if source else select(_RetailProduct)
    if category:
        stmt = stmt.where(_RetailProduct.category.ilike(f"%{category}%"))
    if brand:
        stmt = stmt.where(_RetailProduct.brand.ilike(f"%{brand}%"))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.order_by(_RetailProduct.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    products = result.scalars().all()

    # 延迟加载响应模型
    global _RetailProductResponse
    if _RetailProductResponse is None:
        from app.schemas.retail_product import RetailProductResponse
        _RetailProductResponse = RetailProductResponse

    return {
        "items": [_RetailProductResponse.model_validate(p).dict(exclude_none=True) for p in products],
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
        select(_RetailProduct).where(_RetailProduct.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="零售产品不存在")

    global _RetailProductResponse
    if _RetailProductResponse is None:
        from app.schemas.retail_product import RetailProductResponse
        _RetailProductResponse = RetailProductResponse

    return _RetailProductResponse.model_validate(product).dict(exclude_none=None)


@router.post("/retail-products", summary="创建零售产品")
async def create_retail_product(
    data: dict,
    db: AsyncSession = Depends(get_db_session),
):
    """
    创建零售产品（管理后台用，支持多种数据来源）

    需要管理员或配方师权限。
    """
    from app.api.deps import get_current_user
    current_user = await get_current_user(db)
    if current_user.role not in ("admin", "formulator"):
        raise HTTPException(status_code=403, detail="权限不足")

    global _RetailProduct
    if _RetailProduct is None:
        from app.models.retail_product import RetailProduct
        _RetailProduct = RetailProduct

    # 检查 external_id 是否已存在
    ext_id = data.get("external_id") or data.get("sku")
    if ext_id:
        check_stmt = select(_RetailProduct).where(
            (_RetailProduct.external_id == ext_id) | (_RetailProduct.sku == ext_id)
        )
        existing = await db.execute(check_stmt)
        if existing.scalar():
            raise HTTPException(status_code=400, detail=f"外部标识 {ext_id} 已存在")

    product = _RetailProduct(**data)
    product.created_by = current_user.id
    db.add(product)
    await db.commit()
    await db.refresh(product)

    global _RetailProductResponse
    if _RetailProductResponse is None:
        from app.schemas.retail_product import RetailProductResponse
        _RetailProductResponse = RetailProductResponse

    return _RetailProductResponse.model_validate(product).dict(exclude_none=True)


@router.put("/retail-products/{product_id}", summary="更新零售产品")
async def update_retail_product(
    product_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db_session),
):
    """更新零售产品"""
    global _RetailProduct
    if _RetailProduct is None:
        from app.models.retail_product import RetailProduct
        _RetailProduct = RetailProduct

    result = await db.execute(
        select(_RetailProduct).where(_RetailProduct.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="零售产品不存在")

    for key, value in data.items():
        if hasattr(product, key):
            setattr(product, key, value)
    product.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(product)

    global _RetailProductResponse
    if _RetailProductResponse is None:
        from app.schemas.retail_product import RetailProductResponse
        _RetailProductResponse = RetailProductResponse

    return _RetailProductResponse.model_validate(product).dict(exclude_none=True)


@router.delete("/retail-products/{product_id}", summary="删除零售产品")
async def delete_retail_product(
    product_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """删除零售产品（软删除）"""
    from app.api.deps import get_current_user
    current_user = await get_current_user(db)
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可删除")

    global _RetailProduct
    if _RetailProduct is None:
        from app.models.retail_product import RetailProduct
        _RetailProduct = RetailProduct

    result = await db.execute(
        select(_RetailProduct).where(_RetailProduct.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="零售产品不存在")

    await db.delete(product)
    await db.commit()

    return {"status": "deleted", "id": product_id}


@router.get("/retail-products/search", summary="零售产品全文搜索")
async def search_retail_products(
    query: str = Query(..., description="搜索关键词"),
    category: Optional[str] = Query(None, description="品类筛选"),
    brand: Optional[str] = Query(None, description="品牌筛选"),
    source: Optional[str] = Query(None, description="数据来源"),
    formulation_type: Optional[str] = Query(None, description="剂型筛选"),
    min_price: Optional[float] = Query(None, description="最低价格"),
    max_price: Optional[float] = Query(None, description="最高价格"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=200, description="每页数量"),
    db: AsyncSession = Depends(get_db_session),
):
    """
    零售产品全文搜索（支持关键词匹配名称、品牌、分类等）
    """
    global _RetailProduct
    if _RetailProduct is None:
        from app.models.retail_product import RetailProduct
        _RetailProduct = RetailProduct

    # 构建搜索条件
    stmt = select(_RetailProduct)
    if source:
        stmt = stmt.where(_RetailProduct.source == source)
    if category:
        stmt = stmt.where(_RetailProduct.category.ilike(f"%{category}%"))
    if brand:
        stmt = stmt.where(_RetailProduct.brand.ilike(f"%{brand}%"))
    if formulation_type:
        stmt = stmt.where(_RetailProduct.formulation_type.ilike(f"%{formulation_type}%"))
    if min_price is not None:
        stmt = stmt.where(_RetailProduct.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(_RetailProduct.price <= max_price)

    # 关键词搜索 - 在产品名、品牌、分类中模糊匹配
    if query:
        # A-27：原写 ilike(Column, pattern) —— sqlalchemy 顶层没有 ilike 函数，
        #       一进这个分支就是 NameError/ImportError。改用列方法 .ilike()。
        stmt = stmt.where(
            (_RetailProduct.product_name.ilike(f"%{query}%")) |
            (_RetailProduct.brand.ilike(f"%{query}%")) |
            (_RetailProduct.category.ilike(f"%{query}%"))
        )

    # 计数查询
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    # 数据查询
    stmt = stmt.order_by(_RetailProduct.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    products = result.scalars().all()

    global _RetailProductResponse
    if _RetailProductResponse is None:
        from app.schemas.retail_product import RetailProductResponse
        _RetailProductResponse = RetailProductResponse

    return {
        "items": [_RetailProductResponse.model_validate(p).dict(exclude_none=True) for p in products],
        "total": total,
        "page": page,
        "page_size": page_size,
        "data_source": "postgresql",
    }

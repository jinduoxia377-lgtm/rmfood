"""
零售产品 CRUD API 路由

用于 Potion AI VFT x RMFOOD 深度融合方案。
对标 Potion AI VFT 的 /organizations/products 端点。
使用共享 router 实例注册到 /databases 前缀下。
"""
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import Depends, HTTPException, Query
from sqlalchemy import func, select  # A-27: ilike 不是顶层函数，改用列方法 .ilike()
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.models.food_material import FoodMaterial
from app.models.user_model import User
from app.schemas.search_new import FoodMaterialCreate, FoodMaterialUpdate

# 使用共享 router 实例
from . import router

logger = logging.getLogger(__name__)

# Lazy import for RetailProduct (avoids circular imports in service layer)
_RetailProduct = None
_RetailProductResponse = None


def _set_food_search_tokens(material) -> None:
    """创建/更新 food_materials 时用 jieba 生成 search_tokens_{a..d}。

    迁移 022：触发器 fn_food_materials_search_vector 在这些 token 列非空时
    按 to_tsvector('simple', tokens) 分词构建 search_vector（真中文召回）；
    分词逻辑与查询侧 chinese_nlp 完全一致（同一 jieba 词典 + 同义词表）。
    """
    from app.services.search.chinese_nlp import get_nlp_pipeline

    nlp = get_nlp_pipeline()
    tok = nlp.build_food_search_tokens(
        name_cn=material.name_cn,
        aliases=material.aliases,
        effects=material.effects,
        indications=material.indications,
        category=material.category,
        sub_category=material.sub_category,
        description=material.description,
    )
    material.search_tokens_a = tok["a"]
    material.search_tokens_b = tok["b"]
    material.search_tokens_c = tok["c"]
    material.search_tokens_d = tok["d"]


def _set_retail_search_tokens(product) -> None:
    """创建/更新 retail_products 时用 jieba 生成 search_tokens_{a..d}（迁移 022）。"""
    from app.services.search.chinese_nlp import get_nlp_pipeline

    nlp = get_nlp_pipeline()
    tok = nlp.build_retail_search_tokens(
        product_name=product.product_name,
        brand=product.brand,
        category=product.category,
        sub_category=product.sub_category,
        effects=product.effects,
        target_population=product.target_population,
        full_ingredients=product.full_ingredients,
        formulation_type=product.formulation_type,
        key_ingredients=product.key_ingredients,
    )
    product.search_tokens_a = tok["a"]
    product.search_tokens_b = tok["b"]
    product.search_tokens_c = tok["c"]
    product.search_tokens_d = tok["d"]


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


@router.post("/food-materials/manual", summary="创建食品原料（管理后台）")
async def create_food_material(
    data: FoodMaterialCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    创建食品原料（管理后台用）

    注意：POST /food-materials 被 db_modules/food_materials.py 的
    混合搜索端点占用，因此管理创建端点挂载在 /food-materials/manual 下
    （对齐零售侧 /retail-products/manual 模式）。

    需要管理员或配方师权限。
    """
    if current_user is None:
        raise HTTPException(status_code=401, detail="未认证，请先登录")
    if current_user.role not in ("admin", "formulator"):
        raise HTTPException(status_code=403, detail="权限不足，需要管理员或配方师权限")

    # P0-7：用 Pydantic 白名单 schema（FoodMaterialCreate）过滤字段，
    # 杜绝 FoodMaterial(**data) 直灌原始 dict 写入 id/review_status/审计字段。
    # extra="forbid" 已在 schema 层拒绝未知字段，这里再显式取一次以防御。
    payload = data.model_dump()
    payload.pop("id", None)
    payload.pop("created_at", None)
    payload.pop("updated_at", None)
    payload.pop("created_by", None)
    payload.pop("reviewed_by", None)
    payload.pop("reviewed_at", None)
    # 服务端强制默认值：新创建记录一律进入待审核状态
    payload.setdefault("source_db", "manual")
    payload.setdefault("review_status", "pending")

    material = FoodMaterial(**payload)
    material.created_by = current_user.id
    # 迁移 022：创建时用 jieba 生成 search_tokens，激活真中文全文召回
    _set_food_search_tokens(material)
    db.add(material)
    await db.commit()
    await db.refresh(material)
    return material.to_dict()


@router.put("/food-materials/{material_id}", summary="更新食品原料")
async def update_food_material(
    material_id: int,
    data: FoodMaterialUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_current_user),
):
    """更新食品原料（管理后台用，需要管理员或配方师权限）"""
    if current_user is None:
        raise HTTPException(status_code=401, detail="未认证，请先登录")
    if current_user.role not in ("admin", "formulator"):
        raise HTTPException(status_code=403, detail="权限不足，需要管理员或配方师权限")

    result = await db.execute(
        select(FoodMaterial).where(FoodMaterial.id == material_id)
    )
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="食品原料不存在")

    # P0-7：仅应用 schema 白名单字段；exclude_unset 保证未传字段不动，
    # 显式传入 null 才会清空该字段。审计字段被 schema 排除，无法越权写入。
    updates = data.model_dump(exclude_unset=True)
    updates.pop("id", None)
    updates.pop("created_by", None)
    updates.pop("created_at", None)
    updates.pop("reviewed_by", None)
    updates.pop("reviewed_at", None)
    for key, value in updates.items():
        setattr(material, key, value)
    material.updated_at = datetime.now(timezone.utc)
    # 迁移 022：字段变更后重算 search_tokens（若更新涉及检索字段）
    _set_food_search_tokens(material)

    await db.commit()
    await db.refresh(material)
    return material.to_dict()


@router.delete("/food-materials/{material_id}", summary="删除食品原料")
async def delete_food_material(
    material_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_current_user),
):
    """删除食品原料（管理后台用，仅管理员可删除）"""
    if current_user is None:
        raise HTTPException(status_code=401, detail="未认证，请先登录")
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可删除")

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

    # exclude_none 必须是 bool；传 None 在 Pydantic V2 下会抛 TypeError（500）
    return _RetailProductResponse.model_validate(product).dict(exclude_none=True)


@router.post("/retail-products/manual", summary="创建零售产品（管理后台）")
async def create_retail_product(
    data: dict,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    创建零售产品（管理后台用，支持多种数据来源）

    注意：POST /retail-products 被 db_modules/food_materials.py 的
    混合搜索端点占用，因此管理创建端点挂载在 /retail-products/manual 下。

    需要管理员或配方师权限。
    """
    if current_user is None:
        raise HTTPException(status_code=401, detail="未认证，请先登录")
    if current_user.role not in ("admin", "formulator"):
        raise HTTPException(status_code=403, detail="权限不足，需要管理员或配方师权限")

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
    # 迁移 022：创建时用 jieba 生成 search_tokens，激活真中文全文召回
    _set_retail_search_tokens(product)
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
    current_user: Optional[User] = Depends(get_current_user),
):
    """更新零售产品（管理后台用，需要管理员或配方师权限）"""
    if current_user is None:
        raise HTTPException(status_code=401, detail="未认证，请先登录")
    if current_user.role not in ("admin", "formulator"):
        raise HTTPException(status_code=403, detail="权限不足，需要管理员或配方师权限")

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
    # 迁移 022：字段变更后重算 search_tokens（若更新涉及检索字段）
    _set_retail_search_tokens(product)

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
    current_user: Optional[User] = Depends(get_current_user),
):
    """删除零售产品（管理后台用，仅管理员可删除）"""
    if current_user is None:
        raise HTTPException(status_code=401, detail="未认证，请先登录")
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

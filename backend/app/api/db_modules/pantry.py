"""
收藏/书架 (Pantry) API 路由

对标 Potion AI VFT 的 /pantry/* 端点。
用户收藏食品原料、零售产品、中药材、活性肽等。

实现方式: 利用 User.preferences JSON 字段存储收藏ID列表。
- preferences.pantry.food_materials = [id1, id2, ...]
- preferences.pantry.retail_products = [id1, id2, ...]
- preferences.pantry.herbs = [tcmsp_id, ...]
- preferences.pantry.peptides = [sequence, ...]
"""

import logging
from typing import Optional

from fastapi import Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.models.user_model import User

from . import router

logger = logging.getLogger(__name__)


def _require_user(current_user: Optional[User]) -> User:
    """收藏写操作必须登录；未认证返回 401（避免 None.preferences 触发 500）。"""
    if current_user is None:
        raise HTTPException(status_code=401, detail="未认证，请先登录")
    return current_user


def _get_pantry_ids(user: User, item_type: str) -> list:
    """从 User.preferences JSON 中获取收藏 ID 列表（返回副本，避免原地修改污染 ORM 属性历史）"""
    prefs = user.preferences or {}
    pantry = prefs.get("pantry", {})
    return list(pantry.get(item_type, []))


def _set_pantry_ids(user: User, item_type: str, ids: list):
    """将收藏 ID 列表写入 User.preferences JSON

    注意：必须创建新的 dict 再赋给 user.preferences，否则 SQLAlchemy 的 JSON
    列无法检测“同一对象原地修改”，commit 后变更不会持久化（经典 JSON 变更陷阱）。
    """
    prefs = dict(user.preferences or {})
    pantry = dict(prefs.get("pantry") or {})
    pantry[item_type] = list(ids)
    prefs["pantry"] = pantry
    user.preferences = prefs


# ── 通用收藏查询 ──────────────────────────────────────

@router.get("/pantry", summary="获取用户收藏列表")
async def get_pantry(
    item_type: Optional[str] = Query(None, description="类型筛选: food_material | retail_product | herb | peptide"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取当前用户的收藏列表（基于 preferences JSON）"""
    # 未认证用户可正常浏览，收藏列表返回空（避免 500 干扰市售产品页面加载）
    if current_user is None:
        return {"items": [], "total": 0}

    results = []
    item_types_to_fetch = [item_type] if item_type else ["food_material", "retail_product", "herb", "peptide"]

    for itype in item_types_to_fetch:
        ids = _get_pantry_ids(current_user, itype)
        if not ids:
            continue

        if itype == "food_material":
            from app.models.food_material import FoodMaterial
            qs = select(FoodMaterial).where(FoodMaterial.id.in_(ids))
            res = await db.execute(qs)
            for row in res.scalars().all():
                results.append({"type": "food_material", "data": {
                    "id": row.id, "name_cn": row.name_cn, "category": getattr(row, 'category', None),
                    "is_food_homology": getattr(row, 'is_food_homology', False),
                }})

        elif itype == "retail_product":
            from app.models.retail_product import RetailProduct
            qs = select(RetailProduct).where(RetailProduct.id.in_(ids))
            res = await db.execute(qs)
            for row in res.scalars().all():
                results.append({"type": "retail_product", "data": {
                    "id": row.id, "product_name": row.product_name, "brand": getattr(row, 'brand', None),
                    "category": getattr(row, 'category', None), "price": getattr(row, 'price', None),
                }})

        elif itype == "herb":
            from app.models.external_data import TCMHerb
            qs = select(TCMHerb).where((TCMHerb.tcmsp_id.in_(ids)) | (TCMHerb.name_cn.in_(ids)))
            res = await db.execute(qs)
            for row in res.scalars().all():
                results.append({"type": "herb", "data": {
                    "id": row.id, "name_cn": row.name_cn, "name_latin": getattr(row, 'name_latin', None),
                    "ob_percent": getattr(row, 'ob_percent', None), "dl_value": getattr(row, 'dl_value', None),
                }})

        elif itype == "peptide":
            from app.models.external_data import BioactivePeptide
            qs = select(BioactivePeptide).where(BioactivePeptide.id.in_(ids))
            res = await db.execute(qs)
            for row in res.scalars().all():
                results.append({"type": "peptide", "data": {
                    "id": row.id, "sequence": row.sequence, "activity_type": getattr(row, 'activity_type', None),
                    "source_protein": getattr(row, 'source_protein', None),
                }})

    return {"items": results, "total": len(results)}


# ── 食品原料收藏 ──────────────────────────────────────

@router.post("/pantry/food-materials/{material_id}", summary="添加食品原料到收藏")
async def add_to_pantry_material(
    material_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """将食品原料添加到用户收藏"""
    current_user = _require_user(current_user)
    from app.models.food_material import FoodMaterial

    result = await db.execute(select(FoodMaterial).where(FoodMaterial.id == material_id))
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="食品原料不存在")

    ids = _get_pantry_ids(current_user, "food_material")
    if material_id in ids:
        return {"status": "already_added", "material_id": material_id}

    ids.append(material_id)
    _set_pantry_ids(current_user, "food_material", ids)
    await db.commit()

    return {"status": "added", "material_id": material_id, "name_cn": material.name_cn}


@router.delete("/pantry/food-materials/{material_id}", summary="从收藏中移除食品原料")
async def remove_from_pantry_material(
    material_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """从用户收藏中移除食品原料"""
    current_user = _require_user(current_user)
    ids = _get_pantry_ids(current_user, "food_material")
    if material_id not in ids:
        raise HTTPException(status_code=404, detail="收藏项不存在")

    ids.remove(material_id)
    _set_pantry_ids(current_user, "food_material", ids)
    await db.commit()
    return {"status": "removed", "material_id": material_id}


# ── 零售产品收藏 ──────────────────────────────────────

@router.post("/pantry/retail-products/{product_id}", summary="添加零售产品到收藏")
async def add_to_pantry_product(
    product_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """将零售产品添加到用户收藏"""
    current_user = _require_user(current_user)
    from app.models.retail_product import RetailProduct

    result = await db.execute(select(RetailProduct).where(RetailProduct.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="零售产品不存在")

    ids = _get_pantry_ids(current_user, "retail_product")
    if product_id in ids:
        return {"status": "already_added", "product_id": product_id}

    ids.append(product_id)
    _set_pantry_ids(current_user, "retail_product", ids)
    await db.commit()
    return {"status": "added", "product_id": product_id, "product_name": product.product_name}


@router.delete("/pantry/retail-products/{product_id}", summary="从收藏中移除零售产品")
async def remove_from_pantry_product(
    product_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """从用户收藏中移除零售产品"""
    current_user = _require_user(current_user)
    ids = _get_pantry_ids(current_user, "retail_product")
    if product_id not in ids:
        raise HTTPException(status_code=404, detail="收藏项不存在")

    ids.remove(product_id)
    _set_pantry_ids(current_user, "retail_product", ids)
    await db.commit()
    return {"status": "removed", "product_id": product_id}


# ── 中药材收藏 ────────────────────────────────────────

@router.post("/pantry/herbs/{herb_id}", summary="添加中药材到收藏")
async def add_to_pantry_herb(
    herb_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """将中药材添加到用户收藏（通过 name_cn 或 tcmsp_id 匹配）"""
    current_user = _require_user(current_user)
    from app.models.external_data import TCMHerb

    result = await db.execute(
        select(TCMHerb).where((TCMHerb.name_cn == herb_id) | (TCMHerb.tcmsp_id == herb_id))
    )
    herb = result.scalar_one_or_none()
    if not herb:
        raise HTTPException(status_code=404, detail="中药材不存在")

    ids = _get_pantry_ids(current_user, "herb")
    if herb.name_cn in ids or herb.tcmsp_id in ids:
        return {"status": "already_added", "herb_id": herb.name_cn}

    ids.append(herb.name_cn)
    _set_pantry_ids(current_user, "herb", ids)
    await db.commit()
    return {"status": "added", "herb_id": herb.name_cn, "name_cn": herb.name_cn}


@router.delete("/pantry/herbs/{herb_id}", summary="从收藏中移除中药材")
async def remove_from_pantry_herb(
    herb_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """从用户收藏中移除中药材"""
    current_user = _require_user(current_user)
    ids = _get_pantry_ids(current_user, "herb")
    if herb_id not in ids:
        raise HTTPException(status_code=404, detail="收藏项不存在")

    ids.remove(herb_id)
    _set_pantry_ids(current_user, "herb", ids)
    await db.commit()
    return {"status": "removed", "herb_id": herb_id}


# ── 活性肽收藏 ────────────────────────────────────────

@router.post("/pantry/peptides/{peptide_id}", summary="添加活性肽到收藏")
async def add_to_pantry_peptide(
    peptide_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """将活性肽添加到用户收藏"""
    current_user = _require_user(current_user)
    from app.models.external_data import BioactivePeptide

    result = await db.execute(select(BioactivePeptide).where(BioactivePeptide.id == peptide_id))
    peptide = result.scalar_one_or_none()
    if not peptide:
        raise HTTPException(status_code=404, detail="活性肽不存在")

    ids = _get_pantry_ids(current_user, "peptide")
    if peptide_id in ids:
        return {"status": "already_added", "peptide_id": peptide_id}

    ids.append(peptide_id)
    _set_pantry_ids(current_user, "peptide", ids)
    await db.commit()
    return {"status": "added", "peptide_id": peptide_id, "sequence": peptide.sequence[:20]}


@router.delete("/pantry/peptides/{peptide_id}", summary="从收藏中移除活性肽")
async def remove_from_pantry_peptide(
    peptide_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """从用户收藏中移除活性肽"""
    current_user = _require_user(current_user)
    ids = _get_pantry_ids(current_user, "peptide")
    if peptide_id not in ids:
        raise HTTPException(status_code=404, detail="收藏项不存在")

    ids.remove(peptide_id)
    _set_pantry_ids(current_user, "peptide", ids)
    await db.commit()
    return {"status": "removed", "peptide_id": peptide_id}

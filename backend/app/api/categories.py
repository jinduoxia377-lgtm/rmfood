"""
分类管理路由
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..models import Category
from ..services.auth import get_current_user
from ..models.user_model import User
from ..api.deps import get_db_session
from ..core.performance.cache_system import cache_async, cache_service

router = APIRouter(prefix="/categories", tags=["分类管理"])


@router.get("", summary="获取分类列表")
@cache_async("categories:list:{parent_id}", expire=3600)
async def list_categories(
    parent_id: Optional[int] = Query(None, description="父分类ID，为空则获取根分类"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取分类树形列表"""
    if parent_id is None:
        query = select(Category).where(Category.parent_id == None).order_by(Category.sort_order, Category.id)
    else:
        query = select(Category).where(Category.parent_id == parent_id).order_by(Category.sort_order, Category.id)

    result = await db.execute(query)
    categories = result.scalars().all()

    return [
        {
            "id": c.id,
            "name": c.name,
            "parent_id": c.parent_id,
            "description": c.description,
            "sort_order": c.sort_order,
            "children_count": len(c.children) if c.children else 0,
        }
        for c in categories
    ]


@router.get("/tree", summary="获取分类树形结构")
@cache_async("categories:tree", expire=3600)
async def get_category_tree(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取完整分类树形结构"""
    query = select(Category).options(selectinload(Category.children)).order_by(Category.sort_order, Category.id)
    result = await db.execute(query)
    categories = result.scalars().all()

    def build_tree(cats: list[Category]) -> list[dict]:
        return [
            {
                "id": cat.id,
                "name": cat.name,
                "parent_id": cat.parent_id,
                "description": cat.description,
                "sort_order": cat.sort_order,
                "children": build_tree(list(cat.children)) if cat.children else [],
            }
            for cat in cats
            if cat.parent_id is None
        ]

    return build_tree(categories)


@router.get("/{category_id}", summary="获取分类详情")
@cache_async("categories:detail:{category_id}", expire=3600)
async def get_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取单个分类详情"""
    query = select(Category).where(Category.id == category_id)
    result = await db.execute(query)
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(status_code=404, detail="分类不存在")

    return {
        "id": category.id,
        "name": category.name,
        "parent_id": category.parent_id,
        "description": category.description,
        "sort_order": category.sort_order,
        "formula_count": len(category.formulas) if category.formulas else 0,
    }


@router.post("", summary="创建分类")
async def create_category(
    name: str = Query(..., min_length=1, max_length=100),
    parent_id: Optional[int] = Query(None, description="父分类ID"),
    description: Optional[str] = Query(None, max_length=500),
    sort_order: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """创建新分类"""
    if parent_id is not None:
        parent_query = select(Category).where(Category.id == parent_id)
        parent_result = await db.execute(parent_query)
        parent = parent_result.scalar_one_or_none()
        if not parent:
            raise HTTPException(status_code=400, detail="父分类不存在")

    category = Category(
        name=name,
        parent_id=parent_id,
        description=description,
        sort_order=sort_order,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)

    # 清除相关缓存
    await cache_service.delete("categories:tree")
    await cache_service.delete(f"categories:list:{category.parent_id}")
    await cache_service.delete("categories:list:None")

    return {
        "id": category.id,
        "name": category.name,
        "parent_id": category.parent_id,
        "description": category.description,
        "sort_order": category.sort_order,
    }


@router.put("/{category_id}", summary="更新分类")
async def update_category(
    category_id: int,
    name: Optional[str] = Query(None, min_length=1, max_length=100),
    parent_id: Optional[int] = Query(None, description="父分类ID，设为null则为根分类"),
    description: Optional[str] = Query(None, max_length=500),
    sort_order: Optional[int] = Query(None, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """更新分类信息"""
    query = select(Category).where(Category.id == category_id)
    result = await db.execute(query)
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(status_code=404, detail="分类不存在")

    if parent_id is not None:
        if parent_id == category_id:
            raise HTTPException(status_code=400, detail="不能将自己设为父分类")

        parent_query = select(Category).where(Category.id == parent_id)
        parent_result = await db.execute(parent_query)
        parent = parent_result.scalar_one_or_none()
        if not parent:
            raise HTTPException(status_code=400, detail="父分类不存在")

        def has_descendant(cat: Category, target_id: int) -> bool:
            if cat.id == target_id:
                return True
            for child in cat.children or []:
                if has_descendant(child, target_id):
                    return True
            return False

        if has_descendant(category, parent_id):
            raise HTTPException(status_code=400, detail="不能将子类设为父分类")

    if name is not None:
        category.name = name
    if parent_id is not None or parent_id is None and "parent_id" in locals():
        category.parent_id = parent_id
    if description is not None:
        category.description = description
    if sort_order is not None:
        category.sort_order = sort_order

    await db.commit()
    await db.refresh(category)

    # 清除相关缓存
    await cache_service.delete("categories:tree")
    await cache_service.delete(f"categories:list:{category.parent_id}")
    await cache_service.delete("categories:list:None")
    await cache_service.delete(f"categories:detail:{category.id}")

    return {
        "id": category.id,
        "name": category.name,
        "parent_id": category.parent_id,
        "description": category.description,
        "sort_order": category.sort_order,
    }


@router.delete("/{category_id}", summary="删除分类")
async def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """删除分类（若有子分类或关联配方则拒绝删除）"""
    query = select(Category).where(Category.id == category_id).options(selectinload(Category.children))
    result = await db.execute(query)
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(status_code=404, detail="分类不存在")

    if category.children and len(category.children) > 0:
        raise HTTPException(status_code=400, detail="该分类下有子分类，请先删除子分类")

    if category.formulas and len(category.formulas) > 0:
        raise HTTPException(status_code=400, detail="该分类下有配方，请先移除关联")

    # 保存分类信息以便清除缓存
    category_id = category.id
    parent_id = category.parent_id

    await db.delete(category)
    await db.commit()

    # 清除相关缓存
    await cache_service.delete("categories:tree")
    await cache_service.delete(f"categories:list:{parent_id}")
    await cache_service.delete("categories:list:None")
    await cache_service.delete(f"categories:detail:{category_id}")

    return {"message": "分类已删除"}

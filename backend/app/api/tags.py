"""
标签管理路由
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..models import Tag
from ..services.auth import get_current_user
from ..models.user_model import User
from ..api.deps import get_db_session
from ..core.cache_system import cache_async, cache_service

router = APIRouter(prefix="/tags", tags=["标签管理"])


@router.get("", summary="获取标签列表")
@cache_async("tags:list:{search}:{order_by}", expire=3600)
async def list_tags(
    search: Optional[str] = Query(None, description="搜索标签名称"),
    order_by: str = Query("usage_count", pattern="^(usage_count|created_at|name)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取标签列表，支持搜索和排序"""
    query = select(Tag)

    if search:
        query = query.where(Tag.name.ilike(f"%{search}%"))

    if order_by == "usage_count":
        query = query.order_by(Tag.usage_count.desc())
    elif order_by == "created_at":
        query = query.order_by(Tag.created_at.desc())
    else:
        query = query.order_by(Tag.name)

    result = await db.execute(query)
    tags = result.scalars().all()

    return [
        {
            "id": t.id,
            "name": t.name,
            "color": t.color,
            "icon": t.icon,
            "usage_count": t.usage_count,
        }
        for t in tags
    ]


@router.get("/popular", summary="获取热门标签")
@cache_async("tags:popular:{limit}", expire=3600)
async def get_popular_tags(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取使用频率最高的标签"""
    query = select(Tag).order_by(Tag.usage_count.desc()).limit(limit)
    result = await db.execute(query)
    tags = result.scalars().all()

    return [
        {
            "id": t.id,
            "name": t.name,
            "color": t.color,
            "icon": t.icon,
            "usage_count": t.usage_count,
        }
        for t in tags
    ]


@router.get("/{tag_id}", summary="获取标签详情")
@cache_async("tags:detail:{tag_id}", expire=3600)
async def get_tag(
    tag_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取单个标签详情"""
    query = select(Tag).where(Tag.id == tag_id)
    result = await db.execute(query)
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")

    return {
        "id": tag.id,
        "name": tag.name,
        "color": tag.color,
        "icon": tag.icon,
        "usage_count": tag.usage_count,
        "formula_count": len(tag.formulas) if tag.formulas else 0,
    }


@router.post("", summary="创建标签")
async def create_tag(
    name: str = Query(..., min_length=1, max_length=50),
    color: Optional[str] = Query("#6366f1", max_length=20),
    icon: Optional[str] = Query(None, max_length=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """创建新标签"""
    existing_query = select(Tag).where(Tag.name == name)
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="标签名称已存在")

    tag = Tag(
        name=name,
        color=color,
        icon=icon,
    )
    db.add(tag)
    await db.commit()
    await db.refresh(tag)

    # 清除相关缓存
    await cache_service.delete("tags:list:None:usage_count")
    await cache_service.delete("tags:list:None:created_at")
    await cache_service.delete("tags:list:None:name")
    await cache_service.delete("tags:popular:20")

    return {
        "id": tag.id,
        "name": tag.name,
        "color": tag.color,
        "icon": tag.icon,
        "usage_count": tag.usage_count,
    }


@router.put("/{tag_id}", summary="更新标签")
async def update_tag(
    tag_id: int,
    name: Optional[str] = Query(None, min_length=1, max_length=50),
    color: Optional[str] = Query(None, max_length=20),
    icon: Optional[str] = Query(None, max_length=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """更新标签信息"""
    query = select(Tag).where(Tag.id == tag_id)
    result = await db.execute(query)
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")

    if name is not None and name != tag.name:
        existing_query = select(Tag).where(Tag.name == name)
        existing_result = await db.execute(existing_query)
        if existing_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="标签名称已存在")
        tag.name = name

    if color is not None:
        tag.color = color
    if icon is not None:
        tag.icon = icon

    await db.commit()
    await db.refresh(tag)

    # 清除相关缓存
    await cache_service.delete("tags:list:None:usage_count")
    await cache_service.delete("tags:list:None:created_at")
    await cache_service.delete("tags:list:None:name")
    await cache_service.delete("tags:popular:20")
    await cache_service.delete(f"tags:detail:{tag.id}")

    return {
        "id": tag.id,
        "name": tag.name,
        "color": tag.color,
        "icon": tag.icon,
        "usage_count": tag.usage_count,
    }


@router.delete("/{tag_id}", summary="删除标签")
async def delete_tag(
    tag_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """删除标签"""
    query = select(Tag).where(Tag.id == tag_id)
    result = await db.execute(query)
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")

    # 保存标签ID以便清除缓存
    tag_id = tag.id

    await db.delete(tag)
    await db.commit()

    # 清除相关缓存
    await cache_service.delete("tags:list:None:usage_count")
    await cache_service.delete("tags:list:None:created_at")
    await cache_service.delete("tags:list:None:name")
    await cache_service.delete("tags:popular:20")
    await cache_service.delete(f"tags:detail:{tag_id}")

    return {"message": "标签已删除"}


@router.post("/batch", summary="批量创建标签")
async def batch_create_tags(
    names: list[str] = Query(..., description="标签名称列表"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """批量创建标签（自动跳过已存在的）"""
    created = []
    skipped = []

    for name in names:
        name = name.strip()
        if not name:
            continue

        existing_query = select(Tag).where(Tag.name == name)
        existing_result = await db.execute(existing_query)
        if existing_result.scalar_one_or_none():
            skipped.append(name)
            continue

        tag = Tag(name=name)
        db.add(tag)
        created.append({"name": name, "id": None})

    await db.commit()

    for tag_data in created:
        query = select(Tag).where(Tag.name == tag_data["name"])
        result = await db.execute(query)
        tag = result.scalar_one()
        tag_data["id"] = tag.id

    # 清除相关缓存
    if created:
        await cache_service.delete("tags:list:None:usage_count")
        await cache_service.delete("tags:list:None:created_at")
        await cache_service.delete("tags:list:None:name")
        await cache_service.delete("tags:popular:20")

    return {
        "created": created,
        "skipped": skipped,
    }

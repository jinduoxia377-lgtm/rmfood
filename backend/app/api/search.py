"""
搜索 API 路由
全文搜索 + 高级筛选 + 收藏夹 + 最近访问
"""

from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from ..api.deps import get_db_session, get_current_user
from ..core.search_engine import SearchEngine, SearchQuery, AdvancedFilter, global_search
from ..models import User

router = APIRouter(prefix="/search", tags=["搜索服务"])


@router.get("/global", summary="全局跨类型搜索")
async def global_search_endpoint(
    q: str = Query(..., min_length=1, max_length=200, description="搜索关键词"),
    types: str = Query("formula,experiment", description="搜索类型，逗号分隔"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db_session),
):
    """
    全局搜索（跨多种资源类型）
    
    - 在配方、实验、原料等中同时搜索
    - 返回分类汇总结果
    - 支持中文模糊匹配
    """
    type_list = [t.strip() for t in types.split(",") if t.strip()]
    
    result = await global_search(
        db=db,
        keyword=q,
        types=type_list,
        page=page,
        page_size=page_size,
    )
    
    return result


@router.get("/{resource_type}", summary="资源类型搜索")
async def search_resource(
    resource_type: str,
    q: Optional[str] = Query(None, description="关键词"),
    sort_by: Optional[str] = Query(None, description="排序字段"),
    order: str = Query("desc", regex="^(asc|desc)$"),
    status: Optional[str] = Query(None, description="状态筛选"),
    category: Optional[str] = Query(None, description="分类筛选"),
    created_from: Optional[str] = Query(None, description="创建时间起"),
    created_to: Optional[str] = Query(None, description="创建时间止"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    facets: bool = Query(False, description="是否返回聚合统计"),
    db: AsyncSession = Depends(get_db_session),
):
    """
    指定资源类型的搜索与高级筛选
    
    支持参数:
    - **q**: 关键词搜索
    - **sort_by**: 排序字段 (name/created_at/updated_at)
    - **order**: 排序方向 (asc/desc)
    - **status**: 状态筛选
    - **category**: 分类筛选
    - **created_from/to**: 时间范围
    - **facets**: 是否返回聚合统计
    """
    engine = SearchEngine(db)
    
    # 构建查询对象
    query = SearchQuery(
        keyword=q,
        sort_by=sort_by,
        sort_order=order,
        page=page,
        page_size=page_size,
        facets=["status", "category"] if facets else None,
    )
    
    # 添加筛选条件
    if status:
        query.filters.append(AdvancedFilter(field="status", operator="eq", value=status))
    if category:
        query.filters.append(AdvancedFilter(field="category", operator="contains", value=category))
    if created_from or created_to:
        query.filters.append(
            AdvancedFilter(
                field="created_at",
                operator="between",
                value=[created_from, created_to] if created_from and created_to else created_from or created_to
            )
        )
    
    result = await engine.advanced_search(resource_type, query)
    
    return result.to_dict()


@router.get("/suggestions", summary="搜索建议")
async def get_suggestions(
    prefix: str = Query(..., min_length=2, max_length=50),
    type: str = Query("formula", description="资源类型"),
    limit: int = Query(10, ge=1, le=20),
    db: AsyncSession = Depends(get_db_session),
):
    """获取搜索自动补全建议"""
    engine = SearchEngine(db)
    suggestions = await engine.get_suggestions(prefix, type, limit)
    
    return {"suggestions": suggestions}


# ═════════════════════════════════════
# 收藏夹管理
# ═════════════════════════════════════

@router.post("/favorites", summary="添加收藏")
async def add_favorite(
    item_type: str,
    item_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """添加到收藏夹"""
    engine = SearchEngine(db)
    success = await engine.add_to_favorites(current_user.id, item_type, item_id)
    
    return {"success": success, "message": "已添加到收藏夹"}


@router.delete("/favorites/{item_type}/{item_id}", summary="取消收藏")
async def remove_favorite(
    item_type: str,
    item_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """从收藏夹移除"""
    engine = SearchEngine(db)
    success = await engine.remove_from_favorites(current_user.id, item_type, item_id)
    
    return {"success": success, "message": "已从收藏夹移除"}


@router.get("/favorites", summary="我的收藏列表")
async def list_favorites(
    type: Optional[str] = Query(None, description="按类型过滤"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取当前用户的收藏列表"""
    engine = SearchEngine(db)
    favorites = await engine.get_favorites(current_user.id, type)
    
    return {"items": favorites, "total": len(favorites)}


@router.get("/favorites/check/{item_type}/{item_id}", summary="检查收藏状态")
async def check_favorite_status(
    item_type: str,
    item_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """检查某项是否已被收藏"""
    engine = SearchEngine(db)
    is_fav = await engine.is_favorited(current_user.id, item_type, item_id)
    
    return {"is_favorited": is_fav}


# ═════════════════════════════════════
# 最近访问记录
# ═════════════════════════════════════

@router.post("/recent-views", summary="记录访问")
async def record_view(
    item_type: str,
    item_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """记录一次页面访问"""
    engine = SearchEngine(db)
    await engine.record_view(current_user.id, item_type, item_id)
    
    return {"success": True}


@router.get("/recent-views", summary="最近访问列表")
async def list_recent_views(
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取最近访问列表（按时间倒序）"""
    engine = SearchEngine(db)
    recent_views = await engine.get_recent_views(current_user.id, limit)
    
    return {"items": recent_views}
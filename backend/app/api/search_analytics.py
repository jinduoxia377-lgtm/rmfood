"""
搜索分析 API 路由

用于 Potion AI VFT x RMFOOD 深度融合方案。
提供搜索热词、趋势、行为分析等 API。
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.services.search.search_analytics import SearchAnalyticsService
from app.services.search.search_optimizer import SearchCacheService, SearchPrecomputeService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/search/analytics", tags=["搜索分析"])


@router.get("/hot-searches")
async def get_hot_searches(
    limit: int = Query(20, ge=1, le=50, description="返回数量"),
    days: int = Query(7, ge=1, le=90, description="时间窗口(天)"),
    db: AsyncSession = Depends(get_db_session),
):
    """
    获取热门搜索词
    GET /api/v1/search/analytics/hot-searches
    """
    service = SearchAnalyticsService(db)
    return await service.get_hot_searches(limit=limit, time_window_days=days)


@router.get("/trends/{keyword}")
async def get_search_trends(
    keyword: str,
    days: int = Query(30, ge=1, le=365, description="时间窗口(天)"),
    db: AsyncSession = Depends(get_db_session),
):
    """
    获取搜索词趋势
    GET /api/v1/search/analytics/trends/:keyword
    """
    service = SearchAnalyticsService(db)
    return await service.get_search_trends(keyword, days=days)


@router.get("/behavior-stats")
async def get_search_behavior_stats(
    days: int = Query(30, ge=1, le=365, description="时间窗口(天)"),
    db: AsyncSession = Depends(get_db_session),
):
    """
    获取搜索行为统计
    GET /api/v1/search/analytics/behavior-stats
    """
    service = SearchAnalyticsService(db)
    return await service.get_search_behavior_stats(days=days)


@router.get("/conversion-rate")
async def get_search_conversion_rate(
    days: int = Query(30, ge=1, le=365, description="时间窗口(天)"),
    db: AsyncSession = Depends(get_db_session),
):
    """
    获取搜索转化率
    GET /api/v1/search/analytics/conversion-rate
    """
    service = SearchAnalyticsService(db)
    return await service.get_search_conversion_rate(days=days)


@router.get("/popular-categories")
async def get_popular_categories(
    days: int = Query(30, ge=1, le=365, description="时间窗口(天)"),
    limit: int = Query(10, ge=1, le=50, description="返回数量"),
    db: AsyncSession = Depends(get_db_session),
):
    """
    获取热门分类
    GET /api/v1/search/analytics/popular-categories
    """
    service = SearchAnalyticsService(db)
    return await service.get_popular_categories(days=days, limit=limit)


@router.post("/precompute/hot-searches")
async def precompute_hot_searches(
    days: int = Query(7, ge=1, le=90, description="时间窗口(天)"),
    db: AsyncSession = Depends(get_db_session),
):
    """
    预计算热门搜索词 (管理后台用)
    POST /api/v1/search/analytics/precompute/hot-searches
    """
    from app.core.session import redis_client
    if redis_client:
        cache_service = SearchCacheService(redis_client)
        return await SearchPrecomputeService.precompute_hot_searches(db, cache_service, days)
    return {"message": "Redis 未配置，跳过预计算"}


@router.post("/optimize/indexes")
async def optimize_search_indexes(
    db: AsyncSession = Depends(get_db_session),
):
    """
    优化搜索索引 (管理后台用)
    POST /api/v1/search/analytics/optimize/indexes
    """
    from app.services.search.search_optimizer import SearchIndexOptimizer

    tables_config = {
        "food_materials": {
            "text_columns": ["name_cn", "aliases", "effects", "description"],
            "vector_columns": ["embedding"],
        },
        "retail_products": {
            "text_columns": ["product_name", "brand", "effects", "full_ingredients"],
            "vector_columns": ["embedding"],
        },
    }

    await SearchIndexOptimizer.optimize_all_indexes(db, tables_config)
    return {"message": "搜索索引优化完成"}

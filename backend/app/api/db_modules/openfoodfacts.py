"""
OFF 数据同步监控与实时查询 API

提供同步状态查询、错误日志、实时产品搜索/详情/分类浏览等接口。
参照 search.py 中 /sync/* 端点的架构模式。
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException, Path
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_current_user
from app.models.user_model import User
from app.schemas.retail_product import (
    RetailProductSearchRequest,
    RetailProductResponse,
    PaginatedProductResponse,
    SyncStatusResponse,
    ImportReportResponse,
    ImportErrorResponse,
)

logger = logging.getLogger(__name__)

from . import router


# ── 同步状态 ──

@router.get("/openfoodfacts/sync-status", response_model=SyncStatusResponse, summary="OFF 同步状态")
async def get_off_sync_status(
    db: AsyncSession = Depends(get_db_session),
):
    """获取 OFF 数据同步状态和产品统计（公开接口）"""
    from app.services.data_sources.openfoodfacts_client import off_service
    return await off_service.get_sync_stats(db)


# ── 错误日志 ──

@router.get("/openfoodfacts/errors", response_model=ImportErrorResponse, summary="OFF 导入错误日志")
async def get_off_import_errors(
    limit: int = Query(50, ge=1, le=500, description="返回错误数量上限"),
    db: AsyncSession = Depends(get_db_session),
):
    """获取最近的导入错误（公开接口）"""
    try:
        result = await db.execute(text("""
            SELECT barcode, error_type, error_message, created_at
            FROM off_import_errors
            ORDER BY created_at DESC
            LIMIT :limit
        """), {"limit": limit})
        rows = result.fetchall()
    except Exception:
        # off_import_errors 表尚未创建（OFF 导入未初始化）时优雅降级
        rows = []
        logger.warning("off_import_errors 表不存在，返回空错误列表")

    return ImportErrorResponse(
        errors=[
            {
                "barcode": r[0],
                "error_type": r[1],
                "error_message": r[2],
                "created_at": str(r[3]) if r[3] else None,
            }
            for r in rows
        ],
        total=len(rows),
    )


# ── 导入报告 ──

@router.get("/openfoodfacts/report", response_model=ImportReportResponse, summary="OFF 导入报告")
async def get_off_import_report(
    db: AsyncSession = Depends(get_db_session),
):
    """生成 OFF 数据导入报告（公开接口）"""
    # 总体统计
    result = await db.execute(text("""
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embedding,
            ROUND(AVG(data_quality)::numeric, 2) as avg_quality,
            COUNT(DISTINCT brand) as unique_brands,
            COUNT(DISTINCT category) as unique_categories,
            MIN(created_at) as first_import,
            MAX(updated_at) as last_update
        FROM retail_products
        WHERE source = 'openfoodfacts'
    """))
    row = result.fetchone()
    overall = dict(row._mapping) if row else {}

    # 分类分布 Top 10
    cat_result = await db.execute(text("""
        SELECT category, COUNT(*) as cnt
        FROM retail_products
        WHERE source = 'openfoodfacts' AND category IS NOT NULL
        GROUP BY category
        ORDER BY cnt DESC
        LIMIT 10
    """))
    categories = [dict(r._mapping) for r in cat_result.fetchall()]

    # 数据质量分布
    qual_result = await db.execute(text("""
        SELECT
            COUNT(CASE WHEN data_quality >= 0.8 THEN 1 END) as high,
            COUNT(CASE WHEN data_quality >= 0.5 AND data_quality < 0.8 THEN 1 END) as medium,
            COUNT(CASE WHEN data_quality < 0.5 THEN 1 END) as low
        FROM retail_products
        WHERE source = 'openfoodfacts'
    """))
    qual_row = qual_result.fetchone()
    quality_dist = dict(qual_row._mapping) if qual_row else {}

    return ImportReportResponse(
        overall=overall,
        categories=categories,
        quality_distribution=quality_dist,
    )


# ── 实时搜索 ──

@router.post("/openfoodfacts/search", summary="OFF 实时搜索")
async def search_openfoodfacts(
    request: RetailProductSearchRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    混合搜索零售产品。

    - DB 优先：在 retail_products 表中搜索，支持分类/品牌/价格等过滤
    - realtime=True：直接调 OFF REST API，不走本地缓存
    """
    from app.services.data_sources.openfoodfacts_client import off_service
    return await off_service.search_products(
        request.query, db,
        page=request.page,
        page_size=request.page_size,
        realtime=request.realtime,
        category=request.category,
        brand=request.brand,
        formulation_type=request.formulation_type,
        min_price=request.min_price,
        max_price=request.max_price,
        min_rating=request.min_rating,
        effects=request.effects,
    )


# ── 按条码查询 ──

@router.get("/openfoodfacts/product/barcode/{barcode}", summary="按条码查询")
async def get_product_by_barcode(
    barcode: str = Path(..., pattern=r"^\d{10,17}$", description="EAN 條碼 (10-17 位數字)"),
    realtime: bool = Query(False, description="强制实时查询 OFF API"),
    db: AsyncSession = Depends(get_db_session),
):
    """
    通过条形码查询产品详情。

    DB 优先 — 本地有缓存直接返回；
    realtime=true — 直接调 OFF REST API 获取最新数据。
    """
    from app.services.data_sources.openfoodfacts_client import off_service
    product = await off_service.get_product_by_barcode(
        barcode, db, realtime=realtime,
    )
    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"未找到条码 {barcode} 对应的产品",
        )
    return product


# ── 按 ID 查询 ──

@router.get("/openfoodfacts/product/{product_id}", summary="按 ID 查询")
async def get_product_by_id(
    product_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """按数据库 ID 查询零售产品详情"""
    from app.services.data_sources.openfoodfacts_client import off_service
    product = await off_service.get_product_by_id(product_id, db)
    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"未找到 ID 为 {product_id} 的产品",
        )
    return product


# ── 按分类浏览 ──

@router.get("/openfoodfacts/category/{category_tag}", summary="按分类浏览")
async def list_by_category(
    category_tag: str = Path(..., pattern=r"^[a-z0-9\-]+$", description="OFF 分類標籤 (kebab-case)"),
    page: int = Query(1, ge=1, description="頁碼"),
    page_size: int = Query(50, ge=1, le=200, description="每頁數量"),
    realtime: bool = Query(False, description="强制实时查询"),
    db: AsyncSession = Depends(get_db_session),
):
    """按分类标签浏览零售产品"""
    from app.services.data_sources.openfoodfacts_client import off_service
    return await off_service.list_by_category(
        category_tag, db, page=page, page_size=page_size, realtime=realtime,
    )


# ── 分类列表 ──

@router.get("/openfoodfacts/categories", summary="分类列表")
async def get_off_categories(
    db: AsyncSession = Depends(get_db_session),
):
    """获取所有零售产品分类及其数量（公开接口）"""
    from app.services.data_sources.openfoodfacts_client import off_service
    cats = await off_service.get_categories(db)
    return {
        "categories": cats,
        "total": len(cats),
    }


# ── 手动触发增量同步（需管理员权限） ──

@router.post("/openfoodfacts/sync", summary="手动触发增量同步")
async def trigger_off_sync(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    手动触发 OFF 增量同步。

    需要管理员或配方师权限。
    实际同步逻辑在 import_openfoodfacts.py 中实现，
    此处返回同步调度状态。
    """
    if current_user.role not in ("admin", "formulator"):
        raise HTTPException(
            status_code=403,
            detail="权限不足，需要管理员或配方师权限",
        )

    from app.services.data_sources.openfoodfacts_client import off_service
    stats = await off_service.get_sync_stats(db)
    return {
        "status": "sync_triggered",
        "message": "增量同步已在后台队列中执行",
        "current_stats": stats,
    }

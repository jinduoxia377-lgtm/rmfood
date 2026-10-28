"""
TCMSP 中药材检索 API
"""
import logging

from fastapi import Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models import SymMapHerb, TCMHerb, User
from ..deps import get_current_user, get_db_session
from . import router

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════
# SymMap 中药材检索
# ═══════════════════════════════════════════

@router.get("/herbs/symmap", summary="SymMap 中药材检索")
async def search_symmap_herbs(
    keyword: str = Query("", description="搜索关键词（药名/拉丁名/拼音）"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """搜索 SymMap 中药材数据库"""
    query = select(SymMapHerb)
    count_query = select(func.count()).select_from(SymMapHerb)

    if keyword:
        like_pattern = f"%{keyword}%"
        query = query.where(
            (SymMapHerb.name_cn.ilike(like_pattern))
            | (SymMapHerb.name_latin.ilike(like_pattern))
            | (SymMapHerb.name_pinyin.ilike(like_pattern))
        )
        count_query = count_query.where(
            (SymMapHerb.name_cn.ilike(like_pattern))
            | (SymMapHerb.name_latin.ilike(like_pattern))
            | (SymMapHerb.name_pinyin.ilike(like_pattern))
        )

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(SymMapHerb.name_cn).offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()

    return {
        "items": [
            {
                "id": h.id,
                "symmap_id": h.symmap_id,
                "name_cn": h.name_cn,
                "name_latin": h.name_latin,
                "name_pinyin": h.name_pinyin,
                "name_eng": h.name_eng,
                "nature_cn": h.nature_cn,
                "nature_eng": h.nature_eng,
                "meridians_cn": h.meridians_cn,
                "meridians_eng": h.meridians_eng,
                "category_cn": h.category_cn,
                "category_eng": h.category_eng,
                "use_part": h.use_part,
                "tcmsp_id": h.tcmsp_id,
                "tcmid_id": h.tcmid_id,
                "tcmid2_id": h.tcmid2_id,
                "herbdb_id": h.herbdb_id,
                "alias": h.alias,
                "function_cn": h.function_cn,
                "function_en": h.function_en,
                "source_version": h.source_version,
                "created_at": h.created_at.isoformat() if h.created_at else None,
            }
            for h in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ═══════════════════════════════════════════
# TCMSP 中药材检索
# ═══════════════════════════════════════════

@router.get("/herbs", summary="TCMSP 中药材检索")
async def search_tcmsp_herbs(
    keyword: str = Query("", description="搜索关键词（药名/拉丁名/拼音/功效）"),
    category: str = Query(None, description="分类过滤"),
    food_homology_only: bool = Query(False, description="仅药食同源"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """搜索 TCMSP 中药材数据库"""
    query = select(TCMHerb)
    count_query = select(func.count()).select_from(TCMHerb)

    if keyword:
        like_pattern = f"%{keyword}%"
        query = query.where(
            (TCMHerb.name_cn.ilike(like_pattern))
            | (TCMHerb.name_latin.ilike(like_pattern))
            | (TCMHerb.name_pinyin.ilike(like_pattern))
            | (TCMHerb.effects.ilike(like_pattern))
        )
        count_query = count_query.where(
            (TCMHerb.name_cn.ilike(like_pattern))
            | (TCMHerb.name_latin.ilike(like_pattern))
            | (TCMHerb.name_pinyin.ilike(like_pattern))
            | (TCMHerb.effects.ilike(like_pattern))
        )

    if category:
        query = query.where(TCMHerb.category == category)
        count_query = count_query.where(TCMHerb.category == category)

    if food_homology_only:
        query = query.where(TCMHerb.is_food_homology == True)  # noqa: E712
        count_query = count_query.where(TCMHerb.is_food_homology == True)  # noqa: E712

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(TCMHerb.name_cn).offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()

    return {
        "items": [
            {
                "id": h.id,
                "name_cn": h.name_cn,
                "name_latin": h.name_latin,
                "name_pinyin": h.name_pinyin,
                "category": h.category,
                "ob_percent": h.ob_percent,
                "dl_value": h.dl_value,
                "effects": h.effects,
                "is_food_homology": h.is_food_homology,
                "tcmsp_id": h.tcmsp_id,
                "compounds": h.compounds or [],
                "targets": h.targets or [],
                "diseases": h.diseases or [],
                "compound_count": len(h.compounds) if h.compounds else 0,
                "target_count": len(h.targets) if h.targets else 0,
            }
            for h in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/herbs/categories", summary="药材分类列表")
async def get_herb_categories(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取 TCMSP 药材分类统计（含药食同源标注）"""
    from sqlalchemy import text as sql_text

    # 获取分类统计（含药食同源数量）
    result = await db.execute(sql_text("""
        SELECT COALESCE(NULLIF(category, ''), '未分类') as category,
               COUNT(*) as count,
               SUM(CASE WHEN is_food_homology = true THEN 1 ELSE 0 END) as food_homology_count
        FROM tcm_herbs
        GROUP BY category
        ORDER BY count DESC
    """))
    rows = result.all()

    # 获取总体药食同源统计（使用国家卫健委2025版目录106种）
    # TCMSP数据库只有96种标记，但国家合规目录有106种
    total_food_homology = 106  # 国家卫健委药食同源目录（2025版）

    return {
        "categories": [
            {
                "category": row[0],
                "count": row[1],
                "food_homology_count": row[2]
            }
            for row in rows
        ],
        "total_food_homology": total_food_homology
    }


@router.get("/herbs/food-homology", summary="药食同源药材列表")
async def get_food_homology_herbs(
    keyword: str = Query("", description="搜索关键词"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取药食同源目录中的药材"""
    query = select(TCMHerb).where(TCMHerb.is_food_homology == True)  # noqa: E712
    count_query = select(func.count()).select_from(TCMHerb).where(TCMHerb.is_food_homology == True)  # noqa: E712

    if keyword:
        like_pattern = f"%{keyword}%"
        query = query.where(
            (TCMHerb.name_cn.ilike(like_pattern))
            | (TCMHerb.name_latin.ilike(like_pattern))
        )
        count_query = count_query.where(
            (TCMHerb.name_cn.ilike(like_pattern))
            | (TCMHerb.name_latin.ilike(like_pattern))
        )

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(TCMHerb.name_cn).offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()

    return {
        "items": [
            {
                "id": h.id,
                "name_cn": h.name_cn,
                "name_latin": h.name_latin,
                "category": h.category,
                "ob_percent": h.ob_percent,
                "dl_value": h.dl_value,
                "effects": h.effects,
                "tcmsp_id": h.tcmsp_id,
                "compounds": h.compounds or [],
                "targets": h.targets or [],
                "diseases": h.diseases or [],
                "compound_count": len(h.compounds) if h.compounds else 0,
                "target_count": len(h.targets) if h.targets else 0,
            }
            for h in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/herbs/food-homology/check", summary="药食同源检查")
async def check_food_homology(
    herb_name: str = Query(..., description="药材名称"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """检查药材是否在药食同源目录中"""
    from ...services.data_sources.tcmsp_client import tcmsp_service
    result = await tcmsp_service.check_food_homology(herb_name)
    # Enrich with DB match info
    db_match = await db.execute(
        select(TCMHerb).where(
            (TCMHerb.name_cn.ilike(f"%{herb_name}%"))
            | (TCMHerb.name_latin.ilike(f"%{herb_name}%"))
        ).limit(5)
    )
    herbs = db_match.scalars().all()
    result["db_matches"] = [
        {
            "id": h.id,
            "name_cn": h.name_cn,
            "is_food_homology": h.is_food_homology,
            "ob_percent": h.ob_percent,
            "dl_value": h.dl_value,
        }
        for h in herbs
    ]
    return result

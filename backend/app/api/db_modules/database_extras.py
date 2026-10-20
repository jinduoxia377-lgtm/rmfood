"""RMCHM / CFAM 数据库检索 API（数据检索中心扩展）

- GET /databases/rmchm/herbs         — RMCHM 中药材检索（714+ 种）
- GET /databases/rmchm/herbs/:id     — RMCHM 药材详情（含化合物/靶点/疾病）
- GET /databases/rmchm/stats         — RMCHM 统计
- GET /databases/cfam/herbs          — CFAM 官方药食同源目录（111 条）
- GET /databases/cfam/herbs/:id      — CFAM 药材详情
- GET /databases/cfam/stats          — CFAM 统计
- GET /databases/herb-image          — 药材图片 URL（RMCHM/CFAM 统一）
"""
from __future__ import annotations

import logging
import os
import re
from typing import Optional

from fastapi import Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.models.database_extras import RMCHMHerb
from app.models.external_data import HFEHerb
from . import router

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════
# RMCHM 中药材检索
# ═══════════════════════════════════════════

@router.get("/rmchm/herbs", summary="RMCHM 中药材检索")
async def get_rmchm_herbs(
    keyword: str = Query("", description="搜索关键词（中文名/拼音/拉丁名/功效）"),
    category: str = Query(None, description="分类过滤（如 补气药/清热药）"),
    food_homology: Optional[bool] = Query(None, description="仅药食同源"),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
):
    query = select(RMCHMHerb)
    count_query = select(func.count()).select_from(RMCHMHerb)

    if keyword:
        like = f"%{keyword}%"
        query = query.where(
            RMCHMHerb.name_cn.ilike(like)
            | RMCHMHerb.name_pinyin.ilike(like)
            | RMCHMHerb.name_latin.ilike(like)
            | RMCHMHerb.function_cn.ilike(like)
        )
        count_query = count_query.where(
            RMCHMHerb.name_cn.ilike(like)
            | RMCHMHerb.name_pinyin.ilike(like)
            | RMCHMHerb.name_latin.ilike(like)
            | RMCHMHerb.function_cn.ilike(like)
        )
    if category:
        query = query.where(RMCHMHerb.category_cn == category)
        count_query = count_query.where(RMCHMHerb.category_cn == category)
    if food_homology is not None:
        query = query.where(RMCHMHerb.is_food_homology == food_homology)
        count_query = count_query.where(RMCHMHerb.is_food_homology == food_homology)

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(RMCHMHerb.name_cn)
             .offset((page - 1) * page_size)
             .limit(page_size)
    )).scalars().all()

    return {
        "items": [
            {**h.to_dict(include_relations=False), "image_url": _resolve_herb_image(h.name_cn, h.image_path)}
            for h in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "source": "rmchm_v324",
    }


@router.get("/rmchm/herbs/{herb_id}", summary="RMCHM 药材详情")
async def get_rmchm_herb_detail(
    herb_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    herb = (await db.execute(select(RMCHMHerb).where(RMCHMHerb.id == herb_id))).scalar_one_or_none()
    if not herb:
        raise HTTPException(status_code=404, detail=f"RMCHM 药材未找到: id={herb_id}")
    return {"success": True, "data": herb.to_dict(include_relations=True)}


@router.get("/rmchm/stats", summary="RMCHM 统计")
async def get_rmchm_stats(db: AsyncSession = Depends(get_db_session)):
    total = (await db.execute(select(func.count()).select_from(RMCHMHerb))).scalar() or 0
    homology = (await db.execute(
        select(func.count()).select_from(RMCHMHerb).where(RMCHMHerb.is_food_homology == True)  # noqa: E712
    )).scalar() or 0
    toxic = (await db.execute(
        select(func.count()).select_from(RMCHMHerb).where(RMCHMHerb.is_toxic == True)  # noqa: E712
    )).scalar() or 0
    category_rows = (await db.execute(
        select(RMCHMHerb.category_cn, func.count()).group_by(RMCHMHerb.category_cn)
    )).all()
    return {
        "total_herbs": total,
        "food_homology_count": homology,
        "toxic_count": toxic,
        "category_distribution": [
            {"category": r[0] or "未分类", "count": r[1]} for r in category_rows
        ],
        "source": "rmchm_v324",
    }


# ═══════════════════════════════════════════
# CFAM 官方药食同源目录
# 数据源：hf_enriched_herbs（HFEHerb，官方目录，含公告批次/特殊提示）
# ═══════════════════════════════════════════

# 公告批次映射（source_version → announcement_id）
_CFAM_ANNOUNCEMENT_MAP = {
    "卫法监发[2002]51号": "ann_2002_51",
    "卫健委公告2019年第8号": "ann_2019_8",
    "卫健委公告2023年第9号": "ann_2023_9",
    "卫健委公告2024年第4号": "ann_2024_4",
}


def _cfam_announcement_id(source_version: Optional[str]) -> Optional[str]:
    return _CFAM_ANNOUNCEMENT_MAP.get(source_version or "") or "other"


def _cfam_special_notice(source_version: Optional[str]) -> Optional[str]:
    source = source_version or ""
    if "2023年第9号" in source or "2024年第4号" in source:
        return "建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用"
    return None


def _cfam_usage_restriction(source_version: Optional[str]) -> Optional[str]:
    source = source_version or ""
    if "2019年第8号" in source:
        return "仅作为香辛料和调味品使用"
    return None


def _cfam_herb_to_dict(h: HFEHerb) -> dict:
    return {
        "id": h.id,
        "name_cn": h.name_cn,
        "name_latin": h.latin_name,
        "name_en": h.name_en,
        "nature": h.nature_cn,
        "flavor": h.flavor_cn,
        "category": h.category,
        "announcement_id": _cfam_announcement_id(h.source_version),
        "announcement_source": h.source_version,
        "usage_restriction": _cfam_usage_restriction(h.source_version),
        "special_notice": _cfam_special_notice(h.source_version),
        "image_path": h.image_path,
        "image_url": _resolve_herb_image(h.name_cn, h.image_path),
        "is_food_homology": h.is_food_homology,
        "pdf_page": 8,
        "created_at": h.created_at.isoformat() if h.created_at else None,
    }


# ═══════════════════════════════════════════
# 药材图片 URL 解析
# 图片目录：data/106FAM（药食同源）+ data/RMCHM_IMAGES（MMID 全库配图）
# 统一由 /api/v1/rmchm/images/{filename} 服务
# ═══════════════════════════════════════════

_HERB_IMAGE_DIRS = [
    r"D:\RMFOODFP\data\106FAM",
    r"D:\RMFOODFP\data\RMCHM_IMAGES",
]


def _norm_herb_filename(fn: str) -> str:
    """去掉扩展名和括号注解（如 姜（生姜、干姜）.jpg → 姜）。"""
    base = os.path.splitext(fn)[0]
    base = re.sub(r"[（(].*?[）)]", "", base)
    return base.strip()


def _resolve_herb_image(name: str, image_path: Optional[str]) -> Optional[str]:
    """将数据库 image_path 解析为可访问的图片 URL。

    优先级：
    1. 已是完整 URL（/api/v1/... 或 http...）→ 直接返回
    2. image_path 的文件名存在于图片目录 → 返回 /api/v1/rmchm/images/{文件名}
    3. 按药材名在图片目录中智能匹配（名称先去除括号注解，如 龙眼肉（桂圆）→ 龙眼肉）
    4. 均未命中 → None
    """
    if image_path and (image_path.startswith("/api/v1/") or image_path.startswith("http")):
        return image_path

    if image_path:
        fname = os.path.basename(image_path.replace("\\", "/"))
        for img_dir in _HERB_IMAGE_DIRS:
            if fname and os.path.exists(os.path.join(img_dir, fname)):
                return f"/api/v1/rmchm/images/{fname}"

    if name:
        norm_name = _norm_herb_filename(name)
        for img_dir in _HERB_IMAGE_DIRS:
            if not os.path.isdir(img_dir):
                continue
            best_prefix = None
            best_contains = None
            for fn in os.listdir(img_dir):
                if not fn.endswith((".jpg", ".jpeg", ".png")):
                    continue
                norm = _norm_herb_filename(fn)
                if norm_name and norm == norm_name:
                    return f"/api/v1/rmchm/images/{fn}"
                if best_prefix is None and norm_name and norm.startswith(norm_name):
                    best_prefix = fn
                if best_contains is None and norm_name and norm_name in norm:
                    best_contains = fn
            if best_prefix:
                return f"/api/v1/rmchm/images/{best_prefix}"
            if best_contains:
                return f"/api/v1/rmchm/images/{best_contains}"

    return None


@router.get("/cfam/herbs", summary="CFAM 药食同源完整目录")
async def get_cfam_herbs(
    keyword: str = Query("", description="搜索关键词（中文名/拉丁名）"),
    announcement_id: str = Query(None, description="公告批次过滤"),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
):
    query = select(HFEHerb).where(HFEHerb.is_food_homology == True)  # noqa: E712
    count_query = select(func.count()).select_from(HFEHerb).where(HFEHerb.is_food_homology == True)  # noqa: E712

    if keyword:
        like = f"%{keyword}%"
        query = query.where(HFEHerb.name_cn.ilike(like) | HFEHerb.latin_name.ilike(like))
        count_query = count_query.where(HFEHerb.name_cn.ilike(like) | HFEHerb.latin_name.ilike(like))
    if announcement_id:
        # 将 announcement_id 反查为 source_version 列表（保留 "other" 用于未匹配批次）
        source_versions = [sv for sv, aid in _CFAM_ANNOUNCEMENT_MAP.items() if aid == announcement_id]
        if source_versions:
            query = query.where(HFEHerb.source_version.in_(source_versions))
            count_query = count_query.where(HFEHerb.source_version.in_(source_versions))
        elif announcement_id == "other":
            query = query.where(~HFEHerb.source_version.in_(list(_CFAM_ANNOUNCEMENT_MAP.keys())))
            count_query = count_query.where(~HFEHerb.source_version.in_(list(_CFAM_ANNOUNCEMENT_MAP.keys())))

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(HFEHerb.name_cn)
             .offset((page - 1) * page_size)
             .limit(page_size)
    )).scalars().all()

    return {
        "items": [_cfam_herb_to_dict(h) for h in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "source": "cfam_official",
        "version": "2026.05.24",
    }


@router.get("/cfam/herbs/{herb_id}", summary="CFAM 药材详情")
async def get_cfam_herb_detail(
    herb_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    herb = (await db.execute(select(HFEHerb).where(HFEHerb.id == herb_id))).scalar_one_or_none()
    if not herb:
        raise HTTPException(status_code=404, detail=f"CFAM 药材未找到: id={herb_id}")
    return {"success": True, "data": _cfam_herb_to_dict(herb)}


@router.get("/cfam/stats", summary="CFAM 统计")
async def get_cfam_stats(db: AsyncSession = Depends(get_db_session)):
    total = (await db.execute(
        select(func.count()).select_from(HFEHerb).where(HFEHerb.is_food_homology == True)  # noqa: E712
    )).scalar() or 0
    ann_rows = (await db.execute(
        select(HFEHerb.source_version, func.count())
        .where(HFEHerb.is_food_homology == True)  # noqa: E712
        .group_by(HFEHerb.source_version)
    )).all()
    return {
        "total_herbs": total,
        "announcement_distribution": [
            {"announcement_id": _cfam_announcement_id(r[0]), "count": r[1]} for r in ann_rows
        ],
        "source": "cfam_official",
    }


@router.get("/herb-image", summary="获取药材图片 URL（RMCHM/CFAM 统一）")
async def get_herb_image(
    name: str = Query(..., description="药材中文名"),
    source: str = Query("rmchm", description="数据源: rmchm / cfam"),
    db: AsyncSession = Depends(get_db_session),
):
    """根据药材中文名返回可访问的图片 URL（支持 RMCHM / CFAM 两个数据源）。"""
    image_path: Optional[str] = None
    if source == "cfam":
        image_path = (await db.execute(
            select(HFEHerb.image_path).where(HFEHerb.name_cn == name).limit(1)
        )).scalar_one_or_none()
    else:
        image_path = (await db.execute(
            select(RMCHMHerb.image_path).where(RMCHMHerb.name_cn == name).limit(1)
        )).scalar_one_or_none()

    url = _resolve_herb_image(name, image_path)
    return {"name": name, "source": source, "image_url": url, "found": url is not None}
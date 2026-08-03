"""
活性肽与知识图谱检索 API
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db_session, get_current_user
from ...models import (
    User, BioactivePeptide, KnowledgeGraphNode,
)
from ...services.data_sources.dfbp_client import dfbp_service
from ...services.data_sources.graph_service import graph_service

"""
Shared router for peptides module.
"""
from . import router

import logging
logger = logging.getLogger(__name__)

@router.get("/peptides", summary="DFBP 活性肽检索")
async def search_peptides(
    keyword: str = Query("", description="搜索关键词（序列/来源蛋白/活性类型）"),
    activity_type: str | None = Query(None, description="活性类型过滤"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """搜索 DFBP 生物活性肽数据库（数据库优先，内存 fallback）"""
    query = select(BioactivePeptide)
    count_query = select(func.count()).select_from(BioactivePeptide)

    if keyword:
        like_pattern = f"%{keyword}%"
        query = query.where(
            (BioactivePeptide.sequence.ilike(like_pattern))
            | (BioactivePeptide.source_protein.ilike(like_pattern))
            | (BioactivePeptide.source_organism.ilike(like_pattern))
            | (BioactivePeptide.activity_type.ilike(like_pattern))
        )
        count_query = count_query.where(
            (BioactivePeptide.sequence.ilike(like_pattern))
            | (BioactivePeptide.source_protein.ilike(like_pattern))
            | (BioactivePeptide.source_organism.ilike(like_pattern))
            | (BioactivePeptide.activity_type.ilike(like_pattern))
        )
    if activity_type:
        query = query.where(BioactivePeptide.activity_type == activity_type)
        count_query = count_query.where(BioactivePeptide.activity_type == activity_type)

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(BioactivePeptide.sequence).offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()

    # 数据库有结果直接返回
    if total > 0:
        return {
            "items": [
                {
                    "id": p.id,
                    "sequence": p.sequence,
                    "source_protein": p.source_protein,
                    "source_organism": p.source_organism,
                    "activity_type": p.activity_type,
                    "activity_value": p.activity_value,
                    "activity_unit": p.activity_unit,
                    "molecular_weight": p.molecular_weight,
                    "hydrolysis_enzyme": p.hydrolysis_enzyme,
                }
                for p in items
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    # Fallback: 从内存知识库搜索
    from ...services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
    results = []
    for idx, pep in enumerate(DFBP_PEPTIDE_DATABASE):
        kw = keyword.lower() if keyword else ""
        match = True
        if kw:
            match = (
                kw in (pep.get("sequence") or "").lower()
                or kw in (pep.get("source_protein") or "").lower()
                or kw in (pep.get("source_organism") or "").lower()
                or kw in (pep.get("activity_type") or "").lower()
            )
        if activity_type and pep.get("activity_type") != activity_type:
            match = False
        if match:
            results.append({
                "id": -(idx + 1),
                "sequence": pep.get("sequence", ""),
                "source_protein": pep.get("source_protein", ""),
                "source_organism": pep.get("source_organism", ""),
                "activity_type": pep.get("activity_type", ""),
                "activity_value": pep.get("activity_value"),
                "activity_unit": pep.get("activity_unit", ""),
                "molecular_weight": pep.get("molecular_weight"),
                "hydrolysis_enzyme": pep.get("hydrolysis_enzyme"),
            })

    total_fb = len(results)
    paginated = results[(page - 1) * page_size : page * page_size]
    return {
        "items": paginated,
        "total": total_fb,
        "page": page,
        "page_size": page_size,
    }


@router.get("/peptides/activity-types", summary="活性肽类型列表")
async def get_peptide_activity_types(
    current_user: User = Depends(get_current_user),
):
    """获取所有活性类型及其数量"""
    return {"activity_types": await dfbp_service.get_activity_types()}


@router.get("/peptides/{peptide_id}", summary="活性肽详情")
async def get_peptide_detail(
    peptide_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取活性肽完整信息（支持内存数据负数 ID）"""
    # 负数 ID：从内存知识库获取
    if peptide_id < 0:
        from ...services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
        idx = -(peptide_id) - 1
        if 0 <= idx < len(DFBP_PEPTIDE_DATABASE):
            pep = DFBP_PEPTIDE_DATABASE[idx]
            return {
                "id": peptide_id,
                "sequence": pep.get("sequence", ""),
                "source_protein": pep.get("source_protein", ""),
                "source_organism": pep.get("source_organism", ""),
                "activity_type": pep.get("activity_type", ""),
                "activity_value": pep.get("activity_value"),
                "activity_unit": pep.get("activity_unit", ""),
                "molecular_weight": pep.get("molecular_weight"),
                "hydrolysis_enzyme": pep.get("hydrolysis_enzyme"),
                "dfbp_id": pep.get("dfbp_id"),
                "literature_doi": pep.get("literature_doi"),
            }
        raise HTTPException(404, detail="活性肽不存在")

    peptide = (await db.execute(
        select(BioactivePeptide).where(BioactivePeptide.id == peptide_id)
    )).scalar_one_or_none()
    if not peptide:
        raise HTTPException(404, detail="活性肽不存在")
    return {
        "id": peptide.id,
        "sequence": peptide.sequence,
        "source_protein": peptide.source_protein,
        "source_organism": peptide.source_organism,
        "activity_type": peptide.activity_type,
        "activity_value": peptide.activity_value,
        "activity_unit": peptide.activity_unit,
        "molecular_weight": peptide.molecular_weight,
        "hydrolysis_enzyme": peptide.hydrolysis_enzyme,
        "dfbp_id": peptide.dfbp_id,
        "literature_doi": peptide.literature_doi,
    }


# ═══════════════════════════════════════════
# 知识图谱
# ═══════════════════════════════════════════


import logging
logger = logging.getLogger(__name__)
logger.info("peptides module loaded")

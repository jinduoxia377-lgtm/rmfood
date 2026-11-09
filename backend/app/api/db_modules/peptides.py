"""
活性肽与知识图谱检索 API
"""
import logging

from fastapi import Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models import (
    BioactivePeptide,
    User,
)
from ..deps import get_current_user, get_db_session

# Shared router for peptides module.
from . import router

logger = logging.getLogger(__name__)

@router.get("/peptides", summary="DFBP 活性肽检索")
async def search_peptides(
    keyword: str = Query("", description="搜索关键词（序列/来源蛋白/活性类型）"),
    activity_type: str | None = Query(None, description="活性类型过滤"),
    source_protein: str | None = Query(
        None, description="来源蛋白品类精确过滤（如 Collagen/Casein/Soy protein）"
    ),
    provenance: str | None = Query(
        None,
        description="溯源过滤: literature_confirmed(真食源肽,逐条PMID/DOI) | synthetic_unverified(合成未确证) | all(默认,向后兼容)",
    ),
    food_material_id: int | None = Query(
        None, description="按关联食品原料 ID 过滤（查某食材下的肽）"
    ),
    sort: str = Query(
        "sequence",
        description="排序字段: sequence | activity_type | molecular_weight (默认 sequence)",
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """搜索 DFBP 生物活性肽数据库（数据库优先，内存 fallback）

    溯源分层：库内仅少量为 literature_confirmed（真食源肽，逐条 PMID/DOI 溯源），
    其余多为 synthetic_unverified（合成/未溯源）。前端传 provenance=literature_confirmed
    可只看真食源肽；默认 all 保持向后兼容（不破坏既有调用）。
    """
    query = select(BioactivePeptide)
    count_query = select(func.count()).select_from(BioactivePeptide)

    if keyword:
        like_pattern = f"%{keyword}%"
        keyword_filter = (
            (BioactivePeptide.sequence.ilike(like_pattern))
            | (BioactivePeptide.source_protein.ilike(like_pattern))
            | (BioactivePeptide.source_organism.ilike(like_pattern))
            | (BioactivePeptide.activity_type.ilike(like_pattern))
        )
        query = query.where(keyword_filter)
        count_query = count_query.where(keyword_filter)
    if activity_type:
        query = query.where(BioactivePeptide.activity_type == activity_type)
        count_query = count_query.where(BioactivePeptide.activity_type == activity_type)

    # 来源蛋白品类精确过滤（默认 None 不加 where，向后兼容；与 provenance 等可叠加）
    if source_protein:
        query = query.where(BioactivePeptide.source_protein == source_protein)
        count_query = count_query.where(BioactivePeptide.source_protein == source_protein)

    # 溯源过滤（默认 all 不加 where，向后兼容）
    if provenance and provenance != "all":
        query = query.where(BioactivePeptide.provenance == provenance)
        count_query = count_query.where(BioactivePeptide.provenance == provenance)

    # 按关联食品原料过滤（查"某食品原料下的肽"）
    if food_material_id is not None:
        query = query.where(BioactivePeptide.food_material_id == food_material_id)
        count_query = count_query.where(BioactivePeptide.food_material_id == food_material_id)

    # 排序（白名单映射，默认 sequence 保持兼容；NULL 值排最后）
    sort_column = {
        "sequence": BioactivePeptide.sequence,
        "activity_type": BioactivePeptide.activity_type,
        "molecular_weight": BioactivePeptide.molecular_weight,
    }.get(sort, BioactivePeptide.sequence)
    query = query.order_by(sort_column.is_(None), sort_column)

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.offset((page - 1) * page_size).limit(page_size)
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
                    # 溯源分层 + 食材关联 + 溯源说明（前端区分真食源肽 vs 合成肽）
                    "provenance": p.provenance,
                    "food_material_id": p.food_material_id,
                    "evidence_note": p.evidence_note,
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
                # 内存库无溯源/食材关联列，填默认值保持响应结构一致
                "provenance": pep.get("provenance", "synthetic_unverified"),
                "food_material_id": pep.get("food_material_id"),
                "evidence_note": pep.get("evidence_note"),
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
    db: AsyncSession = Depends(get_db_session),
):
    """获取所有活性类型及其数量 — 从 PostgreSQL 实时查询"""
    from ...services.data_sources.dfbp_client import ACTIVITY_TYPE_MAP
    result = await db.execute(
        select(BioactivePeptide.activity_type, func.count().label('cnt'))
        .where(BioactivePeptide.activity_type.isnot(None))
        .group_by(BioactivePeptide.activity_type)
        .order_by(func.count().desc())
    )
    rows = result.fetchall()
    return {
        "activity_types": [
            {
                "type_en": row[0],
                "type_cn": ACTIVITY_TYPE_MAP.get(row[0], row[0]),
                "count": row[1],
            }
            for row in rows
        ]
    }


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


import logging  # noqa: E402

logger = logging.getLogger(__name__)
logger.info("peptides module loaded")

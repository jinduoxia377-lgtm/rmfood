"""
TCMSP 化合物/靶点/疾病 检索 API
"""
import logging

from fastapi import Depends, HTTPException, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.tcm_schema import TCMCompound, TCMDisease, TCMTarget
from ..deps import get_current_user, get_db_session
from . import router

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════
# 化合物检索
# ═══════════════════════════════════════════

@router.get("/compounds", summary="TCMSP 化合物检索")
async def search_compounds(
    keyword: str = Query("", description="搜索关键词（化合物名称）"),
    min_ob: float = Query(None, ge=0, le=200, description="最小 OB%"),
    max_ob: float = Query(None, ge=0, le=200, description="最大 OB%"),
    min_dl: float = Query(None, ge=0, le=1, description="最小 DL 值"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """搜索 TCMSP 化合物数据库"""
    query = select(TCMCompound)
    count_query = select(func.count()).select_from(TCMCompound)

    if keyword:
        like = f"%{keyword}%"
        query = query.where(TCMCompound.name.ilike(like))
        count_query = count_query.where(TCMCompound.name.ilike(like))

    if min_ob is not None:
        query = query.where(TCMCompound.ob_percent >= min_ob)
        count_query = count_query.where(TCMCompound.ob_percent >= min_ob)

    if max_ob is not None:
        query = query.where(TCMCompound.ob_percent <= max_ob)
        count_query = count_query.where(TCMCompound.ob_percent <= max_ob)

    if min_dl is not None:
        query = query.where(TCMCompound.dl_value >= min_dl)
        count_query = count_query.where(TCMCompound.dl_value >= min_dl)

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(TCMCompound.ob_percent.desc().nullslast())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()

    return {
        "items": [
            {
                "id": c.id,
                "name": c.name,
                "tcmsp_compound_id": c.tcmsp_compound_id,
                "molecular_weight": c.molecular_weight,
                "ob_percent": c.ob_percent,
                "dl_value": c.dl_value,
                "logp": c.logp,
                "hbd": c.hbd,
                "hba": c.hba,
                "tpsa": c.tpsa,
                "source": c.source,
            }
            for c in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/compounds/stats", summary="化合物统计")
async def get_compound_stats(
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """获取化合物统计数据"""
    total = (await db.execute(select(func.count()).select_from(TCMCompound))).scalar() or 0

    ob_ranges = [
        (0, 30, "低活性 OB<30%"),
        (30, 50, "中等 OB 30-50%"),
        (50, 70, "高活性 OB 50-70%"),
        (70, 100, "极高 OB 70-100%"),
        (100, 200, "特殊 >100%"),
    ]
    ob_stats = []
    for min_v, max_v, label in ob_ranges:
        result = await db.execute(
            select(func.count()).where(
                TCMCompound.ob_percent >= min_v, TCMCompound.ob_percent < max_v
            )
        )
        ob_stats.append({"label": label, "count": result.scalar() or 0})

    dl_ranges = [
        (0, 0.18, "DL<0.18 (不类药)"),
        (0.18, 0.50, "DL 0.18-0.50"),
        (0.50, 0.80, "DL 0.50-0.80"),
        (0.80, 1.0, "DL>0.80 (优秀类药)"),
    ]
    dl_stats = []
    for min_v, max_v, label in dl_ranges:
        result = await db.execute(
            select(func.count()).where(
                TCMCompound.dl_value >= min_v, TCMCompound.dl_value < max_v
            )
        )
        dl_stats.append({"label": label, "count": result.scalar() or 0})

    top_ob = (await db.execute(
        select(TCMCompound.name, TCMCompound.ob_percent, TCMCompound.dl_value)
        .where(TCMCompound.ob_percent.isnot(None))
        .order_by(TCMCompound.ob_percent.desc())
        .limit(10)
    )).mappings().all()

    return {
        "total_compounds": total,
        "ob_distribution": ob_stats,
        "dl_distribution": dl_stats,
        "top_ob_compounds": top_ob,
    }


# ═══════════════════════════════════════════
# 靶点检索
# ═══════════════════════════════════════════

@router.get("/targets", summary="TCMSP 靶点检索")
async def search_targets(
    keyword: str = Query("", description="搜索关键词（靶点名称/基因符号）"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """搜索 TCMSP 靶点数据库"""
    query = select(TCMTarget)
    count_query = select(func.count()).select_from(TCMTarget)

    if keyword:
        like = f"%{keyword}%"
        query = query.where(
            (TCMTarget.name.ilike(like)) | (TCMTarget.gene_symbol.ilike(like))
        )
        count_query = count_query.where(
            (TCMTarget.name.ilike(like)) | (TCMTarget.gene_symbol.ilike(like))
        )

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(TCMTarget.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()

    return {
        "items": [
            {
                "id": t.id,
                "name": t.name,
                "gene_symbol": t.gene_symbol,
                "organism": t.organism,
                "source": t.source,
            }
            for t in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/targets/stats", summary="靶点统计")
async def get_target_stats(
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """获取靶点统计数据"""
    total = (await db.execute(select(func.count()).select_from(TCMTarget))).scalar() or 0
    with_gene = (await db.execute(
        select(func.count()).where(TCMTarget.gene_symbol.isnot(None))
    )).scalar() or 0

    top = (await db.execute(text("""
        SELECT t.name, t.gene_symbol, COUNT(ct.compound_id) as compound_count
        FROM tcm_targets t
        LEFT JOIN tcm_compound_targets ct ON ct.target_id = t.id
        GROUP BY t.id, t.name, t.gene_symbol
        ORDER BY compound_count DESC LIMIT 15
    """))).mappings().all()

    return {
        "total_targets": total,
        "with_gene_symbol": with_gene,
        "top_targets": [
            {"name": t["name"], "gene_symbol": t["gene_symbol"], "compound_count": t["compound_count"]}
            for t in top
        ],
    }


# ═══════════════════════════════════════════
# 疾病检索
# ═══════════════════════════════════════════

@router.get("/diseases", summary="TCMSP 疾病检索")
async def search_diseases(
    keyword: str = Query("", description="搜索关键词（疾病名称）"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """搜索 TCMSP 疾病数据库"""
    query = select(TCMDisease)
    count_query = select(func.count()).select_from(TCMDisease)

    if keyword:
        like = f"%{keyword}%"
        query = query.where(TCMDisease.name.ilike(like))
        count_query = count_query.where(TCMDisease.name.ilike(like))

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(TCMDisease.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()

    return {
        "items": [
            {"id": d.id, "name": d.name, "mesh_id": d.mesh_id, "source": d.source}
            for d in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/diseases/stats", summary="疾病统计")
async def get_disease_stats(
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    total = (await db.execute(select(func.count()).select_from(TCMDisease))).scalar() or 0
    return {"total_diseases": total}


# ═══════════════════════════════════════════
# 化合物详情（含关联靶点）
# ═══════════════════════════════════════════

@router.get("/compounds/{compound_id}", summary="化合物详情")
async def get_compound_detail(
    compound_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    result = await db.execute(select(TCMCompound).where(TCMCompound.id == compound_id))
    compound = result.scalar_one_or_none()
    if not compound:
        raise HTTPException(status_code=404, detail="化合物不存在")

    targets_result = await db.execute(text("""
        SELECT t.name, t.gene_symbol
        FROM tcm_targets t
        JOIN tcm_compound_targets ct ON ct.target_id = t.id
        WHERE ct.compound_id = :cid
    """), {"cid": compound_id})
    targets = [{"name": r[0], "gene_symbol": r[1]} for r in targets_result.all()]

    herbs_result = await db.execute(text("""
        SELECT h.name_cn, h.name_latin
        FROM tcm_herbs h
        JOIN tcm_herb_compounds hc ON hc.herb_id = h.id
        WHERE hc.compound_id = :cid
    """), {"cid": compound_id})
    herbs = [{"name_cn": r[0], "name_latin": r[1]} for r in herbs_result.all()]

    return {
        "id": compound.id,
        "name": compound.name,
        "tcmsp_compound_id": compound.tcmsp_compound_id,
        "molecular_weight": compound.molecular_weight,
        "ob_percent": compound.ob_percent,
        "dl_value": compound.dl_value,
        "logp": compound.logp,
        "hbd": compound.hbd,
        "hba": compound.hba,
        "targets": targets,
        "related_herbs": herbs[:20],
        "source": compound.source,
    }

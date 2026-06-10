"""
数据库检索 API
TCMSP 中药材数据库 / DFBP 活性肽数据库 / 知识图谱搜索
Phase 2: 增强数据同步 / 知识图谱可视化 / 药食同源检索
"""
from fastapi import APIRouter, Depends, HTTPException, Query  # v2.0-pg
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import get_db_session, get_current_user
from ..models.models import (
    User, TCMHerb, BioactivePeptide, KnowledgeGraphNode, DataSnapshot,
)
from ..services.data_sources.tcmsp_client import tcmsp_service
from ..services.data_sources.dfbp_client import dfbp_service
from ..services.data_sources.graph_service import graph_service
from ..services.data_sources.search_service import search_service

router = APIRouter(prefix="/databases", tags=["数据库检索"])


# ═══════════════════════════════════════════
# TCMSP 中药材检索
# ═══════════════════════════════════════════

@router.get("/herbs", summary="TCMSP 中药材检索")
async def search_herbs(
    keyword: str = Query("", description="搜索关键词（药名/拉丁名/拼音）"),
    category: str | None = Query(None, description="药材分类过滤"),
    food_homology_only: bool = Query(False, description="仅药食同源"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """搜索 TCMSP 中药材数据库（数据库优先，内存 fallback）"""
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
        query = query.where(TCMHerb.is_food_homology == True)
        count_query = count_query.where(TCMHerb.is_food_homology == True)

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(TCMHerb.name_cn).offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()

    # 数据库有结果直接返回
    if total > 0:
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
                    "compound_count": len(h.compounds) if h.compounds else 0,
                    "target_count": len(h.targets) if h.targets else 0,
                }
                for h in items
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    # Fallback: 从内存知识库搜索（无需同步即可使用）
    from ..services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE
    results = []
    for idx, herb in enumerate(TCMSP_HERB_DATABASE):
        kw = keyword.lower() if keyword else ""
        match = True
        if kw:
            match = (
                kw in herb["name_cn"].lower()
                or kw in (herb.get("name_latin") or "").lower()
                or kw in (herb.get("name_pinyin") or "").lower()
                or kw in (herb.get("effects") or "").lower()
            )
        if category and herb.get("category") != category:
            match = False
        if food_homology_only and not herb.get("is_food_homology"):
            match = False
        if match:
            results.append({
                "id": -(idx + 1),  # 负数 ID 标识内存数据
                "name_cn": herb["name_cn"],
                "name_latin": herb.get("name_latin", ""),
                "name_pinyin": herb.get("name_pinyin", ""),
                "category": herb.get("category", ""),
                "ob_percent": herb.get("ob_percent"),
                "dl_value": herb.get("dl_value"),
                "effects": herb.get("effects", ""),
                "is_food_homology": herb.get("is_food_homology", False),
                "compound_count": len(herb.get("compounds", [])),
                "target_count": len(herb.get("targets", [])),
            })

    total_fb = len(results)
    paginated = results[(page - 1) * page_size : page * page_size]
    return {
        "items": paginated,
        "total": total_fb,
        "page": page,
        "page_size": page_size,
    }


@router.get("/herbs/categories", summary="药材分类列表")
async def get_herb_categories(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取所有药材分类及数量"""
    return {"categories": await tcmsp_service.get_categories(db)}


@router.get("/herbs/food-homology", summary="药食同源药材列表")
async def get_food_homology_herbs(
    keyword: str = Query("", description="搜索关键词"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取药食同源目录中的药材"""
    return await tcmsp_service.get_food_homology_list(db, keyword, page, page_size)


@router.get("/herbs/food-homology/check", summary="药食同源查询")
async def check_food_homology(
    herb_name: str = Query(..., min_length=1, description="药材名称"),
    current_user: User = Depends(get_current_user),
):
    """查询药材是否在药食同源目录中"""
    return await tcmsp_service.check_food_homology(herb_name)


@router.get("/herbs/{herb_id}", summary="中药材详情")
async def get_herb_detail(
    herb_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取中药材完整信息，包括化合物和靶点列表"""
    # 负数 ID：从内存知识库获取（无需同步）
    if herb_id < 0:
        from ..services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE
        idx = -(herb_id) - 1
        if 0 <= idx < len(TCMSP_HERB_DATABASE):
            herb = TCMSP_HERB_DATABASE[idx]
            return {
                "id": herb_id,
                "name_cn": herb["name_cn"],
                "name_latin": herb.get("name_latin", ""),
                "name_pinyin": herb.get("name_pinyin", ""),
                "category": herb.get("category", ""),
                "compounds": herb.get("compounds", []),
                "targets": herb.get("targets", []),
                "diseases": herb.get("diseases", []),
                "ob_percent": herb.get("ob_percent"),
                "dl_value": herb.get("dl_value"),
                "effects": herb.get("effects", ""),
                "is_food_homology": herb.get("is_food_homology", False),
                "tcmsp_id": None,
            }
        raise HTTPException(404, detail="药材不存在")

    herb = (await db.execute(select(TCMHerb).where(TCMHerb.id == herb_id))).scalar_one_or_none()
    if not herb:
        raise HTTPException(404, detail="药材不存在")
    return {
        "id": herb.id,
        "name_cn": herb.name_cn,
        "name_latin": herb.name_latin,
        "name_pinyin": herb.name_pinyin,
        "category": herb.category,
        "compounds": herb.compounds,
        "targets": herb.targets,
        "diseases": herb.diseases,
        "ob_percent": herb.ob_percent,
        "dl_value": herb.dl_value,
        "effects": herb.effects,
        "is_food_homology": herb.is_food_homology,
        "tcmsp_id": herb.tcmsp_id,
    }


# ═══════════════════════════════════════════
# DFBP 活性肽检索
# ═══════════════════════════════════════════

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
    from ..services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
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
        from ..services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
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

@router.get("/knowledge-graph/search", summary="知识图谱搜索")
async def search_knowledge_graph(
    keyword: str = Query(..., min_length=1, description="搜索关键词"),
    node_type: str | None = Query(None, description="节点类型过滤（herb/compound/target/disease）"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """搜索中医药知识图谱节点（数据库优先，内存 fallback）"""
    # 先查数据库
    query = select(KnowledgeGraphNode)
    count_query = select(func.count()).select_from(KnowledgeGraphNode)

    like_pattern = f"%{keyword}%"
    query = query.where(KnowledgeGraphNode.node_label.ilike(like_pattern))
    count_query = count_query.where(KnowledgeGraphNode.node_label.ilike(like_pattern))

    if node_type:
        query = query.where(KnowledgeGraphNode.node_type == node_type)
        count_query = count_query.where(KnowledgeGraphNode.node_type == node_type)

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(KnowledgeGraphNode.node_label).limit(limit)
    )).scalars().all()

    # 数据库有结果直接返回
    if total > 0:
        return {
            "items": [
                {
                    "id": n.id,
                    "node_type": n.node_type,
                    "node_label": n.node_label,
                    "properties": n.properties,
                    "source_db": n.source_db,
                }
                for n in items
            ],
            "total": total,
        }

    # Fallback: 从知识库内存搜索（无需同步即可使用）
    memory_results = await graph_service.search_nodes(keyword, node_type, limit)
    return {
        "items": memory_results,
        "total": len(memory_results),
    }


@router.get("/knowledge-graph/relations", summary="节点关系网络")
async def get_node_relations(
    node_label: str = Query(..., min_length=1, description="节点标签"),
    depth: int = Query(1, ge=1, le=3),
    current_user: User = Depends(get_current_user),
):
    """获取节点的关联关系网络（用于可视化）"""
    return await graph_service.get_node_relations(node_label, depth)


@router.get("/knowledge-graph/herb-path", summary="药材-化合物-靶点路径")
async def get_herb_compound_targets(
    herb_name: str = Query(..., min_length=1, description="药材名称"),
    current_user: User = Depends(get_current_user),
):
    """获取药材-化合物-靶点的完整路径"""
    return await graph_service.get_herb_compound_targets(herb_name)


@router.get("/knowledge-graph/interactions", summary="药材配伍网络")
async def get_herb_interactions(
    herbs: str = Query(..., min_length=1, description="药材名称，逗号分隔"),
    current_user: User = Depends(get_current_user),
):
    """获取多味药材之间的配伍关系网络"""
    herb_names = [h.strip() for h in herbs.split(",") if h.strip()]
    if len(herb_names) < 2:
        raise HTTPException(400, detail="请至少提供两味药材")
    return await graph_service.get_interaction_network(herb_names)


@router.get("/knowledge-graph/stats", summary="知识图谱统计")
async def get_graph_stats(
    current_user: User = Depends(get_current_user),
):
    """获取知识图谱整体统计"""
    return await graph_service.get_graph_stats()


@router.get("/knowledge-graph/path", summary="节点间路径发现")
async def find_path(
    source: str = Query(..., description="起始节点"),
    target: str = Query(..., description="目标节点"),
    max_depth: int = Query(5, ge=1, le=8, description="最大搜索深度"),
    current_user: User = Depends(get_current_user),
):
    """使用BFS查找两个知识图谱节点之间的最短关联路径"""
    result = await graph_service.find_path(source, target, max_depth)
    if not result:
        return {"path": [], "found": False, "message": f"未找到从 {source} 到 {target} 的关联路径（深度≤{max_depth}）"}
    return {"path": result, "found": True, "source": source, "target": target, "length": len(result)}


@router.get("/knowledge-graph/subgraph", summary="子图提取")
async def get_subgraph(
    center: str = Query(..., description="中心节点标签"),
    radius: int = Query(2, ge=1, le=3, description="展开半径"),
    current_user: User = Depends(get_current_user),
):
    """提取以某节点为中心的子图（多层级展开）"""
    return await graph_service.get_subgraph(center, radius)


# ═══════════════════════════════════════════
# 统一搜索
# ═══════════════════════════════════════════

@router.get("/unified-search", summary="跨数据源统一搜索")
async def unified_search(
    keyword: str = Query(..., min_length=1, description="搜索关键词"),
    sources: str = Query("herbs,peptides,graph", description="数据源，逗号分隔"),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
):
    """跨数据源统一搜索"""
    source_list = [s.strip() for s in sources.split(",") if s.strip()]
    return await search_service.unified_search(keyword, source_list, limit)


# ═══════════════════════════════════════════
# 数据同步
# ═══════════════════════════════════════════

@router.post("/sync/herbs", summary="同步 TCMSP 药材数据")
async def sync_tcmsp_herbs(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """从知识库同步 TCMSP 中药材数据到本地数据库"""
    if current_user.role not in ("admin", "formulator", "reviewer"):
        raise HTTPException(403, detail="权限不足，需要管理员或配方师权限")
    return await tcmsp_service.sync_herbs(db)


@router.post("/sync/peptides", summary="同步 DFBP 肽数据")
async def sync_dfbp_peptides(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """从知识库同步 DFBP 活性肽数据到本地数据库"""
    if current_user.role not in ("admin", "formulator", "reviewer"):
        raise HTTPException(403, detail="权限不足，需要管理员或配方师权限")
    return await dfbp_service.sync_peptides(db)


@router.get("/sync/stats", summary="同步状态统计")
async def get_sync_stats(
    db: AsyncSession = Depends(get_db_session),
):
    """获取各数据源的同步统计（公开接口）"""
    herb_stats = await tcmsp_service.get_sync_stats(db)
    peptide_stats = await dfbp_service.get_sync_stats(db)
    graph_stats = await graph_service.get_graph_stats()
    return {
        "tcmsp": herb_stats,
        "dfbp": peptide_stats,
        "knowledge_graph": graph_stats,
    }


# ═══════════════════════════════════════════
# 数据快照
# ═══════════════════════════════════════════

@router.get("/snapshots", summary="数据源同步快照")
async def list_snapshots(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """查看各数据源的同步快照信息"""
    snapshots = (await db.execute(
        select(DataSnapshot).order_by(DataSnapshot.created_at.desc())
    )).scalars().all()

    return {
        "snapshots": [
            {
                "snapshot_id": s.snapshot_id,
                "source_db": s.source_db,
                "total_records": s.total_records,
                "is_active": s.is_active,
                "checksum": s.checksum,
                "metadata": s.metadata_,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in snapshots
        ]
    }


# ═══════════════════════════════════════════
# 实时数据仪表盘 (Phase 4 深度增强)
# ═══════════════════════════════════════════

@router.get("/dashboard/overview", summary="实时仪表盘概览")
async def dashboard_overview(
    db: AsyncSession = Depends(get_db_session),
):
    """实时仪表盘概览数据 — 从 PostgreSQL 数据库聚合多源统计（公开接口）"""
    import json
    from datetime import datetime

    # ── 1. 基础计数（优先从 PostgreSQL 查询）──
    herb_total_result = await db.execute(select(func.count()).select_from(TCMHerb))
    total_herbs = herb_total_result.scalar() or 0

    peptide_total_result = await db.execute(select(func.count()).select_from(BioactivePeptide))
    total_peptides = peptide_total_result.scalar() or 0

    # ── 2. 药材数据分析（PostgreSQL 优先，内存 fallback）──
    # 尝试从数据库获取药材数据
    herbs_db = (await db.execute(select(TCMHerb))).scalars().all()
    use_herb_db = len(herbs_db) > 0

    if use_herb_db:
        # PostgreSQL 数据源
        ob_distribution = {"<10%": 0, "10-30%": 0, "30-50%": 0, "50-70%": 0, ">70%": 0}
        dl_distribution = {"<0.1": 0, "0.1-0.2": 0, "0.2-0.3": 0, "0.3-0.5": 0, ">0.5": 0}
        category_breakdown = {}
        food_homology_count = 0
        high_ob_herbs = []

        for h in herbs_db:
            ob = h.ob_percent or 0
            dl = h.dl_value or 0
            cat = h.category or "未分类"

            if ob < 10: ob_distribution["<10%"] += 1
            elif ob < 30: ob_distribution["10-30%"] += 1
            elif ob < 50: ob_distribution["30-50%"] += 1
            elif ob < 70: ob_distribution["50-70%"] += 1
            else: ob_distribution[">70%"] += 1

            if dl < 0.1: dl_distribution["<0.1"] += 1
            elif dl < 0.2: dl_distribution["0.1-0.2"] += 1
            elif dl < 0.3: dl_distribution["0.2-0.3"] += 1
            elif dl < 0.5: dl_distribution["0.3-0.5"] += 1
            else: dl_distribution[">0.5"] += 1

            category_breakdown[cat] = category_breakdown.get(cat, 0) + 1

            if h.is_food_homology is True:
                food_homology_count += 1

            compound_count = len(h.compounds) if isinstance(h.compounds, list) else 0
            if ob >= 40:
                high_ob_herbs.append({
                    "name_cn": h.name_cn or f"(ID:{h.id})",
                    "ob_percent": round(ob, 2),
                    "dl_value": round(dl, 3),
                    "compound_count": compound_count,
                    "category": cat,
                    "is_food_homology": bool(h.is_food_homology),
                })

        high_ob_herbs.sort(key=lambda x: x["ob_percent"], reverse=True)
    else:
        # Fallback: 内存数据
        from ..services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE
        herbs_mem = TCMSP_HERB_DATABASE
        total_herbs = len(herbs_mem)

        ob_distribution = {"<10%": 0, "10-30%": 0, "30-50%": 0, "50-70%": 0, ">70%": 0}
        dl_distribution = {"<0.1": 0, "0.1-0.2": 0, "0.2-0.3": 0, "0.3-0.5": 0, ">0.5": 0}
        category_breakdown = {}
        food_homology_count = 0
        high_ob_herbs = []

        for h in herbs_mem:
            ob = h.get("ob_percent") or 0
            dl = h.get("dl_value") or 0
            cat = h.get("category", "未分类")

            if ob < 10: ob_distribution["<10%"] += 1
            elif ob < 30: ob_distribution["10-30%"] += 1
            elif ob < 50: ob_distribution["30-50%"] += 1
            elif ob < 70: ob_distribution["50-70%"] += 1
            else: ob_distribution[">70%"] += 1

            if dl < 0.1: dl_distribution["<0.1"] += 1
            elif dl < 0.2: dl_distribution["0.1-0.2"] += 1
            elif dl < 0.3: dl_distribution["0.2-0.3"] += 1
            elif dl < 0.5: dl_distribution["0.3-0.5"] += 1
            else: dl_distribution[">0.5"] += 1

            category_breakdown[cat] = category_breakdown.get(cat, 0) + 1
            if h.get("is_food_homology"):
                food_homology_count += 1
            if ob >= 40:
                high_ob_herbs.append({
                    "name_cn": h["name_cn"],
                    "ob_percent": round(ob, 2),
                    "dl_value": round(dl, 3),
                    "compound_count": len(h.get("compounds", [])),
                    "category": cat,
                    "is_food_homology": h.get("is_food_homology", False),
                })

        high_ob_herbs.sort(key=lambda x: x["ob_percent"], reverse=True)

    # ── 3. 活性肽数据分析（PostgreSQL 优先，内存 fallback）──
    peptides_db = (await db.execute(select(BioactivePeptide))).scalars().all()
    use_peptide_db = len(peptides_db) > 0

    if use_peptide_db:
        seq_len_distribution = {
            "二肽(2)": 0, "三肽(3)": 0, "四肽(4)": 0, "五肽(5)": 0,
            "六肽(6)": 0, "七肽(7)": 0, "八肽(8)": 0, "九肽以上(9+)": 0,
        }
        activity_type_breakdown = {}
        enzyme_breakdown = {}
        source_organism_breakdown = {}
        high_activity_peptides = []

        for p in peptides_db:
            seq_len = len(p.sequence or "")
            act_type = p.activity_type or "未知"
            enzyme = p.hydrolysis_enzyme or "未知"
            organism = p.source_organism or "未知"
            act_val = p.activity_value

            if seq_len <= 2: seq_len_distribution["二肽(2)"] += 1
            elif seq_len <= 3: seq_len_distribution["三肽(3)"] += 1
            elif seq_len <= 4: seq_len_distribution["四肽(4)"] += 1
            elif seq_len <= 5: seq_len_distribution["五肽(5)"] += 1
            elif seq_len <= 6: seq_len_distribution["六肽(6)"] += 1
            elif seq_len <= 7: seq_len_distribution["七肽(7)"] += 1
            elif seq_len <= 8: seq_len_distribution["八肽(8)"] += 1
            else: seq_len_distribution["九肽以上(9+)"] += 1

            activity_type_breakdown[act_type] = activity_type_breakdown.get(act_type, 0) + 1
            enzyme_breakdown[enzyme] = enzyme_breakdown.get(enzyme, 0) + 1
            source_organism_breakdown[organism] = source_organism_breakdown.get(organism, 0) + 1

            if act_val and act_type == "ACE inhibitory":
                try:
                    if float(act_val) < 1.0:
                        high_activity_peptides.append({
                            "sequence": p.sequence,
                            "activity_value": act_val,
                            "activity_unit": p.activity_unit or "μM",
                            "source_protein": p.source_protein,
                            "molecular_weight": p.molecular_weight,
                            "hydrolysis_enzyme": enzyme,
                        })
                except (ValueError, TypeError):
                    pass
    else:
        # Fallback: 内存数据
        from ..services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
        peptides_mem = DFBP_PEPTIDE_DATABASE
        total_peptides = len(peptides_mem)

        seq_len_distribution = {
            "二肽(2)": 0, "三肽(3)": 0, "四肽(4)": 0, "五肽(5)": 0,
            "六肽(6)": 0, "七肽(7)": 0, "八肽(8)": 0, "九肽以上(9+)": 0,
        }
        activity_type_breakdown = {}
        enzyme_breakdown = {}
        source_organism_breakdown = {}
        high_activity_peptides = []

        for p in peptides_mem:
            seq_len = len(p.get("sequence") or "")
            act_type = p.get("activity_type", "未知")
            enzyme = p.get("hydrolysis_enzyme", "未知")
            organism = p.get("source_organism", "未知")
            act_val = p.get("activity_value")

            if seq_len <= 2: seq_len_distribution["二肽(2)"] += 1
            elif seq_len <= 3: seq_len_distribution["三肽(3)"] += 1
            elif seq_len <= 4: seq_len_distribution["四肽(4)"] += 1
            elif seq_len <= 5: seq_len_distribution["五肽(5)"] += 1
            elif seq_len <= 6: seq_len_distribution["六肽(6)"] += 1
            elif seq_len <= 7: seq_len_distribution["七肽(7)"] += 1
            elif seq_len <= 8: seq_len_distribution["八肽(8)"] += 1
            else: seq_len_distribution["九肽以上(9+)"] += 1

            activity_type_breakdown[act_type] = activity_type_breakdown.get(act_type, 0) + 1
            enzyme_breakdown[enzyme] = enzyme_breakdown.get(enzyme, 0) + 1
            source_organism_breakdown[organism] = source_organism_breakdown.get(organism, 0) + 1

            if act_val and act_type == "ACE inhibitory":
                try: act_val_f = float(act_val)
                except (ValueError, TypeError): act_val_f = None
                if act_val_f is not None and act_val_f < 1.0:
                    high_activity_peptides.append({
                        "sequence": p.get("sequence"),
                        "activity_value": act_val,
                        "activity_unit": p.get("activity_unit", "μM"),
                        "source_protein": p.get("source_protein"),
                        "molecular_weight": p.get("molecular_weight"),
                        "hydrolysis_enzyme": enzyme,
                    })

    high_activity_peptides.sort(key=lambda x: float(x["activity_value"]) if x["activity_value"] else 999)

    # 热门分类 Top 8
    top_categories = sorted(category_breakdown.items(), key=lambda x: x[1], reverse=True)[:8]
    top_activity_types = sorted(activity_type_breakdown.items(), key=lambda x: x[1], reverse=True)[:8]
    top_enzymes = sorted(enzyme_breakdown.items(), key=lambda x: x[1], reverse=True)[:6]
    top_organisms = sorted(source_organism_breakdown.items(), key=lambda x: x[1], reverse=True)[:6]

    # 图谱统计（保持原有逻辑）
    graph_stats = await graph_service.get_graph_stats()

    return {
        "timestamp": datetime.now().isoformat(),
        "data_source": "postgresql" if (use_herb_db or use_peptide_db) else "memory_fallback",
        "summary": {
            "total_herbs": total_herbs,
            "total_peptides": total_peptides,
            "food_homology_count": food_homology_count,
            "total_graph_nodes": (
                graph_stats.get("total_herbs", 0) +
                graph_stats.get("total_compounds", 0) +
                graph_stats.get("total_targets", 0) +
                graph_stats.get("total_diseases", 0)
            ),
            "high_quality_herbs": len(high_ob_herbs),
            "high_activity_peptides": len(high_activity_peptides),
            "category_count": len(category_breakdown),
            "activity_type_count": len(activity_type_breakdown),
        },
        "ob_distribution": ob_distribution,
        "dl_distribution": dl_distribution,
        "seq_length_distribution": seq_len_distribution,
        "categories": [{"category": k, "count": v} for k, v in top_categories],
        "activity_types": [{"type": k, "count": v} for k, v in top_activity_types],
        "enzymes": [{"enzyme": k, "count": v} for k, v in top_enzymes],
        "source_organisms": [{"organism": k, "count": v} for k, v in top_organisms],
        "top_herbs_by_ob": high_ob_herbs[:15],
        "top_active_peptides": high_activity_peptides[:20],
        "graph_stats": graph_stats,
    }


# ═══════════════════════════════════════════
# 排行榜专用 API（公开接口）
# ═══════════════════════════════════════════

@router.get("/ranking/food-homology", summary="药食同源原料热度排行")
async def ranking_food_homology(
    db: AsyncSession = Depends(get_db_session),
):
    """
    药食同源原料热度排行 — 基于 TCMSP 药材数据综合热度评分
    筛选 is_food_homology=True 的药食同源药材，按 OB% 降序排列返回 TOP 20
    热度分数公式: heat_score = ob_percent * 0.4 + compound_count * 2 + target_count * 3
    （公开接口，无需认证）
    """
    from datetime import datetime

    # ── 数据库优先：查询药食同源药材 ──
    herbs_db = (await db.execute(
        select(TCMHerb).where(TCMHerb.is_food_homology == True)
    )).scalars().all()

    if len(herbs_db) > 0:
        ranked = []
        for h in herbs_db:
            ob = h.ob_percent or 0
            cc = len(h.compounds) if isinstance(h.compounds, list) else 0
            tc = len(h.targets) if isinstance(h.targets, list) else 0
            heat_score = round(ob * 0.4 + cc * 2 + tc * 3, 2)
            effects_raw = h.effects or ""
            effects_truncated = effects_raw[:50] + ("..." if len(effects_raw) > 50 else "")
            ranked.append({
                "name_cn": h.name_cn or f"(ID:{h.id})",
                "name_latin": h.name_latin or "",
                "ob_percent": round(ob, 2),
                "dl_value": round(h.dl_value or 0, 3),
                "compound_count": cc,
                "target_count": tc,
                "category": h.category or "",
                "effects": effects_truncated,
                "is_food_homology": True,
                "heat_score": heat_score,
            })

        ranked.sort(key=lambda x: (x["ob_percent"], x["heat_score"]), reverse=True)
        top20 = ranked[:20]
        for i, item in enumerate(top20, 1):
            item["rank"] = i

        return {
            "items": top20,
            "total": len(herbs_db),
            "generated_at": datetime.now().isoformat(),
            "data_source": "database",
        }

    # ── Fallback: 内存数据 ──
    from ..services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE

    candidates = [
        h for h in TCMSP_HERB_DATABASE
        if h.get("is_food_homology") is True
    ]

    ranked = []
    for h in candidates:
        ob = h.get("ob_percent") or 0
        cc = len(h.get("compounds", []))
        tc = len(h.get("targets", []))
        heat_score = round(ob * 0.4 + cc * 2 + tc * 3, 2)
        effects_raw = h.get("effects") or ""
        effects_truncated = effects_raw[:50] + ("..." if len(effects_raw) > 50 else "")
        ranked.append({
            "name_cn": h["name_cn"],
            "name_latin": h.get("name_latin", ""),
            "ob_percent": round(ob, 2),
            "dl_value": round(h.get("dl_value") or 0, 3),
            "compound_count": cc,
            "target_count": tc,
            "category": h.get("category", ""),
            "effects": effects_truncated,
            "is_food_homology": True,
            "heat_score": heat_score,
        })

    ranked.sort(key=lambda x: (x["ob_percent"], x["heat_score"]), reverse=True)
    top20 = ranked[:20]

    for i, item in enumerate(top20, 1):
        item["rank"] = i

    return {
        "items": top20,
        "total": len(candidates),
        "generated_at": datetime.now().isoformat(),
        "data_source": "memory_fallback",
    }


@router.get("/ranking/active-peptides", summary="高活性肽活性排行")
async def ranking_active_peptides():
    """
    高活性肽活性排行 — 基于 DFBP 活性肽数据的 ACE 抑制肽活性排名
    筛选 activity_type="ACE inhibitory" 的肽，按 IC50 升序排列返回 TOP 20（值越小活性越高）
    活性评分公式: activity_score = (1000 / (activity_value + 0.01)) * log(seq_length + 1)
    （公开接口，无需认证）
    """
    from datetime import datetime
    from math import log
    from ..services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE

    candidates = [
        p for p in DFBP_PEPTIDE_DATABASE
        if p.get("activity_type") == "ACE inhibitory"
        and p.get("activity_value") is not None
    ]

    ranked = []
    for p in candidates:
        av = float(p["activity_value"])
        seq_len = len(p.get("sequence") or "")
        activity_score = round((1000 / (av + 0.01)) * log(seq_len + 1), 4)
        ranked.append({
            "sequence": p.get("sequence", ""),
            "activity_value": round(av, 6),
            "activity_unit": p.get("activity_unit", "μM"),
            "source_protein": p.get("source_protein", ""),
            "molecular_weight": round(p.get("molecular_weight") or 0, 1),
            "hydrolysis_enzyme": p.get("hydrolysis_enzyme", ""),
            "activity_type": "ACE inhibitory",
            "seq_length": seq_len,
            "activity_score": activity_score,
        })

    ranked.sort(key=lambda x: x["activity_value"])
    top20 = ranked[:20]

    for i, item in enumerate(top20, 1):
        item["rank"] = i

    return {
        "items": top20,
        "total": len(candidates),
        "generated_at": datetime.now().isoformat(),
    }


@router.get("/dashboard/trends", summary="数据趋势分析")
async def dashboard_trends(
    db: AsyncSession = Depends(get_db_session),
):
    """
    数据趋势分析 — 基于当前数据的静态分析趋势图
    返回药材属性关联趋势、活性类型时间分布模拟等（公开接口）
    """
    import random

    # ── 数据库优先：查询药材和活性肽数据 ──
    herbs_db = (await db.execute(select(TCMHerb).limit(500))).scalars().all()
    peptides_db = (await db.execute(select(BioactivePeptide).limit(500))).scalars().all()

    use_herb_db = len(herbs_db) > 0
    use_peptide_db = len(peptides_db) > 0

    # 选择数据源
    if use_herb_db:
        herbs_source = herbs_db
        is_herb_orm = True
    else:
        from ..services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE
        herbs_source = TCMSP_HERB_DATABASE
        is_herb_orm = False

    if use_peptide_db:
        peptides_source = peptides_db
        is_peptide_orm = True
    else:
        from ..services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
        peptides_source = DFBP_PEPTIDE_DATABASE
        is_peptide_orm = False

    # ── 药材 OB vs DL 散点数据 (用于散点图，采样 200 条) ──
    ob_dl_scatter = []
    sample_herbs = random.sample(herbs_source, min(300, len(herbs_source)))
    for h in sample_herbs:
        if is_herb_orm:
            ob = h.ob_percent
            dl = h.dl_value
            name_cn = h.name_cn or f"(ID:{h.id})"
            category = h.category or ""
            is_fh = bool(h.is_food_homology)
        else:
            ob = h.get("ob_percent")
            dl = h.get("dl_value")
            name_cn = h["name_cn"]
            category = h.get("category", "")
            is_fh = h.get("is_food_homology", False)

        if ob is not None and dl is not None:
            ob_dl_scatter.append({
                "x": round(ob, 2),
                "y": round(dl, 3),
                "name": name_cn,
                "category": category,
                "is_food_homology": is_fh,
            })

    # ── 化合物数 vs 靶点数 关联 ──
    compound_target_corr = []
    for h in herbs_source:
        if is_herb_orm:
            cc = len(h.compounds) if isinstance(h.compounds, list) else 0
            tc = len(h.targets) if isinstance(h.targets, list) else 0
            name_cn = h.name_cn or f"(ID:{h.id})"
        else:
            cc = len(h.get("compounds", []))
            tc = len(h.get("targets", []))
            name_cn = h["name_cn"]

        if cc > 0 or tc > 0:
            compound_target_corr.append({
                "x": cc,
                "y": tc,
                "name": name_cn,
            })

    # ── 活性肽分子量 vs 活性值 关联 ──
    mw_activity_scatter = []
    for p in peptides_source:
        if is_peptide_orm:
            mw = p.molecular_weight
            av = p.activity_value
            at = p.activity_type
            seq = p.sequence or ""
            sp = p.source_protein or ""
        else:
            mw = p.get("molecular_weight")
            av = p.get("activity_value")
            at = p.get("activity_type")
            seq = p.get("sequence", "")
            sp = p.get("source_protein", "")

        if mw is not None and av is not None and at == "ACE inhibitory":
            try:
                mw_activity_scatter.append({
                    "x": round(mw, 1),
                    "y": round(float(av), 4),
                    "seq_len": len(seq),
                    "source": sp,
                })
            except (ValueError, TypeError):
                pass

    # ── 分类-功效热力数据 ──
    category_effect_matrix = {}
    for h in herbs_source:
        if is_herb_orm:
            cat = h.category or "未分类"
            effects_raw = h.effects or ""
        else:
            cat = h.get("category", "未分类")
            effects_raw = h.get("effects") or ""

        effects = effects_raw.split()[0:1] if effects_raw else [""]
        effect_key = effects[0] if effects else "未知"
        key = f"{cat}|{effect_key}"
        category_effect_matrix[key] = category_effect_matrix.get(key, 0) + 1

    heatmap_data = []
    for k, v in category_effect_matrix.items():
        parts = k.split("|", 1)
        if len(parts) == 2:
            heatmap_data.append({"category": parts[0], "effect": parts[1], "value": v})

    return {
        "ob_dl_scatter": ob_dl_scatter[:200],
        "compound_target_correlation": compound_target_corr[:200],
        "mw_activity_scatter": mw_activity_scatter[:150],
        "category_effect_heatmap": heatmap_data[:80],
        "analysis_notes": {
            "ob_dl_scatter": f"共 {len(ob_dl_scatter)} 个有效数据点",
            "compound_target": f"共 {len(compound_target_corr)} 个有效数据点",
            "mw_activity": f"共 {len(mw_activity_scatter)} 个 ACE 抑制肽数据点",
            "heatmap": f"共 {len(heatmap_data)} 个分类-功效组合",
        },
        "data_source": "database" if (use_herb_db or use_peptide_db) else "memory_fallback",
    }


@router.get("/suggestions", summary="搜索自动补全建议")
async def get_search_suggestions(
    keyword: str = Query(..., min_length=1, description="输入关键词"),
    limit: int = Query(10, ge=1, le=30),
    db: AsyncSession = Depends(get_db_session),
):
    """实时搜索自动补全建议 — 跨数据源（公开接口）"""
    kw = keyword.lower()
    suggestions = {"herbs": [], "peptides": [], "graph": []}

    # ── 药材建议（数据库优先 + 内存补充）──
    # 先从 DB 查询
    herbs_db = (await db.execute(
        select(TCMHerb.name_cn, TCMHerb.name_latin, TCMHerb.name_pinyin, TCMHerb.category)
        .where(TCMHerb.name_cn.ilike(f"%{keyword}%"))
        .limit(limit * 2)
    )).all()

    seen_herb_names = set()
    # 添加 DB 结果
    for row in herbs_db:
        name_cn = row[0] or ""
        if name_cn.lower() not in seen_herb_names and kw in name_cn.lower():
            suggestions["herbs"].append({
                "type": "herb",
                "label": name_cn,
                "sublabel": row[1] or "",
                "category": row[3] or "",
            })
            seen_herb_names.add(name_cn.lower())
            if len(suggestions["herbs"]) >= limit:
                break

    # 如果 DB 结果不足，从内存补充
    if len(suggestions["herbs"]) < limit:
        from ..services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE
        for h in TCMSP_HERB_DATABASE:
            if len(suggestions["herbs"]) >= limit:
                break
            name_cn = h.get("name_cn", "")
            if name_cn.lower() not in seen_herb_names and kw in name_cn.lower():
                suggestions["herbs"].append({
                    "type": "herb",
                    "label": name_cn,
                    "sublabel": h.get("name_latin", ""),
                    "category": h.get("category", ""),
                })
                seen_herb_names.add(name_cn.lower())

    # ── 活性肽建议（数据库优先 + 内存补充）──
    peptides_db = (await db.execute(
        select(BioactivePeptide.sequence, BioactivePeptide.source_protein, BioactivePeptide.activity_type)
        .where(
            (BioactivePeptide.sequence.ilike(f"%{keyword}%"))
            | (BioactivePeptide.source_protein.ilike(f"%{keyword}%"))
        )
        .limit(limit * 2)
    )).all()

    seen_peptide_seqs = set()
    # 添加 DB 结果
    for row in peptides_db:
        seq = row[0] or ""
        if seq.lower() not in seen_peptide_seqs and (kw in seq.lower() or kw in (row[1] or "").lower()):
            suggestions["peptides"].append({
                "type": "peptide",
                "label": seq,
                "sublabel": row[1] or "",
                "activity_type": row[2] or "",
            })
            seen_peptide_seqs.add(seq.lower())
            if len(suggestions["peptides"]) >= limit:
                break

    # 如果 DB 结果不足，从内存补充
    if len(suggestions["peptides"]) < limit:
        from ..services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
        for p in DFBP_PEPTIDE_DATABASE:
            if len(suggestions["peptides"]) >= limit:
                break
            seq = p.get("sequence", "")
            if seq.lower() not in seen_peptide_seqs and (kw in seq.lower() or kw in (p.get("source_protein") or "").lower()):
                suggestions["peptides"].append({
                    "type": "peptide",
                    "label": seq,
                    "sublabel": p.get("source_protein", ""),
                    "activity_type": p.get("activity_type", ""),
                })
                seen_peptide_seqs.add(seq.lower())

    # 知识图谱节点建议（保持原有逻辑）
    graph_result = await graph_service.search_nodes(kw, None, limit)
    suggestions["graph"] = [
        {"type": n.get("type", "node"), "label": n.get("node_label", ""), "sublabel": n.get("type", "")}
        for n in graph_result[:limit]
    ]

    return suggestions


@router.get("/cross-search", summary="交叉检索")
async def cross_database_search(
    herb_name: str = Query(..., min_length=1, description="药材名称"),
    db: AsyncSession = Depends(get_db_session),
):
    """
    交叉检索 — 根据药材名检索相关活性肽和化合物信息
    用于发现药材-食物蛋白-活性肽之间的潜在关联（公开接口）
    """
    # ── 数据库优先：查找目标药材 ──
    target_herb = None
    is_from_db = False

    herb_db = (await db.execute(
        select(TCMHerb).where(
            (TCMHerb.name_cn.ilike(f"%{herb_name}%"))
            | (TCMHerb.name_latin.ilike(f"%{herb_name}%"))
        ).limit(1)
    )).scalar_one_or_none()

    if herb_db:
        target_herb = {
            "name_cn": herb_db.name_cn or f"(ID:{herb_db.id})",
            "name_latin": herb_db.name_latin or "",
            "effects": herb_db.effects or "",
            "category": herb_db.category or "",
            "ob_percent": herb_db.ob_percent,
            "compounds": herb_db.compounds if isinstance(herb_db.compounds, list) else [],
        }
        is_from_db = True
    else:
        # Fallback: 从内存查找
        from ..services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE
        for h in TCMSP_HERB_DATABASE:
            if herb_name.lower() in h["name_cn"].lower() or h["name_cn"] == herb_name:
                target_herb = {
                    "name_cn": h["name_cn"],
                    "name_latin": h.get("name_latin", ""),
                    "effects": h.get("effects", ""),
                    "category": h.get("category", ""),
                    "ob_percent": h.get("ob_percent"),
                    "compounds": h.get("compounds", []),
                }
                break

    if not target_herb:
        raise HTTPException(404, detail=f"未找到药材: {herb_name}")

    # 获取药材的化合物列表
    compounds = target_herb["compounds"]

    # ── 活性肽匹配（数据库优先 + 内存补充）──
    peptides_db = (await db.execute(select(BioactivePeptide).limit(500))).scalars().all()
    use_peptide_db = len(peptides_db) > 0

    related_peptides = []
    herb_effects = (target_herb.get("effects") or "").lower()

    if use_peptide_db:
        # 使用 DB 数据
        for p in peptides_db:
            relevance_score = 0
            organism = (p.source_organism or "").lower()
            protein = (p.source_protein or "").lower()
            activity_type = (p.activity_type or "").lower()

            # 来源生物体相关性
            edible_keywords = ["plant", "food", "soybean", "milk", "egg", "fish", "meat", "rice", "wheat"]
            for kw in edible_keywords:
                if kw in organism:
                    relevance_score += 1

            # 功效关键词匹配
            if "antioxidant" in herb_effects and "antioxidant" in activity_type:
                relevance_score += 5
            if "immune" in herb_effects and "immunomodulatory" in activity_type:
                relevance_score += 5
            if "ace" in herb_effects and "ace" in activity_type:
                relevance_score += 5

            if relevance_score > 0:
                related_peptides.append({
                    **{"relevance_score": relevance_score},
                    "sequence": p.sequence,
                    "source_protein": p.source_protein,
                    "source_organism": p.source_organism,
                    "activity_type": p.activity_type,
                    "activity_value": p.activity_value,
                    "molecular_weight": p.molecular_weight,
                    "hydrolysis_enzyme": p.hydrolysis_enzyme,
                })
    else:
        # Fallback: 内存数据
        from ..services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
        for p in DFBP_PEPTIDE_DATABASE:
            relevance_score = 0
            organism = (p.get("source_organism") or "").lower()
            protein = (p.get("source_protein") or "").lower()

            # 来源生物体相关性
            edible_keywords = ["plant", "food", "soybean", "milk", "egg", "fish", "meat", "rice", "wheat"]
            for kw in edible_keywords:
                if kw in organism:
                    relevance_score += 1

            # 功效关键词匹配
            if "antioxidant" in herb_effects and "antioxidant" in (p.get("activity_type") or "").lower():
                relevance_score += 5
            if "immune" in herb_effects and "immunomodulatory" in (p.get("activity_type") or "").lower():
                relevance_score += 5
            if "ace" in herb_effects and "ace" in (p.get("activity_type") or "").lower():
                relevance_score += 5

            if relevance_score > 0:
                related_peptides.append({
                    **{"relevance_score": relevance_score},
                    "sequence": p.get("sequence"),
                    "source_protein": p.get("source_protein"),
                    "source_organism": p.get("source_organism"),
                    "activity_type": p.get("activity_type"),
                    "activity_value": p.get("activity_value"),
                    "molecular_weight": p.get("molecular_weight"),
                    "hydrolysis_enzyme": p.get("hydrolysis_enzyme"),
                })

    related_peptides.sort(key=lambda x: x["relevance_score"], reverse=True)

    return {
        "herb": {
            "name_cn": target_herb["name_cn"],
            "name_latin": target_herb["name_latin"],
            "effects": target_herb["effects"],
            "category": target_herb["category"],
            "ob_percent": target_herb["ob_percent"],
            "compound_count": len(compounds),
        },
        "compounds": compounds[:10],
        "related_peptides": related_peptides[:20],
        "match_summary": {
            "total_compounds": len(compounds),
            "matched_peptides": len(related_peptides),
            "high_relevance_peptides": len([p for p in related_peptides if p["relevance_score"] >= 5]),
        },
        "data_source": "database" if is_from_db else "memory_fallback",
    }


@router.get("/data-quality", summary="数据质量报告")
async def data_quality_report(
    db: AsyncSession = Depends(get_db_session),
):
    """数据质量评估报告 — 完整性、一致性、丰富度指标（公开接口）"""
    from datetime import datetime

    # ── 数据库优先：查询药材和活性肽数据 ──
    herbs_db = (await db.execute(select(TCMHerb))).scalars().all()
    peptides_db = (await db.execute(select(BioactivePeptide))).scalars().all()

    use_herb_db = len(herbs_db) > 0
    use_peptide_db = len(peptides_db) > 0

    # 选择数据源
    if use_herb_db:
        herbs_source = herbs_db
        is_herb_orm = True
        total_herbs = len(herbs_db)
    else:
        from ..services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE
        herbs_source = TCMSP_HERB_DATABASE
        is_herb_orm = False
        total_herbs = len(TCMSP_HERB_DATABASE)

    if use_peptide_db:
        peptides_source = peptides_db
        is_peptide_orm = True
        total_peptides = len(peptides_db)
    else:
        from ..services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
        peptides_source = DFBP_PEPTIDE_DATABASE
        is_peptide_orm = False
        total_peptides = len(DFBP_PEPTIDE_DATABASE)

    # ── 数据完整性评分（药材）──
    herb_fields = ["name_cn", "name_latin", "name_pinyin", "category", "effects", "ob_percent", "dl_value"]
    completeness_per_field = {}
    for field in herb_fields:
        filled = 0
        for h in herbs_source:
            if is_herb_orm:
                val = getattr(h, field, None)
            else:
                val = h.get(field)
            if val:
                filled += 1
        completeness_per_field[field] = {
            "filled": filled,
            "total": total_herbs,
            "rate": round(filled / max(total_herbs, 1) * 100, 1),
        }

    # ── 数据完整性评分（活性肽）──
    peptide_fields = ["sequence", "source_protein", "source_organism", "activity_type", "activity_value", "molecular_weight"]
    peptide_completeness = {}
    for field in peptide_fields:
        filled = 0
        for p in peptides_source:
            if is_peptide_orm:
                val = getattr(p, field, None)
            else:
                val = p.get(field)
            if val:
                filled += 1
        peptide_completeness[field] = {
            "filled": filled,
            "total": total_peptides,
            "rate": round(filled / max(total_peptides, 1) * 100, 1),
        }

    # ── 数据健康度指标（药材）──
    herb_health = {
        "with_ob": sum(1 for h in herbs_source if (h.ob_percent if is_herb_orm else h.get("ob_percent")) is not None),
        "with_dl": sum(1 for h in herbs_source if (h.dl_value if is_herb_orm else h.get("dl_value")) is not None),
        "with_compounds": sum(1 for h in herbs_source if len((h.compounds if isinstance(h.compounds, list) else []) if is_herb_orm else h.get("compounds", [])) > 0),
        "with_targets": sum(1 for h in herbs_source if len((h.targets if isinstance(h.targets, list) else []) if is_herb_orm else h.get("targets", [])) > 0),
        "with_diseases": sum(1 for h in herbs_source if len((h.diseases if isinstance(h.diseases, list) else []) if is_herb_orm else h.get("diseases", [])) > 0),
        "food_homology": sum(1 for h in herbs_source if (bool(h.is_food_homology) if is_herb_orm else h.get("is_food_homology"))),
        "avg_compounds": round(sum(len((h.compounds if isinstance(h.compounds, list) else []) if is_herb_orm else h.get("compounds", [])) for h in herbs_source) / max(total_herbs, 1), 1),
        "avg_targets": round(sum(len((h.targets if isinstance(h.targets, list) else []) if is_herb_orm else h.get("targets", [])) for h in herbs_source) / max(total_herbs, 1), 1),
    }

    # ── 数据健康度指标（活性肽）──
    peptide_health = {
        "has_activity_value": sum(1 for p in peptides_source if (p.activity_value if is_peptide_orm else p.get("activity_value"))),
        "has_molecular_weight": sum(1 for p in peptides_source if (p.molecular_weight if is_peptide_orm else p.get("molecular_weight"))),
        "has_enzyme_info": sum(1 for p in peptides_source if (p.hydrolysis_enzyme if is_peptide_orm else p.get("hydrolysis_enzyme"))),
        "ace_inhibitory_count": sum(1 for p in peptides_source if (p.activity_type if is_peptide_orm else p.get("activity_type")) == "ACE inhibitory"),
        "antioxidant_count": sum(1 for p in peptides_source if (p.activity_type if is_peptide_orm else p.get("activity_type")) == "Antioxidant"),
        "avg_seq_length": round(sum(len((p.sequence or "") if is_peptide_orm else p.get("sequence", "")) for p in peptides_source) / max(total_peptides, 1), 1),
        "avg_mw": round(sum((p.molecular_weight or 0) if is_peptide_orm else (p.get("molecular_weight") or 0) for p in peptides_source) / max(total_peptides, 1), 1),
    }

    # 综合质量分数
    herb_quality_score = round(
        (completeness_per_field.get("name_cn", {}).get("rate", 0) * 0.1 +
         completeness_per_field.get("ob_percent", {}).get("rate", 0) * 0.2 +
         completeness_per_field.get("effects", {}).get("rate", 0) * 0.15 +
         herb_health["with_compounds"] / max(total_herbs, 1) * 100 * 0.25 +
         herb_health["with_targets"] / max(total_herbs, 1) * 100 * 0.3), 1
    )
    peptide_quality_score = round(
        (peptide_completeness.get("sequence", {}).get("rate", 0) * 0.25 +
         peptide_completeness.get("activity_type", {}).get("rate", 0) * 0.2 +
         peptide_completeness.get("activity_value", {}).get("rate", 0) * 0.2 +
         peptide_health["has_enzyme_info"] / max(total_peptides, 1) * 100 * 0.15 +
         peptide_health["has_molecular_weight"] / max(total_peptides, 1) * 100 * 0.2), 1
    )

    return {
        "generated_at": datetime.now().isoformat(),
        "herb_data": {
            "total_records": total_herbs,
            "quality_score": herb_quality_score,
            "grade": "A" if herb_quality_score >= 85 else ("B" if herb_quality_score >= 70 else ("C" if herb_quality_score >= 50 else "D")),
            "field_completeness": completeness_per_field,
            "health_indicators": herb_health,
        },
        "peptide_data": {
            "total_records": total_peptides,
            "quality_score": peptide_quality_score,
            "grade": "A" if peptide_quality_score >= 85 else ("B" if peptide_quality_score >= 70 else ("C" if peptide_quality_score >= 50 else "D")),
            "field_completeness": peptide_completeness,
            "health_indicators": peptide_health,
        },
        "overall_score": round((herb_quality_score + peptide_quality_score) / 2, 1),
        "data_source": "database" if (use_herb_db or use_peptide_db) else "memory_fallback",
        "recommendations": _generate_recommendations(herb_quality_score, peptide_quality_score, herb_health, peptide_health, total_herbs, total_peptides),
    }


def _generate_recommendations(hqs, pqs, hh, ph, total_herbs=100, total_peptides=100):
    """基于质量指标生成优化建议"""
    recs = []
    if hqs < 80:
        recs.append("建议补充药材的拉丁名和拼音字段，提升基础数据完整度")
    if total_herbs > 0 and hh["with_compounds"] / total_herbs < 0.5:
        recs.append("部分药材缺少化合物数据，建议从 TCMSP 补充同步")
    if pqs < 75:
        recs.append("活性肽数据缺少部分关键字段（活性值/分子量），建议补充文献数据")
    if total_peptides > 0 and ph["has_enzyme_info"] / total_peptides < 0.3:
        recs.append("多数活性肽缺少水解酶信息，影响配方开发参考价值")
    if len(recs) == 0:
        recs.append("数据质量整体良好，可正常支持配方研发工作流")
    return recs

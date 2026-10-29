"""
统一搜索、数据同步与快照 API
"""
import logging

from fastapi import Depends, HTTPException, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ...models import BioactivePeptide, DataSnapshot, KnowledgeGraphNode, TCMHerb, User
from ...services.data_sources.dfbp_client import dfbp_service
from ...services.data_sources.graph_service import graph_service
from ...services.data_sources.tcmsp_client import tcmsp_service
from ..deps import get_current_user, get_db_session

# Shared router for search module.
from . import router

logger = logging.getLogger(__name__)

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
    query = query.where(KnowledgeGraphNode.name.ilike(like_pattern))
    count_query = count_query.where(KnowledgeGraphNode.name.ilike(like_pattern))

    if node_type:
        query = query.where(KnowledgeGraphNode.node_type == node_type)
        count_query = count_query.where(KnowledgeGraphNode.node_type == node_type)

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(KnowledgeGraphNode.name).limit(limit)
    )).scalars().all()

    # 数据库有结果直接返回
    if total > 0:
        return {
            "items": [
                {
                    "id": n.id,
                    "node_type": n.node_type,
                    "node_label": n.name,
                    "properties": n.properties,
                    "source_db": n.source_database,
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
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """跨数据源统一搜索 — 合并药材/肽/知识图谱/食品原料/零售产品的搜索结果"""
    from sqlalchemy import select as sa_select

    from app.models.external_data import MMIDHerb, TCMHerb
    from app.models.food_material import FoodMaterial
    from app.models.knowledge_graph import KGNode
    from app.models.retail_product import RetailProduct

    source_list = [s.strip() for s in sources.split(",") if s.strip()]
    results = []
    like_pattern = f"%{keyword}%"

    # 1. TCM 药材搜索
    if "herbs" in source_list:
        herbs = await db.execute(
            sa_select(TCMHerb).where(
                TCMHerb.name_cn.ilike(like_pattern)
            ).limit(limit)
        )
        for h in herbs.scalars().all():
            results.append({
                "source": "herb",
                "id": h.id,
                "name": h.name_cn or h.name_latin,
                "name_latin": h.name_latin,
                "category": h.category or "中药材",
                "score": 0.9,
                "extra": {
                    "ob_percent": h.ob_percent,
                    "dl_value": h.dl_value,
                    "is_food_homology": h.is_food_homology,
                },
            })

    # 2. MMID 药材
    if "mmid_herbs" in source_list:
        mmid_herbs = await db.execute(
            sa_select(MMIDHerb).where(
                MMIDHerb.name_cn.ilike(like_pattern)
            ).limit(limit)
        )
        for h in mmid_herbs.scalars().all():
            results.append({
                "source": "mmid_herb",
                "id": h.id,
                "name": h.name_cn,
                "category": "MMID药材",
                "score": 0.85,
            })

    # 3. 活性肽搜索
    if "peptides" in source_list:
        from app.models.external_data import BioactivePeptide
        peptides = await db.execute(
            sa_select(BioactivePeptide).where(
                BioactivePeptide.sequence.ilike(like_pattern) |
                BioactivePeptide.source_protein.ilike(like_pattern)
            ).limit(limit)
        )
        for p in peptides.scalars().all():
            results.append({
                "source": "peptide",
                "id": p.id,
                "name": p.sequence or f"ID:{p.id}",
                "category": "活性肽",
                "score": 0.8,
                "extra": {
                    "activity_type": p.activity_type,
                    "source_protein": p.source_protein,
                },
            })

    # 4. 食品原料搜索
    if "food_materials" in source_list:
        food_materials = await db.execute(
            sa_select(FoodMaterial).where(
                FoodMaterial.name_cn.ilike(like_pattern) |
                FoodMaterial.category.ilike(like_pattern)
            ).limit(limit)
        )
        for fm in food_materials.scalars().all():
            results.append({
                "source": "food_material",
                "id": fm.id,
                "name": fm.name_cn,
                "category": fm.category or "食品原料",
                "score": 0.85,
                "extra": {
                    "food_homology": fm.food_homology,
                    "toxicity_class": fm.toxicity_class,
                },
            })

    # 5. 零售产品搜索
    if "retail_products" in source_list:
        products = await db.execute(
            sa_select(RetailProduct).where(
                RetailProduct.product_name.ilike(like_pattern) |
                RetailProduct.brand.ilike(like_pattern)
            ).limit(limit)
        )
        for rp in products.scalars().all():
            results.append({
                "source": "retail_product",
                "id": rp.id,
                "name": rp.product_name,
                "category": rp.category or "零售产品",
                "score": 0.75,
                "extra": {
                    "brand": rp.brand,
                    "price": rp.price,
                    "rating": rp.avg_rating,
                    "allergens_tags": rp.allergens_tags or [],
                    "additives_tags": rp.additives_tags or [],
                    "ecoscore_grade": rp.ecoscore_grade,
                },
            })

    # 6. 知识图谱节点搜索
    if "graph" in source_list:
        graph_nodes = await db.execute(
            sa_select(KGNode).where(
                KGNode.node_label.ilike(like_pattern)
            ).limit(limit)
        )
        for node in graph_nodes.scalars().all():
            results.append({
                "source": "graph",
                "id": node.id,
                "name": node.node_label,
                "category": node.node_type or "知识图谱",
                "score": 0.7,
                "extra": node.properties or {},
            })

    # 按 score 降序排列
    results.sort(key=lambda x: x["score"], reverse=True)
    results = results[:limit]

    return {
        "keyword": keyword,
        "sources": source_list,
        "results": results,
        "total": len(results),
        "limit": limit,
    }


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
    from datetime import datetime

    # ── 1. 基础计数（优先从 PostgreSQL 查询）──
    herb_total_result = await db.execute(select(func.count()).select_from(TCMHerb))
    total_herbs = herb_total_result.scalar() or 0

    peptide_total_result = await db.execute(select(func.count()).select_from(BioactivePeptide))
    total_peptides = peptide_total_result.scalar() or 0

    # ── 2. 药材数据分析（PostgreSQL 聚合查询，避免全表加载）──
    herbs_count = await db.execute(select(func.count()).select_from(TCMHerb))
    use_herb_db = (herbs_count.scalar() or 0) > 0

    if use_herb_db:
        from sqlalchemy import text as sql_text

        # OB distribution (aggregate via CASE)
        ob_rows = await db.execute(sql_text("""
            SELECT
                CASE
                    WHEN ob_percent < 10 THEN '<10%'
                    WHEN ob_percent < 30 THEN '10-30%'
                    WHEN ob_percent < 50 THEN '30-50%'
                    WHEN ob_percent < 70 THEN '50-70%'
                    ELSE '>70%'
                END as bucket,
                COUNT(*) as cnt
            FROM tcm_herbs
            GROUP BY bucket ORDER BY cnt DESC
        """))
        ob_distribution = {"<10%": 0, "10-30%": 0, "30-50%": 0, "50-70%": 0, ">70%": 0}
        for row in ob_rows.fetchall():
            if row[0] in ob_distribution:
                ob_distribution[row[0]] = row[1]

        # DL distribution (aggregate via CASE)
        dl_rows = await db.execute(sql_text("""
            SELECT
                CASE
                    WHEN dl_value < 0.1 THEN '<0.1'
                    WHEN dl_value < 0.2 THEN '0.1-0.2'
                    WHEN dl_value < 0.3 THEN '0.2-0.3'
                    WHEN dl_value < 0.5 THEN '0.3-0.5'
                    ELSE '>0.5'
                END as bucket,
                COUNT(*) as cnt
            FROM tcm_herbs
            GROUP BY bucket ORDER BY cnt DESC
        """))
        dl_distribution = {"<0.1": 0, "0.1-0.2": 0, "0.2-0.3": 0, "0.3-0.5": 0, ">0.5": 0}
        for row in dl_rows.fetchall():
            if row[0] in dl_distribution:
                dl_distribution[row[0]] = row[1]

        # Category breakdown (aggregate GROUP BY)
        cat_rows = await db.execute(sql_text("""
            SELECT COALESCE(category, '未分类') as cat, COUNT(*) as cnt
            FROM tcm_herbs
            GROUP BY cat ORDER BY cnt DESC
        """))
        category_breakdown = {row[0]: row[1] for row in cat_rows.fetchall()}
        # 药食同源计数（从 TCMSP 数据库）
        fh_result = await db.execute(sql_text("SELECT COUNT(*) FROM tcm_herbs WHERE is_food_homology = true"))
        food_homology_count = fh_result.scalar() or 0
        high_ob_herbs = []
    else:
        # Fallback: 内存数据
        from ...services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE
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

            if ob < 10:
                ob_distribution["<10%"] += 1
            elif ob < 30:
                ob_distribution["10-30%"] += 1
            elif ob < 50:
                ob_distribution["30-50%"] += 1
            elif ob < 70:
                ob_distribution["50-70%"] += 1
            else:
                ob_distribution[">70%"] += 1

            if dl < 0.1:
                dl_distribution["<0.1"] += 1
            elif dl < 0.2:
                dl_distribution["0.1-0.2"] += 1
            elif dl < 0.3:
                dl_distribution["0.2-0.3"] += 1
            elif dl < 0.5:
                dl_distribution["0.3-0.5"] += 1
            else:
                dl_distribution[">0.5"] += 1

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

    # ── 3. 活性肽数据分析（PostgreSQL 聚合查询，避免全量加载）──
    activity_type_result = await db.execute(
        select(BioactivePeptide.activity_type, func.count().label('cnt'))
        .where(BioactivePeptide.activity_type.isnot(None))
        .group_by(BioactivePeptide.activity_type)
        .order_by(func.count().desc())
    )
    activity_type_breakdown = {row[0]: row[1] for row in activity_type_result.fetchall()}
    # total_peptides 已在上方从全表 count 查询获取 (line 381)，此处不覆盖

    # seq_length distribution via raw SQL CASE
    seq_len_rows = await db.execute(text("""
        SELECT
            CASE
                WHEN length(sequence) <= 2 THEN '二肽(2)'
                WHEN length(sequence) <= 3 THEN '三肽(3)'
                WHEN length(sequence) <= 4 THEN '四肽(4)'
                WHEN length(sequence) <= 5 THEN '五肽(5)'
                WHEN length(sequence) <= 6 THEN '六肽(6)'
                WHEN length(sequence) <= 7 THEN '七肽(7)'
                WHEN length(sequence) <= 8 THEN '八肽(8)'
                ELSE '九肽以上(9+)'
            END as bucket,
            COUNT(*) as cnt
        FROM bioactive_peptides
        WHERE activity_type IS NOT NULL
        GROUP BY bucket
        ORDER BY cnt DESC
    """))
    seq_len_distribution = {"二肽(2)": 0, "三肽(3)": 0, "四肽(4)": 0, "五肽(5)": 0,
                            "六肽(6)": 0, "七肽(7)": 0, "八肽(8)": 0, "九肽以上(9+)": 0}
    for row in seq_len_rows.fetchall():
        bucket, cnt = row[0], row[1]
        if bucket in seq_len_distribution:
            seq_len_distribution[bucket] = cnt

    # enzyme & organism breakdown via raw SQL
    enzyme_rows = await db.execute(text("""
        SELECT hydrolysis_enzyme, COUNT(*) as cnt
        FROM bioactive_peptides
        WHERE activity_type IS NOT NULL
        GROUP BY hydrolysis_enzyme ORDER BY cnt DESC LIMIT 6
    """))
    enzyme_breakdown = {row[0] or "未知": row[1] for row in enzyme_rows.fetchall()}

    organism_rows = await db.execute(text("""
        SELECT source_organism, COUNT(*) as cnt
        FROM bioactive_peptides
        WHERE activity_type IS NOT NULL
        GROUP BY source_organism ORDER BY cnt DESC LIMIT 6
    """))
    source_organism_breakdown = {row[0] or "未知": row[1] for row in organism_rows.fetchall()}

    # high activity peptides (ACE inhibitory, IC50 < 1.0) — use LIMIT for pagination
    high_act_rows = await db.execute(text("""
        SELECT sequence, activity_value, activity_unit, source_protein, molecular_weight, hydrolysis_enzyme
        FROM bioactive_peptides
        WHERE activity_type = 'ACE inhibitory'
          AND activity_value IS NOT NULL
          AND CAST(activity_value AS FLOAT) < 1.0
        ORDER BY CAST(activity_value AS FLOAT) ASC
        LIMIT 20
    """))
    high_activity_peptides = []
    for row in high_act_rows.fetchall():
        try:
            av = float(row[1])
            if av < 1.0:
                high_activity_peptides.append({
                    "sequence": row[0] or "",
                    "activity_value": row[1],
                    "activity_unit": row[2] or "μM",
                    "source_protein": row[3] or "",
                    "molecular_weight": row[4] or 0,
                    "hydrolysis_enzyme": row[5] or "",
                })
        except (ValueError, TypeError):
            pass
    use_peptide_db = True

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


# ── 搜索建议（自动补全）──────────────────────
from pydantic import BaseModel, Field  # noqa: E402


class SearchSuggestRequest(BaseModel):
    """搜索建议请求体"""
    query: str = Field(..., min_length=1, max_length=100)
    limit: int = Field(10, ge=1, le=20)
    search_types: list[str] = Field(
        default_factory=lambda: ["herbs", "peptides", "food_materials", "retail_products"],
    )


@router.post("/search/suggest", summary="搜索建议（自动补全）")
async def search_suggest(
    body: SearchSuggestRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """基于本地库为搜索框提供自动补全建议（药材/活性肽/食品原料/零售产品）。"""
    from app.models.retail_product import RetailProduct

    keyword = body.query.strip()
    limit = body.limit
    if not keyword:
        return {"suggestions": []}

    like = f"%{keyword}%"
    suggestions: list[dict] = []
    wanted = set(body.search_types)

    # 零售产品（市售产品自动补全）
    if "retail_products" in wanted:
        try:
            rows = (await db.execute(
                select(RetailProduct.id, RetailProduct.product_name, RetailProduct.brand)
                .where(
                    RetailProduct.product_name.ilike(like)
                    | RetailProduct.brand.ilike(like)
                    | RetailProduct.category.ilike(like)
                )
                .order_by(RetailProduct.data_quality.desc())
                .limit(limit)
            )).all()
            for row in rows:
                name = row[1] or ""
                brand = row[2] or ""
                suggestions.append({
                    "text": name if name else brand,
                    "type": "retail_product",
                    "score": 0.98 if name.lower().startswith(keyword.lower()) else 0.9,
                    "extra": {"brand": brand, "id": row[0]},
                })
        except Exception as e:  # noqa: BLE001
            logger.warning("[SearchSuggest] retail_products 查询失败: %s", e)

    # 药材（TCMHerb 名称）
    if "herbs" in wanted and len(suggestions) < limit:
        try:
            rows = (await db.execute(
                select(TCMHerb.name_cn)
                .where(TCMHerb.name_cn.ilike(like))
                .order_by(TCMHerb.name_cn)
                .limit(limit - len(suggestions))
            )).scalars().all()
            for name in rows:
                suggestions.append({
                    "text": name,
                    "type": "herb",
                    "score": 0.95 if name.lower().startswith(keyword.lower()) else 0.85,
                })
        except Exception as e:  # noqa: BLE001
            logger.warning("[SearchSuggest] herbs 查询失败: %s", e)

    # 活性肽（序列片段）
    if "peptides" in wanted and len(suggestions) < limit:
        try:
            rows = (await db.execute(
                select(BioactivePeptide.sequence)
                .where(BioactivePeptide.sequence.ilike(like))
                .limit(limit - len(suggestions))
            )).scalars().all()
            for seq in rows:
                suggestions.append({
                    "text": seq[:40],
                    "type": "peptide",
                    "score": 0.8,
                })
        except Exception as e:  # noqa: BLE001
            logger.warning("[SearchSuggest] peptides 查询失败: %s", e)

    return {"suggestions": suggestions[:limit]}


import logging  # noqa: E402

logger = logging.getLogger(__name__)
logger.info("search module loaded")

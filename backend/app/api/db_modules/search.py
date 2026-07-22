"""
统一搜索、数据同步与快照 API
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db_session, get_current_user
from ...models import DataSnapshot, User, TCMHerb, BioactivePeptide, KnowledgeGraphNode
from ...services.data_sources.tcmsp_client import tcmsp_service
from ...services.data_sources.dfbp_client import dfbp_service
from ...services.data_sources.graph_service import graph_service

"""
Shared router for search module.
"""
from . import router

import logging
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
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """跨数据源统一搜索 — 合并药材/肽/知识图谱/食品原料/零售产品的搜索结果"""
    from sqlalchemy import select as sa_select
    from app.models.external_data import TCMHerb, MMIDHerb
    from app.models.retail_product import RetailProduct
    from app.models.food_material import FoodMaterial
    from app.models.knowledge_graph import KGNode

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
                "name_latin": h.herb_name_latin,
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

    # ── 2. 药材数据分析（PostgreSQL 优先，内存 fallback）──
    # 使用聚合查询避免全表加载（防止内存溢出）
    herbs_db = (await db.execute(select(TCMHerb).order_by(TCMHerb.id).limit(5000))).scalars().all()
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
    peptides_db = (await db.execute(select(BioactivePeptide).limit(5000))).scalars().all()
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
        from ...services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
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


logger = __import__("logging").getLogger(__name__)
logger.info("search module loaded")

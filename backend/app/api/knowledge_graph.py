"""
知识图谱增强分析 API

提供图谱构建、图论算法分析、智能推荐等端点。

端点列表:
- POST /databases/knowledge-graph/build          — 从TCMSP重建知识图谱
- GET  /databases/knowledge-graph/analytics/centrality — 中心性计算
- GET  /databases/knowledge-graph/analytics/communities — 社区检测
- GET  /databases/knowledge-graph/analytics/kcore       — K-Core分解
- GET  /databases/knowledge-graph/recommend/herb/{herb_name}   — 药材相似推荐
- GET  /databases/knowledge-graph/recommend/similar/{node_type}/{node_label} — 通用相似推荐
- GET  /databases/knowledge-graph/bridges         — 关键桥梁节点
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .deps import get_db_session, get_current_active_user
from ..models.user_model import User
from ..services.kg.graph_engine import KnowledgeGraphEngine
from ..models.knowledge_graph import KGNode

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/databases/knowledge-graph", tags=["知识图谱分析"])

# 全局引擎实例（无状态，线程安全）
engine = KnowledgeGraphEngine()


# ═══════════════════════════════════════════
# 图谱构建
# ═══════════════════════════════════════════

@router.post("/build", summary="从TCMSP数据构建/重建知识图谱")
async def build_knowledge_graph(
    rebuild: bool = Query(False, description="是否全量重建（清空后重建）"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """触发从TCMSP数据库重建知识图谱

    数据流:
    tcm_herbs → herb节点 → compound节点(contains边) → target节点(targets边) → disease节点(treats边)

    使用UPSERT策略，已存在的节点会更新属性而非重复创建。
    """
    try:
        options = {
            "rebuild": rebuild,
            "batch_size": 200,
        }
        stats = await engine.build_from_tcmsp(db, options=options)

        return {
            "success": True,
            "message": f"图谱构建完成: {stats['herbs_created']}药材 + "
                       f"{stats['compounds_created']}化合物 + "
                       f"{stats['targets_created']}靶点 + "
                       f"{stats['diseases_created']}疾病",
            "stats": stats,
        }
    except Exception as e:
        logger.error("知识图谱构建失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="服务器内部错误，请稍后重试",
        )


# ═══════════════════════════════════════════
# 中心性分析
# ═══════════════════════════════════════════

@router.get("/analytics/centrality", summary="节点中心性分析")
async def compute_centrality(
    mode: str = Query("pageRank", description="算法类型: pageRank / betweenness / closeness"),
    node_type: Optional[str] = Query(None, description="节点类型过滤 (herb/compound/target/disease)"),
    edge_type: Optional[str] = Query(None, description="边类型过滤"),
    limit: int = Query(20, ge=1, le=200, description="返回top-N结果"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """计算节点的中心性指标

    - pageRank: PageRank算法，衡量节点的重要性
    - betweenness: 介数中心性，衡量节点作为"桥梁"的能力
    - closeness: 接近中心性，衡量节点到其他节点的平均距离
    """
    valid_modes = {"pagerank", "betweenness", "closeness"}
    if mode.lower() not in valid_modes:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "INVALID_MODE",
                "message": f"不支持的算法模式: {mode}, 可选: {valid_modes}",
            },
        )

    # 加载图谱数据
    node_types = [node_type] if node_type else None
    edge_types = [edge_type] if edge_type else None
    nodes, edges = await engine.load_graph_from_db(db, node_types=node_types, edge_types=edge_types)

    if not nodes:
        return {
            "mode": mode,
            "total_nodes": 0,
            "results": [],
            "message": "图谱中暂无数据，请先执行 /build 构建图谱",
        }

    # 根据模式选择算法
    mode_lower = mode.lower()
    if mode_lower == "pagerank":
        scores = engine.compute_pagerank(nodes, edges)
        metric_label = "pagerank_score"
    elif mode_lower == "betweenness":
        scores = engine.compute_betweenness(nodes, edges)
        metric_label = "betweenness_score"
    elif mode_lower == "closeness":
        scores = engine.compute_closeness(nodes, edges)
        metric_label = "closeness_score"

    # 排序并取top-N
    sorted_results = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:limit]

    # 补充节点信息
    node_lookup = {n["id"]: n for n in nodes}
    results = []
    for nid, score in sorted_results:
        node_info = node_lookup.get(nid, {})
        results.append({
            "node_id": nid,
            "node_type": node_info.get("node_type", "unknown"),
            "node_label": node_info.get("node_label", str(nid)),
            metric_label: round(score, 8),
        })

    return {
        "mode": mode,
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "returned": len(results),
        "results": results,
    }


# ═══════════════════════════════════════════
# 社区检测
# ═══════════════════════════════════════════

@router.get("/analytics/communities", summary="Louvain社区检测")
async def detect_communities(
    algorithm: str = Query("louvain", description="社区检测算法: louvain"),
    node_type: Optional[str] = Query(None, description="节点类型过滤"),
    limit_per_community: int = Query(10, ge=1, le=50, description="每个社区返回的最大节点数"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """执行Louvain社区检测算法

    将图谱中的节点划分为若干社区，社区内连接紧密，社区间连接稀疏。
    返回每个社区的节点列表和统计信息。
    """
    if algorithm.lower() != "louvain":
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_ALGORITHM", "message": "当前仅支持 louvain 算法"},
        )

    node_types = [node_type] if node_type else None
    nodes, edges = await engine.load_graph_from_db(db, node_types=node_types)

    if not nodes:
        return {
            "algorithm": algorithm,
            "total_communities": 0,
            "communities": [],
            "message": "图谱中暂无数据",
        }

    communities = engine.detect_communities_louvain(nodes, edges)

    # 按社区分组
    community_groups: Dict[int, List[int]] = defaultdict(list)
    for nid, comm_id in communities.items():
        community_groups[comm_id].append(nid)

    node_lookup = {n["id"]: n for n in nodes}

    # 构建返回数据
    community_list = []
    for comm_id in sorted(community_groups.keys()):
        member_ids = community_groups[comm_id]
        members = [
            {
                "node_id": mid,
                "node_type": node_lookup.get(mid, {}).get("node_type", "unknown"),
                "node_label": node_lookup.get(mid, {}).get("node_label", str(mid)),
            }
            for mid in member_ids[:limit_per_community]
        ]

        # 统计社区内各类型的数量
        type_counts: Dict[str, int] = {}
        for mid in member_ids:
            nt = node_lookup.get(mid, {}).get("node_type", "unknown")
            type_counts[nt] = type_counts.get(nt, 0) + 1

        community_list.append({
            "community_id": comm_id,
            "size": len(member_ids),
            "type_distribution": type_counts,
            "members": members,
            "showing": min(len(member_ids), limit_per_community),
        })

    # 按社区大小排序
    community_list.sort(key=lambda c: c["size"], reverse=True)

    return {
        "algorithm": algorithm,
        "total_nodes": len(nodes),
        "total_communities": len(community_list),
        "communities": community_list,
        "modularity_hint": f"共{len(communities)}个社区，最大社区含{community_list[0]['size'] if community_list else 0}节点",
    }


# ═══════════════════════════════════════════
# K-Core 分解
# ═══════════════════════════════════════════

@router.get("/analytics/kcore", summary="K-Core核心分解")
async def kcore_decomposition(
    k: Optional[int] = Query(None, ge=1, description="K值（不传则返回所有节点的coreness值）"),
    node_type: Optional[str] = Query(None, description="节点类型过滤"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """K-Core分解分析

    K-Core是图中最小度数>=k的最大子图。
    不指定k时返回每个节点的coreness值。
    指定k时返回属于该核心的节点集合。
    """
    node_types = [node_type] if node_type else None
    nodes, edges = await engine.load_graph_from_db(db, node_types=node_types)

    if not nodes:
        return {"k": k, "total_nodes": 0, "results": [], "message": "图谱中暂无数据"}

    result = engine.decompose_kcore(nodes, edges, k=k)
    node_lookup = {n["id"]: n for n in nodes}

    if k is not None:
        # 返回核心子图的节点
        core_node_ids = result if isinstance(result, set) else set()
        core_nodes = [
            {
                "node_id": nid,
                "node_type": node_lookup.get(nid, {}).get("node_type", "unknown"),
                "node_label": node_lookup.get(nid, {}).get("node_label", str(nid)),
                "coreness": k,
            }
            for nid in core_node_ids
        ]

        return {
            "k": k,
            "total_nodes": len(nodes),
            "core_size": len(core_nodes),
            "results": core_nodes,
        }
    else:
        # 返回所有节点的coreness
        coreness_result = result if isinstance(result, dict) else {}
        sorted_coreness = sorted(coreness_result.items(), key=lambda x: x[1], reverse=True)

        return {
            "k": None,
            "total_nodes": len(nodes),
            "max_coreness": max(coreness_result.values()) if coreness_result else 0,
            "results": [
                {
                    "node_id": nid,
                    "node_type": node_lookup.get(nid, {}).get("node_type", "unknown"),
                    "node_label": node_lookup.get(nid, {}).get("node_label", str(nid)),
                    "coreness": c,
                }
                for nid, c in sorted_coreness
            ],
        }


# ═══════════════════════════════════════════
# 相似药材推荐
# ═══════════════════════════════════════════

@router.get("/recommend/herb/{herb_name}", summary="基于图谱的相似药材推荐")
async def recommend_similar_herbs(
    herb_name: str,
    top_n: int = Query(10, ge=1, le=50, description="返回top-N相似药材"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """根据图谱拓扑结构推荐与目标药材相似的药材

    推荐依据（加权综合评分）:
    1. 共同化合物Jaccard相似度 (40%)
    2. 共同靶点覆盖度 (35%)
    3. 二跳路径重叠度 (25%)
    """
    # 查找目标药材节点
    result = await db.execute(
        select(KGNode).where(
            KGNode.node_type == "herb",
            KGNode.node_label.ilike(f"%{herb_name}%"),
        ).limit(1)
    )
    target_node = result.scalar_one_or_none()

    if not target_node:
        raise HTTPException(
            status_code=404,
            detail={"error": "HERB_NOT_FOUND", "message": f"未找到药材: {herb_name}"},
        )

    # 加载全图谱
    nodes, edges = await engine.load_graph_from_db(db)

    if not nodes or not edges:
        return {
            "target_herb": herb_name,
            "target_id": target_node.id,
            "recommendations": [],
            "message": "图谱数据不足，请先执行 /build",
        }

    recommendations = engine.recommend_similar_herbs(target_node.id, nodes, edges, top_n=top_n)

    # 补充药材名称
    node_lookup = {n["id"]: n for n in nodes}
    enriched_recs = []
    for rec in recommendations:
        herb_info = node_lookup.get(rec["herb_id"], {})
        enriched_recs.append({
            **rec,
            "herb_name": herb_info.get("node_label", f"herb_{rec['herb_id']}"),
        })

    return {
        "target_herb": target_node.node_label,
        "target_id": target_node.id,
        "total_candidates": len(recommendations),
        "returned": len(enriched_recs),
        "recommendations": enriched_recs,
    }


# ═══════════════════════════════════════════
# 通用相似节点推荐
# ═══════════════════════════════════════════

@router.get("/recommend/similar/{node_type}/{node_label:path}", summary="通用相似节点推荐")
async def recommend_similar_nodes(
    node_type: str,
    node_label: str,
    top_n: int = Query(10, ge=1, le=50, description="返回top-N相似节点"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """基于一跳邻居Jaccard相似度的通用节点推荐

    支持任意节点类型的相似度计算和推荐。
    通过比较两个节点邻居集合的重叠程度来衡量相似性。
    """
    # 查找目标节点
    result = await db.execute(
        select(KGNode).where(
            KGNode.node_type == node_type,
            KGNode.node_label.ilike(f"%{node_label}%"),
        ).limit(1)
    )
    target_node = result.scalar_one_or_none()

    if not target_node:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "NODE_NOT_FOUND",
                "message": f"未找到节点: type={node_type}, label={node_label}",
            },
        )

    # 加载图谱
    nodes, edges = await engine.load_graph_from_db(db, node_types=[node_type])

    if not nodes or not edges:
        return {
            "target": {"type": node_type, "label": node_label},
            "similar_nodes": [],
            "message": "图谱数据不足",
        }

    # 构建邻接表
    node_ids = {n["id"] for n in nodes}
    adj_out: Dict[int, Set[int]] = defaultdict(set)
    adj_in: Dict[int, Set[int]] = defaultdict(set)
    for edge in edges:
        s, t = edge["source"], edge["target"]
        if s in node_ids and t in node_ids:
            adj_out[s].add(t)
            adj_in[t].add(s)

    # 获取目标节点的全部邻居（出+入）
    target_neighbors = adj_out.get(target_node.id, set()) | adj_in.get(target_node.id, set())

    # 计算与其他同类节点的Jaccard相似度
    similarities: List[Dict[str, Any]] = []

    for candidate in nodes:
        cid = candidate["id"]
        if cid == target_node.id:
            continue

        cand_neighbors = adj_out.get(cid, set()) | adj_in.get(cid, set())

        if target_neighbors or cand_neighbors:
            intersection = len(target_neighbors & cand_neighbors)
            union = len(target_neighbors | cand_neighbors)
            jaccard = intersection / union if union > 0 else 0.0
        else:
            jaccard = 0.0

        if jaccard > 0:
            similarities.append({
                "node_id": cid,
                "node_type": candidate.get("node_type", "unknown"),
                "node_label": candidate.get("node_label", str(cid)),
                "jaccard_similarity": round(jaccard, 6),
                "common_neighbors": intersection,
            })

    similarities.sort(key=lambda x: x["jaccard_similarity"], reverse=True)

    return {
        "target": {
            "id": target_node.id,
            "type": node_type,
            "label": target_node.node_label,
        },
        "total_compared": len(nodes) - 1,
        "returned": len(similarities[:top_n]),
        "similar_nodes": similarities[:top_n],
    }


# ═══════════════════════════════════════════
# 关键桥梁节点
# ═══════════════════════════════════════════

@router.get("/bridges", summary="识别关键桥梁节点")
async def get_key_bridges(
    top_n: int = Query(20, ge=1, le=100, description="返回top-N桥梁节点"),
    node_type: Optional[str] = Query(None, description="节点类型过滤"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """识别知识图谱中的关键桥梁节点

    桥梁节点是那些在图谱中起"承上启下"作用的关键节点，
    移除它们会导致图谱连通性显著下降。

    综合评估指标:
    - 介数中心性 (50%): 节点在最短路径中的出现频率
    - 跨社区连接数 (30%): 连接不同社区的边数
    - 度数 (20%): 节点的连接总数
    """
    node_types = [node_type] if node_type else None
    nodes, edges = await engine.load_graph_from_db(db, node_types=node_types)

    if not nodes or not edges:
        return {
            "total_bridges": 0,
            "bridges": [],
            "message": "图谱数据不足，请先执行 /build",
        }

    bridges = engine.find_key_bridges(nodes, edges, top_n=top_n)

    # 补充节点标签信息
    node_lookup = {n["id"]: n for n in nodes}
    enriched_bridges = []
    for b in bridges:
        info = node_lookup.get(b["node_id"], {})
        enriched_bridges.append({
            **b,
            "node_type": info.get("node_type", "unknown"),
            "node_label": info.get("node_label", f"node_{b['node_id']}"),
        })

    return {
        "total_nodes_analyzed": len(nodes),
        "total_bridges_returned": len(enriched_bridges),
        "bridges": enriched_bridges,
    }

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

import asyncio
import hashlib
import json
import logging
import time
from collections import defaultdict  # A-27：detect_communities 用到，原先漏导入 → 恒定 500
from typing import Any, Dict, List, Optional, Set  # A-27：Set 亦被用到，原先漏导入

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import (  # or_: /nodes/{id}/neighbors 与 /subgraph 用到，原漏导入 → NameError 500
    or_,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import async_session_factory
from ..core.performance.task_queue import TaskPriority, get_task_queue
from ..core.plans import require_plan
from ..models.knowledge_graph import KGNode
from ..models.user_model import User
from ..services.kg.graph_engine import KnowledgeGraphEngine
from .deps import get_db_session

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
    current_user: User = Depends(require_plan("knowledge_graph")),  # 变更操作：强制认证
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
    current_user: User = Depends(require_plan("knowledge_graph")),
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
    # 图谱割裂修复②a：按实测重划同步/异步边界。纯Python引擎在B表全谱(14749节点)实测——
    # PageRank 1.63s(同步OK)；closeness 全对BFS >6min、betweenness ~6min、kcore 34s 同步均扛不住。
    # 故仅 pageRank 切 B表全谱；closeness/betweenness 守卫回退 memory 小图 + 提示，待②b 异步化。
    mode_lower_pre = mode.lower()
    if mode_lower_pre == "pagerank":
        nodes, edges = await engine.load_graph(db, source="btable", node_types=node_types, edge_types=edge_types)
        source_used = "btable"
        source_note = None
    else:
        # closeness / betweenness：同步扛不住(>6min)，回退 memory 小图 + 提示
        nodes, edges = await engine.load_graph(db, source="memory", node_types=node_types, edge_types=edge_types)
        source_used = "memory"
        source_note = f"{mode} 在 B表全谱(14749节点)纯Python同步实测约6分钟以上会超时，已回退内存小图；全谱 {mode} 需异步架构(规划中)"

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
        "source": source_used,
        **({"note": source_note} if source_note else {}),
        "results": results,
    }


# ═══════════════════════════════════════════
# 异步分析任务（图谱割裂修复②b-1：betweenness 试点）
# ═══════════════════════════════════════════
#
# betweenness 在 B表全谱(14749节点/240344边)纯Python实测 ~161s，同步必超时。
# 复用现有 AsyncTaskQueue（asyncio内存队列，main.py 已 start）+ Redis 结果缓存。
# 链路：POST 提交→返回 task_id → 前端 GET /core/tasks/{task_id} 轮询 → done 取结果。
# 缓存：key=算法+图指纹(节点/边数+采样)，TTL 24h，命中直接返回免重算。

_KG_BETWEENNESS_CACHE_TTL = 86400  # 24h

# 进程内回退缓存（Redis 未启用时用；生产 USE_REDIS=true 走 Redis 跨进程共享）
_kg_betweenness_memcache: Dict[str, Any] = {}
_kg_betweenness_memcache_ts: Dict[str, float] = {}


def _kg_betweenness_cache_key(node_count: int, edge_count: int, sample_size: Optional[int]) -> str:
    """图指纹缓存键：图规模+采样变化时自动失效。"""
    raw = f"btable:{node_count}:{edge_count}:sample={sample_size}"
    fp = hashlib.sha1(raw.encode()).hexdigest()[:16]
    return f"rmfood:kg:betweenness:{fp}"


async def _kg_get_cached_betweenness(key: str) -> Optional[Dict[str, Any]]:
    try:
        from ..core.distributed.redis_client import get_redis
        redis = await get_redis()
        if redis is not None:
            raw = await redis.get(key)
            return json.loads(raw) if raw else None
    except Exception as e:  # Redis 故障不阻断，回退内存
        logger.warning(f"betweenness Redis 缓存读取失败(回退内存): {e}")
    # 内存回退
    ts = _kg_betweenness_memcache_ts.get(key)
    if ts and (time.time() - ts) < _KG_BETWEENNESS_CACHE_TTL and key in _kg_betweenness_memcache:
        return _kg_betweenness_memcache[key]
    return None


async def _kg_set_cached_betweenness(key: str, payload: Dict[str, Any]) -> None:
    try:
        from ..core.distributed.redis_client import get_redis
        redis = await get_redis()
        if redis is not None:
            await redis.set(key, json.dumps(payload, ensure_ascii=False), ex=_KG_BETWEENNESS_CACHE_TTL)
            return
    except Exception as e:
        logger.warning(f"betweenness Redis 缓存写入失败(回退内存): {e}")
    # 内存回退（只留最近一份，避免内存膨胀）
    _kg_betweenness_memcache.clear()
    _kg_betweenness_memcache_ts.clear()
    _kg_betweenness_memcache[key] = payload
    _kg_betweenness_memcache_ts[key] = time.time()


async def _run_betweenness_task(
    node_count: int, edge_count: int, sample_size: Optional[int], cache_key: str
) -> Dict[str, Any]:
    """异步任务体：加载B表→线程池算betweenness→缓存→返回 top 结果。

    在 AsyncTaskQueue worker 协程中运行；自身开独立 DB session（不复用请求 session）。
    compute_betweenness 是同步CPU密集，用 run_in_executor 丢线程池避免阻塞事件循环。
    """
    # 缓存命中（提交后到真正执行间可能已被其它请求算好）
    cached = await _kg_get_cached_betweenness(cache_key)
    if cached is not None:
        return {**cached, "cached": True}

    eng = KnowledgeGraphEngine()
    async with async_session_factory() as db:
        nodes, edges = await eng.load_graph_from_btable(db)

    if not nodes:
        return {"mode": "betweenness", "total_nodes": 0, "results": [], "message": "图谱为空"}

    loop = asyncio.get_running_loop()
    scores = await loop.run_in_executor(
        None, lambda: eng.compute_betweenness(nodes, edges, sample_size=sample_size)
    )

    node_lookup = {n["id"]: n for n in nodes}
    sorted_items = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    results = [
        {
            "node_id": nid,
            "node_type": node_lookup.get(nid, {}).get("node_type", "unknown"),
            "node_label": node_lookup.get(nid, {}).get("node_label", str(nid)),
            "betweenness_score": round(score, 8),
        }
        for nid, score in sorted_items
    ]
    payload = {
        "mode": "betweenness",
        "source": "btable",
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "sample_size": sample_size,
        "results": results,  # 全量排序，前端按 limit 取
    }
    await _kg_set_cached_betweenness(cache_key, payload)
    return {**payload, "cached": False}


@router.post("/analytics/betweenness/async", summary="介数中心性(异步，B表全谱)")
async def betweenness_async(
    limit: int = Query(20, ge=1, le=200, description="返回top-N"),
    sample_size: Optional[int] = Query(None, ge=50, le=5000, description="采样源节点数(默认自动500)"),
    current_user: User = Depends(require_plan("knowledge_graph")),
) -> Dict[str, Any]:
    """提交 betweenness 异步任务，立即返回 task_id。

    B表全谱(14749节点)纯Python实测~161s，同步超时，故走 AsyncTaskQueue。
    前端用返回的 task_id 轮询 GET /api/v1/core/tasks/{task_id} 取结果。
    结果缓存 Redis 24h（图规模/采样不变即命中）。
    """
    # 用图规模做缓存键（提交前快速判定，避免重复提交已缓存任务）
    cache_key = _kg_betweenness_cache_key(14749, 240344, sample_size)  # 规模指纹(稳定)
    cached = await _kg_get_cached_betweenness(cache_key)
    if cached is not None:
        return {
            "success": True,
            "mode": "betweenness",
            "cached": True,
            "task_id": None,
            "status": "done",
            "result": {**cached, "results": cached.get("results", [])[:limit]},
        }

    queue = get_task_queue()
    task_id = await queue.submit(
        func=_run_betweenness_task,
        args=(14749, 240344, sample_size, cache_key),
        priority=TaskPriority.HIGH,
        timeout=900,  # 161s 实测，留足余量
        metadata={"algorithm": "betweenness", "source": "btable"},
    )
    return {"success": True, "mode": "betweenness", "cached": False, "task_id": task_id, "status": "pending", "poll": f"/api/v1/core/tasks/{task_id}"}


# ── 通用异步分析缓存（②b-2：communities/kcore 复用②b-1 模式）──
_KG_ASYNC_CACHE_TTL = 86400  # 24h
_kg_async_memcache: Dict[str, Any] = {}
_kg_async_memcache_ts: Dict[str, float] = {}


def _kg_async_cache_key(algo: str, node_count: int, edge_count: int, extra: str = "") -> str:
    raw = f"{algo}:btable:{node_count}:{edge_count}:{extra}"
    fp = hashlib.sha1(raw.encode()).hexdigest()[:16]
    return f"rmfood:kg:{algo}:{fp}"


async def _kg_get_cached(key: str) -> Optional[Dict[str, Any]]:
    try:
        from ..core.distributed.redis_client import get_redis
        redis = await get_redis()
        if redis is not None:
            raw = await redis.get(key)
            return json.loads(raw) if raw else None
    except Exception as e:
        logger.warning(f"异步分析 Redis 缓存读取失败(回退内存): {e}")
    ts = _kg_async_memcache_ts.get(key)
    if ts and (time.time() - ts) < _KG_ASYNC_CACHE_TTL and key in _kg_async_memcache:
        return _kg_async_memcache[key]
    return None


async def _kg_set_cached(key: str, payload: Dict[str, Any]) -> None:
    try:
        from ..core.distributed.redis_client import get_redis
        redis = await get_redis()
        if redis is not None:
            await redis.set(key, json.dumps(payload, ensure_ascii=False), ex=_KG_ASYNC_CACHE_TTL)
            return
    except Exception as e:
        logger.warning(f"异步分析 Redis 缓存写入失败(回退内存): {e}")
    _kg_async_memcache.clear()
    _kg_async_memcache_ts.clear()
    _kg_async_memcache[key] = payload
    _kg_async_memcache_ts[key] = time.time()


async def _run_communities_task(node_count: int, edge_count: int, cache_key: str) -> Dict[str, Any]:
    """Louvain 社区检测异步任务体（B表全谱，>5000节点自动度数降采样）。"""
    cached = await _kg_get_cached(cache_key)
    if cached is not None:
        return {**cached, "cached": True}
    eng = KnowledgeGraphEngine()
    async with async_session_factory() as db:
        nodes, edges = await eng.load_graph_from_btable(db)
    if not nodes:
        return {"mode": "communities", "total_nodes": 0, "communities": [], "message": "图谱为空"}
    loop = asyncio.get_running_loop()
    comm_map = await loop.run_in_executor(None, lambda: eng.detect_communities_louvain(nodes, edges))
    node_lookup = {n["id"]: n for n in nodes}
    # 按社区分组
    groups: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for nid, cid in comm_map.items():
        info = node_lookup.get(nid, {})
        groups[cid].append({
            "node_id": nid,
            "node_type": info.get("node_type", "unknown"),
            "node_label": info.get("node_label", str(nid)),
        })
    communities = [
        {"community_id": cid, "size": len(members), "nodes": members}
        for cid, members in sorted(groups.items(), key=lambda x: -len(x[1]))
    ]
    payload = {"mode": "communities", "source": "btable", "total_nodes": len(nodes),
               "total_edges": len(edges), "total_communities": len(communities), "communities": communities}
    await _kg_set_cached(cache_key, payload)
    return {**payload, "cached": False}


async def _run_kcore_task(node_count: int, edge_count: int, cache_key: str) -> Dict[str, Any]:
    """K-Core 分解异步任务体（B表全谱，实测34s）。"""
    cached = await _kg_get_cached(cache_key)
    if cached is not None:
        return {**cached, "cached": True}
    eng = KnowledgeGraphEngine()
    async with async_session_factory() as db:
        nodes, edges = await eng.load_graph_from_btable(db)
    if not nodes:
        return {"mode": "kcore", "total_nodes": 0, "results": [], "message": "图谱为空"}
    loop = asyncio.get_running_loop()
    coreness = await loop.run_in_executor(None, lambda: eng.decompose_kcore(nodes, edges))
    node_lookup = {n["id"]: n for n in nodes}
    sorted_items = sorted(coreness.items(), key=lambda x: x[1], reverse=True)
    results = [
        {"node_id": nid, "node_type": node_lookup.get(nid, {}).get("node_type", "unknown"),
         "node_label": node_lookup.get(nid, {}).get("node_label", str(nid)), "coreness": c}
        for nid, c in sorted_items
    ]
    payload = {"mode": "kcore", "source": "btable", "total_nodes": len(nodes), "total_edges": len(edges),
               "max_coreness": max(coreness.values()) if coreness else 0, "results": results}
    await _kg_set_cached(cache_key, payload)
    return {**payload, "cached": False}


def _submit_kg_async(algo: str, func, args: tuple, timeout: int) -> Dict[str, Any]:
    """公共提交逻辑（返回 dict 由调用端点包装为响应）。"""
    # 同步提交——由 async 端点 await 调用
    return {"algo": algo, "func": func, "args": args, "timeout": timeout}


@router.post("/analytics/communities/async", summary="Louvain社区检测(异步，B表全谱)")
async def communities_async(
    limit_per_community: int = Query(10, ge=1, le=50, description="每社区返回节点数"),
    current_user: User = Depends(require_plan("knowledge_graph")),
) -> Dict[str, Any]:
    """提交 Louvain 社区检测异步任务（B表全谱，比 betweenness 更重）。"""
    cache_key = _kg_async_cache_key("communities", 14749, 240344)
    cached = await _kg_get_cached(cache_key)
    if cached is not None:
        trimmed = {**cached, "communities": [
            {**c, "nodes": c["nodes"][:limit_per_community]} for c in cached.get("communities", [])
        ]}
        return {"success": True, "mode": "communities", "cached": True, "task_id": None, "status": "done", "result": trimmed}
    queue = get_task_queue()
    task_id = await queue.submit(func=_run_communities_task, args=(14749, 240344, cache_key),
                                 priority=TaskPriority.HIGH, timeout=1800,
                                 metadata={"algorithm": "communities", "source": "btable"})
    return {"success": True, "mode": "communities", "cached": False, "task_id": task_id, "status": "pending", "poll": f"/api/v1/core/tasks/{task_id}"}


@router.post("/analytics/kcore/async", summary="K-Core分解(异步，B表全谱)")
async def kcore_async(
    current_user: User = Depends(require_plan("knowledge_graph")),
) -> Dict[str, Any]:
    """提交 K-Core 分解异步任务（B表全谱，实测~34s）。"""
    cache_key = _kg_async_cache_key("kcore", 14749, 240344)
    cached = await _kg_get_cached(cache_key)
    if cached is not None:
        return {"success": True, "mode": "kcore", "cached": True, "task_id": None, "status": "done", "result": cached}
    queue = get_task_queue()
    task_id = await queue.submit(func=_run_kcore_task, args=(14749, 240344, cache_key),
                                 priority=TaskPriority.HIGH, timeout=600,
                                 metadata={"algorithm": "kcore", "source": "btable"})
    return {"success": True, "mode": "kcore", "cached": False, "task_id": task_id, "status": "pending", "poll": f"/api/v1/core/tasks/{task_id}"}


# ═══════════════════════════════════════════
# 社区检测
# ═══════════════════════════════════════════

@router.get("/analytics/communities", summary="Louvain社区检测")
async def detect_communities(
    algorithm: str = Query("louvain", description="社区检测算法: louvain"),
    node_type: Optional[str] = Query(None, description="节点类型过滤"),
    limit_per_community: int = Query(10, ge=1, le=50, description="每个社区返回的最大节点数"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_plan("knowledge_graph")),
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
    nodes, edges = await engine.load_graph(db, source="memory", node_types=node_types)

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
    current_user: User = Depends(require_plan("knowledge_graph")),
) -> Dict[str, Any]:
    """K-Core分解分析

    K-Core是图中最小度数>=k的最大子图。
    不指定k时返回每个节点的coreness值。
    指定k时返回属于该核心的节点集合。
    """
    node_types = [node_type] if node_type else None
    # 图谱割裂修复②a：kcore 纯Python剥离法在B表全谱(14749节点/240344边)实测34s，同步超预算，
    # 守卫回退 memory 小图（覆盖小但不崩），待②b 异步化后切全谱。
    nodes, edges = await engine.load_graph(db, source="memory", node_types=node_types)
    kcore_source = "memory"
    kcore_note = "kcore 在 B表全谱(14749节点)纯Python同步实测约34s会超时，已回退内存小图；全谱 kcore 需异步架构(规划中)"

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
            "source": kcore_source,
            "note": kcore_note,
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
            "source": kcore_source,
            "note": kcore_note,
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
    current_user: User = Depends(require_plan("knowledge_graph")),
) -> Dict[str, Any]:
    """根据图谱拓扑结构推荐与目标药材相似的药材

    推荐依据（加权综合评分）:
    1. 共同化合物Jaccard相似度 (40%)
    2. 共同靶点覆盖度 (35%)
    3. 二跳路径重叠度 (25%)
    """
    # 查找目标药材节点 — 图谱割裂修复②a：目标必须从 B表 节点解析（与下方 load_graph(btable)
    # 同一 id 命名空间）。原先用 /build 的 KGNode 表查 id，但 edges/nodes 来自 B表，
    # 两套 id 不同 → target_node.id 在 B表 nodes 里不存在 → recommend 恒返回 0。
    nodes, edges = await engine.load_graph(db, source="btable")

    target_node = next(
        (n for n in nodes if n["node_type"] == "herb" and herb_name in (n.get("node_label") or "")),
        None,
    )
    if not target_node:
        raise HTTPException(
            status_code=404,
            detail={"error": "HERB_NOT_FOUND", "message": f"未找到药材: {herb_name}"},
        )
    target_id = target_node["id"]
    target_label = target_node["node_label"]

    if not nodes or not edges:
        return {
            "target_herb": herb_name,
            "target_id": target_node.id,
            "recommendations": [],
            "message": "图谱数据不足，请先执行 /build",
        }

    recommendations = engine.recommend_similar_herbs(target_id, nodes, edges, top_n=top_n)

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
        "target_herb": target_label,
        "target_id": target_id,
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
    current_user: User = Depends(require_plan("knowledge_graph")),
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
    nodes, edges = await engine.load_graph(db, source="memory", node_types=[node_type])

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
    current_user: User = Depends(require_plan("knowledge_graph")),
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
    nodes, edges = await engine.load_graph(db, source="memory", node_types=node_types)

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


# ═══════════════════════════════════════════
# 节点搜索与关系遍历（新增）
# ═══════════════════════════════════════════

@router.get("/nodes/search", summary="搜索图谱节点")
async def search_graph_nodes(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    node_type: Optional[str] = Query(None, description="节点类型过滤"),
    limit: int = Query(20, ge=1, le=100, description="返回数量"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_plan("knowledge_graph")),
) -> Dict[str, Any]:
    """搜索知识图谱中的节点，支持模糊匹配和类型过滤"""

    # 注意：KGNode 没有 description 列，描述信息存在 properties JSON 字段里。
    # 原实现引用 KGNode.description 触发 AttributeError → 500。
    stmt = select(KGNode).where(
        KGNode.node_label.ilike(f"%{q}%")
    )
    if node_type:
        stmt = stmt.where(KGNode.node_type == node_type)
    stmt = stmt.limit(limit)

    result = await db.execute(stmt)
    nodes = result.scalars().all()

    return {
        "query": q,
        "node_type_filter": node_type,
        "total": len(nodes),
        "nodes": [
            {
                "id": n.id,
                "type": n.node_type,
                "label": n.node_label,
                "description": (n.properties or {}).get("description"),
            }
            for n in nodes
        ],
    }


@router.get("/nodes/{node_id}/neighbors", summary="获取节点的邻居节点")
async def get_node_neighbors(
    node_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_plan("knowledge_graph")),
) -> Dict[str, Any]:
    """获取指定节点的所有邻居节点（入边和出边连接的节点）"""
    from ..models.knowledge_graph import KGEdge

    # 获取节点信息
    stmt = select(KGNode).where(KGNode.id == node_id)
    result = await db.execute(stmt)
    node = result.scalar_one_or_none()

    if not node:
        raise HTTPException(status_code=404, detail="节点不存在")

    # 获取所有相关边
    edges_stmt = select(KGEdge).where(
        or_(KGEdge.source_id == node_id, KGEdge.target_id == node_id)
    )
    edges_result = await db.execute(edges_stmt)
    edges = edges_result.scalars().all()

    neighbor_ids = set()
    for e in edges:
        if e.source_id == node_id:
            neighbor_ids.add(e.target_id)
        else:
            neighbor_ids.add(e.source_id)

    # 获取邻居节点详情
    if neighbor_ids:
        nodes_stmt = select(KGNode).where(KGNode.id.in_(neighbor_ids))
        nodes_result = await db.execute(nodes_stmt)
        neighbors = nodes_result.scalars().all()
    else:
        neighbors = []

    return {
        "node_id": node_id,
        "node_label": node.node_label,
        "node_type": node.node_type,
        "neighbor_count": len(neighbors),
        "neighbors": [
            {
                "id": n.id,
                "type": n.node_type,
                "label": n.node_label,
                "description": (n.properties or {}).get("description"),
            }
            for n in neighbors
        ],
    }


@router.get("/nodes/{node_id}/subgraph", summary="获取节点的子图（2跳邻居）")
async def get_node_subgraph(
    node_id: int,
    depth: int = Query(2, ge=1, le=3, description="搜索深度"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_plan("knowledge_graph")),
) -> Dict[str, Any]:
    """获取指定节点的子图（多跳邻居 + 连接边）"""
    from ..models.knowledge_graph import KGEdge

    # 与 /neighbors 保持一致：节点不存在返回 404，而不是空子图 200
    exist_stmt = select(KGNode.id).where(KGNode.id == node_id)
    exist_result = await db.execute(exist_stmt)
    if exist_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="节点不存在")

    visited: set = {node_id}
    current_level = {node_id}
    all_nodes: set = set()
    all_edges: list = []

    for _ in range(depth):
        if not current_level:
            break

        # 获取当前层所有节点的边
        stmt = select(KGEdge).where(
            or_(
                KGEdge.source_id.in_(current_level),
                KGEdge.target_id.in_(current_level),
            )
        )
        result = await db.execute(stmt)
        edges = result.scalars().all()

        next_level: set = set()
        for e in edges:
            all_edges.append({
                "id": e.id,
                "source_id": e.source_id,
                "target_id": e.target_id,
                "type": e.edge_type,
                "strength": e.strength,
            })
            if e.source_id not in visited:
                next_level.add(e.source_id)
                all_nodes.add(e.source_id)
            if e.target_id not in visited:
                next_level.add(e.target_id)
                all_nodes.add(e.target_id)

        visited |= next_level
        current_level = next_level

    # 获取所有节点详情
    node_stmt = select(KGNode).where(KGNode.id.in_(all_nodes))
    node_result = await db.execute(node_stmt)
    nodes = node_result.scalars().all()

    return {
        "root_node_id": node_id,
        "depth": depth,
        "total_nodes": len(nodes) + 1,
        "total_edges": len(all_edges),
        "nodes": [
            {
                "id": n.id,
                "type": n.node_type,
                "label": n.node_label,
                "description": (n.properties or {}).get("description"),
            }
            for n in nodes
        ],
        "edges": all_edges,
    }

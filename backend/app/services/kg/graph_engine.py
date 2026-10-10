"""
知识图谱引擎 v2.0 — 真实数据驱动 + 图论算法

功能:
1. 从TCMSP数据库自动构建知识图谱(herb→compound→target/disease链路)
2. PageRank中心性算法
3. 介数中心性(Betweenness Centrality)
4. 接近中心性(Closeness Centrality)
5. Louvain社区检测(简化版)
6. K-Core分解
7. 智能推荐(基于共同邻居/图嵌入相似度)
8. 子图提取与关键路径分析

使用方式:
    from app.services.kg.graph_engine import KnowledgeGraphEngine

    engine = KnowledgeGraphEngine()
    await engine.build_from_tcmsp(db)
    scores = engine.compute_pagerank(nodes, edges)
"""

import json
import logging
import random
from collections import defaultdict, deque
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import select, func, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.knowledge_graph import KGNode, KGEdge
from ..data_sources.tcmsp_client import tcmsp_service
# A-27：下面 3 个方法引用的 KnowledgeGraphService 定义在这里；原先根本没导入，
#       一调用就是 NameError（/api/v1/knowledge-base 的搜索/邻居/子图接口全挂）。
from ..data_sources.graph_service import KnowledgeGraphService

logger = logging.getLogger(__name__)


class KnowledgeGraphEngine:
    """基于真实TCMSP数据的知识图谱引擎

    提供图谱构建、图论算法分析、智能推荐等核心能力。
    所有算法基于纯Python实现，不依赖networkx等外部库。
    """

    # ═══════════════════════════════════════════
    # 图谱构建
    # ═══════════════════════════════════════════

    async def build_from_tcmsp(
        self,
        db: AsyncSession,
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """从PostgreSQL中的TCMSP数据构建完整知识图谱

        数据流:
        tcm_herbs (578条) → kg_nodes (type=herb)
          ↓ compounds (JOIN tcm_compounds via tcm_herb_compounds)
        tcm_compounds → kg_nodes (type=compound)
          ↓ targets (从tcm_compound_targets关联表提取)
        提取的靶点 → kg_nodes (type=target)
        提取的疾病 → kg_nodes (type=disease)

        边关系:
        herb --contains--> compound (每对关系strength = OB% * DL归一化)
        compound --targets--> target (strength = 活性置信度)
        herb --treats--> disease (从effects字段推断)

        Args:
            db: 异步数据库会话
            options: 构建选项，支持:
                - rebuild: bool = False  是否全量重建（先清空再构建）
                - batch_size: int = 200  批量插入大小
                - skip_edges: bool = False  是否跳过边构建（仅建节点）

        Returns:
            构建统计信息字典
        """
        opts = options or {}
        rebuild = opts.get("rebuild", False)
        batch_size = opts.get("batch_size", 50)
        skip_edges = opts.get("skip_edges", False)

        stats = {
            "herbs_created": 0,
            "compounds_created": 0,
            "targets_created": 0,
            "diseases_created": 0,
            "edges_contains": 0,
            "edges_targets": 0,
            "edges_treats": 0,
            "total_time_ms": 0,
        }

        import time
        start_time = time.perf_counter()

        # ── 阶段0: 检查现有数据 ──
        existing_count = await db.execute(
            select(func.count(KGNode.id)).where(KGNode.source == "tcmsp")
        )
        existing_nodes = existing_count.scalar() or 0

        if existing_nodes > 0 and not rebuild:
            logger.info(f"知识图谱已有 {existing_nodes} 条TCMSP节点，执行增量更新")
        elif rebuild and existing_nodes > 0:
            logger.info(f"全量重建模式：清除现有 {existing_nodes} 条TCMSP节点")
            await db.execute(text("DELETE FROM kg_edges WHERE source = 'tcmsp'"))
            await db.execute(text("DELETE FROM kg_nodes WHERE source = 'tcmsp'"))
            await db.commit()

        # ── 阶段1: 创建药材节点 ──
        logger.info("阶段1: 从 tcm_herbs 创建药材节点...")
        herbs_result = await db.execute(
            select(
                text("id"),
                text("name_cn"),
                text("name_latin"),
                text("ob_percent"),
                text("dl_value"),
                text("effects"),
                text("category"),
            ).select_from(text("tcm_herbs"))
        )
        herbs = herbs_result.all()
        herb_id_map: Dict[int, int] = {}  # tcm_herbs.id -> kg_nodes.id

        for herb in herbs:
            herb_db_id, name_cn, name_latin, ob_percent, dl_value, effects, category = herb
            node_label = name_cn or name_latin or f"herb_{herb_db_id}"

            # UPSERT: 使用ON CONFLICT避免重复（参数化SQL）
            upsert_sql = text("""
                INSERT INTO kg_nodes (node_type, node_label, properties, source, source_id, tcm_herb_id, created_at, updated_at)
                VALUES (:nt, :nl, :prop, :src, :sid, :tid, NOW(), NOW())
                ON CONFLICT (node_type, node_label) DO UPDATE SET
                    properties = EXCLUDED.properties,
                    updated_at = NOW()
                RETURNING id
            """)
            result = await db.execute(upsert_sql, {
                "nt": "herb",
                "nl": node_label,
                "prop": json.dumps({
                    "name_latin": name_latin,
                    "ob_percent": float(ob_percent) if ob_percent else None,
                    "dl_value": float(dl_value) if dl_value else None,
                    "effects": effects,
                    "category": category,
                }, ensure_ascii=False),
                "src": "tcmsp",
                "sid": str(herb_db_id),
                "tid": herb_db_id,
            })
            kg_node_id = result.scalar_one()
            herb_id_map[herb_db_id] = kg_node_id
            stats["herbs_created"] += 1

        await db.commit()
        logger.info(f"  ✓ 创建/更新 {stats['herbs_created']} 个药材节点")

        # ── 阶段2: 创建化合物节点 + contains边 ──
        logger.info("阶段2: 从 tcm_compounds 创建化合物节点和contains边...")

        # 通过关联表获取药材-化合物关系
        hc_result = await db.execute(text("""
            SELECT
                hc.herb_id,
                c.id AS compound_id,
                c.name AS compound_name,
                c.ob_percent AS compound_ob,
                c.dl_value AS compound_dl,
                c.molecular_formula,
                c.smiles,
                hc.content_percent
            FROM tcm_herb_compounds hc
            JOIN tcm_compounds c ON c.id = hc.compound_id
            WHERE hc.herb_id = ANY(:herb_ids)
        """), {"herb_ids": list(herb_id_map.keys())})

        compound_rows = hc_result.all()
        compound_id_map: Dict[int, int] = {}  # tcm_compounds.id -> kg_nodes.id
        edge_batch: List[Dict[str, Any]] = []

        for row in compound_rows:
            herb_db_id, comp_db_id, comp_name, comp_ob, comp_dl, formula, smiles, content_pct = row

            if not comp_name:
                continue

            # 创建/更新化合物节点
            comp_upsert = text("""
                INSERT INTO kg_nodes (node_type, node_label, properties, source, source_id, created_at, updated_at)
                VALUES (:nt, :nl, :prop, :src, :sid, NOW(), NOW())
                ON CONFLICT (node_type, node_label) DO UPDATE SET
                    properties = EXCLUDED.properties,
                    updated_at = NOW()
                RETURNING id
            """)
            result = await db.execute(comp_upsert, {
                "nt": "compound",
                "nl": comp_name,
                "prop": json.dumps({
                    "molecular_formula": formula,
                    "smiles": smiles,
                    "ob_percent": float(comp_ob) if comp_ob else None,
                    "dl_value": float(comp_dl) if comp_dl else None,
                    "content_percent": float(content_pct) if content_pct else None,
                }, ensure_ascii=False),
                "src": "tcmsp",
                "sid": str(comp_db_id),
            })
            comp_kg_id = result.scalar_one()
            compound_id_map[comp_db_id] = comp_kg_id
            stats["compounds_created"] += 1

            # 计算 contains 边强度: OB%归一化 * DL值
            ob_norm = min(float(comp_ob) / 100.0, 1.0) if comp_ob else 0.3
            dl_val = float(comp_dl) if comp_dl else 0.18  # TCMSP默认DL阈值
            strength = round(ob_norm * dl_val, 4)

            # 收集边（批量插入）
            edge_batch.append({
                "source_id": herb_id_map[herb_db_id],
                "target_id": comp_kg_id,
                "edge_type": "contains",
                "strength": strength,
                "properties": {"content_percent": content_pct},
                "source": "tcmsp",
            })

            if len(edge_batch) >= batch_size:
                await self._batch_insert_edges(db, edge_batch)
                stats["edges_contains"] += len(edge_batch)
                edge_batch.clear()

        # 处理剩余边
        if edge_batch:
            await self._batch_insert_edges(db, edge_batch)
            stats["edges_contains"] += len(edge_batch)

        await db.commit()
        logger.info(f"  ✓ 创建/更新 {stats['compounds_created']} 个化合物节点, {stats['edges_contains']} 条contains边")

        # ── 阶段3: 创建靶点节点 + targets边 ──
        if not skip_edges:
            logger.info("阶段3: 从 tcm_compound_targets 创建靶点节点和targets边...")

            ct_result = await db.execute(text("""
                SELECT
                    ct.compound_id,
                    t.id AS target_id,
                    t.name AS target_name,
                    t.gene_symbol,
                    ct.activity_type,
                    ct.confidence
                FROM tcm_compound_targets ct
                JOIN tcm_targets t ON t.id = ct.target_id
                WHERE ct.compound_id = ANY(:compound_ids)
            """), {"compound_ids": list(compound_id_map.keys())})

            target_rows = ct_result.all()
            target_id_map: Dict[int, int] = {}
            target_edge_batch = []

            for row in target_rows:
                comp_db_id, tgt_db_id, tgt_name, gene_symbol, activity_type, confidence = row

                if not tgt_name:
                    continue

                # 创建/更新靶点节点
                tgt_upsert = text("""
                    INSERT INTO kg_nodes (node_type, node_label, properties, source, source_id, created_at, updated_at)
                    VALUES (:nt, :nl, :prop, :src, :sid, NOW(), NOW())
                    ON CONFLICT (node_type, node_label) DO UPDATE SET
                        properties = EXCLUDED.properties,
                        updated_at = NOW()
                    RETURNING id
                """)
                result = await db.execute(tgt_upsert, {
                    "nt": "target",
                    "nl": tgt_name,
                    "prop": json.dumps({
                        "gene_symbol": gene_symbol,
                        "activity_type": activity_type,
                    }, ensure_ascii=False),
                    "src": "tcmsp",
                    "sid": str(tgt_db_id),
                })
                tgt_kg_id = result.scalar_one()
                target_id_map[tgt_db_id] = tgt_kg_id
                stats["targets_created"] += 1

                # targets边强度 = 置信度
                tgt_strength = round(float(confidence), 4) if confidence else 0.5
                target_edge_batch.append({
                    "source_id": compound_id_map[comp_db_id],
                    "target_id": tgt_kg_id,
                    "edge_type": "targets",
                    "strength": tgt_strength,
                    "properties": {"activity_type": activity_type},
                    "source": "tcmsp",
                })

                if len(target_edge_batch) >= batch_size:
                    await self._batch_insert_edges(db, target_edge_batch)
                    stats["edges_targets"] += len(target_edge_batch)
                    target_edge_batch.clear()

            if target_edge_batch:
                await self._batch_insert_edges(db, target_edge_batch)
                stats["edges_targets"] += len(target_edge_batch)

            await db.commit()
            logger.info(f"  ✓ 创建/更新 {stats['targets_created']} 个靶点节点, {stats['edges_targets']} 条targets边")

        # ── 阶段4: 从药材effects推断疾病节点 + treats边 ──
        if not skip_edges:
            logger.info("阶段4: 从药材effects推断疾病节点和treats边...")
            disease_set: Set[str] = set()
            disease_edge_batch = []
            disease_id_map: Dict[str, int] = {}

            # 常见疾病关键词映射（从effects文本中提取）
            disease_keywords = [
                "炎症", "肿瘤", "癌症", "糖尿病", "高血压", "心血管", "肝病",
                "肾病", "免疫", "抗菌", "抗病毒", "抗氧化", "镇痛", "抗炎",
                "抗癌", "抗肿瘤", "降糖", "降压", "保肝", "护肾", "感冒",
                "发热", "咳嗽", "哮喘", "消化", "便秘", "腹泻", "失眠",
                "抑郁", "焦虑", "风湿", "关节炎", "骨质疏松", "贫血",
                "止血", "活血", "解毒", "清热", "祛湿", "化痰",
            ]

            for herb in herbs:
                herb_db_id = herb[0]
                effects = herb[5]  # effects字段
                if not effects or not isinstance(effects, str):
                    continue

                # 从effects中匹配疾病关键词
                matched_diseases = [kw for kw in disease_keywords if kw in effects]

                for disease_name in matched_diseases:
                    full_disease_label = f"{disease_name}相关疾病"

                    if full_disease_label not in disease_id_map:
                        dis_upsert = text("""
                            INSERT INTO kg_nodes (node_type, node_label, properties, source, created_at, updated_at)
                            VALUES (:nt, :nl, :prop, :src, NOW(), NOW())
                            ON CONFLICT (node_type, node_label) DO UPDATE SET
                                updated_at = NOW()
                            RETURNING id
                        """)
                        result = await db.execute(dis_upsert, {
                            "nt": "disease",
                            "nl": full_disease_label,
                            "prop": json.dumps({"keyword": disease_name, "inferred_from": "effects"}, ensure_ascii=False),
                            "src": "tcmsp",
                        })
                        dis_kg_id = result.scalar_one()
                        disease_id_map[full_disease_label] = dis_kg_id
                        stats["diseases_created"] += 1
                    else:
                        dis_kg_id = disease_id_map[full_disease_label]

                    disease_edge_batch.append({
                        "source_id": herb_id_map[herb_db_id],
                        "target_id": dis_kg_id,
                        "edge_type": "treats",
                        "strength": 0.6,  # 推断关系的默认强度
                        "properties": {"basis": "keyword_inference"},
                        "source": "tcmsp",
                    })

                    if len(disease_edge_batch) >= batch_size:
                        await self._batch_insert_edges(db, disease_edge_batch)
                        stats["edges_treats"] += len(disease_edge_batch)
                        disease_edge_batch.clear()

            if disease_edge_batch:
                await self._batch_insert_edges(db, disease_edge_batch)
                stats["edges_treats"] += len(disease_edge_batch)

            await db.commit()
            logger.info(f"  ✓ 创建/更新 {stats['diseases_created']} 个疾病节点, {stats['edges_treats']} 条treats边")

        elapsed = (time.perf_counter() - start_time) * 1000
        stats["total_time_ms"] = round(elapsed, 2)

        logger.info(
            f"知识图谱构建完成 | "
            f"节点: 药材={stats['herbs_created']}, 化合物={stats['compounds_created']}, "
            f"靶点={stats['targets_created']}, 疾病={stats['diseases_created']} | "
            f"边: contains={stats['edges_contains']}, targets={stats['edges_targets']}, treats={stats['edges_treats']} | "
            f"耗时: {elapsed:.0f}ms"
        )

        return stats

    async def _batch_insert_edges(
        self,
        db: AsyncSession,
        edges: List[Dict[str, Any]],
    ) -> None:
        """批量插入边（使用UPSERT避免重复，自动去重同批次重复边）"""
        if not edges:
            return

        # 按唯一约束去重：同一批次中相同(source_id, target_id, edge_type)只保留第一条
        seen = set()
        unique_edges = []
        for e in edges:
            key = (e["source_id"], e["target_id"], e["edge_type"])
            if key not in seen:
                seen.add(key)
                unique_edges.append(e)
        edges = unique_edges

        values = []
        params = {}
        for i, e in enumerate(edges):
            key_prefix = f"src{i}"
            values.append(f"""
                (:{key_prefix}_sid, :{key_prefix}_tid, :{key_prefix}_etype,
                 :{key_prefix}_str, :{key_prefix}_prop, :{key_prefix}_src, NOW(), NOW())
            """)
            params[f"{key_prefix}_sid"] = e["source_id"]
            params[f"{key_prefix}_tid"] = e["target_id"]
            params[f"{key_prefix}_etype"] = e["edge_type"]
            params[f"{key_prefix}_str"] = e["strength"]
            params[f"{key_prefix}_prop"] = json.dumps(e.get("properties", {}), ensure_ascii=False) if isinstance(e.get("properties"), dict) else "{}"
            params[f"{key_prefix}_src"] = e["source"]

        sql = text(f"""
            INSERT INTO kg_edges (source_id, target_id, edge_type, strength, properties, source, created_at, updated_at)
            VALUES {', '.join(values)}
            ON CONFLICT (source_id, target_id, edge_type) DO UPDATE SET
                strength = EXCLUDED.strength,
                properties = EXCLUDED.properties,
                updated_at = NOW()
        """)
        await db.execute(sql, params)

    # ═══════════════════════════════════════════
    # 数据加载工具方法
    # ═══════════════════════════════════════════

    async def load_graph_from_db(
        self,
        db: AsyncSession,
        node_types: Optional[List[str]] = None,
        edge_types: Optional[List[str]] = None,
        limit: Optional[int] = None,
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """从数据库加载图谱数据为标准格式（用于算法输入）

        Args:
            db: 数据库会话
            node_types: 节点类型过滤列表
            edge_types: 边类型过滤列表
            limit: 节点数量限制

        Returns:
            (nodes, edges) 元组，其中:
            - nodes: [{"id": int, "node_type": str, "node_label": str}, ...]
            - edges: [{"source": int, "target": int, "strength": float}, ...]
        """
        # 加载节点
        query = select(KGNode.id, KGNode.node_type, KGNode.node_label)
        if node_types:
            query = query.where(KGNode.node_type.in_(node_types))
        if limit:
            query = query.limit(limit)

        result = await db.execute(query)
        nodes = [
            {"id": row[0], "node_type": row[1], "node_label": row[2]}
            for row in result.all()
        ]

        if not nodes:
            return [], []

        node_ids = {n["id"] for n in nodes}

        # 加载边
        edge_query = select(
            KGEdge.source_id, KGEdge.target_id, KGEdge.edge_type, KGEdge.strength
        ).where(
            (KGEdge.source_id.in_(node_ids)) & (KGEdge.target_id.in_(node_ids))
        )
        if edge_types:
            edge_query = edge_query.where(KGEdge.edge_type.in_(edge_types))

        edge_result = await db.execute(edge_query)
        edges = [
            {"source": row[0], "target": row[1], "type": row[2], "strength": row[3]}
            for row in edge_result.all()
        ]

        return nodes, edges

    # ═══════════════════════════════════════════
    # PageRank 算法
    # ═══════════════════════════════════════════

    def compute_pagerank(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        damping: float = 0.85,
        iterations: int = 50,
        tolerance: float = 1e-6,
    ) -> Dict[int, float]:
        """PageRank算法实现

        标准迭代算法:
        PR(p) = (1-d)/N + d * sum(PR(q)/L(q)) for q in links_to(p)

        Args:
            nodes: 节点列表 [{"id": int, ...}, ...]
            edges: 边列表 [{"source": int, "target": int, "strength": float}, ...]
            damping: 阻尼系数，默认0.85
            iterations: 最大迭代次数，默认50
            tolerance: 收敛阈值

        Returns:
            {node_id: pagerank_score} 字典
        """
        if not nodes:
            return {}

        # 构建邻接表（出链）
        node_ids = {n["id"] for n in nodes}
        out_links: Dict[int, List[Tuple[int, float]]] = defaultdict(list)
        in_links: Dict[int, List[int]] = defaultdict(list)

        for edge in edges:
            s, t = edge["source"], edge["target"]
            if s in node_ids and t in node_ids:
                w = edge.get("strength", 1.0)
                out_links[s].append((t, w))
                in_links[t].append(s)

        n = len(nodes)
        inv_n = 1.0 / n

        # 初始化：所有节点均匀分布
        pr: Dict[int, float] = {nid: inv_n for nid in node_ids}

        # 迭代计算
        for iteration in range(iterations):
            new_pr: Dict[int, float] = {}

            for nid in node_ids:
                # 来自入链节点的贡献
                rank_sum = 0.0
                for src in in_links[nid]:
                    out_degree = len(out_links[src])
                    if out_degree > 0:
                        rank_sum += pr[src] / out_degree

                new_pr[nid] = (1 - damping) * inv_n + damping * rank_sum

            # 处理悬挂节点（dangling nodes）：无出链的节点将其PR均匀分配给所有节点
            dangling_sum = sum(pr[nid] for nid in node_ids if len(out_links[nid]) == 0)
            for nid in node_ids:
                new_pr[nid] += damping * dangling_sum * inv_n

            # 归一化
            total = sum(new_pr.values())
            if total > 0:
                scale = 1.0 / total
                for nid in new_pr:
                    new_pr[nid] *= scale

            # 检查收敛
            diff = sum(abs(new_pr[nid] - pr[nid]) for nid in node_ids)
            pr = new_pr

            if diff < tolerance:
                logger.debug(f"PageRank在 {iteration + 1} 次迭代后收敛 (diff={diff:.2e})")
                break

        return pr

    # ═══════════════════════════════════════════
    # 介数中心性 (Brandes算法)
    # ═══════════════════════════════════════════

    def compute_betweenness(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        sample_size: Optional[int] = None,
    ) -> Dict[int, float]:
        """介数中心性 (Brandes算法)

        O(nm)复杂度的精确算法。
        当节点数>500时自动采样加速。

        Args:
            nodes: 节点列表
            edges: 边列表（无向处理）
            sample_size: 采样源节点数（None=全部）

        Returns:
            {node_id: betweenness_score} 字典
        """
        if not nodes:
            return {}

        node_ids = {n["id"] for n in nodes}
        n = len(node_ids)

        # 构建无向邻接表
        adj: Dict[int, Set[int]] = defaultdict(set)
        for edge in edges:
            s, t = edge["source"], edge["target"]
            if s in node_ids and t in node_ids:
                adj[s].add(t)
                adj[t].add(s)

        # 大图采样优化
        sources = list(node_ids)
        if sample_size is None and n > 500:
            sample_size = min(500, n)
        if sample_size and sample_size < n:
            random.seed(42)  # 固定种子保证可复现
            sources = random.sample(sources, sample_size)

        betweenness: Dict[int, float] = {nid: 0.0 for nid in node_ids}

        for s in sources:
            # BFS前向遍历
            stack: List[int] = []
            predecessors: Dict[int, List[int]] = defaultdict(list)
            sigma: Dict[int, int] = {s: 1}
            dist: Dict[int, int] = {s: 0}
            queue = deque([s])

            while queue:
                v = queue.popleft()
                stack.append(v)
                for w in adj[v]:
                    if w not in dist:
                        dist[w] = dist[v] + 1
                        queue.append(w)
                    if dist[w] == dist[v] + 1:
                        sigma[w] = sigma.get(w, 0) + sigma[v]
                        predecessors[w].append(v)

            # 反向累积依赖
            delta: Dict[int, float] = {nid: 0.0 for nid in node_ids}
            while stack:
                w = stack.pop()
                for v in predecessors[w]:
                    delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])
                if w != s:
                    betweenness[w] += delta[w]

        # 无向图需要除以2（每条最短路径被计算了两次）
        normalization = 1.0 if (sample_size and sample_size < n) else 0.5
        for nid in betweenness:
            betweenness[nid] *= normalization

        return betweenness

    # ═══════════════════════════════════════════
    # 接近中心性
    # ═══════════════════════════════════════════

    def compute_closeness(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        wf_improved: bool = True,
    ) -> Dict[int, float]:
        """接近中心性

        closeness(v) = (n-1) / sum(distances to all other reachable nodes)
        改进版(Wasserman-Faust): 对不可达节点的惩罚更合理

        Args:
            nodes: 节点列表
            edges: 边列表（无向处理）
            wf_improved: 是否使用Wasserman-Faust改进公式

        Returns:
            {node_id: closeness_score} 字典
        """
        if not nodes:
            return {}

        node_ids = {n["id"] for n in nodes}
        n = len(node_ids)

        # 构建无向邻接表
        adj: Dict[int, Set[int]] = defaultdict(set)
        for edge in edges:
            s, t = edge["source"], edge["target"]
            if s in node_ids and t in node_ids:
                adj[s].add(t)
                adj[t].add(s)

        closeness: Dict[int, float] = {}

        for source in node_ids:
            # BFS计算到所有其他节点的最短路径
            distances: Dict[int, int] = {source: 0}
            visited = {source}
            queue = deque([source])

            while queue:
                current = queue.popleft()
                for neighbor in adj[current]:
                    if neighbor not in visited:
                        visited.add(neighbor)
                        distances[neighbor] = distances[current] + 1
                        queue.append(neighbor)

            reachable = len(distances) - 1  # 不包含自身
            if reachable == 0:
                closeness[source] = 0.0
                continue

            total_distance = sum(distances.values())

            if wf_improved:
                # Wasserman-Faust改进：考虑不可达节点
                # C*(v) = [(n-1)/reachable]^2 * (reachable / total_distance)
                factor = ((n - 1) / reachable) ** 2 if reachable > 0 else 0
                closeness[source] = factor * (reachable / total_distance) if total_distance > 0 else 0.0
            else:
                closeness[source] = reachable / total_distance if total_distance > 0 else 0.0

        return closeness

    # ═══════════════════════════════════════════
    # Louvain 社区检测（简化版 Phase 1）
    # ═══════════════════════════════════════════

    def detect_communities_louvain(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        max_iterations: int = 20,
        max_nodes: int = 5000,
    ) -> Dict[int, int]:
        """Louvain社区检测（简化版，仅Phase 1 modularity优化）

        通过反复移动单个节点到邻居社区来最大化模块度。
        当节点数超过 max_nodes 时，自动按度数降采样以保证响应速度。

        Args:
            nodes: 节点列表
            edges: 边列表
            max_iterations: 最大外层迭代次数
            max_nodes: 最大处理节点数（超出时降采样高连接度节点）

        Returns:
            {node_id: community_id} 字典
        """
        if not nodes:
            return {}

        # 超大图降采样：保留高度数节点，保证响应速度
        if len(nodes) > max_nodes:
            logger.info(f"社区检测: 节点数 {len(nodes)} 超过阈值 {max_nodes}，执行度数降采样")
            node_degrees: Dict[int, int] = defaultdict(int)
            for edge in edges:
                s, t = edge["source"], edge["target"]
                node_degrees[s] = node_degrees.get(s, 0) + 1
                node_degrees[t] = node_degrees.get(t, 0) + 1
            # 按度数排序，取前 max_nodes 个
            top_node_ids = sorted(node_degrees.keys(), key=lambda x: node_degrees[x], reverse=True)[:max_nodes]
            node_set = set(top_node_ids)
            nodes = [n for n in nodes if n["id"] in node_set]
            edges = [e for e in edges if e["source"] in node_set and e["target"] in node_set]
            logger.info(f"降采样后: {len(nodes)} 节点, {len(edges)} 边")

        node_ids = {n["id"] for n in nodes}

        # 构建加权邻接表
        adj: Dict[int, Dict[int, float]] = defaultdict(dict)
        total_weight = 0.0
        for edge in edges:
            s, t = edge["source"], edge["target"]
            w = edge.get("strength", 1.0)
            if s in node_ids and t in node_ids:
                adj[s][t] = w
                adj[t][s] = w
                total_weight += w

        if total_weight == 0:
            # 无权重时默认为1
            for edge in edges:
                s, t = edge["source"], edge["target"]
                if s in node_ids and t in node_ids:
                    adj[s][t] = 1.0
                    adj[t][s] = 1.0
            total_weight = len(edges) * 2  # 无向图每条边算两次

        m = total_weight  # 总边权重（无向图的2倍）
        if m == 0:
            return {nid: i for i, nid in enumerate(node_ids)}

        # 初始化：每个节点独立成社区
        node_to_community: Dict[int, int] = {nid: idx for idx, nid in enumerate(sorted(node_ids))}
        community_to_nodes: Dict[int, Set[int]] = {idx: {nid} for idx, nid in enumerate(sorted(node_ids))}

        # 计算每个社区的内部总权重（sigma_in）和总度数（sigma_tot）
        sigma_in: Dict[int, float] = defaultdict(float)
        sigma_tot: Dict[int, float] = defaultdict(float)
        k: Dict[int, float] = {}  # 每个节点的加权度数

        for nid in node_ids:
            k[nid] = sum(adj[nid].values())
            comm = node_to_community[nid]
            sigma_tot[comm] = k[nid]

        for edge in edges:
            s, t = edge["source"], edge["target"]
            if s in node_ids and t in node_ids:
                cs, ct = node_to_community[s], node_to_community[t]
                w = edge.get("strength", 1.0)
                if cs == ct:
                    sigma_in[cs] += w

        improved = True
        iteration = 0
        # 根据图规模自适应调整迭代次数
        effective_max_iter = min(max_iterations, max(3, 5000 // len(nodes)))

        while improved and iteration < effective_max_iter:
            improved = False
            iteration += 1
            nodes_list = list(node_ids)
            random.seed(iteration * 17)
            random.shuffle(nodes_list)

            for node in nodes_list:
                best_delta = 0.0
                best_comm = node_to_community[node]
                current_comm = best_comm

                # 先将节点从当前社区移除
                k_i_in_comm = sum(
                    adj[node].get(neighbor, 0)
                    for neighbor in community_to_nodes[current_comm]
                    if neighbor != node
                )

                sigma_in[current_comm] -= 2 * k_i_in_comm
                sigma_tot[current_comm] -= k[node]

                # 尝试加入每个邻居的社区
                neighbor_comms: Set[int] = set()
                for neighbor in adj[node]:
                    if neighbor in node_to_community:
                        neighbor_comms.add(node_to_community[neighbor])

                for target_comm in neighbor_comms | {current_comm}:
                    if target_comm == current_comm:
                        continue

                    # 计算移动后的modularity增益
                    ki_in_target = sum(
                        adj[node].get(neighbor, 0)
                        for neighbor in community_to_nodes[target_comm]
                    )

                    delta_q = (
                        ki_in_target - sigma_tot[target_comm] * k[node] / m
                    ) - (
                        k_i_in_comm - sigma_tot[current_comm] * k[node] / m
                    )

                    if delta_q > best_delta:
                        best_delta = delta_q
                        best_comm = target_comm

                # 移动到最佳社区或恢复原位
                if best_comm != current_comm:
                    community_to_nodes[current_comm].discard(node)
                    community_to_nodes[best_comm].add(node)
                    node_to_community[node] = best_comm

                    # 更新sigma_in和sigma_tot
                    ki_in_best = sum(
                        adj[node].get(neighbor, 0)
                        for neighbor in community_to_nodes[best_comm]
                        if neighbor != node
                    )
                    sigma_in[best_comm] += 2 * ki_in_best
                    sigma_tot[best_comm] += k[node]

                    improved = True
                else:
                    # 恢复
                    sigma_in[current_comm] += 2 * k_i_in_comm
                    sigma_tot[current_comm] += k[node]

        # 重编号社区ID为连续整数
        unique_comms = sorted(set(node_to_community.values()))
        comm_remap = {old: new for new, old in enumerate(unique_comms)}

        return {nid: comm_remap[c] for nid, c in node_to_community.items()}

    # ═══════════════════════════════════════════
    # K-Core 分解
    # ═══════════════════════════════════════════

    def decompose_kcore(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        k: Optional[int] = None,
    ) -> Any:
        """K-Core分解

        使用剥离法：反复删除度数<k的节点，直到所有剩余节点度数>=k。

        Args:
            nodes: 节点列表
            edges: 边列表
            k: 指定k值返回>=k的核心子图节点集；
               None则返回所有节点的coreness值

        Returns:
            k为整数时: Set[int] （核心子图节点ID集合）
            k为None时: {node_id: coreness} 字典
        """
        if not nodes:
            return set() if k is not None else {}

        node_ids = {n["id"] for n in nodes}

        # 构建邻接表和度数
        adj: Dict[int, Set[int]] = defaultdict(set)
        for edge in edges:
            s, t = edge["source"], edge["target"]
            if s in node_ids and t in node_ids:
                adj[s].add(t)
                adj[t].add(s)

        # 计算coreness（Batagelj-Zaversnik算法）
        coreness: Dict[int, int] = {nid: 0 for nid in node_ids}
        remaining_nodes = set(node_ids)
        current_degrees: Dict[int, int] = {nid: len(adj[nid]) for nid in node_ids}

        # 按度数排序（用于高效剥离）
        sorted_by_deg = sorted(remaining_nodes, key=lambda x: current_degrees[x])
        deg_pos: Dict[int, int] = {nid: i for i, nid in enumerate(sorted_by_deg)}
        bin_max_deg = max(current_degrees.values()) if current_degrees else 0

        # 度数桶
        bins: List[List[int]] = [[] for _ in range(bin_max_deg + 2)]
        for nid in node_ids:
            d = current_degrees[nid]
            bins[d].append(nid)

        current_k = 0
        for i in range(bin_max_deg + 1):
            while bins[i]:
                v = bins[i].pop()
                coreness[v] = max(current_k, i)
                current_k = coreness[v]

                for u in adj[v]:
                    if u in remaining_nodes and current_degrees[u] > current_k:
                        du = current_degrees[u]
                        current_degrees[u] = du - 1
                        bins[du - 1].append(u)

                remaining_nodes.discard(v)

        if k is not None:
            # 返回 >=k 的核心子图
            core_subgraph = {nid for nid, c in coreness.items() if c >= k}
            return core_subgraph
        else:
            return coreness

    # ═══════════════════════════════════════════
    # 相似药材推荐
    # ═══════════════════════════════════════════

    def recommend_similar_herbs(
        self,
        herb_id: int,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        top_n: int = 10,
    ) -> List[Dict[str, Any]]:
        """基于图谱拓扑的相似药材推荐

        综合评分策略:
        1. 共同化合物比例 (Jaccard similarity on neighbor compound sets) — 权重40%
        2. 共同靶点覆盖度 — 权重35%
        3. 二跳路径重叠度 — 权重25%

        Args:
            herb_id: 目标药材节点ID
            nodes: 全部节点列表
            edges: 全部边列表
            top_n: 返回top-N结果

        Returns:
            排序后的相似药材列表 [{herb_id, score, details}, ...]
        """
        node_id_set = {n["id"] for n in nodes}
        if herb_id not in node_id_set:
            return []

        # 构建有向邻接表
        adj_out: Dict[int, Set[int]] = defaultdict(set)
        adj_in: Dict[int, Set[int]] = defaultdict(set)
        for edge in edges:
            s, t = edge["source"], edge["target"]
            if s in node_id_set and t in node_id_set:
                adj_out[s].add(t)
                adj_in[t].add(s)

        # 获取目标药材的一跳和二跳邻居
        herb_compounds = adj_out.get(herb_id, set())
        herb_targets: Set[int] = set()
        for c in herb_compounds:
            herb_targets.update(adj_out.get(c, set()))

        # 二跳邻居（通过化合物到达的其他药材）
        two_hop_herbs: Set[int] = set()
        for c in herb_compounds:
            for neighbor in adj_in.get(c, set()):
                if neighbor != herb_id:
                    two_hop_herbs.add(neighbor)

        # 找出所有其他药材节点
        herb_nodes = {n["id"] for n in nodes if n.get("node_type") == "herb"}
        other_herbs = herb_nodes - {herb_id}

        if not other_herbs:
            return []

        scores: List[Dict[str, Any]] = []

        for candidate_id in other_herbs:
            cand_compounds = adj_out.get(candidate_id, set())

            # 1. Jaccard相似度（共同化合物）
            if herb_compounds or cand_compounds:
                intersection = len(herb_compounds & cand_compounds)
                union = len(herb_compounds | cand_compounds)
                jaccard = intersection / union if union > 0 else 0.0
            else:
                jaccard = 0.0

            # 2. 共同靶点覆盖度
            cand_targets: Set[int] = set()
            for c in cand_compounds:
                cand_targets.update(adj_out.get(c, set()))

            if herb_targets or cand_targets:
                target_intersection = len(herb_targets & cand_targets)
                target_union = len(herb_targets | cand_targets)
                target_coverage = target_intersection / target_union if target_union > 0 else 0.0
            else:
                target_coverage = 0.0

            # 3. 二跳路径重叠度
            hop_overlap = len(two_hop_herbs & {candidate_id})
            hop_score = 1.0 if hop_overlap > 0 else 0.0

            # 综合加权评分
            final_score = (
                jaccard * 0.40 +
                target_coverage * 0.35 +
                hop_score * 0.25
            )

            if final_score > 0:
                scores.append({
                    "herb_id": candidate_id,
                    "score": round(final_score, 6),
                    "details": {
                        "jaccard_compounds": round(jaccard, 4),
                        "target_coverage": round(target_coverage, 4),
                        "common_compounds": intersection,
                        "common_targets": target_intersection,
                    },
                })

        # 按综合评分排序
        scores.sort(key=lambda x: x["score"], reverse=True)
        return scores[:top_n]

    # ═══════════════════════════════════════════
    # 关键桥梁节点识别
    # ═══════════════════════════════════════════

    def find_key_bridges(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        top_n: int = 20,
    ) -> List[Dict[str, Any]]:
        """识别关键桥梁节点（高betweenness + 跨社区连接）

        综合指标:
        1. 介数中心性得分（标准化后）— 权重50%
        2. 跨社区连接数（连接不同社区的边数）— 权重30%
        3. 度数（标准化后）— 权重20%

        Args:
            nodes: 节点列表
            edges: 边列表
            top_n: 返回top-N桥梁节点

        Returns:
            排序后的桥梁节点列表
        """
        if not nodes or not edges:
            return []

        # 并行计算多个指标
        betweenness = self.compute_betweenness(nodes, edges)
        communities = self.detect_communities_louvain(nodes, edges)

        # 标准化betweenness
        b_values = list(betweenness.values())
        b_max = max(b_values) if b_values else 1.0
        b_min = min(b_values) if b_values else 0.0
        b_range = b_max - b_min if b_max > b_min else 1.0

        # 构建邻接表
        node_ids = {n["id"] for n in nodes}
        adj: Dict[int, Set[int]] = defaultdict(set)
        degrees: Dict[int, int] = defaultdict(int)
        for edge in edges:
            s, t = edge["source"], edge["target"]
            if s in node_ids and t in node_ids:
                adj[s].add(t)
                adj[t].add(s)
                degrees[s] += 1
                degrees[t] += 1

        d_values = list(degrees.values())
        d_max = max(d_values) if d_values else 1.0
        d_range = d_max if d_max > 0 else 1.0

        bridges: List[Dict[str, Any]] = []

        for nid in node_ids:
            # 标准化betweenness
            norm_b = (betweenness.get(nid, 0) - b_min) / b_range

            # 跨社区连接数
            cross_comm_edges = 0
            my_comm = communities.get(nid, -1)
            for neighbor in adj[nid]:
                if communities.get(neighbor, -2) != my_comm:
                    cross_comm_edges += 1

            # 标准化度数
            norm_d = degrees[nid] / d_range

            # 综合桥梁分数
            bridge_score = (
                norm_b * 0.50 +
                (cross_comm_edges / max(len(adj[nid]), 1)) * 0.30 +
                norm_d * 0.20
            )

            bridges.append({
                "node_id": nid,
                "bridge_score": round(bridge_score, 6),
                "betweenness": round(betweenness.get(nid, 0), 6),
                "cross_community_edges": cross_comm_edges,
                "degree": degrees[nid],
                "community": my_comm,
            })

        bridges.sort(key=lambda x: x["bridge_score"], reverse=True)
        return bridges[:top_n]

    # ═══════════════════════════════════════════
    # Ego网络提取
    # ═══════════════════════════════════════════

    def extract_ego_network(
        self,
        center_node_id: int,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        radius: int = 2,
    ) -> Dict[str, Any]:
        """提取以某节点为中心的ego网络（指定半径）

        使用BFS遍历，收集半径内所有节点和边。

        Args:
            center_node_id: 中心节点ID
            nodes: 全部节点列表
            edges: 全部边列表
            radius: ego网络半径（跳数）

        Returns:
            {"center_id", "nodes", "edges", "radius", "total_nodes", "total_edges"}
        """
        node_lookup = {n["id"]: n for n in nodes}
        if center_node_id not in node_lookup:
            return {
                "center_id": center_node_id,
                "nodes": [],
                "edges": [],
                "radius": radius,
                "total_nodes": 0,
                "total_edges": 0,
                "error": "中心节点不存在",
            }

        # 构建邻接表
        node_ids = {n["id"] for n in nodes}
        adj: Dict[int, List[Tuple[int, Dict]]] = defaultdict(list)
        for edge in edges:
            s, t = edge["source"], edge["target"]
            if s in node_ids and t in node_ids:
                adj[s].append((t, edge))
                adj[t].append((s, edge))

        # BFS遍历指定半径
        visited: Set[int] = {center_node_id}
        ego_edges: List[Dict] = []
        queue = deque([(center_node_id, 0)])

        while queue:
            current_id, depth = queue.popleft()
            if depth >= radius:
                continue

            for neighbor_id, edge_data in adj[current_id]:
                if neighbor_id not in visited:
                    visited.add(neighbor_id)
                    queue.append((neighbor_id, depth + 1))
                ego_edges.append(edge_data)

        # 过滤节点
        ego_nodes = [node_lookup[nid] for nid in visited if nid in node_lookup]

        # 统计
        type_counts: Dict[str, int] = defaultdict(int)
        for node in ego_nodes:
            type_counts[node.get("node_type", "unknown")] += 1

        return {
            "center_id": center_node_id,
            "center_label": node_lookup[center_node_id].get("node_label", str(center_node_id)),
            "nodes": ego_nodes,
            "edges": ego_edges,
            "radius": radius,
            "total_nodes": len(ego_nodes),
            "total_edges": len(ego_edges),
            "type_distribution": dict(type_counts),
        }

    # ═══════════════════════════════════════════
    # API 查询方法（供知识图谱查询 API 使用）
    # ═══════════════════════════════════════════

    async def get_nodes(
        self,
        node_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """获取图谱节点列表（从 TCMSP 数据库）

        A-39：原实现从 tcmsp_client 导入 TCM_COMPOUND_DATABASE / TARGET_DATABASE /
        DISEASE_DATABASE，但那三个常量在模块里【根本不存在】（只有
        TCMSP_HERB_DATABASE）→ ImportError，经全局异常中间件（异常串含
        "database"）被映射成 503，GET /knowledge-base/graph/nodes 长期不可用。

        这三类节点本来就寄生在药材条目上（每条药材都带 compounds / targets /
        diseases 三个字段），直接从药材库展开即可，无需独立常量。
        """
        from ..data_sources.tcmsp_client import TCMSP_HERB_DATABASE

        all_nodes: List[Dict[str, Any]] = []

        def herb_nodes() -> List[Dict[str, Any]]:
            return [{
                "id": f"herb_{h.get('name_cn', '')}",
                "node_type": "herb",
                "node_label": h.get("name_cn", ""),
                "properties": h,
            } for h in TCMSP_HERB_DATABASE]

        def nested_nodes(field: str, node_type_name: str) -> List[Dict[str, Any]]:
            """从药材条目里展开嵌套集合（化合物 / 靶点 / 疾病），按名字去重"""
            seen: set = set()
            out: List[Dict[str, Any]] = []
            for h in TCMSP_HERB_DATABASE:
                for raw in (h.get(field) or []):
                    if isinstance(raw, dict):
                        label = raw.get("name") or raw.get("name_cn") or ""
                        props = raw
                    else:
                        label = str(raw)
                        props = {"name": label, "source_herb": h.get("name_cn", "")}
                    if not label or label in seen:
                        continue
                    seen.add(label)
                    out.append({
                        "id": f"{node_type_name}_{label}",
                        "node_type": node_type_name,
                        "node_label": label,
                        "properties": props,
                    })
            return out

        type_builders = {
            "herb": herb_nodes,
            "compound": lambda: nested_nodes("compounds", "compound"),
            "target": lambda: nested_nodes("targets", "target"),
            "disease": lambda: nested_nodes("diseases", "disease"),
        }

        for t, build in type_builders.items():
            if node_type and t != node_type:
                continue
            items = build()
            for item in items[offset:offset + limit]:
                all_nodes.append(item)
                if len(all_nodes) >= limit:
                    break
            if len(all_nodes) >= limit:
                break

        return all_nodes[:limit]

    async def search_nodes(
        self,
        query: str,
        node_type: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """搜索图谱节点"""
        service = KnowledgeGraphService()
        nodes = await service.search_nodes(query, node_type=node_type, limit=limit)
        return nodes

    async def get_neighbors(
        self,
        node_id: str,
        depth: int = 1,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """获取节点邻居关系"""
        service = KnowledgeGraphService()
        parts = node_id.split("_", 1)
        if len(parts) != 2:
            return {"neighbors": [], "edges": []}
        node_type, node_label = parts
        # A-27：get_node_relations(node_label, depth) 只有两个参数，原调用把 node_type
        #       当成 depth 传进去了。
        relations = await service.get_node_relations(node_label, depth=depth)
        return relations

    async def extract_subgraph(
        self,
        seed_nodes: List[str],
        max_depth: int = 2,
    ) -> Dict[str, Any]:
        """提取子图"""
        service = KnowledgeGraphService()
        if not seed_nodes:
            return {"nodes": [], "edges": []}
        parts = seed_nodes[0].split("_", 1)
        if len(parts) != 2:
            return {"nodes": [], "edges": []}
        node_label = parts[1]
        node_type = parts[0]
        relations = await service.get_node_relations(node_label, depth=max_depth)
        return relations

    async def compute_herb_pagerank(
        self,
        top_n: int = 50,
    ) -> List[Dict[str, Any]]:
        """计算 PageRank 中心性排名（简化版：基于连接度）

        A-27：本方法原名 compute_pagerank，与上面第 507 行的【真实 PageRank 实现】
        同名，定义在后 ⇒ 把前者整个覆盖掉。app/api/knowledge_graph.py 调用的是
        `engine.compute_pagerank(nodes, edges)`，实际却落到这个只吃 top_n 的简化版上，
        抛 TypeError → /analytics/centrality 恒定 500。这里改名以保留两个实现。
        """
        from ..data_sources.tcmsp_client import TCMSP_HERB_DATABASE

        compound_counts: Dict[str, int] = {}
        for herb in TCMSP_HERB_DATABASE:
            name = herb.get("name_cn", "")
            compounds = herb.get("compounds", [])
            compound_counts[name] = len(compounds) if isinstance(compounds, list) else 0

        sorted_herbs = sorted(compound_counts.items(), key=lambda x: x[1], reverse=True)
        max_count = sorted_herbs[0][1] if sorted_herbs else 1
        return [
            {
                "id": f"herb_{name}",
                "node_type": "herb",
                "node_label": name,
                "pagerank_score": round(count / max(max_count, 1), 4),
                "compound_count": count,
            }
            for name, count in sorted_herbs[:top_n]
        ]

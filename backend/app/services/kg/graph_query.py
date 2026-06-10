"""
知识图谱查询引擎

基于数据库的知识图谱查询服务，替代原来的硬编码数据。
支持：
- 节点搜索（模糊匹配）
- 关系查询（邻居、子图）
- 路径发现（BFS/DFS）
- 全量图谱加载
- 图谱统计

使用方式:
    from app.services.kg.graph_query import GraphQueryService

    service = GraphQueryService(db)
    results = await service.search_nodes("人参", node_type="herb")
"""
import logging
from collections import defaultdict, deque
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...models.knowledge_graph import KGNode, KGEdge

logger = logging.getLogger(__name__)


class GraphQueryService:
    """知识图谱查询服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def search_nodes(
        self,
        keyword: str,
        node_type: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        搜索知识图谱节点

        Args:
            keyword: 搜索关键词
            node_type: 节点类型过滤（可选）
            limit: 返回数量限制

        Returns:
            节点列表
        """
        query = select(KGNode)

        if keyword:
            like_pattern = f"%{keyword}%"
            query = query.where(
                or_(
                    KGNode.node_label.ilike(like_pattern),
                    KGNode.properties.cast(String).ilike(like_pattern),
                )
            )

        if node_type:
            query = query.where(KGNode.node_type == node_type)

        query = query.limit(limit)
        result = await self.db.execute(query)
        nodes = result.scalars().all()

        return [node.to_dict() for node in nodes]

    async def get_node_by_id(self, node_id: int) -> Optional[KGNode]:
        """根据 ID 获取节点"""
        result = await self.db.execute(
            select(KGNode).where(KGNode.id == node_id)
        )
        return result.scalar_one_or_none()

    async def get_node_by_type_label(self, node_type: str, node_label: str) -> Optional[KGNode]:
        """根据类型和标签获取节点"""
        result = await self.db.execute(
            select(KGNode).where(
                KGNode.node_type == node_type,
                KGNode.node_label == node_label,
            )
        )
        return result.scalar_one_or_none()

    async def get_node_relations(
        self,
        node_label: str,
        depth: int = 1,
    ) -> Dict[str, Any]:
        """
        获取节点的关系网络

        Args:
            node_label: 节点标签
            depth: 查询深度（1=直接邻居，2=二跳邻居）

        Returns:
            包含 nodes 和 edges 的图数据
        """
        # 查找中心节点
        center_node = await self.get_node_by_type_label(None, node_label)
        if not center_node:
            # 尝试模糊匹配
            result = await self.db.execute(
                select(KGNode).where(KGNode.node_label == node_label).limit(1)
            )
            center_node = result.scalar_one_or_none()

        if not center_node:
            return {"center_node": node_label, "nodes": [], "edges": [], "stats": {"nodes": 0, "edges": 0}}

        # BFS 遍历指定深度
        visited_nodes: Set[int] = {center_node.id}
        all_edges: List[KGEdge] = []
        queue: deque = deque([(center_node.id, 0)])

        while queue:
            current_id, current_depth = queue.popleft()
            if current_depth >= depth:
                continue

            # 获取当前节点的所有边
            edges_result = await self.db.execute(
                select(KGEdge)
                .options(
                    selectinload(KGEdge.source_node),
                    selectinload(KGEdge.target_node),
                )
                .where(
                    or_(
                        KGEdge.source_id == current_id,
                        KGEdge.target_id == current_id,
                    )
                )
            )
            edges = edges_result.scalars().all()

            for edge in edges:
                all_edges.append(edge)
                neighbor_id = edge.target_id if edge.source_id == current_id else edge.source_id
                if neighbor_id not in visited_nodes:
                    visited_nodes.add(neighbor_id)
                    queue.append((neighbor_id, current_depth + 1))

        # 获取所有涉及的节点
        nodes_result = await self.db.execute(
            select(KGNode).where(KGNode.id.in_(visited_nodes))
        )
        nodes = nodes_result.scalars().all()

        # 统计类型分布
        type_breakdown = defaultdict(int)
        for node in nodes:
            type_breakdown[node.node_type] += 1

        return {
            "center_node": node_label,
            "nodes": [node.to_dict() for node in nodes],
            "edges": [edge.to_dict() for edge in all_edges],
            "stats": {
                "nodes": len(nodes),
                "edges": len(all_edges),
                "type_breakdown": dict(type_breakdown),
            },
        }

    async def get_full_graph(self, depth: int = 1) -> Dict[str, Any]:
        """
        获取全量图谱数据

        Args:
            depth: 图谱深度（控制加载范围）

        Returns:
            全量图谱数据
        """
        # 获取度数最高的节点作为中心
        degree_query = (
            select(
                KGEdge.source_id.label("node_id"),
                func.count().label("degree"),
            )
            .group_by(KGEdge.source_id)
            .order_by(func.count().desc())
            .limit(50)
        )
        degree_result = await self.db.execute(degree_query)
        top_nodes = degree_result.all()

        if not top_nodes:
            # 如果没有边数据，返回所有节点
            nodes_result = await self.db.execute(select(KGNode).limit(500))
            nodes = nodes_result.scalars().all()
            return {
                "center_node": "",
                "nodes": [node.to_dict() for node in nodes],
                "edges": [],
                "stats": {"nodes": len(nodes), "edges": 0},
                "mode": "nodes_only",
            }

        # 收集高权重节点的邻居
        visited_nodes: Set[int] = set()
        all_edges: List[KGEdge] = []

        for row in top_nodes[:20]:  # 取前20个高权重节点
            center_id = row.node_id
            if center_id in visited_nodes:
                continue

            visited_nodes.add(center_id)
            queue = deque([(center_id, 0)])

            while queue:
                current_id, current_depth = queue.popleft()
                if current_depth >= depth:
                    continue

                edges_result = await self.db.execute(
                    select(KGEdge)
                    .options(
                        selectinload(KGEdge.source_node),
                        selectinload(KGEdge.target_node),
                    )
                    .where(
                        or_(
                            KGEdge.source_id == current_id,
                            KGEdge.target_id == current_id,
                        )
                    )
                )
                edges = edges_result.scalars().all()

                for edge in edges:
                    all_edges.append(edge)
                    neighbor_id = edge.target_id if edge.source_id == current_id else edge.source_id
                    if neighbor_id not in visited_nodes:
                        visited_nodes.add(neighbor_id)
                        queue.append((neighbor_id, current_depth + 1))

        # 获取所有涉及的节点
        nodes_result = await self.db.execute(
            select(KGNode).where(KGNode.id.in_(visited_nodes))
        )
        nodes = nodes_result.scalars().all()

        # 统计类型分布
        type_breakdown = defaultdict(int)
        for node in nodes:
            type_breakdown[node.node_type] += 1

        return {
            "center_node": top_nodes[0].node_id if top_nodes else "",
            "nodes": [node.to_dict() for node in nodes],
            "edges": [edge.to_dict() for edge in all_edges],
            "stats": {
                "nodes": len(nodes),
                "edges": len(all_edges),
                "type_breakdown": dict(type_breakdown),
            },
            "mode": "full",
        }

    async def find_path(
        self,
        source_label: str,
        target_label: str,
        max_depth: int = 4,
    ) -> Dict[str, Any]:
        """
        查找两个节点之间的最短路径（BFS）

        Args:
            source_label: 源节点标签
            target_label: 目标节点标签
            max_depth: 最大搜索深度

        Returns:
            路径信息
        """
        # 查找源节点和目标节点
        source_node = await self.get_node_by_type_label(None, source_label)
        target_node = await self.get_node_by_type_label(None, target_label)

        if not source_node or not target_node:
            return {"found": False, "path": [], "message": "节点不存在"}

        # BFS 查找最短路径
        visited: Set[int] = {source_node.id}
        queue: deque = deque([(source_node.id, [source_node.id])])

        while queue:
            current_id, path = queue.popleft()
            if len(path) > max_depth + 1:
                continue

            if current_id == target_node.id:
                # 找到路径，构建结果
                path_nodes = []
                path_edges = []
                for i in range(len(path) - 1):
                    node_result = await self.db.execute(
                        select(KGNode).where(KGNode.id == path[i])
                    )
                    node = node_result.scalar_one_or_none()
                    if node:
                        path_nodes.append(node.to_dict())

                    edge_result = await self.db.execute(
                        select(KGEdge)
                        .where(
                            or_(
                                and_(KGEdge.source_id == path[i], KGEdge.target_id == path[i + 1]),
                                and_(KGEdge.source_id == path[i + 1], KGEdge.target_id == path[i]),
                            )
                        )
                        .limit(1)
                    )
                    edge = edge_result.scalar_one_or_none()
                    if edge:
                        path_edges.append(edge.to_dict())

                # 添加最后一个节点
                node_result = await self.db.execute(
                    select(KGNode).where(KGNode.id == path[-1])
                )
                node = node_result.scalar_one_or_none()
                if node:
                    path_nodes.append(node.to_dict())

                return {
                    "found": True,
                    "path": path_nodes,
                    "edges": path_edges,
                    "length": len(path) - 1,
                }

            # 获取邻居
            edges_result = await self.db.execute(
                select(KGEdge).where(
                    or_(
                        KGEdge.source_id == current_id,
                        KGEdge.target_id == current_id,
                    )
                )
            )
            edges = edges_result.scalars().all()

            for edge in edges:
                neighbor_id = edge.target_id if edge.source_id == current_id else edge.source_id
                if neighbor_id not in visited:
                    visited.add(neighbor_id)
                    queue.append((neighbor_id, path + [neighbor_id]))

        return {"found": False, "path": [], "message": "未找到路径"}

    async def get_graph_stats(self) -> Dict[str, Any]:
        """获取图谱统计信息"""
        # 节点统计
        node_count_result = await self.db.execute(select(func.count(KGNode.id)))
        total_nodes = node_count_result.scalar() or 0

        # 边统计
        edge_count_result = await self.db.execute(select(func.count(KGEdge.id)))
        total_edges = edge_count_result.scalar() or 0

        # 按类型统计节点
        node_type_query = (
            select(KGNode.node_type, func.count().label("count"))
            .group_by(KGNode.node_type)
        )
        node_type_result = await self.db.execute(node_type_query)
        node_types = {row.node_type: row.count for row in node_type_result.all()}

        # 按类型统计边
        edge_type_query = (
            select(KGEdge.edge_type, func.count().label("count"))
            .group_by(KGEdge.edge_type)
        )
        edge_type_result = await self.db.execute(edge_type_query)
        edge_types = {row.edge_type: row.count for row in edge_type_result.all()}

        return {
            "total_nodes": total_nodes,
            "total_edges": total_edges,
            "node_types": node_types,
            "edge_types": edge_types,
            "density": total_edges / (total_nodes * (total_nodes - 1)) if total_nodes > 1 else 0,
        }


# 需要导入 String 用于 JSON 字段查询
from sqlalchemy import String

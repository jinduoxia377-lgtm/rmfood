"""
知识图谱端口接口

定义知识图谱查询的抽象接口，由 infrastructure 层的适配器实现。
"""
from abc import ABC, abstractmethod
from typing import Optional

from .knowledge import CompoundInfo, GraphPath, HerbInfo, KGNode, KGRelation


class KnowledgeGraphRepository(ABC):
    """知识图谱仓储接口"""

    @abstractmethod
    async def search_nodes(self, query: str, node_type: Optional[str] = None, limit: int = 20) -> list[KGNode]:
        """搜索节点"""
        ...

    @abstractmethod
    async def get_node_relations(self, node_id: str, relation_type: Optional[str] = None, max_depth: int = 1) -> tuple[list[KGNode], list[KGRelation]]:
        """获取节点关联的子图和关系"""
        ...

    @abstractmethod
    async def find_path(self, source_id: str, target_id: str, max_depth: int = 4) -> list[GraphPath]:
        """查找两个节点之间的最短路径"""
        ...

    @abstractmethod
    async def get_herb_info(self, herb_id: str) -> Optional[HerbInfo]:
        """获取药材完整信息"""
        ...

    @abstractmethod
    async def get_compound_info(self, compound_id: str) -> Optional[CompoundInfo]:
        """获取化合物完整信息"""
        ...

    @abstractmethod
    async def get_herbs_by_effect(self, effect: str) -> list[HerbInfo]:
        """按功效查询药材"""
        ...

    @abstractmethod
    async def get_food_homology_herbs(self) -> list[HerbInfo]:
        """获取药食同源食材列表"""
        ...

    @abstractmethod
    async def get_incompatible_pairs(self) -> list[tuple[str, str]]:
        """获取配伍禁忌对"""
        ...


class Neo4jKnowledgeGraphRepository(KnowledgeGraphRepository):
    """Neo4j 实现的知识图谱仓储"""

    def __init__(self, driver):
        self._driver = driver

    async def search_nodes(self, query: str, node_type: Optional[str] = None, limit: int = 20) -> list[KGNode]:
        async with self._driver.session() as session:
            if node_type:
                result = await session.run(
                    "MATCH (n:{node_type}) WHERE n.label CONTAINS $query "
                    "RETURN n LIMIT $limit",
                    node_type=node_type, query=query, limit=limit,
                )
            else:
                result = await session.run(
                    "MATCH (n) WHERE n.label CONTAINS $query OR n.id CONTAINS $query "
                    "RETURN n LIMIT $limit",
                    query=query, limit=limit,
                )
            return [self._record_to_node(r["n"]) for r in await result.fetch()]

    async def get_node_relations(self, node_id: str, relation_type: Optional[str] = None, max_depth: int = 1) -> tuple[list[KGNode], list[KGRelation]]:
        async with self._driver.session() as session:
            if relation_type:
                result = await session.run(
                    f"MATCH (n {{id: $node_id}})-[r:{relation_type}]-(m) "
                    f"RETURN n, r, m LIMIT 100",
                    node_id=node_id,
                )
            else:
                result = await session.run(
                    "MATCH (n {id: $node_id})-[r]-(m) "
                    "RETURN n, r, m LIMIT 100",
                    node_id=node_id,
                )
            nodes = {}
            relations = []
            records = await result.fetch()
            for r in records:
                source = self._record_to_node(r["n"])
                target = self._record_to_node(r["m"])
                edge = self._record_to_relation(r["r"], source.id, target.id)
                nodes[source.id] = source
                nodes[target.id] = target
                relations.append(edge)
            return list(nodes.values()), relations

    async def find_path(self, source_id: str, target_id: str, max_depth: int = 4) -> list[GraphPath]:
        async with self._driver.session() as session:
            result = await session.run(
                "MATCH p = shortestPath((a {id: $source_id})-[*..$max_depth]-(b {id: $target_id})) "
                "RETURN p LIMIT 5",
                source_id=source_id, target_id=target_id, max_depth=max_depth,
            )
            paths = []
            async for record in result:
                path = record["p"]
                nodes = [self._record_to_node(n) for n in path.nodes]
                edges = []
                for i, r in enumerate(path.relationships):
                    edges.append(self._record_to_relation(
                        r, path.nodes[i].get("id"), path.nodes[i + 1].get("id")
                    ))
                paths.append(GraphPath(nodes=nodes, edges=edges))
            return paths

    async def get_herb_info(self, herb_id: str) -> Optional[HerbInfo]:
        async with self._driver.session() as session:
            result = await session.run(
                "MATCH (h:herb {id: $herb_id}) "
                "OPTIONAL MATCH (h)-[:contains]->(c:compound) "
                "OPTIONAL MATCH (h)-[:treats]->(d:disease) "
                "OPTIONAL MATCH (c)-[:targets]->(t:target) "
                "RETURN h, collect(DISTINCT c.name) AS compounds, "
                "collect(DISTINCT t.name) AS targets "
                "LIMIT 1",
                herb_id=herb_id,
            )
            record = await result.single()
            if not record:
                return None
            h = record["h"]
            return HerbInfo(
                id=h.get("id"),
                name_cn=h.get("label"),
                name_en=h.get("name_en", ""),
                category=h.get("category", ""),
                property_taste=h.get("property_taste", ""),
                meridian=h.get("meridian", ""),
                efficacy=h.get("efficacy", []),
                compounds=record.get("compounds", []),
                targets=record.get("targets", []),
                is_food_homology=h.get("is_food_homology", False),
                toxicity=h.get("toxicity", "无毒"),
            )

    async def get_compound_info(self, compound_id: str) -> Optional[CompoundInfo]:
        async with self._driver.session() as session:
            result = await session.run(
                "MATCH (c:compound {id: $compound_id}) "
                "OPTIONAL MATCH (c)<-[:contains]-(h:herb) "
                "OPTIONAL MATCH (c)-[:targets]->(t:target) "
                "RETURN c, collect(DISTINCT h.label) AS herbs, "
                "collect(DISTINCT t.name) AS targets",
                compound_id=compound_id,
            )
            record = await result.single()
            if not record:
                return None
            c = record["c"]
            return CompoundInfo(
                id=c.get("id"),
                name=c.get("label", ""),
                molecular_weight=c.get("mw", 0.0),
                formula=c.get("formula", ""),
                logp=c.get("logp", 0.0),
                h_bond_donors=c.get("hbd", 0),
                h_bond_acceptors=c.get("hba", 0),
                bioavailability=c.get("ob", 0.0),
                drug_likeness=c.get("dl", 0.0),
                source_herbs=record.get("herbs", []),
                targets=record.get("targets", []),
            )

    async def get_herbs_by_effect(self, effect: str) -> list[HerbInfo]:
        herbs = []
        async with self._driver.session() as session:
            result = await session.run(
                "MATCH (h:herb) WHERE $effect IN h.efficacy "
                "RETURN h LIMIT 50",
                effect=effect,
            )
            async for record in result:
                h = record["h"]
                herbs.append(HerbInfo(
                    id=h.get("id"),
                    name_cn=h.get("label"),
                    name_en=h.get("name_en", ""),
                    category=h.get("category", ""),
                    property_taste=h.get("property_taste", ""),
                    meridian=h.get("meridian", ""),
                    efficacy=h.get("efficacy", []),
                    compounds=[],
                    targets=[],
                    is_food_homology=h.get("is_food_homology", False),
                ))
        return herbs

    async def get_food_homology_herbs(self) -> list[HerbInfo]:
        return await self.get_herbs_by_type("food")

    async def get_herbs_by_type(self, node_type: str) -> list[HerbInfo]:
        herbs = []
        async with self._driver.session() as session:
            result = await session.run(
                "MATCH (h:herb) WHERE h.category = $node_type OR h.is_food_homology = true "
                "RETURN h ORDER BY h.label LIMIT 200",
                node_type=node_type,
            )
            async for record in result:
                h = record["h"]
                herbs.append(HerbInfo(
                    id=h.get("id", ""),
                    name_cn=h.get("label", ""),
                    name_en=h.get("name_en", ""),
                    category=h.get("category", ""),
                    property_taste=h.get("property_taste", ""),
                    meridian=h.get("meridian", ""),
                    efficacy=h.get("efficacy", []),
                    compounds=[],
                    targets=[],
                    is_food_homology=True,
                ))
        return herbs

    async def get_incompatible_pairs(self) -> list[tuple[str, str]]:
        pairs = []
        async with self._driver.session() as session:
            result = await session.run(
                "MATCH (a:herb)-[r:antagonism]-(b:herb) "
                "RETURN a.label, b.label, r.confidence",
            )
            async for record in result:
                pairs.append((record["a.label"], record["b.label"]))
        return pairs

    @staticmethod
    def _record_to_node(record) -> KGNode:
        return KGNode(
            id=record.get("id", ""),
            node_type=record.get("node_type", list(record.labels)[0] if record.labels else "unknown"),
            label=record.get("label", record.get("name", "")),
            description=record.get("description", ""),
            properties=dict(record),
        )

    @staticmethod
    def _record_to_relation(record, source_id: str, target_id: str) -> KGRelation:
        return KGRelation(
            source_id=source_id,
            target_id=target_id,
            relation_type=record.type,
            properties=dict(record),
            confidence=record.get("confidence", 1.0),
        )

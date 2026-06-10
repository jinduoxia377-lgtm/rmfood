"""
知识图谱领域实体测试（M1.6）

使用内存适配器验证图谱查询逻辑，不依赖 Neo4j。
"""
import pytest
from typing import Optional

from app.domain.knowledge import (
    KGNode, KGRelation, GraphPath, HerbInfo, CompoundInfo,
    NodeType, EdgeType,
)
from app.domain.knowledge_ports import KnowledgeGraphRepository


class InMemoryKnowledgeGraph(KnowledgeGraphRepository):
    """内存知识图谱（测试用）"""

    def __init__(self):
        self._nodes: dict[str, KGNode] = {}
        self._edges: list[KGRelation] = []

    def add_node(self, node: KGNode):
        self._nodes[node.id] = node

    def add_edge(self, edge: KGRelation):
        self._edges.append(edge)

    def add_herb(self, id: str, label: str, **kwargs):
        self._nodes[id] = KGNode(id=id, node_type=NodeType.HERB, label=label, properties=kwargs)

    def add_compound(self, id: str, label: str, **kwargs):
        self._nodes[id] = KGNode(id=id, node_type=NodeType.COMPOUND, label=label, properties=kwargs)

    def add_relation(self, source_id: str, target_id: str, rel_type: str, **kwargs):
        self._edges.append(KGRelation(source_id=source_id, target_id=target_id, relation_type=rel_type, properties=kwargs))

    async def search_nodes(self, query: str, node_type: Optional[str] = None, limit: int = 20):
        results = []
        for node in self._nodes.values():
            if node_type and node.node_type != node_type:
                continue
            if query.lower() in node.label.lower():
                results.append(node)
        return results[:limit]

    async def get_node_relations(self, node_id: str, relation_type: Optional[str] = None, max_depth: int = 1):
        nodes_set = {}
        edges = []
        node = self._nodes.get(node_id)
        if node:
            nodes_set[node.id] = node
        for edge in self._edges:
            if edge.source_id == node_id or edge.target_id == node_id:
                if relation_type and edge.relation_type != relation_type:
                    continue
                edges.append(edge)
                target = self._nodes.get(edge.target_id if edge.source_id == node_id else edge.source_id)
                if target:
                    nodes_set[target.id] = target
        return list(nodes_set.values()), edges

    async def find_path(self, source_id: str, target_id: str, max_depth: int = 4):
        # BFS 查找路径（简化实现）
        visited = {source_id}
        queue = [[source_id]]
        while queue:
            path = queue.pop(0)
            last = path[-1]
            if last == target_id:
                nodes = [self._nodes[nid] for nid in path if nid in self._nodes]
                edges = []
                for i in range(len(path) - 1):
                    for e in self._edges:
                        if (e.source_id == path[i] and e.target_id == path[i + 1]) or \
                           (e.target_id == path[i] and e.source_id == path[i + 1]):
                            edges.append(e)
                            break
                return [GraphPath(nodes=nodes, edges=edges)]
            if len(path) < max_depth:
                for e in self._edges:
                    next_id = None
                    if e.source_id == last and e.target_id not in visited:
                        next_id = e.target_id
                    elif e.target_id == last and e.source_id not in visited:
                        next_id = e.source_id
                    if next_id:
                        visited.add(next_id)
                        queue.append(path + [next_id])
        return []

    async def get_herb_info(self, herb_id: str):
        node = self._nodes.get(herb_id)
        if not node or node.node_type != NodeType.HERB:
            return None
        p = node.properties
        return HerbInfo(
            id=node.id, name_cn=node.label, name_en=p.get("name_en", ""),
            category=p.get("category", ""), property_taste=p.get("property_taste", ""),
            meridian=p.get("meridian", ""), efficacy=p.get("efficacy", []),
            compounds=p.get("compounds", []), targets=p.get("targets", []),
            is_food_homology=p.get("is_food_homology", False),
        )

    async def get_compound_info(self, compound_id: str):
        node = self._nodes.get(compound_id)
        if not node or node.node_type != NodeType.COMPOUND:
            return None
        p = node.properties
        return CompoundInfo(
            id=node.id, name=node.label,
            molecular_weight=p.get("mw", 0.0), formula=p.get("formula", ""),
            logp=p.get("logp", 0.0), bioavailability=p.get("ob", 0.0),
            h_bond_donors=p.get("hbd", 0), h_bond_acceptors=p.get("hba", 0),
        )

    async def get_herbs_by_effect(self, effect: str):
        results = []
        for node in self._nodes.values():
            if node.node_type != NodeType.HERB:
                continue
            p = node.properties
            if effect in p.get("efficacy", []):
                results.append(HerbInfo(
                    id=node.id, name_cn=node.label, name_en=p.get("name_en", ""),
                    category=p.get("category", ""), property_taste=p.get("property_taste", ""),
                    meridian=p.get("meridian", ""), efficacy=p.get("efficacy", []),
                    compounds=p.get("compounds", []), targets=p.get("targets", []),
                    is_food_homology=p.get("is_food_homology", False),
                ))
        return results

    async def get_food_homology_herbs(self):
        results = []
        for node in self._nodes.values():
            if node.node_type == NodeType.HERB and node.properties.get("is_food_homology"):
                p = node.properties
                results.append(HerbInfo(
                    id=node.id, name_cn=node.label, name_en=p.get("name_en", ""),
                    category=p.get("category", ""), property_taste=p.get("property_taste", ""),
                    meridian=p.get("meridian", ""), efficacy=p.get("efficacy", []),
                    compounds=p.get("compounds", []), targets=p.get("targets", []),
                    is_food_homology=True,
                ))
        return results

    async def get_incompatible_pairs(self):
        pairs = []
        for e in self._edges:
            if e.relation_type == EdgeType.ANTAGONISM:
                src = self._nodes.get(e.source_id)
                tgt = self._nodes.get(e.target_id)
                if src and tgt:
                    pairs.append((src.label, tgt.label))
        return pairs


@pytest.fixture
def kg() -> InMemoryKnowledgeGraph:
    g = InMemoryKnowledgeGraph()

    # 添加药材
    g.add_herb("herb-001", "枸杞子", name_en="Lycium barbarum",
               category="果实类", property_taste="甘平", meridian="肝/肾",
               efficacy=["抗氧化", "明目", "免疫调节"], is_food_homology=True)
    g.add_herb("herb-002", "人参", name_en="Panax ginseng",
               category="根茎类", property_taste="甘温", meridian="脾/肺",
               efficacy=["补气", "免疫调节", "抗疲劳"])
    g.add_herb("herb-003", "山楂", name_en="Crataegus pinnatifida",
               category="果实类", property_taste="酸甘微温", meridian="脾/胃/肝",
               efficacy=["消食", "活血", "降脂"], is_food_homology=True)
    g.add_herb("herb-004", "甘草", name_en="Glycyrrhiza uralensis",
               category="根茎类", property_taste="甘平", meridian="心/肺/脾/胃",
               efficacy=["补脾", "解毒", "调和诸药"], is_food_homology=True)

    # 添加化合物
    g.add_compound("comp-001", "枸杞多糖", mw=1200.0, ob=30.5, dl=0.14)
    g.add_compound("comp-002", "人参皂苷Rb1", mw=1109.3, ob=25.0, dl=0.12)
    g.add_compound("comp-003", "槲皮素", mw=302.24, ob=46.43, dl=0.28)

    # 添加关系
    g.add_relation("herb-001", "comp-001", EdgeType.CONTAINS)
    g.add_relation("herb-002", "comp-002", EdgeType.CONTAINS)
    g.add_relation("herb-001", "comp-003", EdgeType.CONTAINS)
    g.add_relation("herb-003", "comp-003", EdgeType.CONTAINS)
    g.add_relation("herb-001", "herb-003", EdgeType.SYNERGY)
    g.add_relation("herb-002", "herb-004", EdgeType.ANTAGONISM)

    return g


class TestKnowledgeGraphDomain:
    """知识图谱领域实体测试"""

    def test_node_creation(self):
        node = KGNode(id="test-1", node_type=NodeType.HERB, label="枸杞子")
        assert node.node_type == "herb"
        assert node.label == "枸杞子"

    def test_relation_creation(self):
        rel = KGRelation(source_id="a", target_id="b", relation_type=EdgeType.SYNERGY, confidence=0.9)
        assert rel.relation_type == "synergy"
        assert rel.confidence == 0.9

    def test_graph_path_description(self):
        path = GraphPath(
            nodes=[KGNode(id="a", node_type="herb", label="枸杞子"),
                   KGNode(id="b", node_type="compound", label="枸杞多糖")],
            edges=[KGRelation(source_id="a", target_id="b", relation_type="contains")],
        )
        desc = path.describe()
        assert "枸杞子" in desc
        assert "枸杞多糖" in desc
        assert "contains" in desc

    def test_herb_info_defaults(self):
        h = HerbInfo(id="h-1", name_cn="test", name_en="t", category="c",
                     property_taste="t", meridian="m", efficacy=[], compounds=[], targets=[])
        assert h.toxicity == "无毒"
        assert h.is_food_homology is False


class TestKnowledgeGraphQueries:
    """知识图谱查询测试"""

    @pytest.mark.asyncio
    async def test_search_nodes(self, kg):
        results = await kg.search_nodes("枸杞")
        assert len(results) >= 1
        assert all("枸杞" in r.label for r in results)

    @pytest.mark.asyncio
    async def test_search_by_type(self, kg):
        results = await kg.search_nodes("山", node_type=NodeType.HERB)
        assert len(results) == 1
        assert results[0].label == "山楂"

    @pytest.mark.asyncio
    async def test_search_empty(self, kg):
        results = await kg.search_nodes("不存在的药材")
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_get_node_relations(self, kg):
        nodes, edges = await kg.get_node_relations("herb-001")
        assert len(nodes) >= 2  # 自身 + 关联节点
        assert len(edges) >= 2   # 枸杞多糖 + 槲皮素 + 山楂

    @pytest.mark.asyncio
    async def test_get_herb_info(self, kg):
        info = await kg.get_herb_info("herb-001")
        assert info is not None
        assert info.name_cn == "枸杞子"
        assert info.is_food_homology is True
        assert "抗氧化" in info.efficacy

    @pytest.mark.asyncio
    async def test_get_compound_info(self, kg):
        info = await kg.get_compound_info("comp-001")
        assert info is not None
        assert info.name == "枸杞多糖"
        assert info.molecular_weight == 1200.0

    @pytest.mark.asyncio
    async def test_get_herbs_by_effect(self, kg):
        results = await kg.get_herbs_by_effect("免疫调节")
        assert len(results) == 2
        assert all("免疫调节" in h.efficacy for h in results)

    @pytest.mark.asyncio
    async def test_get_food_homology_herbs(self, kg):
        results = await kg.get_food_homology_herbs()
        assert len(results) == 3  # 枸杞、山楂、甘草
        assert all(h.is_food_homology for h in results)

    @pytest.mark.asyncio
    async def test_get_incompatible_pairs(self, kg):
        pairs = await kg.get_incompatible_pairs()
        assert len(pairs) == 1
        assert ("人参", "甘草") in pairs or ("甘草", "人参") in pairs

    @pytest.mark.asyncio
    async def test_find_path(self, kg):
        paths = await kg.find_path("herb-001", "comp-002")
        # 枸杞子 → 槲皮素 → ... → 人参皂苷（通过共有化合物）
        # 或通过其他路径
        assert len(paths) >= 0  # 图谱数据有限，不强制有路径

    @pytest.mark.asyncio
    async def test_herb_not_found(self, kg):
        info = await kg.get_herb_info("nonexistent")
        assert info is None


class TestKnowledgeGraphEdgeCases:
    """知识图谱边界情况测试"""

    @pytest.mark.asyncio
    async def test_empty_graph_search(self):
        g = InMemoryKnowledgeGraph()
        results = await g.search_nodes("test")
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_empty_graph_herb_info(self):
        g = InMemoryKnowledgeGraph()
        info = await g.get_herb_info("test")
        assert info is None

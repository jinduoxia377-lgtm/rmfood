"""
知识图谱领域实体（M1.6 / ADR-004）

药食同源知识图谱的核心领域实体。
不依赖 Neo4j 或 SQLAlchemy，纯 Python。
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


class NodeType:
    """节点类型常量"""
    HERB = "herb"            # 药材
    COMPOUND = "compound"    # 化合物
    TARGET = "target"        # 靶点
    DISEASE = "disease"      # 疾病
    PEPTIDE = "peptide"      # 活性肽
    PROTEIN = "protein"      # 蛋白质
    FOOD = "food"            # 药食同源食材
    PATHWAY = "pathway"      # 代谢通路


class EdgeType:
    """关系类型常量"""
    SYNERGY = "synergy"          # 协同
    ANTAGONISM = "antagonism"    # 拮抗
    CONTAINS = "contains"        # 含有
    TARGETS = "targets"          # 作用于
    TREATS = "treats"            # 治疗
    INHIBITS = "inhibits"        # 抑制
    ACTIVATES = "activates"      # 激活
    HOMOLOGY = "homology"        # 药食同源
    SIMILAR_TO = "similar_to"    # 相似


@dataclass
class KGNode:
    """知识图谱节点"""
    id: str
    node_type: str
    label: str
    description: str = ""
    properties: dict = field(default_factory=dict)


@dataclass
class KGRelation:
    """知识图谱关系"""
    source_id: str
    target_id: str
    relation_type: str
    properties: dict = field(default_factory=dict)
    confidence: float = 1.0  # 置信度 0-1


@dataclass
class GraphPath:
    """图谱路径（用于推理链）"""
    nodes: list[KGNode]
    edges: list[KGRelation]
    total_weight: float = 0.0

    def describe(self) -> str:
        """生成路径描述"""
        parts = []
        for i, node in enumerate(self.nodes):
            parts.append(f"{node.label}({node.node_type})")
            if i < len(self.edges):
                parts.append(f"──[{self.edges[i].relation_type}]→")
        return " ".join(parts)


@dataclass
class HerbInfo:
    """药材信息（聚合）"""
    id: str
    name_cn: str
    name_en: str
    category: str          # 分类：果实/根茎/花/叶/全草
    property_taste: str    # 性味：寒/热/温/凉/平
    meridian: str          # 归经
    efficacy: list[str]    # 功效列表
    compounds: list[str]   # 主要化合物
    targets: list[str]     # 作用靶点
    is_food_homology: bool = False  # 是否药食同源
    toxicity: str = "无毒"  # 毒性


@dataclass
class CompoundInfo:
    """化合物信息"""
    id: str
    name: str
    molecular_weight: float = 0.0
    formula: str = ""
    logp: float = 0.0       # 脂水分布系数
    h_bond_donors: int = 0
    h_bond_acceptors: int = 0
    bioavailability: float = 0.0  # 口服生物利用度 OB%
    drug_likeness: float = 0.0    # 类药性 DL
    source_herbs: list[str] = field(default_factory=list)
    targets: list[str] = field(default_factory=list)

"""RMFOOD 知识图谱数据模型

存储知识图谱的节点和关系，支持：
- 药材、化合物、靶点、疾病、肽、蛋白质、食物等实体
- 协同、拮抗、含有、作用于、治疗等关系
- 图查询、路径分析、社区发现

使用方式:
    from app.models.knowledge_graph import KGNode, KGEdge
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Integer, String, Float, DateTime, JSON, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# 节点类型常量
NODE_TYPES = [
    "herb",       # 药材
    "compound",   # 化合物
    "target",     # 靶点
    "disease",    # 疾病
    "peptide",    # 活性肽
    "protein",    # 蛋白质
    "food",       # 食物（药食同源）
]

# 边类型常量
EDGE_TYPES = [
    "synergy",      # 协同作用
    "antagonism",   # 拮抗作用
    "contains",     # 含有（药材-化合物）
    "targets",      # 作用于（化合物-靶点）
    "treats",       # 治疗（药材/化合物-疾病）
    "inhibits",     # 抑制
    "activates",    # 激活
    "derived_from", # 来源于（肽-蛋白质）
    "homology",     # 药食同源
    "similar_to",   # 相似（结构/功能相似）
]


class KGNode(Base):
    """
    知识图谱节点

    存储所有类型的实体节点，包括药材、化合物、靶点等。
    使用 node_type 区分实体类型，properties 存储扩展属性。
    """
    __tablename__ = "kg_nodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 节点标识
    node_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True,
        comment="节点类型: herb/compound/target/disease/peptide/protein/food"
    )
    node_label: Mapped[str] = mapped_column(
        String(200), nullable=False, index=True,
        comment="节点标签（显示名称）"
    )

    # 扩展属性（JSON 格式，存储不同类型节点的特有属性）
    properties: Mapped[Optional[dict]] = mapped_column(
        JSON, default=dict,
        comment="节点属性（JSON）"
    )

    # 数据来源
    source: Mapped[str] = mapped_column(
        String(50), default="manual",
        comment="数据来源: tcmsp/dfbp/manual/import"
    )
    source_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True,
        comment="源系统中的ID"
    )

    # 关联数据库记录（可选）
    tcm_herb_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tcm_herbs.id", ondelete="SET NULL"), nullable=True,
        comment="关联 TCMSP 药材表"
    )
    bioactive_peptide_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("bioactive_peptides.id", ondelete="SET NULL"), nullable=True,
        comment="关联 DFBP 活性肽表"
    )

    # 元数据
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)

    # 关系
    outgoing_edges: Mapped[list["KGEdge"]] = relationship(
        "KGEdge", foreign_keys="KGEdge.source_id", back_populates="source_node",
        cascade="all, delete-orphan"
    )
    incoming_edges: Mapped[list["KGEdge"]] = relationship(
        "KGEdge", foreign_keys="KGEdge.target_id", back_populates="target_node",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        # 同类型同名节点唯一约束
        UniqueConstraint("node_type", "node_label", name="uq_kg_node_type_label"),
    )

    def __repr__(self) -> str:
        return f"<KGNode(id={self.id}, type={self.node_type}, label={self.node_label})>"

    def to_dict(self) -> dict:
        """转换为字典（用于 API 响应）"""
        return {
            "id": f"{self.node_type}_{self.node_label}",
            "node_type": self.node_type,
            "node_label": self.node_label,
            "properties": self.properties or {},
            "source": self.source,
        }


class KGEdge(Base):
    """
    知识图谱边（关系）

    存储节点之间的关系，包括协同、拮抗、含有等。
    使用 strength 表示关系强度（0-1），properties 存储扩展信息。
    """
    __tablename__ = "kg_edges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 关系端点
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("kg_nodes.id", ondelete="CASCADE"), nullable=False,
        comment="源节点ID"
    )
    target_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("kg_nodes.id", ondelete="CASCADE"), nullable=False,
        comment="目标节点ID"
    )

    # 关系类型
    edge_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True,
        comment="关系类型: synergy/antagonism/contains/targets/treats 等"
    )

    # 关系强度（0-1）
    strength: Mapped[float] = mapped_column(
        Float, default=0.0,
        comment="关系强度（0-1），用于排序和可视化"
    )

    # 扩展属性
    properties: Mapped[Optional[dict]] = mapped_column(
        JSON, default=dict,
        comment="关系属性（如 basis 证据、reference 文献等）"
    )

    # 数据来源
    source: Mapped[str] = mapped_column(
        String(50), default="manual",
        comment="数据来源: tcmsp/dfbp/manual/import"
    )

    # 元数据
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)

    # 关系
    source_node: Mapped["KGNode"] = relationship(
        "KGNode", foreign_keys=[source_id], back_populates="outgoing_edges"
    )
    target_node: Mapped["KGNode"] = relationship(
        "KGNode", foreign_keys=[target_id], back_populates="incoming_edges"
    )

    __table_args__ = (
        # 同一对节点的同类型关系唯一约束
        UniqueConstraint("source_id", "target_id", "edge_type", name="uq_kg_edge_source_target_type"),
    )

    def __repr__(self) -> str:
        return f"<KGEdge(id={self.id}, {self.source_id} -> {self.target_id}, type={self.edge_type})>"

    def to_dict(self) -> dict:
        """转换为字典（用于 API 响应）"""
        return {
            "source": self.source_node.node_label if self.source_node else str(self.source_id),
            "target": self.target_node.node_label if self.target_node else str(self.target_id),
            "type": self.edge_type,
            "strength": self.strength,
            "label": self.edge_type,
            **(self.properties or {}),
        }

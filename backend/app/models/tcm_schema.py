"""TCMSP 中药材数据库规范化模型

将原来的 JSON 字段拆分为独立的关联表，支持：
- 高效的化合物/靶点/疾病查询
- 多对多关系管理
- 数据完整性约束

表结构:
- tcm_herbs (已有) — 药材主表
- tcm_compounds — 化合物表
- tcm_targets — 靶点表
- tcm_diseases — 疾病表
- tcm_herb_compounds — 药材-化合物关联
- tcm_compound_targets — 化合物-靶点关联
- tcm_target_diseases — 靶点-疾病关联
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Integer, String, Float, Text, DateTime, JSON, Boolean, ForeignKey, Index, UniqueConstraint, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ═══════════════════════════════════════════
# 关联表（多对多）
# ═══════════════════════════════════════════

# 药材-化合物关联
tcm_herb_compounds = Table(
    "tcm_herb_compounds",
    Base.metadata,
    Column("herb_id", Integer, ForeignKey("tcm_herbs.id", ondelete="CASCADE"), primary_key=True),
    Column("compound_id", Integer, ForeignKey("tcm_compounds.id", ondelete="CASCADE"), primary_key=True),
    Column("content_percent", Float, nullable=True, comment="含量百分比"),
    Column("created_at", DateTime, default=_now),
)

# 化合物-靶点关联
tcm_compound_targets = Table(
    "tcm_compound_targets",
    Base.metadata,
    Column("compound_id", Integer, ForeignKey("tcm_compounds.id", ondelete="CASCADE"), primary_key=True),
    Column("target_id", Integer, ForeignKey("tcm_targets.id", ondelete="CASCADE"), primary_key=True),
    Column("activity_type", String(50), nullable=True, comment="活性类型: inhibitor/activator/binder"),
    Column("activity_value", Float, nullable=True, comment="活性值"),
    Column("activity_unit", String(50), nullable=True, comment="活性单位"),
    Column("evidence_source", String(100), nullable=True, comment="证据来源: TCMSP/Literature/Prediction"),
    Column("confidence", Float, default=0.0, comment="置信度 0-1"),
    Column("created_at", DateTime, default=_now),
)

# 靶点-疾病关联
tcm_target_diseases = Table(
    "tcm_target_diseases",
    Base.metadata,
    Column("target_id", Integer, ForeignKey("tcm_targets.id", ondelete="CASCADE"), primary_key=True),
    Column("disease_id", Integer, ForeignKey("tcm_diseases.id", ondelete="CASCADE"), primary_key=True),
    Column("evidence_type", String(50), nullable=True, comment="证据类型: therapeutic/association/genetic"),
    Column("confidence", Float, default=0.0, comment="置信度 0-1"),
    Column("created_at", DateTime, default=_now),
)


# ═══════════════════════════════════════════
# 化合物表
# ═══════════════════════════════════════════

class TCMCompound(Base):
    """
    TCMSP 化合物表

    存储中药材中的活性化合物，包括药代动力学属性（OB%、DL）。
    """
    __tablename__ = "tcm_compounds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 化合物标识
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True, comment="化合物名称")
    molecular_formula: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment="分子式")
    molecular_weight: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="分子量 (Da)")
    smiles: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="SMILES 结构式")
    inchi: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="InChI 标识")

    # 药代动力学属性
    ob_percent: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="口服生物利用度 OB%")
    dl_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="类药性 DL 值")
    drug_likeness: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="药物相似性分数")
    bioavailability_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="生物利用度分数")

    # 物化属性
    hba: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="氢键受体数")
    hbd: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="氢键供体数")
    logp: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="脂水分配系数 LogP")
    tpsa: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="拓扑极性表面积 TPSA")

    # 来源
    tcmsp_compound_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, unique=True, comment="TCMSP 化合物ID")
    source: Mapped[str] = mapped_column(String(50), default="tcmsp", comment="数据来源")

    # 元数据
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)

    # 关系
    herbs: Mapped[list["TCMHerb"]] = relationship(
        "TCMHerb", secondary=tcm_herb_compounds, back_populates="compounds_rel"
    )
    targets: Mapped[list["TCMTarget"]] = relationship(
        "TCMTarget", secondary=tcm_compound_targets, back_populates="compounds"
    )

    # Indexes defined via column-level index=True to avoid create_all duplicates
    # (Index objects in __table_args__ can conflict with auto-generated indexes)

    def __repr__(self) -> str:
        return f"<TCMCompound(id={self.id}, name={self.name}, OB={self.ob_percent}%)>"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "molecular_formula": self.molecular_formula,
            "molecular_weight": self.molecular_weight,
            "ob_percent": self.ob_percent,
            "dl_value": self.dl_value,
            "smiles": self.smiles,
        }


# ═══════════════════════════════════════════
# 靶点表
# ═══════════════════════════════════════════

class TCMTarget(Base):
    """
    TCMSP 靶点表

    存储药物靶点蛋白，包括基因符号、UniProt ID 等。
    """
    __tablename__ = "tcm_targets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 靶点标识
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True, comment="靶点名称")
    gene_symbol: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True, comment="基因符号")
    uniprot_id: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, unique=True, comment="UniProt ID")
    organism: Mapped[str] = mapped_column(String(100), default="Homo sapiens", comment="物种")

    # 靶点信息
    target_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="靶点类型: enzyme/receptor/ion_channel/transporter")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="靶点描述")
    pdb_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, comment="PDB 结构ID列表")

    # 来源
    source: Mapped[str] = mapped_column(String(50), default="tcmsp", comment="数据来源")

    # 元数据
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)

    # 关系
    compounds: Mapped[list["TCMCompound"]] = relationship(
        "TCMCompound", secondary=tcm_compound_targets, back_populates="targets"
    )
    diseases: Mapped[list["TCMDisease"]] = relationship(
        "TCMDisease", secondary=tcm_target_diseases, back_populates="targets"
    )

    __table_args__ = (
        # (performance indexes omitted — add via Alembic)
    )

    def __repr__(self) -> str:
        return f"<TCMTarget(id={self.id}, name={self.name}, gene={self.gene_symbol})>"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "gene_symbol": self.gene_symbol,
            "uniprot_id": self.uniprot_id,
            "target_type": self.target_type,
            "organism": self.organism,
        }


# ═══════════════════════════════════════════
# 疾病表
# ═══════════════════════════════════════════

class TCMDisease(Base):
    """
    TCMSP 疾病表

    存储与靶点相关的疾病信息。
    """
    __tablename__ = "tcm_diseases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 疾病标识
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True, comment="疾病名称")
    mesh_id: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, unique=True, comment="MeSH ID")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="疾病描述")
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment="疾病分类")

    # 来源
    source: Mapped[str] = mapped_column(String(50), default="tcmsp", comment="数据来源")

    # 元数据
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)

    # 关系
    targets: Mapped[list["TCMTarget"]] = relationship(
        "TCMTarget", secondary=tcm_target_diseases, back_populates="diseases"
    )

    def __repr__(self) -> str:
        return f"<TCMDisease(id={self.id}, name={self.name})>"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "mesh_id": self.mesh_id,
            "category": self.category,
        }


# ═══════════════════════════════════════════
# 扩展 tcm_herbs 表的关系
# ═══════════════════════════════════════════

# 注意：tcm_herbs 表已在 external_data.py 中定义
# 这里通过 Monkey-patch 添加关系（避免重复定义表）
# 实际使用时，建议将 tcm_herbs 迁移到此文件

# 延迟导入避免循环引用
def _patch_herb_relationships():
    """为 tcm_herbs 表添加化合物关系"""
    from .external_data import TCMHerb
    from sqlalchemy.orm import relationship

    # 添加化合物关系（多对多）
    if not hasattr(TCMHerb, 'compounds_rel'):
        TCMHerb.compounds_rel = relationship(
            "TCMCompound",
            secondary=tcm_herb_compounds,
            back_populates="herbs",
            lazy="selectin",
        )

# 在模块加载时执行
_patch_herb_relationships()

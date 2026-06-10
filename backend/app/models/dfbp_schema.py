"""DFBP 活性肽数据库规范化模型

将原来的单一表拆分为规范化结构，支持：
- 多种活性类型的高效查询
- 来源蛋白和水解酶的独立管理
- 活性数据的详细记录

表结构:
- bioactive_peptides (已有) — 肽主表
- peptide_activities — 肽活性数据表
- peptide_source_proteins — 来源蛋白表
- peptide_enzymes — 水解酶表
- peptide_enzyme_links — 肽-酶关联表
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Integer, String, Float, Text, DateTime, JSON, ForeignKey, Index, UniqueConstraint, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ═══════════════════════════════════════════
# 关联表（多对多）
# ═══════════════════════════════════════════

# 肽-酶关联
peptide_enzyme_links = Table(
    "peptide_enzyme_links",
    Base.metadata,
    Column("peptide_id", Integer, ForeignKey("bioactive_peptides.id", ondelete="CASCADE"), primary_key=True),
    Column("enzyme_id", Integer, ForeignKey("peptide_enzymes.id", ondelete="CASCADE"), primary_key=True),
    Column("hydrolysis_yield", Float, nullable=True, comment="水解产率 (%)"),
    Column("conditions", JSON, nullable=True, comment="水解条件 (pH, 温度, 时间)"),
    Column("created_at", DateTime, default=_now),
)


# ═══════════════════════════════════════════
# 肽活性数据表
# ═══════════════════════════════════════════

class PeptideActivity(Base):
    """
    肽活性数据表

    存储肽的多种生物活性数据，支持一对多关系。
    一个肽可以有多种活性（如同时具有 ACE 抑制和抗氧化活性）。
    """
    __tablename__ = "peptide_activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 关联肽
    peptide_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bioactive_peptides.id", ondelete="CASCADE"),
        nullable=False, index=True, comment="关联肽ID"
    )

    # 活性信息
    activity_type: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True,
        comment="活性类型: ACE inhibitory/Antioxidant/Antimicrobial/DPP-IV inhibitory/..."
    )
    activity_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="活性值")
    activity_unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="活性单位")
    activity_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="活性描述")

    # 实验条件
    assay_method: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, comment="检测方法")
    assay_conditions: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="检测条件 (pH, 温度等)")
    cell_line: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment="细胞系（如果是细胞实验）")

    # 文献引用
    reference_doi: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, comment="文献 DOI")
    reference_title: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="文献标题")
    reference_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="发表年份")

    # 元数据
    source: Mapped[str] = mapped_column(String(50), default="dfbp", comment="数据来源")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)

    # 关系
    peptide: Mapped["BioactivePeptide"] = relationship(
        "BioactivePeptide", back_populates="activities"
    )

    __table_args__ = (
        # (performance indexes omitted — add via Alembic)
    )

    def __repr__(self) -> str:
        return f"<PeptideActivity(id={self.id}, peptide_id={self.peptide_id}, type={self.activity_type})>"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "activity_type": self.activity_type,
            "activity_value": self.activity_value,
            "activity_unit": self.activity_unit,
            "assay_method": self.assay_method,
            "reference_doi": self.reference_doi,
        }


# ═══════════════════════════════════════════
# 来源蛋白表
# ═══════════════════════════════════════════

class PeptideSourceProtein(Base):
    """
    肽来源蛋白表

    存储肽的来源蛋白质信息。
    """
    __tablename__ = "peptide_source_proteins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 蛋白标识
    protein_name: Mapped[str] = mapped_column(
        String(200), nullable=False, index=True, comment="蛋白名称"
    )
    uniprot_id: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, unique=True, comment="UniProt ID"
    )
    organism: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="物种"
    )
    organism_taxid: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="物种分类ID"
    )

    # 蛋白信息
    protein_family: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="蛋白家族"
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="蛋白描述"
    )
    sequence_length: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="序列长度"
    )
    molecular_weight: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, comment="分子量 (Da)"
    )

    # 来源
    source: Mapped[str] = mapped_column(String(50), default="dfbp", comment="数据来源")

    # 元数据
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)

    def __repr__(self) -> str:
        return f"<PeptideSourceProtein(id={self.id}, name={self.protein_name})>"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "protein_name": self.protein_name,
            "uniprot_id": self.uniprot_id,
            "organism": self.organism,
            "protein_family": self.protein_family,
        }


# ═══════════════════════════════════════════
# 水解酶表
# ═══════════════════════════════════════════

class PeptideEnzyme(Base):
    """
    肽水解酶表

    存储用于制备肽的水解酶信息。
    """
    __tablename__ = "peptide_enzymes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 酶标识
    enzyme_name: Mapped[str] = mapped_column(
        String(200), nullable=False, index=True, comment="酶名称"
    )
    enzyme_type: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="酶类型: protease/peptidase/collagenase"
    )
    ec_number: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, comment="EC 编号"
    )
    organism: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="来源生物"
    )

    # 酶学参数
    optimal_ph: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="最适 pH")
    optimal_temperature: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="最适温度 (°C)")
    cleavage_sites: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, comment="切割位点特异性")

    # 来源
    source: Mapped[str] = mapped_column(String(50), default="dfbp", comment="数据来源")

    # 元数据
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)

    # 关系
    peptides: Mapped[list] = relationship(
        "BioactivePeptide",
        secondary=peptide_enzyme_links,
        back_populates="enzymes",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<PeptideEnzyme(id={self.id}, name={self.enzyme_name})>"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "enzyme_name": self.enzyme_name,
            "enzyme_type": self.enzyme_type,
            "ec_number": self.ec_number,
            "organism": self.organism,
            "optimal_ph": self.optimal_ph,
            "optimal_temperature": self.optimal_temperature,
        }


# ═══════════════════════════════════════════
# 扩展 bioactive_peptides 表的关系
# ═══════════════════════════════════════════

def _patch_peptide_relationships():
    """为 bioactive_peptides 表添加规范化关系"""
    from .external_data import BioactivePeptide
    from sqlalchemy.orm import relationship

    # 添加活性数据关系（一对多）
    if not hasattr(BioactivePeptide, 'activities'):
        BioactivePeptide.activities = relationship(
            "PeptideActivity",
            back_populates="peptide",
            cascade="all, delete-orphan",
            lazy="selectin",
        )

    # 添加酶关系（多对多）
    if not hasattr(BioactivePeptide, 'enzymes'):
        BioactivePeptide.enzymes = relationship(
            "PeptideEnzyme",
            secondary=peptide_enzyme_links,
            back_populates="peptides",
            lazy="selectin",
        )

    # 添加来源蛋白关系（多对一）
    if not hasattr(BioactivePeptide, 'source_protein_rel'):
        BioactivePeptide.source_protein_id = None  # 占位，实际需要迁移添加字段
        # BioactivePeptide.source_protein_rel = relationship(
        #     "PeptideSourceProtein",
        #     foreign_keys="BioactivePeptide.source_protein_id",
        #     lazy="selectin",
        # )

# 在模块加载时执行
_patch_peptide_relationships()

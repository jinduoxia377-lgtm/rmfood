"""RMFOOD Phase 2 外部数据模型"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, JSON, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from ..core.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class TCMHerb(Base):
    __tablename__ = "tcm_herbs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name_cn: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name_latin: Mapped[str | None] = mapped_column(String(200))
    name_pinyin: Mapped[str | None] = mapped_column(String(100))
    category: Mapped[str | None] = mapped_column(String(100))
    compounds: Mapped[list | None] = mapped_column(JSON, default=list)
    targets: Mapped[list | None] = mapped_column(JSON, default=list)
    diseases: Mapped[list | None] = mapped_column(JSON, default=list)
    ob_percent: Mapped[float | None] = mapped_column(Float)
    dl_value: Mapped[float | None] = mapped_column(Float)
    effects: Mapped[str | None] = mapped_column(Text)
    is_food_homology: Mapped[bool] = mapped_column(Boolean, default=False)
    tcmsp_id: Mapped[str | None] = mapped_column(String(50))
    source_version: Mapped[str | None] = mapped_column(String(50))
    synced_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class BioactivePeptide(Base):
    __tablename__ = "bioactive_peptides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sequence: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    source_protein: Mapped[str | None] = mapped_column(String(200))
    source_organism: Mapped[str | None] = mapped_column(String(200))
    activity_type: Mapped[str | None] = mapped_column(String(100))
    activity_value: Mapped[float | None] = mapped_column(Float)
    activity_unit: Mapped[str | None] = mapped_column(String(50))
    molecular_weight: Mapped[float | None] = mapped_column(Float)
    hydrolysis_enzyme: Mapped[str | None] = mapped_column(String(200))
    dfbp_id: Mapped[str | None] = mapped_column(String(50))
    dfbp_version: Mapped[str | None] = mapped_column(String(20))
    literature_doi: Mapped[str | None] = mapped_column(String(200))
    source_version: Mapped[str | None] = mapped_column(String(50))
    synced_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class KnowledgeGraphNode(Base):
    __tablename__ = "knowledge_graph_nodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    neo4j_id: Mapped[str | None] = mapped_column(String(50))
    node_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    node_label: Mapped[str] = mapped_column(String(200), nullable=False)
    properties: Mapped[dict | None] = mapped_column(JSON, default=dict)
    source_db: Mapped[str | None] = mapped_column(String(50))
    version: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

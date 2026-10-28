"""RMFOOD 肽序列分析模型"""
from datetime import datetime
from typing import TYPE_CHECKING, Dict, List, Optional

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.utils import now_utc_mapped

from .base import Base


class AnalysisMode(str):
    QUICK = "quick"
    DEEP = "deep"
    CUSTOM = "custom"


class DimensionType(str):
    BASIC = "basic"
    STRUCTURE = "structure"
    PHYSICOCHEMICAL = "physicochemical"
    BIOACTIVITY = "bioactivity"
    SAFETY = "safety"
    OVERALL = "overall"


if TYPE_CHECKING:
    from .formula import Peptide
    from .user_model import User


class PeptideAnalysis(Base):
    __tablename__ = "peptide_analyses"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sequence: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False, index=True)
    analysis_mode: Mapped[str] = mapped_column(
        SQLEnum(AnalysisMode.QUICK, AnalysisMode.DEEP, AnalysisMode.CUSTOM, name="analysis_mode"),
        default=AnalysisMode.QUICK,
        nullable=False
    )
    tags: Mapped[Optional[List[str]]] = mapped_column(JSON, default=list)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    peptide_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("peptides.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False, index=True)

    user: Mapped["User"] = relationship(
        "User",
        back_populates="peptide_analyses",
        foreign_keys=[user_id]
    )

    peptide: Mapped[Optional["Peptide"]] = relationship(
        "Peptide",
        back_populates="analyses"
    )

    details: Mapped[List["PeptideAnalysisDetail"]] = relationship(
        "PeptideAnalysisDetail",
        back_populates="analysis",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<PeptideAnalysis(id={self.id}, sequence='{self.sequence}', mode='{self.analysis_mode}')>"


class PeptideAnalysisDetail(Base):
    __tablename__ = "peptide_analysis_details"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    analysis_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("peptide_analyses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    dimension_type: Mapped[str] = mapped_column(
        SQLEnum(
            DimensionType.BASIC,
            DimensionType.STRUCTURE,
            DimensionType.PHYSICOCHEMICAL,
            DimensionType.BIOACTIVITY,
            DimensionType.SAFETY,
            DimensionType.OVERALL,
            name="dimension_type"
        ),
        nullable=False
    )
    data: Mapped[Dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False)

    analysis: Mapped["PeptideAnalysis"] = relationship(
        "PeptideAnalysis",
        back_populates="details"
    )

    def __repr__(self) -> str:
        return f"<PeptideAnalysisDetail(id={self.id}, dimension='{self.dimension_type}')>"

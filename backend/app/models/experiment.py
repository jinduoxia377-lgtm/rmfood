"""RMFOOD 实验模型"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, JSON, Enum, ForeignKey, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from .enums import ExperimentStatus
from app.models.utils import now_utc_mapped


class Experiment(Base):
    __tablename__ = "experiments"

    # ── 多租户隔离 ──────────────────────────────────────
    organization_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, index=True, comment="所属组织 ID，None 表示全局共享"
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ExperimentStatus] = mapped_column(
        Enum(ExperimentStatus), default=ExperimentStatus.PLANNED, nullable=False
    )
    formula_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("formulas.id", ondelete="CASCADE"), index=True)
    researcher_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), index=True)

    objectives: Mapped[list | None] = mapped_column(JSON, default=list)
    methodology: Mapped[str | None] = mapped_column(Text)
    parameters: Mapped[dict | None] = mapped_column(JSON, default=dict)
    materials: Mapped[list | None] = mapped_column(JSON, default=list)
    equipment: Mapped[list | None] = mapped_column(JSON, default=list)

    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    results: Mapped[dict | None] = mapped_column(JSON, default=dict)
    conclusions: Mapped[str | None] = mapped_column(Text)
    recommendations: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)

    formula: Mapped["Formula | None"] = relationship("Formula", back_populates="experiments")
    researcher: Mapped["User"] = relationship("User", back_populates="experiments")
    data_points: Mapped[list["ExperimentData"]] = relationship(
        "ExperimentData", back_populates="experiment", order_by="ExperimentData.created_at"
    )

    @property
    def formula_name(self) -> str | None:
        return self.formula.name if self.formula else None

    @property
    def researcher_name(self) -> str | None:
        return self.researcher.full_name or self.researcher.username if self.researcher else None


class ExperimentData(Base):
    __tablename__ = "experiment_data"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    experiment_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("experiments.id", ondelete="CASCADE"), index=True)
    parameter: Mapped[str] = mapped_column(String(200), nullable=False)
    value: Mapped[str | None] = mapped_column(String(500))
    unit: Mapped[str | None] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)

    experiment: Mapped["Experiment"] = relationship("Experiment", back_populates="data_points")


from .user_model import User
from .formula import Formula

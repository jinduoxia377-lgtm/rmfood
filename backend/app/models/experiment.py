"""RMFOOD 实验模型"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, JSON, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base
from .enums import ExperimentStatus


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ExperimentStatus] = mapped_column(
        Enum(ExperimentStatus), default=ExperimentStatus.PLANNED, nullable=False
    )
    formula_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("formulas.id"))
    researcher_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))

    objectives: Mapped[list | None] = mapped_column(JSON, default=list)
    methodology: Mapped[str | None] = mapped_column(Text)
    parameters: Mapped[dict | None] = mapped_column(JSON, default=dict)
    materials: Mapped[list | None] = mapped_column(JSON, default=list)
    equipment: Mapped[list | None] = mapped_column(JSON, default=list)

    start_date: Mapped[datetime | None] = mapped_column(DateTime)
    end_date: Mapped[datetime | None] = mapped_column(DateTime)
    actual_start: Mapped[datetime | None] = mapped_column(DateTime)
    actual_end: Mapped[datetime | None] = mapped_column(DateTime)

    results: Mapped[dict | None] = mapped_column(JSON, default=dict)
    conclusions: Mapped[str | None] = mapped_column(Text)
    recommendations: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

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

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    experiment_id: Mapped[int] = mapped_column(Integer, ForeignKey("experiments.id", ondelete="CASCADE"))
    parameter: Mapped[str] = mapped_column(String(200), nullable=False)
    value: Mapped[str | None] = mapped_column(String(500))
    unit: Mapped[str | None] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    experiment: Mapped["Experiment"] = relationship("Experiment", back_populates="data_points")


from .user_model import User
from .formula import Formula

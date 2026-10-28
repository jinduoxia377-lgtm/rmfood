"""
批记录模型
建立从配方到实物的第一次落地
"""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Column, DateTime, Enum, Float, ForeignKey, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.utils import now_utc_mapped

from .base import Base
from .enums import BatchStatus

if TYPE_CHECKING:
    from .formula import Formula
    from .ingredient_lot import IngredientLot
    from .sample import Sample

# ── 关联表（必须在模型定义前声明）──────────────────────────
batch_ingredient_lots = Table(
    "batch_ingredient_lots",
    Base.metadata,
    Column("batch_id", BigInteger, ForeignKey("batches.id", ondelete="CASCADE"), primary_key=True),
    Column("ingredient_lot_id", BigInteger, ForeignKey("ingredient_lots.id", ondelete="CASCADE"), primary_key=True),
    Column("used_qty_kg", Float, nullable=False, default=0.0),
)


class Batch(Base):
    __tablename__ = "batches"

    # ── 多租户隔离 ──────────────────────────────────────
    organization_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, index=True, comment="所属组织 ID，None 表示全局共享"
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ── 批号（人类可读） ──────────────────────────────────
    batch_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)

    # ── 关联 ──────────────────────────────────────────────
    formula_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("formulas.id", ondelete="CASCADE"), index=True)
    formula_version_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("formula_versions.id", ondelete="SET NULL"), index=True
    )

    # ── 批记录信息 ────────────────────────────────────────
    target_weight_kg: Mapped[float] = mapped_column(Float, nullable=False, comment="目标产量(kg)")
    actual_weight_kg: Mapped[float | None] = mapped_column(Float, comment="实际产量(kg)")
    yield_rate: Mapped[float | None] = mapped_column(Float, comment="产率(%)")

    # ── 状态 ──────────────────────────────────────────────
    status: Mapped[BatchStatus] = mapped_column(
        Enum(BatchStatus), default=BatchStatus.PLANNED, nullable=False
    )

    # ── 生产信息 ──────────────────────────────────────────
    prepared_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"))
    preparation_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)

    # ── 时间戳 ────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)

    # ── 关系 ──────────────────────────────────────────────
    formula: Mapped["Formula"] = relationship("Formula", back_populates="batches")
    ingredient_lots: Mapped[list["IngredientLot"]] = relationship(
        "IngredientLot",
        secondary=batch_ingredient_lots,
        back_populates="batches",
        lazy="selectin",
    )
    samples: Mapped[list["Sample"]] = relationship(
        "Sample", back_populates="batch", cascade="all, delete-orphan", order_by="Sample.created_at"
    )

    @property
    def formula_code(self) -> str | None:
        return self.formula.code if self.formula else None

    @property
    def formula_name(self) -> str | None:
        return self.formula.name if self.formula else None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "organization_id": self.organization_id,
            "batch_code": self.batch_code,
            "formula_id": self.formula_id,
            "formula_version_id": self.formula_version_id,
            "formula_code": self.formula_code,
            "formula_name": self.formula_name,
            "target_weight_kg": self.target_weight_kg,
            "actual_weight_kg": self.actual_weight_kg,
            "yield_rate": self.yield_rate,
            "status": self.status.value if hasattr(self.status, 'value') else str(self.status),
            "prepared_by": self.prepared_by,
            "preparation_date": self.preparation_date.isoformat() if self.preparation_date else None,
            "notes": self.notes,
            "sample_count": len(self.samples),
            "ingredient_lot_count": len(self.ingredient_lots),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

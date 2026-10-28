"""
原料批号模型
原料入库追踪，链接批次原料消耗
"""
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.utils import now_utc_mapped

from .base import Base
from .enums import IngredientLotStatus

if TYPE_CHECKING:
    from .batch_record import Batch
    from .formula import Ingredient


class IngredientLot(Base):
    __tablename__ = "ingredient_lots"

    # ── 多租户隔离 ──────────────────────────────────────
    organization_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, index=True, comment="所属组织 ID，None 表示全局共享"
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ── 关联 ──────────────────────────────────────────────
    ingredient_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("ingredients.id", ondelete="CASCADE"), index=True)

    # ── 批号信息 ──────────────────────────────────────────
    supplier_lot_number: Mapped[str] = mapped_column(String(100), nullable=False, comment="供应商批号")
    internal_lot_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, comment="内部批号")

    # ── 数量 ──────────────────────────────────────────────
    received_qty_kg: Mapped[float] = mapped_column(Float, nullable=False, comment="入库量(kg)")
    used_qty_kg: Mapped[float] = mapped_column(Float, default=0.0, comment="已使用量(kg)")
    remaining_qty_kg: Mapped[float] = mapped_column(Float, comment="剩余量(kg)")

    # ── 日期 ──────────────────────────────────────────────
    received_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), comment="入库日期")
    expiry_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), comment="有效期")

    # ── 状态 ──────────────────────────────────────────────
    status: Mapped[IngredientLotStatus] = mapped_column(
        Enum(IngredientLotStatus), default=IngredientLotStatus.AVAILABLE, nullable=False
    )

    # ── 文档与备注 ────────────────────────────────────────
    coa_url: Mapped[str | None] = mapped_column(String(500), comment="COA文档URL")
    notes: Mapped[str | None] = mapped_column(Text, comment="备注")

    # ── 时间戳 ────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)

    # ── 关系 ──────────────────────────────────────────────
    ingredient: Mapped["Ingredient"] = relationship("Ingredient", back_populates="ingredient_lots")
    batches: Mapped[list["Batch"]] = relationship(
        "Batch", secondary="batch_ingredient_lots", back_populates="ingredient_lots"
    )

    @property
    def ingredient_name(self) -> str | None:
        return self.ingredient.name if self.ingredient else None

    @property
    def is_expired(self) -> bool:
        if self.expiry_date is None:
            return False
        return datetime.now(timezone.utc) > self.expiry_date

    @property
    def is_available(self) -> bool:
        return self.status == IngredientLotStatus.AVAILABLE and self.remaining_qty_kg > 0

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "organization_id": self.organization_id,
            "ingredient_id": self.ingredient_id,
            "ingredient_name": self.ingredient_name,
            "supplier_lot_number": self.supplier_lot_number,
            "internal_lot_code": self.internal_lot_code,
            "received_qty_kg": self.received_qty_kg,
            "used_qty_kg": self.used_qty_kg,
            "remaining_qty_kg": self.remaining_qty_kg,
            "received_date": self.received_date.isoformat() if self.received_date else None,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "status": self.status.value if hasattr(self.status, 'value') else str(self.status),
            "coa_url": self.coa_url,
            "notes": self.notes,
            "is_expired": self.is_expired,
            "is_available": self.is_available,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

"""
样品模型
连接批次与测试结果
"""
from datetime import datetime, timezone
from sqlalchemy import BigInteger, String, Text, DateTime, JSON, ForeignKey, Float, Integer, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from .enums import SampleType
from app.models.utils import now_utc_mapped


class Sample(Base):
    __tablename__ = "samples"

    # ── 多租户隔离 ──────────────────────────────────────
    organization_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, index=True, comment="所属组织 ID，None 表示全局共享"
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ── 样品标识 ──────────────────────────────────────────
    sample_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    batch_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("batches.id", ondelete="CASCADE"), index=True)

    # ── 样品信息 ──────────────────────────────────────────
    sample_type: Mapped[SampleType] = mapped_column(
        Enum(SampleType), default=SampleType.QC, nullable=False
    )
    quantity_g: Mapped[float | None] = mapped_column(Float, comment="取样量(g)")
    storage_condition: Mapped[str | None] = mapped_column(String(100), comment="存储条件")
    aliquot_count: Mapped[int] = mapped_column(Integer, default=1, comment="分装份数")

    # ── 时间戳 ────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)

    # ── 关系 ──────────────────────────────────────────────
    batch: Mapped["Batch"] = relationship("Batch", back_populates="samples")
    test_reports: Mapped[list["TestReport"]] = relationship(
        "TestReport", back_populates="sample", cascade="all, delete-orphan", order_by="TestReport.created_at"
    )

    @property
    def batch_code(self) -> str | None:
        return self.batch.batch_code if self.batch else None

    @property
    def formula_code(self) -> str | None:
        return self.batch.formula_code if self.batch else None

    @property
    def test_count(self) -> int:
        return len(self.test_reports)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "organization_id": self.organization_id,
            "sample_code": self.sample_code,
            "batch_id": self.batch_id,
            "batch_code": self.batch_code,
            "formula_code": self.formula_code,
            "sample_type": self.sample_type.value if hasattr(self.sample_type, 'value') else str(self.sample_type),
            "quantity_g": self.quantity_g,
            "storage_condition": self.storage_condition,
            "aliquot_count": self.aliquot_count,
            "test_count": self.test_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

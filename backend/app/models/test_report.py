"""
测试报告模型
每个测试参数一条记录，携带规格判定
"""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.utils import now_utc_mapped

from .base import Base
from .enums import TestResult

if TYPE_CHECKING:
    from .sample import Sample


class TestReport(Base):
    __tablename__ = "test_reports"

    # ── 多租户隔离 ──────────────────────────────────────
    organization_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, index=True, comment="所属组织 ID，None 表示全局共享"
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ── 关联 ──────────────────────────────────────────────
    sample_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("samples.id", ondelete="CASCADE"), index=True)

    # ── 测试信息 ──────────────────────────────────────────
    parameter: Mapped[str] = mapped_column(String(200), nullable=False, index=True, comment="测试参数名")
    value: Mapped[float | None] = mapped_column(Float, comment="实测值")
    unit: Mapped[str | None] = mapped_column(String(50), comment="单位")

    # ── Spec 判定 ─────────────────────────────────────────
    spec_min: Mapped[float | None] = mapped_column(Float, comment="规格下限")
    spec_max: Mapped[float | None] = mapped_column(Float, comment="规格上限")
    result: Mapped[TestResult | None] = mapped_column(
        Enum(TestResult), default=TestResult.PENDING, nullable=True, comment="判定结果"
    )

    # ── 元数据 ────────────────────────────────────────────
    tester_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"))
    tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), comment="测试日期")
    notes: Mapped[str | None] = mapped_column(Text, comment="备注")

    # ── 时间戳 ────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)

    # ── 关系 ──────────────────────────────────────────────
    sample: Mapped["Sample"] = relationship("Sample", back_populates="test_reports")

    @property
    def is_in_spec(self) -> bool:
        if self.value is None or self.result not in (TestResult.PASS, TestResult.WARN):
            return False
        if self.spec_min is not None and self.value < self.spec_min:
            return False
        if self.spec_max is not None and self.value > self.spec_max:
            return False
        return True

    @property
    def deviation_pct(self) -> float | None:
        """相对于规格中心的偏差百分比"""
        if self.value is None or self.spec_min is None or self.spec_max is None:
            return None
        center = (self.spec_min + self.spec_max) / 2
        range_val = (self.spec_max - self.spec_min) / 2
        if range_val == 0:
            return 0.0
        return round((self.value - center) / range_val * 100, 2)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "organization_id": self.organization_id,
            "sample_id": self.sample_id,
            "parameter": self.parameter,
            "value": self.value,
            "unit": self.unit,
            "spec_min": self.spec_min,
            "spec_max": self.spec_max,
            "result": self.result.value if self.result else None,
            "is_in_spec": self.is_in_spec,
            "deviation_pct": self.deviation_pct,
            "tester_id": self.tester_id,
            "tested_at": self.tested_at.isoformat() if self.tested_at else None,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

"""
配方反馈数据模型

用于「反馈迭代闭环」：记录用户对 AI 生成配方的评分、症状变化、
客观指标更新与备注，支撑后续基于反馈的配方迭代优化。
"""
from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.utils import now_utc_mapped


class FormulaFeedback(Base):
    """配方反馈记录"""
    __tablename__ = "formula_feedback"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ── 归属 ──
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True, comment="反馈用户ID")
    organization_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, index=True, comment="租户组织ID"
    )
    formula_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True, comment="配方ID")

    # ── 反馈内容 ──
    rating: Mapped[int] = mapped_column(BigInteger, nullable=False, comment="评分 1-5")
    symptom_change: Mapped[str | None] = mapped_column(Text, nullable=True, comment="症状变化描述")
    metric_updates: Mapped[list | None] = mapped_column(JSON, default=list, comment="客观指标更新列表")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True, comment="备注")

    # ── 审计字段 ──
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False
    )

    def to_dict(self) -> dict:
        """转换为字典格式（用于 API 响应）"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "organization_id": self.organization_id,
            "formula_id": self.formula_id,
            "rating": self.rating,
            "symptom_change": self.symptom_change,
            "metric_updates": self.metric_updates or [],
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

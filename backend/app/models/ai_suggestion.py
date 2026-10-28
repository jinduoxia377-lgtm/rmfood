"""RMFOOD AI建议模型

用于AI辅助模块，存储AI生成的配方优化建议。
支持多种建议类型（成分替换、工艺改进、成本优化等），
记录置信度分数和应用状态，便于效果追踪。
"""
from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Enum, Float, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.utils import now_utc_mapped

from .base import Base
from .enums import SuggestionType


class AiSuggestion(Base):
    __tablename__ = "ai_suggestions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    prompt_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("prompt_versions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    suggestion_type: Mapped[SuggestionType] = mapped_column(Enum(SuggestionType), nullable=False)
    content: Mapped[dict] = mapped_column(JSON, nullable=False)
    confidence_score: Mapped[float | None] = mapped_column(Float)
    is_applied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False, index=True)

    prompt_version: Mapped["PromptVersion | None"] = relationship(
        "PromptVersion", back_populates="suggestions"
    )

    __table_args__ = (
        Index("idx_ai_suggestion_type_created_at", "suggestion_type", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<AiSuggestion(id={self.id}, type={self.suggestion_type.value}, confidence={self.confidence_score}, applied={self.is_applied})>"


from .prompt_version import PromptVersion

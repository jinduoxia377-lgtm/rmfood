"""RMFOOD AI建议模型

用于AI辅助模块，存储AI生成的配方优化建议。
支持多种建议类型（成分替换、工艺改进、成本优化等），
记录置信度分数和应用状态，便于效果追踪。
"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, Float, Boolean, DateTime, JSON, Enum, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base
from .enums import SuggestionType


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AiSuggestion(Base):
    __tablename__ = "ai_suggestions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prompt_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("prompt_versions.id", ondelete="SET NULL"), nullable=True
    )
    suggestion_type: Mapped[SuggestionType] = mapped_column(Enum(SuggestionType), nullable=False)
    content: Mapped[dict] = mapped_column(JSON, nullable=False)
    confidence_score: Mapped[float | None] = mapped_column(Float)
    is_applied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False, index=True)

    prompt_version: Mapped["PromptVersion | None"] = relationship(
        "PromptVersion", back_populates="suggestions"
    )

    __table_args__ = (
        Index("idx_ai_suggestion_type_created_at", "suggestion_type", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<AiSuggestion(id={self.id}, type={self.suggestion_type.value}, confidence={self.confidence_score}, applied={self.is_applied})>"


from .prompt_version import PromptVersion

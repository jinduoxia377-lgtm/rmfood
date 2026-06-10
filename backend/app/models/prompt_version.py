"""RMFOOD Prompt版本历史模型

用于AI辅助模块，记录Prompt模板的完整版本历史。
支持内容快照、差异对比和变更追踪，便于回滚和审计。
"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, JSON, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prompt_template_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("prompt_templates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content_snapshot: Mapped[str] = mapped_column(Text, nullable=False)
    diff_summary: Mapped[str | None] = mapped_column(Text)
    changelog: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)

    creator: Mapped["User | None"] = relationship("User")
    template: Mapped["PromptTemplate"] = relationship(
        "PromptTemplate", back_populates="versions"
    )
    suggestions: Mapped[list["AiSuggestion"]] = relationship(
        "AiSuggestion", back_populates="prompt_version", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_prompt_version_template_version", "prompt_template_id", "version_number"),
    )

    def __repr__(self) -> str:
        return f"<PromptVersion(id={self.id}, template_id={self.prompt_template_id}, version={self.version_number})>"


from .user_model import User
from .ai_suggestion import AiSuggestion
from .prompt_template import PromptTemplate

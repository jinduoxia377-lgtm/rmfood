"""RMFOOD Prompt模板模型

用于AI辅助模块，管理Prompt模板的基础信息。
支持多版本管理、分类标签和访问控制。
"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, JSON, ForeignKey, Boolean, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from app.models.utils import now_utc_mapped


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc_mapped, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc_mapped, onupdate=now_utc_mapped)

    creator: Mapped["User | None"] = relationship("User")
    versions: Mapped[list["PromptVersion"]] = relationship(
        "PromptVersion", back_populates="template", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<PromptTemplate(id={self.id}, name={self.name}, category={self.category})>"


from .user_model import User
from .prompt_version import PromptVersion
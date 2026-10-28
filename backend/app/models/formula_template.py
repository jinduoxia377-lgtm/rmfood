"""配方模板模型"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class FormulaTemplate(Base):
    __tablename__ = "formula_templates"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[Optional[str]] = mapped_column(String(100))
    target_effects: Mapped[list | None] = mapped_column("effects", JSON, default=list)
    ingredients: Mapped[list | None] = mapped_column(JSON, default=list)
    usage: Mapped[Optional[str]] = mapped_column(Text)
    usage_count: Mapped[int] = mapped_column(BigInteger, default=0)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[Optional[int]] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "effects": self.target_effects or [],
            "ingredients": self.ingredients or [],
            "usage": self.usage,
            "usage_count": self.usage_count,
            "is_featured": self.is_featured,
            "is_active": self.is_active,
        }

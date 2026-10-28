"""Integrations and report configs ORM models"""
from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseModel


class Integration(BaseModel):
    """Third-party integration configuration"""
    __tablename__ = "integrations"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "provider": self.provider,
            "is_active": self.is_active,
            "last_synced_at": self.last_synced_at.isoformat() if self.last_synced_at else None,
        }


class ReportConfig(BaseModel):
    """Saved report configuration"""
    __tablename__ = "report_configs"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    widgets_config: Mapped[str] = mapped_column(Text, nullable=False)  # JSON string
    filters: Mapped[str] = mapped_column(Text, default="")  # JSON string
    created_by: Mapped[int] = mapped_column(BigInteger, nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

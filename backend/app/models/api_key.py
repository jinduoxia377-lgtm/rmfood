"""API keys and webhooks ORM models"""
from datetime import datetime
from sqlalchemy import String, Text, Boolean, DateTime, Integer, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel
from .utils import now_utc_mapped


class ApiKey(BaseModel):
    """API key for programmatic access"""
    __tablename__ = "api_keys"

    organization_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    key_hash: Mapped[str] = mapped_column(String(256), unique=True, nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    permissions: Mapped[str] = mapped_column(Text, default="")

    organization: Mapped["Organization"] = relationship(
        "Organization", back_populates="api_keys",
        foreign_keys="[ApiKey.organization_id]",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "key_prefix": self.key_prefix,
            "name": self.name,
            "is_active": self.is_active,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Webhook(BaseModel):
    """Webhook subscription"""
    __tablename__ = "webhooks"

    organization_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    events: Mapped[str] = mapped_column(Text, nullable=False)  # comma-separated event types
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    secret: Mapped[str | None] = mapped_column(String(256), nullable=True)
    last_triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    deliveries: Mapped[list["WebhookDelivery"]] = relationship(
        "WebhookDelivery", back_populates="webhook", cascade="all, delete-orphan"
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "url": self.url,
            "events": self.events.split(",") if self.events else [],
            "is_active": self.is_active,
            "last_triggered_at": self.last_triggered_at.isoformat() if self.last_triggered_at else None,
        }


class WebhookDelivery(BaseModel):
    """Webhook delivery record"""
    __tablename__ = "webhook_deliveries"

    webhook_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, success, failed
    http_status: Mapped[int | None] = mapped_column(nullable=True)
    response_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)

    webhook: Mapped["Webhook"] = relationship(
        "Webhook", back_populates="deliveries"
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "webhook_id": self.webhook_id,
            "event_type": self.event_type,
            "status": self.status,
            "http_status": self.http_status,
            "retry_count": self.retry_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

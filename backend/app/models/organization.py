"""Organization and membership ORM models

Supports multi-tenant organization management.
"""
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel

if TYPE_CHECKING:
    from .api_key import ApiKey


class Organization(BaseModel):
    """Organization (tenant)"""
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    owner_id: Mapped[int] = mapped_column(BigInteger, nullable=True, index=True)

    # ── 订阅/版本与扩展（ORM 与迁移 20260819_000000 及 multi_tenant_service
    #    INSERT/读取 org.plan、org.settings 对齐；缺失曾致 create_all 建库缺列、
    #   org.plan/org.settings 运行期 AttributeError）──
    plan: Mapped[str] = mapped_column(String(20), default="free", nullable=False)
    settings: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    members: Mapped[List["OrganizationMember"]] = relationship(
        "OrganizationMember", back_populates="organization", cascade="all, delete-orphan",
        foreign_keys="[OrganizationMember.organization_id]",
    )

    api_keys: Mapped[List["ApiKey"]] = relationship(
        "ApiKey", back_populates="organization", cascade="all, delete-orphan",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "is_active": self.is_active,
            "owner_id": self.owner_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class OrganizationMember(BaseModel):
    """Organization membership"""
    __tablename__ = "organization_members"

    organization_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("organizations.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(50), default="member", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    organization: Mapped["Organization"] = relationship(
        "Organization", back_populates="members",
        foreign_keys="[OrganizationMember.organization_id]",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "organization_id": self.organization_id,
            "user_id": self.user_id,
            "role": self.role,
            "is_active": self.is_active,
        }


class Subscription(BaseModel):
    """Organization subscription / billing plan"""
    __tablename__ = "subscriptions"

    organization_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    plan: Mapped[str] = mapped_column(String(20), default="free", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)  # active/canceled/expired/trial
    billing_cycle: Mapped[str | None] = mapped_column(String(10), default="monthly")  # monthly/yearly
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payment_provider: Mapped[str | None] = mapped_column(String(30), default="mock")
    external_id: Mapped[str | None] = mapped_column(String(128))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "organization_id": self.organization_id,
            "plan": self.plan,
            "status": self.status,
            "billing_cycle": self.billing_cycle,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "payment_provider": self.payment_provider,
            "external_id": self.external_id,
        }


class BillingOrder(BaseModel):
    """Billing order (mock payment in current phase)"""
    __tablename__ = "billing_orders"

    organization_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    plan: Mapped[str] = mapped_column(String(20), nullable=False)
    billing_cycle: Mapped[str] = mapped_column(String(10), default="monthly")
    amount_cents: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="CNY")
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending/paid/failed/canceled
    provider_order_id: Mapped[str | None] = mapped_column(String(128))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "organization_id": self.organization_id,
            "plan": self.plan,
            "billing_cycle": self.billing_cycle,
            "amount_cents": self.amount_cents,
            "currency": self.currency,
            "status": self.status,
            "provider_order_id": self.provider_order_id,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class OrganizationInvitation(BaseModel):
    """Organization member invitation (for users not yet registered / not yet accepted)"""
    __tablename__ = "organization_invitations"

    organization_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), default="member", nullable=False)
    token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)  # pending/accepted/expired
    invited_by: Mapped[int | None] = mapped_column(BigInteger)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "organization_id": self.organization_id,
            "email": self.email,
            "role": self.role,
            "token": self.token,
            "status": self.status,
            "invited_by": self.invited_by,
            "accepted_at": self.accepted_at.isoformat() if self.accepted_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

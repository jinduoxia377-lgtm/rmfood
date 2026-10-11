"""Organization and membership ORM models

Supports multi-tenant organization management.
"""
from datetime import datetime
from sqlalchemy import String, Integer, Text, Boolean, BigInteger, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List

from .base import BaseModel
from .utils import now_utc_mapped
from .enums import UserRole


class Organization(BaseModel):
    """Organization (tenant)"""
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    owner_id: Mapped[int] = mapped_column(BigInteger, nullable=True, index=True)

    members: Mapped[List["OrganizationMember"]] = relationship(
        "OrganizationMember", back_populates="organization", cascade="all, delete-orphan",
        foreign_keys="[OrganizationMember.organization_id]",
    )

    api_keys: Mapped[List["ApiKey"]] = relationship(
        "ApiKey", back_populates="organization", cascade="all, delete-orphan",
        foreign_keys="[ApiKey.organization_id]",
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

    organization_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
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

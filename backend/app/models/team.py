"""RMFOOD 团队模型

用于团队协作模块，管理团队基本信息、设置和归档状态。
支持团队级别的配方共享、权限管理和协作工作流。
"""
from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.utils import now_utc_mapped

from .base import Base


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    owner_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    org_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    settings: Mapped[dict | None] = mapped_column(JSON, default=dict)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False)

    owner: Mapped["User"] = relationship("User", foreign_keys=[owner_id], back_populates="owned_teams")
    members: Mapped[list["TeamMember"]] = relationship(
        "TeamMember", back_populates="team", cascade="all, delete-orphan", lazy="selectin"
    )

    __table_args__ = (
        Index("idx_team_owner_id_created_at", "owner_id", "created_at"),
        Index("idx_teams_org_id", "org_id"),
    )

    def __repr__(self) -> str:
        return f"<Team(id={self.id}, name='{self.name}', owner_id={self.owner_id}, archived={self.is_archived})>"


from .team_member import TeamMember  # noqa: E402
from .user_model import User  # noqa: E402

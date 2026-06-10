"""RMFOOD 团队模型

用于团队协作模块，管理团队基本信息、设置和归档状态。
支持团队级别的配方共享、权限管理和协作工作流。
"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, Boolean, DateTime, JSON, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    settings: Mapped[dict | None] = mapped_column(JSON, default=dict)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)

    owner: Mapped["User"] = relationship("User", foreign_keys=[owner_id], back_populates="owned_teams")
    members: Mapped[list["TeamMember"]] = relationship(
        "TeamMember", back_populates="team", cascade="all, delete-orphan", lazy="selectin"
    )

    __table_args__ = (
        Index("idx_team_owner_id_created_at", "owner_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Team(id={self.id}, name='{self.name}', owner_id={self.owner_id}, archived={self.is_archived})>"


from .user_model import User
from .team_member import TeamMember

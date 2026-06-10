"""RMFOOD 团队成员模型

用于团队协作模块，管理团队成员的权限角色和邀请关系。
支持 owner/admin/member/guest 四级权限体系。
"""
from datetime import datetime, timezone
from sqlalchemy import Integer, DateTime, Enum, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base
from .enums import TeamRole


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[TeamRole] = mapped_column(Enum(TeamRole), default=TeamRole.MEMBER, nullable=False)
    invited_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)

    team: Mapped["Team"] = relationship("Team", back_populates="members")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="team_memberships")
    inviter: Mapped["User | None"] = relationship("User", foreign_keys=[invited_by])

    __table_args__ = (
        UniqueConstraint("team_id", "user_id", name="uq_team_user"),
        Index("idx_team_member_team_id_joined_at", "team_id", "joined_at"),
    )

    def __repr__(self) -> str:
        return f"<TeamMember(id={self.id}, team_id={self.team_id}, user_id={self.user_id}, role={self.role.value})>"


from .team import Team
from .user_model import User

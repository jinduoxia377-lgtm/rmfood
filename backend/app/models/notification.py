"""RMFOOD 通知模型（扩展版）

用于云端同步、团队协作和AI辅助模块的通知系统。
支持多种通知类型（系统、团队邀请、同步状态、AI任务完成等），
包含丰富的元数据和已读状态追踪。
"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, JSON, Enum, Boolean, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base
from .enums import NotificationType, NotificationStatus


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType), default=NotificationType.SYSTEM, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON, default=dict)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False, index=True)

    user: Mapped["User"] = relationship("User", back_populates="notifications")

    __table_args__ = (
        Index("idx_notification_user_read_created", "user_id", "is_read", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Notification(id={self.id}, user_id={self.user_id}, type={self.type.value}, read={self.is_read})>"


from .user_model import User

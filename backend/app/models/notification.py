"""RMFOOD 通知模型（扩展版）

用于云端同步、团队协作和AI辅助模块的通知系统。
支持多种通知类型（系统、团队邀请、同步状态、AI任务完成等），
包含丰富的元数据和已读状态追踪。
"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, JSON, Boolean, ForeignKey, Index, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from .enums import NotificationType, NotificationStatus
from app.models.utils import now_utc_mapped


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[NotificationType] = mapped_column(
        String(50), default=NotificationType.SYSTEM.value, nullable=False
    )
    # ── 已读状态（双字段同步） ──
    # status 枚举是权威来源，is_read 是派生字段用于查询性能
    status: Mapped[NotificationStatus] = mapped_column(
        String(20), default=NotificationStatus.UNREAD.value, nullable=False
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(500))
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False, index=True)

    user: Mapped["User"] = relationship("User", back_populates="notifications")

    __table_args__ = (
        Index("idx_notification_user_read_created", "user_id", "is_read", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Notification(id={self.id}, user_id={self.user_id}, type={self.type.value}, read={self.is_read})>"


from .user_model import User


class NotificationPreference(Base):
    """User notification preferences"""
    __tablename__ = "notification_preferences"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False, index=True)
    # data 列用于存储完整的偏好快照（历史遗留 schema，NOT NULL）
    data: Mapped[dict] = mapped_column("data", JSON, default=dict, nullable=False)
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    in_app_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    webhook_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False)

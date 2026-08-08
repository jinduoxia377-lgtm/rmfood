"""RMFOOD 同步日志模型

用于云端同步模块，记录所有数据同步操作的详细日志。
支持冲突检测、操作审计和同步状态追踪。
"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, JSON, Enum, ForeignKey, Index, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from .enums import SyncAction, SyncStatus
from app.models.utils import now_utc_mapped


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    device_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("user_devices.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[SyncAction] = mapped_column(Enum(SyncAction), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[int | None] = mapped_column(BigInteger)
    payload: Mapped[dict | None] = mapped_column(JSON)
    status: Mapped[SyncStatus] = mapped_column(Enum(SyncStatus), default=SyncStatus.PENDING, nullable=False)
    error_msg: Mapped[str | None] = mapped_column(Text)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False, index=True)

    user: Mapped["User"] = relationship("User", back_populates="sync_logs")
    device: Mapped["UserDevice | None"] = relationship("UserDevice", back_populates="sync_logs")

    __table_args__ = (
        Index("idx_sync_log_user_timestamp", "user_id", "timestamp"),
        Index("idx_sync_log_entity", "entity_type", "entity_id"),
    )

    def __repr__(self) -> str:
        return f"<SyncLog(id={self.id}, user_id={self.user_id}, action={self.action.value}, entity={self.entity_type}:{self.entity_id}, status={self.status.value})>"


from .user_model import User
from .user_device import UserDevice

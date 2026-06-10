"""RMFOOD 用户设备模型

用于云端同步模块，记录用户的设备信息，支持多设备同步和冲突检测。
"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Boolean, DateTime, Enum, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base
from .enums import DeviceType


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class UserDevice(Base):
    __tablename__ = "user_devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    device_type: Mapped[DeviceType] = mapped_column(Enum(DeviceType), nullable=False)
    device_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="devices")
    sync_logs: Mapped[list["SyncLog"]] = relationship(
        "SyncLog", back_populates="device", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_user_device_user_id_created_at", "user_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<UserDevice(id={self.id}, device_id='{self.device_id}', user_id={self.user_id}, type={self.device_type.value})>"


from .user_model import User
from .sync_log import SyncLog

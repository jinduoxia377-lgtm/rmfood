"""RMFOOD 变更数据捕获 (CDC) 模型

记录所有数据库表的变更事件，支持：
- 实时数据同步
- WebSocket 推送
- 审计追踪
- 数据回滚

使用 SQLAlchemy 事件监听器自动捕获变更。
"""
import enum
from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, String
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.utils import now_utc_mapped

from .base import Base


class ChangeAction(str, enum.Enum):
    """变更操作类型"""
    INSERT = "INSERT"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


class ChangeEvent(Base):
    """
    变更事件表

    记录所有表的数据变更，用于：
    1. 实时推送 — WebSocket 广播变更到相关用户
    2. 增量同步 — 云端同步的变更队列
    3. 审计追踪 — 完整的数据变更历史
    4. 数据回滚 — 基于 old_values 恢复数据
    """
    __tablename__ = "change_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # 变更实体信息
    entity_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True,
        comment="变更实体类型（表名）"
    )
    entity_id: Mapped[int] = mapped_column(
        BigInteger, nullable=False, index=True,
        comment="变更实体ID"
    )

    # 变更操作
    action: Mapped[ChangeAction] = mapped_column(
        SQLEnum(ChangeAction), nullable=False,
        comment="变更操作类型"
    )

    # 变更详情
    changed_fields: Mapped[list | None] = mapped_column(
        JSON, default=list,
        comment="变更的字段列表"
    )
    old_values: Mapped[dict | None] = mapped_column(
        JSON, default=dict,
        comment="变更前的值（UPDATE/DELETE 时记录）"
    )
    new_values: Mapped[dict | None] = mapped_column(
        JSON, default=dict,
        comment="变更后的值（INSERT/UPDATE 时记录）"
    )

    # 操作人信息
    user_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        comment="操作人ID"
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(45), nullable=True,
        comment="操作人IP地址"
    )

    # 元数据
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata", JSON, default=dict,
        comment="附加元数据"
    )

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, nullable=False, index=True,
        comment="变更时间"
    )

    # 关系
    user: Mapped["User | None"] = relationship("User", foreign_keys=[user_id])

    # Indexes omitted from __table_args__ to prevent duplicate creation during create_all
    # (performance indexes can be added via Alembic migrations)

    def __repr__(self) -> str:
        return (
            f"<ChangeEvent(id={self.id}, entity={self.entity_type}:{self.entity_id}, "
            f"action={self.action.value}, user_id={self.user_id})>"
        )

    def to_dict(self) -> dict:
        """转换为字典（用于 WebSocket 推送）"""
        return {
            "id": self.id,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "action": self.action.value,
            "changed_fields": self.changed_fields,
            "old_values": self.old_values,
            "new_values": self.new_values,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


from .user_model import User

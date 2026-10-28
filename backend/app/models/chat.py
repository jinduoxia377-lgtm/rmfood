"""RMFOOD 对话记录模型

用于存储AI对话历史记录，支持会话管理、消息存储和导出功能。
"""
from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.utils import now_utc_mapped

from .base import Base


class ChatSession(Base):
    """对话会话模型

    存储一个完整的对话会话，包含标题、创建时间、消息数量等元数据。
    """
    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # DS Bot 移植：单 Bot 对话复用会话表，bot_id 为空表示普通 AI 会话
    bot_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("ai_bots.id", ondelete="SET NULL"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    tags: Mapped[list[str] | None] = mapped_column(JSON, default=[])
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False)

    # 关系
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.timestamp")

    def to_dict(self) -> dict:
        """转换为字典，包含基本信息"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "message_count": self.message_count,
            "is_active": self.is_active,
            "tags": self.tags or [],
            "metadata": self.metadata_ or {},
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class ChatMessage(Base):
    """对话消息模型

    存储单条对话消息，包含角色、内容、时间戳和扩展元数据。
    """
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # user, assistant, system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False, index=True)

    # v7.1 新增字段
    is_edited: Mapped[bool] = mapped_column(Boolean, default=False)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    original_content: Mapped[str | None] = mapped_column(Text)
    is_withdrawn: Mapped[bool] = mapped_column(Boolean, default=False)
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    withdraw_reason: Mapped[str | None] = mapped_column(String(255))
    reply_to: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("chat_messages.id"), index=True)
    quote_content: Mapped[str | None] = mapped_column(Text)
    rating: Mapped[str | None] = mapped_column(String(10))  # up, down
    feedback: Mapped[str | None] = mapped_column(Text)
    is_bookmarked: Mapped[bool] = mapped_column(Boolean, default=False)
    bookmark_note: Mapped[str | None] = mapped_column(String(500))
    message_tags: Mapped[list[str] | None] = mapped_column("tags", JSON, default=[])
    message_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, default=dict)

    # 关系
    session = relationship("ChatSession", back_populates="messages")
    replied_message = relationship("ChatMessage", remote_side=[id], uselist=False)

    def to_dict(self, include_all: bool = True) -> dict:
        """转换为字典"""
        base = {
            "id": self.id,
            "session_id": self.session_id,
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
        }

        if include_all:
            base.update({
                "is_edited": self.is_edited,
                "edited_at": self.edited_at.isoformat() if self.edited_at else None,
                "original_content": self.original_content,
                "is_withdrawn": self.is_withdrawn,
                "withdrawn_at": self.withdrawn_at.isoformat() if self.withdrawn_at else None,
                "withdraw_reason": self.withdraw_reason,
                "reply_to": self.reply_to,
                "quote_content": self.quote_content,
                "rating": self.rating,
                "feedback": self.feedback,
                "is_bookmarked": self.is_bookmarked,
                "bookmark_note": self.bookmark_note,
                "tags": self.message_tags or [],
                "metadata": self.message_metadata or {},
            })

        return base

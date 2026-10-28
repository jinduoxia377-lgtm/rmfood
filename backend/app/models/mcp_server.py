"""MCP 服务器注册表模型（v3.3：AI 员工外部能力）。

记录可被 Bot 连接的外部 MCP 服务器（HTTP/SSE 传输）：
- 租户隔离（tenant_id + visibility）
- 工具白名单（allow_tools，空=全部）
- 认证 token 加密存储
"""
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.utils import now_utc_mapped

from .base import Base


class McpServerConfig(Base):
    """外部 MCP 服务器配置"""

    __tablename__ = "ai_mcp_servers"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)

    name: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, comment="服务器标识，如 pubmed",
    )
    transport: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="http", comment="http | sse | stdio",
    )
    url: Mapped[str] = mapped_column(
        String(512), nullable=True, comment="MCP 服务器端点 URL（HTTP/SSE）",
    )
    command: Mapped[str | None] = mapped_column(
        String(512), nullable=True, comment="stdio 传输的启动命令（如 npx ...）",
    )
    headers: Mapped[list | None] = mapped_column(
        JSON, nullable=True, default=list, comment="自定义请求头（JSON 对象）",
    )
    auth_token_encrypted: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="AES 加密后的认证 Token",
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=sa.text("true"),
    )
    allow_tools: Mapped[list | None] = mapped_column(
        JSON, nullable=True, default=list, comment="允许的工具名白名单（空=全部）",
    )
    visibility: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="org", comment="org | private",
    )
    created_by: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped,
        nullable=False,
    )

    __table_args__ = (
        Index("ix_ai_mcp_servers_tenant_enabled", "tenant_id", "enabled"),
    )

    def to_dict(self, include_secret: bool = False) -> dict[str, Any]:
        d: dict[str, Any] = {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "name": self.name,
            "transport": self.transport,
            "url": self.url,
            "command": self.command,
            "headers": self.headers or {},
            "enabled": self.enabled,
            "allow_tools": self.allow_tools or [],
            "visibility": self.visibility,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "auth_token_configured": bool(self.auth_token_encrypted),
        }
        if include_secret and self.auth_token_encrypted:
            d["auth_token_present"] = True
        return d

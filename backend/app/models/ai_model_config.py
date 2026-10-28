"""AI 模型配置持久化模型

存储多 Provider 的 API 配置、认证方式、模型映射和兜底链，
替代纯内存配置，支持后端重启后自动恢复。
"""
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy import JSON, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.utils import now_utc_mapped

from .base import Base


class AIModelConfig(Base):
    """AI 模型配置 — 多 Provider、多格式、含兜底链的持久化配置表。

    每个 (tenant_id, model_type) 对应一条记录，覆盖：
    - api_format: openai | anthropic | gemini | azure | custom
    - auth_method: api_key | bearer_token | header
    - auth_header_name: 自定义 Header 名称（header 模式时生效）
    - base_url: API 基础地址
    - provider: 提供商标识（deepseek / openai / zhipu / qwen / azure …）
    - default_model: 首选模型 ID
    - fallback_models: 兜底模型 ID 列表（按优先级）
    - temperature / max_tokens / top_p / stream_enabled
    - created_at / updated_at
    """

    __tablename__ = "ai_model_configs"

    id: Mapped[int] = mapped_column(
        sa.BigInteger, primary_key=True, autoincrement=True,
    )

    # ── 租户隔离 ──────────────────────────────────────────────────
    tenant_id: Mapped[int] = mapped_column(
        sa.BigInteger, nullable=False, index=True,
        comment="关联 tenants.id，默认租户为 1",
    )
    # ── 模型类型标识 ──────────────────────────────────────────────
    # 与前端 ModelType 保持一致
    model_type: Mapped[str] = mapped_column(
        sa.String(64), nullable=False,
        comment="formula_gpt | llm | synergy_net | safety_checker | taste_predictor | stability_model | peptide_scorer",
    )
    # ── API 格式 ──────────────────────────────────────────────────
    api_format: Mapped[str] = mapped_column(
        sa.String(32), nullable=False, server_default="openai",
        comment="openai | anthropic | gemini | azure | custom",
    )
    # ── 认证方式 ──────────────────────────────────────────────────
    auth_method: Mapped[str] = mapped_column(
        sa.String(32), nullable=False, server_default="api_key",
        comment="api_key | bearer_token | header",
    )
    auth_header_name: Mapped[str | None] = mapped_column(
        sa.String(64), nullable=True, default=None,
        comment="自定义认证 Header 名称（header 模式时有效）",
    )
    # ── 基础地址 ──────────────────────────────────────────────────
    base_url: Mapped[str] = mapped_column(
        sa.String(512), nullable=False, server_default="https://api.deepseek.com/v1",
    )
    # ── Provider ──────────────────────────────────────────────────
    provider: Mapped[str] = mapped_column(
        sa.String(64), nullable=False, server_default="deepseek",
    )
    # ── 模型映射 ──────────────────────────────────────────────────
    # [{"id": "deepseek-chat", "display_name": "DeepSeek Chat"}, ...]
    models: Mapped[list] = mapped_column(
        JSON, nullable=False, server_default="[]",
    )
    # ── 默认模型 ──────────────────────────────────────────────────
    default_model: Mapped[str] = mapped_column(
        sa.String(128), nullable=False, server_default="deepseek-chat",
    )
    # ── 兜底模型列表（按优先级） ─────────────────────────────────
    fallback_models: Mapped[list] = mapped_column(
        JSON, nullable=False, server_default="[]",
    )
    # ── 推理参数 ──────────────────────────────────────────────────
    temperature: Mapped[float] = mapped_column(
        sa.Float, nullable=False, server_default="0.7",
    )
    max_tokens: Mapped[int] = mapped_column(
        # P1-4 修复（2026-10-26）：server_default 由 "4096" 提到 "16000"。
        # 旧值与代码层 ModelConfig.max_tokens 默认 16000
        # （app/services/ai_model_config_service.py）矛盾，导致新租户 / 新 model_type /
        # 全新安装的首次种子（get_or_create 不显式传 max_tokens，靠本默认值兜底）
        # 静默拿到 4096，专业配方卡 JSON 会被截断。
        # 线上数据订正见 alembic/versions/20261026_010000_bump_max_tokens_default.py。
        sa.Integer, nullable=False, server_default="16000",
    )
    top_p: Mapped[float] = mapped_column(
        sa.Float, nullable=False, server_default="0.9",
    )
    stream_enabled: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default="false",
    )
    # ── 请求策略 ──────────────────────────────────────────────────
    timeout_ms: Mapped[int] = mapped_column(
        sa.Integer, nullable=False, server_default="30000",
    )
    max_retries: Mapped[int] = mapped_column(
        sa.Integer, nullable=False, server_default="3",
    )
    # ── 并发限制 ──────────────────────────────────────────────────
    concurrency_limit: Mapped[int] = mapped_column(
        sa.Integer, nullable=False, server_default="3",
        comment="最大并发请求数（1-10）",
    )
    # ── 加密 API Key ─────────────────────────────────────────────
    api_key_encrypted: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="AES-256-GCM 加密后的 API Key（非明文）",
    )
    # ── 时间戳 ───────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False,
    )

    __table_args__ = (
        sa.UniqueConstraint("tenant_id", "model_type", name="uq_ai_model_config_tenant_model"),
        sa.Index("ix_ai_model_config_tenant", "tenant_id"),
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "model_type": self.model_type,
            "api_format": self.api_format,
            "auth_method": self.auth_method,
            "auth_header_name": self.auth_header_name,
            "base_url": self.base_url,
            "provider": self.provider,
            "models": self.models or [],
            "default_model": self.default_model,
            "fallback_models": self.fallback_models or [],
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "top_p": self.top_p,
            "stream_enabled": self.stream_enabled,
            "timeout_ms": self.timeout_ms,
            "max_retries": self.max_retries,
            "concurrency_limit": self.concurrency_limit,
            "api_key_encrypted": self.api_key_encrypted is not None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

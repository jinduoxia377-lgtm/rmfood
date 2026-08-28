"""add ai_model_configs table for persistent multi-provider LLM configuration

Revision ID: 20260821_150000_add_ai_model_configs
Revises: 20260821_140000_add_peptide_batch_coa
Create Date: 2026-08-21 15:00:00

新增 AI 模型配置持久化表：
- ai_model_configs: 支持多 Provider、API 格式、认证方式、模型映射、兜底链
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20260821_150000_add_ai_model_configs'
down_revision: Union[str, None] = '20260821_140000_add_peptide_batch_coa'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_model_configs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.BigInteger(), nullable=False, index=True),
        sa.Column("model_type", sa.String(64), nullable=False,
                  comment="formula_gpt | llm | synergy_net | safety_checker | taste_predictor | stability_model | peptide_scorer"),
        sa.Column("api_format", sa.String(32), nullable=False, server_default="openai",
                  comment="openai | anthropic | gemini | azure | custom"),
        sa.Column("auth_method", sa.String(32), nullable=False, server_default="api_key",
                  comment="api_key | bearer_token | header"),
        sa.Column("auth_header_name", sa.String(64), nullable=True,
                  comment="自定义认证 Header 名称（header 模式时有效）"),
        sa.Column("base_url", sa.String(512), nullable=False, server_default="https://api.deepseek.com/v1"),
        sa.Column("provider", sa.String(64), nullable=False, server_default="deepseek"),
        sa.Column("models", sa.JSON(), nullable=False, server_default="[]",
                  comment="可用模型列表 [{id, display_name}]"),
        sa.Column("default_model", sa.String(128), nullable=False, server_default="deepseek-chat"),
        sa.Column("fallback_models", sa.JSON(), nullable=False, server_default="[]",
                  comment="兜底模型 ID 列表（按优先级）"),
        sa.Column("temperature", sa.Float(), nullable=False, server_default="0.7"),
        sa.Column("max_tokens", sa.Integer(), nullable=False, server_default="4096"),
        sa.Column("top_p", sa.Float(), nullable=False, server_default="0.9"),
        sa.Column("stream_enabled", sa.Boolean(), nullable=False, server_default=False),
        sa.Column("timeout_ms", sa.Integer(), nullable=False, server_default="30000"),
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("api_key_encrypted", sa.Text(), nullable=True,
                  comment="AES-256-GCM 加密后的 API Key"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.UniqueConstraint("tenant_id", "model_type", name="uq_ai_model_config_tenant_model"),
        sa.Index("ix_ai_model_config_tenant", "tenant_id"),
    )


def downgrade() -> None:
    op.drop_table("ai_model_configs")

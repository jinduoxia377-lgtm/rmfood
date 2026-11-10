"""add rag_knowledge_sources (本草古籍书目元数据表)

Revision ID: 20261105_000001
Revises: 20261102_000002
Create Date: 2026-11-05

背景:
    42 部本草古籍已导入 ChromaDB（backend/data/chromadb_v2，user_id="system"，
    15,658 块），但 PostgreSQL 无书目登记。本迁移新建 rag_knowledge_sources，
    用于 SQL 查询 / 审计 / 分块统计；数据回填由独立脚本负责，本迁移不写入数据。

幂等性:
    - 表：inspect(bind).has_table() 判定，已存在则跳过 CREATE TABLE。
    - 索引：CREATE [UNIQUE] INDEX IF NOT EXISTS，可重复执行。
    - 历史遗留：生产库曾出现 alembic stamp 跳过 DDL 的情况，故 DDL 不以
      alembic_version 为唯一事实来源；执行后须用
      to_regclass('public.rag_knowledge_sources') + information_schema.columns 复核。
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261105_000001"
down_revision = "20261102_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if not insp.has_table("rag_knowledge_sources"):
        op.create_table(
            "rag_knowledge_sources",
            sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
            sa.Column("source", sa.String(255), nullable=False),
            sa.Column("title", sa.String(128), nullable=False),
            sa.Column("dynasty", sa.String(32), nullable=True),
            sa.Column("author", sa.String(64), nullable=True),
            sa.Column(
                "category",
                sa.String(32),
                nullable=False,
                server_default=sa.text("'ancient_book'"),
            ),
            sa.Column("display_name", sa.String(255), nullable=True),
            sa.Column("chunk_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("char_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("checksum", sa.String(64), nullable=True),
            sa.Column("user_id", sa.String(64), nullable=False, server_default=sa.text("'system'")),
            sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column(
                "imported_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.PrimaryKeyConstraint("id", name="pk_rag_knowledge_sources"),
        )

    # 索引与模型 __table__ 生成的名称保持一致（否则 autogenerate 会反复报差异）
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_rag_knowledge_sources_source "
        "ON rag_knowledge_sources (source)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_rag_knowledge_sources_category "
        "ON rag_knowledge_sources (category)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_rag_knowledge_sources_dynasty "
        "ON rag_knowledge_sources (dynasty)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS rag_knowledge_sources CASCADE")

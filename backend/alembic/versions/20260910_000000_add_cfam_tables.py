"""add hf_enriched_herbs and rmchm_herbs tables for CFAM

Revision ID: 20260910_000000_add_cfam_tables
Revises: 20260823_000000_add_concurrency_limit
Create Date: 2026-09-10 00:00:00

新增药食同源数据表：
- hf_enriched_herbs: 增强版药食同源表（106种官方目录）
- rmchm_herbs: 莱茵中药材数据库
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20260910_000000_add_cfam_tables'
down_revision: Union[str, None] = '20260823_000000_add_concurrency_limit'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ═══════════════════════════════════════════
    # hf_enriched_herbs: 药食同源增强表
    # ═══════════════════════════════════════════
    op.create_table(
        "hf_enriched_herbs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("source_id", sa.String(50), unique=True, index=True),
        # 基础名称
        sa.Column("name_cn", sa.String(100), nullable=False, index=True),
        sa.Column("name_en", sa.String(200)),
        sa.Column("latin_name", sa.String(200)),
        # 传统属性
        sa.Column("nature_cn", sa.String(200)),  # 四气
        sa.Column("flavor_cn", sa.String(200)),  # 五味
        sa.Column("meridians_cn", sa.String(500)),  # 归经
        # 分类
        sa.Column("category", sa.String(100), index=True),
        # 现代药学数据
        sa.Column("ob_percent", sa.Float()),
        sa.Column("dl_value", sa.Float()),
        sa.Column("is_food_homology", sa.Boolean(), server_default="true"),
        sa.Column("is_toxic", sa.Boolean(), server_default="false"),
        # 网络药理数据
        sa.Column("compounds", sa.JSON(), server_default="[]"),
        sa.Column("targets", sa.JSON(), server_default="[]"),
        sa.Column("diseases", sa.JSON(), server_default="[]"),
        sa.Column("compound_count", sa.Integer(), server_default="0"),
        sa.Column("target_count", sa.Integer(), server_default="0"),
        sa.Column("disease_count", sa.Integer(), server_default="0"),
        # 官方合规信息
        sa.Column("approval_date", sa.DateTime()),
        sa.Column("status", sa.String(100)),
        sa.Column("max_dosage", sa.String(100)),
        sa.Column("restrictions", sa.JSON(), server_default="[]"),
        sa.Column("usage_forms", sa.JSON(), server_default="[]"),
        sa.Column("notes", sa.Text()),
        # 图片资源
        sa.Column("image_path", sa.String(500)),
        sa.Column("image_source", sa.String(50)),
        # 交叉引用
        sa.Column("tcmsp_id", sa.String(50), index=True),
        sa.Column("symmap_id", sa.Integer(), index=True),
        sa.Column("mmid_pid", sa.String(20)),
        # 元数据
        sa.Column("data_quality_score", sa.Float()),
        sa.Column("source_version", sa.String(50)),
        sa.Column("synced_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )

    # ═══════════════════════════════════════════
    # rmchm_herbs: 莱茵中药材数据库
    # ═══════════════════════════════════════════
    op.create_table(
        "rmchm_herbs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        # 唯一标识
        sa.Column("rmchm_id", sa.String(8), nullable=False, unique=True, index=True),
        sa.Column("rmchm_code", sa.String(20), nullable=False, unique=True, index=True),
        # 基础名称
        sa.Column("name_cn", sa.String(200), nullable=False, index=True),
        sa.Column("name_pinyin", sa.String(200)),
        sa.Column("name_latin", sa.String(300)),
        sa.Column("name_eng", sa.String(300)),
        # 传统属性
        sa.Column("nature_cn", sa.String(1000)),  # 四气
        sa.Column("nature_eng", sa.String(500)),
        sa.Column("meridians_cn", sa.String(1000)),  # 归经
        sa.Column("meridians_eng", sa.String(500)),
        sa.Column("category_cn", sa.String(100)),
        sa.Column("category_eng", sa.String(100)),
        sa.Column("use_part", sa.String(100)),  # 药用部位
        sa.Column("alias", sa.Text()),  # 别名
        sa.Column("function_cn", sa.Text()),  # 功效
        # 现代药理学
        sa.Column("ob_percent", sa.Float()),
        sa.Column("dl_value", sa.Float()),
        sa.Column("is_food_homology", sa.Boolean(), server_default="false"),
        sa.Column("is_toxic", sa.Boolean(), server_default="false"),
        # 交叉引用
        sa.Column("tcmsp_id", sa.Integer(), index=True),
        sa.Column("symmap_id", sa.Integer(), index=True),
        # 统计信息
        sa.Column("compounds_count", sa.Integer(), server_default="0"),
        sa.Column("targets_count", sa.Integer(), server_default="0"),
        sa.Column("diseases_count", sa.Integer(), server_default="0"),
        # 图片资源
        sa.Column("image_path", sa.String(500)),
        sa.Column("image_source", sa.String(50)),
        # 质量评估
        sa.Column("data_quality_score", sa.Float()),
        # 元数据
        sa.Column("source_versions", sa.JSON()),
        sa.Column("synced_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )

    # 添加索引
    op.create_index("ix_hf_enriched_herbs_name_cn", "hf_enriched_herbs", ["name_cn"])
    op.create_index("ix_hf_enriched_herbs_category", "hf_enriched_herbs", ["category"])
    op.create_index("ix_rmchm_herbs_name_cn", "rmchm_herbs", ["name_cn"])
    op.create_index("ix_rmchm_herbs_rmchm_id", "rmchm_herbs", ["rmchm_id"])
    op.create_index("ix_rmchm_herbs_rmchm_code", "rmchm_herbs", ["rmchm_code"])


def downgrade() -> None:
    op.drop_table("rmchm_herbs")
    op.drop_table("hf_enriched_herbs")

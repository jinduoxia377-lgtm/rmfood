"""add peptide_structure_analyses table

Revision ID: 20260918_000000_add_peptide_structure_analysis
Revises: 20260910_000000_add_cfam_tables
Create Date: 2026-09-18 00:00:00

新增肽链结构分析历史表：
- peptide_structure_analyses: 存储每次序列分析的完整结果
- 支持历史记录查询和批量分析任务管理
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20260918_000000_add_peptide_structure_analysis'
down_revision: Union[str, None] = '20260910_000000_add_cfam_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "peptide_structure_analyses",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        # 分析结果核心字段
        sa.Column("sequence", sa.String(500), nullable=False),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        # 结构转换结果
        sa.Column("smiles", sa.Text(), nullable=True),
        sa.Column("selfies", sa.Text(), nullable=True),
        # 理化性质
        sa.Column("molecular_weight", sa.Float(), server_default="0"),
        sa.Column("isoelectric_point", sa.Float(), server_default="0"),
        sa.Column("hydrophobicity", sa.Float(), server_default="0"),
        # 活性预测
        sa.Column("ace_inhibition_score", sa.Float(), server_default="0"),
        sa.Column("antioxidant_score", sa.Float(), server_default="0"),
        sa.Column("antimicrobial_score", sa.Float(), server_default="0"),
        # 安全性评估
        sa.Column("is_allergen", sa.Boolean(), server_default="false"),
        sa.Column("is_toxic", sa.Boolean(), server_default="false"),
        sa.Column("digestibility", sa.String(20), server_default="'unknown'"),
        # 风味预测
        sa.Column("bitterness_score", sa.Float(), server_default="0"),
        sa.Column("umami_potential", sa.Float(), server_default="0"),
        # 综合评分
        sa.Column("food_safety_score", sa.Float(), server_default="0"),
        # 来源信息
        sa.Column("source_food", sa.String(200), nullable=True),
        sa.Column("source_database", sa.String(100), nullable=True),
        sa.Column("literature_refs", sa.JSON(), server_default="[]"),
        # 元数据
        sa.Column("n_terminal_mod", sa.String(20), nullable=True),
        sa.Column("c_terminal_mod", sa.String(20), nullable=True),
        sa.Column("unusual_aas", sa.JSON(), server_default="[]"),
        # 分析状态
        sa.Column("status", sa.String(20), server_default="'completed'"),
        sa.Column("error_message", sa.Text(), nullable=True),
        # 时间戳
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    
    # 创建索引
    op.create_index("ix_peptide_structure_seq", "peptide_structure_analyses", ["sequence"])
    op.create_index("ix_peptide_structure_user_time", "peptide_structure_analyses", ["user_id", "created_at"])
    op.create_index("ix_peptide_structure_score", "peptide_structure_analyses", ["food_safety_score"])


def downgrade() -> None:
    op.drop_table("peptide_structure_analyses")

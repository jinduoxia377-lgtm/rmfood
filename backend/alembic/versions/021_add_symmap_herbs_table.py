"""添加 SymMap 中药材数据库表

Revision ID: 021_add_symmap_herbs_table
Revises: 020_add_share_fields
Create Date: 2026-07-03

SymMap 是北京中医药大学、中国科学院计算技术研究所、北京交通大学联合构建的
中药-化合物-靶点-疾病对称图谱数据库。

本迁移创建 symmap_herbs 表，存储 698 种药材的传统中药数据，
并通过 TCMSP_id 等字段与现有 tcm_herbs、mmid_herbs 表建立关联。
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "021_add_symmap_herbs_table"
down_revision = "020_add_share_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """创建 symmap_herbs 表"""
    op.create_table(
        "symmap_herbs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("symmap_id", sa.Integer(), nullable=False, unique=True, index=True, comment="SymMap 内部ID"),
        sa.Column("name_cn", sa.String(100), nullable=False, index=True, comment="中文名"),
        sa.Column("name_pinyin", sa.String(100), comment="拼音"),
        sa.Column("name_latin", sa.String(300), comment="拉丁名"),
        sa.Column("name_eng", sa.String(300), comment="英文名"),
        sa.Column("nature_cn", sa.String(200), comment="性味（中文）"),
        sa.Column("nature_eng", sa.String(200), comment="性味（英文）"),
        sa.Column("meridians_cn", sa.String(200), comment="归经（中文）"),
        sa.Column("meridians_eng", sa.String(200), comment="归经（英文）"),
        sa.Column("category_cn", sa.String(100), comment="分类（中文）"),
        sa.Column("category_eng", sa.String(100), comment="分类（英文）"),
        sa.Column("use_part", sa.String(100), comment="药用部位"),
        sa.Column("tcmsp_id", sa.Integer(), index=True, comment="TCMSP ID"),
        sa.Column("tcmid_id", sa.Integer(), comment="TCMID ID"),
        sa.Column("tcmid2_id", sa.Integer(), comment="TCM-ID ID"),
        sa.Column("herbdb_id", sa.String(100), comment="HERBDB ID"),
        sa.Column("alias", sa.String(300), comment="别名"),
        sa.Column("source_version", sa.String(50)),
        sa.Column("synced_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    """删除 symmap_herbs 表"""
    op.drop_table("symmap_herbs")

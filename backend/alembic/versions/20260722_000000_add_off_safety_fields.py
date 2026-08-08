"""添加 OpenFoodFacts 食品安全字段

Revision ID: 031_add_off_safety_fields
Revises: 030_add_openfoodfacts_support
Create Date: 2026-07-22

新增 retail_products 表 5 列：
  - allergens_tags TEXT[]  — 过敏原标签（牛奶、坚果、麸质等）
  - additives_tags TEXT[]  — 添加剂标签
  - ecoscore_grade VARCHAR(20) — 生态评分等级 (a/b/c/d/e)
  - traces_tags TEXT[]     — 潜在交叉污染物质
  - contaminants TEXT[]    — 污染物标签

并为 allergens_tags / additives_tags 创建 GIN 索引支持数组查询。
"""

from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as psql

revision = '20260722_000000_add_off_safety_fields'
down_revision = '20260720_020000_add_openfoodfacts_support'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. 新增 5 个列
    op.add_column('retail_products',
                  sa.Column('allergens_tags', psql.ARRAY(sa.Text()), nullable=True))
    op.add_column('retail_products',
                  sa.Column('additives_tags', psql.ARRAY(sa.Text()), nullable=True))
    op.add_column('retail_products',
                  sa.Column('ecoscore_grade', sa.String(20), nullable=True))
    op.add_column('retail_products',
                  sa.Column('traces_tags', psql.ARRAY(sa.Text()), nullable=True))
    op.add_column('retail_products',
                  sa.Column('contaminants', psql.ARRAY(sa.Text()), nullable=True))

    # 2. 为过敏原和添加剂数组创建 GIN 索引，支持 && 查询
    op.execute(
        "CREATE INDEX IF NOT EXISTS gin_rp_allergens "
        "ON retail_products USING gin(allergens_tags)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS gin_rp_additives "
        "ON retail_products USING gin(additives_tags)"
    )


def downgrade() -> None:
    # 删除索引
    op.drop_index("gin_rp_additives", table_name="retail_products")
    op.drop_index("gin_rp_allergens", table_name="retail_products")

    # 删除列（从后往前，避免依赖问题）
    op.drop_column('retail_products', 'contaminants')
    op.drop_column('retail_products', 'traces_tags')
    op.drop_column('retail_products', 'ecoscore_grade')
    op.drop_column('retail_products', 'additives_tags')
    op.drop_column('retail_products', 'allergens_tags')

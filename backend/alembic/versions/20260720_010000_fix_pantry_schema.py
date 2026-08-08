"""修正 user_pantry 表结构为 item-level 一对多

Revision ID: 029_fix_pantry_schema
Revises: 028_enable_pgvector
Create Date: 2026-07-20

将 user_pantry 从 user-level (arrays) 改为 item-level (每行一个收藏项)。
旧表的 food_material_ids 等数组列废弃，改为统一的 item_type + item_id。
"""

from alembic import op
import sqlalchemy as sa

revision = '20260720_010000_fix_pantry_schema'
down_revision = '20260720_000000_enable_pgvector'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. 创建新的 item-level 结构
    op.create_table(
        'user_pantry_items',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.BigInteger(), nullable=False, index=True),
        sa.Column('item_type', sa.String(50), nullable=False, comment='food_material | retail_product | herb | peptide'),
        sa.Column('item_id', sa.BigInteger(), nullable=False, comment='对应表的 ID'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
        sa.UniqueConstraint('user_id', 'item_type', 'item_id', name='uq_pantry_item'),
    )

    # 2. 迁移旧数据到新表 (将 food_material_ids 数组拆分为多行)
    op.execute("""
        INSERT INTO user_pantry_items (user_id, item_type, item_id, created_at)
        SELECT
            user_id,
            'food_material',
            UNNEST(food_material_ids::bigint[]),
            created_at
        FROM user_pantry
        WHERE food_material_ids IS NOT NULL
          AND array_length(food_material_ids, 1) > 0
    """)

    # 3. 废弃旧表的数组列 (保留表结构和偏好设置列)
    op.execute("ALTER TABLE user_pantry DROP COLUMN IF EXISTS food_material_ids")

    # 4. 添加用户偏好设置表
    op.create_table(
        'user_preferences',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.BigInteger(), nullable=False, unique=True, index=True),
        sa.Column('preferred_categories', sa.ARRAY(sa.String()), server_default='{}'),
        sa.Column('avoid_ingredients', sa.ARRAY(sa.Text()), server_default='{}'),
        sa.Column('dietary_restrictions', sa.ARRAY(sa.String()), server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
    )

    # 5. 迁移旧表的偏好设置
    op.execute("""
        INSERT INTO user_preferences (user_id, preferred_categories, avoid_ingredients, dietary_restrictions)
        SELECT
            user_id,
            preferred_categories,
            avoid_ingredients,
            dietary_restrictions
        FROM user_pantry
        WHERE user_id IS NOT NULL
          AND (preferred_categories IS NOT NULL OR avoid_ingredients IS NOT NULL OR dietary_restrictions IS NOT NULL)
        ON CONFLICT (user_id) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_table('user_preferences')
    op.drop_table('user_pantry_items')
    op.execute("ALTER TABLE user_pantry ADD COLUMN food_material_ids BIGINT[]")

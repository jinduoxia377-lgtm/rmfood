"""Open Food Facts 数据接入支持表 + 索引

Revision ID: 030_add_openfoodfacts_support
Revises: 029_fix_pantry_schema
Create Date: 2026-07-20

新增:
1. off_sync_state 表 — 同步状态追踪
2. off_import_errors 表 — 导入错误日志
3. retail_products 新索引 — data_quality, crawl_timestamp, source+external_id, key_ingredients GIN
"""

from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as psql

revision = '20260720_020000'
down_revision = '20260720_010000_fix_pantry_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. 同步状态追踪表
    op.create_table(
        'off_sync_state',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('source', sa.String(50), server_default='openfoodfacts'),
        sa.Column('last_sync_date', sa.Date()),
        sa.Column('last_processed_barcode', sa.String(100)),
        sa.Column('total_processed', sa.Integer(), server_default='0'),
        sa.Column('total_updated', sa.Integer(), server_default='0'),
        sa.Column('total_failed', sa.Integer(), server_default='0'),
        sa.Column('status', sa.String(20), server_default='idle'),
        sa.Column('started_at', sa.DateTime(timezone=True)),
        sa.Column('completed_at', sa.DateTime(timezone=True)),
        sa.Column('error_message', sa.Text()),
    )

    # 2. 错误日志表
    op.create_table(
        'off_import_errors',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('barcode', sa.String(100)),
        sa.Column('error_type', sa.String(50)),
        sa.Column('error_message', sa.Text()),
        sa.Column('raw_data', psql.JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
    )

    # 3. 新索引
    op.execute("CREATE INDEX IF NOT EXISTS idx_rp_data_quality ON retail_products(data_quality)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_rp_crawl_timestamp ON retail_products(crawl_timestamp)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_rp_source_external ON retail_products(source, external_id)")
    # key_ingredients 是 JSON 类型，GIN 索引需要 jsonb，先转换
    op.execute("ALTER TABLE retail_products ALTER COLUMN key_ingredients TYPE jsonb USING key_ingredients::jsonb")
    op.execute("CREATE INDEX IF NOT EXISTS gin_rp_key_ingredients ON retail_products USING gin(key_ingredients)")


def downgrade() -> None:
    op.drop_index("gin_rp_key_ingredients", table_name="retail_products")
    op.drop_index("idx_rp_source_external", table_name="retail_products")
    op.drop_index("idx_rp_crawl_timestamp", table_name="retail_products")
    op.drop_index("idx_rp_data_quality", table_name="retail_products")
    # 回退 key_ingredients 类型
    op.execute("ALTER TABLE retail_products ALTER COLUMN key_ingredients TYPE json USING key_ingredients::json")
    op.drop_table('off_import_errors')
    op.drop_table('off_sync_state')

"""启用 pgvector 扩展 + 升级 embedding 列类型

Revision ID: 028_enable_pgvector
Revises: 027_potion_vft_integration
Create Date: 2026-07-20

升级说明:
1. 将 food_materials.embedding 和 retail_products.embedding 升级为 VECTOR(512)
2. 创建 HNSW 向量索引
3. 创建 FTS tsvector 列和 GIN 索引
"""

import sqlalchemy as sa
from alembic import op
import sqlalchemy.dialects.postgresql as psql

revision = '20260720_000000_enable_pgvector'
down_revision = '20260718_000000_potion_vft_integration'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # 检查 pgvector 是否可用
    pgvector_available = False
    try:
        result = conn.execute(sa.text("SELECT 1 FROM pg_extension WHERE extname = 'vector'"))
        pgvector_available = bool(result.fetchone())
    except Exception:
        pass

    if pgvector_available:
        # 1. food_materials embedding 列升级
        op.execute("ALTER TABLE food_materials ALTER COLUMN embedding TYPE TEXT USING embedding::text")
        op.execute("ALTER TABLE food_materials ALTER COLUMN embedding TYPE vector(512) USING embedding::vector")
        op.execute("""
            CREATE INDEX IF NOT EXISTS idx_fm_embedding_hnsw
            ON food_materials USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
        """)

        # 2. retail_products embedding 列升级
        op.execute("ALTER TABLE retail_products ALTER COLUMN embedding TYPE TEXT USING embedding::text")
        op.execute("ALTER TABLE retail_products ALTER COLUMN embedding TYPE vector(512) USING embedding::vector")
        op.execute("""
            CREATE INDEX IF NOT EXISTS idx_rp_embedding_hnsw
            ON retail_products USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
        """)

    # 3. FTS tsvector 列和 GIN 索引
    op.execute("ALTER TABLE food_materials ADD COLUMN IF NOT EXISTS search_vector tsvector")
    op.execute("CREATE INDEX IF NOT EXISTS idx_fm_search_vector ON food_materials USING GIN (search_vector)")
    op.execute("ALTER TABLE retail_products ADD COLUMN IF NOT EXISTS search_vector tsvector")
    op.execute("CREATE INDEX IF NOT EXISTS idx_rp_search_vector ON retail_products USING GIN (search_vector)")

    # 4. 触发器函数 (使用 sa.text 避免转义问题)
    conn.execute(sa.text("""
        CREATE OR REPLACE FUNCTION fm_update_search_vector() RETURNS TRIGGER AS $func$
        BEGIN
            NEW.search_vector := to_tsvector('simple',
                COALESCE(NEW.name_cn, '') || ' ' ||
                COALESCE(NEW.name_en, '') || ' ' ||
                COALESCE(NEW.name_latin, '') || ' ' ||
                COALESCE(NEW.category, '') || ' ' ||
                COALESCE(NEW.sub_category, '') || ' ' ||
                COALESCE(NEW.description, '') || ' ' ||
                COALESCE(NEW.indications, '') || ' ' ||
                COALESCE(array_to_string(NEW.aliases, ' '), '') || ' ' ||
                COALESCE(array_to_string(NEW.effects, ' '), '')
            );
            RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql
    """))
    conn.execute(sa.text("DROP TRIGGER IF EXISTS fm_search_vector_trigger ON food_materials"))
    conn.execute(sa.text("""
        CREATE TRIGGER fm_search_vector_trigger
        BEFORE INSERT OR UPDATE ON food_materials
        FOR EACH ROW EXECUTE FUNCTION fm_update_search_vector()
    """))

    conn.execute(sa.text("""
        CREATE OR REPLACE FUNCTION rp_update_search_vector() RETURNS TRIGGER AS $func$
        BEGIN
            NEW.search_vector := to_tsvector('simple',
                COALESCE(NEW.product_name, '') || ' ' ||
                COALESCE(NEW.brand, '') || ' ' ||
                COALESCE(NEW.category, '') || ' ' ||
                COALESCE(NEW.sub_category, '') || ' ' ||
                COALESCE(NEW.full_ingredients, '') || ' ' ||
                COALESCE(NEW.formulation_type, '') || ' ' ||
                COALESCE(array_to_string(NEW.effects, ' '), '')
            );
            RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql
    """))
    conn.execute(sa.text("DROP TRIGGER IF EXISTS rp_search_vector_trigger ON retail_products"))
    conn.execute(sa.text("""
        CREATE TRIGGER rp_search_vector_trigger
        BEFORE INSERT OR UPDATE ON retail_products
        FOR EACH ROW EXECUTE FUNCTION rp_update_search_vector()
    """))

    # 5. VACUUM ANALYZE (需要在事务外执行，跳过)
    # op.execute("VACUUM ANALYZE food_materials")
    # op.execute("VACUUM ANALYZE retail_products")


def downgrade() -> None:
    # 删除触发器和函数
    conn = op.get_bind()
    conn.execute(sa.text("DROP TRIGGER IF EXISTS fm_search_vector_trigger ON food_materials"))
    conn.execute(sa.text("DROP TRIGGER IF EXISTS rp_search_vector_trigger ON retail_products"))
    conn.execute(sa.text("DROP FUNCTION IF EXISTS fm_update_search_vector()"))
    conn.execute(sa.text("DROP FUNCTION IF EXISTS rp_update_search_vector()"))

    # 删除 FTS 列和索引
    op.execute("DROP INDEX IF EXISTS idx_fm_search_vector")
    op.execute("DROP INDEX IF EXISTS idx_rp_search_vector")
    op.execute("ALTER TABLE food_materials DROP COLUMN IF EXISTS search_vector")
    op.execute("ALTER TABLE retail_products DROP COLUMN IF EXISTS search_vector")

    # 删除向量索引
    op.execute("DROP INDEX IF EXISTS idx_fm_embedding_hnsw")
    op.execute("DROP INDEX IF EXISTS idx_rp_embedding_hnsw")

    # 回退 embedding 类型
    op.execute("ALTER TABLE food_materials ALTER COLUMN embedding TYPE json USING embedding::text")
    op.execute("ALTER TABLE retail_products ALTER COLUMN embedding TYPE json USING embedding::text")

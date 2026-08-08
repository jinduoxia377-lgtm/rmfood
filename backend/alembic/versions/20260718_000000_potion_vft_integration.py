"""Potion AI VFT 融合模块: 食品原料 + 零售产品搜索表

Revision ID: 027_potion_vft_integration
Revises: f21c3fe4ee7b
Create Date: 2026-07-18
"""

import sqlalchemy as sa
from alembic import op
import sqlalchemy.dialects.postgresql as psql

revision = '20260718_000000_potion_vft_integration'
down_revision = '20260708_183155_extra_knowledge_source'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 使用 raw SQL 创建所有表，完全控制列定义 ──
    
    # 1. food_materials
    op.execute("""
        CREATE TABLE food_materials (
            id BIGSERIAL PRIMARY KEY,
            external_id VARCHAR(100) UNIQUE,
            gb_code VARCHAR(50),
            name_cn VARCHAR(200) NOT NULL,
            name_latin VARCHAR(200),
            name_en VARCHAR(200),
            aliases TEXT[] DEFAULT '{}'::text[],
            category VARCHAR(100),
            sub_category VARCHAR(100),
            food_homology BOOLEAN DEFAULT FALSE,
            toxicity_class VARCHAR(20),
            active_ingredients TEXT[] DEFAULT '{}'::text[],
            compound_refs BIGINT[] DEFAULT '{}'::bigint[],
            effects TEXT[] DEFAULT '{}'::text[],
            indications TEXT,
            ob_percent FLOAT,
            dl_value FLOAT,
            bioavailability_score FLOAT,
            safe_dose_min FLOAT,
            safe_dose_max FLOAT,
            contraindications TEXT[] DEFAULT '{}'::text[],
            interactions TEXT[] DEFAULT '{}'::text[],
            regulatory_status VARCHAR(50),
            approved_regions VARCHAR[] DEFAULT '{}'::varchar[],
            max_daily_intake VARCHAR(50),
            suppliers JSON DEFAULT '{}'::json,
            origin_countries VARCHAR[] DEFAULT '{}'::varchar[],
            description TEXT,
            image_url VARCHAR(500),
            msds_url VARCHAR(500),
            coa_url VARCHAR(500),
            embedding JSON,
            source_db VARCHAR(50) DEFAULT 'manual',
            data_quality FLOAT DEFAULT 1.0,
            review_status VARCHAR(20) DEFAULT 'pending',
            reviewed_by BIGINT,
            reviewed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            created_by BIGINT
        )
    """)
    op.execute("CREATE INDEX idx_fm_name_cn ON food_materials(name_cn)")
    op.execute("CREATE INDEX idx_fm_category ON food_materials(category)")
    op.execute("CREATE INDEX idx_fm_food_homology ON food_materials(food_homology)")

    # 2. retail_products
    op.execute("""
        CREATE TABLE retail_products (
            id BIGSERIAL PRIMARY KEY,
            external_id VARCHAR(100) UNIQUE,
            sku VARCHAR(100),
            brand VARCHAR(200) NOT NULL,
            product_name VARCHAR(500) NOT NULL,
            product_line VARCHAR(200),
            category VARCHAR(100),
            sub_category VARCHAR(100),
            formulation_type VARCHAR(50),
            effects TEXT[] DEFAULT '{}'::text[],
            target_population TEXT[] DEFAULT '{}'::text[],
            full_ingredients TEXT,
            key_ingredients JSON DEFAULT '{}'::json,
            material_refs BIGINT[] DEFAULT '{}'::bigint[],
            peptide_refs BIGINT[] DEFAULT '{}'::bigint[],
            compound_refs BIGINT[] DEFAULT '{}'::bigint[],
            price FLOAT,
            currency VARCHAR(3) DEFAULT 'CNY',
            package_size VARCHAR(50),
            volume_ml FLOAT,
            weight_g FLOAT,
            sales_channels VARCHAR[] DEFAULT '{}'::varchar[],
            avg_rating FLOAT,
            review_count BIGINT,
            monthly_sales BIGINT,
            image_urls TEXT[] DEFAULT '{}'::text[],
            reg_type VARCHAR(20),
            approved_region VARCHAR(50),
            embedding JSON,
            source VARCHAR(50) DEFAULT 'crawl',
            crawl_timestamp TIMESTAMPTZ,
            data_quality FLOAT DEFAULT 1.0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            created_by BIGINT
        )
    """)
    op.execute("CREATE INDEX idx_rp_brand ON retail_products(brand)")
    op.execute("CREATE INDEX idx_rp_name ON retail_products(product_name)")
    op.execute("CREATE INDEX idx_rp_category ON retail_products(category)")

    # 3. search_history 表（全新创建）
    op.create_table(
        'search_history',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.BigInteger(), nullable=False, index=True),
        sa.Column('query', sa.String(500), nullable=False),
        sa.Column('query_normalized', sa.String(500)),
        sa.Column('search_type', sa.String(50), server_default='general'),
        sa.Column('filters', sa.JSON),
        sa.Column('result_count', sa.Integer(), server_default='0'),
        sa.Column('results_json', sa.JSON),
        sa.Column('response_time_ms', sa.Integer()),
        sa.Column('created_at', sa.DateTime(timezone=True)),
    )

    # 4. hot_search_queries
    op.create_table(
        'hot_search_queries',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('query', sa.String(200), nullable=False, unique=True),
        sa.Column('search_count', sa.Integer(), server_default='0'),
        sa.Column('trend_score', sa.Float(), server_default='0.0'),
        sa.Column('last_used_at', sa.DateTime(timezone=True)),
        sa.Column('is_hot', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True)),
    )

    # 5. user_pantry
    op.create_table(
        'user_pantry',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.BigInteger(), nullable=False, index=True),
        sa.Column('food_material_ids', psql.ARRAY(sa.BigInteger())),
        sa.Column('preferred_categories', psql.ARRAY(sa.String())),
        sa.Column('avoid_ingredients', psql.ARRAY(sa.Text())),
        sa.Column('dietary_restrictions', psql.ARRAY(sa.String())),
        sa.Column('created_at', sa.DateTime(timezone=True)),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table('user_pantry')
    op.drop_table('hot_search_queries')
    op.drop_table('search_history')
    op.drop_table('retail_products')
    op.drop_table('food_materials')

"""sync herb/whitelist schema to match current models

Revision ID: 20261030_000001
Revises: 20261030_000000
Create Date: 2026-10-30 21:35:00

生产库与模型不同步修复（幂等，IF NOT EXISTS）：
- rmchm_herbs: 补 function_en (TEXT)、source_versions (JSON)，并迁移 source_info 数据
- hf_enriched_herbs: 建表（若缺），列与 HFEHerb 模型一致
- pre_register_requests: 补 review_deadline (TIMESTAMPTZ)
"""
from alembic import op

revision = '20261030_000001'
down_revision = '20261030_000000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. rmchm_herbs: function_en + source_versions
    op.execute("ALTER TABLE rmchm_herbs ADD COLUMN IF NOT EXISTS function_en TEXT")
    op.execute("ALTER TABLE rmchm_herbs ADD COLUMN IF NOT EXISTS source_versions JSON")
    # 迁移旧列 source_info 数据（若有）
    op.execute(
        "UPDATE rmchm_herbs SET source_versions = source_info "
        "WHERE source_versions IS NULL AND source_info IS NOT NULL"
    )

    # 2. hf_enriched_herbs 建表（与 HFEHerb 模型一致）
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS hf_enriched_herbs (
            id BIGSERIAL PRIMARY KEY,
            source_id VARCHAR(50) UNIQUE,
            name_cn VARCHAR(100) NOT NULL,
            name_en VARCHAR(200),
            latin_name VARCHAR(200),
            nature_cn VARCHAR(200),
            flavor_cn VARCHAR(200),
            meridians_cn VARCHAR(500),
            category VARCHAR(100),
            ob_percent FLOAT,
            dl_value FLOAT,
            is_food_homology BOOLEAN DEFAULT true,
            is_toxic BOOLEAN DEFAULT false,
            compounds JSON DEFAULT '[]',
            targets JSON DEFAULT '[]',
            diseases JSON DEFAULT '[]',
            compound_count INTEGER DEFAULT 0,
            target_count INTEGER DEFAULT 0,
            disease_count INTEGER DEFAULT 0,
            approval_date TIMESTAMP,
            status VARCHAR(100),
            max_dosage VARCHAR(100),
            restrictions JSON DEFAULT '[]',
            usage_forms JSON DEFAULT '[]',
            notes TEXT,
            image_path VARCHAR(500),
            image_source VARCHAR(50),
            tcmsp_id VARCHAR(50),
            symmap_id INTEGER,
            mmid_pid VARCHAR(20),
            data_quality_score FLOAT,
            source_version VARCHAR(50),
            synced_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_hf_enriched_herbs_name_cn "
        "ON hf_enriched_herbs(name_cn)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_hf_enriched_herbs_category "
        "ON hf_enriched_herbs(category)"
    )

    # 3. pre_register_requests: review_deadline
    op.execute(
        "ALTER TABLE pre_register_requests "
        "ADD COLUMN IF NOT EXISTS review_deadline TIMESTAMPTZ"
    )


def downgrade() -> None:
    # 不回滚（同步修复迁移），保持幂等
    pass

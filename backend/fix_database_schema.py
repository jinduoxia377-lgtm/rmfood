"""
完整数据库模式同步脚本
修复 formulas 和 formula_versions 表的列名不匹配问题
"""
import asyncpg
import asyncio
import sys
import os

async def sync_all_schemas():
    # Read DB config from .env
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    db_url = 'postgresql://postgres:password@localhost:5432/rmfood'
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('DATABASE_URL='):
                    db_url = line.split('=', 1)[1].strip().replace('"', '').replace("'", '')
                    break
    # Remove +asyncpg suffix
    db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')

    print(f"[INFO] Connecting to database...")
    conn = await asyncpg.connect(db_url)

    try:
        # =========================================
        # Fix formulas table
        # =========================================
        print("\n=== Fixing formulas table ===")

        # Get existing columns
        existing = await conn.fetch(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'formulas'"
        )
        existing_cols = {row['column_name'] for row in existing}

        # Expected columns (based on Formula model)
        expected_formulas = [
            ('organization_id', 'BIGINT'),
            ('code', 'VARCHAR(50)'),
            ('description', 'TEXT'),
            ('status', 'VARCHAR(50)'),
            ('version', 'INTEGER'),
            ('target_effects', 'JSON'),
            ('composition', 'JSON'),
            ('processing_method', 'TEXT'),
            ('dosage', 'VARCHAR(100)'),
            ('storage_conditions', 'VARCHAR(200)'),
            ('shelf_life', 'INTEGER'),
            ('safety_check', 'JSON'),
            ('compliance_status', 'JSON'),
            ('ai_recommendations', 'JSON'),
            ('synergy_analysis', 'JSON'),
            ('share_code', 'VARCHAR(64)'),
            ('share_password_hash', 'VARCHAR(256)'),
            ('view_count', 'INTEGER'),
            ('creator_id', 'BIGINT'),
            ('reviewer_id', 'BIGINT'),
            ('reviewed_at', 'TIMESTAMPTZ'),
            ('review_notes', 'TEXT'),
            ('created_at', 'TIMESTAMPTZ'),
            ('updated_at', 'TIMESTAMPTZ'),
            ('data_classification', 'VARCHAR(20)'),
            ('data_retention_days', 'INTEGER'),
            ('data_owner', 'VARCHAR(100)'),
        ]

        for col_name, col_type in expected_formulas:
            if col_name not in existing_cols:
                try:
                    if col_type == 'JSON':
                        await conn.execute(f"ALTER TABLE formulas ADD COLUMN IF NOT EXISTS {col_name} JSON DEFAULT NULL")
                    elif col_type.startswith('VARCHAR'):
                        length = col_type.replace('VARCHAR(', '').replace(')', '')
                        await conn.execute(f"ALTER TABLE formulas ADD COLUMN IF NOT EXISTS {col_name} VARCHAR({length}) DEFAULT NULL")
                    elif col_type == 'BIGINT':
                        await conn.execute(f"ALTER TABLE formulas ADD COLUMN IF NOT EXISTS {col_name} BIGINT DEFAULT NULL")
                    elif col_type == 'INTEGER':
                        await conn.execute(f"ALTER TABLE formulas ADD COLUMN IF NOT EXISTS {col_name} INTEGER DEFAULT NULL")
                    elif col_type == 'TEXT':
                        await conn.execute(f"ALTER TABLE formulas ADD COLUMN IF NOT EXISTS {col_name} TEXT DEFAULT NULL")
                    elif col_type == 'TIMESTAMPTZ':
                        await conn.execute(f"ALTER TABLE formulas ADD COLUMN IF NOT EXISTS {col_name} TIMESTAMPTZ DEFAULT NULL")
                    print(f"  [OK] formulas.{col_name}")
                except Exception as e:
                    print(f"  [ERROR] formulas.{col_name}: {e}")

        # =========================================
        # Fix formula_versions table
        # =========================================
        print("\n=== Fixing formula_versions table ===")

        existing = await conn.fetch(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'formula_versions'"
        )
        existing_cols = {row['column_name'] for row in existing}

        # The model uses: id, formula_id, version, snapshot, change_summary, created_by, created_at
        # The DB has: id, formula_id, version_number, changes_description, snapshot_data, created_by, created_at
        # We need to add the model's expected column names

        expected_versions = [
            ('version', 'INTEGER'),  # Model expects 'version', DB has 'version_number'
            ('snapshot', 'JSON'),  # Model expects 'snapshot', DB has 'snapshot_data'
            ('change_summary', 'TEXT'),  # Model expects 'change_summary', DB has 'changes_description'
        ]

        for col_name, col_type in expected_versions:
            if col_name not in existing_cols:
                try:
                    if col_type == 'JSON':
                        await conn.execute(f"ALTER TABLE formula_versions ADD COLUMN IF NOT EXISTS {col_name} JSON DEFAULT NULL")
                    elif col_type == 'TEXT':
                        await conn.execute(f"ALTER TABLE formula_versions ADD COLUMN IF NOT EXISTS {col_name} TEXT DEFAULT NULL")
                    elif col_type == 'INTEGER':
                        await conn.execute(f"ALTER TABLE formula_versions ADD COLUMN IF NOT EXISTS {col_name} INTEGER DEFAULT NULL")
                    print(f"  [OK] formula_versions.{col_name}")
                except Exception as e:
                    print(f"  [ERROR] formula_versions.{col_name}: {e}")
            else:
                print(f"  [SKIP] formula_versions.{col_name} (exists)")

        # =========================================
        # Add indexes
        # =========================================
        print("\n=== Adding indexes ===")

        indexes = [
            "CREATE INDEX IF NOT EXISTS ix_formulas_code ON formulas(code)",
            "CREATE INDEX IF NOT EXISTS ix_formulas_status ON formulas(status)",
            "CREATE INDEX IF NOT EXISTS ix_formulas_creator_id ON formulas(creator_id)",
            "CREATE INDEX IF NOT EXISTS ix_formulas_created_at ON formulas(created_at)",
            "CREATE INDEX IF NOT EXISTS ix_formulas_updated_at ON formulas(updated_at)",
            "CREATE INDEX IF NOT EXISTS ix_formula_versions_formula_id ON formula_versions(formula_id)",
            "CREATE INDEX IF NOT EXISTS ix_formula_versions_version ON formula_versions(version)",
        ]

        for idx_sql in indexes:
            try:
                await conn.execute(idx_sql)
                print(f"  [OK] {idx_sql.split('IF NOT EXISTS')[1].split(' ON ')[0].strip()}")
            except Exception as e:
                print(f"  [SKIP] {idx_sql[:50]}...: {e}")

        # =========================================
        # Verify
        # =========================================
        print("\n=== Verification ===")

        formulas_cols = await conn.fetch(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'formulas' ORDER BY ordinal_position"
        )
        print(f"formulas table: {len(formulas_cols)} columns")

        versions_cols = await conn.fetch(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'formula_versions' ORDER BY ordinal_position"
        )
        print(f"formula_versions table: {len(versions_cols)} columns")

        print("\n[SUCCESS] Database schema sync completed!")

    except Exception as e:
        print(f"[FATAL] Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(sync_all_schemas())

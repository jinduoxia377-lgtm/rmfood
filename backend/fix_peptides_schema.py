"""
修复数据库表结构 - 添加缺失列
"""
import asyncio
import asyncpg
import sys

DB_CONFIG = "postgresql://postgres:password@localhost:5432/rmfood"

async def fix_peptides_table():
    conn = await asyncpg.connect(DB_CONFIG)

    try:
        # Get existing columns
        existing = await conn.fetch(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'peptides'"
        )
        existing_cols = {row['column_name'] for row in existing}

        # Columns expected by model
        expected = [
            ('organization_id', 'BIGINT'),
            ('source_protein', 'VARCHAR(200)'),
            ('source_organism', 'VARCHAR(200)'),
            ('activity_type', 'VARCHAR(100)'),
            ('activity_value', 'DOUBLE PRECISION'),
            ('activity_unit', 'VARCHAR(50)'),
            ('dfbp_id', 'VARCHAR(50)'),
        ]

        missing = [(col, typ) for col, typ in expected if col not in existing_cols]

        if missing:
            print(f"Adding {len(missing)} missing columns to peptides table...")
            for col, typ in missing:
                try:
                    if typ == 'BIGINT':
                        await conn.execute(f"ALTER TABLE peptides ADD COLUMN IF NOT EXISTS {col} BIGINT DEFAULT NULL")
                    elif typ.startswith('VARCHAR'):
                        length = typ.replace('VARCHAR(', '').replace(')', '')
                        await conn.execute(f"ALTER TABLE peptides ADD COLUMN IF NOT EXISTS {col} VARCHAR({length}) DEFAULT NULL")
                    elif typ == 'DOUBLE PRECISION':
                        await conn.execute(f"ALTER TABLE peptides ADD COLUMN IF NOT EXISTS {col} DOUBLE PRECISION DEFAULT NULL")
                    print(f"  [OK] {col}")
                except Exception as e:
                    print(f"  [ERROR] {col}: {e}")
        else:
            print("peptides table already has all required columns")

        # Verify
        result = await conn.fetch(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'peptides' ORDER BY ordinal_position"
        )
        print(f"\nTotal peptides columns: {len(result)}")

    finally:
        await conn.close()

async def main():
    print("=== Fixing peptides table ===")
    await fix_peptides_table()
    print("\nDone!")

if __name__ == "__main__":
    asyncio.run(main())

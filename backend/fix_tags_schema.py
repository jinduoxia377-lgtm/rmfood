"""
修复 tags 表结构 - 添加缺失列
"""
import asyncio
import asyncpg

DB_CONFIG = "postgresql://postgres:password@localhost:5432/rmfood"

async def fix_tags_table():
    conn = await asyncpg.connect(DB_CONFIG)

    try:
        # Get existing columns
        existing = await conn.fetch(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'tags'"
        )
        existing_cols = {row['column_name'] for row in existing}

        # Columns expected by model
        expected = [
            ('icon', 'VARCHAR(50)'),
            ('usage_count', 'INTEGER'),
        ]

        missing = [(col, typ) for col, typ in expected if col not in existing_cols]

        if missing:
            print(f"Adding {len(missing)} missing columns to tags table...")
            for col, typ in missing:
                try:
                    if typ == 'VARCHAR(50)':
                        await conn.execute(f"ALTER TABLE tags ADD COLUMN IF NOT EXISTS {col} VARCHAR(50) DEFAULT NULL")
                    elif typ == 'INTEGER':
                        await conn.execute(f"ALTER TABLE tags ADD COLUMN IF NOT EXISTS {col} INTEGER DEFAULT 0")
                    print(f"  [OK] {col}")
                except Exception as e:
                    print(f"  [ERROR] {col}: {e}")
        else:
            print("tags table already has all required columns")

        # Verify
        result = await conn.fetch(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'tags' ORDER BY ordinal_position"
        )
        print(f"\nTotal tags columns: {len(result)}")
        print("Columns:", [r['column_name'] for r in result])

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(fix_tags_table())

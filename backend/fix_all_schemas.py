"""
完整数据库结构修复脚本
修复所有关联表的缺失列
"""
import asyncio
import asyncpg

DB_CONFIG = "postgresql://postgres:password@localhost:5432/rmfood"

# Table schema definitions (column_name: sql_type)
TABLE_SCHEMAS = {
    'ingredients': [
        ('organization_id', 'BIGINT'),
        ('name_cn', 'VARCHAR(200)'),
        ('source', 'VARCHAR(200)'),
        ('properties', 'JSON'),
        ('is_food_homology', 'BOOLEAN'),
    ],
    'categories': [
        ('created_at', 'TIMESTAMPTZ'),
        ('updated_at', 'TIMESTAMPTZ'),
    ],
    'peptides': [
        ('organization_id', 'BIGINT'),
        ('source_protein', 'VARCHAR(200)'),
        ('source_organism', 'VARCHAR(200)'),
        ('activity_type', 'VARCHAR(100)'),
        ('activity_value', 'DOUBLE PRECISION'),
        ('activity_unit', 'VARCHAR(50)'),
        ('dfbp_id', 'VARCHAR(50)'),
    ],
    'tags': [
        ('icon', 'VARCHAR(50)'),
        ('usage_count', 'INTEGER'),
    ],
}

async def fix_table(table_name, columns):
    conn = await asyncpg.connect(DB_CONFIG)
    try:
        # Get existing columns
        existing = await conn.fetch(
            f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table_name}'"
        )
        existing_cols = {row['column_name'] for row in existing}

        missing = [(col, typ) for col, typ in columns if col not in existing_cols]

        if missing:
            print(f"  Fixing {table_name}: adding {len(missing)} columns")
            for col, typ in missing:
                try:
                    if typ == 'BIGINT':
                        await conn.execute(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col} BIGINT DEFAULT NULL")
                    elif typ == 'VARCHAR(200)':
                        await conn.execute(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col} VARCHAR(200) DEFAULT NULL")
                    elif typ == 'VARCHAR(100)':
                        await conn.execute(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col} VARCHAR(100) DEFAULT NULL")
                    elif typ == 'VARCHAR(50)':
                        await conn.execute(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col} VARCHAR(50) DEFAULT NULL")
                    elif typ == 'JSON':
                        await conn.execute(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col} JSON DEFAULT NULL")
                    elif typ == 'BOOLEAN':
                        await conn.execute(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col} BOOLEAN DEFAULT FALSE")
                    elif typ == 'INTEGER':
                        await conn.execute(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col} INTEGER DEFAULT 0")
                    elif typ == 'DOUBLE PRECISION':
                        await conn.execute(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col} DOUBLE PRECISION DEFAULT NULL")
                    elif typ == 'TIMESTAMPTZ':
                        await conn.execute(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col} TIMESTAMPTZ DEFAULT NOW()")
                    print(f"    + {col}")
                except Exception as e:
                    print(f"    ERROR {col}: {e}")
        else:
            print(f"  {table_name}: OK (all columns exist)")
    finally:
        await conn.close()

async def main():
    print("=== Database Schema Fix ===\n")
    for table, columns in TABLE_SCHEMAS.items():
        await fix_table(table, columns)
    print("\n=== Done ===")

if __name__ == "__main__":
    asyncio.run(main())

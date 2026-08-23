"""
修复 comments 表结构
"""
import asyncio
import asyncpg

DB_CONFIG = "postgresql://postgres:password@localhost:5432/rmfood"

async def fix_comments_table():
    conn = await asyncpg.connect(DB_CONFIG)
    try:
        # Rename author_id to user_id
        try:
            await conn.execute("ALTER TABLE comments RENAME COLUMN author_id TO user_id")
            print("[OK] Renamed author_id -> user_id")
        except Exception as e:
            print(f"[SKIP] author_id rename: {e}")

        # Add is_internal if missing
        try:
            await conn.execute("ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT FALSE")
            print("[OK] Added is_internal column")
        except Exception as e:
            print(f"[ERROR] is_internal: {e}")

        # Check if we need to migrate is_deleted data
        try:
            result = await conn.fetchval("SELECT count(*) FROM comments WHERE is_deleted = TRUE")
            if result > 0:
                await conn.execute("UPDATE comments SET is_internal = is_deleted WHERE is_internal IS NULL")
                print(f"[OK] Migrated {result} is_deleted records to is_internal")
        except Exception as e:
            print(f"[INFO] is_deleted check: {e}")

        # Verify
        result = await conn.fetch("SELECT column_name FROM information_schema.columns WHERE table_name = 'comments' ORDER BY ordinal_position")
        cols = [r['column_name'] for r in result]
        print(f"\nFinal comments columns: {cols}")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(fix_comments_table())

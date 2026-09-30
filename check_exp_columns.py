"""Check NOT NULL constraints on experiments + experiment_data, and what a raw INSERT needs."""
import sys, asyncio
sys.path.insert(0, r"D:\RMFOODFP\backend")

from app.core.database.session import async_session_factory
from sqlalchemy import text

async def main():
    async with async_session_factory() as db:
        for table in ("experiments", "experiment_data"):
            r = await db.execute(text("""
                SELECT column_name, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = :t
                ORDER BY ordinal_position
            """), {"t": table})
            rows = r.fetchall()
            print(f"=== {table} column nullability ===")
            for col, nullable, default in rows:
                flag = "NULL-OK " if nullable == "YES" else "NOTNULL"
                print(f"  {flag}  {col:20s} default={default}")
            print()

        # Try a raw INSERT mimicking the ORM to find which NOT NULL col breaks it
        print("=== raw INSERT test (title+code only) ===")
        try:
            r = await db.execute(text(
                "INSERT INTO experiments (title, code, status, researcher_id, created_at, updated_at) "
                "VALUES ('rawtest', 'EXP-RAW-000', 'planned', 1, NOW(), NOW()) RETURNING id"
            ))
            row = r.fetchone()
            print("  raw INSERT OK, id =", row[0] if row else None)
            await db.rollback()
        except Exception as e:
            print(f"  raw INSERT FAILED: {type(e).__name__}: {e}")
            await db.rollback()

asyncio.run(main())

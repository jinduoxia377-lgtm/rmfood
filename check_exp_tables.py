"""Find the real table name for experiments + check if it exists."""
import sys, asyncio
sys.path.insert(0, r"D:\RMFOODFP\backend")

from app.core.database.session import async_session_factory
from sqlalchemy import text

async def main():
    async with async_session_factory() as db:
        # list all tables
        r = await db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"))
        tables = [row[0] for row in r.fetchall()]
        print("=== all public tables ===")
        print(tables)
        print()
        # search for experiment-related
        r2 = await db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename ILIKE '%experiment%'"))
        exp_tables = [row[0] for row in r2.fetchall()]
        print("experiment-related tables:", exp_tables)
        # check real column names
        for t in exp_tables:
            r3 = await db.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='{t}' ORDER BY ordinal_position"))
            cols = [row[0] for row in r3.fetchall()]
            print(f"\n{t} columns ({len(cols)}):")
            print(cols)
        # row counts
        for t in exp_tables:
            rc = await db.execute(text(f"SELECT COUNT(*) FROM {t}"))
            print(f"\n{t} row count: {rc.scalar()}")

asyncio.run(main())

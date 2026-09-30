"""Check real timezone-ness of timestamp columns across the 3 tables we touch."""
import sys, asyncio
sys.path.insert(0, r"D:\RMFOODFP\backend")
from app.core.database.session import async_session_factory
from sqlalchemy import text

async def main():
    f = async_session_factory
    async with f() as db:
        r = await db.execute(text("""
            SELECT table_name, column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_name IN ('experiments','experiment_data','audit_logs')
              AND udt_name IN ('timestamp','timestamptz','timestamp')
            ORDER BY table_name, column_name
        """))
        print("timestamp-family columns:")
        for tname, cname, dtype, udt in r.fetchall():
            tz = "TZ" if udt == "timestamptz" else "naive"
            print(f"  {tname:16s} {cname:16s} {dtype:30s} [{tz}]")

asyncio.run(main())

"""Check what audit_logs actually contains (rows + any leftover test data)."""
import sys, asyncio
sys.path.insert(0, r"D:\RMFOODFP\backend")
from app.core.database.session import async_session_factory
from sqlalchemy import text

async def main():
    f = async_session_factory
    async with f() as db:
        r = await db.execute(text("SELECT COUNT(*) FROM audit_logs"))
        print("audit_logs total rows:", r.scalar())
        r2 = await db.execute(text("SELECT id, action, resource_type, resource_id, user_id FROM audit_logs ORDER BY id DESC LIMIT 10"))
        print("last 10 audit rows:")
        for row in r2.fetchall():
            print("  ", tuple(row))
        # experiments leftovers
        r3 = await db.execute(text("SELECT id, code, title FROM experiments ORDER BY id"))
        print("experiments all rows:")
        for row in r3.fetchall():
            print("  ", tuple(row))
        r4 = await db.execute(text("SELECT COUNT(*) FROM experiment_data"))
        print("experiment_data rows:", r4.scalar())

asyncio.run(main())

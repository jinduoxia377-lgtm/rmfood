"""Verify the real audit_logs columns + whether id auto-increments."""
import sys, asyncio
sys.path.insert(0, r"D:\RMFOODFP\backend")
from app.core.database.session import async_session_factory
from sqlalchemy import text

async def main():
    f = async_session_factory
    async with f() as db:
        r = await db.execute(text(
            "SELECT column_name, data_type, is_nullable, column_default "
            "FROM information_schema.columns WHERE table_name='audit_logs' ORDER BY ordinal_position"
        ))
        print("audit_logs real columns:")
        for name, dtype, nullable, default in r.fetchall():
            print(f"  {name:16s} {dtype:24s} null={nullable:3s} default={default}")
        # test insert
        print("\n=== raw INSERT test ===")
        try:
            r = await db.execute(text(
                "INSERT INTO audit_logs (action, resource_type, resource_id, user_id, details) "
                "VALUES ('probe.ormtest', 'experiment', 42, 1, '{\"probe\":1}') RETURNING id"
            ))
            print("raw INSERT OK, id =", r.fetchone()[0])
            await db.execute(text("DELETE FROM audit_logs WHERE action='probe.ormtest'"))
            await db.commit()
        except Exception as e:
            print("raw INSERT FAILED:", type(e).__name__, str(e)[:200])
            await db.rollback()

asyncio.run(main())

import sys, asyncio
sys.path.insert(0, r"D:\RMFOODFP\backend")
from app.core.database.session import async_session_factory
from sqlalchemy import text

async def main():
    f = async_session_factory
    async with f() as db:
        r = await db.execute(text("SELECT id, code, title, status FROM experiments"))
        rows = r.fetchall()
        print("experiments:")
        for row in rows:
            print(f"  id={row[0]} code={row[1]!r} status={row[3]!r} title={row[2]!r}")
        # check audit logs probe rows from earlier verify (should be 0, they were rolled back)
        r2 = await db.execute(text("SELECT COUNT(*) FROM audit_logs WHERE action LIKE :a"), {"a": "probe.orm"})
        print("audit_logs probe.orm rows =", r2.scalar())
        r3 = await db.execute(text("SELECT COUNT(*) FROM audit_logs WHERE action LIKE :a"), {"a": "experiment.%"})
        print("audit_logs experiment.* rows =", r3.scalar())

asyncio.run(main())

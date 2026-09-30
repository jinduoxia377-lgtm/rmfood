import sys, asyncio
sys.path.insert(0, r"D:\RMFOODFP\backend")
from app.core.database.session import async_session_factory
from sqlalchemy import text

async def main():
    f = async_session_factory
    async with f() as db:
        # delete the leftover test experiment (created by earlier API attempt) + its data
        r = await db.execute(text("SELECT id FROM experiments WHERE code='EXP-20260927-0001'"))
        eids = [row[0] for row in r.fetchall()]
        for eid in eids:
            await db.execute(text("DELETE FROM experiment_data WHERE experiment_id=:i"), {"i": eid})
            await db.execute(text("DELETE FROM experiments WHERE id=:i"), {"i": eid})
        # delete the orphaned audit row (references the test experiment)
        for eid in eids:
            await db.execute(text("DELETE FROM audit_logs WHERE resource_id=:i"), {"i": eid})
        await db.commit()
        r2 = await db.execute(text("SELECT COUNT(*) FROM experiments"))
        r3 = await db.execute(text("SELECT COUNT(*) FROM experiment_data"))
        r4 = await db.execute(text("SELECT COUNT(*) FROM audit_logs"))
        print(f"FINAL STATE: experiments={r2.scalar()} experiment_data={r3.scalar()} audit_logs={r4.scalar()}")

asyncio.run(main())

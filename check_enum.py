import sys, asyncio
sys.path.insert(0, r"D:\RMFOODFP\backend")
from app.core.database.session import async_session_factory
from sqlalchemy import text

async def main():
    async with async_session_factory() as db:
        r = await db.execute(text("SELECT enum_range('experimentstatus')"))
        print("enum:", r.fetchone()[0])
        r2 = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='experiments' AND is_nullable='NO'"))
        print("experiments NOT NULL:", [x[0] for x in r2.fetchall()])
        # raw insert using enum default via string cast
        try:
            r3 = await db.execute(text(
                "INSERT INTO experiments (title, code, status, researcher_id) VALUES ('rawtest2','EXP-RAW-0002', 'PLANNED'::experimentstatus, 1) RETURNING id"
            ))
            print("raw insert id:", r3.fetchone()[0])
        except Exception as e:
            print("raw insert failed:", str(e)[:150])
        await db.rollback()

asyncio.run(main())

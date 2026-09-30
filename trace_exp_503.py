"""Robust trace: each step in a fresh session so one failure doesn't kill the rest."""
import sys, asyncio
sys.path.insert(0, r"D:\RMFOODFP\backend")

from app.core.database.session import async_session_factory
from sqlalchemy import text

async def run_one(db_factory, sql, params=None):
    try:
        async with db_factory() as db:
            r = await db.execute(text(sql), params or {})
            return r.fetchall()
    except Exception as e:
        return [f"__ERR__ {type(e).__name__}: {str(e)[:160]}"]

async def main():
    f = async_session_factory

    rows = await run_one(f, "SELECT enum_range('public.experimentstatus')")
    print("ENUM:", rows[0][0] if rows and not rows[0][0].startswith("__ERR__") else rows)

    rows = await run_one(f, "SELECT column_name FROM information_schema.columns WHERE table_name='experiments' AND is_nullable='NO' ORDER BY ordinal_position")
    print("EXPERIMENTS NOT NULL:", [r[0] for r in rows] if rows and not str(rows[0][0]).startswith("__ERR__") else rows)

    # raw insert
    try:
        async with f() as db:
            r = await db.execute(text(
                "INSERT INTO experiments (title, code, status, researcher_id) "
                "VALUES (:t, :c, 'PLANNED'::experimentstatus, :u) RETURNING id"
            ), {"t": "rawtest4", "c": "EXP-RAW-0004", "u": 1})
            print("RAW INSERT OK id:", r.fetchone()[0])
            await db.execute(text("DELETE FROM experiments WHERE code='EXP-RAW-0004'"))
            await db.commit()
    except Exception as e:
        print("RAW INSERT FAILED:", type(e).__name__, str(e)[:200])

    # users
    rows = await run_one(f, "SELECT id, username FROM users ORDER BY id LIMIT 5")
    print("USERS:", rows if rows and not str(rows[0][0]).startswith("__ERR__") else rows)

asyncio.run(main())

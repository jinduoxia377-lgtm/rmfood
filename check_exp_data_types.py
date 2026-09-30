import sys, asyncio
sys.path.insert(0, r"D:\RMFOODFP\backend")
from app.core.database.session import async_session_factory
from sqlalchemy import text

async def main():
    f = async_session_factory
    async with f() as db:
        r = await db.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='experiment_data' ORDER BY ordinal_position"))
        print("experiment_data columns (name -> type):")
        for name, dtype in r.fetchall():
            print(f"  {name:18s} {dtype}")

asyncio.run(main())

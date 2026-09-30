"""Verify the experiments table has the columns the ORM model expects."""
import sys, asyncio
sys.path.insert(0, r"D:\RMFOODFP\backend")
from app.core.database.session import async_session_factory
from sqlalchemy import text

async def main():
    f = async_session_factory
    # experiments real columns
    async with f() as db:
        r = await db.execute(text("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='experiments' ORDER BY ordinal_position"))
        print("experiments real columns:")
        cols = []
        for name, dtype, nullable in r.fetchall():
            cols.append(name)
            print(f"  {name:22s} {dtype:28s} null={nullable}")
        # check the ones the ORM model expects
        expected = ['id','title','name','code','description','status','formula_id','researcher_id',
                    'objectives','methodology','parameters','materials','equipment',
                    'start_date','end_date','actual_start','actual_end','results','conclusions',
                    'recommendations','created_at','updated_at','organization_id']
        print("\nexpected-but-missing:", [c for c in expected if c not in cols])

asyncio.run(main())

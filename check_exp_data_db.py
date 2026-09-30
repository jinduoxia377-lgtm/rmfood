import sys, asyncio
sys.path.insert(0, r"D:\RMFOODFP\backend")
from app.core.database.session import async_session_factory
from sqlalchemy import text

async def main():
    f = async_session_factory
    # experiment_data NOT NULL
    async with f() as db:
        r = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='experiment_data' AND is_nullable='NO' ORDER BY ordinal_position"))
        print("experiment_data NOT NULL:", [x[0] for x in r.fetchall()])

    # raw INSERT into experiment_data using the DB's real columns (data_type NOT NULL)
    async with f() as db:
        try:
            r = await db.execute(text(
                "INSERT INTO experiment_data (experiment_id, data_type, data_value, measurement_time) VALUES (1, 'factor_A', '1.0', NOW()) RETURNING id"
            ))
            print("experiment_data raw INSERT OK:", r.fetchone()[0])
            await db.execute(text("DELETE FROM experiment_data WHERE id>0"))
            await db.commit()
        except Exception as e:
            print("experiment_data raw INSERT FAILED:", type(e).__name__, str(e)[:150])
            await db.rollback()

    # ORM-style check: does a parameter/value column exist?
    async with f() as db:
        r = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='experiment_data'"))
        cols = [x[0] for x in r.fetchall()]
        print("experiment_data all columns:", cols)
        print("has parameter col:", "parameter" in cols, "| has value col:", "value" in cols, "| has recorded_at:", "recorded_at" in cols)

asyncio.run(main())

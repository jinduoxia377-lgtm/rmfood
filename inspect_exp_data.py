"""Inspect real experiment data points to design the DOE import mapping."""
import sys, asyncio
sys.path.insert(0, r"D:\RMFOODFP\backend")

from app.core.database.session import async_session_factory
from sqlalchemy import text

async def main():
    async with async_session_factory() as db:
        r = await db.execute(text("""
            SELECT e.id, e.code, e.title, COUNT(d.id) AS n
            FROM experiments e
            LEFT JOIN experiment_data d ON d.experiment_id = e.id
            GROUP BY e.id, e.code, e.title
            ORDER BY n DESC
            LIMIT 5
        """))
        rows = r.fetchall()
        print("=== top experiments by data point count ===")
        for row in rows:
            print(f"  id={row[0]} code={row[1]} n={row[3]} title={str(row[2])[:40]}")

        if rows and rows[0][3] > 0:
            target = rows[0][0]
            r2 = await db.execute(text("SELECT * FROM experiments WHERE id=:i"), {"i": target})
            exp = r2.fetchone()
            print(f"\n=== experiment {target} fields ===")
            for c in exp.keys():
                v = getattr(exp, c)
                if isinstance(v, (dict, list)):
                    print(f"  {c} = {str(v)[:120]}")
                else:
                    print(f"  {c} = {str(v)[:80]}")

            r3 = await db.execute(text("SELECT * FROM experiment_data WHERE experiment_id=:i LIMIT 20 ORDER BY id"), {"i": target})
            dps = r3.fetchall()
            print(f"\n=== {len(dps)} sample data points (schema) ===")
            if dps:
                print("  columns:", dps[0].__class__.__name__ and [dps[0]._mapping.keys()] if hasattr(dps[0],'_mapping') else "n/a")

        else:
            print("\nNo experiments have data points yet; mapping must be validated by creating test data.")

asyncio.run(main())

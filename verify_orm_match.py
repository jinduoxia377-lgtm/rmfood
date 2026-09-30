"""Verify ORM models now match real DB columns + types (single session, no FK issues)."""
import sys, asyncio
sys.path.insert(0, r"D:\RMFOODFP\backend")

from app.core.database.session import async_session_factory
from sqlalchemy import text, select
from app.models.experiment import Experiment, ExperimentData
from app.models.enums import ExperimentStatus

async def main():
    f = async_session_factory

    async with f() as db:
        exp = Experiment(
            title="ORM-VERIFY-EXP-3",
            code="EXP-ORM-0003",
            status=ExperimentStatus.PLANNED,
            researcher_id=1,
        )
        db.add(exp)
        await db.flush()
        exp_id = exp.id
        print(f"ORM Experiment INSERT OK id={exp_id} name={exp.name!r}")

        dp = ExperimentData(experiment_id=exp_id, data_type="factor_A", data_value=1.0, unit="coded")
        db.add(dp)
        await db.flush()
        print(f"ORM ExperimentData INSERT OK id={dp.id} data_type={dp.data_type!r} value={dp.value!r} (float)")

        # also verify read-back via ORM
        r = await db.execute(select(ExperimentData).where(ExperimentData.experiment_id == exp_id))
        for d in r.scalars().all():
            print(f"  read back: data_type={d.data_type!r} data_value={d.data_value!r} parameter_alias={d.parameter!r}")

        # cleanup in same session
        await db.execute(text("DELETE FROM experiment_data WHERE experiment_id=:i"), {"i": exp_id})
        await db.execute(text("DELETE FROM experiments WHERE code='EXP-ORM-0003'"))
        await db.commit()
        print("cleanup done")

asyncio.run(main())

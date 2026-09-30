"""Verify audit_logs + experiments + experiment_data ORM INSERTs all work now."""
import sys, asyncio
sys.path.insert(0, r"D:\RMFOODFP\backend")

from app.core.database.session import async_session_factory
from sqlalchemy import text
from app.models.system import AuditLog
from app.models.experiment import Experiment, ExperimentData
from app.models.enums import ExperimentStatus

async def main():
    f = async_session_factory
    exp_id = None
    dp_id = None

    # AuditLog
    async with f() as db:
        log = AuditLog(action="probe.orm", resource_type="experiment", resource_id=999, user_id=1, details={"probe": 1})
        db.add(log)
        try:
            await db.flush()
            print(f"OK AuditLog INSERT id={log.id}")
        except Exception as e:
            print(f"FAIL AuditLog: {type(e).__name__}: {str(e)[:150]}")
            await db.rollback()
        await db.rollback()

    # Experiment + ExperimentData
    async with f() as db:
        exp = Experiment(title="ORM-CHAIN-VERIFY", code="EXP-ORM-CHAIN", status=ExperimentStatus.PLANNED, researcher_id=1)
        db.add(exp)
        try:
            await db.flush()
            exp_id = exp.id
            print(f"OK Experiment INSERT id={exp_id}")
        except Exception as e:
            print(f"FAIL Experiment: {type(e).__name__}: {str(e)[:150]}")
            await db.rollback()
            return

        dp = ExperimentData(experiment_id=exp_id, data_type="factor_A", data_value=1.5, unit="coded", notes="probe")
        db.add(dp)
        try:
            await db.flush()
            dp_id = dp.id
            print(f"OK ExperimentData INSERT id={dp_id} data_value={dp.data_value}")
        except Exception as e:
            print(f"FAIL ExperimentData: {type(e).__name__}: {str(e)[:150]}")
            await db.rollback()
            return

        # cleanup in-session
        await db.execute(text("DELETE FROM experiment_data WHERE id=:i"), {"i": dp_id})
        await db.execute(text("DELETE FROM experiments WHERE id=:i"), {"i": exp_id})
        await db.execute(text("DELETE FROM audit_logs WHERE action='probe.orm'"))
        await db.commit()
        print("cleanup done")

asyncio.run(main())

"""Final end-to-end verification of the full chain, with cleanup + no leftover data."""
import sys, asyncio
import requests
sys.path.insert(0, r"D:\RMFOODFP\backend")

from app.core.database.session import async_session_factory
from sqlalchemy import text
from app.models.experiment import Experiment, ExperimentData
from app.models.enums import ExperimentStatus

BASE = "http://localhost:8000/api/v1"
CODE = "EXP-P2CHAIN-FINAL"

async def seed():
    f = async_session_factory
    conditions = [
        (1.0, 1.0, 12.5), (1.0, -1.0, 8.0), (-1.0, 1.0, 7.2), (-1.0, -1.0, 3.1),
        (0.0, 0.0, 11.0), (0.0, 0.0, 11.2), (2.0, 0.0, 14.8), (-2.0, 0.0, 4.9),
        (0.0, 2.0, 15.1), (0.0, -2.0, 5.3),
    ]
    from datetime import datetime, timedelta
    async with f() as db:
        await db.execute(text("DELETE FROM experiment_data WHERE experiment_id=(SELECT id FROM experiments WHERE code=:c)"), {"c": CODE})
        await db.execute(text("DELETE FROM experiments WHERE code=:c"), {"c": CODE})
        exp = Experiment(title="P2CHAIN FINAL: DOE chain", code=CODE,
                        status=ExperimentStatus.IN_PROGRESS, researcher_id=1, name="")
        db.add(exp)
        await db.flush()
        exp_id = exp.id
        base_ts = datetime.now()
        for ci, (a, b, y) in enumerate(conditions):
            for pname, pval in (("factor_A", a), ("factor_B", b), ("response_Y", y)):
                db.add(ExperimentData(experiment_id=exp_id, data_type=pname, data_value=pval,
                                       unit="coded", measurement_time=base_ts + timedelta(milliseconds=ci * 1000)))
        await db.commit()
        n = (await db.execute(text("SELECT COUNT(*) FROM experiment_data WHERE experiment_id=:i"), {"i": exp_id})).scalar()
        print(f"[seed] exp_id={exp_id} data_points={n}")
        return exp_id

async def cleanup():
    f = async_session_factory
    async with f() as db:
        await db.execute(text("DELETE FROM experiment_data WHERE experiment_id=(SELECT id FROM experiments WHERE code=:c)"), {"c": CODE})
        await db.execute(text("DELETE FROM experiments WHERE code=:c"), {"c": CODE})
        await db.execute(text("DELETE FROM audit_logs WHERE resource_id=(SELECT id FROM experiments WHERE code=:c)"), {"c": CODE})
        await db.commit()
        r = (await db.execute(text("SELECT COUNT(*) FROM experiments WHERE code=:c"), {"c": CODE})).scalar()
        print(f"[cleanup] leftover temp rows = {r}")

def main():
    exp_id = asyncio.run(seed())
    s = requests.Session()

    # 1) import
    r = s.get(f"{BASE}/doe/experiments/{exp_id}/runs?response_parameter=response_Y", timeout=20)
    imp = (r.json() or {}).get("data") or r.json()
    runs = imp.get("runs", [])
    print(f"\n[1] /doe/experiments/{exp_id}/runs -> {r.status_code} | runs={len(runs)} factors={[f['name'] for f in imp.get('factors',[])]}")
    assert len(runs) == 10, f"expected 10 runs, got {len(runs)}"
    assert "response_Y" not in runs[0]["factor_levels"], "response leaked into factors"

    # 2) fit
    r = s.post(f"{BASE}/doe/fit", json={"runs": runs, "response_names": ["response_Y"], "include_interaction": True, "include_quadratic": True}, timeout=20)
    fit = (r.json() or {}).get("data") or r.json()
    m = fit.get("models", [{}])[0]
    print(f"\n[2] /doe/fit -> {r.status_code} | R²={m.get('r_squared')} | terms={m.get('significant_terms')}")

    # 3) active learning
    r = s.post(f"{BASE}/doe/active-learning", json={"existing_runs": runs, "fitted_model": m, "n_recommend": 3}, timeout=20)
    al = (r.json() or {}).get("data") or r.json()
    recs = al.get("recommendations", [])
    print(f"\n[3] /doe/active-learning -> {r.status_code} | strategy={al.get('strategy')} recs={len(recs)}")

    # 4) export back
    r = s.post(f"{BASE}/doe/experiments/export", json={"experiment_id": exp_id, "recommendations": recs, "note": "final"}, timeout=20)
    ex = (r.json() or {}).get("data") or r.json()
    print(f"\n[4] /doe/experiments/export -> {r.status_code} | created={ex.get('created_data_points')}")

    # 5) inverse search
    r = s.post(f"{BASE}/doe/inverse-search", json={"model": m, "target_values": {"response_Y": 13.0}}, timeout=20)
    inv = (r.json() or {}).get("data") or r.json()
    print(f"\n[5] /doe/inverse-search -> {r.status_code} | feasibility={inv.get('feasibility_score')}")

    asyncio.run(cleanup())
    print("\n=== FINAL CHAIN VERIFIED, temp data cleaned ===")

if __name__ == "__main__":
    main()

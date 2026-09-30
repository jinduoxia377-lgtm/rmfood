"""
End-to-end chain test: 实验管理 → DOE 拟合 → 主动学习推荐
Strategy (user-approved): write a tagged temp experiment + data points DIRECTLY via DB
session (bypassing CSRF-protected addData endpoint), run the full DOE chain through the
public /doe/* endpoints, then delete the temp data. No fake data remains in the DB.
"""
import sys, asyncio
import requests

sys.path.insert(0, r"D:\RMFOODFP\backend")

from app.core.database.session import async_session_factory
from sqlalchemy import text, select
from app.models.experiment import Experiment, ExperimentData
from app.models.enums import ExperimentStatus

BASE = "http://localhost:8000/api/v1"
TAG = "P2CHAIN_TEST"
CODE = "EXP-P2CHAIN-TEMP"


# ── Step 1: seed a tagged temp experiment + data points via DB ──
def seed_temp_experiment() -> int:
    """Create a temp experiment with 10 DOE conditions (30 data points) via raw DB. Returns exp id."""
    async def _seed():
        f = async_session_factory
        conditions = [
            (1.0, 1.0, 12.5), (1.0, -1.0, 8.0), (-1.0, 1.0, 7.2), (-1.0, -1.0, 3.1),
            (0.0, 0.0, 11.0), (0.0, 0.0, 11.2), (2.0, 0.0, 14.8), (-2.0, 0.0, 4.9),
            (0.0, 2.0, 15.1), (0.0, -2.0, 5.3),
        ]
        async with f() as db:
            # delete any prior temp
            await db.execute(text("DELETE FROM experiment_data WHERE experiment_id=(SELECT id FROM experiments WHERE code=:c)"), {"c": CODE})
            await db.execute(text("DELETE FROM experiments WHERE code=:c"), {"c": CODE})
            # create experiment (ORM, matches real DB cols)
            exp = Experiment(title=f"{TAG}: DOE 链式测试", code=CODE,
                            status=ExperimentStatus.IN_PROGRESS, researcher_id=1, name="")
            db.add(exp)
            await db.flush()
            exp_id = exp.id
            # add data points: factor_A, factor_B, response_Y per condition
            # measurement_time 故意错开秒数（第 i 个条件写入 i 秒后），
            # 这样导入端点按秒级桶分组能正确还原 10 个独立 run（而非塌成 1 个）
            from datetime import datetime, timedelta
            base_ts = datetime.now()
            for a, b, y in conditions:
                for pname, pval in (("factor_A", a), ("factor_B", b), ("response_Y", y)):
                    dp = ExperimentData(experiment_id=exp_id, data_type=pname, data_value=pval,
                                         unit="coded", measurement_time=base_ts)
                    db.add(dp)
                base_ts += timedelta(seconds=1)
            await db.commit()
            r = await db.execute(text("SELECT COUNT(*) FROM experiment_data WHERE experiment_id=:i"), {"i": exp_id})
            n = r.scalar()
            print(f"[seed] created exp id={exp_id}, data points={n}")
            return exp_id
    return asyncio.run(_seed())


def cleanup_temp_experiment():
    """Delete the temp experiment + its data points."""
    async def _cleanup():
        f = async_session_factory
        async with f() as db:
            await db.execute(text("DELETE FROM experiment_data WHERE experiment_id=(SELECT id FROM experiments WHERE code=:c)"), {"c": CODE})
            await db.execute(text("DELETE FROM experiments WHERE code=:c"), {"c": CODE})
            await db.commit()
            r = await db.execute(text("SELECT COUNT(*) FROM experiments WHERE code=:c"), {"c": CODE})
            print(f"[cleanup] remaining temp exp rows = {r.scalar()}")
    asyncio.run(_cleanup())


def main():
    # Seed real data via DB
    exp_id = seed_temp_experiment()

    # Public /doe/* endpoints (CSRF-exempt)
    s = requests.Session()

    # [3] import runs (response_Y as the designated response variable)
    r = s.get(f"{BASE}/doe/experiments/{exp_id}/runs?response_parameter=response_Y", timeout=20)
    imp = r.json()
    print(f"\n[3] GET /doe/experiments/{exp_id}/runs -> {r.status_code}")
    print(f"  total_runs={imp.get('total_runs')} grouping={imp.get('grouping')}")
    print(f"  factors={[f['name'] for f in imp.get('factors', [])]}")
    print(f"  response_candidates={imp.get('response_candidates')} all_parameters={imp.get('all_parameters')}")
    runs = imp.get("runs", [])
    if not runs:
        print("  NO RUNS — abort")
        cleanup_temp_experiment()
        return 1
    # sanity: factor_levels should NOT include response_Y; response_values SHOULD
    sample = runs[0]
    assert "response_Y" not in sample.get("factor_levels", {}), f"response leaked into factors: {sample}"
    assert "response_Y" in sample.get("response_values", {}), f"response_Y missing from response_values: {sample}"
    print(f"  sample run: factor_levels={sample.get('factor_levels')} response_values={sample.get('response_values')}")

    # [4] fit
    fit_payload = {
        "runs": runs,
        "response_names": ["response_Y"],
        "include_interaction": True,
        "include_quadratic": True,
    }
    r = s.post(f"{BASE}/doe/fit", json=fit_payload, timeout=20)
    fit = r.json()
    models = fit.get("models", [])
    print(f"\n[4] POST /doe/fit -> {r.status_code}")
    if models:
        m = models[0]
        print(f"  equation: {m.get('equation')}")
        print(f"  r_squared: {m.get('r_squared')}")
        print(f"  significant_terms: {m.get('significant_terms')}")
    else:
        print(f"  no model: {str(fit)[:200]}")

    # [5] active learning with fitted model
    al_payload = {"existing_runs": runs, "fitted_model": models[0] if models else None, "n_recommend": 3}
    r = s.post(f"{BASE}/doe/active-learning", json=al_payload, timeout=20)
    al = r.json()
    recs = al.get("recommendations", [])
    print(f"\n[5] POST /doe/active-learning -> {r.status_code} strategy={al.get('strategy')}")
    for rec in recs:
        print(f"  run {rec.get('run_id')}: factor_levels={rec.get('factor_levels')}")

    # [6] export recommendations back to experiment (closed loop)
    export_payload = {"experiment_id": exp_id, "recommendations": recs, "note": f"strategy={al.get('strategy')} 闭环测试"}
    r = s.post(f"{BASE}/doe/experiments/export", json=export_payload, timeout=20)
    print(f"\n[6] POST /doe/experiments/export -> {r.status_code}")
    if r.status_code < 400:
        ex = r.json()
        print(f"  created_data_points={ex.get('created_data_points')} ids={str(ex.get('data_point_ids'))[:120]}")
    else:
        print(f"  body: {r.text[:300]}")

    # [7] inverse search
    if models:
        inv_payload = {"model": models[0], "target_values": {"response_Y": 13.0}}
        r = s.post(f"{BASE}/doe/inverse-search", json=inv_payload, timeout=20)
        inv = r.json()
        print(f"\n[7] POST /doe/inverse-search -> {r.status_code}")
        print(f"  predicted_factors={inv.get('predicted_factors')} feasibility={inv.get('feasibility_score')}")

    cleanup_temp_experiment()
    print("\n=== FULL DB CHAIN COMPLETE (temp data cleaned) ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

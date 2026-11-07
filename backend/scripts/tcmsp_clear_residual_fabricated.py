"""清除 桂花/山楂 残留的伪造 OB/DL/bioavailability 值（不在 TCMSP 索引，无法严谨纠正）。

这两个值是整数估值 + bioavailability_score=0.0（无意义），来源为 bencao/regulations（非科学库），
属伪造数据。它们是真实药材，只是无法按名精确匹配 TCMSP，故诚实置 NULL（留待后续别名匹配补真值）。
覆盖前备份原值到 sidecar，可回滚。
"""
import asyncio
import json
import os

import asyncpg

SIDECAR = os.path.join(os.path.dirname(__file__), "tcmsp_obdl_residual_cleared.json")
TARGETS = ["桂花", "山楂"]

async def m(apply: bool):
    c = await asyncpg.connect(host="localhost", port=5432, database="rmfood",
                              user="postgres", password="password")
    # 所有非 tcm_sp 来源仍持有 OB 的行 = 伪造残值（真实 OB/DL 现全来自 tcm_sp），
    # 统一诚实置 NULL，避免漏掉硬编码名单外的残留（如 大豆）。
    rows = await c.fetch(
        "SELECT id, name_cn, ob_percent, dl_value, bioavailability_score, source_db, data_quality "
        "FROM food_materials WHERE ob_percent IS NOT NULL AND source_db <> 'tcm_sp' "
        "ORDER BY id")
    backup = []
    for r in rows:
        backup.append({k: (float(v) if v is not None and k != "name_cn" and k != "source_db" else v)
                       for k, v in r.items()})
        if apply:
            await c.execute(
                "UPDATE food_materials SET ob_percent=NULL, dl_value=NULL, "
                "bioavailability_score=NULL WHERE id=$1", r["id"])
    await c.close()
    if apply:
        # 合并备份（不覆盖已有原值），保证跨重跑回滚完整
        existing = {"originals": []}
        if os.path.exists(SIDECAR):
            with open(SIDECAR, "r", encoding="utf-8") as f:
                existing = json.load(f)
        have = {o["id"] for o in existing.get("originals", [])}
        for b in backup:
            if b["id"] not in have:
                existing.setdefault("originals", []).append(b)
        existing["cleared_because"] = "not_in_tcmsp_index_unfounded_estimates"
        with open(SIDECAR, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)
        print("APPLIED: cleared fabricated OB/DL/bio on %d rows (merged backup -> %s, total %d originals)"
              % (len(backup), SIDECAR, len(existing["originals"])))
    else:
        print("DRY-RUN would clear fabricated values on:")
        for b in backup:
            print("  id=%s %s ob=%s dl=%s bio=%s src=%s" % (
                b["id"], b["name_cn"], b["ob_percent"], b["dl_value"],
                b["bioavailability_score"], b["source_db"]))

if __name__ == "__main__":
    import sys
    asyncio.run(m(apply="--apply" in sys.argv))

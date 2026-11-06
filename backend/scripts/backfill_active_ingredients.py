# -*- coding: utf-8 -*-
"""回填 food_materials.active_ingredients（P1，专业字段）。

数据源（本地权威，不编造）：
  - tcm_herbs.compounds (json)：TCMSP 分子列表 [{name, ob, dl, mw,...}]，612 行
  - hf_enriched_herbs.compounds (json)：同结构，111 行
按 name_cn（含 aliases）匹配，取两源分子名的并集。

范围（任务指定）：**仅药食同源/中药材**。普通食品（food_homology=False 且两源
均无匹配，如大米/小麦/玉米/花生/大豆）一律跳过，不硬填——无 TCMSP 分子数据即
诚实留空。

分子筛选：TCMSP 口服生物利用度 OB≥30 且 类药性 DL≥0.18（TCMSP 常用活性阈值）
优先；若筛后为空则回退到全部分子名。结果去重、截断 TOP 60，避免数组爆炸。

非破坏/幂等（only-fill）：仅填 active_ingredients 为空(NULL/空数组)的行；非空
一律跳过，重跑 0 更新。记录 source_db + data_quality + updated_at。

用法：
  python scripts/backfill_active_ingredients.py                       # dry-run
  python scripts/backfill_active_ingredients.py --apply               # 需二次确认
  python scripts/backfill_active_ingredients.py --apply --yes-i-know  # 确认后写库
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

SOURCE_DB = "tcm_herbs+hf_enriched_herbs.compounds"  # ≤50 字符
DATA_QUALITY = 0.85  # TCMSP 分子名，活性阈值筛选，中高置信
OB_MIN = 30.0
DL_MIN = 0.18
TOP_N = 60

EMPTY = "(active_ingredients IS NULL OR array_length(active_ingredients,1) IS NULL " \
        "OR array_length(active_ingredients,1) = 0)"


async def _conn():
    import asyncpg
    url = ""
    for line in (Path(__file__).resolve().parents[1] / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("DATABASE_URL="):
            url = line.split("=", 1)[1].strip().strip('"').strip("'")
    return await asyncpg.connect(url.replace("postgresql+asyncpg://", "postgresql://"))


def _load_compounds(raw):
    """解析 compounds json -> (active_names, all_names)。"""
    if not raw:
        return [], []
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return [], []
    if not isinstance(data, list):
        return [], []
    active, allnames = [], []
    for mol in data:
        if not isinstance(mol, dict):
            continue
        name = mol.get("name")
        if not name or not isinstance(name, str):
            continue
        name = name.strip()
        if not name:
            continue
        allnames.append(name)
        ob = mol.get("ob")
        dl = mol.get("dl")
        try:
            if ob is not None and dl is not None and float(ob) >= OB_MIN and float(dl) >= DL_MIN:
                active.append(name)
        except (TypeError, ValueError):
            pass
    return active, allnames


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="实际写库（默认 dry-run）")
    ap.add_argument("--yes-i-know", action="store_true", help="--apply 二次确认硬守卫")
    args = ap.parse_args()

    if args.apply and not args.yes_i_know:
        print("[REFUSING] --apply 需二次确认：请加 --yes-i-know（先 dry-run 核对）。")
        sys.exit(3)

    conn = await _conn()
    try:
        # 两源 compounds 载入内存（612+111 行，小）
        tcm_rows = await conn.fetch("SELECT name_cn, compounds FROM tcm_herbs WHERE compounds IS NOT NULL")
        hf_rows = await conn.fetch("SELECT name_cn, compounds FROM hf_enriched_herbs WHERE compounds IS NOT NULL")
        src = {}  # name -> {"active": set, "all": set}
        for r in list(tcm_rows) + list(hf_rows):
            key = r["name_cn"]
            if not key:
                continue
            active, alln = _load_compounds(r["compounds"])
            e = src.setdefault(key, {"active": set(), "all": set()})
            e["active"].update(active)
            e["all"].update(alln)

        # 待填行
        rows = await conn.fetch(
            f"SELECT id, name_cn, aliases, food_homology FROM food_materials WHERE {EMPTY} ORDER BY name_cn")
        before = await conn.fetchval(
            "SELECT COUNT(*) FROM food_materials WHERE array_length(active_ingredients,1) > 0")

        plan = []
        skipped_nosrc = []
        for r in rows:
            keys = [r["name_cn"]] + list(r["aliases"] or [])
            active, alln = set(), set()
            for k in keys:
                if k in src:
                    active |= src[k]["active"]
                    alln |= src[k]["all"]
            names = sorted(active) if active else sorted(alln)
            if not names:
                skipped_nosrc.append((r["name_cn"], r["food_homology"]))
                continue
            names = names[:TOP_N]
            plan.append((r["id"], r["name_cn"], names, "活性阈值OB≥30&DL≥0.18" if active else "全部分子(无阈值命中)"))

        total = await conn.fetchval("SELECT COUNT(*) FROM food_materials")
        print("=== backfill_active_ingredients dry-run 计划 ===")
        print(f"[before] total={total}；active_ingredients 非空={before}/{total}；空={len(rows)}")
        print(f"可回填（两源 TCMSP 分子命中）={len(plan)} 行；"
              f"无源跳过={len(skipped_nosrc)} 行（诚实留空）")
        if skipped_nosrc:
            fh_false = [n for n, fh in skipped_nosrc if not fh]
            print(f"  其中 food_homology=False 普通食品（按规则跳过）={len(fh_false)}："
                  f"{fh_false[:20]}{'...' if len(fh_false)>20 else ''}")
            fh_true_nosrc = [n for n, fh in skipped_nosrc if fh]
            if fh_true_nosrc:
                print(f"  其中 food_homology=True 但两源无分子（留空）={len(fh_true_nosrc)}：{fh_true_nosrc}")
        print("--- 逐行计划（前 40 行示例）---")
        for _id, name, names, how in plan[:40]:
            print(f"  {name} [{how}] {len(names)}种: {names[:6]}{'...' if len(names)>6 else ''}")

        if not args.apply:
            print("\n[dry-run] 未写库。确认后： "
                  "python scripts/backfill_active_ingredients.py --apply --yes-i-know")
            return

        updated = 0
        for fid, name, names, _how in plan:
            await conn.execute(
                "UPDATE food_materials SET active_ingredients=$2, source_db=$3, "
                "data_quality=$4, updated_at=NOW() "
                "WHERE id=$1 AND (active_ingredients IS NULL OR array_length(active_ingredients,1) IS NULL "
                "OR array_length(active_ingredients,1)=0)",
                fid, names, SOURCE_DB, DATA_QUALITY)
            updated += 1
        after = await conn.fetchval(
            "SELECT COUNT(*) FROM food_materials WHERE array_length(active_ingredients,1) > 0")
        print(f"\n[APPLY] active_ingredients 非空 {before}/{total} -> {after}/{total}（本次填 {after-before} 行）")
        print(f"[APPLY] source_db={SOURCE_DB}，data_quality={DATA_QUALITY}，updated_at=NOW()")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())

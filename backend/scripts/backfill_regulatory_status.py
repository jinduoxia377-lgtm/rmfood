# -*- coding: utf-8 -*-
"""回填 food_materials.regulatory_status（P0-1，最高 ROI——回填后合规引擎即刻生效）。

数据源（本地权威，不编造）：
  - backend/app/services/data_sources/china_food_regulations.py
      FOOD_HOMOLOGY_CATALOG (106 种药食同源) + FOOD_HOMOLOGY_MATERIALS[*].name
      NEW_FOOD_MATERIALS[*].name (新食品原料)

映射规则（任务指定，非「留空」）：
  药食同源目录内     -> "允许用于普通食品(药食同源)"
  新食品原料目录内   -> "已批准(新食品原料)"
  两者都不是         -> "待审"

非破坏/幂等（only-fill）：仅填 regulatory_status IS NULL 的行；非空一律跳过，
重跑 0 更新。每次回填记录 source_db + data_quality + updated_at。

用法：
  python scripts/backfill_regulatory_status.py                       # dry-run：打印计划，不写库
  python scripts/backfill_regulatory_status.py --apply               # 二次确认后写库
  python scripts/backfill_regulatory_status.py --apply --yes-i-know  # 确认守卫通过，写库
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.data_sources.china_food_regulations import (
    FOOD_HOMOLOGY_CATALOG,
    FOOD_HOMOLOGY_MATERIALS,
    NEW_FOOD_MATERIALS,
)

# 药食同源：目录集合 + FOOD_HOMOLOGY_MATERIALS 逐条 name（并集，容错）
HOMOLOGY_NAMES = set(FOOD_HOMOLOGY_CATALOG) | {m["name"] for m in FOOD_HOMOLOGY_MATERIALS}
NEW_FOOD_NAMES = {m["name"] for m in NEW_FOOD_MATERIALS}

STATUS_HOMOLOGY = "允许用于普通食品(药食同源)"
STATUS_NEW_FOOD = "已批准(新食品原料)"
STATUS_PENDING = "待审"

SOURCE_DB = "china_food_regulations"  # ≤50 字符（列 varchar(50)）
DATA_QUALITY = 0.98  # 官方目录逐名映射，高置信


async def _conn():
    import asyncpg
    url = ""
    for line in (Path(__file__).resolve().parents[1] / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("DATABASE_URL="):
            url = line.split("=", 1)[1].strip().strip('"').strip("'")
    return await asyncpg.connect(url.replace("postgresql+asyncpg://", "postgresql://"))


def classify(name: str):
    """返回 (status, source)。药食同源优先。"""
    if name in HOMOLOGY_NAMES:
        return STATUS_HOMOLOGY, "药食同源目录(2024版106种)"
    if name in NEW_FOOD_NAMES:
        return STATUS_NEW_FOOD, "新食品原料目录"
    return STATUS_PENDING, "两者都不是->待审"


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="实际写库（默认 dry-run）")
    ap.add_argument("--yes-i-know", action="store_true", help="--apply 的二次确认硬守卫")
    args = ap.parse_args()

    if args.apply and not args.yes_i_know:
        print("[REFUSING] --apply 需二次确认：请加 --yes-i-know（先跑 dry-run 核对计划）。")
        sys.exit(3)

    conn = await _conn()
    try:
        rows = await conn.fetch(
            "SELECT id, name_cn, regulatory_status FROM food_materials ORDER BY name_cn")
        before_nonnull = sum(1 for r in rows if r["regulatory_status"])
        plan = []
        for r in rows:
            if r["regulatory_status"]:
                continue  # only-fill：非空跳过
            status, src = classify(r["name_cn"])
            plan.append((r["id"], r["name_cn"], status, src))

        total = len(rows)
        print("=== backfill_regulatory_status dry-run 计划 ===")
        print(f"[before] food_materials={total} 行；regulatory_status 非空={before_nonnull}/{total}")
        # 统计三类
        from collections import Counter
        c = Counter(p[2] for p in plan)
        print(f"将回填 {len(plan)} 行：" + "；".join(f"{k}={v}" for k, v in c.items()))
        print("--- 逐行计划（name -> status | 来源）---")
        for _id, name, status, src in sorted(plan, key=lambda x: (x[2], x[1])):
            print(f"  {name} -> {status} | {src}")

        if not args.apply:
            print("\n[dry-run] 未写库。确认后执行： "
                  "python scripts/backfill_regulatory_status.py --apply --yes-i-know")
            return

        for fid, name, status, src in plan:
            # only-fill：WHERE regulatory_status IS NULL 保证幂等 + 不覆盖
            await conn.execute(
                "UPDATE food_materials SET regulatory_status=$2, source_db=$3, "
                "data_quality=$4, updated_at=NOW() "
                "WHERE id=$1 AND regulatory_status IS NULL",
                fid, status, SOURCE_DB, DATA_QUALITY)
        after_nonnull = await conn.fetchval(
            "SELECT COUNT(*) FROM food_materials WHERE regulatory_status IS NOT NULL")
        print(f"\n[APPLY] regulatory_status 非空 {before_nonnull}/{total} -> {after_nonnull}/{total} "
              f"（本次填 {after_nonnull - before_nonnull} 行）")
        print(f"[APPLY] 已记录 source_db={SOURCE_DB}，data_quality={DATA_QUALITY}，updated_at=NOW()")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())

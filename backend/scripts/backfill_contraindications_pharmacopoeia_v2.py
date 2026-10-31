# -*- coding: utf-8 -*-
"""《中国药典》2020 一部【注意】回填（v2 条目边界确证）。only-fill 非破坏，dry-run 默认。

v2 确证（条目边界解析，非窗口扫描）：81 缺禁忌药食同源药材中仅 3 味药典【注意】属实：
  苦杏仁(→杏仁/杏仁（甜、苦）) : 内服不宜过量,以免中毒（《药典》一部 苦杏仁【注意】）
  鲜芦根                        : 孕妇慎用（《药典》一部 鲜芦根【注意】）
  亚麻仁(→亚麻子)              : 大便滑泻者禁用（《药典》一部 亚麻子【注意】）
其余 78 味：条目定位/确证无【注意】（或非药典药材：枳椇子/葛花/白扁豆花/低聚木糖/花生 0 出现）。

用法：python scripts/backfill_contraindications_pharmacopoeia_v2.py [--apply]
"""
import asyncio
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import text

# 药典一部【注意】→ food_materials 行（含别名映射）
PLAN = {
    "苦杏仁": "内服不宜过量,以免中毒",
    "杏仁": "内服不宜过量,以免中毒",          # 别名→苦杏仁
    "杏仁（甜、苦）": "内服不宜过量,以免中毒",  # 别名→苦杏仁（苦杏仁为组分）
    "鲜芦根": "孕妇慎用",
    "亚麻仁": "大便滑泻者禁用",                # 别名→亚麻子
}
EMPTY = "(contraindications IS NULL OR array_length(contraindications,1) IS NULL OR array_length(contraindications,1)=0)"
SOURCE_DB = "pharmacopoeia2020"
DQ = 0.95


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="实际写库（默认 dry-run）")
    args = ap.parse_args()

    from app.core.database.session import async_session_factory
    async with async_session_factory() as db:
        total = (await db.execute(text("SELECT COUNT(*) FROM food_materials"))).scalar()
        before = (await db.execute(text(
            "SELECT COUNT(*) FROM food_materials WHERE array_length(contraindications,1) > 0"))).scalar()
        empty = (await db.execute(text(
            f"SELECT name_cn FROM food_materials WHERE {EMPTY} AND name_cn = ANY(:ns)"),
            {"ns": list(PLAN.keys())})).fetchall()
        empty_names = [r[0] for r in empty]

        print("=== 《药典》2020 一部【注意】回填（v2 条目边界确证）计划 ===")
        print(f"[before] food_materials={total}；contraindications={before}/{total}")
        print(f"回填候选: {len(PLAN)}；其中当前为空（可回填）: {len(empty_names)}")
        for n, t in PLAN.items():
            tag = "可回填" if n in empty_names else "已填/跳过"
            print(f"  {n}: {t}  [{tag}]")

        if not args.apply:
            print("\n[dry-run] 未写库。确认后执行 --apply")
            return

        updated = 0
        for n in empty_names:
            await db.execute(
                text("UPDATE food_materials SET contraindications=:c, source_db=:s, data_quality=:d, updated_at=NOW() "
                     "WHERE name_cn=:n AND " + EMPTY),
                {"c": [PLAN[n]], "s": SOURCE_DB, "d": DQ, "n": n})
            updated += 1
        await db.commit()
        print(f"\n[APPLY] 回填 {updated} 行（source_db={SOURCE_DB}, data_quality={DQ}）")
        after = (await db.execute(text(
            "SELECT COUNT(*) FROM food_materials WHERE array_length(contraindications,1) > 0"))).scalar()
        print(f"[APPLY] 实测 contraindications={after}/{total}")


if __name__ == "__main__":
    asyncio.run(main())

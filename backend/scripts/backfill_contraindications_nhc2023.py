# -*- coding: utf-8 -*-
"""国家卫健委 2023年第9号公告（党参等9种新增药食同源）使用限制回填。only-fill 非破坏，dry-run 默认。

权威源原文（nhc.gov.cn，2023年11月9日）：
  「上述物质作为食药物质，建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用。」
映射到 76 缺药食同源食材中的 4 行（2023公告条目且在 76 缺）：
  杜仲叶 / 肉苁蓉（荒漠）/ 铁皮石斛 / 山茱萸
注：普通「肉苁蓉」不映射（2023公告条目为「肉苁蓉（荒漠）」特定物种，避免臆测）。
其余 72 行：2002 卫法监发〔2002〕51号 药食同源分类清单（无逐条使用限制）；GB2760 为食品添加剂标准（不适用于全食材）。

用法：python scripts/backfill_contraindications_nhc2023.py [--apply]
"""
import asyncio
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import text

RESTRICTION = "孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用（国家卫生健康委员会2023年第9号公告）"
PLAN = {
    "杜仲叶": RESTRICTION,
    "肉苁蓉（荒漠）": RESTRICTION,
    "铁皮石斛": RESTRICTION,
    "山茱萸": RESTRICTION,
}
EMPTY = "(contraindications IS NULL OR array_length(contraindications,1) IS NULL OR array_length(contraindications,1)=0)"
SOURCE_DB = "nhc_food_homology"
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

        print("=== 国家卫健委 2023年第9号公告 使用限制回填 ===")
        print(f"[before] food_materials={total}；contraindications={before}/{total}")
        print(f"回填候选: {len(PLAN)}；当前为空（可回填）: {len(empty_names)}")
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

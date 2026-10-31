# -*- coding: utf-8 -*-
"""《本草纲目》（李时珍，明，公有领域）食养禁忌回填。only-fill 非破坏，dry-run 默认。

确证（条目【气味】/【主治】/【发明】原文核对，非臆造；12 味，其中 2 味已填跳过 → 11 行可填）：
  八角茴香 : 大茴香性热，多食伤目发疮，食料不宜过用（茴香【发明】时珍）
  大蒜     : 久食伤肝损眼；多食却明；久食令人血清，使毛发白（大蒜【气味】藏器/时珍）
  花椒     : 多食令人乏气喘促；久食令人失明，伤血脉（秦椒【气味】别录/李鹏飞）
  大枣(→枣) : 忌与葱同食令人五脏不和；与鱼同食令人腰腹痛；久食最损脾助湿热；齿病疳病虫人不宜啖枣
  小麦     : 多食，长宿 ，加客气（小麦面【气味】思邈）
  薤白     : 发热病不宜多食；三、四月勿食生者；不可与牛肉同食令人作症瘕
  白扁豆   : 患冷人勿食；患寒热者不可食
  芡实     : 先有冷气人不可食，令人腹胀气满；小儿秋月食多脐下结痛
  榧子     : 多食滑肠，五痔人宜之；榧子皮反绿豆，能杀人也
  桃仁     : 双仁者有毒，不可食
  薏苡仁   : 多食利二便，动膀胱气（已填，跳过）
  赤小豆   : 久食瘦人

注：古典食养禁忌（多食/久食/忌与X同食），非药品级；source_db=ben_cao_gang_mu, data_quality=0.85。
用法：python scripts/backfill_contraindications_bencaogangmu.py [--apply]
"""
import asyncio
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import text

PLAN = {
    "八角茴香": ["多食伤目发疮，食料不宜过用"],
    "白扁豆": ["患冷人勿食", "患寒热者不可食"],
    "赤小豆": ["久食瘦人"],
    "大蒜": ["久食伤肝损眼", "多食却明", "久食令人血清，使毛发白"],
    "花椒": ["多食令人乏气喘促", "久食令人失明，伤血脉"],
    "薤白": ["发热病不宜多食", "三、四月勿食生者", "不可与牛肉同食，令人作症瘕"],
    "芡实": ["先有冷气人不可食，令人腹胀气满", "小儿秋月食多，脐下结痛也"],
    "榧子": ["多食滑肠，五痔人宜之", "榧子皮反绿豆，能杀人也"],
    "桃仁": ["双仁者有毒，不可食"],
    "小麦": ["多食，长宿 ，加客气"],
    "枣": ["忌与葱同食，令人五脏不和；与鱼同食，令人腰腹痛", "久食最损脾、助湿热也", "有齿病、疳病、虫 人不宜啖枣"],
    "枣（大枣、酸枣、黑枣）": ["忌与葱同食，令人五脏不和；与鱼同食，令人腰腹痛", "久食最损脾、助湿热也", "有齿病、疳病、虫 人不宜啖枣"],
}
EMPTY = "(contraindications IS NULL OR array_length(contraindications,1) IS NULL OR array_length(contraindications,1)=0)"
SOURCE_DB = "ben_cao_gang_mu"
DQ = 0.85


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

        print("=== 《本草纲目》食养禁忌回填（条目原文核对）计划 ===")
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
                {"c": PLAN[n], "s": SOURCE_DB, "d": DQ, "n": n})
            updated += 1
        await db.commit()
        print(f"\n[APPLY] 回填 {updated} 行（source_db={SOURCE_DB}, data_quality={DQ}）")
        after = (await db.execute(text(
            "SELECT COUNT(*) FROM food_materials WHERE array_length(contraindications,1) > 0"))).scalar()
        print(f"[APPLY] 实测 contraindications={after}/{total}")


if __name__ == "__main__":
    asyncio.run(main())

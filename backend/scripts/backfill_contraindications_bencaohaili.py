# -*- coding: utf-8 -*-
"""《本草害利》《食鉴本草》《本草备要》《本草从新》禁忌回填（条目〔害〕/内联原文核对）。
only-fill 非破坏，dry-run 默认。确证 19 味 → 21 行（白茅根×2 + 姜×2 + 17）。dq=0.85 古典。
用法：python scripts/backfill_contraindications_bencaohaili.py [--apply]
"""
import asyncio
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import text

# name_cn -> (禁忌列表, source_db)
PLAN = {
    "白茅根": (["吐血因于虚寒者，非其所宜", "因寒发哕，中寒呕吐湿痰，停饮发热，并不宜服"], "ben_cao_hai_li"),
    "鲜白茅根": (["吐血因于虚寒者，非其所宜", "因寒发哕，中寒呕吐湿痰，停饮发热，并不宜服"], "ben_cao_hai_li"),
    "地黄": (["性寒而润，脾虚泄泻，胃虚食少，产后泄泻，俱禁用"], "ben_cao_hai_li"),
    "佛手": (["单用多用，亦损正气"], "ben_cao_hai_li"),
    "黄芥子": (["辛走气，气病无多食辛，多食则筋急爪枯", "辛热泄气，昏目动火伤精"], "ben_cao_hai_li"),
    "姜": (["干姜：辛能僭上，散气动血，损阴伤目", "生姜：九月食姜，伤人损寿"], "ben_cao_hai_li"),
    "姜（生姜、干姜）": (["干姜：辛能僭上，散气动血，损阴伤目", "生姜：九月食姜，伤人损寿"], "ben_cao_hai_li"),
    "橘皮": (["气味辛温，能耗真气，忌与耗气药同用", "胃虚有火呕吐，不宜与温热香燥药同用"], "ben_cao_hai_li"),
    "莱菔子": (["专下气复能耗血，久食涩营卫，白人须发", "服地黄、首乌者不可食"], "ben_cao_hai_li"),
    "木瓜": (["下部腰膝无力，精血真阴不足者不宜用", "伤食脾胃未虚，积滞多者不宜用", "多食令人癃"], "ben_cao_hai_li"),
    "砂仁": (["辛窜性燥，血虚火炎者勿用", "胎妇多服耗气，必致难产"], "ben_cao_hai_li"),
    "香薷": (["辛散，表无所感而中热者，误则损人表气，故无表邪者戒之"], "ben_cao_hai_li"),
    "小茴香": (["其性温燥，能昏目发疮", "胃肾多火，阳道数举，得热则吐者，均戒"], "ben_cao_hai_li"),
    "杏叶": (["性温有毒，有湿痰者勿服", "阴虚咳嗽便闭，肺家虚有热痰者忌"], "ben_cao_hai_li"),
    "郁李仁": (["性专下降，下后令人津液亏损，燥结愈甚", "津液不足者，慎勿轻投"], "ben_cao_hai_li"),
    "知母": (["伤胃滑肠，令人作泻", "脾弱，饮食不消化，胃虚不思食，肾虚溏泄者禁用"], "ben_cao_hai_li"),
    "蜂蜜": (["滑肠，泄泻与中满者忌用之", "忌与葱、鲜莴苣同食"], "ben_cao_bei_yao"),
    "黑胡椒": (["多食损肺，走气动火，发疮、痔、脏毒，齿痛目昏"], "ben_cao_bei_yao"),
    "紫苏": (["多服泄人真气"], "ben_cao_bei_yao"),
    "紫苏籽": (["肠滑气虚者忌用"], "ben_cao_bei_yao"),
    "昆布": (["性雄，多服令人瘦削"], "ben_cao_cong_xin"),
}
EMPTY = "(contraindications IS NULL OR array_length(contraindications,1) IS NULL OR array_length(contraindications,1)=0)"
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

        print("=== 《本草害利/食鉴本草/本草备要/本草从新》禁忌回填计划 ===")
        print(f"[before] food_materials={total}；contraindications={before}/{total}")
        print(f"回填候选: {len(PLAN)}；当前为空（可回填）: {len(empty_names)}")
        for n, (c, s) in PLAN.items():
            tag = "可回填" if n in empty_names else "已填/跳过"
            print(f"  {n}: {c}  [{tag} source={s}]")

        if not args.apply:
            print("\n[dry-run] 未写库。确认后执行 --apply")
            return

        updated = 0
        for n in empty_names:
            c, s = PLAN[n]
            await db.execute(
                text("UPDATE food_materials SET contraindications=:c, source_db=:s, data_quality=:d, updated_at=NOW() "
                     "WHERE name_cn=:n AND " + EMPTY),
                {"c": c, "s": s, "d": DQ, "n": n})
            updated += 1
        await db.commit()
        print(f"\n[APPLY] 回填 {updated} 行（data_quality={DQ}）")
        after = (await db.execute(text(
            "SELECT COUNT(*) FROM food_materials WHERE array_length(contraindications,1) > 0"))).scalar()
        print(f"[APPLY] 实测 contraindications={after}/{total}")


if __name__ == "__main__":
    asyncio.run(main())

# -*- coding: utf-8 -*-
"""《中国药典》十九畏禁忌源回填 food_materials.contraindications（默认 dry-run，--apply 才写库）。

背景（RAG 非功能补全 Step1，禁忌源《中国药典》回填）：
  food_materials.contraindications 已达 55/142；剩余 87 行无本地真实源（HERB_KNOWLEDGE_BASE /
  herb_food_herbs / tcm_herbs 已穷尽）。本脚本以**经典《中国药典》十九畏**（权威配伍禁忌歌诀）
  为源，对剩余药食同源药材推导药材级"不宜与XX同用（《中国药典》十九畏）"文本，仅填空回填。

  经典十九畏歌诀：硫磺原是火中精，朴硝一见便相争；水银莫与砒霜见，狼毒最怕密陀僧；
  巴豆性烈最为上，偏与牵牛不顺情；丁香莫与郁金见，牙硝难合京三棱；
  川乌草乌不顺犀，人参最怕五灵脂；官桂善能调冷气，若逢石脂便相欺。
  经与 87 味剩余药食同源药材交叉核对，适用者为：
    丁香 → 不宜与郁金同用（《中国药典》十九畏）
    肉桂 → 不宜与赤石脂同用（《中国药典》十九畏）（官桂=肉桂；石脂=赤石脂）
  其余经典十九畏对涉及非药食同源药材（硫磺、朴硝、水银、砒霜、狼毒、密陀僧、巴豆、牵牛、
  牙硝、三棱、川乌、草乌、犀角、人参、五灵脂），不在 food_materials（药食同源）范畴，不适用。

约束：
  - 仅填空：array_length(contraindications,1) IS NULL 或 =0 的行才回填；**绝不覆盖非空值**。
  - 幂等：重复运行无副作用。
  - 源为经典《中国药典》十九畏（权威、可溯源、非编造）。
  - 不使用非经典/民间禁忌（如人参-莱菔子、食物相克）——避免向临床禁忌字段传播低质/民间数据。

用法：
  python scripts/backfill_contraindications_pharmacopoeia.py            # dry-run
  python scripts/backfill_contraindications_pharmacopoeia.py --apply    # 实际写库（仅填空）
"""
import asyncio
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import text

# 经典《中国药典》十九畏（权威配伍禁忌，可溯源）。仅药食同源适用的对。
SHIJIWEI_CANONICAL_PAIRS = [
    ("丁香", "郁金"),
    ("肉桂", "赤石脂"),  # 官桂=肉桂；石脂=赤石脂
]

EMPTY = "(contraindications IS NULL OR array_length(contraindications,1) IS NULL OR array_length(contraindications,1)=0)"


def _canonical_19wei_text(name_cn: str) -> list[str]:
    """由经典《中国药典》十九畏推导药材级禁忌文本。"""
    out: list[str] = []
    for a, b in SHIJIWEI_CANONICAL_PAIRS:
        if name_cn == a:
            out.append(f"不宜与{b}同用（《中国药典》十九畏）")
        elif name_cn == b:
            out.append(f"不宜与{a}同用（《中国药典》十九畏）")
    return out


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="实际写库（默认 dry-run）")
    args = ap.parse_args()

    from app.core.database.session import async_session_factory
    async with async_session_factory() as db:
        total = (await db.execute(text("SELECT COUNT(*) FROM food_materials"))).scalar()
        before = (await db.execute(text(
            "SELECT COUNT(*) FROM food_materials WHERE array_length(contraindications,1) > 0"))).scalar()
        rows = (await db.execute(text(
            f"SELECT name_cn FROM food_materials WHERE {EMPTY} ORDER BY name_cn"))).fetchall()
        missing = [r[0] for r in rows]

        plan = {}
        for name in missing:
            c19 = _canonical_19wei_text(name)
            if c19:
                plan[name] = c19

        print("=== backfill_contraindications_pharmacopoeia（《中国药典》十九畏）计划 ===")
        print(f"[before] food_materials={total} 行；contraindications={before}/{total}")
        print(f"missing: {len(missing)}；可回填（经典十九畏）: {len(plan)}")
        for name, contra in plan.items():
            print(f"  {name}: {contra}")

        if not args.apply:
            print("\n[dry-run] 未写库。确认后执行： python scripts/backfill_contraindications_pharmacopoeia.py --apply")
            return

        updated = 0
        for name, contra in plan.items():
            cur = (await db.execute(text(
                "SELECT contraindications FROM food_materials WHERE name_cn=:n"), {"n": name})).scalar()
            if not cur:  # None 或空数组（array_length IS NULL）
                await db.execute(
                    text("UPDATE food_materials SET contraindications=:c, updated_at=NOW() WHERE name_cn=:n"),
                    {"c": contra, "n": name})
                updated += 1
        await db.commit()
        print(f"\n[APPLY] contraindications 回填 {updated} 行")
        after = (await db.execute(text(
            "SELECT COUNT(*) FROM food_materials WHERE array_length(contraindications,1) > 0"))).scalar()
        print(f"[APPLY] 实测 contraindications={after}/{total}")


if __name__ == "__main__":
    asyncio.run(main())

# -*- coding: utf-8 -*-
"""非破坏回填 food_materials.contraindications（默认 dry-run，--apply 才写库）。

背景（RAG 非功能补全 Step1）：
  food_materials.contraindications 仅 29/142。穷举本地真实禁忌源后，可用源（按权威性/优先级）：
    1. HERB_KNOWLEDGE_BASE.contraindication（app/services/knowledge_base.py，52 味药食同源，
       国家卫健委目录 + 中医药典籍策展；孕妇慎用/脾胃虚寒者慎用等真实禁忌）——主源。
    2. herb_food_herbs.restrictions（卫健委药食同源目录表，11 行非空，如山药:胃寒腹痛者忌用）。
    3. tcm_herbs.contraindications（TCMSP/典籍，11 行非空，如白扁豆:脾虚寒者忌用）。

约束：
  - 仅填空：array_length(contraindications,1) IS NULL 或 =0 的行才回填；**绝不覆盖非空值**。
  - 幂等：重复运行无副作用。
  - 源数据均为真实（不造禁忌）。禁忌文本按 、，,；; 切分为数组（与既有 29 行格式一致）。

用法：
  python scripts/backfill_contraindications.py            # dry-run：打印 before/after 计划
  python scripts/backfill_contraindications.py --apply    # 实际写库（仅填空）
"""
import asyncio
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.knowledge_base import HERB_KNOWLEDGE_BASE

# 空数组在 PG 中 array_length('{}',1) 返回 NULL，故必须同时判 IS NULL 与 =0。
EMPTY = "({col} IS NULL OR array_length({col},1) IS NULL OR array_length({col},1)=0)"


def _split(text):
    """按 、，,；; 切分禁忌文本为数组（保持既有格式）。"""
    if not text:
        return []
    out = []
    for ch in ("、", "，", ",", "；", ";", "/"):
        text = text.replace(ch, "|")
    for p in text.split("|"):
        p = p.strip()
        if p and p not in out:
            out.append(p)
    return out


async def _conn():
    import asyncpg
    from pathlib import Path as P
    url = ""
    for line in (P(__file__).resolve().parents[1] / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("DATABASE_URL="):
            url = line.split("=", 1)[1].strip().strip('"').strip("'")
    return await asyncpg.connect(url.replace("postgresql+asyncpg://", "postgresql://"))


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="实际写库（默认 dry-run）")
    args = ap.parse_args()

    conn = await _conn()
    try:
        total = await conn.fetchval("SELECT COUNT(*) FROM food_materials")
        before = await conn.fetchval(
            "SELECT COUNT(*) FROM food_materials WHERE array_length(contraindications,1) > 0")

        # 缺禁忌的行（NULL 或空数组）
        rows = await conn.fetch(
            f"SELECT name_cn FROM food_materials WHERE {EMPTY.format(col='contraindications')} ORDER BY name_cn")
        missing = [r["name_cn"] for r in rows]

        # 源2/源3 载入
        src_hfh = {}
        for r in await conn.fetch("SELECT name_cn, restrictions FROM herb_food_herbs WHERE array_length(restrictions,1) > 0"):
            src_hfh[r["name_cn"]] = [str(x).strip() for x in r["restrictions"] if str(x).strip()]
        src_tcm = {}
        for r in await conn.fetch("SELECT name_cn, contraindications FROM tcm_herbs WHERE contraindications IS NOT NULL AND btrim(contraindications)<>''"):
            src_tcm[r["name_cn"]] = _split(r["contraindications"])

        # 按优先级组装回填计划：KB → herb_food_herbs → tcm_herbs（首命中）
        plan = {}
        src_used = {}
        for name in missing:
            if name in HERB_KNOWLEDGE_BASE and HERB_KNOWLEDGE_BASE[name].get("contraindication"):
                plan[name] = _split(HERB_KNOWLEDGE_BASE[name]["contraindication"])
                src_used[name] = "knowledge_base"
            elif name in src_hfh and src_hfh[name]:
                plan[name] = src_hfh[name]
                src_used[name] = "herb_food_herbs"
            elif name in src_tcm and src_tcm[name]:
                plan[name] = src_tcm[name]
                src_used[name] = "tcm_herbs"

        print("=== backfill_contraindications 计划 ===")
        print(f"[before] food_materials={total} 行；contraindications={before}/{total}")
        print(f"missing: {len(missing)}；可回填: {len(plan)}")
        by_src = {}
        for name, s in src_used.items():
            by_src[s] = by_src.get(s, 0) + 1
        print(f"  源分布: {by_src}")
        for name, contra in plan.items():
            print(f"  {name} ({src_used[name]}): {contra}")

        if not args.apply:
            print("\n[dry-run] 未写库。确认后执行： python scripts/backfill_contraindications.py --apply")
            return

        updated = 0
        for name, contra in plan.items():
            cur = await conn.fetchval("SELECT contraindications FROM food_materials WHERE name_cn=$1", name)
            if not cur:  # None 或空数组（array_length IS NULL）
                await conn.execute(
                    "UPDATE food_materials SET contraindications=$2, updated_at=NOW() WHERE name_cn=$1",
                    name, contra)
                updated += 1
        await conn.execute("COMMIT")
        print(f"\n[APPLY] contraindications 回填 {updated} 行")
        after = await conn.fetchval(
            "SELECT COUNT(*) FROM food_materials WHERE array_length(contraindications,1) > 0")
        print(f"[APPLY] 实测 contraindications={after}/{total}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())

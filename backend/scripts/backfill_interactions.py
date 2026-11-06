# -*- coding: utf-8 -*-
"""回填 food_materials.interactions（P1，专业字段）。

数据源（本地权威，不编造）：backend/app/services/ai_models/safety_checker.py 的
  - _EIGHTEEN_CONTRAINDICATIONS（十八反，17 对）
  - _NINETEEN_ANTAGONISMS（十九畏，11 对）
  - _PREGNANCY_CAUTION（孕妇慎用/禁用清单）
共 28 对配伍禁忌 + 孕妇禁忌。仅读这些静态规则表（数据常量），不调用业务方法。

生成规则：对每味原料 name_cn（含 aliases），若命中某配伍禁忌的一端，则生成
  "不宜与{另一端}同用（十八反/十九畏）"；孕妇禁忌生成 "孕妇慎用/禁用"。
配伍对另一端多不在药食同源库内（如甘遂/大戟/藜芦），此时仍如实记录禁忌另一方，
供合规引擎在配方层面拦截——不因「库内无此味」而丢弃规则。

范围：**仅药食同源/中药材**（food_homology=True 全部纳入；food_homology=False 但
命中规则者也纳入，因其为中药材如人参/白术/白芍/太子参）。普通食品无配伍规则，
自然不命中，不硬填。

非破坏/幂等（only-fill）：仅填 interactions 为空的行；重跑 0 更新。
记录 source_db + data_quality + updated_at。

用法：
  python scripts/backfill_interactions.py                       # dry-run
  python scripts/backfill_interactions.py --apply --yes-i-know  # 确认后写库
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.ai_models.safety_checker import (
    _EIGHTEEN_CONTRAINDICATIONS,
    _NINETEEN_ANTAGONISMS,
    _PREGNANCY_CAUTION,
)

SOURCE_DB = "safety_checker(十八反十九畏+孕妇禁忌)"  # ≤50 字符
DATA_QUALITY = 0.9

CONTRA_PAIRS = [("十八反", a, b) for a, b in _EIGHTEEN_CONTRAINDICATIONS] + \
               [("十九畏", a, b) for a, b in _NINETEEN_ANTAGONISMS]

EMPTY = "(interactions IS NULL OR array_length(interactions,1) IS NULL " \
        "OR array_length(interactions,1) = 0)"


async def _conn():
    import asyncpg
    url = ""
    for line in (Path(__file__).resolve().parents[1] / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("DATABASE_URL="):
            url = line.split("=", 1)[1].strip().strip('"').strip("'")
    return await asyncpg.connect(url.replace("postgresql+asyncpg://", "postgresql://"))


def gen_interactions(name, aliases):
    """返回该原料的 interactions 文本数组（可能为空）。"""
    keys = {name} | set(aliases or [])
    out = []
    for kind, a, b in CONTRA_PAIRS:
        if a in keys and b not in out:
            out.append(f"不宜与{b}同用（{kind}）")
        elif b in keys and a not in out:
            out.append(f"不宜与{a}同用（{kind}）")
    if name in _PREGNANCY_CAUTION:
        out.append("孕妇慎用/禁用（妊娠禁忌）")
    # 去重保序
    seen, res = set(), []
    for x in out:
        if x not in seen:
            seen.add(x)
            res.append(x)
    return res


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--yes-i-know", action="store_true")
    args = ap.parse_args()

    if args.apply and not args.yes_i_know:
        print("[REFUSING] --apply 需二次确认：请加 --yes-i-know。")
        sys.exit(3)

    conn = await _conn()
    try:
        rows = await conn.fetch(
            f"SELECT id, name_cn, aliases, food_homology FROM food_materials WHERE {EMPTY} ORDER BY name_cn")
        total = await conn.fetchval("SELECT COUNT(*) FROM food_materials")
        before = await conn.fetchval(
            "SELECT COUNT(*) FROM food_materials WHERE array_length(interactions,1) > 0")

        plan = []
        for r in rows:
            if not r["food_homology"]:
                # 仅药食同源/中药材；普通食品跳过（除非命中孕妇/配伍，但普通食品不会命中）
                inter = gen_interactions(r["name_cn"], r["aliases"])
                if not inter:
                    continue
            else:
                inter = gen_interactions(r["name_cn"], r["aliases"])
                if not inter:
                    continue
            plan.append((r["id"], r["name_cn"], inter, r["food_homology"]))

        print("=== backfill_interactions dry-run 计划 ===")
        print(f"[before] total={total}；interactions 非空={before}/{total}；空={len(rows)}")
        print(f"命中配伍/孕妇禁忌可回填={len(plan)} 行（其余无规则命中，诚实留空）")
        print("--- 逐行计划 ---")
        for _id, name, inter, fh in plan:
            print(f"  {name}{'(药食同源)' if fh else '(中药材)'}: {inter}")

        if not args.apply:
            print("\n[dry-run] 未写库。确认后： "
                  "python scripts/backfill_interactions.py --apply --yes-i-know")
            return

        for fid, name, inter, _fh in plan:
            await conn.execute(
                "UPDATE food_materials SET interactions=$2, source_db=$3, data_quality=$4, "
                "updated_at=NOW() WHERE id=$1 AND (interactions IS NULL OR "
                "array_length(interactions,1) IS NULL OR array_length(interactions,1)=0)",
                fid, inter, SOURCE_DB, DATA_QUALITY)
        after = await conn.fetchval(
            "SELECT COUNT(*) FROM food_materials WHERE array_length(interactions,1) > 0")
        print(f"\n[APPLY] interactions 非空 {before}/{total} -> {after}/{total}（本次填 {after-before} 行）")
        print(f"[APPLY] source_db={SOURCE_DB}，data_quality={DATA_QUALITY}，updated_at=NOW()")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())

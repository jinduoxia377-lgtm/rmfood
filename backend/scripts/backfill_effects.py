# -*- coding: utf-8 -*-
"""非破坏性回填 food_materials.effects / contraindications（默认 dry-run，--apply 才写库）。

背景（RAG 非功能补全 任务1）：
  food_materials 经 complete_food_materials.py + 并行 tcm_herbs 回填后，effects 已 137/142、
  contraindications 133/142。本脚本负责**补齐剩余缺口**，且**只填空、绝不覆盖非空值**：
  - effects：从 tcm_herbs.effects（"、"分隔）按 name_cn 回填（权威 TCMSP/真实药材功效）。
  - contraindications：优先 tcm_herbs.extra_knowledge.contraindication(s)，其次保持现状
    （HERB_DOSAGE_DATABASE/curated 已在 complete_food_materials.py 覆盖——tcm_herbs 无
    contraindication 数据，此路径通常为 no-op）。

幂等：仅 UPDATE 空值行；重复运行无副作用。非破坏：非空 effects/contraindications 永不覆盖。

用法：
  python scripts/backfill_effects.py            # dry-run：打印将回填清单，不写库
  python scripts/backfill_effects.py --apply    # 实际写库（仅填空，不覆盖）
"""
import asyncio
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# 注意：PostgreSQL 空数组 ::text 渲染为 '{}' 而非 '[]'，故用 array_length 判定「空」，
# 否则会漏掉所有空数组行（此前误把 '{}' 当非空，虚高非空率）。
EMPTY_CHECK = "({col} IS NULL OR array_length({col}, 1) IS NULL OR array_length({col}, 1) = 0)"


def _split_effects(raw):
    if not raw:
        return []
    parts = []
    for ch in ("、", "，", ",", "；", ";"):
        raw = raw.replace(ch, "|")
    for p in raw.split("|"):
        p = p.strip()
        if p and p not in parts:
            parts.append(p)
    return parts


def _extra_contraindications(extra_knowledge):
    """从 tcm_herbs.extra_knowledge JSON 提取 contraindication(s)。"""
    if not extra_knowledge:
        return []
    try:
        d = json.loads(extra_knowledge) if isinstance(extra_knowledge, str) else extra_knowledge
        val = d.get("contraindication") or d.get("contraindications") or d.get("restrictions")
    except Exception:
        return []
    if isinstance(val, list):
        return [str(x).strip() for x in val if str(x).strip()]
    if isinstance(val, str):
        return _split_effects(val)
    return [str(val)] if val else []


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
        # 缺 effects 的行 + tcm_herbs 匹配
        rows = await conn.fetch(
            "SELECT f.name_cn, t.effects AS t_effects, t.extra_knowledge AS t_ek "
            "FROM food_materials f LEFT JOIN tcm_herbs t ON t.name_cn = f.name_cn "
            f"WHERE {EMPTY_CHECK.format(col='f.effects')} ORDER BY f.name_cn")
        eff_plan = []
        for r in rows:
            effects = _split_effects(r["t_effects"])
            if effects:
                eff_plan.append((r["name_cn"], effects))

        # 缺 contraindications 的行 + tcm_herbs.extra_knowledge
        rows = await conn.fetch(
            "SELECT f.name_cn, t.extra_knowledge AS t_ek "
            "FROM food_materials f LEFT JOIN tcm_herbs t ON t.name_cn = f.name_cn "
            f"WHERE {EMPTY_CHECK.format(col='f.contraindications')} ORDER BY f.name_cn")
        contra_plan = []
        for r in rows:
            contra = _extra_contraindications(r["t_ek"])
            if contra:
                contra_plan.append((r["name_cn"], contra))

        # 真实 before 计数（array_length 判定非空）
        total = await conn.fetchval("SELECT COUNT(*) FROM food_materials")
        eff_before = await conn.fetchval(
            "SELECT COUNT(*) FROM food_materials WHERE array_length(effects,1) > 0")
        contra_before = await conn.fetchval(
            "SELECT COUNT(*) FROM food_materials WHERE array_length(contraindications,1) > 0")

        print("=== backfill_effects dry-run 计划 ===")
        print(f"[before] food_materials={total} 行；effects={eff_before}/{total}；contraindications={contra_before}/{total}")
        print(f"effects 可回填（tcm_herbs 匹配）: {len(eff_plan)} 行")
        for name, eff in eff_plan:
            print(f"  {name}: {eff}")
        print(f"contraindications 可回填（extra_knowledge）: {len(contra_plan)} 行")
        for name, contra in contra_plan:
            print(f"  {name}: {contra}")

        if not args.apply:
            print("\n[dry-run] 未写库。确认后执行： python scripts/backfill_effects.py --apply")
            return

        # --apply：仅填空、不覆盖
        updated_eff = updated_contra = 0
        for name, effects in eff_plan:
            cur = await conn.fetchval(
                f"SELECT effects FROM food_materials WHERE name_cn=$1", name)
            if not cur:  # None 或空数组
                await conn.execute(
                    "UPDATE food_materials SET effects=$2, updated_at=NOW() WHERE name_cn=$1",
                    name, effects)
                updated_eff += 1
        for name, contra in contra_plan:
            cur = await conn.fetchval(
                f"SELECT contraindications FROM food_materials WHERE name_cn=$1", name)
            if not cur:  # None 或空数组
                await conn.execute(
                    "UPDATE food_materials SET contraindications=$2, updated_at=NOW() WHERE name_cn=$1",
                    name, contra)
                updated_contra += 1
        await conn.execute("COMMIT")
        print(f"\n[APPLY] effects 回填 {updated_eff} 行；contraindications 回填 {updated_contra} 行")

        # 回读实测（用 array_length 判定真实非空）
        total = await conn.fetchval("SELECT COUNT(*) FROM food_materials")
        eff = await conn.fetchval(
            "SELECT COUNT(*) FROM food_materials WHERE array_length(effects,1) > 0")
        contra = await conn.fetchval(
            "SELECT COUNT(*) FROM food_materials WHERE array_length(contraindications,1) > 0")
        print(f"[APPLY] 实测 food_materials={total} 行；effects={eff}/{total}；contraindications={contra}/{total}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())

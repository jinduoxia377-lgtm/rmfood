# -*- coding: utf-8 -*-
"""药食同源目录归一（P0-2 + P0-4 苦杏仁安全）。

权威基准：backend/app/services/data_sources/china_food_regulations.py 的
FOOD_HOMOLOGY_CATALOG（官方 106 种）。归一后 food_homology=True 的 distinct
name_cn 必须 ⊆ 该 106 项。

处理三类问题（当前 name_cn 120 distinct → 归一后 106）：
  1. 拆括号复合名：`姜（生姜、干姜）` -> 规范名 `姜` + aliases[生姜,干姜]。
     该括号行与已有规范名行重复 -> 数据无损合并进规范名行后删除括号行。
  2. 炮制品/异体字归一：熟地黄->地黄、红枣->枣、桑葚->桑椹、陈皮->橘皮、
     大枣->枣、生姜->姜、桂圆肉->龙眼肉、白茅根->鲜白茅根、苦杏仁->杏仁。
     同样无损合并进规范名行后删除异体行。
  3. 补 5 个官方别名进对应原料 aliases 数组（非新增行）。

合并是「加法且无损」：aliases/effects/contraindications 取并集，绝不丢已有值；
toxicity_class 仅当规范名行为空时才取异体行值（保留苦杏仁「小毒」）。

P0-4 苦杏仁：归一后并入 `杏仁` 行（official 只收 `杏仁`），保留 food_homology=True、
toxicity_class=小毒，并把官方/药典口径安全禁忌并入 contraindications（only-fill）。

幂等：重跑 0 变更（异体行已删、别名已存在即跳过）。

用法：
  python scripts/normalize_food_homology.py                        # dry-run：打印全表计划
  python scripts/normalize_food_homology.py --apply                # 需二次确认
  python scripts/normalize_food_homology.py --apply --yes-i-know   # 确认后写库
"""
import argparse
import asyncio
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.data_sources.china_food_regulations import FOOD_HOMOLOGY_CATALOG

OFFICIAL_106 = set(FOOD_HOMOLOGY_CATALOG)

# 异体字/炮制品/独立别名行 -> 规范名（均为 official 106 之内）。合并后删除异体行。
ALIAS_TO_CANONICAL = {
    "红枣": "枣", "熟地黄": "地黄", "桑葚": "桑椹", "陈皮": "橘皮",
    "大枣": "枣", "生姜": "姜", "桂圆肉": "龙眼肉", "白茅根": "鲜白茅根",
    "苦杏仁": "杏仁",
}

# 补 5 个官方别名 -> 规范名（official 106 之内，均已有行；不加行）
EXTRA_ALIASES = {
    "姜": ["干姜"],
    "龙眼肉": ["桂圆"],
    "化橘红": ["橘红"],
    "西红花": ["藏红花"],
    "山柰": ["山奈"],  # 已核实：库内规范名 山柰(Kaempferia galanga)，山奈为同物异字，
                       # compliance_engine/safety_checker 均将 山奈 列为其别名
}

# P0-4 苦杏仁官方/药典口径安全禁忌（写入 杏仁 行，标注来源）。
# 苦杏仁并入 杏仁 后，杏仁 继承 小毒 + 本安全句；only-append，不重复。
KUXINGREN_SAFETY = (
    "含苦杏仁苷，不宜过量或生食，孕妇慎用，儿童禁用"
    "（据《中国药典》2025年版苦杏仁项及国家药食同源目录安全口径）"
)
KUX_SAFETY_KEY = "苦杏仁苷"  # 判定 杏仁 行是否已含安全句的关键词（幂等）

# 毒性等级升序；合并时取「更保守（更高）」值，避免 苦杏仁(小毒) 并入 杏仁(无毒) 丢失毒性信号
TOX_RANK = {"无毒": 0, "小毒": 1, "有毒": 2, "大毒": 3}

SOURCE_DB = "china_food_regulations+pharmacopoeia"  # ≤50 字符（列 varchar(50)）
DATA_QUALITY = 0.97


async def _conn():
    import asyncpg
    url = ""
    for line in (Path(__file__).resolve().parents[1] / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("DATABASE_URL="):
            url = line.split("=", 1)[1].strip().strip('"').strip("'")
    return await asyncpg.connect(url.replace("postgresql+asyncpg://", "postgresql://"))


def parse_bracket(name: str):
    """`姜（生姜、干姜）` -> (canonical='姜', bracket_aliases=['生姜','干姜'])。
    无括号 -> (name, [])。"""
    m = re.match(r"^(.+?)（(.+)）$", name)
    if not m:
        return name, []
    canonical = m.group(1).strip()
    inner = m.group(2)
    parts = re.split(r"[、,，/]", inner)
    return canonical, [p.strip() for p in parts if p.strip()]


def dedup(seq):
    out = []
    for x in seq:
        if x and x not in out:
            out.append(x)
    return out


async def get_row(conn, name):
    return await conn.fetchrow(
        "SELECT id, name_cn, aliases, effects, contraindications, toxicity_class, food_homology "
        "FROM food_materials WHERE name_cn=$1", name)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="实际写库（默认 dry-run）")
    ap.add_argument("--yes-i-know", action="store_true", help="--apply 的二次确认硬守卫")
    args = ap.parse_args()

    if args.apply and not args.yes_i_know:
        print("[REFUSING] --apply 需二次确认：请加 --yes-i-know（先跑 dry-run 核对全表）。")
        sys.exit(3)

    conn = await _conn()
    try:
        rows = await conn.fetch(
            "SELECT id, name_cn, aliases, effects, contraindications, toxicity_class "
            "FROM food_materials WHERE food_homology ORDER BY name_cn")
        by_name = {r["name_cn"]: r for r in rows}
        names = set(by_name)

        # ── 1. 计算每个 food_homology 行的规范名 ──
        # 优先级：括号拆分 > 显式异体表 > 自身已是规范名
        fold_plan = []   # (variant_name, canonical, new_aliases, del_row)
        for name in sorted(names):
            if "（" in name:
                canonical, bracket_aliases = parse_bracket(name)
                fold_plan.append((name, canonical, bracket_aliases, True))
            elif name in ALIAS_TO_CANONICAL:
                fold_plan.append((name, ALIAS_TO_CANONICAL[name], [], True))
            # else: 自身即规范名，不动

        print("=== normalize_food_homology dry-run 计划 ===")
        print(f"[before] food_homology 行={len(names)}；distinct name_cn={len(names)}")
        print(f"官方基准 106 项。将合并/删除 {len(fold_plan)} 个异体/括号行：")
        for vname, canon, bracket_al, _del in fold_plan:
            note = f" 拆括号别名{bracket_al}" if bracket_al else ""
            print(f"  {vname}  ->  {canon}{note}")
            # 数据无损核对：异体行独有值提示
            vrow = by_name.get(vname)
            crow = by_name.get(canon)
            if vrow and crow:
                for field in ("effects", "contraindications", "aliases"):
                    vset = set(vrow[field] or [])
                    cset = set(crow[field] or [])
                    only_v = vset - cset
                    if only_v:
                        print(f"      [无损合并] {field} 并入规范名行: {sorted(only_v)}")
                if vrow["toxicity_class"] and vrow["toxicity_class"] != crow["toxicity_class"]:
                    print(f"      [毒性] 异体行 toxicity={vrow['toxicity_class']}，"
                          f"规范名行={crow['toxicity_class']} -> 规范名行为空才取异体值")

        # ── 2. 补 5 个官方别名 ──
        print("\n补官方别名（进已有行 aliases，不加行）：")
        alias_plan = []
        for canon, al_list in EXTRA_ALIASES.items():
            crow = by_name.get(canon)
            if crow is None:
                print(f"  [跳过] 规范名行 {canon} 不在库中")
                continue
            cur = set(crow["aliases"] or [])
            to_add = [a for a in al_list if a not in cur]
            alias_plan.append((canon, to_add))
            print(f"  {canon}: 现有={sorted(cur)} -> 新增={to_add if to_add else '无(已存在)'}")

        # ── 3. P0-4 苦杏仁安全禁忌（并入 杏仁 行）──
        print("\nP0-4 苦杏仁安全：归一后并入 `杏仁` 行，安全禁忌 only-fill：")
        xingren = by_name.get("杏仁")
        will_have = bool(xingren and xingren["contraindications"])
        # only-fill：杏仁 若已通过苦杏仁归并带上禁忌，或本身已有，则跳过
        if will_have:
            print(f"  杏仁 行已有 contraindications={xingren['contraindications']} -> only-fill 跳过安全句"
                  f"（苦杏仁并入时其禁忌会无损并入）")
        else:
            print(f"  杏仁 行禁忌为空 -> 写入安全句: {KUXINGREN_SAFETY}")

        # ── 归一后 distinct 校验 ──
        after_names = set(names)
        for vname, canon, _a, _d in fold_plan:
            after_names.discard(vname)
        outside = after_names - OFFICIAL_106
        print(f"\n[校验] 归一后 distinct={len(after_names)}；"
              f"∉官方106 的残留={sorted(outside) if outside else '无（⊆官方106 ✓）'}")

        if not args.apply:
            print("\n[dry-run] 未写库。确认后执行： "
                  "python scripts/normalize_food_homology.py --apply --yes-i-know")
            return

        # ══ APPLY：单事务原子 ══
        async with conn.transaction():
            # 备份将被删除的异体行（可逆保险），幂等
            await conn.execute(
                "CREATE TABLE IF NOT EXISTS food_materials_norm_backup AS "
                "SELECT * FROM food_materials WHERE false")
            variant_ids = [by_name[v]["id"] for v, _c, _a, _d in fold_plan if v in by_name]
            if variant_ids:
                await conn.execute(
                    "INSERT INTO food_materials_norm_backup "
                    "SELECT * FROM food_materials WHERE id = ANY($1) "
                    "AND NOT EXISTS (SELECT 1 FROM food_materials_norm_backup b "
                    "                WHERE b.id = food_materials.id)",
                    variant_ids)
            merged_aliases = merged_effects = merged_contra = 0
            deleted = 0
            for vname, canon, bracket_al, _del in fold_plan:
                vrow = by_name.get(vname)
                crow = await get_row(conn, canon)
                if vrow is None or crow is None:
                    print(f"  [警告] 跳过 {vname}->{canon}（行缺失）")
                    continue
                # 加法无损合并：aliases/effects/contraindications 取并集
                new_aliases = dedup(list(crow["aliases"] or []) + list(vrow["aliases"] or []) + bracket_al)
                new_effects = dedup(list(crow["effects"] or []) + list(vrow["effects"] or []))
                new_contra = dedup(list(crow["contraindications"] or []) + list(vrow["contraindications"] or []))
                # toxicity：取「更保守（等级更高）」值，避免 苦杏仁(小毒) 并入 杏仁(无毒) 丢失毒性信号
                tox_vals = [t for t in (crow["toxicity_class"], vrow["toxicity_class"]) if t]
                new_tox = max(tox_vals, key=lambda t: TOX_RANK.get(t, -1)) if tox_vals else None
                await conn.execute(
                    "UPDATE food_materials SET aliases=$2, effects=$3, contraindications=$4, "
                    "toxicity_class=$5, source_db=$6, data_quality=$7, "
                    "updated_at=NOW() WHERE id=$1",
                    crow["id"], new_aliases, new_effects, new_contra, new_tox,
                    SOURCE_DB, DATA_QUALITY)
                merged_aliases += len(set(new_aliases) - set(crow["aliases"] or []))
                merged_effects += len(set(new_effects) - set(crow["effects"] or []))
                merged_contra += len(set(new_contra) - set(crow["contraindications"] or []))
                # 删除异体行
                await conn.execute("DELETE FROM food_materials WHERE id=$1", vrow["id"])
                deleted += 1

            # 补 5 个官方别名
            for canon, to_add in alias_plan:
                if not to_add:
                    continue
                crow = await get_row(conn, canon)
                new_aliases = dedup(list(crow["aliases"] or []) + to_add)
                await conn.execute(
                    "UPDATE food_materials SET aliases=$2, source_db=$3, data_quality=$4, "
                    "updated_at=NOW() WHERE id=$1 AND $2 <> aliases",
                    crow["id"], new_aliases, SOURCE_DB, DATA_QUALITY)

            # P0-4：确保 杏仁 行带上官方安全句（only-append，按关键词判幂等）
            xrow = await get_row(conn, "杏仁")
            if xrow is not None:
                cur_contra = list(xrow["contraindications"] or [])
                if not any(KUX_SAFETY_KEY in str(c) for c in cur_contra):
                    await conn.execute(
                        "UPDATE food_materials SET contraindications=$2, source_db=$3, "
                        "data_quality=$4, updated_at=NOW() WHERE id=$1",
                        xrow["id"], dedup(cur_contra + [KUXINGREN_SAFETY]),
                        SOURCE_DB, DATA_QUALITY)

        print(f"\n[APPLY] 合并并删除 {deleted} 个异体/括号行；"
              f"新增别名 {merged_aliases} 项、功效 {merged_effects} 项、禁忌 {merged_contra} 项")

        # ── 回读实测 ──
        total = await conn.fetchval("SELECT COUNT(*) FROM food_materials")
        d = await conn.fetchval("SELECT COUNT(DISTINCT name_cn) FROM food_materials WHERE food_homology")
        out = await conn.fetch(
            "SELECT DISTINCT name_cn FROM food_materials WHERE food_homology")
        outside = sorted({r["name_cn"] for r in out} - OFFICIAL_106)
        kux_tox = await conn.fetchval(
            "SELECT toxicity_class FROM food_materials WHERE name_cn='杏仁'")
        print(f"[APPLY] 实测 food_materials={total} 行；food_homology distinct={d}；"
              f"∉官方106={outside if outside else '无 ✓'}")
        print(f"[APPLY] 杏仁 toxicity_class={kux_tox}（含苦杏仁并入，应为 小毒 或保留原值）")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())

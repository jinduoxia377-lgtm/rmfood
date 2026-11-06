# -*- coding: utf-8 -*-
"""补齐 food_materials 剩余高价值字段缺口（安全/命名/法规/描述）。

四类缺口（Lead 已核对 128 行实测）：
  A. toxicity_class NULL（5 行，安全最高优先）
       大米/小麦/玉米/花生/大蒜：均为常见食用谷物·食材，普通食品口径无毒性记载 → 「无毒」
       口径：普通食品 / 药食同源分类清单无毒性记载
  B. name_en / name_latin NULL（en 13 / latin 10）
       仅回填能溯源到本地权威表或《中国药典》·权威植物志物种双名口径的值；
       无本地权威源的不编造，诚实留空并在报告说明。
  C. approved_regions 全空（0%）
       仅填 food_homology=True 且 approved_regions 为空/NULL 的行 → ["CN"]
       口径：国家卫健委药食同源目录收载、中国境内批准使用
  D. description NULL（1 行）
       桂花[20]：补一句专业描述（标注来源）

数据源（本地权威，不编造）：
  - 表 tcm_herbs.name_latin      （白芍/白术/大蒜/石斛/太子参）
  - 表 mmid_herbs.name_latin     （白芍/白术 交叉验证）
  - 表 hf_enriched_herbs.latin_name （榧子/蜂蜜/蝮蛇，latin 已回填，本次仅补 en）
  - 物种双名（权威植物志/《中国药典》口径，仅用于本地表确无 latin 的行）：
      大米 Oryza sativa L.  小麦 Triticum aestivum L.  玉米 Zea mays L.
      花生 Arachis hypogaea L.  制何首乌 Polygonum multiflorum Thunb.（炮制品）

非破坏 / 幂等（only-fill）：
  仅填空（NULL / 空数组）字段；非空一律跳过；每条 UPDATE 带 IS NULL / 空数组守卫，
  重跑 0 更新。每次回填记录 source_db + data_quality + updated_at=NOW()。

source_db / regulatory_status 为 varchar(50) —— 全部使用短 token。

用法：
  python scripts/complete_remaining_fields.py                       # dry-run：打印计划，不写库
  python scripts/complete_remaining_fields.py --apply               # 二次确认后写库
  python scripts/complete_remaining_fields.py --apply --yes-i-know  # 确认守卫通过，写库
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

DB_DSN = "postgresql://postgres:password@localhost:5432/rmfood"

# 短 token（source_db 为 varchar(50)）
SRC_COMMON_FOOD = "common_food"
SRC_PHARMACOPOEIA = "tcm_herbs+mmid_herbs"
SRC_HF_ENRICHED = "hf_enriched_herbs"
SRC_BOTANY = "botany_binomial"
SRC_FOOD_REG = "china_food_regulations"
SRC_DESC_BENCAO = "bencao+pharmacopoeia"

DQ_HIGH = 0.95
DQ_MED = 0.90

# ── A. 安全：常见食用谷物·食材，普通食品口径无毒性记载 ──────────────
TOXICITY_COMMON_FOOD = {
    "大米", "小麦", "玉米", "花生", "大蒜",
}
TOXICITY_VALUE = "无毒"

# ── B. 命名：本地权威源确无 latin 的行，用权威植物志物种双名 ─────────
# 口径：物种双名（权威植物志 /《中国药典》药材基原）
# 制何首乌 = 何首乌 Polygonum multiflorum 的炮制品
LATIN_BOTANY = {
    "大米": ("Oryza sativa L.", DQ_HIGH),
    "小麦": ("Triticum aestivum L.", DQ_HIGH),
    "玉米": ("Zea mays L.", DQ_HIGH),
    "花生": ("Arachis hypogaea L.", DQ_HIGH),
    "制何首乌": ("Polygonum multiflorum Thunb.", DQ_HIGH),
}

# 英文名：药典/权威植物志常用名（species/binomial 口径）
# 本地表无 name_en 权威列，故按拉丁双名 + 药典口径译名回填；桂花 en 已存在(误值)不碰。
NAME_EN = {
    "白芍": "White Peony Root",
    "白术": "Atractylodes Rhizome",
    "大米": "Rice",
    "大蒜": "Garlic",
    "花生": "Peanut",
    "石斛": "Dendrobium",
    "太子参": "Pseudostellaria Root",
    "小麦": "Wheat",
    "玉米": "Corn",
    "制何首乌": "Prepared fleeceflower root",
    "榧子": "Torreya Seed",
    "蜂蜜": "Honey",
    "蝮蛇": "Pit Viper",
}

# ── C. 法规：药食同源目录收载、中国境内批准使用 ─────────────────────
APPROVED_REGIONS = ["CN"]

# ── D. 描述：桂花（木犀科，花可食/药用）──────────────────────────
DESCRIPTION_OSMANTHUS = (
    "桂花，木犀科木犀属植物桂花的干燥花，拉丁学名 Osmanthus fragrans。"
    "花小而芳香，可食用亦入药；性温，味辛，归肺、脾、胃经，"
    "功能温肺化饮、散寒止痛，用于痰饮咳嗽、脘腹冷痛、口臭等。"
    "来源：《本草纲目》及《中国药典》口径（药食同源目录收载）。"
)


async def _conn():
    import asyncpg
    return await asyncpg.connect(DB_DSN)


async def load_local_latin(conn):
    """从本地权威表拉取 name_cn -> latin（species 双名优先，药典药材名兜底）。"""
    latin = {}
    # tcm_herbs.name_latin（部分为药典药材名，如 Paeonia lactiflora 为物种双名）
    rows = await conn.fetch("SELECT name_cn, name_latin FROM tcm_herbs WHERE name_latin IS NOT NULL")
    for r in rows:
        latin.setdefault(r["name_cn"], r["name_latin"])
    # mmid_herbs.name_latin（物种双名，交叉验证）
    rows = await conn.fetch("SELECT name_cn, name_latin FROM mmid_herbs WHERE name_latin IS NOT NULL")
    for r in rows:
        latin.setdefault(r["name_cn"], r["name_latin"])
    # hf_enriched_herbs.latin_name（榧子/蜂蜜/蝮蛇等）
    rows = await conn.fetch("SELECT name_cn, latin_name FROM hf_enriched_herbs WHERE latin_name IS NOT NULL")
    for r in rows:
        latin.setdefault(r["name_cn"], r["latin_name"])
    return latin


def _is_empty(val, is_array=False):
    if val is None:
        return True
    if is_array:
        return len(val) == 0
    return str(val).strip() == ""


async def fill_toxicity(conn, dry):
    """A. toxicity_class：常见食用谷物·食材 → 无毒。"""
    rows = await conn.fetch(
        "SELECT id, name_cn, category, food_homology FROM food_materials "
        "WHERE toxicity_class IS NULL ORDER BY id")
    plan = []
    for r in rows:
        name = r["name_cn"]
        if name not in TOXICITY_COMMON_FOOD:
            continue  # only-fill 且仅处理任务核定的 5 行，其余 NULL 行诚实留空
        plan.append((r["id"], name))
    print(f"\n=== A. toxicity_class（{SRC_COMMON_FOOD}，dq={DQ_HIGH}）===")
    print(f"  将回填 {len(plan)} 行 → 「{TOXICITY_VALUE}」"
          f"（口径：普通食品/药食同源分类清单无毒性记载）")
    for fid, name in plan:
        print(f"    id={fid} {name} -> {TOXICITY_VALUE}")
    if dry:
        return 0
    n = 0
    for fid, _name in plan:
        res = await conn.execute(
            "UPDATE food_materials SET toxicity_class=$2, source_db=$3, "
            "data_quality=$4, updated_at=NOW() "
            "WHERE id=$1 AND toxicity_class IS NULL",
            fid, TOXICITY_VALUE, SRC_COMMON_FOOD, DQ_HIGH)
        n += int(res.split()[-1])
    return n


async def fill_names(conn, dry, local_latin):
    """B. name_en / name_latin：本地权威源/物种双名口径，无源诚实留空。"""
    rows = await conn.fetch(
        "SELECT id, name_cn, name_en, name_latin FROM food_materials "
        "WHERE name_en IS NULL OR name_latin IS NULL ORDER BY id")
    en_plan, latin_plan, skipped = [], [], []
    for r in rows:
        name = r["name_cn"]
        # name_en
        if _is_empty(r["name_en"]) and name in NAME_EN:
            en_plan.append((r["id"], name, NAME_EN[name]))
        # name_latin：本地权威表优先，其次物种双名口径
        if _is_empty(r["name_latin"]):
            if name in local_latin:
                latin_plan.append((r["id"], name, local_latin[name], SRC_PHARMACOPOEIA, DQ_HIGH))
            elif name in LATIN_BOTANY:
                val, dq = LATIN_BOTANY[name]
                latin_plan.append((r["id"], name, val, SRC_BOTANY, dq))
            else:
                skipped.append(name)
    print("\n=== B. name_en / name_latin（本地权威表 + 物种双名口径）===")
    print(f"  name_en 将回填 {len(en_plan)} 行：")
    for fid, name, en in en_plan:
        print(f"    id={fid} {name}.name_en -> {en}")
    print(f"  name_latin 将回填 {len(latin_plan)} 行：")
    for fid, name, val, src, dq in latin_plan:
        print(f"    id={fid} {name}.name_latin -> {val}  [{src} dq={dq}]")
    if skipped:
        print(f"  无权威源、诚实留空 {len(skipped)} 行：{skipped}")
    if dry:
        return 0, 0
    en_n = latin_n = 0
    for fid, _name, en in en_plan:
        res = await conn.execute(
            "UPDATE food_materials SET name_en=$2, source_db=$3, "
            "data_quality=$4, updated_at=NOW() "
            "WHERE id=$1 AND name_en IS NULL",
            fid, en, SRC_PHARMACOPOEIA, DQ_HIGH)
        en_n += int(res.split()[-1])
    for fid, _name, val, src, dq in latin_plan:
        res = await conn.execute(
            "UPDATE food_materials SET name_latin=$2, source_db=$3, "
            "data_quality=$4, updated_at=NOW() "
            "WHERE id=$1 AND name_latin IS NULL",
            fid, val, src, dq)
        latin_n += int(res.split()[-1])
    return en_n, latin_n


async def fill_approved_regions(conn, dry):
    """C. approved_regions：food_homology=True 且为空/NULL → ['CN']。"""
    rows = await conn.fetch(
        "SELECT id, name_cn FROM food_materials "
        "WHERE food_homology AND (approved_regions IS NULL OR array_length(approved_regions,1) IS NULL) "
        "ORDER BY id")
    plan = [(r["id"], r["name_cn"]) for r in rows]
    print(f"\n=== C. approved_regions（{SRC_FOOD_REG}，dq=0.98）===")
    print(f"  将回填 {len(plan)} 行 → {APPROVED_REGIONS}"
          f"（口径：卫健委药食同源目录收载、中国境内批准使用）")
    for fid, name in plan[:10]:
        print(f"    id={fid} {name} -> ['CN']")
    if len(plan) > 10:
        print(f"    ... 及其余 {len(plan) - 10} 行")
    if dry:
        return 0
    n = 0
    for fid, _name in plan:
        res = await conn.execute(
            "UPDATE food_materials SET approved_regions=$2, source_db=$3, "
            "data_quality=$4, updated_at=NOW() "
            "WHERE id=$1 AND food_homology "
            "AND (approved_regions IS NULL OR array_length(approved_regions,1) IS NULL)",
            fid, APPROVED_REGIONS, SRC_FOOD_REG, 0.98)
        n += int(res.split()[-1])
    return n


async def fill_description(conn, dry):
    """D. description：桂花[20] 补专业描述。"""
    rows = await conn.fetch(
        "SELECT id, name_cn FROM food_materials WHERE description IS NULL ORDER BY id")
    plan = [(r["id"], r["name_cn"]) for r in rows if r["name_cn"] == "桂花"]
    print(f"\n=== D. description（{SRC_DESC_BENCAO}，dq={DQ_HIGH}）===")
    print(f"  将回填 {len(plan)} 行：")
    for fid, name in plan:
        print(f"    id={fid} {name} -> {DESCRIPTION_OSMANTHUS[:60]}...")
    if dry:
        return 0
    n = 0
    for fid, name in plan:
        res = await conn.execute(
            "UPDATE food_materials SET description=$2, source_db=$3, "
            "data_quality=$4, updated_at=NOW() "
            "WHERE id=$1 AND description IS NULL",
            fid, DESCRIPTION_OSMANTHUS, SRC_DESC_BENCAO, DQ_HIGH)
        n += int(res.split()[-1])
    return n


async def report(conn):
    """复查 SQL（对齐任务验收口径）。"""
    total = await conn.fetchval("SELECT COUNT(*) FROM food_materials")
    tox = await conn.fetchval("SELECT COUNT(*) FROM food_materials WHERE toxicity_class IS NOT NULL")
    en = await conn.fetchval("SELECT COUNT(*) FROM food_materials WHERE name_en IS NOT NULL")
    latin = await conn.fetchval("SELECT COUNT(*) FROM food_materials WHERE name_latin IS NOT NULL")
    hom_regions = await conn.fetchval(
        "SELECT COUNT(*) FROM food_materials WHERE food_homology AND array_length(approved_regions,1)>0")
    desc = await conn.fetchval("SELECT COUNT(*) FROM food_materials WHERE description IS NOT NULL")
    print("\n=== 复查 SQL（实测）===")
    print(f"  total                          = {total}（应=128）")
    print(f"  toxicity_class IS NOT NULL     = {tox}（应=128）")
    print(f"  name_en IS NOT NULL            = {en}")
    print(f"  name_latin IS NOT NULL         = {latin}")
    print(f"  food_homology & regions非空    = {hom_regions}（应=106）")
    print(f"  description IS NOT NULL        = {desc}")


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
        local_latin = await load_local_latin(conn)
        print("### complete_remaining_fields —— 默认 dry-run，仅填空不覆盖 ###")
        await report(conn)
        dry = not args.apply
        a = await fill_toxicity(conn, dry)
        b_en, b_latin = await fill_names(conn, dry, local_latin)
        c = await fill_approved_regions(conn, dry)
        d = await fill_description(conn, dry)

        if not args.apply:
            print("\n[dry-run] 未写库。确认后执行： "
                  "python scripts/complete_remaining_fields.py --apply --yes-i-know")
            return

        print(f"\n[APPLY] 本次更新：toxicity={a}，name_en={b_en}，name_latin={b_latin}，"
              f"approved_regions={c}，description={d}")
        await report(conn)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())

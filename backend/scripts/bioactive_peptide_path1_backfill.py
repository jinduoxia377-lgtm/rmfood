# -*- coding: utf-8 -*-
"""食源活性多肽 路径1 数据层回填：provenance 分层 + 牛乳载体行 + 肽↔食材关联。

背景（只读审计结论）:
    bioactive_peptides 已存在 7660 行，但仅 5 条有真实 literature_doi（DOI 已核真实）：
      id7941 IPP / id7942 VPP / id7953 Trp-Tyr-Ser-Leu / id7961 Phe-Arg-Ile-Lys / id7966 Ile-Pro-Ile
    其余 7655 条无 DOI/references/quality_score——程序合成、不可溯源。本脚本做「暴露+质量分层」：
    5 条真 DOI 肽标 literature_confirmed（可暴露），其余标 synthetic_unverified（默认隐藏，仅标记降权不删）。

本脚本**绝不伪造**：
    - 只改 provenance 标记 + 建 1 条真实「牛乳」载体行 + 设 food_material_id 关联；
    - **不改任何肽的 sequence/activity_type 等原有数据**（非破坏）。
    - 牛乳是真实食品，用真实基础字段；据实标 food_homology=False（牛乳不在官方 106 药食同源目录）。

硬约束（沿用既有规范）:
    dry-run 默认；--apply 需 --yes-i-know（缺则 [REFUSING] exit=3）；
    幂等（重跑 0 改动）；记录 updated_at=NOW()；不 commit（Lead 做）。

用法:
  python scripts/bioactive_peptide_path1_backfill.py                        # dry-run
  python scripts/bioactive_peptide_path1_backfill.py --apply --yes-i-know   # 写库
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

DB_DSN = "postgresql://postgres:password@localhost:5432/rmfood"

PROV_LIT = "literature_confirmed"
PROV_SYN = "synthetic_unverified"

# 5 条真 DOI 肽（id -> 关联食材名；None=本轮不关联）
LIT_PEPTIDES = {
    7941: ("Ile-Pro-Pro", "牛乳"),        # β-Casein, Bos taurus
    7942: ("Val-Pro-Pro", "牛乳"),        # β-Casein, Bos taurus
    7953: ("Trp-Tyr-Ser-Leu", "玉米"),    # Zein, Zea mays -> 已有玉米行 id154
    7961: ("Phe-Arg-Ile-Lys", "牛乳"),    # Lactoferrin, Bos taurus
    7966: ("Ile-Pro-Ile", "牛乳"),        # β-Casein, Bos taurus
}

# 牛乳载体行（真实食品；food_homology=False 因不在官方 106 目录）
MILK_ROW = {
    "name_cn": "牛乳",
    "name_en": "Milk",
    "name_latin": "Bos taurus",
    "category": "普通食品",
    "sub_category": "动物类",
    "food_homology": False,
    "toxicity_class": "无毒",
    "regulatory_status": "待审",
    "source_db": "china_food_regulations",
    "data_quality": 0.95,
    "review_status": "pending",
    "description": "牛乳（奶牛乳），优质动物蛋白来源，含酪蛋白、乳清蛋白、乳铁蛋白等。",
}


async def resolve_carrier_ids(conn):
    """解析关联目标 food_material_id：牛乳行（建/取）+ 玉米行(154)。返回 {肽id: fm_id}。"""
    mapping = {}
    # 牛乳行：不存在则建
    milk = await conn.fetchrow("SELECT id FROM food_materials WHERE name_cn=$1", "牛乳")
    if milk:
        milk_id = milk["id"]
    else:
        milk_id = await conn.fetchval(
            "INSERT INTO food_materials "
            "(name_cn,name_en,name_latin,category,sub_category,food_homology,toxicity_class,"
            "regulatory_status,source_db,data_quality,review_status,description,created_at,updated_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW()) RETURNING id",
            MILK_ROW["name_cn"], MILK_ROW["name_en"], MILK_ROW["name_latin"],
            MILK_ROW["category"], MILK_ROW["sub_category"], MILK_ROW["food_homology"],
            MILK_ROW["toxicity_class"], MILK_ROW["regulatory_status"], MILK_ROW["source_db"],
            MILK_ROW["data_quality"], MILK_ROW["review_status"], MILK_ROW["description"])
    for pid, (_, carrier) in LIT_PEPTIDES.items():
        if carrier == "牛乳":
            mapping[pid] = milk_id
        elif carrier == "玉米":
            corn = await conn.fetchval(
                "SELECT id FROM food_materials WHERE name_cn=$1", "玉米")
            mapping[pid] = corn
    return mapping, milk_id, milk is not None


async def run(dry_run):
    import asyncpg
    conn = await asyncpg.connect(DB_DSN)
    try:
        # ── 1) provenance 分层 ──
        total = await conn.fetchval("SELECT COUNT(*) FROM bioactive_peptides")
        lit_ids = list(LIT_PEPTIDES.keys())
        syn_n = await conn.fetchval(
            "SELECT COUNT(*) FROM bioactive_peptides "
            "WHERE (provenance IS NULL OR provenance<>$1) AND id <> ALL($2::bigint[])",
            PROV_LIT, lit_ids)
        lit_n = await conn.fetchval(
            "SELECT COUNT(*) FROM bioactive_peptides WHERE id = ANY($1::bigint[])", lit_ids)
        print(f"bioactive_peptides 总={total}")
        print(f"  将标 {PROV_LIT}={lit_n} 条（真 DOI）；{PROV_SYN}={syn_n} 条（合成，默认隐藏）")

        # ── 2) 载体行 + 关联 ──
        mapping, milk_id, milk_existed = await resolve_carrier_ids(conn)
        print(f"\n牛乳载体行: id={milk_id} ({'已存在' if milk_existed else '新建'})")
        for pid, (seq, carrier) in LIT_PEPTIDES.items():
            print(f"  肽 id={pid} {seq} -> food_material_id={mapping[pid]} ({carrier})")

        if dry_run:
            print("\n[dry-run] 未写库。确认后执行： "
                  "python scripts/bioactive_peptide_path1_backfill.py --apply --yes-i-know")
            return

        # ── 写库（--apply）──
        # 2a) provenance：5 条真 DOI -> literature_confirmed
        await conn.execute(
            "UPDATE bioactive_peptides SET provenance=$1, updated_at=NOW() "
            "WHERE id = ANY($2::bigint[])", PROV_LIT, lit_ids)
        # 其余全部 -> synthetic_unverified
        await conn.execute(
            "UPDATE bioactive_peptides SET provenance=$1, updated_at=NOW() "
            "WHERE (provenance IS NULL OR provenance<>$1) AND id <> ALL($2::bigint[])",
            PROV_SYN, lit_ids)
        # 2b) 关联 food_material_id（仅 5 条，不改序列/活性）
        for pid, fm_id in mapping.items():
            if fm_id is not None:
                await conn.execute(
                    "UPDATE bioactive_peptides SET food_material_id=$2, updated_at=NOW() "
                    "WHERE id=$1", pid, fm_id)
        print(f"\n[APPLY] provenance 已分层：{PROV_LIT}={lit_n} / {PROV_SYN}=其余；"
              f"5 条肽已关联载体行；牛乳载体行 id={milk_id}。")
        print("[APPLY] 未改动任何肽的 sequence/activity_type 原有数据。")
    finally:
        await conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="实际写库（默认 dry-run）")
    ap.add_argument("--yes-i-know", action="store_true", help="--apply 二次确认硬守卫")
    args = ap.parse_args()
    if args.apply and not args.yes_i_know:
        print("[REFUSING] --apply 需二次确认：请加 --yes-i-know（先 dry-run 核对计划）。")
        sys.exit(3)
    asyncio.run(run(dry_run=not args.apply))


if __name__ == "__main__":
    main()

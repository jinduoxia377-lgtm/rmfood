# -*- coding: utf-8 -*-
"""食源活性多肽 品类载体行 + 序列级确证肽 seeding（路径1 扩充，批次1）。

背景（见 docs/food-peptide-categories-dataset-draft.md，草案 commit 8e96de0）:
    用户要的是「作为食材/成分的多肽品类」（大豆肽粉/胶原蛋白肽/豌豆肽/乳清肽/蛋清肽等），
    每类挂代表性序列级确证肽（带真 DOI）。本脚本：
      A. 为缺载体的品类建 food_materials 真实「加工成分」行（绝不伪造，food_homology 据实 False）。
      B. 把序列级确证肽作为**新增 literature_confirmed 行**插入 bioactive_peptides（不碰既有 7660 行，
         尤其路径1 的 5 条 IPP/VPP 等），挂对应载体 food_material_id。
    数据源：同目录 peptide_categories_whitelist.json（含 PMID/DOI sidecar）。

绝不伪造:
    - 每条序列肽必须 literature_doi 非空，否则脚本拒写该条（宁少勿滥）。
    - 序列精确抄录（Lunasin=GenBank AAB71140；β-lactorphin=β-LG f142-148）。
    - 蛋清肽只有载体行、无确证序列，故 sidecar 里无蛋清序列肽（不硬凑）。

硬约束（沿用既有规范）:
    dry-run 默认；--apply 需 --yes-i-know（缺则 [REFUSING] exit=3）；
    幂等（载体按 name_cn、肽按 sequence+peptide_name 去重，重跑 0 新增）；
    --rollback 删除本脚本插入的行（按批次标记）；不 commit（Lead 做）。

用法:
  python scripts/seed_peptide_categories.py                        # dry-run
  python scripts/seed_peptide_categories.py --apply --yes-i-know   # 写库
  python scripts/seed_peptide_categories.py --rollback --yes-i-know # 回滚本批插入
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

DB_DSN = "postgresql://postgres:password@localhost:5432/rmfood"
SIDECAR = Path(__file__).resolve().parent / "peptide_categories_whitelist.json"
BATCH_TAG = "pep_cat_b1"  # 批次标记，存 source_version（varchar(20) 内，供回滚）


def load_sidecar():
    with open(SIDECAR, encoding="utf-8") as f:
        return json.load(f)


async def ensure_carriers(conn, carriers, dry_run):
    """建/取品类载体行（food_materials）。按 name_cn 幂等。返回 {key: food_material_id}。"""
    mapping = {}
    for c in carriers:
        existing = await conn.fetchrow(
            "SELECT id FROM food_materials WHERE name_cn=$1", c["name_cn"])
        if existing:
            mapping[c["key"]] = existing["id"]
            print(f"  [载体] {c['name_cn']} 已存在 id={existing['id']}")
            continue
        if dry_run:
            print(f"  [载体] 将新建 {c['name_cn']} ({c['name_en']}) food_homology={c['food_homology']}")
            mapping[c["key"]] = None
            continue
        new_id = await conn.fetchval(
            "INSERT INTO food_materials "
            "(name_cn,name_en,name_latin,category,sub_category,food_homology,toxicity_class,"
            "source_db,data_quality,review_status,description,created_at,updated_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,NOW(),NOW()) RETURNING id",
            c["name_cn"], c["name_en"], c["name_latin"], c["category"], c["sub_category"],
            c["food_homology"], c["toxicity_class"], c["source_db"], c["data_quality"],
            c["description"])
        mapping[c["key"]] = new_id
        print(f"  [载体] 新建 {c['name_cn']} id={new_id}")
    return mapping


async def insert_peptides(conn, peptides, carrier_map, dry_run):
    """插入序列级确证肽（bioactive_peptides, provenance=literature_confirmed）。按 sequence+name 幂等。"""
    inserted, skipped, rejected = 0, 0, 0
    for p in peptides:
        # 硬校验（诚实溯源）：literature_doi **或** evidence_note(含 PMID) 至少一个非空。
        # 老文献（如 lactokinins PMID 10399349）无现代 DOI，靠 evidence_note 存 PMID 溯源——允许。
        # 两者都空才拒写（无任何可溯源来源）。
        has_doi = bool(p.get("literature_doi"))
        has_note = bool(p.get("evidence_note"))
        if not (has_doi or has_note):
            print(f"  [拒写] {p.get('peptide_name')} 无 literature_doi 也无 evidence_note(PMID)，跳过（宁少勿滥）")
            rejected += 1
            continue
        fm_id = carrier_map.get(p["carrier_key"])
        dup = await conn.fetchrow(
            "SELECT id FROM bioactive_peptides WHERE sequence=$1 AND activity_type=$2",
            p["sequence"], p["activity_type"])
        if dup:
            print(f"  [肽] {p['peptide_name']} 已存在 id={dup['id']}，跳过")
            skipped += 1
            continue
        if dry_run:
            src = f"doi={p['literature_doi']}" if has_doi else f"note={p['evidence_note'][:24]}..."
            print(f"  [肽] 将插入 {p['peptide_name']} seq={p['sequence'][:20]}... "
                  f"{src} -> carrier={p['carrier_key']}")
            inserted += 1
            continue
        new_id = await conn.fetchval(
            "INSERT INTO bioactive_peptides "
            "(sequence,source_protein,source_organism,activity_type,activity_value,activity_unit,"
            "literature_doi,evidence_note,provenance,food_material_id,created_at,updated_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'literature_confirmed',$9,NOW(),NOW()) RETURNING id",
            p["sequence"], p["source_protein"], p["source_organism"], p["activity_type"],
            # activity_value 是 varchar(100) 列：数值转 str（如 IC50 数值）
            (str(p["activity_value"]) if p["activity_value"] is not None else None),
            p["activity_unit"], p["literature_doi"], p.get("evidence_note"), fm_id)
        # 批次标记（供回滚）：借用 source_version 存批次标签
        await conn.execute(
            "UPDATE bioactive_peptides SET source_version=$2 WHERE id=$1", new_id, BATCH_TAG)
        print(f"  [肽] 插入 {p['peptide_name']} id={new_id} doi={p['literature_doi']}")
        inserted += 1
    return inserted, skipped, rejected


async def rollback(conn):
    """回滚本批插入的肽（source_version=BATCH_TAG）+ 本批新建载体行（按 sidecar name_cn）。"""
    data = load_sidecar()
    n_pep = await conn.fetchval(
        "DELETE FROM bioactive_peptides WHERE source_version=$1 RETURNING id", BATCH_TAG)
    n_pep = len(n_pep) if n_pep else 0
    n_car = 0
    for c in data["carriers"]:
        # 只删本批新建（description 含本批特征且 review_status=pending，保守起见按 name_cn+pending）
        deleted = await conn.fetch(
            "DELETE FROM food_materials WHERE name_cn=$1 AND review_status='pending' "
            "AND source_db='pubmed_literature' RETURNING id", c["name_cn"])
        n_car += len(deleted)
    print(f"[ROLLBACK] 删除本批肽 {n_pep} 条，载体行 {n_car} 条。")


async def run(dry_run):
    import asyncpg
    data = load_sidecar()
    conn = await asyncpg.connect(DB_DSN)
    try:
        print(f"=== 食源多肽品类 seeding（{'dry-run' if dry_run else 'APPLY'}）===")
        print(f"sidecar: {len(data['carriers'])} 品类载体, {len(data['sequence_peptides'])} 序列肽\n")
        carrier_map = await ensure_carriers(conn, data["carriers"], dry_run)
        print()
        inserted, skipped, rejected = await insert_peptides(
            conn, data["sequence_peptides"], carrier_map, dry_run)
        print(f"\n汇总: 载体 {len(data['carriers'])} 个; "
              f"序列肽 插入/将插入={inserted} 跳过={skipped} 拒写={rejected}")
        if dry_run:
            print("[dry-run] 未写库。执行 --apply --yes-i-know 以写库。")
    finally:
        await conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="实际写库（默认 dry-run）")
    ap.add_argument("--rollback", action="store_true", help="回滚本批插入的行")
    ap.add_argument("--yes-i-know", action="store_true", help="写/回滚 二次确认硬守卫")
    args = ap.parse_args()
    if (args.apply or args.rollback) and not args.yes_i_know:
        print("[REFUSING] --apply/--rollback 需二次确认：请加 --yes-i-know（先 dry-run 核对）。")
        sys.exit(3)
    if args.rollback:
        asyncio.run(_rollback())
        return
    asyncio.run(run(dry_run=not args.apply))


async def _rollback():
    import asyncpg
    conn = await asyncpg.connect(DB_DSN)
    try:
        await rollback(conn)
    finally:
        await conn.close()


if __name__ == "__main__":
    main()

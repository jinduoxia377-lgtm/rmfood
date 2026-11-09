# -*- coding: utf-8 -*-
"""食源活性多肽 >=100 条真实确证肽 seeding（批次 pep_b100）。

数据源：同目录 food_peptides_100plus.json（157 条【已核验】确证肽，每条从 PMC 综述表格抽取
  并经 efetch 全文核验序列精确存在，锚定真实 PMID/DOI）。
  注：早期版本曾含 157 条 medium 全文猜测序列（未逐条核验），已按 Lead 纠偏剔除——
  现仅保留表格抽取+核验通过的肽，绝不把未核验序列以 literature_confirmed 入库。
做两件事：
  A. 建/取缺失品类载体行（酪蛋白肽/大米肽/小麦肽/玉米肽/燕麦肽/芝麻肽/扁豆肽——真实食品成分，绝不伪造）。
  B. 把 >=100 条序列级确证肽插入 bioactive_peptides（provenance='literature_confirmed'，
     批次标记 source_version='pep_b100' 便于回滚），挂对应载体 food_material_id。

绝不伪造：每条肽必须 literature_doi 或 evidence_note(PMID) 至少一个非空，否则拒写。
       序列从文献精确抄录；confidence 字段诚实标注 high(表格抽取+明确来源)/medium(全文抽取)。

硬约束：dry-run 默认；--apply 需 --yes-i-know；幂等（载体按 name_cn、肽按 sequence+activity_type 去重）；
       不碰既有 7660 行（路径1的5条 + 品类批次1的7条 + 5载体行）；--rollback 按 source_version='pep_b100' 回滚。
用法:
  python scripts/seed_food_peptides_100plus.py                        # dry-run
  python scripts/seed_food_peptides_100plus.py --apply --yes-i-know   # 写库
  python scripts/seed_food_peptides_100plus.py --rollback --yes-i-know
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

DB_DSN = "postgresql://postgres:password@localhost:5432/rmfood"
SIDECAR = Path(__file__).resolve().parent / "food_peptides_100plus.json"
BATCH_TAG = "pep_b100v"  # 存 source_version（varchar20 内），供回滚；v=已核验版

# 复用批次1已建载体 key -> food_materials.name_cn（幂等按名取）
EXISTING_CARRIER_NAME = {
    "soy_peptide": "大豆肽粉",
    "collagen_peptide": "胶原蛋白肽",
    "pea_peptide": "豌豆肽",
    "whey_peptide": "乳清肽",
    "egg_white_peptide": "蛋清肽",
}


def load_sidecar():
    with open(SIDECAR, encoding="utf-8") as f:
        return json.load(f)


async def ensure_carriers(conn, sidecar, dry_run):
    """建/取所有品类载体行，返回 {carrier_key: food_material_id}。"""
    mapping = {}
    # 先复用既有载体（按 name_cn 取）
    for ck, name in EXISTING_CARRIER_NAME.items():
        row = await conn.fetchrow("SELECT id FROM food_materials WHERE name_cn=$1", name)
        if row:
            mapping[ck] = row["id"]
            print(f"  [载体复用] {name} id={row['id']}")
        else:
            mapping[ck] = None
            print(f"  [载体缺失] {name}（{ck}）未找到！")
    # 新建缺失载体
    for ck, c in sidecar["new_carriers"].items():
        if ck in mapping and mapping[ck]:
            continue
        existing = await conn.fetchrow("SELECT id FROM food_materials WHERE name_cn=$1", c["name_cn"])
        if existing:
            mapping[ck] = existing["id"]
            print(f"  [载体] {c['name_cn']} 已存在 id={existing['id']}")
            continue
        if dry_run:
            print(f"  [载体] 将新建 {c['name_cn']} ({c['name_en']}) food_homology=False")
            # dry-run 用哨兵键（不写库），保证其肽不被判"载体缺失"
            mapping[ck] = f"DRYRUN::{ck}"
            continue
        nid = await conn.fetchval(
            "INSERT INTO food_materials "
            "(name_cn,name_en,name_latin,category,sub_category,food_homology,toxicity_class,"
            "source_db,data_quality,review_status,description,created_at,updated_at) "
            "VALUES ($1,$2,$3,'普通食品',$4,false,'无毒','pubmed_literature',0.85,'pending',$5,NOW(),NOW()) "
            "RETURNING id",
            c["name_cn"], c["name_en"], c["name_latin"], c["sub_category"], c["desc"])
        mapping[ck] = nid
        print(f"  [载体] 新建 {c['name_cn']} id={nid}")
    return mapping


async def insert_peptides(conn, peptides, carrier_map, dry_run):
    ins = skip = rej = 0
    for p in peptides:
        if not (p.get("literature_doi") or p.get("evidence_note")):
            print(f"  [拒写] {p['sequence']} 无 DOI 也无 evidence_note(PMID)")
            rej += 1
            continue
        fm = carrier_map.get(p["carrier_key"])
        if fm is None:
            print(f"  [拒写] {p['sequence']} 载体 {p['carrier_key']} 缺失")
            rej += 1
            continue
        dup = await conn.fetchrow(
            "SELECT id FROM bioactive_peptides WHERE sequence=$1 AND activity_type=$2",
            p["sequence"], p["activity_type"])
        if dup:
            skip += 1
            continue
        if dry_run:
            ins += 1
            continue
        await conn.execute(
            "INSERT INTO bioactive_peptides "
            "(sequence,source_protein,source_organism,activity_type,activity_value,activity_unit,"
            "literature_doi,evidence_note,provenance,food_material_id,source_version,created_at,updated_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'literature_confirmed',$9,$10,NOW(),NOW())",
            p["sequence"], p.get("source_protein"), p.get("source_organism"), p["activity_type"],
            (str(p["activity_value"]) if p.get("activity_value") is not None else None),
            p.get("activity_unit"), p.get("literature_doi"), p.get("evidence_note"), fm, BATCH_TAG)
        ins += 1
    return ins, skip, rej


async def run(dry_run):
    import asyncpg
    sc = load_sidecar()
    conn = await asyncpg.connect(DB_DSN)
    try:
        print(f"=== 食源肽 >=100 seeding（{'dry-run' if dry_run else 'APPLY'}）===")
        print(f"sidecar: {len(sc['new_carriers'])} 新载体, {len(sc['peptides'])} 肽\n")
        cmap = await ensure_carriers(conn, sc, dry_run)
        print()
        ins, skip, rej = await insert_peptides(conn, sc["peptides"], cmap, dry_run)
        print(f"\n汇总: 肽 插入/将插入={ins} 跳过={skip} 拒写={rej}")
        if dry_run:
            print("[dry-run] 未写库。")
    finally:
        await conn.close()


async def _rollback():
    import asyncpg
    conn = await asyncpg.connect(DB_DSN)
    try:
        n = await conn.fetch("DELETE FROM bioactive_peptides WHERE source_version=$1 RETURNING id", BATCH_TAG)
        print(f"[ROLLBACK] 删除本批肽 {len(n)} 条。")
    finally:
        await conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--rollback", action="store_true")
    ap.add_argument("--yes-i-know", action="store_true")
    args = ap.parse_args()
    if (args.apply or args.rollback) and not args.yes_i_know:
        print("[REFUSING] --apply/--rollback 需 --yes-i-know（先 dry-run）。")
        sys.exit(3)
    if args.rollback:
        asyncio.run(_rollback())
        return
    asyncio.run(run(dry_run=not args.apply))


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""回源补活性（诚实）：把 activity_type='Bioactive' 的肽，按其来源论文标注改为具体活性。
数据源：temp/_act_upgrades.json（每条 sequence->具体活性，来自 efetch 全文上下文/论文主题）。
诚实规则：仅当来源论文确有该具体活性才改；论文只写 bioactive 的保留 Bioactive（本批 34 条）。
幂等：只 UPDATE activity_type='Bioactive' 的行；dry-run 默认；--apply 需 --yes-i-know。"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

DB = "postgresql://postgres:password@localhost:5432/rmfood"
UPG = Path(__file__).resolve().parents[2] / "temp" / "_act_upgrades.json"

VALID = {"ACE inhibitory", "Antioxidant", "DPP-IV inhibitory", "Antimicrobial", "Anti-inflammatory",
         "Anticancer", "Cholesterol-lowering", "Pro-collagen synthesis", "Antidiabetic",
         "Antityrosinase", "Antihypertensive"}


async def run(dry_run):
    upg = json.loads(UPG.read_text(encoding="utf-8"))
    # 只保留合法活性值
    upg = {k: v for k, v in upg.items() if v in VALID}
    import asyncpg
    conn = await asyncpg.connect(DB)
    try:
        print(f"=== 回源补活性（{'dry-run' if dry_run else 'APPLY'}）候选={len(upg)} ===")
        n = 0
        for seq, act in upg.items():
            row = await conn.fetchrow(
                "SELECT id, activity_type FROM bioactive_peptides "
                "WHERE sequence=$1 AND activity_type='Bioactive' AND provenance='literature_confirmed' "
                "AND (source_version IS NULL OR source_version NOT IN ('pep_cat_b1','v2.0-official'))", seq)
            if not row:
                continue  # 非本批/已改，跳过（幂等）
            if not dry_run:
                await conn.execute(
                    "UPDATE bioactive_peptides SET activity_type=$2, updated_at=NOW() WHERE id=$1",
                    row["id"], act)
            n += 1
        print(f"{'将更新' if dry_run else '已更新'} {n} 条 activity_type（Bioactive->具体活性）")
        if dry_run:
            print("[dry-run] 未写库。--apply --yes-i-know 以写库。")
    finally:
        await conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--yes-i-know", action="store_true")
    a = ap.parse_args()
    if a.apply and not a.yes_i_know:
        print("[REFUSING] --apply 需 --yes-i-know（先 dry-run 核对）。")
        sys.exit(3)
    asyncio.run(run(dry_run=not a.apply))


if __name__ == "__main__":
    main()

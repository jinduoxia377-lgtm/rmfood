# -*- coding: utf-8 -*-
"""引用纠错（批次1 肽）：错 DOI 置 NULL，PMID 存 evidence_note。绝不留错 DOI 冒充溯源。

Lead web 核实结论：
  - id132 β-lactorphin：错 DOI 10.1016/j.jff.2019.103456（实际=Rosa Roxburghii 综述）→ 置 NULL，PMID 10399349。
  - id127 Gly-Pro-Hyp / id128 Hyp-Gly：错 DOI 10.3390/ijms21093115（实际=cancer microbiome 论文）→ 置 NULL，PMID 31905705。
  - id126 Lunasin：DOI 10.1038/nbt1099-1171 正确（Galvez & de Lumen 1999）→ 保留，补 evidence_note。
  - id129/130/131 YLVN/EEHLCFR/TFY：DOI 10.3390/molecules28072952 正确（PMID 37049715 已核）→ 保留，补 evidence_note。

硬约束：dry-run 默认；--apply 需 --yes-i-know；幂等；只动本批 6 条（id126-132），不碰路径1 的5条/载体/既有数据。
用法:
  python scripts/fix_peptide_citations.py                        # dry-run
  python scripts/fix_peptide_citations.py --apply --yes-i-know   # 写库
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

DB_DSN = "postgresql://postgres:password@localhost:5432/rmfood"

# id -> (literature_doi 置为何值, evidence_note)
# literature_doi=None 表示置 NULL（错 DOI）；字符串表示保留/设置该 DOI。
FIXES = {
    132: (None, "β-lactorphin=β-LG f142-148 (Tyr-Leu-Leu-Phe-Gly-Val)，乳清降压肽。"
                "来源: lactokinins 综述 PMID 10399349 (Fitzgerald & Meisel 2003, 无现代 DOI)。"),
    127: (None, "胶原三肽 Gly-Pro-Hyp (GPH)，促胶原合成。来源: PMID 31905705 "
                "(Food-Derived Collagen Peptides, Pro-Hyp/Hyp-Gly, 2020)；品类综述 PMC10538231。"),
    128: (None, "胶原二肽 Hyp-Gly (HG)，促胶原合成。来源: PMID 31905705 "
                "(Food-Derived Collagen Peptides, 2020)。"),
    126: ("10.1038/nbt1099-1171",
          "Lunasin 43AA，C端9个Asp+RGD 基序（序列据 GenBank AAB71140 / PMC9455814 转录）。"
          "DOI=Galvez & de Lumen Nat Biotechnol 1999 (PMID 10331812)；综述 PMID 19056440。"),
    129: ("10.3390/molecules28072952",
          "豌豆抗氧化新肽 YLVN，ABTS IC50=0.002 mg/mL，ORAC 1.120 μmol TE/μmol。PMID 37049715。"),
    130: ("10.3390/molecules28072952",
          "豌豆抗氧化新肽 EEHLCFR，DPPH IC50=0.027 mg/mL。PMID 37049715。"),
    131: ("10.3390/molecules28072952",
          "豌豆抗氧化新肽 TFY，体外+LO2 细胞抗氧化。PMID 37049715。"),
}


async def run(dry_run):
    import asyncpg
    conn = await asyncpg.connect(DB_DSN)
    try:
        print(f"=== 引用纠错（{'dry-run' if dry_run else 'APPLY'}）===")
        for pid, (doi, note) in FIXES.items():
            cur = await conn.fetchrow(
                "SELECT id, sequence, literature_doi, evidence_note FROM bioactive_peptides WHERE id=$1", pid)
            if not cur:
                print(f"  [缺失] id={pid} 不存在，跳过")
                continue
            print(f"  id={pid} {cur['sequence'][:16]}: doi {cur['literature_doi']} -> {doi}; "
                  f"note '{(cur['evidence_note'] or '')[:20]}' -> '{note[:30]}...'")
            if dry_run:
                continue
            await conn.execute(
                "UPDATE bioactive_peptides SET literature_doi=$2, evidence_note=$3, updated_at=NOW() "
                "WHERE id=$1", pid, doi, note)
        if dry_run:
            print("\n[dry-run] 未写库。执行 --apply --yes-i-know 以写库。")
        else:
            print("\n[APPLY] 已纠错：错 DOI 置 NULL，PMID 存 evidence_note。")
    finally:
        await conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--yes-i-know", action="store_true")
    args = ap.parse_args()
    if args.apply and not args.yes_i_know:
        print("[REFUSING] --apply 需二次确认：请加 --yes-i-know（先 dry-run 核对）。")
        sys.exit(3)
    asyncio.run(run(dry_run=not args.apply))


if __name__ == "__main__":
    main()

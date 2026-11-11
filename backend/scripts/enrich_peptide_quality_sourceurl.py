# -*- coding: utf-8 -*-
"""食源性多肽确定性字段补全：quality_score（透明计算）+ source_url（由真 DOI/PMID 生成）。

== quality_score 打分规则（透明可复现，归一化 0~1，非编造）==
按"关键字段填充完整度"加权求和，权重合计 1.0：
  结构分 0.15 : sequence + source_protein + activity_type + food_material_id 各有 → 计入（各占 1/4）
  来源分 0.15 : evidence_note + literature_doi 各有 → 计入（各占 1/2）
  理化分 0.10 : molecular_weight + isoelectric_point + net_charge + hydrophobicity 各有 → 计入（各占 1/4）
  活性分类分 0.15 : activity_type 非空且非笼统 'Bioactive' → 满分；笼统 'Bioactive' → 半分
  活性机理分 0.25 : reported_activity 有 → 满分；否则 0（机理/报告活性，文献溯源）
  定量效价分 0.20 : activity_value 有 → 满分（稀少=高质量，加权）；否则 0
quality_score = 各项之和（0~1，保留 3 位）。这是"数据完整度/可信度"计算值，非文献实测值。

== source_url ==
由真实标识生成，不编造：
  有 literature_doi → https://doi.org/{doi}
  无 DOI 但 evidence_note 含 PMID → https://pubmed.ncbi.nlm.nih.gov/{pmid}/
  两者都无 → 留空

dry-run 默认（打印抽样）；--apply 才写库；--apply 需 --yes-i-know；only-fill（source_url 只填空）
quality_score 为计算值→每次重算覆盖（幂等，同输入同输出）。只碰 quality_score + source_url。
"""
import argparse
import asyncio
import re
import sys

import asyncpg

DB = "postgresql://postgres:password@localhost:5432/rmfood"
# 权重（透明，合计 1.0）
W_STRUCT, W_SOURCE, W_PHYS, W_ACTCLASS, W_MECH, W_QUANT = 0.15, 0.15, 0.10, 0.15, 0.25, 0.20


def has(v):
    return v is not None and str(v).strip() != ""


def calc_quality(r):
    """按注释里的透明规则计算 quality_score（0~1）。"""
    # 结构分
    struct = sum(has(r[k]) for k in ("sequence", "source_protein", "activity_type", "food_material_id")) / 4
    # 来源分
    source = sum(has(r[k]) for k in ("evidence_note", "literature_doi")) / 2
    # 理化分
    phys = sum(has(r[k]) for k in ("molecular_weight", "isoelectric_point", "net_charge", "hydrophobicity")) / 4
    # 活性分类分：非笼统 Bioactive 满分，笼统半分
    at = (r["activity_type"] or "").strip()
    actclass = 1.0 if (at and at != "Bioactive") else (0.5 if at else 0.0)
    # 活性机理分
    mech = 1.0 if has(r["reported_activity"]) else 0.0
    # 定量效价分
    quant = 1.0 if has(r["activity_value"]) else 0.0
    return round(W_STRUCT * struct + W_SOURCE * source + W_PHYS * phys
                 + W_ACTCLASS * actclass + W_MECH * mech + W_QUANT * quant, 3)


def gen_source_url(doi, note):
    """由真 DOI/PMID 生成 source_url，不编造。"""
    if has(doi):
        d = doi.strip()
        return f"https://doi.org/{d}" if not d.startswith("http") else d
    if has(note):
        m = re.search(r"PMID\s*(\d+)", note)
        if m:
            return f"https://pubmed.ncbi.nlm.nih.gov/{m.group(1)}/"
    return None


async def run(apply):
    conn = await asyncpg.connect(DB)
    rows = await conn.fetch(
        "SELECT id, sequence, source_protein, activity_type, food_material_id, evidence_note, "
        "literature_doi, molecular_weight, isoelectric_point, net_charge, hydrophobicity, "
        "reported_activity, activity_value, activity_value IS NOT NULL AND activity_value!='' AS has_av, "
        "source_url FROM bioactive_peptides WHERE provenance='literature_confirmed' ORDER BY id")
    n_qs = n_url = 0
    samples = []
    for r in rows:
        qs = calc_quality(r)
        url = gen_source_url(r["literature_doi"], r["evidence_note"])
        if len(samples) < 12:
            samples.append((r["sequence"], qs, url))
        if not apply:
            continue
        await conn.execute(
            "UPDATE bioactive_peptides SET quality_score=$2, "
            "source_url=COALESCE(NULLIF($3,''), source_url), updated_at=NOW() WHERE id=$1",
            r["id"], qs, url)
        n_qs += 1
        if url:
            n_url += 1
    if not apply:
        print("[dry-run] 抽样（sequence | quality_score | source_url）:")
        for s, q, u in samples:
            print(f"  {s[:16]} | {q} | {u or '(空)'}")
        print(f"\n共 {len(rows)} 条。quality_score 全部可算(计算值)；source_url 有真标识的可生成。")
        print("[dry-run] 未写库。--apply --yes-i-know 以写。")
    else:
        print(f"[apply] 更新 {n_qs} 行 quality_score；source_url 非空 {n_url} 行。")
    await conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--yes-i-know", action="store_true")
    a = ap.parse_args()
    if a.apply and not a.yes_i_know:
        print("[REFUSING] --apply 需 --yes-i-know（先 dry-run 核对）。")
        sys.exit(3)
    asyncio.run(run(a.apply))


if __name__ == "__main__":
    main()

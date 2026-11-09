# -*- coding: utf-8 -*-
"""深度补全（确定性字段，非伪造）：source_organism / source_protein / molecular_weight。
- molecular_weight：由 sequence 用标准残基分子量精确计算（+H2O），标 computed（double 列）。
- source_organism/source_protein：从载体 name_latin / 默认映射推知（确定可知才填）。
排除守卫：永不改 batch1(pep_cat_b1)/path1(v2.0-official)/pep_b100v/pep_b100w 的 sequence/activity_type
（本任务不改这俩键，故不破坏去重）。dry-run 默认/--apply 需 --yes-i-know/幂等。"""
import argparse
import asyncio
import re
import sys

DB = "postgresql://postgres:password@localhost:5432/rmfood"

# 单字母残基单同质量（Da）
RES = {"A": 71.03711, "R": 156.10111, "N": 114.04293, "D": 115.02694, "C": 103.00919,
       "E": 129.04259, "Q": 128.05858, "G": 57.02146, "H": 137.05891, "I": 113.08406,
       "L": 113.08406, "K": 128.09496, "M": 131.04049, "F": 147.06841, "P": 97.05276,
       "S": 87.03203, "T": 101.04768, "W": 186.07931, "Y": 163.06333, "V": 99.06842,
       "U": 168.9640, "O": 237.1477}
WATER = 18.01056
# 三字母 -> 单字母（含 Hyp 羟脯氨酸）
THREE = {"Gly": "G", "Pro": "P", "Hyp": "P", "Ala": "A", "Val": "V", "Leu": "L", "Ile": "I",
         "Phe": "F", "Tyr": "Y", "Trp": "W", "Ser": "S", "Thr": "T", "Cys": "C", "Met": "M",
         "Asn": "N", "Gln": "Q", "Asp": "D", "Glu": "E", "Lys": "K", "Arg": "R", "His": "H"}
# Hyp(羟脯氨酸)残基质量（Pro 97.05 + O）≈ 113.0477；Hyp 常以三字母出现
HYP_MASS = 113.0477
# 载体 name_cn -> (默认 organism, 默认 source_protein)
CARRIER_ORG = {
    "酪蛋白肽": ("Bos taurus", "Casein"), "乳清肽": ("Bos taurus", "Whey protein"),
    "牛乳": ("Bos taurus", "Milk protein"), "蛋清肽": ("Gallus gallus", "Egg white protein"),
    "大豆肽粉": ("Glycine max", "Soy protein"), "豌豆肽": ("Pisum sativum", "Pea protein"),
    "大米肽": ("Oryza sativa", "Rice protein"), "小麦肽": ("Triticum aestivum", "Wheat protein"),
    "玉米肽": ("Zea mays", "Corn protein"), "玉米": ("Zea mays", "Corn protein"),
    "胶原蛋白肽": (None, "Collagen"),  # 组织/物种看论文（bovine/fish/squid）
    "牛骨胶原蛋白肽": ("Bos taurus", "Bovine bone collagen"),
}
# 论文标题关键词 -> organism（胶原等需细判）
TITLE_ORG = [("squid", "Squid"), ("fish", "Fish"), ("bovine", "Bos taurus"), ("cow", "Bos taurus"),
             ("salmon", "Salmon"), ("carp", "Carp"), ("croaker", "Fish"), ("sheep", "Sheep"),
             ("marine", "Marine invertebrate"), ("jellyfish", "Jellyfish")]


def calc_mw(seq):
    """单字母或三字母序列 -> 分子量（残基和 + H2O）。非标准残基/无法解析返回 None。"""
    seq = seq.strip()
    if not seq:
        return None
    if " " in seq or "-" in seq:
        # 三字母如 "Gly-Pro-Hyp"
        parts = [p for p in re.split(r"[- ]", seq) if p]
        total = 0.0
        for p in parts:
            p_cap = p.capitalize()
            if p_cap == "Hyp":
                total += HYP_MASS
            elif p_cap in THREE:
                total += RES[THREE[p_cap]]
            else:
                return None
        return round(total + WATER, 2)
    # 单字母
    if all(ch in RES for ch in seq):
        return round(sum(RES[ch] for ch in seq) + WATER, 2)
    return None


async def run(dry_run):
    import asyncpg
    conn = await asyncpg.connect(DB)
    rows = await conn.fetch(
        "SELECT b.id, b.sequence, b.source_protein, b.source_organism, b.molecular_weight, "
        "f.name_cn AS carrier, f.name_latin AS latin "
        "FROM bioactive_peptides b JOIN food_materials f ON f.id=b.food_material_id "
        "WHERE b.provenance='literature_confirmed' "
        "AND (b.source_version IS NULL OR b.source_version NOT IN ('pep_cat_b1','v2.0-official'))")
    n_mw = n_org = n_prot = 0
    for r in rows:
        sets, vals, i = [], [], 1
        # MW
        if r["molecular_weight"] is None:
            mw = calc_mw(r["sequence"])
            if mw:
                sets.append(f"molecular_weight=${i}")
                vals.append(mw)
                i += 1
                n_mw += 1
        # organism
        if not r["source_organism"]:
            org = None
            # 胶原看论文名/载体 latin
            latin = (r["latin"] or "")
            if r["carrier"] == "胶原蛋白肽":
                for kw, o in TITLE_ORG:
                    if kw in latin.lower():
                        org = o
                        break
                if org is None and latin:
                    org = latin  # 载体 name_latin 已是物种
            else:
                org = CARRIER_ORG.get(r["carrier"], (None, None))[0]
            if org:
                sets.append(f"source_organism=${i}")
                vals.append(org)
                i += 1
                n_org += 1
        # source_protein
        if not r["source_protein"]:
            prot = CARRIER_ORG.get(r["carrier"], (None, None))[1]
            if prot:
                sets.append(f"source_protein=${i}")
                vals.append(prot)
                i += 1
                n_prot += 1
        if sets and not dry_run:
            await conn.execute(
                f"UPDATE bioactive_peptides SET {', '.join(sets)}, updated_at=NOW() WHERE id=${i}",
                *vals, r["id"])
    print(f"{'将补' if dry_run else '已补'}: MW={n_mw} organism={n_org} protein={n_prot}")
    if dry_run:
        print("[dry-run] 未写库。")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--yes-i-know", action="store_true")
    a = ap.parse_args()
    if a.apply and not a.yes_i_know:
        print("[REFUSING] --apply 需 --yes-i-know。")
        sys.exit(3)
    asyncio.run(run(dry_run=not a.apply))


if __name__ == "__main__":
    main()

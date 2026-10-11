# -*- coding: utf-8 -*-
"""Test the key hypothesis: is the ACE label actually learnable from sequence,
   and does the synthetic portion carry signal or only noise?"""
import sys
import os
import random

sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

from app.services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE


def label_stats(records, name):
    pos = sum(1 for r in records if r["_label"] == 1)
    n = len(records)
    print("  %-28s n=%-5d pos=%-5d (%.1f%%)" % (name, n, pos, 100.0 * pos / max(n, 1)))


def to_rec(rec, target="ACE inhibitory"):
    seq = (rec.get("sequence") or "").upper().replace("-", "")
    at = (rec.get("activity_type") or "").lower()
    lab = 1 if target.lower() in at else 0
    return {"seq": seq, "act": rec.get("activity_type"), "_label": lab,
            "synth": bool(rec.get("is_synthetic", False))}


recs = [to_rec(r) for r in DFBP_PEPTIDE_DATABASE if len((r.get("sequence") or "")) >= 2]
real = [r for r in recs if not r["synth"]]
synth = [r for r in recs if r["synth"]]

print("=" * 78)
print("HYPOTHESIS TEST: where does the ACE signal live?")
print("=" * 78)
label_stats(recs, "ALL")
label_stats(real, "REAL only (core+hand)")
label_stats(synth, "SYNTHETIC only")

# Which activity_types exist in the synthetic block?
from collections import Counter
print()
print("  synthetic activity_type distribution:")
for at, c in Counter((r["act"] or "None") for r in synth).most_common(12):
    print("    %-34s %d" % (at[:34], c))
print()
print("  real activity_type distribution:")
for at, c in Counter((r["act"] or "None") for r in real).most_common(12):
    print("    %-34s %d" % (at[:34], c))

# Is synthetic sequence composition distinguishable between ACE and non-ACE?
def mean_hydrophobic(rs):
    hyd = set("FWYLIVM")
    vals = [sum(1 for aa in r["seq"] if aa in hyd) / max(len(r["seq"]), 1) for r in rs]
    return sum(vals) / max(len(vals), 1) if vals else 0.0


print()
print("  mean hydrophobic fraction (a real SAR signal would differ by label):")
for name, rs in (("synthetic", synth), ("real", real)):
    a = [r for r in rs if r["_label"] == 1]
    b = [r for r in rs if r["_label"] == 0]
    print("    %-10s ACE-pos=%.4f  ACE-neg=%.4f  delta=%+.4f" % (
        name, mean_hydrophobic(a), mean_hydrophobic(b),
        mean_hydrophobic(a) - mean_hydrophobic(b)))